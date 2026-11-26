/**
 * Extra tools for one workbench chat. An extension is a container feature's
 * tool surface (`fileTools`, `contentDb`, ...) or a tool set invented in
 * memory, added to a single conversation. The assistant's own files never
 * change and its other conversations never see the tools.
 *
 * The list is kept per conversation thread in the project's diskCache, so a
 * chat keeps its tools after the host restarts. `ChatSessions` mounts the
 * list before each turn, and serves it as an MCP server to an assistant that
 * runs on a coding agent.
 *
 * `supportTools(target)` gives a helper chat (lucaExpert, opened as the tech
 * support of another chat) the tools to change that chat's list.
 */
import { z } from 'zod'

export const ChatExtensionSchema = z.object({
	feature: z.string().trim().min(1),
	only: z.array(z.string().trim().min(1)).optional(),
	options: z.record(z.string(), z.any()).optional(),
	folder: z.string().trim().min(1).optional(),
	source: z.string().optional(),
	description: z.string().optional(),
})
export type ChatExtension = z.infer<typeof ChatExtensionSchema>

export type ToolBundle = { schemas: Record<string, any>; handlers: Record<string, (args: any) => any>; setup?: (assistant: any) => void; provider?: any }

/** One option a client can draw as a single field. */
export type ChatExtensionOption = {
	name: string
	type: 'string' | 'number' | 'integer' | 'boolean'
	description: string
	default?: string | number | boolean
	enum?: string[]
	minimum?: number
	maximum?: number
}

export type ChatExtensionFeature = {
	name: string
	description: string
	/** `all` when the assistant already has every tool, `some` for part of them. */
	builtIn?: 'all' | 'some'
	tools: Array<{ name: string; description: string; builtIn?: boolean }>
	options: ChatExtensionOption[]
}

/** Who a support chat extends. */
export type ChatTarget = { assistant: string; conversationId: string }

/** What the support tools need from the chat sessions. */
export type ChatExtensionHost = {
	extensions(target: ChatTarget): Promise<ChatExtension[]>
	setExtensions(target: ChatTarget, list: ChatExtension[]): Promise<ChatExtension[]>
	toolNames(target: ChatTarget): Promise<string[]>
}

/** Argument names that carry a filesystem path in the container's tool surfaces. */
const PATH_ARGS = ['path', 'source', 'destination', 'cwd', 'directory', 'filePath']
/** Options every helper has that are not settings. */
const INTERNAL_OPTIONS = new Set(['name', '_cacheKey', 'cached', 'enable'])
export const PROMPT_KEY = 'workbenchChatExtensions'

/**
 * The options of a feature's JSON schema that are one plain value. Objects,
 * arrays and unions are left out: the app cannot draw them as one field, so
 * they are set through the tech support chat. Pure.
 */
export function scalarOptions(schema: any): ChatExtensionOption[] {
	const properties = schema?.properties && typeof schema.properties === 'object' ? schema.properties : {}
	const out: ChatExtensionOption[] = []
	for (const [name, prop] of Object.entries<any>(properties)) {
		if (!prop || typeof prop !== 'object' || INTERNAL_OPTIONS.has(name)) continue
		const description = typeof prop.description === 'string' ? prop.description : ''
		if (/\(tests?\)\s*$/i.test(description)) continue
		const isEnum = Array.isArray(prop.enum) && prop.enum.length > 0 && prop.enum.every((v: any) => typeof v === 'string')
		if (!isEnum && !['string', 'number', 'integer', 'boolean'].includes(prop.type)) continue
		const option: ChatExtensionOption = { name, type: isEnum ? 'string' : prop.type, description }
		if (['string', 'number', 'boolean'].includes(typeof prop.default)) option.default = prop.default
		if (isEnum) option.enum = prop.enum
		if (typeof prop.minimum === 'number') option.minimum = prop.minimum
		if (typeof prop.maximum === 'number' && prop.maximum < Number.MAX_SAFE_INTEGER) option.maximum = prop.maximum
		out.push(option)
	}
	return out
}

