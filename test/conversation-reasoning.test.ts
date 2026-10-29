import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { AGIContainer } from '../src/agi/container.server'
import type { Conversation } from '../src/agi/features/conversation'

/**
 * A scripted chat transport: every ask runs one tool round and then answers,
 * streaming reasoning before each step, the way DeepSeek does.
 */
function scriptedConversation(options: Record<string, any> = {}) {
	const container = new AGIContainer()
	const providers = container.feature('modelProviders')
	const requests: any[] = []
	providers.registerTransport('openai-chat-completions', {
		apiMode: 'openai-chat-completions',
		async *stream(request: any) {
			requests.push(request)
			const n = requests.length
			const afterTool = request.messages.at(-1)?.role === 'tool'
			yield { type: 'reasoning', text: `thought ${n}` } as const
			if (afterTool) {
				yield { type: 'chunk', text: `answer ${n}` } as const
				yield { type: 'response', response: { content: `answer ${n}`, toolCalls: [] } } as const
			} else {
				yield { type: 'response', response: { content: '', toolCalls: [{ id: `call_${n}`, name: 'lookup', rawArguments: '{}' }] } } as const
			}
		},
	})
	const conversation = container.feature('conversation', {
		cached: false,
		model: 'gpt-5',
		api: 'chat',
		tools: {
			lookup: { description: 'look something up', parameters: { type: 'object', properties: {} }, handler: async () => 'found' },
		},
		...options,
	}) as Conversation
	return { conversation, requests }
}

const sentKeys = (requests: any[]) => requests.flatMap((r) => r.messages.flatMap((m: any) => Object.keys(m)))

describe('Conversation reasoning', () => {
	let savedDefaultProvider: string | undefined
	beforeAll(() => {
		savedDefaultProvider = process.env.LUCA_DEFAULT_PROVIDER
		process.env.LUCA_DEFAULT_PROVIDER = 'openai'
	})
	afterAll(() => {
		if (savedDefaultProvider === undefined) delete process.env.LUCA_DEFAULT_PROVIDER
		else process.env.LUCA_DEFAULT_PROVIDER = savedDefaultProvider
	})

	it('records reasoning on assistant messages and never sends it by default', async () => {
		const { conversation, requests } = scriptedConversation()
		await conversation.ask('one')
		await conversation.ask('two')

		const assistants = conversation.messages.filter((m) => m.role === 'assistant') as any[]
		expect(assistants.map((m) => m.reasoning)).toEqual(['thought 1', 'thought 2', 'thought 3', 'thought 4'])
		expect(sentKeys(requests)).not.toContain('reasoning')
		expect(sentKeys(requests)).not.toContain('reasoning_content')
	})

	it('replays reasoning only on tool-call messages of the turn in progress', async () => {
		const { conversation, requests } = scriptedConversation({ replayReasoning: true })
		await conversation.ask('one')
		await conversation.ask('two')

		// request 2 is turn one's follow-up after its tool call
		const followUp = requests[1].messages.find((m: any) => m.tool_calls)
		expect(followUp.reasoning_content).toBe('thought 1')

		// request 4 is turn two's follow-up: only turn two's tool call carries reasoning
		const replayed = requests[3].messages.filter((m: any) => m.tool_calls).map((m: any) => m.reasoning_content)
		expect(replayed).toEqual([undefined, 'thought 3'])
		expect(sentKeys(requests)).not.toContain('reasoning')
	})

	it('records nothing when recordReasoning is false', async () => {
		const { conversation } = scriptedConversation({ recordReasoning: false })
		await conversation.ask('one')
		expect(conversation.messages.some((m: any) => 'reasoning' in m)).toBe(false)
	})
})
