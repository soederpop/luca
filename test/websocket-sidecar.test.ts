import { describe, it, expect, afterAll } from 'bun:test'
import { NodeContainer } from '../src/node/container'

const container = new NodeContainer()

async function openClient(url: string): Promise<WebSocket> {
  const ws = new WebSocket(url)
  await new Promise<void>((resolve, reject) => {
    ws.onopen = () => resolve()
    ws.onerror = (e) => reject(e)
  })
  return ws
}

describe('WebSocket sidecar — attach to an express server via Upgrade', () => {
  const http = container.server('express', {})
  const ws = container.server('websocket', { json: true, server: http, path: '/ws' })
  let port = 0

  afterAll(async () => {
    try { ws.connections.forEach((c: any) => c.close?.()) } catch {}
    try { await ws.stop() } catch {}
    try { await http.stop() } catch {}
  })

  it('shares the express port: HTTP and WebSocket coexist on one port', async () => {
    http.app.get('/health', (_req: any, res: any) => res.json({ ok: true }))

    // ws.start() happens BEFORE express listens — attachment is deferred.
    await ws.start()
    expect(ws.isListening).toBe(true)

    port = await container.feature('networking').findOpenPort(19900)

    const attached = new Promise<void>((resolve) => ws.on('attached', () => resolve()))
    await http.start({ port })
    await attached  // deferred attach fires once express is listening

    // HTTP still works on the same port
    const health = await container.client('rest', { baseURL: `http://localhost:${port}` }).get('/health')
    expect(health).toEqual({ ok: true })
  })

  it('accepts a WebSocket connection on the shared port at the configured path', async () => {
    const connOnServer = new Promise<any>((resolve) => ws.on('connection', resolve))
    ws.on('message', (data: any, socket: any) => ws.send(socket, { echo: data }))

    const client = await openClient(`ws://localhost:${port}/ws`)
    expect(await connOnServer).toBeDefined()

    const echoed = await new Promise<any>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout')), 5000)
      client.onmessage = (e: any) => { clearTimeout(timer); resolve(JSON.parse(e.data)) }
      client.send(JSON.stringify({ hi: 1 }))
    })
    expect(echoed).toEqual({ echo: { hi: 1 } })

    client.close()
  })

  it('does not handle connections on a non-matching path', async () => {
    // A path-scoped ws server leaves non-matching upgrades unhandled (the
    // socket never completes the handshake), so no connection is emitted.
    const stray = new WebSocket(`ws://localhost:${port}/nope`)
    let opened = false
    stray.onopen = () => { opened = true }
    await new Promise((r) => setTimeout(r, 500))
    expect(opened).toBe(false)
    try { stray.close() } catch {}
  })
})

describe('WebSocket sidecar — noServer mode with manual handleUpgrade', () => {
  const http = container.server('express', {})
  const ws = container.server('websocket', { json: true, noServer: true })
  let port = 0

  afterAll(async () => {
    try { ws.connections.forEach((c: any) => c.close?.()) } catch {}
    try { await ws.stop() } catch {}
    try { await http.stop() } catch {}
  })

  it('binds no port and upgrades connections handed to it', async () => {
    http.app.get('/ping', (_req: any, res: any) => res.json({ pong: true }))

    await ws.start()          // noServer: no port bound
    port = await container.feature('networking').findOpenPort(19910)
    await http.start({ port })

    // We own the upgrade event and route it into the ws server.
    http.httpServer.on('upgrade', (req: any, socket: any, head: any) => {
      ws.handleUpgrade(req, socket, head)
    })

    const connOnServer = new Promise<any>((resolve) => ws.on('connection', resolve))
    ws.on('message', (data: any, socket: any) => ws.send(socket, { echo: data }))

    const client = await openClient(`ws://localhost:${port}`)
    expect(await connOnServer).toBeDefined()

    const echoed = await new Promise<any>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout')), 5000)
      client.onmessage = (e: any) => { clearTimeout(timer); resolve(JSON.parse(e.data)) }
      client.send(JSON.stringify({ ping: true }))
    })
    expect(echoed).toEqual({ echo: { ping: true } })

    client.close()
  })
})
