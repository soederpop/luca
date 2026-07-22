import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'bun:test'
import { AGIContainer } from '../src/agi/container.server'
import type { Conversation } from '../src/agi/features/conversation'

function makeConversation(opts: Record<string, any> = {}): Conversation {
	const container = new AGIContainer()
	return container.feature('conversation', { model: 'gpt-5', ...opts }) as Conversation
}

describe('Conversation', () => {
	describe('state', () => {
		it('initializes with empty messages when no history provided', () => {
			const conv = makeConversation()
			expect(conv.messages).toEqual([])
		})

		it('seeds message history from options', () => {
			const history = [{ role: 'system', content: 'You are helpful.' }]
			const conv = makeConversation({ history })
			expect(conv.messages).toHaveLength(1)
			expect(conv.messages[0]).toEqual(history[0])
		})

		it('uses provided model', () => {
			const conv = makeConversation({ model: 'gpt-4.1' })
			expect(conv.model).toBe('gpt-4.1')
		})

		it('isStreaming is false initially', () => {
			const conv = makeConversation()
			expect(conv.isStreaming).toBe(false)
		})
	})

	describe('pushMessage', () => {
		it('appends to messages', () => {
			const conv = makeConversation()
			conv.pushMessage({ role: 'user', content: 'hello' })
			expect(conv.messages).toHaveLength(1)
			expect(conv.messages[0]!.role).toBe('user')
		})

		it('does not mutate prior messages array', () => {
			const conv = makeConversation()
			const before = conv.messages
			conv.pushMessage({ role: 'user', content: 'hi' })
			expect(conv.messages).not.toBe(before)
		})
	})

	describe('tools', () => {
		it('starts with no tools', () => {
			const conv = makeConversation()
			expect(conv.availableTools).toHaveLength(0)
		})

		it('addTool registers a tool', () => {
			const conv = makeConversation()
			conv.addTool('greet', {
				description: 'Says hello',
				parameters: { type: 'object', properties: {} },
				handler: async () => 'hello',
			})
			expect(conv.availableTools).toContain('greet')
		})

		it('removeTool deregisters a tool', () => {
			const conv = makeConversation()
			conv.addTool('greet', {
				description: 'Says hello',
				parameters: { type: 'object', properties: {} },
				handler: async () => 'hello',
			})
			conv.removeTool('greet')
			expect(conv.availableTools).not.toContain('greet')
		})

		it('updateTools merges without replacing unrelated tools', () => {
			const conv = makeConversation()
			conv.addTool('a', { description: 'A', parameters: { type: 'object', properties: {} }, handler: async () => 'a' })
			conv.updateTools({ b: { description: 'B', parameters: { type: 'object', properties: {} }, handler: async () => 'b' } })
			expect(conv.availableTools).toContain('a')
			expect(conv.availableTools).toContain('b')
		})

		it('construction-time tools are available immediately', () => {
			const conv = makeConversation({
				tools: {
					ping: { description: 'Ping', parameters: { type: 'object', properties: {} }, handler: async () => 'pong' }
				}
			})
			expect(conv.availableTools).toContain('ping')
		})
	})

	describe('estimateTokens', () => {
		it('returns a near-zero baseline for empty messages', () => {
			const conv = makeConversation()
			expect(conv.estimateTokens()).toBeLessThan(10)
		})

		it('returns a positive number when messages exist', () => {
			const conv = makeConversation({
				history: [{ role: 'user', content: 'What is the capital of France?' }]
			})
			expect(conv.estimateTokens()).toBeGreaterThan(0)
		})

		it('increases as more messages are added', () => {
			const conv = makeConversation()
			conv.pushMessage({ role: 'user', content: 'Hello' })
			const first = conv.estimateTokens()
			conv.pushMessage({ role: 'assistant', content: 'Hi there, how can I help you today?' })
			const second = conv.estimateTokens()
			expect(second).toBeGreaterThan(first)
		})
	})

	describe('modelProviders transport routing', () => {
		// These tests exercise the legacy default-OpenAI routing with injected
		// transports. Pin the default provider so a developer machine with the
		// local llama-server stack installed doesn't flip blank conversations to
		// the (real!) local provider.
		let savedDefault: string | undefined
		beforeAll(() => {
			savedDefault = process.env.LUCA_DEFAULT_PROVIDER
			process.env.LUCA_DEFAULT_PROVIDER = 'openai'
		})
		afterAll(() => {
			if (savedDefault === undefined) delete process.env.LUCA_DEFAULT_PROVIDER
			else process.env.LUCA_DEFAULT_PROVIDER = savedDefault
		})

		function makeContainerAndConversation(opts: Record<string, any> = {}) {
			const container = new AGIContainer()
			const providers = container.feature('modelProviders')
			const conv = container.feature('conversation', { model: 'gpt-5', ...opts }) as Conversation
			return { container, providers, conv }
		}

		it('routes chat-mode asks through the openai-chat-completions transport', async () => {
			const { providers, conv } = makeContainerAndConversation({ api: 'chat' })
			const requests: any[] = []
			providers.registerTransport('openai-chat-completions', {
				apiMode: 'openai-chat-completions',
				async *stream(request: any) {
					requests.push(request)
					yield { type: 'chunk', text: 'hel' } as const
					yield { type: 'chunk', text: 'lo' } as const
					yield { type: 'response', response: { content: 'hello', toolCalls: [], usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 } } } as const
				},
			})

			const chunks: string[] = []
			conv.on('chunk', (delta: string) => chunks.push(delta))

			const answer = await conv.ask('Ping')

			expect(answer).toBe('hello')
			expect(chunks).toEqual(['hel', 'lo'])
			expect(requests[0].messages.at(-1)).toMatchObject({ role: 'user', content: 'Ping' })
			expect(conv.messages.at(-1)).toEqual({ role: 'assistant', content: 'hello' })
			expect(conv.state.get('tokenUsage')).toMatchObject({ prompt: 5, completion: 2, total: 7 })
		})

		it('routes a configured OpenAI-compatible provider through its own baseURL and default model', async () => {
			// Regression: a `provider:` pointing at a local OpenAI-compatible box
			// (registerLocal) must use that box's baseURL and default model — not
			// fall back to the container's default OpenAI client + 'gpt-5'.
			const container = new AGIContainer()
			const providers = container.feature('modelProviders')
			providers.registerLocal('mybox', 'http://mybox:9999/v1', 'mybox-model')

			let seen: any = null
			providers.registerTransport('openai-chat-completions', {
				apiMode: 'openai-chat-completions',
				async *stream(request: any, provider: any) {
					seen = { request, provider }
					yield { type: 'response', response: { content: 'ok', toolCalls: [] } } as const
				},
			})

			const conv = container.feature('conversation', { provider: 'mybox' }) as Conversation
			// No explicit model → the provider's default model wins, never 'gpt-5'.
			expect(conv.model).toBe('mybox-model')

			const answer = await conv.ask('Ping')

			expect(answer).toBe('ok')
			expect(conv.apiMode).toBe('chat')
			// The configured provider's connection is used, not the default OpenAI client.
			expect(seen.provider.baseURL).toBe('http://mybox:9999/v1')
			expect(seen.provider.auth).toBe('none')
			// The model sent to the transport is the provider default, not the fallback.
			expect(seen.request.model ?? seen.provider.model).toBe('mybox-model')
		})

		it('executes tool calls returned by the transport and loops to a final answer', async () => {
			const { providers, conv } = makeContainerAndConversation({ api: 'chat' })
			const requests: any[] = []
			providers.registerTransport('openai-chat-completions', {
				apiMode: 'openai-chat-completions',
				async *stream(request: any) {
					requests.push(request)
					if (requests.length === 1) {
						yield {
							type: 'response',
							response: { content: '', toolCalls: [{ id: 'call_1', name: 'lookup', arguments: { id: 42 }, rawArguments: '{"id":42}' }] },
						} as const
						return
					}
					yield { type: 'chunk', text: 'found it' } as const
					yield { type: 'response', response: { content: 'found it', toolCalls: [] } } as const
				},
			})

			const toolArgs: any[] = []
			conv.addTool('lookup', {
				description: 'Lookup a value',
				parameters: { type: 'object', properties: { id: { type: 'number' } } },
				handler: async (args: any) => { toolArgs.push(args); return { ok: true } },
			})

			const answer = await conv.ask('Use the tool')

			expect(answer).toBe('found it')
			expect(toolArgs).toEqual([{ id: 42 }])
			expect(requests.length).toBe(2)
			// The message history keeps the OpenAI tool_calls wire format
			const assistantWithTools = conv.messages.find(m => (m as any).tool_calls) as any
			expect(assistantWithTools.tool_calls).toEqual([
				{ id: 'call_1', type: 'function', function: { name: 'lookup', arguments: '{"id":42}' } },
			])
			expect(conv.messages.find(m => m.role === 'tool')).toMatchObject({ tool_call_id: 'call_1' })
		})

		it('routes responses-mode asks through the openai-responses transport', async () => {
			const { providers, conv } = makeContainerAndConversation()
			const requests: any[] = []
			providers.registerTransport('openai-responses', {
				apiMode: 'openai-responses',
				async *stream(request: any) {
					requests.push(request)
					yield { type: 'rawEvent', event: { type: 'response.output_text.delta', delta: 'hi there' } } as const
					yield { type: 'chunk', text: 'hi there' } as const
					const response = { id: 'resp_1', output: [], output_text: 'hi there', usage: { input_tokens: 3, output_tokens: 2, total_tokens: 5 } }
					yield { type: 'rawEvent', event: { type: 'response.completed', response } } as const
					yield { type: 'response', response: { content: 'hi there', toolCalls: [], usage: response.usage, providerData: { responseId: 'resp_1', response } } } as const
				},
			})

			const answer = await conv.ask('Hello')

			expect(answer).toBe('hi there')
			expect(conv.state.get('lastResponseId')).toBe('resp_1')
			expect(conv.messages.at(-1)).toEqual({ role: 'assistant', content: 'hi there' })
			expect(conv.state.get('tokenUsage')).toMatchObject({ prompt: 3, completion: 2, total: 5 })
			expect(requests[0].providerOptions.input).toBeDefined()
		})

		it('routes a non-OpenAI provider through the generic transport loop', async () => {
			const { providers, conv } = makeContainerAndConversation({ provider: 'generic-fake', model: undefined })
			const requests: any[] = []
			providers.registerProfile({ id: 'generic-fake', apiMode: 'generic-fake', auth: 'none', defaultModel: 'generic-model' })
			providers.registerTransport('generic-fake', {
				apiMode: 'generic-fake',
				async *stream(request: any) {
					requests.push(request)
					yield { type: 'chunk', text: 'gen ' } as const
					yield { type: 'chunk', text: 'answer' } as const
					yield { type: 'response', response: { content: 'gen answer', toolCalls: [], providerData: { sessionId: 'sess_1' } } } as const
				},
			})

			const answer = await conv.ask('Ping')

			expect(answer).toBe('gen answer')
			// No explicit model → provider default wins in the generic loop.
			expect(requests[0].model).toBe('generic-model')
			expect(conv.messages.at(-1)).toEqual({ role: 'assistant', content: 'gen answer' })
			// Continuation data is captured and threaded into the next ask.
			expect(conv.state.get('lastProviderData')).toEqual({ sessionId: 'sess_1' })
			await conv.ask('Again')
			expect(requests[1].providerOptions.previousProviderData).toEqual({ sessionId: 'sess_1' })
		})

		it('runs the generic loop tool cycle and preserves OpenAI wire format in history', async () => {
			const { providers, conv } = makeContainerAndConversation({ provider: 'generic-tools' })
			const requests: any[] = []
			providers.registerProfile({ id: 'generic-tools', apiMode: 'generic-tools', auth: 'none', defaultModel: 'gm' })
			providers.registerTransport('generic-tools', {
				apiMode: 'generic-tools',
				async *stream(request: any) {
					requests.push(request)
					if (requests.length === 1) {
						yield { type: 'toolCall', toolCall: { id: 'call_7', name: 'lookup', arguments: { id: 9 }, rawArguments: '{"id":9}' } } as const
						yield { type: 'response', response: { content: '', toolCalls: [{ id: 'call_7', name: 'lookup', arguments: { id: 9 }, rawArguments: '{"id":9}' }] } } as const
						return
					}
					yield { type: 'response', response: { content: 'done', toolCalls: [] } } as const
				},
			})

			const seen: any[] = []
			conv.addTool('lookup', {
				description: 'Lookup',
				parameters: { type: 'object', properties: { id: { type: 'number' } } },
				handler: async (args: any) => { seen.push(args); return { ok: true } },
			})

			const answer = await conv.ask('Use it')

			expect(answer).toBe('done')
			expect(seen).toEqual([{ id: 9 }])
			expect(requests.length).toBe(2)
			const assistantWithTools = conv.messages.find(m => (m as any).tool_calls) as any
			expect(assistantWithTools.tool_calls).toEqual([
				{ id: 'call_7', type: 'function', function: { name: 'lookup', arguments: '{"id":9}' } },
			])
			expect(conv.messages.find(m => m.role === 'tool')).toMatchObject({ tool_call_id: 'call_7' })
		})
	})

	describe('stub()', () => {
		it('exact string match returns the stub response', async () => {
			const conv = makeConversation()
			conv.stub('ping', 'pong')
			const result = await conv.ask('ping')
			expect(result).toBe('pong')
		})

		it('substring match triggers the stub', async () => {
			const conv = makeConversation()
			conv.stub('weather', 'Sunny and 72°F.')
			const result = await conv.ask('what is the weather today?')
			expect(result).toBe('Sunny and 72°F.')
		})

		it('regex match triggers the stub', async () => {
			const conv = makeConversation()
			conv.stub(/hello/i, 'Hey there!')
			const result = await conv.ask('HELLO')
			expect(result).toBe('Hey there!')
		})

		it('function response is called on each match', async () => {
			const conv = makeConversation()
			let callCount = 0
			conv.stub('count', () => `call ${++callCount}`)
			expect(await conv.ask('count')).toBe('call 1')
			expect(await conv.ask('count')).toBe('call 2')
		})

		it('first matching stub wins', async () => {
			const conv = makeConversation()
			conv.stub('hello', 'first')
			conv.stub('hello', 'second')
			expect(await conv.ask('hello')).toBe('first')
		})

		it('appends user and assistant messages to history', async () => {
			const conv = makeConversation()
			conv.stub('hi', 'hello back')
			await conv.ask('hi')
			expect(conv.messages).toHaveLength(2)
			expect(conv.messages[0]).toMatchObject({ role: 'user', content: 'hi' })
			expect(conv.messages[1]).toMatchObject({ role: 'assistant', content: 'hello back' })
		})

		it('isStreaming is false after the call resolves', async () => {
			const conv = makeConversation()
			conv.stub('test', 'response')
			await conv.ask('test')
			expect(conv.isStreaming).toBe(false)
		})

		it('emits chunk events for each word', async () => {
			const conv = makeConversation()
			conv.stub('go', 'one two three')
			const chunks: string[] = []
			conv.on('chunk', (delta: string) => chunks.push(delta))
			await conv.ask('go')
			expect(chunks.join('')).toBe('one two three')
		})

		it('emits preview events with accumulating text', async () => {
			const conv = makeConversation()
			conv.stub('go', 'alpha beta')
			const previews: string[] = []
			conv.on('preview', (text: string) => previews.push(text))
			await conv.ask('go')
			expect(previews.at(-1)).toBe('alpha beta')
			// Each preview should be longer than or equal to the previous
			for (let i = 1; i < previews.length; i++) {
				expect(previews[i]!.length).toBeGreaterThanOrEqual(previews[i - 1]!.length)
			}
		})

		it('emits turnStart and turnEnd events', async () => {
			const conv = makeConversation()
			conv.stub('x', 'y')
			const events: string[] = []
			conv.on('turnStart', () => events.push('turnStart'))
			conv.on('turnEnd', () => events.push('turnEnd'))
			await conv.ask('x')
			expect(events).toEqual(['turnStart', 'turnEnd'])
		})

		it('emits response event with the full text', async () => {
			const conv = makeConversation()
			conv.stub('question', 'the answer')
			let emitted = ''
			conv.on('response', (text: string) => { emitted = text })
			await conv.ask('question')
			expect(emitted).toBe('the answer')
		})

		it('stub is chainable', () => {
			const conv = makeConversation()
			const result = conv.stub('a', 'A').stub('b', 'B')
			expect(result).toBe(conv)
			expect(conv.availableTools).toHaveLength(0) // stubs don't affect tools
		})
	})
})

