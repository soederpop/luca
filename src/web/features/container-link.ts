import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from '../../schemas/base.js'
import { features, Feature } from '../feature.js'
import type { Container } from '../../container.js'

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

// --- Schemas ---

export const ContainerLinkStateSchema = FeatureStateSchema.extend({
  connected: z.boolean().default(false).describe('Whether connected to the host'),
  token: z.string().optional().describe('Auth token received from host during registration'),
  hostId: z.string().optional().describe('UUID of the connected host container'),
  reconnectAttempts: z.number().default(0).describe('Number of reconnection attempts made'),
})
export type ContainerLinkState = z.infer<typeof ContainerLinkStateSchema>

export const ContainerLinkOptionsSchema = FeatureOptionsSchema.extend({
  hostUrl: z.string().optional().describe('WebSocket URL of the host container (e.g. ws://localhost:8089)'),
  meta: z.record(z.string(), z.any()).optional().describe('Metadata to send during registration'),
  capabilities: z.array(z.string()).optional().describe('Capability tags to advertise to the host'),
  reconnect: z.boolean().default(true).describe('Whether to automatically reconnect on disconnection'),
  reconnectInterval: z.number().default(1000).describe('Base interval in ms between reconnection attempts'),
  maxReconnectAttempts: z.number().default(10).describe('Maximum number of reconnection attempts'),
})
export type ContainerLinkOptions = z.infer<typeof ContainerLinkOptionsSchema>

export const ContainerLinkEventsSchema = FeatureEventsSchema.extend({
  connected: z.tuple([z.string().describe('Host container UUID')]).describe('Emitted when successfully registered with the host'),
  disconnected: z.tuple([z.string().optional().describe('Reason')]).describe('Emitted when disconnected from the host'),
  evalRequest: z.tuple([z.string().describe('Code to evaluate'), z.string().describe('Request ID')]).describe('Emitted before executing an eval request from the host'),
  reconnecting: z.tuple([z.number().describe('Attempt number')]).describe('Emitted when attempting to reconnect'),
})

// --- Feature ---

/**
 * ContainerLink (Web-side) — WebSocket client that connects to a node host.
 *
 * Connects to a ContainerLink host over WebSocket. The host can evaluate code
 * in this container, and the web side can emit structured events to the host.
 * The web side can NEVER eval code in the host — trust is strictly one-way.
 *
 * @example
 * ```typescript
 * const link = container.feature('containerLink', {
 *   enable: true,
 *   hostUrl: 'ws://localhost:8089',
 * })
 * await link.connect()
 *
 * // Send events to the host
 * link.emitToHost('click', { x: 100, y: 200 })
 *
 * // Listen for eval requests before they execute
 * link.on('evalRequest', (code, requestId) => {
 *   console.log('Host is evaluating:', code)
 * })
 * ```
 */
export class ContainerLink extends Feature<ContainerLinkState, ContainerLinkOptions> {
  static override shortcut = 'features.containerLink' as const
  static override stateSchema = ContainerLinkStateSchema
  static override optionsSchema = ContainerLinkOptionsSchema
  static override eventsSchema = ContainerLinkEventsSchema

  static attach(container: Container & { containerLink?: ContainerLink }) {
    container.features.register('containerLink', ContainerLink)
  }

  private _ws?: WebSocket
  private _reconnectTimer?: ReturnType<typeof setTimeout>

  override get initialState(): ContainerLinkState {
    return {
      ...super.initialState,
      connected: false,
      reconnectAttempts: 0,
    }
  }

  /** Whether currently connected to the host. */
  get isConnected(): boolean {
    return this.state.get('connected') || false
  }

  /** The auth token received from the host. */
  get token(): string | undefined {
    return this.state.get('token')
  }

  /** The host container's UUID. */
  get hostId(): string | undefined {
    return this.state.get('hostId')
  }

  /**
   * Connect to the host WebSocket server and perform registration.
   *
   * @param hostUrl - Override the configured host URL
   * @returns Promise that resolves when registered
   */
  async connect(hostUrl?: string): Promise<this> {
    const url = hostUrl || this.options.hostUrl
    if (!url) {
      throw new Error('No hostUrl provided for containerLink connection')
    }

    if (this._ws) {
      this._ws.close()
      this._ws = undefined
    }

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url)
      this._ws = ws

      let registered = false

      ws.onopen = () => {
        // Send registration
        const msg = this.createMessage(MessageTypes.register, {
          uuid: this.container.uuid,
          url: typeof window !== 'undefined' ? window.location?.href : undefined,
          capabilities: this.options.capabilities,
          meta: this.options.meta,
        })
        ws.send(JSON.stringify(msg))
      }

