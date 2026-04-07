import { describe, it, expect, beforeEach } from 'bun:test'
import { AGIContainer } from '../src/agi/container.server'
import type { Assistant } from '../src/agi/features/assistant'

/**
 * Helper: create a runtime assistant with no folder, stub the conversation
 * so tests never hit the network, and inject hook functions directly.
 */
function makeAssistant(hooks: Record<string, (...args: any[]) => any> = {}) {
	const container = new AGIContainer()
	const assistant = container.feature('assistant', {
		systemPrompt: 'You are a test assistant.',
		model: 'gpt-5',
	}) as Assistant

	// Inject hooks into state (same shape loadHooks() produces)
	assistant.state.set('hooks', hooks)

	return assistant
}

/** Start + stub so ask() never touches the network */
async function startWithStub(assistant: Assistant, pattern: string | RegExp = /.*/, response: string = 'stubbed') {
	await assistant.start()
	assistant.conversation.stub(pattern, response)
	return assistant
}

describe('Assistant triggerHook', () => {
	it('returns undefined when no hook exists for the name', async () => {
		const assistant = makeAssistant()
		const result = await assistant.triggerHook('nonexistent', 'arg1')
		expect(result).toBeUndefined()
	})

	it('calls the hook with (assistant, ...args) and awaits it', async () => {
		const calls: any[][] = []
		const assistant = makeAssistant({
			myHook: async (asst: any, a: string, b: number) => {
				calls.push([asst, a, b])
				return 'hook-result'
			},
		})

		const result = await assistant.triggerHook('myHook', 'hello', 42)
		expect(result).toBe('hook-result')
		expect(calls).toHaveLength(1)
		expect(calls[0]![0]).toBe(assistant)
		expect(calls[0]![1]).toBe('hello')
		expect(calls[0]![2]).toBe(42)
	})

	it('emits hookFired before calling the hook', async () => {
		const events: string[] = []
		const assistant = makeAssistant({
			myHook: async () => { events.push('hook-ran') },
		})
		assistant.on('hookFired', (name: string) => { events.push(`hookFired:${name}`) })

		await assistant.triggerHook('myHook')
		expect(events).toEqual(['hookFired:myHook', 'hook-ran'])
	})

	it('awaits async hooks to completion before returning', async () => {
		let resolved = false
		const assistant = makeAssistant({
			slowHook: async () => {
				await new Promise(r => setTimeout(r, 50))
				resolved = true
			},
		})

		await assistant.triggerHook('slowHook')
		expect(resolved).toBe(true)
	})
})

describe('Assistant lifecycle hooks', () => {
	it('beforeStart runs before the assistant is started', async () => {
		const order: string[] = []
		const assistant = makeAssistant({
			beforeStart: async () => { order.push('beforeStart') },
			started: async () => { order.push('started') },
			afterStart: async () => { order.push('afterStart') },
		})

		await assistant.start()
		expect(order).toEqual(['beforeStart', 'started', 'afterStart'])
	})

	it('afterStart blocks start() until complete', async () => {
		let afterStartDone = false
		const assistant = makeAssistant({
			afterStart: async () => {
				await new Promise(r => setTimeout(r, 50))
				afterStartDone = true
			},
		})

		await assistant.start()
		expect(afterStartDone).toBe(true)
	})

	it('formatSystemPrompt modifies the system prompt before conversation creation', async () => {
		const assistant = makeAssistant({
			formatSystemPrompt: async (_asst: any, prompt: string) => {
				return prompt + '\nExtra instructions.'
			},
		})

		await assistant.start()
		expect(assistant.systemPrompt).toContain('Extra instructions.')
	})
})

describe('Assistant ask hooks', () => {
	it('beforeAsk fires on every ask() call', async () => {
		let callCount = 0
		const assistant = makeAssistant({
			beforeAsk: async () => { callCount++ },
		})
		await startWithStub(assistant)

		await assistant.ask('first')
		await assistant.ask('second')
		expect(callCount).toBe(2)
	})

	it('beforeAsk can rewrite the question via return value', async () => {
		const questionsReceived: string[] = []
		const assistant = makeAssistant({
			beforeAsk: async (_asst: any, question: string) => {
				return question + ' (rewritten)'
			},
		})
		await assistant.start()

		// Stub that captures the actual question sent to the conversation
		assistant.conversation.on('userMessage', (content: any) => {
			questionsReceived.push(typeof content === 'string' ? content : JSON.stringify(content))
		})
		assistant.conversation.stub(/.*/, 'ok')

		await assistant.ask('hello')
		expect(questionsReceived[0]).toContain('(rewritten)')
	})

	it('beforeInitialAsk fires only on the first ask()', async () => {
		let callCount = 0
		const assistant = makeAssistant({
			beforeInitialAsk: async () => { callCount++ },
		})
		await startWithStub(assistant)

		await assistant.ask('first')
		await assistant.ask('second')
		await assistant.ask('third')
		expect(callCount).toBe(1)
	})

	it('answered hook fires after the response is produced', async () => {
		let hookResponse: string | undefined
		const assistant = makeAssistant({
			answered: async (_asst: any, result: string) => {
				hookResponse = result
			},
		})
		await startWithStub(assistant, /.*/, 'the answer')

		await assistant.ask('question')
		expect(hookResponse).toBe('the answer')
	})

	it('answered hook is awaited before ask() returns', async () => {
		let hookDone = false
		const assistant = makeAssistant({
			answered: async () => {
				await new Promise(r => setTimeout(r, 50))
				hookDone = true
			},
		})
		await startWithStub(assistant)

		await assistant.ask('question')
		expect(hookDone).toBe(true)
	})
})

