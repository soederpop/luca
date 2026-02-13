import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'
import type { Container } from '@/container';
import { type AvailableFeatures } from '@/feature'
import { features, Feature } from '@/feature'
import type { OpenAIClient } from '../openai-client';
import type OpenAI from 'openai';
import type { ConversationHistory } from './conversation-history';

declare module '@/feature' {
	interface AvailableFeatures {
		conversation: typeof Conversation
	}
}

export type Message = OpenAI.Chat.Completions.ChatCompletionMessageParam

export type ContentPart =
	| { type: 'text'; text: string }
	| { type: 'image_url'; image_url: { url: string; detail?: 'low' | 'high' | 'auto' } }

export interface ConversationTool {
	handler: (...args: any[]) => Promise<any>
	description: string
	parameters: Record<string, any>
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
	tools: z.record(z.any()).optional().describe('Tools the model can call during conversation'),
	/** Tags for categorizing and searching this conversation */
	tags: z.array(z.string()).optional().describe('Tags for categorizing and searching this conversation'),
	/** Arbitrary metadata to attach to this conversation */
	metadata: z.record(z.any()).optional().describe('Arbitrary metadata to attach to this conversation'),
})

export const ConversationStateSchema = FeatureStateSchema.extend({
	id: z.string().describe('Unique identifier for this conversation instance'),
	thread: z.string().describe('Thread identifier for grouping conversations'),
	model: z.string().describe('The OpenAI model being used'),
	messages: z.array(z.any()).describe('Full message history of the conversation'),
	streaming: z.boolean().describe('Whether a streaming response is currently in progress'),
	lastResponse: z.string().describe('The last assistant response text'),
	toolCalls: z.number().describe('Total number of tool calls made in this conversation'),
	tokenUsage: z.object({
		prompt: z.number().describe('Total prompt tokens consumed'),
		completion: z.number().describe('Total completion tokens consumed'),
		total: z.number().describe('Total tokens consumed'),
	}).describe('Cumulative token usage statistics'),
})

export type ConversationOptions = z.infer<typeof ConversationOptionsSchema>
export type ConversationState = z.infer<typeof ConversationStateSchema>

/**
 * A self-contained conversation with OpenAI that supports streaming,
 * tool calling, and message state management.
 *
 * @extends Feature
 */
export class Conversation extends Feature<ConversationState, ConversationOptions> {
	static override stateSchema = ConversationStateSchema
	static override optionsSchema = ConversationOptionsSchema
	static override shortcut = 'features.conversation' as const

	private get _tools(): Record<string, ConversationTool> {
		return this.options.tools || {}
	}

	static attach(container: Container<AvailableFeatures, any>) {
		features.register('conversation', Conversation)
		return container
	}

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
			tokenUsage: { prompt: 0, completion: 0, total: 0 }
		}
	}

	/** Returns the registered tools available for the model to call. */
	get tools() : Record<string, any> {
		return this.options.tools || {}
	}

	/** Returns the full message history of the conversation. */
	get messages(): Message[] {
		return this.state.get('messages') || []
	}

	/** Returns the OpenAI model name being used for completions. */
	get model(): string {
		return this.state.get('model')!
	}

	/** Whether a streaming response is currently in progress. */
	get isStreaming(): boolean {
		return !!this.state.get('streaming')
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
	async ask(content: string | ContentPart[]): Promise<string> {
		const userMessage: Message = { role: 'user', content: content as any }
		this.pushMessage(userMessage)
		this.emit('userMessage', content)

		return this.runCompletionLoop()
	}

	/** Returns the OpenAI client instance from the container. */
	get openai() {
		return this.container.client('openai') as OpenAIClient
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
	 * Runs the streaming completion loop. If the model requests tool calls,
	 * executes them and loops again until a text response is produced.
	 *
	 * @returns {Promise<string>} The final assistant text response
	 */
	private async runCompletionLoop(): Promise<string> {
		const hasTools = Object.keys(this._tools || {}).length > 0
		const toolsParam = hasTools ? this.openaiTools : undefined

		this.state.set('streaming', true)
		this.emit('streamStart')

		let fullContent = ''
		let toolCalls: Array<{ id: string; function: { name: string; arguments: string }; type: 'function' }> = []

		try {
			const stream = await this.openai.raw.chat.completions.create({
				model: this.model,
				messages: this.messages,
				stream: true,
				...(toolsParam ? { tools: toolsParam, tool_choice: 'auto' } : {})
			})

			for await (const chunk of stream) {
				const delta = chunk.choices[0]?.delta

				if (delta?.content) {
					fullContent += delta.content
					this.emit('chunk', delta.content)
					this.emit('preview', fullContent)
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
							toolCalls[tc.index].id = tc.id
						}
						if (tc.function?.name) {
							toolCalls[tc.index].function.name += tc.function.name
						}
						if (tc.function?.arguments) {
							toolCalls[tc.index].function.arguments += tc.function.arguments
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
			this.emit('streamEnd')
		}

		// If the model produced tool calls, execute them and loop
		if (toolCalls.length > 0) {
			const assistantMessage: OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam = {
				role: 'assistant',
				content: fullContent || null,
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

			// Loop: let the model respond to tool results
			return this.runCompletionLoop()
		}

		// Final text response
		const assistantMessage: Message = { role: 'assistant', content: fullContent }
		this.pushMessage(assistantMessage)
		this.state.set('lastResponse', fullContent)

		this.emit('response', fullContent)

		return fullContent
	}

	/**
	 * Append a message to the conversation state.
	 *
	 * @param {Message} message - The message to append
	 */
	private pushMessage(message: Message) {
		this.state.set('messages', [...this.messages, message])
	}
}

export default features.register('conversation', Conversation)
