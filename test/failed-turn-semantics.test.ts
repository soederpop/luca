import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { AGIContainer } from '../src/agi/container.server'
import { ToolLoopLimitError, type Conversation, type FailedTurnRecord } from '../src/agi/features/conversation'
import type { Assistant } from '../src/agi/features/assistant'

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

describe('Failed-turn and retry semantics', () => {
	let savedDefaultProvider: string | undefined
	beforeAll(() => {
		savedDefaultProvider = process.env.LUCA_DEFAULT_PROVIDER
		process.env.LUCA_DEFAULT_PROVIDER = 'openai'
	})
	afterAll(() => {
		if (savedDefaultProvider === undefined) delete process.env.LUCA_DEFAULT_PROVIDER
		else process.env.LUCA_DEFAULT_PROVIDER = savedDefaultProvider
	})

	it('records a retryable failed turn, keeps the input, and drops partial output', async () => {
		const { providers, conversation } = nativeConversation({
			history: [{ role: 'system', content: 'probe' }],
			tools: { probe: { description: 'probe', parameters: {}, handler: async () => 'probe result' } },
		})
		let calls = 0
		providers.registerTransport('openai-chat-completions', {
			apiMode: 'openai-chat-completions',
			async *stream() {
				calls++
				if (calls === 1) {
					// First turn wants a tool: this pushes partial output (an assistant
					// tool_calls message plus a tool result) before the failure.
					yield { type: 'response', response: { content: '', toolCalls: [{ id: 'call_1', name: 'probe', rawArguments: '{}' }] } } as const
					return
				}
				const error: any = new Error('provider melted down')
				error.status = 500
				throw error
			},
		})

		const events: FailedTurnRecord[] = []
		conversation.on('turnFailed', (record: FailedTurnRecord) => { events.push(record) })
		const versionBefore = conversation.state.get('messagesVersion')!

		await expect(conversation.ask('do the thing')).rejects.toThrow('provider melted down')

		// The input survives as the last message; the partial tool traffic is gone.
		expect(conversation.messages).toEqual([
			{ role: 'system', content: 'probe' },
			{ role: 'user', content: 'do the thing' },
		])
		expect(conversation.state.get('messagesVersion')).toBeGreaterThan(versionBefore)

		const failed = conversation.state.get('failedTurn') as FailedTurnRecord
		expect(failed).toMatchObject({
			userMessageIndex: 1,
			retryable: true,
			error: { name: 'Error', message: 'provider melted down', status: 500 },
		})
		expect(failed.id).toStartWith('ft_')
		expect(events).toEqual([failed])
	})

	it('retries the surviving input without duplicating it and clears the record', async () => {
		const { providers, conversation } = nativeConversation({ history: [{ role: 'system', content: 'probe' }] })
		let failNext = true
		const requests: any[] = []
		providers.registerTransport('openai-chat-completions', {
			apiMode: 'openai-chat-completions',
			async *stream(request: any) {
				requests.push(request)
				if (failNext) { failNext = false; throw new Error('flaky') }
				yield { type: 'response', response: { content: 'recovered answer', toolCalls: [] } } as const
			},
		})

		await expect(conversation.ask('please answer')).rejects.toThrow('flaky')
		const failed = conversation.state.get('failedTurn') as FailedTurnRecord

		const answer = await conversation.retryFailedTurn({ expectId: failed.id })

		expect(answer).toBe('recovered answer')
		expect(conversation.state.get('failedTurn')).toBeNull()
		expect(conversation.messages).toEqual([
			{ role: 'system', content: 'probe' },
			{ role: 'user', content: 'please answer' },
			{ role: 'assistant', content: 'recovered answer' },
		])
		// Both attempts sent the same single user message — no duplicate input.
		const userCounts = requests.map(request =>
			request.messages.filter((message: any) => message.role === 'user').length)
		expect(userCounts).toEqual([1, 1])
	})

	it('refuses a retry with no failure, a stale id, or a conversation that moved on', async () => {
		const { providers, conversation } = nativeConversation()
		providers.registerTransport('openai-chat-completions', {
			apiMode: 'openai-chat-completions',
			async *stream() {
				yield { type: 'response', response: { content: 'fine', toolCalls: [] } } as const
			},
		})

		await expect(conversation.retryFailedTurn()).rejects.toThrow('no failed turn')

		// Manufacture a failure, then move past it with a successful turn.
		const original = conversation.state.get('failedTurn')
		conversation.state.set('failedTurn', {
			id: 'ft_stale', userMessageIndex: 0, retryable: true,
			error: { name: 'Error', message: 'old' }, at: new Date().toISOString(),
		})
		await expect(conversation.retryFailedTurn({ expectId: 'ft_other' })).rejects.toThrow('expected failed turn')
		conversation.state.set('failedTurn', original ?? null)

		await conversation.ask('works now')
		expect(conversation.state.get('failedTurn')).toBeNull()
	})

	it('a new ask() supersedes the failed turn', async () => {
		const { providers, conversation } = nativeConversation()
		let fail = true
		providers.registerTransport('openai-chat-completions', {
			apiMode: 'openai-chat-completions',
			async *stream() {
				if (fail) { fail = false; throw new Error('once') }
				yield { type: 'response', response: { content: 'ok', toolCalls: [] } } as const
			},
		})

		await expect(conversation.ask('first')).rejects.toThrow('once')
		expect(conversation.state.get('failedTurn')).not.toBeNull()

		await conversation.ask('second')
		expect(conversation.state.get('failedTurn')).toBeNull()
	})

	it('an abort is not a failed turn', async () => {
		const { providers, conversation } = nativeConversation()
		providers.registerTransport('openai-chat-completions', {
			apiMode: 'openai-chat-completions',
			async *stream() {
				await new Promise(() => {})
			},
		})

		const pending = conversation.ask('block forever')
		await new Promise(resolve => setTimeout(resolve, 20))
		conversation.abort()
		await expect(pending).rejects.toMatchObject({ name: 'ConversationAbortError' })
		expect(conversation.state.get('failedTurn')).toBeNull()
	})

	it('keeps a pre-turn continuation for the retry but drops one minted mid-turn', async () => {
		const { providers, conversation } = nativeConversation({
			api: 'responses',
			tools: { probe: { description: 'probe', parameters: {}, handler: async () => 'probe result' } },
		})
		const requests: any[] = []
		let mode: 'ok' | 'fail-early' | 'fail-after-tool-turn' = 'ok'
		let counter = 0
		providers.registerTransport('openai-responses', {
			apiMode: 'openai-responses',
			async *stream(request: any) {
				requests.push(request)
				if (mode === 'fail-early') throw new Error('down before any response')
				const id = `resp_${++counter}`
				const wantsTool = mode === 'fail-after-tool-turn' && !request.providerOptions.input?.some?.((item: any) => item.type === 'function_call_output')
				if (wantsTool) {
					const response = {
						id,
						output: [{ type: 'function_call', call_id: 'call_1', name: 'probe', arguments: '{}' }],
						output_text: '',
					}
					yield { type: 'response', response: { content: '', toolCalls: [], providerData: { responseId: id, response } } } as const
					return
				}
				if (mode === 'fail-after-tool-turn') throw new Error('down after tool turn')
				const response = { id, output: [], output_text: id }
				yield { type: 'response', response: { content: id, toolCalls: [], providerData: { responseId: id, response } } } as const
			},
		})

		// Mint a valid pre-turn continuation.
		await conversation.ask('first')
		expect(conversation.state.get('lastResponseId')).toBe('resp_1')

		// Failure before any response: the pre-turn handle survives, and the
		// retry chains from it instead of replaying the whole transcript.
		mode = 'fail-early'
		await expect(conversation.ask('second')).rejects.toThrow('down before any response')
		expect(conversation.state.get('lastResponseId')).toBe('resp_1')

		mode = 'ok'
		await conversation.retryFailedTurn()
		expect(requests.at(-1)!.providerOptions.previousResponseId).toBe('resp_1')

		// Failure after a tool turn minted resp_N: that handle describes rolled
		// back partial output, so every handle drops.
		mode = 'fail-after-tool-turn'
		await expect(conversation.ask('third')).rejects.toThrow('down after tool turn')
		expect(conversation.state.get('lastResponseId')).toBeNull()
		expect(conversation.state.get('lastResponseMessageCount')).toBeNull()
		// Partial output rolled back: the last message is the failed input.
		expect(conversation.messages.at(-1)).toMatchObject({ role: 'user', content: 'third' })
	})
})

