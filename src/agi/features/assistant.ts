import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from '../../schemas/base.js'
import { type AvailableFeatures } from '@soederpop/luca/feature'
import { Feature } from '@soederpop/luca/feature'
import type { Conversation, ConversationTool, ContentPart, AskOptions, Message } from './conversation'
import type { AGIContainer } from '../container.server.js'
import type { ContentDb } from '@soederpop/luca/node'
import type { ConversationHistory, ConversationMeta } from './conversation-history'
import hashObject from '../../hash-object.js'
import { InterceptorChain, type InterceptorFn, type InterceptorPoints, type InterceptorPoint } from '../lib/interceptor-chain.js'

declare module '@soederpop/luca/feature' {
	interface AvailableFeatures {
		assistant: typeof Assistant
	}
}

export const AssistantEventsSchema = FeatureEventsSchema.extend({
	created: z.tuple([]).describe('Emitted immediately after the assistant loads its prompt, tools, and hooks.'),
	started: z.tuple([]).describe('Emitted when the assistant has been initialized'),
	turnStart: z.tuple([z.object({ turn: z.number(), isFollowUp: z.boolean() })]).describe('Emitted when a new completion turn begins. isFollowUp is true when resuming after tool calls'),
	turnEnd: z.tuple([z.object({ turn: z.number(), hasToolCalls: z.boolean() })]).describe('Emitted when a completion turn ends. hasToolCalls indicates whether tool calls will follow'),
	chunk: z.tuple([z.string().describe('A chunk of streamed text')]).describe('Emitted as tokens stream in'),
	preview: z.tuple([z.string().describe('The accumulated response so far')]).describe('Emitted with the full response text accumulated across all turns'),
	response: z.tuple([z.string().describe('The final response text')]).describe('Emitted when a complete response is produced (accumulated across all turns)'),
	rawEvent: z.tuple([z.any().describe('A raw streaming event from the active model API')]).describe('Emitted for each raw streaming event from the underlying conversation transport'),
	mcpEvent: z.tuple([z.any().describe('A raw MCP-related streaming event')]).describe('Emitted for MCP-specific streaming and output-item events when using Responses API MCP tools'),
	toolCall: z.tuple([z.string().describe('Tool name'), z.any().describe('Tool arguments')]).describe('Emitted when a tool is called'),
	toolResult: z.tuple([z.string().describe('Tool name'), z.any().describe('Result value')]).describe('Emitted when a tool returns a result'),
	toolError: z.tuple([z.string().describe('Tool name'), z.any().describe('Error')]).describe('Emitted when a tool call fails'),
	hookFired: z.tuple([z.string().describe('Hook/event name')]).describe('Emitted when a hook function is called'),
	systemPromptExtensionsChanged: z.tuple([]).describe('Emitted when system prompt extensions are added or removed'),
})

export const AssistantStateSchema = FeatureStateSchema.extend({
	started: z.boolean().describe('Whether the assistant has been initialized'),
	conversationCount: z.number().describe('Number of ask() calls made'),
	lastResponse: z.string().describe('The most recent response text'),
	folder: z.string().describe('The resolved assistant folder path'),
	docsFolder: z.string().describe('The resolved docs folder'),
	conversationId: z.string().optional().describe('The active conversation persistence ID'),
	threadId: z.string().optional().describe('The active thread ID'),
	systemPrompt: z.string().describe('The loaded system prompt text'),
	systemPromptExtensions: z.record(z.string(), z.string()).describe('Named extensions appended to the system prompt'),
	meta: z.record(z.string(), z.any()).describe('Parsed YAML frontmatter from CORE.md'),
	tools: z.record(z.string(), z.any()).describe('Registered tool implementations'),
	hooks: z.record(z.string(), z.any()).describe('Loaded event hook functions'),
	resumeThreadId: z.string().optional().describe('Thread ID override for resume'),
	pendingPlugins: z.array(z.any()).describe('Pending async plugin promises'),
	conversation: z.any().nullable().describe('The active Conversation feature instance'),
	subagents: z.record(z.string(), z.any()).describe('Cached subagent instances'),
})

