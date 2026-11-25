/**
 * The workbench host: a token-guarded, 127.0.0.1-only HTTP + WebSocket server
 * that exposes the project's container (registries, helper docs, eval, live state).
 *
 * It never touches process.stdin or stdout, so tests can run it in-process.
 */
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import type { Socket } from 'node:net'
import { WebSocketServer, type WebSocket } from 'ws'
import { z } from 'zod'
import { allHelperInstances } from '../container.js'
import { project, registryNames, registryStacks, allRegistryStacks, helperView, findLiveInstance, methodsOf, parseArgs, displayText, commandView } from './views.js'
import { ConsoleSessions } from './console.js'
import { CommandRuns, buildArgs } from './runs.js'
import { OriginIndex } from './origins.js'
import { planCopy, planBorrow, planUnborrow, applyPlan } from './borrow.js'
import { pluginsView, planPlugin } from './plugins.js'
import type { Plan } from './changes.js'
import { EndpointIndex, ServeControl, endpointsView } from './endpoints.js'
import { DocsIndex, docsView, modelsView, docView, saveDoc } from './docs.js'
import { ChatSessions } from './chat.js'
import { fileView, saveFile, listFiles } from './files.js'
import { ToolIndex, plainParams } from './tools.js'

export type WorkbenchHostOptions = {
	lucaVersion?: string
	/** Fixed token. Defaults to a fresh uuid without dashes. */
	token?: string
	/** Port to bind. Defaults to 0 (the OS picks a free one). */
	port?: number
	/** How to start a command child. Defaults to how this process started (`childPrefix()`). */
	childPrefix?: string[]
}

export type WorkbenchHost = {
	port: number
	token: string
	close(): Promise<void>
	/** Kill every command child now. Safe in a process `exit` handler. */
	killChildren(): void
}

const MAX_DEPTH = 6
const MAX_KEYS = 100
const MAX_ARRAY = 200
const MAX_STRING = 20_000
const MAX_BODY = 1_000_000
/** A method call from the inspector gives up after this long. The call itself keeps running. */
const CALL_TIMEOUT_MS = 30_000

/** Turn any value into plain JSON. Handles cycles, functions, bigint, errors, maps, sets. Never throws. */
export function toJsonSafe(value: any, depth = 0, seen: WeakSet<object> = new WeakSet()): any {
	try {
		switch (typeof value) {
			case 'undefined': return null
			case 'function': return `[Function ${value.name || 'anonymous'}]`
			case 'symbol': return value.toString()
			case 'bigint': return value.toString()
			case 'number': return Number.isFinite(value) ? value : String(value)
			case 'string': return value.length > MAX_STRING ? value.slice(0, MAX_STRING) + `... [${value.length - MAX_STRING} more chars]` : value
			case 'boolean': return value
		}
		if (value === null) return null
		if (seen.has(value)) return '[Circular]'
		if (depth >= MAX_DEPTH) return `[${value?.constructor?.name || 'Object'}]`
		seen.add(value)
		try {
			if (value instanceof Error) return { name: value.name, message: value.message, stack: value.stack }
			if (value instanceof Date) return Number.isNaN(value.getTime()) ? 'Invalid Date' : value.toISOString()
			if (value instanceof RegExp) return value.toString()
			if (value instanceof Map) return { __type: 'Map', entries: [...value.entries()].slice(0, MAX_ARRAY).map(([k, v]) => [toJsonSafe(k, depth + 1, seen), toJsonSafe(v, depth + 1, seen)]) }
			if (value instanceof Set) return { __type: 'Set', values: [...value.values()].slice(0, MAX_ARRAY).map((v) => toJsonSafe(v, depth + 1, seen)) }
			if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) return `[${value.constructor.name} ${(value as any).byteLength} bytes]`
			if (Array.isArray(value)) {
				const out = value.slice(0, MAX_ARRAY).map((v) => toJsonSafe(v, depth + 1, seen))
				if (value.length > MAX_ARRAY) out.push(`... ${value.length - MAX_ARRAY} more items`)
				return out
			}
			// Helpers and the container are huge graphs. Show a short tag, not the graph.
			if (typeof value.shortcut === 'string' && value.state && typeof value.emit === 'function') return `[Helper ${value.shortcut}]`
			const out: Record<string, any> = {}
			let n = 0
			for (const key of Object.keys(value)) {
				if (n++ >= MAX_KEYS) { out['...'] = 'more keys omitted'; break }
				let v: any
				try { v = value[key] } catch (e: any) { v = `[Getter threw: ${e?.message}]` }
				out[key] = toJsonSafe(v, depth + 1, seen)
			}
			return out
		} finally {
			seen.delete(value)
		}
	} catch (err: any) {
		return `[Unserializable: ${err?.message}]`
	}
}

