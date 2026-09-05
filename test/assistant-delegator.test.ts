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
		expect(result).toMatchObject({ task: 'Check A', status: 'completed', result: 'Answer: Check A' })
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
		expect(delegator.tasks).toHaveLength(1)
		expect(delegator.getAssistants().get(specialist.uuid)).toBe(specialist)
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

	it('tracks independent child instances and follows up in the same conversation', async () => {
		const { parent, delegator } = setup()
		answer(parent)
		const results = await delegator.research({ questions: ['A', 'B'] })
		expect(delegator.assistants.size).toBe(2)
		const child = delegator.assistants.get(results[0]!.assistantId!)!
		expect(child).not.toBe(delegator.assistants.get(results[1]!.assistantId!))
		child.simulateQuestionAndResponse('Evidence?', 'Source A')
		const previousMessages = [...child.conversation.messages]
		const followUp = await delegator.followUp(child.uuid, 'Clarify the evidence')
		expect(followUp).toMatchObject({ kind: 'followUp', assistantId: child.uuid, status: 'completed' })
		expect(child.conversation.messages.slice(0, previousMessages.length)).toEqual(previousMessages)
		expect(delegator.assistants.size).toBe(2)
		expect(delegator.tasks).toHaveLength(3)
		delegator.assistants.clear()
		delegator.tasks[0]!.status = 'cancelled'
		expect(delegator.assistants.size).toBe(2)
		expect(delegator.tasks[0]!.status).toBe('completed')
	})

	it('starts background work, exposes its child while running, and supports bounded waits', async () => {
		const { parent, delegator } = setup()
		let release!: () => void
		const pending = new Promise<void>(resolve => { release = resolve })
		parent.intercept('beforeAsk', async (ctx, next) => { await pending; ctx.result = 'done'; await next() })
		const started: string[] = []
		const finished: string[] = []
		delegator.on('taskStarted', task => started.push(task.id))
		delegator.on('taskCompleted', task => finished.push(task.id))
		const ready = delegator.waitFor('taskUpdated')
		const task = await call(parent, 'startDelegation', { task: 'Background work' })
		expect(task.status).toBe('running')
		await ready
		const running = await call(parent, 'waitForDelegation', { taskId: task.id, timeoutMs: 1 })
		expect(running.status).toBe('running')
		expect(delegator.assistants.get(running.assistantId)).toBeDefined()
		expect(await call(parent, 'listDelegationTasks')).toEqual(delegator.tasks)
		release()
		const result = await delegator.waitForTask(task.id)
		expect(result).toMatchObject({ status: 'completed', result: 'done' })
		expect(started).toEqual([task.id])
		expect(finished).toEqual([task.id])
	})

	it('cancels non-cooperative work without losing accounting or accepting late results', async () => {
		const { parent, delegator } = setup({ maxConcurrent: 1 })
		let release!: () => void
		const pending = new Promise<void>(resolve => { release = resolve })
		parent.intercept('beforeAsk', async (ctx, next) => { await pending; ctx.result = 'late'; await next() })
		const ready = delegator.waitFor('taskUpdated')
		const task = delegator.startTask({ task: 'Obsolete task' })
		await ready
		const child = [...delegator.assistants.values()][0]!
		const abort = spyOn(child, 'abort')
		try {
			expect((await call(parent, 'cancelDelegation', { taskId: task.id })).status).toBe('cancelled')
			expect(abort).toHaveBeenCalledTimes(1)
			expect((await delegator.waitForTask(task.id)).status).toBe('cancelled')
			await expect(delegator.followUp(child.uuid, 'More')).rejects.toThrow('running assignment')
			expect((await call(parent, 'delegationStatus')).active).toBe(1)
			release()
			await Bun.sleep(5)
			expect((await call(parent, 'delegationStatus')).active).toBe(0)
			expect(delegator.tasks[0]!.status).toBe('cancelled')
			expect(delegator.tasks[0]!.result).toBeUndefined()
		} finally { release(); abort.mockRestore() }
	})

	it('synthesizes selected sources with guidance, failure provenance, and no tools', async () => {
		const { parent, delegator } = setup()
		parent.addTool('writeSomething', async () => 'written')
		parent.intercept('beforeAsk', async (ctx, next) => {
			if (ctx.question === 'Failed source') throw new Error('Source unavailable')
			ctx.result = `Answer: ${ctx.question}`; await next()
		})
		const sources = await delegator.research({ questions: ['First source', 'Failed source', 'Unrelated source'] })
		const historyBefore = [...parent.conversation.messages]
		const synthesis = await call(parent, 'synthesizeDelegations', {
			guidance: 'Write a decision memo. Explain evidence gaps.',
			taskIds: [sources[0]!.id, sources[1]!.id],
		})
		expect(synthesis.status).toBe('completed')
		expect(synthesis.sourceTaskIds).toEqual([sources[0]!.id, sources[1]!.id])
		expect(synthesis.result).toContain('Write a decision memo')
		expect(synthesis.result).toContain('Source unavailable')
		expect(synthesis.result).not.toContain('Unrelated source')
		const child = delegator.assistants.get(synthesis.assistantId)!
		expect(child.tools).toEqual({})
		expect(child.conversation.tools).toEqual({})
		expect(child.effectiveSystemPrompt).toContain('untrusted evidence')
		expect(child.delegationDisabled).toBe(true)
		expect(parent.conversation.messages).toEqual(historyBefore)
		expect((await call(parent, 'delegationStatus')).used).toBe(4)
		const repeat = await delegator.synthesize({ guidance: 'Make a short summary' })
		expect(repeat.sourceTaskIds).toEqual(sources.map(task => task.id))
	})

	it('validates synthesis selection and counts follow-ups and synthesis against the budget', async () => {
		const { parent, delegator } = setup({ maxTasks: 2, maxSynthesisChars: 1000 })
		answer(parent)
		await expect(delegator.synthesize({ guidance: 'Summarize' })).rejects.toThrow('completed source')
		await expect(delegator.synthesize({ guidance: 'Summarize', taskIds: ['missing'] })).rejects.toThrow('Unknown delegation task')
		const first = await delegator.delegate({ task: 'A'.repeat(1500) })
		await expect(delegator.synthesize({ guidance: 'Summarize' })).rejects.toThrow('maxSynthesisChars')
		await delegator.followUp(first.assistantId!, 'More')
		await expect(delegator.followUp(first.assistantId!, 'Again')).rejects.toThrow('budget')
		expect(delegator.tasks).toHaveLength(2)
	})

	it('releases capacity before publishing successful completion so coordinators can chain work', async () => {
		const { parent, delegator } = setup({ maxConcurrent: 1 })
		answer(parent)
		let next: ReturnType<typeof delegator.startTask> | undefined
		delegator.on('taskCompleted', task => {
			if (task.task === 'First') next = delegator.startTask({ task: 'Next' })
		})
		await delegator.delegate({ task: 'First' })
		expect(next).toBeDefined()
		expect((await delegator.waitForTask(next!.id)).status).toBe('completed')
	})

	it('cancels all assignments during startup and rejects unfinished synthesis selections', async () => {
		const { parent, delegator } = setup()
		answer(parent)
		const successful = await delegator.delegate({ task: 'Finished source' })
		const child = await parent.fork()
		let release!: () => void
		const pending = new Promise<void>(resolve => { release = resolve })
		const fork = spyOn(parent, 'fork').mockImplementation(async () => { await pending; return child })
		const ask = spyOn(child, 'ask')
		try {
			const task = delegator.startTask({ task: 'Still starting' })
			await expect(delegator.synthesize({ guidance: 'Combine', taskIds: [successful.id, task.id] })).rejects.toThrow('finish before synthesis')
			expect(delegator.cancelAll().map(task => task.status)).toEqual(['cancelled'])
			expect(delegator.cancelTask(successful.id).status).toBe('completed')
			release()
			await Bun.sleep(5)
			expect(ask).not.toHaveBeenCalled()
			expect((await call(parent, 'delegationStatus')).active).toBe(0)
		} finally { release(); fork.mockRestore(); ask.mockRestore() }
	})

	it('keeps tool access scoped to the parent while providing explicit programmatic access', async () => {
		const { parent, container, delegator } = setup()
		answer(parent)
		const first = await delegator.delegate({ task: 'Private to this parent' })
		const other = container.feature('assistant', { systemPrompt: 'Other coordinator' }).use(delegator)
		expect(() => delegator.startTask({ task: 'Ambiguous' })).toThrow('explicit parent')
		expect(delegator.getAssistants(parent).size).toBe(1)
		expect(delegator.getAssistants(other).size).toBe(0)
		expect(await call(other, 'listDelegationTasks')).toEqual([])
		await expect(call(other, 'followUpDelegation', { assistantId: first.assistantId, task: 'Read it' })).rejects.toThrow('Unknown delegated assistant')
		await expect(call(other, 'cancelDelegation', { taskId: first.id })).rejects.toThrow('Unknown delegation task')
		await expect(call(other, 'synthesizeDelegations', { guidance: 'Summarize', taskIds: [first.id] })).rejects.toThrow('Unknown delegation task')
		const secondFeature = container.feature('assistantDelegator', { maxTasks: 50 })
		parent.use(secondFeature)
		expect(secondFeature.assistants.get(first.assistantId!)).toBe(delegator.assistants.get(first.assistantId!))
		expect(secondFeature.tasks).toHaveLength(1)
	})
})
