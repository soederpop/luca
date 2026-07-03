# IpcSocket (features.ipcSocket)

> Stability: `stable`

IpcSocket Feature - Inter-Process Communication via Unix Domain Sockets This feature provides robust IPC (Inter-Process Communication) capabilities using Unix domain sockets. It supports both server and client modes, allowing processes to communicate efficiently through file system-based socket connections. **Key Features:** - Hub-and-spoke: one server, many named clients with identity tracking - Targeted messaging: sendTo(clientId), broadcast(msg, excludeId) - Request/reply: ask() + reply() with timeout-based correlation - Auto-reconnect: clients reconnect with exponential backoff - Stale socket detection: probeSocket() before listen() - Clean shutdown: stopServer() removes socket file **CLI commands: an open socket keeps the process alive.** A `luca` command that connects as a client will hang after its work is done — the live socket (and reconnect timers, when `reconnect: true`) keep the event loop running. Call `ipc.disconnect()` (client) or `await ipc.stopServer()` (server) when finished, and if the process still lingers, end with `process.exit(0)`. **Mode locking:** a single IpcSocket instance is locked to one role — the first `listen()` locks it into server mode and the first `connect()` locks it into client mode (attempting the other call afterwards throws). To act as both server and client within one process, create two distinct instances, e.g. by passing different options: `container.feature('ipcSocket', { role: 'server' })` and `container.feature('ipcSocket', { role: 'client' })`. **Server (Hub):** ```typescript const ipc = container.feature('ipcSocket'); await ipc.listen('/tmp/hub.sock', true); ipc.on('connection', (clientId, socket) => { console.log('Client joined:', clientId); }); ipc.on('message', (data, clientId) => { console.log(`From ${clientId}:`, data); // Incoming ask() requests carry a requestId — reply to complete them if (data.requestId) ipc.reply(data.requestId, { result: 42 }, clientId); // Or fire-and-forget back to the sender else ipc.sendTo(clientId, { ack: true }); }); ``` **Client (Spoke):** ```typescript const ipc = container.feature('ipcSocket'); await ipc.connect('/tmp/hub.sock', { reconnect: true, name: 'worker-1' }); // Fire and forget await ipc.send({ type: 'status', ready: true }); // Request/reply: ask the server and await its reply const answer = await ipc.ask({ type: 'question' }); // Answer asks initiated by the server ipc.on('message', (data) => { if (data.requestId) ipc.reply(data.requestId, { result: 42 }); }); ```

## Usage

```ts
container.feature('ipcSocket')
```

## Methods

### listen

Starts the IPC server listening on the specified socket path. This method sets up a Unix domain socket server that can accept multiple client connections. Each connected client is tracked, and the server automatically handles connection lifecycle events. Messages received from clients are JSON-parsed and emitted as 'message' events. **Server Behavior:** - Tracks all connected clients in the sockets Set - Automatically removes clients when they disconnect - JSON-parses incoming messages and emits 'message' events - Emits 'connection' events when clients connect - Prevents starting multiple servers on the same instance **Socket File Management:** - Resolves the socket path relative to the container's working directory - Optionally removes existing socket files to prevent "address in use" errors - Throws error if socket file exists and removeLock is false

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `socketPath` | `string` | ✓ | The file system path for the Unix domain socket |
| `removeLock` | `any` |  | Whether to remove existing socket file (default: false) |

**Returns:** `Promise<Server>`

```ts
// Basic server setup
const server = await ipc.listen('/tmp/myapp.sock');

// With automatic stale-socket removal (probes first; throws if a live
// process is already listening on the path)
const server2 = await ipc.listen('/tmp/myapp2.sock', true);

// Handle connections and messages — both events include the client ID
ipc.on('connection', (clientId, socket) => {
 console.log('New client connected:', clientId);
});

ipc.on('message', (data, clientId) => {
 console.log(`Received from ${clientId}:`, data);
 // Echo back to all clients
 ipc.broadcast({ echo: data });
});
```



### stopServer

Stops the IPC server and cleans up all connections. This method gracefully shuts down the server by: 1. Closing the server listener 2. Destroying all active client connections 3. Clearing the sockets tracking set 4. Resetting the server instance

**Returns:** `Promise<void>`

