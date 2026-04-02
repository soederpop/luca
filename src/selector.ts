import { Helper } from './helper.js'
import type { Container, ContainerContext } from './container.js'
import { Registry } from './registry.js'
import { SelectorStateSchema, SelectorOptionsSchema, SelectorEventsSchema, type SelectorRunResult } from './schemas/base.js'
import { z } from 'zod'
import { join } from 'path'
import { graftModule, isNativeHelperClass } from './graft.js'

export type { SelectorRunResult }

export type SelectorState = z.infer<typeof SelectorStateSchema>
export type SelectorOptions = z.infer<typeof SelectorOptionsSchema>

export interface AvailableSelectors {}

export type SelectorFactory = <T extends keyof AvailableSelectors>(
	key: T,
	options?: ConstructorParameters<AvailableSelectors[T]>[0]
) => NonNullable<InstanceType<AvailableSelectors[T]>>

export interface SelectorsInterface {
	selectors: SelectorsRegistry
	select: SelectorFactory
}

/**
 * Type helper for module-augmentation of AvailableSelectors when using the
 * module-based pattern.
 *
 * @example
 * ```typescript
 * declare module '@soederpop/luca' {
 *   interface AvailableSelectors {
 *     packageInfo: SimpleSelector<typeof argsSchema>
 *   }
 * }
 * ```
 */
export type SimpleSelector<Schema extends z.ZodType = z.ZodType> = typeof Selector & {
	argsSchema: Schema
}

/**
 * A Selector is a helper that returns data. Where Commands perform actions,
 * Selectors query and return structured results with built-in caching.
 *
 * Module authors export a `run(args, context)` function that returns data.
 * The `select()` dispatch method wraps `run()` with cache check/store and
 * returns `{ data, cached, cacheKey }`.
 *
 * Caching is on by default and keyed by `hashObject({ selectorName, args, gitSha })`.
 * Export a `cacheKey(args, context)` function to customize, or set `cacheable = false`
 * to disable.
 *
 * @example
 * ```typescript
 * // selectors/package-info.ts
 * export const description = 'Returns parsed package.json data'
 * export const argsSchema = z.object({ field: z.string().optional() })
 *
 * export function cacheKey(args, context) {
 *   return context.container.git.sha
 * }
 *
 * export async function run(args, context) {
 *   const manifest = context.container.manifest
 *   return args.field ? manifest[args.field] : manifest
 * }
 * ```
 */
export class Selector<
	T extends SelectorState = SelectorState,
	K extends SelectorOptions = SelectorOptions
