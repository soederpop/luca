import { describe, it, expect, afterAll } from 'bun:test'
import { NodeContainer } from '../src/node/container'
import { tmpdir } from 'os'
import { join } from 'path'

/**
 * Regression tests for the ipcSocket ask()/reply() correlation.
 *
 * Previously the server-side 'message' handler stripped the envelope and
 * emitted only the inner data — so handlers could never see the requestId
 * of an incoming ask() and the documented request/reply pattern
 * (`if (data.requestId) ipc.reply(data.requestId, ...)`) was impossible.
 */
describe('IpcSocket ask/reply protocol', () => {
  const socketPath = join(tmpdir(), `luca-ipc-ask-test-${process.pid}-${Date.now()}.sock`)

  const serverContainer = new NodeContainer()
  const clientContainer = new NodeContainer()
  const server = serverContainer.feature('ipcSocket')
  const client = clientContainer.feature('ipcSocket')

  afterAll(async () => {
    try { client.disconnect() } catch {}
    try { await server.stopServer() } catch {}
  })

  it('setup: server listens, client connects', async () => {
    await server.listen(socketPath, true)
    await client.connect(socketPath, { name: 'test-worker' })
    expect(server.isServer).toBe(true)
  })

  it('client.ask() surfaces requestId to the server handler and resolves with the reply', async () => {
    server.on('message', (data: any, clientId: string) => {
      if (data?.requestId && data.type === 'double') {
        server.reply(data.requestId, { result: data.value * 2 }, clientId)
      }
    })

    const answer = await client.ask({ type: 'double', value: 21 }, { timeoutMs: 3000 })
    expect(answer).toEqual({ result: 42 })
  })

  it('server.ask() surfaces requestId to the client handler and resolves with the reply', async () => {
    client.on('message', (data: any) => {
      if (data?.requestId && data.type === 'identify') {
        client.reply(data.requestId, { role: 'worker' })
      }
    })

    // Wait until the server has registered the connection
    const clientId = server.connectedClients[0]?.id
    expect(clientId).toBeDefined()

    const answer = await server.ask({ type: 'identify' }, { clientId: clientId!, timeoutMs: 3000 })
    expect(answer).toEqual({ role: 'worker' })
  })

  it('non-object ask payloads are wrapped so requestId is still visible', async () => {
    server.on('message', (data: any, clientId: string) => {
      if (data?.requestId && data.data === 'ping') {
        server.reply(data.requestId, 'pong', clientId)
      }
    })

    const answer = await client.ask('ping', { timeoutMs: 3000 })
    expect(answer).toBe('pong')
  })

  it('plain send() messages do not gain a requestId', async () => {
    const received = new Promise<any>((resolve) => {
      const handler = (data: any) => {
        if (data?.type === 'status') {
          server.off?.('message', handler)
          resolve(data)
        }
      }
      server.on('message', handler)
    })

    await client.send({ type: 'status', ready: true })
    const data = await received
    expect(data.requestId).toBeUndefined()
    expect(data.ready).toBe(true)
  })

  it('reply() in server mode without a clientId throws', () => {
    expect(() => server.reply('some-request-id', { nope: true })).toThrow(/clientId/)
  })
})
