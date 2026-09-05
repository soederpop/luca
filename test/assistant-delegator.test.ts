import { describe, it, expect, spyOn } from 'bun:test'
import { AGIContainer } from '../src/agi/container.server'
import type { Assistant } from '../src/agi/features/assistant'
import { delegationToolNames } from '../src/agi/delegation-policy'

function setup(options = {}) {
	const container = new AGIContainer()
	const parent = container.feature('assistant', { systemPrompt: 'Test assistant', model: 'gpt-5' })
	const delegator = container.feature('assistantDelegator', options)
	parent.use(delegator)
	return { container, parent, delegator }
}

function call(parent: Assistant, name: string, args = {}): Promise<any> {
	return Promise.resolve(parent.tools[name]!.handler(args))
}

function answer(parent: Assistant) {
	parent.intercept('beforeAsk', async (ctx, next) => {
		ctx.result = `Answer: ${ctx.question}`
		await next()
	})
}

describe('assistantDelegator', () => {
	it('registers typed tools and operating guidance, and delegates ordered research', async () => {
		const { parent } = setup()
		answer(parent)
		expect(parent.effectiveSystemPrompt).toContain('12 total child tasks')
		expect(parent.tools.delegateTask!.description).toContain('independent assignment')
		const result = await call(parent, 'delegateTask', { task: 'Check A' })
		expect(result).toEqual({ task: 'Check A', status: 'completed', result: 'Answer: Check A' })
		const research = await call(parent, 'researchTasks', { questions: ['Q1', 'Q2'], context: 'Find evidence' })
		expect(research.map((r: any) => r.task)).toEqual(['Q1', 'Q2'])
		expect(research[0].result).toContain('Find evidence')
		expect(await call(parent, 'delegationStatus')).toMatchObject({ active: 0, used: 3, remaining: 9 })
	})

	it('strips tools and prompt from forks, research children, reloads, and attempted reattachment', async () => {
		const { parent, delegator } = setup()
		answer(parent)
		parent.addSystemPromptExtension('unrelated', 'Keep this extension')
		const child = await parent.fork({ history: 'full' })
		child.use(delegator)
		child.use(delegator.toTools())
		child.reload()
		for (const name of delegationToolNames) {
			expect(child.allTools[name]).toBeUndefined()
			expect(child.conversation.tools[name]).toBeUndefined()
			expect(child.toolFilterDecision(name).included).toBe(false)
		}
		expect(child.effectiveSystemPrompt).not.toContain('You can delegate bounded work')
		expect(child.conversation.messages[0]!.content).not.toContain('You can delegate bounded work')
		expect(child.effectiveSystemPrompt).toContain('Keep this extension')
		expect(parent.tools.delegateTask).toBeDefined()
		const grandchild = await child.fork()
		expect(grandchild.tools.delegateTask).toBeUndefined()
	})

	it('binds a shared feature to each consumer and supports filtered tools bundles', async () => {
		const { parent, container, delegator } = setup()
		answer(parent)
		const other = container.feature('assistant', { systemPrompt: 'Other' })
		other.intercept('beforeAsk', async (ctx, next) => { ctx.result = 'Other response'; await next() })
		other.use(delegator)
		expect((await call(other, 'delegateTask', { task: 'Other task' })).result).toBe('Other response')
		expect((await call(parent, 'delegationStatus')).used).toBe(0)
		const filtered = container.feature('assistant', { systemPrompt: 'Filtered' })
		filtered.use(delegator.toTools({ only: ['delegationStatus'] }))
		expect(filtered.tools.delegationStatus).toBeDefined()
		expect(filtered.tools.delegateTask).toBeUndefined()
	})

	it('reserves capacity atomically and preserves lifetime limits across reattachment', async () => {
		const { parent, container } = setup({ maxConcurrent: 1, maxTasks: 1 })
		let finish!: () => void
		const pending = new Promise<void>(resolve => { finish = resolve })
		parent.intercept('beforeAsk', async (ctx, next) => { await pending; ctx.result = 'done'; await next() })
		const first = call(parent, 'delegateTask', { task: 'First' })
		await expect(call(parent, 'delegateTask', { task: 'Second' })).rejects.toThrow('budget')
		finish()
		await first
		parent.use(container.feature('assistantDelegator', { maxTasks: 100 }))
		await expect(call(parent, 'delegateTask', { task: 'Third' })).rejects.toThrow('budget')
	})

	it('rejects oversized and duplicate batches without spending budget', async () => {
		const { parent } = setup({ maxConcurrent: 1 })
		await expect(call(parent, 'researchTasks', { questions: ['A', 'B'] })).rejects.toThrow('concurrency')
		await expect(call(parent, 'researchTasks', { questions: ['A', 'A'] })).rejects.toThrow('distinct')
		await expect(call(parent, 'delegateTask', { task: ' ' })).rejects.toThrow()
		expect((await call(parent, 'delegationStatus')).used).toBe(0)
	})

	it('reports individual errors and releases capacity after failures', async () => {
		const { parent } = setup()
		parent.intercept('beforeAsk', async (ctx, next) => {
			if (ctx.question === 'bad') throw new Error('Test failure')
			ctx.result = 'ok'; await next()
		})
		const results = await call(parent, 'researchTasks', { questions: ['good', 'bad'] })
		expect(results[0].status).toBe('completed')
		expect(results[1]).toMatchObject({ status: 'failed', error: 'Test failure' })
		expect((await call(parent, 'delegationStatus')).active).toBe(0)
	})

	it('times out without releasing slots for work that ignores abort', async () => {
		const { parent } = setup({ timeoutMs: 20, maxConcurrent: 1 })
		let finish!: () => void
		const pending = new Promise<void>(resolve => { finish = resolve })
		parent.intercept('beforeAsk', async (ctx, next) => { await pending; ctx.result = 'late'; await next() })
		const result = await call(parent, 'delegateTask', { task: 'Slow' })
		expect(result.status).toBe('timedOut')
		expect((await call(parent, 'delegationStatus')).active).toBe(1)
		await expect(call(parent, 'delegateTask', { task: 'More' })).rejects.toThrow('concurrency')
		finish()
		await Bun.sleep(10)
		expect((await call(parent, 'delegationStatus')).active).toBe(0)
	})

	it('limits named specialists and strips delegator even when a factory ignores options', async () => {
		const { parent, container, delegator } = setup({ allowedAgents: ['specialist'], maxToolTurns: 2 })
		const manager = container.feature('assistantsManager')
		manager.state.set('discovered', true)
		let specialist!: Assistant
		manager.register('specialist', () => {
			specialist = container.feature('assistant', { systemPrompt: 'Specialist' }).use(delegator)
			answer(specialist)
			return specialist
		})
		expect(await call(parent, 'listDelegationAgents')).toEqual(['specialist'])
		await expect(call(parent, 'delegateTask', { task: 'No', agent: 'forbidden' })).rejects.toThrow('not permitted')
		expect((await call(parent, 'delegateTask', { task: 'Help', agent: 'specialist' })).status).toBe('completed')
		expect(specialist.tools.delegateTask).toBeUndefined()
		expect(specialist.conversation.maxToolTurns).toBe(2)
		expect(specialist.effectiveSystemPrompt).not.toContain('You can delegate bounded work')
	})

	it('does not ask a child that finishes starting after its deadline', async () => {
		const { parent } = setup({ timeoutMs: 10 })
		const child = await parent.fork()
		let release!: () => void
		const pending = new Promise<void>(resolve => { release = resolve })
		const fork = spyOn(parent, 'fork').mockImplementation(async () => { await pending; return child })
		const ask = spyOn(child, 'ask')
		try {
			expect((await call(parent, 'delegateTask', { task: 'Late startup' })).status).toBe('timedOut')
			expect((await call(parent, 'delegationStatus')).active).toBe(1)
			release()
			await Bun.sleep(5)
			expect(ask).not.toHaveBeenCalled()
			expect((await call(parent, 'delegationStatus')).active).toBe(0)
		} finally {
			release(); fork.mockRestore(); ask.mockRestore()
		}
	})

	it('prevents concurrent assignments to the same cached specialist', async () => {
		const { parent, container } = setup()
		const manager = container.feature('assistantsManager')
		manager.state.set('discovered', true)
		let release!: () => void
		const pending = new Promise<void>(resolve => { release = resolve })
		manager.register('slow', () => {
			const child = container.feature('assistant', { systemPrompt: 'Slow' })
			child.intercept('beforeAsk', async (ctx, next) => { await pending; ctx.result = 'done'; await next() })
			return child
		})
		const first = call(parent, 'delegateTask', { task: 'First', agent: 'slow' })
		await expect(call(parent, 'delegateTask', { task: 'Second', agent: 'slow' })).rejects.toThrow('running assignment')
		release()
		await first
		expect((await call(parent, 'delegationStatus')).used).toBe(1)
	})
})