describe('Native tool-loop ceiling', () => {
	let savedDefaultProvider: string | undefined
	beforeAll(() => {
		savedDefaultProvider = process.env.LUCA_DEFAULT_PROVIDER
		process.env.LUCA_DEFAULT_PROVIDER = 'openai'
	})
	afterAll(() => {
		if (savedDefaultProvider === undefined) delete process.env.LUCA_DEFAULT_PROVIDER
		else process.env.LUCA_DEFAULT_PROVIDER = savedDefaultProvider
	})

	function recursiveToolTransport(providers: any, answersAfter: number) {
		let calls = 0
		providers.registerTransport('openai-chat-completions', {
			apiMode: 'openai-chat-completions',
			async *stream() {
				calls++
				if (calls <= answersAfter) {
					yield { type: 'response', response: { content: '', toolCalls: [{ id: `call_${calls}`, name: 'again', rawArguments: '{}' }] } } as const
					return
				}
				yield { type: 'response', response: { content: 'finally done', toolCalls: [] } } as const
			},
		})
		return () => calls
	}

	const againTool = { again: { description: 'ask for another turn', parameters: {}, handler: async () => 'go again' } }

	it('defaults to 75 and stops a runaway loop with ToolLoopLimitError as a failed turn', async () => {
		const { providers, conversation } = nativeConversation({
			maxToolTurns: 3,
			tools: againTool,
			history: [{ role: 'system', content: 'probe' }],
		})
		expect(nativeConversation().conversation.maxToolTurns).toBe(75)
		const callsMade = recursiveToolTransport(providers, Number.POSITIVE_INFINITY)

		const pending = conversation.ask('recurse forever')
		await expect(pending).rejects.toBeInstanceOf(ToolLoopLimitError)
		await expect(pending).rejects.toMatchObject({ name: 'ToolLoopLimitError', limit: 3 })

		// The ceiling stopped it after exactly maxToolTurns provider calls, the
		// partial tool traffic is rolled back, and the failure is retryable.
		expect(callsMade()).toBe(3)
		expect(conversation.messages).toEqual([
			{ role: 'system', content: 'probe' },
			{ role: 'user', content: 'recurse forever' },
		])
		expect(conversation.state.get('failedTurn')).toMatchObject({
			retryable: true,
			error: { name: 'ToolLoopLimitError' },
		})
	})

	it('the override permits deeper recursion than the tightened default', async () => {
		const tight = nativeConversation({ maxToolTurns: 3, tools: againTool })
		recursiveToolTransport(tight.providers, 5)
		await expect(tight.conversation.ask('needs six turns')).rejects.toBeInstanceOf(ToolLoopLimitError)

		const roomy = nativeConversation({ maxToolTurns: 10, tools: againTool })
		recursiveToolTransport(roomy.providers, 5)
		await expect(roomy.conversation.ask('needs six turns')).resolves.toBe('finally done')
	})

	it('caps the Responses loop the same way', async () => {
		const { providers, conversation } = nativeConversation({
			api: 'responses',
			maxToolTurns: 2,
			tools: againTool,
		})
		let counter = 0
		providers.registerTransport('openai-responses', {
			apiMode: 'openai-responses',
			async *stream() {
				const id = `resp_${++counter}`
				const response = {
					id,
					output: [{ type: 'function_call', call_id: `call_${counter}`, name: 'again', arguments: '{}' }],
					output_text: '',
				}
				yield { type: 'response', response: { content: '', toolCalls: [], providerData: { responseId: id, response } } } as const
			},
		})

		await expect(conversation.ask('recurse forever')).rejects.toMatchObject({ name: 'ToolLoopLimitError', limit: 2 })
		expect(counter).toBe(2)
		expect(conversation.messages.at(-1)).toMatchObject({ role: 'user', content: 'recurse forever' })
	})
})

