# ClaudeController (features.claudeController)

> Stability: `stable`

Multi-session spawner for interactive Claude Code workers. ClaudeController is intentionally only the registry/orchestrator for spawning one or more `ClaudeSessionController` workers. Each worker owns the actual tmux session, cwd, args, screen parsing, JSONL session lookup, and input APIs. This keeps the feature singleton focused on lifecycle and tracking while the per-session controller handles interactive behavior without `claude -p`.

## Usage

```ts
container.feature('claudeController', {
  // Default working directory for interactive Claude sessions
  cwd,
  // Path to claude executable; defaults to claudeCode.claudePath or claude
  claudePath,
  // Tmux session name prefix
  sessionPrefix,
  // Default tmux pane width
  width,
  // Default tmux pane height
  height,
  // Delay after sending input before refreshing state
  settleMs,
})
```

## Options (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `cwd` | `string` | Default working directory for interactive Claude sessions |
| `claudePath` | `string` | Path to claude executable; defaults to claudeCode.claudePath or claude |
| `sessionPrefix` | `string` | Tmux session name prefix |
| `width` | `number` | Default tmux pane width |
| `height` | `number` | Default tmux pane height |
| `settleMs` | `number` | Delay after sending input before refreshing state |

## Methods

### definePersona

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `name` | `string` | ✓ | Parameter name |
| `persona` | `ClaudeControllerPersona` | ✓ | Parameter persona |

**Returns:** `this`



### getPersona

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `name` | `string` | ✓ | Parameter name |

**Returns:** `ClaudeControllerPersona | undefined`



### listPersonas

**Returns:** `Array<{ name: string; persona: ClaudeControllerPersona }>`



### create

Create a ClaudeSessionController worker without starting its tmux process.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `ClaudeControllerStartOptions` |  | Parameter options |

**Returns:** `ClaudeSessionController`



### start

Start one interactive Claude session and track its worker.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `ClaudeControllerStartOptions` |  | Parameter options |

**Returns:** `Promise<ClaudeControllerSnapshot>`



### startMany

Start multiple interactive Claude sessions concurrently.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `ClaudeControllerStartOptions[]` | ✓ | Parameter options |

**Returns:** `Promise<ClaudeControllerSnapshot[]>`



### spawn

Alias for start(), emphasizing this feature's spawner role.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `ClaudeControllerStartOptions` |  | Parameter options |

**Returns:** `Promise<ClaudeControllerSnapshot>`



### spawnMany

Alias for startMany(), emphasizing this feature's spawner role.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `ClaudeControllerStartOptions[]` | ✓ | Parameter options |

**Returns:** `Promise<ClaudeControllerSnapshot[]>`



### session

Return a spawned worker by id. The worker owns ask/respond/choices/etc.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | `string` |  | Parameter id |

**Returns:** `ClaudeSessionController | undefined`



### listSessions

List spawned worker objects.

**Returns:** `ClaudeSessionController[]`



### snapshots

Return latest tracked snapshots without touching tmux.

**Returns:** `ClaudeControllerSnapshot[]`



### refresh

Refresh one spawned worker's tracked snapshot.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | `string` |  | Parameter id |

**Returns:** `Promise<ClaudeControllerSnapshot>`



### refreshAll

Refresh all spawned workers concurrently.

**Returns:** `Promise<ClaudeControllerSnapshot[]>`



### stop

Stop and forget one spawned Claude session.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | `string` |  | Parameter id |

**Returns:** `Promise<void>`



### stopAll

Stop and forget every spawned Claude session.

**Returns:** `Promise<void>`



## Getters

| Property | Type | Description |
|----------|------|-------------|
| `activeController` | `string | undefined` |  |

## Events (Zod v4 schema)

### controller:update

Fired after a session snapshot refresh

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `id` | `string` |  |
| `snapshot` | `any` |  |



### controller:start

Fired when an interactive Claude session starts

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `id` | `string` |  |
| `tmuxSession` | `string` |  |



### controller:stop

Fired when a spawned Claude session is stopped

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `id` | `string` |  |



## State (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `boolean` | Whether this feature is currently enabled |
| `controllers` | `object` | Map of controller IDs to latest snapshots |
| `activeController` | `string` | Most recently spawned controller ID |

## Examples

**features.claudeController**

```ts
const controller = container.feature('claudeController')
const [docs, tests] = await controller.startMany([
 { id: 'docs', cwd: repo, args: ['--add-dir', repo] },
 { id: 'tests', cwd: repo, args: ['--permission-mode', 'acceptEdits'] },
])
const docsWorker = controller.session('docs')
await docsWorker?.ask('Inspect the docs')
```

