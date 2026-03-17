import { z } from 'zod'

// Base helper schemas — looseObject allows additional properties so subclass
// state types can structurally extend the base via z.infer<>
export const HelperStateSchema = z.looseObject({}).describe('Base state for all helpers')

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

// Container state schema
export const ContainerStateSchema = z.object({
  started: z.boolean().default(false).describe('Whether the container has been started'),
  enabledFeatures: z.array(z.string()).describe('List of currently enabled feature shortcut IDs'),
  registries: z.array(z.string()).describe('Names of attached registries (e.g. features, clients, servers)'),
  factories: z.array(z.string()).describe('Names of available factory methods (e.g. feature, client, server)'),
}).describe('Core container state')

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

// WebSocket client schemas
export const WebSocketClientStateSchema = ClientStateSchema.extend({
  connectionError: z.any().optional().describe('The last connection error, if any'),
  reconnectAttempts: z.number().default(0).describe('Number of reconnection attempts made'),
}).describe('WebSocket client state with connection error and reconnect tracking')

export const WebSocketClientOptionsSchema = ClientOptionsSchema.extend({
  reconnect: z.boolean().optional().describe('Whether to automatically reconnect on disconnection'),
  reconnectInterval: z.number().optional().describe('Base interval in milliseconds between reconnection attempts'),
  maxReconnectAttempts: z.number().optional().describe('Maximum number of reconnection attempts before giving up'),
}).describe('WebSocket client options with reconnection settings')

export const WebSocketClientEventsSchema = ClientEventsSchema.extend({
  message: z.tuple([z.any().describe('The parsed message data')]).describe('Emitted when a message is received'),
  open: z.tuple([]).describe('Emitted when the WebSocket connection is established'),
  close: z.tuple([z.number().optional().describe('Close code'), z.string().optional().describe('Close reason')]).describe('Emitted when the WebSocket connection is closed'),
  error: z.tuple([z.any().describe('The error')]).describe('Emitted when a WebSocket error occurs'),
  reconnecting: z.tuple([z.number().describe('Attempt number')]).describe('Emitted when attempting to reconnect'),
}).describe('WebSocket client events')

// GraphQL client schemas
export const GraphClientOptionsSchema = ClientOptionsSchema.extend({
  endpoint: z.string().optional().describe('The GraphQL endpoint path, defaults to /graphql'),
}).describe('GraphQL client options')

export const GraphClientEventsSchema = ClientEventsSchema.extend({
  graphqlError: z.tuple([z.array(z.any()).describe('Array of GraphQL errors')]).describe('Emitted when GraphQL-level errors are present in the response'),
}).describe('GraphQL client events')

export const ServerEventsSchema = HelperEventsSchema.extend({}).describe('Base server events')

// MCP Server schemas
export const MCPServerOptionsSchema = ServerOptionsSchema.extend({
  transport: z.enum(['stdio', 'http']).optional().describe('Transport type for MCP communication'),
  serverName: z.string().optional().describe('Server name reported to MCP clients'),
  serverVersion: z.string().optional().describe('Server version reported to MCP clients'),
  mcpCompat: z.enum(['standard', 'codex']).optional().describe('HTTP compatibility profile for MCP clients'),
  stdioCompat: z.enum(['standard', 'codex', 'auto']).optional().describe('Stdio framing compatibility profile for MCP clients'),
}).describe('MCP server options')

export const MCPServerStateSchema = ServerStateSchema.extend({
  transport: z.string().optional().describe('Active transport type'),
  toolCount: z.number().default(0).describe('Number of registered tools'),
  resourceCount: z.number().default(0).describe('Number of registered resources'),
  promptCount: z.number().default(0).describe('Number of registered prompts'),
}).describe('MCP server state with tool/resource/prompt counts')

