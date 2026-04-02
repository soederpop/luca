import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from '../../schemas/base.js'
import { type AvailableFeatures } from '@soederpop/luca/feature'
import { Feature } from '../feature.js'
import type { OpenAIClient } from '../../clients/openai';
import type OpenAI from 'openai';
import type { ConversationHistory } from './conversation-history';
import { countMessageTokens, getContextWindow } from '../lib/token-counter.js';

declare module '@soederpop/luca/feature' {
	interface AvailableFeatures {
		conversation: typeof Conversation
	}
}

export type Message = OpenAI.Chat.Completions.ChatCompletionMessageParam

export type ContentPart =
	| { type: 'text'; text: string }
	| { type: 'image_url'; image_url: { url: string; detail?: 'low' | 'high' | 'auto' } }
	| { type: 'input_audio'; data: string; format: 'mp3' | 'wav' }
	| { type: 'input_file'; file_data: string; filename: string }

export interface ConversationTool {
	handler: (...args: any[]) => Promise<any>
	description: string
	parameters: Record<string, any>
}

export interface ConversationMCPServer {
	url: string
	headers?: Record<string, string>
	allowedTools?: string[] | { tool_names?: string[] }
	requireApproval?: 'always' | 'never' | {
		always?: { tool_names?: string[] }
		never?: { tool_names?: string[] }
	}
}

export const ConversationOptionsSchema = FeatureOptionsSchema.extend({
	/** A unique identifier for the conversation */
	id: z.string().optional().describe('A unique identifier for the conversation'),
	/** A human-readable title for the conversation */
	title: z.string().optional().describe('A human-readable title for the conversation'),
	/** A unique identifier for threads, an arbitrary grouping mechanism */
	thread: z.string().optional().describe('A unique identifier for threads, an arbitrary grouping mechanism'),
	/** Any available OpenAI model */
	model: z.string().optional().describe('Any available OpenAI model'),
	/** Initial message history to seed the conversation */
	history: z.array(z.any()).optional().describe('Initial message history to seed the conversation'),
	/** Tools the model can call during conversation */
	tools: z.record(z.string(), z.any()).optional().describe('Tools the model can call during conversation'),
	/** Remote MCP servers to expose as tools when using the OpenAI Responses API */
	mcpServers: z.record(z.string(), z.any()).optional().describe('Remote MCP servers keyed by server label'),
	/** Which OpenAI API to use for completions */
	api: z.enum(['auto', 'responses', 'chat']).optional().describe('Completion API mode. auto uses Responses unless local=true'),
	/** Tags for categorizing and searching this conversation */
	tags: z.array(z.string()).optional().describe('Tags for categorizing and searching this conversation'),
	/** Arbitrary metadata to attach to this conversation */
	metadata: z.record(z.string(), z.any()).optional().describe('Arbitrary metadata to attach to this conversation'),

	clientOptions: z.record(z.string(), z.any()).optional().describe('Options for the OpenAI client'), // the type of options for OpenAI client

	local: z.boolean().optional().describe('Whether to use the local ollama models instead of the remote OpenAI models'),

	/** Maximum number of output tokens per completion */
	maxTokens: z.number().optional().describe('Maximum number of output tokens per completion (default 512)'),

	/** Sampling temperature (0-2). Higher = more random, lower = more deterministic. */
	temperature: z.number().min(0).max(2).optional().describe('Sampling temperature (0-2). Higher = more random, lower = more deterministic'),
	/** Nucleus sampling: only consider tokens with top_p cumulative probability (0-1). */
	topP: z.number().min(0).max(1).optional().describe('Nucleus sampling cutoff (0-1). Lower = more focused'),
	/** Top-K sampling: only consider the K most likely tokens. Not supported by OpenAI — used with local/Anthropic models. */
	topK: z.number().optional().describe('Top-K sampling. Only supported by local/Anthropic models'),
	/** Penalizes tokens based on how often they already appeared (-2 to 2). */
	frequencyPenalty: z.number().min(-2).max(2).optional().describe('Frequency penalty (-2 to 2). Positive = discourage repetition'),
	/** Penalizes tokens based on whether they appeared at all (-2 to 2). */
	presencePenalty: z.number().min(-2).max(2).optional().describe('Presence penalty (-2 to 2). Positive = encourage new topics'),
	/** Stop sequences — model stops generating when it encounters any of these strings. */
	stop: z.array(z.string()).optional().describe('Stop sequences — generation halts when any of these strings is produced'),

	/** Enable automatic compaction when estimated input tokens approach the context limit */
	autoCompact: z.boolean().optional().describe('Enable automatic compaction when input tokens approach the context limit'),
	/** Fraction of contextWindow at which auto-compact triggers (0.0–1.0, default 0.8) */
	compactThreshold: z.number().min(0).max(1).optional().describe('Fraction of context window at which auto-compact triggers (default 0.8)'),
	/** Override the inferred context window size for this model */
	contextWindow: z.number().optional().describe('Override the inferred context window size for this model'),
	/** Number of recent messages to preserve after compaction (default 4) */
	compactKeepRecent: z.number().optional().describe('Number of recent messages to preserve after compaction (default 4)'),
})

