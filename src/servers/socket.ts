import { z } from 'zod'
import { ServerStateSchema, ServerOptionsSchema, ServerEventsSchema } from '../schemas/base.js'
import { type StartOptions, Server, type ServerState } from '../server.js';
import { WebSocketServer as BaseServer } from 'ws'

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