function describeType(value: any): string {
	if (value === null) return 'null'
	if (Array.isArray(value)) return 'array'
	if (typeof value === 'object') return value.constructor?.name || 'object'
	return typeof value
}

/** Same approach as `luca eval`: strip TS, scope container + enabled features + z, top-level await. */
async function runEval(container: any, code: string): Promise<any> {
	const vm = container.feature('vm')
	try {
		code = container.feature('transpiler').transformSync(code, { loader: 'ts' }).code
	} catch {
		// vm.run reports the real syntax error against the user's own code.
	}
	container.helpers.seedVirtualModules()
	const ctx: Record<string, any> = {
		container,
		z,
		require: vm.createRequireFor(container.paths.resolve('__workbench__.ts')),
	}
	for (const [name, instance] of Object.entries(container.enabledFeatures ?? {})) ctx[name] = instance

	try {
		const result = await vm.run(code, ctx)
		return { ok: true, result: toJsonSafe(result), type: describeType(result) }
	} catch (err: any) {
		const message = String(err?.message ?? err)
		let hint: string | undefined
		try { hint = vm.hintForEvalError(message, code) } catch {}
		return hint ? { ok: false, error: message, hint } : { ok: false, error: message }
	}
}

function sendJson(res: ServerResponse, status: number, body: unknown) {
	const text = JSON.stringify(body)
	res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
	res.end(text)
}

function readBody(req: IncomingMessage): Promise<string> {
	return new Promise((resolve, reject) => {
		let size = 0
		const chunks: Buffer[] = []
		req.on('data', (c: Buffer) => {
			size += c.length
			if (size > MAX_BODY) { reject(new Error('body too large')); req.destroy(); return }
			chunks.push(c)
		})
		req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
		req.on('error', reject)
	})
}

