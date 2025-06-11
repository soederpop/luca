import { Helper, type HelperOptions, type HelperState } from "./helper.js";
import type { Container, ContainerContext } from "./container.js";
import axios, { type AxiosError, type AxiosInstance, type AxiosRequestConfig } from "axios";
import { Registry } from "./registry.js";

export interface ClientOptions extends HelperOptions {
  baseURL?: string;
  json?: boolean;
}

export interface AvailableClients {
  rest: typeof RestClient;
  graph: typeof GraphClient;
}

export interface ClientState extends HelperState {
  connected: boolean;
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

  static attach(container: Container & ClientsInterface): any {
    return Object.assign(container, {
      get clients() {
        return clients;
      },

      client<T extends keyof AvailableClients>(
        id: T,
        options?: ConstructorParameters<AvailableClients[T]>[0]
      ): InstanceType<AvailableClients[T]> {
        const { hashObject } = container.utils;
        const BaseClass = clients.lookup(
          id as keyof AvailableClients
        ) as AvailableClients[T];

        const cacheKey = hashObject({
          __type: "client",
          id,
          options,
          uuid: container.uuid,
        });
        const cached = helperCache.get(cacheKey);

        if (cached) {
          return cached as InstanceType<AvailableClients[T]>;
        }

        const helperOptions = (options || {}) as ConstructorParameters<
          AvailableClients[T]
        >[0];

        const instance = new (BaseClass as any)(helperOptions, container.context) as InstanceType<AvailableClients[T]>;

        helperCache.set(cacheKey, instance);

        return instance;
      },
    });
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

export class RestClient<
  T extends ClientState = ClientState,
  K extends ClientOptions = ClientOptions
> extends Client<T, K> {
  axios!: AxiosInstance;

  static override shortcut = "clients.rest" as const

  static override attach(container: Container & ClientsInterface): any {
    return container
  }

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

export class GraphClient<
  T extends ClientState = ClientState,
  K extends ClientOptions = ClientOptions
> extends Client<T, K> {
  static override shortcut = "clients.graph" as const
}

/** 
 * The Websocket Client accepts a websocket URL as its baseURL and establishes a connection to it, 
*/
export class WebSocketClient<
  T extends ClientState = ClientState,
  K extends ClientOptions = ClientOptions
> extends Client<T, K> {
  ws!: WebSocket

  static override shortcut = "clients.websocket" as const

  override async connect() {
    this.ws = new WebSocket(this.baseURL)
    return this
  }
}


export class ClientsRegistry extends Registry<Client<any>> {
  override scope = "clients"
}

export const clients = new ClientsRegistry();

clients.register("rest", RestClient);
clients.register("graph", GraphClient);
clients.register("websocket", WebSocketClient);

// Register OpenAI client
import("./ai/openai-client.js").then(({ OpenAIClient }) => {
  clients.register("openai", OpenAIClient);
});

export const helperCache = new Map();

export default Client;
