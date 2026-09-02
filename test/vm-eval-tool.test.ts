import { describe, it, expect } from 'bun:test'
import { NodeContainer } from '../src/node/container'

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
})
