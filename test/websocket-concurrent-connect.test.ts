import { describe, it, expect, afterAll } from 'bun:test'
import { NodeContainer } from '../src/node/container'

// container.client() caches by options, so callers that never heard of each
// other share one client. Overlapping connect() calls used to open two sockets;
// disconnect() closed only the second and the orphan kept the process alive.

describe('WebSocket client overlapping connect()', () => {
  const cleanups: Array<() => Promise<any> | any> = []

  afterAll(async () => {
    for (const fn of cleanups.reverse()) {
      try { await fn() } catch {}
    }
  })

  it('opens one socket for concurrent callers and closes it on disconnect', async () => {
    const container = new NodeContainer()
    const server = container.server('websocket', { json: true })
    await server.start({ port: 19894 })
    cleanups.push(() => server.stop())

    let opened = 0
    let closed = 0
    server.on('connection', (socket: any) => {
      opened++
      socket.on('close', () => closed++)
    })

    const a = container.client('websocket', { baseURL: 'ws://localhost:19894', json: true })
    const b = container.client('websocket', { baseURL: 'ws://localhost:19894', json: true })
    expect(a).toBe(b)

    await Promise.all([a.connect(), b.connect(), a.send({ type: 'hello' })])
    await new Promise((r) => setTimeout(r, 50))
    expect(opened).toBe(1)

    await a.disconnect()
    await new Promise((r) => setTimeout(r, 50))
    expect(closed).toBe(1)
  })

  it('lets a later connect() retry after a failed attempt', async () => {
    const container = new NodeContainer()
    const client = container.client('websocket', { baseURL: 'ws://localhost:19895' })

    const results = await Promise.allSettled([client.connect(), client.connect()])
    expect(results.every((r) => r.status === 'rejected')).toBe(true)
    expect((client as any)._connecting).toBeNull()
  })
})
