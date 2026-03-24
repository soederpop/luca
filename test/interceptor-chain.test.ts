import { describe, it, expect } from 'bun:test'
import { InterceptorChain } from '../src/agi/lib/interceptor-chain'

describe('InterceptorChain', () => {
	it('runs interceptors in order then the final', async () => {
		const chain = new InterceptorChain<{ log: string[] }>()
		chain.add(async (ctx, next) => { ctx.log.push('a'); await next() })
		chain.add(async (ctx, next) => { ctx.log.push('b'); await next() })

		const ctx = { log: [] as string[] }
		await chain.run(ctx, async () => { ctx.log.push('final') })

		expect(ctx.log).toEqual(['a', 'b', 'final'])
	})

	it('skips the final when an interceptor does not call next', async () => {
		const chain = new InterceptorChain<{ log: string[] }>()
		chain.add(async (ctx, _next) => { ctx.log.push('blocker') })
		chain.add(async (ctx, next) => { ctx.log.push('never'); await next() })

		const ctx = { log: [] as string[] }
		await chain.run(ctx, async () => { ctx.log.push('final') })

		expect(ctx.log).toEqual(['blocker'])
	})

	it('allows interceptors to mutate ctx before and after next', async () => {
		const chain = new InterceptorChain<{ value: number }>()
		chain.add(async (ctx, next) => {
			ctx.value *= 2
			await next()
			ctx.value += 100
		})

		const ctx = { value: 5 }
		await chain.run(ctx, async () => { ctx.value += 1 })

		expect(ctx.value).toBe(111) // (5*2)=10, final +1=11, after +100=111
	})

	it('reports hasInterceptors and size', () => {
		const chain = new InterceptorChain<{}>()
		expect(chain.hasInterceptors).toBe(false)
		expect(chain.size).toBe(0)

		const fn = async (_ctx: {}, next: () => Promise<void>) => { await next() }
		chain.add(fn)
		expect(chain.hasInterceptors).toBe(true)
		expect(chain.size).toBe(1)

		chain.remove(fn)
		expect(chain.hasInterceptors).toBe(false)
	})

	it('runs just the final when no interceptors are registered', async () => {
		const chain = new InterceptorChain<{ ran: boolean }>()
		const ctx = { ran: false }
		await chain.run(ctx, async () => { ctx.ran = true })
		expect(ctx.ran).toBe(true)
	})
})
