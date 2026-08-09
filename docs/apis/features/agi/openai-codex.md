# OpenAICodex (features.openaiCodex)

> Stability: `stable`

OpenAI Codex CLI wrapper feature. Spawns and manages Codex sessions as subprocesses, streaming structured JSON events back through the container's event system. Mirrors the ClaudeCode feature pattern: each call to `run()` spawns a `codex exec --json` process, parses NDJSON from stdout line-by-line, and emits typed events on the feature's event bus.

## Usage

```ts
container.feature('openaiCodex', {
  // Path to the codex CLI binary
  codexPath,
  // Default model to use for sessions
  model,
  // Default working directory for sessions
  cwd,
  // Sandbox policy for shell commands
  sandbox,
  // Approval mode for codex operations
  approvalMode,
  // Path to additional project doc to include
  projectDoc,
  // Disable automatic codex.md inclusion
  noProjectDoc,
  // Do not truncate stdout/stderr from command outputs
  fullStdout,
})
```

## Options (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `codexPath` | `string` | Path to the codex CLI binary |
| `model` | `string` | Default model to use for sessions |
| `cwd` | `string` | Default working directory for sessions |
| `sandbox` | `string` | Sandbox policy for shell commands |
| `approvalMode` | `string` | Approval mode for codex operations |
| `projectDoc` | `string` | Path to additional project doc to include |
| `noProjectDoc` | `boolean` | Disable automatic codex.md inclusion |
| `fullStdout` | `boolean` | Do not truncate stdout/stderr from command outputs |

## Methods

### checkAvailability

Check if the Codex CLI is available and capture its version.

**Returns:** `Promise<boolean>`



### run

Run a prompt in a new Codex session. Spawns a subprocess, streams NDJSON events, and resolves when the session completes.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `prompt` | `string` | ✓ | The natural language instruction for the Codex agent |
| `options` | `CodexRunOptions` |  | Optional overrides for model, cwd, sandbox policy, etc. |

`CodexRunOptions` properties:

| Property | Type | Description |
|----------|------|-------------|
| `model` | `string` |  |
| `cwd` | `string` |  |
| `sandbox` | `'read-only' | 'workspace-write' | 'danger-full-access'` |  |
| `approvalMode` | `'suggest' | 'auto-edit' | 'full-auto'` |  |
| `projectDoc` | `string` |  |
| `noProjectDoc` | `boolean` |  |
| `fullStdout` | `boolean` |  |
| `images` | `string[]` |  |
| `fullAuto` | `boolean` |  |
| `resumeSessionId` | `string` | Resume a previous session by ID. |
| `resumeLast` | `boolean` | Resume the most recent session. |
| `dangerouslyAutoApproveEverything` | `boolean` | Skip all approvals and sandboxing. |
| `config` | `Record<string, unknown>` | Inline config overrides forwarded to codex as `-c key=value` flags. Values are TOML-encoded (strings get JSON-quoted; booleans, numbers, and arrays are passed through). Use this to set things like `developer_instructions`, `base_instructions`, `model_reasoning_effort`, etc. without writing a profile file. |
| `profile` | `string` | Codex profile name to layer (codex -p <name>). Reads `$CODEX_HOME/<name>.config.toml`. |
| `extraArgs` | `string[]` | Additional CLI flags. |

**Returns:** `Promise<CodexSession>`

```ts
const session = await codex.run('Fix the failing tests')
console.log(session.result)

const session = await codex.run('Refactor the auth module', {
 model: 'o4-mini',
 fullAuto: true,
 cwd: '/path/to/project'
})
```



### start

Run a prompt without waiting for completion. Returns the session ID immediately so you can subscribe to events.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `prompt` | `string` | ✓ | The natural language instruction for the Codex agent |
| `options` | `CodexRunOptions` |  | Optional overrides for model, cwd, sandbox policy, etc. |

`CodexRunOptions` properties:

