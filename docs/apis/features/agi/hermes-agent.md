# HermesAgent (features.hermesAgent)

> Stability: `stable`

Hermes Agent CLI wrapper feature. Controls the `hermes` agent CLI over the Agent Client Protocol (ACP): a single persistent `hermes acp` adapter process is lazily spawned on first use and shared across runs, with one ACP session per `run()`/`start()` call. Streaming updates (message chunks, thoughts, tool calls, plans, usage) are re-emitted as typed session events, mirroring the claudeCode and openaiCodex agent-wrapper features. The adapter boot is slow (~15s — it loads MCP servers), which is why the process is reused. Call `stopAdapter()` when you're done in short-lived scripts, otherwise the adapter keeps the event loop alive. The underlying `hermesAcp` client is registered lazily when this feature is enabled — it does not appear in the clients registry otherwise. Known limitations: hermes `--toolsets` / `--skills` preloading has no ACP or env-var surface, so it is not supported. Options that map to spawn-time env vars (provider, yolo, safeMode, ignoreRules, ignoreUserConfig, maxTurns, acceptHooks) require `restartAdapter()` to change after the adapter is running. Hermes reports token usage but no cost.

## Usage

```ts
container.feature('hermesAgent', {
  // Path to the hermes CLI binary
  hermesPath,
  // Default model for sessions (applied via session/set_model, and HERMES_INFERENCE_MODEL at adapter spawn)
  model,
  // Default working directory for sessions
  cwd,
  // Default ACP session mode, mapped to default/accept_edits/dont_ask; also drives how permission requests are answered
  permissionMode,
  // MCP server configs passed to session/new
  mcpServers,
  // Inference provider override (HERMES_INFERENCE_PROVIDER at adapter spawn; requires restartAdapter() to change)
  provider,
  // Bypass approval prompts: sets HERMES_YOLO_MODE=1 at adapter spawn and auto-approves ACP permission requests
  yolo,
  // Disable all hermes customizations — user config, rules, plugins, MCP servers (HERMES_SAFE_MODE=1 at adapter spawn)
  safeMode,
  // Skip auto-injection of AGENTS.md, memory, and preloaded skills (HERMES_IGNORE_RULES=1 at adapter spawn)
  ignoreRules,
  // Ignore ~/.hermes/config.yaml and use built-in defaults (HERMES_IGNORE_USER_CONFIG=1 at adapter spawn)
  ignoreUserConfig,
  // Maximum tool-calling iterations per turn (HERMES_MAX_ITERATIONS at adapter spawn)
  maxTurns,
  // Auto-approve unseen shell hooks without a TTY prompt (HERMES_ACCEPT_HOOKS=1 at adapter spawn)
  acceptHooks,
  // Timeout for adapter spawn + ACP initialize handshake (default 60000; the adapter loads MCP servers and can take ~15s)
  adapterBootTimeoutMs,
})
```

## Options (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `hermesPath` | `string` | Path to the hermes CLI binary |
| `model` | `string` | Default model for sessions (applied via session/set_model, and HERMES_INFERENCE_MODEL at adapter spawn) |
| `cwd` | `string` | Default working directory for sessions |
| `permissionMode` | `string` | Default ACP session mode, mapped to default/accept_edits/dont_ask; also drives how permission requests are answered |
| `mcpServers` | `array` | MCP server configs passed to session/new |
| `provider` | `string` | Inference provider override (HERMES_INFERENCE_PROVIDER at adapter spawn; requires restartAdapter() to change) |
| `yolo` | `boolean` | Bypass approval prompts: sets HERMES_YOLO_MODE=1 at adapter spawn and auto-approves ACP permission requests |
| `safeMode` | `boolean` | Disable all hermes customizations — user config, rules, plugins, MCP servers (HERMES_SAFE_MODE=1 at adapter spawn) |
| `ignoreRules` | `boolean` | Skip auto-injection of AGENTS.md, memory, and preloaded skills (HERMES_IGNORE_RULES=1 at adapter spawn) |
| `ignoreUserConfig` | `boolean` | Ignore ~/.hermes/config.yaml and use built-in defaults (HERMES_IGNORE_USER_CONFIG=1 at adapter spawn) |
| `maxTurns` | `number` | Maximum tool-calling iterations per turn (HERMES_MAX_ITERATIONS at adapter spawn) |
| `acceptHooks` | `boolean` | Auto-approve unseen shell hooks without a TTY prompt (HERMES_ACCEPT_HOOKS=1 at adapter spawn) |
| `adapterBootTimeoutMs` | `number` | Timeout for adapter spawn + ACP initialize handshake (default 60000; the adapter loads MCP servers and can take ~15s) |

