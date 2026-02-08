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
 * Converts a ZodObject's shape into an introspection-friendly record.
 * Returns { fieldName: { type, description } } for use in the introspection system.
 */
export function describeZodShape(schema: z.ZodType): Record<string, { type: string, description: string }> {
  const result: Record<string, { type: string, description: string }> = {}

  if (!(schema instanceof z.ZodObject)) return result

  const shape = schema.shape as Record<string, z.ZodType>

  for (const [key, fieldSchema] of Object.entries(shape)) {
    result[key] = {
      type: getZodTypeName(fieldSchema),
      description: fieldSchema.description || '',
    }
  }

  return result
}

/**
 * Extracts a human-readable type name from a Zod schema.
 */
export function getZodTypeName(schema: z.ZodType): string {
  if (schema instanceof z.ZodString) return 'string'
  if (schema instanceof z.ZodNumber) return 'number'
  if (schema instanceof z.ZodBoolean) return 'boolean'
  if (schema instanceof z.ZodArray) return `${getZodTypeName(schema.element)}[]`
  if (schema instanceof z.ZodOptional) return `${getZodTypeName(schema.unwrap())} | undefined`
  if (schema instanceof z.ZodDefault) return getZodTypeName(schema.removeDefault())
  if (schema instanceof z.ZodNullable) return `${getZodTypeName(schema.unwrap())} | null`
  if (schema instanceof z.ZodEnum) return (schema.options as string[]).map(v => `'${v}'`).join(' | ')
  if (schema instanceof z.ZodUnion) return (schema.options as z.ZodType[]).map(getZodTypeName).join(' | ')
  if (schema instanceof z.ZodRecord) return `Record<string, ${getZodTypeName(schema.valueSchema)}>`
  if (schema instanceof z.ZodObject) return 'object'
  if (schema instanceof z.ZodFunction) return 'function'
  if (schema instanceof z.ZodAny) return 'any'
  if (schema instanceof z.ZodLiteral) return JSON.stringify(schema.value)

  return 'unknown'
}
