import { z } from 'zod'
import { Client } from '../client.js'
import type { ContainerContext } from '../container.js'
import {
  WebSocketClientStateSchema, WebSocketClientOptionsSchema, WebSocketClientEventsSchema,
} from '../schemas/base.js'

export type WebSocketClientState = z.infer<typeof WebSocketClientStateSchema>
export type WebSocketClientOptions = z.infer<typeof WebSocketClientOptionsSchema>

declare module '../client' {
  interface AvailableClients {
    websocket: typeof WebSocketClient
  }
}

/** Tracks an in-flight `ask()` request awaiting a correlated reply (resolve/reject callbacks plus the timeout timer). */
export interface PendingRequest<T = any> {
  resolve: (value: T) => void
  reject: (reason: any) => void
  timer: ReturnType<typeof setTimeout>
}

/**
 * WebSocket client that bridges raw WebSocket events to Luca's Helper event bus,
 * providing a clean interface for sending/receiving messages, tracking connection
 * state (`state.connected`, `state.reconnectAttempts`), and optional
 * auto-reconnection with exponential backoff (base `reconnectInterval`, doubled
 * per attempt, capped at 30s, up to `maxReconnectAttempts`).
 *
 * Supports ask/reply semantics when paired with the Luca WebSocket server
 * (`container.server('websocket')`). The client can `ask(type, data)` the server
 * and await a typed response. In the other direction, an ask from the server
 * arrives as a normal `message` event whose payload carries a `requestId`;
 * answer it with `send({ replyTo: requestId, data })`. Asks time out (reject)
 * if no reply arrives within the configurable window.
 *
 * Incoming messages are JSON-parsed when possible; non-JSON payloads are
 * delivered as-is. Outgoing payloads are always `JSON.stringify`'d.
 *
 * Events emitted:
 * - `open` — connection established
 * - `message` — message received (JSON-parsed when possible)
 * - `close` — connection closed (with code and reason)
 * - `error` — connection error
 * - `reconnecting` — attempting reconnection (with attempt number)
 *
 * **CLI commands: an open socket keeps the process alive.** A `luca` command that
 * connects as a client will hang after its work is done — the live WebSocket (and
 * any reconnect timers) keep the event loop running. Call `await ws.disconnect()`
 * when finished, and if the process still lingers (other handles or pending
 * timers), end with `process.exit(0)`.
 *
 * @example
 * ```typescript
 * // pair it with the Luca websocket server so the example is self-contained
 * const port = await container.feature('networking').findOpenPort(8200)
 * const server = container.server('websocket', { json: true })
 * await server.start({ port })
 * server.on('message', (msg) => {
 *   if (msg?.type === 'getUser') msg.reply({ id: msg.data.id, name: 'Alice' })
 * })
 *
 * const ws = container.client('websocket', {
 *   baseURL: `ws://localhost:${port}`,
 *   reconnect: true,
 *   maxReconnectAttempts: 5
 * })
 * ws.on('message', (data) => console.log('Received:', data))
 * await ws.connect()
 * await ws.send({ type: 'hello' })
 *
 * // ask/reply: request data from the server and await its answer
 * const result = await ws.ask('getUser', { id: 42 })
 * console.log(result)   // { id: 42, name: 'Alice' }
 *
 * // done — close the socket so the process can exit
 * await ws.disconnect()
 * await server.stop()
 * ```
 */
export class WebSocketClient<
  T extends WebSocketClientState = WebSocketClientState,
  K extends WebSocketClientOptions = WebSocketClientOptions
