# ExpressServer (servers.express)

> Stability: `core`

Express.js HTTP server with automatic endpoint mounting, CORS, and SPA history fallback. Wraps an Express application with convention-based endpoint discovery. Endpoint modules (files exporting `path` plus `get`/`post`/`put`/`patch`/`delete` handlers) are mounted as routes — this is what `luca serve` does with your project's `endpoints/` folder via `useEndpoints(dir)`. Supports static file serving, CORS, and single-page app history fallback out of the box.

## Usage

```ts
container.server('express', {
  // Port number to listen on
  port,
  // Hostname or IP address to bind to
  host,
  // Whether to enable CORS middleware
  cors,
  // Path to serve static files from
  static,
  // Serve index.html for unmatched routes (SPA history fallback)
  historyFallback,
  // (app: Express, server: Server) => Express
  create,
  // (options: StartOptions, server: Server) => Promise<any>
  beforeStart,
})
```

## Options (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `port` | `number` | Port number to listen on |
| `host` | `string` | Hostname or IP address to bind to |
| `cors` | `boolean` | Whether to enable CORS middleware |
| `static` | `string` | Path to serve static files from |
| `historyFallback` | `boolean` | Serve index.html for unmatched routes (SPA history fallback) |
| `create` | `any` | (app: Express, server: Server) => Express |
| `beforeStart` | `any` | (options: StartOptions, server: Server) => Promise<any> |

## Methods

### start

Start the Express HTTP server. A runtime `port` overrides the constructor option and is written to state so `server.port` always reflects reality. Runs the `beforeStart` hook, wires the SPA history fallback (when `historyFallback` + `static` are set), then listens. Resolves once the server is accepting connections; calling start() while already listening is a no-op.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `StartOptions` |  | Optional runtime overrides for port and host (host defaults to '0.0.0.0') |

**Returns:** `Promise<this>`

```ts
const server = container.server('express')
server.app.get('/ping', (req, res) => res.json({ pong: true }))

await server.start({ port: 3000 })
console.log(server.isListening)   // true
console.log(server.port)          // 3000 — runtime port wins over options
```



### stop

Stop the HTTP listener. Waits up to 500ms for the underlying server to close (open keep-alive connections can hold it), then marks the server stopped either way — so stop() never hangs a CLI command.

**Returns:** `Promise<this>`

```ts
const server = container.server('express')
await server.start({ port: 3000 })
// ... handle requests ...
await server.stop()
console.log(server.isListening)   // false
```



### configure

**Returns:** `Promise<this>`



### useEndpoint

Mount an already-constructed Endpoint instance onto the Express app and track it (mounted endpoints power reloadEndpoint and the OpenAPI spec). Most callers want useEndpoints(dir) or useEndpointModules(mods) instead, which build the Endpoint for you.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `endpoint` | `Endpoint` | ✓ | A loaded Endpoint instance |

**Returns:** `this`

```ts
import { Endpoint } from 'luca'

const server = container.server('express')
const endpoint = new Endpoint({ path: '/hello' }, container.context)
await endpoint.load({
 path: '/hello',
 get: async (params) => ({ hello: params.name || 'world' }),
})
server.useEndpoint(endpoint)
await server.start({ port: 3000 })
```



### useEndpoints

Discover and mount every endpoint module in a directory (recursive `**\/*.ts` scan). This is how `luca serve` wires up a project's `endpoints/` folder. Each file must export a `path` string (files without one are silently skipped) plus handler functions named after HTTP methods. Modules are loaded through the helpers feature's VM-aware loader, so this works from the compiled binary too. A file that fails to load logs an error and is skipped — it does not abort the others.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `dir` | `string` | ✓ | Absolute path to the directory containing endpoint modules |

**Returns:** `Promise<this>`

```ts
// endpoints/users.ts:
//   export const path = '/users/:id'
//   export async function get(params, ctx) {
//     return { id: params.id }        // params merges query + body + route params
//   }

const server = container.server('express')
await server.useEndpoints(container.paths.join('endpoints'))
await server.start({ port: 3000 })
// GET http://localhost:3000/users/42 -> { "id": "42" }
```



### reloadEndpoint

Reload a mounted endpoint by its file path. Re-reads the module through the helpers VM loader so the next request picks up the new handlers.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `filePath` | `string` | ✓ | Absolute path to the endpoint file |

**Returns:** `Promise<Endpoint | null>`

```ts
const server = container.server('express')
await server.useEndpoints(container.paths.join('endpoints'))
await server.start({ port: 3000 })

// after editing endpoints/users.ts on disk (e.g. from a file watcher):
const reloaded = await server.reloadEndpoint(container.paths.join('endpoints', 'users.ts'))
console.log(reloaded ? 'hot-reloaded' : 'not a mounted endpoint')
```



### useEndpointModules

Mount endpoint modules you already have in memory (imported or inline objects) instead of scanning a directory. Same module contract as useEndpoints: each needs a `path` plus HTTP-method handlers; modules without a `path` are skipped, and a module that fails to load logs an error without aborting the rest.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `modules` | `EndpointModule[]` | ✓ | Array of endpoint modules (or their `import()` results) |

**Returns:** `Promise<this>`

```ts
const server = container.server('express')
await server.useEndpointModules([
 {
   path: '/status',
   get: async () => ({ ok: true, uptime: process.uptime() }),
 },
 {
   path: '/echo',
   post: async (params) => ({ received: params }),
 },
])
await server.start({ port: 3000 })
```



### serveOpenAPISpec

Register a GET /openapi.json route that serves the OpenAPI 3.1 spec generated from all mounted endpoints (regenerated per request, so endpoints mounted later still show up).

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `{ title?: string; version?: string; description?: string }` |  | Optional info-block overrides (title, version, description) |