## Methods

### checkAvailability

Check if the Hermes CLI is available and capture its version.

**Returns:** `Promise<boolean>`

```ts
const hermes = container.feature('hermesAgent')
if (await hermes.checkAvailability()) {
 console.log(hermes.state.current.hermesVersion) // "Hermes Agent v0.19.0 ..."
}
```



### stopAdapter

Stop the persistent adapter process. Safe to call when not running. Call this from short-lived scripts — the adapter otherwise keeps the event loop alive.

**Returns:** `Promise<void>`

```ts
const session = await hermes.run('Do the thing')
await hermes.stopAdapter()
```



### restartAdapter

Restart the adapter process. Use after changing spawn-time options (model, provider, yolo, safeMode, ignoreRules, maxTurns, acceptHooks).

**Returns:** `Promise<void>`



### run

Run a prompt in a new Hermes session and wait for completion. Boots the shared `hermes acp` adapter on first use (~15s), creates an ACP session, streams update events, and resolves with the completed session.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `prompt` | `string` | ✓ | The natural language instruction for the Hermes agent |
| `options` | `HermesRunOptions` |  | Per-run overrides (model, cwd, permissionMode, resume, ...) |

`HermesRunOptions` properties:

| Property | Type | Description |
|----------|------|-------------|
| `model` | `string` | Model override for this run (applied via session/set_model). |
| `cwd` | `string` | Working directory for the ACP session. |
| `permissionMode` | `'default' | 'acceptEdits' | 'dontAsk'` | ACP session mode for this run, mapped to default/accept_edits/dont_ask. |
| `yolo` | `boolean` | Auto-approve all permission requests for this run. |
| `resumeSessionId` | `string` | Resume a previous hermes session by its ACP/hermes session ID (session/load). |
| `continue` | `boolean` | Continue the most recent ACP session created by this feature instance. |
| `mcpServers` | `any[]` | MCP server configs passed to session/new. |
| `timeoutMs` | `number` | Timeout in ms for the prompt turn. No timeout by default — agent turns can run long. |

**Returns:** `Promise<HermesSession>`

```ts
const session = await hermes.run('List the files in this folder and summarize them')
console.log(session.result)

// Resume a previous hermes session
const followUp = await hermes.run('Now write that summary to NOTES.md', {
 resumeSessionId: session.acpSessionId,
 permissionMode: 'acceptEdits',
})
```



### start

Run a prompt without waiting for completion. Returns the session ID immediately so you can subscribe to events. The adapter boot, session creation, and prompt all happen in the background.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `prompt` | `string` | ✓ | The natural language instruction for the Hermes agent |
| `options` | `HermesRunOptions` |  | Per-run overrides (model, cwd, permissionMode, resume, ...) |

`HermesRunOptions` properties:

| Property | Type | Description |
|----------|------|-------------|
| `model` | `string` | Model override for this run (applied via session/set_model). |
| `cwd` | `string` | Working directory for the ACP session. |
| `permissionMode` | `'default' | 'acceptEdits' | 'dontAsk'` | ACP session mode for this run, mapped to default/accept_edits/dont_ask. |
| `yolo` | `boolean` | Auto-approve all permission requests for this run. |
| `resumeSessionId` | `string` | Resume a previous hermes session by its ACP/hermes session ID (session/load). |
| `continue` | `boolean` | Continue the most recent ACP session created by this feature instance. |
| `mcpServers` | `any[]` | MCP server configs passed to session/new. |
| `timeoutMs` | `number` | Timeout in ms for the prompt turn. No timeout by default — agent turns can run long. |

