/**
 * Canvases for the workbench: a blank page an assistant draws on.
 *
 * A canvas is a page the host serves at `/canvas/<id>/`. It loads the Luca
 * web runtime (`dist/browser.mjs`, else the same version from unpkg) and
 * links back to the host over `/canvas/<id>/link`. The host sends code to
 * eval; the page answers with the result. The page can never eval in the
 * host: it can only answer, report events, and read a short list of the
 * host's read-only routes.
 *
 * Each canvas has its own key. The key opens the canvas page, its link and
 * the read-only routes. It never opens the host's own token routes.
 *
 * The page is locked down with a CSP header: scripts come from the host
 * itself and from unpkg only, and it connects only to loopback, `*.ts.net`
 * and unpkg. Luca Desktop adds a content rule list on top.
 *
 * Code that ran without an error is kept (in the cache folder), so a page
 * that reloads, or a canvas that opens again after a restart, draws the same.
 */
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { WebSocket } from 'ws'
import { z } from 'zod'

type Broadcast = (frame: Record<string, unknown>) => void

/** Routes the canvas key opens, GET only. All of them are read-only. */
export const CANVAS_READ_ROUTES: RegExp[] = [
	/^\/project$/,
	/^\/registries$/,
	/^\/registry\/[^/]+$/,
	/^\/helper\/[^/]+\/[^/]+$/,
	/^\/docs$/,
	/^\/docs\/models$/,
	/^\/docs\/item$/,
	/^\/servers$/,
	/^\/endpoints$/,
	/^\/serve$/,
]

/** Hosts a canvas may reach, beside its own origin. */
const LOOPBACK = ['http://127.0.0.1:*', 'ws://127.0.0.1:*', 'http://localhost:*', 'ws://localhost:*']
// CSP matches host names only, so Tailscale is reachable by MagicDNS name, not by 100.x address.
const TAILNET = ['http://*.ts.net:*', 'https://*.ts.net', 'ws://*.ts.net:*', 'wss://*.ts.net']
const UNPKG = 'https://unpkg.com'

/** The Content-Security-Policy of a canvas page. Pure. */
export function canvasCsp(): string {
	const local = [...LOOPBACK, ...TAILNET].join(' ')
	return [
		`default-src 'none'`,
		`script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval' ${UNPKG}`,
		`style-src 'self' 'unsafe-inline' ${UNPKG}`,
		`img-src 'self' data: blob: ${UNPKG} ${local}`,
		`media-src 'self' data: blob: ${UNPKG} ${local}`,
		`font-src 'self' data: ${UNPKG}`,
		`connect-src 'self' ${UNPKG} ${local}`,
		`worker-src 'self' blob:`,
		`frame-src 'self' blob: data: ${local}`,
		`object-src 'none'`,
		`base-uri 'none'`,
		`form-action 'none'`,
	].join('; ')
}

const ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,47}$/
const MAX_LOG = 200
const MAX_EVENTS = 100
const MAX_CODE = 200_000
const EVAL_TIMEOUT_MS = 30_000
const CONNECT_WAIT_MS = 10_000
const DESKTOP_SNAPSHOT_WAIT_MS = 4_000

export type CanvasEvent = { seq: number; name: string; data: unknown; at: number }

type Pending = { resolve: (value: any) => void; timer: ReturnType<typeof setTimeout> }

type Canvas = {
	id: string
	title: string
	key: string
	createdAt: string
	/** Code that ran without an error, in order. Replayed when the page loads again. */
	log: string[]
	events: CanvasEvent[]
	seq: number
	ws?: WebSocket
	size?: { width: number; height: number }
	/** Resolves the waiters for the page's next link. */
	waiters: Array<() => void>
	pending: Map<string, Pending>
	replaying: boolean
	/** The page said hello and its replay is done: evals may go. */
	ready: boolean
}

export type CanvasView = {
	id: string
	title: string
	open: boolean
	width: number | null
	height: number | null
	evals: number
	createdAt: string
	/** The page, with its key. Open it in Luca Desktop or a browser. */
	url: string
}

/** `My Chart!` -> `my-chart`. Pure. */
export function canvasSlug(text: string): string {
	return String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
}

/** The page's HTML. The boot script is a file, so the CSP needs no inline script. */
export function canvasHtml(id: string, title: string, key: string): string {
	const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))
	return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<link rel="stylesheet" href="/canvas/${id}/canvas.css?key=${key}">
</head>
<body>
<div id="stage"><canvas id="canvas"></canvas></div>
<script type="module" src="/canvas/${id}/boot.js?key=${key}"></script>
</body>
</html>
`
}

export const CANVAS_CSS = `html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: #fff; color: #111; font: 14px -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif; }
#stage { position: absolute; inset: 0; overflow: hidden; }
#canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
#canvas-status { position: fixed; right: 8px; bottom: 6px; font: 11px ui-monospace, Menlo, monospace; color: #888; pointer-events: none; }
`

/**
 * The page's boot module. It builds the web container, sets the globals the
 * assistant's code uses, and answers the host over the link.
 */
export function canvasBoot(id: string): string {
	return `// Luca canvas ${id}. The host evals code here; this page never evals in the host.
