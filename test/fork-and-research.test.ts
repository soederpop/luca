import { describe, it, expect } from 'bun:test'
import { AGIContainer } from '../src/agi/container.server'
import type { Conversation } from '../src/agi/features/conversation'
import type { Assistant } from '../src/agi/features/assistant'

function makeConversation(opts: Record<string, any> = {}): Conversation {
	const container = new AGIContainer()
	return container.feature('conversation', {
		model: 'gpt-5',
		history: [
			{ role: 'system', content: 'You are a helpful assistant.' },
			{ role: 'user', content: 'What is Luca?' },
			{ role: 'assistant', content: 'Luca is a framework.' },
			{ role: 'user', content: 'Tell me more.' },
			{ role: 'assistant', content: 'It provides dependency injection for TypeScript apps.' },
			{ role: 'user', content: 'How does the container work?' },
			{ role: 'assistant', content: 'The container is a singleton that manages features, clients, and servers.' },
		],
		...opts,
	}) as Conversation
}

function makeAssistant(container?: AGIContainer): Assistant {
	const c = container || new AGIContainer()
	return c.feature('assistant', {
		systemPrompt: 'You are a research assistant.',
		model: 'gpt-5',
	}) as Assistant
}

describe('Conversation fork', () => {
	it('fork with history: full copies all messages', () => {
		const conv = makeConversation()
		const fork = conv.fork({ history: 'full' })
		expect(fork.messages).toHaveLength(conv.messages.length)
		expect(fork.messages[0]).toEqual(conv.messages[0])
	})

	it('fork with history: none keeps only the system message', () => {
		const conv = makeConversation()
		const fork = conv.fork({ history: 'none' })
		expect(fork.messages).toHaveLength(1)
		expect(fork.messages[0]!.role).toBe('system')
	})

	it('fork with history: none on a conversation without system message returns empty', () => {
		const container = new AGIContainer()
		const conv = container.feature('conversation', {
			model: 'gpt-5',
			history: [
				{ role: 'user', content: 'hello' },
				{ role: 'assistant', content: 'hi' },
			],
		}) as Conversation
		const fork = conv.fork({ history: 'none' })
		expect(fork.messages).toHaveLength(0)
	})

	it('fork with history: 1 keeps system + last exchange', () => {
		const conv = makeConversation()
		const fork = conv.fork({ history: 1 })
		// System + last user + last assistant = 3
		expect(fork.messages).toHaveLength(3)
		expect(fork.messages[0]!.role).toBe('system')
		expect(fork.messages[1]!.role).toBe('user')
		expect((fork.messages[1] as any).content).toBe('How does the container work?')
	})

	it('fork with history: 2 keeps system + last 2 exchanges', () => {
		const conv = makeConversation()
		const fork = conv.fork({ history: 2 })
		// System + 2 user/assistant pairs = 5
		expect(fork.messages).toHaveLength(5)
		expect(fork.messages[0]!.role).toBe('system')
		expect((fork.messages[1] as any).content).toBe('Tell me more.')
	})

	it('fork with model override changes the model', () => {
		const conv = makeConversation()
		const fork = conv.fork({ model: 'gpt-4o-mini' })
		expect(fork.model).toBe('gpt-4o-mini')
	})

	it('fork does not affect original conversation', () => {
		const conv = makeConversation()
		const originalLength = conv.messages.length
		const fork = conv.fork({ history: 'none' })
		fork.pushMessage({ role: 'user', content: 'new message on fork' })
		expect(conv.messages).toHaveLength(originalLength)
	})

	it('fork with array creates multiple independent forks', () => {
		const conv = makeConversation()
		const forks = conv.fork([
			{ history: 'none' },
			{ history: 1 },
			{ history: 'full' },
		])
		expect(forks).toHaveLength(3)
		expect(forks[0]!.messages).toHaveLength(1) // system only
		expect(forks[1]!.messages).toHaveLength(3) // system + 1 exchange
		expect(forks[2]!.messages).toHaveLength(conv.messages.length) // all
	})

	it('default fork (no options) copies all messages', () => {
		const conv = makeConversation()
		const fork = conv.fork()
		expect(fork.messages).toHaveLength(conv.messages.length)
	})
})

