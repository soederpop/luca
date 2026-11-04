# McpBridge (features.mcpBridge)

> Stability: `stable`

Bridges MCP servers (local stdio or remote Streamable HTTP) to Luca assistants by discovering their tools and exposing them as first-class assistant tool calls.

## Usage

```ts
container.feature('mcpBridge', {
  // Path to a JSON file containing an mcpServers map, resolved relative to the container working directory. Loaded when connecting; a missing file warns and loads no servers. Strings may use ${VAR} or ${VAR:-default} to read environment variables.
  configFile,
  // MCP server configurations keyed by server name. Explicit entries replace matching entries from configFile.
  servers,
  // Server names to leave out, from configFile or servers. Lets one assistant share a project .mcp.json without getting every server in it.
  skipServers,
  // Register discovered MCP tools as first-class assistant tools
  materializeTools,
  // Separator between server name and tool name for materialized tools
  separator,
  // When an OAuth server has no valid login, open a browser and wait for it during connect. Default false: the server is marked auth-required and the others connect, so headless runs never hang. Log in ahead of time with bridge.login() or `luca mcp-auth login`.
  interactiveAuth,
})
```

## Options (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `configFile` | `string` | Path to a JSON file containing an mcpServers map, resolved relative to the container working directory. Loaded when connecting; a missing file warns and loads no servers. Strings may use ${VAR} or ${VAR:-default} to read environment variables. |
| `servers` | `object` | MCP server configurations keyed by server name. Explicit entries replace matching entries from configFile. |
| `skipServers` | `array` | Server names to leave out, from configFile or servers. Lets one assistant share a project .mcp.json without getting every server in it. |
| `materializeTools` | `boolean` | Register discovered MCP tools as first-class assistant tools |
| `separator` | `string` | Separator between server name and tool name for materialized tools |
| `interactiveAuth` | `boolean` | When an OAuth server has no valid login, open a browser and wait for it during connect. Default false: the server is marked auth-required and the others connect, so headless runs never hang. Log in ahead of time with bridge.login() or `luca mcp-auth login`. |

## Methods

### connectAll

Connect to all configured MCP servers, discover their capabilities, and cache the results. Safe to call multiple times (no-ops if already connected). Loads and validates configFile before connecting. A missing file warns and loads no servers; an unreadable or invalid file rejects.

**Returns:** `Promise<void>`



### loadServerConfigs

The merged server map: configFile entries (with ${VAR} expanded) overlaid by explicit `servers` options. Does not connect anything.

**Returns:** `Promise<Record<string, McpServerConfig>>`



### connectServer

Connect to a single MCP server, discover its tools/resources/prompts.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `name` | `string` | ✓ | Parameter name |
| `config` | `McpServerConfig` | ✓ | Parameter config |
| `connectOptions` | `{ interactiveAuth?: boolean }` |  | Parameter connectOptions |

**Returns:** `Promise<ConnectedServer>`



### login

Log in to OAuth servers by opening a browser, then connect them. With no name, logs in to every configured http server that needs it. A server with a valid stored login connects without opening anything.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `name` | `string` |  | One server name from the config. Omit for all. |

**Returns:** `Promise<Record<string, { status: string; error?: string }>>`

```ts
const bridge = container.feature('mcpBridge', { configFile: '.mcp.json' })
await bridge.login('fellow')
```



### logout

Forget the stored OAuth login (tokens and registered client) for a server and disconnect it. The next connect needs a fresh login.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `name` | `string` | ✓ | Server name from the config |

**Returns:** `Promise<void>`



### authStatus

Which configured http servers have a stored OAuth login. Reads the store only; it does not check that the tokens are still accepted.

**Returns:** `Promise<Record<string, { url: string; oauth: boolean; loggedIn: boolean; tokensSavedAt?: string; hasRefreshToken: boolean }>>`



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



### authRequired

Fired when an http server needs an OAuth login. In interactive mode the browser is opening; otherwise the server is left in auth-required.

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | server name |
| `arg1` | `string` | authorization URL |



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
   remote: {
     url: 'https://mcp.example.com/mcp',
     headers: { Authorization: `Bearer ${token}` },
   },
   fellow: { url: 'https://fellow.app/mcp' }, // OAuth, discovered automatically
 },
})
await bridge.login('fellow') // opens a browser once; later runs reuse the stored login
```



**login**

```ts
const bridge = container.feature('mcpBridge', { configFile: '.mcp.json' })
await bridge.login('fellow')
```