const params = new URLSearchParams(location.search)
const key = new URL(import.meta.url).searchParams.get('key') || params.get('key') || ''
const runtime = await import('/canvas/runtime/luca.mjs?key=' + encodeURIComponent(key))
const container = runtime.default || window.luca
window.luca = container
window.container = container

const stage = document.getElementById('stage')
const canvas = document.getElementById('canvas')
window.stage = stage
window.canvas = canvas
// The first getContext call decides the kind, so ctx is made on first use: 'webgl' stays possible.
// ctx draws in CSS pixels: it is scaled by devicePixelRatio, so ctx.fillRect(0, 0, stage.clientWidth, stage.clientHeight) fills the stage.
Object.defineProperty(window, 'ctx', { configurable: true, get() {
  const c = canvas.getContext('2d')
  if (!canvas.__scaled) { canvas.__scaled = true; c.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0) }
  return c
} })
window.dpr = window.devicePixelRatio || 1

const status = document.createElement('div')
status.id = 'canvas-status'
document.body.appendChild(status)
const setStatus = (text) => { status.textContent = text }

function fit() {
  const dpr = window.devicePixelRatio || 1
  const w = Math.max(1, Math.round(stage.clientWidth * dpr))
  const h = Math.max(1, Math.round(stage.clientHeight * dpr))
  if (canvas.width === w && canvas.height === h) return
  // Resizing a canvas clears it: keep what was drawn.
  let copy = null
  if (canvas.width > 1 && canvas.height > 1 && canvas.__kind !== 'webgl') {
    try { copy = document.createElement('canvas'); copy.width = canvas.width; copy.height = canvas.height; copy.getContext('2d').drawImage(canvas, 0, 0) } catch { copy = null }
  }
  canvas.width = w
  canvas.height = h
  if (canvas.__kind === '2d') {
    const c = canvas.getContext('2d')
    if (copy) { try { c.drawImage(copy, 0, 0) } catch {} }
    if (canvas.__scaled) c.setTransform(dpr, 0, 0, dpr, 0, 0)
  }
}
const getContext = canvas.getContext.bind(canvas)
canvas.getContext = (kind, opts) => { canvas.__kind = kind; return getContext(kind, opts) }
fit()

const assetLoader = container.feature('assetLoader')
window.assetLoader = assetLoader
/** unpkg('d3@7') imports an ES module; unpkg('lodash', '_') loads a script and returns its global. */
window.unpkg = (pkg, globalName) => globalName ? assetLoader.unpkg(pkg, globalName) : assetLoader.importModule(pkg)
window.loadStylesheet = (href) => assetLoader.constructor.loadStylesheet(/^https?:/.test(href) ? href : 'https://unpkg.com/' + href)

/** Read-only routes of the workbench host: workbench.get('/registries'). */
window.workbench = {
  origin: location.origin,
  async get(path, query) {
    const url = new URL(path, location.origin)
    for (const [k, v] of Object.entries(query || {})) url.searchParams.set(k, String(v))
    const res = await fetch(url, { headers: { 'x-canvas-key': key } })
    const body = await res.json().catch(() => null)
    if (!res.ok) throw new Error((body && body.error) || ('workbench answered ' + res.status))
    return body
  },
}

/** Clear the stage now: the default canvas is wiped, everything else on the stage goes. Saved code still runs on reload (resetCanvas drops it). */
window.clear = () => {
  for (const el of [...stage.children]) if (el !== canvas) el.remove()
  if (canvas.__kind !== 'webgl' && canvas.__kind !== 'webgl2') canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height)
}

let ws = null
const outbox = []
function send(msg) {
  const text = JSON.stringify(msg)
  if (ws && ws.readyState === 1) ws.send(text)
  else outbox.push(text)
}

/** Tell the assistant something happened: emit('clicked', { x, y }). */
window.emit = (name, data) => send({ type: 'event', name: String(name), data: safe(data) })

function safe(value, depth = 0, seen = new WeakSet()) {
  try {
    if (value === undefined) return null
    if (value === null || typeof value === 'boolean' || typeof value === 'string') return typeof value === 'string' && value.length > 20000 ? value.slice(0, 20000) + '…' : value
    if (typeof value === 'number') return Number.isFinite(value) ? value : String(value)
    if (typeof value === 'bigint' || typeof value === 'symbol') return String(value)
    if (typeof value === 'function') return '[Function ' + (value.name || 'anonymous') + ']'
    if (typeof Node !== 'undefined' && value instanceof Node) return '[' + (value.constructor && value.constructor.name || 'Node') + (value.id ? ' #' + value.id : '') + ']'
    if (value instanceof Error) return { name: value.name, message: value.message, stack: value.stack }
    if (seen.has(value)) return '[Circular]'
    if (depth >= 5) return '[' + (value.constructor && value.constructor.name || 'Object') + ']'
    seen.add(value)
    if (Array.isArray(value)) return value.slice(0, 200).map((v) => safe(v, depth + 1, seen))
    if (ArrayBuffer.isView(value)) return '[' + value.constructor.name + ' ' + value.byteLength + ' bytes]'
    if (value instanceof Map) return { __type: 'Map', entries: [...value.entries()].slice(0, 100).map(([k, v]) => [safe(k, depth + 1, seen), safe(v, depth + 1, seen)]) }
    if (value instanceof Set) return { __type: 'Set', values: [...value].slice(0, 100).map((v) => safe(v, depth + 1, seen)) }
    if (typeof value.shortcut === 'string' && typeof value.emit === 'function') return '[Helper ' + value.shortcut + ']'
    const out = {}
    let n = 0
    for (const k of Object.keys(value)) { if (n++ >= 100) { out['…'] = 'more keys'; break } try { out[k] = safe(value[k], depth + 1, seen) } catch (e) { out[k] = '[threw]' } }
    return out
  } catch (e) { return '[Unserializable]' }
}

