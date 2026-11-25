/**
 * A project's own workbench tools. A project (or a plugin it loads) puts
 * one file per tool in a `workbench/` folder. Each file's default export
 * (or an array of them) is plain data plus functions:
 *
 *   page tool  `{ id, title, hint?, glyph?, page: '/path' | 'https://…' }`
 *   view tool  `{ id, title, hint?, glyph?, renderer?, data(ctx), actions? }`
 *
 * The host reads the files (no server needed), calls `data(ctx)` and shapes
 * the result for the renderer the app draws: `stacks` (card stacks),
 * `tree` (the console's value tree), `markdown` (prose) or `table` (a
 * markdown table). An action's `run(ctx, target)` may be an async
 * generator that yields palette steps (`choose`, `ask`, `confirm`); the
 * app answers each step through `POST /tools/actions/<token>/answer`.
 *
 * Nothing a project writes may crash the host: a file that throws, a bad
 * shape and a `data` that throws all come back as readable errors.
 */
import { statSync } from 'node:fs'
import { valueTree, type TreeNode } from './console.js'
import { originOf, sources, tildePath, type HelperOrigin } from './origins.js'

export const TOOL_RENDERERS = ['stacks', 'tree', 'markdown', 'table'] as const
export type ToolRenderer = (typeof TOOL_RENDERERS)[number]

/** Named card and stack colors the app knows. `slot:<n>` is a ring color too. */
export const TOOL_TONES = ['accent', 'good', 'warn', 'bad', 'info', 'muted'] as const

const DATA_TIMEOUT_MS = 30_000
const STEP_TIMEOUT_MS = 60_000
/** A running action no one answers is dropped after this long. */
const ACTION_IDLE_MS = 10 * 60_000
const MAX_CARDS = 500
const MAX_TEXT = 2000

export type ToolKey = { action: string; key: string; label: string }

export type ToolView = {
	id: string
	title: string
	hint: string
	/** An SF Symbol name the author picked, or null for the default mark. */
	glyph: string | null
	kind: 'page' | 'view'
	/** For a view tool. */
	renderer: ToolRenderer | null
	/** For a page tool: the serve path or URL. */
	page: string | null
	/** The tile after `luca://<project>/`: `tool/<id>` or `page/<path>`. */
	address: string
	origin: HelperOrigin
	/** `workbench/todo.ts` */
	fileDisplay: string
	keys: ToolKey[]
}

export type ToolError = { file: string; fileDisplay: string; id: string | null; origin: HelperOrigin; error: string }

export type ToolsView = {
	/** One line when the project declares no tools. */
	notice: string | null
	count: number
	tools: ToolView[]
	errors: ToolError[]
}

type Declared = { view: ToolView; spec: any }

type Source = { dir: string; root: string; origin: HelperOrigin }

function clip(text: unknown, max = MAX_TEXT): string {
	const s = typeof text === 'string' ? text : text == null ? '' : String(text)
	return s.length > max ? s.slice(0, max) + '…' : s
}

/**
 * A load failure in one line. A syntax error comes from bun build as
 * `error: Expected "}" but found "this"` then `at <file>:4:3`: that pair
 * reads as `line 4:3: Expected "}" but found "this"`. Pure, so it is tested.
 */
export function loadErrorText(err: any): string {
	const message = String(err?.message ?? err)
	const m = /\nerror: ([^\n]+)\n\s*at [^\n]*?:(\d+):(\d+)/.exec(message)
	if (m) return clip(`line ${m[2]}:${m[3]}: ${m[1]}`, 500)
	const plain = /\berror: ([^\n]+)/.exec(message)
	if (plain && message.startsWith('vm.loadModule')) return clip(plain[1]!, 500)
	return firstLine(err)
}

function firstLine(err: any): string {
	return clip(String(err?.message ?? err).split('\n')[0] || 'failed', 500)
}

const ID = /^[A-Za-z0-9][A-Za-z0-9_-]*$/
/** One stroke as the keymap writes it: `a`, `A`, `Shift-a`, `Ctrl-x`, `Enter`. No sequences. */
const KEY = /^(?:(?:Shift|Ctrl|Cmd|Alt|Opt)-)*(?:[!-~]|Enter|Tab|Backspace|Up|Down|Left|Right|Space)$/

