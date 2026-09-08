import { Helper } from './helper.js'
import type { Container, ContainerContext } from './container.js'
import { Registry } from './registry.js'
import { z } from 'zod'
import { EndpointStateSchema, EndpointOptionsSchema, EndpointEventsSchema } from './schemas/base.js'
import { HttpError } from './http-error.js'
import { isMultipartRequest, parseMultipart, type UploadConfig, type UploadedFile } from './multipart.js'

export { HttpError } from './http-error.js'
export type { UploadConfig, UploadFieldConfig, UploadedFile } from './multipart.js'

export interface AvailableEndpoints {}

export type EndpointState = z.infer<typeof EndpointStateSchema>
export type EndpointOptions = z.infer<typeof EndpointOptionsSchema>

export type EndpointHandler = (
  parameters: Record<string, any>,
  context: EndpointContext
) => Promise<any> | any

export type EndpointContext = {
  container: Container<any>
  request: any
  response: any
  query: Record<string, any>
  body: Record<string, any>
  params: Record<string, any>
}

export interface EndpointRateLimit {
  /** Maximum requests allowed per window */
  maxRequests: number
  /** Window size in seconds (default: 1) */
  windowSeconds?: number
}

export interface EndpointModule {
  path: string
  get?: EndpointHandler
  post?: EndpointHandler
  put?: EndpointHandler
  patch?: EndpointHandler
  delete?: EndpointHandler
  getSchema?: z.ZodType
  postSchema?: z.ZodType
  putSchema?: z.ZodType
  patchSchema?: z.ZodType
  deleteSchema?: z.ZodType
  /** Rate limit applied to all methods on this endpoint */
  rateLimit?: EndpointRateLimit
  /** Per-method rate limits (overrides the endpoint-level rateLimit) */
  getRateLimit?: EndpointRateLimit
  postRateLimit?: EndpointRateLimit
  putRateLimit?: EndpointRateLimit
  patchRateLimit?: EndpointRateLimit
  deleteRateLimit?: EndpointRateLimit
  /** Zod schema describing the 200 response body, used to type the OpenAPI spec */
  getResponse?: z.ZodType
  postResponse?: z.ZodType
  putResponse?: z.ZodType
  patchResponse?: z.ZodType
  deleteResponse?: z.ZodType
  /** Raw OpenAPI responses object, merged over the generated defaults (for 202, 404, ...) */
  getResponses?: Record<string, any>
  postResponses?: Record<string, any>
  putResponses?: Record<string, any>
  patchResponses?: Record<string, any>
  deleteResponses?: Record<string, any>
  /** Declares multipart/form-data file uploads — enables parsing and describes the body in the spec */
  getUpload?: UploadConfig
  postUpload?: UploadConfig
  putUpload?: UploadConfig
  patchUpload?: UploadConfig
  deleteUpload?: UploadConfig
  /** OpenAPI security requirement for this endpoint. `[]` marks it public when the spec has a root default. */
  security?: any[]
  description?: string
  tags?: string[]
}

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const

/** All recognized exports on an endpoint module */
const KNOWN_EXPORTS = new Set([
  'path', 'description', 'tags', 'default', 'rateLimit', 'security',
  ...HTTP_METHODS,
  ...HTTP_METHODS.map(m => `${m}Schema`),
  ...HTTP_METHODS.map(m => `${m}RateLimit`),
  ...HTTP_METHODS.map(m => `${m}Response`),
  ...HTTP_METHODS.map(m => `${m}Responses`),
  ...HTTP_METHODS.map(m => `${m}Upload`),
])

/** Express route params (`:id`, `:id?`) as OpenAPI template params (`{id}`). */
export function toOpenAPIPath(path: string): string {
  return path.replace(/:([A-Za-z0-9_]+)\??/g, '{$1}')
}

/** The route param names declared in an express path, with whether each is optional. */
export function pathParameterNames(path: string): Array<{ name: string; required: boolean }> {
  const found: Array<{ name: string; required: boolean }> = []
  for (const match of path.matchAll(/:([A-Za-z0-9_]+)(\?)?/g)) {
    found.push({ name: match[1] as string, required: !match[2] })
  }
  return found
}

/**
 * Sliding-window rate limiter keyed by IP address.
 * Tracks timestamps of requests and prunes entries older than the window.
 */
class RateLimiter {
  private _windows = new Map<string, number[]>()

  /** Returns true if the request is allowed, false if rate-limited. */
  allow(key: string, maxRequests: number, windowMs: number): boolean {
    const now = Date.now()
    let timestamps = this._windows.get(key)

    if (!timestamps) {
      timestamps = []
      this._windows.set(key, timestamps)
    }

    // Prune timestamps outside the window
    while (timestamps.length > 0 && (timestamps[0] ?? 0) <= now - windowMs) {
      timestamps.shift()
    }

    if (timestamps.length >= maxRequests) {
      return false
    }

    timestamps.push(now)
    return true
  }

