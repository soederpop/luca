import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { createServer, type Server as HttpServer } from 'node:http'
import { NodeContainer } from '../src/node/container'

// Busy-port behavior:
// - websocket: an EXPLICITLY requested busy port throws EADDRINUSE instead of
//   silently drifting via findOpenPort; auto-drift (with a portChanged event)
//   only happens when no port was specified.
// - express: await start() REJECTS on EADDRINUSE instead of hanging forever.

describe('Busy port behavior', () => {
  let blocker: HttpServer
  let busyPort: number

  beforeAll(async () => {
    blocker = createServer(() => {})
    await new Promise<void>((resolve) => blocker.listen(0, () => resolve()))
    busyPort = (blocker.address() as any).port
  })

  afterAll(async () => {
    await new Promise<void>((resolve) => blocker.close(() => resolve()))
  })

  it('websocket: explicit constructor port that is busy throws EADDRINUSE', async () => {
    const container = new NodeContainer()
    const server = container.server('websocket', { port: busyPort })

    let caught: any
    try {
      await server.start()
    } catch (err) {
      caught = err
    } finally {
      try { await server.stop() } catch {}
    }

    expect(caught).toBeInstanceOf(Error)
    expect(caught.code).toBe('EADDRINUSE')
    expect(caught.port).toBe(busyPort)
    expect(caught.message).toContain(String(busyPort))
  })

  it('websocket: explicit start({ port }) that is busy throws EADDRINUSE', async () => {
    const container = new NodeContainer()
    const server = container.server('websocket')

    let caught: any
    try {
      await server.start({ port: busyPort })
    } catch (err) {
      caught = err
    } finally {
      try { await server.stop() } catch {}
    }

    expect(caught).toBeInstanceOf(Error)
    expect(caught.code).toBe('EADDRINUSE')
  })

  it('websocket: no explicit port auto-drifts off a busy default and emits portChanged', async () => {
    const container = new NodeContainer()
    const server = container.server('websocket')
    // Simulate the default port being busy without touching the real 8081:
    // state.port drives configure(), but only options/start() count as explicit.
    server.state.set('port', busyPort)

    const changes: Array<[number, number]> = []
    server.on('portChanged', (from: number, to: number) => changes.push([from, to]))

    await server.start()
    try {
      expect(server.port).not.toBe(busyPort)
      expect(changes).toHaveLength(1)
      expect(changes[0][0]).toBe(busyPort)
      expect(changes[0][1]).toBe(server.port)
    } finally {
      await server.stop()
    }
  })

  it('express: start() rejects on a busy port instead of hanging', async () => {
    const container = new NodeContainer()
    const server = container.server('express')

    const result: any = await Promise.race([
      server.start({ port: busyPort }).then(() => 'resolved', (err: any) => err),
      new Promise((resolve) => setTimeout(() => resolve('hung'), 3000)),
    ])

    try { await server.stop() } catch {}

    expect(result).not.toBe('hung')       // the old bug: neither resolve nor reject
    expect(result).not.toBe('resolved')
    expect(result).toBeInstanceOf(Error)
    expect(result.code).toBe('EADDRINUSE')
  })

  it('express: still starts normally on a free port after the fix', async () => {
    const container = new NodeContainer()
    const server = container.server('express')
    server.app.get('/ping', (_req: any, res: any) => res.json({ pong: true }))

    const port = await container.feature('networking').findOpenPort(19900)
    await server.start({ port })
    try {
      const api = container.client('rest', { baseURL: `http://localhost:${port}` })
      expect(await api.get('/ping')).toEqual({ pong: true })
    } finally {
      await server.stop()
    }
  })
})