/**
 * Check one declared tool and shape it for the list. Answers the view, or
 * the reason it cannot be used. Pure, so it is tested.
 */
export function shapeTool(spec: any, fallbackId: string, origin: HelperOrigin, fileDisplay: string): { view: ToolView } | { error: string; id: string | null } {
	if (!spec || typeof spec !== 'object' || Array.isArray(spec)) return { error: 'the export is not a tool object ({ id, title, page | data })', id: null }
	const id = spec.id === undefined ? fallbackId : String(spec.id)
	if (!ID.test(id)) return { error: `id "${id}" must be letters, digits, - or _`, id }
	if (id === 'actions') return { error: 'id "actions" is kept for the host; pick another', id }
	if (typeof spec.title !== 'string' || !spec.title.trim()) return { error: 'title is required (a string)', id }
	const hasPage = spec.page !== undefined
	const hasData = spec.data !== undefined
	if (hasPage && hasData) return { error: 'a tool has either page or data, not both', id }
	if (!hasPage && !hasData) return { error: 'a tool needs page (a path or URL) or data (a function)', id }
	if (hasPage && (typeof spec.page !== 'string' || !spec.page.trim())) return { error: 'page must be a path like /todo or a URL', id }
	if (hasData && typeof spec.data !== 'function') return { error: 'data must be a function (ctx) => value', id }
	if (spec.renderer !== undefined && !TOOL_RENDERERS.includes(spec.renderer)) {
		return { error: `renderer "${spec.renderer}" is not one of ${TOOL_RENDERERS.join(', ')}`, id }
	}
	if (spec.actions !== undefined && (typeof spec.actions !== 'object' || spec.actions === null || Array.isArray(spec.actions))) {
		return { error: 'actions must be an object { [id]: { key, label, run } }', id }
	}
	const keys: ToolKey[] = []
	for (const [action, a] of Object.entries<any>(spec.actions || {})) {
		if (!ID.test(action)) return { error: `action id "${action}" must be letters, digits, - or _`, id }
		if (!a || typeof a.run !== 'function') return { error: `action ${action} needs run(ctx, target)`, id }
		if (typeof a.key !== 'string' || !KEY.test(a.key)) return { error: `action ${action}: key "${a?.key}" must be one key like a, A, Shift-a or Ctrl-x`, id }
		keys.push({ action, key: a.key, label: clip(typeof a.label === 'string' && a.label ? a.label : action, 120) })
	}
	const page = hasPage ? String(spec.page).trim() : null
	const address = page ? `page/${/^https?:\/\//.test(page) ? page : page.replace(/^\/+/, '')}` : `tool/${id}`
	return {
		view: {
			id,
			title: clip(spec.title.trim(), 120),
			hint: clip(typeof spec.hint === 'string' ? spec.hint : '', 240),
			glyph: typeof spec.glyph === 'string' && spec.glyph ? spec.glyph : null,
			kind: page ? 'page' : 'view',
			renderer: page ? null : (spec.renderer ?? null),
			page,
			address,
			origin,
			fileDisplay,
			keys,
		},
	}
}

/** The `workbench/` folders the host reads: the project's own, then each plugin's. */
export function toolSources(container: any): Source[] {
	const cwd = String(container.cwd)
	const home = String(container.feature('os').homedir)
	const out: Source[] = [{ dir: container.paths.resolve(cwd, 'workbench'), root: cwd, origin: { kind: 'own', tag: 'project', label: 'this project' } }]
	const seen = new Set<string>([cwd])
	for (const s of sources(container)) {
		if (s.kind !== 'plugin' || seen.has(s.root)) continue
		seen.add(s.root)
		const dir = container.paths.resolve(s.root, 'workbench')
		out.push({ dir, root: s.root, origin: originOf('plugin', home, { dir, root: s.root, plugin: s.plugin }) })
	}
	return out
}

function toolFiles(container: any, dir: string): string[] {
	const fs = container.feature('fs')
	if (!fs.isDirectory(dir)) return []
	let names: string[] = []
	try { names = fs.readdirSync(dir) } catch {}
	return names
		.filter((n) => /\.(ts|js|mjs)$/.test(n) && !/\.(test|spec)\./.test(n) && !n.startsWith('_') && !n.startsWith('.'))
		.sort()
		.map((n) => container.paths.resolve(dir, n))
		.filter((f) => fs.isFile(f))
}

