import Websocket from 'isomorphic-ws'
import { Client, clients } from '../../client'
import { z } from 'zod'
import { ClientStateSchema, ClientOptionsSchema } from '../../schemas/base.js'

declare module '../../client' {
  interface AvailableClients {
    websocket: typeof SocketClient
  }
}

export const SocketStateSchema = ClientStateSchema.extend({
  connectionError: z.any().optional(),
})

export const SocketOptionsSchema = ClientOptionsSchema.extend({
  reconnect: z.boolean().optional(),
})

export type SocketState = z.infer<typeof SocketStateSchema>
export type SocketOptions = z.infer<typeof SocketOptionsSchema>

export class SocketClient<T extends SocketState = SocketState, K extends SocketOptions = SocketOptions> extends Client<T,K> {
  ws?: Websocket

  static override shortcut = 'clients.websocket' as const
  
  static override attach(...args: any[]) {
    clients.register('websocket', SocketClient)
  }

  override afterInitialize(): void {
    const { reconnect } = this.options

    this.on('close', () => {
      if(reconnect) {
        this.connect()
      }  
    })
  }

  async send(data: any) {
    if(!this.isConnected && !this.hasError) {
      await this.connect() 
    }
    
    if(typeof this.ws === 'undefined') {
      throw new Error(`Missing websocket instance`)
    }
    
    this.ws.send(JSON.stringify({
      id: this.container.utils.uuid(),
      data
    }))
  }

  get hasError() {
    return !!this.state.get('connectionError')
  }

  override async connect() {
    if(this.isConnected) {
      return this
    }
    
    const ws = this.ws = new Websocket(this.options.baseURL!)

    await new Promise((res,rej) => {
      ws.onopen = res  
      ws.onerror = rej

      ws.onmessage = (data: any) => {
        this.emit('message', data)
      }

      ws.onclose = () => {
        this.emit('close')
        this.state.set('connected', false)
      }
    }).catch((error) => {
      this.state.set('connectionError', error)
      throw error
    })

    return this  
  }
}

export default clients.register('websocket', SocketClient)