describe('Assistant tool hooks', () => {
	it('beforeToolCall hook fires before tool execution', async () => {
		const hookCalls: any[] = []
		const assistant = makeAssistant({
			beforeToolCall: async (_asst: any, ctx: any) => {
				hookCalls.push({ name: ctx.name, args: { ...ctx.args } })
			},
		})
		await assistant.start()

		// Add a simple tool and stub a response that triggers it
		assistant.addTool('echo', {
			description: 'Echo tool',
			parameters: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
			handler: async (args: any) => args.text,
		})

		// Directly invoke the toolExecutor to test hooks without needing model responses
		const handler = async (args: any) => args.text
		await assistant.conversation.toolExecutor!('echo', { text: 'hello' }, handler)

		expect(hookCalls).toHaveLength(1)
		expect(hookCalls[0]!.name).toBe('echo')
		expect(hookCalls[0]!.args.text).toBe('hello')
	})

	it('afterToolCall hook fires after tool execution with result', async () => {
		const hookCalls: any[] = []
		const assistant = makeAssistant({
			afterToolCall: async (_asst: any, ctx: any) => {
				hookCalls.push({ name: ctx.name, result: ctx.result })
			},
		})
		await assistant.start()

		const handler = async (args: any) => args.text
		await assistant.conversation.toolExecutor!('echo', { text: 'world' }, handler)

		expect(hookCalls).toHaveLength(1)
		expect(hookCalls[0]!.name).toBe('echo')
		expect(hookCalls[0]!.result).toBe('world')
	})

	it('beforeToolCall can modify args via ctx mutation', async () => {
		const assistant = makeAssistant({
			beforeToolCall: async (_asst: any, ctx: any) => {
				ctx.args.text = 'intercepted'
			},
		})
		await assistant.start()

		let receivedArgs: any
		const handler = async (args: any) => { receivedArgs = args; return 'ok' }
		await assistant.conversation.toolExecutor!('echo', { text: 'original' }, handler)

		expect(receivedArgs.text).toBe('intercepted')
	})

	it('beforeToolCall can skip execution via ctx.skip', async () => {
		const assistant = makeAssistant({
			beforeToolCall: async (_asst: any, ctx: any) => {
				ctx.skip = true
				ctx.result = 'skipped-by-hook'
			},
		})
		await assistant.start()

		let handlerCalled = false
		const handler = async () => { handlerCalled = true; return 'should not run' }
		const result = await assistant.conversation.toolExecutor!('echo', { text: 'hi' }, handler)

		expect(handlerCalled).toBe(false)
		expect(result).toBe('skipped-by-hook')
	})

	it('afterToolCall can modify the result via ctx mutation', async () => {
		const assistant = makeAssistant({
			afterToolCall: async (_asst: any, ctx: any) => {
				ctx.result = 'modified-result'
			},
		})
		await assistant.start()

		const handler = async () => 'original-result'
		const result = await assistant.conversation.toolExecutor!('echo', {}, handler)

		expect(result).toBe('modified-result')
	})
})

describe('Assistant forwarded event hooks', () => {
	it('turnStart hook fires before the turnStart event on the assistant bus', async () => {
		const order: string[] = []
		const assistant = makeAssistant({
			turnStart: async () => { order.push('hook') },
		})
		await startWithStub(assistant)

		assistant.on('turnStart', () => { order.push('event') })

		await assistant.ask('go')
		expect(order[0]).toBe('hook')
		expect(order[1]).toBe('event')
	})

	it('response hook fires with the final response text', async () => {
		let hookText: string | undefined
		const assistant = makeAssistant({
			response: async (_asst: any, text: string) => {
				hookText = text
			},
		})
		await startWithStub(assistant, /.*/, 'final answer')

		await assistant.ask('question')
		expect(hookText).toBe('final answer')
	})
})