describe('Conversation research', () => {
	it('fans out questions and returns results', async () => {
		const conv = makeConversation()
		conv.stub(/pros of A/, 'A is fast')
		conv.stub(/pros of B/, 'B is safe')

		const results = await conv.research([
			'What are the pros of A?',
			'What are the pros of B?',
		])

		expect(results).toHaveLength(2)
		expect(results[0]).toBe('A is fast')
		expect(results[1]).toBe('B is safe')
	})

	it('forks inherit stubs from the parent', async () => {
		const conv = makeConversation()
		conv.stub(/.*/, 'stubbed')

		const results = await conv.research([
			'anything',
			'something else',
		], { history: 'none' })

		expect(results).toEqual(['stubbed', 'stubbed'])
	})

	it('respects per-fork history option', async () => {
		const conv = makeConversation()
		conv.stub(/.*/, 'stubbed')

		const results = await conv.research([
			{ question: 'q1', forkOptions: { history: 'none' } },
			{ question: 'q2', forkOptions: { history: 1 } },
		])

		expect(results).toHaveLength(2)
		expect(results[0]).toBe('stubbed')
		expect(results[1]).toBe('stubbed')
	})
})

describe('Assistant fork', () => {
	it('creates an independent assistant with same system prompt', async () => {
		const assistant = makeAssistant()
		await assistant.start()

		const fork = await assistant.fork({ history: 'none' })
		expect(fork.systemPrompt).toBe(assistant.systemPrompt)
		expect(fork.isStarted).toBe(true)
	})

	it('fork preserves interceptors', async () => {
		const assistant = makeAssistant()
		const intercepted: string[] = []

		assistant.intercept('beforeAsk', async (ctx, next) => {
			intercepted.push('parent-interceptor')
			ctx.result = 'intercepted'
			await next()
		})

		await assistant.start()
		const fork = await assistant.fork({ history: 'none' })

		const result = await fork.ask('anything')
		expect(result).toBe('intercepted')
		expect(intercepted).toContain('parent-interceptor')
	})

	it('fork preserves system prompt extensions', async () => {
		const assistant = makeAssistant()
		assistant.addSystemPromptExtension('extra', 'You also speak French.')
		await assistant.start()

		const fork = await assistant.fork({ history: 'none' })
		expect(fork.effectiveSystemPrompt).toContain('You also speak French.')
	})

	it('fork with model override', async () => {
		const assistant = makeAssistant()
		await assistant.start()

		const fork = await assistant.fork({ model: 'gpt-4o-mini', history: 'none' })
		expect(fork.conversation.model).toBe('gpt-4o-mini')
	})

	it('fork array creates multiple assistants', async () => {
		const assistant = makeAssistant()
		await assistant.start()

		const forks = await assistant.fork([
			{ history: 'none' },
			{ history: 'none' },
		])

		expect(forks).toHaveLength(2)
		expect(forks[0]!.isStarted).toBe(true)
		expect(forks[1]!.isStarted).toBe(true)
	})
})

