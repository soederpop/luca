import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { createServer, type Server as HttpServer } from 'node:http'
import { NodeContainer } from '../src/node/container'

// Covers the agent-friendly fixes for the rest client:
// - handleError merges the response body/headers back in (axios toJSON drops them)
// - *OrThrow variants throw a real Error carrying status/code/data

describe('RestClient error handling', () => {
  const container = new NodeContainer()
  let httpServer: HttpServer
  let port: number

  beforeAll(async () => {
    httpServer = createServer((req, res) => {
      if (req.url === '/ok') {
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ ok: true }))
        return
      }
      // everything else fails with a body that must survive into the result
      res.writeHead(422, { 'content-type': 'application/json', 'x-test-header': 'yes' })
      res.end(JSON.stringify({ error: 'validation_failed', details: { name: 'required' } }))
    })
    await new Promise<void>((resolve) => httpServer.listen(0, () => resolve()))
    port = (httpServer.address() as any).port
  })

  afterAll(async () => {
    await new Promise<void>((resolve) => httpServer.close(() => resolve()))
  })

  it('returned errors carry the parsed response body and headers', async () => {
    const api = container.client('rest', { baseURL: `http://localhost:${port}`, json: true })
    const result: any = await api.post('/users', {})

    expect(result.name).toBe('AxiosError')
    expect(result.status).toBe(422)
    // the old handleError dropped these entirely
    expect(result.data).toEqual({ error: 'validation_failed', details: { name: 'required' } })
    expect(result.headers).toBeDefined()
  })

  it('getOrThrow returns the parsed body on success', async () => {
    const api = container.client('rest', { baseURL: `http://localhost:${port}`, json: true })
    expect(await api.getOrThrow('/ok')).toEqual({ ok: true })
  })

  it('getOrThrow throws a real Error carrying status and data on HTTP failure', async () => {
    const api = container.client('rest', { baseURL: `http://localhost:${port}`, json: true })

    let caught: any
    try {
      await api.getOrThrow('/nope')
    } catch (err) {
      caught = err
    }

    expect(caught).toBeInstanceOf(Error)
    expect(caught.status).toBe(422)
    expect(caught.data).toEqual({ error: 'validation_failed', details: { name: 'required' } })
    expect(caught.message).toContain('GET /nope failed with status 422')
    expect(caught.message).toContain('validation_failed')
  })

  it('postOrThrow throws with status and data too', async () => {
    const api = container.client('rest', { baseURL: `http://localhost:${port}`, json: true })

    let caught: any
    try {
      await api.postOrThrow('/users', { nope: true })
    } catch (err) {
      caught = err
    }

    expect(caught).toBeInstanceOf(Error)
    expect(caught.status).toBe(422)
    expect(caught.data.error).toBe('validation_failed')
  })

  it('OrThrow variants throw on connection-level failures with a code', async () => {
    const api = container.client('rest', { baseURL: 'http://localhost:59981', json: true })

    let caught: any
    try {
      await api.getOrThrow('/anything')
    } catch (err) {
      caught = err
    }

    expect(caught).toBeInstanceOf(Error)
    expect(caught.status).toBeUndefined()
    expect(caught.code).toBeDefined()
  })

  it('OrThrow failures still emit the failure event', async () => {
    const api = container.client('rest', { baseURL: `http://localhost:${port}`, json: true })
    const failures: any[] = []
    api.on('failure', (err: any) => failures.push(err))

    await api.deleteOrThrow('/users/1').catch(() => {})
    expect(failures).toHaveLength(1)
  })

  it('all five OrThrow variants exist', () => {
    const api = container.client('rest', { baseURL: `http://localhost:${port}` })
    for (const name of ['getOrThrow', 'postOrThrow', 'putOrThrow', 'patchOrThrow', 'deleteOrThrow']) {
      expect(typeof (api as any)[name]).toBe('function')
    }
  })
})
