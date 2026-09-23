# ContainerLink (features.containerLink)

> Stability: `stable`

ContainerLink (Web-side) — WebSocket client that connects to a node host. Connects to a ContainerLink host over WebSocket. The host can evaluate code in this container, and the web side can emit structured events to the host. The web side can NEVER eval code in the host — trust is strictly one-way.

## Usage

```ts
container.feature('containerLink', {
  // WebSocket URL of the host container (e.g. ws://localhost:8089)
  hostUrl,
  // Metadata to send during registration
  meta,
  // Capability tags to advertise to the host
  capabilities,
  // Whether to automatically reconnect on disconnection
  reconnect,
  // Base interval in ms between reconnection attempts
  reconnectInterval,
  // Maximum number of reconnection attempts
  maxReconnectAttempts,
})
```

## Options (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `hostUrl` | `string` | WebSocket URL of the host container (e.g. ws://localhost:8089) |
| `meta` | `object` | Metadata to send during registration |
| `capabilities` | `array` | Capability tags to advertise to the host |
| `reconnect` | `boolean` | Whether to automatically reconnect on disconnection |
| `reconnectInterval` | `number` | Base interval in ms between reconnection attempts |
| `maxReconnectAttempts` | `number` | Maximum number of reconnection attempts |

## Methods

### connect

Connect to the host WebSocket server and perform registration.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `hostUrl` | `string` |  | Override the configured host URL |

**Returns:** `Promise<this>`



### disconnect

Disconnect from the host.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `reason` | `string` |  | Optional reason string |

**Returns:** `void`



### emitToHost

Send a structured event to the host container.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `eventName` | `string` | ✓ | Name of the event |
| `data` | `any` |  | Optional event data |

**Returns:** `void`



## Getters

| Property | Type | Description |
|----------|------|-------------|
| `isConnected` | `boolean` | Whether currently connected to the host. |
| `token` | `string | undefined` | The auth token received from the host. |
| `hostId` | `string | undefined` | The host container's UUID. |

## Events (Zod v4 schema)

### connected

Emitted when successfully registered with the host

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | Host container UUID |



### disconnected

Emitted when disconnected from the host

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | Reason |



### evalRequest

Emitted before executing an eval request from the host

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | Code to evaluate |
| `arg1` | `string` | Request ID |



### reconnecting

Emitted when attempting to reconnect

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `number` | Attempt number |



## State (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `boolean` | Whether this feature is currently enabled |
| `connected` | `boolean` | Whether connected to the host |
| `token` | `string` | Auth token received from host during registration |
| `hostId` | `string` | UUID of the connected host container |
| `reconnectAttempts` | `number` | Number of reconnection attempts made |

## Examples

**features.containerLink**

```ts
const link = container.feature('containerLink', {
 enable: true,
 hostUrl: 'ws://localhost:8089',
})
await link.connect()

// Send events to the host
link.emitToHost('click', { x: 100, y: 200 })

// Listen for eval requests before they execute
link.on('evalRequest', (code, requestId) => {
 console.log('Host is evaluating:', code)
})
```

