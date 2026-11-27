/**
 * Pure view builders for the workbench host. Each one reads the container
 * (registries, introspection, live instances) and returns plain JSON.
 * Nothing here creates a helper instance, so reading is always side-effect free.
 */
import { allHelperInstances } from '../container.js'
import { ContainerDescriber, DescribeError } from '../container-describer.js'
import type { HelperOrigin } from './origins.js'

/** Where a helper comes from (`OriginIndex`). Optional so a view works without one. */
export type Origins = { of(registry: string, id: string): HelperOrigin }

/** Registries the workbench shows, in display order. Skipped when the container lacks them. */
const KNOWN_REGISTRIES = ['features', 'clients', 'servers', 'commands', 'endpoints', 'assistants', 'selectors']

export type WorkbenchCard = {
	id: string
	title: string
	subtitle: string
	preview: string
	open: { tool: 'helper'; registry: string; id: string }
	origin?: HelperOrigin
}

export type WorkbenchStack = { id: string; title: string; cards: WorkbenchCard[] }

/** Registry names this container really has, contract order first. */
export function registryNames(container: any): string[] {
	const attached: string[] = container.registryNames || []
	const has = (n: string) => attached.includes(n) || Array.isArray(container[n]?.available)
	const known = KNOWN_REGISTRIES.filter(has)
	const extra = attached.filter((n) => !KNOWN_REGISTRIES.includes(n) && Array.isArray(container[n]?.available))
	return [...known, ...extra]
}

function registryOf(container: any, name: string): any | undefined {
	return registryNames(container).includes(name) ? container[name] : undefined
}

/** Ids of helpers that came from the project (or plugins) rather than the framework. */
function projectHelperKeys(container: any): Set<string> {
	try {
		return new Set<string>(container.feature('helpers').state.get('registered') || [])
	} catch {
		return new Set()
	}
}

function projectName(container: any): string {
	const fs = container.feature('fs')
	const pkgPath = container.paths.resolve('package.json')
	try {
		if (fs.exists(pkgPath)) {
			const name = fs.readJson(pkgPath)?.name
			if (typeof name === 'string' && name) return name
		}
	} catch {}
	const parts = String(container.cwd).split('/').filter(Boolean)
	return parts[parts.length - 1] || String(container.cwd)
}

export function project(container: any, lucaVersion: string) {
	const registries = registryNames(container)
		.map((name) => ({ name, count: (container[name]?.available || []).length as number }))
		.filter((r) => r.count > 0)
	return { name: projectName(container), cwd: String(container.cwd), lucaVersion, registries }
}

function introspectionOf(container: any, registry: string, id: string): any | undefined {
	try {
		return container[registry]?.introspect?.(id)
	} catch {
		return undefined
	}
}

function descriptionOf(container: any, registry: string, id: string): string {
	const fromIntrospection = introspectionOf(container, registry, id)?.description
	if (typeof fromIntrospection === 'string' && fromIntrospection.trim()) return fromIntrospection.trim()
	try {
		const ctor: any = container[registry].lookup(id)
		const d = ctor?.description
		if (typeof d === 'string') return d.trim()
	} catch {}
	return ''
}

export function registryStacks(container: any, registry: string, origins?: Origins): { stacks: WorkbenchStack[] } | undefined {
	const reg = registryOf(container, registry)
	if (!reg) return undefined
	const projectKeys = projectHelperKeys(container)
	const stacks: WorkbenchStack[] = [
		{ id: 'project', title: 'Project', cards: [] },
		{ id: 'builtin', title: 'Built in', cards: [] },
	]
	for (const id of reg.available as string[]) {
		const text = descriptionOf(container, registry, id)
		const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
		const card: WorkbenchCard = {
			id,
			title: id,
			subtitle: (lines[0] || '').slice(0, 200),
			preview: lines.slice(0, 3).join('\n').slice(0, 400),
			open: { tool: 'helper', registry, id },
		}
		if (origins) card.origin = origins.of(registry, id)
		stacks[projectKeys.has(`${registry}.${id}`) ? 0 : 1]!.cards.push(card)
	}
	return { stacks: stacks.filter((s) => s.cards.length > 0) }
}

/** Zod schema to JSON schema, or null when the schema is missing or cannot be shown. */
function optionsJsonSchema(ctor: any): any {
	const schema = ctor?.optionsSchema
	if (!schema || typeof schema.toJSONSchema !== 'function') return null
	try {
		return schema.toJSONSchema({ unrepresentable: 'any' })
	} catch {
		try { return schema.toJSONSchema() } catch { return null }
	}
}

