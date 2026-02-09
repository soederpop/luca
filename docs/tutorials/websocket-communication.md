# Communicating Between NodeContainer and WebContainer Over WebSockets

Luca provides matching WebSocket primitives on both sides of the wire: a `WebsocketServer` for the `NodeContainer` and a `SocketClient` for the `WebContainer`. This makes it natural to build real-time applications where your server and browser share the same architectural patterns — observable state, event buses, and the container's dependency injection.

This tutorial walks through wiring up bidirectional communication between the two containers.

## The Two Containers

**`NodeContainer`** (server-side) has a `servers` registry with a built-in `websocket` server type:

```ts
import container from '@/node'
const ws = container.server('websocket', { port: 8081 })
```

**`WebContainer`** (browser-side) has a `SocketClient` for connecting to WebSocket endpoints:

```ts
import container from '@/browser'
const ws = container.client('websocket', { baseURL: 'ws://localhost:8081' })
```

Both follow the same Luca patterns you already know: state, events, caching.

## Part 1: The Server (NodeContainer)

### Setting Up the WebSocket Server

The `WebsocketServer` uses the `ws` library under the hood. It auto-registers in the `servers` registry when you import the server module.

```ts
// server.ts
import container from '@/node'

const ws = container.server('websocket', { port: 8081 })

ws.on('connection', (socket) => {
  console.log('Client connected')

  // Send a welcome message to the new client
  ws.send(socket, { type: 'welcome', message: 'Hello from the server' })
})

ws.on('message', (rawData, socket) => {
  const data = JSON.parse(rawData.toString())
  console.log('Received:', data)

  // Echo back to the sender
  ws.send(socket, { type: 'echo', payload: data })
})

await ws.start()
console.log(`WebSocket server listening on port ${ws.port}`)
```

### Server API

The `WebsocketServer` gives you:

| Method / Property | What it does |
|---|---|
| `start()` | Begins listening for connections |
| `send(socket, message)` | Send JSON to a specific client |
| `broadcast(message)` | Send JSON to all connected clients |
| `connections` | `Set` of all active client sockets |
| `wss` | The underlying `ws.WebSocketServer` instance |
| `port` | The port being listened on (default `8081`) |

### Broadcasting

Send a message to every connected client at once:

```ts
ws.on('message', (rawData, socket) => {
  const data = JSON.parse(rawData.toString())

  // If someone sends a chat message, broadcast it to everyone
  if (data.data?.type === 'chat') {
    ws.broadcast({
      type: 'chat',
      from: data.id,
      text: data.data.text,
    })
  }
})
```

### Port Management

The server integrates with the container's `networking` feature for port management. Calling `configure()` before `start()` will find an open port if the requested one is taken:

```ts
const ws = container.server('websocket', { port: 8081 })
await ws.configure() // finds open port if 8081 is busy
await ws.start()
console.log(`Actually listening on port ${ws.port}`)
```

`start()` calls `configure()` automatically if it hasn't been called yet.

## Part 2: The Client (WebContainer)

### Connecting from the Browser

The `SocketClient` uses `isomorphic-ws`, so it works in any browser environment. It wraps every message in an envelope with a UUID for tracing.

```ts
// app.ts (browser)
import container from '@/browser'

const ws = container.client('websocket', {
  baseURL: 'ws://localhost:8081',
  reconnect: true, // auto-reconnect on disconnect
})

await ws.connect()

ws.on('message', (event) => {
  const data = JSON.parse(event.data)
  console.log('Server says:', data)
})

// Send a message — auto-wrapped in { id: uuid, data: ... }
await ws.send({ type: 'chat', text: 'Hello from the browser!' })
```

### Client API

| Method / Property | What it does |
|---|---|
| `connect()` | Opens the WebSocket connection |
| `send(data)` | Sends JSON (auto-wrapped with a UUID envelope) |
| `isConnected` | Whether the connection is active |
| `hasError` | Whether the last connection attempt failed |
| `ws` | The underlying WebSocket instance |

### Auto-Reconnect

When `reconnect: true` is set, the client listens for `close` events and automatically calls `connect()` again:

```ts
const ws = container.client('websocket', {
  baseURL: 'ws://localhost:8081',
  reconnect: true,
})

// Will keep trying to reconnect if the server goes down
await ws.connect()
```

### Lazy Connection

The `send()` method auto-connects if you haven't called `connect()` yet:

```ts
const ws = container.client('websocket', { baseURL: 'ws://localhost:8081' })

// No explicit connect() needed — send() handles it
await ws.send({ type: 'ping' })
```

## Part 3: Putting It All Together

Here's a complete example: a server that exposes the container's runtime information over WebSockets, and a browser client that queries it.

### Server

