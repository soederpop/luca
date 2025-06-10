import type { NodeContainer } from '../node/container.js'
import express from 'express'
import type { Express } from 'express'
import cors from 'cors'
import { servers, type StartOptions, Server, type ServersInterface, type ServerState, type ServerOptions } from '../server/server.js';

declare module '../server/index' {
  interface AvailableServers {
    express: typeof ExpressServer 
  }
}

export interface ExpressServerOptions extends ServerOptions {
  cors?: boolean;
  static?: string;
  create?: (app: Express, server: Server) => Express
  beforeStart?: (options: StartOptions, server: Server) => Promise<any>
}

const defaultCreate = (app: Express, server: Server) => app

export class ExpressServer<T extends ServerState = ServerState, K extends ExpressServerOptions = ExpressServerOptions> extends Server<T,K> {
    static override shortcut = 'servers.express' as const
    
    static override attach(container: NodeContainer & ServersInterface) {
      return container
    }
  
    _app?: Express
 
    get express() {
      return express
    }

    get hooks() {
      const { create = defaultCreate, beforeStart = () => {} } = this.options  
      
      return {
        create,
        beforeStart
      }
    }

    get app() {
      if(this._app) {
        return this._app
      }
      
      const app = express()
      
      if (this.options.cors !== false) {
        app.use(cors())
      }
      
      app.use(express.json({ limit: "500mb" }))
      app.use(express.urlencoded({ extended: true, limit: "500mb", parameterLimit: 50000 }))
      
      if (this.options.static) {
        app.use(express.static(this.options.static))
      }
      
      // @ts-ignore-next-line
      const server : Server = this
      return this.hooks.create(app, server)
    }
  
    override async start(options?: StartOptions) {
      if (this.isListening) {
        return this
      }

      options = {
        port: this.options.port || 3000,
        host: this.options.host || '0.0.0.0',
        ...options || {}
      }

      // @ts-ignore-next-line
      await this.hooks.beforeStart(options, this)
      
      await new Promise((res) => {
        this.app.listen(options?.port!, options?.host!, () => {
          this.state.set('listening', true)
          res(null)
        })
      })
      
      return this
    }
    
    override async configure() {
      this.state.set('configured', true)
      return this
    }
}

servers.register('express', ExpressServer)

export default ExpressServer