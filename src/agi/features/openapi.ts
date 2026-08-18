import { Feature } from '../feature.js'
import type { Helper } from '../../helper.js'
import { FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from '../../schemas/base.js'
import { z } from 'zod'
import { camelCase } from 'lodash-es'

declare module '../../feature.js' {
  interface AvailableFeatures {
    openapi: typeof OpenAPI
  }
}

export const OpenAPIStateSchema = FeatureStateSchema.extend({
  loaded: z.boolean().default(false).describe('Whether the OpenAPI spec has been fetched and parsed'),
  title: z.string().default('').describe('The API title from the spec info block'),
  version: z.string().default('').describe('The API version from the spec info block'),
  endpointCount: z.number().default(0).describe('Number of parsed endpoints in the spec'),
})

export const OpenAPIOptionsSchema = FeatureOptionsSchema.extend({
  url: z.string().optional().describe('URL to the OpenAPI/Swagger spec or the API server base URL')
})

export const OpenAPIEventsSchema = FeatureEventsSchema.extend({
	loaded: z.tuple([z.any().describe('The parsed OpenAPI spec object')]).describe('Fired after the spec is fetched and parsed'),
}).describe('OpenAPI events')

export type OpenAPIOptions = z.infer<typeof OpenAPIOptionsSchema>
export type OpenAPIState = z.infer<typeof OpenAPIStateSchema>



export interface EndpointInfo {
  /** Human-friendly camelCase name derived from operationId */
  name: string
  /** Original operationId from the spec */
  operationId: string
  /** HTTP method (get, post, put, delete, patch, etc.) */
  method: string
  /** URL path template, e.g. /pets/{petId} */
  path: string
  /** Summary from the spec */
  summary: string
  /** Longer description from the spec */
  description: string
  /** Tags for grouping */
  tags: string[]
  /** Parameter definitions from the spec */
  parameters: OpenAPIParameter[]
  /** Request body schema if present */
  requestBody: any
  /** Response definitions keyed by status code */
  responses: Record<string, any>
  /** Whether the endpoint is deprecated */
  deprecated: boolean
}

export interface OpenAPIParameter {
  name: string
  in: 'query' | 'path' | 'header' | 'cookie'
  description: string
  required: boolean
  schema: any
}

export interface OpenAIFunctionDef {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, any>
    required: string[]
  }
}

export interface OpenAIToolDef {
  type: 'function'
  function: OpenAIFunctionDef
}

/**
 * The OpenAPI feature loads an OpenAPI/Swagger spec from a URL and provides
 * inspection and conversion utilities.
 *
 * Works in both browser and node environments since it uses fetch.
 *
 * @example
 * ```typescript
 * const api = container.feature('openapi', { url: 'https://petstore.swagger.io/v2' })
 * await api.load()
 *
 * // Inspect all endpoints
 * api.endpoints
 *
 * // Get a single endpoint by its friendly name
 * api.endpoint('getPetById')
 *
 * // Convert to OpenAI tool definitions
 * api.toOpenAITools()
 *
 * // Convert a single endpoint to a function definition
 * api.toFunction('getPetById')
 *
 * // Call an endpoint directly
 * await api.call('getPetById', { petId: 42 })
 *
 * // Give an assistant the whole API as callable tools — the spec is loaded
 * // and the tools registered before the assistant starts
 * assistant.use(container.feature('openapi', { url: 'https://petstore.swagger.io/v2' }))
 * ```
 */
export class OpenAPI extends Feature<OpenAPIState, OpenAPIOptions> {
  static override shortcut = 'features.openapi' as const
  static override description = 'Load and inspect OpenAPI specs, convert endpoints to OpenAI tool/function definitions'
  static override stability = 'stable' as const
  static override category = 'ai-assistants' as const
  static override stateSchema = OpenAPIStateSchema
  static override optionsSchema = OpenAPIOptionsSchema
  static override eventsSchema = OpenAPIEventsSchema

  static { Feature.register(this, 'openapi') }

  /** Raw parsed spec document */
  private _spec: any = null

  /** Parsed endpoint map keyed by friendly name */
  private _endpoints: Map<string, EndpointInfo> = new Map()

  /** @returns Default state with loaded=false and empty metadata fields. */
  override get initialState(): OpenAPIState {
    return { enabled: false, loaded: false, title: '', version: '', endpointCount: 0 }
  }