**Returns:** `this`

```ts
const server = container.server('express')
await server.useEndpoints(container.paths.join('endpoints'))
server.serveOpenAPISpec({ title: 'My API', version: '2.0.0' })
await server.start({ port: 3000 })
// GET http://localhost:3000/openapi.json -> the generated spec
```



### generateOpenAPISpec

Build an OpenAPI 3.1 document describing every mounted endpoint — paths come from the endpoint modules, parameter schemas from their zod method schemas (e.g. `getSchema`), and the server URL from the current port.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `{ title?: string; version?: string; description?: string }` |  | Optional info-block overrides (title, version, description) |

**Returns:** `Record<string, any>`

```ts
const server = container.server('express')
await server.useEndpointModules([
 { path: '/status', get: async () => ({ ok: true }) },
])
const spec = server.generateOpenAPISpec({ title: 'My API' })
console.log(spec.info.title)          // 'My API'
console.log(Object.keys(spec.paths))  // ['/status']
```



## Getters

| Property | Type | Description |
|----------|------|-------------|
| `express` | `typeof express` | The raw express module itself — handy for `server.express.static(...)`, `server.express.Router()`, etc. |
| `hooks` | `{ create: (app: Express, server: Server) => Express; beforeStart: (options: any, server: Server) => any }` | The lifecycle hooks resolved from options: `create(app, server)` runs when the app is first built (before endpoints mount); `beforeStart(startOptions, server)` runs inside start() before listening. Both default to no-ops. |
| `app` | `Express` | The underlying Express application, built lazily on first access: CORS (unless `cors: false`), JSON + urlencoded body parsers, optional static file serving, then the `create` hook. Use it to register raw routes and middleware directly. |

## State (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `port` | `number` | The port the server is bound to |
| `listening` | `boolean` | Whether the server is actively listening for connections |
| `configured` | `boolean` | Whether the server has been configured |
| `stopped` | `boolean` | Whether the server has been stopped |

## Examples

**servers.express**

```ts
const server = container.server('express', { static: './public' })

// custom routes on the underlying Express app, before or after start
server.app.get('/health', (req, res) => res.json({ ok: true }))

// mount a folder of endpoint modules (what `luca serve` does with endpoints/)
await server.useEndpoints(container.paths.join('endpoints'))

await server.start({ port: 3000 })
console.log(server.port)          // 3000
const api = container.client('rest', { baseURL: `http://localhost:${server.port}` })
console.log(await api.get('/health'))   // { ok: true }
await server.stop()
```

```ts
// endpoints/status.ts — rate-limited endpoint module, mounted by `luca serve`
export const path = '/status'
export const rateLimit = { maxRequests: 10, windowSeconds: 60 } // all methods
export async function get() { return { ok: true } }

// Custom middleware via the create hook (runs before endpoints mount)
const server = container.server('express', {
 create: (app, server) => { app.use(myMiddleware); return app },
})
```



**start**

```ts
const server = container.server('express')
server.app.get('/ping', (req, res) => res.json({ pong: true }))

await server.start({ port: 3000 })
console.log(server.isListening)   // true
console.log(server.port)          // 3000 — runtime port wins over options
```



**stop**

```ts
const server = container.server('express')
await server.start({ port: 3000 })
// ... handle requests ...
await server.stop()
console.log(server.isListening)   // false
```



**useEndpoint**

```ts
import { Endpoint } from 'luca'

const server = container.server('express')
const endpoint = new Endpoint({ path: '/hello' }, container.context)
await endpoint.load({
 path: '/hello',
 get: async (params) => ({ hello: params.name || 'world' }),
})
server.useEndpoint(endpoint)
await server.start({ port: 3000 })
```



**useEndpoints**

```ts
// endpoints/users.ts:
//   export const path = '/users/:id'
//   export async function get(params, ctx) {
//     return { id: params.id }        // params merges query + body + route params
//   }

const server = container.server('express')
await server.useEndpoints(container.paths.join('endpoints'))
await server.start({ port: 3000 })
// GET http://localhost:3000/users/42 -> { "id": "42" }
```



**reloadEndpoint**

```ts
const server = container.server('express')
await server.useEndpoints(container.paths.join('endpoints'))
await server.start({ port: 3000 })

// after editing endpoints/users.ts on disk (e.g. from a file watcher):
const reloaded = await server.reloadEndpoint(container.paths.join('endpoints', 'users.ts'))
console.log(reloaded ? 'hot-reloaded' : 'not a mounted endpoint')
```



**useEndpointModules**

```ts
const server = container.server('express')
await server.useEndpointModules([
 {
   path: '/status',
   get: async () => ({ ok: true, uptime: process.uptime() }),
 },
 {
   path: '/echo',
   post: async (params) => ({ received: params }),
 },
])
await server.start({ port: 3000 })
```



**serveOpenAPISpec**

```ts
const server = container.server('express')
await server.useEndpoints(container.paths.join('endpoints'))
server.serveOpenAPISpec({ title: 'My API', version: '2.0.0' })
await server.start({ port: 3000 })
// GET http://localhost:3000/openapi.json -> the generated spec
```



**generateOpenAPISpec**

```ts
const server = container.server('express')
await server.useEndpointModules([
 { path: '/status', get: async () => ({ ok: true }) },
])
const spec = server.generateOpenAPISpec({ title: 'My API' })
console.log(spec.info.title)          // 'My API'
console.log(Object.keys(spec.paths))  // ['/status']
```



**app**

```ts
const server = container.server('express')
server.app.get('/health', (req, res) => res.json({ ok: true }))
server.app.use((req, res, next) => { console.log(req.method, req.path); next() })
await server.start({ port: 3000 })
```