/** `workbench/todo.ts` in the project, `<plugin folder>/workbench/a.ts` in a plugin. */
function fileDisplayOf(file: string, root: string, cwd: string, home: string): string {
	if (root === cwd && file.startsWith(cwd + '/')) return file.slice(cwd.length + 1)
	if (file.startsWith(root + '/')) return `${root.split('/').filter(Boolean).pop()}/${file.slice(root.length + 1)}`
	return tildePath(file, home)
}

/**
 * The declared tools. Files load again only when their mtime changes, so a
 * saved declaration shows on the next list or reload, no restart needed.
 */
export class ToolIndex {
	private cache = new Map<string, { mtime: number; specs: any[]; error?: string }>()
	private lastRaw = new Map<string, any>()
	private actions = new ActionRuns()

	constructor(private container: any) {}

	async load(): Promise<{ declared: Declared[]; errors: ToolError[] }> {
		const cwd = String(this.container.cwd)
		const home = String(this.container.feature('os').homedir)
		const helpers = this.container.feature('helpers')
		const declared: Declared[] = []
		const errors: ToolError[] = []
		const ids = new Map<string, string>()
		const live = new Set<string>()
		for (const source of toolSources(this.container)) {
			for (const file of toolFiles(this.container, source.dir)) {
				live.add(file)
				const fileDisplay = fileDisplayOf(file, source.root, cwd, home)
				const origin: HelperOrigin = { ...source.origin, file, label: source.origin.kind === 'plugin' ? source.origin.label : fileDisplay }
				let mtime = 0
				try { mtime = statSync(file).mtimeMs } catch {}
				let entry = this.cache.get(file)
				if (!entry || entry.mtime !== mtime) {
					entry = { mtime, specs: [] }
					try {
						const mod = await helpers.loadModuleExports(file, { cacheBust: true })
						const value = mod?.default !== undefined ? mod.default : mod?.tool
						if (value === undefined) entry.error = 'no default export: export default { id, title, page | data }'
						else entry.specs = Array.isArray(value) ? value : [value]
					} catch (err: any) {
						entry.error = loadErrorText(err)
					}
					this.cache.set(file, entry)
				}
				if (entry.error) { errors.push({ file, fileDisplay, id: null, origin, error: entry.error }); continue }
				const base = this.container.paths.parse(file).name as string
				entry.specs.forEach((spec, i) => {
					const shaped = shapeTool(spec, entry!.specs.length > 1 ? `${base}-${i + 1}` : base, origin, fileDisplay)
					if ('error' in shaped) { errors.push({ file, fileDisplay, id: shaped.id, origin, error: shaped.error }); return }
					const taken = ids.get(shaped.view.id)
					if (taken) {
						errors.push({ file, fileDisplay, id: shaped.view.id, origin, error: `id ${shaped.view.id} is taken by ${taken}; this one is left out` })
						return
					}
					ids.set(shaped.view.id, fileDisplay)
					declared.push({ view: shaped.view, spec })
				})
			}
		}
		for (const key of this.cache.keys()) if (!live.has(key)) this.cache.delete(key)
		return { declared, errors }
	}

	async view(): Promise<ToolsView> {
		const { declared, errors } = await this.load()
		const tools = declared.map((d) => d.view)
		return {
			notice: tools.length || errors.length ? null : 'This project declares no tools. Add a file to workbench/ (see declaring-tools.md).',
			count: tools.length,
			tools,
			errors,
		}
	}

	private async find(id: string): Promise<{ found?: Declared; error?: ToolError }> {
		const { declared, errors } = await this.load()
		const named = (e: ToolError) => e.id === id || (e.id === null && this.container.paths.parse(e.file).name === id)
		return { found: declared.find((d) => d.view.id === id), error: errors.find(named) }
	}

	private ctx(params: Record<string, string>) {
		const cwd = String(this.container.cwd)
		return { container: this.container, params, project: { cwd, name: this.container.paths.basename(cwd) } }
	}

