import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from '../../schemas/base.js'
import { type AvailableFeatures } from '@soederpop/luca/feature'
import { Feature } from '@soederpop/luca/feature'
import type { Conversation, ConversationTool, ContentPart, AskOptions, Message } from './conversation'
import type { AGIContainer } from '../container.server.js'
import type { ContentDb } from '@soederpop/luca/node'
import type { ConversationHistory, ConversationMeta } from './conversation-history'
import hashObject from '../../hash-object.js'

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
})

export const AssistantStateSchema = FeatureStateSchema.extend({
	started: z.boolean().describe('Whether the assistant has been initialized'),
	conversationCount: z.number().describe('Number of ask() calls made'),
	lastResponse: z.string().describe('The most recent response text'),
	folder: z.string().describe('The resolved assistant folder path'),
	docsFolder: z.string().describe('The resolved docs folder'),
	conversationId: z.string().optional().describe('The active conversation persistence ID'),
	threadId: z.string().optional().describe('The active thread ID'),
})

export const AssistantOptionsSchema = FeatureOptionsSchema.extend({
	/** The folder containing the assistant definition (CORE.md, tools.ts, hooks.ts) */
	folder: z.string().describe('The folder containing the assistant definition'),

	/** If the docs folder is different from folder/docs */
	docsFolder: z.string().optional().describe('The folder containing the assistant documentation'),

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

	/** History persistence mode: lifecycle (ephemeral), daily (auto-resume per day), persistent (single long-running thread), session (unique per run, resumable) */
	historyMode: z.enum(['lifecycle', 'daily', 'persistent', 'session']).optional().describe('Conversation history persistence mode'),
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

	/** @returns Default state with the assistant not started, zero conversations, and the resolved folder path. */
	override get initialState(): AssistantState {
		return {
			...super.initialState,
			started: false,
			conversationCount: 0,
			lastResponse: '',
			folder: this.resolvedFolder,
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

	private _conversation?: Conversation
	private _resumeThreadId?: string

	// Using `declare` to prevent class field initializers from overwriting
	// values set during afterInitialize() (called from the base constructor).
	declare private _tools: Record<string, ConversationTool>
	declare private _hooks: Record<string, (...args: any[]) => any>
	declare private _systemPrompt: string
	declare private _pendingPlugins: Promise<void>[]

	/**
	 * Called immediately after the assistant is constructed. Synchronously loads
	 * the system prompt, tools, and hooks, then binds hooks as event listeners
	 * so every emitted event automatically invokes its corresponding hook.
	 */
	override afterInitialize() {
		this._pendingPlugins = []

		// Load system prompt synchronously
		this._systemPrompt = this.loadSystemPrompt()

		// Load tools and hooks synchronously via vm.performSync
		this._tools = this.loadTools()
		this._hooks = this.loadHooks()

		// Bind hooks to events BEFORE emitting created so the created hook fires
		this.bindHooksToEvents()

		this.emit('created')
	}

	get conversation(): Conversation {
		if (!this._conversation) {
			this._conversation = this.container.feature('conversation', {
				model: this.options.model || 'gpt-5.2',
				tools: this._tools || this.loadTools(),
				...(this.options.maxTokens ? { maxTokens: this.options.maxTokens } : {}),
				history: [
					{ role: 'system', content: this._systemPrompt || this.loadSystemPrompt() },
				],
			})
		}
		return this._conversation
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
		return this._systemPrompt
	}

	/** The tools registered with this assistant. */
	get tools(): Record<string, ConversationTool> {
		return this._tools
	}

	/**
	 * Apply a setup function to this assistant. The function receives the
	 * assistant instance and can configure tools, hooks, event listeners, etc.
	 *
	 * @param fn - Setup function that receives this assistant
	 * @returns this, for chaining
	 *
	 * @example
	 * ```typescript
	 * assistant
	 *   .use(setupLogging)
	 *   .use(addAnalyticsTools)
	 * ```
	 */
	use(fn: (assistant: this) => void | Promise<void>): this {
		const result = fn(this)
		if (result && typeof (result as any).then === 'function') {
			this._pendingPlugins.push(result as Promise<void>)
		}
		return this
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
	addTool(handler: (...args: any[]) => any, schema?: z.ZodType): this {
		const name = handler.name
		if (!name) throw new Error('addTool handler must be a named function')

		if (schema) {
			const jsonSchema = (schema as any).toJSONSchema() as Record<string, any>
			this._tools[name] = {
				handler: handler as ConversationTool['handler'],
				description: jsonSchema.description || name,
				parameters: {
					type: jsonSchema.type || 'object',
					properties: jsonSchema.properties || {},
					...(jsonSchema.required ? { required: jsonSchema.required } : {}),
				},
			}
		} else {
			this._tools[name] = {
				handler: handler as ConversationTool['handler'],
				description: name,
				parameters: { type: 'object', properties: {} },
			}
		}

		return this
	}

	/**
	 * Remove a tool by name or handler function reference.
	 *
	 * @param nameOrHandler - The tool name string, or the handler function to match
	 * @returns this, for chaining
	 */
	removeTool(nameOrHandler: string | ((...args: any[]) => any)): this {
		if (typeof nameOrHandler === 'string') {
			delete this._tools[nameOrHandler]
		} else {
			for (const [name, tool] of Object.entries(this._tools)) {
				if (tool.handler === nameOrHandler) {
					delete this._tools[name]
					break
				}
			}
		}

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
	 * Load the system prompt from CORE.md, applying any prepend/append options.
	 *
	 * @returns {string} The assembled system prompt
	 */
	loadSystemPrompt(): string {
		const { fs } = this.container
		let prompt = ''

		if (fs.exists(this.corePromptPath)) {
			prompt = fs.readFile(this.corePromptPath)
		}

		if (this.options.prependPrompt) {
			prompt = this.options.prependPrompt + '\n\n' + prompt
		}

		if (this.options.appendPrompt) {
			prompt = prompt + '\n\n' + this.options.appendPrompt
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
			return tools
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

		// Merge in option-provided tools and schemas
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
		this._resumeThreadId = threadId
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

		const threadId = this._resumeThreadId || this.buildThreadId(mode)
		this.state.set('threadId', threadId)

		const existing = await this.conversationHistory.findByThread(threadId)

		if (existing) {
			// Replace conversation messages with loaded history
			const messages = [...existing.messages]

			// Swap in fresh system prompt if it changed
			if (messages.length > 0 && (messages[0]!.role === 'system' || messages[0]!.role === 'developer')) {
				messages[0] = { role: messages[0]!.role, content: this._systemPrompt }
			}

			this.conversation.state.set('id', existing.id)
			this.conversation.state.set('thread', threadId)
			this.conversation.state.set('messages', messages)
			this.state.set('conversationId', existing.id)
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
	private bindHooksToEvents() {
		const assistant = this
		for (const [eventName, hookFn] of Object.entries(this._hooks)) {
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
		if (this._pendingPlugins.length) {
			await Promise.all(this._pendingPlugins)
			this._pendingPlugins = []
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

		// Load conversation history for non-lifecycle modes
		await this.loadConversationHistory()

		// Enable autoCompact for modes that accumulate history
		const mode = this.options.historyMode || 'lifecycle'
		if (mode === 'daily' || mode === 'persistent') {
			(this.conversation.options as any).autoCompact = true
		}

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

		const result = await this.conversation.ask(question, options)

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
}

export default Assistant
