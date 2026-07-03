# ProcessManager (features.processManager)

> Stability: `stable`

Manages long-running child processes with tracking, events, and automatic cleanup. Unlike the `proc` feature whose spawn methods block until the child exits, ProcessManager returns a SpawnHandler immediately — a handle object with its own state, events, and lifecycle methods. The feature tracks all spawned processes, maintains observable state, and can automatically kill them on parent exit. Each handler maintains a memory-efficient output buffer: the first 20 lines (head) and last 50 lines (tail) of stdout/stderr are kept, everything in between is discarded. SCOPE: tracking is in-memory and per-process. ProcessManager supervises children of the *current* process only — its registry does not survive the CLI exiting, so it is the wrong tool for cross-invocation supervision (a `start` command spawning a worker that a later `stop` command must find). For that, use the detached spawn pattern: `proc.spawn(cmd, args, { detached: true })` + persist the PID via `diskCache`, and check liveness with `proc.kill(pid, 0)`. EVENT NAMING: handler-level events are singular (`exit`, `crash`, `killed` on the SpawnHandler) while feature-level events are past tense (`exited`, `crashed`, `killed`, `spawned`, `allStopped` on the ProcessManager itself). Subscribe on the right object for the name you want. The feature also keeps observable bookkeeping state: `pm.state.get('totalSpawned')` counts every spawn since the feature was created, and `pm.state.get('processes')` maps process IDs to metadata records (command, args, pid, status, exit code, timestamps). With `autoCleanup: true` (the default) exit/SIGINT/SIGTERM handlers are registered on first spawn so tracked children die with the parent.

## Usage

```ts
container.feature('processManager', {
  // Register process.on exit/SIGINT/SIGTERM handlers to kill all tracked processes
  autoCleanup,
})
```

## Options (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `autoCleanup` | `boolean` | Register process.on exit/SIGINT/SIGTERM handlers to kill all tracked processes |

## Methods

### spawnProcess

Tool handler: spawn a long-running background process.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `args` | `{ command: string; args?: string; tag?: string; cwd?: string }` | ✓ | Parameter args |

**Returns:** `void`



### runCommand

Tool handler: run a command to completion and return its output.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `args` | `{ command: string; cwd?: string }` | ✓ | Parameter args |

**Returns:** `void`



### listProcesses

Tool handler: list all tracked processes.

**Returns:** `void`



### getProcessOutput

Tool handler: peek at a process's buffered output.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `args` | `{ id?: string; tag?: string; stream?: string }` | ✓ | Parameter args |

**Returns:** `void`



### killProcess

Tool handler: kill a process by ID or tag.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `args` | `{ id?: string; tag?: string; signal?: string }` | ✓ | Parameter args |

**Returns:** `void`



### setupToolsConsumer

When an assistant uses processManager, inject system prompt guidance about how to manage processes safely and effectively.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `consumer` | `Helper` | ✓ | Parameter consumer |

**Returns:** `void`



### spawn

Spawn a long-running process and return a handle immediately. The returned SpawnHandler provides events for stdout/stderr streaming, exit/crash notifications, and methods to kill or await the process.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `command` | `string` | ✓ | The command to execute (e.g. 'node', 'bun', 'python') |
| `args` | `string[]` |  | Arguments to pass to the command |
| `options` | `SpawnOptions` |  | Spawn configuration |

`SpawnOptions` properties:

| Property | Type | Description |
|----------|------|-------------|
| `tag` | `string` | User-defined tag for later lookups via getByTag() |
| `cwd` | `string` | Working directory for the spawned process (defaults to container cwd) |
| `env` | `Record<string, string>` | Additional environment variables merged with process.env |
| `stdin` | `'pipe' | 'inherit' | 'ignore' | null` | stdin mode: 'pipe' to write to the process, 'inherit', or 'ignore' (default: 'ignore') |
| `stdout` | `'pipe' | 'inherit' | 'ignore' | null` | stdout mode: 'pipe' to capture output, 'inherit', or 'ignore' (default: 'pipe') |
| `stderr` | `'pipe' | 'inherit' | 'ignore' | null` | stderr mode: 'pipe' to capture errors, 'inherit', or 'ignore' (default: 'pipe') |

**Returns:** `SpawnHandler`

```ts
const pm = container.feature('processManager', { enable: true })

// Returns immediately — the handle carries state, events, and lifecycle methods
const handle = pm.spawn('echo', ['hello from process manager'], { tag: 'greeter' })
handle.on('stdout', (data) => console.log(data))

// Wait for completion when you need the result
const exitCode = await handle.await()
```



### get

Get a SpawnHandler by its unique ID.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | `string` | ✓ | The process ID returned by spawn |

**Returns:** `SpawnHandler | undefined`