  /** The base server URL derived from options, normalizing the openapi.json suffix */
  get serverUrl(): string {
    const url = this.options.url || ''
    // Spec loaded from a local file — the only callable base URL is the one the spec declares
    if (!/^https?:\/\//.test(url)) {
      return String(this._spec?.servers?.[0]?.url || '').replace(/\/$/, '')
    }
    return url.replace(/\/openapi\.json\/?$/, '').replace(/\/swagger\.json\/?$/, '').replace(/\/$/, '')
  }

  /** The URL that will be fetched for the spec document */
  get specUrl(): string {
    const url = this.options.url!
    if (/\.(json|yaml|yml)(\?.*)?$/.test(url)) return url
    return `${this.serverUrl}/openapi.json`
  }

  /** The raw spec object. Null before load() is called. */
  get spec() {
    return this._spec
  }

  /**
   * Fetches and parses the OpenAPI spec from the configured URL.
   * Populates `endpoints`, updates state with spec metadata.
   *
   * @returns {Promise<this>} This instance, for chaining
   */
  async load(): Promise<this> {
    const specUrl = this.specUrl
    let raw: string

    const fsAvailable = (this.container as any).features?.available?.includes?.('fs')
    if (!/^https?:\/\//.test(specUrl) && fsAvailable) {
      raw = (this.container as any).feature('fs').readFile(specUrl) as string
    } else {
      const response = await fetch(specUrl)
      if (!response.ok) {
        throw new Error(`Failed to load OpenAPI spec from ${specUrl}: ${response.status} ${response.statusText}`)
      }
      raw = await response.text()
    }

    try {
      this._spec = JSON.parse(raw)
    } catch (jsonErr) {
      // Specs are commonly YAML — fall back when the yaml feature is around
      const yamlAvailable = (this.container as any).features?.available?.includes?.('yaml')
      if (!yamlAvailable) throw jsonErr
      this._spec = (this.container as any).feature('yaml').parse(raw)
    }
    this._endpoints = buildEndpointMap(this._spec)

    this.setState({
      loaded: true,
      title: this._spec.info?.title || '',
      version: this._spec.info?.version || '',
      endpointCount: this._endpoints.size,
    })

    this.emit('started', this._spec)
    return this
  }

  /** All parsed endpoints as an array */
  get endpoints(): EndpointInfo[] {
    return Array.from(this._endpoints.values())
  }

  /** All endpoint friendly names */
  get endpointNames(): string[] {
    return Array.from(this._endpoints.keys())
  }

  /** Map of endpoints grouped by tag */
  get endpointsByTag(): Record<string, EndpointInfo[]> {
    const result: Record<string, EndpointInfo[]> = {}
    for (const ep of this._endpoints.values()) {
      const tags = ep.tags.length ? ep.tags : ['untagged']
      for (const tag of tags) {
        if (!result[tag]) result[tag] = []
        result[tag].push(ep)
      }
    }
    return result
  }

  /**
   * Get a single endpoint by its friendly name or operationId.
   *
   * @param {string} name - The friendly name or operationId to look up
   * @returns {EndpointInfo | undefined} The endpoint info, or undefined if not found
   */
  endpoint(name: string): EndpointInfo | undefined {
    return this._endpoints.get(name)
      || this.endpoints.find((ep) => ep.operationId === name)
  }

  /**
   * Convert all endpoints into OpenAI-compatible tool definitions.
   *
   * @param {Function} [filter] - Optional predicate to select which endpoints to include
   * @returns {OpenAIToolDef[]} Array of tool definitions ready for the OpenAI tools parameter
   */
  toOpenAITools(filter?: (ep: EndpointInfo) => boolean): OpenAIToolDef[] {
    const eps = filter ? this.endpoints.filter(filter) : this.endpoints
    return eps.map((ep) => ({
      type: 'function' as const,
      function: endpointToFunction(ep),
    }))
  }

  /**
   * Convert a single endpoint (by name) to an OpenAI-compatible tool definition.
   *
   * @param {string} name - The endpoint friendly name or operationId
   * @returns {OpenAIToolDef | undefined} The tool definition, or undefined if not found
   */
  toTool(name: string): OpenAIToolDef | undefined {
    const ep = this.endpoint(name)
    if (!ep) return undefined
    return { type: 'function', function: endpointToFunction(ep) }
  }