export const ConversationStateSchema = FeatureStateSchema.extend({
	id: z.string().describe('Unique identifier for this conversation instance'),
	thread: z.string().describe('Thread identifier for grouping conversations'),
	model: z.string().describe('The OpenAI model being used'),
	messages: z.array(z.any()).describe('Full message history of the conversation'),
	streaming: z.boolean().describe('Whether a streaming response is currently in progress'),
	lastResponse: z.string().describe('The last assistant response text'),
	toolCalls: z.number().describe('Total number of tool calls made in this conversation'),
	api: z.enum(['responses', 'chat']).describe('Which completion API is active for this conversation'),
	lastResponseId: z.string().nullable().describe('Most recent OpenAI Responses API response ID for continuing conversation state'),
	tokenUsage: z.object({
		prompt: z.number().describe('Total prompt tokens consumed'),
		completion: z.number().describe('Total completion tokens consumed'),
		total: z.number().describe('Total tokens consumed'),
	}).describe('Cumulative token usage statistics'),
	estimatedInputTokens: z.number().describe('Estimated input token count for the current messages array'),
	compactionCount: z.number().describe('Number of times compact() has been called'),
	contextWindow: z.number().describe('The context window size for the current model'),
	tools: z.record(z.string(), z.any()).describe('Active tools map including any runtime overrides'),
	callMaxTokens: z.number().nullable().describe('Per-call max tokens override, cleared after each ask()'),
})

export const ConversationEventsSchema = FeatureEventsSchema.extend({
	userMessage: z.tuple([z.any().describe('The user message content (string or ContentPart[])')]).describe('Fired when a user message is added to the conversation'),
	turnStart: z.tuple([z.object({ turn: z.number(), isFollowUp: z.boolean() })]).describe('Fired at the start of each completion turn'),
	turnEnd: z.tuple([z.object({ turn: z.number(), hasToolCalls: z.boolean() })]).describe('Fired at the end of each completion turn'),
	toolCallsStart: z.tuple([z.any().describe('Array of tool call objects from the model')]).describe('Fired when the model begins a batch of tool calls'),
	toolCall: z.tuple([z.string().describe('Tool name'), z.any().describe('Parsed arguments object')]).describe('Fired before invoking a single tool handler'),
	toolResult: z.tuple([z.string().describe('Tool name'), z.string().describe('Serialized result')]).describe('Fired after a tool handler returns successfully'),
	toolError: z.tuple([z.string().describe('Tool name'), z.any().describe('Error object or message')]).describe('Fired when a tool handler throws or the tool is unknown'),
	toolCallsEnd: z.tuple([]).describe('Fired after all tool calls in a turn have been executed'),
	chunk: z.tuple([z.string().describe('Text delta from the stream')]).describe('Fired for each streaming text delta'),
	preview: z.tuple([z.string().describe('Accumulated text so far')]).describe('Fired after each chunk with the full accumulated text'),
	response: z.tuple([z.string().describe('Final accumulated response text')]).describe('Fired when the final text response is produced'),
	responseCompleted: z.tuple([z.any().describe('The completed OpenAI Response object')]).describe('Fired when the Responses API stream completes'),
	rawEvent: z.tuple([z.any().describe('Raw stream event from the API')]).describe('Fired for every raw event from the Responses API stream'),
	mcpEvent: z.tuple([z.any().describe('MCP-related stream event')]).describe('Fired for MCP-related events from the Responses API'),
	summarizeStart: z.tuple([]).describe('Fired before generating a conversation summary'),
	summarizeEnd: z.tuple([z.string().describe('The generated summary text')]).describe('Fired after the summary is generated'),
	compactStart: z.tuple([z.object({ messageCount: z.number(), keepRecent: z.number() })]).describe('Fired before compacting the conversation history'),
	compactEnd: z.tuple([z.object({ summary: z.string(), removedCount: z.number(), estimatedTokens: z.number(), compactionCount: z.number() })]).describe('Fired after compaction completes'),
	autoCompactTriggered: z.tuple([z.object({ estimated: z.number(), limit: z.number(), contextWindow: z.number() })]).describe('Fired when auto-compact kicks in because tokens exceeded the threshold'),
}).describe('Conversation events')

export type ConversationOptions = z.infer<typeof ConversationOptionsSchema>
export type ConversationState = z.infer<typeof ConversationStateSchema>

export type AskOptions = {
	maxTokens?: number
	/**
	 * When provided, enables OpenAI Structured Outputs. The model is constrained
	 * to return JSON matching this Zod schema. The return value of ask() will be
	 * the parsed object instead of a raw string.
	 */
	schema?: z.ZodType
}

/**
 * Recursively set `additionalProperties: false` on every object-type node
 * in a JSON Schema tree. OpenAI strict mode requires this at every level.
 * Also ensures every object has a `required` array listing all its property keys.
 */
function strictifySchema(schema: Record<string, any>): Record<string, any> {
	const clone = { ...schema }

	if (clone.type === 'object' && clone.properties) {
		clone.additionalProperties = false
		clone.required = Object.keys(clone.properties)
		const props: Record<string, any> = {}
		for (const [key, val] of Object.entries(clone.properties)) {
			props[key] = strictifySchema(val as Record<string, any>)
		}
		clone.properties = props
	}

	if (clone.items) {
		clone.items = strictifySchema(clone.items)
	}

	// anyOf / oneOf / allOf
	for (const combiner of ['anyOf', 'oneOf', 'allOf'] as const) {
		if (Array.isArray(clone[combiner])) {
			clone[combiner] = clone[combiner].map((s: Record<string, any>) => strictifySchema(s))
		}
	}

	return clone
}

