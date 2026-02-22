import { z } from 'zod'
import { describeZodShape, describeEventsSchema } from '../schemas/base.js'

/**
 * Inspection is a feature that is available to all containers, its purpose is to provide
 * runtime inspection of a particular helper's public API:
 * 	- methods 
 * 	- properties
 *  - events that it emits
 *  - the shape of its state at any given point
 *
 * So that if you have an instance of a helper in e.g. a REPL, or if an AI Agent wants to
 * work with a helper, there is a common way of getting the information needed in a way that
 * it can be formatted e.g. as OpenAI Tool Calls or as OpenAPI Spec for a ChatGPT Plugin,
 * or a custom UI for a helper.  
 *
 * Because Javascript doesn't have runtime introspection capabilities, we solve this problem by
 * exposing this runtime registry on the container, and then using a build time tool to analyze
 * specific class definitions ( since the Luca framework encourages this pattern ) to extract
 * the jsdoc comments for the class along with any type information that is available and then
 * populate the registry with the information we need.
 * 
 * Each Helper class will have a method that will return information about itself found in the 
 * central introspection registry.  This registry can be loaded at runtime from a remote source,
 * depending on the container.  In node, we can load it from a file, or from a URL. 
 */

export type ExampleIntrospection = { language: string; code: string }

export type MethodIntrospection = {
	description: string
	parameters: Record<string, { type: string, description: string, properties?: Record<string, { type: string, description: string }> }>
	required: string[]
	returns: string
	examples?: ExampleIntrospection[]
}

/** Sections that can be requested individually from introspect / inspect */
export type IntrospectionSection = 'methods' | 'getters' | 'events' | 'state' | 'options' | 'envVars' | 'examples'

export type GetterIntrospection = {
	description: string
	returns: string
	examples?: ExampleIntrospection[]
}

export type EventIntrospection = {
	name: string
	description: string
	arguments: Record<string, { type: string, description: string }>
}

// Every subclass of Helper will have its own Subclasses that will want to document themselves
// it will store that information at the class level as a HelperIntroSpection
export type HelperIntrospection = {
	// id will be e.g. features.vm, clients.openai, etc
	id: string;
	// a description of the helper, the main jsdoc comment for the class
	description: string;
	// a shortcut for the helper, e.g. "vm" for the VM feature, which will be what it is registered as with the registry and what the key is in AvailableFeatures, etc
	shortcut: string;
	// a map of method names to their introspection
	methods: Record<string, MethodIntrospection>
	// a map of getter names to their introspection
	getters: Record<string, GetterIntrospection>
	// a map of event names to their introspection
	events: Record<string, EventIntrospection>
	// a map of state properties to their introspection
	state: Record<string, { type: string, description: string }>
	// a map of options properties to their introspection
	options: Record<string, { type: string, description: string }>
	// environment variables used by this helper
	envVars?: string[]
	// class-level @example blocks from JSDoc
	examples?: ExampleIntrospection[]
}

export type RegistryIntrospection = {
	/** The name of the registry, e.g. "features", "clients", "servers" */
	name: string
	/** The base class for this registry (e.g. "Feature", "Client", "Server") */
	baseClass: string
	/** The IDs of all registered members available in this registry */
	available: string[]
}

export type ContainerIntrospection = {
	/** The class name, e.g. "NodeContainer", "AGIContainer" */
	className: string
	/** UUID of this container instance */
	uuid: string
	/** JSDoc-derived description of the container class */
	description: string
	/** Available registries (features, clients, servers, etc.) */
	registries: RegistryIntrospection[]
	/** Available factory method names (feature, client, server, etc.) */
	factories: string[]
	/** Container methods extracted from JSDoc/AST */
	methods: Record<string, MethodIntrospection>
	/** Container getters extracted from JSDoc/AST */
	getters: Record<string, GetterIntrospection>
	/** Container events */
	events: Record<string, EventIntrospection>
	/** Container state shape */
	state: Record<string, { type: string, description: string }>
	/** List of currently enabled feature shortcut IDs */
	enabledFeatures: string[]
	/** Environment flags */
	environment: {
		isBrowser: boolean
		isNode: boolean
		isBun: boolean
		isElectron: boolean
		isDevelopment: boolean
		isProduction: boolean
		isCI: boolean
	}
}

