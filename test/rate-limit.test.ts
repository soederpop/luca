import { describe, it, expect, beforeEach, vi } from 'vitest'
import { NodeContainer } from '../src/node/container'
import { Endpoint, type EndpointModule } from '../src/endpoint'

/** Creates a minimal mock Express app that records registered routes and lets us fire requests. */
function createMockApp() {
  const routes: Record<string, Function> = {}

  const app: any = {}
  for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
    app[method] = (path: string, handler: Function) => {
      routes[`${method}:${path}`] = handler
    }
  }

  /** Simulate a request hitting a registered route */
  async function request(method: string, path: string, options: { ip?: string; query?: any; body?: any; params?: any } = {}) {
    const handler = routes[`${method}:${path}`]
    if (!handler) throw new Error(`No route for ${method} ${path}`)

    let statusCode = 200
    let responseBody: any = null
    let headersSent = false

    const req = {
      ip: options.ip || '127.0.0.1',
      socket: { remoteAddress: options.ip || '127.0.0.1' },
      query: options.query || {},
      body: options.body || {},
      params: options.params || {},
    }

    const res = {
      status(code: number) {
        statusCode = code
        return res
      },
      json(body: any) {
        responseBody = body
        headersSent = true
      },
      get headersSent() {
        return headersSent
      },
    }

    await handler(req, res)
    return { status: statusCode, body: responseBody }
  }

  return { app, routes, request }
}

function createEndpoint(mod: EndpointModule) {
  const c = new NodeContainer()
  const endpoint = new Endpoint({ path: mod.path }, c.context)
  endpoint.load(mod)
  return endpoint
}