export const AssistantOptionsSchema = FeatureOptionsSchema.extend({
	/** The folder containing the assistant definition (CORE.md, tools.ts, hooks.ts). Optional for runtime-created assistants. */
	folder: z.string().default('.').describe('The folder containing the assistant definition. Defaults to cwd for runtime-created assistants.'),

	/** If the docs folder is different from folder/docs */
	docsFolder: z.string().optional().describe('The folder containing the assistant documentation'),

	/** Provide a complete system prompt directly, bypassing CORE.md. Useful for runtime-created assistants. */
	systemPrompt: z.string().optional().describe('Provide a complete system prompt directly, bypassing CORE.md'),

	/** Text to prepend to the system prompt from CORE.md */
	prependPrompt: z.string().optional().describe('Text to prepend to the system prompt'),

	/** Text to append to the system prompt from CORE.md */
	appendPrompt: z.string().optional().describe('Text to append to the system prompt'),
	/** Override or extend the tools loaded from tools.ts */

	tools: z.record(z.string(), z.any()).optional().describe('Override or extend the tools loaded from tools.ts'),
	/** Override or extend the schemas loaded from tools.ts */

	schemas: z.record(z.string(), z.any()).optional().describe('Override or extend schemas whose keys match tool names'),
	/** OpenAI model to use for the conversation */

	model: z.string().optional().describe('OpenAI model to use'),
	/** Maximum number of output tokens per completion */

	maxTokens: z.number().optional().describe('Maximum number of output tokens per completion'),

	local: z.boolean().default(false).describe('Whether to use our local models for this'),

	/** History persistence mode: lifecycle (ephemeral), daily (auto-resume per day), persistent (single long-running thread), session (unique per run, resumable) */
	historyMode: z.enum(['lifecycle', 'daily', 'persistent', 'session']).optional().describe('Conversation history persistence mode'),

	/** When true, prepend a timestamp to each user message so the assistant can track the passage of time across sessions */
	injectTimestamps: z.boolean().default(false).describe('Prepend timestamps to user messages so the assistant can perceive time passing between sessions'),

	/** Strict allowlist of tool names to include. Only these tools will be available. Supports "*" glob matching. */
	allowTools: z.array(z.string()).optional().describe('Strict allowlist of tool name patterns. Only matching tools are available. Supports * glob matching.'),

	/** Denylist of tool names to exclude. Matching tools will be removed. Supports "*" glob matching. */
	forbidTools: z.array(z.string()).optional().describe('Denylist of tool name patterns to exclude. Supports * glob matching.'),

	/** Convenience alias for allowTools — an explicit list of tool names (exact matches only). */
	toolNames: z.array(z.string()).optional().describe('Explicit list of tool names to include (exact match). Shorthand for allowTools without glob patterns.'),
})

export type AssistantState = z.infer<typeof AssistantStateSchema>
export type AssistantOptions = z.infer<typeof AssistantOptionsSchema>

/**
 * An Assistant is a combination of a system prompt and tool calls that has a
 * conversation with an LLM. You define an assistant by creating a folder with
 * CORE.md (system prompt), tools.ts (tool implementations), and hooks.ts (event handlers).
 *
 * @extends Feature
 *
 * @example
 * ```typescript
 * const assistant = container.feature('assistant', {
 *   folder: 'assistants/my-helper'
 * })
 * const answer = await assistant.ask('What capabilities do you have?')
 * ```
 */
export class Assistant extends Feature<AssistantState, AssistantOptions> {
	static override stateSchema = AssistantStateSchema
	static override optionsSchema = AssistantOptionsSchema
	static override eventsSchema = AssistantEventsSchema
	static override shortcut = 'features.assistant' as const

	static { Feature.register(this, 'assistant') }

	readonly interceptors = {
		beforeAsk: new InterceptorChain<InterceptorPoints['beforeAsk']>(),
		beforeTurn: new InterceptorChain<InterceptorPoints['beforeTurn']>(),
		beforeToolCall: new InterceptorChain<InterceptorPoints['beforeToolCall']>(),
		afterToolCall: new InterceptorChain<InterceptorPoints['afterToolCall']>(),
		beforeResponse: new InterceptorChain<InterceptorPoints['beforeResponse']>(),
	}

	/**
	 * Register an interceptor at a given point in the pipeline.
	 *
	 * @param point - The interception point
	 * @param fn - Middleware function receiving (ctx, next)
	 * @returns this, for chaining
	 */
	intercept<K extends InterceptorPoint>(point: K, fn: InterceptorFn<InterceptorPoints[K]>): this {
		this.interceptors[point].add(fn as any)
		return this
	}

	/** @returns Default state with the assistant not started, zero conversations, and the resolved folder path. */
	override get initialState(): AssistantState {
		return {
			...super.initialState,
			started: false,
			conversationCount: 0,
			lastResponse: '',
			folder: this.resolvedFolder,
			systemPrompt: '',
			systemPromptExtensions: {},
			meta: {},
			tools: {},
			hooks: {},
			resumeThreadId: undefined,
			pendingPlugins: [],
			conversation: null,
			subagents: {},
		}
	}

	override get container(): AGIContainer {
		return super.container as AGIContainer
	}

	get name() {
		return this.resolvedFolder.split('/').pop()
	}

	/** The absolute resolved path to the assistant folder. */
	get resolvedFolder(): string {
		return this.container.paths.resolve(this.options.folder)
	}

	/** The path to CORE.md which provides the system prompt. */
	get corePromptPath(): string {
		return this.paths.resolve('CORE.md')
	}

	/** The path to tools.ts which provides tool implementations and schemas. */
	get toolsModulePath(): string {
		return this.paths.resolve('tools.ts')
	}

	/** The path to hooks.ts which provides event handler functions. */
	get hooksModulePath(): string {
		return this.paths.resolve('hooks.ts')
	}

	/** Whether this assistant has a voice.yaml configuration file. */
	get hasVoice(): boolean {
		return this.container.fs.exists(this.paths.resolve('voice.yaml'))
	}

	/** Parsed voice configuration from voice.yaml, or undefined if not present. */
	get voiceConfig(): Record<string, any> | undefined {
		if (!this.hasVoice) return undefined
		const yaml = this.container.feature('yaml')
		return yaml.parse(this.container.fs.readFile(this.paths.resolve('voice.yaml')))
	}

