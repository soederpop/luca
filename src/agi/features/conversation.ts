import type { Container } from '@/container';
import { type AvailableFeatures, type FeatureOptions, type FeatureState } from '@/feature'
import { features, Feature } from '@/feature'
import type { OpenAIClient } from '../openai-client';
import type OpenAI from 'openai';

declare module '@/feature' {
	interface AvailableFeatures {
		conversation: typeof Conversation
	}
}

export type Message = OpenAI.Chat.Completions.ChatCompletionMessageParam

export interface ConversationTool {
	handler: (...args: any[]) => Promise<any>
	description: string
	parameters: Record<string, any>
}

export interface ConversationOptions extends FeatureOptions {
	/** A unique identifier for the conversation */
	id?: string
	/** A unique identifier for threads, an arbitrary grouping mechanism */
	thread?: string
	/** Any available OpenAI model */
	model?: string
	/** Initial message history to seed the conversation */
	history?: Message[]
	/** Tools the model can call during conversation */
	tools?: Record<string, ConversationTool>
}

export interface ConversationState extends FeatureState {
	id: string
	thread: string
	model: string
	messages: Message[]
	streaming: boolean
	lastResponse: string
	toolCalls: number
	tokenUsage: {
		prompt: number
		completion: number
		total: number
	}
}

/**
 * A self-contained conversation with OpenAI that supports streaming,
 * tool calling, and message state management.
 *
 * @extends Feature
 */
export class Conversation extends Feature<ConversationState, ConversationOptions> {
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

	get tools() : Record<string, any> {
		return this.options.tools || {}
	}

	get messages(): Message[] {
		return this.state.get('messages') || []
	}

	get model(): string {
		return this.state.get('model')!
	}

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
	 * @param {string} content - The user message
	 * @returns {Promise<string>} The assistant's final text response
	 *
	 * @example
	 * const reply = await conversation.ask("What's the weather in SF?")
	 */
	async ask(content: string): Promise<string> {
		const userMessage: Message = { role: 'user', content }
		this.pushMessage(userMessage)
		this.emit('userMessage', content)

		return this.runCompletionLoop()
	}

	get openai() {
		return this.container.client('openai') as OpenAIClient
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
				}

				if (delta?.tool_calls) {
					console.log(delta.tool_calls)
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
