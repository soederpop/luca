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
 * A positional argument declaration. Plain strings map argv positions to named
 * fields; the object form additionally carries help metadata when there is no
 * matching argsSchema field to describe it.
 */
export type PositionalSpec = string | {
	name: string
	description?: string
	required?: boolean
}

/**
 * A single usage example shown in `--help` output. The object form adds a
 * one-line description rendered above the command.
 */
export type CommandExample = string | { command: string, description?: string }

/**
 * Declarative metadata for one subcommand, rendered by the help system and
 * used for focused help (`luca <cmd> <sub> --help`).
 */
export interface SubcommandSpec {
	/** One-line description of what the subcommand does */
	description: string
	/** Positional signature shown in help, e.g. '<name> [outDir]' */
	args?: string
	/** Usage examples specific to this subcommand */
	examples?: CommandExample[]
}

/** Extract the field names from a positionals declaration (variadic `...` prefix stripped). */
export function positionalNames(positionals: PositionalSpec[]): string[] {
	return positionals.map((p) => (typeof p === 'string' ? p : p.name).replace(/^\.\.\./, ''))
}

/**
 * Handler options type for module-based commands: the inferred argsSchema
 * fields plus the raw positional array (`_[0]` is the command name).
 *
 * @example
 * ```typescript
 * export default async function myCmd(options: CommandArgs<typeof argsSchema>, context: ContainerContext) {
 *   options._ // string[] — raw positionals, typed
 * }
 * ```
 */
export type CommandArgs<S extends z.ZodType> = z.infer<S> & { _: string[] }

/** Get the field shape of a Zod object schema, tolerating Zod v4 internals. Returns null for non-object schemas. */
function schemaShape(schema: any): Record<string, any> | null {
	try {
		const shape = typeof schema?._def?.shape === 'function' ? schema._def.shape() : schema?._def?.shape
		return shape || null
	} catch {
		return null
	}
}

/** Walk through Zod wrapper types (optional/default/nullable/...) to the base type name ('string', 'boolean', 'number', 'array', 'enum', ...). */
function zodBaseType(field: any): string | undefined {
	let current = field
	for (let i = 0; current && i < 12; i++) {
		const t = current._def?.type || current.type
		if (t === 'optional' || t === 'default' || t === 'nullable' || t === 'readonly' || t === 'catch') {
			current = current._def?.innerType
			continue
		}
		if (t === 'pipe') {
			current = current._def?.in
			continue
		}
		return t
	}
	return undefined
}

/** Unwrap to the ZodArray element schema for a field, or undefined when the field isn't an array. */
function zodArrayElement(field: any): any {
	let current = field
	for (let i = 0; current && i < 12; i++) {
		const t = current._def?.type || current.type
		if (t === 'array') return current._def?.element ?? current.element
		current = current._def?.innerType ?? current._def?.schema
	}
	return undefined
}

const kebabCase = (s: string) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()

/**
 * Derive minimist parser options from a command's argsSchema so flag parsing
 * agrees with the schema: boolean flags never consume a following positional,
 * and string-typed flags keep numeric-looking values as strings.
 *
 * `--help` and `--verbose` are always treated as booleans unless the schema
 * declares them otherwise. Kebab-case aliases are included for camelCase fields.
 */
export function minimistOptionsFor(schema?: z.ZodType): { boolean: string[]; string: string[] } {
	const boolean = new Set<string>(['help', 'verbose'])
	const string = new Set<string>()
	const shape = schemaShape(schema)

	if (shape) {
		for (const [key, field] of Object.entries(shape)) {
			if (key === '_') continue
			const t = zodBaseType(field)
			if (t === 'boolean') {
				boolean.add(key)
			} else {
				boolean.delete(key)
				if (t === 'string' || t === 'enum') string.add(key)
			}
		}
	}

	// Users type kebab-case flags for camelCase schema fields — alias both spellings
	for (const set of [boolean, string]) {
		for (const key of [...set]) {
			const kebab = kebabCase(key)
			if (kebab !== key) set.add(kebab)
		}
	}

	return { boolean: [...boolean], string: [...string] }
}

/**
 * Type helper for module-augmentation of AvailableCommands when using the
 * SimpleCommand (module-based) pattern instead of a full class.
 *
 * @example
 * ```typescript
 * declare module 'luca' {
 *   interface AvailableCommands {
 *     serve: SimpleCommand<typeof argsSchema>
 *   }
 * }
 * ```
 */
