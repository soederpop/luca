/**
 * What the console knows about the code being typed: completions, the
 * signature of the call the caret is in, and the docs of the name under
 * the caret. All three come from the live session scope and from Luca's
 * own introspection, so they are true for this project now.
 *
 * Nothing here runs the user's code. A chain like `fs.readFile` is walked
 * by reading properties. A call is never made, except that
 * `container.feature('x')`, `.client('x')` and `.server('x')` resolve to
 * that helper's class, for its docs.
 */
import { computeNonCodeMask } from '../node/features/transpiler.js'

export type DocParam = { name: string; type: string; description: string; required?: boolean }

export type DocMember = { name: string; kind: string; detail: string; summary: string }

/** The docs of one name, ready to draw at any size. */
export type DocCard = {
	/** `fs.readFile`, `features.fs`. */
	title: string
	/** method, getter, property, function, helper, container, value, keyword, class. */
	kind: string
	/** `readFile(path: string, encoding?: BufferEncoding | null): string | Buffer`. */
	signature?: string
	/** The description, in full. */
	summary: string
	params?: DocParam[]
	returns?: string
	examples?: string[]
	/** The helper this belongs to, and the tile that shows all of it. */
	owner?: { registry: string; id: string; title: string; address: string }
	/** A helper's or an object's members, in short. */
	members?: DocMember[]
	/** The value now, as one line. Only for values read without a call. */
	value?: string
	/** The type of the value now. */
	type?: string
	/** True when Luca has docs for it. False: read from the live object only. */
	documented: boolean
}

export type CompletionItem = {
	label: string
	kind: string
	/** Short, right of the label: a signature or a type. */
	detail: string
	/** The text that replaces `from..to`. */
	insert: string
	doc: DocCard
	/** Added to the rank score: a nudge down the list when nothing else separates items. */
	weight?: number
}

export type Completion = {
	/** The range of the input the chosen item replaces (UTF-16 offsets). */
	from: number
	to: number
	items: CompletionItem[]
	/** The call the caret is in, and which argument. */
	signature?: { doc: DocCard; active: number }
	/** The docs of the name the caret is on. */
	hover?: DocCard
}

const ITEM_LIMIT = 120
const MEMBER_LIMIT = 80
const PREVIEW = 90
const KEYWORDS = ['await', 'async', 'const', 'let', 'function', 'return', 'new', 'typeof', 'true', 'false', 'null', 'undefined', 'for', 'if', 'else', 'try', 'catch', 'throw', 'import']
const GLOBALS = ['JSON', 'Math', 'Object', 'Array', 'Promise', 'Date', 'Map', 'Set', 'String', 'Number', 'Boolean', 'RegExp', 'Error', 'Buffer', 'process', 'fetch', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'URL', 'URLSearchParams', 'console', 'structuredClone', 'parseInt', 'parseFloat', 'encodeURIComponent', 'decodeURIComponent', 'globalThis']
const FACTORIES: Record<string, string> = { feature: 'features', client: 'clients', server: 'servers' }

function clip(text: string, max: number): string {
	return text.length > max ? text.slice(0, max - 1) + '…' : text
}

function isHelper(value: any): boolean {
	return !!value && typeof value === 'object' && typeof value.shortcut === 'string' && !!value.state && typeof value.emit === 'function'
}

function isContainer(value: any): boolean {
	return !!value && typeof value === 'object' && typeof value.feature === 'function' && !!value.features && typeof value.registryNames !== 'undefined'
}

function typeOf(value: any): string {
	if (value === null) return 'null'
	if (Array.isArray(value)) return 'Array'
	if (typeof value === 'object') return value.constructor?.name || 'Object'
	return typeof value
}

/** A value as one short line, without calling anything on it. */
function preview(value: any): string {
	try {
		switch (typeof value) {
			case 'string': return JSON.stringify(clip(value, PREVIEW))
			case 'number': case 'boolean': case 'undefined': return String(value)
			case 'bigint': return `${value}n`
			case 'symbol': return value.toString()
			case 'function': return `ƒ ${value.name || 'anonymous'}(${paramNames(value).join(', ')})`
		}
		if (value === null) return 'null'
		if (isHelper(value)) return `[Helper ${value.shortcut}]`
		if (isContainer(value)) return '[Container]'
		if (Array.isArray(value)) return `Array(${value.length})`
		if (value instanceof Map || value instanceof Set) return `${typeOf(value)}(${value.size})`
		if (value instanceof Date) return Number.isNaN(value.getTime()) ? 'Invalid Date' : value.toISOString()
		if (typeof value.then === 'function') return 'Promise'
		const keys = Object.keys(value)
		const name = typeOf(value)
		return clip(`${name === 'Object' ? '' : name + ' '}{ ${keys.slice(0, 6).join(', ')}${keys.length > 6 ? ', …' : ''} }`, PREVIEW)
	} catch {
		return '[unreadable]'
	}
}

