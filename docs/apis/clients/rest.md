# RestClient (clients.rest)

> Stability: `core`

HTTP REST client built on top of axios. Provides convenience methods for GET, POST, PUT, PATCH, and DELETE requests with automatic JSON handling, configurable base URL, and error event emission. All request methods return the **parsed response body directly** — there is no `{ data, status, headers }` wrapper. `await api.get('/users')` IS the users payload, not an axios Response. **Errors are returned, not thrown.** This applies to HTTP error statuses (4xx/5xx) AND to connection-level failures (connection refused, DNS failures, timeouts). In both cases the request methods resolve with the error serialized as JSON (via `error.toJSON()`) instead of rejecting, and a `failure` event is emitted on the client. The returned value is a **plain object** with `message` and `code`/`status` fields — NOT an Error instance, so `result instanceof Error` is false. A try/catch around `api.get(...)` will NOT catch a down server or a 404 — inspect the returned value's shape instead. HTTP errors come back as `name: 'AxiosError'` with a numeric `status`; connection errors carry a `code` whose exact string depends on the runtime (`'ConnectionRefused'` under Bun, `'ECONNREFUSED'` under Node). Configure once via options: `baseURL` prefixes every request path, and `json: true` sets `Content-Type: application/json` + `Accept: application/json` default headers. Per-request headers and any other axios config go in the last argument of each method. The underlying axios instance is available as `api.axios` for anything beyond that (interceptors, etc.).

## Usage

```ts
container.client('rest', {
  // Base URL for the client connection
  baseURL,
  // Whether to automatically parse responses as JSON
  json,
})
```

## Options (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `baseURL` | `string` | Base URL for the client connection |
| `json` | `boolean` | Whether to automatically parse responses as JSON |

## Methods

### beforeRequest

**Returns:** `Promise<void>`



### patch

Send a PATCH request. Returns the parsed response body directly (not an axios Response wrapper). On HTTP errors, returns the error as JSON instead of throwing — check the result's shape, don't try/catch.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `url` | `string` | ✓ | Request path relative to baseURL |
| `data` | `any` |  | Request body (the partial update) |
| `options` | `AxiosRequestConfig` |  | Additional axios request config (headers, timeout, etc.) |

**Returns:** `Promise<any>`

```ts
const api = container.client('rest', { baseURL: 'https://api.example.com', json: true })
const patched = await api.patch('/users/42', { role: 'viewer' })
if (patched?.name === 'AxiosError') console.error(patched.status, patched.message)
```



### put

Send a PUT request. Returns the parsed response body directly (not an axios Response wrapper). On HTTP errors, returns the error as JSON instead of throwing — check the result's shape, don't try/catch.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `url` | `string` | ✓ | Request path relative to baseURL |
| `data` | `any` |  | Request body (the full replacement representation) |
| `options` | `AxiosRequestConfig` |  | Additional axios request config (headers, timeout, etc.) |

**Returns:** `Promise<any>`

```ts
const api = container.client('rest', { baseURL: 'https://api.example.com', json: true })
const updated = await api.put('/users/42', { name: 'Alice', role: 'admin' })
console.log(updated)   // the parsed response body
```



### post

Send a POST request. Returns the parsed response body directly (not an axios Response wrapper). On HTTP errors, returns the error as JSON instead of throwing — check the result's shape, don't try/catch.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `url` | `string` | ✓ | Request path relative to baseURL |
| `data` | `any` |  | Request body (JSON-encoded when the `json` option is set) |
| `options` | `AxiosRequestConfig` |  | Additional axios request config (headers, timeout, etc.) |

**Returns:** `Promise<any>`

```ts
const api = container.client('rest', { baseURL: 'https://api.example.com', json: true })

const created = await api.post('/users', { name: 'Alice', role: 'admin' })

if (created?.name === 'AxiosError') {
 console.error('create failed:', created.status, created.message)   // e.g. 422
} else {
 console.log('created user', created.id)
}
```



### delete