const AsyncFunction = (async () => {}).constructor
function compile(code) {
  const trimmed = code.trim().replace(/;+\\s*$/, '')
  // An expression gives its value back; anything else runs as a function body (use return).
  try { return new AsyncFunction('return (\\n' + trimmed + '\\n)') } catch {}
  return new AsyncFunction(code)
}

async function run(code) {
  const logs = []
  const orig = {}
  for (const level of ['log', 'info', 'warn', 'error']) {
    orig[level] = console[level]
    console[level] = (...args) => { logs.push(level + ': ' + args.map((a) => typeof a === 'string' ? a : JSON.stringify(safe(a))).join(' ')); orig[level].apply(console, args) }
  }
  try {
    const value = await compile(code)()
    return { ok: true, value: safe(value), kind: value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value, logs }
  } catch (err) {
    return { ok: false, error: String(err && err.message || err), stack: err && err.stack ? String(err.stack).split('\\n').slice(0, 6).join('\\n') : undefined, logs }
  } finally {
    for (const level of Object.keys(orig)) console[level] = orig[level]
  }
}

function snapshot() {
  // The page alone can only copy canvases. Luca Desktop takes a real screenshot.
  const all = [...document.querySelectorAll('canvas')].filter((c) => c.width > 1 && c.height > 1 && c.id !== '__snap')
  if (!all.length) return { error: 'no canvas to copy' }
  const out = document.createElement('canvas')
  out.id = '__snap'
  out.width = canvas.width
  out.height = canvas.height
  const g = out.getContext('2d')
  g.fillStyle = getComputedStyle(document.body).backgroundColor || '#fff'
  g.fillRect(0, 0, out.width, out.height)
  const box = stage.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1
  for (const c of all) {
    const r = c.getBoundingClientRect()
    try { g.drawImage(c, (r.left - box.left) * dpr, (r.top - box.top) * dpr, r.width * dpr, r.height * dpr) } catch {}
  }
  return { dataUrl: out.toDataURL('image/png'), width: out.width, height: out.height, partial: document.querySelectorAll('svg, img, div:not(#stage):not(#canvas-status)').length > 0 }
}

window.addEventListener('error', (e) => send({ type: 'event', name: 'error', data: { message: e.message, source: e.filename, line: e.lineno } }))
window.addEventListener('unhandledrejection', (e) => send({ type: 'event', name: 'error', data: { message: String(e.reason && e.reason.message || e.reason) } }))
// The stage can start at 0x0 (a hidden tile) and change any time: follow it, not the window.
let lastSize = ''
new ResizeObserver(() => {
  fit()
  const size = stage.clientWidth + 'x' + stage.clientHeight
  if (size !== lastSize) { lastSize = size; send({ type: 'size', width: stage.clientWidth, height: stage.clientHeight }) }
}).observe(stage)

