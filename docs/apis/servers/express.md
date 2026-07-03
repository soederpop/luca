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

// findOpenPort keeps the example collision-free; start({ port: 3000 }) works the same
const port = await container.feature('networking').findOpenPort(3430)
await server.start({ port })
console.log(server.isListening)    // true
console.log(server.port === port)  // true — runtime port wins over options
await server.stop()
```



### stop

Stop the HTTP listener. Waits up to 500ms for the underlying server to close (open keep-alive connections can hold it), then marks the server stopped either way — so stop() never hangs a CLI command.

**Returns:** `Promise<this>`

```ts
const server = container.server('express')
const port = await container.feature('networking').findOpenPort(3440)
await server.start({ port })
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
// The Endpoint class is on the endpoints registry — no import needed
const Endpoint = container.endpoints.baseClass

const server = container.server('express')
const endpoint = new Endpoint({ path: '/hello' }, container.context)
await endpoint.load({
 path: '/hello',
 get: async (params) => ({ hello: params.name || 'world' }),
})
server.useEndpoint(endpoint)

const port = await container.feature('networking').findOpenPort(3450)
await server.start({ port })
const api = container.client('rest', { baseURL: `http://localhost:${port}` })
console.log(await api.get('/hello', { name: 'luca' }))   // { hello: 'luca' }
await server.stop()
```



### useEndpoints

Discover and mount every endpoint module in a directory (recursive `**\/*.ts` scan). This is how `luca serve` wires up a project's `endpoints/` folder. Each file must export a `path` string (files without one are silently skipped) plus handler functions named after HTTP methods. Modules are loaded through the helpers feature's VM-aware loader, so this works from the compiled binary too. A file that fails to load logs an error and is skipped — it does not abort the others.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `dir` | `string` | ✓ | Absolute path to the directory containing endpoint modules |

**Returns:** `Promise<this>`

```ts
// Given an endpoints/users.ts file like this (written here so the example runs):
const fs = container.feature('fs')
fs.ensureFile(container.paths.join('endpoints', 'users.ts'), [
 "export const path = '/users/:id'",
 "export async function get(params) { return { id: params.id } }",
].join('\n'))

const server = container.server('express')
await server.useEndpoints(container.paths.join('endpoints'))

const port = await container.feature('networking').findOpenPort(3460)
await server.start({ port })
const api = container.client('rest', { baseURL: `http://localhost:${port}` })
console.log(await api.get('/users/42'))   // { id: '42' } — params merges query + body + route params
await server.stop()
```



### reloadEndpoint

Reload a mounted endpoint by its file path. Re-reads the module through the helpers VM loader so the next request picks up the new handlers.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `filePath` | `string` | ✓ | Absolute path to the endpoint file |

**Returns:** `Promise<Endpoint | null>`

```ts
const fs = container.feature('fs')
const file = container.paths.join('endpoints', 'users.ts')
fs.ensureFile(file, "export const path = '/users/:id'\nexport async function get(params) { return { id: params.id } }")

const server = container.server('express')
await server.useEndpoints(container.paths.join('endpoints'))

// after editing endpoints/users.ts on disk (e.g. from a file watcher):
fs.ensureFile(file, "export const path = '/users/:id'\nexport async function get(params) { return { id: params.id, v: 2 } }", true)
const reloaded = await server.reloadEndpoint(file)
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
   get: async () => ({ ok: true }),
 },
 {
   path: '/echo',
   post: async (params) => ({ received: params }),
 },
])

const port = await container.feature('networking').findOpenPort(3480)
await server.start({ port })
const api = container.client('rest', { baseURL: `http://localhost:${port}` })
console.log(await api.post('/echo', { hello: 'world' }))   // { received: { hello: 'world' } }
await server.stop()
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
await server.useEndpointModules([
 { path: '/status', get: async () => ({ ok: true }) },
])
server.serveOpenAPISpec({ title: 'My API', version: '2.0.0' })

const port = await container.feature('networking').findOpenPort(3470)
await server.start({ port })
const api = container.client('rest', { baseURL: `http://localhost:${port}` })
const spec = await api.get('/openapi.json')
console.log(spec.info.title, Object.keys(spec.paths))   // My API [ '/status' ]
await server.stop()
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

// mount endpoint modules — useEndpoints(dir) does the same for a folder
// of endpoint files (that's what `luca serve` does with endpoints/)
await server.useEndpointModules([
 { path: '/status', get: async () => ({ ok: true }) },
])

// grab a free port so the example runs anywhere; a fixed port works too
const port = await container.feature('networking').findOpenPort(3400)
await server.start({ port })
console.log(server.port === port)       // true

const api = container.client('rest', { baseURL: `http://localhost:${server.port}` })
console.log(await api.get('/health'))   // { ok: true }
await server.stop()
```

```ts
// endpoints/status.ts — a rate-limited endpoint module, mounted by `luca serve`:
//   export const path = '/status'
//   export const rateLimit = { maxRequests: 10, windowSeconds: 60 } // all methods
//   export async function get() { return { ok: true } }

// Custom middleware via the create hook (runs before endpoints mount)
const seen = []
const server = container.server('express', {
 create: (app, server) => {
   app.use((req, res, next) => { seen.push(req.path); next() })
   return app
 },
})
server.app.get('/ping', (req, res) => res.json({ pong: true }))

const port = await container.feature('networking').findOpenPort(3410)
await server.start({ port })
const api = container.client('rest', { baseURL: `http://localhost:${port}` })
console.log(await api.get('/ping'))   // { pong: true }
console.log(seen)                     // ['/ping']
await server.stop()
```



**start**

```ts
const server = container.server('express')
server.app.get('/ping', (req, res) => res.json({ pong: true }))

// findOpenPort keeps the example collision-free; start({ port: 3000 }) works the same
const port = await container.feature('networking').findOpenPort(3430)
await server.start({ port })
console.log(server.isListening)    // true
console.log(server.port === port)  // true — runtime port wins over options
await server.stop()
```



**stop**

```ts
const server = container.server('express')
const port = await container.feature('networking').findOpenPort(3440)
await server.start({ port })
// ... handle requests ...
await server.stop()
console.log(server.isListening)   // false
```



**useEndpoint**

```ts
// The Endpoint class is on the endpoints registry — no import needed
const Endpoint = container.endpoints.baseClass

const server = container.server('express')
const endpoint = new Endpoint({ path: '/hello' }, container.context)
await endpoint.load({
 path: '/hello',
 get: async (params) => ({ hello: params.name || 'world' }),
})
server.useEndpoint(endpoint)

const port = await container.feature('networking').findOpenPort(3450)
await server.start({ port })
const api = container.client('rest', { baseURL: `http://localhost:${port}` })
console.log(await api.get('/hello', { name: 'luca' }))   // { hello: 'luca' }
await server.stop()
```



**useEndpoints**

```ts
// Given an endpoints/users.ts file like this (written here so the example runs):
const fs = container.feature('fs')
fs.ensureFile(container.paths.join('endpoints', 'users.ts'), [
 "export const path = '/users/:id'",
 "export async function get(params) { return { id: params.id } }",
].join('\n'))

const server = container.server('express')
await server.useEndpoints(container.paths.join('endpoints'))

const port = await container.feature('networking').findOpenPort(3460)
await server.start({ port })
const api = container.client('rest', { baseURL: `http://localhost:${port}` })
console.log(await api.get('/users/42'))   // { id: '42' } — params merges query + body + route params
await server.stop()
```



**reloadEndpoint**

```ts
const fs = container.feature('fs')
const file = container.paths.join('endpoints', 'users.ts')
fs.ensureFile(file, "export const path = '/users/:id'\nexport async function get(params) { return { id: params.id } }")

const server = container.server('express')
await server.useEndpoints(container.paths.join('endpoints'))

// after editing endpoints/users.ts on disk (e.g. from a file watcher):
fs.ensureFile(file, "export const path = '/users/:id'\nexport async function get(params) { return { id: params.id, v: 2 } }", true)
const reloaded = await server.reloadEndpoint(file)
console.log(reloaded ? 'hot-reloaded' : 'not a mounted endpoint')
```



**useEndpointModules**

```ts
const server = container.server('express')
await server.useEndpointModules([
 {
   path: '/status',
   get: async () => ({ ok: true }),
 },
 {
   path: '/echo',
   post: async (params) => ({ received: params }),
 },
])

const port = await container.feature('networking').findOpenPort(3480)
await server.start({ port })
const api = container.client('rest', { baseURL: `http://localhost:${port}` })
console.log(await api.post('/echo', { hello: 'world' }))   // { received: { hello: 'world' } }
await server.stop()
```



**serveOpenAPISpec**

```ts
const server = container.server('express')
await server.useEndpointModules([
 { path: '/status', get: async () => ({ ok: true }) },
])
server.serveOpenAPISpec({ title: 'My API', version: '2.0.0' })

const port = await container.feature('networking').findOpenPort(3470)
await server.start({ port })
const api = container.client('rest', { baseURL: `http://localhost:${port}` })
const spec = await api.get('/openapi.json')
console.log(spec.info.title, Object.keys(spec.paths))   // My API [ '/status' ]
await server.stop()
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
server.app.use((req, res, next) => { console.log(req.method, req.path); next() })
server.app.get('/health', (req, res) => res.json({ ok: true }))

const port = await container.feature('networking').findOpenPort(3420)
await server.start({ port })
const api = container.client('rest', { baseURL: `http://localhost:${port}` })
console.log(await api.get('/health'))   // { ok: true }
await server.stop()
```

