import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { z } from 'zod'
import { AGIContainer } from '../src/agi/container.server'
import { ConversationAbortError, type Conversation } from '../src/agi/features/conversation'
import type { Assistant } from '../src/agi/features/assistant'
import { ClaudeSessionTransport } from '../src/agi/features/model-providers'
import { argsSchema as mcpArgsSchema } from '../src/commands/mcp'

function nativeConversation(options: Record<string, any> = {}) {
	const container = new AGIContainer()
	const providers = container.feature('modelProviders')
	const conversation = container.feature('conversation', {
		cached: false,
		model: 'gpt-5',
		api: 'chat',
		...options,
	}) as Conversation
	return { container, providers, conversation }
}

describe('Conversation correctness boundaries', () => {
	let savedDefaultProvider: string | undefined
	beforeAll(() => {
		savedDefaultProvider = process.env.LUCA_DEFAULT_PROVIDER
		process.env.LUCA_DEFAULT_PROVIDER = 'openai'
	})
	afterAll(() => {
		if (savedDefaultProvider === undefined) delete process.env.LUCA_DEFAULT_PROVIDER
		else process.env.LUCA_DEFAULT_PROVIDER = savedDefaultProvider
	})

	it('serializes overlapping asks and keeps per-call options attached to their turn', async () => {
		const { providers, conversation } = nativeConversation()
		const requests: any[] = []
		let releaseFirst!: () => void
		const firstBlocked = new Promise<void>((resolve) => { releaseFirst = resolve })
		let active = 0
		let maxActive = 0
		providers.registerTransport('openai-chat-completions', {
			apiMode: 'openai-chat-completions',
			async *stream(request: any) {
				requests.push(request)
				active++
				maxActive = Math.max(maxActive, active)
				try {
					if (requests.length === 1) await firstBlocked
					yield { type: 'response', response: { content: request.instructions, toolCalls: [] } } as const
				} finally {
					active--
				}
			},
		})

		const first = conversation.ask('one', { instructions: 'first', maxTokens: 11 })
		const second = conversation.ask('two', { instructions: 'second', maxTokens: 22 })
		for (let attempt = 0; attempt < 50 && requests.length === 0; attempt++) {
			await new Promise(resolve => setTimeout(resolve, 0))
		}
		expect(requests).toHaveLength(1)
		releaseFirst()

		expect(await Promise.all([first, second])).toEqual(['first', 'second'])
		expect(maxActive).toBe(1)
		expect(requests.map(request => [request.instructions, request.maxTokens])).toEqual([
			['first', 11],
			['second', 22],
		])
	})

	it('never trims away the active request and applies budgeting to generic transports', async () => {
		const container = new AGIContainer()
		const providers = container.feature('modelProviders')
		providers.registerProfile({ id: 'budget-generic', apiMode: 'budget-generic', auth: 'none', defaultModel: 'gpt-5' })
		const requests: any[] = []
		providers.registerTransport('budget-generic', {
			apiMode: 'budget-generic',
			async *stream(request: any) {
				requests.push(request)
				yield { type: 'response', response: { content: 'ok', toolCalls: [] } } as const
			},
		})
		const conversation = container.feature('conversation', {
			cached: false,
			provider: 'budget-generic',
			maxInputTokens: 1,
			history: [
				{ role: 'system', content: 'system' },
				{ role: 'user', content: 'old history' },
				{ role: 'assistant', content: 'old answer' },
			],
		}) as Conversation

		await conversation.ask('CURRENT REQUEST MUST SURVIVE')

		expect(requests[0].messages.at(-1)).toMatchObject({ role: 'user', content: 'CURRENT REQUEST MUST SURVIVE' })
		expect(requests[0].messages.some((message: any) => message.content === 'old history')).toBe(false)
	})

	it('uses Responses continuation while local history is current and falls back from a stale id', async () => {
		const { providers, conversation } = nativeConversation({ api: 'responses' })
		const requests: any[] = []
		providers.registerTransport('openai-responses', {
			apiMode: 'openai-responses',
			async *stream(request: any) {
				requests.push(request)
				if (request.providerOptions.previousResponseId === 'stale') {
					const error: any = new Error('previous_response_id not found')
					error.status = 404
					throw error
				}
				const id = `resp_${requests.length}`
				const response = { id, output: [], output_text: id, usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 } }
				yield { type: 'response', response: { content: id, toolCalls: [], providerData: { responseId: id, response } } } as const
			},
		})

		await conversation.ask('first')
		await conversation.ask('second')
		expect(requests[1].providerOptions.previousResponseId).toBe('resp_1')

		conversation.state.set('lastResponseId', 'stale')
		conversation.state.set('lastResponseMessageCount', conversation.messages.length)
		const result = await conversation.ask('third')
		expect(result).toBe('resp_4')
		expect(requests[2].providerOptions.previousResponseId).toBe('stale')
		expect(requests[3].providerOptions.previousResponseId).toBeUndefined()
		expect(requests[3].providerOptions.input.length).toBeGreaterThan(1)
	})

	it('validates structured output for native and generic transports', async () => {
		const schema = z.object({ count: z.number().int() })
		const { providers, conversation } = nativeConversation()
		providers.registerTransport('openai-chat-completions', {
			apiMode: 'openai-chat-completions',
			async *stream(request: any) {
				expect(request.responseFormat).toBeDefined()
				yield { type: 'response', response: { content: '{"count":"wrong"}', toolCalls: [] } } as const
			},
		})
		await expect(conversation.ask('count', { schema })).rejects.toThrow()

		const genericContainer = new AGIContainer()
		const genericProviders = genericContainer.feature('modelProviders')
		genericProviders.registerProfile({ id: 'structured-generic', apiMode: 'structured-generic', auth: 'none', defaultModel: 'gpt-5' })
		genericProviders.registerTransport('structured-generic', {
			apiMode: 'structured-generic',
			async *stream(request: any) {
				expect(request.responseFormat).toBeDefined()
				yield { type: 'response', response: { content: '{"count":3}', toolCalls: [] } } as const
			},
		})
		const generic = genericContainer.feature('conversation', { cached: false, provider: 'structured-generic' }) as Conversation
		expect(await generic.ask('count', { schema }) as any).toEqual({ count: 3 })
	})

	it('aborts a custom transport even when it ignores the supplied signal', async () => {
		const container = new AGIContainer()
		const providers = container.feature('modelProviders')
		providers.registerProfile({ id: 'slow-generic', apiMode: 'slow-generic', auth: 'none', defaultModel: 'gpt-5' })
		providers.registerTransport('slow-generic', {
			apiMode: 'slow-generic',
			async *stream() {
				await new Promise(() => {})
				yield { type: 'response', response: { content: 'too late', toolCalls: [] } } as const
			},
		})
		const conversation = container.feature('conversation', { cached: false, provider: 'slow-generic' }) as Conversation
		const pending = conversation.ask('wait')
		await Promise.resolve()
		conversation.abort()
		await expect(pending).rejects.toBeInstanceOf(ConversationAbortError)
	})

	it('propagates aborts from raw conversation tool handlers', async () => {
		const { providers, conversation } = nativeConversation()
		conversation.addTool('waitForever', {
			description: 'Wait until the turn is aborted',
			parameters: { type: 'object', properties: {} },
			handler: async () => new Promise(() => {}),
		})
		let call = 0
		providers.registerTransport('openai-chat-completions', {
			apiMode: 'openai-chat-completions',
			async *stream() {
				call++
				if (call === 1) {
					yield {
						type: 'response',
						response: {
							content: '',
							toolCalls: [{ id: 'call_1', name: 'waitForever', rawArguments: '{}' }],
						},
					} as const
				}
			},
		})

		const pending = conversation.ask('use the tool')
		for (let attempt = 0; attempt < 50 && conversation.state.get('toolCalls') === 0; attempt++) {
			await new Promise(resolve => setTimeout(resolve, 0))
		}
		conversation.abort()

		await expect(pending).rejects.toBeInstanceOf(ConversationAbortError)
	})

	it('adds per-turn costs without repricing earlier models and honors provider totals', async () => {
		const { providers, conversation } = nativeConversation({ model: 'gpt-4' })
		providers.registerTransport('openai-chat-completions', {
			apiMode: 'openai-chat-completions',
			async *stream() {
				yield {
					type: 'response',
					response: { content: 'ok', toolCalls: [], usage: { prompt_tokens: 1_000_000, completion_tokens: 0, total_tokens: 1_000_000 } },
				} as const
			},
		})
		await conversation.ask('first')
		expect(conversation.state.get('cost')?.totalCost).toBe(30)
		conversation.setModel('gpt-4.1')
		await conversation.ask('second')
		expect(conversation.state.get('cost')?.totalCost).toBe(32)

		const genericContainer = new AGIContainer()
		const genericProviders = genericContainer.feature('modelProviders')
		genericProviders.registerProfile({ id: 'priced-generic', apiMode: 'priced-generic', auth: 'none', defaultModel: 'unknown' })
		genericProviders.registerTransport('priced-generic', {
			apiMode: 'priced-generic',
			async *stream() {
				yield { type: 'response', response: { content: 'ok', toolCalls: [], usage: { costUsd: 0.25 } } } as const
			},
		})
		const generic = genericContainer.feature('conversation', { cached: false, provider: 'priced-generic' }) as Conversation
		await generic.ask('priced')
		expect(generic.state.get('cost')?.totalCost).toBe(0.25)
	})

	it('clears provider-specific options across routing changes', () => {
		const { conversation } = nativeConversation({
			provider: 'openai',
			providerOptions: { apiKey: 'secret-a', permissionMode: 'bypassPermissions' },
		})
		conversation.setProvider('claude-code')
		expect(conversation.options.providerOptions).toBeUndefined()
	})

	it('restores continuation, usage, and cost state when an assistant resumes', async () => {
		const container = new AGIContainer()
		const assistant = container.feature('assistant', {
			cached: false,
			name: 'resume-state-test',
			systemPrompt: 'Current system prompt',
			historyMode: 'session',
		}) as Assistant
		assistant.resumeThread('resume:thread')
		const record = {
			id: 'saved-conversation', title: 'Saved', model: 'gpt-5', tags: [], thread: 'resume:thread',
			createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:01.000Z', messageCount: 3,
			messages: [{ role: 'system', content: 'Old prompt' }, { role: 'user', content: 'hello' }, { role: 'assistant', content: 'hi' }],
			tokenUsage: { prompt: 10, completion: 4, total: 14, cachedTokens: 2, reasoningTokens: 1 },
			cost: { inputCost: 0.01, outputCost: 0.02, totalCost: 0.03 },
			metadata: { lastResponseId: 'resp_saved', lastResponseMessageCount: 3, lastProviderData: { claudeSessionId: 'claude_saved' } },
		}
		;(assistant.conversationHistory as any).findByThread = async () => record
		await assistant.start()

		expect(assistant.conversation.state.get('lastResponseId')).toBe('resp_saved')
		expect(assistant.conversation.state.get('lastProviderData')).toEqual({ claudeSessionId: 'claude_saved' })
		expect(assistant.conversation.state.get('tokenUsage')).toEqual(record.tokenUsage)
		expect(assistant.conversation.state.get('cost')).toEqual(record.cost)
	})

	it('applies fork tool filters to native tools and the Claude MCP bridge', async () => {
		const container = new AGIContainer()
		const assistant = container.feature('assistant', {
			cached: false, name: 'filtered-researcher', systemPrompt: 'Research safely.', provider: 'claude-code',
			providerOptions: { assistant: 'filtered-researcher' },
		}) as Assistant
		assistant.addTool('safeLookup', async () => 'safe')
		assistant.addTool('createResearchJob', async () => 'forked')
		await assistant.start()
		const fork = await assistant.fork({ history: 'none', forbidTools: ['createResearchJob'] })

		expect(fork.conversation.availableTools).toEqual(['safeLookup'])
		expect(fork.conversation.options.providerOptions?.assistantToolFilters).toEqual({ forbidTools: ['createResearchJob'] })
	})

	it('requests streaming Chat usage, minimizes Codex continuation data, and forwards Claude MCP filters', async () => {
		expect(mcpArgsSchema.parse({ forbidTool: 'createResearchJob' }).forbidTool).toBe('createResearchJob')
		const container = new AGIContainer()
		const providers = container.feature('modelProviders')
		const chatCalls: any[] = []
		const chatProvider = await providers.resolve({
			provider: { id: 'test-chat', apiMode: 'openai-chat-completions', auth: 'none' },
			providerOptions: { client: { chat: { completions: { create: async (params: any) => {
				chatCalls.push(params)
				async function* chunks() { yield { choices: [], usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 } } }
				return chunks()
			} } } } },
		})
		for await (const _event of chatProvider.transport.stream({ model: 'gpt-5', messages: [], stream: true }, chatProvider)) { /* drain */ }
		expect(chatCalls[0].stream_options).toEqual({ include_usage: true })

		const codex = container.feature('openaiCodex') as any
		codex.run = async () => ({ result: 'ok', threadId: 'thread-safe', prompt: 'secret', messages: ['secret'], executions: ['secret'] })
		const codexProvider = await providers.resolve({ provider: 'openai-codex' })
		const codexEvents: any[] = []
		for await (const event of codexProvider.transport.stream({ model: 'gpt-5-codex', messages: [{ role: 'user', content: 'go' }] }, codexProvider)) codexEvents.push(event)
		expect(codexEvents.at(-1).response.providerData).toEqual({ codexThreadId: 'thread-safe' })

		const runs: any[] = []
		providers.registerTransport('claude-session', new ClaudeSessionTransport(container, {
			claudeCode: { run: async (_prompt: string, options: any) => {
				runs.push(options)
				return { status: 'completed', result: 'ok', sessionId: 'claude-safe' }
			} },
		}))
		const claudeProvider = await providers.resolve({
			provider: 'claude-code',
			providerOptions: { assistant: 'researcher', assistantToolFilters: { forbidTools: ['createResearchJob'] } },
		})
		for await (const _event of claudeProvider.transport.stream({ model: 'claude-code', messages: [{ role: 'user', content: 'go' }] }, claudeProvider)) { /* drain */ }
		expect(runs[0].mcpServers['luca-researcher'].args).toContain('--forbid-tool')
		expect(runs[0].mcpServers['luca-researcher'].args).toContain('createResearchJob')
	})
})
