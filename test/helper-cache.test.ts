import { describe, it, expect } from 'bun:test'
import { AGIContainer } from '../src/agi/container.server'

describe('helper instance cache', () => {
	describe('nested option content participates in the cache key', () => {
		it('conversations differing only in history[0].content are distinct instances', () => {
			const container = new AGIContainer()
			const c1 = container.feature('conversation', {
				model: 'gpt-4o',
				history: [{ role: 'system', content: 'prompt A' }],
			})
			const c2 = container.feature('conversation', {
				model: 'gpt-4o',
				history: [{ role: 'system', content: 'prompt B' }],
			})
			expect(c1).not.toBe(c2)
		})

		it('identical options still return the same cached instance', () => {
			const container = new AGIContainer()
			const opts = { model: 'gpt-4o', history: [{ role: 'system' as const, content: 'same' }] }
			const c1 = container.feature('conversation', { ...opts, history: [...opts.history] })
			const c2 = container.feature('conversation', { ...opts, history: [...opts.history] })
			expect(c1).toBe(c2)
		})
	})

	describe('cached: false', () => {
		it('always constructs a fresh instance', () => {
			const container = new AGIContainer()
			const opts = { model: 'gpt-4o', cached: false }
			const c1 = container.feature('conversation', { ...opts })
			const c2 = container.feature('conversation', { ...opts })
			expect(c1).not.toBe(c2)
		})

		it('does not read from or poison the cache for cached callers', () => {
			const container = new AGIContainer()
			const cachedBefore = container.feature('conversation', { model: 'gpt-4o' })
			const uncached = container.feature('conversation', { model: 'gpt-4o', cached: false })
			const cachedAfter = container.feature('conversation', { model: 'gpt-4o' })
			expect(uncached).not.toBe(cachedBefore)
			expect(cachedAfter).toBe(cachedBefore)
		})
	})

	describe('assistant conversations are never shared', () => {
		it('two assistants of the same kind own distinct conversations', () => {
			const container = new AGIContainer()
			const a1 = container.feature('assistant', { folder: 'assistants/codingAssistant', name: 'probe1' })
			const a2 = container.feature('assistant', { folder: 'assistants/codingAssistant', name: 'probe2' })
			expect(a1).not.toBe(a2)
			expect(a1.conversation).not.toBe(a2.conversation)
			expect(a1.conversation.uuid).not.toBe(a2.conversation.uuid)
		})

		it('mutating one assistant conversation does not leak into the other', () => {
			const container = new AGIContainer()
			const a1 = container.feature('assistant', { folder: 'assistants/codingAssistant', name: 'leak1' })
			const a2 = container.feature('assistant', { folder: 'assistants/codingAssistant', name: 'leak2' })
			a1.conversation.pushMessage({ role: 'user', content: 'secret from session 1' })
			const leaked = a2.conversation.messages.some(
				(m: any) => typeof m.content === 'string' && m.content.includes('secret from session 1')
			)
			expect(leaked).toBe(false)
		})
	})

	describe('conversation forks are never shared', () => {
		it('two forks of the same conversation are distinct instances', () => {
			const container = new AGIContainer()
			const parent = container.feature('conversation', {
				model: 'gpt-4o',
				history: [{ role: 'system', content: 'fork parent' }],
			})
			const f1 = parent.fork()
			const f2 = parent.fork()
			expect(f1).not.toBe(parent)
			expect(f1).not.toBe(f2)
		})
	})
})
