import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from '../../schemas/base.js'
import type { Container } from '@/container'
import { type AvailableFeatures } from '@/feature'
import { features, Feature } from '@/feature'
import type { Conversation, ConversationTool, ContentPart } from './conversation'
import type { DocsReader } from './docs-reader'
import type { AGIContainer } from '../container.server.js'
import type { ContentDb } from '@/node/features/content-db.js'

declare module '@/feature' {
	interface AvailableFeatures {
		assistant: typeof Assistant
	}
}

export const AssistantEventsSchema = FeatureEventsSchema.extend({
	started: z.tuple([]).describe('Emitted when the assistant has been initialized'),
	chunk: z.tuple([z.string().describe('A chunk of streamed text')]).describe('Emitted as tokens stream in'),
	preview: z.tuple([z.string().describe('The accumulated response so far')]).describe('Emitted with the full response text so far as it streams'),
	response: z.tuple([z.string().describe('The final response text')]).describe('Emitted when a complete response is produced'),
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
})

export const AssistantOptionsSchema = FeatureOptionsSchema.extend({
	/** The folder containing the assistant definition (CORE.md, tools.ts, hooks.ts, docs/) */
	folder: z.string().describe('The folder containing the assistant definition'),
	/** Path to the docs subfolder, relative to the assistant folder */
	docsPath: z.string().optional().describe('Path to the docs subfolder relative to the assistant folder'),
	/** Text to prepend to the system prompt from CORE.md */
	prependPrompt: z.string().optional().describe('Text to prepend to the system prompt'),
	/** Text to append to the system prompt from CORE.md */
	appendPrompt: z.string().optional().describe('Text to append to the system prompt'),
	/** Override or extend the tools loaded from tools.ts */
	tools: z.record(z.any()).optional().describe('Override or extend the tools loaded from tools.ts'),
	/** Override or extend the schemas loaded from tools.ts */
	schemas: z.record(z.any()).optional().describe('Override or extend schemas whose keys match tool names'),
	/** OpenAI model to use for the conversation */
	model: z.string().optional().describe('OpenAI model to use'),
})

export type AssistantState = z.infer<typeof AssistantStateSchema>
export type AssistantOptions = z.infer<typeof AssistantOptionsSchema>

