import express from 'express'
import type { Express } from 'express'
import cors from 'cors'
import { z } from 'zod'
import { ServerStateSchema, ServerOptionsSchema } from '../schemas/base.js'
import { type StartOptions, Server, type ServerState } from '../server.js'
import { Endpoint, type EndpointModule, warnUnknownExports } from '../endpoint.js'

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

/**
 * Express.js HTTP server with automatic endpoint mounting, CORS, and SPA history fallback.
 *
 * Wraps an Express application with convention-based endpoint discovery. Endpoints
 * defined as modules are automatically mounted as routes. Supports static file serving,
 * CORS configuration, and single-page app history fallback out of the box.
 *
 * @extends Server
 *
 * @example
 * ```typescript
 * const server = container.server('express', { cors: true, static: './public' })
 * await server.start({ port: 3000 })
 *
 * // Mount endpoints programmatically
 * server.mount(myEndpoint)
 *
 * // Access the underlying Express app
 * server.app.get('/health', (req, res) => res.json({ ok: true }))
 * ```
 */
export class ExpressServer<T extends ServerState = ServerState, K extends ExpressServerOptions = ExpressServerOptions> extends Server<T,K> {
    static override shortcut = 'servers.express' as const
    static override stateSchema = ServerStateSchema
    static override optionsSchema = ExpressServerOptionsSchema

    static { Server.register(this, 'express') }
  
    _app?: Express
    _listener?: any
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
      this._app = this.hooks.create(app, server) || app

      return app
    }
  
    /**
     * Start the Express HTTP server. A runtime `port` overrides the constructor
     * option and is written to state so `server.port` always reflects reality.
     *
     * @param options - Optional runtime overrides for port and host
     */
    override async start(options?: StartOptions) {
      if (this.isListening) {
        return this
      }

      // Apply runtime port to state so this.port reflects the override
      if (options?.port) {
        this.state.set('port', options.port)
      }

      const startOptions = {
        port: this.port,
        host: options?.host || this.options.host || '0.0.0.0',
      }

      // @ts-ignore-next-line
      await this.hooks.beforeStart(startOptions, this)

      // SPA history fallback: serve index.html for unmatched GET routes
      if (this.options.historyFallback && this.options.static) {
        const indexPath = `${this.options.static}/index.html`
        this.app.get('*', (_req: any, res: any) => {
          res.sendFile(indexPath)
        })
      }

      await new Promise((res) => {
        this._listener = this.app.listen(startOptions.port, startOptions.host, () => {
          this.state.set('listening', true)
          res(null)
        })
      })

      return this
    }

    override async stop() {
      if (this.isStopped) {
        return this
      }

      await Promise.race([
        new Promise<void>((resolve) => {
          if (!this._listener) {
            resolve()
            return
          }

          try {
            this._listener.close(() => {
              this._listener = undefined
              resolve()
            })
          } catch {
            this._listener = undefined
            resolve()
          }
        }),
        new Promise<void>((resolve) => setTimeout(resolve, 500)),
      ])

      this.state.set('listening', false)
      this.state.set('stopped', true)
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
      const { Glob } = globalThis.Bun || (await import('bun'))
      const glob = new Glob('**/*.ts')

      // Use the helpers feature's VM-aware loader so endpoints can resolve
      // packages like zod and @soederpop/luca even from the compiled binary
      const helpers = this.container.feature('helpers') as any

      for await (const file of glob.scan({ cwd: dir, absolute: true })) {
        try {
          const mod = await helpers.loadModuleExports(file)
          const endpointModule: EndpointModule = mod.default || mod

          if (!endpointModule.path) {
            continue
          }

          warnUnknownExports(mod, file)

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

    async useEndpointModules(modules: EndpointModule[]): Promise<this> {
      for (const mod of modules) {
        try {
          const endpointModule: EndpointModule = (mod as any).default || mod

          if (!endpointModule.path) {
            continue
          }

          const endpoint = new Endpoint(
            { path: endpointModule.path },
            this.container.context
          )
          await endpoint.load(endpointModule)
          this.useEndpoint(endpoint)
        } catch (err) {
          console.error(`Failed to load endpoint module (${(mod as any).path || 'unknown'}):`, err)
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

export default ExpressServer