/** A list from a client, cleaned: unknown keys dropped, one entry per feature. Throws on a bad shape. */
export function parseExtensions(value: unknown): ChatExtension[] {
	const list = z.array(ChatExtensionSchema).parse(value ?? [])
	const seen = new Set<string>()
	return list.filter((entry) => !seen.has(entry.feature) && !!seen.add(entry.feature))
}

/** One line per extension, for a tool result. Pure. */
export function summary(entry: ChatExtension) {
	return {
		feature: entry.feature,
		...(entry.only?.length ? { only: entry.only } : {}),
		...(entry.folder ? { folder: entry.folder } : {}),
		...(entry.options && Object.keys(entry.options).length ? { options: entry.options } : {}),
		...(entry.source ? { invented: true, description: entry.description || '' } : {}),
	}
}

function staticTools(Constructor: any): Record<string, any> {
	const merged: Record<string, any> = {}
	const chain: any[] = []
	let current = Constructor
	while (current && current !== Object) {
		if (Object.hasOwn(current, 'tools') && current.tools) chain.unshift(current)
		current = Object.getPrototypeOf(current)
	}
	for (const entry of chain) Object.assign(merged, entry.tools)
	return merged
}

function hasOwnToTools(Constructor: any): boolean {
	let proto = Constructor?.prototype
	while (proto && proto !== Object.prototype) {
		if (Object.hasOwn(proto, 'toTools')) return proto.constructor?.name !== 'Helper'
		proto = Object.getPrototypeOf(proto)
	}
	return false
}

function jsonSchema(schema: any): any {
	if (!schema) return {}
	try { return z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) } catch {}
	try { return schema.toJSONSchema?.() ?? {} } catch { return {} }
}

function describeTool(schema: any, description?: string): string {
	return String(schema?.description || description || '').split('\n')[0]!.trim()
}

export class ChatExtensions {
	private catalogCache: Array<Omit<ChatExtensionFeature, 'builtIn'>> | null = null

	constructor(private container: any) {}

	/** Features with tools, for the picker. Tools the assistant has (`has`) come back marked built in. */
	available(has: string[] = []): ChatExtensionFeature[] {
		const owned = new Set(has)
		return this.catalog().map((feature) => {
			const tools = feature.tools.map((tool) => (owned.has(tool.name) ? { ...tool, builtIn: true } : tool))
			const count = tools.filter((tool) => tool.builtIn).length
			return { ...feature, ...(count ? { builtIn: count === tools.length ? 'all' as const : 'some' as const } : {}), tools }
		})
	}

	private catalog() {
		if (this.catalogCache) return this.catalogCache
		const out: Array<Omit<ChatExtensionFeature, 'builtIn'>> = []
		for (const name of [...this.container.features.available].sort() as string[]) {
			try {
				const Constructor: any = this.container.features.lookup(name)
				let tools = Object.entries(staticTools(Constructor)).map(([tool, entry]: [string, any]) => ({ name: tool, description: describeTool(entry?.schema, entry?.description) }))
				// A feature that builds its tools at runtime has to be made to list them.
				if (!tools.length && hasOwnToTools(Constructor)) {
					try {
						const bundle = this.container.feature(name).toTools()
						tools = Object.entries(bundle?.schemas || {}).map(([tool, schema]) => ({ name: tool, description: describeTool(schema) }))
					} catch {}
				}
				if (!tools.length) continue
				const intro = this.container.features.introspect?.(`features.${name}`) || Constructor.introspect?.()
				const description = String(intro?.description || Constructor.description || '').split('\n')[0]!.trim()
				out.push({ name, description, tools, options: scalarOptions(jsonSchema(Constructor.optionsSchema)) })
			} catch {}
		}
		this.catalogCache = out
		return out
	}

