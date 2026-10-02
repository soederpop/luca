import { describe, it, expect, spyOn } from 'bun:test'
import { tmpdir } from 'os'
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

	describe('zod virtual module', () => {
		/**
		 * The 'zod' virtual module must support every zod v4 import style user
		 * code reaches for. Each transpiles to a different access pattern on the
		 * module object, so the seeded shape has to carry all three.
		 */
		it('supports named, namespace, and default import shapes', () => {
			const c = new NodeContainer()
			c.helpers.seedVirtualModules()
			const vm = c.feature('vm')
			const zodModule = vm.createRequireFor(import.meta.path)('zod')

			// import { z } from 'zod'
			expect(typeof zodModule.z.string).toBe('function')
			// import * as z from 'zod'; z.string()
			expect(typeof zodModule.string).toBe('function')
			// import z from 'zod'
			expect(typeof zodModule.default.string).toBe('function')

			const schema = zodModule.z.object({ name: zodModule.z.string() })
			expect(schema.parse({ name: 'luca' }).name).toBe('luca')
		})

		it('a VM-loaded module can build and use a zod schema', () => {
			const c = new NodeContainer()
			c.helpers.seedVirtualModules()
			const vm = c.feature('vm')
			const transpiler = c.feature('transpiler')
			const { code } = transpiler.transformSync(`
				import { z } from 'zod'
				export const schema = z.object({ port: z.number() })
				export const parsed = schema.parse({ port: 3000 })
			`, { format: 'cjs' })
			const sharedExports = {}
			const { context } = vm.performSync(code, {
				require: vm.createRequireFor(import.meta.path),
				exports: sharedExports,
				module: { exports: sharedExports },
				console,
			})
			expect(context.module.exports.parsed.port).toBe(3000)
		})

		it('container.zod is the same zod as container.z', () => {
			const c = new NodeContainer()
			expect(c.zod).toBe(c.z)
			expect(typeof c.zod.object).toBe('function')
		})
	})

	describe('node globals in the VM context', () => {
		/**
		 * Bundled npm deps (imapflow, nodemailer, mailparser) reference global,
		 * setImmediate, and queueMicrotask at module init. The VM context must
		 * provide them or plugin features fail only inside the compiled binary.
		 */
		const GLOBALS_MODULE = `
			export function checkGlobals() {
				return {
					global: typeof global,
					setImmediate: typeof setImmediate,
					clearImmediate: typeof clearImmediate,
					queueMicrotask: typeof queueMicrotask,
					structuredClone: typeof structuredClone,
					performance: typeof performance,
					EventTarget: typeof EventTarget,
					Event: typeof Event,
				}
			}
			export function globalIsSelfReferential() {
				;(global as any).__vmMarker = 'set-via-global'
				// a bare read resolves through the contextified global, so this only
				// passes when \`global\` is the sandbox itself, not the host globalThis
				return (globalThis as any).__vmMarker === 'set-via-global'
			}
			export function runsSetImmediate(): Promise<string> {
				return new Promise(resolve => setImmediate(() => resolve('ran')))
			}
		`

		function writeGlobalsModule(c: NodeContainer): string {
			const fs = c.feature('fs')
			const dir = c.paths.resolve(tmpdir(), `vm-loadmodule-globals-${c.utils.uuid()}`)
			fs.mkdir(dir)
			const file = c.paths.resolve(dir, 'globals.ts')
			fs.writeFile(file, GLOBALS_MODULE)
			return file
		}

		async function assertGlobalsWork(c: NodeContainer, file: string) {
			const vm = c.feature('vm')
			const mod = vm.loadModule(file)
			expect(mod.checkGlobals()).toEqual({
				global: 'object',
				setImmediate: 'function',
				clearImmediate: 'function',
				queueMicrotask: 'function',
				structuredClone: 'function',
				performance: 'object',
				EventTarget: 'function',
				Event: 'function',
			})
			expect(mod.globalIsSelfReferential()).toBe(true)
			expect(await mod.runsSetImmediate()).toBe('ran')
		}

		it('provides them on the plain transpile path', async () => {
			const c = new NodeContainer()
			await assertGlobalsWork(c, writeGlobalsModule(c))
		})

		it('provides them on the bundled path (virtual modules seeded)', async () => {
			const c = new NodeContainer()
			c.helpers.seedVirtualModules()
			await assertGlobalsWork(c, writeGlobalsModule(c))
		})

		it('bundled dynamic import of an inlined CJS dep yields its named exports', async () => {
			const c = new NodeContainer()
			c.helpers.seedVirtualModules() // force the _loadModuleBundled path
			const fs = c.feature('fs')
			const vm = c.feature('vm')

			const dir = c.paths.resolve(tmpdir(), `vm-loadmodule-interop-${c.utils.uuid()}`)
			fs.mkdir(dir)
			// mimics imapflow: CJS module that touches `global` at init and exports a class
			fs.writeFile(c.paths.resolve(dir, 'dep.js'), `
				global.__depInit = true
				class ImapFlow { constructor() { this.ok = true } }
				module.exports.ImapFlow = ImapFlow
			`)
			const entry = c.paths.resolve(dir, 'entry.ts')
			fs.writeFile(entry, `
				export async function connect() {
					const { ImapFlow } = await import('./dep.js')
					return new ImapFlow().ok
				}
			`)

			const mod = vm.loadModule(entry)
			expect(await mod.connect()).toBe(true)
		})
	})

	describe('unbundled fallback (bun build fails)', () => {
		function writeGraph(c: NodeContainer, files: Record<string, string>): string {
			const fs = c.feature('fs')
			const dir = c.paths.resolve(tmpdir(), `vm-loadmodule-fallback-${c.utils.uuid()}`)
			fs.mkdir(dir)
			for (const [name, src] of Object.entries(files)) fs.writeFile(c.paths.resolve(dir, name), src)
			return dir
		}

		it('routes relative imports back through the VM so they still see virtual modules', () => {
			const c = new NodeContainer()
			c.helpers.seedVirtualModules()
			const vm = c.feature('vm')
			vm.defineModule('probe', { token: 'T' })
			// `require('./missing')` is never called, but the bundler must resolve it
			// statically and fails — that forces the unbundled path for entry.ts.
			const dir = writeGraph(c, {
				'entry.ts': `
					import { token } from 'probe'
					import { deep } from './helper'
					export const fromEntry = token
					export const viaHelper = deep
					export function lazy() { return require('./missing') }
				`,
				'helper.ts': `
					import { token } from 'probe'
					export const deep = token + '-helper'
				`,
			})

			const warn = spyOn(console, 'warn').mockImplementation(() => {})
			try {
				const mod = vm.loadModule(c.paths.resolve(dir, 'entry.ts'))
				expect(mod.fromEntry).toBe('T')
				expect(mod.viaHelper).toBe('T-helper')
				// the bundler's own diagnostic is surfaced, not swallowed
				expect(warn).toHaveBeenCalledTimes(1)
				expect(String(warn.mock.calls[0][0])).toContain('Could not resolve: "./missing"')
			} finally {
				warn.mockRestore()
			}
		})

		it('a shared dependency executes once per load', () => {
			const c = new NodeContainer()
			c.helpers.seedVirtualModules()
			const vm = c.feature('vm')
			const dir = writeGraph(c, {
				'entry.ts': `
					import { id as a } from './a'
					import { id as b } from './b'
					export const same = a === b
					export function lazy() { return require('./missing') }
				`,
				'a.ts': `export { id } from './shared'`,
				'b.ts': `export { id } from './shared'`,
				'shared.ts': `export const id = Symbol('once')`,
			})
			const warn = spyOn(console, 'warn').mockImplementation(() => {})
			try {
				expect(vm.loadModule(c.paths.resolve(dir, 'entry.ts')).same).toBe(true)
			} finally {
				warn.mockRestore()
			}
		})

		it('reports the bundler error and the real missing file when nothing can load', () => {
			const c = new NodeContainer()
			c.helpers.seedVirtualModules()
			const vm = c.feature('vm')
			// the missing file is two imports deep — the error must name it, not just the entry
			const dir = writeGraph(c, {
				'entry.ts': `import { x } from './mid'; export const y = x`,
				'mid.ts': `import { x } from './gone'; export { x }`,
			})
			let err: any
			try { vm.loadModule(c.paths.resolve(dir, 'entry.ts')) } catch (e) { err = e }
			expect(err).toBeDefined()
			expect(err.message).toContain('bun build said')
			expect(err.message).toContain('Could not resolve: "./gone"')
			expect(err.message).toContain('Unbundled fallback said')
			expect(err.message).toContain('./gone')
		})

		it('names a circular import instead of recursing forever', () => {
			const c = new NodeContainer()
			c.helpers.seedVirtualModules()
			const vm = c.feature('vm')
			const dir = writeGraph(c, {
				'entry.ts': `import { b } from './b'; export const a = 1; export const viaB = b; export function lazy() { return require('./missing') }`,
				'b.ts': `import { a } from './entry'; export const b = a; export function lazy() { return require('./missing') }`,
			})
			expect(() => vm.loadModule(c.paths.resolve(dir, 'entry.ts'))).toThrow(/circular import/)
		})
	})

	describe('missing files', () => {
		it('loadModule throws a descriptive error naming the path', () => {
			const c = new NodeContainer()
			const vm = c.feature('vm')
			const missing = c.paths.resolve(tmpdir(), `vm-loadmodule-missing-${c.utils.uuid()}.ts`)
			expect(() => vm.loadModule(missing)).toThrow(missing)
			expect(() => vm.loadModule(missing)).toThrow(/not found/)
		})

		it('tryLoadModule returns null for a missing file', () => {
			const c = new NodeContainer()
			const vm = c.feature('vm')
			const missing = c.paths.resolve(tmpdir(), `vm-tryload-missing-${c.utils.uuid()}.ts`)
			expect(vm.tryLoadModule(missing)).toBeNull()
		})

		it('tryLoadModule loads an existing module and still propagates execution errors', () => {
			const c = new NodeContainer()
			const fs = c.feature('fs')
			const vm = c.feature('vm')
			const dir = c.paths.resolve(tmpdir(), `vm-tryload-${c.utils.uuid()}`)
			fs.mkdir(dir)

			const good = c.paths.resolve(dir, 'good.ts')
			fs.writeFile(good, 'export const ok = true')
			expect(vm.tryLoadModule(good)?.ok).toBe(true)

			const broken = c.paths.resolve(dir, 'broken.ts')
			fs.writeFile(broken, "throw new Error('boom from module')")
			expect(() => vm.tryLoadModule(broken)).toThrow('boom from module')
		})
	})
})
