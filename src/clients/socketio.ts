import { z } from 'zod'
import { io, type Socket } from 'socket.io-client'
import { Client } from '../client.js'
import type { ContainerContext } from '../container.js'
import { ClientStateSchema, ClientOptionsSchema, ClientEventsSchema } from '../schemas/base.js'

export const SocketIOClientStateSchema = ClientStateSchema.extend({
  socketId: z.string().optional().describe('The socket ID assigned by the server'),
  connectionError: z.any().optional().describe('The last connection error, if any'),
  reconnectAttempts: z.number().default(0).describe('Number of reconnection attempts made'),
}).describe('Socket.IO client state')

export const SocketIOClientOptionsSchema = ClientOptionsSchema.extend({
  namespace: z.string().optional().describe('Socket.IO namespace to connect to (e.g. "/chat")'),
  path: z.string().optional().describe('Server path, defaults to "/socket.io"'),
  transports: z.array(z.string()).optional().describe('Allowed transports in preference order, defaults to ["websocket", "polling"]'),
  reconnect: z.boolean().optional().describe('Whether to automatically reconnect on disconnection (default: true)'),
  reconnectInterval: z.number().optional().describe('Base interval in milliseconds between reconnection attempts'),
  maxReconnectAttempts: z.number().optional().describe('Maximum number of reconnection attempts before giving up'),
}).describe('Socket.IO client options')

export const SocketIOClientEventsSchema = ClientEventsSchema.extend({
  open: z.tuple([]).describe('Emitted when the connection is established'),
  message: z.tuple([z.any().describe('The message data')]).describe('Emitted when a "message" event is received'),
  close: z.tuple([z.string().optional().describe('Disconnect reason')]).describe('Emitted when the connection is closed'),
  error: z.tuple([z.any().describe('The error')]).describe('Emitted when a connection error occurs'),
  reconnecting: z.tuple([z.number().describe('Attempt number')]).describe('Emitted when attempting to reconnect'),
}).describe('Socket.IO client events')

export type SocketIOClientState = z.infer<typeof SocketIOClientStateSchema>
export type SocketIOClientOptions = z.infer<typeof SocketIOClientOptionsSchema>

declare module '../client' {
  interface AvailableClients {
    socketio: typeof SocketIOClient
  }
}

/**
 * Socket.IO client that bridges socket.io-client events to Luca's Helper event bus.
 * Mirrors the WebSocket client interface so the two are interchangeable for
 * connect/disconnect/send/ask workflows, while adding `fire()` for socket.io's
 * native named-event emission.
 *
 * Reconnection is delegated to socket.io's built-in machinery. Calling
 * `disconnect()` suppresses auto-reconnect — no extra flag needed. The `ask()`
 * method uses socket.io acknowledgment callbacks rather than the requestId/replyTo
 * correlation used by the WebSocket client — the server must invoke the ack callback.
 *
 * Events emitted:
 * - `open` — connection established (maps from socket.io `connect`)
 * - `message` — a `message` event was received
 * - `close` — disconnected (with reason string)
 * - `error` — connection error
 * - `reconnecting` — attempting reconnection (with attempt number)
 *
 * @example
 * ```typescript
 * const sio = container.client('socketio', {
 *   baseURL: 'http://localhost:3000',
 *   namespace: '/chat',
 *   reconnect: true,
 * })
 * sio.on('message', (data) => console.log('Received:', data))
 * await sio.connect()
 * await sio.send({ text: 'hello' })
 *
 * // named event emission
 * await sio.fire('join', { room: 'general' })
 *
 * // ask with server-side ack: server must call the callback
 * const reply = await sio.ask('getUser', { id: 42 })
 * ```
 */
export class SocketIOClient<
  T extends SocketIOClientState = SocketIOClientState,
  K extends SocketIOClientOptions = SocketIOClientOptions