/** The parameter names of a function, from its source. Best effort. */
export function paramNames(fn: Function): string[] {
	let src = ''
	try { src = Function.prototype.toString.call(fn) } catch { return [] }
	if (/\{\s*\[native code\]\s*\}\s*$/.test(src)) return Array.from({ length: fn.length }, (_, i) => `arg${i + 1}`)
	const open = src.indexOf('(')
	// `x => x + 1`: one name, no parentheses.
	const arrow = /^\s*(?:async\s+)?([A-Za-z_$][\w$]*)\s*=>/.exec(src)
	if (arrow) return [arrow[1]!]
	if (open < 0) return []
	let depth = 0
	let end = -1
	for (let i = open; i < src.length && i < open + 2000; i++) {
		const ch = src[i]
		if (ch === '(' || ch === '[' || ch === '{') depth++
		else if (ch === ')' || ch === ']' || ch === '}') { depth--; if (depth === 0) { end = i; break } }
	}
	if (end < 0) return []
	const inside = src.slice(open + 1, end)
	const parts: string[] = []
	let part = ''
	depth = 0
	for (const ch of inside) {
		if (ch === '(' || ch === '[' || ch === '{') depth++
		else if (ch === ')' || ch === ']' || ch === '}') depth--
		if (ch === ',' && depth === 0) { parts.push(part); part = '' } else part += ch
	}
	if (part.trim()) parts.push(part)
	return parts.map((p) => {
		const t = p.trim()
		if (t.startsWith('{')) return 'options'
		if (t.startsWith('[')) return 'items'
		const name = /^(\.\.\.)?\s*([A-Za-z_$][\w$]*)/.exec(t)
		if (!name) return 'arg'
		return `${name[1] ?? ''}${name[2]}${!name[1] && t.includes('=') ? '?' : ''}`
	})
}

// MARK: Reading the input

type Segment =
	| { kind: 'name'; name: string }
	| { kind: 'call'; args: string }
	| { kind: 'index'; raw: string }

const ID_CHAR = /[\w$]/

/** The start of the member chain that ends at `end`: `a.b('x').c` and the like. */
function chainStart(code: string, end: number, mask: Uint8Array): number {
	let i = end
	while (i > 0) {
		const ch = code[i - 1]!
		if (ID_CHAR.test(ch) && !mask[i - 1]) { i--; continue }
		if (ch === '.') {
			// `?.` reads as `.`.
			i--
			if (code[i - 1] === '?') i--
			// Space or a new line before the dot (a chain over many lines).
			let j = i
			while (j > 0 && /\s/.test(code[j - 1]!)) j--
			if (j > 0 && (ID_CHAR.test(code[j - 1]!) || code[j - 1] === ')' || code[j - 1] === ']')) i = j
			continue
		}
		if (ch === ')' || ch === ']') {
			const openCh = ch === ')' ? '(' : '['
			let depth = 0
			let j = i - 1
			for (; j >= 0; j--) {
				if (mask[j]) continue
				if (code[j] === ch) depth++
				else if (code[j] === openCh) { depth--; if (depth === 0) break }
			}
			if (j < 0) break
			i = j
			continue
		}
		break
	}
	return i
}

/** `a.b('x')[0].c` as segments. Undefined when it is not a plain chain. */
function parseChain(text: string): Segment[] | undefined {
	const segments: Segment[] = []
	let i = 0
	const n = text.length
	const skipSpace = () => { while (i < n && /\s/.test(text[i]!)) i++ }
	skipSpace()
	const first = /^[A-Za-z_$][\w$]*/.exec(text.slice(i))
	if (!first) return undefined
	segments.push({ kind: 'name', name: first[0] })
	i += first[0].length
	while (i < n) {
		skipSpace()
		if (i >= n) break
		const ch = text[i]!
		if (ch === '.' || (ch === '?' && text[i + 1] === '.')) {
			i += ch === '?' ? 2 : 1
			skipSpace()
			const name = /^[A-Za-z_$][\w$]*/.exec(text.slice(i))
			if (!name) {
				// A dot at the very end: the member is still to be typed.
				if (i >= n) { segments.push({ kind: 'name', name: '' }); break }
				return undefined
			}
			segments.push({ kind: 'name', name: name[0] })
			i += name[0].length
			continue
		}
		if (ch === '(' || ch === '[') {
			const close = ch === '(' ? ')' : ']'
			let depth = 0
			let j = i
			for (; j < n; j++) {
				if (text[j] === ch) depth++
				else if (text[j] === close) { depth--; if (depth === 0) break }
			}
			if (j >= n) return undefined
			const inner = text.slice(i + 1, j)
			segments.push(ch === '(' ? { kind: 'call', args: inner } : { kind: 'index', raw: inner })
			i = j + 1
			continue
		}
		return undefined
	}
	return segments
}

