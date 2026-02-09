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

export type MethodIntrospection = {
	description: string
	parameters: Record<string, { type: string, description: string }>
	required: string[]
	returns: string 
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
	// a map of event names to their introspection
	events: Record<string, EventIntrospection>
	// a map of state properties to their introspection
	state: Record<string, { type: string, description: string }>
	// a map of options properties to their introspection
	options: Record<string, { type: string, description: string }>
}

export const __INTROSPECTION__ = new Map<string, HelperIntrospection>()


export function introspect(id: string) : HelperIntrospection | undefined {
	return __INTROSPECTION__.get(id)
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

	const key = helperConstructor.shortcut
	const existing = __INTROSPECTION__.get(key)

	const introspection: HelperIntrospection = {
		id: key,
		description: helperConstructor.description || existing?.description || '',
		shortcut: helperConstructor.shortcut,
		// preserve build-time AST data if generated file already loaded
		methods: existing?.methods || {},
		events: existing?.events || {},
		state: {},
		options: {}
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

	
