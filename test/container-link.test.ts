import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { NodeContainer } from '../src/node/container'
import { MessageTypes, type LinkMessage, type ContainerLink } from '../src/node/features/container-link'

// Local helper for tests — mirrors the protocol message format
let _testMsgCounter = 0
function createTestMessage<T = any>(type: string, data?: T, token?: string): LinkMessage<T> {
  return {
    type: type as any,
    id: `test-${Date.now()}-${++_testMsgCounter}`,
    timestamp: Date.now(),
    ...(token != null ? { token } : {}),
    ...(data != null ? { data } : {}),
  }
}

// Helper: connect and register using Bun's native WebSocket
async function connectAndRegister(port: number, uuid: string, opts?: { url?: string; capabilities?: string[]; meta?: Record<string, any> }) {
  const ws = new WebSocket(`ws://localhost:${port}`)

  const token = await new Promise<string>((resolve, reject) => {
    ws.onopen = () => {
      ws.send(JSON.stringify(createTestMessage(MessageTypes.register, {
        uuid,
        url: opts?.url,
        capabilities: opts?.capabilities,
        meta: opts?.meta,
      })))
    }
    ws.onmessage = (event: MessageEvent) => {
      const msg = JSON.parse(event.data)
      if (msg.type === 'registered') resolve(msg.data.token)
      if (msg.type === 'error') reject(new Error(msg.data?.message))
    }
    ws.onerror = () => reject(new Error('WS error'))
    setTimeout(() => reject(new Error('Registration timeout')), 3000)
  })

  return { ws, token }
}

function closeWs(ws: WebSocket): Promise<void> {
  return new Promise((resolve) => {
    if (ws.readyState === WebSocket.CLOSED) { resolve(); return }
    ws.onclose = () => resolve()
    ws.close()
    setTimeout(resolve, 200)
  })
}

describe('link message construction', () => {
  it('generates unique ids', () => {
    const a = createTestMessage(MessageTypes.ping)
    const b = createTestMessage(MessageTypes.ping)
    expect(a.id).not.toBe(b.id)
  })

  it('sets timestamp', () => {
    const before = Date.now()
    const msg = createTestMessage(MessageTypes.eval, { code: '1+1' })
    expect(msg.timestamp).toBeGreaterThanOrEqual(before)
    expect(msg.timestamp).toBeLessThanOrEqual(Date.now())
  })

  it('includes type and data', () => {
    const msg = createTestMessage(MessageTypes.event, { eventName: 'click', data: { x: 1 } }, 'tok123')
    expect(msg.type).toBe('event')
    expect(msg.data).toEqual({ eventName: 'click', data: { x: 1 } })
    expect(msg.token).toBe('tok123')
  })

  it('omits token when not provided', () => {
    const msg = createTestMessage(MessageTypes.ping)
    expect(msg.token).toBeUndefined()
  })
})

