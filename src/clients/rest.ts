import axios, { type AxiosError, type AxiosInstance, type AxiosRequestConfig } from "axios";
import { Client, type ClientOptions, type ClientState } from '../client.js'
import type { HelperStability } from '../introspection/index.js'
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
 * All request methods return the **parsed response body directly** — there is
 * no `{ data, status, headers }` wrapper. `await api.get('/users')` IS the
 * users payload, not an axios Response.
 *
 * **Errors are returned, not thrown.** This applies to HTTP error statuses (4xx/5xx)
 * AND to connection-level failures (connection refused, DNS failures, timeouts).
 * In both cases the request methods resolve with the error serialized as JSON
 * (via `error.toJSON()`) instead of rejecting, and a `failure` event is emitted
 * on the client. The returned value is a **plain object** with `message` and
 * `code`/`status` fields — NOT an Error instance, so `result instanceof Error`
 * is false. A try/catch around `api.get(...)` will NOT catch a down server or a
 * 404 — inspect the returned value's shape instead. HTTP errors come back as
 * `name: 'AxiosError'` with a numeric `status`; connection errors carry a `code`
 * whose exact string depends on the runtime (`'ConnectionRefused'` under Bun,
 * `'ECONNREFUSED'` under Node).
 *
 * Configure once via options: `baseURL` prefixes every request path, and
 * `json: true` sets `Content-Type: application/json` + `Accept: application/json`
 * default headers. Per-request headers and any other axios config go in the
 * last argument of each method. The underlying axios instance is available as
 * `api.axios` for anything beyond that (interceptors, etc.).
 *
 * @example
 * ```typescript
 * const api = container.client('rest', { baseURL: 'https://api.example.com', json: true })
 * const users = await api.get('/users')                 // parsed body, no .data unwrapping
 * await api.post('/users', { name: 'Alice' })
 *
 * // Health check: distinguish an up server from a down one by inspecting the result
 * const local = container.client('rest', { baseURL: 'http://localhost:4000' })
 * const result = await local.get('/health')
 * if (result?.code || result?.name === 'AxiosError') {
 *   console.log('server is DOWN:', result.message)   // error, returned not thrown
 * } else {
 *   console.log('server is UP:', result)             // parsed response body
 * }
 * ```
 */
export class RestClient<
  T extends ClientState = ClientState,
  K extends ClientOptions = ClientOptions
> extends Client<T, K> {
  axios!: AxiosInstance;

  static override shortcut: string = "clients.rest"
  // annotated (not `as const`) so subclasses can declare their own stability
  static override stability: HelperStability = 'core'
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
   * of throwing — check the result's shape, don't try/catch.
   * @param url - Request path relative to baseURL
   * @param data - Request body (the partial update)
   * @param options - Additional axios request config (headers, timeout, etc.)
   * @returns Parsed response body
   *
   * @example
   * ```typescript
   * const api = container.client('rest', { baseURL: 'https://api.example.com', json: true })
   * const patched = await api.patch('/users/42', { role: 'viewer' })
   * if (patched?.name === 'AxiosError') console.error(patched.status, patched.message)
   * ```
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
   * of throwing — check the result's shape, don't try/catch.
   * @param url - Request path relative to baseURL
   * @param data - Request body (the full replacement representation)
   * @param options - Additional axios request config (headers, timeout, etc.)
   * @returns Parsed response body
   *
   * @example
   * ```typescript
   * const api = container.client('rest', { baseURL: 'https://api.example.com', json: true })
   * const updated = await api.put('/users/42', { name: 'Alice', role: 'admin' })
   * console.log(updated)   // the parsed response body
   * ```
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
   * of throwing — check the result's shape, don't try/catch.
   * @param url - Request path relative to baseURL
   * @param data - Request body (JSON-encoded when the `json` option is set)
   * @param options - Additional axios request config (headers, timeout, etc.)
   * @returns Parsed response body
   *
   * @example
   * ```typescript
   * const api = container.client('rest', { baseURL: 'https://api.example.com', json: true })
   *
   * const created = await api.post('/users', { name: 'Alice', role: 'admin' })
   *
   * if (created?.name === 'AxiosError') {
   *   console.error('create failed:', created.status, created.message)   // e.g. 422
   * } else {
   *   console.log('created user', created.id)
   * }
   * ```
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
   * of throwing — check the result's shape, don't try/catch. Note the second
   * argument is query params (like get), not a request body.
   * @param url - Request path relative to baseURL
   * @param params - Query parameters (serialized into the query string)
   * @param options - Additional axios request config (headers, timeout, etc.)
   * @returns Parsed response body
   *
   * @example
   * ```typescript
   * const api = container.client('rest', { baseURL: 'https://api.example.com', json: true })
   *
   * // second arg is query params: DELETE /users/42?soft=true
   * const result = await api.delete('/users/42', { soft: true })
   * if (result?.name === 'AxiosError') console.error('delete failed:', result.status)
   * ```
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
   * of throwing — check the result's shape, don't try/catch.
   * @param url - Request path relative to baseURL
   * @param params - Query parameters (serialized into the query string)
   * @param options - Additional axios request config (headers, timeout, etc.)
   * @returns Parsed response body
   *
   * @example
   * ```typescript
   * const api = container.client('rest', { baseURL: 'https://api.example.com', json: true })
   *
   * // second arg is query params: GET /search?q=luca&limit=10
   * const results = await api.get('/search', { q: 'luca', limit: 10 })
   *
   * // per-request headers via the third arg
   * const token = 'my-jwt'
   * const me = await api.get('/me', {}, { headers: { Authorization: `Bearer ${token}` } })
   *
   * // errors come back as a plain object, not a throw
   * if (me?.name === 'AxiosError') console.error(me.status, me.message)
   * ```
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