/** The names of a chain of plain names (`a.b.c`), else undefined. */
function chainNames(segments: Segment[]): string[] | undefined {
	return segments.every((s) => s.kind === 'name') ? segments.map((s) => (s as { name: string }).name) : undefined
}

/** `?fs.readFile`: a one-line docs question, as the console reads it. */
export function isDocQuery(code: string): boolean {
	return /^\s*\?/.test(code) && !code.includes('\n')
}

/** `'x'`, `"x"` or `` `x` `` with nothing else: the string. */
function stringLiteral(raw: string): string | undefined {
	const m = /^\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1\s*$/.exec(raw)
	if (!m || (m[1] === '`' && m[2]!.includes('${'))) return undefined
	return m[2]!.replace(/\\(.)/g, '$1')
}

// MARK: Resolving a chain to a thing

/** What a chain names: a live value, a helper's class, or a documented member with no value. */
type Ref = {
	/** The text of the chain, for the title. */
	path: string
	has: boolean
	value?: any
	/** The object the value was read from, and the member's name. */
	parent?: Ref
	name?: string
	/** A helper known by its class only: no instance exists. */
	helper?: { registry: string; id: string }
}

export class ConsoleDocs {
	constructor(private container: any) {}

	private introspection(registry: string, id: string): any | undefined {
		try { return this.container[registry]?.introspect?.(id) } catch { return undefined }
	}

	private containerIntrospection: any
	private containerDocs(): any {
		if (this.containerIntrospection === undefined) {
			try { this.containerIntrospection = this.container.introspect?.() ?? null } catch { this.containerIntrospection = null }
		}
		return this.containerIntrospection
	}

	/** `features.fs` → its registry and id. */
	private helperOf(value: any): { registry: string; id: string } | undefined {
		if (!isHelper(value)) return undefined
		const [registry, ...rest] = String(value.shortcut).split('.')
		const id = rest.join('.')
		if (!registry || !id || !this.container[registry]?.has?.(id)) return undefined
		return { registry, id }
	}

	private liveInstance(registry: string, id: string): any | undefined {
		try {
			if (registry === 'features') {
				const enabled = this.container.enabledFeatures?.[id]
				if (enabled) return enabled
			}
		} catch {}
		return undefined
	}

	private root(scope: any, name: string): Ref | undefined {
		if (name in scope) return { path: name, has: true, value: scope[name] }
		if (GLOBALS.includes(name) && name in globalThis) return { path: name, has: true, value: (globalThis as any)[name] }
		return undefined
	}

	private member(ref: Ref, name: string): Ref | undefined {
		const path = `${ref.path}.${name}`
		if (ref.helper && !ref.has) {
			const docs = this.introspection(ref.helper.registry, ref.helper.id)
			if (docs?.methods?.[name] || docs?.getters?.[name]) return { path, has: false, parent: ref, name }
			try {
				const proto = this.container[ref.helper.registry].lookup(ref.helper.id)?.prototype
				if (proto && name in proto) return { path, has: false, parent: ref, name }
			} catch {}
			return undefined
		}
		if (!ref.has || ref.value === null || ref.value === undefined) return undefined
		let value: any
		try {
			const target = Object(ref.value)
			if (!(name in target)) return undefined
			value = target[name]
		} catch {
			return { path, has: false, parent: ref, name }
		}
		return { path, has: true, value, parent: ref, name }
	}

