# ChildProcess (features.proc)

> Stability: `core`

The ChildProcess feature provides utilities for executing external processes and commands. This feature wraps Node.js child process functionality to provide convenient methods for executing shell commands, spawning processes, and capturing their output. It supports both synchronous and asynchronous execution with various options.

## Usage

```ts
container.feature('proc')
```

## Methods

### execAndCapture

Executes a command string and captures its output asynchronously. This method takes a complete command string, splits it into command and arguments, and executes it using the spawnAndCapture method. It's a convenient wrapper for simple command execution. **WARNING: the command string is split naively on spaces** — there is no shell quoting or escaping. Quoted arguments containing spaces (paths like `"/My Documents/file.txt"`, format strings like `--format="%h %s"`) get mangled into multiple arguments, quotes included. If any argument contains spaces or quotes, use `spawnAndCapture(command, argsArray)` instead and pass each argument as its own array element.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `cmd` | `string` | ✓ | The complete command string to execute (e.g., "git status --porcelain") |
| `options` | `any` |  | Options to pass to the underlying spawn process |

**Returns:** `Promise<{
    stderr: string;
    stdout: string;
    error: null | any;
    exitCode: number;
    pid: number | null;
  }>`

```ts
// Execute a git command
const result = await proc.execAndCapture('git status --porcelain')
if (result.exitCode === 0) {
 console.log('Git status:', result.stdout)
} else {
 console.error('Git error:', result.stderr)
}

// Execute with options
const result = await proc.execAndCapture('npm list --depth=0', {
 cwd: '/path/to/project'
})

// WRONG: quoted args with spaces get split apart
// await proc.execAndCapture('git log --format="%h %ad %s" --date=short')
// RIGHT: use spawnAndCapture with an args array
const log = await proc.spawnAndCapture('git', ['log', '--format=%h %ad %s', '--date=short'])
```



### spawnAndCapture

Spawns a process and captures its output with real-time monitoring capabilities. This method provides comprehensive process execution with the ability to capture output, monitor real-time data streams, and handle process lifecycle events. It's ideal for long-running processes where you need to capture output as it happens.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `command` | `string` | ✓ | The command to execute (e.g., 'node', 'npm', 'git') |
| `args` | `string[]` | ✓ | Array of arguments to pass to the command |
| `options` | `SpawnOptions` |  | Options for process execution and monitoring |

`SpawnOptions` properties:

| Property | Type | Description |
|----------|------|-------------|
| `stdio` | `"ignore" | "inherit"` | Standard I/O mode for the child process |
| `stdout` | `"ignore" | "inherit"` | Stdout mode for the child process |
| `stderr` | `"ignore" | "inherit"` | Stderr mode for the child process |
| `cwd` | `string` | Working directory for the child process |
| `environment` | `Record<string, any>` | Environment variables to pass to the child process |
| `onError` | `(data: string) => void` | Callback invoked when stderr data is received |
| `onOutput` | `(data: string) => void` | Callback invoked when stdout data is received |
| `onExit` | `(code: number) => void` | Callback invoked when the process exits |
| `onStart` | `(childProcess: ChildProcess) => void` | Callback invoked when the process starts |

**Returns:** `Promise<{
    stderr: string;
    stdout: string;
    error: null | any;
    exitCode: number;
    pid: number | null;
  }>`

```ts
// Basic usage
const result = await proc.spawnAndCapture('node', ['--version'])
console.log(`Node version: ${result.stdout}`)

// With real-time output monitoring
const result = await proc.spawnAndCapture('npm', ['install'], {
 onOutput: (data) => console.log('📦 ', data.trim()),
 onError: (data) => console.error('❌ ', data.trim()),
 onExit: (code) => console.log(`Process exited with code ${code}`)
})

// Long-running process with custom working directory
const buildResult = await proc.spawnAndCapture('npm', ['run', 'build'], {
 cwd: '/path/to/project',
 onOutput: (data) => {
   if (data.includes('error')) {
     console.error('Build error detected:', data)
   }
 }
})
```



### spawn

