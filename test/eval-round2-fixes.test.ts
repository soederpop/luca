import { describe, it, expect } from 'bun:test'
import { Command, commands } from '../src/command'
import { graftModule } from '../src/graft'
import { NodeContainer } from '../src/node/container'
import { z } from 'zod'
import { CommandOptionsSchema } from '../src/schemas/base'
import '../src/commands/index'

describe('paths.relative', () => {
	const container = new NodeContainer()

	it('honors an absolute base argument like node path.relative', () => {
		expect(container.paths.relative('/tmp/a', '/tmp/a/b')).toBe('b')
		expect(container.paths.relative('/tmp/a/b', '/tmp/a')).toBe('..')
	})

	it('resolves a relative base against cwd', () => {
		expect(container.paths.relative('sub', 'sub/x')).toBe('x')
	})

	it('keeps the single-arg form: target relative to container cwd', () => {
		expect(container.paths.relative('sub/x')).toBe('sub/x')
		expect(container.paths.relative(container.paths.resolve('sub/x'))).toBe('sub/x')
	})
})

describe('command options._ contract', () => {
	it('exposes raw positionals at options._ through CLI dispatch', async () => {
		let received: any = null

		const Grafted = graftModule(Command as any, {
			argsSchema: CommandOptionsSchema.extend({
				action: z.string().optional(),
			}),
			positionals: ['action'],
			run: async (args: any) => { received = args },
		}, 'raw-positionals-test', 'commands')

		commands.register('raw-positionals-test', Grafted as any)
		const container = new NodeContainer()
		const cmd = container.command('raw-positionals-test' as any)

		// Simulate: luca raw-positionals-test sum 1 2 3
		await cmd.dispatch({ _: ['raw-positionals-test', 'sum', '1', '2', '3'] }, 'cli')

		expect(received).toBeDefined()
		expect(received.action).toBe('sum')
		expect(received._).toEqual(['raw-positionals-test', 'sum', '1', '2', '3'])
	})

	it('does not clobber a schema-declared _ field', async () => {
		let received: any = null

		const Grafted = graftModule(Command as any, {
			argsSchema: CommandOptionsSchema.extend({
				_: z.array(z.string()).default([]),
			}),
			run: async (args: any) => { received = args },
		}, 'declared-underscore-test', 'commands')

		commands.register('declared-underscore-test', Grafted as any)
		const container = new NodeContainer()
		const cmd = container.command('declared-underscore-test' as any)

		await cmd.dispatch({ _: ['declared-underscore-test', 'x'] }, 'cli')

		expect(Array.isArray(received._)).toBe(true)
	})
})