describe('Endpoint Rate Limiting', () => {
  it('allows requests under the limit', async () => {
    const { app, request } = createMockApp()
    const endpoint = createEndpoint({
      path: '/api/test',
      rateLimit: { maxRequests: 5 },
      get: async () => ({ ok: true }),
    })
    endpoint.mount(app)

    for (let i = 0; i < 5; i++) {
      const res = await request('get', '/api/test')
      expect(res.status).toBe(200)
      expect(res.body).toEqual({ ok: true })
    }
  })

  it('returns 429 when rate limit is exceeded', async () => {
    const { app, request } = createMockApp()
    const endpoint = createEndpoint({
      path: '/api/test',
      rateLimit: { maxRequests: 3 },
      get: async () => ({ ok: true }),
    })
    endpoint.mount(app)

    // First 3 should succeed
    for (let i = 0; i < 3; i++) {
      const res = await request('get', '/api/test')
      expect(res.status).toBe(200)
    }

    // 4th should be rate limited
    const res = await request('get', '/api/test')
    expect(res.status).toBe(429)
    expect(res.body).toEqual({ error: 'Too Many Requests' })
  })

  it('emits error event when rate limited', async () => {
    const { app, request } = createMockApp()
    const endpoint = createEndpoint({
      path: '/api/test',
      rateLimit: { maxRequests: 1 },
      get: async () => ({ ok: true }),
    })
    endpoint.mount(app)

    const errors: any[] = []
    endpoint.on('error', (err: any) => errors.push(err))

    await request('get', '/api/test') // allowed
    await request('get', '/api/test') // rate limited

    expect(errors).toHaveLength(1)
    expect(errors[0].message).toContain('Rate limit exceeded')
  })

  it('tracks rate limits per IP address', async () => {
    const { app, request } = createMockApp()
    const endpoint = createEndpoint({
      path: '/api/test',
      rateLimit: { maxRequests: 2 },
      get: async () => ({ ok: true }),
    })
    endpoint.mount(app)

    // IP A uses its 2 requests
    await request('get', '/api/test', { ip: '10.0.0.1' })
    await request('get', '/api/test', { ip: '10.0.0.1' })
    const limitedA = await request('get', '/api/test', { ip: '10.0.0.1' })
    expect(limitedA.status).toBe(429)

    // IP B should still be allowed
    const okB = await request('get', '/api/test', { ip: '10.0.0.2' })
    expect(okB.status).toBe(200)
  })

  it('supports per-method rate limits that override endpoint-level', async () => {
    const { app, request } = createMockApp()
    const endpoint = createEndpoint({
      path: '/api/test',
      rateLimit: { maxRequests: 10 },       // general: 10 rps
      getRateLimit: { maxRequests: 2 },      // GET: 2 rps
      get: async () => ({ method: 'get' }),
      post: async () => ({ method: 'post' }),
    })
    endpoint.mount(app)

    // GET should be limited at 2
    await request('get', '/api/test')
    await request('get', '/api/test')
    const limited = await request('get', '/api/test')
    expect(limited.status).toBe(429)

    // POST should still use the general limit of 10
    for (let i = 0; i < 10; i++) {
      const res = await request('post', '/api/test')
      expect(res.status).toBe(200)
    }
    const postLimited = await request('post', '/api/test')
    expect(postLimited.status).toBe(429)
  })

  it('does not rate limit when no rateLimit is set', async () => {
    const { app, request } = createMockApp()
    const endpoint = createEndpoint({
      path: '/api/test',
      get: async () => ({ ok: true }),
    })
    endpoint.mount(app)

    // Should handle many requests without 429
    for (let i = 0; i < 100; i++) {
      const res = await request('get', '/api/test')
      expect(res.status).toBe(200)
    }
  })

  it('resets the window after time passes', async () => {
    const { app, request } = createMockApp()
    const endpoint = createEndpoint({
      path: '/api/test',
      rateLimit: { maxRequests: 2, windowSeconds: 0.1 },
      get: async () => ({ ok: true }),
    })
    endpoint.mount(app)

    await request('get', '/api/test')
    await request('get', '/api/test')
    const limited = await request('get', '/api/test')
    expect(limited.status).toBe(429)

    // Wait for the 100ms window to expire
    await new Promise((resolve) => setTimeout(resolve, 150))

    const allowed = await request('get', '/api/test')
    expect(allowed.status).toBe(200)
  })

  it('rateLimitFor returns correct config', () => {
    const endpoint = createEndpoint({
      path: '/api/test',
      rateLimit: { maxRequests: 10 },
      postRateLimit: { maxRequests: 2 },
      get: async () => ({}),
      post: async () => ({}),
    })

    // GET falls back to endpoint-level rateLimit
    expect(endpoint.rateLimitFor('get')).toEqual({ maxRequests: 10 })
    // POST uses its own override
    expect(endpoint.rateLimitFor('post')).toEqual({ maxRequests: 2 })
    // DELETE has no handler but we can still query the config
    expect(endpoint.rateLimitFor('delete')).toEqual({ maxRequests: 10 })
  })

  it('rateLimiter.reset() clears all tracking', async () => {
    const { app, request } = createMockApp()
    const endpoint = createEndpoint({
      path: '/api/test',
      rateLimit: { maxRequests: 1 },
      get: async () => ({ ok: true }),
    })
    endpoint.mount(app)

    await request('get', '/api/test')
    const limited = await request('get', '/api/test')
    expect(limited.status).toBe(429)

    // Reset the limiter
    endpoint.rateLimiter.reset()

    const allowed = await request('get', '/api/test')
    expect(allowed.status).toBe(200)
  })

  it('does not increment requestCount on rate-limited requests', async () => {
    const { app, request } = createMockApp()
    const endpoint = createEndpoint({
      path: '/api/test',
      rateLimit: { maxRequests: 2 },
      get: async () => ({ ok: true }),
    })
    endpoint.mount(app)

    await request('get', '/api/test')
    await request('get', '/api/test')
    await request('get', '/api/test') // rate limited

    expect(endpoint.state.get('requestCount')).toBe(2)
  })

  it('includes 429 in OpenAPI spec when rate limit is configured', () => {
    const endpoint = createEndpoint({
      path: '/api/test',
      rateLimit: { maxRequests: 5 },
      get: async () => ({}),
    })

    const spec = endpoint.toOpenAPIPathItem()
    expect(spec.get.responses['429']).toEqual({ description: 'Rate limit exceeded' })
  })

  it('omits 429 from OpenAPI spec when no rate limit is configured', () => {
    const endpoint = createEndpoint({
      path: '/api/test',
      get: async () => ({}),
    })

    const spec = endpoint.toOpenAPIPathItem()
    expect(spec.get.responses['429']).toBeUndefined()
  })
})
