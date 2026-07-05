import { describe, it, expect, afterAll } from 'bun:test'
import WebSocket from 'ws'
import { NodeContainer } from '../src/node/container'
import { encodeWireFrame } from '../src/clients/websocket'

const container = new NodeContainer()

/** Normalize whatever a binary frame arrives as into a comparable Uint8Array. */
function toBytes(x: any): Uint8Array {
  if (x instanceof ArrayBuffer) return new Uint8Array(x)
  if (ArrayBuffer.isView(x)) return new Uint8Array(x.buffer, x.byteOffset, x.byteLength)
  return x
}

describe('encodeWireFrame — symmetric, binary-aware framing', () => {
  it('passes strings through as-is (raw text frame, not double-quoted)', () => {
    expect(encodeWireFrame('hello')).toBe('hello')
  })

  it('passes an ArrayBuffer through untouched', () => {
    const ab = new Uint8Array([1, 2, 3]).buffer
    expect(encodeWireFrame(ab)).toBe(ab)
  })

  it('passes typed arrays / Buffers through untouched (binary frame)', () => {
    const u8 = new Uint8Array([250, 0, 17])
    expect(encodeWireFrame(u8)).toBe(u8)
    const buf = Buffer.from([9, 8, 7])
    expect(encodeWireFrame(buf)).toBe(buf)
  })

  it('JSON-encodes plain objects and arrays', () => {
    expect(encodeWireFrame({ a: 1 })).toBe('{"a":1}')
    expect(encodeWireFrame([1, 2])).toBe('[1,2]')
  })

  it('does NOT mangle a Buffer into {"type":"Buffer",...} (the old bug)', () => {
    const encoded = encodeWireFrame(Buffer.from([1, 2, 3]))
    expect(typeof encoded).not.toBe('string')
  })
})

describe('WebSocket server — binary frames round-trip', () => {
  const server = container.server('websocket', { json: true })
  let port = 0

  afterAll(async () => {
    try { server.connections.forEach((c: any) => c.close?.()) } catch {}
    try { await server.stop() } catch {}
  })

  it('starts', async () => {
    port = await container.feature('networking').findOpenPort(19940)
    await server.start({ port })
    expect(server.isListening).toBe(true)
  })

  it('client → server: raw PCM-like bytes arrive as binary, unchanged', async () => {
    const received = new Promise<any>((resolve) => server.on('message', (data) => resolve(data)))
    const client = new WebSocket(`ws://localhost:${port}`)
    await new Promise<void>((r, j) => { client.onopen = () => r(); client.onerror = j })

    const payload = new Uint8Array([0, 1, 2, 250, 128, 255])
    client.send(payload)

    const got = await received
    expect(toBytes(got)).toEqual(payload)   // survived inbound json-parse attempt as binary
    client.close()
  })

  it('server → client: send(Buffer) is delivered as a binary frame, unchanged', async () => {
    const connected = new Promise<any>((resolve) => server.on('connection', resolve))
    const client = new WebSocket(`ws://localhost:${port}`)
    await new Promise<void>((r, j) => { client.onopen = () => r(); client.onerror = j })
    const sock = await connected

    const bytes = Buffer.from([9, 8, 7, 6, 5])
    const received = new Promise<{ data: any; isBinary: boolean }>((resolve) => {
      client.on('message', (data: any, isBinary: boolean) => resolve({ data, isBinary }))
    })
    await server.send(sock, bytes)

    const { data, isBinary } = await received
    expect(isBinary).toBe(true)
    expect(toBytes(data)).toEqual(new Uint8Array(bytes))
    client.close()
  })

  it('objects still round-trip as JSON (regression)', async () => {
    const connected = new Promise<any>((resolve) => server.on('connection', resolve))
    const client = new WebSocket(`ws://localhost:${port}`)
    await new Promise<void>((r, j) => { client.onopen = () => r(); client.onerror = j })
    const sock = await connected

    const received = new Promise<any>((resolve) => {
      client.on('message', (data: any) => resolve(JSON.parse(data.toString())))
    })
    await server.send(sock, { hello: 'world', n: 42 })
    expect(await received).toEqual({ hello: 'world', n: 42 })
    client.close()
  })

  it('broadcast(Buffer) reaches connected clients as binary', async () => {
    const c1 = new WebSocket(`ws://localhost:${port}`)
    await new Promise<void>((r, j) => { c1.onopen = () => r(); c1.onerror = j })
    // let the server register the connection
    await new Promise((r) => setTimeout(r, 50))

    const bytes = Buffer.from([42, 43, 44])
    const received = new Promise<{ data: any; isBinary: boolean }>((resolve) => {
      c1.on('message', (data: any, isBinary: boolean) => resolve({ data, isBinary }))
    })
    await server.broadcast(bytes)

    const { data, isBinary } = await received
    expect(isBinary).toBe(true)
    expect(toBytes(data)).toEqual(new Uint8Array(bytes))
    c1.close()
  })
})

describe('WebSocket client — send() frames binary as binary', () => {
  const server = container.server('websocket', { json: true })
  let port = 0

  afterAll(async () => {
    try { server.connections.forEach((c: any) => c.close?.()) } catch {}
    try { await server.stop() } catch {}
  })

  it('a Luca client sending a typed array arrives as binary on the server', async () => {
    port = await container.feature('networking').findOpenPort(19950)
    await server.start({ port })

    const received = new Promise<any>((resolve) => server.on('message', (data) => resolve(data)))

    const client = container.client('websocket', { baseURL: `ws://localhost:${port}` })
    await client.connect()
    await client.send(new Uint8Array([1, 2, 3, 200]))

    const got = await received
    expect(toBytes(got)).toEqual(new Uint8Array([1, 2, 3, 200]))

    await client.disconnect()
  })
})
