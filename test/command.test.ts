import { describe, it, expect } from 'bun:test'
import { Command, commands } from '../src/command'
import { graftModule, isNativeHelperClass } from '../src/graft'
import { NodeContainer } from '../src/node/container'
import { z } from 'zod'
import { CommandOptionsSchema } from '../src/schemas/base'
// Side-effect import to register built-in commands
import '../src/commands/index'

describe('graftModule', () => {
	it('creates a Command subclass from a run export', () => {
		const argsSchema = CommandOptionsSchema.extend({
			file: z.string(),
		})

		const Grafted = graftModule(Command as any, {
			description: 'Run a file',
			argsSchema,
			positionals: ['file'],
			run: async (args: any) => {},
		}, 'graft-run-test', 'commands')

		expect((Grafted as any).shortcut).toBe('commands.graft-run-test')
		expect((Grafted as any).description).toBe('Run a file')
		expect((Grafted as any).commandDescription).toBe('Run a file')
		expect((Grafted as any).positionals).toEqual(['file'])
		expect((Grafted as any).argsSchema).toBe(argsSchema)
		expect(Grafted.name).toBe('GraftRunTestCommand')
	})

	it('creates a Command subclass from a handler export (legacy)', () => {
		const Grafted = graftModule(Command as any, {
			description: 'Legacy handler',
			handler: async (opts: any, ctx: any) => {},
		}, 'graft-handler-test', 'commands')

		expect((Grafted as any).shortcut).toBe('commands.graft-handler-test')
		expect((Grafted as any).description).toBe('Legacy handler')
		expect(typeof (Grafted as any).prototype.run).toBe('function')
	})

	it('grafts extra exported functions as prototype methods', () => {
		const Grafted = graftModule(Command as any, {
			run: async () => {},
			formatOutput: function (data: any) { return JSON.stringify(data) },
		}, 'graft-methods-test', 'commands')

		expect(typeof (Grafted as any).prototype.formatOutput).toBe('function')
	})

	it('grafts getters onto the prototype', () => {
		const Grafted = graftModule(Command as any, {
			run: async () => {},
			getters: {
				isReady() { return true },
			},
		}, 'graft-getters-test', 'commands')

		const desc = Object.getOwnPropertyDescriptor((Grafted as any).prototype, 'isReady')
		expect(desc).toBeDefined()
		expect(typeof desc!.get).toBe('function')
	})
})

describe('isNativeHelperClass', () => {
	it('returns true for a direct subclass', () => {
		class MyCmd extends Command {}
		expect(isNativeHelperClass(MyCmd, Command)).toBe(true)
	})

	it('returns false for a plain function', () => {
		function notACommand() {}
		expect(isNativeHelperClass(notACommand, Command)).toBe(false)
	})

	it('returns false for null/undefined', () => {
		expect(isNativeHelperClass(null, Command)).toBe(false)
		expect(isNativeHelperClass(undefined, Command)).toBe(false)
	})

	it('returns true for the base class itself', () => {
		expect(isNativeHelperClass(Command, Command)).toBe(true)
	})
})

describe('Command.register', () => {
	it('registers a class-based command and sets shortcut', () => {
		class TestDeployCommand extends Command {
			static override description = 'Deploy to production'
		}
		Command.register(TestDeployCommand, 'test-deploy')

		expect(commands.has('test-deploy')).toBe(true)
		expect((TestDeployCommand as any).shortcut).toBe('commands.test-deploy')
		expect((TestDeployCommand as any).commandDescription).toBe('Deploy to production')
	})
})

