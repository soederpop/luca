import { Helper } from "./helper.js";
import type { Container, ContainerContext } from "./container.js";
import axios, { type AxiosError, type AxiosInstance, type AxiosRequestConfig } from "axios";
import { Registry } from "./registry.js";
import { z } from 'zod'
import {
  ClientStateSchema, ClientOptionsSchema, ClientEventsSchema,
  WebSocketClientStateSchema, WebSocketClientOptionsSchema, WebSocketClientEventsSchema,
  GraphClientOptionsSchema, GraphClientEventsSchema,
} from './schemas/base.js'

export type ClientOptions = z.infer<typeof ClientOptionsSchema>
export type ClientState = z.infer<typeof ClientStateSchema>
export type WebSocketClientState = z.infer<typeof WebSocketClientStateSchema>
export type WebSocketClientOptions = z.infer<typeof WebSocketClientOptionsSchema>
export type GraphClientOptions = z.infer<typeof GraphClientOptionsSchema>

export interface AvailableClients {
  rest: typeof RestClient;
  graph: typeof GraphClient;
  websocket: typeof WebSocketClient;
}

export interface ClientsInterface {
  clients: ClientsRegistry;
  client<T extends keyof AvailableClients>(
    key: T,
    options?: ConstructorParameters<AvailableClients[T]>[0]
  ): InstanceType<AvailableClients[T]>;
}

export class Client<
  T extends ClientState = ClientState,
  K extends ClientOptions = ClientOptions
> extends Helper<T, K> {
  static override shortcut = "clients.base"
  static override stateSchema = ClientStateSchema
  static override optionsSchema = ClientOptionsSchema
  static override eventsSchema = ClientEventsSchema

  /** Self-register a Client subclass from a static initialization block. */
  static register: (SubClass: typeof Client, id?: string) => typeof Client

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

  get baseURL() {
    return this.options.baseURL || ''
  }

  override get options() {
    return this._options as K;
  }

  configure(options?: any): this {
    return this;
  }

  get isConnected() {
    return !!this.state.get("connected");
  }

  async connect(): Promise<this> {
    this.state.set("connected", true);
    return this;
  }
}

// --- Registry and Client.register must be defined BEFORE subclasses ---
// because static blocks in RestClient/GraphClient/WebSocketClient run at class declaration time.

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
  SubClass: typeof Client,
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

// --- Built-in client subclasses ---

export class RestClient<
  T extends ClientState = ClientState,
  K extends ClientOptions = ClientOptions
> extends Client<T, K> {
  axios!: AxiosInstance;

  static override shortcut: string = "clients.rest"
  static { Client.register(this, 'rest') }

  constructor(options: K, context: ContainerContext) {
    super(options, context);

    this.axios = axios.create({
      baseURL: this.baseURL,
    });

    if (this.useJSON) {
      this.axios.defaults.headers.common = {
        ...this.axios.defaults.headers.common,
        "Content-Type": "application/json",
        Accept: "application/json",
      }
    }
  }

  async beforeRequest() {
  }

  get useJSON() {
    return !!this.options.json
  }

  override get baseURL() {
    return this.options.baseURL || '/'
  }

  async patch(url: string, data: any = {}, options: AxiosRequestConfig = {}) {
    await this.beforeRequest();
    return this.axios({
      ...options,
      method: "PATCH",
      url,
      data,
    })
      .then((r) => r.data)
      .catch((e: any) => {
        if (e.isAxiosError) {
          return this.handleError(e);
        } else {
          throw e;
        }
      });
  }

  async put(url: string, data: any = {}, options: AxiosRequestConfig = {}) {
    await this.beforeRequest();
    return this.axios({
      ...options,
      method: "PUT",
      url,
      data,
    })
      .then((r) => r.data)
      .catch((e: any) => {
        if (e.isAxiosError) {
          return this.handleError(e);
        } else {
          throw e;
        }
      });
  }

  async post(url: string, data: any = {}, options: AxiosRequestConfig = {}) {
    await this.beforeRequest();
    return this.axios({
      ...options,
      method: "POST",
      url,
      data,
    })
      .then((r) => r.data)
      .catch((e: any) => {
        if (e.isAxiosError) {
          return this.handleError(e);
        } else {
          throw e;
        }
      });
  }

  async delete(url: string, params: any = {}, options: AxiosRequestConfig = {}) {
    await this.beforeRequest();
    return this.axios({
      ...options,
      method: "DELETE",
      url,
      params,
    })
      .then((r) => r.data)
      .catch((e: any) => {
        if (e.isAxiosError) {
          return this.handleError(e);
        } else {
          throw e;
        }
      });
  }


  async get(url: string, params: any = {}, options: AxiosRequestConfig = {}) {
    await this.beforeRequest()
    return this.axios({
      ...options,
      method: "GET",
      url,
      params,
    })
      .then((r) => r.data)
      .catch((e: any) => {
        if (e.isAxiosError) {
          return this.handleError(e);
        } else {
          throw e;
        }
      });
  }

  async handleError(error: AxiosError) {
    this.emit('failure', error)
    return error.toJSON();
  }
}

/**
 * GraphQL client that wraps RestClient with convenience methods for executing
 * queries and mutations. Automatically handles the GraphQL request envelope
 * (query/variables/operationName) and unwraps responses, extracting the `data`
 * field and emitting events for GraphQL-level errors.
 */
export class GraphClient<
  T extends ClientState = ClientState,
  K extends GraphClientOptions = GraphClientOptions
