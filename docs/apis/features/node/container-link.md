# ContainerLink (features.containerLink)

ContainerLink (Web-side) — WebSocket client that connects to a node host. Connects to a ContainerLink host over WebSocket. The host can evaluate code in this container, and the web side can emit structured events to the host. The web side can NEVER eval code in the host — trust is strictly one-way.

## Usage

```ts
container.feature('containerLink')
```

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

Event emitted by ContainerLink



### disconnected

Event emitted by ContainerLink



### evalRequest

Event emitted by ContainerLink



### reconnecting

Event emitted by ContainerLink



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

