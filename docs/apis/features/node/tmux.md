# features.tmux

Terminal multiplexer feature that wraps tmux to provide programmatic control over terminal panes. Allows scripts to split the terminal into multiple panes, run commands in each pane with full process handles (await, cancel, observe output), and collapse everything back to a single pane when done.

## Usage

```ts
container.feature('tmux', {
  // Custom session name (auto-generated if omitted)
  sessionName,
  // Path to tmux executable
  tmuxPath,
  // Output capture polling interval in ms
  pollInterval,
})
```

## Options

| Property | Type | Description |

|----------|------|-------------|

| `sessionName` | `string` | Custom session name (auto-generated if omitted) |

| `tmuxPath` | `string` | Path to tmux executable |

| `pollInterval` | `number` | Output capture polling interval in ms |

## Methods

### executeTmuxCommand

Execute a tmux command and return the result. Follows the same pattern as Docker.executeDockerCommand.

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `args` | `string[]` | ✓ | Parameter args |

**Returns:** `Promise<{ stdout: string; stderr: string; exitCode: number }>`



### checkAvailability

Check if tmux is available on this system.

**Returns:** `Promise<boolean>`



### enable

Initialize the tmux feature. Verifies tmux is available. Throws if tmux is not installed.

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `options` | `any` |  | Parameter options |

**Returns:** `Promise<this>`



### ensureSession

Ensure we are running inside a tmux session. If already inside tmux, uses the current session. If not, re-execs the current script inside a new tmux session so the user actually sees panes. The current process is replaced (via execSync) — code after `ensureSession()` only runs inside tmux.

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `name` | `string` |  | Session name. Defaults to `luca-{uuid}`. |

**Returns:** `Promise<string>`



### killSession

Kill the current session (or a named one).

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `name` | `string` |  | Parameter name |

**Returns:** `Promise<void>`



### split

Split the current window into multiple panes.

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `options` | `SplitOptions` |  | Split configuration |



`SplitOptions` properties:

| Property | Type | Description |

|----------|------|-------------|

| `count` | `number` | Number of panes to create (splits the current pane this many times) |

| `orientation` | `'horizontal' | 'vertical'` | Split direction: 'horizontal' splits side-by-side, 'vertical' splits top/bottom |

| `size` | `number` | Percentage size for each new pane |

**Returns:** `Promise<TmuxLayout>`



### runInPane

Run a command in a specific pane. Returns a PaneProcess handle.

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `paneId` | `string` | ✓ | The tmux pane ID (e.g. "%5") |

| `command` | `string` | ✓ | The command string to execute |

**Returns:** `Promise<PaneProcess>`



### capture

Capture the current content of a pane.

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `paneId` | `string` | ✓ | The tmux pane ID |

**Returns:** `Promise<string>`



### sendKeys

Send keys to a pane. If `literal` is provided, it's sent as a tmux key name (e.g. "C-c", "Enter"). Otherwise `text` is sent followed by Enter.

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `paneId` | `string` | ✓ | The tmux pane ID |

| `text` | `string` | ✓ | Text to type (followed by Enter) |

| `literal` | `string` |  | A literal tmux key name (sent without Enter) |

**Returns:** `Promise<void>`



### isPaneAlive

Check if a pane is still alive.

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `paneId` | `string` | ✓ | Parameter paneId |

**Returns:** `Promise<boolean>`



### collapse

Kill all managed panes except the first one, returning to a single pane view.

**Returns:** `Promise<void>`



## Events

### sessionCreated

Event emitted by Tmux



### sessionKilled

Event emitted by Tmux



### paneSplit

Event emitted by Tmux



## State

| Property | Type | Description |

|----------|------|-------------|

| `enabled` | `boolean` | Whether this feature is currently enabled |

| `sessionName` | `string` | The current tmux session name |

| `isTmuxAvailable` | `boolean` | Whether tmux CLI is available on this system |

| `isInsideTmux` | `boolean` | Whether we are inside an existing tmux session |

| `paneIds` | `array` | Active pane IDs managed by this feature |

| `lastError` | `string` | Last error message from a tmux operation |

## Environment Variables

- `TMUX`

## Examples

**features.tmux**

```ts
const tmux = container.feature('tmux', { enable: true })
await tmux.ensureSession()

const layout = tmux.split({ count: 2, orientation: 'horizontal' })

const tests = await layout.panes[0].run('bun test')
const build = await layout.panes[1].run('bun run build')

tests.events.on('output', (data) => console.log('tests:', data))

await layout.awaitAll()
await layout.collapse()
```

