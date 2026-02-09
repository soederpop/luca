import { z } from 'zod'

// Base helper schemas
export const HelperStateSchema = z.object({
  // Empty base - allows for extension
}).describe('Base state for all helpers')

export const HelperOptionsSchema = z.object({
  name: z.string().optional().describe('Optional name identifier for this helper instance'),
  _cacheKey: z.string().optional().describe('Internal cache key used for instance deduplication'),
}).describe('Base options for all helpers')

// Type inference utilities
export type InferState<T extends z.ZodType> = z.infer<T>
export type InferOptions<T extends z.ZodType> = z.infer<T>

/**
 * Infer an EventMap from an events schema where each key is an event name
 * and each value is a z.tuple() describing the listener arguments.
 *
 * e.g. z.object({ ready: z.tuple([]), message: z.tuple([z.string()]) })
 *   => { ready: [], message: [string] }
 */
export type InferEvents<T extends z.ZodType> = z.infer<T> extends infer E
  ? { [K in keyof E]: E[K] extends any[] ? E[K] : any[] }
  : Record<string, any[]>

// Schema composition helpers
export const createHelperSchemas = <
  StateSchema extends z.ZodType,
  OptionsSchema extends z.ZodType
>(
  stateSchema: StateSchema,
  optionsSchema: OptionsSchema
) => ({
  state: stateSchema,
  options: optionsSchema,
  types: {} as {
    State: InferState<StateSchema>
    Options: InferOptions<OptionsSchema>
  }
})

// Base schemas for common types
export const FeatureStateSchema = HelperStateSchema.extend({
  enabled: z.boolean().default(false).describe('Whether this feature is currently enabled'),
}).describe('Base feature state with enabled flag')

export const FeatureOptionsSchema = HelperOptionsSchema.extend({
  cached: z.boolean().optional().describe('Whether to cache this feature instance'),
  enable: z.boolean().optional().describe('Whether to automatically enable the feature on creation'),
}).describe('Base feature options with cached and enable flags')

export const ClientStateSchema = HelperStateSchema.extend({
  connected: z.boolean().default(false).describe('Whether the client is currently connected'),
}).describe('Base client state with connection status')

export const ClientOptionsSchema = HelperOptionsSchema.extend({
  baseURL: z.string().optional().describe('Base URL for the client connection'),
  json: z.boolean().optional().describe('Whether to automatically parse responses as JSON'),
}).describe('Base client options with connection settings')

export const ServerStateSchema = HelperStateSchema.extend({
  port: z.number().optional().describe('The port the server is bound to'),
  listening: z.boolean().default(false).describe('Whether the server is actively listening for connections'),
  configured: z.boolean().default(false).describe('Whether the server has been configured'),
  stopped: z.boolean().default(false).describe('Whether the server has been stopped'),
}).describe('Base server state with port and status information')

export const ServerOptionsSchema = HelperOptionsSchema.extend({
  port: z.number().positive().optional().describe('Port number to listen on'),
  host: z.string().optional().describe('Hostname or IP address to bind to'),
}).describe('Base server options with port and host settings')

// Events schemas — each key is an event name, value is z.tuple() of listener args
export const HelperEventsSchema = z.object({
  stateChange: z.tuple([z.any().describe('The current state object')]),
}).describe('Base events for all helpers')

export const FeatureEventsSchema = HelperEventsSchema.extend({
  enabled: z.tuple([]).describe('Emitted when the feature is enabled'),
}).describe('Base feature events')

export const ClientEventsSchema = HelperEventsSchema.extend({
  failure: z.tuple([z.any().describe('The error object')]).describe('Emitted when a request fails'),
}).describe('Base client events')

export const ServerEventsSchema = HelperEventsSchema.extend({}).describe('Base server events')

/**
 * Converts a ZodObject into an introspection-friendly record.
 * Uses Zod v4's native toJSONSchema() and transforms properties
 * into { fieldName: { type, description } } for the introspection system.
 */
export function describeZodShape(schema: z.ZodType): Record<string, { type: string, description: string }> {
  try {
    const jsonSchema = (schema as any).toJSONSchema()
    const properties = jsonSchema?.properties || {}
    const result: Record<string, { type: string, description: string }> = {}

    for (const [key, prop] of Object.entries(properties) as [string, any][]) {
      result[key] = {
        type: prop.type || 'any',
        description: prop.description || ''
      }
    }

    return result
  } catch {
    return {}
  }
}

/**
 * Converts an events ZodObject schema into introspection-friendly EventIntrospection records.
 *
 * Each top-level key is an event name, and its value should be a z.tuple() describing
 * the positional arguments passed to listeners.
 *
 * Merges with existing build-time event data (e.g. descriptions from AST scanning)
 * while adding argument type information from the Zod schema.
 */
export function describeEventsSchema(
  schema: z.ZodType,
  existing: Record<string, { name: string, description: string, arguments: Record<string, { type: string, description: string }> }> = {}
): Record<string, { name: string, description: string, arguments: Record<string, { type: string, description: string }> }> {
  try {
    const jsonSchema = (schema as any).toJSONSchema()
    const properties = jsonSchema?.properties || {}
    const result: Record<string, { name: string, description: string, arguments: Record<string, { type: string, description: string }> }> = { ...existing }

    for (const [eventName, eventProp] of Object.entries(properties) as [string, any][]) {
      const args: Record<string, { type: string, description: string }> = {}

      // The event value is a tuple schema — its items describe positional args
      const items = eventProp?.prefixItems || eventProp?.items
      if (Array.isArray(items)) {
        items.forEach((item: any, index: number) => {
          args[`arg${index}`] = {
            type: item.type || 'any',
            description: item.description || ''
          }
        })
      }

      result[eventName] = {
        name: eventName,
        description: eventProp.description || existing[eventName]?.description || `Event: ${eventName}`,
        arguments: {
          ...(existing[eventName]?.arguments || {}),
          ...args
        }
      }
    }

    return result
  } catch {
    return existing
  }
}