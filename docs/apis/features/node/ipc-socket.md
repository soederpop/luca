# IpcSocket (features.ipcSocket)

IpcSocket Feature - Inter-Process Communication via Unix Domain Sockets This feature provides robust IPC (Inter-Process Communication) capabilities using Unix domain sockets. It supports both server and client modes, allowing processes to communicate efficiently through file system-based socket connections. **Key Features:** - Hub-and-spoke: one server, many named clients with identity tracking - Targeted messaging: sendTo(clientId), broadcast(msg, excludeId) - Request/reply: ask() + reply() with timeout-based correlation - Auto-reconnect: clients reconnect with exponential backoff - Stale socket detection: probeSocket() before listen() - Clean shutdown: stopServer() removes socket file **Server (Hub):** ```typescript const ipc = container.feature('ipcSocket'); await ipc.listen('/tmp/hub.sock', true); ipc.on('connection', (clientId, socket) => { console.log('Client joined:', clientId); }); ipc.on('message', (data, clientId) => { console.log(`From ${clientId}:`, data); // Reply to sender, or ask and wait ipc.sendTo(clientId, { ack: true }); }); ``` **Client (Spoke):** ```typescript const ipc = container.feature('ipcSocket'); await ipc.connect('/tmp/hub.sock', { reconnect: true, name: 'worker-1' }); // Fire and forget await ipc.send({ type: 'status', ready: true }); // Request/reply ipc.on('message', (data) => { if (data.requestId) ipc.reply(data.requestId, { result: 42 }); }); ```

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

// With automatic lock removal
const server = await ipc.listen('/tmp/myapp.sock', true);

// Handle connections and messages
ipc.on('connection', (socket) => {
 console.log('New client connected');
});

ipc.on('message', (data) => {
 console.log('Received message:', data);
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

Broadcasts a message to all connected clients (server mode only).

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `message` | `any` | ✓ | The message object to broadcast |
| `exclude` | `string` |  | Optional client ID to exclude from broadcast |

**Returns:** `this`



### sendTo

Sends a message to a specific client by ID (server mode only).

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `clientId` | `string` | ✓ | The target client ID |
| `message` | `any` | ✓ | The message to send |

**Returns:** `boolean`



### send

Fire-and-forget: sends a message to the server (client mode only). For server→client, use sendTo() or broadcast().

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `message` | `any` | ✓ | The message to send |

**Returns:** `Promise<void>`



### ask

Sends a message and waits for a correlated reply. Works in both client and server mode. The recipient should call `reply(requestId, response)` to respond.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `message` | `any` | ✓ | The message to send |
| `options` | `{ clientId?: string; timeoutMs?: number }` |  | Optional: clientId (server mode target), timeoutMs |

**Returns:** `Promise<any>`



### reply

Sends a reply to a previous ask() call, correlated by requestId.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `requestId` | `string` | ✓ | The requestId from the incoming message |
| `data` | `any` | ✓ | The reply payload |
| `clientId` | `string` |  | Target client (server mode; for client mode, omit) |

**Returns:** `void`



### connect

Connects to an IPC server at the specified socket path (client mode).

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `socketPath` | `string` | ✓ | Path to the server's Unix domain socket |
| `options` | `{ reconnect?: boolean; name?: string }` |  | Optional: reconnect (enable auto-reconnect), name (identify this client) |

**Returns:** `Promise<Socket>`



### disconnect

Disconnects the client and stops any reconnection attempts.

**Returns:** `void`



### probeSocket

Probe an existing socket to see if a live listener is behind it. Attempts a quick connect — if it succeeds, someone is listening.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `socketPath` | `string` | ✓ | Parameter socketPath |

**Returns:** `Promise<boolean>`



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

**listen**

```ts
// Basic server setup
const server = await ipc.listen('/tmp/myapp.sock');

// With automatic lock removal
const server = await ipc.listen('/tmp/myapp.sock', true);

// Handle connections and messages
ipc.on('connection', (socket) => {
 console.log('New client connected');
});

ipc.on('message', (data) => {
 console.log('Received message:', data);
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