  /**
   * Convert all endpoints into OpenAI-compatible function definitions.
   *
   * @param {Function} [filter] - Optional predicate to select which endpoints to include
   * @returns {OpenAIFunctionDef[]} Array of function definitions
   */
  toFunctions(filter?: (ep: EndpointInfo) => boolean): OpenAIFunctionDef[] {
    const eps = filter ? this.endpoints.filter(filter) : this.endpoints
    return eps.map(endpointToFunction)
  }

  /**
   * Convert a single endpoint (by name) to an OpenAI function definition.
   *
   * @param {string} name - The endpoint friendly name or operationId
   * @returns {OpenAIFunctionDef | undefined} The function definition, or undefined if not found
   */
  toFunction(name: string): OpenAIFunctionDef | undefined {
    const ep = this.endpoint(name)
    if (!ep) return undefined
    return endpointToFunction(ep)
  }

  /**
   * Execute an endpoint against the live API.
   *
   * Splits the flat args object back into path, query, and header parameters
   * (mirroring how `toOpenAITools` flattened them) and sends whatever remains
   * as the JSON request body. Loads the spec first if it hasn't been loaded.
   *
   * @param {string} name - The endpoint friendly name or operationId
   * @param {Record<string, any>} [args] - Flat argument object matching the tool schema
   * @returns {Promise<any>} Parsed JSON response body (or raw text if not JSON). HTTP errors return { error, status, statusText, data } instead of throwing.
   *
   * @example
   * ```typescript
   * const pet = await api.call('getPetById', { petId: 42 })
   * ```
   */
  async call(name: string, args: Record<string, any> = {}): Promise<any> {
    if (!this.state.get('loaded')) await this.load()

    const ep = this.endpoint(name)
    if (!ep) throw new Error(`Unknown endpoint "${name}". Available: ${this.endpointNames.join(', ')}`)

    const base = this.serverUrl
    if (!base) throw new Error(`No server URL to call for "${name}" — pass an http(s) url in options, or declare servers[] in the spec`)

    let path = ep.path
    const query = new URLSearchParams()
    const headers: Record<string, string> = {}
    const consumed = new Set<string>()

    for (const param of ep.parameters) {
      const value = args[param.name]
      if (value === undefined || value === null) continue
      if (param.in === 'path') {
        path = path.replace(`{${param.name}}`, encodeURIComponent(String(value)))
        consumed.add(param.name)
      } else if (param.in === 'query') {
        query.set(param.name, String(value))
        consumed.add(param.name)
      } else if (param.in === 'header') {
        headers[param.name] = String(value)
        consumed.add(param.name)
      }
    }

    let body: any
    const bodySchema = ep.requestBody?.content?.['application/json']?.schema
    if (bodySchema) {
      if (!bodySchema.properties && args.body !== undefined) {
        // Single-schema bodies are exposed as a "body" arg by endpointToFunction
        body = args.body
      } else {
        const rest: Record<string, any> = {}
        for (const [key, value] of Object.entries(args)) {
          if (!consumed.has(key) && value !== undefined) rest[key] = value
        }
        if (Object.keys(rest).length) body = rest
      }
    }

    const qs = query.toString()
    const url = `${base}${path}${qs ? `?${qs}` : ''}`
    const init: RequestInit = { method: ep.method.toUpperCase(), headers }
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json'
      init.body = JSON.stringify(body)
    }

    const response = await fetch(url, init)
    const text = await response.text()
    let data: any = text
    try { data = text ? JSON.parse(text) : null } catch { /* leave as text */ }