	/** Walk the segments. A call is only followed for the container's helper factories. */
	private resolve(scope: any, segments: Segment[]): Ref | undefined {
		const first = segments[0]
		if (!first || first.kind !== 'name') return undefined
		let ref = this.root(scope, first.name)
		for (let i = 1; ref && i < segments.length; i++) {
			const seg = segments[i]!
			if (seg.kind === 'name') {
				ref = this.member(ref, seg.name)
			} else if (seg.kind === 'index') {
				const key = stringLiteral(seg.raw) ?? (/^\s*\d+\s*$/.test(seg.raw) ? seg.raw.trim() : undefined)
				if (key === undefined) return undefined
				const from: Ref = ref
				ref = this.member(ref, key)
				if (ref) ref.path = `${from.path}[${seg.raw.trim()}]`
			} else {
				const registry = ref.name ? FACTORIES[ref.name] : undefined
				const id = stringLiteral(seg.args.split(',')[0] ?? '')
				if (!registry || id === undefined || !ref.parent || !isContainer(ref.parent.value)) return undefined
				if (!this.container[registry]?.has?.(id)) return undefined
				const live = this.liveInstance(registry, id)
				const path = `${ref.path}(${seg.args.trim()})`
				ref = live ? { path, has: true, value: live, helper: { registry, id } } : { path, has: false, helper: { registry, id } }
			}
		}
		return ref
	}

	// MARK: Docs

	private owner(registry: string, id: string) {
		const address = registry === 'commands' ? `command/${encodeURIComponent(id)}` : `helper/${encodeURIComponent(registry)}/${encodeURIComponent(id)}`
		return { registry, id, title: `${registry}.${id}`, address }
	}

	private paramsOf(raw: any): DocParam[] {
		const required: string[] = Array.isArray(raw?.required) ? raw.required : []
		return Object.entries<any>(raw?.parameters ?? {}).map(([name, p]) => {
			const param: DocParam = { name, type: String(p?.type ?? 'unknown'), description: prose(p?.description) }
			// "Parameter path" is the doc generator's filler, not a description.
			if (/^Parameter \S+$/.test(param.description)) param.description = ''
			if (required.includes(name)) param.required = true
			return param
		})
	}

	private examplesOf(raw: any): string[] {
		return (Array.isArray(raw?.examples) ? raw.examples : []).map((e: any) => String(e?.code ?? '').trim()).filter(Boolean).slice(0, 4)
	}

	private methodDoc(title: string, name: string, raw: any): DocCard {
		const params = this.paramsOf(raw)
		const returns = String(raw?.returns ?? 'unknown')
		const sig = params.map((p) => `${p.name}${p.required ? '' : '?'}: ${p.type}`).join(', ')
		return {
			title, kind: 'method', signature: `${name}(${sig}): ${returns}`,
			summary: prose(raw?.description), params, returns, examples: this.examplesOf(raw), documented: true,
		}
	}

	private functionDoc(title: string, name: string, fn: Function | undefined, arity = 0): DocCard {
		const names = fn ? paramNames(fn) : Array.from({ length: arity }, (_, i) => `arg${i + 1}`)
		return {
			title, kind: 'function', signature: `${name}(${names.join(', ')})`, summary: '',
			params: names.map((n) => ({ name: n.replace(/^\.\.\.|\?$/g, ''), type: 'unknown', description: '' })), documented: false,
		}
	}

	private membersOfDocs(docs: any): DocMember[] {
		const out: DocMember[] = []
		for (const [name, raw] of Object.entries<any>(docs?.methods ?? {})) {
			const params = this.paramsOf(raw)
			out.push({ name, kind: 'method', detail: `(${params.map((p) => p.name + (p.required ? '' : '?')).join(', ')})`, summary: firstSentence(raw?.description) })
		}
		for (const [name, raw] of Object.entries<any>(docs?.getters ?? {})) {
			out.push({ name, kind: 'getter', detail: String(raw?.returns ?? raw?.type ?? ''), summary: firstSentence(raw?.description) })
		}
		return out.sort((a, b) => a.name.localeCompare(b.name)).slice(0, MEMBER_LIMIT)
	}

	private helperDoc(registry: string, id: string, live: boolean): DocCard {
		const docs = this.introspection(registry, id)
		let summary = prose(docs?.description)
		if (!summary) {
			try { summary = String(this.container[registry].lookup(id)?.description ?? '').trim() } catch {}
		}
		return {
			title: `${registry}.${id}`, kind: 'helper', summary, examples: this.examplesOf(docs),
			owner: this.owner(registry, id), members: this.membersOfDocs(docs),
			type: docs?.className ? String(docs.className) : undefined,
			value: live ? 'live instance' : 'no instance yet',
			documented: !!docs,
		}
	}

