# McpBridge (features.mcpBridge)

> Stability: `stable`

Bridges local stdio MCP servers to Luca assistants by discovering their tools and exposing them as first-class assistant tool calls.

## Usage

```ts
container.feature('mcpBridge', {
  // MCP server configurations keyed by server name
  servers,
  // Register discovered MCP tools as first-class assistant tools
  materializeTools,
  // Separator between server name and tool name for materialized tools
  separator,
})
```

## Options (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `servers` | `object` | MCP server configurations keyed by server name |
| `materializeTools` | `boolean` | Register discovered MCP tools as first-class assistant tools |
| `separator` | `string` | Separator between server name and tool name for materialized tools |

## Methods

### connectAll

Connect to all configured MCP servers, discover their capabilities, and cache the results. Safe to call multiple times (no-ops if already connected).

**Returns:** `Promise<void>`



### connectServer

Connect to a single MCP server, discover its tools/resources/prompts.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `name` | `string` | ✓ | Parameter name |
| `config` | `McpServerConfig` | ✓ | Parameter config |

**Returns:** `Promise<ConnectedServer>`



### disconnectAll

Disconnect from all MCP servers and clean up.

**Returns:** `Promise<void>`



### disconnectServer

Disconnect a single server.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `name` | `string` | ✓ | Parameter name |

**Returns:** `Promise<void>`



### listMcpCapabilities

List capabilities across all connected servers or a specific one.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `args` | `{ server?: string }` | ✓ | Parameter args |

**Returns:** `void`



### useMcpTool

Call a tool on a specific MCP server.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `args` | `{ server: string; tool: string; arguments?: string }` | ✓ | Parameter args |

**Returns:** `void`



### readMcpResource

Read a resource from a connected MCP server.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `args` | `{ server: string; uri: string }` | ✓ | Parameter args |

**Returns:** `void`



### getMcpPrompt

Get a prompt from a connected MCP server.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `args` | `{ server: string; name: string; arguments?: string }` | ✓ | Parameter args |

**Returns:** `void`



### setupToolsConsumer

When an assistant consumes this feature via `assistant.use(bridge)`: 1. Inject system prompt guidance about MCP capabilities. 2. Schedule async connection + tool materialization via the assistant's pending plugins mechanism (awaited during `assistant.start()`).

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `consumer` | `Helper` | ✓ | Parameter consumer |

**Returns:** `void`



### getServer

Get a connected server by name.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `name` | `string` | ✓ | Parameter name |

**Returns:** `ConnectedServer | undefined`



## Getters

| Property | Type | Description |
|----------|------|-------------|
| `connectedServers` | `string[]` | List all connected server names. |
| `allTools` | `Array<{ server: string; tool: McpToolInfo; materializedName: string }>` | Get all discovered tools across all servers, with their server name prefix. |

## Events (Zod v4 schema)

### serverError

Fired when an MCP server connection fails

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | server name |
| `arg1` | `string` | error message |



### serverConnected

Fired when an MCP server connects and its capabilities are discovered

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | server name |
| `arg1` | `number` | tool count |



### serverDisconnected

Fired when an MCP server disconnects

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | server name |



### toolCalled

Fired when a tool call is proxied to an MCP server

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | server name |
| `arg1` | `string` | tool name |



## State (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `boolean` | Whether this feature is currently enabled |
| `servers` | `object` | Status of each connected MCP server |

## Examples

**features.mcpBridge**

```ts
const bridge = container.feature('mcpBridge', {
 servers: {
   github: {
     command: 'npx',
     args: ['-y', '@modelcontextprotocol/server-github'],
     env: { GITHUB_TOKEN: process.env.GITHUB_TOKEN },
   },
 },
})
```

