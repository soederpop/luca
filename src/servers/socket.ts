import { z } from 'zod'
import { ServerStateSchema, ServerOptionsSchema, ServerEventsSchema } from '../schemas/base.js'
import { type StartOptions, Server, type ServerState } from '../server.js';
import { WebSocketServer as BaseServer } from 'ws'
import type { PendingRequest } from '../clients/websocket.js'

declare module '../server' {
  interface AvailableServers {
    websocket: typeof WebsocketServer
  }
}

export const SocketServerOptionsSchema = ServerOptionsSchema.extend({
  json: z.boolean().optional().describe('When enabled, incoming messages are automatically JSON-parsed before emitting the message event, and outgoing send/broadcast calls JSON-stringify the payload'),
})
export type SocketServerOptions = z.infer<typeof SocketServerOptionsSchema>

export const SocketServerEventsSchema = ServerEventsSchema.extend({
  connection: z.tuple([z.any().describe('The raw WebSocket client instance from the ws library')]).describe('Fires when a new client connects'),
  message: z.tuple([z.any().describe('The message data (JSON-parsed object when json option is enabled, raw Buffer/string otherwise)'), z.any().describe('The WebSocket client that sent the message — use with server.send(ws, data) to reply')]).describe('Fires when a message is received from a client. Handler signature: (data, ws)'),
}).describe('WebSocket server events')

/**
 * WebSocket server built on the `ws` library with optional JSON message framing.
 *
 * Manages WebSocket connections, tracks connected clients, and bridges
 * messages to Luca's event bus. When `json` mode is enabled, incoming
 * messages are automatically JSON-parsed (with `.toString()` for Buffer data)
 * and outgoing messages via `send()` / `broadcast()` are JSON-stringified.
 * When `json` mode is disabled, raw message data is emitted as-is and
 * `send()` / `broadcast()` still JSON-stringify for safety.
 *
 * @extends Server
 *
 * @example
 * ```typescript
 * const ws = container.server('websocket', { json: true })
 * await ws.start({ port: 8080 })
 *
 * ws.on('message', (data, client) => {
 *   console.log('Received:', data)
 *   ws.broadcast({ echo: data })
 * })
 * ```
 */
export class WebsocketServer<T extends ServerState = ServerState, K extends SocketServerOptions = SocketServerOptions> extends Server<T,K> {
    static override shortcut = 'servers.websocket' as const
    static override stateSchema = ServerStateSchema
    static override optionsSchema = SocketServerOptionsSchema
    static override eventsSchema = SocketServerEventsSchema

    static { Server.register(this, 'websocket') }
    
    _wss?: BaseServer 

    get wss() {
      if (this._wss) {
        return this._wss
      }
      
      return this._wss = new BaseServer({ 
        port: this.port 
      })
    }

    connections : Set<any> = new Set()
    _pending = new Map<string, PendingRequest>()

    async broadcast(message: any) {
      for(const ws of this.connections) {
        await ws.send(JSON.stringify(message))
      }
      
      return this
    }
    
    async send(ws: any, message: any) {
      await ws.send(JSON.stringify(message))
      return this
    }

    /**
     * Send a request to a specific client and wait for a correlated response.
     * The client is expected to reply with a message whose `replyTo` matches
     * the `requestId` of this message.
     *
     * @param ws - The WebSocket client to ask
     * @param type - A string identifying the request type
     * @param data - Optional payload
     * @param timeout - How long to wait (default 10 000 ms)
     * @returns The `data` field of the response
     *
     * @example
     * ```typescript
     * ws.on('connection', async (client) => {
     *   const info = await ws.ask(client, 'identify')
     *   console.log('Client says:', info)
     * })
     * ```
     */
    async ask<R = any>(ws: any, type: string, data?: any, timeout = 10000): Promise<R> {
      const requestId = this.container.utils.uuid()

      return new Promise<R>((resolve, reject) => {
        const timer = setTimeout(() => {
          this._pending.delete(requestId)
          reject(new Error(`ask("${type}") timed out after ${timeout}ms`))
        }, timeout)

        this._pending.set(requestId, { resolve, reject, timer })
        this.send(ws, { type, data, requestId })
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

    /** @internal Reject all pending ask() calls — used on stop. */
    _rejectAllPending(reason: string) {
      for (const [id, pending] of this._pending) {
        clearTimeout(pending.timer)
        pending.reject(new Error(reason))
      }
      this._pending.clear()
    }

    /**
     * Start the WebSocket server. A runtime `port` overrides the constructor
     * option and is written to state before the underlying `ws.Server` is created,
     * so the server binds to the correct port.
     *
     * @param options - Optional runtime overrides for port and host
     */
    override async start(options?: StartOptions) {
      if (this.isListening) {
        return this
      }

      await this._drainPendingPlugins()

      // Apply runtime port to state before configure/wss touches it
      if (options?.port) {
        this.state.set('port', options.port)
        // Reset cached wss so it rebinds to the new port
        this._wss = undefined
      }

      if(!this.isConfigured || options?.port) {
        await this.configure()
      }

      const { wss } = this
      
      wss.on('connection', (ws) => {
        this.connections.add(ws)
        this.emit('connection', ws)

        ws.on('message', (raw) => {
          let data: any = raw
          if (this.options.json) {
            try {
              data = JSON.parse(typeof raw === 'string' ? raw : raw.toString())
            } catch {}
          }

          // Route reply messages to pending ask() calls
          if (this._handleReply(data)) return

          // If this message is a request (has requestId), provide a reply helper
          if (data && data.requestId) {
            const requestId = data.requestId
            data.reply = (responseData: any) => this.send(ws, { replyTo: requestId, data: responseData })
            data.replyError = (error: string) => this.send(ws, { replyTo: requestId, error })
          }

          this.emit('message', data, ws)
        })
      })
      
      this.state.set('listening', true)

      return this
    }

    override async stop() {
      if (this.isStopped) {
        return this
      }

      this._rejectAllPending('WebSocket server stopped')

      await Promise.race([
        new Promise<void>((resolve) => {
          if (!this._wss) {
            resolve()
            return
          }

          for (const ws of this.connections) {
            try {
              ws.terminate?.()
              ws.close?.()
            } catch {}
          }
          this.connections.clear()

          try {
            this._wss.close(() => {
              this._wss = undefined
              resolve()
            })
          } catch {
            this._wss = undefined
            resolve()
          }
        }),
        new Promise<void>((resolve) => setTimeout(resolve, 500)),
      ])

      this.state.set('listening', false)
      this.state.set('stopped', true)
      return this
    }
    
    /** The port this server will bind to. Defaults to 8081 if not set via constructor options or start(). */
    override get port() {
      return this.state.get('port') || this.options.port || 8081
    }
}

export default WebsocketServer