function eventNames(ctor: any, introspection: any): string[] {
	const names = new Set<string>(Object.keys(introspection?.events || {}))
	const shape = ctor?.eventsSchema?.shape
	if (shape && typeof shape === 'object') for (const k of Object.keys(shape)) names.add(k)
	return [...names]
}

/** The live instance of a helper if one already exists. Never creates one. */
export function findLiveInstance(container: any, registry: string, id: string): any | undefined {
	const shortcut = `${registry}.${id}`
	const reg = registryOf(container, registry)
	let ctor: any
	try { ctor = reg?.lookup(id) } catch {}
	try {
		return allHelperInstances().find((h: any) => {
			if (h?.context?.container && h.context.container !== container) return false
			return h.shortcut === shortcut || (ctor && h.constructor === ctor)
		})
	} catch {
		return undefined
	}
}

/** One row in a schema table: an option, a state key, a getter. */
export type WorkbenchField = { name: string; type: string; description: string; required?: boolean }

/** One method as the inspector lists it. `signature` is ready to draw. */
export type WorkbenchMethod = {
	name: string
	signature: string
	description: string
	params: WorkbenchField[]
	returns: string
	/** What the argument prompt says: how to type the arguments. */
	argsHint: string
	/** False only for a documented method with no parameters: the inspector calls it at once. */
	askArgs: boolean
}

export type HelperView = {
	registry: string
	id: string
	/** `features.fs`. */
	title: string
	/** First line of the description. */
	summary: string
	markdown: string
	/** Options as JSON schema (null when the helper has no zod options). */
	options: any
	state: any
	events: string[]
	/** True when an instance exists now. */
	live: boolean
	/** The live state as pretty JSON, or null when there is no instance. */
	stateText: string | null
	/** One line for the live state section when there is no instance. */
	liveNote: string | null
	/** True when the inspector may call a method (a live instance, or a feature it can create). */
	callable: boolean
	optionFields: WorkbenchField[]
	stateFields: WorkbenchField[]
	getters: WorkbenchField[]
	methods: WorkbenchMethod[]
	/** Where the helper comes from: own, borrowed, plugin, ~/.luca or built in. */
	origin?: HelperOrigin
	/** The `@example` blocks of the class, its methods and its getters, runnable in the console. */
	examples: HelperExample[]
}

/** One `@example` block as the inspector lists it. */
export type HelperExample = {
	/** `class`, `method:readFile`, `getter:cwd`: stable across loads. */
	id: string
	/** `fs`, `fs.readFile()`, `fs.cwd`. */
	title: string
	code: string
	language: string
	from: 'class' | 'method' | 'getter'
	/** The method or getter name; none for a class example. */
	member?: string
}

/**
 * The examples an introspection holds: the class's first, then each method's
 * and each getter's in name order. Pure.
 */
export function examplesOf(id: string, introspection: any): HelperExample[] {
	const out: HelperExample[] = []
	const take = (from: HelperExample['from'], member: string | undefined, list: any) => {
		if (!Array.isArray(list)) return
		list.forEach((ex: any, i: number) => {
			const code = typeof ex === 'string' ? ex : String(ex?.code ?? '')
			if (!code.trim()) return
			const key = member ? `${from}:${member}` : from
			out.push({
				id: i ? `${key}#${i + 1}` : key,
				title: member ? (from === 'method' ? `${id}.${member}()` : `${id}.${member}`) : id,
				code: code.trim(),
				language: String(ex?.language || 'ts'),
				from,
				...(member ? { member } : {}),
			})
		})
	}
	take('class', undefined, introspection?.examples)
	for (const name of Object.keys(introspection?.methods ?? {}).sort()) take('method', name, introspection.methods[name]?.examples)
	for (const name of Object.keys(introspection?.getters ?? {}).sort()) take('getter', name, introspection.getters[name]?.examples)
	return out
}

/** A value as text for the inspector: strings as is, the rest as pretty JSON. */
export function displayText(value: any): string {
	if (typeof value === 'string') return value
	try {
		const text = JSON.stringify(value, null, 2)
		return text === undefined ? String(value) : text
	} catch {
		return String(value)
	}
}

function oneLine(text: unknown, max = 240): string {
	const s = typeof text === 'string' ? text.replace(/\s+/g, ' ').trim() : ''
	return s.length > max ? s.slice(0, max - 1) + '…' : s
}