	/** The docs a member of `parent` has, if Luca documents it. */
	private documentedMember(parent: Ref, name: string, title: string): DocCard | undefined {
		const helper = parent.helper ?? this.helperOf(parent.value)
		const docs = helper ? this.introspection(helper.registry, helper.id) : isContainer(parent.value) ? this.containerDocs() : undefined
		if (!docs) return undefined
		const method = docs.methods?.[name]
		const getter = docs.getters?.[name]
		let card: DocCard | undefined
		if (method) card = this.methodDoc(title, name, method)
		else if (getter) {
			card = { title, kind: 'getter', summary: prose(getter.description), returns: String(getter.returns ?? getter.type ?? 'unknown'), examples: this.examplesOf(getter), documented: true }
			card.signature = `${name}: ${card.returns}`
		}
		if (card && helper) card.owner = this.owner(helper.registry, helper.id)
		return card
	}

	/** The docs of whatever a chain names. */
	private docOf(ref: Ref): DocCard {
		const helper = ref.helper ?? this.helperOf(ref.value)
		if (helper) return { ...this.helperDoc(helper.registry, helper.id, ref.has), title: ref.path === helper.id ? `${helper.registry}.${helper.id}` : ref.path, signature: `${helper.registry}.${helper.id}` }
		if (ref.has && isContainer(ref.value)) {
			const docs = this.containerDocs()
			return { title: ref.path, kind: 'container', summary: String(docs?.description ?? 'The project container: every registry, factory and enabled feature.').trim(), members: this.membersOfDocs(docs), type: String(docs?.className ?? 'Container'), documented: !!docs }
		}
		const name = ref.name ?? ref.path
		const documented = ref.parent ? this.documentedMember(ref.parent, name, ref.path) : undefined
		if (documented) {
			if (ref.has && typeof ref.value !== 'function') { documented.value = preview(ref.value); documented.type = typeOf(ref.value) }
			return documented
		}
		if (!ref.has) {
			let arity = 0
			try {
				const h = ref.parent?.helper
				if (h) arity = Number(this.container[h.registry].lookup(h.id)?.prototype?.[name]?.length) || 0
			} catch {}
			const card = this.functionDoc(ref.path, name, undefined, arity)
			const h = ref.parent?.helper
			if (h) card.owner = this.owner(h.registry, h.id)
			return card
		}
		if (typeof ref.value === 'function') {
			const isClass = /^class\s/.test(safeSource(ref.value))
			const card = this.functionDoc(ref.path, name, ref.value)
			if (isClass) { card.kind = 'class'; card.signature = `new ${card.signature}` }
			const h = ref.parent ? ref.parent.helper ?? this.helperOf(ref.parent.value) : undefined
			if (h) card.owner = this.owner(h.registry, h.id)
			return card
		}
		const card: DocCard = { title: ref.path, kind: ref.parent ? 'property' : 'value', summary: '', value: preview(ref.value), type: typeOf(ref.value), documented: false }
		if (ref.value && typeof ref.value === 'object') card.members = this.membersOfValue(ref).slice(0, MEMBER_LIMIT).map((m) => ({ name: m.label, kind: m.kind, detail: m.detail, summary: firstSentence(m.doc.summary) }))
		return card
	}

	// MARK: Members

