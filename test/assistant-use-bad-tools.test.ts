import { describe, expect, it, spyOn } from 'bun:test'
import { z } from 'zod'
import { AGIContainer } from '../src/agi/container.server'

/**
 * A helper that returns the wrong shape from toTools() should cost that
 * helper's tools and nothing more — the assistant still starts, and the error
 * says which helper is at fault and what shape was expected.
 */
describe('Assistant.use() with a malformed tools provider', () => {
	it('starts anyway and names the helper plus the expected shape', async () => {
		const errors: string[] = []
		const spy = spyOn(console, 'error').mockImplementation((...args: any[]) => {
			errors.push(args.map(String).join(' '))
		})

		try {
			const container = new AGIContainer()
			const assistant = container.feature('assistant', { systemPrompt: 'You are concise.' })

			const brokenHelper = {
				shortcut: 'features.brokenHelper',
				// Missing `handlers` — the classic mistake.
				toTools: () => ({ schemas: { doThing: z.object({ what: z.string() }) } }) as any,
			}

			const goodHelper = {
				shortcut: 'features.goodHelper',
				toTools: () => ({
					schemas: { ping: z.object({}).describe('Ping') },
					handlers: { ping: () => 'pong' },
				}),
			}

			assistant.use(brokenHelper)
			assistant.use(goodHelper)

			await assistant.start()

			expect(assistant.isStarted).toBe(true)
			expect(assistant.availableTools).not.toContain('doThing')
			// The healthy helper is unaffected by its neighbor's failure.
			expect(assistant.availableTools).toContain('ping')

			const reported = errors.join('\n')
			expect(reported).toContain('features.brokenHelper')
			expect(reported).toContain('schemas')
			expect(reported).toContain('{ schemas: Record<string, ZodType>, handlers: Record<string, Function> }')
			// The assistant is named so the user knows where to look.
			expect(reported).toContain(assistant.name)
		} finally {
			spy.mockRestore()
		}
	})

	it('attributes a throwing toTools() to the helper instead of an anonymous TypeError', async () => {
		const errors: string[] = []
		const spy = spyOn(console, 'error').mockImplementation((...args: any[]) => {
			errors.push(args.map(String).join(' '))
		})

		try {
			const container = new AGIContainer()
			const assistant = container.feature('assistant', { systemPrompt: 'You are concise.' })

			assistant.use({
				shortcut: 'features.explodingHelper',
				toTools: () => { throw new Error('kaboom') },
			} as any)

			await assistant.start()

			expect(assistant.isStarted).toBe(true)
			const reported = errors.join('\n')
			expect(reported).toContain('features.explodingHelper')
			expect(reported).toContain('kaboom')
		} finally {
			spy.mockRestore()
		}
	})
})
