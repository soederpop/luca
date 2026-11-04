import { describe, it, expect } from 'bun:test'
// '../src/node' (not '../src/node/container') so the introspection data the
// hints and the depth test read from is loaded, the same as the CLI does.
import { NodeContainer } from '../src/node'

/**
 * evalCode exists so an assistant can inspect and extend its OWN live process —
 * container in scope, itself in scope when mounted via use() — instead of
 * shelling out to `luca eval`, which is a separate amnesiac process. The
 * serializer must never throw: whatever the snippet returns (circular graphs,
 * functions, the container itself), the tool reports something readable.
 */
describe('vm evalCode tool', () => {
	it('exposes evalCode through toTools with a bound handler', async () => {
		const container = new NodeContainer()
		const bundle = container.feature('vm').toTools()
		expect(Object.keys(bundle.schemas)).toContain('evalCode')
		const out = await bundle.handlers.evalCode!({ code: '1 + 1' })
		expect(out.result).toBe(2)
	})

	it('runs against the live container, with top-level await and console capture', async () => {
		const container = new NodeContainer()
		const vm = container.feature('vm')
		const out: any = await vm.evalCode({ code: 'console.log("hi"); await Promise.resolve(); container.features.available.length' })
		expect(out.result).toBeGreaterThan(0)
		expect(out.console).toEqual([{ method: 'log', args: ['hi'] }])
	})

	it('returns errors as data instead of throwing', async () => {
		const container = new NodeContainer()
		const out: any = await container.feature('vm').evalCode({ code: 'nope()' })
		expect(out.error).toMatch(/nope/)
	})

	it('serializes circular results and functions without throwing', async () => {
		const container = new NodeContainer()
		const out: any = await container.feature('vm').evalCode({ code: 'const a = { fn: () => 1 }; a.self = a; a' })
		expect(out.result.self).toBe('[circular]')
		expect(out.result.fn).toMatch(/function/)
	})

	it('seeds virtual modules so imports and require resolve in the snippet', async () => {
		// The tool's own description promises TypeScript and
		// `import { z } from 'zod'`. Nothing else seeds the VM before an
		// assistant's first call, so evalCode has to do it itself.
		const container = new NodeContainer()
		const vm = container.feature('vm')
		expect(vm.modules.has('zod')).toBe(false)

		const imported: any = await vm.evalCode({ code: `import { z } from 'zod'\ntypeof z.string` })
		expect(imported.result).toBe('function')
		expect(vm.modules.has('zod')).toBe(true)

		const required: any = await vm.evalCode({ code: `const { defineModel } = require('contentbase'); typeof defineModel` })
		expect(required.result).toBe('function')
	})

	it('accepts TypeScript syntax and aliased imports', async () => {
		const container = new NodeContainer()
		const out: any = await container.feature('vm').evalCode({
			code: `import { z as zz } from 'zod'\nconst n: number = 41\nzz.number().parse(n) + 1`,
		})
		expect(out.result).toBe(42)
	})

	it('keeps z in scope without an import, like `luca eval` does', async () => {
		const container = new NodeContainer()
		const out: any = await container.feature('vm').evalCode({ code: `z.object({ a: z.string() }).safeParse({ a: 'x' }).success` })
		expect(out.result).toBe(true)
	})

	it('puts enabled features in scope by bare name, like `luca eval`', async () => {
		const container = new NodeContainer()
		container.feature('diskCache', { enable: true } as any)
		const out: any = await container.feature('vm').evalCode({
			code: `[typeof fs.readFile, typeof diskCache.keys]`,
		})
		expect(out.result).toEqual(['function', 'function'])
	})

	it('never lets container context occupy `assistant`', async () => {
		// The snippet scope inherits container.context, so the name has to be
		// pinned: a snippet inspecting `assistant` must get the calling
		// assistant or nothing, never a context entry that shares the name.
		const container = new NodeContainer()
		const vm = container.feature('vm')
		container.addContext('assistant' as any, { name: 'imposter' } as any)

		const bare: any = await vm.evalCode({ code: 'typeof assistant' })
		expect(bare.result).toBe('undefined')

		const mounted: any = await vm.evalCode({ code: 'assistant.name' }, { assistant: { name: 'me' } })
		expect(mounted.result).toBe('me')
	})

	it('carries values between calls when stashed with addContext', async () => {
		// The documented escape hatch from the fresh-context-per-call rule.
		const container = new NodeContainer()
		const vm = container.feature('vm')

		const gone: any = await vm.evalCode({ code: `globalThis.__scratch = 1; 'set'` })
		expect(gone.result).toBe('set')
		expect((await vm.evalCode({ code: 'typeof globalThis.__scratch' }) as any).result).toBe('undefined')

		await vm.evalCode({ code: `container.addContext('scratch', { n: 7 }); 'stashed'` })
		const kept: any = await vm.evalCode({ code: 'scratch.n' })
		expect(kept.result).toBe(7)
	})

	it('setupToolsConsumer rebinds evalCode so `assistant` is the consumer', async () => {
		const container = new NodeContainer()
		const vm = container.feature('vm')
		const added: Record<string, Function> = {}
		const consumer: any = {
			name: 'me',
			addTool: (name: string, handler: Function) => { added[name] = handler },
			addSystemPromptExtension: () => {},
		}
		vm.setupToolsConsumer(consumer)
		const out: any = await added.evalCode!({ code: 'assistant.name' })
		expect(out.result).toBe('me')
	})

	it('returns introspection JSON intact, not collapsed at depth 4', async () => {
		// Introspection nests methods → name → parameters → param → type. The
		// old flat depth cap turned every parameter into "[object Object]".
		const container = new NodeContainer()
		const out: any = await container.feature('vm').evalCode({ code: "container.features.introspect('fs')" })
		expect(typeof out.result.methods.readFile.parameters.path).toBe('object')
		expect(out.result.methods.readFile.parameters.path.type).toBeDefined()
	})

	it('accepts purpose and expectation alongside code', async () => {
		const container = new NodeContainer()
		const bundle = container.feature('vm').toTools()
		const parsed = (bundle.schemas.evalCode as any).parse({ code: '1', purpose: 'check math', expectation: '1' })
		expect(parsed.purpose).toBe('check math')
		const out = await bundle.handlers.evalCode!({ code: '1 + 1', purpose: 'check math', expectation: '2' })
		expect(out.result).toBe(2)
	})
})

