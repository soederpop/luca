# SocketIOClient (clients.socketio)

> Stability: `stable`

Socket.IO client that bridges socket.io-client events to Luca's Helper event bus. Mirrors the WebSocket client interface so the two are interchangeable for connect/disconnect/send/ask workflows, while adding `fire()` for socket.io's native named-event emission. Reconnection is delegated to socket.io's built-in machinery. Calling `disconnect()` suppresses auto-reconnect — no extra flag needed. The `ask()` method uses socket.io acknowledgment callbacks rather than the requestId/replyTo correlation used by the WebSocket client — the server must invoke the ack callback. Events emitted: - `open` — connection established (maps from socket.io `connect`) - `message` — a `message` event was received - `close` — disconnected (with reason string) - `error` — connection error - `reconnecting` — attempting reconnection (with attempt number)

## Usage

```ts
container.client('socketio', {
  // Base URL for the client connection
  baseURL,
  // Whether to automatically parse responses as JSON
  json,
  // Socket.IO namespace to connect to (e.g. "/chat")
  namespace,
  // Server path, defaults to "/socket.io"
  path,
  // Allowed transports in preference order, defaults to ["websocket", "polling"]
  transports,
  // Whether to automatically reconnect on disconnection (default: true)
  reconnect,
  // Base interval in milliseconds between reconnection attempts
  reconnectInterval,
  // Maximum number of reconnection attempts before giving up
  maxReconnectAttempts,
})
```

## Options (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `baseURL` | `string` | Base URL for the client connection |
| `json` | `boolean` | Whether to automatically parse responses as JSON |
| `namespace` | `string` | Socket.IO namespace to connect to (e.g. "/chat") |
| `path` | `string` | Server path, defaults to "/socket.io" |
| `transports` | `array` | Allowed transports in preference order, defaults to ["websocket", "polling"] |
| `reconnect` | `boolean` | Whether to automatically reconnect on disconnection (default: true) |
| `reconnectInterval` | `number` | Base interval in milliseconds between reconnection attempts |
| `maxReconnectAttempts` | `number` | Maximum number of reconnection attempts before giving up |

## Methods

### connect

Establish a socket.io connection to the configured baseURL (+ optional namespace). The socket and its event listeners are created once — subsequent calls after a manual disconnect reuse the same socket instance without rewiring listeners. Resolves once connected; rejects on first connection error.

**Returns:** `Promise<this>`



### send

Emit the `message` event on the socket. Socket.IO handles its own framing, so no explicit JSON serialization is needed (unlike the WebSocket client). Connects first if not already connected.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `data` | `any` | ✓ | The data to send |

**Returns:** `Promise<void>`



### fire

Emit a named event on the socket — equivalent to `socket.emit(event, data)`. Use this for socket.io's named-event semantics beyond the generic `message` channel. Connects first if not already connected.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `event` | `string` | ✓ | The event name to emit |
| `data` | `any` |  | Optional payload |

**Returns:** `Promise<void>`

```ts
await sio.fire('join', { room: 'general' })
await sio.fire('typing', { userId: 1 })
```



### ask

Emit a named event and wait for the server's acknowledgment callback. The server must accept the ack as its last argument and call it to resolve: `socket.on('getUser', (data, ack) => ack({ data: result }))`. If the ack response has an `error` field the promise rejects with that error. If it has a `data` field, that value is resolved; otherwise the full response is returned.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `event` | `string` | ✓ | The event name to emit |
| `data` | `any` |  | Optional payload |
| `timeout` | `any` |  | How long to wait for acknowledgment (default 10 000 ms) |

**Returns:** `Promise<R>`

```ts
const user = await sio.ask('getUser', { id: 42 })
```



### disconnect

Gracefully close the socket.io connection. Calling `socket.disconnect()` suppresses socket.io's built-in auto-reconnect automatically.

**Returns:** `Promise<this>`



## Getters

| Property | Type | Description |
|----------|------|-------------|
| `hasError` | `any` | Whether the client is in an error state. |

## Events (Zod v4 schema)

### open

Emitted when the connection is established



### error

Emitted when a connection error occurs

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `any` | The error |



### message

Emitted when a "message" event is received

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `any` | The message data |



### close

Emitted when the connection is closed

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | Disconnect reason |



### reconnecting

Emitted when attempting to reconnect

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `number` | Attempt number |



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
| `socketId` | `string` | The socket ID assigned by the server |
| `connectionError` | `any` | The last connection error, if any |
| `reconnectAttempts` | `number` | Number of reconnection attempts made |

## Examples

**clients.socketio**

```ts
const sio = container.client('socketio', {
 baseURL: 'http://localhost:3000',
 namespace: '/chat',
 reconnect: true,
})
sio.on('message', (data) => console.log('Received:', data))
await sio.connect()
await sio.send({ text: 'hello' })

// named event emission
await sio.fire('join', { room: 'general' })

// ask with server-side ack: server must call the callback
const reply = await sio.ask('getUser', { id: 42 })
```



**fire**

```ts
await sio.fire('join', { room: 'general' })
await sio.fire('typing', { userId: 1 })
```



**ask**

```ts
const user = await sio.ask('getUser', { id: 42 })
```

