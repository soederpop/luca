import { describe, it, expect } from 'bun:test'
import { z } from 'zod'
import { NodeContainer } from '../src/node/container'
import { Endpoint } from '../src/endpoint'

/** Mount an endpoint on a fake express app and invoke one request against it. */
async function call(mod: any, method: string, req: any) {
  const container = new NodeContainer()
  const endpoint = new Endpoint({ path: mod.path } as any, { container } as any)
  await endpoint.load(mod)

  const handlers: Record<string, any> = {}
  endpoint.mount({ [method]: (_path: string, handler: any) => { handlers[method] = handler } })

  let status = 200
  let payload: any
  const res = {
    headersSent: false,
    status(code: number) { status = code; return res },
    json(body: any) { payload = body; res.headersSent = true; return res },
  }
  await handlers[method]({ query: {}, body: {}, params: {}, ...req }, res)
  return { status, payload }
}

describe('Endpoint route params vs strict schemas', () => {
  it('does not reject route params a strict schema never declared', async () => {
    const mod = {
      path: '/api/things/:id',
      putSchema: z.object({ feature: z.string() }).strict(),
      put: async (params: any) => ({ params }),
    }
    const { status, payload } = await call(mod, 'put', {
      body: { feature: 'knowledgeBase' },
      params: { id: 'chief' },
    })
    expect(status).toBe(200)
    expect(payload.params.feature).toBe('knowledgeBase')
    // still handed to the handler, just not validated against the schema
    expect(payload.params.id).toBe('chief')
  })

  it('still lets a route param satisfy a required schema field', async () => {
    const mod = {
      path: '/api/things/:slug',
      getSchema: z.object({ slug: z.string().min(1) }),
      get: async (params: any) => ({ slug: params.slug }),
    }
    const { status, payload } = await call(mod, 'get', { params: { slug: 'my-thing' } })
    expect(status).toBe(200)
    expect(payload.slug).toBe('my-thing')
  })

  it('still rejects an unrecognized body key on a strict schema', async () => {
    const mod = {
      path: '/api/things/:id',
      putSchema: z.object({ feature: z.string() }).strict(),
      put: async () => ({ ok: true }),
    }
    const { status, payload } = await call(mod, 'put', {
      body: { feature: 'fs', bogus: 1 },
      params: { id: 'chief' },
    })
    expect(status).toBe(400)
    expect(payload.error).toContain('bogus')
  })

  it('still validates body values', async () => {
    const mod = {
      path: '/api/things/:id',
      putSchema: z.object({ feature: z.string().min(1) }).strict(),
      put: async () => ({ ok: true }),
    }
    const { status } = await call(mod, 'put', { body: { feature: '' }, params: { id: 'chief' } })
    expect(status).toBe(400)
  })
})
