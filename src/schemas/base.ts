import { z } from 'zod'

// Base helper schemas
export const HelperStateSchema = z.object({
  // Empty base - allows for extension
}).passthrough().describe('Base state for all helpers')

export const HelperOptionsSchema = z.object({
  name: z.string().optional(),
  _cacheKey: z.string().optional(),
}).passthrough().describe('Base options for all helpers')

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
  timeout: z.number().positive().optional(),
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