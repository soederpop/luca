import { Helper } from "./helper.js";
import type { Container, ContainerContext } from "./container.js";
import { Registry } from "./registry.js";
import { z } from 'zod'
import {
  ClientStateSchema, ClientOptionsSchema, ClientEventsSchema,
} from './schemas/base.js'

export type ClientOptions = z.infer<typeof ClientOptionsSchema>
export type ClientState = z.infer<typeof ClientStateSchema>

// Schema values re-exported so `import { ClientStateSchema } from 'luca/client'`
// works alongside the classes (schemas/base has no dependency on this module).
export { ClientStateSchema, ClientOptionsSchema, ClientEventsSchema }

// Concrete client classes re-exported so `import { RestClient } from 'luca/client'`
// works as documented in the scaffold tutorials. These live in their own files:
//   ./clients/rest.ts, ./clients/graph.ts, ./clients/websocket.ts
// NOTE: those files import `Client` from this module, so these re-exports are
// circular — safe only because they sit at the bottom of this file (see below).
export type { WebSocketClientState, WebSocketClientOptions } from './clients/websocket.js'
export type { GraphClientOptions } from './clients/graph.js'

// AvailableClients is an open interface — subclasses augment it via `declare module`
export interface AvailableClients {}

export interface ClientsInterface {
  clients: ClientsRegistry;
  client<T extends keyof AvailableClients>(
    key: T,
    options?: ConstructorParameters<AvailableClients[T]>[0]
  ): InstanceType<AvailableClients[T]>;
}

/**
 * Base client class for all Luca network clients. Provides connection state
 * tracking, configuration, and the registry/factory infrastructure for
 * creating typed client instances via `container.client('rest')`.
 *
 * Subclasses should override `connect()` and add protocol-specific methods.
 * Register subclasses using `Client.register(this, 'myClient')` in a static block.
 */
export class Client<
  T extends ClientState = ClientState,
  K extends ClientOptions = ClientOptions
> extends Helper<T, K> {
  static override shortcut = "clients.base"
  static override stateSchema = ClientStateSchema
  static override optionsSchema = ClientOptionsSchema
  static override eventsSchema = ClientEventsSchema

  /** Self-register a Client subclass from a static initialization block. */
  static register: (SubClass: abstract new (options: any, context: any) => Client, id?: string) => abstract new (options: any, context: any) => Client

  static attach(container: Container & ClientsInterface): any {
    Object.assign(container, {
      get clients() {
        return clients;
      },

      client<T extends keyof AvailableClients>(
        id: T,
        options?: ConstructorParameters<AvailableClients[T]>[0]
      ): InstanceType<AvailableClients[T]> {
        const BaseClass = clients.lookup(
          id as keyof AvailableClients
        ) as AvailableClients[T];

        return container.createHelperInstance({
          cache: helperCache,
          type: 'client',
          id: String(id),
          BaseClass,
          options,
          fallbackName: String(id),
        }) as InstanceType<AvailableClients[T]>;
      },
    });

    container.registerHelperType('clients', 'client');

    return container;
  }

  constructor(options?: K, context?: ContainerContext) {
    if (typeof context !== "object") {
      throw new Error("Client must be instantiated with a context object");
    }

    super((options as K) || {}, context);

    this.state.set("connected", false);
  }

  /** The base URL for this client's connections/requests. */
  get baseURL() {
    return this.options.baseURL || ''
  }

  override get options() {
    return this._options as K;
  }

  /** Configure this client instance with additional options. */
  configure(options?: any): this {
    return this;
  }

  /** Whether the client is currently connected. */
  get isConnected() {
    return !!this.state.get("connected");
  }

  /** Establish a connection. Subclasses should override with protocol-specific logic. */
  async connect(): Promise<this> {
    this.state.set("connected", true);
    return this;
  }
}

// --- Registry and Client.register must be defined BEFORE subclasses ---
// because static blocks in subclass files run at class declaration time.

export class ClientsRegistry extends Registry<Client<any>> {
  override scope = "clients"
  override baseClass = Client
}

export const clients = new ClientsRegistry();

export const helperCache = new Map();

/**
 * Self-register a Client subclass from a static initialization block.
 * IMPORTANT: Place the static block AFTER all static override declarations
 * so schemas, envVars, and other metadata are set before interceptRegistration fires.
 *
 * @example
 * ```typescript
 * export class OpenAIClient extends Client {
 *   static override stateSchema = OpenAIClientStateSchema
 *   static override optionsSchema = OpenAIClientOptionsSchema
 *   static { Client.register(this, 'openai') }  // must come last
 * }
 * ```
 */
Client.register = function registerClient(
  SubClass: abstract new (options: any, context: any) => Client,
  id?: string,
) {
  const registryId = id ?? SubClass.name[0]!.toLowerCase() + SubClass.name.slice(1)

  // Auto-set shortcut if not explicitly overridden on this class
  if (!Object.getOwnPropertyDescriptor(SubClass, 'shortcut')?.value ||
      (SubClass as any).shortcut === 'unspecified' ||
      (SubClass as any).shortcut === 'clients.base') {
    ;(SubClass as any).shortcut = `clients.${registryId}` as const
  }

  // Register in the clients registry (interceptRegistration sees all statics above)
  clients.register(registryId, SubClass as any)

  // Generate default attach() if not explicitly overridden on this class
  if (!Object.getOwnPropertyDescriptor(SubClass, 'attach')) {
    ;(SubClass as any).attach = (container: any) => {
      clients.register(registryId, SubClass as any)
      return container
    }
  }

  return SubClass
}

// --- Concrete class re-exports -------------------------------------------
// The subclass files import `Client` from THIS module, so a static
// `export { RestClient } from './clients/rest.js'` would evaluate rest.ts
// before the Client class above is initialized (import hoisting) and crash
// with a TDZ ReferenceError. Instead we load them synchronously HERE, after
// Client and Client.register are fully defined — `require` is not hoisted,
// so the cycle resolves cleanly.
const restModule = require('./clients/rest.js') as typeof import('./clients/rest.js')
const graphModule = require('./clients/graph.js') as typeof import('./clients/graph.js')
const websocketModule = require('./clients/websocket.js') as typeof import('./clients/websocket.js')

/** HTTP REST client (axios-based). Re-exported so `import { RestClient } from 'luca/client'` works as documented. */
export const RestClient = restModule.RestClient
/** GraphQL client. Re-exported so `import { GraphClient } from 'luca/client'` works as documented. */
export const GraphClient = graphModule.GraphClient
/** WebSocket client. Re-exported so `import { WebSocketClient } from 'luca/client'` works as documented. */
export const WebSocketClient = websocketModule.WebSocketClient

export default Client;
