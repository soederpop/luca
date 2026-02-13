import { Feature, features } from './feature.js'
import { FeatureStateSchema, FeatureOptionsSchema } from './schemas/base.js'
import { z } from 'zod'
import { camelCase } from 'lodash-es'

export const OpenAPIStateSchema = FeatureStateSchema.extend({
  loaded: z.boolean().default(false),
  title: z.string().default(''),
  version: z.string().default(''),
  endpointCount: z.number().default(0),
})

export const OpenAPIOptionsSchema = FeatureOptionsSchema.extend({
  url: z.string().url(),
})

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
 * api.toTools()
 *
 * // Convert a single endpoint to a function definition
 * api.toFunction('getPetById')
 * ```
 */
export class OpenAPI extends Feature<OpenAPIState, OpenAPIOptions> {
  static override shortcut = 'features.openapi' as const
  static override description = 'Load and inspect OpenAPI specs, convert endpoints to OpenAI tool/function definitions'
  static override stateSchema = OpenAPIStateSchema
  static override optionsSchema = OpenAPIOptionsSchema

  /** Raw parsed spec document */
  private _spec: any = null

  /** Parsed endpoint map keyed by friendly name */
  private _endpoints: Map<string, EndpointInfo> = new Map()

  override get initialState(): OpenAPIState {
    return { enabled: false, loaded: false, title: '', version: '', endpointCount: 0 }
  }

  /** The base server URL derived from options, normalizing the openapi.json suffix */
  get serverUrl(): string {
    return this.options.url.replace(/\/openapi\.json\/?$/, '').replace(/\/swagger\.json\/?$/, '').replace(/\/$/, '')
  }

  /** The URL that will be fetched for the spec document */
  get specUrl(): string {
    const url = this.options.url
    if (/\.(json|yaml|yml)(\?.*)?$/.test(url)) return url
    return `${this.serverUrl}/openapi.json`
  }

  /** The raw spec object. Null before load() is called. */
  get spec() {
    return this._spec
  }

  /**
   * Fetches and parses the OpenAPI spec from the configured URL.
   *
   * Populates `endpoints`, updates state with spec metadata.
   */
  async load(): Promise<this> {
    const response = await fetch(this.specUrl)

    if (!response.ok) {
      throw new Error(`Failed to load OpenAPI spec from ${this.specUrl}: ${response.status} ${response.statusText}`)
    }

    this._spec = await response.json()
    this._endpoints = buildEndpointMap(this._spec)

    this.setState({
      loaded: true,
      title: this._spec.info?.title || '',
      version: this._spec.info?.version || '',
      endpointCount: this._endpoints.size,
    })

    this.emit('loaded', this._spec)
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
   */
  endpoint(name: string): EndpointInfo | undefined {
    return this._endpoints.get(name)
      || this.endpoints.find((ep) => ep.operationId === name)
  }

  /**
   * Convert all endpoints into OpenAI-compatible tool definitions.
   *
   * @param filter - Optional predicate to select which endpoints to include.
   */
  toTools(filter?: (ep: EndpointInfo) => boolean): OpenAIToolDef[] {
    const eps = filter ? this.endpoints.filter(filter) : this.endpoints
    return eps.map((ep) => ({
      type: 'function' as const,
      function: endpointToFunction(ep),
    }))
  }

  /**
   * Convert a single endpoint (by name) to an OpenAI-compatible tool definition.
   */
  toTool(name: string): OpenAIToolDef | undefined {
    const ep = this.endpoint(name)
    if (!ep) return undefined
    return { type: 'function', function: endpointToFunction(ep) }
  }

  /**
   * Convert all endpoints into OpenAI-compatible function definitions.
   *
   * @param filter - Optional predicate to select which endpoints to include.
   */
  toFunctions(filter?: (ep: EndpointInfo) => boolean): OpenAIFunctionDef[] {
    const eps = filter ? this.endpoints.filter(filter) : this.endpoints
    return eps.map(endpointToFunction)
  }

  /**
   * Convert a single endpoint (by name) to an OpenAI function definition.
   */
  toFunction(name: string): OpenAIFunctionDef | undefined {
    const ep = this.endpoint(name)
    if (!ep) return undefined
    return endpointToFunction(ep)
  }

  /**
   * Return a compact JSON summary of all endpoints, useful for logging or REPL inspection.
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

export default features.register('openapi', OpenAPI)
