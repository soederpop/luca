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
// Execute a git command — failures are captured, not thrown
const result = await proc.execAndCapture('git status --porcelain')
if (result.exitCode === 0) {
 console.log('Git status:', result.stdout)
} else {
 console.error('Git error:', result.stderr)
}

// Execute with options
const listing = await proc.execAndCapture('ls -1', { cwd: 'src' })

// WRONG: quoted args with spaces get split apart
// await proc.execAndCapture('git log --format="%h %ad %s" --date=short')
// RIGHT: use spawnAndCapture with an args array
const log = await proc.spawnAndCapture('git', ['log', '--format=%h %ad %s', '--date=short'])
```



### spawnAndCapture

Run a command to completion and get `{ stdout, stderr, exitCode, error }`. This is the default way to run a command. Failures are returned, not thrown — check `exitCode` (and `error`) on the result. Arguments are passed as an array, so nothing is split or shell-escaped. Pass `onOutput`/`onError` callbacks to also watch output live as it streams; the full output is still captured in the returned strings either way. Use `spawn()` instead only when you need the raw ChildProcess handle (streaming without waiting for exit, kill(), detached daemons).

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `command` | `string` | ✓ | The command to execute (e.g., 'node', 'npm', 'git') |
| `args` | `string[]` | ✓ | Array of arguments to pass to the command |
| `options` | `SpawnOptions` |  | Options for process execution and monitoring |

`SpawnOptions` properties:

| Property | Type | Description |
|----------|------|-------------|
| `detached` | `boolean` | Run in a separate process group, allowing callers to cancel the child and its descendants together |
| `stdio` | `"ignore" | "inherit"` | Standard I/O mode for the child process |
| `stdout` | `"ignore" | "inherit"` | Stdout mode for the child process |
| `stderr` | `"ignore" | "inherit"` | Stderr mode for the child process |
| `cwd` | `string` | Working directory for the child process |
| `environment` | `Record<string, any>` | Environment variables to pass to the child process |
| `onError` | `(data: string) => void` | Callback invoked when stderr data is received |
| `onOutput` | `(data: string) => void` | Callback invoked when stdout data is received |
| `onExit` | `(code: number) => void` | Callback invoked when the process exits |
| `onStart` | `(childProcess: ReturnType<typeof nodeSpawn>) => void` | Callback invoked when the process starts |

**Returns:** `Promise<{
    stderr: string;
    stdout: string;
    error: null | any;
    exitCode: number;
    pid: number | null;
  }>`

```ts
// Run a command, get the result — failures come back, they don't throw
const result = await proc.spawnAndCapture('node', ['--version'])
if (result.exitCode === 0) {
 console.log(`Node version: ${result.stdout}`)
} else {
 console.error('failed:', result.stderr)
}

// Watch output live while still capturing it all
const monitored = await proc.spawnAndCapture('bun', ['--version'], {
 onOutput: (data) => console.log('OUT:', data.trim()),
 onError: (data) => console.error('ERR:', data.trim()),
 onExit: (code) => console.log(`Process exited with code ${code}`)
})

// Custom working directory
const listing = await proc.spawnAndCapture('ls', ['-1'], { cwd: 'src' })
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



### execSync

Execute a command synchronously and return its output. Runs a shell command and waits for it to complete before returning. Useful for simple commands where you need the result immediately.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `command` | `string` | ✓ | The command to execute through the shell |
| `options` | `any` |  | Options forwarded to node's execSync (cwd, encoding, maxBuffer, ...) |

**Returns:** `string`

```ts
const greeting = proc.execSync('echo "Hello World"')
const version = proc.execSync('node --version')

// Run in a different directory without changing the container's cwd
const listing = proc.execSync('ls -1', { cwd: 'src' })

// NOTE: execSync throws on a non-zero exit code — commands that can fail
// (e.g. git outside a repository) belong in a try/catch, or better, use
// tryExec() which runs through a real shell and never throws (the exit
// code and stderr come back as data).
```



### exec

REMOVED — renamed to `execSync`. Calling this always throws with migration guidance. The old name read as async, so agents kept writing `await proc.exec(...)` and misreading its blocking, string-returning behavior. Use `execSync` (same semantics, honest name) or `tryExec` for the async, non-throwing variant.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `command` | `string` | ✓ | Ignored; the call always throws |
| `options` | `any` |  | Ignored; the call always throws |

**Returns:** `never`

```ts
// proc.exec('ls')            — throws: renamed
const listing = proc.execSync('ls')          // sync, trimmed stdout
const safe = await proc.tryExec('ls /maybe') // async, never throws
```



### tryExec

Execute a command string through a real shell, asynchronously, and NEVER throw. This is the safe default for running commands that can fail: shell quoting works (unlike `execAndCapture`, which splits naively on spaces), the call is async (unlike `execSync`, which blocks), and a non-zero exit code is returned as data instead of thrown. Inspect `exitCode` yourself.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `cmd` | `string` | ✓ | The complete command string, interpreted by /bin/sh (cmd.exe on Windows) — quotes, pipes, and redirects all work |
| `options` | `SpawnOptions` |  | Options forwarded to spawnAndCapture (cwd, onOutput, onError, ...) |

`SpawnOptions` properties:

| Property | Type | Description |
|----------|------|-------------|
| `detached` | `boolean` | Run in a separate process group, allowing callers to cancel the child and its descendants together |
| `stdio` | `"ignore" | "inherit"` | Standard I/O mode for the child process |
| `stdout` | `"ignore" | "inherit"` | Stdout mode for the child process |
| `stderr` | `"ignore" | "inherit"` | Stderr mode for the child process |
| `cwd` | `string` | Working directory for the child process |
| `environment` | `Record<string, any>` | Environment variables to pass to the child process |
| `onError` | `(data: string) => void` | Callback invoked when stderr data is received |
| `onOutput` | `(data: string) => void` | Callback invoked when stdout data is received |
| `onExit` | `(code: number) => void` | Callback invoked when the process exits |
| `onStart` | `(childProcess: ReturnType<typeof nodeSpawn>) => void` | Callback invoked when the process starts |

