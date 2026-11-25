/**
 * Endpoints for the workbench: the routes in the project's `endpoints/`
 * folder (read in-process the way `luca serve` loads them, so the server
 * need not run), one `luca serve` child the host owns, and requests the
 * host sends to that child and shapes for display.
 */
import { readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'
import { Endpoint } from '../endpoint.js'
import { valueTree, type TreeNode } from './console.js'
import type { CommandRuns, RunView } from './runs.js'

export const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const

/** One input of a request form: a path param, a query param or a body field. */
export type RequestField = {
	name: string
	in: 'path' | 'query' | 'body'
	/** string, number, integer, boolean, enum, array, object. */
	type: string
	required: boolean
	description: string
	/** The default as the form shows it; null when there is none. */
	default: string | null
	options?: string[]
}

export type RouteView = {
	/** `GET /users/:id` */
	id: string
	method: string
	/** The express path, `/users/:id`. */
	path: string
	/** `/users/{id}` */
	openapiPath: string
	summary: string
	tags: string[]
	/** The file, relative to the project. */
	file: string
	/** The request tile after `luca://<project>/`: `request/GET/users/:id`. */
	address: string
	fields: RequestField[]
	/** True when the method sends a JSON body (not GET or DELETE). */
	body: boolean
	/** True when it takes multipart uploads: the form cannot send files. */
	upload: boolean
	/** `10 per 1 s`, when the route has a rate limit. */
	rateLimit: string | null
}

export type RouteGroup = { tag: string; routes: RouteView[] }

export type ServeStatus = 'stopped' | 'starting' | 'running' | 'failed'

export type ServeView = {
	status: ServeStatus
	port: number | null
	/** `http://localhost:3101` while starting or running. */
	url: string | null
	/** The serve child's run: its log is `GET /runs/<runId>`. */
	runId: string | null
	/** `stopped`, `starting on :3101`, `running on :3101`, `failed: …`. */
	text: string
	/** Why it failed, from the child's last lines. */
	error: string | null
}

export type EndpointsView = {
	/** Absolute folder, or null when the project has none. */
	dir: string | null
	/** `endpoints/` */
	dirDisplay: string | null
	notice: string | null
	count: number
	groups: RouteGroup[]
	/** Files that did not load, with the reason. */
	errors: Array<{ file: string; error: string }>
	server: ServeView
}

export type RequestHeader = { name: string; value: string }

export type RequestAnswer =
	| {
			ok: true
			method: string
			/** `/users/42?verbose=true`, as sent. */
			url: string
			status: number
			statusText: string
			/** `2xx` … `5xx`. */
			statusClass: string
			ms: number
			headers: RequestHeader[]
			contentType: string
			bodyKind: 'json' | 'text' | 'empty'
			/** Pretty JSON, or the text as sent back. */
			text: string
			tree: TreeNode | null
			size: number
			/** `1.2 KB` */
			sizeText: string
			/** The JSON body sent, pretty, or null. */
			sent: string | null
	  }
	| { ok: false; error: string; notRunning?: boolean; missing?: string[] }

const RESPONSE_TEXT = 200_000
const REQUEST_TIMEOUT_MS = 30_000
const START_TIMEOUT_MS = 30_000
const FIRST_PORT = 3100

/** The folder `luca serve` would use: `endpoints/`, then `src/endpoints/`. */
export function endpointsDir(cwd: string): string | null {
	for (const candidate of ['endpoints', 'src/endpoints']) {
		const dir = join(cwd, candidate)
		if (existsSync(dir) && statSync(dir).isDirectory()) return dir
	}
	return null
}

function tsFiles(dir: string): string[] {
	const out: string[] = []
	const walk = (d: string) => {
		let names: string[] = []
		try { names = readdirSync(d) } catch { return }
		for (const name of names.sort()) {
			if (name === 'node_modules' || name.startsWith('.')) continue
			const full = join(d, name)
			let st
			try { st = statSync(full) } catch { continue }
			if (st.isDirectory()) walk(full)
			else if (name.endsWith('.ts') && !name.endsWith('.d.ts')) out.push(full)
		}
	}
	walk(dir)
	return out
}

/** A JSON schema property as a form field. `anyOf` with null reads as its other branch. */
export function fieldOf(name: string, where: RequestField['in'], schema: any, required: boolean, description?: string): RequestField {
	let s = schema || {}
	if (Array.isArray(s.anyOf)) s = s.anyOf.find((b: any) => b && b.type !== 'null') || s
	let type = Array.isArray(s.type) ? s.type.find((t: string) => t !== 'null') : s.type
	const options = Array.isArray(s.enum) ? s.enum.map(String) : undefined
	if (options) type = 'enum'
	const def = schema?.default ?? s.default
	return {
		name,
		in: where,
		type: type || 'string',
		// zod lists a field with a default as required (its output always has it); the sender may leave it out.
		required: required && def === undefined,
		description: description || schema?.description || s.description || '',
		default: def === undefined ? null : typeof def === 'string' ? def : JSON.stringify(def),
		...(options ? { options } : {}),
	}
}

/** The form fields of one OpenAPI operation: path params, query params, then the JSON body's properties. */
export function fieldsOf(operation: any): RequestField[] {
	const fields: RequestField[] = []
	for (const p of operation?.parameters || []) {
		if (p.in !== 'path' && p.in !== 'query') continue
		fields.push(fieldOf(p.name, p.in, p.schema, !!p.required, p.description))
	}
	const content = operation?.requestBody?.content || {}
	const schema = content['application/json']?.schema || content['multipart/form-data']?.schema
	if (schema?.properties) {
		const required: string[] = schema.required || []
		for (const [name, prop] of Object.entries<any>(schema.properties)) {
			if (prop?.format === 'binary' || prop?.items?.format === 'binary') continue
			fields.push(fieldOf(name, 'body', prop, required.includes(name)))
		}
	}
	return fields
}

/** Group by the first tag; an untagged route goes under its first path segment (`/users`). */
export function groupRoutes(routes: RouteView[]): RouteGroup[] {
	const order = (m: string) => HTTP_METHODS.indexOf(m.toLowerCase() as any)
	const groups = new Map<string, RouteView[]>()
	for (const route of routes) {
		const tag = route.tags[0] || '/' + (route.path.split('/').filter(Boolean)[0] || '')
		if (!groups.has(tag)) groups.set(tag, [])
		groups.get(tag)!.push(route)
	}
	return [...groups.entries()]
		.sort(([a], [b]) => {
			// Tags first, then path groups, each in name order.
			const pa = a.startsWith('/'), pb = b.startsWith('/')
			return pa === pb ? a.localeCompare(b) : pa ? 1 : -1
		})
		.map(([tag, list]) => ({ tag, routes: list.sort((x, y) => x.path.localeCompare(y.path) || order(x.method) - order(y.method)) }))
}

/** Read every route in the project's endpoints folder. Modules load once per file change. */
export class EndpointIndex {
	private cache = new Map<string, { mtime: number; routes: RouteView[]; error?: string }>()

	constructor(private container: any) {}

	get cwd(): string { return String(this.container.cwd) }

	async routes(): Promise<{ dir: string | null; routes: RouteView[]; errors: Array<{ file: string; error: string }> }> {
		const dir = endpointsDir(this.cwd)
		if (!dir) return { dir: null, routes: [], errors: [] }
		const helpers = this.container.feature('helpers')
		const routes: RouteView[] = []
		const errors: Array<{ file: string; error: string }> = []
		const files = tsFiles(dir)
		for (const key of this.cache.keys()) if (!files.includes(key)) this.cache.delete(key)
		for (const file of files) {
			const rel = relative(this.cwd, file)
			let mtime = 0
			try { mtime = statSync(file).mtimeMs } catch {}
			let entry = this.cache.get(file)
			if (!entry || entry.mtime !== mtime) {
				entry = { mtime, routes: [] }
				try {
					const mod = await helpers.loadModuleExports(file, { cacheBust: true })
					const endpointModule = mod?.default && typeof mod.default === 'object' && mod.default.path ? mod.default : mod
					if (endpointModule?.path) entry.routes = await routesOf(this.container, endpointModule, file, rel)
				} catch (err: any) {
					entry.error = String(err?.message ?? err).split('\n')[0]!
				}
				this.cache.set(file, entry)
			}
			if (entry.error) errors.push({ file: rel, error: entry.error })
			routes.push(...entry.routes)
		}
		return { dir, routes, errors }
	}

	async find(method: string, path: string): Promise<RouteView | undefined> {
		const { routes } = await this.routes()
		return routes.find((r) => r.method === method.toUpperCase() && r.path === path)
	}
}

async function routesOf(container: any, mod: any, file: string, rel: string): Promise<RouteView[]> {
	// The same class `serve` mounts, so the spec matches what the server will answer.
	const ep = new Endpoint({ path: mod.path, filePath: file } as any, container.context)
	await ep.load(mod)
	const item = ep.toOpenAPIPathItem()
	const out: RouteView[] = []
	for (const m of HTTP_METHODS) {
		const op = item[m]
		if (!op) continue
		const method = m.toUpperCase()
		const limit = ep.rateLimitFor(m)
		out.push({
			id: `${method} ${mod.path}`,
			method,
			path: mod.path,
			openapiPath: ep.openAPIPath,
			summary: mod.description || '',
			tags: Array.isArray(mod.tags) ? mod.tags.map(String) : [],
			file: rel,
			address: `request/${method}${mod.path.startsWith('/') ? '' : '/'}${mod.path}`,
			fields: fieldsOf(op),
			body: m !== 'get' && m !== 'delete',
			upload: !!ep.uploadFor(m),
			rateLimit: limit ? `${limit.maxRequests} per ${limit.windowSeconds ?? 1} s` : null,
		})
	}
	return out
}

/** Text a user typed, as the value the field's type wants. Empty is left out. */
export function coerce(field: Pick<RequestField, 'type'>, text: any): any {
	if (text === undefined || text === null) return undefined
	if (typeof text !== 'string') return text
	if (text.trim() === '') return undefined
	const t = text.trim()
	switch (field.type) {
		case 'number':
		case 'integer': {
			const n = Number(t)
			return Number.isFinite(n) ? n : text
		}
		case 'boolean':
			if (/^(true|yes|on|1)$/i.test(t)) return true
			if (/^(false|no|off|0)$/i.test(t)) return false
			return text
		case 'array':
			if (t.startsWith('[')) { try { return JSON.parse(t) } catch {} }
			return t.split(',').map((s) => s.trim()).filter(Boolean)
		case 'object':
			try { return JSON.parse(t) } catch { return text }
		default:
			return text
	}
}

/**
 * The request a form means: the path with its params filled, the query
 * string, and the JSON body. A non-empty `rawBody` is sent as is instead of
 * the body fields. `missing` names required fields left empty.
 */
export function buildRequest(route: Pick<RouteView, 'method' | 'path' | 'fields' | 'body'>, values: Record<string, any>, rawBody?: string): { url: string; body: string | null; missing: string[] } {
	const missing: string[] = []
	let path = route.path
	const query = new URLSearchParams()
	const body: Record<string, any> = {}
	const raw = typeof rawBody === 'string' && rawBody.trim() ? rawBody : null
	for (const field of route.fields) {
		const v = coerce(field, values[field.name])
		if (v === undefined) {
			if (field.required && !(field.in === 'body' && raw)) missing.push(field.name)
			if (field.in === 'path') path = path.replace(new RegExp(`/:${field.name}\\??(?=/|$)`), '')
			continue
		}
		if (field.in === 'path') path = path.replace(new RegExp(`:${field.name}\\??(?=/|$)`), encodeURIComponent(String(v)))
		else if (field.in === 'query') {
			if (Array.isArray(v)) v.forEach((item) => query.append(field.name, String(item)))
			else query.append(field.name, typeof v === 'object' ? JSON.stringify(v) : String(v))
		} else body[field.name] = v
	}
	const qs = query.toString()
	const sent = route.body ? (raw ?? JSON.stringify(body)) : null
	return { url: (path || '/') + (qs ? `?${qs}` : ''), body: sent, missing }
}

export function sizeText(n: number): string {
	if (n < 1024) return `${n} B`
	if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
	return `${(n / 1024 / 1024).toFixed(1)} MB`
}

/** One `luca serve` child per host. Its state goes out as `serve` frames. */
export class ServeControl {
	view: ServeView = { status: 'stopped', port: null, url: null, runId: null, text: 'stopped', error: null }

	constructor(
		private container: any,
		private runs: CommandRuns,
		private emit: (frame: any) => void,
	) {}

	private set(next: Partial<ServeView>) {
		this.view = { ...this.view, ...next }
		const { status, port } = this.view
		this.view.text =
			status === 'running' ? `running on :${port}` :
			status === 'starting' ? `starting on :${port}` :
			status === 'failed' ? `failed${this.view.error ? `: ${this.view.error.split('\n').pop()}` : ''}` :
			'stopped'
		this.emit({ type: 'serve', serve: this.view, at: Date.now() })
	}

	async start(): Promise<ServeView> {
		if (this.view.status === 'starting' || this.view.status === 'running') return this.view
		const port = Number(await this.container.feature('networking').findOpenPort(FIRST_PORT))
		// `--no-open`: serve opens a browser by default.
		const run = this.runs.start('serve', ['--port', String(port), '--no-open'], (v) => this.exited(v))
		this.set({ status: 'starting', port, url: `http://localhost:${port}`, runId: run.runId, error: null })
		void this.probe(run.runId, port)
		return this.view
	}

	stop(): ServeView {
		if (this.view.runId && (this.view.status === 'starting' || this.view.status === 'running')) this.runs.stop(this.view.runId)
		return this.view
	}

	get running(): boolean { return this.view.status === 'running' }

	private async probe(runId: string, port: number) {
		const deadline = Date.now() + START_TIMEOUT_MS
		while (Date.now() < deadline) {
			if (this.view.runId !== runId || this.view.status !== 'starting') return
			try {
				await fetch(`http://127.0.0.1:${port}/openapi.json`, { signal: AbortSignal.timeout(1000) })
				if (this.view.runId === runId && this.view.status === 'starting') this.set({ status: 'running' })
				return
			} catch {}
			await new Promise((r) => setTimeout(r, 200))
		}
		if (this.view.runId === runId && this.view.status === 'starting') {
			this.set({ status: 'failed', error: `no answer on :${port} after ${START_TIMEOUT_MS / 1000} s` })
			this.runs.stop(runId)
		}
	}

	private exited(v: RunView) {
		if (v.runId !== this.view.runId) return
		if (this.view.status === 'failed') return
		if (v.stopped) return this.set({ status: 'stopped', url: null })
		this.set({ status: 'failed', url: null, error: this.runs.tail(v.runId) || v.statusText })
	}

	/** Send one request to the serve child and shape the answer. */
	async send(route: RouteView, values: Record<string, any>, rawBody?: string): Promise<RequestAnswer> {
		if (!this.running || !this.view.port) return { ok: false, notRunning: true, error: 'The server is not running' }
		const built = buildRequest(route, values, rawBody)
		if (built.missing.length) return { ok: false, missing: built.missing, error: `required: ${built.missing.join(', ')}` }
		const started = Date.now()
		let res: Response
		try {
			res = await fetch(`http://127.0.0.1:${this.view.port}${built.url}`, {
				method: route.method,
				headers: built.body !== null ? { 'content-type': 'application/json', accept: 'application/json' } : { accept: 'application/json' },
				body: built.body ?? undefined,
				signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
				redirect: 'manual',
			})
		} catch (err: any) {
			return { ok: false, error: err?.name === 'TimeoutError' ? `no answer after ${REQUEST_TIMEOUT_MS / 1000} s` : String(err?.message ?? err) }
		}
		const raw = await res.text()
		const ms = Date.now() - started
		const contentType = res.headers.get('content-type') || ''
		let bodyKind: 'json' | 'text' | 'empty' = raw.length === 0 ? 'empty' : 'text'
		let text = raw
		let tree: TreeNode | null = null
		if (raw.length && /json/i.test(contentType)) {
			try {
				const parsed = JSON.parse(raw)
				bodyKind = 'json'
				text = JSON.stringify(parsed, null, 2)
				tree = valueTree(parsed)
				// A response is small and read whole: open the second level too.
				for (const child of tree.children ?? []) if (child.children) child.open = true
			} catch {}
		}
		if (text.length > RESPONSE_TEXT) text = text.slice(0, RESPONSE_TEXT) + `\n… ${text.length - RESPONSE_TEXT} more characters`
		const headers: RequestHeader[] = []
		res.headers.forEach((value, name) => headers.push({ name, value }))
		headers.sort((a, b) => a.name.localeCompare(b.name))
		let sent: string | null = null
		if (built.body !== null) {
			try { sent = JSON.stringify(JSON.parse(built.body), null, 2) } catch { sent = built.body }
		}
		return {
			ok: true,
			method: route.method,
			url: built.url,
			status: res.status,
			statusText: res.statusText,
			statusClass: `${Math.floor(res.status / 100)}xx`,
			ms,
			headers,
			contentType,
			bodyKind,
			text,
			tree,
			size: Buffer.byteLength(raw),
			sizeText: sizeText(Buffer.byteLength(raw)),
			sent,
		}
	}
}

/** `GET /endpoints`: the whole tile. */
export async function endpointsView(index: EndpointIndex, serve: ServeControl): Promise<EndpointsView> {
	const { dir, routes, errors } = await index.routes()
	const cwd = index.cwd
	return {
		dir,
		dirDisplay: dir ? relative(cwd, dir) + '/' : null,
		notice: dir ? (routes.length || errors.length ? null : `No routes in ${relative(cwd, dir)}/ yet. A file there exports a path and a handler per method.`) : 'This project has no endpoints/ folder.',
		count: routes.length,
		groups: groupRoutes(routes),
		errors,
		server: serve.view,
	}
}
