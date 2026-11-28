/**
 * The workbench console: eval with the container in scope, as `luca eval`
 * does, in one vm context per session so a name set in one entry is there
 * in the next. The host shapes every answer (a tree for objects, the stack
 * for errors) so the app only draws it.
 */
import { format } from 'node:util'
import { z } from 'zod'
import { computeNonCodeMask } from '../node/features/transpiler.js'
import { ConsoleDocs, type Completion, type DocCard } from './complete.js'

/** One node of a result tree. `children` only on a container that has entries. */
export type TreeNode = {
	/** The key or index in its parent. None on the root. */
	key?: string
	/** `string`, `number`, `Array`, `Map`, a class name… */
	type: string
	/** A leaf's value, or a container's one-line preview. */
	text: string
	children?: TreeNode[]
	/** Entries left out of `children` (over the limit). */
	more?: number
	/** True when the app should show it open at first. Only the root. */
	open?: boolean
}

export type ConsoleLog = { level: string; text: string }

export type ConsoleAnswer =
	| { ok: true; entry: number; input: string; type: string; text: string; tree: TreeNode; logs: ConsoleLog[]; ms: number; doc?: DocCard }
	| { ok: false; entry: number; input: string; error: string; name: string; stack: string; hint?: string; logs: ConsoleLog[]; ms: number }

const TREE_DEPTH = 8
const TREE_KEYS = 100
const TREE_ITEMS = 100
const TREE_NODES = 3000
const LEAF_TEXT = 2000
const PREVIEW_TEXT = 100
const LOG_LINES = 200
const LOG_TEXT = 4000
const STACK_LINES = 30
/** The console stops waiting after this long. The entry keeps running. */
export const CONSOLE_TIMEOUT_MS = 60_000

function typeName(value: any): string {
	if (value === null) return 'null'
	if (Array.isArray(value)) return 'Array'
	if (typeof value === 'object') return value.constructor?.name || 'Object'
	return typeof value
}

function isHelper(value: any): boolean {
	return !!value && typeof value === 'object' && typeof value.shortcut === 'string' && !!value.state && typeof value.emit === 'function'
}

function isContainer(value: any): boolean {
	return !!value && typeof value === 'object' && typeof value.feature === 'function' && !!value.features && typeof value.registryNames !== 'undefined'
}

function clip(text: string, max: number): string {
	return text.length > max ? text.slice(0, max - 1) + '…' : text
}

/** A primitive (or an object we do not open) as one line. */
function leafText(value: any): string {
	switch (typeof value) {
		case 'string': return JSON.stringify(clip(value, LEAF_TEXT))
		case 'undefined': return 'undefined'
		case 'function': return `ƒ ${value.name || 'anonymous'}()`
		case 'symbol': return value.toString()
		case 'bigint': return `${value}n`
		case 'number':
		case 'boolean': return String(value)
	}
	if (value === null) return 'null'
	if (value instanceof Date) return Number.isNaN(value.getTime()) ? 'Invalid Date' : value.toISOString()
	if (value instanceof RegExp) return value.toString()
	if (isHelper(value)) return `[Helper ${value.shortcut}]`
	if (isContainer(value)) return '[Container]'
	if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) return `${value.constructor.name}(${(value as any).byteLength} bytes)`
	if (typeof (value as any).then === 'function') return 'Promise'
	return `[${typeName(value)}]`
}

