/**
 * The servers of the project's `servers` registry, started and stopped
 * inside the workbench host's own container. `luca serve` (the endpoints
 * tile) is a child process; these are live helper instances, so the
 * inspector and the console see them too.
 *
 * A server the workbench starts binds 127.0.0.1 unless a host is given,
 * and every one of them stops when the host closes.
 */
import { allHelperInstances } from '../container.js'
import type { Origins } from './views.js'

export type ServerOption = { name: string; type: string; description: string }

export type ServerKind = {
	id: string
	/** `servers.express`. */
	title: string
	summary: string
	options: ServerOption[]
	/** What the start prompt says: how to type the options. */
	optionsHint: string
	/** The inspector tile of this server class. */
	address: string
	/** How many instances of it are listening now. */
	running: number
	origin?: any
}

export type ServerInstance = {
	/** The instance's uuid. */
	key: string
	id: string
	/** `express :3000`. */
	title: string
	status: 'starting' | 'listening' | 'stopped' | 'failed'
	port: number | null
	host: string | null
	/** `http://localhost:3000`, when there is something to open. */
	url: string | null
	/** `workbench`: started from this tile. `project`: the project's own code made it. */
	by: 'workbench' | 'project'
	/** The options it was made with, as one line. */
	optionsText: string
	/** Its state, as short `key value` pairs. */
	state: Array<{ name: string; value: string }>
	error: string | null
	startedAt: number | null
}

export type ServersView = { kinds: ServerKind[]; instances: ServerInstance[]; text: string }

type Tracked = { instance: any; id: string; options: Record<string, any>; status: ServerInstance['status']; error: string | null; startedAt: number; off?: () => void }

const START_TIMEOUT_MS = 120_000

function firstLine(text: unknown, max = 220): string {
	const s = typeof text === 'string' ? text.replace(/\s+/g, ' ').trim() : ''
	const m = /^(.{20,}?[.!?])(\s|$)/.exec(s)
	const line = m ? m[1]! : s
	return line.length > max ? line.slice(0, max - 1) + '…' : line
}

function short(value: any): string {
	if (value === null || value === undefined) return String(value)
	if (typeof value === 'string') return value.length > 80 ? value.slice(0, 79) + '…' : value
	if (typeof value === 'number' || typeof value === 'boolean') return String(value)
	try {
		const text = JSON.stringify(value)
		return text.length > 80 ? text.slice(0, 79) + '…' : text
	} catch {
		return '[object]'
	}
}

/**
 * The options the user typed, as an object. Empty: none. A number: the
 * port. A JSON object: as is. `port=3001 cors=false`: pairs, values read
 * as JSON when they are JSON. Throws with a line to show otherwise.
 */
export function parseServerOptions(text: unknown): Record<string, any> {
	if (text && typeof text === 'object' && !Array.isArray(text)) return { ...(text as any) }
	const raw = typeof text === 'string' ? text.trim() : typeof text === 'number' ? String(text) : ''
	if (!raw) return {}
	if (/^\d+$/.test(raw)) return { port: Number(raw) }
	if (raw.startsWith('{')) {
		let value: any
		try { value = JSON.parse(raw) } catch { throw new Error('The options are not valid JSON') }
		if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('The options must be a JSON object')
		return value
	}
	const out: Record<string, any> = {}
	for (const word of raw.split(/\s+/)) {
		const eq = word.indexOf('=')
		if (eq <= 0) throw new Error(`Cannot read "${word}". Type a port, name=value pairs, or a JSON object`)
		const value = word.slice(eq + 1)
		try { out[word.slice(0, eq)] = JSON.parse(value) } catch { out[word.slice(0, eq)] = value }
	}
	return out
}

export class ServerControl {
	private tracked = new Map<string, Tracked>()
	private notifyTimer: any

	constructor(private container: any, private emit: (frame: any) => void, private origins?: () => Origins) {}

	private introspection(id: string): any {
		try { return this.container.servers.introspect(id) } catch { return undefined }
	}