| Property | Type | Description |
|----------|------|-------------|
| `model` | `string` |  |
| `cwd` | `string` |  |
| `sandbox` | `'read-only' | 'workspace-write' | 'danger-full-access'` |  |
| `approvalMode` | `'suggest' | 'auto-edit' | 'full-auto'` |  |
| `projectDoc` | `string` |  |
| `noProjectDoc` | `boolean` |  |
| `fullStdout` | `boolean` |  |
| `images` | `string[]` |  |
| `fullAuto` | `boolean` |  |
| `resumeSessionId` | `string` | Resume a previous session by ID. |
| `resumeLast` | `boolean` | Resume the most recent session. |
| `dangerouslyAutoApproveEverything` | `boolean` | Skip all approvals and sandboxing. |
| `config` | `Record<string, unknown>` | Inline config overrides forwarded to codex as `-c key=value` flags. Values are TOML-encoded (strings get JSON-quoted; booleans, numbers, and arrays are passed through). Use this to set things like `developer_instructions`, `base_instructions`, `model_reasoning_effort`, etc. without writing a profile file. |
| `profile` | `string` | Codex profile name to layer (codex -p <name>). Reads `$CODEX_HOME/<name>.config.toml`. |
| `extraArgs` | `string[]` | Additional CLI flags. |

**Returns:** `string`

```ts
const sessionId = codex.start('Build a REST API for users')

codex.on('session:delta', ({ sessionId: sid, text }) => {
 if (sid === sessionId) process.stdout.write(text)
})
```



### abort

Kill a running session's subprocess.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `sessionId` | `string` | ✓ | The session ID to abort |

**Returns:** `void`



### getSession

Retrieve the current state of a session by its ID.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `sessionId` | `string` | ✓ | The session ID to look up |

**Returns:** `CodexSession | undefined`



### waitForSession

Wait for a running session to complete or error. Resolves immediately if the session is already in a terminal state.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `sessionId` | `string` | ✓ | The session ID to wait for |

**Returns:** `Promise<CodexSession>`



### listHistorySessions

List Codex sessions persisted on disk by mining the rollout transcripts under ~/.codex/sessions/. Unlike Claude Code, Codex buckets transcripts by date rather than by project directory, so only the first line (the session_meta record) of each file is read to recover the cwd — full transcripts are never loaded. Thread names are merged in from ~/.codex/session_index.jsonl when available. Results are sorted newest-first.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `{ cwd?: string; limit?: number }` |  | Filtering options |

`{ cwd?: string; limit?: number }` properties:

| Property | Type | Description |
|----------|------|-------------|
| `cwd` | `any` | Only return sessions that ran in this working directory |
| `limit` | `any` | Maximum number of sessions to return |

**Returns:** `Promise<CodexHistorySession[]>`

```ts
const codex = container.feature('openaiCodex')
const sessions = await codex.listHistorySessions({ cwd: container.cwd, limit: 10 })
for (const s of sessions) {
 console.log(s.startedAt, s.threadName ?? s.sessionId, s.cwd)
}
```



### getConversationHistory

