/**
 * A composable middleware chain. Each interceptor receives a mutable
 * context and a `next` function. Calling `next()` continues the chain;
 * skipping it short-circuits.
 */

export type InterceptorFn<T> = (ctx: T, next: () => Promise<void>) => Promise<void>

export class InterceptorChain<T> {
	private fns: InterceptorFn<T>[] = []

	add(fn: InterceptorFn<T>): void {
		this.fns.push(fn)
	}

	remove(fn: InterceptorFn<T>): void {
		const idx = this.fns.indexOf(fn)
		if (idx !== -1) this.fns.splice(idx, 1)
	}

	get hasInterceptors(): boolean {
		return this.fns.length > 0
	}

	get size(): number {
		return this.fns.length
	}

	async run(ctx: T, final: () => Promise<void>): Promise<void> {
		let index = 0
		const fns = this.fns

		const next = async (): Promise<void> => {
			if (index < fns.length) {
				const fn = fns[index++]!
				await fn(ctx, next)
			} else {
				await final()
			}
		}

		await next()
	}
}

export interface BeforeAskCtx {
	question: string | any[]
	options?: any
	result?: string
}

export interface ToolCallCtx {
	name: string
	args: Record<string, any>
	result?: string
	error?: any
	skip?: boolean
}

export interface BeforeResponseCtx {
	text: string
}

export interface BeforeTurnCtx {
	turn: number
	isFollowUp: boolean
	messages: any[]
	skip?: boolean
}

export interface InterceptorPoints {
	beforeAsk: BeforeAskCtx
	beforeTurn: BeforeTurnCtx
	beforeToolCall: ToolCallCtx
	afterToolCall: ToolCallCtx
	beforeResponse: BeforeResponseCtx
}

export type InterceptorPoint = keyof InterceptorPoints
