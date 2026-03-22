import Websocket from 'isomorphic-ws'
import { Client } from '../../client'
import { WebSocketClient, type WebSocketClientState, type WebSocketClientOptions } from '../../clients/websocket'
import { WebSocketClientEventsSchema } from '../../schemas/base.js'

/**
 * Web-specific WebSocket client implementation using isomorphic-ws.
 * Extends the base WebSocketClient with platform-specific transport and
 * an envelope format that wraps sent data with a unique ID.
 */
export class SocketClient<T extends WebSocketClientState = WebSocketClientState, K extends WebSocketClientOptions = WebSocketClientOptions> extends WebSocketClient<T,K> {
  // @ts-expect-error widening ws type for isomorphic-ws compatibility
  declare ws: Websocket | WebSocket

  static override shortcut = 'clients.websocket' as const
  static override eventsSchema = WebSocketClientEventsSchema

  static { Client.register(this, 'websocket') }

  /**
   * Send data over the WebSocket with an ID envelope.
   * Wraps the payload in { id, data } before JSON serialization.
   * Messages with a `requestId` or `replyTo` are sent as-is to
   * preserve the ask/reply protocol.
   */
  override async send(data: any) {
    if(!this.isConnected && !this.hasError) {
      await this.connect()
    }

    if(typeof this.ws === 'undefined') {
      throw new Error(`Missing websocket instance`)
    }

    // Protocol messages (ask/reply) bypass the envelope
    if (data && (data.requestId || data.replyTo)) {
      this.ws.send(JSON.stringify(data))
    } else {
      this.ws.send(JSON.stringify({
        id: this.container.utils.uuid(),
        data
      }))
    }
  }

  /**
   * Establish a WebSocket connection using isomorphic-ws.
   * Bridges raw WebSocket events to the Helper event bus and tracks connection state.
   */
  override async connect() {
    if(this.isConnected) {
      return this
    }

    const ws = this.ws = new Websocket(this.options.baseURL!)
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
          data = JSON.parse(typeof data === 'string' ? data : data.toString())
        } catch {}
        if (!this._handleReply(data)) {
          this.emit('message', data)
        }
      }

      ws.onclose = (event: any) => {
        state.set('connected', false)
        this.emit('close', event?.code, event?.reason)
      }
    }).catch((error) => {
      state.set('connectionError', error)
      throw error
    })

    return this
  }
}

export default SocketClient