```ts
// scripts/ws-server.ts
import container from '@/node'

const ws = container.server('websocket', { port: 8081 })

ws.on('connection', (socket) => {
  console.log('Client connected')
  ws.send(socket, {
    type: 'connected',
    features: container.features.available,
  })
})

ws.on('message', (rawData, socket) => {
  const { id, data } = JSON.parse(rawData.toString())

  switch (data.type) {
    case 'ping':
      ws.send(socket, { type: 'pong', replyTo: id })
      break

    case 'getState':
      ws.send(socket, {
        type: 'state',
        replyTo: id,
        state: container.currentState,
      })
      break

    case 'getGitInfo':
      ws.send(socket, {
        type: 'gitInfo',
        replyTo: id,
        branch: container.git.branch,
        sha: container.git.sha,
      })
      break

    case 'exec':
      container.proc.exec(data.command).then((result) => {
        ws.send(socket, {
          type: 'execResult',
          replyTo: id,
          stdout: result.stdout,
          stderr: result.stderr,
        })
      })
      break

    default:
      ws.send(socket, { type: 'unknown', replyTo: id })
  }
})

// Broadcast state changes to all clients
container.state.observe(() => {
  ws.broadcast({
    type: 'stateChanged',
    state: container.currentState,
  })
})

await ws.start()
console.log(`WebSocket server ready on ws://localhost:${ws.port}`)
```

### Browser Client

```ts
// src/app.ts (browser bundle)
import container from '@/browser'

const ws = container.client('websocket', {
  baseURL: 'ws://localhost:8081',
  reconnect: true,
})

// Track server state in an observable
const serverState = container.newState({
  connected: false,
  branch: '',
  features: [] as string[],
})

ws.on('message', (event) => {
  const msg = JSON.parse(event.data)

  switch (msg.type) {
    case 'connected':
      serverState.set('connected', true)
      serverState.set('features', msg.features)
      break

    case 'gitInfo':
      serverState.set('branch', msg.branch)
      break

    case 'stateChanged':
      console.log('Server state updated:', msg.state)
      break
  }
})

// React to our local state changes
serverState.observe(() => {
  const s = serverState.current
  console.log(`Connected: ${s.connected}, Branch: ${s.branch}`)
})

await ws.connect()

// Query the server
await ws.send({ type: 'getGitInfo' })
await ws.send({ type: 'ping' })
```

## Part 4: Combining with Express

A common pattern is running both an Express HTTP server and a WebSocket server from the same container:

```ts
import container from '@/node'

// HTTP server for REST API
const http = container.server('express', { port: 3000 })
http.app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', wsClients: ws.connections.size })
})

// WebSocket server for real-time updates
const ws = container.server('websocket', { port: 8081 })
ws.on('connection', (socket) => {
  ws.send(socket, { type: 'welcome' })
})

// When something happens via REST, notify WebSocket clients
http.app.post('/api/events', (req, res) => {
  ws.broadcast({ type: 'event', payload: req.body })
  res.json({ sent: true, clients: ws.connections.size })
})

await Promise.all([http.start(), ws.start()])
console.log(`HTTP on :${http.port}, WS on :${ws.port}`)
```

## Message Envelope Format

The `SocketClient` automatically wraps outgoing messages in an envelope:

```ts
// When you call:
await ws.send({ type: 'hello', text: 'hi' })

// The server receives:
{
  "id": "550e8400-e29b-41d4-a716-446655440000",  // UUID for tracing
  "data": { "type": "hello", "text": "hi" }
}
```

This makes it easy to implement request/reply patterns on the server side — match `replyTo` to the original `id`.

## Building a Typed Protocol

For production apps, define your message types and build a thin abstraction:

```ts
// shared/protocol.ts — shared between server and client
interface ServerMessages {
  welcome: { features: string[] }
  pong: { replyTo: string }
  stateChanged: { state: Record<string, any> }
  error: { message: string; replyTo?: string }
}

interface ClientMessages {
  ping: {}
  getState: {}
  subscribe: { channel: string }
}
```

### Server-side helper

```ts
// On the server, wrap the raw WebsocketServer
function createProtocol(ws: WebsocketServer) {
  return {
    onMessage<T extends keyof ClientMessages>(
      type: T,
      handler: (data: ClientMessages[T], socket: any, id: string) => void
    ) {
      ws.on('message', (rawData, socket) => {
        const { id, data } = JSON.parse(rawData.toString())
        if (data.type === type) {
          handler(data, socket, id)
        }
      })
    },

    reply<T extends keyof ServerMessages>(
      socket: any,
      type: T,
      data: ServerMessages[T]
    ) {
      ws.send(socket, { type, ...data })
    },
  }
}

const proto = createProtocol(ws)

proto.onMessage('ping', (data, socket, id) => {
  proto.reply(socket, 'pong', { replyTo: id })
})
```

## Key Differences Between the Containers

| | NodeContainer | WebContainer |
|---|---|---|
| **Import** | `import container from '@/node'` | `import container from '@/browser'` |
| **WebSocket role** | Server (`container.server('websocket')`) | Client (`container.client('websocket')`) |
| **Library** | `ws` (Node native) | `isomorphic-ws` (browser compat) |
| **Default port** | `8081` | N/A (connects to server) |
| **Auto-enabled features** | fs, git, proc, os, networking, ui, vm | None (opt-in) |
| **Available features** | 26+ node features | asset-loader, speech, voice, vault, vm, esbuild |

## Next Steps

- [Getting Started](./getting-started.md) — the fundamentals of the container
- [Creating Express Servers](./express-server.md) — pair HTTP with WebSockets
- [Creating REST Clients](./rest-clients.md) — the client pattern in depth