```ts
// Graceful shutdown
try {
 await ipc.stopServer();
 console.log('IPC server stopped successfully');
} catch (error) {
 console.error('Failed to stop server:', error.message);
}
```



### broadcast

Broadcasts a message to all connected clients (server mode only). Each connected client receives the broadcast as a `message` event. Messages are JSON-encoded in an envelope carrying a UUID for correlation. Clients whose sockets are no longer writable are silently skipped.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `message` | `any` | ✓ | The message object to broadcast |
| `exclude` | `string` |  | Optional client ID to exclude from broadcast |

**Returns:** `this`

```ts
ipc.broadcast({
 type: 'notification',
 message: 'Deployment starting',
 timestamp: Date.now()
})
```



### sendTo

Sends a message to a specific client by ID (server mode only).

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `clientId` | `string` | ✓ | The target client ID |
| `message` | `any` | ✓ | The message to send |

**Returns:** `boolean`

```ts
// Reply directly to the sender of an incoming message
ipc.on('message', (data, clientId) => {
 if (clientId) ipc.sendTo(clientId, { ack: true })
})
```



### send

Fire-and-forget: sends a message to the server (client mode only). For server→client, use sendTo() or broadcast(). When you need a correlated response, use ask() instead.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `message` | `any` | ✓ | The message to send |

**Returns:** `Promise<void>`

```ts
await ipc.connect('/tmp/hub.sock')
await ipc.send({ type: 'status', ready: true })
```



### ask