/**
 * A self-contained conversation with OpenAI that supports streaming,
 * tool calling, and message state management.
 *
 * @extends Feature
 *
 * @example
 * ```typescript
 * const conversation = container.feature('conversation', {
 *   model: 'gpt-4.1',
 *   tools: myToolMap,
 *   history: [{ role: 'system', content: 'You are a helpful assistant.' }]
 * })
 * const reply = await conversation.ask('What is the meaning of life?')
 * ```
 */
export class Conversation extends Feature<ConversationState, ConversationOptions> {
	static override stateSchema = ConversationStateSchema
	static override optionsSchema = ConversationOptionsSchema
	static override eventsSchema = ConversationEventsSchema
	static override shortcut = 'features.conversation' as const

	static { Feature.register(this, 'conversation') }

	/**
	 * Pluggable tool executor. Called for each tool invocation with the tool
	 * name, parsed args, and the default handler. Return the serialized result string.
	 * The Assistant replaces this to wire in beforeToolCall/afterToolCall interceptors.
	 */
	toolExecutor: ((name: string, args: Record<string, any>, handler: (...args: any[]) => Promise<any>) => Promise<string>) | null = null

	/** The active structured output schema for the current ask() call, if any. */
	private _activeSchema: z.ZodType | null = null

	/** Registered stubs: matched against user input to short-circuit the API with a canned response. */
	private _stubs: Array<{ matcher: string | RegExp; response: string | (() => string) }> = []

	/** Resolved max tokens: per-call override > options-level > default 512. */
	private get maxTokens(): number | undefined {
		return (this.state.get('callMaxTokens') as number | null) ?? this.options.maxTokens ?? 512
	}

	/** @returns Default state seeded from options: id, thread, model, initial history, and zero token usage. */
	override get initialState(): ConversationState {
		return {
			...super.initialState,
			id: this.options.id || this.uuid,
			thread: this.options.thread || 'default',
			model: this.options.model || 'gpt-5',
			messages: this.options.history || [],
			streaming: false,
			lastResponse: '',
			toolCalls: 0,
			api: this.apiMode,
			lastResponseId: null,
			tokenUsage: { prompt: 0, completion: 0, total: 0 },
			estimatedInputTokens: 0,
			compactionCount: 0,
			contextWindow: this.options.contextWindow || getContextWindow(this.options.model || 'gpt-5'),
			tools: (this.options.tools || {}) as Record<string, ConversationTool>,
			callMaxTokens: null,
		}
	}

	/** Returns the registered tools available for the model to call. */
	get tools() : Record<string, ConversationTool> {
		return (this.state.get('tools') || {}) as Record<string, ConversationTool>
	}
	
	get availableTools() {
		return Object.keys(this.tools)
	}

	/**
	 * Add or replace a single tool by name.
	 * Uses the same format as tools passed at construction time.
	 */
	addTool(name: string, tool: ConversationTool): this {
		this.state.set('tools', { ...this.tools, [name]: tool })
		return this
	}

	/**
	 * Remove a tool by name.
	 */
	removeTool(name: string): this {
		const current = { ...this.tools }
		delete current[name]
		this.state.set('tools', current)
		return this
	}

	/**
	 * Merge new tools into the conversation, replacing any with the same name.
	 * Accepts the same Record<string, ConversationTool> format used at construction time.
	 */
	updateTools(tools: Record<string, ConversationTool>): this {
		this.state.set('tools', { ...this.tools, ...tools })
		return this
	}

	/**
	 * Register a hardcoded stub response that bypasses the API when the user's message matches.
	 * Streaming is still simulated — chunk/preview events fire word-by-word.
	 *
	 * @param matcher - Exact string match, substring, or RegExp tested against user input
	 * @param response - The text to stream back, or a zero-arg function that returns it
	 *
	 * @example
	 * conversation.stub('hello', 'Hi there!')
	 * conversation.stub(/weather/i, () => 'Sunny and 72°F.')
	 */
	stub(matcher: string | RegExp, response: string | (() => string)): this {
		this._stubs.push({ matcher, response })
		return this
	}

	/** Returns configured remote MCP servers keyed by server label. */
	get mcpServers(): Record<string, ConversationMCPServer> {
		return (this.options.mcpServers || {}) as Record<string, ConversationMCPServer>
	}

	/** Returns the full message history of the conversation. */
	get messages(): Message[] {
		return this.state.get('messages') || []
	}

	/** Returns the OpenAI model name being used for completions. */
	get model(): string {
		return this.state.get('model')!
	}

	/** Returns the active completion API mode after resolving auto/local behavior. */
	get apiMode(): 'responses' | 'chat' {
		const mode = this.options.api || 'auto'
		if (mode === 'chat' || mode === 'responses') return mode
		return this.options.local ? 'chat' : 'responses'
	}

	/** Whether a streaming response is currently in progress. */
	get isStreaming(): boolean {
		return !!this.state.get('streaming')
	}

