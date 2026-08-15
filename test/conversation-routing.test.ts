import { describe, it, expect } from 'bun:test'
import { AGIContainer } from '../src/agi/container.server'
import type { Conversation } from '../src/agi/features/conversation'

function makeContainer() {
	const container = new AGIContainer()
	const mp = container.feature('modelProviders')
	mp.registerLocal('box-a', 'http://localhost:9911/v1', 'model-a')
	mp.registerLocal('box-b', 'http://localhost:9922/v1', 'model-b')
	return container
}

function makeConversation(opts: Record<string, any> = {}): Conversation {
	return makeContainer().feature('conversation', { cached: false, model: 'gpt-5', api: 'chat', ...opts }) as Conversation
}

describe('Conversation routing', () => {
	it('reports the current routing', () => {
		const conv = makeConversation({ provider: 'box-a', model: 'model-a' })
		expect(conv.routing).toMatchObject({ provider: 'box-a', model: 'model-a', apiMode: 'chat', transport: 'openai' })
	})

	describe('setModel', () => {
		it('changes the model used by subsequent turns', () => {
			const conv = makeConversation({ model: 'gpt-5' })
			conv.setModel('gpt-4.1')
			expect(conv.model).toBe('gpt-4.1')
			expect(conv.routing.model).toBe('gpt-4.1')
		})

		it('keeps message history', () => {
			const conv = makeConversation()
			conv.pushMessage({ role: 'user', content: 'hello' })
			conv.setModel('gpt-4.1')
			expect(conv.messages).toHaveLength(1)
		})

		it('resyncs the context window', () => {
			const conv = makeConversation({ model: 'gpt-4.1' })
			const before = conv.contextWindow
			conv.setModel('gpt-3.5-turbo')
			expect(conv.contextWindow).not.toBe(before)
			expect(conv.state.get('contextWindow')).toBe(conv.contextWindow)
		})

		it('drops the Responses continuation handle', () => {
			const conv = makeConversation()
			conv.state.set('lastResponseId', 'resp_123')
			conv.setModel('gpt-4.1')
			expect(conv.state.get('lastResponseId')).toBeNull()
		})

		it('rejects an empty model name', () => {
			const conv = makeConversation()
			expect(() => conv.setModel('')).toThrow(/requires a model name/)
		})

		it('emits routingChanged', () => {
			const conv = makeConversation({ model: 'gpt-5' })
			const events: any[] = []
			conv.on('routingChanged', (change: any) => events.push(change))
			conv.setModel('gpt-4.1')
			expect(events).toHaveLength(1)
			expect(events[0].previous.model).toBe('gpt-5')
			expect(events[0].current.model).toBe('gpt-4.1')
		})
	})

	describe('setProvider', () => {
		it('switches provider and adopts the new provider default model', () => {
			const conv = makeConversation({ provider: 'box-a', model: 'model-a' })
			conv.setProvider('box-b')
			expect(conv.routing).toMatchObject({ provider: 'box-b', model: 'model-b' })
		})

		it('honors an explicit model over the provider default', () => {
			const conv = makeConversation({ provider: 'box-a' })
			conv.setProvider('box-b', { model: 'custom-model' })
			expect(conv.routing).toMatchObject({ provider: 'box-b', model: 'custom-model' })
		})

		it('switches to the generic transport loop for non-OpenAI backends', () => {
			const conv = makeConversation({ provider: 'box-a' })
			expect(conv.routing.transport).toBe('openai')
			conv.setProvider('claude-code')
			expect(conv.routing.transport).toBe('generic')
		})

		it('clears provider continuation data', () => {
			const conv = makeConversation({ provider: 'box-a' })
			conv.state.set('lastProviderData', { sessionId: 'abc' })
			conv.setProvider('box-b')
			expect(conv.state.get('lastProviderData')).toBeUndefined()
		})

		it('keeps message history and tools', () => {
			const conv = makeConversation({ provider: 'box-a' })
			conv.pushMessage({ role: 'user', content: 'hello' })
			conv.addTool('ping', { description: 'ping', parameters: { type: 'object', properties: {} }, handler: async () => 'pong' } as any)
			conv.setProvider('box-b')
			expect(conv.messages).toHaveLength(1)
			expect(conv.availableTools).toContain('ping')
		})

		it('throws on an unregistered provider and leaves routing intact', () => {
			const conv = makeConversation({ provider: 'box-a', model: 'model-a' })
			expect(() => conv.setProvider('nope')).toThrow(/Unknown model provider/)
			expect(conv.routing).toMatchObject({ provider: 'box-a', model: 'model-a' })
		})

		it('falls back to the container default when passed null', () => {
			const conv = makeConversation({ provider: 'box-a' })
			conv.setProvider(null)
			expect(conv.routing.provider).not.toBe('box-a')
		})
	})
})

describe('Assistant routing', () => {
	function makeAssistant(opts: Record<string, any> = {}) {
		const container = makeContainer()
		return container.feature('assistant', { cached: false, name: 'router-test', systemPrompt: 'You are helpful.', ...opts }) as any
	}

	it('delegates setModel to the conversation', () => {
		const assistant = makeAssistant({ model: 'gpt-5' })
		assistant.conversation // force creation
		assistant.setModel('gpt-4.1')
		expect(assistant.routing.model).toBe('gpt-4.1')
		expect(assistant.conversation.model).toBe('gpt-4.1')
	})

	it('delegates setProvider to the conversation', () => {
		const assistant = makeAssistant({ provider: 'box-a' })
		assistant.conversation
		assistant.setProvider('box-b')
		expect(assistant.routing).toMatchObject({ provider: 'box-b', model: 'model-b' })
	})

	it('applies routing set before the conversation exists', () => {
		const assistant = makeAssistant({ provider: 'box-a' })
		assistant.setProvider('box-b')
		expect(assistant.routing).toMatchObject({ provider: 'box-b', model: 'model-b' })
	})

	it('validates the provider id even with no conversation yet', () => {
		const assistant = makeAssistant({ provider: 'box-a' })
		expect(() => assistant.setProvider('nope')).toThrow(/Unknown model provider/)
		expect(assistant.routing.provider).toBe('box-a')
	})
})