	/** Every member of a value: own first, then up the prototype chain. No getter is called. */
	private membersOfValue(ref: Ref): CompletionItem[] {
		const items: CompletionItem[] = []
		const seen = new Set<string>()
		const helper = ref.helper ?? this.helperOf(ref.value)
		const docs = helper ? this.introspection(helper.registry, helper.id) : isContainer(ref.value) ? this.containerDocs() : undefined

		const add = (name: string, kind: string, detail: string, doc: DocCard) => {
			if (seen.has(name) || items.length >= 1000) return
			seen.add(name)
			if (helper && !doc.owner) doc.owner = this.owner(helper.registry, helper.id)
			items.push({ label: name, kind, detail, insert: name, doc })
		}
		const title = (name: string) => `${ref.path}.${name}`

		// What Luca documents comes first: it is the helper's real surface.
		for (const [name, raw] of Object.entries<any>(docs?.methods ?? {})) {
			const doc = this.methodDoc(title(name), name, raw)
			add(name, 'method', `(${(doc.params ?? []).map((p) => p.name + (p.required ? '' : '?')).join(', ')}) → ${doc.returns}`, doc)
		}
		for (const [name, raw] of Object.entries<any>(docs?.getters ?? {})) {
			const returns = String(raw?.returns ?? raw?.type ?? 'unknown')
			add(name, 'getter', returns, { title: title(name), kind: 'getter', signature: `${name}: ${returns}`, summary: prose(raw?.description), returns, examples: this.examplesOf(raw), documented: true })
		}

		let target: any
		if (ref.has) {
			try { target = Object(ref.value) } catch { target = undefined }
		} else if (ref.helper) {
			try { target = this.container[ref.helper.registry].lookup(ref.helper.id)?.prototype } catch {}
		}
		let depth = 0
		for (let obj = target; obj && depth < 12; obj = Object.getPrototypeOf(obj), depth++) {
			// `hasOwnProperty` and friends are on everything: noise. The session's
			// realm has its own Object.prototype, so it is known by its shape.
			if (Object.getPrototypeOf(obj) === null && typeof obj.isPrototypeOf === 'function') break
			let names: string[] = []
			try { names = Object.getOwnPropertyNames(obj) } catch { continue }
			for (const name of names) {
				if (name === 'constructor' || seen.has(name)) continue
				// Array indexes and string characters are not members to complete.
				if (/^\d+$/.test(name)) continue
				let desc: PropertyDescriptor | undefined
				try { desc = Object.getOwnPropertyDescriptor(obj, name) } catch { continue }
				if (!desc) continue
				if (desc.get) {
					add(name, 'getter', '', { title: title(name), kind: 'getter', signature: name, summary: '', documented: false })
				} else if (typeof desc.value === 'function') {
					const doc = this.functionDoc(title(name), name, desc.value)
					add(name, 'method', `(${paramNames(desc.value).join(', ')})`, doc)
				} else {
					const child = desc.value
					const childHelper = this.helperOf(child)
					add(name, childHelper ? 'helper' : 'property', preview(child),
						childHelper ? { ...this.helperDoc(childHelper.registry, childHelper.id, true), title: title(name) }
							: { title: title(name), kind: 'property', summary: '', value: preview(child), type: typeOf(child), documented: false })
				}
			}
		}
		return items
	}

	private scopeItems(scope: any, seed?: Set<string>): CompletionItem[] {
		const items: CompletionItem[] = []
		const seen = new Set<string>()
		const push = (item: CompletionItem) => { if (!seen.has(item.label)) { seen.add(item.label); items.push(item) } }
		let names: string[] = []
		try { names = Object.keys(scope) } catch {}
		for (const name of names) {
			if (name === 'require' || name === 'console' || name === 'z') continue
			const ref: Ref = { path: name, has: true, value: scope[name] }
			const doc = this.docOf(ref)
			// A name the context started with (Bun, crypto, fetch) is a global, not the user's.
			const kind = doc.kind === 'helper' || doc.kind === 'container' ? doc.kind : seed?.has(name) ? 'global' : typeof ref.value === 'function' ? 'function' : 'value'
			push({ label: name, kind, detail: kind === 'helper' ? firstSentence(doc.summary) : preview(ref.value), insert: name, doc })
		}
		for (const name of ['z', 'console', 'require', ...GLOBALS]) {
			const value = name in scope ? scope[name] : (globalThis as any)[name]
			if (value === undefined) continue
			push({ label: name, kind: 'global', detail: typeof value === 'function' ? 'function' : typeOf(value), insert: name, doc: { title: name, kind: 'global', summary: '', type: typeOf(value), documented: false } })
		}
		for (const word of KEYWORDS) push({ label: word, kind: 'keyword', detail: '', insert: word, doc: { title: word, kind: 'keyword', summary: '', documented: false } })
		return items
	}

	private registryItems(registry: string): CompletionItem[] {
		const ids: string[] = [...(this.container[registry]?.available ?? [])]
		return ids.sort().map((id) => {
			const doc = this.helperDoc(registry, id, !!this.liveInstance(registry, id))
			return { label: id, kind: 'helper', detail: firstSentence(doc.summary), insert: id, doc }
		})
	}

	// MARK: The three questions