	/** One `servers` frame after a burst of changes. */
	private changed() {
		clearTimeout(this.notifyTimer)
		this.notifyTimer = setTimeout(() => { try { this.emit({ type: 'servers', at: Date.now() }) } catch {} }, 60)
	}

	private urlOf(id: string, instance: any, port: number | null, host: string | null): string | null {
		if (!port) return null
		const name = !host || host === '0.0.0.0' || host === '127.0.0.1' || host === '::' ? 'localhost' : host
		if (id === 'websocket') return `ws://${name}:${port}`
		if (id === 'mcp') {
			let transport: any
			try { transport = instance.state.get('transport') } catch {}
			return transport === 'http' ? `http://${name}:${port}/mcp` : null
		}
		return `http://${name}:${port}`
	}

	private row(instance: any, id: string, t?: Tracked): ServerInstance {
		let state: Record<string, any> = {}
		try { state = { ...(instance.state?.current ?? {}) } } catch {}
		let options: Record<string, any> = {}
		try { options = { ...(t?.options ?? instance.options ?? {}) } } catch {}
		for (const key of ['cached', '_cacheKey', 'name']) delete options[key]
		const listening = !!state.listening
		const status: ServerInstance['status'] = t && (t.status === 'starting' || t.status === 'failed') ? t.status : listening ? 'listening' : 'stopped'
		const port = typeof state.port === 'number' ? state.port : typeof options.port === 'number' ? options.port : null
		const host = typeof options.host === 'string' ? options.host : null
		const shown = status === 'listening' || status === 'starting'
		return {
			key: String(instance.uuid),
			id,
			title: `${id}${shown && port ? ` :${port}` : ''}`,
			status,
			port: shown ? port : null,
			host,
			url: status === 'listening' ? this.urlOf(id, instance, port, host) : null,
			by: t ? 'workbench' : 'project',
			optionsText: Object.keys(options).length ? Object.entries(options).map(([k, v]) => `${k}=${short(v)}`).join('  ') : 'default options',
			state: Object.entries(state).filter(([k]) => !['port', 'listening'].includes(k)).slice(0, 8).map(([name, value]) => ({ name, value: short(value) })),
			error: t?.error ?? null,
			startedAt: t?.startedAt ?? null,
		}
	}

	/** Server instances the project's own code made, that listen now. */
	private others(): Array<{ instance: any; id: string }> {
		const out: Array<{ instance: any; id: string }> = []
		let all: any[] = []
		try { all = allHelperInstances() as any[] } catch {}
		for (const h of all) {
			try {
				const shortcut = String(h?.shortcut ?? '')
				if (!shortcut.startsWith('servers.') || this.tracked.has(String(h.uuid))) continue
				if (h.context?.container && h.context.container !== this.container) continue
				if (!h.state?.get?.('listening')) continue
				out.push({ instance: h, id: shortcut.slice('servers.'.length) })
			} catch {}
		}
		return out
	}

	get view(): ServersView {
		const instances: ServerInstance[] = [
			...[...this.tracked.values()].map((t) => this.row(t.instance, t.id, t)),
			...this.others().map((o) => this.row(o.instance, o.id)),
		]
		const ids: string[] = [...(this.container.servers?.available ?? [])].sort()
		const origins = this.origins?.()
		const kinds: ServerKind[] = ids.map((id) => {
			const docs = this.introspection(id)
			const options: ServerOption[] = Object.entries<any>(docs?.options ?? {})
				// A function or a hook is not something to type on one line.
				.filter(([, raw]) => !['any', 'function'].includes(String(raw?.type ?? '')))
				.map(([name, raw]) => ({ name, type: String(raw?.type ?? 'unknown'), description: firstLine(raw?.description, 160) }))
			const names = options.map((o) => o.name)
			return {
				id,
				title: `servers.${id}`,
				summary: firstLine(docs?.description),
				options,
				optionsHint: `empty for defaults, a port, or ${names.slice(0, 3).map((n) => `${n}=…`).join(' ') || 'name=value'}`,
				address: `helper/servers/${encodeURIComponent(id)}`,
				running: instances.filter((i) => i.id === id && i.status === 'listening').length,
				...(origins ? { origin: origins.of('servers', id) } : {}),
			}
		})
		const up = instances.filter((i) => i.status === 'listening').length
		return { kinds, instances, text: up ? `${up} listening` : 'none listening' }
	}