	/** `GET /tools/<id>`: the tool's data, shaped for its renderer. */
	async data(id: string, params: Record<string, string>): Promise<{ status: number; body: any }> {
		const { found, error } = await this.find(id)
		if (!found) {
			if (error) return { status: 200, body: { ok: false, id, error: `${error.fileDisplay}: ${error.error}`, declarationError: true } }
			return { status: 404, body: { error: `no tool ${id}` } }
		}
		const { view, spec } = found
		const head = { id, title: view.title, hint: view.hint, origin: view.origin, fileDisplay: view.fileDisplay, keys: view.keys, kind: view.kind, page: view.page, address: view.address }
		if (view.kind === 'page') return { status: 200, body: { ok: true, ...head, renderer: null } }
		const started = Date.now()
		let raw: any
		try {
			raw = await withTimeout(Promise.resolve().then(() => spec.data(this.ctx(params))), DATA_TIMEOUT_MS, 'data')
		} catch (err: any) {
			return { status: 200, body: { ok: false, ...head, renderer: view.renderer, error: `data() threw: ${firstLine(err)}`, ms: Date.now() - started } }
		}
		const shaped = shapeData(view.renderer, raw)
		if ('error' in shaped) return { status: 200, body: { ok: false, ...head, renderer: shaped.renderer, error: shaped.error, ms: Date.now() - started } }
		if (shaped.renderer === 'stacks') this.lastRaw.set(cacheKey(id, params), shaped.rawCards)
		const { rawCards: _drop, ...rest } = shaped as any
		return { status: 200, body: { ok: true, ...head, ...rest, ms: Date.now() - started } }
	}

	/** `POST /tools/<id>/actions/<action>`: start an action. */
	async startAction(id: string, action: string, body: any): Promise<{ status: number; body: any }> {
		const { found } = await this.find(id)
		if (!found) return { status: 404, body: { error: `no tool ${id}` } }
		const declared = found.spec.actions?.[action]
		if (!declared || typeof declared.run !== 'function') return { status: 404, body: { error: `tool ${id} has no action ${action}` } }
		const params = plainParams(body?.params)
		const target = this.targetOf(id, params, body?.target)
		return this.actions.start(`${id}.${action}`, () => declared.run(this.ctx(params), target))
	}

	answer(token: string, body: any) { return this.actions.answer(token, body) }
	cancel(token: string) { return this.actions.cancel(token) }
	closeAll() { this.actions.closeAll() }

	/** The card an action is about: the author's own card object from the last data, by stack and card id. */
	private targetOf(id: string, params: Record<string, string>, target: any): any {
		if (!target || typeof target !== 'object') return null
		const stack = typeof target.stack === 'string' ? target.stack : null
		const card = typeof target.card === 'string' ? target.card : null
		const cards: Map<string, any> | undefined = this.lastRaw.get(cacheKey(id, params))
		const raw = stack && card ? cards?.get(`${stack}\u0000${card}`) : undefined
		return raw ? { ...raw, id: card, stack } : { id: card, stack }
	}
}

function cacheKey(id: string, params: Record<string, string>): string {
	return id + '?' + JSON.stringify(Object.keys(params).sort().map((k) => [k, params[k]]))
}

export function plainParams(raw: any): Record<string, string> {
	const out: Record<string, string> = {}
	if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
		for (const [k, v] of Object.entries(raw)) if (v !== undefined && v !== null) out[k] = String(v)
	}
	return out
}

function withTimeout<T>(p: Promise<T>, ms: number, what: string): Promise<T> {
	let timer: any
	return Promise.race([
		p,
		new Promise<T>((_, reject) => { timer = setTimeout(() => reject(new Error(`${what} gave no answer after ${ms / 1000}s`)), ms) }),
	]).finally(() => clearTimeout(timer))
}

// --- Renderer shapes ---

export type ToolCard = {
	id: string
	title: string
	subtitle: string | null
	preview: string | null
	badge: string | null
	tone: string | null
	/** A tile to open: `luca://…`, or a path after `luca://<project>/`. Null: Enter does nothing. */
	address: string | null
}

export type ToolStack = { id: string; title: string; tone: string | null; count: number; cards: ToolCard[] }

