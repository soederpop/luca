---
title: "Express + a WebSocket Sidecar with luca serve --setup"
tags:
  - servers
  - express
  - websocket
  - serve
  - setup
  - sidecar
  - realtime
---
# Express + a WebSocket Sidecar with `luca serve --setup`

You have REST endpoints served by `luca serve` ([tutorial 7](./07-endpoints.md)). Now you want **live push** — a WebSocket running in the same process, alongside the HTTP API, so a `POST` can notify every connected client. This is the "sidecar" shape: one process, two servers, one shared state.

The clean seam for wiring it up is **`luca serve --setup`**. You keep `luca serve` managing Express (endpoints, static, OpenAPI, port handling), and hand it a small module that receives the running server so you can attach the WebSocket sidecar and connect the two. No custom bootstrap, no reinventing the serve command.

## The shape

```
                 luca serve --setup setup.ts --port 3000
                 │
  ┌──────────────┼───────────────────────────────┐
  │  one process                                  │
  │                                               │
  │   Express (owned by luca serve)   :3000       │  ← endpoints/ + public/
  │        │                                      │
  │        │ setup.ts wires them together         │
  │        ▼                                      │
  │   WebSocket sidecar (you start)   :8081       │  ← live push to clients
  └───────────────────────────────────────────────┘
```

`luca serve` builds the Express server, mounts your `endpoints/`, and serves `public/`. `--setup setup.ts` hands your module that Express server **after endpoints mount but before it starts listening** — exactly the right moment to start the sidecar and stash shared handles.

## The setup module contract

A setup module's default export is a function that receives the Luca Express server. It may be async and is awaited:

```ts
// setup.ts
export default async function setup(server) {
  // `server` is the Luca ExpressServer. Two things you always have:
  const container = server.container   // the full container — reliable handle
  const app = server.app               // the underlying Express app (routes mounted, not yet listening)

  // ...attach middleware, start the sidecar, share state (below)
}
```

What's true at setup time:
- **`server.app` is ready** — endpoints are already mounted; you can add more middleware or routes.
- **It is not listening yet** — `luca serve` calls `start()` *after* your setup returns. Don't assume the HTTP port is open.
- **`server.container` is your container** — use it for features, clients, and the WebSocket server.

> Express has three doors for custom wiring: the `create: (app, server) => app` option (when the app is first built, before endpoints), `server.app.use(...)` on the instance, and `luca serve --setup` from the CLI. This tutorial uses the CLI door — it's the one that composes with the managed `serve` lifecycle.

## Start the WebSocket sidecar

Luca's `websocket` server binds its **own port** — so the sidecar is a *companion port* (say `8081`) next to Express on `3000`. Start it in `setup.ts` and stash it on `app.locals` so your REST endpoints can reach it:

```ts
// setup.ts
export default async function setup(server) {
  const container = server.container
  const app = server.app

  // A JSON WebSocket server on its own port, alongside Express.
  const ws = container.server('websocket', { port: 8081, json: true })

  ws.on('connection', (socket) => {
    ws.send(socket, { type: 'welcome', at: Date.now() })
    socket.on('message', (raw) => {
      // client → server messages arrive here
    })
  })

  await ws.start()

  // Shared state: endpoints reach the sidecar via req.app.locals.
  app.locals.ws = ws
  console.log('WebSocket sidecar listening on :8081')
}
```

`app.locals` is the blessed way to share objects across the HTTP and WebSocket halves — endpoint files can't import a variable from `setup.ts`, but they can read `req.app.locals`.

## Wire REST → WebSocket

The payoff: an HTTP write triggers a live push. Here's an endpoint that records a message and broadcasts it to every connected socket. Endpoint handlers are `(params, ctx)`; reach the sidecar through `ctx.request.app.locals`:

