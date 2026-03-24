import axios, { type AxiosError, type AxiosInstance, type AxiosRequestConfig } from "axios";
import { Client, type ClientOptions, type ClientState } from '../client.js'
import type { ContainerContext } from '../container.js'
import { ClientEventsSchema } from '../schemas/base.js'
import { z } from 'zod'

export const RestClientEventsSchema = ClientEventsSchema.extend({}).describe('REST client events')

declare module '../client' {
  interface AvailableClients {
    rest: typeof RestClient
  }
}

/**
 * HTTP REST client built on top of axios. Provides convenience methods for
 * GET, POST, PUT, PATCH, and DELETE requests with automatic JSON handling,
 * configurable base URL, and error event emission.
 *
 * @example
 * ```typescript
 * const api = container.client('rest', { baseURL: 'https://api.example.com', json: true })
 * const users = await api.get('/users')
 * await api.post('/users', { name: 'Alice' })
 * ```
 */
export class RestClient<
  T extends ClientState = ClientState,
  K extends ClientOptions = ClientOptions
> extends Client<T, K> {
  axios!: AxiosInstance;

  static override shortcut: string = "clients.rest"
  static override eventsSchema = RestClientEventsSchema
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

  async beforeRequest(): Promise<void> {
  }

  /** Whether JSON content-type headers should be set automatically. */
  get useJSON() {
    return !!this.options.json
  }

  override get baseURL() {
    return this.options.baseURL || '/'
  }

  /**
   * Send a PATCH request. Returns the parsed response body directly (not an
   * axios Response wrapper). On HTTP errors, returns the error as JSON instead
   * of throwing.
   * @param url - Request path relative to baseURL
   * @param data - Request body
   * @param options - Additional axios request config
   * @returns Parsed response body
   */
  async patch(url: string, data: any = {}, options: AxiosRequestConfig = {}): Promise<any> {
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

  /**
   * Send a PUT request. Returns the parsed response body directly (not an
   * axios Response wrapper). On HTTP errors, returns the error as JSON instead
   * of throwing.
   * @param url - Request path relative to baseURL
   * @param data - Request body
   * @param options - Additional axios request config
   * @returns Parsed response body
   */
  async put(url: string, data: any = {}, options: AxiosRequestConfig = {}): Promise<any> {
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

  /**
   * Send a POST request. Returns the parsed response body directly (not an
   * axios Response wrapper). On HTTP errors, returns the error as JSON instead
   * of throwing.
   * @param url - Request path relative to baseURL
   * @param data - Request body
   * @param options - Additional axios request config
   * @returns Parsed response body
   */
  async post(url: string, data: any = {}, options: AxiosRequestConfig = {}): Promise<any> {
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

  /**
   * Send a DELETE request. Returns the parsed response body directly (not an
   * axios Response wrapper). On HTTP errors, returns the error as JSON instead
   * of throwing.
   * @param url - Request path relative to baseURL
   * @param params - Query parameters
   * @param options - Additional axios request config
   * @returns Parsed response body
   */
  async delete(url: string, params: any = {}, options: AxiosRequestConfig = {}): Promise<any> {
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

  /**
   * Send a GET request. Returns the parsed response body directly (not an
   * axios Response wrapper). On HTTP errors, returns the error as JSON instead
   * of throwing.
   * @param url - Request path relative to baseURL
   * @param params - Query parameters
   * @param options - Additional axios request config
   * @returns Parsed response body
   */
  async get(url: string, params: any = {}, options: AxiosRequestConfig = {}): Promise<any> {
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

  /** Handle an axios error by emitting 'failure' and returning the error as JSON. */
  async handleError(error: AxiosError): Promise<object> {
    this.emit('failure', error)
    return error.toJSON();
  }
}

export default RestClient