> extends Client<T, K> {
  socket!: Socket

  static override shortcut = 'clients.socketio' as const
  static override stability = 'stable' as const
  static override category = 'networking' as const
  static override stateSchema = SocketIOClientStateSchema
  static override optionsSchema = SocketIOClientOptionsSchema
  static override eventsSchema = SocketIOClientEventsSchema
  static { Client.register(this, 'socketio') }

  override get initialState(): T {
    return {
      connected: false,
      reconnectAttempts: 0,
    } as T
  }

  /**
   * Establish a socket.io connection to the configured baseURL (+ optional namespace).
   * The socket and its event listeners are created once — subsequent calls after a
   * manual disconnect reuse the same socket instance without rewiring listeners.
   * Resolves once connected; rejects on first connection error.
   */
  override async connect(): Promise<this> {
    if (this.isConnected) return this

    const opts = this.options as SocketIOClientOptions
    const state = this.state as any

    if (!this.socket) {
      const url = opts.namespace ? `${this.baseURL}${opts.namespace}` : this.baseURL

      this.socket = io(url, {
        autoConnect: false,
        path: opts.path,
        transports: (opts.transports as any) ?? ['websocket', 'polling'],
        reconnection: opts.reconnect !== false,
        reconnectionAttempts: opts.maxReconnectAttempts ?? Infinity,
        reconnectionDelay: opts.reconnectInterval ?? 1000,
      })

      this.socket.on('connect', () => {
        state.set('connected', true)
        state.set('socketId', this.socket.id)
        state.set('connectionError', undefined)
        state.set('reconnectAttempts', 0)
        this.emit('open')
      })

      this.socket.on('connect_error', (err: any) => {
        state.set('connectionError', err)
        this.emit('error', err)
      })

      this.socket.on('message', (data: any) => {
        this.emit('message', data)
      })

      this.socket.on('disconnect', (reason: string) => {
        state.set('connected', false)
        state.set('socketId', undefined)
        this.emit('close', reason)
      })

      this.socket.io.on('reconnect_attempt', (attempt: number) => {
        state.set('reconnectAttempts', attempt)
        this.emit('reconnecting', attempt)
      })
    }

    await new Promise<void>((resolve, reject) => {
      this.socket.once('connect', () => resolve())
      this.socket.once('connect_error', (err: any) => reject(err))
      this.socket.connect()
    })

    return this
  }

  /**
   * Emit the `message` event on the socket. Socket.IO handles its own framing,
   * so no explicit JSON serialization is needed (unlike the WebSocket client).
   * Connects first if not already connected.
   *
   * @param data - The data to send
   */
  async send(data: any): Promise<void> {
    if (!this.isConnected) await this.connect()
    this.socket.emit('message', data)
  }

  /**
   * Emit a named event on the socket — equivalent to `socket.emit(event, data)`.
   * Use this for socket.io's named-event semantics beyond the generic `message` channel.
   * Connects first if not already connected.
   *
   * @param event - The event name to emit
   * @param data - Optional payload
   *
   * @example
   * ```typescript
   * await sio.fire('join', { room: 'general' })
   * await sio.fire('typing', { userId: 1 })
   * ```
   */
  async fire(event: string, data?: any): Promise<void> {
    if (!this.isConnected) await this.connect()
    this.socket.emit(event, data)
  }

  /**
   * Emit a named event and wait for the server's acknowledgment callback.
   * The server must accept the ack as its last argument and call it to resolve:
   * `socket.on('getUser', (data, ack) => ack({ data: result }))`.
   *
   * If the ack response has an `error` field the promise rejects with that error.
   * If it has a `data` field, that value is resolved; otherwise the full response
   * is returned.
   *
   * @param event - The event name to emit
   * @param data - Optional payload
   * @param timeout - How long to wait for acknowledgment (default 10 000 ms)
   * @returns The `data` field of the ack response, or the full response if no `data` key
   *
   * @example
   * ```typescript
   * const user = await sio.ask('getUser', { id: 42 })
   * ```
   */
  async ask<R = any>(event: string, data?: any, timeout = 10000): Promise<R> {
    if (!this.isConnected) await this.connect()

    return new Promise<R>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`ask("${event}") timed out after ${timeout}ms`))
      }, timeout)

      this.socket.emit(event, data, (response: any) => {
        clearTimeout(timer)
        if (response?.error) {
          reject(new Error(response.error))
        } else {
          resolve(response?.data ?? response)
        }
      })
    })
  }

  /**
   * Gracefully close the socket.io connection. Calling `socket.disconnect()`
   * suppresses socket.io's built-in auto-reconnect automatically.
   */
  async disconnect(): Promise<this> {
    if (this.socket) {
      this.socket.disconnect()
    }
    ;(this.state as any).set('connected', false)
    ;(this.state as any).set('socketId', undefined)
    return this
  }

  /** Whether the client is in an error state. */
  get hasError() {
    return !!(this.state as any).get('connectionError')
  }
}

export default SocketIOClient
