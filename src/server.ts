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

    /** Self-register a Server subclass from a static initialization block. */
    static register: (SubClass: typeof Server, id?: string) => typeof Server

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
          const BaseClass = servers.lookup(id) as AvailableServers[T]

          return container.createHelperInstance({
            cache: helperCache,
            type: 'server',
            id: String(id),
            BaseClass,
            options,
            fallbackName: String(id),
          }) as NonNullable<InstanceType<AvailableServers[T]>>
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

    /** The port this server will bind to. Reads from state first (set by start() or configure()), then constructor options, then defaults to 3000. */
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

    /**
     * Start the server. Runtime options override constructor options and update state
     * so that `server.port` always reflects the actual listening port.
     *
     * @param options - Optional runtime overrides for port and host
     */
    async start(options?: StartOptions) {
      if(this.isListening) {
        return this
      }

      if (options?.port) {
        this.state.set('port', options.port)
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

/**
 * Self-register a Server subclass from a static initialization block.
 * IMPORTANT: Place the static block AFTER all static override declarations
 * so schemas, envVars, and other metadata are set before interceptRegistration fires.
 *
 * @example
 * ```typescript
 * export class ExpressServer extends Server {
 *   static override stateSchema = ServerStateSchema
 *   static override optionsSchema = ExpressServerOptionsSchema
 *   static { Server.register(this, 'express') }  // must come last
 * }
 * ```
 */
Server.register = function registerServer(
  SubClass: typeof Server,
  id?: string,
) {
  const registryId = id ?? SubClass.name[0]!.toLowerCase() + SubClass.name.slice(1)

  // Auto-set shortcut if not explicitly overridden on this class
  if (!Object.getOwnPropertyDescriptor(SubClass, 'shortcut')?.value ||
      (SubClass as any).shortcut === 'unspecified') {
    ;(SubClass as any).shortcut = `servers.${registryId}` as const
  }

  // Register in the servers registry (interceptRegistration sees all statics above)
  servers.register(registryId, SubClass as any)

  // Generate default attach() if not explicitly overridden on this class
  if (!Object.getOwnPropertyDescriptor(SubClass, 'attach')) {
    ;(SubClass as any).attach = (container: any) => {
      servers.register(registryId, SubClass as any)
      return container
    }
  }

  return SubClass
}