type Shaped =
	| { renderer: 'stacks'; stacks: ToolStack[]; rawCards: Map<string, any>; notice: string | null }
	| { renderer: 'tree'; tree: TreeNode }
	| { renderer: 'markdown'; markdown: string }
	| { error: string; renderer: ToolRenderer | null }

/** `good`, `slot:2`, a number (a slot). Anything else is no tone. */
export function toneOf(raw: any): string | null {
	if (typeof raw === 'number' && Number.isInteger(raw) && raw >= 0) return `slot:${raw}`
	if (typeof raw !== 'string') return null
	if ((TOOL_TONES as readonly string[]).includes(raw)) return raw
	return /^slot:\d+$/.test(raw) ? raw : null
}

function slug(text: string, fallback: string): string {
	const s = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
	return s || fallback
}

/**
 * What `data()` gave, in the shape its renderer draws. With no renderer
 * named: `{ stacks }` or an array of stacks is stacks, a string is
 * markdown, anything else a tree. Pure, so it is tested.
 */
export function shapeData(renderer: ToolRenderer | null, raw: any): Shaped {
	const looksLikeStacks = (v: any) => (Array.isArray(v?.stacks) || (Array.isArray(v) && v.length > 0 && v.every((s: any) => s && typeof s === 'object' && Array.isArray(s.cards))))
	const kind: ToolRenderer = renderer ?? (looksLikeStacks(raw) ? 'stacks' : typeof raw === 'string' || typeof raw?.markdown === 'string' ? 'markdown' : 'tree')
	switch (kind) {
		case 'stacks': return stacksOf(raw)
		case 'markdown': {
			const text = typeof raw === 'string' ? raw : typeof raw?.markdown === 'string' ? raw.markdown : null
			if (text === null) return { error: 'renderer markdown needs data() to return a string (or { markdown })', renderer: 'markdown' }
			return { renderer: 'markdown', markdown: clip(text, 200_000) }
		}
		case 'table': {
			const md = tableMarkdown(raw)
			return md === null ? { error: 'renderer table needs an array of objects, or { columns, rows }', renderer: 'table' } : { renderer: 'markdown', markdown: md }
		}
		default: return { renderer: 'tree', tree: valueTree(raw) }
	}
}

function stacksOf(raw: any): Shaped {
	const list = Array.isArray(raw) ? raw : raw?.stacks
	if (!Array.isArray(list)) return { error: 'renderer stacks needs data() to return { stacks: [{ title, cards: [...] }] }', renderer: 'stacks' }
	const rawCards = new Map<string, any>()
	const stackIds = new Set<string>()
	let total = 0
	const stacks: ToolStack[] = []
	for (const [si, s] of list.entries()) {
		if (!s || typeof s !== 'object') return { error: `stack ${si + 1} is not an object`, renderer: 'stacks' }
		if (!Array.isArray(s.cards)) return { error: `stack ${si + 1} (${clip(s.title ?? '', 40)}) has no cards array`, renderer: 'stacks' }
		const title = clip(s.title ?? s.id ?? `Stack ${si + 1}`, 120)
		let id = String(s.id ?? slug(title, `stack-${si + 1}`))
		while (stackIds.has(id)) id += '-'
		stackIds.add(id)
		const cardIds = new Set<string>()
		const cards: ToolCard[] = []
		for (const [ci, c] of s.cards.entries()) {
			if (total >= MAX_CARDS) break
			total++
			const card = c && typeof c === 'object' ? c : { title: String(c) }
			let cid = String(card.id ?? `${ci + 1}`)
			while (cardIds.has(cid)) cid += '-'
			cardIds.add(cid)
			rawCards.set(`${id}\u0000${cid}`, card)
			cards.push({
				id: cid,
				title: clip(card.title ?? cid, 300),
				subtitle: card.subtitle == null || card.subtitle === '' ? null : clip(card.subtitle, 300),
				preview: card.preview == null || card.preview === '' ? null : clip(card.preview),
				badge: card.badge == null || card.badge === '' ? null : clip(card.badge, 40),
				tone: toneOf(card.tone),
				address: typeof card.address === 'string' && card.address ? card.address.replace(/^\/+/, '') : null,
			})
		}
		stacks.push({ id, title, tone: toneOf(s.tone), count: cards.length, cards })
	}
	const notice = total >= MAX_CARDS ? `Only the first ${MAX_CARDS} cards are shown.` : null
	return { renderer: 'stacks', stacks, rawCards, notice }
}

