import { describe, it, expect, afterAll } from 'bun:test'
import { NodeContainer } from '../src/node/container'

describe('WebSocket ask/reply protocol', () => {
  const container = new NodeContainer()
  const server = container.server('websocket', { json: true })
  let clientWsOnServer: any

  afterAll(async () => {
    try { server.connections.forEach((ws: any) => ws.close?.()) } catch {}
    try { await server.stop() } catch {}
  })

  it('setup: start server and connect client', async () => {
    const connPromise = new Promise<any>((resolve) => {
      server.on('connection', resolve)
    })

    server.on('message', (data: any) => {
      if (data.type === 'greet') {
        data.reply({ greeting: `hello ${data.data.name}` })
      }
      if (data.type === 'fail') {
        data.replyError('something went wrong')
      }
    })

    await server.start({ port: 19880 })

    // Use bun's native WebSocket as the client
    const ws = new WebSocket('ws://localhost:19880')
    await new Promise<void>((resolve, reject) => {
      ws.onopen = () => resolve()
      ws.onerror = (e) => reject(e)
    })

    clientWsOnServer = await connPromise
    expect(clientWsOnServer).toBeDefined()

    // Wire up the client to handle server-initiated asks
    ws.onmessage = (event: any) => {
      const msg = JSON.parse(event.data)
      if (msg.requestId && msg.type === 'identify') {
        ws.send(JSON.stringify({ replyTo: msg.requestId, data: { role: 'worker' } }))
      }
    }

    // Stash ws for other tests
    ;(globalThis as any).__testWs = ws
  })

  it('client.ask() sends a request and resolves with the server reply', async () => {
    const ws = (globalThis as any).__testWs as WebSocket

    // Manually implement the client-side ask protocol
    const requestId = container.utils.uuid()
    const result = await new Promise<any>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout')), 5000)
      const handler = (event: any) => {
        const msg = JSON.parse(event.data)
        if (msg.replyTo === requestId) {
          clearTimeout(timer)
          ws.removeEventListener('message', handler)
          if (msg.error) reject(new Error(msg.error))
          else resolve(msg.data)
        }
      }
      ws.addEventListener('message', handler)
      ws.send(JSON.stringify({ type: 'greet', data: { name: 'luca' }, requestId }))
    })

    expect(result).toEqual({ greeting: 'hello luca' })
  })

  it('server.ask() sends a request and resolves with the client reply', async () => {
    const result = await server.ask(clientWsOnServer, 'identify')
    expect(result).toEqual({ role: 'worker' })
  })

  it('ask() rejects with error when reply contains error', async () => {
    const ws = (globalThis as any).__testWs as WebSocket

    const requestId = container.utils.uuid()
    const promise = new Promise<any>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout')), 5000)
      const handler = (event: any) => {
        const msg = JSON.parse(event.data)
        if (msg.replyTo === requestId) {
          clearTimeout(timer)
          ws.removeEventListener('message', handler)
          if (msg.error) reject(new Error(msg.error))
          else resolve(msg.data)
        }
      }
      ws.addEventListener('message', handler)
      ws.send(JSON.stringify({ type: 'fail', requestId }))
    })

    await expect(promise).rejects.toThrow('something went wrong')
  })
})