    if (!response.ok) {
      // Returned, not thrown, so the model can read the failure and adjust
      return { error: true, status: response.status, statusText: response.statusText, data }
    }
    return data
  }

  /**
   * Expose every endpoint as an assistant tool, satisfying the standard
   * `toTools()` contract so `assistant.use(container.feature('openapi', { url }))`
   * just works. Each handler executes the live HTTP call via `call()`.
   *
   * If the spec hasn't loaded yet this returns no tools — `setupToolsConsumer`
   * defers loading and registers the real tools before the assistant starts.
   *
   * @param {{ only?: string[], except?: string[] }} [options] - Filter tools by endpoint name
   * @returns Tools bundle consumable by `assistant.use()`
   */
  override toTools(options?: { only?: string[], except?: string[] }): ReturnType<Helper['toTools']> {
    let eps = this.endpoints
    if (options?.only) eps = eps.filter((ep) => options.only!.includes(ep.name))
    if (options?.except) eps = eps.filter((ep) => !options.except!.includes(ep.name))

    const schemas: Record<string, any> = {}
    const handlers: Record<string, Function> = {}

    for (const ep of eps) {
      const def = endpointToFunction(ep)
      // addTool() only needs a .toJSONSchema() duck type (same trick as mcpBridge)
      schemas[ep.name] = {
        description: def.description,
        toJSONSchema: () => ({ ...def.parameters, description: def.description }),
      }
      handlers[ep.name] = (toolArgs: any) => this.call(ep.name, toolArgs || {})
    }

    return { schemas, handlers, setup: (consumer: Helper) => this.setupToolsConsumer(consumer) } as any
  }

  /**
   * When an assistant consumes this feature before the spec is loaded, queue an
   * async plugin that loads the spec and registers the real tools — assistants
   * await these before starting. Once loaded, adds a system prompt extension
   * describing the API.
   */
  override setupToolsConsumer(consumer: Helper): void {
    const assistant = consumer as any
    if (typeof assistant.use !== 'function') return

    if (!this.state.get('loaded')) {
      assistant.use(async () => {
        await this.load()
        assistant.use(this.toTools())
      })
      return
    }

    if (typeof assistant.addSystemPromptExtension === 'function') {
      const title = this.state.get('title') || this.serverUrl || 'OpenAPI'
      assistant.addSystemPromptExtension(`openapi:${title}`, this.toSystemPrompt())
    }
  }

  /**
   * Build a system prompt brief for this API from the spec's info block:
   * title, summary (OpenAPI 3.1), and description. This is what
   * `assistant.use(api)` injects so the model knows what the API is,
   * not just what its tools are.
   *
   * @returns {string} Text suitable for a system prompt extension
   */
  toSystemPrompt(): string {
    const info = this._spec?.info || {}
    const title = info.title || this.serverUrl || 'OpenAPI'
    const lines: string[] = [
      `You have tools for the "${title}" API (${this._endpoints.size} endpoints). Each tool calls the live API and returns its response.`,
    ]

    // info.summary is OpenAPI 3.1; description is the long-form markdown docs
    if (info.summary) lines.push(info.summary)
    if (info.description) lines.push(info.description)

    return lines.join('\n\n')
  }

  /**
   * Return a compact JSON summary of all endpoints, useful for logging or REPL inspection.
   *
   * @returns {{ title: string, version: string, serverUrl: string, endpointCount: number, endpoints: object[] }} Serializable summary
   */
  toJSON() {
    return {
      title: this.state.get('title'),
      version: this.state.get('version'),
      serverUrl: this.serverUrl,
      endpointCount: this._endpoints.size,
      endpoints: this.endpoints.map((ep) => ({
        name: ep.name,
        method: ep.method.toUpperCase(),
        path: ep.path,
        summary: ep.summary,
        tags: ep.tags,
        deprecated: ep.deprecated,
      })),
    }
  }
}

/**
 * Derive a human-friendly camelCase name from an operationId, or synthesize one from method + path.
 */
function friendlyName(operationId: string | undefined, method: string, path: string): string {
  if (operationId) return camelCase(operationId)

  // Synthesize: GET /pets/{petId} -> getPetsPetId
  const cleaned = path
    .replace(/\{(\w+)\}/g, '$1')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()

  return camelCase(`${method} ${cleaned}`)
}

/**
 * Walk the spec paths and build a Map<friendlyName, EndpointInfo>.
 */