/**
 * Field data from production loops showed 10-14% of evalCode snippets failing
 * on guessed API shapes, each costing a full model round trip before the agent
 * reached for describe_helper. The error itself now carries the answer, built
 * from the helpers' own introspection data so it cannot drift from the real
 * surface. Nothing is renamed; the hint points at what already exists.
 */
describe('vm evalCode error hints', () => {
	const run = async (code: string) => {
		const container = new NodeContainer()
		const out: any = await container.feature('vm').evalCode({ code })
		return out.error as string
	}

	it('names the nearest real methods, marked sync/async, for a guessed method name', async () => {
		const error = await run(`fs.readDirectoryAsync('.')`)
		expect(error).toMatch(/readDirectoryAsync is not a function/)
		expect(error).toMatch(/Hint: fs has no readDirectoryAsync/)
		expect(error).toMatch(/readdirAsync \(async\)/)
		expect(error).toMatch(/readdir \(async\)/)
		expect(error).toMatch(/luca describe fs\.readdirAsync/)
	})

	it('resolves the helper through a local alias', async () => {
		const error = await run(`const f = fs; f.readDirectoryAsync('.')`)
		expect(error).toMatch(/Hint: fs has no readDirectoryAsync/)
	})

	it('says a method is synchronous when .catch/.then is chained on it, and names the async variant', async () => {
		const error = await run(`fs.stat('package.json').catch((e) => e)`)
		expect(error).toMatch(/Hint: fs\.stat\(\) is synchronous, so there is no \.catch\(\)/)
		expect(error).toMatch(/fs\.statAsync\(\)/)

		const then = await run(`fs.readdirSync('.').then((x) => x)`)
		expect(then).toMatch(/fs\.readdirSync\(\) is synchronous/)
		expect(then).toMatch(/fs\.readdirAsync\(\)/)
	})

	it('suggests the nearest registered feature id for an unregistered one', async () => {
		const error = await run(`container.feature('procc')`)
		expect(error).toMatch(/"procc" is not registered/)
		expect(error).toMatch(/Hint: No features named "procc"\. Did you mean: proc\?/)

		// Short ids must not match by being a substring of the guess.
		const docs = await run(`container.feature('docs')`)
		expect(docs).toMatch(/Did you mean: [^?]*Docs/)
		expect(docs).not.toMatch(/Did you mean: [^?]*\bos\b/)
	})

	it('quotes the positional signature when proc.spawnAndCapture gets an options object', async () => {
		const error = await run(`await proc.spawnAndCapture({ cmd: 'ls', args: [] })`)
		expect(error).toMatch(/"file" argument must be of type string/)
		expect(error).toMatch(/Hint: proc\.spawnAndCapture\(\) takes positional arguments/)
		expect(error).toMatch(/proc\.spawnAndCapture\('cmd', \['arg1', 'arg2'\]/)

		const spawn = await run(`proc.spawn({ cmd: 'ls' })`)
		expect(spawn).toMatch(/Hint: proc\.spawn\(\) takes positional arguments/)
	})

	it('leaves unrecognised errors alone', async () => {
		expect(await run('nope()')).toBe('nope is not defined')
	})

	it('tells the assistant the container is shared and only the snippet scope resets', () => {
		const container = new NodeContainer()
		const extensions: Record<string, string> = {}
		container.feature('vm').setupToolsConsumer({ addSystemPromptExtension: (id: string, text: string) => { extensions[id] = text } })
		expect(extensions.vm).toMatch(/Your snippet's scope does not persist\. The container does/)
		expect(extensions.vm).not.toMatch(/Nothing persists between calls/)
		expect(extensions.vm).toMatch(/runLucaCommand/)
		expect(extensions.vm).toMatch(/describe_helper/)
		expect(extensions.vm).toMatch(/last-write-wins/)
	})
})
