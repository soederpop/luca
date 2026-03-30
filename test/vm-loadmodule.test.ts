import { describe, it, expect } from 'bun:test'
import { NodeContainer } from '../src/node/container'

/**
 * Tests for the vm.loadModule pipeline: TypeScript source → esmToCjs → performSync → exports.
 *
 * These tests exercise the transpiler+VM execution path in isolation by running
 * TypeScript code strings directly through transpiler.transformSync + vm.performSync,
 * exactly as loadModule does internally.
 */

function runModule(c: NodeContainer, ts: string, ctx: Record<string, any> = {}): Record<string, any> {
	const transpiler = c.feature('transpiler')
	const vm = c.feature('vm')
	const { code } = transpiler.transformSync(ts, { format: 'cjs' })
	const sharedExports = {}
	const { context } = vm.performSync(code, {
		require: (id: string) => require(id),
		exports: sharedExports,
		module: { exports: sharedExports },
		console,
		...ctx,
	})
	return context.module?.exports || context.exports || {}
}

describe('vm.loadModule pipeline', () => {
	describe('export const / let / var', () => {
		it('exports a const', () => {
			const c = new NodeContainer()
			const exports = runModule(c, `export const x = 42`)
			expect(exports.x).toBe(42)
		})

		it('exports a let', () => {
			const c = new NodeContainer()
			const exports = runModule(c, `export let name = 'hello'`)
			expect(exports.name).toBe('hello')
		})

		it('exports multiple consts', () => {
			const c = new NodeContainer()
			const exports = runModule(c, `
				export const a = 1
				export const b = 2
				export const c = 3
			`)
			expect(exports.a).toBe(1)
			expect(exports.b).toBe(2)
			expect(exports.c).toBe(3)
		})

		it('exports a const object', () => {
			const c = new NodeContainer()
			const exports = runModule(c, `
				export const schemas = { rg: 'search', ls: 'list' }
			`)
			expect(exports.schemas).toEqual({ rg: 'search', ls: 'list' })
		})
	})

	describe('export function', () => {
		it('exports a named function', () => {
			const c = new NodeContainer()
			const exports = runModule(c, `
				export function greet(name: string): string {
					return 'hello ' + name
				}
			`)
			expect(typeof exports.greet).toBe('function')
			expect(exports.greet('world')).toBe('hello world')
		})

		it('exports an async function', () => {
			const c = new NodeContainer()
			const exports = runModule(c, `
				export async function fetchData(): Promise<string> {
					return 'data'
				}
			`)
			expect(typeof exports.fetchData).toBe('function')
		})

		it('exports multiple functions', () => {
			const c = new NodeContainer()
			const exports = runModule(c, `
				export function add(a: number, b: number) { return a + b }
				export function multiply(a: number, b: number) { return a * b }
			`)
			expect(exports.add(2, 3)).toBe(5)
			expect(exports.multiply(2, 3)).toBe(6)
		})
	})

	describe('export { ... }', () => {
		it('exports from a named export block', () => {
			const c = new NodeContainer()
			const exports = runModule(c, `
				const foo = 'foo'
				const bar = 42
				export { foo, bar }
			`)
			expect(exports.foo).toBe('foo')
			expect(exports.bar).toBe(42)
		})

		it('exports with renaming', () => {
			const c = new NodeContainer()
			const exports = runModule(c, `
				const internal = 'value'
				export { internal as external }
			`)
			expect(exports.external).toBe('value')
			expect(exports.internal).toBeUndefined()
		})
	})

	describe('export default', () => {
		it('exports a default value', () => {
			const c = new NodeContainer()
			const exports = runModule(c, `export default 99`)
			expect(exports.default).toBe(99)
		})

		it('exports a default object', () => {
			const c = new NodeContainer()
			const exports = runModule(c, `export default { key: 'value' }`)
			expect(exports.default).toEqual({ key: 'value' })
		})
	})

	describe('TypeScript features', () => {
		it('strips type annotations', () => {
			const c = new NodeContainer()
			const exports = runModule(c, `
				export function identity<T>(value: T): T {
					return value
				}
			`)
			expect(exports.identity('test')).toBe('test')
			expect(exports.identity(42)).toBe(42)
		})

		it('strips import type statements', () => {
			const c = new NodeContainer()
			// import type should be stripped entirely — no runtime require
			const exports = runModule(c, `
				import type { SomeType } from 'some-module'
				export const x = 1
			`)
			expect(exports.x).toBe(1)
		})

		it('strips declare global blocks', () => {
			const c = new NodeContainer()
			const exports = runModule(c, `
				declare global {
					var container: any
				}
				export const answer = 42
			`)
			expect(exports.answer).toBe(42)
		})
	})

	describe('context injection', () => {
		it('injected context variables are accessible in module code', () => {
			const c = new NodeContainer()
			const exports = runModule(c, `
				export function getGreeting(): string {
					return greeting + ' world'
				}
			`, { greeting: 'hello' })
			expect(exports.getGreeting()).toBe('hello world')
		})

		it('injected functions are callable from exported functions', () => {
			const c = new NodeContainer()
			const log: string[] = []
			const exports = runModule(c, `
				export function run() {
					record('called')
				}
			`, { record: (s: string) => log.push(s) })
			exports.run()
			expect(log).toEqual(['called'])
		})
	})

	describe('mixed exports (tools.ts pattern)', () => {
		it('handles the schemas + named functions pattern used by assistant tools', () => {
			const c = new NodeContainer()
			const exports = runModule(c, `
				export const schemas = {
					echo: { description: 'echo a value', properties: { text: {} } }
				}

				export function echo({ text }: { text: string }): string {
					return text
				}

				export async function asyncOp(): Promise<string> {
					return 'done'
				}
			`)
			expect(exports.schemas).toBeDefined()
			expect(exports.schemas.echo.description).toBe('echo a value')
			expect(typeof exports.echo).toBe('function')
			expect(exports.echo({ text: 'hi' })).toBe('hi')
			expect(typeof exports.asyncOp).toBe('function')
		})
	})
})