export async function createWorkbenchHost(container: any, opts: WorkbenchHostOptions = {}): Promise<WorkbenchHost> {
	const token = opts.token || String(container.utils.uuid()).replace(/-/g, '')
	const lucaVersion = opts.lucaVersion || '0.0.0'

	await container.helpers.discoverAll()

	let boundPort = 0
	const consoles = new ConsoleSessions(container)
	// Origins are read from disk once: a change to the project restarts the host.
	let originIndex: OriginIndex | undefined
	const origins = () => (originIndex ??= new OriginIndex(container))
	// Frames go through `broadcast`, which is defined below; runs start after it is.
	const runs = new CommandRuns(String(container.cwd), (frame) => broadcast(frame), opts.childPrefix)
	const endpointIndex = new EndpointIndex(container)
	const serve = new ServeControl(container, runs, (frame) => broadcast(frame))
	const docsIndex = new DocsIndex(container)
	const chats = new ChatSessions(container, (frame) => broadcast(frame))
	const tools = new ToolIndex(container)

	/** Token from a header or ?token=. Also refuses Host headers that are not loopback (DNS rebinding). */
	const authorized = (req: IncomingMessage, url: URL): boolean => {
		const host = String(req.headers.host || '')
		if (!/^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/.test(host)) return false
		const auth = String(req.headers.authorization || '')
		const supplied =
			(auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '') ||
			String(req.headers['x-workbench-token'] || '') ||
			url.searchParams.get('token') ||
			''
		return supplied.length > 0 && supplied === token
	}

	// --- WebSocket fan-out ---
	const sockets = new Set<WebSocket>()
	const attached = new Map<string, () => void>() // helper uuid -> detach
	const pendingSubscriptions = new Set<string>() // "registry.id" asked for before an instance existed

	const broadcast = (message: unknown) => {
		const text = JSON.stringify(message)
		for (const ws of sockets) {
			if (ws.readyState === 1) { try { ws.send(text) } catch {} }
		}
	}

	const splitShortcut = (shortcut: string): [string, string] | undefined => {
		const i = shortcut.indexOf('.')
		return i > 0 ? [shortcut.slice(0, i), shortcut.slice(i + 1)] : undefined
	}

	const attach = (helper: any) => {
		try {
			if (!helper || attached.has(helper.uuid)) return
			if (helper.context?.container && helper.context.container !== container) return
			const parts = splitShortcut(String(helper.shortcut || ''))
			if (!parts || typeof helper.on !== 'function') return
			const [registry, id] = parts
			if (!registryNames(container).includes(registry)) return

			// `text` is what the inspector draws; `state` / `args` stay for other readers.
			const onState = (state: any) => {
				const safe = toJsonSafe(helper.state?.current ?? state)
				broadcast({ type: 'state', registry, id, state: safe, text: displayText(safe), at: Date.now() })
			}
			helper.on('stateChange', onState)
			const offs: Array<() => void> = [() => helper.off?.('stateChange', onState)]

			const reg = container[registry]
			let names: string[] = []
			try {
				names = Object.keys(reg.introspect(id)?.events || {})
				const shape = reg.lookup(id)?.eventsSchema?.shape
				if (shape) names.push(...Object.keys(shape))
			} catch {}
			for (const name of new Set(names)) {
				if (name === 'stateChange') continue
				const fn = (...args: any[]) => {
					const safe = toJsonSafe(args)
					const text = safe.length === 0 ? '' : displayText(safe.length === 1 ? safe[0] : safe)
					broadcast({ type: 'event', registry, id, name, args: safe, text: text.length > 2000 ? text.slice(0, 2000) + '…' : text, at: Date.now() })
				}
				helper.on(name, fn)
				offs.push(() => helper.off?.(name, fn))
			}
			attached.set(helper.uuid, () => offs.forEach((f) => { try { f() } catch {} }))
		} catch (err: any) {
			console.error(`[workbench] could not attach to helper: ${err?.message}`)
		}
	}

	const attachExisting = () => {
		try { allHelperInstances().forEach(attach) } catch {}
	}

	const onFeatureEnabled = (_id: string, feature: any) => {
		attach(feature)
		pendingSubscriptions.forEach((key) => {
			const parts = splitShortcut(key)
			const live = parts && findLiveInstance(container, parts[0], parts[1])
			if (live) { attach(live); pendingSubscriptions.delete(key) }
		})
	}
	try { container.on('featureEnabled', onFeatureEnabled) } catch {}

	/**
	 * Call a method on a helper's live instance. A feature with no instance
	 * yet is created (`container.feature(id)`), as the console would. Other
	 * registries need an instance that already exists.
	 */
	const callMethod = async (registry: string, id: string, name: string, rawArgs: any): Promise<{ status: number; body: any }> => {
		const reg = registryNames(container).includes(registry) ? container[registry] : undefined
		if (!reg || !reg.has?.(id)) return { status: 404, body: { error: `unknown helper: ${registry}.${id}` } }
		let instance = findLiveInstance(container, registry, id)
		let created = false
		if (!instance && registry === 'features') {
			try { instance = container.feature(id); created = true } catch (err: any) {
				return { status: 200, body: { ok: false, error: `could not create ${registry}.${id}: ${err?.message ?? err}` } }
			}
		}
		if (!instance) return { status: 409, body: { error: `${registry}.${id} has no instance. Create one in the console first.` } }
		attach(instance)
		const fn = instance[name]
		if (typeof fn !== 'function') return { status: 404, body: { error: `${registry}.${id} has no method ${name}` } }
		let ctor: any
		try { ctor = reg.lookup(id) } catch {}
		const documented = methodsOf(ctor, introspection(registry, id)).find((m) => m.name === name)
		const args = parseArgs(rawArgs, documented ? documented.params.length : fn.length)
		const started = Date.now()
		try {
			let timer: any
			const result = await Promise.race([
				Promise.resolve(fn.apply(instance, args)),
				new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`no answer after ${CALL_TIMEOUT_MS / 1000}s`)), CALL_TIMEOUT_MS) }),
			]).finally(() => clearTimeout(timer))
			const safe = toJsonSafe(result)
			return { status: 200, body: { ok: true, call: `${id}.${name}(${args.map((a) => JSON.stringify(toJsonSafe(a))).join(', ')})`, result: safe, type: describeType(result), text: displayText(safe), ms: Date.now() - started, created } }
		} catch (err: any) {
			return { status: 200, body: { ok: false, call: `${id}.${name}(…)`, error: String(err?.message ?? err), ms: Date.now() - started, created } }
		}
	}

	const introspection = (registry: string, id: string): any => {
		try { return container[registry]?.introspect?.(id) } catch { return undefined }
	}

	// --- HTTP ---
	const routes = async (req: IncomingMessage, res: ServerResponse, url: URL) => {
		const method = req.method || 'GET'
		const path = url.pathname.replace(/\/+$/, '') || '/'
		const seg = path.split('/').filter(Boolean).map((s) => decodeURIComponent(s))

		if (method === 'GET' && path === '/project') {
			return sendJson(res, 200, project(container, lucaVersion))
		}

		if (method === 'GET' && path === '/registries') {
			return sendJson(res, 200, allRegistryStacks(container, origins()))
		}

		if (method === 'GET' && seg[0] === 'registry' && seg.length === 2) {
			const view = registryStacks(container, seg[1]!, origins())
			return view ? sendJson(res, 200, view) : sendJson(res, 404, { error: `unknown registry: ${seg[1]}` })
		}

		if (method === 'GET' && seg[0] === 'helper' && seg.length === 3) {
			const view = await helperView(container, seg[1]!, seg[2]!, toJsonSafe, origins())
			return view ? sendJson(res, 200, view) : sendJson(res, 404, { error: `unknown helper: ${seg[1]}.${seg[2]}` })
		}

		if (method === 'POST' && seg[0] === 'helper' && seg.length === 4 && seg[3] === 'call') {
			let body: any
			try { body = JSON.parse(await readBody(req) || '{}') } catch { return sendJson(res, 400, { error: 'invalid JSON body' }) }
			if (!body || typeof body.method !== 'string' || !body.method) return sendJson(res, 400, { error: 'method is required' })
			const answer = await callMethod(seg[1]!, seg[2]!, body.method, body.args)
			return sendJson(res, answer.status, answer.body)
		}

		if (method === 'POST' && path === '/eval') {
			let body: any
			try { body = JSON.parse(await readBody(req) || '{}') } catch { return sendJson(res, 400, { error: 'invalid JSON body' }) }
			if (!body || typeof body.code !== 'string' || !body.code.trim()) return sendJson(res, 400, { error: 'code is required' })
			return sendJson(res, 200, await runEval(container, body.code))
		}

		// --- Console ---
		if (method === 'POST' && path === '/console') {
			let body: any
			try { body = JSON.parse(await readBody(req) || '{}') } catch { return sendJson(res, 400, { error: 'invalid JSON body' }) }
			if (!body || typeof body.code !== 'string' || !body.code.trim()) return sendJson(res, 400, { error: 'code is required' })
			const session = typeof body.session === 'string' && body.session ? body.session : 'default'
			return sendJson(res, 200, await consoles.run(body.code, session))
		}

		if (method === 'POST' && path === '/console/complete') {
			let body: any
			try { body = JSON.parse(await readBody(req) || '{}') } catch { return sendJson(res, 400, { error: 'invalid JSON body' }) }
			if (!body || typeof body.code !== 'string') return sendJson(res, 400, { error: 'code is required' })
			const session = typeof body.session === 'string' && body.session ? body.session : 'default'
			const cursor = Number.isInteger(body.cursor) ? body.cursor : body.code.length
			return sendJson(res, 200, consoles.complete(body.code, cursor, session))
		}

		if (method === 'POST' && path === '/console/describe') {
			let body: any
			try { body = JSON.parse(await readBody(req) || '{}') } catch { return sendJson(res, 400, { error: 'invalid JSON body' }) }
			if (!body || typeof body.target !== 'string' || !body.target.trim()) return sendJson(res, 400, { error: 'target is required' })
			const session = typeof body.session === 'string' && body.session ? body.session : 'default'
			const doc = consoles.describe(body.target, session)
			return doc ? sendJson(res, 200, { doc }) : sendJson(res, 404, { error: `no docs for ${body.target}` })
		}

		if (method === 'POST' && path === '/console/reset') {
			let body: any
			try { body = JSON.parse(await readBody(req) || '{}') } catch { return sendJson(res, 400, { error: 'invalid JSON body' }) }
			const session = typeof body?.session === 'string' && body.session ? body.session : 'default'
			return sendJson(res, 200, { ok: true, session, existed: consoles.reset(session) })
		}

		// --- Commands ---
		if (method === 'GET' && seg[0] === 'command' && seg.length === 2) {
			const view = commandView(container, seg[1]!, origins())
			return view ? sendJson(res, 200, view) : sendJson(res, 404, { error: `unknown command: ${seg[1]}` })
		}

		if (method === 'POST' && seg[0] === 'command' && seg.length === 3 && seg[2] === 'run') {
			const view = commandView(container, seg[1]!)
			if (!view) return sendJson(res, 404, { error: `unknown command: ${seg[1]}` })
			let body: any
			try { body = JSON.parse(await readBody(req) || '{}') } catch { return sendJson(res, 400, { error: 'invalid JSON body' }) }
			const values = body?.values && typeof body.values === 'object' && !Array.isArray(body.values) ? body.values : {}
			const missing = view.fields.filter((f) => f.required && f.type !== 'boolean' && (values[f.name] === undefined || String(values[f.name]).trim() === ''))
			if (missing.length) return sendJson(res, 400, { error: `required: ${missing.map((f) => f.name).join(', ')}` })
			return sendJson(res, 200, runs.start(view.id, buildArgs(view.fields, values)))
		}

		if (method === 'GET' && seg[0] === 'runs' && seg.length === 2) {
			const view = runs.get(seg[1]!)
			return view ? sendJson(res, 200, view) : sendJson(res, 404, { error: `unknown run: ${seg[1]}` })
		}

		if (method === 'POST' && seg[0] === 'runs' && seg.length === 3 && seg[2] === 'stop') {
			return runs.stop(seg[1]!) ? sendJson(res, 200, { ok: true, runId: seg[1] }) : sendJson(res, 404, { error: `unknown run: ${seg[1]}` })
		}

		// --- Endpoints and the serve child ---
		if (method === 'GET' && path === '/endpoints') {
			return sendJson(res, 200, await endpointsView(endpointIndex, serve))
		}

		if (method === 'GET' && path === '/endpoints/route') {
			const m = url.searchParams.get('method') || ''
			const p = url.searchParams.get('path') || ''
			const route = await endpointIndex.find(m, p)
			return route ? sendJson(res, 200, { route, server: serve.view }) : sendJson(res, 404, { error: `no route ${m.toUpperCase()} ${p}` })
		}

		if (method === 'POST' && path === '/endpoints/request') {
			let body: any
			try { body = JSON.parse(await readBody(req) || '{}') } catch { return sendJson(res, 400, { error: 'invalid JSON body' }) }
			const route = await endpointIndex.find(String(body?.method || ''), String(body?.path || ''))
			if (!route) return sendJson(res, 404, { error: `no route ${String(body?.method || '').toUpperCase()} ${body?.path || ''}` })
			const values = body?.values && typeof body.values === 'object' && !Array.isArray(body.values) ? body.values : {}
			return sendJson(res, 200, await serve.send(route, values, typeof body?.body === 'string' ? body.body : undefined))
		}

		if (method === 'GET' && path === '/serve') {
			return sendJson(res, 200, serve.view)
		}

		if (method === 'POST' && path === '/serve/start') {
			return sendJson(res, 200, await serve.start())
		}

		if (method === 'POST' && path === '/serve/stop') {
			return sendJson(res, 200, serve.stop())
		}

		// --- Docs (contentbase) ---
		if (method === 'GET' && path === '/docs') {
			return sendJson(res, 200, await docsView(docsIndex))
		}

		if (method === 'GET' && path === '/docs/models') {
			return sendJson(res, 200, await modelsView(docsIndex))
		}

		if (method === 'GET' && path === '/docs/item') {
			const id = url.searchParams.get('id') || ''
			const view = id ? await docView(docsIndex, id) : undefined
			return view ? sendJson(res, 200, view) : sendJson(res, 404, { error: `no doc ${id}` })
		}

		if (method === 'POST' && path === '/docs/save') {
			let body: any
			try { body = JSON.parse(await readBody(req) || '{}') } catch { return sendJson(res, 400, { error: 'invalid JSON body' }) }
			const answer = await saveDoc(docsIndex, body)
			return sendJson(res, answer.status, answer.body)
		}

		// --- Files in the project folder (the file tile) ---
		if (method === 'GET' && path === '/files') {
			return sendJson(res, 200, listFiles(String(container.cwd)))
		}

		if (method === 'GET' && path === '/file') {
			const answer = fileView(String(container.cwd), url.searchParams.get('path') || '')
			return sendJson(res, answer.status, answer.body)
		}

		if (method === 'POST' && path === '/file/save') {
			let body: any
			try { body = JSON.parse(await readBody(req) || '{}') } catch { return sendJson(res, 400, { error: 'invalid JSON body' }) }
			const answer = saveFile(String(container.cwd), body)
			return sendJson(res, answer.status, answer.body)
		}

		// --- Assistants and chat ---
		if (method === 'GET' && path === '/assistants') {
			return sendJson(res, 200, await chats.assistantsView())
		}

		if (method === 'GET' && seg[0] === 'assistants' && seg.length === 3 && seg[2] === 'conversations') {
			const manager = await chats.manager()
			if (!manager.list().some((e: any) => e.name === seg[1])) return sendJson(res, 404, { error: `no assistant ${seg[1]}` })
			return sendJson(res, 200, { assistant: seg[1], conversations: await chats.conversations(seg[1]!) })
		}

		if (method === 'POST' && seg[0] === 'chat' && seg.length === 2 && ['open', 'send', 'stop'].includes(seg[1]!)) {
			let body: any
			try { body = JSON.parse(await readBody(req) || '{}') } catch { return sendJson(res, 400, { error: 'invalid JSON body' }) }
			const assistant = typeof body?.assistant === 'string' ? body.assistant : ''
			const conversationId = typeof body?.conversationId === 'string' ? body.conversationId : ''
			if (!assistant) return sendJson(res, 400, { error: 'assistant is required' })
			if (seg[1] === 'open') {
				const answer = await chats.open(assistant, conversationId)
				return sendJson(res, answer.status, answer.body)
			}
			if (!conversationId || conversationId === 'new') return sendJson(res, 400, { error: 'conversationId is required (from POST /chat/open)' })
			if (seg[1] === 'send') {
				const answer = await chats.send(assistant, conversationId, typeof body?.text === 'string' ? body.text : '')
				return sendJson(res, answer.status, answer.body)
			}
			return sendJson(res, 200, { ok: true, stopped: chats.stop(assistant, conversationId) })
		}

		// --- The project's own tools (workbench/ in the project and its plugins) ---
		if (method === 'GET' && path === '/tools') {
			return sendJson(res, 200, await tools.view())
		}

		if (method === 'GET' && seg[0] === 'tools' && seg.length === 2) {
			const answer = await tools.data(seg[1]!, Object.fromEntries([...url.searchParams.entries()].filter(([k]) => k !== 'token')))
			return sendJson(res, answer.status, answer.body)
		}

		if (method === 'POST' && seg[0] === 'tools' && seg[1] === 'actions' && seg.length === 4 && (seg[3] === 'answer' || seg[3] === 'cancel')) {
			let body: any
			try { body = JSON.parse(await readBody(req) || '{}') } catch { return sendJson(res, 400, { error: 'invalid JSON body' }) }
			const answer = seg[3] === 'cancel' ? await tools.cancel(seg[2]!) : await tools.answer(seg[2]!, body)
			return sendJson(res, answer.status, answer.body)
		}

		if (method === 'POST' && seg[0] === 'tools' && seg.length === 4 && seg[2] === 'actions') {
			let body: any
			try { body = JSON.parse(await readBody(req) || '{}') } catch { return sendJson(res, 400, { error: 'invalid JSON body' }) }
			const answer = await tools.startAction(seg[1]!, seg[3]!, { ...body, params: plainParams(body?.params) })
			return sendJson(res, answer.status, answer.body)
		}

		// --- Borrowing and plugins: a plan to show, then the same plan applied ---
		const planFor = (kind: 'borrow' | 'plugins', body: any): Plan | { error: string } => {
			if (kind === 'plugins') {
				if (!['on', 'off', 'link'].includes(body?.op)) return { error: 'op must be on, off or link' }
				return planPlugin(container, body)
			}
			switch (body?.op) {
				case 'copy': return planCopy(container, origins(), body)
				case 'borrow': return planBorrow(container, origins(), body)
				case 'unborrow': return planUnborrow(container, body)
				default: return { error: 'op must be copy, borrow or unborrow' }
			}
		}

		if (method === 'GET' && path === '/plugins') {
			return sendJson(res, 200, pluginsView(container))
		}

		if (method === 'POST' && (seg[0] === 'borrow' || seg[0] === 'plugins') && seg.length === 2 && (seg[1] === 'preview' || seg[1] === 'apply')) {
			let body: any
			try { body = JSON.parse(await readBody(req) || '{}') } catch { return sendJson(res, 400, { error: 'invalid JSON body' }) }
			const plan = planFor(seg[0] as 'borrow' | 'plugins', body)
			if ('error' in plan) return sendJson(res, 400, { error: plan.error })
			if (seg[1] === 'preview') return sendJson(res, 200, plan.view)
			if (body.digest !== plan.view.digest) return sendJson(res, 409, { error: 'The files changed since the preview. Look at it again.', view: plan.view })
			if (!plan.view.ok) return sendJson(res, 409, { error: plan.view.blocked || 'Clashes need a confirm (overwrite) first', view: plan.view })
			const written = applyPlan(container, plan)
			const home = String(container.feature('os').homedir)
			const shown = written.map((p) => (p.startsWith(home + '/') ? '~' + p.slice(home.length) : p))
			return sendJson(res, 200, { ok: true, op: plan.view.op, written: shown, restart: true, text: `${plan.view.title}: ${shown.length} change${shown.length === 1 ? '' : 's'} written. The project loads it on its next start.` })
		}

		return sendJson(res, 404, { error: 'not found' })
	}

	const server = createServer((req, res) => {
		let url: URL
		try { url = new URL(req.url || '/', 'http://127.0.0.1') } catch { return sendJson(res, 400, { error: 'bad request' }) }
		if (!authorized(req, url)) return sendJson(res, 401, { error: 'unauthorized' })
		routes(req, res, url).catch((err: any) => {
			console.error(`[workbench] ${req.method} ${req.url} failed: ${err?.stack || err}`)
			if (!res.headersSent) sendJson(res, 500, { error: String(err?.message ?? err) })
			else res.end()
		})
	})

	// --- WS upgrade ---
	const wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 })
	const openSockets = new Set<Socket>()
	server.on('connection', (s: Socket) => { openSockets.add(s); s.on('close', () => openSockets.delete(s)) })

	server.on('upgrade', (req, socket, head) => {
		let url: URL
		try { url = new URL(req.url || '/', 'http://127.0.0.1') } catch { socket.destroy(); return }
		if (!authorized(req, url)) {
			const body = JSON.stringify({ error: 'unauthorized' })
			socket.write(`HTTP/1.1 401 Unauthorized\r\ncontent-type: application/json\r\ncontent-length: ${Buffer.byteLength(body)}\r\nconnection: close\r\n\r\n${body}`)
			socket.destroy()
			return
		}
		if (url.pathname !== '/ws') {
			socket.write('HTTP/1.1 404 Not Found\r\nconnection: close\r\n\r\n')
			socket.destroy()
			return
		}
		wss.handleUpgrade(req, socket, head, (ws) => {
			sockets.add(ws)
			ws.on('close', () => sockets.delete(ws))
			ws.on('error', () => sockets.delete(ws))
			ws.on('message', (raw) => {
				try {
					const msg = JSON.parse(String(raw))
					if (msg?.type === 'subscribe' && typeof msg.registry === 'string' && typeof msg.id === 'string') {
						const live = findLiveInstance(container, msg.registry, msg.id)
						if (live) attach(live)
						else pendingSubscriptions.add(`${msg.registry}.${msg.id}`)
						ws.send(JSON.stringify({ type: 'subscribed', registry: msg.registry, id: msg.id, live: !!live }))
					}
				} catch {
					// Ignore malformed client messages.
				}
			})
			attachExisting()
			ws.send(JSON.stringify({ type: 'hello' }))
		})
	})

	await new Promise<void>((resolve, reject) => {
		server.once('error', reject)
		server.listen(opts.port ?? 0, '127.0.0.1', () => { server.off('error', reject); resolve() })
	})
	boundPort = (server.address() as any).port

	let closed: Promise<void> | undefined
	const close = () => (closed ??= new Promise<void>((resolve) => {
		try { container.off?.('featureEnabled', onFeatureEnabled) } catch {}
		runs.killAll()
		chats.closeAll()
		tools.closeAll()
		attached.forEach((detach) => detach())
		attached.clear()
		for (const ws of sockets) { try { ws.terminate() } catch {} }
		sockets.clear()
		wss.close()
		server.close(() => resolve())
		for (const s of openSockets) { try { s.destroy() } catch {} }
	}))

	return { port: boundPort, token, close, killChildren: () => runs.killAll() }
}