Send a DELETE request. Returns the parsed response body directly (not an axios Response wrapper). On HTTP errors, returns the error as JSON instead of throwing — check the result's shape, don't try/catch. Note the second argument is query params (like get), not a request body.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `url` | `string` | ✓ | Request path relative to baseURL |
| `params` | `any` |  | Query parameters (serialized into the query string) |
| `options` | `AxiosRequestConfig` |  | Additional axios request config (headers, timeout, etc.) |

**Returns:** `Promise<any>`

```ts
const api = container.client('rest', { baseURL: 'https://api.example.com', json: true })

// second arg is query params: DELETE /users/42?soft=true
const result = await api.delete('/users/42', { soft: true })
if (result?.name === 'AxiosError') console.error('delete failed:', result.status)
```



### get

Send a GET request. Returns the parsed response body directly (not an axios Response wrapper). On HTTP errors, returns the error as JSON instead of throwing — check the result's shape, don't try/catch.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `url` | `string` | ✓ | Request path relative to baseURL |
| `params` | `any` |  | Query parameters (serialized into the query string) |
| `options` | `AxiosRequestConfig` |  | Additional axios request config (headers, timeout, etc.) |

**Returns:** `Promise<any>`

```ts
const api = container.client('rest', { baseURL: 'https://api.example.com', json: true })

// second arg is query params: GET /search?q=luca&limit=10
const results = await api.get('/search', { q: 'luca', limit: 10 })

// per-request headers via the third arg
const me = await api.get('/me', {}, { headers: { Authorization: `Bearer ${token}` } })

// errors come back as a plain object, not a throw
if (me?.name === 'AxiosError') console.error(me.status, me.message)
```



### handleError

Handle an axios error by emitting 'failure' and returning the error as JSON.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `error` | `AxiosError` | ✓ | Parameter error |

**Returns:** `Promise<object>`



## Getters

| Property | Type | Description |
|----------|------|-------------|
| `useJSON` | `any` | Whether JSON content-type headers should be set automatically. |
| `baseURL` | `any` |  |

## Events (Zod v4 schema)

### failure

Emitted when a request fails

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `any` | The error object |



## State (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `connected` | `boolean` | Whether the client is currently connected |

## Examples

**clients.rest**

```ts
const api = container.client('rest', { baseURL: 'https://api.example.com', json: true })
const users = await api.get('/users')                 // parsed body, no .data unwrapping
await api.post('/users', { name: 'Alice' })

// Health check: distinguish an up server from a down one by inspecting the result
const local = container.client('rest', { baseURL: 'http://localhost:4000' })
const result = await local.get('/health')
if (result?.code || result?.name === 'AxiosError') {
 console.log('server is DOWN:', result.message)   // error, returned not thrown
} else {
 console.log('server is UP:', result)             // parsed response body
}
```



**patch**

```ts
const api = container.client('rest', { baseURL: 'https://api.example.com', json: true })
const patched = await api.patch('/users/42', { role: 'viewer' })
if (patched?.name === 'AxiosError') console.error(patched.status, patched.message)
```



**put**

```ts
const api = container.client('rest', { baseURL: 'https://api.example.com', json: true })
const updated = await api.put('/users/42', { name: 'Alice', role: 'admin' })
console.log(updated)   // the parsed response body
```



**post**

```ts
const api = container.client('rest', { baseURL: 'https://api.example.com', json: true })

const created = await api.post('/users', { name: 'Alice', role: 'admin' })

if (created?.name === 'AxiosError') {
 console.error('create failed:', created.status, created.message)   // e.g. 422
} else {
 console.log('created user', created.id)
}
```



**delete**

```ts
const api = container.client('rest', { baseURL: 'https://api.example.com', json: true })

// second arg is query params: DELETE /users/42?soft=true
const result = await api.delete('/users/42', { soft: true })
if (result?.name === 'AxiosError') console.error('delete failed:', result.status)
```



**get**

```ts
const api = container.client('rest', { baseURL: 'https://api.example.com', json: true })

// second arg is query params: GET /search?q=luca&limit=10
const results = await api.get('/search', { q: 'luca', limit: 10 })

// per-request headers via the third arg
const me = await api.get('/me', {}, { headers: { Authorization: `Bearer ${token}` } })

// errors come back as a plain object, not a throw
if (me?.name === 'AxiosError') console.error(me.status, me.message)
```