> extends Client<T, K> {
  ws!: WebSocket
  _intentionalClose: boolean
  _pending = new Map<string, PendingRequest>()

  static override shortcut = "clients.websocket" as const
  static override stability = 'stable' as const
  static override stateSchema = WebSocketClientStateSchema
  static override optionsSchema = WebSocketClientOptionsSchema
  static override eventsSchema = WebSocketClientEventsSchema
  static { Client.register(this, 'websocket') }

  constructor(options?: K, context?: ContainerContext) {
    super(options, context)
    this._intentionalClose = false
  }

  override get initialState(): T {
    return {
      connected: false,
      reconnectAttempts: 0,
    } as T
  }

  /**
   * Establish a WebSocket connection to the configured baseURL.
   * Wires all raw WebSocket events (open, message, close, error) to the
   * Helper event bus and updates connection state accordingly.
   * Resolves once the connection is open; rejects on error.
   * Calling connect() while already connected is a no-op that resolves immediately.
   *
   * @example
   * ```typescript
   * // a local server to connect to (any ws endpoint works)
   * const port = await container.feature('networking').findOpenPort(8210)
   * const server = container.server('websocket')
   * await server.start({ port })
   *
   * const ws = container.client('websocket', { baseURL: `ws://localhost:${port}` })
   * ws.on('open', () => console.log('connected'))
   * ws.on('close', (code, reason) => console.log('closed', code, reason))
   * await ws.connect()
   * console.log(ws.state.get('connected'))   // true
   *
   * await ws.disconnect()   // an open socket keeps the process alive
   * await server.stop()
   * ```
   */
  override async connect(): Promise<this> {
    if (this.isConnected) {
      return this
    }

    const ws = this.ws = new WebSocket(this.baseURL)
    const state = this.state as any

    await new Promise<void>((resolve, reject) => {
      ws.onopen = () => {
        state.set('connected', true)
        state.set('connectionError', undefined)
        state.set('reconnectAttempts', 0)
        this.emit('open')
        resolve()
      }

      ws.onerror = (event: any) => {
        state.set('connectionError', event)
        this.emit('error', event)
        reject(event)
      }

      ws.onmessage = (event: any) => {
        let data = event?.data ?? event
        try {
          data = JSON.parse(data)
        } catch {}
        if (!this._handleReply(data)) {
          this.emit('message', data)
        }
      }

      ws.onclose = (event: any) => {
        state.set('connected', false)
        this.emit('close', event?.code, event?.reason)
        if (!this._intentionalClose) {
          this.maybeReconnect()
        }
        this._intentionalClose = false
      }
    })

    return this
  }

  /**
   * Send data over the WebSocket connection. Automatically JSON-serializes
   * the payload. If not currently connected, attempts to connect first
   * (so an explicit connect() call beforehand is optional).
   * @param data - The data to send (will be JSON.stringify'd)
   *
   * @example
   * ```typescript
   * const port = await container.feature('networking').findOpenPort(8220)
   * const server = container.server('websocket', { json: true })
   * await server.start({ port })
   * const firstConnection = new Promise((resolve) => server.on('connection', resolve))
   *
   * const ws = container.client('websocket', { baseURL: `ws://localhost:${port}` })
   * await ws.send({ type: 'hello', payload: { name: 'luca' } })  // auto-connects
   *
   * // Answering an ask from the server: its message carries a requestId —
   * // reply by echoing it back as replyTo
   * ws.on('message', async (msg) => {
   *   if (msg?.requestId) {
   *     await ws.send({ replyTo: msg.requestId, data: { name: 'my-client' } })
   *   }
   * })
   * const socket = await firstConnection
   * console.log(await server.ask(socket, 'identify'))   // { name: 'my-client' }
   *
   * await ws.disconnect()
   * await server.stop()
   * ```
   */
  async send(data: any): Promise<void> {
    if (!this.isConnected) {
      await this.connect()
    }

    if (!this.ws) {
      throw new Error('WebSocket instance not available')
    }

    this.ws.send(JSON.stringify(data))
  }

  /**
   * Send a request and wait for a correlated response. The message is sent
   * with a unique `requestId`; the remote side is expected to reply with a
   * message containing `replyTo` set to that same ID.
   *
   * Rejects if the reply carries an `error` field, or with a timeout Error
   * if no reply arrives in time — so unlike the rest client, ask() failures
   * DO throw and should be try/caught.
   *
   * @param type - A string identifying the request type
   * @param data - Optional payload to include with the request
   * @param timeout - How long to wait for a response (default 10 000 ms)
   * @returns The `data` field of the response message
   *
   * @example
   * ```typescript
   * // Server side (container.server('websocket', { json: true })): messages
   * // with a requestId arrive with reply helpers attached
   * const port = await container.feature('networking').findOpenPort(8230)
   * const server = container.server('websocket', { json: true })
   * await server.start({ port })
   * server.on('message', (msg) => {
   *   if (msg.type === 'getUser') msg.reply({ id: msg.data.id, name: 'Alice' })
   * })
   *
   * const ws = container.client('websocket', { baseURL: `ws://localhost:${port}` })
   * await ws.connect()
   *
   * try {
   *   const user = await ws.ask('getUser', { id: 42 }, 5000)
   *   console.log(user)   // { id: 42, name: 'Alice' }
   * } catch (err) {
   *   // reply carried an error field, or no reply within 5s
   *   console.error(err.message)   // e.g. 'ask("getUser") timed out after 5000ms'
   * }
   *
   * await ws.disconnect()
   * await server.stop()
   * ```
   */
  async ask<R = any>(type: string, data?: any, timeout = 10000): Promise<R> {
    const requestId = this.container.utils.uuid()

    return new Promise<R>((resolve, reject) => {
      const timer = setTimeout(() => {
        this._pending.delete(requestId)
        reject(new Error(`ask("${type}") timed out after ${timeout}ms`))
      }, timeout)

      this._pending.set(requestId, { resolve, reject, timer })
      this.send({ type, data, requestId })
    })
  }

  /** @internal Resolve a pending ask() if the incoming message has a replyTo field. Returns true if handled. */
  _handleReply(message: any): boolean {
    if (!message || !message.replyTo) return false

    const pending = this._pending.get(message.replyTo)
    if (!pending) return false

    this._pending.delete(message.replyTo)
    clearTimeout(pending.timer)

    if (message.error) {
      pending.reject(new Error(message.error))
    } else {
      pending.resolve(message.data)
    }
    return true
  }

  /** @internal Reject all pending ask() calls — used on disconnect. */
  _rejectAllPending(reason: string) {
    for (const [id, pending] of this._pending) {
      clearTimeout(pending.timer)
      pending.reject(new Error(reason))
    }
    this._pending.clear()
  }

  /**
   * Gracefully close the WebSocket connection. Suppresses auto-reconnect,
   * rejects any in-flight ask() promises with a 'WebSocket disconnected'
   * error, and updates connection state to disconnected.
   *
   * Always call this at the end of CLI commands — an open socket keeps the
   * process's event loop alive and the command will hang without it.
   *
   * @example
   * ```typescript
   * const port = await container.feature('networking').findOpenPort(8240)
   * const server = container.server('websocket')
   * await server.start({ port })
   *
   * const ws = container.client('websocket', { baseURL: `ws://localhost:${port}` })
   * await ws.connect()
   * await ws.send({ type: 'goodbye' })
   * await ws.disconnect()
   * console.log(ws.state.get('connected'))   // false
   * await server.stop()
   * ```
   */
  async disconnect(): Promise<this> {
    this._intentionalClose = true
    this._rejectAllPending('WebSocket disconnected')
    if (this.ws) {
      this.ws.close()
    }
    ;(this.state as any).set('connected', false)
    return this
  }

  /** Whether the client is in an error state. */
  get hasError() {
    return !!(this.state as any).get('connectionError')
  }

  /**
   * Attempt to reconnect if the reconnect option is enabled and we haven't
   * exceeded maxReconnectAttempts. Uses exponential backoff capped at 30s.
   */
  private maybeReconnect() {
    const opts = this.options as WebSocketClientOptions
    if (!opts.reconnect) return

    const state = this.state as any
    const maxAttempts = opts.maxReconnectAttempts ?? Infinity
    const baseInterval = opts.reconnectInterval ?? 1000
    const attempts = ((state.get('reconnectAttempts') as number) ?? 0) + 1

    if (attempts > maxAttempts) return

    state.set('reconnectAttempts', attempts)
    this.emit('reconnecting', attempts)

    const delay = Math.min(baseInterval * Math.pow(2, attempts - 1), 30000)
    setTimeout(() => {
      this.connect().catch(() => {})
    }, delay)
  }
}

export default WebSocketClient
