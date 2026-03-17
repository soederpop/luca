import { Helper } from './helper.js'
import { z } from 'zod'

export type GraftScope = 'features' | 'clients' | 'servers' | 'commands' | 'endpoints' | 'selectors'

/**
 * Export names that map to static class properties or receive special handling.
 * Everything else that is a function goes onto the prototype as a method.
 */
const RESERVED_EXPORTS = new Set([
	'description', 'envVars',
	'stateSchema', 'optionsSchema', 'eventsSchema',
	'args', 'argsSchema',
	'positionals',
	'getters',
	'run', 'handler',
	'cacheKey', 'cacheable',
	'default',
])

/**
 * Returns true when the candidate is a class (constructor function) whose
 * prototype chain includes BaseClass. Handles cross-module-boundary cases
 * by checking both reference equality and class name.
 */
export function isNativeHelperClass(candidate: unknown, BaseClass: typeof Helper | any): boolean {
	if (typeof candidate !== 'function') return false
	if (!BaseClass) return false
	if (candidate === BaseClass) return true

	let proto = Object.getPrototypeOf(candidate)
	while (proto) {
		if (proto === BaseClass) return true
		if (BaseClass.name && proto.name === BaseClass.name) return true
		proto = Object.getPrototypeOf(proto)
	}
	return false
}

/**
 * Synthesize a Helper subclass from plain module exports.
 *
 * Given a set of exports from a module file and a Helper base class, produces a
 * fully-formed subclass ready for registration in the appropriate registry.
 *
 * Static export mappings:
 *   description   → static description
 *   stateSchema   → static stateSchema
 *   optionsSchema → static optionsSchema  (also aliased from `args`)
 *   eventsSchema  → static eventsSchema
 *   envVars       → static envVars
 *   argsSchema    → static argsSchema (Command scope; also aliased from `args`)
 *   positionals   → static positionals (Command scope; stored for CLI dispatch mapping)
 *   getters       → Object.defineProperty(proto, key, { get })  per key
 *   run           → override run() for Command scope (receives named args + context)
 *   handler       → legacy: wired through parseArgs() for backward compat
 *   [fn exports]  → prototype methods (all other function-valued named exports)
 */
export function graftModule<T extends typeof Helper>(
	BaseClass: T,
	moduleExports: Record<string, any>,
	id: string,
	scope: GraftScope,
): T {
	// Resolve schemas — prefer explicit exports, fall back to whatever the base class has
	const optionsSchema = moduleExports.optionsSchema
		?? moduleExports.args
		?? (BaseClass as any).optionsSchema

	const stateSchema = moduleExports.stateSchema
		?? (BaseClass as any).stateSchema

	const eventsSchema = moduleExports.eventsSchema
		?? (BaseClass as any).eventsSchema

	// Build the subclass
	const GraftedClass = class extends (BaseClass as any) {} as unknown as T & { prototype: any }

	// Static overrides
	const statics: Record<string, any> = {
		shortcut: `${scope}.${id}`,
		description: moduleExports.description ?? '',
	}

	if (moduleExports.envVars) statics.envVars = moduleExports.envVars
	if (optionsSchema) statics.optionsSchema = optionsSchema
	if (stateSchema) statics.stateSchema = stateSchema
	if (eventsSchema) statics.eventsSchema = eventsSchema

	// Command-specific statics
	if (scope === 'commands') {
		const argsSchema = moduleExports.argsSchema ?? moduleExports.args ?? optionsSchema
		statics.argsSchema = argsSchema
		statics.commandDescription = moduleExports.description ?? ''
		if (moduleExports.positionals) {
			statics.positionals = moduleExports.positionals
		}
	}

	// Selector-specific statics (must be set before Object.assign)
	if (scope === 'selectors') {
		statics.cacheable = moduleExports.cacheable !== false
		statics.selectorDescription = moduleExports.description ?? ''
		statics.argsSchema = moduleExports.argsSchema ?? moduleExports.args ?? optionsSchema
	}

	Object.assign(GraftedClass, statics)

	// Wire run() for Command scope
	if (scope === 'commands') {
		if (typeof moduleExports.run === 'function') {
			const runFn = moduleExports.run
			;(GraftedClass as any).prototype.run = async function (args: any, context: any) {
				return runFn(args, context)
			}
		} else if (typeof moduleExports.handler === 'function') {
			const handlerFn = moduleExports.handler
			;(GraftedClass as any).prototype.run = async function (args: any, context: any) {
				return handlerFn(args, context)
			}
		}
	}

	// Wire run() and resolveCacheKey() for Selector scope
	if (scope === 'selectors') {
		if (typeof moduleExports.run === 'function') {
			const runFn = moduleExports.run
			;(GraftedClass as any).prototype.run = async function (args: any, context: any) {
				return runFn(args, context)
			}
		}

		if (typeof moduleExports.cacheKey === 'function') {
			const cacheKeyFn = moduleExports.cacheKey
			;(GraftedClass as any).prototype.resolveCacheKey = function (args: any, context: any) {
				return cacheKeyFn(args, context)
			}
		}
	}

	// Install getters from the `getters` export
	const getterMap: Record<string, () => any> = moduleExports.getters ?? {}
	for (const [key, fn] of Object.entries(getterMap)) {
		if (typeof fn === 'function') {
			Object.defineProperty((GraftedClass as any).prototype, key, {
				get: fn,
				configurable: true,
				enumerable: false,
			})
		}
	}

	// Graft all exported functions (that are not reserved) as prototype methods
	for (const [key, value] of Object.entries(moduleExports)) {
		if (RESERVED_EXPORTS.has(key)) continue
		if (typeof value !== 'function') continue
		;(GraftedClass as any).prototype[key] = value
	}

	// Name the class
	const suffix = SCOPE_SUFFIXES[scope] || ''
	const className = pascalCase(id) + suffix
	Object.defineProperty(GraftedClass, 'name', { value: className, configurable: true })

	return GraftedClass as T
}

const SCOPE_SUFFIXES: Record<string, string> = {
	features: 'Feature',
	clients: 'Client',
	servers: 'Server',
	commands: 'Command',
	endpoints: 'Endpoint',
	selectors: 'Selector',
}

function pascalCase(id: string): string {
	return id
		.replace(/[-_](.)/g, (_: string, c: string) => c.toUpperCase())
		.replace(/^(.)/, (_: string, c: string) => c.toUpperCase())
}