```ts
// endpoints/messages.ts  →  POST /api/messages
import { z } from 'zod'
import type { EndpointContext } from 'luca'

export const path = '/api/messages'

export const postSchema = z.object({
  text: z.string().describe('The message body'),
})

export async function post(params: z.infer<typeof postSchema>, ctx: EndpointContext) {
  const ws = ctx.request.app.locals.ws            // the sidecar, shared from setup.ts
  const message = { id: ctx.container.utils.uuid(), text: params.text, at: Date.now() }

  await ws.broadcast({ type: 'message', message })  // push to all connected clients
  return { ok: true, message }
}
```

Now `POST /api/messages` returns JSON to the caller *and* fans the message out to every WebSocket client in real time. HTTP handles the write; the sidecar handles the notify.

Need the server to *ask* a specific client something and await its reply? The Luca WebSocket server has `ask(socket, type, data)` request/response semantics — see the [ask-and-reply example](../examples/websocket-ask-and-reply-example.md).

## The client side

Connect from a browser app ([tutorial 22](./22-reactive-frontend.md)) or any Luca container — note the client targets the **sidecar port**, not the HTTP port:

```js
// in the browser (or any container)
const socket = container.client('websocket', { baseURL: 'ws://localhost:8081' })
socket.on('message', (msg) => {
  if (msg.type === 'message') store.addMessage(msg.message)  // push into your reactive store
})
await socket.connect()
```

A `fetch('/api/messages', …)` to `:3000` now shows up on every connected client via `:8081`.

## Run it

```bash
luca serve --setup setup.ts --port 3000
```

You get Express on `:3000` (your endpoints + `public/` + `/openapi.json`) and the WebSocket sidecar on `:8081`, in one process, sharing state. `luca serve` holds the process open and handles shutdown.

## Lifecycle & gotchas

- **Setup runs before `listen()`.** `server.app` is ready and endpoints are mounted, but the HTTP port isn't open yet. Do setup work (start the sidecar, add middleware, seed `app.locals`); don't make requests to yourself from inside setup.
- **Share state through `app.locals`.** Endpoint files are separate modules — they can't import from `setup.ts`. Put shared handles (`ws`, caches, queues) on `app.locals` in setup and read `ctx.request.app.locals` in handlers.
- **The sidecar is a companion port.** Clients connect to `ws://host:8081`, distinct from the HTTP `:3000`. For browsers, that's a different origin — allow it (Express `--cors` is on by default for the HTTP side; the WS side isn't CORS-gated the same way, but mind mixed `ws://`/`wss://` under HTTPS).
- **Want a single shared port (HTTP `Upgrade`)?** Luca's `websocket` server always binds its own port, and the Express HTTP listener doesn't exist until `start()` (after setup) — so true single-port upgrade means owning the `http.Server` yourself with raw `ws` (`new WebSocketServer({ noServer: true })` + `httpServer.on('upgrade', …)`) in a custom command, not via `luca serve`. Reach for it only if a second port is genuinely unacceptable; the companion-port sidecar is simpler and is what `serve` supports cleanly.
- **`Bun.serve`/`Bun.spawn` are unavailable** in the VM-loaded setup module — use `container.server(...)` (as here) and `container.feature('proc')`.
- **Clean up if you must.** `luca serve` tears down on SIGINT. If your sidecar holds external resources, close them in a `process.on('SIGINT', …)` handler registered in setup.

## Alternative: own the whole lifecycle in a command

If you don't want `luca serve` managing things — you need custom startup order, your own signal handling, or to run both servers from a script — build the pair directly and start them together (see [Servers → Combining Servers](./06-servers.md)):

```ts
const http = container.server('express', { port: 3000, static: './public' })
const ws = container.server('websocket', { port: 8081, json: true })
await http.useEndpoints('./endpoints')
http.app.locals.ws = ws
await Promise.all([http.start(), ws.start()])
```

Same two-server shape; `--setup` is just the version where `serve` owns Express and you bolt the sidecar on.

## What's Next

- [Servers](./06-servers.md) — Express and WebSocket server primitives and options
- [Endpoints](./07-endpoints.md) — file-based routes served by `luca serve`
- [WebSocket ask-and-reply](../examples/websocket-ask-and-reply-example.md) — server↔client request/response
- [Browser: Reactive UIs](./22-reactive-frontend.md) — subscribing to the sidecar from a front-end store