**Returns:** `Promise<string>`

```ts
const sessionId = await hermes.start('Refactor the utils module')

hermes.on('session:delta', ({ sessionId: sid, text }) => {
 if (sid === sessionId) process.stdout.write(text)
})

const session = await hermes.waitForSession(sessionId)
```



### abort

Cancel a running session's turn via ACP session/cancel. The shared adapter process stays alive (other runs may be using it). If the turn doesn't settle within 10s of the cancel, the adapter is restarted.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `sessionId` | `string` | ✓ | The local session ID to abort |

**Returns:** `void`



### getSession

Retrieve the current state of a session by its ID.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `sessionId` | `string` | ✓ | The session ID to look up |

**Returns:** `HermesSession | undefined`



### waitForSession

Wait for a running session to complete or error. Resolves immediately if the session is already in a terminal state.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `sessionId` | `string` | ✓ | The session ID to wait for |

**Returns:** `Promise<HermesSession>`



### usage

Get aggregated token usage across all sessions, or for a specific session. Hermes reports tokens only — there is no cost accounting.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `sessionId` | `string` |  | Optional session ID to get usage for a single session |

**Returns:** `{ totalInputTokens: number; totalOutputTokens: number; totalThoughtTokens: number; totalCachedReadTokens: number; totalTokens: number; totalTurns: number; sessionCount: number; sessions: Array<{ id: string; turns: number; inputTokens: number; outputTokens: number; status: string`

```ts
const stats = hermes.usage()
console.log(`Tokens: ${stats.totalInputTokens} in / ${stats.totalOutputTokens} out`)
```



### listSessions

List recent sessions from the hermes SQLite session store.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `{ source?: string; limit?: number; workspace?: string }` |  | Parameter options |

**Returns:** `Promise<{ raw: string; lines: string[] }>`

```ts
const { lines } = await hermes.listSessions({ limit: 10 })
lines.forEach((l) => console.log(l))
```



### getSessionHistory

Read a session's full history from the hermes SQLite session store as parsed JSONL records (via `hermes sessions export --format jsonl`).

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `sessionId` | `string` | ✓ | The hermes session ID (e.g. session.acpSessionId) |

**Returns:** `Promise<any[]>`

```ts
const session = await hermes.run('Say hello')
const history = await hermes.getSessionHistory(session.acpSessionId)
```



### enable

Enable the feature. Lazily registers the `hermesAcp` client class in the clients registry (it is not registered at module load) and delegates to the base Feature enable() lifecycle. Does NOT spawn the adapter — that happens on the first run()/start().

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `any` |  | Options to merge into the feature configuration |

**Returns:** `Promise<this>`



## Getters

| Property | Type | Description |
|----------|------|-------------|
| `hermesPath` | `string` |  |
| `parsedVersion` | `{ major: number; minor: number; patch: number } | undefined` | Parse the detected hermes version string into components. |
| `sessionId` | `string | undefined` | The hermes/ACP session ID of the most recent session, useful for resuming with `resumeSessionId` later (including across processes — hermes persists sessions in its SQLite store). |

## Events (Zod v4 schema)

### session:parse-error

Fired when a line from the adapter cannot be parsed as JSON

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `sessionId` | `string` |  |
| `line` | `string` |  |



### adapter:start

Fired when the persistent ACP adapter finishes its initialize handshake

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `agentInfo` | `any` |  |



### adapter:exit

Fired when the adapter process exits

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `exitCode` | `number` |  |
| `error` | `any` |  |



### session:error

Fired when a run or the adapter encounters an error

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `sessionId` | `string` |  |
| `error` | `any` |  |
| `exitCode` | `number` |  |



### session:event

Fired for every session/update notification from the adapter

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `sessionId` | `string` |  |
| `event` | `any` |  |



