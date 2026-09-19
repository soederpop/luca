import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { createServer, type Server as HttpServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { NodeContainer } from '../src/node/container'

// Covers the shared TTL response cache on the rest client:
// - repeated GETs are served from diskCache (one network hit)
// - cache keys incorporate params/body/headers (no false hits)
// - errors are never cached, non-GET methods are never cached by default
// - the cache is shared across client instances (same disk path)

describe('RestClient response cache', () => {
  const container = new NodeContainer()
  const cachePath = join(tmpdir(), `rest-cache-test-${Date.now()}`)
  let httpServer: HttpServer
  let port: number
  let hits: Record<string, number> = {}
  let flakyCalls = 0

  const client = (extra: Record<string, any> = {}) =>
    container.client('rest', {
      baseURL: `http://localhost:${port}`,
      json: true,
      cache: { ttl: 60, path: cachePath },
      ...extra,
    })

  beforeAll(async () => {
    httpServer = createServer((req, res) => {
      const key = `${req.method} ${req.url}`
      hits[key] = (hits[key] || 0) + 1

      if (req.url === '/flaky') {
        // fails on the first call, succeeds afterwards — a cached error would
        // make the second call fail too
        flakyCalls++
        if (flakyCalls === 1) {
          res.writeHead(500, { 'content-type': 'application/json' })
          res.end(JSON.stringify({ error: 'boom' }))
          return
        }
      }

      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ served: key, count: hits[key] }))
    })
    await new Promise<void>((resolve) => httpServer.listen(0, () => resolve()))
    port = (httpServer.address() as any).port
  })

  afterAll(async () => {
    await new Promise<void>((resolve) => httpServer.close(() => resolve()))
  })

  it('serves repeated GETs from the cache', async () => {
    const api = client({ name: 'cached-a' })

    const first = await api.get('/rates')
    const second = await api.get('/rates')

    expect(first).toEqual({ served: 'GET /rates', count: 1 })
    expect(second).toEqual(first)
    expect(hits['GET /rates']).toBe(1)
  })

  it('different params get different cache entries', async () => {
    const api = client({ name: 'cached-b' })

    const usd = await api.get('/quote', { symbol: 'USD' })
    const eur = await api.get('/quote', { symbol: 'EUR' })

    expect(usd).not.toEqual(eur)
    expect(hits['GET /quote?symbol=USD']).toBe(1)
    expect(hits['GET /quote?symbol=EUR']).toBe(1)
  })

  it('different headers get different cache entries', async () => {
    const api = client({ name: 'cached-c' })

    await api.get('/me', {}, { headers: { Authorization: 'Bearer alice' } })
    await api.get('/me', {}, { headers: { Authorization: 'Bearer bob' } })

    expect(hits['GET /me']).toBe(2)
  })

  it('cache: false bypasses the cache per request', async () => {
    const api = client({ name: 'cached-d' })

    await api.get('/fresh')
    await api.get('/fresh', {}, { cache: false })

    expect(hits['GET /fresh']).toBe(2)
  })

  it('does not cache non-GET methods by default', async () => {
    const api = client({ name: 'cached-e' })

    await api.post('/orders', { qty: 1 })
    await api.post('/orders', { qty: 1 })

    expect(hits['POST /orders']).toBe(2)
  })

  it('never caches errors', async () => {
    const api = client({ name: 'cached-f' })

    const failed: any = await api.get('/flaky')
    expect(failed.name).toBe('AxiosError')
    expect(failed.status).toBe(500)

    // second call must reach the (now healthy) server, not a cached 500
    const ok = await api.get('/flaky')
    expect(ok).toEqual({ served: 'GET /flaky', count: 2 })
  })

  it('shares entries across client instances (cross-process proxy)', async () => {
    await client({ name: 'writer' }).get('/shared')
    const fromCache = await client({ name: 'reader' }).get('/shared')

    expect(fromCache).toEqual({ served: 'GET /shared', count: 1 })
    expect(hits['GET /shared']).toBe(1)
  })

  it('getOrThrow shares the same cache entries as get', async () => {
    const api = client({ name: 'cached-g' })

    await api.get('/mixed')
    const viaThrow = await api.getOrThrow('/mixed')

    expect(viaThrow).toEqual({ served: 'GET /mixed', count: 1 })
    expect(hits['GET /mixed']).toBe(1)
  })

  it('expired entries hit the network again', async () => {
    const api = client({ name: 'cached-h' })

    await api.get('/ttl', {}, { cache: { ttl: 1 } })
    await new Promise((resolve) => setTimeout(resolve, 1100))
    await api.get('/ttl', {}, { cache: { ttl: 1 } })

    expect(hits['GET /ttl']).toBe(2)
  })

  it('caching disabled means every request hits the network', async () => {
    const api = container.client('rest', {
      baseURL: `http://localhost:${port}`,
      json: true,
      name: 'uncached',
    })

    await api.get('/plain')
    await api.get('/plain')

    expect(hits['GET /plain']).toBe(2)
  })
})
