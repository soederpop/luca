# WebsocketServer (servers.websocket)

WebsocketServer helper

## Usage

```ts
container.server('websocket', {
  // Port number to listen on
  port,
  // Hostname or IP address to bind to
  host,
  // Whether to automatically JSON parse/stringify messages
  json,
})
```

## Options

| Property | Type | Description |
|----------|------|-------------|
| `port` | `number` | Port number to listen on |
| `host` | `string` | Hostname or IP address to bind to |
| `json` | `boolean` | Whether to automatically JSON parse/stringify messages |

## Methods

### broadcast

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `message` | `any` | ✓ | Parameter message |

**Returns:** `void`



### send

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `ws` | `any` | ✓ | Parameter ws |
| `message` | `any` | ✓ | Parameter message |

**Returns:** `void`



### start

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `StartOptions` |  | Parameter options |

**Returns:** `void`



## Getters

| Property | Type | Description |
|----------|------|-------------|
| `wss` | `any` |  |
| `port` | `any` |  |

## Events

### connection

Event emitted by WebsocketServer



### message

Event emitted by WebsocketServer



## State

| Property | Type | Description |
|----------|------|-------------|
| `port` | `number` | The port the server is bound to |
| `listening` | `boolean` | Whether the server is actively listening for connections |
| `configured` | `boolean` | Whether the server has been configured |
| `stopped` | `boolean` | Whether the server has been stopped |