let attempts = 0
function connect() {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
  ws = new WebSocket(proto + '//' + location.host + '/canvas/${id}/link?key=' + encodeURIComponent(key))
  ws.onopen = () => {
    attempts = 0
    setStatus('')
    ws.send(JSON.stringify({ type: 'hello', width: stage.clientWidth, height: stage.clientHeight, fresh: !window.__linked }))
    window.__linked = true
    while (outbox.length) ws.send(outbox.shift())
  }
  ws.onmessage = async (event) => {
    let msg
    try { msg = JSON.parse(event.data) } catch { return }
    if (msg.type === 'eval') {
      const answer = await run(String(msg.code || ''))
      send({ type: 'result', requestId: msg.requestId, ...answer })
    } else if (msg.type === 'snapshot') {
      send({ type: 'snapshot', requestId: msg.requestId, ...snapshot() })
    } else if (msg.type === 'reload') {
      location.reload()
    } else if (msg.type === 'status') {
      setStatus(String(msg.text || ''))
    }
  }
  ws.onclose = () => {
    setStatus('host gone, reconnecting…')
    setTimeout(connect, Math.min(5000, 300 * Math.pow(2, attempts++)))
  }
}
connect()
`
}

/** Where the Luca web runtime is on this machine, if it is. */
function findWebBundle(container: any): string | undefined {
	const fs = container.feature('fs')
	const paths = container.paths
	const candidates: string[] = []
	if (process.env.LUCA_WEB_BUNDLE) candidates.push(process.env.LUCA_WEB_BUNDLE)
	// A compiled `dist/luca` has `dist/browser.mjs` beside it.
	try { candidates.push(paths.resolve(paths.dirname(process.execPath), 'browser.mjs')) } catch {}
	// Run from source: `<repo>/src/workbench/canvas.ts` -> `<repo>/dist/browser.mjs`.
	try {
		const here = new URL(import.meta.url)
		if (here.protocol === 'file:') candidates.push(paths.resolve(decodeURIComponent(here.pathname), '..', '..', '..', 'dist', 'browser.mjs'))
	} catch {}
	try { candidates.push(paths.resolve(container.feature('os').homedir, '.luca', 'web', 'browser.mjs')) } catch {}
	return candidates.find((p) => { try { return fs.exists(p) && !fs.isDirectory(p) } catch { return false } })
}

/**
 * A tool's answer as MCP content: text, plus an image part for each data URL
 * in `images` (what `canvasSnapshot` returns). Pure.
 */
export function toMcpContent(result: any): { content: any[]; isError?: boolean } {
	if (typeof result === 'string') return { content: [{ type: 'text', text: result }] }
	const { images, ...rest } = result && typeof result === 'object' && !Array.isArray(result) ? result : { images: undefined, value: result }
	const content: any[] = [{ type: 'text', text: JSON.stringify(Array.isArray(result) ? result : rest) }]
	for (const url of Array.isArray(images) ? images : []) {
		const m = /^data:([^;,]+);base64,(.*)$/s.exec(String(url))
		if (m) content.push({ type: 'image', mimeType: m[1], data: m[2] })
	}
	return { content, ...(result && result.ok === false ? { isError: true } : {}) }
}

export class Canvases {
	private canvases = new Map<string, Canvas>()
	private snapshots = new Map<string, Pending>()
	private bundlePath: string | undefined | null = null
	private loaded = false
	/** One MCP server per chat (`''` for none), so a canvas it opens is tagged with that chat. */
	private mcpHandles = new Map<string, Promise<(req: any, res: any, body?: any) => Promise<void>>>()
	private eventListeners: Array<(id: string, name: string, data: unknown) => void> = []
	private readyListeners: Array<(id: string) => void> = []
	/**
	 * The bearer token of `/mcp/canvas`, the canvas tools for a coding agent
	 * (Claude Code, Codex) an assistant runs on. It opens that route only.
	 */
	readonly mcpToken: string

	constructor(
		private container: any,
		private broadcast: Broadcast,
		private opts: { lucaVersion: string; port: () => number },
	) {
		this.mcpToken = String(container.utils.uuid()).replace(/-/g, '')
	}

	/**
	 * The MCP server entry a coding-agent session gets, so its model can use
	 * the canvas tools: `{ 'luca-canvas': { type: 'http', url, headers } }`.
	 * `chat` (the conversation id) rides in the URL, so Luca Desktop opens
	 * the canvases it makes beside that chat.
	 */
	agentMcpServers(chat?: string): Record<string, any> {
		const query = chat ? `?chat=${encodeURIComponent(chat)}` : ''
		return {
			'luca-canvas': {
				type: 'http',
				url: `http://127.0.0.1:${this.opts.port()}/mcp/canvas${query}`,
				headers: { Authorization: `Bearer ${this.mcpToken}` },
			},
		}
	}

	/** True when a request carries the MCP token. */
	mcpAuthorized(req: IncomingMessage): boolean {
		const auth = String(req.headers.authorization || '')
		return auth.toLowerCase().startsWith('bearer ') && auth.slice(7).trim() === this.mcpToken
	}

	/** The `/mcp/canvas` request handler: the canvas tools as an MCP server over streamable HTTP. */
	mcpHandler(chat = ''): Promise<(req: any, res: any, body?: any) => Promise<void>> {
		let handle = this.mcpHandles.get(chat)
		if (handle) return handle
		handle = (async () => {
			const mcp = this.container.server('mcp', { serverName: 'luca-canvas', serverVersion: this.opts.lucaVersion })
			const { schemas, handlers } = this.toTools({ chat: chat || undefined })
			for (const [name, schema] of Object.entries(schemas)) {
				mcp.tool(name, {
					description: (schema as any).description || name,
					schema: schema as any,
					handler: async (args: any) => toMcpContent(await (handlers as any)[name](args)),
				})
			}
			return mcp.requestHandler()
		})()
		this.mcpHandles.set(chat, handle)
		return handle
	}

	/** Hear every `emit(name, data)` a page sends. The guides answer their buttons this way. */
	onPageEvent(fn: (id: string, name: string, data: unknown) => void) { this.eventListeners.push(fn) }

	/** Hear a page that just linked and finished its replay: what draws with `keep: false` draws again here. */
	onPageReady(fn: (id: string) => void) { this.readyListeners.push(fn) }

	// --- Storage ---

	/** Saved canvases live in the cache folder, one JSON file each, per project. */
	get storeDir(): string {
		const os = this.container.feature('os')
		return this.container.paths.resolve(os.cacheDir, 'luca-canvases', String(this.container.utils.hashObject(this.container.cwd)))
	}

	private load() {
		if (this.loaded) return
		this.loaded = true
		const fs = this.container.feature('fs')
		try {
			if (!fs.exists(this.storeDir)) return
			for (const file of fs.readdirSync(this.storeDir)) {
				if (!file.endsWith('.json')) continue
				try {
					const saved = fs.readJson(this.container.paths.resolve(this.storeDir, file))
					if (!saved?.id || !ID_PATTERN.test(saved.id)) continue
					this.canvases.set(saved.id, this.fresh(saved.id, String(saved.title || saved.id), saved.key, saved.createdAt, Array.isArray(saved.log) ? saved.log.map(String) : []))
				} catch {}
			}
		} catch {}
	}

	private save(c: Canvas) {
		try {
			const fs = this.container.feature('fs')
			fs.ensureFolder(this.storeDir)
			fs.writeJson(this.container.paths.resolve(this.storeDir, `${c.id}.json`), { id: c.id, title: c.title, key: c.key, createdAt: c.createdAt, log: c.log })
		} catch (err: any) {
			console.error(`[workbench] could not save canvas ${c.id}: ${err?.message}`)
		}
	}

	private fresh(id: string, title: string, key?: string, createdAt?: string, log: string[] = []): Canvas {
		return {
			id,
			title,
			key: typeof key === 'string' && /^[a-f0-9]{32}$/.test(key) ? key : String(this.container.utils.uuid()).replace(/-/g, ''),
			createdAt: createdAt || new Date().toISOString(),
			log,
			events: [],
			seq: 0,
			waiters: [],
			pending: new Map(),
			replaying: false,
			ready: false,
		}
	}

	// --- Views ---

	private view(c: Canvas): CanvasView {
		return {
			id: c.id,
			title: c.title,
			open: !!c.ws && c.ws.readyState === 1,
			width: c.size?.width ?? null,
			height: c.size?.height ?? null,
			evals: c.log.length,
			createdAt: c.createdAt,
			url: `http://127.0.0.1:${this.opts.port()}/canvas/${c.id}/?key=${c.key}`,
		}
	}

	list(): CanvasView[] {
		this.load()
		return [...this.canvases.values()].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).map((c) => this.view(c))
	}

	get(id: string): CanvasView | undefined {
		this.load()
		const c = this.canvases.get(id)
		return c ? this.view(c) : undefined
	}

	/**
	 * Make a canvas, or give back the one with that id. `open` asks Luca
	 * Desktop to show it (a `canvas-open` frame). `chat` is the conversation
	 * that asked: Desktop groups the canvas with that chat's tile.
	 */
	create(input: { id?: string; title?: string; open?: boolean; chat?: string } = {}): { status: number; body: any } {
		this.load()
		const title = String(input.title || '').trim() || 'Canvas'
		let id = String(input.id || '').trim() || canvasSlug(title) || 'canvas'
		if (!ID_PATTERN.test(id)) return { status: 400, body: { error: 'a canvas id is lowercase letters, digits and dashes' } }
		if (!input.id) {
			// A new canvas from a title gets a free id: `chart`, `chart-2`.
			let n = 2
			const base = id
			while (this.canvases.has(id)) id = `${base}-${n++}`
		}
		let c = this.canvases.get(id)
		const created = !c
		if (!c) {
			c = this.fresh(id, title)
			this.canvases.set(id, c)
			this.save(c)
		}
		if (input.open !== false) this.broadcastOpen(c, input.chat)
		return { status: 200, body: { ok: true, created, canvas: this.view(c) } }
	}

	private broadcastOpen(c: { id: string; title: string }, chat?: string) {
		this.broadcast({ type: 'canvas-open', id: c.id, text: c.title, ...(chat ? { conversationId: chat } : {}), at: Date.now() })
	}

	/** Forget a canvas: its saved code too. Its page, if open, is told to reload into nothing. */
	remove(id: string): boolean {
		this.load()
		const c = this.canvases.get(id)
		if (!c) return false
		this.canvases.delete(id)
		try { c.ws?.close() } catch {}
		try {
			const fs = this.container.feature('fs')
			const file = this.container.paths.resolve(this.storeDir, `${id}.json`)
			if (fs.exists(file)) fs.rmSync(file, { force: true })
		} catch {}
		this.broadcast({ type: 'canvas-closed', id, at: Date.now() })
		return true
	}

	/** Drop the saved code and reload the page: a blank canvas with the same id. */
	reset(id: string): boolean {
		this.load()
		const c = this.canvases.get(id)
		if (!c) return false
		c.log = []
		c.events = []
		this.save(c)
		this.sendTo(c, { type: 'reload' })
		return true
	}

	events(id: string, since = 0): { status: number; body: any } {
		this.load()
		const c = this.canvases.get(id)
		if (!c) return { status: 404, body: { error: `no canvas ${id}` } }
		return { status: 200, body: { id, events: c.events.filter((e) => e.seq > since), last: c.seq } }
	}

	// --- Auth ---

	/** The canvas a key opens, if the key is right for it. */
	private byKey(id: string, key: string): Canvas | undefined {
		this.load()
		const c = this.canvases.get(id)
		return c && key && key === c.key ? c : undefined
	}

	/** True when a request carries the key of some canvas. For the read-only routes. */
	keyOpensReadRoute(req: IncomingMessage, url: URL): boolean {
		if ((req.method || 'GET') !== 'GET') return false
		const path = url.pathname.replace(/\/+$/, '') || '/'
		if (!CANVAS_READ_ROUTES.some((r) => r.test(path))) return false
		const key = String(req.headers['x-canvas-key'] || url.searchParams.get('key') || '')
		if (!key) return false
		this.load()
		for (const c of this.canvases.values()) if (c.key === key) return true
		return false
	}

	// --- The page ---

	/**
	 * Answer a canvas page request (`/canvas/...`). False when the path is
	 * not a canvas path, so the host goes on to its own routes.
	 */
	servePage(req: IncomingMessage, res: ServerResponse, url: URL): boolean {
		const seg = url.pathname.split('/').filter(Boolean)
		if (seg[0] !== 'canvas') return false
		const key = url.searchParams.get('key') || String(req.headers['x-canvas-key'] || '')
		const send = (status: number, type: string, body: string | Buffer, extra: Record<string, string> = {}) => {
			res.writeHead(status, {
				'content-type': type,
				'cache-control': 'no-store',
				'content-security-policy': canvasCsp(),
				'x-content-type-options': 'nosniff',
				'referrer-policy': 'no-referrer',
				...extra,
			})
			res.end(body)
		}
		if ((req.method || 'GET') !== 'GET') { send(405, 'text/plain', 'GET only'); return true }

		// The runtime: any canvas key opens it.
		if (seg[1] === 'runtime' && seg[2] === 'luca.mjs' && seg.length === 3) {
			this.load()
			if (![...this.canvases.values()].some((c) => c.key === key)) { send(401, 'text/plain', 'unauthorized'); return true }
			if (this.bundlePath === null) this.bundlePath = findWebBundle(this.container)
			if (this.bundlePath) {
				try {
					send(200, 'text/javascript; charset=utf-8', this.container.feature('fs').readFile(this.bundlePath, null) as Buffer)
					return true
				} catch {}
			}
			// No local build: the same version from unpkg, which the CSP allows.
			send(302, 'text/plain', '', { location: `${UNPKG}/luca@${this.opts.lucaVersion}/dist/browser.mjs` })
			return true
		}

		const id = seg[1] || ''
		const c = this.byKey(id, key)
		if (!c) { send(401, 'text/plain', 'unauthorized'); return true }
		const file = seg.slice(2).join('/')
		if (file === '' || file === 'index.html') send(200, 'text/html; charset=utf-8', canvasHtml(c.id, c.title, c.key))
		else if (file === 'boot.js') send(200, 'text/javascript; charset=utf-8', canvasBoot(c.id))
		else if (file === 'canvas.css') send(200, 'text/css; charset=utf-8', CANVAS_CSS)
		else send(404, 'text/plain', 'not found')
		return true
	}

	/** The canvas a link upgrade is for, if its key is right. Path `/canvas/<id>/link`. */
	linkTarget(url: URL): string | undefined {
		const seg = url.pathname.split('/').filter(Boolean)
		if (seg.length !== 3 || seg[0] !== 'canvas' || seg[2] !== 'link') return undefined
		const c = this.byKey(seg[1]!, url.searchParams.get('key') || '')
		return c?.id
	}

	/** A page linked. A newer link replaces an older one (the page reloaded, or a second window). */
	attachLink(id: string, ws: WebSocket) {
		const c = this.canvases.get(id)
		if (!c) { try { ws.close() } catch {} ; return }
		const previous = c.ws
		c.ws = ws
		c.ready = false
		if (previous && previous !== ws) { try { previous.close() } catch {} }
		ws.on('message', (raw) => {
			let msg: any
			try { msg = JSON.parse(String(raw)) } catch { return }
			this.onPageMessage(c, ws, msg)
		})
		const gone = () => {
			if (c.ws !== ws) return
			c.ws = undefined
			c.ready = false
			for (const [rid, p] of c.pending) { clearTimeout(p.timer); p.resolve({ ok: false, error: 'the canvas page closed' }); c.pending.delete(rid) }
			this.broadcast({ type: 'canvas-state', id: c.id, text: 'closed', at: Date.now() })
		}
		ws.on('close', gone)
		ws.on('error', gone)
	}

	private onPageMessage(c: Canvas, ws: WebSocket, msg: any) {
		if (c.ws !== ws || !msg || typeof msg.type !== 'string') return
		switch (msg.type) {
			case 'hello': {
				c.size = { width: Number(msg.width) || 0, height: Number(msg.height) || 0 }
				this.broadcast({ type: 'canvas-state', id: c.id, text: 'open', at: Date.now() })
				// A page that just loaded is blank: draw the saved code again, then let waiters in.
				// A page that only lost the host (it restarted) still has its drawing.
				void (msg.fresh ? this.replay(c) : Promise.resolve()).finally(() => {
					if (c.ws !== ws) return
					c.ready = true
					const waiters = c.waiters
					c.waiters = []
					waiters.forEach((w) => w())
					for (const fn of this.readyListeners) { try { fn(c.id) } catch {} }
				})
				return
			}
			case 'size':
				c.size = { width: Number(msg.width) || 0, height: Number(msg.height) || 0 }
				return
			case 'result':
			case 'snapshot': {
				const map = msg.type === 'result' ? c.pending : this.snapshots
				const p = map.get(String(msg.requestId || ''))
				if (!p) return
				clearTimeout(p.timer)
				map.delete(String(msg.requestId))
				const { type, requestId, ...rest } = msg
				p.resolve(rest)
				return
			}
			case 'event': {
				const name = String(msg.name || 'event').slice(0, 100)
				const ev: CanvasEvent = { seq: ++c.seq, name, data: msg.data ?? null, at: Date.now() }
				c.events.push(ev)
				if (c.events.length > MAX_EVENTS) c.events.splice(0, c.events.length - MAX_EVENTS)
				this.broadcast({ type: 'canvas-event', id: c.id, name, text: JSON.stringify(ev.data ?? null).slice(0, 500), at: ev.at })
				for (const fn of this.eventListeners) { try { fn(c.id, name, ev.data) } catch {} }
				return
			}
		}
	}

	private async replay(c: Canvas) {
		if (!c.log.length || c.replaying) return
		c.replaying = true
		try {
			for (const code of c.log) {
				const answer = await this.rawEval(c, code, EVAL_TIMEOUT_MS)
				if (!answer.ok) console.error(`[workbench] canvas ${c.id}: saved code failed again: ${answer.error}`)
			}
		} finally {
			c.replaying = false
		}
	}

	private sendTo(c: Canvas, msg: Record<string, unknown>): boolean {
		if (!c.ws || c.ws.readyState !== 1) return false
		try { c.ws.send(JSON.stringify(msg)); return true } catch { return false }
	}

	/** Wait for the page to link (and finish its replay). */
	private waitForPage(c: Canvas, ms: number): Promise<boolean> {
		if (c.ws && c.ws.readyState === 1 && c.ready) return Promise.resolve(true)
		return new Promise((resolve) => {
			const timer = setTimeout(() => { c.waiters = c.waiters.filter((w) => w !== done); resolve(false) }, ms)
			const done = () => { clearTimeout(timer); resolve(true) }
			c.waiters.push(done)
		})
	}

	private rawEval(c: Canvas, code: string, timeoutMs: number): Promise<any> {
		const requestId = String(this.container.utils.uuid()).slice(0, 12)
		return new Promise((resolve) => {
			const timer = setTimeout(() => { c.pending.delete(requestId); resolve({ ok: false, error: `no answer after ${Math.round(timeoutMs / 1000)}s` }) }, timeoutMs)
			c.pending.set(requestId, { resolve, timer })
			if (!this.sendTo(c, { type: 'eval', requestId, code })) {
				clearTimeout(timer)
				c.pending.delete(requestId)
				resolve({ ok: false, error: 'the canvas page is not open' })
			}
		})
	}

	/** TypeScript in, the JavaScript the page runs out. Plain JavaScript passes through. */
	private toJs(code: string): string {
		try {
			return this.container.feature('transpiler').transformSync(code, { loader: 'ts' }).code
		} catch {
			// A top-level `return` is not valid TS to esbuild; it is fine in the page's function body.
			return code
		}
	}

	/**
	 * Run code in a canvas page and give back its result. Code that ran
	 * without an error is saved unless `keep` is false.
	 */
	async eval(id: string, code: string, opts: { timeoutMs?: number; keep?: boolean; chat?: string } = {}): Promise<any> {
		this.load()
		const c = this.canvases.get(id)
		if (!c) return { ok: false, error: `no canvas ${id}. Make one with createCanvas.` }
		if (typeof code !== 'string' || !code.trim()) return { ok: false, error: 'code is required' }
		if (code.length > MAX_CODE) return { ok: false, error: `code is longer than ${MAX_CODE} characters` }
		if (!(await this.waitForPage(c, CONNECT_WAIT_MS))) {
			this.broadcastOpen(c, opts.chat)
			if (!(await this.waitForPage(c, CONNECT_WAIT_MS))) {
				return { ok: false, error: `the canvas page is not open. Open ${this.view(c).url} in Luca Desktop (or a browser) and try again.` }
			}
		}
		const js = this.toJs(code)
		const started = Date.now()
		const answer = await this.rawEval(c, js, Math.min(Math.max(1000, opts.timeoutMs ?? EVAL_TIMEOUT_MS), 120_000))
		if (answer.ok && opts.keep !== false) {
			c.log.push(js)
			if (c.log.length > MAX_LOG) c.log.splice(0, c.log.length - MAX_LOG)
			this.save(c)
		}
		return { ...answer, ms: Date.now() - started }
	}

	/**
	 * A picture of the canvas. Luca Desktop answers with a screenshot of the
	 * whole page; without it the page copies its canvases (SVG and HTML are
	 * left out).
	 */
	async snapshot(id: string): Promise<any> {
		this.load()
		const c = this.canvases.get(id)
		if (!c) return { ok: false, error: `no canvas ${id}` }
		if (!(await this.waitForPage(c, CONNECT_WAIT_MS))) return { ok: false, error: 'the canvas page is not open' }
		const ask = (send: (requestId: string) => boolean, ms: number) => new Promise<any>((resolve) => {
			const requestId = String(this.container.utils.uuid()).slice(0, 12)
			const timer = setTimeout(() => { this.snapshots.delete(requestId); resolve(null) }, ms)
			this.snapshots.set(requestId, { resolve, timer })
			if (!send(requestId)) { clearTimeout(timer); this.snapshots.delete(requestId); resolve(null) }
		})
		const desktop = await ask((requestId) => { this.broadcast({ type: 'canvas-snapshot', id: c.id, requestId, at: Date.now() }); return true }, DESKTOP_SNAPSHOT_WAIT_MS)
		if (desktop?.dataUrl) return { ok: true, source: 'desktop', width: desktop.width ?? null, height: desktop.height ?? null, dataUrl: desktop.dataUrl }
		const page = await ask((requestId) => this.sendTo(c, { type: 'snapshot', requestId }), 10_000)
		if (page?.dataUrl) return { ok: true, source: 'page', partial: !!page.partial, width: page.width ?? null, height: page.height ?? null, dataUrl: page.dataUrl }
		return { ok: false, error: page?.error || 'no snapshot came back' }
	}

	/** Luca Desktop's answer to a `canvas-snapshot` frame. */
	answerSnapshot(body: any): { status: number; body: any } {
		const requestId = String(body?.requestId || '')
		const p = this.snapshots.get(requestId)
		if (!p) return { status: 404, body: { error: 'no snapshot was asked for with that id' } }
		const png = typeof body?.png === 'string' ? body.png : ''
		const dataUrl = typeof body?.dataUrl === 'string' && body.dataUrl.startsWith('data:image/') ? body.dataUrl : png ? `data:image/png;base64,${png}` : ''
		clearTimeout(p.timer)
		this.snapshots.delete(requestId)
		p.resolve(dataUrl ? { dataUrl, width: Number(body?.width) || null, height: Number(body?.height) || null } : { error: String(body?.error || 'empty snapshot') })
		return { status: 200, body: { ok: true } }
	}

	closeAll() {
		for (const c of this.canvases.values()) {
			for (const p of c.pending.values()) { clearTimeout(p.timer); p.resolve({ ok: false, error: 'the host closed' }) }
			c.pending.clear()
			try { c.ws?.close() } catch {}
			c.ws = undefined
		}
		for (const p of this.snapshots.values()) { clearTimeout(p.timer); p.resolve(null) }
		this.snapshots.clear()
	}

	// --- Assistant tools ---

	/**
	 * The tools a chat assistant gets: `assistant.use(canvases.toTools({ chat }))`.
	 * `chat` (the conversation id) tags the canvases they open with that chat.
	 */
	toTools(opts: { chat?: string } = {}) {
		const chat = opts.chat
		const schemas = {
			createCanvas: z.object({
				title: z.string().optional().describe('A short title for the canvas tile, like "Sales chart"'),
				id: z.string().optional().describe('Reopen the canvas with this id instead of making a new one'),
			}).describe('Make a canvas: a blank web page in a Luca Desktop tile that you draw on with canvasEval. It opens beside the chat. The page has the Luca web runtime (`container`), a full-size <canvas> (`canvas`, `ctx`), and can load packages from unpkg. Returns its id.'),
			canvasEval: z.object({
				id: z.string().describe('The canvas id from createCanvas'),
				code: z.string().describe('JavaScript or TypeScript to run in the page. A single expression gives back its value; otherwise use `return`. Top-level await works. Globals: container (Luca web container), stage (the full-page div), canvas and ctx (the default 2d context, made on first use), unpkg(pkg) to import an ES module from unpkg, unpkg(pkg, globalName) for a UMD script, loadStylesheet(href), workbench.get(path) to read the host, emit(name, data) to send events back. Local variables do not live past one call: keep what you need on window.'),
				timeoutMs: z.number().optional().describe('How long to wait for the result. Default 30000'),
				keep: z.boolean().optional().describe('Save this code so it runs again when the page reloads. Default true. Pass false for questions that draw nothing'),
			}).describe('Run code in a canvas page and get the result, console output, or the error.'),
			canvasSnapshot: z.object({
				id: z.string().describe('The canvas id'),
			}).describe('See the canvas: returns a PNG of the page. Use it after you draw, to check the result.'),
			canvasEvents: z.object({
				id: z.string().describe('The canvas id'),
				since: z.number().optional().describe('Only events after this seq'),
			}).describe('Events the page sent with emit(name, data), and page errors (name "error").'),
			listCanvases: z.object({}).describe('The canvases of this project, open or not.'),
			resetCanvas: z.object({
				id: z.string().describe('The canvas id'),
			}).describe('Make a canvas blank again: drop its saved code and reload the page.'),
		}
		const handlers = {
			createCanvas: async (args: { title?: string; id?: string }) => {
				const answer = this.create({ title: args?.title, id: args?.id, chat })
				if (answer.status !== 200) return answer.body
				const c = this.canvases.get(answer.body.canvas.id)!
				const open = await this.waitForPage(c, CONNECT_WAIT_MS)
				return { ...answer.body, canvas: this.view(c), ready: open, note: open ? undefined : 'The page has not linked yet. canvasEval waits for it.' }
			},
			canvasEval: async (args: { id: string; code: string; timeoutMs?: number; keep?: boolean }) => this.eval(String(args?.id || ''), String(args?.code || ''), { timeoutMs: args?.timeoutMs, keep: args?.keep, chat }),
			canvasSnapshot: async (args: { id: string }) => {
				const shot = await this.snapshot(String(args?.id || ''))
				if (!shot.ok) return shot
				const { dataUrl, ...rest } = shot
				return { ...rest, images: [dataUrl] }
			},
			canvasEvents: async (args: { id: string; since?: number }) => this.events(String(args?.id || ''), Number(args?.since) || 0).body,
			listCanvases: async () => ({ canvases: this.list() }),
			resetCanvas: async (args: { id: string }) => (this.reset(String(args?.id || '')) ? { ok: true } : { ok: false, error: `no canvas ${args?.id}` }),
		}
		return { schemas, handlers }
	}
}