export const MCPServerEventsSchema = ServerEventsSchema.extend({
  toolRegistered: z.tuple([z.string().describe('Tool name')]).describe('Emitted when a tool is registered'),
  resourceRegistered: z.tuple([z.string().describe('Resource URI')]).describe('Emitted when a resource is registered'),
  promptRegistered: z.tuple([z.string().describe('Prompt name')]).describe('Emitted when a prompt is registered'),
  toolCalled: z.tuple([z.string().describe('Tool name'), z.any().describe('Arguments')]).describe('Emitted when a tool is called'),
}).describe('MCP server events')

// Command schemas
export const CommandStateSchema = HelperStateSchema.extend({
  running: z.boolean().default(false).describe('Whether the command is currently executing'),
  exitCode: z.number().optional().describe('Exit code after command finishes'),
}).describe('Base command state')

export const CommandOptionsSchema = HelperOptionsSchema.extend({
  _: z.array(z.string()).default([]).describe('Positional arguments from minimist'),
  dispatchSource: z.enum(['cli', 'headless', 'mcp', 'rpc']).default('cli').describe('How this command was invoked — controls arg normalization and output capture'),
}).describe('Base command options parsed from argv')

export type DispatchSource = 'cli' | 'headless' | 'mcp' | 'rpc'

export interface CommandRunResult {
  exitCode: number
  stdout: string
  stderr: string
}

export const CommandEventsSchema = HelperEventsSchema.extend({
  started: z.tuple([]).describe('Emitted when command execution begins'),
  completed: z.tuple([z.number().describe('Exit code')]).describe('Emitted when command execution finishes'),
  failed: z.tuple([z.any().describe('The error')]).describe('Emitted when command execution fails'),
}).describe('Base command events')

// Selector schemas
export const SelectorStateSchema = HelperStateSchema.extend({
  running: z.boolean().default(false).describe('Whether the selector is currently running'),
  lastRanAt: z.number().optional().describe('Unix timestamp of last successful run'),
}).describe('Base selector state')

export const SelectorOptionsSchema = HelperOptionsSchema.extend({
  dispatchSource: z.enum(['cli', 'headless', 'mcp', 'rpc']).default('headless').describe('How this selector was invoked'),
}).describe('Base selector options')

export interface SelectorRunResult<T = any> {
  data: T
  cached: boolean
  cacheKey: string
}

export const SelectorEventsSchema = HelperEventsSchema.extend({
  started: z.tuple([]).describe('Emitted when selector execution begins'),
  completed: z.tuple([z.any().describe('The result data')]).describe('Emitted when selector execution finishes'),
  failed: z.tuple([z.any().describe('The error')]).describe('Emitted when selector execution fails'),
}).describe('Base selector events')

// Endpoint schemas
export const EndpointStateSchema = HelperStateSchema.extend({
  mounted: z.boolean().default(false).describe('Whether the endpoint is mounted on a server'),
  path: z.string().default('').describe('The URL path this endpoint is served from'),
  methods: z.array(z.string()).default([]).describe('HTTP methods this endpoint handles'),
  requestCount: z.number().default(0).describe('Total number of requests handled'),
}).describe('Base endpoint state')

export const EndpointOptionsSchema = HelperOptionsSchema.extend({
  path: z.string().describe('The URL path this endpoint is served from'),
  filePath: z.string().optional().describe('Absolute path to the endpoint source file'),
}).describe('Base endpoint options')

export const EndpointEventsSchema = HelperEventsSchema.extend({
  loaded: z.tuple([z.any().describe('The loaded endpoint module')]).describe('Emitted when the endpoint module is loaded'),
  mounted: z.tuple([z.string().describe('The path')]).describe('Emitted when the endpoint is mounted on a server'),
  request: z.tuple([z.string().describe('HTTP method'), z.string().describe('Path'), z.any().describe('Parameters')]).describe('Emitted on every request'),
  error: z.tuple([z.any().describe('The error object')]).describe('Emitted when a request handler throws'),
}).describe('Base endpoint events')

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