function fieldsOf(map: any, required: string[] = []): WorkbenchField[] {
	if (!map || typeof map !== 'object') return []
	return Object.entries(map).map(([name, raw]: [string, any]) => {
		const field: WorkbenchField = {
			name,
			type: String(raw?.type ?? raw?.returns ?? 'unknown'),
			description: oneLine(raw?.description, 400),
		}
		if (required.includes(name)) field.required = true
		return field
	})
}

/** Option rows from introspection, else from the JSON schema's properties. */
function optionFieldsOf(introspection: any, jsonSchema: any): WorkbenchField[] {
	const fromIntrospection = fieldsOf(introspection?.options)
	if (fromIntrospection.length) return fromIntrospection
	const props = jsonSchema?.properties
	if (!props || typeof props !== 'object') return []
	const required: string[] = Array.isArray(jsonSchema.required) ? jsonSchema.required : []
	return Object.entries(props).map(([name, raw]: [string, any]) => {
		const type = raw?.type ? (Array.isArray(raw.type) ? raw.type.join(' | ') : String(raw.type)) : raw?.enum ? raw.enum.map((v: any) => JSON.stringify(v)).join(' | ') : 'unknown'
		const field: WorkbenchField = { name, type, description: oneLine(raw?.description, 400) }
		if (required.includes(name)) field.required = true
		return field
	})
}

/** Prototype methods a helper class adds over its base, for helpers with no introspection docs. */
function prototypeMethodNames(ctor: any): string[] {
	const names: string[] = []
	let proto = ctor?.prototype
	// Stop at the framework base classes: their methods are on every helper.
	while (proto && proto !== Object.prototype && !['Helper', 'Feature', 'Client', 'Server', 'Command', 'Endpoint', 'Selector'].includes(proto.constructor?.name)) {
		for (const name of Object.getOwnPropertyNames(proto)) {
			if (name === 'constructor' || name.startsWith('_') || names.includes(name)) continue
			const desc = Object.getOwnPropertyDescriptor(proto, name)
			if (desc && typeof desc.value === 'function') names.push(name)
		}
		proto = Object.getPrototypeOf(proto)
	}
	return names
}

function argsHintFor(params: WorkbenchField[]): string {
	if (!params.length) return 'no arguments: press Enter'
	if (params.length === 1) return `${params[0]!.name}: a JSON value, or plain text for a string`
	return `a JSON array: [${params.map((p) => p.name).join(', ')}]`
}