### session:delta

Fired for each agent_message_chunk text delta

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `sessionId` | `string` |  |
| `text` | `string` |  |
| `role` | `string` |  |



### session:reasoning

Fired for agent_thought_chunk (model thinking) updates

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `sessionId` | `string` |  |
| `text` | `string` |  |



### session:tool-call

Fired for tool_call and tool_call_update session updates

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `sessionId` | `string` |  |
| `toolCall` | `any` |  |



### session:plan

Fired for plan session updates

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `sessionId` | `string` |  |
| `plan` | `any` |  |



### session:usage

Fired for usage_update notifications (context window size/used)

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `sessionId` | `string` |  |
| `usage` | `any` |  |



### session:permission-request

Fired when hermes asks for permission and the feature answers it

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `sessionId` | `string` |  |
| `request` | `any` |  |
| `outcome` | `any` |  |



### session:start

Fired when a new Hermes run begins

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `sessionId` | `string` |  |
| `prompt` | `string` |  |



### session:init

Fired when the ACP session is created or loaded

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `sessionId` | `string` |  |
| `acpSessionId` | `string` |  |
| `models` | `any` |  |
| `modes` | `any` |  |



### session:abort

Fired when a run is aborted by the user

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `sessionId` | `string` |  |



### session:message

Fired when a turn completes, with the accumulated assistant message

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `sessionId` | `string` |  |
| `message` | `any` |  |



### session:result

Fired when a run completes with a final result

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `sessionId` | `string` |  |
| `result` | `string` |  |
| `stopReason` | `string` |  |
| `usage` | `any` |  |



## State (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `boolean` | Whether this feature is currently enabled |
| `sessions` | `object` | Map of session IDs to HermesSession objects |
| `activeSessions` | `array` | List of currently running session IDs |
| `hermesAvailable` | `boolean` | Whether the hermes CLI binary is available |
| `hermesVersion` | `string` | Detected hermes CLI version string |
| `adapterRunning` | `boolean` | Whether the persistent hermes acp adapter process is running |
| `adapterInfo` | `any` | agentInfo returned by the ACP initialize handshake |

## Environment Variables

- `HERMES_INFERENCE_MODEL`
- `HERMES_INFERENCE_PROVIDER`
- `HERMES_YOLO_MODE`
- `HERMES_ACCEPT_HOOKS`

## Examples

**features.hermesAgent**

```ts
const hermes = container.feature('hermesAgent')

hermes.on('session:delta', ({ text }) => process.stdout.write(text))

const session = await hermes.run('Summarize the README in this folder')
console.log(session.result, session.usage)

await hermes.stopAdapter()
```



**checkAvailability**

```ts
const hermes = container.feature('hermesAgent')
if (await hermes.checkAvailability()) {
 console.log(hermes.state.current.hermesVersion) // "Hermes Agent v0.19.0 ..."
}
```



**stopAdapter**

```ts
const session = await hermes.run('Do the thing')
await hermes.stopAdapter()
```



**run**

```ts
const session = await hermes.run('List the files in this folder and summarize them')
console.log(session.result)

// Resume a previous hermes session
const followUp = await hermes.run('Now write that summary to NOTES.md', {
 resumeSessionId: session.acpSessionId,
 permissionMode: 'acceptEdits',
})
```



**start**

```ts
const sessionId = await hermes.start('Refactor the utils module')

hermes.on('session:delta', ({ sessionId: sid, text }) => {
 if (sid === sessionId) process.stdout.write(text)
})

const session = await hermes.waitForSession(sessionId)
```



**usage**

```ts
const stats = hermes.usage()
console.log(`Tokens: ${stats.totalInputTokens} in / ${stats.totalOutputTokens} out`)
```



**listSessions**

```ts
const { lines } = await hermes.listSessions({ limit: 10 })
lines.forEach((l) => console.log(l))
```



**getSessionHistory**

```ts
const session = await hermes.run('Say hello')
const history = await hermes.getSessionHistory(session.acpSessionId)
```