> extends Helper<T, K> {
	static override shortcut = 'selectors.base'
	static override description = 'Base selector'
	static override stateSchema = SelectorStateSchema
	static override optionsSchema = SelectorOptionsSchema
	static override eventsSchema = SelectorEventsSchema

	static selectorDescription: string = ''
	static argsSchema: z.ZodType = SelectorOptionsSchema
	static cacheable: boolean = true

	/** Self-register a Selector subclass from a static initialization block. */
	static register: (SubClass: typeof Selector, id?: string) => typeof Selector

	override get initialState(): T {
		return ({ running: false } as unknown) as T
	}

	/**
	 * The user-defined selector payload. Override this in module-based selectors
	 * by exporting a `run` function.
	 *
	 * Receives validated args and the container context. Must return data.
	 */
	async run(_args: any, _context: ContainerContext): Promise<any> {
		// override via grafted module export
	}

	/**
	 * Compute the cache key for a given set of args.
	 * Override by exporting a `cacheKey(args, context)` function in the module.
	 *
	 * Default: hashObject({ selectorName, args, gitSha })
	 */
	resolveCacheKey(args: any, _context: ContainerContext): string {
		const name = (this.constructor as typeof Selector).shortcut || 'selector'
		const gitSha = (this.container as any).git?.currentCommitSha ?? 'unknown'
		return (this.container as any).utils.hashObject({ selectorName: name, args, gitSha })
	}

	/**
	 * The public dispatch method. Checks cache, calls run(), stores result.
	 *
	 * @returns `{ data, cached, cacheKey }` — the result and cache metadata
	 */
	async select(args?: Record<string, any>): Promise<SelectorRunResult> {
		const Cls = this.constructor as typeof Selector
		const parsed = Cls.argsSchema.parse(args ?? {})
		const resolvedCacheKey = this.resolveCacheKey(parsed, this.context)

		// Cache check
		if (Cls.cacheable) {
			try {
				const cache = this._getCache()
				if (await cache.has(resolvedCacheKey)) {
					const data = await cache.get(resolvedCacheKey, true)
					return { data, cached: true, cacheKey: resolvedCacheKey }
				}
			} catch {
				// Cache miss or unavailable — proceed to run
			}
		}

		// Run the selector
		this.state.set('running' as any, true as any)
		this.emit('started' as any)

		let data: any
		try {
			data = await this.run(parsed, this.context)
			this.state.set('running' as any, false as any)
			this.state.set('lastRanAt' as any, Date.now() as any)
			this.emit('completed' as any, data)
		} catch (err: any) {
			this.state.set('running' as any, false as any)
			this.emit('failed' as any, err)
			throw err
		}

		// Cache store
		if (Cls.cacheable) {
			try {
				await this._getCache().set(resolvedCacheKey, data)
			} catch {
				// Cache write failure is non-fatal
			}
		}

		return { data, cached: false, cacheKey: resolvedCacheKey }
	}

	/** Lazily access diskCache. */
	private _getCache(): any {
		return (this.container as any).feature('diskCache', { enable: true })
	}

	static attach(container: Container<any> & SelectorsInterface) {
		container.selectors = selectors

		Object.assign(container, {
			select<T extends keyof AvailableSelectors>(
				id: T,
				options?: ConstructorParameters<AvailableSelectors[T]>[0]
			): NonNullable<InstanceType<AvailableSelectors[T]>> {
				const BaseClass = selectors.lookup(id as string) as any

				return container.createHelperInstance({
					cache: selectorHelperCache,
					type: 'selector',
					id: String(id),
					BaseClass,
					options,
					fallbackName: String(id),
				}) as NonNullable<InstanceType<AvailableSelectors[T]>>
			},
		})

		container.registerHelperType('selectors', 'select')
		return container
	}
}

export class SelectorsRegistry extends Registry<Selector<any>> {
	override scope = 'selectors'
	override baseClass = Selector as any

	/**
	 * Convert all registered selectors into a `{ schemas, handlers }` object
	 * compatible with `assistant.use()`.
	 *
	 * Each selector becomes a tool whose parameters come from the selector's
	 * `argsSchema` (with internal fields stripped) and whose handler dispatches
	 * the selector and returns the data directly (cache metadata is not exposed).
	 *
	 * @param container - The container used to instantiate and run selectors
	 * @param options - Optional filter/transform options
	 * @param options.include - Only include these selector names (default: all)
	 * @param options.exclude - Exclude these selector names (default: none)
	 * @param options.prefix - Prefix tool names (e.g. 'sel_' → 'sel_packageInfo')
	 */
	toTools(
		container: Container<any> & SelectorsInterface,
		options?: { include?: string[], exclude?: string[], prefix?: string },
	): { schemas: Record<string, z.ZodType>, handlers: Record<string, Function> } {
		const schemas: Record<string, z.ZodType> = {}
		const handlers: Record<string, Function> = {}
		const prefix = options?.prefix ?? ''
		const includeSet = options?.include ? new Set(options.include) : null
		const excludeSet = new Set(options?.exclude ?? [])

		// Internal fields from HelperOptionsSchema and SelectorOptionsSchema
		const internalFields = ['name', '_cacheKey', 'dispatchSource']

		for (const name of this.available) {
			if (excludeSet.has(name)) continue
			if (includeSet && !includeSet.has(name)) continue

			const Sel = this.lookup(name) as typeof Selector
			const rawSchema = Sel.argsSchema
			const description = Sel.selectorDescription || Sel.description || name

			let toolSchema: z.ZodType
			try {
				const shape = typeof (rawSchema as any)?._def?.shape === 'function'
					? (rawSchema as any)._def.shape()
					: (rawSchema as any)?._def?.shape

				if (shape) {
					const cleanShape: Record<string, z.ZodType> = {}
					for (const [key, val] of Object.entries(shape)) {
						if (internalFields.includes(key)) continue
						cleanShape[key] = val as z.ZodType
					}

					toolSchema = Object.keys(cleanShape).length > 0
						? z.object(cleanShape).describe(description)
						: z.object({}).describe(description)
				} else {
					toolSchema = z.object({}).describe(description)
				}
			} catch {
				toolSchema = z.object({}).describe(description)
			}

			const toolName = `${prefix}${name}`
			schemas[toolName] = toolSchema
			handlers[toolName] = async (args: Record<string, any>) => {
				const sel = (container.select as any)(name)
				const result = await sel.select(args ?? {})
				return result.data
			}
		}

		return { schemas, handlers }
	}

