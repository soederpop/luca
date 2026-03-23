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

/**
 * WebSocket client that bridges raw WebSocket events to Luca's Helper event bus,
 * providing a clean interface for sending/receiving messages, tracking connection
 * state, and optional auto-reconnection with exponential backoff.
 *
 * Supports ask/reply semantics when paired with the Luca WebSocket server.
 * The client can `ask(type, data)` the server and await a typed response.
 * Incoming messages with a `requestId` are treated as asks from the server
 * and can be answered with `send({ replyTo: requestId, data })`. Requests
 * time out if no reply arrives within the configurable window.
 *
 * Events emitted:
 * - `open` — connection established
 * - `message` — message received (JSON-parsed when possible)
 * - `close` — connection closed (with code and reason)
 * - `error` — connection error
 * - `reconnecting` — attempting reconnection (with attempt number)
 *
 * @example
 * ```typescript
 * const ws = container.client('websocket', {
 *   baseURL: 'ws://localhost:8080',
 *   reconnect: true,
 *   maxReconnectAttempts: 5
 * })
 * ws.on('message', (data) => console.log('Received:', data))
 * await ws.connect()
 * await ws.send({ type: 'hello' })
 *
 * // ask/reply: request data from the server
 * const result = await ws.ask('getUser', { id: 42 })
 * ```
 */
export interface PendingRequest<T = any> {
  resolve: (value: T) => void
  reject: (reason: any) => void
  timer: ReturnType<typeof setTimeout>
}

export class WebSocketClient<
  T extends WebSocketClientState = WebSocketClientState,
  K extends WebSocketClientOptions = WebSocketClientOptions
> extends Client<T, K> {
  ws!: WebSocket
  _intentionalClose: boolean
  _pending = new Map<string, PendingRequest>()

  static override shortcut = "clients.websocket" as const
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
   * the payload. If not currently connected, attempts to connect first.
   * @param data - The data to send (will be JSON.stringify'd)
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
   * @param type - A string identifying the request type
   * @param data - Optional payload to include with the request
   * @param timeout - How long to wait for a response (default 10 000 ms)
   * @returns The `data` field of the response message
   *
   * @example
   * ```typescript
   * const result = await ws.ask('getUser', { id: 42 })
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
   * Gracefully close the WebSocket connection. Suppresses auto-reconnect
   * and updates connection state to disconnected.
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
