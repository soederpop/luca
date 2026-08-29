import axios, { type AxiosError, type AxiosInstance, type AxiosRequestConfig } from "axios";
import { Client, type ClientOptions, type ClientState } from '../client.js'
import type { HelperStability, HelperCategory } from '../introspection/index.js'
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
 * `'ECONNREFUSED'` under Node). HTTP error results also carry `data` (the parsed
 * response body) and `headers` from the failed response.
 *
 * When a failure should be an exception instead, use the throwing variants —
 * `getOrThrow` / `postOrThrow` / `putOrThrow` / `patchOrThrow` / `deleteOrThrow`
 * — which reject with a real Error carrying `status`, `code`, and `data`.
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
  // annotated (not `as const`) so subclasses can declare their own category
  static override category: HelperCategory = 'networking'
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

  /**
   * Handle an axios error by emitting 'failure' and returning the error as a
   * plain JSON object. Unlike axios' bare `error.toJSON()` (which drops the
   * response entirely), the returned object also carries `data` (the parsed
   * response body — validation details, API error codes, rate-limit messages)
   * and `headers` from the failed response when one exists.
   * @param error - The axios error caught from a failed request
   * @returns Plain object: `error.toJSON()` fields plus `data` and `headers` from the response (both `undefined` for connection-level failures with no response)
   *
   * @example
   * ```typescript
   * const api = container.client('rest', { baseURL: 'https://api.example.com', json: true })
   * const result = await api.post('/users', {})   // server replies 422 { error: 'validation_failed' }
   * if (result?.name === 'AxiosError') {
   *   console.error(result.status, result.data)   // 422 { error: 'validation_failed' }
   * }
   * ```
   */
  async handleError(error: AxiosError): Promise<object> {
    this.emit('failure', error)
    return {
      ...(error.toJSON() as object),
      data: error.response?.data,
      headers: error.response?.headers,
    }
  }

  /**
   * Shared implementation for the OrThrow request variants. Sends the request
   * and returns the parsed body on success. On any failure — HTTP error status
   * or connection-level failure — emits 'failure' and **throws** a real Error
   * carrying `status` (numeric HTTP status, when there was a response),
   * `code` (e.g. 'ECONNREFUSED'), and `data` (the parsed response body), with
   * a body summary in the message.
   * @param config - Full axios request config (method, url, data/params, headers, ...)
   * @returns Parsed response body
   * @throws Error with `status`, `code`, and `data` properties on any request failure
   *
   * @example
   * ```typescript
   * const api = container.client('rest', { baseURL: 'https://api.example.com', json: true })
   * try {
   *   await api.requestOrThrow({ method: 'POST', url: '/users', data: {} })
   * } catch (err) {
   *   console.error(err.status, err.data)   // 422 { error: 'validation_failed' }
   * }
   * ```
   */
  async requestOrThrow(config: AxiosRequestConfig): Promise<any> {
    await this.beforeRequest()
    try {
      const response = await this.axios(config)
      return response.data
    } catch (e: any) {
      if (!e?.isAxiosError) throw e
      this.emit('failure', e)

      const method = String(config.method || 'GET').toUpperCase()
      const status = e.response?.status
      const data = e.response?.data

      let summary = ''
      if (data !== undefined) {
        try {
          summary = typeof data === 'string' ? data : JSON.stringify(data)
        } catch {
          summary = String(data)
        }
        if (summary.length > 300) summary = `${summary.slice(0, 300)}…`
      }

      const reason = status
        ? `status ${status}${summary ? `: ${summary}` : ''}`
        : `${e.code || e.message}`
      const error: any = new Error(`${method} ${config.url} failed with ${reason}`)
      error.status = status
      error.code = e.code
      error.data = data
      error.headers = e.response?.headers
      error.cause = e
      throw error
    }
  }

  /**
   * Send a GET request that **throws on failure** instead of returning the
   * error. Use this when a failed request has no meaningful "inspect the
   * returned error" semantics (auth checks, listings, lookups). The thrown
   * Error carries `status`, `code`, and `data` (parsed response body).
   * @param url - Request path relative to baseURL
   * @param params - Query parameters (serialized into the query string)
   * @param options - Additional axios request config (headers, timeout, etc.)
   * @returns Parsed response body
   * @throws Error with `status`, `code`, and `data` on HTTP or connection failure
   *
   * @example
   * ```typescript
   * const api = container.client('rest', { baseURL: 'https://api.example.com', json: true })
   * try {
   *   const me = await api.getOrThrow('/me')
   * } catch (err) {
   *   console.error(err.status, err.data)   // e.g. 401 { error: 'invalid_api_key' }
   * }
   * ```
   */
  async getOrThrow(url: string, params: any = {}, options: AxiosRequestConfig = {}): Promise<any> {
    return this.requestOrThrow({ ...options, method: 'GET', url, params })
  }

  /**
   * Send a POST request that **throws on failure** instead of returning the
   * error. The thrown Error carries `status`, `code`, and `data` (parsed
   * response body — validation details, API error codes).
   * @param url - Request path relative to baseURL
   * @param data - Request body (JSON-encoded when the `json` option is set)
   * @param options - Additional axios request config (headers, timeout, etc.)
   * @returns Parsed response body
   * @throws Error with `status`, `code`, and `data` on HTTP or connection failure
   *
   * @example
   * ```typescript
   * const api = container.client('rest', { baseURL: 'https://api.example.com', json: true })
   * try {
   *   const created = await api.postOrThrow('/users', { name: 'Alice' })
   * } catch (err) {
   *   console.error(err.status, err.data)   // e.g. 422 { error: 'validation_failed' }
   * }
   * ```
   */
  async postOrThrow(url: string, data: any = {}, options: AxiosRequestConfig = {}): Promise<any> {
    return this.requestOrThrow({ ...options, method: 'POST', url, data })
  }

  /**
   * Send a PUT request that **throws on failure** instead of returning the
   * error. The thrown Error carries `status`, `code`, and `data`.
   * @param url - Request path relative to baseURL
   * @param data - Request body (the full replacement representation)
   * @param options - Additional axios request config (headers, timeout, etc.)
   * @returns Parsed response body
   * @throws Error with `status`, `code`, and `data` on HTTP or connection failure
   *
   * @example
   * ```typescript
   * const api = container.client('rest', { baseURL: 'https://api.example.com', json: true })
   * const updated = await api.putOrThrow('/users/42', { name: 'Alice', role: 'admin' })
   * ```
   */
  async putOrThrow(url: string, data: any = {}, options: AxiosRequestConfig = {}): Promise<any> {
    return this.requestOrThrow({ ...options, method: 'PUT', url, data })
  }

  /**
   * Send a PATCH request that **throws on failure** instead of returning the
   * error. The thrown Error carries `status`, `code`, and `data`.
   * @param url - Request path relative to baseURL
   * @param data - Request body (the partial update)
   * @param options - Additional axios request config (headers, timeout, etc.)
   * @returns Parsed response body
   * @throws Error with `status`, `code`, and `data` on HTTP or connection failure
   *
   * @example
   * ```typescript
   * const api = container.client('rest', { baseURL: 'https://api.example.com', json: true })
   * const patched = await api.patchOrThrow('/users/42', { role: 'viewer' })
   * ```
   */
  async patchOrThrow(url: string, data: any = {}, options: AxiosRequestConfig = {}): Promise<any> {
    return this.requestOrThrow({ ...options, method: 'PATCH', url, data })
  }

  /**
   * Send a DELETE request that **throws on failure** instead of returning the
   * error. Like `delete()`, the second argument is query params, not a body.
   * The thrown Error carries `status`, `code`, and `data`.
   * @param url - Request path relative to baseURL
   * @param params - Query parameters (serialized into the query string)
   * @param options - Additional axios request config (headers, timeout, etc.)
   * @returns Parsed response body
   * @throws Error with `status`, `code`, and `data` on HTTP or connection failure
   *
   * @example
   * ```typescript
   * const api = container.client('rest', { baseURL: 'https://api.example.com', json: true })
   * await api.deleteOrThrow('/users/42', { soft: true })   // DELETE /users/42?soft=true
   * ```
   */
  async deleteOrThrow(url: string, params: any = {}, options: AxiosRequestConfig = {}): Promise<any> {
    return this.requestOrThrow({ ...options, method: 'DELETE', url, params })
  }
}

export default RestClient