### getByTag

Find a SpawnHandler by its user-defined tag.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `tag` | `string` | ✓ | The tag passed to spawn() |

**Returns:** `SpawnHandler | undefined`

```ts
pm.spawn('sleep', ['5'], { tag: 'napper' })
const found = pm.getByTag('napper')
console.log('Found by tag:', found ? found.status : 'no')
```



### list

List all tracked SpawnHandlers (running and finished). Finished processes stay in the registry until removed with `remove(id)`, so the list is a full history of everything spawned by this feature instance.

**Returns:** `SpawnHandler[]`

```ts
const all = pm.list()
const running = all.filter(h => h.isRunning)
console.log(`${running.length} running of ${all.length} tracked`)
```



### killAll

Kill all running processes. Already-finished handlers are skipped; they remain in the registry for inspection. Use `stop()` instead when you also want the process exit handlers removed.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `signal` | `NodeJS.Signals | number` |  | Signal to send (default: SIGTERM) |

**Returns:** `void`

```ts
pm.killAll()
pm.list().filter(h => h.isRunning).length // => 0
```



### stop

Stop the process manager: kill all running processes and remove cleanup handlers. This is the full teardown — unlike `killAll()` it also unregisters the exit/SIGINT/SIGTERM handlers installed by `autoCleanup`, so call it when a long-running command is shutting down and should leave no listeners behind.

**Returns:** `Promise<void>`

```ts
await pm.stop() // killAll + remove process exit handlers
```



### remove

Remove a finished handler from tracking.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `id` | `string` | ✓ | The process ID to remove |

**Returns:** `boolean`



### enable

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `any` |  | Parameter options |

**Returns:** `Promise<this>`



### _onHandlerDone

Called by SpawnHandler when a process finishes. Updates feature-level state.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `handler` | `SpawnHandler` | ✓ | Parameter handler |
| `status` | `'exited' | 'crashed' | 'killed'` | ✓ | Parameter status |
| `exitCode` | `number` |  | Parameter exitCode |

**Returns:** `void`



## Events (Zod v4 schema)

### spawned

Emitted when a new process is spawned

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | process ID |
| `arg1` | `string` | process metadata |



### exited

Emitted when a process exits normally

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | process ID |
| `arg1` | `number` | exit code |



### crashed

Emitted when a process exits with non-zero code

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | process ID |
| `arg1` | `number` | exit code |
| `arg2` | `string` | error info |



### killed

Emitted when a process is killed

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | process ID |



### allStopped

Emitted when all tracked processes have stopped



## State (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `boolean` | Whether this feature is currently enabled |
| `processes` | `object` | Map of process ID to metadata |
| `totalSpawned` | `number` | Total number of processes spawned since feature creation |

## Examples

**features.processManager**

```ts
// Enable with auto-cleanup so tracked processes die when the parent exits
const pm = container.feature('processManager', { enable: true, autoCleanup: true })

// spawn() returns a SpawnHandler immediately — it never blocks
const server = pm.spawn('node', ['server.js'], { tag: 'api', cwd: '/app' })
server.on('stdout', (data) => console.log('[api]', data))
server.on('crash', (code) => console.error('API crashed:', code))

// Peek at buffered output (first 20 + last 50 lines)
const { head, tail } = server.peek()

// List and lookup tracked processes (running and finished)
pm.list()                          // SpawnHandler[]
pm.getByTag('api')                 // SpawnHandler | undefined
pm.state.get('totalSpawned')       // number of processes spawned so far

// Spawn something long-lived and terminate it
const sleeper = pm.spawn('sleep', ['10'], { tag: 'sleeper' })
sleeper.kill()                     // status becomes 'killed'

// Kill everything still running, then full teardown
pm.killAll()
pm.list().filter(h => h.isRunning).length // => 0
await pm.stop()                    // killAll + remove exit handlers
```



**spawn**

```ts
const pm = container.feature('processManager', { enable: true })

// Returns immediately — the handle carries state, events, and lifecycle methods
const handle = pm.spawn('echo', ['hello from process manager'], { tag: 'greeter' })
handle.on('stdout', (data) => console.log(data))

// Wait for completion when you need the result
const exitCode = await handle.await()
```



**getByTag**

```ts
pm.spawn('sleep', ['5'], { tag: 'napper' })
const found = pm.getByTag('napper')
console.log('Found by tag:', found ? found.status : 'no')
```



**list**

```ts
const all = pm.list()
const running = all.filter(h => h.isRunning)
console.log(`${running.length} running of ${all.length} tracked`)
```



**killAll**

```ts
pm.killAll()
pm.list().filter(h => h.isRunning).length // => 0
```



**stop**

```ts
await pm.stop() // killAll + remove process exit handlers
```