	get resolvedDocsFolder() {
		const { docsFolder = this.options.docsFolder || 'docs' } = this.state.current

		if (this.container.fs.exists(docsFolder)) {
			return this.container.paths.resolve(docsFolder)
		}

		const findUp = this.container.fs.findUp('docs', {
			cwd: this.resolvedFolder
		})

		if (typeof findUp === 'string' && this.container.fs.exists(findUp!)) {
			this.state.set('docsFolder', findUp!)
			return this.container.paths.resolve(findUp!)
		}

		return this.paths.resolve('docs')
	}

	/**
	 * Returns an instance of a ContentDb feature for the resolved docs folder
	 */
	get contentDb() : ContentDb {
		return this.container.feature('contentDb', { rootPath: this.resolvedDocsFolder })
	}


	/**
	 * Called immediately after the assistant is constructed. Synchronously loads
	 * the system prompt, tools, and hooks, then binds hooks as event listeners
	 * so every emitted event automatically invokes its corresponding hook.
	 */
	override afterInitialize() {
		this.state.set('pendingPlugins', [])

		// Load system prompt synchronously
		this.state.set('systemPrompt', this.loadSystemPrompt())

		// Load tools and hooks synchronously via vm.performSync
		this.state.set('tools', this.loadTools())
		this.state.set('hooks', this.loadHooks())

		// Bind hooks to events BEFORE emitting created so the created hook fires
		this.bindHooksToEvents()

		this.emit('created')
	}

	get conversation(): Conversation {
		let conv = this.state.get('conversation') as Conversation | null
		if (!conv) {
			conv = this.container.feature('conversation', {
				model: this.options.model || 'gpt-5.4',
				local: !!this.options.local,
				tools: this.tools,
				api: 'chat',
				...(this.options.maxTokens ? { maxTokens: this.options.maxTokens } : {}),
				history: [
					{ role: 'system', content: this.effectiveSystemPrompt },
				],
			})
			this.state.set('conversation', conv)
		}
		return conv
	}

	get availableTools() {
		return Object.keys(this.tools)
	}

	get messages() {
		return this.conversation.messages
	}

	/** Whether the assistant has been started and is ready to receive questions. */
	get isStarted(): boolean {
		return !!this.state.get('started')
	}

	/** The current system prompt text. */
	get systemPrompt(): string {
		return this.state.get('systemPrompt') || ''
	}

	/** The named extensions appended to the system prompt. */
	get systemPromptExtensions(): Record<string, string> {
		return (this.state.get('systemPromptExtensions') || {}) as Record<string, string>
	}

	/** The system prompt with all extensions appended. This is the value passed to the conversation. */
	get effectiveSystemPrompt(): string {
		const base = this.systemPrompt
		const extensions = Object.values(this.systemPromptExtensions)
		if (!extensions.length) return base
		return [base, ...extensions].join('\n\n')
	}

	/**
	 * Add or update a named system prompt extension. The value is appended
	 * to the base system prompt when passed to the conversation.
	 *
	 * @param key - A unique identifier for this extension
	 * @param value - The text to append
	 * @returns this, for chaining
	 */
	addSystemPromptExtension(key: string, value: string): this {
		this.state.set('systemPromptExtensions', { ...this.systemPromptExtensions, [key]: value })
		this.syncSystemPromptToConversation()
		this.emit('systemPromptExtensionsChanged')
		return this
	}

	/**
	 * Remove a named system prompt extension.
	 *
	 * @param key - The identifier of the extension to remove
	 * @returns this, for chaining
	 */
	removeSystemPromptExtension(key: string): this {
		const current = { ...this.systemPromptExtensions }
		delete current[key]
		this.state.set('systemPromptExtensions', current)
		this.syncSystemPromptToConversation()
		this.emit('systemPromptExtensionsChanged')
		return this
	}

	/** Update the conversation's system message to reflect the current effective prompt. */
	private syncSystemPromptToConversation() {
		const conv = this.state.get('conversation') as Conversation | null
		if (!conv) return
		const messages = [...conv.messages]
		if (messages.length > 0 && (messages[0]!.role === 'system' || messages[0]!.role === 'developer')) {
			messages[0] = { ...messages[0]!, content: this.effectiveSystemPrompt }
			conv.state.set('messages', messages)
		}
	}

	/** The tools registered with this assistant. */
	get tools(): Record<string, ConversationTool> {
		const all = (this.state.get('tools') || {}) as Record<string, ConversationTool>
		return this.applyToolFilters(all)
	}

	/**
	 * Apply allowTools, forbidTools, and toolNames filters from options.
	 * toolNames is treated as an exact-match allowlist. allowTools/forbidTools support "*" glob patterns.
	 * allowTools is applied first (strict allowlist), then forbidTools removes from whatever remains.
	 */
	private applyToolFilters(tools: Record<string, ConversationTool>): Record<string, ConversationTool> {
		const { allowTools, forbidTools, toolNames } = this.options
		if (!allowTools && !forbidTools && !toolNames) return tools

		let names = Object.keys(tools)

		// toolNames is a strict exact-match allowlist
		if (toolNames) {
			const allowed = new Set(toolNames)
			names = names.filter(n => allowed.has(n))
		}

		// allowTools: only keep names matching at least one pattern
		if (allowTools) {
			names = names.filter(n => allowTools.some(pattern => this.matchToolPattern(pattern, n)))
		}

		// forbidTools: remove names matching any pattern
		if (forbidTools) {
			names = names.filter(n => !forbidTools.some(pattern => this.matchToolPattern(pattern, n)))
		}

		const result: Record<string, ConversationTool> = {}
		for (const n of names) {
			result[n] = tools[n]
		}
		return result
	}