	/** Build the `{ schemas, handlers }` for one extension. Throws when it cannot be built. */
	async bundle(entry: ChatExtension): Promise<ToolBundle> {
		let bundle: ToolBundle
		if (entry.source) {
			bundle = await this.evaluate(entry.feature, entry.source)
		} else {
			if (!this.container.features.available.includes(entry.feature)) throw new Error(`Unknown feature: ${entry.feature}`)
			const feature: any = this.container.feature(entry.feature, entry.options || {})
			if (typeof feature.toTools !== 'function') throw new Error(`${entry.feature} has no tools`)
			bundle = feature.toTools()
		}
		let names = Object.keys(bundle.schemas || {})
		if (entry.only?.length) names = names.filter((name) => entry.only!.includes(name))
		if (!names.length) throw new Error(`${entry.feature} has none of the requested tools`)
		const folder = entry.folder ? this.resolveFolder(entry.folder) : null
		const schemas: Record<string, any> = {}
		const handlers: Record<string, any> = {}
		for (const name of names) {
			schemas[name] = bundle.schemas[name]
			handlers[name] = folder ? this.heldToFolder(name, bundle.schemas[name], bundle.handlers[name]!, folder) : bundle.handlers[name]
		}
		return { schemas, handlers, setup: bundle.setup, provider: { name: `chatExtension.${entry.feature}` } }
	}

	/**
	 * Every extension's tools, less the ones the assistant has already, and
	 * the prompt lines that tell the assistant about them. An extension that
	 * fails to build becomes a line, so the assistant can tell the user.
	 */
	async build(entries: ChatExtension[], has: Set<string>): Promise<{ tools: ToolBundle; setups: Array<(a: any) => void>; lines: string[] }> {
		const tools: ToolBundle = { schemas: {}, handlers: {} }
		const setups: Array<(a: any) => void> = []
		const lines: string[] = []
		for (const entry of entries) {
			try {
				const bundle = await this.bundle(entry)
				const names = Object.keys(bundle.schemas).filter((name) => !has.has(name) && !tools.schemas[name])
				if (!names.length) continue
				for (const name of names) {
					tools.schemas[name] = bundle.schemas[name]
					tools.handlers[name] = bundle.handlers[name]!
				}
				if (bundle.setup) setups.push(bundle.setup)
				lines.push(`- ${names.join(', ')} (${entry.feature})${entry.folder ? `. Paths must stay inside ${this.resolveFolder(entry.folder)}; relative paths resolve against it.` : ''}`)
			} catch (error: any) {
				lines.push(`- ${entry.feature} could not be loaded: ${error?.message || error}. Tell the user if they ask for it.`)
			}
		}
		return { tools, setups, lines }
	}

	/** The prompt block for the lines `build()` gave. */
	static prompt(lines: string[]): string {
		return ['## Tools Added To This Conversation', 'The user added these tools to this conversation only:', '', ...lines].join('\n')
	}

	/** Write an invented tool set to `features/<name>.ts` as a container feature. */
	async save(entry: ChatExtension): Promise<{ path: string }> {
		if (!entry.source) throw new Error(`${entry.feature} is a container feature already`)
		if (!/^[a-z][A-Za-z0-9]*$/.test(entry.feature)) throw new Error('The name must be camelCase letters and digits')
		const { kebabCase, upperFirst } = this.container.utils.lodash
		const fs: any = this.container.feature('fs')
		const path = this.container.paths.resolve(this.container.cwd, 'features', `${kebabCase(entry.feature)}.ts`)
		if (await fs.exists(path)) throw new Error(`${path} already exists`)
		const className = upperFirst(entry.feature)
		const body = entry.source.split('\n').map((line: string) => `      ${line}`).join('\n')
		await fs.writeFile(path, [
			'/**',
			` * ${className}: ${(entry.description || 'tools saved from a chat extension').replace(/\*\//g, '')}`,
			' *',
			' * Saved from a workbench chat. toTools() runs the body that was written in the chat.',
			' */',
			"import { z } from 'zod'",
			"import { Feature } from 'luca'",
			'',
			`export class ${className} extends Feature {`,
			`  static override shortcut = 'features.${entry.feature}' as const`,
			`  static { Feature.register(this as any, '${entry.feature}') }`,
			'',
			'  override toTools(options: any = {}): any {',
			'    const bundle: any = (function (container: any, z: any): any {',
			body,
			'    })(this.container, z)',
			'    if (!options?.only?.length) return bundle',
			'    const keep = (map: any) => Object.fromEntries(Object.entries(map).filter(([name]) => options.only.includes(name)))',
			'    return { ...bundle, schemas: keep(bundle.schemas), handlers: keep(bundle.handlers) }',
			'  }',
			'}',
			'',
			`export default ${className}`,
			'',
		].join('\n'))
		return { path }
	}