describe('Failed-turn persistence and resume', () => {
	it('a failed final turn survives save() and resume, and clears once retried', async () => {
		const container = new AGIContainer()
		const assistant = container.feature('assistant', {
			cached: false,
			name: 'failed-resume-test',
			systemPrompt: 'probe',
			historyMode: 'session',
		}) as Assistant
		assistant.resumeThread('failed:thread')

		const failedTurn: FailedTurnRecord = {
			id: 'ft_persisted', userMessageIndex: 1, retryable: true,
			error: { name: 'Error', message: 'provider melted down' },
			at: '2026-01-01T00:00:00.000Z',
		}
		const record = {
			id: 'failed-conversation', title: 'Saved', model: 'gpt-5', tags: [], thread: 'failed:thread',
			createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:01.000Z', messageCount: 2,
			messages: [{ role: 'system', content: 'probe' }, { role: 'user', content: 'the failed input' }],
			tokenUsage: { prompt: 1, completion: 0, total: 1, cachedTokens: 0, reasoningTokens: 0 },
			cost: { inputCost: 0, outputCost: 0, totalCost: 0 },
			metadata: { failedTurn },
		}
		;(assistant.conversationHistory as any).findByThread = async () => record
		await assistant.start()

		expect(assistant.failedTurn).toEqual(failedTurn)

		// save() round-trips the record while the failure stands, and removes it
		// once the failure clears.
		const saved: any[] = []
		;(assistant.conversationHistory as any).save = async (updated: any) => { saved.push(structuredClone(updated)) }
		await assistant.save()
		expect(saved[0].metadata.failedTurn).toEqual(failedTurn)

		assistant.conversation.state.set('failedTurn', null)
		await assistant.save()
		expect(saved[1].metadata.failedTurn).toBeUndefined()
	})

	it('does not resurrect a failure that no longer points at the final user message', async () => {
		const container = new AGIContainer()
		const assistant = container.feature('assistant', {
			cached: false,
			name: 'stale-failed-resume-test',
			systemPrompt: 'probe',
			historyMode: 'session',
		}) as Assistant
		assistant.resumeThread('stale-failed:thread')
		const record = {
			id: 'stale-failed', title: 'Saved', model: 'gpt-5', tags: [], thread: 'stale-failed:thread',
			createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:01.000Z', messageCount: 3,
			messages: [
				{ role: 'system', content: 'probe' },
				{ role: 'user', content: 'input' },
				{ role: 'assistant', content: 'it answered after all' },
			],
			tokenUsage: { prompt: 1, completion: 1, total: 2, cachedTokens: 0, reasoningTokens: 0 },
			cost: { inputCost: 0, outputCost: 0, totalCost: 0 },
			metadata: {
				failedTurn: {
					id: 'ft_stale', userMessageIndex: 1, retryable: true,
					error: { name: 'Error', message: 'old failure' }, at: '2026-01-01T00:00:00.000Z',
				},
			},
		}
		;(assistant.conversationHistory as any).findByThread = async () => record
		await assistant.start()

		expect(assistant.failedTurn).toBeNull()
	})
})