	/**
	 * Match a tool name against a pattern that supports "*" as a wildcard.
	 * - "*" matches everything
	 * - "prefix*" matches names starting with prefix
	 * - "*suffix" matches names ending with suffix
	 * - "pre*suf" matches names starting with pre and ending with suf
	 * - exact string matches exactly
	 */
	private matchToolPattern(pattern: string, name: string): boolean {
		if (pattern === '*') return true
		if (!pattern.includes('*')) return pattern === name

		// Convert glob pattern to regex: escape regex chars, replace * with .*
		const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
		return new RegExp(`^${escaped}$`).test(name)
	}

	/**
	 * Apply a setup function or a Helper instance to this assistant.
	 *
	 * When passed a function, it receives the assistant and can configure
	 * tools, hooks, event listeners, etc.
	 *
	 * When passed a Helper instance that exposes tools via toTools(),
	 * those tools are automatically added to this assistant.
	 *
	 * @param fnOrHelper - Setup function or Helper instance
	 * @returns this, for chaining
	 *
	 * @example
	 * ```typescript
	 * assistant
	 *   .use(setupLogging)
	 *   .use(container.feature('git'))
	 * ```
	 */
	use(fnOrHelper: ((assistant: this) => void | Promise<void>) | { toTools: () => { schemas: Record<string, z.ZodType>, handlers: Record<string, Function> } } | { schemas: Record<string, z.ZodType>, handlers: Record<string, Function> }): this {
		if (typeof fnOrHelper === 'function') {
			const result = fnOrHelper(this)
			if (result && typeof (result as any).then === 'function') {
				const pending = this.state.get('pendingPlugins') as Promise<void>[]
				this.state.set('pendingPlugins', [...pending, result as Promise<void>])
			}
		} else if (fnOrHelper && typeof (fnOrHelper as any).toTools === 'function') {
			this._registerTools((fnOrHelper as any).toTools())
			if (typeof (fnOrHelper as any).setupToolsConsumer === 'function') {
				(fnOrHelper as any).setupToolsConsumer(this)
			}
		} else if (fnOrHelper && 'schemas' in fnOrHelper && 'handlers' in fnOrHelper) {
			this._registerTools(fnOrHelper as { schemas: Record<string, z.ZodType>, handlers: Record<string, Function> })
		}
		return this
	}

	/** Register tools from a `{ schemas, handlers }` object. */
	private _registerTools({ schemas, handlers }: { schemas: Record<string, z.ZodType>, handlers: Record<string, Function> }) {
		for (const name of Object.keys(schemas)) {
			if (typeof handlers[name] === 'function') {
				this.addTool(name, handlers[name] as any, schemas[name])
			}
		}
	}

	/**
	 * Add a tool to this assistant. The tool name is derived from the
	 * handler's function name.
	 *
	 * @param handler - A named function that implements the tool
	 * @param schema - Optional Zod schema describing the tool's parameters
	 * @returns this, for chaining
	 *
	 * @example
	 * ```typescript
	 * assistant.addTool(function getWeather(args) {
	 *   return { temp: 72 }
	 * }, z.object({ city: z.string() }).describe('Get weather for a city'))
	 * ```
	 */
	addTool(name: string, handler: (...args: any[]) => any, schema?: z.ZodType): this {
		if (!name) throw new Error('addTool handler must be a named function')

		const current = { ...this.tools }

		if (schema) {
			const jsonSchema = (schema as any).toJSONSchema() as Record<string, any>
			// OpenAI requires `required` to list ALL property keys — optional params
			// must still appear in `required` but use a default value in the schema.
			const properties = jsonSchema.properties || {}
			const required = Object.keys(properties)
			current[name] = {
				handler: handler as ConversationTool['handler'],
				description: jsonSchema.description || name,
				parameters: {
					type: jsonSchema.type || 'object',
					properties,
					required,
				},
			}
		} else {
			current[name] = {
				handler: handler as ConversationTool['handler'],
				description: name,
				parameters: { type: 'object', properties: {} },
			}
		}

		this.state.set('tools', current)
		this.emit('toolsChanged')

		return this
	}

	/**
	 * Remove a tool by name or handler function reference.
	 *
	 * @param nameOrHandler - The tool name string, or the handler function to match
	 * @returns this, for chaining
	 */
	removeTool(nameOrHandler: string | ((...args: any[]) => any)): this {
		const current = { ...this.tools }

		if (typeof nameOrHandler === 'string') {
			delete current[nameOrHandler]
		} else {
			for (const [name, tool] of Object.entries(current)) {
				if (tool.handler === nameOrHandler) {
					delete current[name]
					break
				}
			}
		}

		this.state.set('tools', current)
		this.emit('toolsChanged')

		return this
	}