/** An array of objects, or `{ columns, rows }`, as a markdown table. Null when it is neither. */
export function tableMarkdown(raw: any): string | null {
	let columns: string[]
	let rows: any[]
	if (Array.isArray(raw)) {
		if (!raw.every((r) => r && typeof r === 'object' && !Array.isArray(r))) return null
		rows = raw
		columns = [...new Set(raw.flatMap((r) => Object.keys(r)))]
	} else if (raw && Array.isArray(raw.rows)) {
		rows = raw.rows
		columns = Array.isArray(raw.columns) ? raw.columns.map(String) : [...new Set(rows.flatMap((r: any) => (r && typeof r === 'object' ? Object.keys(r) : [])))]
	} else return null
	const cell = (v: any) => clip(v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v), 200).replace(/\|/g, '\\|').replace(/\n/g, ' ')
	if (!columns.length) return '_No rows._'
	const head = `| ${columns.map(cell).join(' | ')} |\n| ${columns.map(() => '---').join(' | ')} |`
	const body = rows.slice(0, MAX_CARDS).map((r) => `| ${columns.map((c, i) => cell(Array.isArray(r) ? r[i] : r?.[c])).join(' | ')} |`).join('\n')
	return rows.length ? `${head}\n${body}` : `${head}\n\n_No rows._`
}

// --- The action step protocol ---

/** One step the palette shows. `items` are what the user sees; the answer goes back as an index. */
export type ActionStep =
	| { kind: 'choose'; title: string; items: Array<{ title: string; detail: string }> }
	| { kind: 'ask'; title: string; initial: string }
	| { kind: 'confirm'; question: string; yes: string }

export type ActionResult = { flash: string | null; reload: boolean; open: string | null }

type Running = { gen: AsyncGenerator<any, any, any> | Generator<any, any, any>; step: { shown: ActionStep; values: any[] }; name: string; touched: number }

/**
 * A yielded step as the palette draws it, plus the values the answers map
 * to. Throws on a shape the palette has no element for. Pure, so it is tested.
 */
export function shapeStep(raw: any): { shown: ActionStep; values: any[] } {
	if (!raw || typeof raw !== 'object') throw new Error('an action yielded something that is not a step ({ choose | ask | confirm })')
	const kind = raw.kind ?? (raw.choose ? 'choose' : raw.ask !== undefined ? 'ask' : raw.confirm !== undefined ? 'confirm' : undefined)
	switch (kind) {
		case 'choose': {
			const items = raw.items ?? raw.choose
			if (!Array.isArray(items) || !items.length) throw new Error('a choose step needs items (a non-empty array)')
			const shown = items.slice(0, 500).map((it: any) => (typeof it === 'object' && it !== null
				? { title: clip(it.title ?? it.label ?? it.value ?? '', 300), detail: clip(it.detail ?? '', 300) }
				: { title: clip(it, 300), detail: '' }))
			const values = items.slice(0, 500).map((it: any) => (typeof it === 'object' && it !== null ? (it.value !== undefined ? it.value : it) : it))
			return { shown: { kind: 'choose', title: clip(raw.title ?? 'choose', 300), items: shown }, values }
		}
		case 'ask':
			return { shown: { kind: 'ask', title: clip(raw.title ?? (typeof raw.ask === 'string' ? raw.ask : ''), 300), initial: clip(raw.initial ?? '', 300) }, values: [] }
		case 'confirm':
			return { shown: { kind: 'confirm', question: clip(raw.question ?? (typeof raw.confirm === 'string' ? raw.confirm : 'Sure?'), 300), yes: clip(raw.yes ?? 'Yes', 60) }, values: [] }
		default:
			throw new Error(`an action yielded a step of kind "${kind}"; use choose, ask or confirm`)
	}
}