	/** Completions at `cursor`, the call it is in, and the name it is on. */
	complete(scope: any, code: string, cursor: number, seed?: Set<string>): Completion {
		cursor = Math.max(0, Math.min(cursor, code.length))
		const mask = computeNonCodeMask(code)
		const answer: Completion = { from: cursor, to: cursor, items: [] }
		// `?rest.`: a docs question. Every helper id and registry is fair game, not only what is in scope.
		const asking = isDocQuery(code)

		const signature = this.signatureAt(scope, code, cursor, mask)
		if (signature) answer.signature = signature

		// Inside the string of `container.feature('…`: the registry's ids.
		const inString = cursor > 0 && mask[cursor - 1] === 1
		if (inString) {
			let start = cursor
			while (start > 0 && mask[start - 1] && !/['"`]/.test(code[start - 1]!)) start--
			const quote = code[start - 1]
			const before = code.slice(0, Math.max(0, start - 1))
			const factory = /(?:^|[^\w$])([\w$.]+)\.(feature|client|server)\(\s*$/.exec(before)
			if (quote && /['"`]/.test(quote) && factory) {
				let end = cursor
				while (end < code.length && /[\w$-]/.test(code[end]!)) end++
				answer.from = start
				answer.to = end
				answer.items = rank(this.registryItems(FACTORIES[factory[2]!]!), code.slice(start, cursor))
			}
			return answer
		}

		let wordStart = cursor
		while (wordStart > 0 && ID_CHAR.test(code[wordStart - 1]!) && !mask[wordStart - 1]) wordStart--
		let wordEnd = cursor
		while (wordEnd < code.length && ID_CHAR.test(code[wordEnd]!)) wordEnd++
		const prefix = code.slice(wordStart, cursor)
		// A number is not a name: `12.` and `1e3` complete nothing.
		if (/^\d/.test(prefix)) return answer
		answer.from = wordStart
		answer.to = wordEnd

		let before = wordStart
		while (before > 0 && /\s/.test(code[before - 1]!)) before--
		const dotted = code[before - 1] === '.' && code[before - 2] !== '.'
		if (dotted) {
			let dot = before - 1
			if (code[dot - 1] === '?') dot--
			const start = chainStart(code, dot, mask)
			const segments = parseChain(code.slice(start, dot))
			let receiver = segments ? this.resolve(scope, segments) : undefined
			if (!receiver && asking && segments) {
				const names = chainNames(segments)
				// `?features.`: the registry's ids.
				if (names?.length === 1 && this.registries().includes(names[0]!)) answer.items = rank(this.registryItems(names[0]!), prefix)
				else if (names) receiver = this.helperChain(names)
			}
			if (receiver) answer.items = rank(this.membersOfValue(receiver), prefix)
		} else if (code[before - 1] !== '.') {
			answer.items = rank(asking ? this.docScopeItems(scope, seed) : this.scopeItems(scope, seed), prefix)
		}

		// The name the caret is on, whole: its docs follow the caret.
		const start = chainStart(code, wordEnd, mask)
		const segments = wordEnd > start ? parseChain(code.slice(start, wordEnd)) : undefined
		const last = segments?.[segments.length - 1]
		if (segments && last?.kind === 'name' && last.name) {
			let ref = this.resolve(scope, segments)
			if (!ref && asking) { const names = chainNames(segments); if (names) ref = this.helperChain(names) }
			if (ref) answer.hover = this.docOf(ref)
		}
		return answer
	}

	private registries(): string[] {
		return [...(this.container.registryNames ?? [])]
	}

	/**
	 * `features.fs.readFile`, `fs.readFile`, `rest`: a helper by registry and
	 * id, then its member. Needs no instance: the class and its docs answer.
	 */
	private helperChain(names: string[]): Ref | undefined {
		const registries = this.registries()
		const candidates: Array<{ registry: string; id: string; rest: string[] }> = []
		if (registries.includes(names[0]!) && names[1]) candidates.push({ registry: names[0]!, id: names[1], rest: names.slice(2) })
		for (const registry of registries) candidates.push({ registry, id: names[0]!, rest: names.slice(1) })
		for (const c of candidates) {
			if (!this.container[c.registry]?.has?.(c.id)) continue
			const live = this.liveInstance(c.registry, c.id)
			let ref: Ref | undefined = { path: c.id, has: !!live, value: live, helper: { registry: c.registry, id: c.id } }
			for (const name of c.rest) ref = ref ? this.member(ref, name) : undefined
			if (ref) return ref
		}
		return undefined
	}

	/** What a `?` question can start with: the scope, every registry, and every helper id. */
	private docScopeItems(scope: any, seed?: Set<string>): CompletionItem[] {
		const items = this.scopeItems(scope, seed).filter((item) => item.kind !== 'keyword')
		const seen = new Set(items.map((item) => item.label))
		const push = (item: CompletionItem) => { if (!seen.has(item.label)) { seen.add(item.label); items.push(item) } }
		for (const registry of this.registries()) {
			const count = this.container[registry]?.available?.length ?? 0
			push({ label: registry, kind: 'registry', detail: `${count} available`, insert: registry, weight: 0.1, doc: { title: registry, kind: 'registry', summary: `The ${registry} registry: ${count} available. Ask about one with ?${registry}.<id>.`, documented: false } })
		}
		// What is in scope comes first; the rest of the catalog follows.
		for (const registry of this.registries()) for (const item of this.registryItems(registry)) push({ ...item, weight: 0.2 })
		return items
	}

	/** The call the caret is in: its docs and the argument the caret is at. */
	private signatureAt(scope: any, code: string, cursor: number, mask: Uint8Array): Completion['signature'] {
		let depth = 0
		let commas = 0
		for (let i = cursor - 1; i >= 0 && i > cursor - 4000; i--) {
			if (mask[i]) continue
			const ch = code[i]!
			if (ch === ')' || ch === ']' || ch === '}') depth++
			else if (ch === '[' || ch === '{') { if (depth === 0) commas = 0; else depth-- }
			else if (ch === '(') {
				if (depth > 0) { depth--; continue }
				let end = i
				while (end > 0 && /\s/.test(code[end - 1]!)) end--
				const start = chainStart(code, end, mask)
				if (start >= end) { commas = 0; continue }
				const segments = parseChain(code.slice(start, end))
				const ref = segments ? this.resolve(scope, segments) : undefined
				if (!ref) return undefined
				const doc = this.docOf(ref)
				if (!doc.params && doc.kind !== 'method' && doc.kind !== 'function' && doc.kind !== 'class') return undefined
				return { doc, active: commas }
			} else if (ch === ',' && depth === 0) commas++
		}
		return undefined
	}

	/**
	 * `?fs`, `?fs.readFile`, `?container.feature('fs')`, `?features.fs`, `?rest`:
	 * the docs of a name in scope, else of a helper by its id.
	 */
	describe(scope: any, target: string): DocCard | undefined {
		const text = target.trim().replace(/;+$/, '')
		if (!text) return undefined
		const segments = parseChain(text)
		if (segments) {
			const ref = this.resolve(scope, segments)
			if (ref) return this.docOf(ref)
			const names = chainNames(segments)
			const helper = names ? this.helperChain(names) : undefined
			if (helper) return this.docOf(helper)
		}
		return undefined
	}
}

/** Doc text as prose: a JSDoc `{@link name}` reads as `name` in code. */
function prose(text: unknown): string {
	return String(text ?? '').replace(/\{@link\s+([^}\s|]+)(?:[\s|][^}]*)?\}/g, '`$1`').trim()
}

function safeSource(fn: Function): string {
	try { return Function.prototype.toString.call(fn) } catch { return '' }
}

function firstSentence(text: unknown): string {
	const s = typeof text === 'string' ? text.replace(/\s+/g, ' ').trim() : ''
	const m = /^(.{12,}?[.!?])(\s|$)/.exec(s)
	return clip(m ? m[1]! : s, 140)
}

/**
 * Order items for what was typed: an exact start first, then a start in
 * another case, then the letters in order anywhere. Documented names before
 * the rest, names with `_` last.
 */
export function rank(items: CompletionItem[], prefix: string): CompletionItem[] {
	const lower = prefix.toLowerCase()
	const scored: Array<{ item: CompletionItem; score: number }> = []
	for (const item of items) {
		const label = item.label
		let score: number
		if (!prefix) score = 0
		else if (label.startsWith(prefix)) score = 0
		else if (label.toLowerCase().startsWith(lower)) score = 1
		else if (label.toLowerCase().includes(lower)) score = 2
		else if (subsequence(label.toLowerCase(), lower)) score = 3
		else continue
		if (label.startsWith('_') && !prefix.startsWith('_')) score += 10
		if (!item.doc.documented && item.kind !== 'helper' && item.kind !== 'container' && item.kind !== 'value') score += 0.5
		if (item.kind === 'keyword' || item.kind === 'global') score += 0.25
		score += item.weight ?? 0
		scored.push({ item, score })
	}
	scored.sort((a, b) => a.score - b.score || (prefix ? a.item.label.length - b.item.label.length : 0) || a.item.label.localeCompare(b.item.label))
	return scored.slice(0, ITEM_LIMIT).map((s) => s.item)
}

function subsequence(text: string, letters: string): boolean {
	let i = 0
	for (const ch of text) if (ch === letters[i]) i++
	return i === letters.length
}
