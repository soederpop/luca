import { Helper } from './helper.js'
import type { Container, ContainerContext } from './container.js'
import { Registry } from './registry.js'
import { CommandStateSchema, CommandOptionsSchema, CommandEventsSchema } from './schemas/base.js'
import { z } from 'zod'
import { join } from 'path'

export type CommandState = z.infer<typeof CommandStateSchema>
export type CommandOptions = z.infer<typeof CommandOptionsSchema>

export interface AvailableCommands {}

export type CommandFactory = <T extends keyof AvailableCommands>(
	key: T,
	options?: ConstructorParameters<AvailableCommands[T]>[0]
) => NonNullable<InstanceType<AvailableCommands[T]>>

export interface CommandsInterface {
	commands: CommandsRegistry
	command: CommandFactory
}

export type CommandHandler<T = any> = (options: T, context: ContainerContext) => Promise<void>

export class Command<
	T extends CommandState = CommandState,
	K extends CommandOptions = CommandOptions
> extends Helper<T, K> {
	static override shortcut = 'commands.base'
	static override description = 'Base command'
	static override stateSchema = CommandStateSchema
	static override optionsSchema = CommandOptionsSchema
	static override eventsSchema = CommandEventsSchema

	static commandDescription: string = ''
	static argsSchema: z.ZodType = CommandOptionsSchema

	override get initialState(): T {
		return ({ running: false } as unknown) as T
	}

	parseArgs(): any {
		const schema = (this.constructor as typeof Command).argsSchema
		return schema.parse(this.container.options)
	}

	async execute(): Promise<void> {
		// override in subclass
	}

	async run(): Promise<void> {
		this.state.set('running', true)
		this.emit('started')

		try {
			await this.execute()
			this.state.set('running', false)
			this.state.set('exitCode', 0)
			this.emit('completed', 0)
		} catch (err: any) {
			this.state.set('running', false)
			this.state.set('exitCode', 1)
			this.emit('failed', err)
			throw err
		}
	}

	static attach(container: Container<any> & CommandsInterface) {
		container.commands = commands

		Object.assign(container, {
			command<T extends keyof AvailableCommands>(
				id: T,
				options?: ConstructorParameters<AvailableCommands[T]>[0]
			): NonNullable<InstanceType<AvailableCommands[T]>> {
				const BaseClass = commands.lookup(id as string) as any

				return container.createHelperInstance({
					cache: helperCache,
					type: 'command',
					id: String(id),
					BaseClass,
					options,
					fallbackName: String(id),
				}) as NonNullable<InstanceType<AvailableCommands[T]>>
			},
		})

		container.registerHelperType('commands', 'command')
		return container
	}
}

export class CommandsRegistry extends Registry<Command<any>> {
	override scope = 'commands'
	override baseClass = Command as any

	registerHandler<T = any>(
		name: string,
		opts: {
			description?: string
			argsSchema?: z.ZodType
			handler: CommandHandler<T>
		},
	) {
		const handler = opts.handler
		const argsSchema = opts.argsSchema || CommandOptionsSchema
		const desc = opts.description || ''

		const CommandClass = class extends Command {
			static override shortcut = `commands.${name}` as const
			static override description = desc
			static override commandDescription = desc
			static override optionsSchema = argsSchema as any
			static override argsSchema = argsSchema

			override async execute() {
				await handler(this.parseArgs(), this.context)
			}
		}

		Object.defineProperty(CommandClass, 'name', { value: `${name}Command` })

		return this.register(name, CommandClass as any)
	}

	async discover(options: { directory: string }) {
		const { Glob } = globalThis.Bun || (await import('bun'))
		const glob = new Glob('*.ts')

		for await (const file of glob.scan({ cwd: options.directory })) {
			if (file === 'index.ts') continue

			const mod = await import(join(options.directory, file))
			const commandModule = mod.default || mod

			// Support export-based command files (like endpoints).
			// If the module exports a handler function, register it
			// using the filename as the command name.
			if (typeof commandModule.handler === 'function' && !this.has(file.replace(/\.ts$/, ''))) {
				const name = file.replace(/\.ts$/, '')
				this.registerHandler(name, {
					description: commandModule.description || '',
					argsSchema: commandModule.argsSchema,
					handler: commandModule.handler,
				})
			}
		}
	}
}

export const commands = new CommandsRegistry()
export const helperCache = new Map()

export default Command