describe('Command.dispatch', () => {
	it('calls run() with parsed args for CLI dispatch', async () => {
		let received: any = null

		const argsSchema = CommandOptionsSchema.extend({
			target: z.string().default('prod'),
		})

		const Grafted = graftModule(Command as any, {
			argsSchema,
			run: async (args: any, ctx: any) => { received = args },
		}, 'dispatch-cli-test', 'commands')

		commands.register('dispatch-cli-test', Grafted as any)
		const container = new NodeContainer()
		const cmd = container.command('dispatch-cli-test' as any)

		await cmd.dispatch({ _: ['dispatch-cli-test'], target: 'staging' }, 'cli')

		expect(received).toBeDefined()
		expect(received.target).toBe('staging')
	})

	it('maps positionals to named args for CLI dispatch', async () => {
		let received: any = null

		const argsSchema = CommandOptionsSchema.extend({
			file: z.string(),
		})

		const Grafted = graftModule(Command as any, {
			argsSchema,
			positionals: ['file'],
			run: async (args: any, ctx: any) => { received = args },
		}, 'dispatch-positional-test', 'commands')

		commands.register('dispatch-positional-test', Grafted as any)
		const container = new NodeContainer()
		const cmd = container.command('dispatch-positional-test' as any)

		// Simulate: luca dispatch-positional-test myfile.ts
		// minimist produces: { _: ['dispatch-positional-test', 'myfile.ts'] }
		await cmd.dispatch({ _: ['dispatch-positional-test', 'myfile.ts'] }, 'cli')

		expect(received).toBeDefined()
		expect(received.file).toBe('myfile.ts')
	})

	it('collects remaining positionals into an array when schema expects one', async () => {
		let received: any = null

		const argsSchema = CommandOptionsSchema.extend({
			action: z.string(),
			files: z.array(z.string()),
		})

		const Grafted = graftModule(Command as any, {
			argsSchema,
			positionals: ['action', 'files'],
			run: async (args: any, ctx: any) => { received = args },
		}, 'dispatch-glob-test', 'commands')

		commands.register('dispatch-glob-test', Grafted as any)
		const container = new NodeContainer()
		const cmd = container.command('dispatch-glob-test' as any)

		// Simulate: luca dispatch-glob-test process foo.md bar.md baz.md
		// Shell expands *.md before luca sees it
		await cmd.dispatch({ _: ['dispatch-glob-test', 'process', 'foo.md', 'bar.md', 'baz.md'] }, 'cli')

		expect(received).toBeDefined()
		expect(received.action).toBe('process')
		expect(received.files).toEqual(['foo.md', 'bar.md', 'baz.md'])
	})

	it('passes named args through for headless dispatch', async () => {
		let received: any = null

		const argsSchema = CommandOptionsSchema.extend({
			file: z.string(),
		})

		const Grafted = graftModule(Command as any, {
			argsSchema,
			positionals: ['file'],
			run: async (args: any, ctx: any) => { received = args },
		}, 'dispatch-headless-test', 'commands')

		commands.register('dispatch-headless-test', Grafted as any)
		const container = new NodeContainer()
		const cmd = container.command('dispatch-headless-test' as any)

		// Headless: named args directly, no positional mapping
		await cmd.dispatch({ file: 'script.ts' }, 'headless')

		expect(received).toBeDefined()
		expect(received.file).toBe('script.ts')
	})

	it('captures stdout/stderr for headless dispatch', async () => {
		const argsSchema = CommandOptionsSchema.extend({})

		const Grafted = graftModule(Command as any, {
			argsSchema,
			run: async (args: any, ctx: any) => {
				console.log('hello from command')
				console.error('warning: something')
			},
		}, 'dispatch-capture-test', 'commands')

		commands.register('dispatch-capture-test', Grafted as any)
		const container = new NodeContainer()
		const cmd = container.command('dispatch-capture-test' as any)

		const result = await cmd.dispatch({}, 'headless')

		expect(result).toBeDefined()
		expect(result!.exitCode).toBe(0)
		expect(result!.stdout).toContain('hello from command')
		expect(result!.stderr).toContain('warning: something')
	})

	it('captures errors for headless dispatch', async () => {
		const argsSchema = CommandOptionsSchema.extend({})

		const Grafted = graftModule(Command as any, {
			argsSchema,
			run: async () => { throw new Error('boom') },
		}, 'dispatch-error-test', 'commands')

		commands.register('dispatch-error-test', Grafted as any)
		const container = new NodeContainer()
		const cmd = container.command('dispatch-error-test' as any)

		const result = await cmd.dispatch({}, 'headless')

		expect(result).toBeDefined()
		expect(result!.exitCode).toBe(1)
		expect(result!.stderr).toContain('boom')
	})
})

describe('Command registry', () => {
	it('has built-in commands registered', () => {
		const container = new NodeContainer()
		expect(container.commands.has('run')).toBe(true)
		expect(container.commands.has('help')).toBe(true)
		expect(container.commands.has('eval')).toBe(true)
		expect(container.commands.has('chat')).toBe(true)
	})

	it('built-in commands still work through registerHandler', () => {
		const container = new NodeContainer()
		const RunClass = container.commands.lookup('run')
		expect(typeof RunClass).toBe('function')
		expect(typeof RunClass.prototype.run).toBe('function')
	})
})

describe('SimpleCommand type', () => {
	it('grafted commands have positionals as a static property', () => {
		const Grafted = graftModule(Command as any, {
			positionals: ['env', 'region'],
			run: async () => {},
		}, 'simple-cmd-type-test', 'commands')

		expect((Grafted as any).positionals).toEqual(['env', 'region'])
	})
})