	/** The tools a support chat gets to change `target`'s list. */
	supportTools(target: ChatTarget, host: ChatExtensionHost): ToolBundle {
		const current = () => host.extensions(target)
		const put = async (entry: ChatExtension) => {
			await this.bundle(entry)
			const rest = (await current()).filter((existing) => existing.feature !== entry.feature)
			const list = await host.setExtensions(target, [...rest, entry])
			return { ok: true, extensions: list.map(summary), note: "Active from the chat's next message." }
		}
		const guard = (run: (args: any) => Promise<any>) => async (args: any) => {
			try { return await run(args || {}) } catch (error: any) { return { error: error?.message || String(error) } }
		}
		const schemas = {
			chatExtensionCatalog: z.object({
				query: z.string().optional().describe('Filter by feature or tool name.'),
			}).describe('List the container features whose tools can be added to the chat, with their tool names and options.'),
			chatExtensionsList: z.object({}).describe('List the extensions the chat has now, and the tools its assistant has built in.'),
			extendChat: z.object({
				feature: z.string().describe('Feature name from chatExtensionCatalog.'),
				only: z.array(z.string()).optional().describe('Tool names to add. Leave out for all of them.'),
				options: z.record(z.string(), z.any()).optional().describe('Options for container.feature().'),
				folder: z.string().optional().describe('Hold the tools to this absolute folder: every path argument must stay inside it.'),
			}).describe("Add a container feature's tools to the chat. Replaces an extension of the same feature. Takes effect on the chat's next message."),
			inventChatTools: z.object({
				name: z.string().describe('camelCase name for the tool set.'),
				description: z.string().describe('One line on what it is for.'),
				source: z.string().describe('A synchronous JavaScript function body. `container` and `z` (zod) are in scope. It must `return { schemas, handlers }`: schemas maps each tool name to a z.object(...).describe(...), handlers maps the same names to (async) functions of the parsed arguments.'),
				folder: z.string().optional().describe('Hold the tools to this absolute folder.'),
			}).describe('Invent a new tool set in memory and add it to the chat. Nothing is written to disk. The source is run once now to check it.'),
			removeChatExtension: z.object({
				feature: z.string().describe("The extension's feature name."),
			}).describe('Remove one extension from the chat.'),
			saveChatExtension: z.object({
				feature: z.string().describe('The name of an invented tool set on the chat.'),
			}).describe('Write an invented tool set to features/<name>.ts in this project, as a container feature any assistant can use later.'),
		}
		const handlers = {
			chatExtensionCatalog: guard(async (args) => {
				const query = String(args.query || '').toLowerCase()
				const has = await host.toolNames(target)
				return this.available(has)
					.filter((f) => !query || f.name.toLowerCase().includes(query) || f.tools.some((t) => t.name.toLowerCase().includes(query)))
					.map((f) => ({ feature: f.name, description: f.description.slice(0, 200), builtIn: f.builtIn, tools: f.tools.map((t) => t.name), options: f.options.map((o) => o.name) }))
			}),
			chatExtensionsList: guard(async () => ({ extensions: (await current()).map(summary), builtInTools: await host.toolNames(target) })),
			extendChat: guard((args) => put({
				feature: String(args.feature),
				...(args.only?.length ? { only: args.only } : {}),
				...(args.options ? { options: args.options } : {}),
				...(args.folder ? { folder: this.resolveFolder(args.folder) } : {}),
			})),
			inventChatTools: guard((args) => {
				if (this.container.features.available.includes(args.name)) throw new Error(`${args.name} is already a container feature; pick another name`)
				return put({
					feature: String(args.name),
					description: String(args.description || ''),
					source: String(args.source || ''),
					...(args.folder ? { folder: this.resolveFolder(args.folder) } : {}),
				})
			}),
			removeChatExtension: guard(async (args) => {
				const list = await host.setExtensions(target, (await current()).filter((existing) => existing.feature !== args.feature))
				return { ok: true, extensions: list.map(summary) }
			}),
			saveChatExtension: guard(async (args) => {
				const entry = (await current()).find((existing) => existing.feature === args.feature)
				if (!entry) throw new Error(`The chat has no extension named ${args.feature}`)
				const saved = await this.save(entry)
				return { ok: true, ...saved, note: 'The project registers it as a container feature after the workbench host restarts. The chat keeps using its in-memory copy.' }
			}),
		}
		return { schemas, handlers, provider: { name: 'workbench.chatExtensions' } }
	}

