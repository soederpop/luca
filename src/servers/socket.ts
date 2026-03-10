import { z } from 'zod'
import { ServerStateSchema, ServerOptionsSchema } from '../schemas/base.js'
import { type StartOptions, Server, type ServerState } from '../server.js';
import { WebSocketServer as BaseServer } from 'ws'

declare module '../server' {
  interface AvailableServers {
    websocket: typeof WebsocketServer
  }
}

export const SocketServerOptionsSchema = ServerOptionsSchema.extend({
  json: z.boolean().optional().describe('Whether to automatically JSON parse/stringify messages'),
})
export type SocketServerOptions = z.infer<typeof SocketServerOptionsSchema>

export class WebsocketServer<T extends ServerState = ServerState, K extends SocketServerOptions = SocketServerOptions> extends Server<T,K> {
    static override shortcut = 'servers.websocket' as const
    static override stateSchema = ServerStateSchema
    static override optionsSchema = SocketServerOptionsSchema

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

    override async start(options?: StartOptions) {
      if(!this.isConfigured) {
        await this.configure()
      }
      
      const { wss } = this
      
      wss.on('connection', (ws) => {
        this.connections.add(ws)
        this.emit('connection', ws)
        
        ws.on('message', (data) => {
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
    
    override get port() {
      return this.state.get('port') || this.options.port || 8081 
    }
}

export default WebsocketServer
