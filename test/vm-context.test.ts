import { describe, it, expect } from 'bun:test'
import { NodeContainer } from '../src/node/container'

/**
 * These tests verify the VM context preservation behavior that `luca run`
 * depends on for markdown execution. When running sequential code blocks
 * in a shared context, variables defined in earlier blocks must be accessible
 * in later blocks — as long as the blocks don't use top-level await (which
 * wraps code in an async IIFE and isolates the scope).
 */
describe('VM context preservation across sequential runs', () => {
	it('preserves const declarations across runs without await', async () => {
		const c = new NodeContainer()
		const vm = c.feature('vm')
		const shared = vm.createContext({})

		await vm.run('const x = 42', shared)
		const result = await vm.run('x', shared)

		expect(result).toBe(42)
	})

	it('preserves let declarations across runs without await', async () => {
		const c = new NodeContainer()
		const vm = c.feature('vm')
		const shared = vm.createContext({})

		await vm.run('let count = 0', shared)
		await vm.run('count += 10', shared)
		const result = await vm.run('count', shared)

		expect(result).toBe(10)
	})

	it('preserves function declarations across runs', async () => {
		const c = new NodeContainer()
		const vm = c.feature('vm')
		const shared = vm.createContext({})

		await vm.run('function double(n) { return n * 2 }', shared)
		const result = await vm.run('double(21)', shared)

		expect(result).toBe(42)
	})

	it('preserves arrow functions assigned to const', async () => {
		const c = new NodeContainer()
		const vm = c.feature('vm')
		const shared = vm.createContext({})

		await vm.run('const greet = (name) => `hello ${name}`', shared)
		const result = await vm.run('greet("world")', shared)

		expect(result).toBe('hello world')
	})

	it('preserves objects and allows mutation across runs', async () => {
		const c = new NodeContainer()
		const vm = c.feature('vm')
		const shared = vm.createContext({})

		await vm.run('const data = { items: [] }', shared)
		await vm.run('data.items.push("a", "b")', shared)
		await vm.run('data.items.push("c")', shared)
		const result = await vm.run('data.items', shared)

		expect(result).toEqual(['a', 'b', 'c'])
	})

	it('preserves class declarations across runs', async () => {
		const c = new NodeContainer()
		const vm = c.feature('vm')
		const shared = vm.createContext({})

		await vm.run('class Counter { constructor() { this.n = 0 } inc() { this.n++ } }', shared)
		await vm.run('const counter = new Counter(); counter.inc(); counter.inc()', shared)
		const result = await vm.run('counter.n', shared)

		expect(result).toBe(2)
	})

	it('later blocks can compose values from earlier blocks', async () => {
		const c = new NodeContainer()
		const vm = c.feature('vm')
		const shared = vm.createContext({})

		await vm.run('const firstName = "Jane"', shared)
		await vm.run('const lastName = "Doe"', shared)
		await vm.run('const fullName = `${firstName} ${lastName}`', shared)
		const result = await vm.run('fullName', shared)

		expect(result).toBe('Jane Doe')
	})

	it('top-level await blocks lose const/let scope (known limitation)', async () => {
		const c = new NodeContainer()
		const vm = c.feature('vm')
		const shared = vm.createContext({})

		// This block has await, so it gets wrapped in (async () => { ... })()
		// The const is scoped to that IIFE and doesn't leak to the shared context
		await vm.run('const val = await Promise.resolve(99)', shared)
		const result = await vm.run('typeof val', shared)

		expect(result).toBe('undefined')
	})

	it('top-level await blocks can share state via pre-existing context properties', async () => {
		const c = new NodeContainer()
		const vm = c.feature('vm')
		const shared = vm.createContext({ result: null })

		// Assigning to an existing context property works even inside the IIFE
		await vm.run('result = await Promise.resolve("async value")', shared)
		const value = await vm.run('result', shared)

		expect(value).toBe('async value')
	})
})

describe('VM wrapTopLevelAwait', () => {
	it('does not wrap code without await', () => {
		const c = new NodeContainer()
		const vm = c.feature('vm')

		const code = 'const x = 42'
		expect(vm.wrapTopLevelAwait(code)).toBe(code)
	})

	it('wraps code containing await in an async IIFE', () => {
		const c = new NodeContainer()
		const vm = c.feature('vm')

		const wrapped = vm.wrapTopLevelAwait('const x = await fetch("http://example.com")')
		expect(wrapped).toContain('async')
		expect(wrapped).toContain('await fetch')
	})

	it('does not wrap code already in an async function', () => {
		const c = new NodeContainer()
		const vm = c.feature('vm')

		const code = 'async function go() { await fetch("http://example.com") }'
		expect(vm.wrapTopLevelAwait(code)).toBe(code)
	})
})
