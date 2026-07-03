# Tmux (features.tmux)

> Stability: `stable`

Tmux session manager for controlling coding assistants and long-running CLI tools. Creates and manages named tmux sessions that run as background processes, fully independent of whether you're inside a tmux session yourself. Each session can host a coding assistant (hermes, codex, claude, etc.) and you can programmatically send input and inspect their state. Requires `tmux` to be installed (`brew install tmux` on macOS).

## Usage

```ts
container.feature('tmux', {
  // Explicit path to the tmux binary
  tmuxPath,
  // Default pane width for new sessions
  defaultWidth,
  // Default pane height for new sessions
  defaultHeight,
})
```

## Options (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `tmuxPath` | `string` | Explicit path to the tmux binary |
| `defaultWidth` | `number` | Default pane width for new sessions |
| `defaultHeight` | `number` | Default pane height for new sessions |

## Methods

### afterInitialize

**Returns:** `void`



### run

Execute a raw tmux command. Returns stdout/stderr strings. This is the low-level escape hatch for any tmux operation not covered by the API.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `args` | `string[]` | ✓ | Parameter args |

**Returns:** `Promise<{ stdout: string; stderr: string }>`

```ts
await tmux.run(['new-session', '-d', '-s', 'myapp', 'bash'])

// Read the stdout of any tmux query, e.g. pane dimensions
const info = await tmux.run(['display-message', '-t', 'myapp', '-p', '#{pane_width}x#{pane_height}'])
console.log('pane dimensions:', info.stdout.trim())
```



### hasSession

Check whether a named session exists.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `name` | `string` | ✓ | Parameter name |

**Returns:** `Promise<boolean>`



### createSession

Create a new detached named session. If a session with that name already exists this is a no-op (returns a handle to the existing session).

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `name` | `string` | ✓ | Session name (used to target it in all subsequent commands) |
| `options` | `{
      command?: string
      width?: number
      height?: number
      cwd?: string
    }` |  | Parameter options |

`{
      command?: string
      width?: number
      height?: number
      cwd?: string
    }` properties:

| Property | Type | Description |
|----------|------|-------------|
| `command` | `any` | Shell command to run in the session (e.g. `'hermes'`) |
| `width` | `any` | Pane width in columns (default: feature option or 220) |
| `height` | `any` | Pane height in rows (default: feature option or 50) |
| `cwd` | `any` | Working directory for the session |

**Returns:** `Promise<TmuxSession>`



### session

Get or create a named session. If the session already exists, returns a handle to it without restarting. If it doesn't exist, creates it (running `options.command` if provided). This is the primary entry point for managing coding-assistant sessions.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `name` | `string` | ✓ | Parameter name |
| `options` | `{
      command?: string
      width?: number
      height?: number
      cwd?: string
    }` |  | Parameter options |

**Returns:** `Promise<TmuxSession>`

```ts
const hermes = await tmux.session('hermes', { command: 'hermes' })
const codex = await tmux.session('codex', { command: 'codex' })
```



### listSessions

List all active tmux sessions.

**Returns:** `Promise<SessionInfo[]>`

```ts
const sessions = await tmux.listSessions()
sessions.forEach(s => console.log(s.name, '— windows:', s.windows))
```



### killSession

Kill a named session by name.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `name` | `string` | ✓ | Parameter name |

**Returns:** `Promise<void>`



## Getters

| Property | Type | Description |
|----------|------|-------------|
| `tmuxPath` | `string | null` | Path to the resolved tmux binary, or null if not installed |
| `available` | `boolean` | Whether tmux is available on this system |

## State (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `boolean` | Whether this feature is currently enabled |
| `available` | `boolean` | Whether tmux binary was found on this system |
| `tmuxPath` | `string` | Path to the tmux binary |

## Examples

**features.tmux**

```ts
const tmux = container.feature('tmux')

// Start hermes in a background session
const hermes = await tmux.session('hermes', { command: 'hermes' })

// Send it a task
await hermes.send('fix the authentication bug in src/auth.ts')

// Poll until it's done
while (!(await hermes.isWaitingForInput({ commandName: 'hermes' }))) {
 await new Promise(r => setTimeout(r, 2000))
}

// Read the output
const output = await hermes.capture({ lines: -200 })
console.log(output)
```



**run**

```ts
await tmux.run(['new-session', '-d', '-s', 'myapp', 'bash'])

// Read the stdout of any tmux query, e.g. pane dimensions
const info = await tmux.run(['display-message', '-t', 'myapp', '-p', '#{pane_width}x#{pane_height}'])
console.log('pane dimensions:', info.stdout.trim())
```



**session**

```ts
const hermes = await tmux.session('hermes', { command: 'hermes' })
const codex = await tmux.session('codex', { command: 'codex' })
```



**listSessions**

```ts
const sessions = await tmux.listSessions()
sessions.forEach(s => console.log(s.name, '— windows:', s.windows))
```