describe('Conversation default provider', () => {
	const ENV_KEYS = ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY', 'LUCA_DEFAULT_PROVIDER', 'LUCA_HOME', 'XDG_CACHE_HOME'] as const

	async function scrubbed(fn: () => Promise<void>) {
		const { mkdtempSync } = require('node:fs')
		const { tmpdir } = require('node:os')
		const { join } = require('node:path')
		const saved: Record<string, string | undefined> = {}
		for (const key of ENV_KEYS) { saved[key] = process.env[key]; delete process.env[key] }
		// Point local-install discovery at an empty temp dir so a developer's real
		// ~/.luca install doesn't make these tests machine-dependent.
		const tmp = mkdtempSync(join(tmpdir(), 'luca-conv-test-'))
		process.env.LUCA_HOME = join(tmp, 'luca-home')
		process.env.XDG_CACHE_HOME = join(tmp, 'cache')
		try {
			await fn()
		} finally {
			for (const key of ENV_KEYS) {
				if (saved[key] === undefined) delete process.env[key]
				else process.env[key] = saved[key]!
			}
		}
	}

	it('a blank conversation with no provider anywhere fails with setup guidance at ask()', async () => {
		await scrubbed(async () => {
			const conv = makeConversation()
			await expect(conv.ask('hello')).rejects.toThrow(/No model provider is available/)
		})
	})

	it('a blank conversation routes through the default custom provider', async () => {
		await scrubbed(async () => {
			const container = new AGIContainer()
			const providers = container.feature('modelProviders')
			providers.registerLocal('mybox', 'http://mybox:9999/v1', 'mybox-model')

			let seen: any = null
			providers.registerTransport('openai-chat-completions', {
				apiMode: 'openai-chat-completions',
				async *stream(request: any, provider: any) {
					seen = { request, provider }
					yield { type: 'response', response: { content: 'ok', toolCalls: [] } } as const
				},
			})

			// No provider, no model, no clientOptions — a truly blank conversation.
			const conv = container.feature('conversation') as Conversation
			const answer = await conv.ask('Ping')

			expect(answer).toBe('ok')
			expect(seen.provider.id).toBe('mybox')
			expect(seen.provider.baseURL).toBe('http://mybox:9999/v1')
			// The default provider's own model wins — never a gpt-* fallback.
			expect(seen.request.model ?? seen.provider.model).toBe('mybox-model')
		})
	})

	it('an explicit provider option still beats the default', async () => {
		await scrubbed(async () => {
			const container = new AGIContainer()
			const providers = container.feature('modelProviders')
			providers.registerLocal('default-box', 'http://default:1111/v1', 'default-model')
			providers.registerLocal('chosen-box', 'http://chosen:2222/v1', 'chosen-model')
			providers.setDefault('default-box')

			let seen: any = null
			providers.registerTransport('openai-chat-completions', {
				apiMode: 'openai-chat-completions',
				async *stream(request: any, provider: any) {
					seen = { request, provider }
					yield { type: 'response', response: { content: 'ok', toolCalls: [] } } as const
				},
			})

			const conv = container.feature('conversation', { provider: 'chosen-box' }) as Conversation
			await conv.ask('Ping')
			expect(seen.provider.id).toBe('chosen-box')
		})
	})
})
