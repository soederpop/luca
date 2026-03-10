import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'
import { type AvailableFeatures } from '@soederpop/luca/feature'
import { Feature } from '@soederpop/luca/feature'
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
	maxTokens: z.number().optional().describe('Maximum number of output tokens per completion'),

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
})

export type ConversationOptions = z.infer<typeof ConversationOptionsSchema>
export type ConversationState = z.infer<typeof ConversationStateSchema>

export type AskOptions = {
	maxTokens?: number
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
	static override shortcut = 'features.conversation' as const

	static { Feature.register(this, 'conversation') }

	private _callMaxTokens: number | undefined = undefined

	/** Resolved max tokens: per-call override > options-level > undefined (no limit). */
	private get maxTokens(): number | undefined {
		return this._callMaxTokens ?? this.options.maxTokens ?? undefined
	}

	private get _tools(): Record<string, ConversationTool> {
		return this.options.tools || {}
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
		}
	}

	/** Returns the registered tools available for the model to call. */
	get tools() : Record<string, any> {
		return this.options.tools || {}
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
		this._callMaxTokens = options?.maxTokens

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
			if (this.apiMode === 'responses') {
				return await this.runResponsesLoop({
					turn: 1,
					accumulated: '',
					input: [this.toResponsesUserMessage(content)],
					previousResponseId: this.state.get('lastResponseId') || undefined,
				})
			}

			return await this.runChatCompletionLoop({ turn: 1, accumulated: '' })
		} finally {
			this._callMaxTokens = undefined
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

	/** Returns the OpenAI client instance from the container. */
	get openai() {
		let baseURL = this.options.clientOptions?.baseURL ? this.options.clientOptions.baseURL : undefined

		if (this.options.local) {
			baseURL = "http://localhost:11434/v1" 
		}

		return (this.container as any).client('openai', {
			defaultModel: this.options.model || (this.options.local ? "qwen2.5:7b" : "gpt-4o"),
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

		if (existing) {
			existing.messages = this.messages
			existing.model = this.model
			if (opts?.title) existing.title = opts.title
			if (opts?.tags) existing.tags = opts.tags
			if (opts?.thread) existing.thread = opts.thread
			if (opts?.metadata) existing.metadata = { ...existing.metadata, ...opts.metadata }
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
			metadata: opts?.metadata || this.options.metadata || {},
		})
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

		try {
			const stream = await this.openai.raw.responses.create({
				model: this.model as OpenAI.Responses.ResponseCreateParams['model'],
				input: context.input,
				stream: true,
				previous_response_id: context.previousResponseId,
				...(toolsParam ? { tools: toolsParam, tool_choice: 'auto', parallel_tool_calls: true } : {}),
				...(this.responsesInstructions ? { instructions: this.responsesInstructions } : {}),
				...(this.maxTokens ? { max_output_tokens: this.maxTokens } : {}),
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
				const toolName = call.name
				const tool = this._tools[toolName]
				const callCount = (this.state.get('toolCalls') || 0) + 1
				this.state.set('toolCalls', callCount)

				let result: string
				if (!tool) {
					result = JSON.stringify({ error: `Unknown tool: ${toolName}` })
					this.emit('toolError', toolName, result)
				} else {
					try {
						const args = call.arguments ? JSON.parse(call.arguments) : {}
						this.emit('toolCall', toolName, args)
						const output = await tool.handler(args)
						result = typeof output === 'string' ? output : JSON.stringify(output)
						this.emit('toolResult', toolName, result)
					} catch (err: any) {
						result = JSON.stringify({ error: err.message || String(err) })
						this.emit('toolError', toolName, err)
					}
				}

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

		const hasTools = Object.keys(this._tools || {}).length > 0
		const toolsParam = hasTools ? this.openaiTools : undefined

		this.state.set('streaming', true)
		this.emit('turnStart', { turn, isFollowUp: turn > 1 })

		let turnContent = ''
		let toolCalls: Array<{ id: string; function: { name: string; arguments: string }; type: 'function' }> = []

		try {
			const stream = await this.openai.raw.chat.completions.create({
				model: this.model,
				messages: this.messages,
				stream: true,
				...(toolsParam ? { tools: toolsParam, tool_choice: 'auto' } : {}),
				...(this.maxTokens ? { max_tokens: this.maxTokens } : {}),
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
				const toolName = tc.function.name
				const tool = this._tools[toolName]
				const callCount = (this.state.get('toolCalls') || 0) + 1
				this.state.set('toolCalls', callCount)

				let result: string

				if (!tool) {
					result = JSON.stringify({ error: `Unknown tool: ${toolName}` })
					this.emit('toolError', toolName, result)
				} else {
					try {
						const args = JSON.parse(tc.function.arguments)
						this.emit('toolCall', toolName, args)
						const output = await tool.handler(args)
						result = typeof output === 'string' ? output : JSON.stringify(output)
						this.emit('toolResult', toolName, result)
					} catch (err: any) {
						result = JSON.stringify({ error: err.message || String(err) })
						this.emit('toolError', toolName, err)
					}
				}

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