export type SimpleCommand<Schema extends z.ZodType = z.ZodType> = typeof Command & {
	argsSchema: Schema
	positionals: PositionalSpec[]
	subcommands?: Record<string, SubcommandSpec>
	examples?: CommandExample[]
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
	static positionals: PositionalSpec[] = []

	/**
	 * Declarative subcommand metadata, keyed by subcommand name. Rendered in
	 * `--help` output; `luca <cmd> <sub> --help` shows focused help for one entry.
	 * Dispatch is still up to the handler (read the subcommand from a positional).
	 */
	static subcommands: Record<string, SubcommandSpec> = {}

	/** Usage examples rendered at the bottom of `--help` output. */
	static examples: CommandExample[] = []

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
			const binaryName = (this.container as any)._binaryName || 'luca'
			// `luca <cmd> <sub> --help` → focused help for that subcommand
			const firstPositional = ((this.container as any).argv?._ || [])[1]
			const subcommand = firstPositional && Cls.subcommands?.[firstPositional]
				? firstPositional
				: undefined
			console.log(formatCommandHelp(name, this.constructor, ui.colors, { binaryName, subcommand }))
			return
		}

		// Build named args from raw input
		const raw = rawInput ?? { ...(this.container as any).argv }
		const named = this._normalizeInput(raw, dispatchSource)

		// Validate against argsSchema
		let parsed: any
		try {
			parsed = Cls.argsSchema.parse(named)
		} catch (err: any) {
			if (err?.name === 'ZodError' && dispatchSource === 'cli') {
				const ui = (this.container as any).feature('ui')
				const cmdName = Cls.shortcut?.replace('commands.', '') || 'unknown'
				const issues = err.issues || []

				ui.print.red(`\n  Error: Invalid options for "${cmdName}"\n`)
				for (const issue of issues) {
					const path = issue.path?.length ? issue.path.join('.') : 'input'
					ui.print(`  ${ui.colors.yellow('→')} ${ui.colors.bold(path)}: ${issue.message}`)
				}
				ui.print('')
				ui.print.dim(`  Run ${ui.colors.cyan(`luca ${cmdName} --help`)} for usage info.\n`)
				process.exit(1)
			}
			throw err
		}

		// Honor the documented `options._` contract: handlers can read raw
		// positionals via options._ (where _[0] is the command name). Zod object
		// schemas strip unknown keys, so re-attach `_` after validation.
		if (parsed && typeof parsed === 'object' && Array.isArray(raw._) && parsed._ === undefined) {
			parsed._ = raw._
		}

		// For headless dispatch, capture stdout/stderr
		if (dispatchSource !== 'cli') {
			return this._runCaptured(parsed)
		}

		// CLI path — lifecycle events + run
		this.state.set('running', true)
		this.emit('started')

		try {
			await this.run(parsed, this._commandContext())
			this.state.set('running', false)
			this.state.set('exitCode', 0)
			this.emit('completed', 0)
		} catch (err: any) {
			this.state.set('running', false)
			this.state.set('exitCode', 1)
			this.emit('failed', err)

			// Clean CLI error surface: message + hint, stack only on request.
			// Re-throwing here would dump an uncaught-rejection stack for every
			// user-facing error, so we report and set the exit code instead.
			const argv = (this.container as any).argv || {}
			const showStack = Boolean(argv.verbose || process.env.DEBUG)
			try {
				const ui = (this.container as any).feature('ui')
				console.error(ui.colors.red(`\n  Error: ${err?.message || err}`))
				if (showStack && err?.stack) {
					console.error(ui.colors.dim(err.stack) + '\n')
				} else {
					console.error(ui.colors.dim('  Run with --verbose (or DEBUG=1) for a stack trace.\n'))
				}
			} catch {
				console.error(`Error: ${err?.message || err}`)
				if (showStack && err?.stack) console.error(err.stack)
			}
			process.exitCode = 1
		}
	}

	/**
	 * Build the context passed to command handlers: the container context plus
	 * command-dispatch conveniences like `runUntilShutdown` for daemon commands.
	 */
	private _commandContext(): ContainerContext {
		const context = this.context as any
		const container = this.container as any
		if (typeof container.runUntilShutdown === 'function' && typeof context.runUntilShutdown !== 'function') {
			context.runUntilShutdown = (cleanup?: () => void | Promise<void>) => container.runUntilShutdown(cleanup)
		}
		return context
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

		const result = { ...raw }
		// Positionals are strings on a real command line — normalize programmatic
		// CLI dispatches (tests, tooling) the same way before schema validation.
		if (Array.isArray(raw._)) result._ = raw._.map(String)

		const Cls = this.constructor as typeof Command
		const specs = Cls.positionals || []
		if (!specs.length) return result

		// Map _[1], _[2], etc. (skipping _[0] which is command name) to named fields
		const posArgs: any[] = (result._ || []).slice(1)
		for (let i = 0; i < specs.length; i++) {
			const spec = specs[i]!
			const rawName = typeof spec === 'string' ? spec : spec.name
			const variadic = rawName.startsWith('...')
			const name = variadic ? rawName.slice(3) : rawName
			if (result[name] !== undefined) continue

			// A trailing '...rest' positional (or array-typed schema field) collects all remaining args
			if (i === specs.length - 1 && (variadic || this._schemaExpectsArray(Cls.argsSchema, name))) {
				const rest = posArgs.slice(i)
				if (rest.length === 0) continue // let schema defaults / required errors apply
				const elementSchema = zodArrayElement(schemaShape(Cls.argsSchema)?.[name])
				result[name] = rest.map((v) => this._coercePositional(elementSchema, v))
				continue
			}

			if (posArgs[i] === undefined) continue
			result[name] = this._coercePositional(schemaShape(Cls.argsSchema)?.[name], posArgs[i])
		}

		return result
	}

	/**
	 * Coerce a positional value to the primitive its schema field expects.
	 * Positionals arrive as strings (or minimist-coerced numbers/booleans from
	 * older parses) — align them so `z.string()` positionals accept `8080` and
	 * `z.number()` positionals accept `'8080'`.
	 */
	private _coercePositional(fieldSchema: any, value: any): any {
		if (!fieldSchema) return value
		const t = zodBaseType(fieldSchema)
		if (t === 'string' || t === 'enum') return typeof value === 'string' ? value : String(value)
		if (t === 'number') {
			if (typeof value === 'number') return value
			const n = Number(value)
			return Number.isNaN(n) ? value : n
		}
		if (t === 'boolean') {
			if (typeof value === 'boolean') return value
			if (value === 'true') return true
			if (value === 'false') return false
			return value
		}
		return value
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
			await this.run(args, this._commandContext())
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
	 * Convert all registered commands into a `{ schemas, handlers }` object
	 * compatible with `assistant.use()`.
	 *
	 * Each command becomes a tool whose parameters come from the command's
	 * `argsSchema` (with internal CLI fields stripped) and whose handler
	 * dispatches the command headlessly, returning `{ exitCode, stdout, stderr }`.
	 *
	 * @param container - The container used to instantiate and dispatch commands
	 * @param options - Optional filter/transform options
	 * @param options.include - Only include these command names (default: all)
	 * @param options.exclude - Exclude these command names (default: none)
	 * @param options.prefix - Prefix tool names (e.g. 'luca_' → 'luca_eval')
	 */
	toTools(
		container: Container<any> & CommandsInterface,
		options?: { include?: string[], exclude?: string[], prefix?: string },
	): { schemas: Record<string, z.ZodType>, handlers: Record<string, Function> } {
		const schemas: Record<string, z.ZodType> = {}
		const handlers: Record<string, Function> = {}
		const prefix = options?.prefix ?? ''
		const includeSet = options?.include ? new Set(options.include) : null
		const excludeSet = new Set(options?.exclude ?? [])

		// Internal fields inherited from HelperOptionsSchema / CommandOptionsSchema
		const internalFields = ['_', 'dispatchSource', 'name', '_cacheKey']

		for (const name of this.available) {
			if (excludeSet.has(name)) continue
			if (includeSet && !includeSet.has(name)) continue

			const Cmd = this.lookup(name) as typeof Command
			const rawSchema = Cmd.argsSchema
			const description = Cmd.commandDescription || Cmd.description || name

			// Build a clean schema by stripping internal CLI fields from the argsSchema.
			// If the schema is a ZodObject we can use .omit(), otherwise create a
			// virtual passthrough schema so the tool still flows through.
			let toolSchema: z.ZodType
			try {
				const shape = typeof (rawSchema as any)?._def?.shape === 'function'
					? (rawSchema as any)._def.shape()
					: (rawSchema as any)?._def?.shape

				if (shape) {
					// Build a new object schema omitting internal fields
					const cleanShape: Record<string, z.ZodType> = {}
					for (const [key, val] of Object.entries(shape)) {
						if (internalFields.includes(key)) continue
						cleanShape[key] = val as z.ZodType
					}

					toolSchema = Object.keys(cleanShape).length > 0
						? z.object(cleanShape).describe(description)
						: z.object({}).describe(description)
				} else {
					// Not a ZodObject — wrap as passthrough
					toolSchema = z.object({}).describe(description)
				}
			} catch {
				toolSchema = z.object({}).describe(description)
			}

			const toolName = `${prefix}${name}`
			schemas[toolName] = toolSchema
			handlers[toolName] = async (args: Record<string, any>) => {
				const cmd = container.command(name as any)
				const result = await cmd.dispatch(args ?? {}, 'headless')
				return result ?? { exitCode: 0, stdout: '', stderr: '' }
			}
		}

		return { schemas, handlers }
	}

	/**
	 * Internal: register a command from a handler function.
	 * Used by built-in commands. External commands should use the module export pattern.
	 */
	registerHandler<T = any>(
		name: string,
		opts: {
			description?: string
			argsSchema?: z.ZodType
			positionals?: PositionalSpec[]
			subcommands?: Record<string, SubcommandSpec>
			examples?: CommandExample[]
			handler: CommandHandler<T>
		},
	) {
		const CommandClass = graftModule(
			Command as any,
			{
				description: opts.description,
				argsSchema: opts.argsSchema,
				positionals: opts.positionals,
				subcommands: opts.subcommands,
				examples: opts.examples,
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

			// A project command that fails to load (bad import, syntax error,
			// platform-specific resolution quirk) must not take down the CLI —
			// warn and keep discovering, same as the helpers gateway.
			let mod: any
			try {
				mod = await import(join(options.directory, file))
			} catch (err: any) {
				console.warn(`commands.discover: failed to load ${file}: ${err?.message ?? err}`)
				continue
			}

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
					positionals: commandModule.positionals ?? mod.positionals,
					subcommands: commandModule.subcommands ?? mod.subcommands,
					examples: commandModule.examples ?? mod.examples,
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
					subcommands: mod.subcommands,
					examples: mod.examples,
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