**Returns:** `Promise<{ stdout: string; stderr: string; exitCode: number }>`

```ts
// Quoted arguments survive intact
const ok = await proc.tryExec('echo "two words"')
console.log(ok.stdout.trim()) // 'two words'

// Failure is data, not an exception
const bad = await proc.tryExec('git -C /nowhere status')
if (bad.exitCode !== 0) {
 console.error('git failed:', bad.stderr.trim())
}
```



### execJson

Execute a command through a real shell and parse its stdout as JSON. The obvious shape for JSON-speaking CLIs (`gh`, `docker inspect`, `curl`). Throws on a non-zero exit code with stderr in the error message, and throws on unparseable stdout with a snippet of the offending output — so a failure is always loud and diagnosable. For a non-throwing variant, use `tryExec` and parse yourself.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `cmd` | `string` | ✓ | The complete command string, interpreted by a real shell (quoting works) |
| `options` | `SpawnOptions` |  | Options forwarded to spawnAndCapture (cwd, ...) |

`SpawnOptions` properties:

| Property | Type | Description |
|----------|------|-------------|
| `detached` | `boolean` | Run in a separate process group, allowing callers to cancel the child and its descendants together |
| `stdio` | `"ignore" | "inherit"` | Standard I/O mode for the child process |
| `stdout` | `"ignore" | "inherit"` | Stdout mode for the child process |
| `stderr` | `"ignore" | "inherit"` | Stderr mode for the child process |
| `cwd` | `string` | Working directory for the child process |
| `environment` | `Record<string, any>` | Environment variables to pass to the child process |
| `onError` | `(data: string) => void` | Callback invoked when stderr data is received |
| `onOutput` | `(data: string) => void` | Callback invoked when stdout data is received |
| `onExit` | `(code: number) => void` | Callback invoked when the process exits |
| `onStart` | `(childProcess: ReturnType<typeof nodeSpawn>) => void` | Callback invoked when the process starts |

**Returns:** `Promise<T>`

```ts
// Parse structured CLI output directly
const pkg = await proc.execJson<{ name: string }>('cat package.json')
console.log(pkg.name)

// const pr = await proc.execJson('gh pr view --json title,url')
```



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
const result = proc.execSync('echo "Hello World"')
console.log(result) // 'Hello World'

// The default way to run a command: await completion, get the result.
// Failures are returned (check exitCode), not thrown.
const { stdout, stderr, exitCode } = await proc.spawnAndCapture('npm', ['--version'])
console.log(`npm version: ${stdout}`)

// Optionally watch output live as it streams (still fully captured)
await proc.spawnAndCapture('npm', ['install'], {
 onOutput: (data) => console.log('OUT:', data),
 onError: (data) => console.log('ERR:', data)
})
```



**execAndCapture**

```ts
// Execute a git command — failures are captured, not thrown
const result = await proc.execAndCapture('git status --porcelain')
if (result.exitCode === 0) {
 console.log('Git status:', result.stdout)
} else {
 console.error('Git error:', result.stderr)
}

// Execute with options
const listing = await proc.execAndCapture('ls -1', { cwd: 'src' })

// WRONG: quoted args with spaces get split apart
// await proc.execAndCapture('git log --format="%h %ad %s" --date=short')
// RIGHT: use spawnAndCapture with an args array
const log = await proc.spawnAndCapture('git', ['log', '--format=%h %ad %s', '--date=short'])
```



**spawnAndCapture**

```ts
// Run a command, get the result — failures come back, they don't throw
const result = await proc.spawnAndCapture('node', ['--version'])
if (result.exitCode === 0) {
 console.log(`Node version: ${result.stdout}`)
} else {
 console.error('failed:', result.stderr)
}

// Watch output live while still capturing it all
const monitored = await proc.spawnAndCapture('bun', ['--version'], {
 onOutput: (data) => console.log('OUT:', data.trim()),
 onError: (data) => console.error('ERR:', data.trim()),
 onExit: (code) => console.log(`Process exited with code ${code}`)
})

// Custom working directory
const listing = await proc.spawnAndCapture('ls', ['-1'], { cwd: 'src' })
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



**execSync**

```ts
const greeting = proc.execSync('echo "Hello World"')
const version = proc.execSync('node --version')

// Run in a different directory without changing the container's cwd
const listing = proc.execSync('ls -1', { cwd: 'src' })

// NOTE: execSync throws on a non-zero exit code — commands that can fail
// (e.g. git outside a repository) belong in a try/catch, or better, use
// tryExec() which runs through a real shell and never throws (the exit
// code and stderr come back as data).
```



**exec**

```ts
// proc.exec('ls')            — throws: renamed
const listing = proc.execSync('ls')          // sync, trimmed stdout
const safe = await proc.tryExec('ls /maybe') // async, never throws
```



**tryExec**

```ts
// Quoted arguments survive intact
const ok = await proc.tryExec('echo "two words"')
console.log(ok.stdout.trim()) // 'two words'

// Failure is data, not an exception
const bad = await proc.tryExec('git -C /nowhere status')
if (bad.exitCode !== 0) {
 console.error('git failed:', bad.stderr.trim())
}
```



**execJson**

```ts
// Parse structured CLI output directly
const pkg = await proc.execJson<{ name: string }>('cat package.json')
console.log(pkg.name)

// const pr = await proc.execJson('gh pr view --json title,url')
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

