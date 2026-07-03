# WebSocketClient (clients.websocket)

> Stability: `stable`

WebSocket client that bridges raw WebSocket events to Luca's Helper event bus, providing a clean interface for sending/receiving messages, tracking connection state (`state.connected`, `state.reconnectAttempts`), and optional auto-reconnection with exponential backoff (base `reconnectInterval`, doubled per attempt, capped at 30s, up to `maxReconnectAttempts`). Supports ask/reply semantics when paired with the Luca WebSocket server (`container.server('websocket')`). The client can `ask(type, data)` the server and await a typed response. In the other direction, an ask from the server arrives as a normal `message` event whose payload carries a `requestId`; answer it with `send({ replyTo: requestId, data })`. Asks time out (reject) if no reply arrives within the configurable window. Incoming messages are JSON-parsed when possible; non-JSON payloads are delivered as-is. Outgoing payloads are always `JSON.stringify`'d. Events emitted: - `open` — connection established - `message` — message received (JSON-parsed when possible) - `close` — connection closed (with code and reason) - `error` — connection error - `reconnecting` — attempting reconnection (with attempt number) **CLI commands: an open socket keeps the process alive.** A `luca` command that connects as a client will hang after its work is done — the live WebSocket (and any reconnect timers) keep the event loop running. Call `await ws.disconnect()` when finished, and if the process still lingers (other handles or pending timers), end with `process.exit(0)`.

## Usage

```ts
container.client('websocket', {
  // Base URL for the client connection
  baseURL,
  // Whether to automatically parse responses as JSON
  json,
  // Whether to automatically reconnect on disconnection
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
| `reconnect` | `boolean` | Whether to automatically reconnect on disconnection |
| `reconnectInterval` | `number` | Base interval in milliseconds between reconnection attempts |
| `maxReconnectAttempts` | `number` | Maximum number of reconnection attempts before giving up |

## Methods

### connect

Establish a WebSocket connection to the configured baseURL. Wires all raw WebSocket events (open, message, close, error) to the Helper event bus and updates connection state accordingly. Resolves once the connection is open; rejects on error. Calling connect() while already connected is a no-op that resolves immediately.

**Returns:** `Promise<this>`

```ts
const ws = container.client('websocket', { baseURL: 'ws://localhost:8080' })
ws.on('open', () => console.log('connected'))
ws.on('close', (code, reason) => console.log('closed', code, reason))
await ws.connect()
console.log(ws.state.get('connected'))   // true
```



### send

Send data over the WebSocket connection. Automatically JSON-serializes the payload. If not currently connected, attempts to connect first (so an explicit connect() call beforehand is optional).

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `data` | `any` | ✓ | The data to send (will be JSON.stringify'd) |

**Returns:** `Promise<void>`

```ts
const ws = container.client('websocket', { baseURL: 'ws://localhost:8080' })
await ws.send({ type: 'hello', payload: { name: 'luca' } })  // auto-connects

// Answering an ask from the server: its message carries a requestId —
// reply by echoing it back as replyTo
ws.on('message', async (msg) => {
 if (msg?.requestId) {
   await ws.send({ replyTo: msg.requestId, data: { name: 'my-client' } })
 }
})
```



### ask

Send a request and wait for a correlated response. The message is sent with a unique `requestId`; the remote side is expected to reply with a message containing `replyTo` set to that same ID. Rejects if the reply carries an `error` field, or with a timeout Error if no reply arrives in time — so unlike the rest client, ask() failures DO throw and should be try/caught.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `type` | `string` | ✓ | A string identifying the request type |
| `data` | `any` |  | Optional payload to include with the request |
| `timeout` | `any` |  | How long to wait for a response (default 10 000 ms) |

**Returns:** `Promise<R>`

```ts
const ws = container.client('websocket', { baseURL: 'ws://localhost:8080' })
await ws.connect()

try {
 const user = await ws.ask('getUser', { id: 42 }, 5000)
 console.log(user)
} catch (err) {
 // reply carried an error field, or no reply within 5s
 console.error(err.message)   // e.g. 'ask("getUser") timed out after 5000ms'
}

// Server side (container.server('websocket')): messages with a requestId
// arrive with reply helpers attached
// server.on('message', (msg) => {
//   if (msg.type === 'getUser') msg.reply({ id: msg.data.id, name: 'Alice' })
// })
```



### disconnect

Gracefully close the WebSocket connection. Suppresses auto-reconnect, rejects any in-flight ask() promises with a 'WebSocket disconnected' error, and updates connection state to disconnected. Always call this at the end of CLI commands — an open socket keeps the process's event loop alive and the command will hang without it.

**Returns:** `Promise<this>`

```ts
const ws = container.client('websocket', { baseURL: 'ws://localhost:8080' })
await ws.connect()
await ws.send({ type: 'goodbye' })
await ws.disconnect()
console.log(ws.state.get('connected'))   // false
```



## Getters

| Property | Type | Description |
|----------|------|-------------|
| `hasError` | `any` | Whether the client is in an error state. |

## Events (Zod v4 schema)

### open

Emitted when the WebSocket connection is established



### error

Emitted when a WebSocket error occurs

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `any` | The error |



### message

Emitted when a message is received

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `any` | The parsed message data |



### close

Emitted when the WebSocket connection is closed

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `number` | Close code |
| `arg1` | `string` | Close reason |



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
| `connectionError` | `any` | The last connection error, if any |
| `reconnectAttempts` | `number` | Number of reconnection attempts made |

## Examples

**clients.websocket**

```ts
const ws = container.client('websocket', {
 baseURL: 'ws://localhost:8080',
 reconnect: true,
 maxReconnectAttempts: 5
})
ws.on('message', (data) => console.log('Received:', data))
await ws.connect()
await ws.send({ type: 'hello' })

// ask/reply: request data from the server and await its answer
const result = await ws.ask('getUser', { id: 42 })
console.log(result)

// done — close the socket so the process can exit
await ws.disconnect()
```



**connect**

```ts
const ws = container.client('websocket', { baseURL: 'ws://localhost:8080' })
ws.on('open', () => console.log('connected'))
ws.on('close', (code, reason) => console.log('closed', code, reason))
await ws.connect()
console.log(ws.state.get('connected'))   // true
```



**send**

```ts
const ws = container.client('websocket', { baseURL: 'ws://localhost:8080' })
await ws.send({ type: 'hello', payload: { name: 'luca' } })  // auto-connects

// Answering an ask from the server: its message carries a requestId —
// reply by echoing it back as replyTo
ws.on('message', async (msg) => {
 if (msg?.requestId) {
   await ws.send({ replyTo: msg.requestId, data: { name: 'my-client' } })
 }
})
```



**ask**

```ts
const ws = container.client('websocket', { baseURL: 'ws://localhost:8080' })
await ws.connect()

try {
 const user = await ws.ask('getUser', { id: 42 }, 5000)
 console.log(user)
} catch (err) {
 // reply carried an error field, or no reply within 5s
 console.error(err.message)   // e.g. 'ask("getUser") timed out after 5000ms'
}

// Server side (container.server('websocket')): messages with a requestId
// arrive with reply helpers attached
// server.on('message', (msg) => {
//   if (msg.type === 'getUser') msg.reply({ id: msg.data.id, name: 'Alice' })
// })
```



**disconnect**

```ts
const ws = container.client('websocket', { baseURL: 'ws://localhost:8080' })
await ws.connect()
await ws.send({ type: 'goodbye' })
await ws.disconnect()
console.log(ws.state.get('connected'))   // false
```