	/**
	 * Discover and register selectors from a directory.
	 * Detection order:
	 *   1. Default export is a class extending Selector -> register directly
	 *   2. Module exports a `run` function -> graft as SimpleSelector
	 */
	async discover(options: { directory: string }) {
		const { Glob } = globalThis.Bun || (await import('bun'))
		const glob = new Glob('*.ts')

		for await (const file of glob.scan({ cwd: options.directory })) {
			if (file === 'index.ts') continue

			const name = file.replace(/\.ts$/, '')
			if (this.has(name)) continue

			const mod = await import(join(options.directory, file))

			// 1. Class-based: default export extends Selector
			if (isNativeHelperClass(mod.default, Selector)) {
				const ExportedClass = mod.default
				if (!ExportedClass.shortcut || ExportedClass.shortcut === 'selectors.base') {
					ExportedClass.shortcut = `selectors.${name}`
				}
				this.register(name, ExportedClass)
				continue
			}

			const selectorModule = mod.default || mod

			// 2. Module-based with `run` export
			if (typeof selectorModule.run === 'function') {
				const Grafted = graftModule(Selector as any, selectorModule, name, 'selectors')
				this.register(name, Grafted as any)
			}
		}
	}
}

export const selectors = new SelectorsRegistry()
export const selectorHelperCache = new Map()

/**
 * Self-register a Selector subclass from a static initialization block.
 *
 * @example
 * ```typescript
 * export class PackageInfoSelector extends Selector {
 *   static override description = 'Returns parsed package.json data'
 *   static { Selector.register(this, 'packageInfo') }
 *
 *   override async run(args, context) { return context.container.manifest }
 * }
 * ```
 */
Selector.register = function registerSelector(
	SubClass: typeof Selector,
	id?: string,
) {
	const registryId = id ?? (SubClass.name
		? SubClass.name[0]!.toLowerCase() + SubClass.name.slice(1).replace(/Selector$/, '')
		: `selector_${Date.now()}`)

	if (!Object.getOwnPropertyDescriptor(SubClass, 'shortcut')?.value ||
		(SubClass as any).shortcut === 'selectors.base') {
		;(SubClass as any).shortcut = `selectors.${registryId}`
	}

	selectors.register(registryId, SubClass as any)

	if (!Object.getOwnPropertyDescriptor(SubClass, 'attach')) {
		;(SubClass as any).attach = (container: any) => {
			selectors.register(registryId, SubClass as any)
			return container
		}
	}

	return SubClass
}

export { graftModule, isNativeHelperClass } from './graft.js'

export default Selector