/** Entries of a value we open, as [key, value]. Undefined: show it as a leaf. */
function entriesOf(value: any): { entries: Array<[string, any]>; total: number } | undefined {
	if (value === null || typeof value !== 'object') return undefined
	if (value instanceof Date || value instanceof RegExp || ArrayBuffer.isView(value) || value instanceof ArrayBuffer) return undefined
	if (isHelper(value) || isContainer(value) || typeof value.then === 'function') return undefined
	if (Array.isArray(value)) {
		return { entries: value.slice(0, TREE_ITEMS).map((v, i) => [String(i), v]), total: value.length }
	}
	if (value instanceof Map) {
		const all = [...value.entries()]
		return { entries: all.slice(0, TREE_ITEMS).map(([k, v]) => [typeof k === 'string' ? k : leafText(k), v]), total: all.length }
	}
	if (value instanceof Set) {
		const all = [...value.values()]
		return { entries: all.slice(0, TREE_ITEMS).map((v, i) => [String(i), v]), total: all.length }
	}
	if (value instanceof Error) {
		return { entries: [['name', value.name], ['message', value.message], ['stack', value.stack]], total: 3 }
	}
	const keys = Object.keys(value)
	return {
		entries: keys.slice(0, TREE_KEYS).map((k) => {
			let v: any
			try { v = value[k] } catch (e: any) { v = `[Getter threw: ${e?.message}]` }
			return [k, v]
		}),
		total: keys.length,
	}
}

/** `{ a: 1, b: "x", … }` or `Array(3) [1, 2, 3]`: a container as one short line. */
function previewOf(value: any, listed: { entries: Array<[string, any]>; total: number }): string {
	const part = (v: any) => (entriesOf(v) ? (Array.isArray(v) ? `Array(${v.length})` : typeName(v) === 'Object' ? '{…}' : typeName(v)) : leafText(v))
	const isList = Array.isArray(value) || value instanceof Set
	const items = listed.entries.map(([k, v]) => (isList ? part(v) : `${k}: ${part(v)}`))
	let body = ''
	for (const item of items) {
		const next = body ? `${body}, ${item}` : item
		if (next.length > PREVIEW_TEXT) { body += body ? ', …' : '…'; break }
		body = next
	}
	if (listed.total > listed.entries.length && !body.endsWith('…')) body += body ? ', …' : '…'
	if (Array.isArray(value)) return `Array(${value.length}) [${body}]`
	if (value instanceof Map) return `Map(${value.size}) {${body}}`
	if (value instanceof Set) return `Set(${value.size}) {${body}}`
	if (value instanceof Error) return `${value.name}: ${clip(value.message, PREVIEW_TEXT)}`
	const name = typeName(value)
	return `${name === 'Object' ? '' : name + ' '}{${body}}`
}

/**
 * Any value as a tree the console draws as is. Cycles, depth, keys and the
 * total node count are capped, so the container itself is safe to return.
 */
export function valueTree(value: any): TreeNode {
	let budget = TREE_NODES
	const seen = new WeakSet<object>()
	const build = (v: any, key: string | undefined, depth: number): TreeNode => {
		budget--
		const node: TreeNode = { type: typeName(v), text: '' }
		if (key !== undefined) node.key = key
		const listed = entriesOf(v)
		if (!listed) { node.text = leafText(v); return node }
		if (seen.has(v)) { node.text = '[Circular]'; return node }
		node.text = previewOf(v, listed)
		if (depth >= TREE_DEPTH || listed.entries.length === 0) return node
		seen.add(v)
		const children: TreeNode[] = []
		for (const [k, child] of listed.entries) {
			if (budget <= 0) break
			children.push(build(child, k, depth + 1))
		}
		seen.delete(v)
		node.children = children
		if (listed.total > children.length) node.more = listed.total - children.length
		return node
	}
	const root = build(value, undefined, 0)
	if (root.children) root.open = true
	return root
}

/** The result as text: strings as is, the rest as the tree's preview. */
function resultText(value: any, tree: TreeNode): string {
	return typeof value === 'string' ? clip(value, 20_000) : tree.text
}

const IDENT = /^[A-Za-z_$][\w$]*$/

/**
 * Make top-level `const|let|var name = …` an assignment to the session
 * scope, so the name is there in the next entry, also when the entry is
 * wrapped for top-level await. Other declarations (destructuring, no
 * initializer) at the top become `var`, so typing them again does not throw.
 * Only depth 0 code counts: strings, comments, and blocks are left alone.
 */