describe('ContainerLink (node-side)', () => {
  let container: NodeContainer
  let link: ContainerLink
  let port: number
  const openSockets: WebSocket[] = []

  beforeEach(async () => {
    container = new NodeContainer({ cwd: process.cwd() })
    const networking = container.feature('networking')
    port = await networking.findOpenPort(9100)
    link = container.feature('containerLink', { enable: true, port }) as ContainerLink
  })

  afterEach(async () => {
    for (const ws of openSockets) {
      await closeWs(ws).catch(() => {})
    }
    openSockets.length = 0
    await link.stop().catch(() => {})
  })

  it('instantiates with correct defaults', () => {
    expect(link).toBeDefined()
    expect(link.isListening).toBe(false)
    expect(link.connectionCount).toBe(0)
  })

  it('generates unique tokens', () => {
    const tokens = new Set<string>()
    for (let i = 0; i < 100; i++) {
      tokens.add(link.generateToken())
    }
    expect(tokens.size).toBe(100)
  })

  it('tokens are 64 hex chars', () => {
    const token = link.generateToken()
    expect(token).toMatch(/^[0-9a-f]{64}$/)
  })

  it('reports listening after start', async () => {
    await link.start()
    expect(link.isListening).toBe(true)
  })

  it('accepts connection and performs registration handshake', async () => {
    await link.start()
    const { ws, token } = await connectAndRegister(port, 'test-web-container', {
      url: 'http://localhost:3000',
      capabilities: ['eval'],
      meta: { name: 'test' },
    })
    openSockets.push(ws)

    expect(token).toBeTruthy()
    expect(link.connectionCount).toBe(1)

    const connections = link.getConnections()
    expect(connections).toHaveLength(1)
    expect(connections[0].uuid).toBe('test-web-container')
  })

  it('rejects eval messages from web containers', async () => {
    await link.start()
    const { ws, token } = await connectAndRegister(port, 'attacker')
    openSockets.push(ws)

    const errorMsg = await new Promise<any>((resolve, reject) => {
      ws.onmessage = (event: MessageEvent) => {
        const msg = JSON.parse(event.data)
        if (msg.type === 'error') resolve(msg)
      }

      ws.send(JSON.stringify(createTestMessage(MessageTypes.eval, {
        code: 'process.exit(1)',
        requestId: 'evil-123',
      }, token)))

      setTimeout(() => reject(new Error('Timeout')), 3000)
    })

    expect(errorMsg.type).toBe('error')
    expect(errorMsg.data.message).toContain('not permitted')
  })

  it('eval sends code and resolves with result', async () => {
    await link.start()
    const { ws, token } = await connectAndRegister(port, 'eval-target')
    openSockets.push(ws)

    // Simulate web container responding to evals
    ws.onmessage = (event: MessageEvent) => {
      const msg = JSON.parse(event.data)
      if (msg.type === 'eval') {
        ws.send(JSON.stringify(createTestMessage(MessageTypes.evalResult, {
          requestId: msg.data.requestId,
          result: 42,
        }, token)))
      }
    }

    const result = await link.eval('eval-target', '21 * 2')
    expect(result).toBe(42)
  })

  it('eval rejects when container not found', async () => {
    await link.start()
    await expect(link.eval('nonexistent', '1+1')).rejects.toThrow('No connection found')
  })

  it('eval rejects on timeout', async () => {
    await link.start()
    const { ws } = await connectAndRegister(port, 'slow-container')
    openSockets.push(ws)

    // Don't respond to eval — should timeout
    await expect(link.eval('slow-container', '1+1', undefined, 200)).rejects.toThrow('timed out')
  })

  it('disconnect removes a specific client', async () => {
    await link.start()
    const { ws } = await connectAndRegister(port, 'to-disconnect')
    openSockets.push(ws)

    expect(link.connectionCount).toBe(1)
    link.disconnect('to-disconnect', 'test')
    await new Promise(r => setTimeout(r, 50))
    expect(link.connectionCount).toBe(0)
  })

  it('emits connection and disconnection events', async () => {
    await link.start()
    const events: string[] = []
    link.on('connection', (uuid: string) => events.push(`connect:${uuid}`))
    link.on('disconnection', (uuid: string) => events.push(`disconnect:${uuid}`))

    const { ws } = await connectAndRegister(port, 'event-test')

    expect(events).toContain('connect:event-test')

    await closeWs(ws)
    await new Promise(r => setTimeout(r, 50))
    expect(events).toContain('disconnect:event-test')
  })

  it('handles structured events from web containers', async () => {
    await link.start()
    const { ws, token } = await connectAndRegister(port, 'event-sender')
    openSockets.push(ws)

    const receivedEvent = new Promise<any>((resolve) => {
      link.on('event', (uuid: string, eventName: string, data: any) => {
        resolve({ uuid, eventName, data })
      })
    })

    ws.send(JSON.stringify(createTestMessage(MessageTypes.event, {
      eventName: 'userClick',
      data: { x: 100, y: 200 },
    }, token)))

    const evt = await receivedEvent
    expect(evt.uuid).toBe('event-sender')
    expect(evt.eventName).toBe('userClick')
    expect(evt.data).toEqual({ x: 100, y: 200 })
  })

  it('registration without uuid returns error', async () => {
    await link.start()
    const ws = new WebSocket(`ws://localhost:${port}`)
    openSockets.push(ws)

    const errorMsg = await new Promise<any>((resolve, reject) => {
      ws.onopen = () => {
        ws.send(JSON.stringify(createTestMessage(MessageTypes.register, {})))
      }
      ws.onmessage = (event: MessageEvent) => {
        const msg = JSON.parse(event.data)
        if (msg.type === 'error') resolve(msg)
      }
      ws.onerror = () => reject(new Error('WS error'))
      setTimeout(() => reject(new Error('Timeout')), 3000)
    })

    expect(errorMsg.data.message).toContain('uuid')
  })

  it('stop cleans up server and connections', async () => {
    await link.start()
    const { ws } = await connectAndRegister(port, 'cleanup-test')
    openSockets.push(ws)

    await link.stop()
    expect(link.isListening).toBe(false)
    expect(link.connectionCount).toBe(0)
  })
})
