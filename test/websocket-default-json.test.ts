import { describe, it, expect, afterAll } from 'bun:test'
import { NodeContainer } from '../src/node/container'

// Inbound JSON parsing is now the DEFAULT on the websocket server (matching
// outbound framing and the client); json: false opts out for raw consumers.

describe('WebSocket server default JSON parsing', () => {
  const cleanups: Array<() => Promise<any> | any> = []

  afterAll(async () => {
    for (const fn of cleanups.reverse()) {
      try { await fn() } catch {}
    }
  })

  it('parses inbound JSON and supports ask/reply without json: true', async () => {
    const container = new NodeContainer()
    const server = container.server('websocket')          // no json option at all
    await server.start({ port: 19893 })
    cleanups.push(() => server.stop())

    const received: any[] = []
    server.on('message', (msg: any) => {
      received.push(msg)
      if (msg?.requestId) msg.reply({ echoed: msg.data })
    })

    const client = container.client('websocket', { baseURL: 'ws://localhost:19893' })
    await client.connect()
    cleanups.push(() => client.disconnect())

    // ask/reply requires parsed inbound messages — this used to time out silently
    const answer = await client.ask('echo', { n: 42 }, 3000)
    expect(answer).toEqual({ echoed: { n: 42 } })
    expect(received[0].type).toBe('echo')

    // non-JSON text frames still deliver raw when parsing fails
    const rawPromise = new Promise<any>((resolve) => {
      server.on('message', (msg: any) => {
        if (typeof msg !== 'object' || Buffer.isBuffer(msg)) resolve(msg)
      })
    })
    await client.send('not json at all')
    const raw = await rawPromise
    expect(raw.toString()).toBe('not json at all')
  })

  it('json: false opts out and delivers raw Buffers', async () => {
    const container = new NodeContainer()
    const server = container.server('websocket', { json: false })
    await server.start({ port: 19894 })
    cleanups.push(() => server.stop())

    const firstMessage = new Promise<any>((resolve) => {
      server.on('message', (msg: any) => resolve(msg))
    })

    const ws = new WebSocket('ws://localhost:19894')
    await new Promise<void>((resolve, reject) => {
      ws.onopen = () => resolve()
      ws.onerror = (e) => reject(e)
    })
    cleanups.push(() => ws.close())

    ws.send(JSON.stringify({ type: 'hello' }))
    const msg = await firstMessage

    // raw data, NOT a parsed object — msg.type must be undefined
    expect(msg.type).toBeUndefined()
    expect(msg.toString()).toBe(JSON.stringify({ type: 'hello' }))
  })

  it('client ask() timeout message hints at the likely causes', async () => {
    const container = new NodeContainer()
    const server = container.server('websocket')
    await server.start({ port: 19895 })
    cleanups.push(() => server.stop())
    // no message handler on purpose — nothing ever replies

    const client = container.client('websocket', { baseURL: 'ws://localhost:19895' })
    await client.connect()
    cleanups.push(() => client.disconnect())

    let caught: any
    try {
      await client.ask('nobody-home', {}, 300)
    } catch (err) {
      caught = err
    }

    expect(caught).toBeInstanceOf(Error)
    expect(caught.message).toContain('timed out after 300ms')
    expect(caught.message).toContain('json: false')
    expect(caught.message).toContain('no message handler')
  })
})