export function persistDeclarations(code: string): string {
	const mask = computeNonCodeMask(code)
	let depth = 0
	let out = ''
	let last = 0
	// Where the current statement starts: the start, or after `;`, `}` or a newline at depth 0.
	let statementStart = true
	for (let i = 0; i < code.length; i++) {
		// A line comment's newline is masked, but it still ends the statement.
		if (mask[i]) { statementStart = code[i] === '\n' && depth === 0; continue }
		const ch = code[i]!
		if (ch === '(' || ch === '[' || ch === '{') { depth++; statementStart = ch === '{'; continue }
		if (ch === ')' || ch === ']' || ch === '}') { depth = Math.max(0, depth - 1); statementStart = ch === '}'; continue }
		if (ch === ';' || ch === '\n') { if (depth === 0) statementStart = true; continue }
		if (/\s/.test(ch)) continue
		if (depth === 0 && statementStart) {
			const m = /^(const|let|var)(\s+)([A-Za-z_$][\w$]*)?(\s*)(=(?![=>]))?/.exec(code.slice(i))
			if (m && (i === 0 || !/[\w$]/.test(code[i - 1]!))) {
				const [whole, keyword, gap, name, , assign] = m
				if (name && IDENT.test(name) && assign) {
					// `const a = 1, b = 2` keeps its shape: `a = 1, b = 2`.
					out += code.slice(last, i) + whole.slice(keyword!.length + gap!.length)
					last = i + whole.length
					i = last - 1
				} else if (keyword !== 'var') {
					out += code.slice(last, i) + 'var'
					last = i + keyword!.length
					i = last - 1
				}
			}
		}
		statementStart = false
	}
	return out + code.slice(last)
}

/** The lines of a stack worth showing: at most `STACK_LINES`. */
function stackOf(err: any): string {
	const stack: string = typeof err?.stack === 'string' ? err.stack : `${err?.name ?? 'Error'}: ${err?.message ?? err}`
	// The frames of the console itself (vm, this file) say nothing about the user's code.
	const ours = /\b(runInContext|_runInContextWithReturnRecovery|runNow|processTicksAndRejections)\b|\/src\/(node\/features\/vm|workbench\/)/
	return stack.split('\n').filter((line) => !(/^\s+at /.test(line) && ours.test(line))).slice(0, STACK_LINES).join('\n')
}