	/** The prompt a support chat gets alongside `supportTools()`. */
	static brief(target: ChatTarget): string {
		return [
			'## Tech Support For The Chat Beside You',
			`You are open next to the user's conversation with the ${target.assistant} assistant (conversation \`${target.conversationId}\`) in Luca Desktop. Here your job is to change what that one conversation can do. Nothing you do here changes the assistant's files or its other conversations.`,
			'',
			'### Order of work',
			'1. chatExtensionsList shows what the chat has. chatExtensionCatalog shows the container features that have tools. If one fits, extendChat adds it, whole or by tool name, with options.',
			'2. To limit file access, pass `folder`: every path the tools take must then stay inside it. "Let it save files to ~/notes only" is extendChat with feature fileTools, only writeFile, editFile and createDirectory, and that folder.',
			'3. When no feature fits, write the tool. Check how the container behaves first (luca describe, a quick eval). Do not guess a method name. Then inventChatTools adds it: its `source` is a function body that returns `{ schemas, handlers }`. It stays with the conversation and saveChatExtension can write it to features/.',
			"4. An `ok: true` result is the confirmation. Say in one line what you added and that it applies from the chat's next message.",
		].join('\n')
	}

	private resolveFolder(folder: string): string {
		const home = String(this.container.feature('os').homedir)
		const expanded = folder === '~' ? home : folder.startsWith('~/') ? `${home}/${folder.slice(2)}` : folder
		return this.container.paths.resolve(this.container.cwd, expanded)
	}

	/** Run an invented tool set's source and check what it returns. */
	private async evaluate(name: string, source: string): Promise<ToolBundle> {
		const vm: any = this.container.feature('vm')
		const result = await vm.run(`(function (container, z) {\n${source}\n})(container, z)`, { container: this.container, z })
		const schemas = result?.schemas
		const handlers = result?.handlers
		if (!schemas || typeof schemas !== 'object' || !handlers || typeof handlers !== 'object') {
			throw new Error(`${name}: the source must return { schemas, handlers }`)
		}
		for (const tool of Object.keys(schemas)) {
			if (typeof handlers[tool] !== 'function') throw new Error(`${name}: no handler for ${tool}`)
		}
		return { schemas, handlers }
	}

	/**
	 * Wrap a handler so its path arguments cannot leave `folder`. Relative
	 * paths resolve against the folder; a tool with an optional `path`
	 * defaults to it. A symlink inside the folder can point out of it, so the
	 * real path of the nearest ancestor that exists is checked too.
	 */
	heldToFolder(tool: string, schema: any, handler: (args: any) => any, folder: string) {
		const paths = this.container.paths
		const fs: any = this.container.feature('fs')
		const inside = (root: string, target: string) => {
			const rel = paths.relative(root, target)
			return rel === '' || (!rel.startsWith('..') && !rel.startsWith('/'))
		}
		const realInside = async (target: string) => {
			try {
				const root = await fs.realpath(folder)
				let probe = target
				while (!(await fs.exists(probe))) {
					const parent = paths.dirname(probe)
					if (parent === probe) return true
					probe = parent
				}
				return inside(root, await fs.realpath(probe))
			} catch {
				return true
			}
		}
		return async (input: any) => {
			const args = { ...(input || {}) }
			if (args.path === undefined && schema?.shape?.path) args.path = folder
			for (const key of PATH_ARGS) {
				if (typeof args[key] !== 'string' || !args[key]) continue
				const resolved = paths.resolve(folder, args[key])
				if (!inside(folder, resolved) || !(await realInside(resolved))) {
					return JSON.stringify({ error: `Refused: ${tool} on "${args[key]}" is outside ${folder}. In this conversation these tools work only inside that folder.` })
				}
				args[key] = resolved
			}
			return handler(args)
		}
	}
}