	/**
	 * Simulate a tool call and its result by appending the appropriate
	 * messages to the conversation history. Useful for injecting context
	 * that looks like the assistant performed a tool call.
	 *
	 * @param toolCallName - The name of the tool
	 * @param args - The arguments that were "passed" to the tool
	 * @param result - The result the tool "returned"
	 * @returns this, for chaining
	 */
	simulateToolCallWithResult(toolCallName: string, args: Record<string, any>, result: any): this {
		if (!this.conversation) {
			throw new Error('Cannot simulate: assistant has no active conversation. Call start() first.')
		}

		const callId = `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

		this.conversation.pushMessage({
			role: 'assistant',
			content: null,
			tool_calls: [{
				id: callId,
				type: 'function',
				function: {
					name: toolCallName,
					arguments: JSON.stringify(args),
				},
			}],
		} as Message)

		this.conversation.pushMessage({
			role: 'tool',
			tool_call_id: callId,
			content: typeof result === 'string' ? result : JSON.stringify(result),
		} as Message)

		return this
	}

	/**
	 * Simulate a user question and assistant response by appending both
	 * messages to the conversation history.
	 *
	 * @param question - The user's question
	 * @param response - The assistant's response
	 * @returns this, for chaining
	 */
	simulateQuestionAndResponse(question: string, response: string): this {
		if (!this.conversation) {
			throw new Error('Cannot simulate: assistant has no active conversation. Call start() first.')
		}

		this.conversation.pushMessage({ role: 'user', content: question })
		this.conversation.pushMessage({ role: 'assistant', content: response })

		return this
	}

	/**
	 * Parsed YAML frontmatter from CORE.md, or empty object if none.
	 */
	get meta(): Record<string, any> {
		return (this.state.get('meta') || {}) as Record<string, any>
	}

	/**
	 * Load the system prompt from CORE.md, applying any prepend/append options.
	 * YAML frontmatter (between --- fences) is stripped from the prompt and
	 * stored in `_meta`.
	 *
	 * @returns {string} The assembled system prompt
	 */
	loadSystemPrompt(): string {
		const { fs } = this.container
		let prompt = ''
		this.state.set('meta', {})

		if (this.options.systemPrompt) {
			prompt = this.options.systemPrompt
		} else if (fs.exists(this.corePromptPath)) {
			const raw = fs.readFile(this.corePromptPath).toString()
			const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)

			if (fmMatch) {
				const yaml = this.container.feature('yaml')
				this.state.set('meta', yaml.parse(fmMatch[1]!) ?? {})
				prompt = raw.slice(fmMatch[0].length)
			} else {
				prompt = raw
			}
		}

		if (this.options.prependPrompt) {
			prompt = this.options.prependPrompt + '\n\n' + prompt
		}

		if (this.options.appendPrompt) {
			prompt = prompt + '\n\n' + this.options.appendPrompt
		}

		if (this.options.injectTimestamps) {
			prompt = prompt + '\n\n' + [
				'## Timestamps',
				'Each user message is prefixed with a timestamp in [YYYY-MM-DD HH:MM] format.',
				'Use these to understand the passage of time between interactions.',
				'The user may return hours or days later within the same conversation — acknowledge the time gap naturally when relevant, and use timestamps to contextualize when topics were previously discussed.',
			].join('\n')
		}

		return prompt.trim()
	}

	/**
	 * Load tools from tools.ts using the container's VM feature, injecting
	 * the container and assistant as globals. Merges with any tools
	 * provided in the constructor options. Runs synchronously via vm.loadModule.
	 *
	 * @returns {Record<string, ConversationTool>} The assembled tool map
	 */
	loadTools(): Record<string, ConversationTool> {
		const tools: Record<string, ConversationTool> = {}

		// Skip loading if no tools file exists (runtime-created assistants)
		if (!this.container.fs.exists(this.toolsModulePath)) {
			return this.mergeOptionTools(tools)
		}

		// Ensure virtual modules (zod, @soederpop/luca, etc.) are seeded so tools
		// files outside the project tree can resolve them through the VM
		if (this.container.features.has('helpers')) {
			const helpers = this.container.feature('helpers') as any
			helpers.seedVirtualModules()
		}

		const vm = this.container.feature('vm')

		let moduleExports: Record<string, any>
		try {
			moduleExports = vm.loadModule(this.toolsModulePath, {
				container: this.container,
				me: this,
				my: this,
				assistant: this,
				console: console,
			})
		} catch (err: any) {
			console.error(`Failed to load tools from ${this.toolsModulePath}`)
			console.error(`There may be a syntax error in this file. Please check it.`)
			console.error(err.message || err)
			return this.mergeOptionTools(tools)
		}

		if (Object.keys(moduleExports).length) {
			const schemas: Record<string, z.ZodType> = moduleExports.schemas || {}

			for (const [name, fn] of Object.entries(moduleExports)) {
				if (name === 'schemas' || name === 'default' || typeof fn !== 'function') continue

				const schema = schemas[name]
				if (schema) {
					const jsonSchema = (schema as any).toJSONSchema() as Record<string, any>
					tools[name] = {
						handler: fn as ConversationTool['handler'],
						description: jsonSchema.description || name,
						parameters: {
							type: jsonSchema.type || 'object',
							properties: jsonSchema.properties || {},
							...(jsonSchema.required ? { required: jsonSchema.required } : {}),
						},
					}
				} else {
					tools[name] = {
						handler: fn as ConversationTool['handler'],
						description: name,
						parameters: { type: 'object', properties: {} },
					}
				}
			}
		}

		return this.mergeOptionTools(tools)
	}

	/**
	 * Merge tools provided via constructor options into the tool map.
	 * This allows runtime-created assistants to define tools entirely via options.
	 */
	private mergeOptionTools(tools: Record<string, ConversationTool>): Record<string, ConversationTool> {
		if (this.options.tools) {
			const optionSchemas = this.options.schemas || {}

			for (const [name, fn] of Object.entries(this.options.tools)) {
				if (typeof fn !== 'function') continue

				const schema = optionSchemas[name]
				if (schema) {
					const jsonSchema = (schema as any).toJSONSchema() as Record<string, any>
					tools[name] = {
						handler: fn as ConversationTool['handler'],
						description: jsonSchema.description || name,
						parameters: {
							type: jsonSchema.type || 'object',
							properties: jsonSchema.properties || {},
							...(jsonSchema.required ? { required: jsonSchema.required } : {}),
						},
					}
				} else {
					tools[name] = {
						handler: fn as ConversationTool['handler'],
						description: name,
						parameters: { type: 'object', properties: {} },
					}
				}
			}
		}

		return tools
	}

	/**
	 * Load event hooks from hooks.ts. Each exported function name should
	 * match an event the assistant emits. When that event fires, the
	 * corresponding hook function is called. Runs synchronously via vm.loadModule.
	 *
	 * @returns {Record<string, Function>} The hook function map
	 */
	loadHooks(): Record<string, (...args: any[]) => any> {
		const hooks: Record<string, (...args: any[]) => any> = {}

		// Skip loading if no hooks file exists (runtime-created assistants)
		if (!this.container.fs.exists(this.hooksModulePath)) {
			return hooks
		}

		const vm = this.container.feature('vm')

		let moduleExports: Record<string, any>
		try {
			moduleExports = vm.loadModule(this.hooksModulePath, {
				container: this.container,
				me: this,
				my: this,
				assistant: this,
				console: console,
			})
		} catch (err: any) {
			console.error(`Failed to load hooks from ${this.hooksModulePath}`)
			console.error(`There may be a syntax error in this file. Please check it.`)
			console.error(err.message || err)
			return hooks
		}

		for (const [name, fn] of Object.entries(moduleExports)) {
			if (name === 'default' || typeof fn !== 'function') continue
			hooks[name] = fn as (...args: any[]) => any
		}

		return hooks
	}

	/**
	 * Provides a helper for creating paths off of the assistant's base folder
	 */
	get paths() {
		const { container } = this
		const base = this.resolvedFolder

		return {
			resolve(...args: any[]) {
				return container.paths.resolve(base, ...args)		
			},
			join(...args: any[]) {
				return container.paths.resolve(base, ...args)
			}
		}
	}

	/**
	 * Prepend a [YYYY-MM-DD HH:MM] timestamp to user message content.
	 */
	private prependTimestamp(content: string | ContentPart[]): string | ContentPart[] {
		const now = new Date()
		const pad = (n: number) => String(n).padStart(2, '0')
		const stamp = `[${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}]`

		if (typeof content === 'string') {
			return `${stamp} ${content}`
		}

		if (content.length > 0 && content[0].type === 'text') {
			return [{ type: 'text' as const, text: `${stamp} ${content[0].text}` }, ...content.slice(1)]
		}

		return [{ type: 'text' as const, text: stamp }, ...content]
	}

	// -- History mode helpers --

	/** The assistant name derived from the folder basename. */
	get assistantName(): string {
		return this.resolvedFolder.split('/').pop() || 'assistant'
	}

	/** An 8-char hash of the container cwd for per-project thread isolation. */
	get cwdHash(): string {
		return hashObject(this.container.cwd).slice(0, 8)
	}

	/** The thread prefix for this assistant+project combination. */
	get threadPrefix(): string {
		return `${this.assistantName}:${this.cwdHash}:`
	}

	/** Build a thread ID based on the history mode. */
	private buildThreadId(mode: string): string {
		const prefix = this.threadPrefix
		switch (mode) {
			case 'daily': {
				const today = new Date().toISOString().slice(0, 10)
				return `${prefix}${today}`
			}
			case 'persistent':
				return `${prefix}persistent`
			case 'session':
				return `${prefix}${this.uuid}`
			default:
				return `${prefix}${this.uuid}`
		}
	}

	/** The conversationHistory feature instance. */
	get conversationHistory(): ConversationHistory {
		return this.container.feature('conversationHistory') as ConversationHistory
	}

	/** The active thread ID (undefined in lifecycle mode). */
	get currentThreadId(): string | undefined {
		return this.state.get('threadId')
	}

	/**
	 * Override thread for resume. Call before start().
	 *
	 * @param threadId - The thread ID to resume
	 * @returns this, for chaining
	 */
	resumeThread(threadId: string): this {
		this.state.set('resumeThreadId', threadId)
		return this
	}

	/**
	 * List saved conversations for this assistant+project.
	 *
	 * @param opts - Optional limit
	 * @returns Conversation metadata records
	 */
	async listHistory(opts?: { limit?: number }): Promise<ConversationMeta[]> {
		const metas = await this.conversationHistory.findByThreadPrefix(this.threadPrefix)
		if (opts?.limit) return metas.slice(0, opts.limit)
		return metas
	}

	/**
	 * Delete all history for this assistant+project.
	 *
	 * @returns Number of conversations deleted
	 */
	async clearHistory(): Promise<number> {
		return this.conversationHistory.deleteByThreadPrefix(this.threadPrefix)
	}

	/**
	 * Load history into the conversation after it's been created.
	 * Called from start() for non-lifecycle modes.
	 */
	private async loadConversationHistory(): Promise<void> {
		const mode = this.options.historyMode || 'lifecycle'
		if (mode === 'lifecycle') return

		const threadId = (this.state.get('resumeThreadId') as string | undefined) || this.buildThreadId(mode)
		this.state.set('threadId', threadId)

		const existing = await this.conversationHistory.findByThread(threadId)

		if (existing) {
			// Replace conversation messages with loaded history
			const messages = [...existing.messages]

			// Swap in fresh system prompt if it changed
			if (messages.length > 0 && (messages[0]!.role === 'system' || messages[0]!.role === 'developer')) {
				messages[0] = { role: messages[0]!.role, content: this.effectiveSystemPrompt }
			}

			this.conversation.state.set('id', existing.id)
			this.conversation.state.set('thread', threadId)
			this.conversation.state.set('messages', messages)
			this.state.set('conversationId', existing.id)

			// Restore lastResponseId so the Responses API can continue the chain
			if (existing.metadata?.lastResponseId) {
				this.conversation.state.set('lastResponseId', existing.metadata.lastResponseId)
			}
		} else {
			// Fresh conversation — just set thread
			this.conversation.state.set('thread', threadId)
			this.state.set('conversationId', this.conversation.state.get('id'))
		}
	}

	/**
	 * Bind all loaded hook functions as event listeners. Each hook whose
	 * name matches an event gets wired up so it fires automatically when
	 * that event is emitted. Must be called before any events are emitted.
	 */
	/** Hook names that are called directly during lifecycle, not bound as event listeners. */
	private static lifecycleHooks = new Set(['formatSystemPrompt'])

	private bindHooksToEvents() {
		const assistant = this
		const hooks = (this.state.get('hooks') || {}) as Record<string, (...args: any[]) => any>
		for (const [eventName, hookFn] of Object.entries(hooks)) {
			if (Assistant.lifecycleHooks.has(eventName)) continue
			this.on(eventName as any, (...args: any[]) => {
				this.emit('hookFired', eventName)
				hookFn(assistant, ...args)
			})
		}
	}

	/**
	 * Start the assistant by creating the conversation and wiring up events.
	 * The system prompt, tools, and hooks are already loaded synchronously
	 * during initialization.
	 *
	 * @returns {Promise<this>} The initialized assistant
	 */
	async start(): Promise<this> {
		// Prevent duplicate listener registration if already started
		if (this.isStarted) return this

		// Wait for any async .use() plugins to finish before starting
		const pending = this.state.get('pendingPlugins') as Promise<void>[]
		if (pending.length) {
			await Promise.all(pending)
			this.state.set('pendingPlugins', [])
		}

		// Allow hooks.ts to export a formatSystemPrompt(assistant, prompt) => string
		// that transforms the system prompt before the conversation is created.
		const hooks = (this.state.get('hooks') || {}) as Record<string, (...args: any[]) => any>
		if (hooks.formatSystemPrompt) {
			const result = await hooks.formatSystemPrompt(this, this.systemPrompt)
			if (typeof result === 'string') {
				this.state.set('systemPrompt', result)
			}
		}

		// Wire up event forwarding from conversation to assistant.
		// Hooks fire automatically because they're bound as event listeners.
		this.conversation.on('turnStart', (info: any) => this.emit('turnStart', info))
		this.conversation.on('turnEnd', (info: any) => this.emit('turnEnd', info))
		this.conversation.on('chunk', (chunk: string) => this.emit('chunk', chunk))
		this.conversation.on('preview', (text: string) => this.emit('preview', text))
		this.conversation.on('response', (text: string) => {
			this.emit('response', text)
			this.state.set('lastResponse', text)
		})
		this.conversation.on('rawEvent', (event: any) => this.emit('rawEvent', event))
		this.conversation.on('mcpEvent', (event: any) => this.emit('mcpEvent', event))
		this.conversation.on('toolCall', (name: string, args: any) => this.emit('toolCall', name, args))
		this.conversation.on('toolResult', (name: string, result: any) => this.emit('toolResult', name, result))
		this.conversation.on('toolError', (name: string, error: any) => this.emit('toolError', name, error))

		// Install interceptor-aware tool executor on the conversation
		this.conversation.toolExecutor = async (name: string, args: Record<string, any>, handler: (...a: any[]) => Promise<any>) => {
			const ctx = { name, args, result: undefined as string | undefined, error: undefined, skip: false }

			await this.interceptors.beforeToolCall.run(ctx, async () => {})

			if (ctx.skip) {
				const result = ctx.result ?? JSON.stringify({ skipped: true })
				this.emit('toolResult', ctx.name, result)
				return result
			}

			try {
				this.emit('toolCall', ctx.name, ctx.args)
				const output = await handler(ctx.args)
				ctx.result = typeof output === 'string' ? output : JSON.stringify(output)
			} catch (err: any) {
				ctx.error = err
				ctx.result = JSON.stringify({ error: err.message || String(err) })
			}

			await this.interceptors.afterToolCall.run(ctx, async () => {})

			if (ctx.error && !ctx.result?.includes('"error"')) {
				this.emit('toolError', ctx.name, ctx.error)
			} else {
				this.emit('toolResult', ctx.name, ctx.result!)
			}

			return ctx.result!
		}

		// Load conversation history for non-lifecycle modes
		await this.loadConversationHistory()

		// Enable autoCompact for modes that accumulate history
		const mode = this.options.historyMode || 'lifecycle'
		if (mode === 'daily' || mode === 'persistent') {
			(this.conversation.options as any).autoCompact = true
		}
		
		this.on('toolsChanged', () => {
			const conv = this.state.get('conversation') as Conversation | null
			if (conv) {
				conv.updateTools(this.tools)
			}
		})

		this.state.set('started', true)
		this.emit('started')

		return this
	}

	/**
	 * Ask the assistant a question. It will use its tools to produce
	 * a streamed response. The assistant auto-starts if needed.
	 *
	 * @param {string | ContentPart[]} question - The question to ask
	 * @returns {Promise<string>} The assistant's response
	 *
	 * @example
	 * ```typescript
	 * const answer = await assistant.ask('What capabilities do you have?')
	 * ```
	 */
	async ask(question: string | ContentPart[], options?: AskOptions): Promise<string> {
		if (!this.isStarted) {
			await this.start()
		}

		if (!this.conversation) {
			return 'Assistant is not started'
		}

		const count = (this.state.get('conversationCount') || 0) + 1
		this.state.set('conversationCount', count)

		if (this.options.injectTimestamps) {
			question = this.prependTimestamp(question)
		}

		// Run beforeAsk interceptors — they can rewrite the question or short-circuit
		if (this.interceptors.beforeAsk.hasInterceptors) {
			const ctx = { question, options } as InterceptorPoints['beforeAsk']
			await this.interceptors.beforeAsk.run(ctx, async () => {})
			if (ctx.result !== undefined) return ctx.result
			question = ctx.question
			options = ctx.options
		}

		let result = await this.conversation.ask(question, options)

		// Run beforeResponse interceptors — they can rewrite the final text
		if (this.interceptors.beforeResponse.hasInterceptors) {
			const ctx = { text: result }
			await this.interceptors.beforeResponse.run(ctx, async () => {})
			result = ctx.text
		}

		// Auto-save for non-lifecycle modes
		if (this.options.historyMode !== 'lifecycle' && this.state.get('threadId')) {
			await this.conversation.save({ thread: this.state.get('threadId') })
		}

		this.emit('answered', result)

		return result
	}

	/**
	 * Save the conversation to disk via conversationHistory.
	 *
	 * @param opts - Optional overrides for title, tags, thread, or metadata
	 * @returns The saved conversation record
	 */
	async save(opts?: { title?: string; tags?: string[]; thread?: string; metadata?: Record<string, any> }) {
		if (!this.conversation) {
			throw new Error('Cannot save: assistant has no active conversation')
		}

		return this.conversation.save(opts)
	}

	// -- Subagent API --

	/**
	 * Names of assistants available as subagents, discovered via the assistantsManager.
	 *
	 * @returns {string[]} Available assistant names
	 */
	get availableSubagents(): string[] {
		try {
			const manager = this.container.feature('assistantsManager')
			return manager.available
		} catch {
			return []
		}
	}

	/**
	 * Get or create a subagent assistant. Uses the assistantsManager to discover
	 * and create the assistant, then caches the instance for reuse across tool calls.
	 *
	 * @param id - The assistant name (e.g. 'codingAssistant')
	 * @param options - Additional options to pass to the assistant constructor
	 * @returns {Promise<Assistant>} The subagent assistant instance, started and ready
	 *
	 * @example
	 * ```typescript
	 * const researcher = await assistant.subagent('codingAssistant')
	 * const answer = await researcher.ask('Find all usages of container.feature("fs")')
	 * ```
	 */
	async subagent(id: string, options: Record<string, any> = {}): Promise<Assistant> {
		const subagents = (this.state.get('subagents') || {}) as Record<string, Assistant>
		if (subagents[id]) return subagents[id]

		const manager = this.container.feature('assistantsManager')

		if (!manager.state.get('discovered')) {
			await manager.discover()
		}

		const instance = manager.create(id, options)
		await instance.start()

		this.state.set('subagents', { ...subagents, [id]: instance })
		return instance
	}
}

export default Assistant