	/** Make an instance and start it. Answers at once; the start goes on and a `servers` frame follows. */
	start(id: string, optionsInput: unknown): { status: number; body: any } {
		if (!this.container.servers?.has?.(id)) return { status: 404, body: { error: `unknown server: ${id}` } }
		let options: Record<string, any>
		try { options = parseServerOptions(optionsInput) } catch (err: any) { return { status: 400, body: { error: String(err?.message ?? err) } } }
		// The host's stdin and stdout are its line to the app. A stdio MCP server would take them.
		if (id === 'mcp') {
			if (options.transport === 'stdio') return { status: 400, body: { error: 'The workbench cannot start an MCP server on stdio. Use transport=http.' } }
			options.transport = 'http'
		}
		const known = Object.keys(this.introspection(id)?.options ?? {})
		// Local only, unless a host is asked for.
		if (options.host === undefined && (known.length === 0 || known.includes('host'))) options.host = '127.0.0.1'
		let instance: any
		try {
			instance = this.container.server(id, { ...options, cached: false })
		} catch (err: any) {
			return { status: 400, body: { error: String(err?.message ?? err) } }
		}
		const t: Tracked = { instance, id, options, status: 'starting', error: null, startedAt: Date.now() }
		const onState = () => this.changed()
		try { instance.on?.('stateChange', onState); t.off = () => instance.off?.('stateChange', onState) } catch {}
		this.tracked.set(String(instance.uuid), t)
		let timer: any
		const startOptions: Record<string, any> = {}
		if (typeof options.port === 'number') startOptions.port = options.port
		if (typeof options.host === 'string') startOptions.host = options.host
		if (id === 'mcp') startOptions.transport = 'http'
		// No port asked for: the first free one from the server's default, so
		// a second instance, or a port something else holds, is not an error.
		const begin = async () => {
			if (startOptions.port === undefined) {
				try {
					const free = await this.container.feature('networking').findOpenPort(Number(instance.port) || 3000)
					if (typeof free === 'number' && free > 0) startOptions.port = free
				} catch {}
			}
			return instance.start(startOptions)
		}
		Promise.race([
			begin(),
			new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`no answer after ${START_TIMEOUT_MS / 1000}s`)), START_TIMEOUT_MS) }),
		]).then(() => {
			t.status = 'listening'
		}).catch((err: any) => {
			t.status = 'failed'
			t.error = String(err?.message ?? err)
		}).finally(() => {
			clearTimeout(timer)
			this.changed()
		})
		this.changed()
		return { status: 200, body: { ok: true, instance: this.row(instance, id, t) } }
	}

	/** Stop an instance. One the workbench started leaves the list. */
	async stop(key: string): Promise<{ status: number; body: any }> {
		const t = this.tracked.get(key)
		const other = t ? undefined : this.others().find((o) => String(o.instance.uuid) === key)
		const instance = t?.instance ?? other?.instance
		if (!instance) return { status: 404, body: { error: 'no such server instance' } }
		try {
			if (!t || t.status !== 'failed') await instance.stop()
		} catch (err: any) {
			return { status: 500, body: { error: String(err?.message ?? err) } }
		} finally {
			if (t) { try { t.off?.() } catch {}; this.tracked.delete(key) }
			this.changed()
		}
		return { status: 200, body: { ok: true } }
	}

	/** Stop everything the workbench started. For the host's close. */
	async stopAll(): Promise<void> {
		clearTimeout(this.notifyTimer)
		const all = [...this.tracked.values()]
		this.tracked.clear()
		await Promise.all(all.map(async (t) => {
			try { t.off?.() } catch {}
			try { await Promise.race([t.instance.stop(), new Promise((r) => setTimeout(r, 3000))]) } catch {}
		}))
	}
}