	/**
	 * Returns the correct parameter name for limiting output tokens.
	 * Local models (LM Studio, Ollama) and legacy OpenAI models use max_tokens.
	 * Newer OpenAI models (gpt-4o+, gpt-4.1, gpt-5, o1, o3, o4) require max_completion_tokens.
	 */
	private get maxTokensParam(): 'max_tokens' | 'max_completion_tokens' {
		if (this.options.local) return 'max_tokens'

		const model = this.model
		const needsCompletionTokens = [
			'gpt-4o', 'gpt-4.1', 'gpt-5', 'o1', 'o3', 'o4',
		]

		if (needsCompletionTokens.some((prefix) => model.startsWith(prefix))) {
			return 'max_completion_tokens'
		}

		return 'max_tokens'
	}

	/** The context window size for the current model (from options override or auto-detected). */
	get contextWindow(): number {
		return this.options.contextWindow || getContextWindow(this.model)
	}

	/** Whether the conversation is approaching the context limit. */
	get isNearContextLimit(): boolean {
		const threshold = this.options.compactThreshold ?? 0.8
		return this.estimateTokens() >= this.contextWindow * threshold
	}

	/**
	 * Estimate the input token count for the current messages array
	 * using the js-tiktoken tokenizer. Updates state.
	 */
	estimateTokens(): number {
		const count = countMessageTokens(this.messages, this.model)
		this.state.set('estimatedInputTokens', count)
		return count
	}

	/**
	 * Generate a summary of the conversation so far using the LLM.
	 * Read-only — does not modify messages.
	 */
	async summarize(): Promise<string> {
		this.emit('summarizeStart')

		const transcript = this.messages
			.map(m => {
				const role = m.role
				const content = typeof m.content === 'string'
					? m.content
					: Array.isArray(m.content)
						? (m.content as any[]).filter((p: any) => p.type === 'text').map((p: any) => p.text).join('\n')
						: (m.content != null ? JSON.stringify(m.content) : '(no content)')
				return `[${role}]: ${content || '(no text content)'}`
			})
			.join('\n\n')

		const response = await this.openai.raw.chat.completions.create({
			model: this.model,
			messages: [
				{
					role: 'system',
					content: 'You are a conversation summarizer. Produce a concise but comprehensive summary of the following conversation. Preserve all key facts, decisions, context, user preferences, and any important details needed to continue the conversation. Output only the summary.',
				},
				{ role: 'user', content: transcript },
			],
			stream: false,
		})

		const summary = (response as any).choices?.[0]?.message?.content || ''
		this.emit('summarizeEnd', summary)
		return summary
	}

	/**
	 * Compact the conversation by summarizing old messages and replacing them
	 * with a summary message. Keeps the system message (if any) and the most
	 * recent N messages.
	 */
	async compact(options?: { keepRecent?: number }): Promise<{ summary: string; removedCount: number; estimatedTokens: number }> {
		const keepRecent = options?.keepRecent ?? this.options.compactKeepRecent ?? 4
		const messages = this.messages

		if (messages.length <= keepRecent + 1) {
			return { summary: '', removedCount: 0, estimatedTokens: this.estimateTokens() }
		}

		this.emit('compactStart', { messageCount: messages.length, keepRecent })

		const summary = await this.summarize()

		const systemMessage = (messages[0]?.role === 'system' || messages[0]?.role === 'developer')
			? messages[0]
			: null

		const recentMessages = messages.slice(-keepRecent)

		const newMessages: Message[] = []
		if (systemMessage) newMessages.push(systemMessage)

		newMessages.push({
			role: 'developer',
			content: `[Conversation Summary — the following is a summary of the earlier conversation that has been compacted to save context space]\n\n${summary}`,
		} as Message)

		newMessages.push(...recentMessages)

		const removedCount = messages.length - newMessages.length
		this.state.set('messages', newMessages)
		this.state.set('compactionCount', (this.state.get('compactionCount') || 0) + 1)

		// Responses API: clear continuation chain since message history changed
		if (this.apiMode === 'responses') {
			this.state.set('lastResponseId', null)
		}

		const estimatedTokens = this.estimateTokens()

		this.emit('compactEnd', { summary, removedCount, estimatedTokens, compactionCount: this.state.get('compactionCount') })

		return { summary, removedCount, estimatedTokens }
	}

	/**
	 * Get the OpenAI-formatted tools array from the registered tools.
	 *
	 * @returns {OpenAI.Chat.Completions.ChatCompletionTool[]} The tools formatted for OpenAI
	 */
	private get openaiTools(): OpenAI.Chat.Completions.ChatCompletionTool[] {
		return Object.entries(this.tools).map(([name, tool]) => ({
			type: 'function' as const,
			function: {
				name,
				description: tool.description,
				parameters: tool.parameters
			}
		}))
	}

	/**
	 * Get the OpenAI Responses-formatted tools array from local function tools
	 * plus configured remote MCP servers.
	 */
	private get responseTools(): OpenAI.Responses.Tool[] {
		const functionTools = Object.entries(this.tools).map(([name, tool]) => ({
			type: 'function' as const,
			name,
			description: tool.description,
			parameters: { ...tool.parameters, additionalProperties: false },
			strict: true,
		}))

		const mcpTools = Object.entries(this.mcpServers)
			.filter(([, server]) => !!server?.url)
			.map(([serverLabel, server]) => ({
				type: 'mcp' as const,
				server_label: serverLabel,
				server_url: server.url,
				...(server.headers ? { headers: server.headers } : {}),
				...(server.allowedTools ? { allowed_tools: server.allowedTools } : {}),
				...(server.requireApproval ? { require_approval: server.requireApproval } : {}),
			}))

		return [...functionTools, ...mcpTools]
	}