/** What an action returned, as the app acts on it. A string is a flash. */
export function shapeResult(raw: any): ActionResult {
	if (typeof raw === 'string') return { flash: clip(raw, 300), reload: true, open: null }
	if (!raw || typeof raw !== 'object') return { flash: null, reload: true, open: null }
	return {
		flash: raw.flash == null ? null : clip(raw.flash, 300),
		reload: raw.reload === undefined ? true : !!raw.reload,
		open: typeof raw.open === 'string' && raw.open ? raw.open.replace(/^\/+/, '') : null,
	}
}

function isIterator(v: any): v is AsyncGenerator | Generator {
	return v && typeof v.next === 'function' && typeof v.return === 'function' && (typeof v[Symbol.asyncIterator] === 'function' || typeof v[Symbol.iterator] === 'function')
}

/**
 * Actions that wait on the user. Each has a token; the app answers a step
 * by it. Esc cancels (`gen.return()`, so the action's `finally` runs).
 */
export class ActionRuns {
	private running = new Map<string, Running>()
	private seq = 0

	async start(name: string, run: () => any): Promise<{ status: number; body: any }> {
		this.sweep()
		let value: any
		try {
			value = await withTimeout(Promise.resolve().then(run), STEP_TIMEOUT_MS, name)
		} catch (err: any) {
			return { status: 200, body: { ok: false, error: `${name} threw: ${firstLine(err)}` } }
		}
		if (!isIterator(value)) return { status: 200, body: { ok: true, done: true, result: shapeResult(value) } }
		const token = `act-${Date.now().toString(36)}-${++this.seq}`
		return this.advance(token, { gen: value, step: { shown: { kind: 'confirm', question: '', yes: '' }, values: [] }, name, touched: Date.now() }, undefined)
	}

	async answer(token: string, body: any): Promise<{ status: number; body: any }> {
		const run = this.running.get(token)
		if (!run) return { status: 404, body: { error: `no running action ${token} (it ended or timed out)` } }
		if (body?.cancel === true || body?.value === null || body?.value === undefined) return this.cancel(token)
		let value = body.value
		const step = run.step.shown
		if (step.kind === 'choose') {
			const i = typeof value === 'number' ? value : Number(value)
			if (!Number.isInteger(i) || i < 0 || i >= run.step.values.length) return { status: 400, body: { error: `pick 0…${run.step.values.length - 1}` } }
			value = run.step.values[i]
		} else if (step.kind === 'confirm') {
			value = value === true || value === 'true'
		} else {
			value = String(value)
		}
		return this.advance(token, run, value)
	}

	async cancel(token: string): Promise<{ status: number; body: any }> {
		const run = this.running.get(token)
		if (!run) return { status: 404, body: { error: `no running action ${token}` } }
		this.running.delete(token)
		try { await withTimeout(Promise.resolve(run.gen.return(undefined)), STEP_TIMEOUT_MS, run.name) } catch {}
		return { status: 200, body: { ok: true, done: true, cancelled: true, result: { flash: null, reload: false, open: null } } }
	}

	closeAll() {
		for (const [token, run] of this.running) { try { run.gen.return(undefined) } catch {} ; this.running.delete(token) }
	}

	private async advance(token: string, run: Running, value: any): Promise<{ status: number; body: any }> {
		this.running.delete(token)
		let next: IteratorResult<any, any>
		try {
			next = await withTimeout(Promise.resolve(run.gen.next(value)), STEP_TIMEOUT_MS, run.name)
		} catch (err: any) {
			return { status: 200, body: { ok: false, error: `${run.name} threw: ${firstLine(err)}` } }
		}
		if (next.done) return { status: 200, body: { ok: true, done: true, result: shapeResult(next.value) } }
		let step: { shown: ActionStep; values: any[] }
		try { step = shapeStep(next.value) } catch (err: any) {
			try { run.gen.return(undefined) } catch {}
			return { status: 200, body: { ok: false, error: `${run.name}: ${firstLine(err)}` } }
		}
		run.step = step
		run.touched = Date.now()
		this.running.set(token, run)
		return { status: 200, body: { ok: true, done: false, token, step: step.shown } }
	}

	private sweep() {
		const now = Date.now()
		for (const [token, run] of this.running) {
			if (now - run.touched > ACTION_IDLE_MS) { try { run.gen.return(undefined) } catch {} ; this.running.delete(token) }
		}
	}

	get size() { return this.running.size }
}