Read the full conversation history for a persisted Codex session from its rollout JSONL file. Accepts either a Codex session/thread ID (from listHistorySessions or a session's threadId) or this feature's local session ID, which is resolved to its threadId automatically. Returns the raw parsed records: session_meta, response_item (messages, tool calls, reasoning), event_msg, and turn_context entries. Malformed lines are skipped so format drift between CLI versions degrades gracefully.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `sessionId` | `string` | ✓ | Codex session/thread ID or local session ID |

**Returns:** `Promise<any[]>`

```ts
const [latest] = await codex.listHistorySessions({ limit: 1 })
const records = await codex.getConversationHistory(latest.sessionId)
const messages = records.filter(r => r.type === 'response_item' && r.payload?.type === 'message')
```



### searchUserPrompts

Search the user's prompt history across all Codex sessions. Reads ~/.codex/history.jsonl, which logs every user prompt with its session ID and timestamp — handy for "which session did I ask about X in?".

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `query` | `string` | ✓ | Case-insensitive substring to match against prompt text |
| `options` | `{ limit?: number }` |  | Search options |

`{ limit?: number }` properties:

| Property | Type | Description |
|----------|------|-------------|
| `limit` | `any` | Maximum number of matches to return |

**Returns:** `Promise<CodexPromptHistoryEntry[]>`

```ts
const hits = await codex.searchUserPrompts('websocket')
for (const hit of hits) console.log(new Date(hit.ts * 1000), hit.text)
```



### sessionHistoryToMarkdown

Export a persisted Codex session's history as a readable markdown document. Mirrors claudeCode.sessionHistoryToMarkdown(). The source can be: - A path to a rollout JSONL file - A Codex session/thread ID (located via ~/.codex/sessions/) - A local session ID from this feature's state (resolved via its threadId) - Omitted, in which case the most recent session on disk is used

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `source` | `string` |  | Path to a rollout JSONL file, a session ID, or omit for the most recent session |

**Returns:** `Promise<string>`

```ts
// Most recent session on this machine
const md = await codex.sessionHistoryToMarkdown()

// A specific session
const [latest] = await codex.listHistorySessions({ cwd: container.cwd, limit: 1 })
const doc = await codex.sessionHistoryToMarkdown(latest.sessionId)
```



### enable

Enable the feature. Delegates to the base Feature enable() lifecycle.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `any` |  | Options to merge into the feature configuration |

**Returns:** `Promise<this>`



## Getters

| Property | Type | Description |
|----------|------|-------------|
| `codexPath` | `string` |  |
| `codexHome` | `string` | The Codex home directory. Honors the CODEX_HOME environment variable, falling back to ~/.codex. |

## Events (Zod v4 schema)

### session:event

Fired for every parsed JSON event from the Codex CLI stream

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `sessionId` | `string` |  |
| `event` | `any` |  |



### session:delta

Fired for each text delta from an agent message

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `sessionId` | `string` |  |
| `text` | `string` |  |
| `role` | `string` |  |



### session:message

Fired when a complete agent message is received

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `sessionId` | `string` |  |
| `message` | `any` |  |



### session:exec

Fired when a command execution item completes

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `sessionId` | `string` |  |
| `exec` | `any` |  |



### session:reasoning

Fired when a reasoning item is received

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `sessionId` | `string` |  |
| `text` | `string` |  |



### session:exec-start

Fired when a command execution item starts

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `sessionId` | `string` |  |
| `command` | `string` |  |



### session:start

Fired when a new Codex session is spawned

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `sessionId` | `string` |  |
| `prompt` | `string` |  |



### session:error

Fired when a session encounters an error

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `sessionId` | `string` |  |
| `error` | `any` |  |
| `exitCode` | `number` |  |



### session:parse-error

Fired when a JSON line from the CLI cannot be parsed

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `sessionId` | `string` |  |
| `line` | `string` |  |



### session:result

Fired when a session completes with a final result

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `sessionId` | `string` |  |
| `result` | `string` |  |



### session:abort

Fired when a session is aborted by the user

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `sessionId` | `string` |  |



## State (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `boolean` | Whether this feature is currently enabled |
| `sessions` | `object` | Map of session IDs to CodexSession objects |
| `activeSessions` | `array` | List of currently running session IDs |
| `codexAvailable` | `boolean` | Whether the codex CLI binary is available |
| `codexVersion` | `string` | Detected codex CLI version string |

## Examples

**features.openaiCodex**

```ts
const codex = container.feature('openaiCodex')

// Listen for events
codex.on('session:message', ({ sessionId, message }) => console.log(message))
codex.on('session:patch', ({ sessionId, patch }) => console.log('File changed:', patch.path))

// Run a prompt
const session = await codex.run('Fix the failing tests in src/')
console.log(session.result)
```



**run**

```ts
const session = await codex.run('Fix the failing tests')
console.log(session.result)

const session = await codex.run('Refactor the auth module', {
 model: 'o4-mini',
 fullAuto: true,
 cwd: '/path/to/project'
})
```



**start**

```ts
const sessionId = codex.start('Build a REST API for users')

codex.on('session:delta', ({ sessionId: sid, text }) => {
 if (sid === sessionId) process.stdout.write(text)
})
```



**listHistorySessions**

```ts
const codex = container.feature('openaiCodex')
const sessions = await codex.listHistorySessions({ cwd: container.cwd, limit: 10 })
for (const s of sessions) {
 console.log(s.startedAt, s.threadName ?? s.sessionId, s.cwd)
}
```



**getConversationHistory**

```ts
const [latest] = await codex.listHistorySessions({ limit: 1 })
const records = await codex.getConversationHistory(latest.sessionId)
const messages = records.filter(r => r.type === 'response_item' && r.payload?.type === 'message')
```



**searchUserPrompts**

```ts
const hits = await codex.searchUserPrompts('websocket')
for (const hit of hits) console.log(new Date(hit.ts * 1000), hit.text)
```



**sessionHistoryToMarkdown**

```ts
// Most recent session on this machine
const md = await codex.sessionHistoryToMarkdown()

// A specific session
const [latest] = await codex.listHistorySessions({ cwd: container.cwd, limit: 1 })
const doc = await codex.sessionHistoryToMarkdown(latest.sessionId)
```