Sends a message and waits for a correlated reply. Works in both client and server mode. On the receiving side the message is delivered via the 'message' event with a `requestId` property merged onto the payload; the recipient should call `reply(requestId, response)` (plus the sender's clientId when replying from a server) to resolve this promise.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `message` | `any` | ✓ | The message to send |
| `options` | `{ clientId?: string; timeoutMs?: number }` |  | Optional: clientId (server mode target), timeoutMs |

**Returns:** `Promise<any>`

```ts
// Client asking the server
const answer = await ipc.ask({ type: 'sum', numbers: [1, 2, 3] })

// Server asking a specific client
const status = await ipc.ask({ type: 'ping' }, { clientId, timeoutMs: 2000 })
```



### reply

Sends a reply to a previous ask() call, correlated by requestId. Incoming ask() requests surface their `requestId` on the payload delivered to the 'message' event, so a handler can correlate the reply: ```typescript // Server side — the 'message' handler receives (data, clientId) ipc.on('message', (data, clientId) => { if (data.requestId) ipc.reply(data.requestId, { result: 42 }, clientId) }) ```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `requestId` | `string` | ✓ | The requestId from the incoming message |
| `data` | `any` | ✓ | The reply payload |
| `clientId` | `string` |  | Target client (required in server mode; omit in client mode) |

**Returns:** `void`



### connect

Connects to an IPC server at the specified socket path (client mode).

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `socketPath` | `string` | ✓ | Path to the server's Unix domain socket |
| `options` | `{ reconnect?: boolean; name?: string }` |  | Optional: reconnect (enable auto-reconnect with exponential backoff), name (identify this client to the server) |

**Returns:** `Promise<Socket>`

```ts
const ipc = container.feature('ipcSocket')
await ipc.connect('/tmp/hub.sock', { reconnect: true, name: 'worker-1' })

ipc.on('message', (data) => {
 console.log('From server:', data)
})

// The server assigns this client an ID on connect
console.log('My client id:', ipc.clientId)
```



### disconnect

Disconnects the client and stops any reconnection attempts. Call this when a CLI command finishes its work — an open socket (and any reconnect timers) keeps the event loop alive, so a command that skips disconnect() will hang instead of exiting.

**Returns:** `void`

```ts
const answer = await ipc.ask({ type: 'status' })
ipc.disconnect() // let the process exit cleanly
```



### probeSocket

Probe an existing socket to see if a live listener is behind it. Attempts a quick connect (500ms timeout) — if it succeeds, someone is listening. Used internally by listen(socketPath, true) to distinguish a stale socket file (safe to remove) from one owned by a live process.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `socketPath` | `string` | ✓ | Path to the socket file to probe |

**Returns:** `Promise<boolean>`

```ts
const alive = await ipc.probeSocket('/tmp/hub.sock')
if (!alive) {
 await ipc.listen('/tmp/hub.sock', true)
}
```



## Getters

| Property | Type | Description |
|----------|------|-------------|
| `isClient` | `boolean` | Checks if the IPC socket is operating in client mode. |
| `isServer` | `boolean` | Checks if the IPC socket is operating in server mode. |
| `clientCount` | `number` | Returns the number of currently connected clients (server mode). |
| `connectedClients` | `Array<{ id: string; name?: string; connectedAt: number }>` | Returns info about all connected clients (server mode). |
| `connection` | `Socket | undefined` | Gets the current client connection socket. |

## Events (Zod v4 schema)

### disconnection

Event emitted by IpcSocket



### connection

Event emitted by IpcSocket



### message

Event emitted by IpcSocket



## State (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `boolean` | Whether this feature is currently enabled |

## Examples

**features.ipcSocket**

```ts
// Complete request/reply roundtrip in a single process.
// Passing distinct options yields two independent instances,
// one locked into server mode and one into client mode.
const hub = container.feature('ipcSocket', { role: 'server' })
const spoke = container.feature('ipcSocket', { role: 'client' })

const sock = `/tmp/ipc-example-${process.pid}.sock`
await hub.listen(sock, true) // `true` removes a stale socket file before binding

// Server side: ask() requests arrive on the 'message' event with a requestId —
// reply with it (plus the sender's clientId when replying from the server).
hub.on('message', (data, clientId) => {
 if (data.requestId && data.type === 'sum') {
   hub.reply(data.requestId, { sum: data.numbers.reduce((a, b) => a + b, 0) }, clientId)
 }
})

await spoke.connect(sock, { name: 'worker-1' })
const answer = await spoke.ask({ type: 'sum', numbers: [1, 2, 3] })
console.log(answer) // { sum: 6 }

// Fire-and-forget alternatives: send() (client→server), sendTo()/broadcast() (server→clients)

spoke.disconnect()
await hub.stopServer()
// In real projects the hub and spoke live in different processes —
// the API is identical; only the socket path is shared.
```



**listen**

```ts
// Basic server setup
const server = await ipc.listen('/tmp/myapp.sock');

// With automatic stale-socket removal (probes first; throws if a live
// process is already listening on the path)
const server2 = await ipc.listen('/tmp/myapp2.sock', true);

// Handle connections and messages — both events include the client ID
ipc.on('connection', (clientId, socket) => {
 console.log('New client connected:', clientId);
});

ipc.on('message', (data, clientId) => {
 console.log(`Received from ${clientId}:`, data);
 // Echo back to all clients
 ipc.broadcast({ echo: data });
});
```



**stopServer**

```ts
// Graceful shutdown
try {
 await ipc.stopServer();
 console.log('IPC server stopped successfully');
} catch (error) {
 console.error('Failed to stop server:', error.message);
}
```



**broadcast**

```ts
ipc.broadcast({
 type: 'notification',
 message: 'Deployment starting',
 timestamp: Date.now()
})
```



**sendTo**

```ts
// Reply directly to the sender of an incoming message
ipc.on('message', (data, clientId) => {
 if (clientId) ipc.sendTo(clientId, { ack: true })
})
```



**send**

```ts
await ipc.connect('/tmp/hub.sock')
await ipc.send({ type: 'status', ready: true })
```



**ask**

```ts
// Client asking the server
const answer = await ipc.ask({ type: 'sum', numbers: [1, 2, 3] })

// Server asking a specific client
const status = await ipc.ask({ type: 'ping' }, { clientId, timeoutMs: 2000 })
```



**connect**

```ts
const ipc = container.feature('ipcSocket')
await ipc.connect('/tmp/hub.sock', { reconnect: true, name: 'worker-1' })

ipc.on('message', (data) => {
 console.log('From server:', data)
})

// The server assigns this client an ID on connect
console.log('My client id:', ipc.clientId)
```



**disconnect**

```ts
const answer = await ipc.ask({ type: 'status' })
ipc.disconnect() // let the process exit cleanly
```



**probeSocket**

```ts
const alive = await ipc.probeSocket('/tmp/hub.sock')
if (!alive) {
 await ipc.listen('/tmp/hub.sock', true)
}
```

