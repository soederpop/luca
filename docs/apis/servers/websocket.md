# WebsocketServer (servers.websocket)

> Stability: `stable`

WebSocket server built on the `ws` library with optional JSON message framing. Manages WebSocket connections, tracks connected clients, and bridges messages to Luca's event bus. When `json` mode is enabled, incoming messages are automatically JSON-parsed (with `.toString()` for Buffer data); a binary frame that is not valid JSON is passed through untouched. When `json` mode is disabled, raw message data is emitted as-is. Outgoing `send()` / `broadcast()` frame the payload with {@link encodeWireFrame}: objects become JSON, but a `Buffer`/`ArrayBuffer`/ typed array is sent as a raw binary frame and a `string` as a raw text frame. So binary transport (audio, protobuf, etc.) is a first-class option — no need to base64 into JSON or drop to the raw `wss` getter. Supports ask/reply semantics when paired with the Luca WebSocket client. The server can `ask(ws, type, data)` a connected client and await a typed response, or handle incoming asks from clients by listening for messages with a `requestId` and replying via `send(ws, { replyTo, data })`. Requests time out if no reply arrives within the configurable window.

## Usage

```ts
container.server('websocket', {
  // Port number to listen on
  port,
  // Hostname or IP address to bind to
  host,
  // When enabled, incoming messages are automatically JSON-parsed before emitting the message event (binary frames that are not valid JSON are passed through untouched). Note: outgoing send/broadcast always frame objects as JSON regardless of this flag — this option only controls inbound parsing.
  json,
  // Attach to an existing HTTP server via the WebSocket Upgrade handshake instead of binding a port. Accepts a Node http.Server or a Luca express server. When it is an express server that has not started yet, attachment is deferred until it begins listening — so a WebSocket and an HTTP API can share one port.
  server,
  // Create the server in noServer mode: it binds no port and performs no upgrade handling of its own. Drive it manually by calling handleUpgrade(request, socket, head) from your own HTTP server's "upgrade" event.
  noServer,
  // Only accept WebSocket connections whose request path matches this value (e.g. "/ws"). Lets HTTP routes and WebSocket connections coexist on one shared port without colliding.
  path,
})
```

## Options (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `port` | `number` | Port number to listen on |
| `host` | `string` | Hostname or IP address to bind to |
| `json` | `boolean` | When enabled, incoming messages are automatically JSON-parsed before emitting the message event (binary frames that are not valid JSON are passed through untouched). Note: outgoing send/broadcast always frame objects as JSON regardless of this flag — this option only controls inbound parsing. |
| `server` | `any` | Attach to an existing HTTP server via the WebSocket Upgrade handshake instead of binding a port. Accepts a Node http.Server or a Luca express server. When it is an express server that has not started yet, attachment is deferred until it begins listening — so a WebSocket and an HTTP API can share one port. |
| `noServer` | `boolean` | Create the server in noServer mode: it binds no port and performs no upgrade handling of its own. Drive it manually by calling handleUpgrade(request, socket, head) from your own HTTP server's "upgrade" event. |
| `path` | `string` | Only accept WebSocket connections whose request path matches this value (e.g. "/ws"). Lets HTTP routes and WebSocket connections coexist on one shared port without colliding. |

## Methods

### handleUpgrade

Feed an HTTP `upgrade` event to this server. Only meaningful in `noServer` mode — wire it from your own http.Server: `httpServer.on('upgrade', (req, socket, head) => wsServer.handleUpgrade(req, socket, head))`.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `request` | `any` | ✓ | Parameter request |
| `socket` | `any` | ✓ | Parameter socket |
| `head` | `any` | ✓ | Parameter head |

**Returns:** `void`



### broadcast

Send a message to every connected client. Objects are JSON-encoded; a `Buffer`/`ArrayBuffer`/typed array is broadcast as a raw binary frame and a `string` as a raw text frame (see {@link encodeWireFrame}). The frame is encoded once and reused across all connections.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `message` | `any` | ✓ | Parameter message |

**Returns:** `Promise<this>`



### send

Send a message to one client. Objects are JSON-encoded; a `Buffer`/`ArrayBuffer`/typed array is sent as a raw binary frame and a `string` as a raw text frame (see {@link encodeWireFrame}).

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `ws` | `any` | ✓ | Parameter ws |
| `message` | `any` | ✓ | Parameter message |

**Returns:** `Promise<this>`



### ask