export const __INTROSPECTION__ = new Map<string, HelperIntrospection>()
export const __CONTAINER_INTROSPECTION__ = new Map<string, Partial<ContainerIntrospection>>()

export function introspect(id: string) : HelperIntrospection | undefined {
	return __INTROSPECTION__.get(id)
}

/**
 * Called by generated files to seed build-time AST data for Container classes.
 * Merges into any existing entry.
 */
export function setContainerBuildTimeData(className: string, data: Partial<ContainerIntrospection>) {
	const existing = __CONTAINER_INTROSPECTION__.get(className)
	__CONTAINER_INTROSPECTION__.set(className, {
		...existing,
		...data,
		methods: data.methods || existing?.methods || {},
		getters: data.getters || existing?.getters || {},
		events: data.events || existing?.events || {},
	})
}

/**
 * Retrieves build-time AST data for a Container class by name.
 */
export function getContainerBuildTimeData(className: string): Partial<ContainerIntrospection> | undefined {
	return __CONTAINER_INTROSPECTION__.get(className)
}

/**
 * Called by generated files to seed build-time AST data (description, methods, events).
 * Merges into any existing entry without overwriting runtime-derived state/options.
 */
export function setBuildTimeData(key: string, data: HelperIntrospection) {
	const existing = __INTROSPECTION__.get(key)

	__INTROSPECTION__.set(key, {
		...data,
		// preserve runtime-derived state/options if registration already happened
		state: existing?.state || data.state || {},
		options: existing?.options || data.options || {},
		getters: data.getters || existing?.getters || {},
		envVars: existing?.envVars || data.envVars || [],
		examples: data.examples || existing?.examples,
	})
}

/**
 * Called at registry.register() time to merge runtime Zod schema data
 * into the introspection entry. Preserves build-time methods/events
 * regardless of import order.
 */
export function interceptRegistration(registry: any, helperConstructor: any) {

	if (!helperConstructor.shortcut) {
		console.error("Helper has no shortcut", helperConstructor)
		return
	}

	// Warn if a concrete Helper subclass inherits its schemas from a parent
	// instead of setting its own. This usually means a custom schema was
	// defined but never assigned via `static override optionsSchema = ...`,
	// causing Zod's safeParse to silently strip custom option/state keys.
	if (helperConstructor.shortcut !== 'unspecified') {
		if (!helperConstructor.hasOwnProperty('optionsSchema')) {
			console.warn(
				`[luca] ${helperConstructor.shortcut}: no \`static override optionsSchema\` — ` +
				`custom options will be stripped during construction. ` +
				`Set \`static override optionsSchema\` on the class if it accepts custom options.`
			)
		}
		if (!helperConstructor.hasOwnProperty('stateSchema')) {
			console.warn(
				`[luca] ${helperConstructor.shortcut}: no \`static override stateSchema\` — ` +
				`introspection will report the base state shape. ` +
				`Set \`static override stateSchema\` on the class if it has custom state.`
			)
		}
	}

	const key = helperConstructor.shortcut
	const existing = __INTROSPECTION__.get(key)

	const introspection: HelperIntrospection = {
		id: key,
		description: helperConstructor.description || existing?.description || '',
		shortcut: helperConstructor.shortcut,
		// preserve build-time AST data if generated file already loaded
		methods: existing?.methods || {},
		getters: existing?.getters || {},
		events: existing?.events || {},
		state: {},
		options: {},
		envVars: Array.isArray(helperConstructor.envVars)
			? helperConstructor.envVars
			: (existing?.envVars || []),
		examples: existing?.examples,
	}

	// Always populate state and options from Zod schemas at runtime
	if (helperConstructor.stateSchema && helperConstructor.stateSchema instanceof z.ZodObject) {
		introspection.state = describeZodShape(helperConstructor.stateSchema)
	}

	if (helperConstructor.optionsSchema && helperConstructor.optionsSchema instanceof z.ZodObject) {
		introspection.options = describeZodShape(helperConstructor.optionsSchema)
	}

	// Merge event argument types from Zod eventsSchema, preserving build-time AST descriptions
	if (helperConstructor.eventsSchema && helperConstructor.eventsSchema instanceof z.ZodObject) {
		introspection.events = describeEventsSchema(helperConstructor.eventsSchema, introspection.events)
	}

	__INTROSPECTION__.set(key, introspection)

	return introspection
}

	