function buildEndpointMap(spec: any): Map<string, EndpointInfo> {
  const map = new Map<string, EndpointInfo>()
  const paths = spec.paths || {}

  for (const [path, pathItem] of Object.entries<any>(paths)) {
    // Shared parameters at the path level
    const sharedParams: OpenAPIParameter[] = (pathItem.parameters || []).map(normalizeParam)

    for (const method of ['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'trace']) {
      const operation = pathItem[method]
      if (!operation) continue

      const name = friendlyName(operation.operationId, method, path)
      const opParams: OpenAPIParameter[] = (operation.parameters || []).map(normalizeParam)

      // Merge path-level params with operation-level (operation overrides by name+in)
      const paramKey = (p: OpenAPIParameter) => `${p.in}:${p.name}`
      const merged = new Map<string, OpenAPIParameter>()
      for (const p of sharedParams) merged.set(paramKey(p), p)
      for (const p of opParams) merged.set(paramKey(p), p)

      const endpoint: EndpointInfo = {
        name,
        operationId: operation.operationId || '',
        method,
        path,
        summary: operation.summary || '',
        description: operation.description || '',
        tags: operation.tags || [],
        parameters: Array.from(merged.values()),
        requestBody: operation.requestBody || null,
        responses: operation.responses || {},
        deprecated: !!operation.deprecated,
      }

      map.set(name, endpoint)
    }
  }

  return map
}

function normalizeParam(raw: any): OpenAPIParameter {
  return {
    name: raw.name || '',
    in: raw.in || 'query',
    description: raw.description || '',
    required: !!raw.required,
    schema: raw.schema || {},
  }
}

/**
 * Convert an EndpointInfo into an OpenAI-compatible function definition.
 *
 * Merges path, query, and header params + requestBody properties into a single
 * flat `parameters` object, which is the format OpenAI expects.
 */
function endpointToFunction(ep: EndpointInfo): OpenAIFunctionDef {
  const properties: Record<string, any> = {}
  const required: string[] = []

  for (const param of ep.parameters) {
    properties[param.name] = {
      ...schemaToJsonSchema(param.schema),
      description: param.description || `${param.in} parameter`,
    }
    if (param.required) required.push(param.name)
  }

  // Merge requestBody properties (for application/json)
  const bodySchema = ep.requestBody?.content?.['application/json']?.schema
  if (bodySchema) {
    if (bodySchema.properties) {
      for (const [key, val] of Object.entries<any>(bodySchema.properties)) {
        properties[key] = schemaToJsonSchema(val)
      }
      if (bodySchema.required) {
        for (const r of bodySchema.required) {
          if (!required.includes(r)) required.push(r)
        }
      }
    } else {
      // If the body is a single schema without properties, expose it as "body"
      properties['body'] = {
        ...schemaToJsonSchema(bodySchema),
        description: 'Request body',
      }
    }
  }

  const description = [ep.summary, ep.description]
    .filter(Boolean)
    .join(' — ')
    || `${ep.method.toUpperCase()} ${ep.path}`

  return {
    name: ep.name,
    description,
    parameters: {
      type: 'object',
      properties,
      required,
    },
  }
}

/**
 * Lightweight conversion of an OpenAPI schema fragment to a JSON Schema-compatible
 * fragment suitable for OpenAI function calling.
 *
 * Handles the common cases: primitives, arrays, objects, enums, $ref (as opaque string).
 */
function schemaToJsonSchema(schema: any): any {
  if (!schema) return { type: 'string' }

  // Pass through $ref as a string description since we don't resolve refs here
  if (schema.$ref) {
    return { type: 'string', description: `Reference: ${schema.$ref}` }
  }

  const result: any = {}

  if (schema.type) result.type = schema.type
  if (schema.description) result.description = schema.description
  if (schema.enum) result.enum = schema.enum
  if (schema.default !== undefined) result.default = schema.default

  if (schema.type === 'array' && schema.items) {
    result.items = schemaToJsonSchema(schema.items)
  }

  if (schema.type === 'object' && schema.properties) {
    result.properties = {}
    for (const [key, val] of Object.entries<any>(schema.properties)) {
      result.properties[key] = schemaToJsonSchema(val)
    }
    if (schema.required) result.required = schema.required
  }

  // oneOf / anyOf / allOf pass-through
  if (schema.oneOf) result.oneOf = schema.oneOf.map(schemaToJsonSchema)
  if (schema.anyOf) result.anyOf = schema.anyOf.map(schemaToJsonSchema)
  if (schema.allOf) result.allOf = schema.allOf.map(schemaToJsonSchema)

  // Default to string if nothing was set
  if (!result.type && !result.oneOf && !result.anyOf && !result.allOf) {
    result.type = 'string'
  }

  return result
}

export default OpenAPI
