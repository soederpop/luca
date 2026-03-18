import { Helper } from './helper.js'
import type { Container, ContainerContext } from './container.js'
import { Registry } from './registry.js'
import { CommandStateSchema, CommandOptionsSchema, CommandEventsSchema, type DispatchSource, type CommandRunResult } from './schemas/base.js'
import { z } from 'zod'
import { join } from 'path'
import { graftModule, isNativeHelperClass } from './graft.js'

export type { DispatchSource, CommandRunResult }

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

/**
 * Type helper for module-augmentation of AvailableCommands when using the
 * SimpleCommand (module-based) pattern instead of a full class.
 *
 * @example
 * ```typescript
 * declare module '@soederpop/luca' {
 *   interface AvailableCommands {
 *     serve: SimpleCommand<typeof argsSchema>
 *   }
 * }
 * ```
 */
export type SimpleCommand<Schema extends z.ZodType = z.ZodType> = typeof Command & {
	argsSchema: Schema
	positionals: string[]
}

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
	static positionals: string[] = []

	/** Self-register a Command subclass from a static initialization block. */
	static register: (SubClass: typeof Command, id?: string) => typeof Command

	override get initialState(): T {
		return ({ running: false } as unknown) as T
	}

	/**
	 * Parse raw CLI argv against this command's argsSchema.
	 * Kept for backward compatibility with built-in commands.
	 */
	parseArgs(): any {
		const schema = (this.constructor as typeof Command).argsSchema
		return schema.parse(this.container.options)
	}

	/**
	 * The user-defined command payload. Override this in class-based commands,
	 * or export a `run` function in module-based commands.
	 *
	 * Receives clean, named args (positionals already mapped) and the container context.
	 */
	async run(_args: any, _context: ContainerContext): Promise<void> {
		// override in subclass or grafted from module export
	}

	/**
	 * Internal dispatch normalizer. Maps positionals for CLI, passes through named
	 * args for headless, validates via argsSchema, captures output when headless.
	 *
	 * @param rawInput - Named args object. When omitted, reads from container.argv.
	 * @param source - Override the dispatch source. Defaults to constructor option.
	 */
	async execute(rawInput?: Record<string, any>, source?: DispatchSource): Promise<CommandRunResult | void> {
		const dispatchSource = source ?? (this._options as any).dispatchSource ?? 'cli'
		const Cls = this.constructor as typeof Command

		// Help intercept (CLI only) — must happen before schema validation
		// so `luca somecommand --help` works even without required args
		if (dispatchSource === 'cli' && (this.container as any).argv?.help) {
			const { formatCommandHelp } = await import('./commands/help.js')
			const ui = (this.container as any).feature('ui')
			const name = Cls.shortcut?.replace('commands.', '') || 'unknown'
			console.log(formatCommandHelp(name, this.constructor, ui.colors))
			return
		}

		// Build named args from raw input
		const raw = rawInput ?? { ...(this.container as any).argv }
		const named = this._normalizeInput(raw, dispatchSource)

		// Validate against argsSchema
		const parsed = Cls.argsSchema.parse(named)

		// For headless dispatch, capture stdout/stderr
		if (dispatchSource !== 'cli') {
			return this._runCaptured(parsed)
		}

		// CLI path — lifecycle events + run
		this.state.set('running', true)
		this.emit('started')

		try {
			await this.run(parsed, this.context)
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

	/**
	 * The public entry point for dispatching a command.
	 * Called by the CLI and other dispatch surfaces.
	 */
	async dispatch(rawInput?: Record<string, any>, source?: DispatchSource): Promise<CommandRunResult | void> {
		return this.execute(rawInput, source)
	}

	/**
	 * Map CLI positional args to named fields based on the command's positionals declaration.
	 * For non-CLI dispatch, args are already named — pass through.
	 */
	private _normalizeInput(raw: Record<string, any>, source: DispatchSource): Record<string, any> {
		if (source !== 'cli') return raw

		const Cls = this.constructor as typeof Command
		const positionals = Cls.positionals
		if (!positionals.length) return raw

		const result = { ...raw }

		// Map raw._[1], raw._[2], etc. (skipping _[0] which is command name) to named fields
		const posArgs: string[] = (raw._ || []).slice(1)
		for (let i = 0; i < positionals.length; i++) {
			const name = positionals[i]!
			if (result[name] !== undefined) continue
			if (posArgs[i] === undefined) continue

			// Last positional collects all remaining args if the schema expects an array
			if (i === positionals.length - 1 && posArgs.length > positionals.length) {
				const isArray = this._schemaExpectsArray(Cls.argsSchema, name)
				if (isArray) {
					result[name] = posArgs.slice(i)
					continue
				}
			}

			result[name] = posArgs[i]
		}

		return result
	}

	/**
	 * Check whether a Zod schema expects an array type for a given field.
	 * Unwraps ZodObject → ZodOptional/ZodDefault/ZodNullable → ZodArray.
	 */
	private _schemaExpectsArray(schema: z.ZodType, field: string): boolean {
		try {
			const shape = typeof (schema as any)?._def?.shape === 'function'
				? (schema as any)._def.shape()
				: (schema as any)?._def?.shape
			if (!shape || !shape[field]) return false
			let inner = shape[field]
			// Unwrap wrappers (optional, default, nullable)
			while (inner) {
				if (inner instanceof z.ZodArray) return true
				if (inner._def?.innerType) { inner = inner._def.innerType; continue }
				if (inner._def?.schema) { inner = inner._def.schema; continue }
				break
			}
			return false
		} catch {
			return false
		}
	}

	/**
	 * Run the command with stdout/stderr capture for headless dispatch.
	 * Returns a CommandRunResult with captured output.
	 *
	 * NOTE: Uses global console mutation — not safe for concurrent headless dispatches.
	 * A future iteration should pass a logger through context instead.
	 */
	private async _runCaptured(args: any): Promise<CommandRunResult> {
		const captured = { stdout: '', stderr: '' }
		const origLog = console.log.bind(console)
		const origErr = console.error.bind(console)

		console.log = (...a: any[]) => { captured.stdout += a.join(' ') + '\n' }
		console.error = (...a: any[]) => { captured.stderr += a.join(' ') + '\n' }

		let exitCode = 0
		try {
			this.state.set('running', true)
			this.emit('started')
			await this.run(args, this.context)
			this.state.set('exitCode', 0)
			this.emit('completed', 0)
		} catch (err: any) {
			exitCode = 1
			this.state.set('exitCode', 1)
			this.emit('failed', err)
			captured.stderr += (err?.message || String(err)) + '\n'
		} finally {
			console.log = origLog
			console.error = origErr
			this.state.set('running', false)
		}

		return { exitCode, stdout: captured.stdout, stderr: captured.stderr }
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

	/**
	 * Internal: register a command from a handler function.
	 * Used by built-in commands. External commands should use the module export pattern.
	 */
	registerHandler<T = any>(
		name: string,
		opts: {
			description?: string
			argsSchema?: z.ZodType
			handler: CommandHandler<T>
		},
	) {
		const CommandClass = graftModule(
			Command as any,
			{
				description: opts.description,
				argsSchema: opts.argsSchema,
				handler: opts.handler,
			},
			name,
			'commands',
		) as any

		return this.register(name, CommandClass)
	}

	/**
	 * Discover and register commands from a directory.
	 * Detection order:
	 *   1. Default export is a class extending Command → register directly
	 *   2. Module exports a `run` function → graft as SimpleCommand
	 *   3. Module exports a `handler` function → legacy graft
	 */
	async discover(options: { directory: string }) {
		const { Glob } = globalThis.Bun || (await import('bun'))
		const glob = new Glob('*.ts')

		for await (const file of glob.scan({ cwd: options.directory })) {
			if (file === 'index.ts') continue

			const name = file.replace(/\.ts$/, '')
			if (this.has(name)) continue

			const mod = await import(join(options.directory, file))

			// 1. Class-based: default export extends Command
			if (isNativeHelperClass(mod.default, Command)) {
				const ExportedClass = mod.default
				if (!ExportedClass.shortcut || ExportedClass.shortcut === 'commands.base') {
					ExportedClass.shortcut = `commands.${name}`
				}
				if (!ExportedClass.commandDescription && ExportedClass.description) {
					ExportedClass.commandDescription = ExportedClass.description
				}
				this.register(name, ExportedClass)
				continue
			}

			const commandModule = mod.default || mod

			// 2. Module-based with `run` export (new SimpleCommand pattern)
			if (typeof commandModule.run === 'function') {
				const Grafted = graftModule(Command as any, commandModule, name, 'commands')
				this.register(name, Grafted as any)
				continue
			}

			// 3. Legacy: `handler` export
			if (typeof commandModule.handler === 'function') {
				const Grafted = graftModule(Command as any, {
					description: commandModule.description,
					argsSchema: commandModule.argsSchema,
					handler: commandModule.handler,
				}, name, 'commands')
				this.register(name, Grafted as any)
				continue
			}

			// 4. Plain default-exported function: export default async function name(options, context)
			if (typeof mod.default === 'function' && !isNativeHelperClass(mod.default, Command)) {
				const Grafted = graftModule(Command as any, {
					description: mod.description || '',
					argsSchema: mod.argsSchema,
					positionals: mod.positionals,
					handler: mod.default,
				}, name, 'commands')
				this.register(name, Grafted as any)
			}
		}
	}
}

export const commands = new CommandsRegistry()
export const helperCache = new Map()

/**
 * Self-register a Command subclass from a static initialization block.
 * Mirrors Feature.register / Client.register / Server.register pattern.
 *
 * @example
 * ```typescript
 * export class DeployCommand extends Command {
 *   static override description = 'Deploy to production'
 *   static override argsSchema = deployArgsSchema
 *   static override positionals = ['environment']
 *   static { Command.register(this, 'deploy') }
 *
 *   override async run(args, context) { ... }
 * }
 * ```
 */
Command.register = function registerCommand(
	SubClass: typeof Command,
	id?: string,
) {
	const registryId = id ?? (SubClass.name
		? SubClass.name[0]!.toLowerCase() + SubClass.name.slice(1).replace(/Command$/, '')
		: `command_${Date.now()}`)

	if (!Object.getOwnPropertyDescriptor(SubClass, 'shortcut')?.value ||
		(SubClass as any).shortcut === 'commands.base') {
		;(SubClass as any).shortcut = `commands.${registryId}`
	}

	if (!(SubClass as any).commandDescription && (SubClass as any).description) {
		;(SubClass as any).commandDescription = (SubClass as any).description
	}

	commands.register(registryId, SubClass as any)

	if (!Object.getOwnPropertyDescriptor(SubClass, 'attach')) {
		;(SubClass as any).attach = (container: any) => {
			commands.register(registryId, SubClass as any)
			return container
		}
	}

	return SubClass
}

export { graftModule, isNativeHelperClass } from './graft.js'

export default Command