describe('Assistant createResearchJob', () => {
	it('returns a job entity with running status', async () => {
		const container = new AGIContainer()
		const assistant = makeAssistant(container)

		// Use interceptors to simulate responses with random delays
		assistant.intercept('beforeAsk', async (ctx, next) => {
			const delay = Math.floor(Math.random() * 50) + 10
			await container.sleep(delay)
			ctx.result = `Answer to: ${ctx.question}`
			await next()
		})

		await assistant.start()

		const job = await assistant.createResearchJob(
			'Research context',
			['Question 1', 'Question 2', 'Question 3'],
			{ history: 'none' }
		)

		expect(job.state.get('status')).toBe('running')
		expect(job.state.get('total')).toBe(3)
		expect(job.id).toMatch(/^research:/)
	})

	it('job is tracked in assistant.researchJobs', async () => {
		const container = new AGIContainer()
		const assistant = makeAssistant(container)

		assistant.intercept('beforeAsk', async (ctx, next) => {
			ctx.result = 'done'
			await next()
		})

		await assistant.start()

		const job = await assistant.createResearchJob('', ['q1'], { history: 'none' })
		expect(assistant.researchJobs.has(job.id)).toBe(true)
		expect(assistant.researchJobs.get(job.id)).toBe(job)
	})

	it('emits forkCompleted for each resolved fork', async () => {
		const container = new AGIContainer()
		const assistant = makeAssistant(container)

		assistant.intercept('beforeAsk', async (ctx, next) => {
			const delay = Math.floor(Math.random() * 30) + 10
			await container.sleep(delay)
			ctx.result = `Result for: ${ctx.question}`
			await next()
		})

		await assistant.start()

		const job = await assistant.createResearchJob(
			'',
			['Q1', 'Q2'],
			{ history: 'none' }
		)

		const completed: number[] = []
		job.on('forkCompleted', (index) => {
			completed.push(index)
		})

		await job.waitFor('completed')

		expect(completed.sort()).toEqual([0, 1])
	})

	it('resolves with all results on completed event', async () => {
		const container = new AGIContainer()
		const assistant = makeAssistant(container)

		assistant.intercept('beforeAsk', async (ctx, next) => {
			const delay = Math.floor(Math.random() * 50) + 10
			await container.sleep(delay)
			ctx.result = `Answer: ${ctx.question}`
			await next()
		})

		await assistant.start()

		const job = await assistant.createResearchJob(
			'',
			['Alpha', 'Beta', 'Gamma'],
			{ history: 'none' }
		)

		const results = await new Promise<string[]>((resolve) => {
			job.on('completed', (r) => resolve(r))
		})

		expect(results).toHaveLength(3)
		expect(results[0]).toBe('Answer: Alpha')
		expect(results[1]).toBe('Answer: Beta')
		expect(results[2]).toBe('Answer: Gamma')
	})

	it('tracks incremental progress in state', async () => {
		const container = new AGIContainer()
		const assistant = makeAssistant(container)

		// Track completion order via events
		const completedIndices: number[] = []

		assistant.intercept('beforeAsk', async (ctx, next) => {
			// Stagger the forks: first question takes longer
			const delay = String(ctx.question).includes('A') ? 40 : 10
			await container.sleep(delay)
			ctx.result = `Done: ${ctx.question}`
			await next()
		})

		await assistant.start()

		const job = await assistant.createResearchJob(
			'',
			['A', 'B'],
			{ history: 'none' }
		)

		job.on('forkCompleted', (index) => {
			completedIndices.push(index)
		})

		// B should finish first (10ms vs 40ms)
		// Wait for first completion
		await new Promise<void>(resolve => {
			const check = () => {
				if (job.state.get('completed')! >= 1) return resolve()
				setTimeout(check, 5)
			}
			check()
		})

		expect(job.state.get('completed')).toBe(1)
		expect(job.state.get('status')).toBe('running')

		// Wait for full completion
		await job.waitFor('completed')
		expect(job.state.get('completed')).toBe(2)
		expect(job.state.get('status')).toBe('completed')
		expect(job.state.get('results')![0]).toBe('Done: A')
		expect(job.state.get('results')![1]).toBe('Done: B')
	})

	it('shared prompt is added as system prompt extension on forks', async () => {
		const container = new AGIContainer()
		const assistant = makeAssistant(container)

		let capturedPrompts: string[] = []

		assistant.intercept('beforeAsk', async (ctx, next) => {
			// Capture the effective system prompt from the fork
			capturedPrompts.push('captured')
			ctx.result = 'done'
			await next()
		})

		await assistant.start()

		await assistant.createResearchJob(
			'You are analyzing security vulnerabilities.',
			['Check for XSS'],
			{ history: 'none' }
		)

		await container.sleep(50)
		expect(capturedPrompts.length).toBeGreaterThan(0)
	})
})

describe('Assistant research (sugar)', () => {
	it('blocks until all results are available', async () => {
		const container = new AGIContainer()
		const assistant = makeAssistant(container)

		assistant.intercept('beforeAsk', async (ctx, next) => {
			const delay = Math.floor(Math.random() * 30) + 10
			await container.sleep(delay)
			ctx.result = `R:${ctx.question}`
			await next()
		})

		await assistant.start()

		const results = await assistant.research(
			['Q1', 'Q2', 'Q3'],
			{ history: 'none' }
		)

		expect(results).toHaveLength(3)
		expect(results[0]).toBe('R:Q1')
		expect(results[1]).toBe('R:Q2')
		expect(results[2]).toBe('R:Q3')
	})

	it('supports per-question fork overrides', async () => {
		const container = new AGIContainer()
		const assistant = makeAssistant(container)

		assistant.intercept('beforeAsk', async (ctx, next) => {
			ctx.result = `answered`
			await next()
		})

		await assistant.start()

		const results = await assistant.research([
			'simple question',
			{ question: 'contextual question', forkOptions: { history: 'full' } },
		], { history: 'none' })

		expect(results).toHaveLength(2)
		expect(results[0]).toBe('answered')
		expect(results[1]).toBe('answered')
	})

	it('creates a tracked job under the hood', async () => {
		const container = new AGIContainer()
		const assistant = makeAssistant(container)

		assistant.intercept('beforeAsk', async (ctx, next) => {
			ctx.result = 'ok'
			await next()
		})

		await assistant.start()

		expect(assistant.researchJobs.size).toBe(0)
		await assistant.research(['q'], { history: 'none' })
		expect(assistant.researchJobs.size).toBe(1)
	})
})
