# ClaudeCode (features.claudeCode)

No description provided

## Usage

```ts
container.feature('claudeCode', {
  // Path to the claude CLI binary
  claudePath,
  // Default model to use for sessions
  model,
  // Default working directory for sessions
  cwd,
  // Default system prompt prepended to all sessions
  systemPrompt,
  // Default append system prompt for all sessions
  appendSystemPrompt,
  // Default permission mode for Claude CLI sessions
  permissionMode,
  // Default allowed tools for sessions
  allowedTools,
  // Default disallowed tools for sessions
  disallowedTools,
  // Whether to stream partial messages token-by-token
  streaming,
  // MCP config file paths to pass to sessions
  mcpConfig,
  // MCP server configs keyed by name, injected into sessions via temp config file
  mcpServers,
  // Path to write a parseable NDJSON session log file
  fileLogPath,
  // Verbosity level for file logging. Defaults to "normal"
  fileLogLevel,
})
```

## Options

| Property | Type | Description |
|----------|------|-------------|
| `claudePath` | `string` | Path to the claude CLI binary |
| `model` | `string` | Default model to use for sessions |
| `cwd` | `string` | Default working directory for sessions |
| `systemPrompt` | `string` | Default system prompt prepended to all sessions |
| `appendSystemPrompt` | `string` | Default append system prompt for all sessions |
| `permissionMode` | `string` | Default permission mode for Claude CLI sessions |
| `allowedTools` | `array` | Default allowed tools for sessions |
| `disallowedTools` | `array` | Default disallowed tools for sessions |
| `streaming` | `boolean` | Whether to stream partial messages token-by-token |
| `mcpConfig` | `array` | MCP config file paths to pass to sessions |
| `mcpServers` | `object` | MCP server configs keyed by name, injected into sessions via temp config file |
| `fileLogPath` | `string` | Path to write a parseable NDJSON session log file |
| `fileLogLevel` | `string` | Verbosity level for file logging. Defaults to "normal" |

## Methods

### checkAvailability

Check if the Claude CLI is available and capture its version.

**Returns:** `Promise<boolean>`

```ts
const available = await cc.checkAvailability()
if (!available) throw new Error('Claude CLI not found')
```



### writeMcpConfig

Write an MCP server config map to a temp file suitable for `--mcp-config`.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `servers` | `Record<string, McpServerConfig>` | ✓ | Server configs keyed by name |

**Returns:** `Promise<string>`

```ts
const configPath = await cc.writeMcpConfig({
 'my-api': { type: 'http', url: 'https://api.example.com/mcp' },
 'local-tool': { type: 'stdio', command: 'bun', args: ['run', 'server.ts'] }
})
```



### run

Run a prompt in a new Claude Code session. Spawns a subprocess, streams NDJSON events, and resolves when the session completes.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `prompt` | `string` | ✓ | The instruction/prompt to send |
| `options` | `RunOptions` |  | Session configuration overrides |

`RunOptions` properties:

| Property | Type | Description |
|----------|------|-------------|
| `model` | `string` | Override model for this session. |
| `cwd` | `string` | Override working directory. |
| `systemPrompt` | `string` | System prompt for this session. |
| `appendSystemPrompt` | `string` | Append system prompt for this session. |
| `permissionMode` | `'default' | 'acceptEdits' | 'bypassPermissions' | 'plan'` | Permission mode override. |
| `allowedTools` | `string[]` | Allowed tools override. |
| `disallowedTools` | `string[]` | Disallowed tools override. |
| `streaming` | `boolean` | Whether to stream partial messages. |
| `resumeSessionId` | `string` | Resume a previous session by ID. |
| `continue` | `boolean` | Continue the most recent conversation. |
| `addDirs` | `string[]` | Additional directories to allow tool access to. |
| `mcpConfig` | `string[]` | MCP config file paths. |
| `mcpServers` | `Record<string, McpServerConfig>` | MCP servers to inject, keyed by server name. |
| `dangerouslySkipPermissions` | `boolean` | Skip all permission checks (only for sandboxed environments). |
| `extraArgs` | `string[]` | Additional arbitrary CLI flags. |
| `fileLogPath` | `string` | Path to write a parseable NDJSON session log file. Overrides feature-level fileLogPath. |
| `fileLogLevel` | `FileLogLevel` | Verbosity level for file logging. Overrides feature-level fileLogLevel. |

**Returns:** `Promise<ClaudeSession>`

```ts
// Simple one-shot
const session = await cc.run('What files are in this project?')
console.log(session.result)

// With options
const session = await cc.run('Refactor the auth module', {
 model: 'opus',
 cwd: '/path/to/project',
 permissionMode: 'acceptEdits',
 streaming: true
})

// With injected MCP servers
const session = await cc.run('Use the database tools to list tables', {
 mcpServers: {
   'db-tools': { type: 'stdio', command: 'bun', args: ['run', 'db-mcp.ts'] },
   'api': { type: 'http', url: 'https://api.example.com/mcp' }
 }
})

// Resume a previous session
const session = await cc.run('Now add tests for that', {
 resumeSessionId: previousSession.sessionId
})
```



### start

Run a prompt without waiting for completion. Returns the session ID immediately so you can subscribe to events.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `prompt` | `string` | ✓ | The instruction/prompt to send |
| `options` | `RunOptions` |  | Session configuration overrides |

`RunOptions` properties:

| Property | Type | Description |
|----------|------|-------------|
| `model` | `string` | Override model for this session. |
| `cwd` | `string` | Override working directory. |
| `systemPrompt` | `string` | System prompt for this session. |
| `appendSystemPrompt` | `string` | Append system prompt for this session. |
| `permissionMode` | `'default' | 'acceptEdits' | 'bypassPermissions' | 'plan'` | Permission mode override. |
| `allowedTools` | `string[]` | Allowed tools override. |
| `disallowedTools` | `string[]` | Disallowed tools override. |
| `streaming` | `boolean` | Whether to stream partial messages. |
| `resumeSessionId` | `string` | Resume a previous session by ID. |
| `continue` | `boolean` | Continue the most recent conversation. |
| `addDirs` | `string[]` | Additional directories to allow tool access to. |
| `mcpConfig` | `string[]` | MCP config file paths. |
| `mcpServers` | `Record<string, McpServerConfig>` | MCP servers to inject, keyed by server name. |
| `dangerouslySkipPermissions` | `boolean` | Skip all permission checks (only for sandboxed environments). |
| `extraArgs` | `string[]` | Additional arbitrary CLI flags. |
| `fileLogPath` | `string` | Path to write a parseable NDJSON session log file. Overrides feature-level fileLogPath. |
| `fileLogLevel` | `FileLogLevel` | Verbosity level for file logging. Overrides feature-level fileLogLevel. |

**Returns:** `Promise<string>`

```ts
const sessionId = cc.start('Build a REST API for users')

cc.on('session:delta', ({ sessionId: sid, text }) => {
 if (sid === sessionId) process.stdout.write(text)
})

cc.on('session:result', ({ sessionId: sid, result }) => {
 if (sid === sessionId) console.log('\nDone:', result)
})
```



### abort

Kill a running session's subprocess.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `sessionId` | `string` | ✓ | The local session ID to abort |

**Returns:** `void`

```ts
const sessionId = cc.start('Do something long')
// ... later
cc.abort(sessionId)
```



### getSession

Get a session by its local ID.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `sessionId` | `string` | ✓ | The local session ID |

**Returns:** `ClaudeSession | undefined`

```ts
const session = cc.getSession(sessionId)
if (session?.status === 'completed') {
 console.log(session.result)
}
```



### waitForSession

Wait for a running session to complete.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `sessionId` | `string` | ✓ | The local session ID |

**Returns:** `Promise<ClaudeSession>`

```ts
const id = cc.start('Build something cool')
const session = await cc.waitForSession(id)
console.log(session.result)
```



### cleanupMcpTempFiles

Clean up any temp MCP config files created during sessions.

**Returns:** `Promise<void>`



### enable

Initialize the feature.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `any` |  | Enable options |

**Returns:** `Promise<this>`



## Getters

| Property | Type | Description |
|----------|------|-------------|
| `claudePath` | `string` | Resolve the path to the claude CLI binary. |

## Events

### session:log-error

Event emitted by ClaudeCode



### session:event

Event emitted by ClaudeCode



### session:init

Event emitted by ClaudeCode



### session:delta

Event emitted by ClaudeCode



### session:stream

Event emitted by ClaudeCode



### session:message

Event emitted by ClaudeCode



### session:result

Event emitted by ClaudeCode



### session:start

Event emitted by ClaudeCode



### session:parse-error

Event emitted by ClaudeCode



### session:error

Event emitted by ClaudeCode



### session:abort

Event emitted by ClaudeCode



## State

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `boolean` | Whether this feature is currently enabled |
| `sessions` | `object` | Map of session IDs to ClaudeSession objects |
| `activeSessions` | `array` | List of currently running session IDs |
| `claudeAvailable` | `boolean` | Whether the Claude CLI binary is available |
| `claudeVersion` | `string` | Detected Claude CLI version string |

## Environment Variables

- `TMPDIR`

## Examples

**features.claudeCode**

```ts
const cc = container.feature('claudeCode')

// Listen for events
cc.on('session:delta', ({ sessionId, text }) => process.stdout.write(text))
cc.on('session:result', ({ sessionId, result }) => console.log('Done:', result))

// Run a prompt
const session = await cc.run('Explain the architecture of this project')
console.log(session.result)
```



**checkAvailability**

```ts
const available = await cc.checkAvailability()
if (!available) throw new Error('Claude CLI not found')
```



**writeMcpConfig**

```ts
const configPath = await cc.writeMcpConfig({
 'my-api': { type: 'http', url: 'https://api.example.com/mcp' },
 'local-tool': { type: 'stdio', command: 'bun', args: ['run', 'server.ts'] }
})
```



**run**

```ts
// Simple one-shot
const session = await cc.run('What files are in this project?')
console.log(session.result)

// With options
const session = await cc.run('Refactor the auth module', {
 model: 'opus',
 cwd: '/path/to/project',
 permissionMode: 'acceptEdits',
 streaming: true
})

// With injected MCP servers
const session = await cc.run('Use the database tools to list tables', {
 mcpServers: {
   'db-tools': { type: 'stdio', command: 'bun', args: ['run', 'db-mcp.ts'] },
   'api': { type: 'http', url: 'https://api.example.com/mcp' }
 }
})

// Resume a previous session
const session = await cc.run('Now add tests for that', {
 resumeSessionId: previousSession.sessionId
})
```



**start**

```ts
const sessionId = cc.start('Build a REST API for users')

cc.on('session:delta', ({ sessionId: sid, text }) => {
 if (sid === sessionId) process.stdout.write(text)
})

cc.on('session:result', ({ sessionId: sid, result }) => {
 if (sid === sessionId) console.log('\nDone:', result)
})
```



**abort**

```ts
const sessionId = cc.start('Do something long')
// ... later
cc.abort(sessionId)
```



**getSession**

```ts
const session = cc.getSession(sessionId)
if (session?.status === 'completed') {
 console.log(session.result)
}
```



**waitForSession**

```ts
const id = cc.start('Build something cool')
const session = await cc.waitForSession(id)
console.log(session.result)
```