Send a request to a specific client and wait for a correlated response. The client is expected to reply with a message whose `replyTo` matches the `requestId` of this message.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `ws` | `any` | ✓ | The WebSocket client to ask |
| `type` | `string` | ✓ | A string identifying the request type |
| `data` | `any` |  | Optional payload |
| `timeout` | `any` |  | How long to wait (default 10 000 ms) |

**Returns:** `Promise<R>`

```ts
const server = container.server('websocket', { json: true })
const port = await container.feature('networking').findOpenPort(8190)
await server.start({ port })
const firstConnection = new Promise((resolve) => server.on('connection', resolve))

// a connected Luca websocket client replies by echoing requestId as replyTo
const client = container.client('websocket', { baseURL: `ws://localhost:${port}` })
client.on('message', (msg) => {
 if (msg?.requestId) client.send({ replyTo: msg.requestId, data: { name: 'my-client' } })
})
await client.connect()

const socket = await firstConnection
const info = await server.ask(socket, 'identify')
console.log('Client says:', info)   // { name: 'my-client' }

await client.disconnect()
await server.stop()
```



### start

Start the WebSocket server. A runtime `port` overrides the constructor option and is written to state before the underlying `ws.Server` is created, so the server binds to the correct port.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `StartOptions` |  | Optional runtime overrides for port and host |

**Returns:** `Promise<this>`



### stop

**Returns:** `Promise<this>`



## Getters

| Property | Type | Description |
|----------|------|-------------|
| `wss` | `BaseServer` | The underlying `ws` WebSocketServer, built lazily on first access. The construction mode is chosen from options: `noServer` builds a manual server (drive it with {@link handleUpgrade}); an attached `server` (raw http.Server, or an already-listening express server) shares that server's port via the Upgrade handshake; otherwise it binds its own `port`. A `path` option, when set, is applied in every mode. |
| `port` | `number` | The port this server will bind to. Defaults to 8081 if not set via constructor options or start(). |

## Events (Zod v4 schema)

### attached

Fires when a deferred attachment completes — i.e. an express server passed as the `server` option has started listening and the WebSocket is now sharing its port

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `any` | The Node http.Server the WebSocket server attached to |



### connection

Fires when a new client connects

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `any` | The raw WebSocket client instance from the ws library |



### message

Fires when a message is received from a client. Handler signature: (data, ws)

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `any` | The message data (JSON-parsed object when json option is enabled, raw Buffer/string otherwise) |
| `arg1` | `any` | The WebSocket client that sent the message — use with server.send(ws, data) to reply |



## State (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `port` | `number` | The port the server is bound to |
| `listening` | `boolean` | Whether the server is actively listening for connections |
| `configured` | `boolean` | Whether the server has been configured |
| `stopped` | `boolean` | Whether the server has been stopped |

## Examples

**servers.websocket**

```ts
const server = container.server('websocket', { json: true })
const port = await container.feature('networking').findOpenPort(8180)
await server.start({ port })

server.on('message', (data, client) => {
 console.log('Received:', data)
})

// a Luca websocket client on the other end — it answers asks from the
// server by echoing the requestId back as replyTo
const firstConnection = new Promise((resolve) => server.on('connection', resolve))
const client = container.client('websocket', { baseURL: `ws://localhost:${port}` })
client.on('message', (msg) => {
 if (msg?.requestId) client.send({ replyTo: msg.requestId, data: { name: 'my-client' } })
})
await client.connect()
await client.send({ type: 'hello' })      // -> Received: { type: 'hello' }

// ask/reply: request info from a connected client and await its answer
const socket = await firstConnection
const info = await server.ask(socket, 'identify')
console.log('Client says:', info)         // { name: 'my-client' }

await client.disconnect()
await server.stop()
```



**ask**

```ts
const server = container.server('websocket', { json: true })
const port = await container.feature('networking').findOpenPort(8190)
await server.start({ port })
const firstConnection = new Promise((resolve) => server.on('connection', resolve))

// a connected Luca websocket client replies by echoing requestId as replyTo
const client = container.client('websocket', { baseURL: `ws://localhost:${port}` })
client.on('message', (msg) => {
 if (msg?.requestId) client.send({ replyTo: msg.requestId, data: { name: 'my-client' } })
})
await client.connect()

const socket = await firstConnection
const info = await server.ask(socket, 'identify')
console.log('Client says:', info)   // { name: 'my-client' }

await client.disconnect()
await server.stop()
```

