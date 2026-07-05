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
  server: z.any().optional().describe('Attach to an existing HTTP server via the WebSocket Upgrade handshake instead of binding a port. Accepts a Node http.Server or a Luca express server. When it is an express server that has not started yet, attachment is deferred until it begins listening — so a WebSocket and an HTTP API can share one port.'),
  noServer: z.boolean().optional().describe('Create the server in noServer mode: it binds no port and performs no upgrade handling of its own. Drive it manually by calling handleUpgrade(request, socket, head) from your own HTTP server\'s "upgrade" event.'),
  path: z.string().optional().describe('Only accept WebSocket connections whose request path matches this value (e.g. "/ws"). Lets HTTP routes and WebSocket connections coexist on one shared port without colliding.'),
})
export type SocketServerOptions = z.infer<typeof SocketServerOptionsSchema>

export const SocketServerEventsSchema = ServerEventsSchema.extend({
  connection: z.tuple([z.any().describe('The raw WebSocket client instance from the ws library')]).describe('Fires when a new client connects'),
  message: z.tuple([z.any().describe('The message data (JSON-parsed object when json option is enabled, raw Buffer/string otherwise)'), z.any().describe('The WebSocket client that sent the message — use with server.send(ws, data) to reply')]).describe('Fires when a message is received from a client. Handler signature: (data, ws)'),
  attached: z.tuple([z.any().describe('The Node http.Server the WebSocket server attached to')]).describe('Fires when a deferred attachment completes — i.e. an express server passed as the `server` option has started listening and the WebSocket is now sharing its port'),
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
 * Supports ask/reply semantics when paired with the Luca WebSocket client.
 * The server can `ask(ws, type, data)` a connected client and await a typed
 * response, or handle incoming asks from clients by listening for messages
 * with a `requestId` and replying via `send(ws, { replyTo, data })`.
 * Requests time out if no reply arrives within the configurable window.
 *
 * @extends Server
 *
 * @example
 * ```typescript
 * const server = container.server('websocket', { json: true })
 * const port = await container.feature('networking').findOpenPort(8180)
 * await server.start({ port })
 *
 * server.on('message', (data, client) => {
 *   console.log('Received:', data)
 * })
 *
 * // a Luca websocket client on the other end — it answers asks from the
 * // server by echoing the requestId back as replyTo
 * const firstConnection = new Promise((resolve) => server.on('connection', resolve))
 * const client = container.client('websocket', { baseURL: `ws://localhost:${port}` })
 * client.on('message', (msg) => {
 *   if (msg?.requestId) client.send({ replyTo: msg.requestId, data: { name: 'my-client' } })
 * })
 * await client.connect()
 * await client.send({ type: 'hello' })      // -> Received: { type: 'hello' }
 *
 * // ask/reply: request info from a connected client and await its answer
 * const socket = await firstConnection
 * const info = await server.ask(socket, 'identify')
 * console.log('Client says:', info)         // { name: 'my-client' }
 *
 * await client.disconnect()
 * await server.stop()
 * ```
 */
export class WebsocketServer<T extends ServerState = ServerState, K extends SocketServerOptions = SocketServerOptions> extends Server<T,K> {
    static override shortcut = 'servers.websocket' as const
    static override stability = 'stable' as const
    static override stateSchema = ServerStateSchema
    static override optionsSchema = SocketServerOptionsSchema
    static override eventsSchema = SocketServerEventsSchema

    static { Server.register(this, 'websocket') }
    
    _wss?: BaseServer

    /**
     * The underlying `ws` WebSocketServer, built lazily on first access. The
     * construction mode is chosen from options: `noServer` builds a manual
     * server (drive it with {@link handleUpgrade}); an attached `server`
     * (raw http.Server, or an already-listening express server) shares that
     * server's port via the Upgrade handshake; otherwise it binds its own
     * `port`. A `path` option, when set, is applied in every mode.
     */
    get wss(): BaseServer {
      if (this._wss) {
        return this._wss
      }

      const pathOpt = this.options.path ? { path: this.options.path } : {}

      if (this.options.noServer) {
        return this._wss = new BaseServer({ noServer: true, ...pathOpt })
      }

      const httpServer = this._attachedHttpServer()
      if (httpServer) {
        return this._wss = new BaseServer({ server: httpServer, ...pathOpt })
      }

      return this._wss = new BaseServer({ port: this.port, ...pathOpt })
    }

    /**
     * Resolve the HTTP server to attach to, if any. Returns the raw Node
     * http.Server for a raw `server` option, the express server's live
     * `httpServer` when it is already listening, or `undefined` when there is
     * nothing to attach to yet (including an express server that hasn't started).
     */
    private _attachedHttpServer(): any | undefined {
      const target = this.options.server
      if (!target) return undefined
      if (target instanceof Server) return (target as any).httpServer
      return target
    }

    /**
     * Feed an HTTP `upgrade` event to this server. Only meaningful in `noServer`
     * mode — wire it from your own http.Server:
     * `httpServer.on('upgrade', (req, socket, head) => wsServer.handleUpgrade(req, socket, head))`.
     */
    handleUpgrade(request: any, socket: any, head: any): void {
      this.wss.handleUpgrade(request, socket, head, (ws) => {
        this.wss.emit('connection', ws, request)
      })
    }

    connections : Set<any> = new Set()
    _pending = new Map<string, PendingRequest>()

    async broadcast(message: any): Promise<this> {
      for(const ws of this.connections) {
        await ws.send(JSON.stringify(message))
      }
      
      return this
    }
    
    async send(ws: any, message: any): Promise<this> {
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
     * const server = container.server('websocket', { json: true })
     * const port = await container.feature('networking').findOpenPort(8190)
     * await server.start({ port })
     * const firstConnection = new Promise((resolve) => server.on('connection', resolve))
     *
     * // a connected Luca websocket client replies by echoing requestId as replyTo
     * const client = container.client('websocket', { baseURL: `ws://localhost:${port}` })
     * client.on('message', (msg) => {
     *   if (msg?.requestId) client.send({ replyTo: msg.requestId, data: { name: 'my-client' } })
     * })
     * await client.connect()
     *
     * const socket = await firstConnection
     * const info = await server.ask(socket, 'identify')
     * console.log('Client says:', info)   // { name: 'my-client' }
     *
     * await client.disconnect()
     * await server.stop()
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
    override async start(options?: StartOptions): Promise<this> {
      if (this.isListening) {
        return this
      }

      await this._drainPendingPlugins()

      const attaching = !!this.options.server
      const manual = !!this.options.noServer

      // Attaching to an express server that hasn't started yet: defer wiring
      // until it begins listening, then share its port via the Upgrade handshake.
      if (attaching && this.options.server instanceof Server && !this._attachedHttpServer()) {
        this._deferAttach(this.options.server as Server)
        this.state.set('listening', true)
        return this
      }

      // Own-port mode honors a runtime port override; attach/noServer bind no port.
      if (options?.port && !attaching && !manual) {
        this.state.set('port', options.port)
        // Reset cached wss so it rebinds to the new port
        this._wss = undefined
      }

      // configure() finds an open port — only relevant when binding our own.
      if (!attaching && !manual && (!this.isConfigured || options?.port)) {
        await this.configure()
      }

      this._bindConnectionHandlers(this.wss)
      this.state.set('listening', true)

      return this
    }

    /** Attach to a Luca server (e.g. express) once it is listening, sharing its port. */
    private _deferAttach(lucaServer: Server): void {
      const attach = () => {
        const httpServer = (lucaServer as any).httpServer
        if (!httpServer || this._wss) return
        const pathOpt = this.options.path ? { path: this.options.path } : {}
        this._wss = new BaseServer({ server: httpServer, ...pathOpt })
        this._bindConnectionHandlers(this._wss)
        this.emit('attached', httpServer)
      }

      if ((lucaServer as any).isListening) {
        attach()
        return
      }

      const off = lucaServer.state.observe((_type: any, key: any, value: any) => {
        if (key === 'listening' && value) {
          off?.()
          attach()
        }
      })
    }

    /** Wire connection + message handling (including ask/reply plumbing) onto a ws server. */
    private _bindConnectionHandlers(wss: BaseServer): void {
      wss.on('connection', (ws) => {
        this.connections.add(ws)
        this.emit('connection', ws)

        ws.on('message', (raw: any) => {
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
    }

    override async stop(): Promise<this> {
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
    override get port(): number {
      return this.state.get('port') || this.options.port || 8081
    }
}

export default WebsocketServer