  /** Clear all tracking state */
  reset(): void {
    this._windows.clear()
  }
}

export type EndpointFactory = <T extends keyof AvailableEndpoints>(
  key: T,
  options?: ConstructorParameters<AvailableEndpoints[T]>[0]
) => NonNullable<InstanceType<AvailableEndpoints[T]>>

export interface EndpointsInterface {
  endpoints: EndpointsRegistry
  endpoint: EndpointFactory
}

export class Endpoint<
  T extends EndpointState = EndpointState,
  K extends EndpointOptions = EndpointOptions
> extends Helper<T, K> {
  static override shortcut = 'endpoints.base'
  static override description = 'File-based HTTP endpoint with Remix-like DX'
  static override stateSchema = EndpointStateSchema
  static override optionsSchema = EndpointOptionsSchema
  static override eventsSchema = EndpointEventsSchema

  private _module: EndpointModule | null = null
  private _rateLimiter = new RateLimiter()

  static attach(container: Container & EndpointsInterface): any {
    Object.assign(container, {
      get endpoints() {
        return endpoints
      },

      endpoint<T extends keyof AvailableEndpoints>(
        id: T,
        options?: ConstructorParameters<AvailableEndpoints[T]>[0]
      ): InstanceType<AvailableEndpoints[T]> {
        const BaseClass = endpoints.lookup(id as string) as any

        return container.createHelperInstance({
          cache: helperCache,
          type: 'endpoint',
          id: String(id),
          BaseClass,
          options,
          fallbackName: String(id),
        }) as InstanceType<AvailableEndpoints[T]>
      },
    })

    container.registerHelperType('endpoints', 'endpoint')

    return container
  }

  override get initialState(): T {
    return ({
      mounted: false,
      path: this.options.path || '',
      methods: [],
      requestCount: 0,
    } as unknown) as T
  }

  get path() {
    return this.options.path
  }

  get module() {
    return this._module
  }

  get methods(): string[] {
    if (!this._module) return []
    return HTTP_METHODS.filter((m) => typeof (this._module as any)[m] === 'function')
  }

  get isMounted() {
    return !!this.state.get('mounted')
  }

  async load(mod?: EndpointModule): Promise<this> {
    if (mod) {
      this._module = mod
    } else if (this.options.filePath) {
      const imported = await import(`${this.options.filePath}?t=${Date.now()}`)
      this._module = imported.default || imported
    }

    // Note: DELETE handlers should be exported as `export { del as delete }`.
    // We no longer remap `destroy` → `delete` because ESM namespace objects
    // are frozen and the mutation throws on Bun.

    this.state.set('methods', this.methods)
    this.state.set('path', this.path)
    this.emit('loaded', this._module)
    return this
  }

  async reload(): Promise<this> {
    this._module = null
    if (this.options.filePath) {
      const helpers = this.container.feature('helpers') as any
      const mod = await helpers.loadModuleExports(this.options.filePath, { cacheBust: true })
      const endpointModule: EndpointModule = mod.default || mod
      return this.load(endpointModule)
    }
    return this.load()
  }

  handler(method: string): EndpointHandler | undefined {
    return this._module?.[method as keyof EndpointModule] as EndpointHandler | undefined
  }

  schema(method: string): z.ZodType | undefined {
    return this._module?.[`${method}Schema` as keyof EndpointModule] as z.ZodType | undefined
  }

  /** The `<method>Response` zod schema describing the 200 body, if the module declares one. */
  responseSchema(method: string): z.ZodType | undefined {
    return this._module?.[`${method}Response` as keyof EndpointModule] as z.ZodType | undefined
  }

  /** Raw OpenAPI `responses` overrides from `<method>Responses`, merged over the defaults. */
  responseOverrides(method: string): Record<string, any> | undefined {
    return this._module?.[`${method}Responses` as keyof EndpointModule] as Record<string, any> | undefined
  }

  /** The `<method>Upload` multipart declaration, if this method accepts file uploads. */
  uploadFor(method: string): UploadConfig | undefined {
    return this._module?.[`${method}Upload` as keyof EndpointModule] as UploadConfig | undefined
  }

  /** This endpoint's path with express route params rewritten as OpenAPI templates. */
  get openAPIPath(): string {
    return toOpenAPIPath(this.path)
  }

  /** Returns the rate limit config for a given method, or undefined if none. */
  rateLimitFor(method: string): EndpointRateLimit | undefined {
    const perMethod = this._module?.[`${method}RateLimit` as keyof EndpointModule] as EndpointRateLimit | undefined
    return perMethod || this._module?.rateLimit
  }

  /** Access the rate limiter instance (useful for testing or manual resets) */
  get rateLimiter(): RateLimiter {
    return this._rateLimiter
  }

  mount(app: any): this {
    for (const method of this.methods) {
      const endpoint = this

      app[method](this.path, async (req: any, res: any) => {
        try {
          // Rate limit check
          const limit = endpoint.rateLimitFor(method)
          if (limit) {
            const ip = req.ip || req.socket?.remoteAddress || 'unknown'
            const key = `${method}:${ip}`
            const windowMs = (limit.windowSeconds ?? 1) * 1000
            if (!endpoint._rateLimiter.allow(key, limit.maxRequests, windowMs)) {
              endpoint.emit('error', new Error(`Rate limit exceeded for ${method.toUpperCase()} ${endpoint.path}`))
              res.status(429).json({ error: 'Too Many Requests' })
              return
            }
          }

          const currentHandler = endpoint.handler(method)
          if (!currentHandler) {
            res.status(404).json({ error: 'Not found' })
            return
          }

          // Multipart bodies bypass express.json, so parse them here when the
          // module declares an upload. Files arrive as named handler params.
          const upload = endpoint.uploadFor(method)
          let uploadedFiles: Record<string, UploadedFile | UploadedFile[]> = {}
          if (upload) {
            if (isMultipartRequest(req)) {
              const parsed = await parseMultipart(req, upload)
              uploadedFiles = parsed.files
              req.body = { ...(req.body || {}), ...parsed.fields }
            } else if (Object.values(upload.fields).some(f => f.required)) {
              throw new HttpError(415, 'Expected multipart/form-data request body')
            }
          }

          const routeParams = req.params || {}
          const parameters = { ...req.query, ...req.body, ...routeParams, ...uploadedFiles }
          const currentSchema = endpoint.schema(method)
          // Route params are merged in for convenience, but a .strict() schema would reject the
          // ones it never declared. Hide those from parse, then put them back on the result so
          // handlers reading validated.id keep working either way.
          const shape = (currentSchema as any)?.shape
          const parseInput = { ...parameters }
          if (shape) {
            for (const key of [...Object.keys(routeParams), ...Object.keys(uploadedFiles)]) {
              if (!(key in shape)) delete parseInput[key]
            }
          }
          const validated = currentSchema
            ? { ...(currentSchema.parse(parseInput) as Record<string, any>), ...routeParams, ...uploadedFiles }
            : parameters

          const ctx: EndpointContext = {
            container: endpoint.container,
            request: req,
            response: res,
            query: req.query || {},
            body: req.body || {},
            params: req.params || {},
          }

          const result = await currentHandler(validated, ctx)
          endpoint.state.set('requestCount', (endpoint.state.get('requestCount') || 0) + 1)
          endpoint.emit('request', method, endpoint.path, parameters)

          if (!res.headersSent) {
            res.json(result)
          }
        } catch (err: any) {
          endpoint.emit('error', err)
          if (!res.headersSent) {
            if (err.name === 'ZodError') {
              const issues = err.issues || err.errors || []
              const details = issues.map((e: any) => `${(e.path || []).join('.')}: ${e.message}`).join(', ')
              console.error(`[${method.toUpperCase()} ${endpoint.path}] Validation failed: ${details}`)
              res.status(400).json({ error: `Validation failed: ${details}`, details: issues })
            } else if (typeof err.statusCode === 'number') {
              console.error(`[${method.toUpperCase()} ${endpoint.path}] ${err.statusCode}: ${err.message}`)
              res.status(err.statusCode).json({ error: err.message, ...(err.details ? { details: err.details } : {}) })
            } else {
              console.error(`[${method.toUpperCase()} ${endpoint.path}] ${err.message}`)
              res.status(500).json({ error: err.message })
            }
          }
        }
      })
    }

    this.state.set('mounted', true)
    this.emit('mounted', this.path)
    return this
  }

  /**
   * Describe this endpoint as an OpenAPI 3.1 path item.
   *
   * Route params declared in the path (`/things/:id`) are emitted as
   * `in: path` parameters rather than being mistaken for query string
   * parameters, `<method>Response` schemas type the 200 body, and a
   * `<method>Upload` declaration is described as `multipart/form-data`.
   */
  toOpenAPIPathItem(): Record<string, any> {
    const pathItem: Record<string, any> = {}
    const routeParams = pathParameterNames(this.path)
    const routeParamNames = new Set(routeParams.map(p => p.name))

    for (const method of this.methods) {
      const methodSchema = this.schema(method)
      const operationId = `${method}_${this.openAPIPath.replace(/[\/{}]/g, '_').replace(/^_/, '')}`

      let jsonSchema: any = undefined
      if (methodSchema) {
        try {
          jsonSchema = (methodSchema as any).toJSONSchema()
        } catch {
          // Schema conversion failed, serve without parameter docs
        }
      }

      const properties = (jsonSchema?.properties || {}) as Record<string, any>
      const required: string[] = jsonSchema?.required || []

      // Path params come from the route, but a declared schema field of the
      // same name carries the better type and description.
      const parameters: any[] = routeParams.map(({ name, required: isRequired }) => ({
        name,
        in: 'path',
        required: isRequired,
        schema: properties[name] || { type: 'string' },
        description: properties[name]?.description || '',
      }))

      const operation: Record<string, any> = {
        operationId,
        summary: this._module?.description || `${method.toUpperCase()} ${this.path}`,
        tags: this._module?.tags || [],
        responses: this.buildResponses(method),
      }

      if (this._module?.security !== undefined) {
        operation.security = this._module.security
      }

      const upload = this.uploadFor(method)

      if (method === 'get' || method === 'delete') {
        for (const [name, prop] of Object.entries(properties)) {
          if (routeParamNames.has(name)) continue
          parameters.push({
            name,
            in: 'query',
            required: required.includes(name),
            schema: prop,
            description: (prop as any).description || '',
          })
        }
      } else if (!upload && jsonSchema) {
        operation.requestBody = {
          required: true,
          content: { 'application/json': { schema: this.omitPathParams(jsonSchema, routeParamNames) } },
        }
      }

      if (upload) {
        operation.requestBody = this.buildUploadRequestBody(upload, jsonSchema, routeParamNames)
      }

      if (parameters.length > 0) {
        operation.parameters = parameters
      }

      pathItem[method] = operation
    }

    return pathItem
  }

  /** Route params are described as path parameters, so keep them out of the body schema too. */
  private omitPathParams(jsonSchema: any, routeParamNames: Set<string>): any {
    if (!jsonSchema?.properties || routeParamNames.size === 0) return jsonSchema

    const properties = Object.fromEntries(
      Object.entries(jsonSchema.properties).filter(([name]) => !routeParamNames.has(name))
    )
    const required = (jsonSchema.required || []).filter((name: string) => !routeParamNames.has(name))

    return { ...jsonSchema, properties, ...(required.length ? { required } : { required: undefined }) }
  }

  /** The 200 response typed from `<method>Response`, with `<method>Responses` merged over the defaults. */
  private buildResponses(method: string): Record<string, any> {
    const responseSchema = this.responseSchema(method)
    let okSchema: any = { type: 'object' }

    if (responseSchema) {
      try {
        okSchema = (responseSchema as any).toJSONSchema()
      } catch {
        // fall back to the untyped object
      }
    }

    return {
      '200': {
        description: 'Successful response',
        content: { 'application/json': { schema: okSchema } },
      },
      ...(this.rateLimitFor(method) ? { '429': { description: 'Rate limit exceeded' } } : {}),
      '400': { description: 'Validation error' },
      '500': { description: 'Server error' },
      ...(this.responseOverrides(method) || {}),
    }
  }

  /** Describe a `<method>Upload` declaration as a multipart/form-data body. */
  private buildUploadRequestBody(
    upload: UploadConfig,
    jsonSchema: any,
    routeParamNames: Set<string>
  ): Record<string, any> {
    const fieldSchema = this.omitPathParams(jsonSchema, routeParamNames)
    const properties: Record<string, any> = { ...(fieldSchema?.properties || {}) }
    const required: string[] = [...(fieldSchema?.required || [])]
    const encoding: Record<string, any> = {}

    for (const [name, field] of Object.entries(upload.fields)) {
      const fileSchema: any = { type: 'string', format: 'binary' }
      if (field.description) fileSchema.description = field.description

      properties[name] = field.multiple ? { type: 'array', items: fileSchema } : fileSchema

      if (field.required) required.push(name)
      if (field.accept?.length) encoding[name] = { contentType: field.accept.join(', ') }
    }

    return {
      required: Object.values(upload.fields).some(f => f.required),
      content: {
        'multipart/form-data': {
          schema: { type: 'object', properties, ...(required.length ? { required } : {}) },
          ...(Object.keys(encoding).length ? { encoding } : {}),
        },
      },
    }
  }
}


export function warnUnknownExports(mod: Record<string, any>, filePath: string): void {
  const unknown = Object.keys(mod).filter(k => !k.startsWith('__') && !KNOWN_EXPORTS.has(k))
  if (unknown.length > 0) {
    console.warn(`[endpoint] ${filePath}: unknown exports: ${unknown.join(', ')}`)
  }
}

export class EndpointsRegistry extends Registry<Endpoint<any>> {
  override scope = 'endpoints'
  override baseClass = Endpoint
}

export const endpoints = new EndpointsRegistry()

export const helperCache = new Map()

export default Endpoint
