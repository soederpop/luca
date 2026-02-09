import { z } from 'zod'

// Base helper schemas
export const HelperStateSchema = z.object({
  // Empty base - allows for extension
}).describe('Base state for all helpers')

export const HelperOptionsSchema = z.object({
  name: z.string().optional(),
  _cacheKey: z.string().optional(),
}).describe('Base options for all helpers')

// Type inference utilities
export type InferState<T extends z.ZodType> = z.infer<T>
export type InferOptions<T extends z.ZodType> = z.infer<T>

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
  enabled: z.boolean().default(false)
}).describe('Base feature state with enabled flag')

export const FeatureOptionsSchema = HelperOptionsSchema.extend({
  cached: z.boolean().optional(),
  enable: z.boolean().optional(),
}).describe('Base feature options with cached and enable flags')

export const ClientStateSchema = HelperStateSchema.extend({
  connected: z.boolean().default(false)
}).describe('Base client state with connection status')

export const ClientOptionsSchema = HelperOptionsSchema.extend({
  baseURL: z.string().optional(),
  json: z.boolean().optional(),
}).describe('Base client options with connection settings')

export const ServerStateSchema = HelperStateSchema.extend({
  port: z.number().optional(),
  listening: z.boolean().default(false),
  configured: z.boolean().default(false),
  stopped: z.boolean().default(false),
}).describe('Base server state with port and status information')

export const ServerOptionsSchema = HelperOptionsSchema.extend({
  port: z.number().positive().optional(),
  host: z.string().optional(),
}).describe('Base server options with port and host settings')

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