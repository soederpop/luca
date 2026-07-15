import { describe, it, expect } from 'bun:test'
import { NodeContainer } from '../src/node/container'
import { tmpdir } from 'os'

/**
 * Dynamic `import()` inside VM-executed code. Without an
 * `importModuleDynamically` callback on the compiled script, any dynamic
 * import throws "A dynamic import callback was not specified" — these tests
 * pin the callback's resolution order: virtual modules first (matching
 * `require`), then referrer-relative paths, then native import.
 */
describe('VM dynamic import', () => {
	it('imports node builtins', async () => {
		const c = new NodeContainer()
		const vm = c.feature('vm')

		const result = await vm.run(`const p = await import('node:path'); p.basename('/a/b.txt')`)
		expect(result).toBe('b.txt')
	})

	it('resolves virtual modules before native resolution', async () => {
		const c = new NodeContainer()
		const vm = c.feature('vm')
		vm.defineModule('answers', { magic: 42 })

		const result = await vm.run(`const m = await import('answers'); m.magic`)
		expect(result).toBe(42)
	})

	it('exposes the virtual module exports object as the default export', async () => {
		const c = new NodeContainer()
		const vm = c.feature('vm')
		vm.defineModule('answers', { magic: 42 })

		const result = await vm.run(`(await import('answers')).default.magic`)
		expect(result).toBe(42)
	})

	it('resolves lazy virtual modules and caches the loader result', async () => {
		const c = new NodeContainer()
		const vm = c.feature('vm')
		let builds = 0
		vm.defineLazyModule('expensive', () => ({ builds: ++builds }))

		const first = await vm.run(`(await import('expensive')).builds`)
		const second = await vm.run(`(await import('expensive')).builds`)
		expect(first).toBe(1)
		expect(second).toBe(1)
	})

	it('returns the same module instance as require for virtual modules', async () => {
		const c = new NodeContainer()
		const vm = c.feature('vm')
		const shared = { hits: [] as string[] }
		vm.defineModule('shared-state', shared)

		const result = await vm.run(
			`const viaImport = await import('shared-state'); viaImport.hits === direct.hits`,
			{ direct: shared }
		)
		expect(result).toBe(true)
	})

	it('resolves relative specifiers against the filePath referrer', async () => {
		const c = new NodeContainer()
		const vm = c.feature('vm')
		const fs = c.feature('fs')

		const dir = c.paths.resolve(tmpdir(), `vm-dyn-import-${c.utils.uuid()}`)
		fs.mkdir(dir)
		const target = c.paths.resolve(dir, 'target.ts')
		fs.writeFile(target, `export const hello = 'from-relative'`)

		const referrer = c.paths.resolve(dir, 'main.ts')
		const result = await vm.run(
			`(await import('./target.ts')).hello`,
			{},
			{ filePath: referrer }
		)
		expect(result).toBe('from-relative')
	})

	it('supports dynamic import in runSync-compiled scripts that return promises', async () => {
		const c = new NodeContainer()
		const vm = c.feature('vm')
		vm.defineModule('answers', { magic: 42 })

		const promise = vm.runSync<Promise<number>>(`(async () => (await import('answers')).magic)()`)
		expect(await promise).toBe(42)
	})

	it('supports dynamic import inside runCaptured', async () => {
		const c = new NodeContainer()
		const vm = c.feature('vm')

		const { result, console: calls } = await vm.runCaptured(
			`const p = await import('node:path'); console.log('loaded'); p.basename('/x/y.md')`
		)
		expect(result).toBe('y.md')
		expect(calls).toEqual([{ method: 'log', args: ['loaded'] }])
	})
})