      ws.onmessage = (event: MessageEvent) => {
        let msg: LinkMessage
        try {
          msg = JSON.parse(event.data)
        } catch {
          return
        }

        if (!registered && msg.type === MessageTypes.registered) {
          registered = true
          const data = msg.data as RegisteredData
          this.setState({
            connected: true,
            token: data.token,
            hostId: data.hostId,
            reconnectAttempts: 0,
          })
          this.emit('connected', data.hostId)
          resolve(this)
          return
        }

        if (!registered && msg.type === MessageTypes.error) {
          reject(new Error(msg.data?.message || 'Registration failed'))
          return
        }

        this.handleMessage(msg)
      }

      ws.onclose = () => {
        const wasConnected = this.isConnected
        this.setState({ connected: false })

        if (wasConnected) {
          this.emit('disconnected', 'closed')
        }

        if (!registered) {
          reject(new Error('WebSocket closed before registration'))
          return
        }

        this.maybeReconnect(url)
      }

      ws.onerror = () => {
        if (!registered) {
          reject(new Error('WebSocket connection error'))
        }
      }
    })
  }

  /**
   * Disconnect from the host.
   *
   * @param reason - Optional reason string
   */
  disconnect(reason?: string): void {
    // Prevent reconnection
    this.clearReconnectTimer()

    if (this._ws) {
      try {
        const msg = this.createMessage(MessageTypes.disconnect, { reason: reason || 'client disconnect' }, this.token)
        this._ws.send(JSON.stringify(msg))
      } catch { /* ignore */ }

      this._ws.close()
      this._ws = undefined
    }

    this.setState({ connected: false, token: undefined, hostId: undefined })
    this.emit('disconnected', reason)
  }

  /**
   * Send a structured event to the host container.
   *
   * @param eventName - Name of the event
   * @param data - Optional event data
   */
  emitToHost(eventName: string, data?: any): void {
    if (!this._ws || !this.isConnected) {
      throw new Error('Not connected to host')
    }

    const msg = this.createMessage<EventData>(MessageTypes.event, {
      eventName,
      data,
    }, this.token)

    this._ws.send(JSON.stringify(msg))
  }

  // --- Internal ---

  private handleMessage(msg: LinkMessage): void {
    switch (msg.type) {
      case MessageTypes.eval:
        this.handleEval(msg as LinkMessage<EvalData>)
        break

      case MessageTypes.ping:
        this.respondToPing()
        break

      case MessageTypes.disconnect:
        this.clearReconnectTimer()
        this._ws?.close()
        this._ws = undefined
        this.setState({ connected: false, token: undefined, hostId: undefined })
        this.emit('disconnected', msg.data?.reason || 'host disconnect')
        break

      default:
        break
    }
  }

  private async handleEval(msg: LinkMessage<EvalData>): Promise<void> {
    const data = msg.data
    if (!data?.code || !data?.requestId) return

    this.emit('evalRequest', data.code, data.requestId)

    try {
      const vm = this.container.feature('vm') as any
      const result = await vm.run(data.code, data.context || {})

      const response = this.createMessage(MessageTypes.evalResult, {
        requestId: data.requestId,
        result,
      }, this.token)

      this._ws?.send(JSON.stringify(response))
    } catch (err: any) {
      const response = this.createMessage(MessageTypes.evalResult, {
        requestId: data.requestId,
        error: err?.message || String(err),
      }, this.token)

      this._ws?.send(JSON.stringify(response))
    }
  }

  private respondToPing(): void {
    if (!this._ws || !this.isConnected) return
    const msg = this.createMessage(MessageTypes.pong, undefined, this.token)
    this._ws.send(JSON.stringify(msg))
  }

  private maybeReconnect(url: string): void {
    if (!this.options.reconnect) return

    const attempts = this.state.get('reconnectAttempts') || 0
    const max = this.options.maxReconnectAttempts || 10

    if (attempts >= max) return

    const baseInterval = this.options.reconnectInterval || 1000
    const delay = baseInterval * Math.pow(1.5, attempts)
    const nextAttempt = attempts + 1

    this.setState({ reconnectAttempts: nextAttempt })
    this.emit('reconnecting', nextAttempt)

    this._reconnectTimer = setTimeout(() => {
      this.connect(url).catch(() => {
        // Reconnect failure handled by connect's onclose
      })
    }, delay)
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

  private clearReconnectTimer(): void {
    if (this._reconnectTimer) {
      clearTimeout(this._reconnectTimer)
      this._reconnectTimer = undefined
    }
  }
}

export default features.register('containerLink', ContainerLink)
