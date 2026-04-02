import { describe, it, expect, beforeEach } from 'bun:test'
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
