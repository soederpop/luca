import { describe, it, expect } from 'bun:test'
import { AGIContainer } from '../src/agi/container.server'
import type { Conversation } from '../src/agi/features/conversation'

function make() {
	const container = new AGIContainer()
	const providers = container.feature('modelProviders')
	const conv = container.feature('conversation', { model: 'gpt-5', api: 'chat' }) as Conversation
	return { providers, conv }
}

/**
 * Transport that calls `lookup` on its first request, then answers. The
 * `onToolTurn` hook fires while the tool batch is running so a test can steer
 * mid-turn. `requests` records every request the model saw.
 */
function installTransport(providers: any, opts: { toolTurns?: number } = {}) {
	const requests: any[] = []
	const toolTurns = opts.toolTurns ?? 1
	providers.registerTransport('openai-chat-completions', {
		apiMode: 'openai-chat-completions',
		async *stream(request: any) {
			requests.push(request)
			if (requests.length <= toolTurns) {
				yield {
					type: 'response',
					response: { content: '', toolCalls: [{ id: `call_${requests.length}`, name: 'lookup', arguments: {}, rawArguments: '{}' }] },
				} as const
				return
			}
			yield { type: 'response', response: { content: `answer ${requests.length}`, toolCalls: [] } } as const
		},
	})
	return requests
}

const lastUserText = (request: any) => {
	const users = request.messages.filter((m: any) => m.role === 'user')
	const last = users[users.length - 1]
	return typeof last.content === 'string' ? last.content : last.content.map((p: any) => p.text).join('')
}

describe('steer()', () => {
	it('returns false and does nothing when no turn is active', () => {
		const { conv } = make()
		expect(conv.isTurnActive).toBe(false)
		expect(conv.steer('hello')).toBe(false)
		expect(conv.pendingSteers.length).toBe(0)
	})

	it('injects a steer as a user message between the tool batch and the next model call', async () => {
		const { providers, conv } = make()
		const requests = installTransport(providers)
		let steeredEvents: any[] = []
		conv.on('steered', (c: any) => steeredEvents.push(c))

		conv.addTool('lookup', {
			description: 'lookup',
			parameters: { type: 'object', properties: {} },
			handler: async () => {
				expect(conv.steer('actually, keep it short')).toBe(true)
				return 'found'
			},
		})

		const answer = await conv.ask('research this')
		expect(answer).toBe('answer 2')
		expect(requests.length).toBe(2)
		// The second model call saw the steer as the most recent user message.
		expect(lastUserText(requests[1])).toBe('actually, keep it short')
		expect(steeredEvents).toEqual(['actually, keep it short'])
		// History: user, assistant(tool call), tool, user(steer), assistant.
		const roles = conv.messages.filter((m: any) => m.role !== 'system').map((m: any) => m.role)
		expect(roles).toEqual(['user', 'assistant', 'tool', 'user', 'assistant'])
		expect(conv.pendingSteers.length).toBe(0)
	})

	it('runs a late steer as a follow-up turn inside the same ask()', async () => {
		const { providers, conv } = make()
		const requests = installTransport(providers, { toolTurns: 0 })
		// Steer while the final response is streaming: no tool gap remains.
		let steeredOnce = false
		conv.on('turnStart', () => {
			if (steeredOnce) return
			steeredOnce = true
			conv.steer('one more thing')
		})

		const answer = await conv.ask('hi')
		expect(answer).toBe('answer 2')
		expect(requests.length).toBe(2)
		expect(lastUserText(requests[1])).toBe('one more thing')
	})

	it('drops undelivered steers when the turn aborts', async () => {
		const { providers, conv } = make()
		providers.registerTransport('openai-chat-completions', {
			apiMode: 'openai-chat-completions',
			async *stream() {
				conv.steer('too late')
				conv.abort()
				yield { type: 'response', response: { content: 'x', toolCalls: [] } } as const
			},
		})
		await expect(conv.ask('hi')).rejects.toMatchObject({ name: 'ConversationAbortError' })
		expect(conv.pendingSteers.length).toBe(0)
	})
})

describe('queueDepth', () => {
	it('counts asks waiting behind the active turn and drains in order', async () => {
		const { providers, conv } = make()
		let release!: () => void
		const gate = new Promise<void>((r) => { release = r })
		const seen: string[] = []
		providers.registerTransport('openai-chat-completions', {
			apiMode: 'openai-chat-completions',
			async *stream(request: any) {
				seen.push(lastUserText(request))
				if (seen.length === 1) await gate
				yield { type: 'response', response: { content: `r${seen.length}`, toolCalls: [] } } as const
			},
		})
		const first = conv.ask('first')
		await new Promise((r) => setTimeout(r, 5))
		const second = conv.ask('second')
		const third = conv.ask('third')
		await new Promise((r) => setTimeout(r, 5))
		expect(conv.isTurnActive).toBe(true)
		expect(conv.queueDepth).toBe(2)
		release()
		expect(await first).toBe('r1')
		expect(await second).toBe('r2')
		expect(await third).toBe('r3')
		expect(conv.queueDepth).toBe(0)
		expect(seen).toEqual(['first', 'second', 'third'])
	})
})
