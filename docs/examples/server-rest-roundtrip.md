---
title: "Server + REST Client Roundtrip"
tags: [express, endpoints, rest, rateLimit, server, http]
lastTested: "2026-07-03"
lastTestPassed: true
---

# Server + REST Client Roundtrip

Start an express server with file-based endpoints, add a raw custom route through the `create` hook, call it all with the `rest` client — and see how the client reports errors (it **returns** them, it never throws). Also: endpoints get IP-keyed rate limiting for free, no middleware to write.

## Write an endpoint module

Endpoints are plain modules. Exporting `rateLimit` turns on built-in sliding-window rate limiting — this one allows 3 requests per minute per IP.

```ts
const fs = container.feature('fs')
const dir = container.paths.resolve('tmp', 'roundtrip-endpoints')
fs.ensureFolder(dir)

fs.writeFile(container.paths.resolve(dir, 'status.ts'), `
export const path = '/status'
export const description = 'Rate-limited status endpoint'
export const rateLimit = { maxRequests: 3, windowSeconds: 60 }

export async function get() {
  return { ok: true, time: new Date().toISOString() }
}
`)
console.log('endpoint written to', dir)
```

## Create the server and client

The `create: (app, server) => app` hook runs when the express app is built — the door for raw middleware and routes that don't fit the endpoint-module shape. (Two more doors: `server.app.use(...)` after creation, and `luca serve --setup setup.ts` from the CLI.)

```ts
const server = container.server('express', {
  cors: true,
  create: (app) => {
    app.get('/custom', (req, res) => res.json({ source: 'create hook' }))
    return app
  },
})

const api = container.client('rest', { baseURL: 'http://localhost:43117' })
console.log('server and client created')
```

## Mount the endpoints and start listening

`useEndpoints(dir)` loads every endpoint module in a folder — the same discovery `luca serve` does for your project's `endpoints/`.

```ts
await server.useEndpoints(dir)
await server.start({ port: 43117 })
console.log('listening:', server.state.get('listening'))
```

## Call it with the rest client

Methods return the parsed JSON body directly — no `{ data, status }` wrapper.

```ts
const status = await api.get('/status')
console.log('GET /status →', status)

const custom = await api.get('/custom')
console.log('GET /custom →', custom)
```

## Errors are returned, not thrown

This is the rest client's most important contract — and the easiest to get wrong. HTTP errors (4xx/5xx) AND connection failures (ECONNREFUSED, DNS, timeouts) resolve with the error serialized as JSON. A `try/catch` around `api.get(...)` catches **nothing**. Inspect the returned shape instead.

Burn through the rate limit to see it live — requests 2 and 3 pass, the 4th comes back as a 429 error object:

```ts
for (let i = 2; i <= 4; i++) {
  const result = await api.get('/status')
  if (result?.name === 'AxiosError') {
    console.log(`request ${i} → BLOCKED (${result.status ?? result.code}): ${result.message}`)
  } else {
    console.log(`request ${i} → ok`)
  }
}
```

Same story for a server that's down — the connection error comes back as a value too (the `code` is runtime-flavored: `ECONNREFUSED` under node, `ConnectionRefused` under bun — check `result?.name === 'AxiosError'` when you need a runtime-agnostic test):

```ts
const nobody = container.client('rest', { baseURL: 'http://localhost:59999' })
const down = await nobody.get('/anything')
console.log('down server →', down?.code, '|', down?.message)
```

## Cleanup

```ts
await server.stop()
await fs.rmdir(dir)
console.log('stopped:', server.state.get('stopped'))
```

## Summary

Endpoint modules export `path` + method handlers, and `rateLimit`/`getRateLimit` for free per-IP throttling. Raw routes go through the `create` hook, `server.app.use()`, or `luca serve --setup`. The `rest` client returns parsed JSON on success and **returns error objects on any failure** — check `result?.name === 'AxiosError'` or `result?.code`, don't `try/catch`.