/** The helper factories in scope, by registry: `feature('fs')` is `container.feature('fs')`. */
const FACTORY_OF: Record<string, string> = { features: 'feature', clients: 'client', servers: 'server' }
/** The registries a bare name can come from, in the order they are tried. */
const AUTO_REGISTRIES = ['features', 'clients', 'servers']
const DECLARED = /\b(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/g

/**
 * The free names of `code` that a helper registry knows and the scope does
 * not have yet, with the registry for each. A name after `.`, an object key
 * (`fs:`), a name the code declares itself, and anything in a string or
 * comment do not count. This only reads the code; it runs nothing.
 */
export function helperNamesIn(code: string, has: (name: string) => boolean, registryOf: (name: string) => string | undefined): Array<{ name: string; registry: string }> {
	const mask = computeNonCodeMask(code)
	const declared = new Set<string>()
	for (const m of code.matchAll(DECLARED)) if (!mask[m.index!]) declared.add(m[1]!)
	const found = new Map<string, string>()
	for (const m of code.matchAll(/[A-Za-z_$][\w$]*/g)) {
		const i = m.index!
		const name = m[0]
		if (mask[i] || found.has(name) || declared.has(name)) continue
		if (i > 0 && /[\w$]/.test(code[i - 1]!)) continue
		let b = i - 1
		while (b >= 0 && /\s/.test(code[b]!)) b--
		if (b >= 0 && code[b] === '.' && code[b - 1] !== '.') continue
		let a = i + name.length
		while (a < code.length && /\s/.test(code[a]!)) a++
		if (code[a] === ':' && code[a + 1] !== ':') continue
		// `fs = …` gives the name a value of its own; `fs => …` is a parameter.
		if (code[a] === '=' && code[a + 1] !== '=') continue
		if (has(name)) continue
		const registry = registryOf(name)
		if (registry) found.set(name, registry)
	}
	return [...found].map(([name, registry]) => ({ name, registry }))
}

type Session = { context: any; entries: number; queue: Promise<unknown>; logs: ConsoleLog[] | null; last?: any; seed: Set<string> }

/**
 * `?fs.readFile` or `fs.readFile?`: a question about a name, not code to
 * run. Returns the name. One line only, and the short form must be a plain
 * chain, so `a ? b : c` and `x?.y` stay code.
 */
export function docQuery(input: string): string | undefined {
	const text = input.trim()
	if (!text || text.includes('\n')) return undefined
	if (text.startsWith('?')) return text.slice(1).trim() || undefined
	const m = /^([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*|\((?:'[^']*'|"[^"]*")\))*)\s*\?$/.exec(text)
	return m ? m[1] : undefined
}

/** The console sessions of one host, each its own vm context. */
export class ConsoleSessions {
	private sessions = new Map<string, Session>()
	private docs: ConsoleDocs

	constructor(private container: any) {
		this.docs = new ConsoleDocs(container)
	}

	/** Completions, the signature and the docs at the caret, from the session's live scope. */
	complete(code: string, cursor: number, name = 'default'): Completion {
		const s = this.session(name)
		return this.docs.complete(s.context, code, cursor, s.seed)
	}

	/** The docs of a name in the session, or of a helper by id. */
	describe(target: string, name = 'default'): DocCard | undefined {
		return this.docs.describe(this.session(name).context, target)
	}

	private session(name: string): Session {
		let s = this.sessions.get(name)
		if (s) {
			// A feature enabled since the last entry joins the scope, unless the user took its name.
			for (const [id, instance] of Object.entries(this.container.enabledFeatures ?? {})) {
				if (!(id in s.context)) s.context[id] = instance
			}
			return s
		}
		const container = this.container
		const vm = container.feature('vm')
		container.helpers.seedVirtualModules()
		const holder: Session = { context: null, entries: 0, queue: Promise.resolve(), logs: null, seed: new Set() }
		// Logs go to the entry that is running; later ones (a timer) go to stderr, never stdout.
		const write = (level: string) => (...args: any[]) => {
			const text = clip(format(...args), LOG_TEXT)
			if (holder.logs && holder.logs.length < LOG_LINES) holder.logs.push({ level, text })
			else if (!holder.logs) process.stderr.write(`[console] ${text}\n`)
		}
		const consoleProxy: Record<string, any> = {}
		for (const level of ['log', 'info', 'warn', 'error', 'debug', 'trace', 'dir', 'table']) consoleProxy[level] = write(level)
		const scope: Record<string, any> = {
			container,
			z,
			require: vm.createRequireFor(container.paths.resolve('__workbench_console__.ts')),
			console: consoleProxy,
		}
		// `feature('x')`, `client('x')`, `server('x')`: the container's factories.
		// The helper also takes its id as a name, when the name is free, so a
		// call nobody assigned is still there in the next entry.
		for (const [registry, factory] of Object.entries(FACTORY_OF)) {
			const fn = (id: string, options?: any, ...rest: any[]) => {
				const helper = container[factory](id, options, ...rest)
				const ctx = holder.context
				if (ctx && typeof id === 'string' && IDENT.test(id) && !(id in ctx)) ctx[id] = helper
				return helper
			}
			Object.defineProperty(fn, 'name', { value: factory })
			// complete.ts follows a call of this function to the helper's class.
			;(fn as any).lucaRegistry = registry
			scope[factory] = fn
		}
		for (const [id, instance] of Object.entries(container.enabledFeatures ?? {})) scope[id] = instance
		holder.context = vm.createContext(scope)
		// What the context starts with, so the names the user sets can be told apart.
		holder.seed = new Set(Object.keys(holder.context))
		this.sessions.set(name, holder)
		return holder
	}

	/**
	 * A name the entry uses that is not in scope but is a helper id
	 * (`modelProviders`, `rest`) becomes that helper, made with its default
	 * options, before the entry runs. Each one is said in the entry's logs.
	 */
	private defineHelpers(s: Session, code: string, logs: ConsoleLog[]) {
		const container = this.container
		const names = helperNamesIn(
			code,
			(name) => name in s.context || name in globalThis,
			(name) => AUTO_REGISTRIES.find((r) => { try { return !!container[r]?.has?.(name) } catch { return false } }),
		)
		for (const { name, registry } of names) {
			const factory = FACTORY_OF[registry]!
			try {
				s.context[name] = container[factory](name)
				logs.push({ level: 'info', text: `${name} = ${factory}('${name}')` })
			} catch (err: any) {
				logs.push({ level: 'warn', text: `${name} is a ${registry.slice(0, -1)}, but ${factory}('${name}') threw: ${err?.message ?? err}` })
			}
		}
	}

	reset(name = 'default'): boolean {
		return this.sessions.delete(name)
	}

	/** Run one entry. Entries of a session run one at a time, in order. */
	run(input: string, name = 'default'): Promise<ConsoleAnswer> {
		const s = this.session(name)
		const entry = ++s.entries
		const next = s.queue.then(() => this.runNow(s, input, entry))
		s.queue = next.catch(() => {})
		return next
	}

	private async runNow(s: Session, input: string, entry: number): Promise<ConsoleAnswer> {
		const container = this.container
		const vm = container.feature('vm')
		const asked = docQuery(input)
		if (asked !== undefined) {
			const doc = this.docs.describe(s.context, asked)
			if (doc) return { ok: true, entry, input, type: 'docs', text: doc.title, tree: { type: 'docs', text: doc.title }, logs: [], ms: 0, doc }
			return { ok: false, entry, input, error: `No docs for ${asked}`, name: 'Docs', stack: '', hint: 'Ask about a name in scope (?fs, ?fs.readFile), a helper by id (?rest, ?features.fs), or a factory call (?container.client(\'rest\')).', logs: [], ms: 0 }
		}
		let code = input
		try {
			code = container.feature('transpiler').transformSync(code, { loader: 'ts' }).code
		} catch {
			// vm.run reports the real syntax error against the user's own code.
		}
		const logs: ConsoleLog[] = []
		this.defineHelpers(s, code, logs)
		code = persistDeclarations(code)
		s.logs = logs
		const started = Date.now()
		let timer: any
		try {
			const result = await Promise.race([
				vm.run(code, s.context),
				new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`no answer after ${CONSOLE_TIMEOUT_MS / 1000}s; it may still be running`)), CONSOLE_TIMEOUT_MS) }),
			])
			const tree = valueTree(result)
			// `_` is the last result, unless the user gave `_` a value of their own.
			if (!('_' in s.context) || s.context._ === s.last) { s.context._ = result; s.last = result }
			const answer: ConsoleAnswer = { ok: true, entry, input, type: typeName(result), text: resultText(result, tree), tree, logs, ms: Date.now() - started }
			// A helper or the container as the result: its docs ride along.
			if (isHelper(result) || isContainer(result)) {
				try { s.context.__workbenchResult = result; const doc = this.docs.describe(s.context, '__workbenchResult'); if (doc) { doc.title = isHelper(result) ? String(result.shortcut) : 'container'; answer.doc = doc } } catch {} finally { delete s.context.__workbenchResult }
			}
			return answer
		} catch (err: any) {
			const message = String(err?.message ?? err)
			let hint: string | undefined
			try { hint = vm.hintForEvalError(message, input) } catch {}
			const answer: ConsoleAnswer = { ok: false, entry, input, error: message, name: String(err?.name ?? 'Error'), stack: stackOf(err), logs, ms: Date.now() - started }
			if (hint) answer.hint = hint
			return answer
		} finally {
			clearTimeout(timer)
			s.logs = null
		}
	}
}
