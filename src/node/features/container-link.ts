import { z } from 'zod'
import { randomBytes } from 'crypto'
import { FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from '../../schemas/base.js'
import { Feature } from '../feature.js'
import { WebSocketServer } from 'ws'

// --- Message Types ---

export const MessageTypes = {
  register: 'register',
  registered: 'registered',
  eval: 'eval',
  evalResult: 'evalResult',
  event: 'event',
  ping: 'ping',
  pong: 'pong',
  disconnect: 'disconnect',
  error: 'error',
} as const

export type MessageType = typeof MessageTypes[keyof typeof MessageTypes]

// --- Link Message Envelope ---

export interface LinkMessage<T = any> {
  type: MessageType
  id: string
  timestamp: number
  token?: string
  data?: T
}

// --- Registration Data ---

export interface RegisterData {
  uuid: string
  url?: string
  capabilities?: string[]
  meta?: Record<string, any>
}

export interface RegisteredData {
  token: string
  hostId: string
}

// --- Eval Data ---

export interface EvalData {
  code: string
  context?: Record<string, any>
  requestId: string
  timeout?: number
}

export interface EvalResultData {
  requestId: string
  result?: any
  error?: string
}

// --- Event Data ---

export interface EventData {
  eventName: string
  data?: any
}

// --- Connected Container Metadata ---

export interface ConnectedContainer {
  uuid: string
  url?: string
  capabilities?: string[]
  meta?: Record<string, any>
  ws: any
  token: string
  missedHeartbeats: number
}

// --- Schemas ---

export const ContainerLinkStateSchema = FeatureStateSchema.extend({
  connectionCount: z.number().default(0).describe('Number of currently connected web containers'),
  port: z.number().optional().describe('Port the WebSocket server is listening on'),
  listening: z.boolean().default(false).describe('Whether the WebSocket server is listening'),
})
export type ContainerLinkState = z.infer<typeof ContainerLinkStateSchema>

export const ContainerLinkOptionsSchema = FeatureOptionsSchema.extend({
  port: z.number().optional().default(8089).describe('Port for the WebSocket server'),
  heartbeatInterval: z.number().optional().default(30000).describe('Interval in ms between heartbeat pings'),
  maxMissedHeartbeats: z.number().optional().default(3).describe('Max missed pongs before disconnecting a client'),
})
export type ContainerLinkOptions = z.infer<typeof ContainerLinkOptionsSchema>

export const ContainerLinkEventsSchema = FeatureEventsSchema.extend({
  connection: z.tuple([z.string().describe('Container UUID'), z.any().describe('Connection metadata')]).describe('Emitted when a web container connects and registers'),
  disconnection: z.tuple([z.string().describe('Container UUID'), z.string().optional().describe('Reason')]).describe('Emitted when a web container disconnects'),
  event: z.tuple([z.string().describe('Container UUID'), z.string().describe('Event name'), z.any().describe('Event data')]).describe('Emitted when a web container sends a structured event'),
  evalResult: z.tuple([z.string().describe('Request ID'), z.any().describe('Result or error')]).describe('Emitted when an eval result is received'),
})

// --- Pending Eval ---

type PendingEval = {
  resolve: (value: any) => void
  reject: (reason: any) => void
  timer: ReturnType<typeof setTimeout>
}

// --- Feature ---

/**
 * ContainerLink (Node-side) — WebSocket host for remote web containers.
 *
 * Creates a WebSocket server that web containers connect to. The host can evaluate
 * code in connected web containers and receive structured events back.
 * Trust is strictly one-way: the node side can eval in web containers,
 * but web containers can NEVER eval in the node container.
 *
 * @example
 * ```typescript
 * const link = container.feature('containerLink', { enable: true, port: 8089 })
 * await link.start()
 *
 * // When a web container connects:
 * link.on('connection', (uuid, meta) => {
 *   console.log('Connected:', uuid)
 * })
 *
 * // Eval code in a specific web container
 * const result = await link.eval(uuid, 'document.title')
 *
 * // Broadcast eval to all connected containers
 * const results = await link.broadcast('navigator.userAgent')
 *
 * // Listen for events from web containers
 * link.on('event', (uuid, eventName, data) => {
 *   console.log(`Event from ${uuid}: ${eventName}`, data)
 * })
 * ```
 */
export class ContainerLink extends Feature<ContainerLinkState, ContainerLinkOptions> {
  static override shortcut = 'features.containerLink' as const
  static override stateSchema = ContainerLinkStateSchema
  static override optionsSchema = ContainerLinkOptionsSchema
  static override eventsSchema = ContainerLinkEventsSchema
  static { Feature.register(this, 'containerLink') }

  private _wss?: WebSocketServer
  private _connections = new Map<string, ConnectedContainer>()
  private _pendingEvals = new Map<string, PendingEval>()
  private _heartbeatTimer?: ReturnType<typeof setInterval>

  override get initialState(): ContainerLinkState {
    return {
      ...super.initialState,
      connectionCount: 0,
      listening: false,
    }
  }

  /** Whether the WebSocket server is currently listening. */
  get isListening(): boolean {
    return this.state.get('listening') || false
  }

  /** Number of currently connected web containers. */
  get connectionCount(): number {
    return this._connections.size
  }

  /**
   * Start the WebSocket server and begin accepting connections.
   *
   * @returns This feature instance for chaining
   */
  async start(): Promise<this> {
    if (this._wss) return this

    const port = this.options.port || 8089

    return new Promise((resolve) => {
      this._wss = new WebSocketServer({ port }, () => {
        this.setState({ listening: true, port })
        this.startHeartbeat()
        resolve(this)
      })

      this._wss.on('connection', (ws) => {
        ws.on('message', (raw: Buffer | string) => {
          this.handleMessage(ws, raw)
        })

        ws.on('close', () => {
          const entry = this.findConnectionByWs(ws)
          if (entry) {
            this._connections.delete(entry.uuid)
            this.setState({ connectionCount: this._connections.size })
            this.emit('disconnection', entry.uuid, 'closed')
          }
        })

        ws.on('error', () => {
          const entry = this.findConnectionByWs(ws)
          if (entry) {
            this._connections.delete(entry.uuid)
            this.setState({ connectionCount: this._connections.size })
            this.emit('disconnection', entry.uuid, 'error')
          }
        })
      })

      this._wss.on('error', (err) => {
        this.emit('error', err)
      })
    })
  }

  /**
   * Stop the WebSocket server and disconnect all clients.
   *
   * @returns This feature instance for chaining
   */
  async stop(): Promise<this> {
    this.stopHeartbeat()

    // Reject all pending evals
    for (const [, pending] of this._pendingEvals) {
      clearTimeout(pending.timer)
      pending.reject(new Error('ContainerLink stopped'))
    }
    this._pendingEvals.clear()

    // Disconnect all clients forcefully
    for (const [, conn] of this._connections) {
      try {
        conn.ws.terminate?.()
        conn.ws.close?.()
      } catch { /* ignore */ }
    }
    this._connections.clear()

    // Close server with timeout to avoid hanging
    if (this._wss) {
      await Promise.race([
        new Promise<void>((resolve) => {
          this._wss!.close(() => resolve())
        }),
        new Promise<void>((resolve) => setTimeout(resolve, 500)),
      ])
      this._wss = undefined
    }

    this.setState({ listening: false, connectionCount: 0, port: undefined })
    return this
  }

  /**
   * Evaluate code in a specific connected web container.
   *
   * @param containerId - UUID of the target web container
   * @param code - JavaScript code to evaluate
   * @param context - Optional context variables to inject
   * @param timeout - Timeout in ms (default 10000)
   * @returns The eval result
   */
  async eval<T = any>(containerId: string, code: string, context?: Record<string, any>, timeout = 10000): Promise<T> {
    const conn = this._connections.get(containerId)
    if (!conn) {
      throw new Error(`No connection found for container: ${containerId}`)
    }

    const requestId = this.createMessage(MessageTypes.eval).id

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this._pendingEvals.delete(requestId)
        reject(new Error(`Eval timed out after ${timeout}ms`))
      }, timeout)

      this._pendingEvals.set(requestId, { resolve, reject, timer })

      const msg = this.createMessage<EvalData>(MessageTypes.eval, {
        code,
        context,
        requestId,
        timeout,
      }, conn.token)

      conn.ws.send(JSON.stringify(msg))
    })
  }

  /**
   * Evaluate code in all connected web containers.
   *
   * @param code - JavaScript code to evaluate
   * @param context - Optional context variables to inject
   * @param timeout - Timeout in ms (default 10000)
   * @returns Map of containerId → result or Error
   */
  async broadcast<T = any>(code: string, context?: Record<string, any>, timeout = 10000): Promise<Map<string, T | Error>> {
    const results = new Map<string, T | Error>()
    const promises: Promise<void>[] = []

    for (const [uuid] of this._connections) {
      promises.push(
        this.eval<T>(uuid, code, context, timeout)
          .then((result) => { results.set(uuid, result) })
          .catch((err) => { results.set(uuid, err instanceof Error ? err : new Error(String(err))) })
      )
    }

    await Promise.all(promises)
    return results
  }

  /**
   * Get metadata of all connected containers.
   *
   * @returns Array of connection metadata (without ws reference)
   */
  getConnections(): Array<Omit<ConnectedContainer, 'ws' | 'token'>> {
    return Array.from(this._connections.values()).map(({ ws, token, ...rest }) => rest)
  }

  /**
   * Disconnect a specific web container.
   *
   * @param containerId - UUID of the container to disconnect
   * @param reason - Optional reason string
   */
  disconnect(containerId: string, reason?: string): void {
    const conn = this._connections.get(containerId)
    if (!conn) return

    try {
      const msg = this.createMessage(MessageTypes.disconnect, { reason: reason || 'disconnected by host' }, conn.token)
      conn.ws.send(JSON.stringify(msg))
      conn.ws.close()
    } catch { /* ignore */ }

    this._connections.delete(containerId)
    this.setState({ connectionCount: this._connections.size })
    this.emit('disconnection', containerId, reason)
  }

  // --- Internal ---

  private handleMessage(ws: any, raw: Buffer | string): void {
    let msg: LinkMessage
    try {
      msg = JSON.parse(typeof raw === 'string' ? raw : raw.toString())
    } catch {
      return // Malformed JSON
    }

    switch (msg.type) {
      case MessageTypes.register:
        this.handleRegister(ws, msg)
        break

      case MessageTypes.eval:
        // SECURITY: Web containers can NEVER eval in the node container
        this.sendToWs(ws, this.createMessage(MessageTypes.error, {
          message: 'Eval from web containers is not permitted',
          requestId: (msg.data as any)?.requestId,
        }))
        break

      case MessageTypes.evalResult:
        this.handleEvalResult(msg)
        break

      case MessageTypes.event:
        this.handleEvent(ws, msg)
        break

      case MessageTypes.pong:
        this.handlePong(ws)
        break

      case MessageTypes.disconnect:
        this.handleClientDisconnect(ws, msg)
        break

      default:
        break
    }
  }

  private handleRegister(ws: any, msg: LinkMessage<RegisterData>): void {
    const data = msg.data
    if (!data?.uuid) {
      this.sendToWs(ws, this.createMessage(MessageTypes.error, { message: 'Registration requires uuid' }))
      return
    }

    const token = this.generateToken()

    const connection: ConnectedContainer = {
      uuid: data.uuid,
      url: data.url,
      capabilities: data.capabilities,
      meta: data.meta,
      ws,
      token,
      missedHeartbeats: 0,
    }

    this._connections.set(data.uuid, connection)
    this.setState({ connectionCount: this._connections.size })

    // Send registered acknowledgment
    this.sendToWs(ws, this.createMessage(MessageTypes.registered, {
      token,
      hostId: this.container.uuid,
    } as any))

    this.emit('connection', data.uuid, {
      url: data.url,
      capabilities: data.capabilities,
      meta: data.meta,
    })
  }

  private handleEvalResult(msg: LinkMessage<EvalResultData>): void {
    const data = msg.data
    if (!data?.requestId) return

    // Validate token
    const conn = this.findConnectionByToken(msg.token)
    if (!conn) return

    const pending = this._pendingEvals.get(data.requestId)
    if (!pending) return

    this._pendingEvals.delete(data.requestId)
    clearTimeout(pending.timer)

    if (data.error) {
      pending.reject(new Error(data.error))
    } else {
      pending.resolve(data.result)
    }

    this.emit('evalResult', data.requestId, data.error ? new Error(data.error) : data.result)
  }

  private handleEvent(_ws: any, msg: LinkMessage<EventData>): void {
    const conn = this.findConnectionByToken(msg.token)
    if (!conn) return

    const data = msg.data
    if (!data?.eventName) return

    this.emit('event', conn.uuid, data.eventName, data.data)
  }

  private handlePong(ws: any): void {
    const entry = this.findConnectionByWs(ws)
    if (entry) {
      entry.missedHeartbeats = 0
    }
  }

  private handleClientDisconnect(ws: any, msg: LinkMessage): void {
    const entry = this.findConnectionByWs(ws)
    if (entry) {
      this._connections.delete(entry.uuid)
      this.setState({ connectionCount: this._connections.size })
      this.emit('disconnection', entry.uuid, msg.data?.reason || 'client disconnect')
      try { ws.close() } catch { /* ignore */ }
    }
  }

  /** Generate a cryptographically random token for connection auth. */
  generateToken(): string {
    return randomBytes(32).toString('hex')
  }

  /** Create a link protocol message with a unique ID. */
  private createMessage<T = any>(type: MessageType, data?: T, token?: string): LinkMessage<T> {
    return {
      type,
      id: this.container.utils.uuid(),
      timestamp: Date.now(),
      ...(token != null ? { token } : {}),
      ...(data != null ? { data } : {}),
    }
  }

  private sendToWs(ws: any, msg: LinkMessage): void {
    try {
      ws.send(JSON.stringify(msg))
    } catch { /* ignore */ }
  }

  /**
   * Send a message to a specific connected container by UUID.
   *
   * @param containerId - UUID of the target container
   * @param msg - The message to send
   */
  sendTo(containerId: string, msg: LinkMessage): void {
    const conn = this._connections.get(containerId)
    if (!conn) return
    this.sendToWs(conn.ws, msg)
  }

  private findConnectionByWs(ws: any): ConnectedContainer | undefined {
    for (const conn of this._connections.values()) {
      if (conn.ws === ws) return conn
    }
    return undefined
  }

  private findConnectionByToken(token?: string): ConnectedContainer | undefined {
    if (!token) return undefined
    for (const conn of this._connections.values()) {
      if (conn.token === token) return conn
    }
    return undefined
  }

  private startHeartbeat(): void {
    const interval = this.options.heartbeatInterval || 30000
    const maxMissed = this.options.maxMissedHeartbeats || 3

    this._heartbeatTimer = setInterval(() => {
      for (const [uuid, conn] of this._connections) {
        conn.missedHeartbeats++

        if (conn.missedHeartbeats > maxMissed) {
          this.disconnect(uuid, 'heartbeat timeout')
          continue
        }

        this.sendToWs(conn.ws, this.createMessage(MessageTypes.ping))
      }
    }, interval)

    // Don't keep the process alive just for heartbeats
    if (this._heartbeatTimer?.unref) {
      this._heartbeatTimer.unref()
    }
  }

  private stopHeartbeat(): void {
    if (this._heartbeatTimer) {
      clearInterval(this._heartbeatTimer)
      this._heartbeatTimer = undefined
    }
  }
}

export default ContainerLink