	/** Returns the first system/developer text message to use as Responses instructions. */
	private get responsesInstructions(): string | undefined {
		for (const message of this.messages) {
			if ((message.role === 'system' || message.role === 'developer') && typeof message.content === 'string') {
				return message.content
			}
		}
		return undefined
	}

	/**
	 * Send a message and get a streamed response. Automatically handles
	 * tool calls by invoking the registered handlers and feeding results
	 * back to the model until a final text response is produced.
	 *
	 * @param {string | ContentPart[]} content - The user message, either a string or array of content parts (text + images)
	 * @returns {Promise<string>} The assistant's final text response
	 *
	 * @example
	 * const reply = await conversation.ask("What's the weather in SF?")
	 * // With image:
	 * const reply = await conversation.ask([
	 *   { type: 'text', text: 'What is in this diagram?' },
	 *   { type: 'image_url', image_url: { url: 'data:image/png;base64,...' } }
	 * ])
	 */
	async ask(content: string | ContentPart[], options?: AskOptions): Promise<string> {
		this.state.set('callMaxTokens', options?.maxTokens ?? null)
		this._activeSchema = options?.schema ?? null

		// Auto-compact before adding the new message
		if (this.options.autoCompact) {
			const threshold = this.options.compactThreshold ?? 0.8
			const estimated = this.estimateTokens()
			const limit = this.contextWindow * threshold
			if (estimated >= limit) {
				this.emit('autoCompactTriggered', { estimated, limit, contextWindow: this.contextWindow })
				await this.compact()
			}
		}

		const userMessage: Message = { role: 'user', content: content as any }
		this.pushMessage(userMessage)
		this.emit('userMessage', content)

		try {
			const stubText = this._matchStub(typeof content === 'string' ? content : '')
			if (stubText !== null) {
				return await this._streamStub(stubText)
			}

			let raw: string

			if (this.apiMode === 'responses') {
				const previousResponseId = this.state.get('lastResponseId') || undefined
				let input: OpenAI.Responses.ResponseInput

				if (previousResponseId) {
					// Can chain via previous_response_id — only send the new user message
					input = [this.toResponsesUserMessage(content)]
				} else {
					// No previous response ID (first call or resumed from disk).
					// Convert full message history to Responses API input so the model has context.
					input = this.messagesToResponsesInput()
				}

				raw = await this.runResponsesLoop({
					turn: 1,
					accumulated: '',
					input,
					previousResponseId,
				})
			} else {
				raw = await this.runChatCompletionLoop({ turn: 1, accumulated: '' })
			}

			// When a structured output schema is active, parse the JSON response
			if (this._activeSchema) {
				try {
					const parsed = JSON.parse(raw)
					return parsed
				} catch {
					// Model returned something that isn't valid JSON — return raw
					return raw
				}
			}

			return raw
		} finally {
			this.state.set('callMaxTokens', null)
			this._activeSchema = null
		}
	}

	/** Convert user content into a Responses API input message item. */
	private toResponsesUserMessage(content: string | ContentPart[]): OpenAI.Responses.ResponseInputItem.Message {
		if (typeof content === 'string') {
			return {
				type: 'message',
				role: 'user',
				content: [{ type: 'input_text', text: content }]
			}
		}

		const parts = content.map((part) => {
			if (part.type === 'text') {
				return { type: 'input_text' as const, text: part.text }
			}
			if (part.type === 'input_audio') {
				return { type: 'input_audio' as const, data: part.data, format: part.format }
			}
			if (part.type === 'input_file') {
				return { type: 'input_file' as const, file_data: part.file_data, filename: part.filename }
			}

			return {
				type: 'input_image' as const,
				image_url: part.image_url.url,
				detail: part.image_url.detail || 'auto',
			}
		}) as OpenAI.Responses.ResponseInputMessageContentList

		return {
			type: 'message',
			role: 'user',
			content: parts,
		}
	}

	/**
	 * Convert the full Chat Completions message history into Responses API input items.
	 * Used when resuming a conversation without a previous_response_id.
	 */
	private messagesToResponsesInput(): OpenAI.Responses.ResponseInput {
		const input: OpenAI.Responses.ResponseInput = []

		for (const msg of this.messages) {
			if (msg.role === 'system' || msg.role === 'developer') {
				// System/developer messages are handled via the instructions parameter
				continue
			}

			if (msg.role === 'user') {
				if (typeof msg.content === 'string') {
					input.push({
						type: 'message',
						role: 'user',
						content: [{ type: 'input_text', text: msg.content }],
					})
				} else if (Array.isArray(msg.content)) {
					input.push(this.toResponsesUserMessage(msg.content as ContentPart[]))
				}
				continue
			}

			if (msg.role === 'assistant') {
				const content = typeof msg.content === 'string' ? msg.content : (msg.content || []).map((p: any) => p.text || '').join('')
				if (content) {
					input.push({
						type: 'message',
						role: 'assistant',
						content: [{ type: 'output_text', text: content, annotations: [] }],
						id: `msg_replay-${input.length}`,
						status: 'completed',
					} as any)
				}
				continue
			}

			// Tool results — skip in the replay since the assistant's tool_calls won't have matching IDs
			// The model will still understand context from the assistant messages that followed
		}

		return input
	}