Spawn a raw child process and return the handle immediately. Useful when callers need streaming access to stdout/stderr and direct lifecycle control (for example, cancellation via kill()). Pass `detached: true` to run the child in its own process group so it can outlive the parent. When detached, stdio defaults to 'ignore' (piped stdio would tie the child to the parent and keep the parent's event loop alive) — call `.unref()` on the returned handle to let the parent exit.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `command` | `string` | ✓ | The executable to run |
| `args` | `string[]` |  | Arguments to pass to the command |
| `options` | `RawSpawnOptions` |  | Spawn options |

`RawSpawnOptions` properties:

| Property | Type | Description |
|----------|------|-------------|
| `cwd` | `string` | Working directory for the child process |
| `environment` | `Record<string, any>` | Environment variables to pass to the child process |
| `stdin` | `string | Buffer` | Optional stdin payload written immediately after spawn |
| `stdout` | `"pipe" | "inherit" | "ignore"` | Stdout mode for the child process |
| `stderr` | `"pipe" | "inherit" | "ignore"` | Stderr mode for the child process |
| `detached` | `boolean` | Run the child in its own process group so it can outlive the parent (defaults stdio to 'ignore') |

**Returns:** `import('child_process').ChildProcess`

```ts
// Streaming access with lifecycle control
const child = proc.spawn('bun', ['run', 'dev'])
child.stdout?.on('data', (buf) => console.log(buf.toString()))

// Background worker that outlives the CLI process
const worker = proc.spawn('bun', ['worker.ts'], {
 detached: true,   // own process group — not reaped when the CLI exits
 stdout: 'ignore', // no pipes back to the parent
 stderr: 'ignore',
})
worker.unref()      // let the parent event loop exit
console.log('worker pid:', worker.pid)
```



### exec

Execute a command synchronously and return its output. Runs a shell command and waits for it to complete before returning. Useful for simple commands where you need the result immediately.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `command` | `string` | ✓ | The command to execute |
| `options` | `any` |  | Options for command execution (cwd, encoding, etc.) |

**Returns:** `string`

```ts
const branch = proc.exec('git branch --show-current')
const version = proc.exec('node --version')
```



### execSync

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `command` | `string` | ✓ | Parameter command |
| `options` | `any` |  | Parameter options |

**Returns:** `string`



### establishLock

Establishes a PID-file lock to prevent duplicate process instances. Writes the current process PID to the given file path. If the file already exists and the PID inside it refers to a running process, the current process exits immediately. Stale PID files (where the process is no longer running) are automatically cleaned up. Cleanup handlers are registered on SIGTERM, SIGINT, and process exit to remove the PID file when the process shuts down.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `pidPath` | `string` | ✓ | Path to the PID file, resolved relative to container.cwd |

**Returns:** `{ release: () => void }`

```ts
// In a command handler — exits if already running
const lock = proc.establishLock('tmp/luca-main.pid')

// Later, if you need to release manually
lock.release()
```



### kill

Kills a process by its PID.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `pid` | `number` | ✓ | The process ID to kill |
| `signal` | `NodeJS.Signals | number` |  | The signal to send (e.g. 'SIGTERM', 'SIGKILL', 9) |

**Returns:** `boolean`

```ts
// Gracefully terminate a process
proc.kill(12345)

// Force kill a process
proc.kill(12345, 'SIGKILL')

// Liveness check (supervisor pattern): signal 0 sends nothing but
// returns false if the PID is dead/recycled — it does not throw.
// Perfect for checking a PID persisted via diskCache from an earlier run.
const cache = container.feature('diskCache')
if (await cache.has('worker')) {
 const { pid } = await cache.get('worker')
 const alive = proc.kill(pid, 0)   // true = still running, false = gone
}
```



### findPidsByPort

Finds PIDs of processes listening on a given port. Uses `lsof` on macOS/Linux to discover which processes have a socket bound to the specified port.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `port` | `number` | ✓ | The port number to search for |

**Returns:** `number[]`

```ts
const pids = proc.findPidsByPort(3000)
console.log(`Processes on port 3000: ${pids}`)

// Kill everything on port 3000
for (const pid of proc.findPidsByPort(3000)) {
 proc.kill(pid)
}
```



### isProcessRunning

Checks whether any process matching a given name is currently running. Uses `pgrep -x` for an exact match against process names.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `name` | `string` | ✓ | The process name to look for (e.g. 'afplay', 'node', 'nginx') |

**Returns:** `boolean`

```ts
if (proc.isProcessRunning('afplay')) {
 console.log('Audio is currently playing')
}
```



### onSignal

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `signal` | `NodeJS.Signals` | ✓ | Parameter signal |
| `handler` | `() => void` | ✓ | Parameter handler |

**Returns:** `() => void`



## State (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `boolean` | Whether this feature is currently enabled |

## Examples

**features.proc**

```ts
const proc = container.feature('proc')

// Execute a simple command synchronously
const result = proc.exec('echo "Hello World"')
console.log(result) // 'Hello World'

// Execute and capture output asynchronously
const { stdout, stderr } = await proc.spawnAndCapture('npm', ['--version'])
console.log(`npm version: ${stdout}`)

// Execute with callbacks for real-time output
await proc.spawnAndCapture('npm', ['install'], {
 onOutput: (data) => console.log('OUT:', data),
 onError: (data) => console.log('ERR:', data)
})
```



**execAndCapture**

```ts
// Execute a git command
const result = await proc.execAndCapture('git status --porcelain')
if (result.exitCode === 0) {
 console.log('Git status:', result.stdout)
} else {
 console.error('Git error:', result.stderr)
}

// Execute with options
const result = await proc.execAndCapture('npm list --depth=0', {
 cwd: '/path/to/project'
})

// WRONG: quoted args with spaces get split apart
// await proc.execAndCapture('git log --format="%h %ad %s" --date=short')
// RIGHT: use spawnAndCapture with an args array
const log = await proc.spawnAndCapture('git', ['log', '--format=%h %ad %s', '--date=short'])
```



**spawnAndCapture**

```ts
// Basic usage
const result = await proc.spawnAndCapture('node', ['--version'])
console.log(`Node version: ${result.stdout}`)

// With real-time output monitoring
const result = await proc.spawnAndCapture('npm', ['install'], {
 onOutput: (data) => console.log('📦 ', data.trim()),
 onError: (data) => console.error('❌ ', data.trim()),
 onExit: (code) => console.log(`Process exited with code ${code}`)
})

// Long-running process with custom working directory
const buildResult = await proc.spawnAndCapture('npm', ['run', 'build'], {
 cwd: '/path/to/project',
 onOutput: (data) => {
   if (data.includes('error')) {
     console.error('Build error detected:', data)
   }
 }
})
```



**spawn**

```ts
// Streaming access with lifecycle control
const child = proc.spawn('bun', ['run', 'dev'])
child.stdout?.on('data', (buf) => console.log(buf.toString()))

// Background worker that outlives the CLI process
const worker = proc.spawn('bun', ['worker.ts'], {
 detached: true,   // own process group — not reaped when the CLI exits
 stdout: 'ignore', // no pipes back to the parent
 stderr: 'ignore',
})
worker.unref()      // let the parent event loop exit
console.log('worker pid:', worker.pid)
```



**exec**

```ts
const branch = proc.exec('git branch --show-current')
const version = proc.exec('node --version')
```



**establishLock**

```ts
// In a command handler — exits if already running
const lock = proc.establishLock('tmp/luca-main.pid')

// Later, if you need to release manually
lock.release()
```



**kill**

```ts
// Gracefully terminate a process
proc.kill(12345)

// Force kill a process
proc.kill(12345, 'SIGKILL')

// Liveness check (supervisor pattern): signal 0 sends nothing but
// returns false if the PID is dead/recycled — it does not throw.
// Perfect for checking a PID persisted via diskCache from an earlier run.
const cache = container.feature('diskCache')
if (await cache.has('worker')) {
 const { pid } = await cache.get('worker')
 const alive = proc.kill(pid, 0)   // true = still running, false = gone
}
```



**findPidsByPort**

```ts
const pids = proc.findPidsByPort(3000)
console.log(`Processes on port 3000: ${pids}`)

// Kill everything on port 3000
for (const pid of proc.findPidsByPort(3000)) {
 proc.kill(pid)
}
```



**isProcessRunning**

```ts
if (proc.isProcessRunning('afplay')) {
 console.log('Audio is currently playing')
}
```