/**
 * An Assistant is a combination of a system prompt and tool calls that has a
 * conversation with an LLM. You define an assistant by creating a folder with
 * CORE.md (system prompt), tools.ts (tool implementations), hooks.ts (event handlers),
 * and a docs/ subfolder of structured markdown the assistant can research.
 *
 * Every assistant automatically gets a researchInternalDocs tool backed by a DocsReader
 * that can query the assistant's docs/ folder.
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

	static attach(container: Container<AvailableFeatures, any>) {
		features.register('assistant', Assistant)
		return container
	}

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

	/** The absolute resolved path to the assistant folder. */
	get resolvedFolder(): string {
		return this.container.paths.resolve(this.options.folder)
	}

	/** The path to the docs subfolder. */
	get docsFolder(): string {
		return this.container.paths.resolve(this.resolvedFolder, this.options.docsPath || 'docs')
	}

	/** The path to CORE.md which provides the system prompt. */
	get corePromptPath(): string {
		return this.container.paths.resolve(this.resolvedFolder, 'CORE.md')
	}

	/** The path to tools.ts which provides tool implementations and schemas. */
	get toolsModulePath(): string {
		return this.container.paths.resolve(this.resolvedFolder, 'tools.ts')
	}

	/** The path to hooks.ts which provides event handler functions. */
	get hooksModulePath(): string {
		return this.container.paths.resolve(this.resolvedFolder, 'hooks.ts')
	}

	conversation?: Conversation
	docsReader?: DocsReader

	private _tools: Record<string, ConversationTool> = {}
	private _hooks: Record<string, (...args: any[]) => any> = {}
	private _systemPrompt: string = ''

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
	 * provided in the constructor options.
	 *
	 * @returns {Promise<Record<string, ConversationTool>>} The assembled tool map
	 */
	async loadTools(): Promise<Record<string, ConversationTool>> {
		const tools: Record<string, ConversationTool> = {}

		const { fs } = this.container

		if (fs.exists(this.toolsModulePath)) {
			const code = fs.readFile(this.toolsModulePath)
			const vm = this.container.feature('vm')

			const { context } = await vm.perform(code, {
				container: this.container,
				me: this,
				require: (await import('module')).createRequire(this.toolsModulePath),
				exports: {},
				module: { exports: {} },
			})

			const moduleExports = context.module?.exports || context.exports || {}
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
	 * corresponding hook function is called.
	 *
	 * @returns {Promise<Record<string, Function>>} The hook function map
	 */
	async loadHooks(): Promise<Record<string, (...args: any[]) => any>> {
		const hooks: Record<string, (...args: any[]) => any> = {}

		const { fs } = this.container

		if (fs.exists(this.hooksModulePath)) {
			const code = fs.readFile(this.hooksModulePath)
			const vm = this.container.feature('vm')

			const { context } = await vm.perform(code, {
				container: this.container,
				me: this,
				require: (await import('module')).createRequire(this.hooksModulePath),
				exports: {},
				module: { exports: {} },
			})

			const moduleExports = context.module?.exports || context.exports || {}

			for (const [name, fn] of Object.entries(moduleExports)) {
				if (name === 'default' || typeof fn !== 'function') continue
				hooks[name] = fn as (...args: any[]) => any
			}
		}

		return hooks
	}

	/**
	 * Initialize the DocsReader for the assistant's docs/ folder,
	 * providing the researchInternalDocs tool.
	 *
	 * @returns {Promise<DocsReader | undefined>} The docs reader, or undefined if no docs folder exists
	 */
	async initDocsReader(): Promise<DocsReader | undefined> {
		if (!this.container.fs.exists(this.docsFolder)) return undefined

		const contentDb = this.container.feature('contentDb', {
			rootPath: this.docsFolder,
		}) as ContentDb

		const docsReader = this.container.feature('docsReader', {
			contentDb,
			model: this.options.model,
		})

		await docsReader.start()
		return docsReader
	}

	/**
	 * Build the researchInternalDocs tool that delegates to the DocsReader.
	 *
	 * @returns {ConversationTool} The tool definition
	 */
	private buildDocsResearchTool(): ConversationTool {
		const reader = this.docsReader!

		return {
			handler: async ({ question }: { question: string }) => {
				return reader.ask(question)
			},
			description: 'Research the assistant\'s internal documentation to answer a question. Use this to look up information in the docs/ folder.',
			parameters: {
				type: 'object',
				properties: {
					question: {
						type: 'string',
						description: 'The question to research in the internal docs',
					},
				},
				required: ['question'],
			},
		}
	}

	/**
	 * Build the listDocs tool that lists all available documents directly
	 * from the content database without going through the DocsReader AI.
	 *
	 * @returns {ConversationTool} The tool definition
	 */
	private buildListDocsTool(): ConversationTool {
		const db = this.docsReader!.contentDb

		return {
			handler: async () => {
				return db.collection.available.map((id: string) => {
					try {
						const doc = db.collection.document(id)
						return { id, title: doc.title, outline: doc.toOutline() }
					} catch {
						return { id }
					}
				})
			},
			description: 'List all available documents in the assistant\'s docs/ folder with their titles and heading outlines.',
			parameters: {
				type: 'object',
				properties: {},
			},
		}
	}

	/**
	 * Build the readDocOutlines tool that returns heading outlines for
	 * one or more documents, useful for scanning structure before reading.
	 *
	 * @returns {ConversationTool} The tool definition
	 */
	private buildReadDocOutlinesTool(): ConversationTool {
		const db = this.docsReader!.contentDb

		return {
			handler: async ({ docs }: { docs: string[] }) => {
				return docs.map((id: string) => {
					try {
						const doc = db.collection.document(id)
						return { id, title: doc.title, outline: doc.toOutline() }
					} catch (err: any) {
						return { id, error: err.message }
					}
				})
			},
			description: 'Get the heading outline of one or more documents. Useful for understanding document structure before reading the full content.',
			parameters: {
				type: 'object',
				properties: {
					docs: {
						type: 'array',
						items: { type: 'string' },
						description: 'The document IDs to get outlines for',
					},
				},
				required: ['docs'],
			},
		}
	}

	/**
	 * Build the readDocs tool that reads one or more documents directly
	 * from the content database without going through the DocsReader AI.
	 *
	 * @returns {ConversationTool} The tool definition
	 */
	private buildReadDocsTool(): ConversationTool {
		const db = this.docsReader!.contentDb

		return {
			handler: async ({ docs }: { docs: string[] }) => {
				return docs.map((id: string) => {
					try {
						const doc = db.collection.document(id)
						return { id, title: doc.title, meta: doc.meta, content: doc.content }
					} catch (err: any) {
						return { id, error: err.message }
					}
				})
			},
			description: 'Read the full content of one or more documents by their IDs. Use listDocs first to see what\'s available.',
			parameters: {
				type: 'object',
				properties: {
					docs: {
						type: 'array',
						items: { type: 'string' },
						description: 'The document IDs to read',
					},
				},
				required: ['docs'],
			},
		}
	}

	/**
	 * Start the assistant by loading the system prompt, tools, uooks, and docs reader,
	 * then creating the underlying conversation.
	 *
	 * @returns {Promise<this>} The initialized assistant
	 */
	async start(): Promise<this> {
		// Load system prompt
		this._systemPrompt = this.loadSystemPrompt()

		this.emit('systemPromptLoaded', this._systemPrompt)

		// Load tools from tools.ts and options
		this._tools = await this.loadTools()
		this.emit('toolsLoaded')

		// Load hooks from hooks.ts
		this._hooks = await this.loadHooks()
		this.emit('hooksLoaded')

		// Initialize the docs reader for internal docs
		this.docsReader = await this.initDocsReader()

		// Add docs tools and table of contents if docs are available
		if (this.docsReader) {
			this._tools.researchInternalDocs = this.buildDocsResearchTool()
			this._tools.listDocs = this.buildListDocsTool()
			this._tools.readDocOutlines = this.buildReadDocOutlinesTool()
			this._tools.readDocs = this.buildReadDocsTool()

			// Append a runtime table of contents so the assistant knows what docs exist
			const toc = this.docsReader.contentDb.collection.tableOfContents({ title: 'Available Documentation' })
			if (toc) {
				this._systemPrompt += '\n\n---\n\n' + toc
			}
		}

		// Create the conversation
		this.conversation = this.container.feature('conversation', {
			model: this.options.model || 'gpt-4.1',
			tools: this._tools,
			history: [
				{ role: 'system', content: this._systemPrompt },
			],
		})

		// Wire up event forwarding from conversation to assistant
		this.conversation.on('chunk', (chunk: string) => {
			this.emit('chunk', chunk)
			this.fireHook('chunk', chunk)
		})
		this.conversation.on('preview', (text: string) => {
			this.emit('preview', text)
			this.fireHook('preview', text)
		})
		this.conversation.on('response', (text: string) => {
			this.emit('response', text)
			this.state.set('lastResponse', text)
			this.fireHook('response', text)
		})
		this.conversation.on('toolCall', (name: string, args: any) => {
			this.emit('toolCall', name, args)
			this.fireHook('toolCall', name, args)
		})
		this.conversation.on('toolResult', (name: string, result: any) => {
			this.emit('toolResult', name, result)
			this.fireHook('toolResult', name, result)
		})
		this.conversation.on('toolError', (name: string, error: any) => {
			this.emit('toolError', name, error)
			this.fireHook('toolError', name, error)
		})

		// Register all hooks as event listeners
		this.bindHooks()

		this.state.set('started', true)
		this.emit('started')
		this.fireHook('started')

		return this
	}

	/**
	 * Bind loaded hook functions as event listeners on this assistant.
	 * Hook function names that match event names are automatically wired up.
	 */
	private bindHooks() {
		for (const [eventName, hookFn] of Object.entries(this._hooks)) {
			// Only bind hooks that aren't already forwarded from conversation events
			const forwardedEvents = ['chunk', 'preview', 'response', 'toolCall', 'toolResult', 'toolError', 'started']
			if (!forwardedEvents.includes(eventName)) {
				this.on(eventName as any, (...args: any[]) => {
					this.emit('hookFired', eventName)
					hookFn(...args)
				})
			}
		}
	}

	/**
	 * Fire a hook function by event name if one exists.
	 *
	 * @param {string} eventName - The event/hook name
	 * @param {...any} args - Arguments to pass to the hook
	 */
	private fireHook(eventName: string, ...args: any[]) {
		const hook = this._hooks[eventName]
		if (hook) {
			this.emit('hookFired', eventName)
			try {
				Promise.resolve(hook(...args))
					.catch((err) => {
						this.emit('hookError', eventName, err)
						this.fireHook('hookError', eventName, err)
					})
					.then(() => {
						this.emit('hookCompleted', eventName)
					})
			} catch (err) {
				// Hook errors are non-fatal
			}
		}
	}

	/**
	 * Ask the assistant a question. It will use its tools and docs to
	 * produce a streamed response. The assistant auto-starts if needed.
	 *
	 * @param {string | ContentPart[]} question - The question to ask
	 * @returns {Promise<string>} The assistant's response
	 *
	 * @example
	 * ```typescript
	 * const answer = await assistant.ask('What capabilities do you have?')
	 * ```
	 */
	async ask(question: string | ContentPart[]): Promise<string> {
		if (!this.isStarted) {
			await this.start()
		}

		if (!this.conversation) {
			return 'Assistant is not started'
		}

		const count = (this.state.get('conversationCount') || 0) + 1
		this.state.set('conversationCount', count)

		const result = await this.conversation.ask(question)

		this.emit('answered', result)
		this.fireHook('answered', result)

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

export default features.register('assistant', Assistant)