> extends RestClient<T, K> {
  static override shortcut = "clients.graph" as const
  static override optionsSchema = GraphClientOptionsSchema
  static override eventsSchema = GraphClientEventsSchema
  static { Client.register(this, 'graph') }

  /** The GraphQL endpoint path. Defaults to '/graphql'. */
  get endpoint() {
    return (this.options as GraphClientOptions).endpoint || '/graphql'
  }

  /**
   * Execute a GraphQL query and return the unwrapped data.
   * @param query - The GraphQL query string
   * @param variables - Optional variables for the query
   * @param operationName - Optional operation name when the query contains multiple operations
   */
  async query<R = any>(query: string, variables?: Record<string, any>, operationName?: string): Promise<R> {
    return this.execute<R>(query, variables, operationName)
  }

  /**
   * Execute a GraphQL mutation and return the unwrapped data.
   * Semantically identical to query() but named for clarity when performing mutations.
   * @param mutation - The GraphQL mutation string
   * @param variables - Optional variables for the mutation
   * @param operationName - Optional operation name when the mutation contains multiple operations
   */
  async mutate<R = any>(mutation: string, variables?: Record<string, any>, operationName?: string): Promise<R> {
    return this.execute<R>(mutation, variables, operationName)
  }

  /**
   * Execute a GraphQL operation, unwrap the response, and handle errors.
   * Posts to the configured endpoint with the standard GraphQL envelope.
   * If the response contains GraphQL-level errors, emits both 'graphqlError'
   * and 'failure' events before returning the data.
   */
  private async execute<R = any>(query: string, variables?: Record<string, any>, operationName?: string): Promise<R> {
    const body: Record<string, any> = { query }
    if (variables) body.variables = variables
    if (operationName) body.operationName = operationName

    const response = await this.post(this.endpoint, body)

    if (response?.errors?.length) {
      this.emit('graphqlError', response.errors)
      this.emit('failure', response.errors)
    }

    return response?.data as R
  }
}

/**
 * WebSocket client that bridges raw WebSocket events to Luca's Helper event bus,
 * providing a clean interface for sending/receiving messages, tracking connection
 * state, and optional auto-reconnection with exponential backoff.
 *
 * Events emitted:
 * - `open` — connection established
 * - `message` — message received (JSON-parsed when possible)
 * - `close` — connection closed (with code and reason)
 * - `error` — connection error
 * - `reconnecting` — attempting reconnection (with attempt number)
 */
export class WebSocketClient<
  T extends WebSocketClientState = WebSocketClientState,
  K extends WebSocketClientOptions = WebSocketClientOptions
> extends Client<T, K> {
  ws!: WebSocket
  _intentionalClose: boolean

  static override shortcut = "clients.websocket" as const
  static override stateSchema = WebSocketClientStateSchema
  static override optionsSchema = WebSocketClientOptionsSchema
  static override eventsSchema = WebSocketClientEventsSchema
  static { Client.register(this, 'websocket') }

  constructor(options?: K, context?: ContainerContext) {
    super(options, context)
    this._intentionalClose = false
  }

  override get initialState(): T {
    return {
      connected: false,
      reconnectAttempts: 0,
    } as T
  }

  /**
   * Establish a WebSocket connection to the configured baseURL.
   * Wires all raw WebSocket events (open, message, close, error) to the
   * Helper event bus and updates connection state accordingly.
   * Resolves once the connection is open; rejects on error.
   */
  override async connect(): Promise<this> {
    if (this.isConnected) {
      return this
    }

    const ws = this.ws = new WebSocket(this.baseURL)
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
          data = JSON.parse(data)
        } catch {}
        this.emit('message', data)
      }

      ws.onclose = (event: any) => {
        state.set('connected', false)
        this.emit('close', event?.code, event?.reason)
        if (!this._intentionalClose) {
          this.maybeReconnect()
        }
        this._intentionalClose = false
      }
    })

    return this
  }

  /**
   * Send data over the WebSocket connection. Automatically JSON-serializes
   * the payload. If not currently connected, attempts to connect first.
   * @param data - The data to send (will be JSON.stringify'd)
   */
  async send(data: any): Promise<void> {
    if (!this.isConnected) {
      await this.connect()
    }

    if (!this.ws) {
      throw new Error('WebSocket instance not available')
    }

    this.ws.send(JSON.stringify(data))
  }

  /**
   * Gracefully close the WebSocket connection. Suppresses auto-reconnect
   * and updates connection state to disconnected.
   */
  async disconnect(): Promise<this> {
    this._intentionalClose = true
    if (this.ws) {
      this.ws.close()
    }
    ;(this.state as any).set('connected', false)
    return this
  }

  /** Whether the client is in an error state. */
  get hasError() {
    return !!(this.state as any).get('connectionError')
  }

  /**
   * Attempt to reconnect if the reconnect option is enabled and we haven't
   * exceeded maxReconnectAttempts. Uses exponential backoff capped at 30s.
   */
  private maybeReconnect() {
    const opts = this.options as WebSocketClientOptions
    if (!opts.reconnect) return

    const state = this.state as any
    const maxAttempts = opts.maxReconnectAttempts ?? Infinity
    const baseInterval = opts.reconnectInterval ?? 1000
    const attempts = ((state.get('reconnectAttempts') as number) ?? 0) + 1

    if (attempts > maxAttempts) return

    state.set('reconnectAttempts', attempts)
    this.emit('reconnecting', attempts)

    const delay = Math.min(baseInterval * Math.pow(2, attempts - 1), 30000)
    setTimeout(() => {
      this.connect().catch(() => {})
    }, delay)
  }
}

export default Client;