	/**
	 * Build the OpenAI response_format / text.format config from the active Zod schema.
	 * Returns undefined when no schema is active.
	 */
	private get structuredOutputConfig(): { name: string; schema: Record<string, any>; strict: true } | undefined {
		if (!this._activeSchema) return undefined

		const raw = (this._activeSchema as any).toJSONSchema() as Record<string, any>
		const strict = strictifySchema(raw)

		// Derive a name from the schema description or fall back to a default.
		// OpenAI requires [a-zA-Z0-9_-] max 64 chars.
		const desc = raw.description || 'structured_output'
		const name = desc.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64)

		return {
			name,
			schema: { type: strict.type || 'object', properties: strict.properties, required: strict.required, additionalProperties: false },
			strict: true,
		}
	}

	/** Returns the OpenAI client instance from the container. */
	get openai() {
		let baseURL = this.options.clientOptions?.baseURL ? this.options.clientOptions.baseURL : undefined

		if (this.options.local) {
			baseURL = "http://localhost:1234/v1" 
		}

		return (this.container as any).client('openai', {
			defaultModel: this.options.model || (this.options.local ? this.options.model || "qwen/qwen3-coder-30b" : "gpt-5"),
			...this.options.clientOptions,
			...(baseURL ? { baseURL } : {}),
		}) as OpenAIClient
	}

	/** Returns the conversationHistory feature for persistence. */
	get history(): ConversationHistory {
		return this.container.feature('conversationHistory') as ConversationHistory
	}

	/**
	 * Persist this conversation to disk via conversationHistory.
	 * Creates a new record if this conversation hasn't been saved before,
	 * or updates the existing one.
	 *
	 * @param opts - Optional overrides for title, tags, thread, or metadata
	 * @returns The saved conversation record
	 */
	async save(opts?: { title?: string; tags?: string[]; thread?: string; metadata?: Record<string, any> }) {
		const id = this.state.get('id')!
		const existing = await this.history.load(id)

		// Persist lastResponseId so the Responses API can continue the chain on resume
		const lastResponseId = this.state.get('lastResponseId')
		const responseMeta = lastResponseId ? { lastResponseId } : {}

		if (existing) {
			existing.messages = this.messages
			existing.model = this.model
			if (opts?.title) existing.title = opts.title
			if (opts?.tags) existing.tags = opts.tags
			if (opts?.thread) existing.thread = opts.thread
			existing.metadata = { ...existing.metadata, ...responseMeta, ...(opts?.metadata || {}) }
			await this.history.save(existing)
			return existing
		}

		return this.history.create({
			id,
			title: opts?.title || this.options.title || 'Untitled',
			model: this.model,
			messages: this.messages,
			tags: opts?.tags || this.options.tags || [],
			thread: opts?.thread || this.options.thread || this.state.get('thread'),
			metadata: { ...responseMeta, ...(opts?.metadata || this.options.metadata || {}) },
		})
	}

	/**
	 * Execute a single tool call, routing through the pluggable toolExecutor
	 * if one is set (e.g. by the Assistant's interceptor chain).
	 */
	private async executeTool(toolName: string, rawArgs: string): Promise<string> {
		const tool = this.tools[toolName]
		const callCount = (this.state.get('toolCalls') || 0) + 1
		this.state.set('toolCalls', callCount)

		if (!tool) {
			const result = JSON.stringify({ error: `Unknown tool: ${toolName}` })
			this.emit('toolError', toolName, result)
			return result
		}

		let args: Record<string, any>
		try {
			args = rawArgs ? JSON.parse(rawArgs) : {}
		} catch (parseErr: any) {
			const result = JSON.stringify({ error: `Failed to parse tool arguments: ${parseErr.message}`, rawArgs })
			this.emit('toolError', toolName, parseErr)
			return result
		}

		if (this.toolExecutor) {
			return this.toolExecutor(toolName, args, tool.handler)
		}

		try {
			this.emit('toolCall', toolName, args)
			const output = await tool.handler(args)
			const result = typeof output === 'string' ? output : JSON.stringify(output)
			this.emit('toolResult', toolName, result)
			return result
		} catch (err: any) {
			const result = JSON.stringify({ error: err.message || String(err) })
			this.emit('toolError', toolName, err)
			return result
		}
	}

	/** Check registered stubs against user input. Returns the response text, or null if no match. */
	private _matchStub(input: string): string | null {
		for (const { matcher, response } of this._stubs) {
			const matched = typeof matcher === 'string'
				? input === matcher || input.includes(matcher)
				: matcher.test(input)
			if (matched) {
				return typeof response === 'function' ? response() : response
			}
		}
		return null
	}

	/**
	 * Simulate a streaming response for a hardcoded stub text.
	 * Emits chunk/preview events word-by-word, yielding between each to keep the event loop alive.
	 */
	private async _streamStub(text: string): Promise<string> {
		this.state.set('streaming', true)
		this.emit('turnStart', { turn: 1, isFollowUp: false })

		let accumulated = ''
		const chunks = text.match(/\S+\s*/g) ?? [text]

		try {
			for (const chunk of chunks) {
				accumulated += chunk
				this.emit('chunk', chunk)
				this.emit('preview', accumulated)
				await Promise.resolve()
			}
		} finally {
			this.state.set('streaming', false)
		}

		const trimmed = text
		this.pushMessage({ role: 'assistant', content: trimmed })
		this.state.set('lastResponse', trimmed)
		this.emit('turnEnd', { turn: 1, hasToolCalls: false })
		this.emit('response', trimmed)

		return trimmed
	}

	/**
	 * Runs the streaming Responses API loop. Handles local function calls by
	 * executing handlers and submitting `function_call_output` items until
	 * the model produces a final text response.
	 */
	private async runResponsesLoop(context: {
		turn: number
		accumulated: string
		input: OpenAI.Responses.ResponseInput
		previousResponseId?: string
	}): Promise<string> {

		const { turn } = context
		let accumulated = context.accumulated
		let turnContent = ''
		let finalResponse: OpenAI.Responses.Response | undefined

		const toolsParam = this.responseTools.length > 0 ? this.responseTools : undefined

		this.state.set('streaming', true)
		this.emit('turnStart', { turn, isFollowUp: turn > 1 })

		const textFormat = this.structuredOutputConfig
			? { text: { format: { type: 'json_schema' as const, ...this.structuredOutputConfig } } }
			: {}

		try {
			const stream = await this.openai.raw.responses.create({
				model: this.model as OpenAI.Responses.ResponseCreateParams['model'],
				input: context.input,
				stream: true,
				previous_response_id: context.previousResponseId,
				...(toolsParam ? { tools: toolsParam, tool_choice: 'auto', parallel_tool_calls: true } : {}),
				...(this.responsesInstructions ? { instructions: this.responsesInstructions } : {}),
				...(this.maxTokens ? { max_output_tokens: this.maxTokens } : {}),
				...(this.options.temperature != null ? { temperature: this.options.temperature } : {}),
				...(this.options.topP != null ? { top_p: this.options.topP } : {}),
				...(this.options.topK != null ? { top_k: this.options.topK } : {}),
				...(this.options.frequencyPenalty != null ? { frequency_penalty: this.options.frequencyPenalty } : {}),
				...(this.options.presencePenalty != null ? { presence_penalty: this.options.presencePenalty } : {}),
				...(this.options.stop ? { stop: this.options.stop } : {}),
				...textFormat,
			})

			for await (const event of stream) {
				this.emit('rawEvent', event)
				if ((event as any).type?.startsWith?.('response.mcp_')) {
					this.emit('mcpEvent', event)
				}
				if (((event as any).type === 'response.output_item.added' || (event as any).type === 'response.output_item.done')
					&& (event as any).item?.type?.startsWith?.('mcp_')) {
					this.emit('mcpEvent', event)
				}

				if (event.type === 'response.output_text.delta') {
					const delta = event.delta || ''
					turnContent += delta
					accumulated += delta
					this.emit('chunk', delta)
					this.emit('preview', accumulated)
				}

				if (event.type === 'response.completed') {
					finalResponse = event.response
					this.emit('responseCompleted', event.response)
				}
			}
		} finally {
			this.state.set('streaming', false)
		}

		if (!finalResponse) {
			throw new Error('Responses stream ended without a completed response')
		}

		this.state.set('lastResponseId', finalResponse.id)
		this.applyResponsesUsage(finalResponse.usage || undefined)

		const functionCalls = (finalResponse.output || []).filter((item) => item.type === 'function_call') as OpenAI.Responses.ResponseFunctionToolCall[]
		if (functionCalls.length > 0) {
			const assistantMessage: OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam = {
				role: 'assistant',
				content: turnContent || null,
				tool_calls: functionCalls.map((call) => ({
					id: call.call_id,
					type: 'function',
					function: {
						name: call.name,
						arguments: call.arguments || '{}',
					}
				}))
			}
			this.pushMessage(assistantMessage)

			this.emit('toolCallsStart', functionCalls)

			const functionOutputs: OpenAI.Responses.ResponseInputItem.FunctionCallOutput[] = []
			for (const call of functionCalls) {
				const result = await this.executeTool(call.name, call.arguments || '{}')

				this.pushMessage({
					role: 'tool',
					tool_call_id: call.call_id,
					content: result,
				})

				functionOutputs.push({
					type: 'function_call_output',
					call_id: call.call_id,
					output: result,
				})
			}

			this.emit('toolCallsEnd')
			this.emit('turnEnd', { turn, hasToolCalls: true })

			return this.runResponsesLoop({
				turn: turn + 1,
				accumulated,
				input: functionOutputs,
				previousResponseId: finalResponse.id,
			})
		}

		const finalText = turnContent || finalResponse.output_text || ''
		const assistantMessage: Message = { role: 'assistant', content: finalText }
		this.pushMessage(assistantMessage)
		this.state.set('lastResponse', accumulated || finalText)

		this.emit('turnEnd', { turn, hasToolCalls: false })
		this.emit('response', accumulated || finalText)

		return accumulated || finalText
	}

	/** Apply Responses API usage stats to this conversation's token usage counters. */
	private applyResponsesUsage(usage?: OpenAI.Responses.ResponseUsage) {
		if (!usage) return
		const prev = this.state.get('tokenUsage')!
		this.state.set('tokenUsage', {
			prompt: prev.prompt + (usage.input_tokens || 0),
			completion: prev.completion + (usage.output_tokens || 0),
			total: prev.total + (usage.total_tokens || 0),
		})
	}

	/**
	 * Runs the streaming completion loop. If the model requests tool calls,
	 * executes them and loops again until a text response is produced.
	 *
	 * @returns {Promise<string>} The final assistant text response
	 */
	/**
	 * Runs the streaming completion loop. If the model requests tool calls,
	 * executes them and loops again until a text response is produced.
	 *
	 * @param context - Turn tracking: turn number and text accumulated across all turns
	 * @returns {Promise<string>} The final assistant text response (accumulated across all turns)
	 */
	private async runChatCompletionLoop(context: { turn: number; accumulated: string } = { turn: 1, accumulated: '' }): Promise<string> {
		
		const { turn } = context
		let accumulated = context.accumulated

		const hasTools = Object.keys(this.tools).length > 0
		const toolsParam = hasTools ? this.openaiTools : undefined

		this.state.set('streaming', true)
		this.emit('turnStart', { turn, isFollowUp: turn > 1 })

		let turnContent = ''
		let toolCalls: Array<{ id: string; function: { name: string; arguments: string }; type: 'function' }> = []

		const responseFormat = this.structuredOutputConfig
			? { response_format: { type: 'json_schema' as const, json_schema: this.structuredOutputConfig } }
			: {}

		try {
			const stream = await this.openai.raw.chat.completions.create({
				model: this.model,
				messages: this.messages,
				stream: true,
				...(toolsParam ? { tools: toolsParam, tool_choice: 'auto' } : {}),
				...(this.maxTokens ? { [this.maxTokensParam]: this.maxTokens } : {}),
				...(this.options.temperature != null ? { temperature: this.options.temperature } : {}),
				...(this.options.topP != null ? { top_p: this.options.topP } : {}),
				...(this.options.topK != null ? { top_k: this.options.topK } : {}),
				...(this.options.frequencyPenalty != null ? { frequency_penalty: this.options.frequencyPenalty } : {}),
				...(this.options.presencePenalty != null ? { presence_penalty: this.options.presencePenalty } : {}),
				...(this.options.stop ? { stop: this.options.stop } : {}),
				...responseFormat,
			})

			for await (const chunk of stream) {
				const delta = chunk.choices[0]?.delta

				if (delta?.content) {
					turnContent += delta.content
					accumulated += delta.content
					this.emit('chunk', delta.content)
					this.emit('preview', accumulated)
				}

				if (delta?.tool_calls) {
					for (const tc of delta.tool_calls) {
						if (!toolCalls[tc.index]) {
							toolCalls[tc.index] = {
								id: tc.id || '',
								type: 'function',
								function: { name: '', arguments: '' }
							}
						}
						if (tc.id) {
							toolCalls[tc.index]!.id = tc.id
						}
						if (tc.function?.name) {
							toolCalls[tc.index]!.function.name += tc.function.name
						}
						if (tc.function?.arguments) {
							toolCalls[tc.index]!.function.arguments += tc.function.arguments
						}
					}
				}

				if (chunk.usage) {
					const prev = this.state.get('tokenUsage')!
					this.state.set('tokenUsage', {
						prompt: prev.prompt + (chunk.usage.prompt_tokens || 0),
						completion: prev.completion + (chunk.usage.completion_tokens || 0),
						total: prev.total + (chunk.usage.total_tokens || 0)
					})
				}
			}
		} finally {
			this.state.set('streaming', false)
		}

		// If the model produced tool calls, execute them and loop
		if (toolCalls.length > 0) {
			const assistantMessage: OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam = {
				role: 'assistant',
				content: turnContent || null,
				tool_calls: toolCalls
			}
			this.pushMessage(assistantMessage)

			this.emit('toolCallsStart', toolCalls)

			for (const tc of toolCalls) {
				const result = await this.executeTool(tc.function.name, tc.function.arguments)

				const toolMessage: OpenAI.Chat.Completions.ChatCompletionToolMessageParam = {
					role: 'tool',
					tool_call_id: tc.id,
					content: result
				}
				this.pushMessage(toolMessage)
			}

			this.emit('toolCallsEnd')
			this.emit('turnEnd', { turn, hasToolCalls: true })

			// Loop: let the model respond to tool results
			return this.runChatCompletionLoop({ turn: turn + 1, accumulated })
		}

		// Final text response — use this turn's content for the message history,
		// but accumulated for the response event and return value
		const assistantMessage: Message = { role: 'assistant', content: turnContent }
		this.pushMessage(assistantMessage)
		this.state.set('lastResponse', accumulated)

		this.emit('turnEnd', { turn, hasToolCalls: false })
		this.emit('response', accumulated)

		return accumulated
	}

	/**
	 * Append a message to the conversation state.
	 *
	 * @param {Message} message - The message to append
	 */
	pushMessage(message: Message) {
		this.state.set('messages', [...this.messages, message])
	}
}

export default Conversation