export function methodsOf(ctor: any, introspection: any): WorkbenchMethod[] {
	const documented = introspection?.methods && typeof introspection.methods === 'object' ? introspection.methods : {}
	const out: WorkbenchMethod[] = []
	for (const [name, raw] of Object.entries<any>(documented)) {
		const required: string[] = Array.isArray(raw?.required) ? raw.required : []
		const params = fieldsOf(raw?.parameters, required)
		const returns = String(raw?.returns ?? 'unknown')
		const sig = params.map((p) => `${p.name}${p.required ? '' : '?'}: ${p.type}`).join(', ')
		out.push({ name, signature: `${name}(${sig}): ${returns}`, description: oneLine(raw?.description, 400), params, returns, argsHint: argsHintFor(params), askArgs: params.length > 0 })
	}
	if (!out.length) {
		for (const name of prototypeMethodNames(ctor)) {
			let arity = 0
			try { arity = Number(ctor.prototype[name]?.length) || 0 } catch {}
			const params: WorkbenchField[] = Array.from({ length: arity }, (_, i) => ({ name: `arg${i + 1}`, type: 'unknown', description: '' }))
			// Undocumented: `length` misses default and rest parameters, so always ask.
			out.push({ name, signature: `${name}(${params.map((p) => p.name).join(', ')})`, description: '', params, returns: 'unknown', argsHint: params.length ? argsHintFor(params) : 'arguments not documented: a JSON array, one value, or empty for none', askArgs: true })
		}
	}
	return out.sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * The arguments the user typed, as an argument list. Empty: none. A JSON
 * array: spread when the method takes more than one argument. Other JSON:
 * one argument. Anything else: one string argument.
 */
export function parseArgs(text: unknown, paramCount: number): any[] {
	if (Array.isArray(text)) return text
	if (typeof text !== 'string') return text === undefined || text === null ? [] : [text]
	const trimmed = text.trim()
	if (!trimmed) return []
	let value: any
	try { value = JSON.parse(trimmed) } catch { return [trimmed] }
	if (Array.isArray(value) && paramCount !== 1) return value
	return [value]
}

/** The card stacks of the registry tile: one stack per registry, project helpers first. */
export function allRegistryStacks(container: any, origins?: Origins): { stacks: Array<{ id: string; title: string; cards: any[] }> } {
	const projectKeys = projectHelperKeys(container)
	const stacks = registryNames(container).map((registry) => {
		const ids: string[] = [...(container[registry]?.available || [])]
		const fromProject = (id: string) => projectKeys.has(`${registry}.${id}`)
		ids.sort((a, b) => Number(fromProject(b)) - Number(fromProject(a)) || a.localeCompare(b))
		const cards = ids.map((id) => {
			const lines = descriptionOf(container, registry, id).split('\n').map((l) => l.trim()).filter(Boolean)
			const card: any = {
				id: `${registry}.${id}`,
				title: id,
				subtitle: (lines[0] || '').slice(0, 200),
				preview: lines.slice(0, 3).join('\n').slice(0, 400),
				open: { tool: 'helper', registry, id },
				// A command opens its runner; every other helper its inspector.
				address: registry === 'commands' ? `command/${encodeURIComponent(id)}` : `helper/${encodeURIComponent(registry)}/${encodeURIComponent(id)}`,
			}
			if (fromProject(id)) card.badge = 'project'
			if (origins) card.origin = origins.of(registry, id)
			return card
		})
		return { id: registry, title: registry, cards }
	})
	return { stacks: stacks.filter((s) => s.cards.length > 0) }
}

/** Returns undefined for an unknown helper. `safe` makes values JSON-safe. */
export async function helperView(
	container: any,
	registry: string,
	id: string,
	safe: (v: any) => any,
	origins?: Origins,
): Promise<HelperView | undefined> {
	const reg = registryOf(container, registry)
	if (!reg || !reg.has(id)) return undefined

	const describer = new ContainerDescriber(container)
	let markdown = ''
	try {
		await describer.initialize()
		const [item] = describer.resolve(`${registry}.${id}`, 'server')
		markdown = item ? describer.getData(item, { platform: 'server' }).text : ''
	} catch (err: any) {
		if (!(err instanceof DescribeError) && err?.name !== 'DescribeError') throw err
		markdown = `# ${registry}.${id}\n\n${descriptionOf(container, registry, id)}`
	}

	const ctor: any = reg.lookup(id)
	const live = findLiveInstance(container, registry, id)
	let state: any = null
	if (live) {
		try { state = safe(live.state?.current ?? null) } catch { state = null }
	}

	const introspection = introspectionOf(container, registry, id)
	const options = optionsJsonSchema(ctor)
	return {
		registry,
		id,
		title: `${registry}.${id}`,
		summary: oneLine(descriptionOf(container, registry, id).split('\n')[0]),
		markdown,
		options,
		state,
		events: eventNames(ctor, introspection),
		live: !!live,
		stateText: live ? displayText(state) : null,
		liveNote: live ? null : registry === 'features'
			? 'No instance yet. Calling a method creates one.'
			: 'No instance yet. Create one in the console to see its state and call it.',
		callable: !!live || registry === 'features',
		optionFields: optionFieldsOf(introspection, options),
		stateFields: fieldsOf(introspection?.state),
		getters: fieldsOf(introspection?.getters),
		methods: methodsOf(ctor, introspection),
		...(origins ? { origin: origins.of(registry, id) } : {}),
		examples: examplesOf(id, introspection),
	}
}

const INTERNAL_ARGS = new Set(['_', 'dispatchSource', '_cacheKey'])

function jsonType(raw: any): { type: import('./runs.js').CommandField['type']; options?: string[] } {
	if (!raw || typeof raw !== 'object') return { type: 'unknown' }
	if (Array.isArray(raw.enum)) return { type: 'enum', options: raw.enum.map(String) }
	const variants = raw.anyOf || raw.oneOf
	if (Array.isArray(variants)) {
		for (const v of variants) {
			const t = jsonType(v)
			if (t.type !== 'unknown' && v?.type !== 'null') return t
		}
	}
	const t = Array.isArray(raw.type) ? raw.type.find((x: string) => x !== 'null') : raw.type
	if (t === 'string' || t === 'boolean' || t === 'array') return { type: t }
	if (t === 'number' || t === 'integer') return { type: 'number' }
	return { type: 'unknown' }
}

function defaultText(value: any): string | null {
	if (value === undefined) return null
	if (Array.isArray(value)) return value.length ? value.map(String).join(' ') : null
	if (value === null) return null
	return typeof value === 'string' ? value : JSON.stringify(value)
}

const kebab = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()

/** The form for one command, from its `argsSchema` and `positionals`. */
export type CommandFormView = {
	id: string
	title: string
	summary: string
	badge: 'project' | null
	usage: string
	fields: import('./runs.js').CommandField[]
	examples: Array<{ command: string; description: string }>
	/** `export const subcommands`: the verbs a command takes, for a picker. */
	subcommands: Array<{ name: string; args: string; description: string }>
	origin?: HelperOrigin
}

export function commandView(container: any, id: string, origins?: Origins): CommandFormView | undefined {
	const reg = registryOf(container, 'commands')
	if (!reg || !reg.has(id)) return undefined
	const Cmd: any = reg.lookup(id)
	let schema: any = null
	try { schema = Cmd.argsSchema?.toJSONSchema?.({ unrepresentable: 'any', io: 'input' }) } catch {}
	const props: Record<string, any> = schema?.properties && typeof schema.properties === 'object' ? schema.properties : {}
	const required: string[] = Array.isArray(schema?.required) ? schema.required : []
	const specs: any[] = Array.isArray(Cmd.positionals) ? Cmd.positionals : []
	const fields: import('./runs.js').CommandField[] = []

	specs.forEach((spec, position) => {
		const rawName = typeof spec === 'string' ? spec : String(spec?.name ?? '')
		const variadic = rawName.startsWith('...')
		const name = variadic ? rawName.slice(3) : rawName
		if (!name) return
		const prop = props[name]
		const t = prop ? jsonType(prop) : { type: 'string' as const }
		fields.push({
			name,
			flag: `--${kebab(name)}`,
			type: variadic ? 'array' : t.type,
			...(t.options ? { options: t.options } : {}),
			default: defaultText(prop?.default),
			description: oneLine(prop?.description || (typeof spec === 'object' ? spec?.description : '') || '', 400),
			required: required.includes(name) || (typeof spec === 'object' && spec?.required === true),
			positional: true,
			position,
		})
	})
	const taken = new Set(fields.map((f) => f.name))
	for (const [name, prop] of Object.entries<any>(props)) {
		if (INTERNAL_ARGS.has(name) || taken.has(name)) continue
		// The base helper option, not a flag the command declared.
		if (name === 'name' && /^Optional name identifier for this helper instance/.test(String(prop?.description || ''))) continue
		const t = jsonType(prop)
		fields.push({
			name,
			flag: `--${kebab(name)}`,
			type: t.type,
			...(t.options ? { options: t.options } : {}),
			default: defaultText(prop?.default),
			description: oneLine(prop?.description, 400),
			required: required.includes(name),
			positional: false,
		})
	}
	fields.push({
		name: '__extra__', flag: '', type: 'string', default: null,
		description: 'More arguments, typed as on the command line', required: false, positional: false, extra: true,
	})

	const usage = ['luca', id, ...fields.filter((f) => f.positional).map((f) => (f.required ? `<${f.name}>` : `[${f.name}]`)),
		...(fields.some((f) => !f.positional && !f.extra) ? ['[flags]'] : [])].join(' ')
	const examples = (Array.isArray(Cmd.examples) ? Cmd.examples : []).map((e: any) =>
		typeof e === 'string' ? { command: e, description: '' } : { command: String(e?.command ?? ''), description: String(e?.description ?? '') })
	const description = String(Cmd.commandDescription || descriptionOf(container, 'commands', id) || '')
	const subs = Cmd.subcommands && typeof Cmd.subcommands === 'object' ? Cmd.subcommands : {}
	const subcommands = Object.entries<any>(subs).map(([name, sub]) => ({
		name, args: String(sub?.args ?? ''), description: oneLine(String(sub?.description ?? ''), 400),
	}))
	return {
		id,
		title: `luca ${id}`,
		summary: oneLine(description.split('\n')[0]),
		badge: projectHelperKeys(container).has(`commands.${id}`) ? 'project' : null,
		usage,
		fields,
		examples,
		subcommands,
		...(origins ? { origin: origins.of('commands', id) } : {}),
	}
}
