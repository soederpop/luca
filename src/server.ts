import type { NodeContainer } from './node/container.js'
import { Helper } from './helper.js'
import { Registry } from './registry.js'
import { z } from 'zod'
import { ServerStateSchema, ServerOptionsSchema, ServerEventsSchema } from './schemas/base.js'

export type ServerState = z.infer<typeof ServerStateSchema>
export type ServerOptions = z.infer<typeof ServerOptionsSchema>

export type StartOptions = {
  port?: number;
  host?: string;
}

export type ServerFactory = <T extends keyof AvailableServers>(
      key: T,
      options?: ConstructorParameters<AvailableServers[T]>[0]
) => NonNullable<InstanceType<AvailableServers[T]>>

export interface ServersInterface {
  servers: ServersRegistry;
  server: ServerFactory
}

export interface AvailableServers {}

export class Server<T extends ServerState = ServerState, K extends ServerOptions = ServerOptions> extends Helper<T, K> {
    static override stateSchema = ServerStateSchema
    static override optionsSchema = ServerOptionsSchema
    static override eventsSchema = ServerEventsSchema

    override get initialState() : T {
      return ({
        port: this.options.port || 3000,
        listening: false,
        configured: false,
        stopped: false
      } as unknown) as T
    }

    override get options() : K {
      return {
        port: 3000,
        host: '0.0.0.0',
        ...this._options,
      }
    }

    static attach(container: NodeContainer & ServersInterface) {
      container.servers = servers

      Object.assign(container, {
        server<T extends keyof AvailableServers>(
          id: T,
          options?: ConstructorParameters<AvailableServers[T]>[0]
        ): NonNullable<InstanceType<AvailableServers[T]>> {
          const { hashObject } = container.utils
          const BaseClass = servers.lookup(id) as AvailableServers[T]

          const cacheKey = hashObject({ __type: "server", id, options, uuid: container.uuid })
          const cached = helperCache.get(cacheKey)

          if (cached) {
            return cached as NonNullable<InstanceType<AvailableServers[T]>>
          }

          const helperOptions = options as ConstructorParameters<AvailableServers[T]>[0]

          const instance = new (BaseClass as any)(helperOptions, container.context) as NonNullable<InstanceType<
            AvailableServers[T]
          >>

          helperCache.set(cacheKey, instance)

          return instance
        }
      })

      container.registerHelperType('servers', 'server')

      return container
    }

    override get container() : NodeContainer {
        return super.container as NodeContainer
    }

    get isListening() {
      return !!this.state.get('listening')
    }

    get isConfigured() {
      return !!this.state.get('configured')
    }

    get isStopped() {
      return !!this.state.get('stopped')
    }

    get port() {
      return this.state.get('port') || this.options.port || 3000
    }

    async stop() {
      if(this.isStopped) {
        return this
      }

      this.state.set('stopped', true)

      return this
    }

    async start(options?: StartOptions) {
      if(this.isListening) {
        return this
      }

      this.state.set('listening', true)

      return this
    }

    async configure() {
      const port = await this.container.networking.findOpenPort(this.port)

      if(port !== this.port) {
        this.state.set('port', port)
      }

      this.state.set('configured', true)

      return this
    }
}

export class ServersRegistry extends Registry<Server<any>> {
  override scope = "servers"
  override baseClass = Server
}

export const servers = new ServersRegistry()

export const helperCache = new Map()
