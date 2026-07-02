# SocketRepl (features.socketRepl)

> Stability: `stable`

Socket REPL — a WebSocket-powered interactive read-eval-print loop. Exposes a REPL session over WebSocket so remote clients (browser, other process, terminal UI) can evaluate expressions in a sandboxed VM context populated with the container and its helpers. Each connected client gets its own session tracking but shares the same VM context. Supports tab completion and async/await. Messages use JSON framing: - Client → Server: `{ type: "eval", input: "expression" }` - Client → Server: `{ type: "complete", partial: "container.fea" }` - Server → Client: `{ type: "prompt", prompt: "> " }` - Server → Client: `{ type: "result", value: "..." }` - Server → Client: `{ type: "error", message: "..." }` - Server → Client: `{ type: "completions", items: ["feature", "features"], partial: "fea" }`

## Usage

```ts
container.feature('socketRepl', {
  // Port for the WebSocket server (default: 8282)
  port,
  // The prompt string sent to clients (default: "> ")
  prompt,
  // Path to the REPL history file for command persistence
  historyPath,
})
```

## Options (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `port` | `number` | Port for the WebSocket server (default: 8282) |
| `prompt` | `string` | The prompt string sent to clients (default: "> ") |
| `historyPath` | `string` | Path to the REPL history file for command persistence |

## Methods

### start

Start the socket REPL server. Creates a VM context populated with the container and its helpers, starts a WebSocket server, and begins accepting REPL connections.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `{ port?: number, context?: any, historyPath?: string }` |  | Configuration for the REPL session |

`{ port?: number, context?: any, historyPath?: string }` properties:

| Property | Type | Description |
|----------|------|-------------|
| `port` | `any` | Port to listen on (default: 8282) |
| `context` | `any` | Additional variables to inject into the VM context |
| `historyPath` | `any` | Custom path for the history file |

**Returns:** `void`

```ts
const socketRepl = container.feature('socketRepl', { enable: true })
await socketRepl.start({
 port: 8282,
 context: { db: myDatabase },
})
```



### stop

Stop the socket REPL server and disconnect all clients.

**Returns:** `void`



## Getters

| Property | Type | Description |
|----------|------|-------------|
| `vmContext` | `any` | The VM context object used for evaluating expressions. |
| `isStarted` | `any` | Whether the REPL server is currently running. |

## Events (Zod v4 schema)

### client:connected

A REPL client connected

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | Client ID |



### client:disconnected

A REPL client disconnected

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | Client ID |



### eval

An expression was evaluated

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | The input expression |
| `arg1` | `string` | Client ID |



### eval:result

An expression produced a result

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `any` | The result |
| `arg1` | `string` | Client ID |



### eval:error

An expression threw an error

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | Error message |
| `arg1` | `string` | Client ID |



## State (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `boolean` | Whether this feature is currently enabled |
| `started` | `boolean` | Whether the socket REPL server is running |
| `port` | `number` | The port the WebSocket server is listening on |
| `activeClients` | `number` | Number of connected REPL clients |

## Examples

**features.socketRepl**

```ts
const socketRepl = container.feature('socketRepl', { enable: true })
await socketRepl.start({ port: 8282, context: { myVar: 42 } })
```



**start**

```ts
const socketRepl = container.feature('socketRepl', { enable: true })
await socketRepl.start({
 port: 8282,
 context: { db: myDatabase },
})
```

