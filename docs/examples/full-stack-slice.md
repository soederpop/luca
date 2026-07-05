---
title: 'A Full-Stack Slice: Endpoints, Express, and the REST Client'
tags:
  - express
  - rest
  - endpoints
  - servers
  - clients
  - composition
  - rateLimit
lastTested: '2026-07-05'
lastTestPassed: true
---

# A Full-Stack Slice: Endpoints, Express, and the REST Client

One vertical slice, all in this process: file-based **endpoint modules** mounted on the **express server**, consumed by the **rest client** — including the two behaviors that surprise everyone: rate limiting declared as an export, and the rest client *returning* errors instead of throwing them.

For each helper's full API: `luca describe express`, `luca describe rest`, `luca describe endpoints`.

## Write an endpoints folder

An endpoint module exports a `path` plus HTTP-method functions (`get`, `post`, ...). Whatever they return is sent as JSON. `export const rateLimit` declares throttling — no middleware wiring. This is exactly what `luca serve` mounts from your project's `endpoints/` folder. Modules without a `path` export are skipped.

```ts
// bare assignment: survives into later blocks
endpointsDir = container.paths.resolve('tmp', `full-stack-slice-${Date.now()}`, 'endpoints')
fs.ensureFolder(endpointsDir)

fs.writeFile(container.paths.resolve(endpointsDir, 'todos.ts'), `
export const path = '/todos'

const todos = [
  { id: 1, title: 'write the docs', done: false },
  { id: 2, title: 'ship the docs', done: false },
]

export async function get() {
  return { todos }
}

// handlers receive (params, ctx) — params merges query + body + route params
export async function post(params) {
  const todo = { id: todos.length + 1, title: params.title, done: false }
  todos.push(todo)
  return todo
}
`)

fs.writeFile(container.paths.resolve(endpointsDir, 'status.ts'), `
export const path = '/status'
export const rateLimit = { maxRequests: 3, windowSeconds: 60 }

export async function get() {
  return { ok: true, at: new Date().toISOString() }
}
`)

console.log('endpoint modules written')
```

## Mount and start the server

`useEndpoints(dir)` mounts every module in the folder at its exported `path`. You can also hang plain express routes off `server.app` before or after starting.

```ts
server = container.server('express')

// a hand-rolled route alongside the endpoint modules
server.app.get('/health', (req, res) => res.json({ healthy: true }))

await server.useEndpoints(endpointsDir)

const port = await networking.findOpenPort(4310)
await server.start({ port })
console.log('listening on', server.port)
```

## Consume it with the rest client

The client returns **parsed JSON directly** — no `{ data, status }` wrapper to unwrap.

```ts
api = container.client('rest', { baseURL: `http://localhost:${server.port}`, json: true })

const health = await api.get('/health')
if (health.healthy !== true) throw new Error('health route broken')

const listing = await api.get('/todos')
if (listing.todos.length !== 2) throw new Error('expected 2 seed todos')

const created = await api.post('/todos', { title: 'celebrate' })
if (created.id !== 3) throw new Error('post did not create todo #3')

console.log('created:', created)
```

## Errors are returned, not thrown

This is the framework's most important anti-prior. HTTP error statuses (a 404 here) and connection failures (a dead port) both **resolve** with the error serialized as a plain object — `instanceof Error` is `false`, and try/catch catches nothing. Inspect the shape.

```ts
// a 404 — returned, not thrown
const missing = await api.get('/nope')
if (missing instanceof Error) throw new Error('unexpected: 404 came back as an Error instance')
if (missing?.status !== 404 && missing?.name !== 'AxiosError') {
  throw new Error('expected the 404 to come back as a serialized AxiosError')
}
console.log('404 came back as a value:', missing.name, missing.status ?? missing.code)

// a connection refused — also returned, not thrown. The exact `code` string
// depends on the runtime: 'ConnectionRefused' under Bun, 'ECONNREFUSED' under Node.
const deadPort = await networking.findOpenPort(4550)
const down = container.client('rest', { baseURL: `http://localhost:${deadPort}` })
const result = await down.get('/anything')
if (result instanceof Error) throw new Error('unexpected: connection error came back as an Error instance')
if (!result?.code) throw new Error('expected a connection error code in the returned value')
console.log('dead server came back as a value:', result.code)
```

So the idiomatic health check is a shape check, not a try/catch:

```ts
const check = await api.get('/status')
if (check?.name === 'AxiosError') {
  console.log('server is DOWN:', check.message)
} else {
  console.log('server is UP:', check.ok)
}
```

## Rate limiting kicks in

`status.ts` declared `maxRequests: 3` per minute. We used one above; two more succeed, then the server answers 429 — which the client, of course, *returns*.

```ts
await api.get('/status')
await api.get('/status')
const limited = await api.get('/status')

if (limited?.status !== 429) throw new Error(`expected a 429 after exceeding the rate limit, got ${JSON.stringify(limited).slice(0, 120)}`)
console.log('rate limit enforced with a 429 on request #4')
```

## Shut down

Always stop servers at the end of a script — otherwise the process never exits.

```ts
await server.stop()
await fs.rmdir(container.paths.resolve(endpointsDir, '..'))
console.log('server stopped, scratch folder removed')
```
