import type { NodeContainer } from '../node/container.js'
import express from 'express'
import type { Express } from 'express'
import cors from 'cors'
import { z } from 'zod'
import { ServerStateSchema, ServerOptionsSchema } from '../schemas/base.js'
import { servers, type StartOptions, Server, type ServersInterface, type ServerState } from '../server.js'
import { Endpoint, type EndpointModule } from '../endpoint.js'

declare module '../server' {
  interface AvailableServers {
    express: typeof ExpressServer
  }
}

export const ExpressServerOptionsSchema = ServerOptionsSchema.extend({
  cors: z.boolean().optional().describe('Whether to enable CORS middleware'),
  static: z.string().optional().describe('Path to serve static files from'),
  historyFallback: z.boolean().optional().describe('Serve index.html for unmatched routes (SPA history fallback)'),
  create: z.any().optional().describe('(app: Express, server: Server) => Express'),
  beforeStart: z.any().optional().describe('(options: StartOptions, server: Server) => Promise<any>'),
})
export type ExpressServerOptions = z.infer<typeof ExpressServerOptionsSchema>

const defaultCreate = (app: Express, server: Server) => app

export class ExpressServer<T extends ServerState = ServerState, K extends ExpressServerOptions = ExpressServerOptions> extends Server<T,K> {
    static override shortcut = 'servers.express' as const
    static override stateSchema = ServerStateSchema
    static override optionsSchema = ExpressServerOptionsSchema
    
    static override attach(container: NodeContainer & ServersInterface) {
      return container
    }
  
    _app?: Express
    _mountedEndpoints: Endpoint[] = []

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
      this.hooks.create(app, server)

      this._app = this.hooks.create(app, server) || app

      return app
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

      // SPA history fallback: serve index.html for unmatched GET routes
      if (this.options.historyFallback && this.options.static) {
        const indexPath = `${this.options.static}/index.html`
        this.app.get('*', (_req: any, res: any) => {
          res.sendFile(indexPath)
        })
      }

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

    useEndpoint(endpoint: Endpoint): this {
      endpoint.mount(this.app)
      this._mountedEndpoints.push(endpoint)
      return this
    }

    async useEndpoints(dir: string): Promise<this> {
      const glob = new Bun.Glob('**/*.ts')

      for await (const file of glob.scan({ cwd: dir, absolute: true })) {
        try {
          const mod = await import(file)
          const endpointModule: EndpointModule = mod.default || mod

          if (!endpointModule.path) {
            continue
          }

          const endpoint = new Endpoint(
            { path: endpointModule.path, filePath: file },
            this.container.context
          )
          await endpoint.load(endpointModule)
          this.useEndpoint(endpoint)
        } catch (err) {
          console.error(`Failed to load endpoint from ${file}:`, err)
        }
      }

      return this
    }

    serveOpenAPISpec(options: { title?: string; version?: string; description?: string } = {}): this {
      const server = this
      this.app.get('/openapi.json', (_req: any, res: any) => {
        res.json(server.generateOpenAPISpec(options))
      })
      return this
    }

    generateOpenAPISpec(options: { title?: string; version?: string; description?: string } = {}): Record<string, any> {
      const paths: Record<string, any> = {}

      for (const ep of this._mountedEndpoints) {
        paths[ep.path] = ep.toOpenAPIPathItem()
      }

      return {
        openapi: '3.1.0',
        info: {
          title: options.title || 'Luca API',
          version: options.version || '1.0.0',
          description: options.description || 'Auto-generated from Luca endpoints',
        },
        servers: [{ url: `http://localhost:${this.port}` }],
        paths,
      }
    }
}

servers.register('express', ExpressServer)

export default ExpressServer