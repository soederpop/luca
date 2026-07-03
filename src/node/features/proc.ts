import { Feature } from "../feature.js";
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'
import { execSync, spawn as nodeSpawn } from "child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from "fs";
import { dirname, resolve } from "path";
import * as asyncProc from "child-process-promise";

interface SpawnOptions {
  /** Standard I/O mode for the child process */
  stdio?: "ignore" | "inherit";
  /** Stdout mode for the child process */
  stdout?: "ignore" | "inherit";
  /** Stderr mode for the child process */
  stderr?: "ignore" | "inherit";
  /** Working directory for the child process */
  cwd?: string;
  /** Environment variables to pass to the child process */
  environment?: Record<string, any>;
  /** Callback invoked when stderr data is received */
  onError?: (data: string) => void;
  /** Callback invoked when stdout data is received */
  onOutput?: (data: string) => void;
  /** Callback invoked when the process exits */
  onExit?: (code: number) => void;
  /** Callback invoked when the process starts */
  onStart?: (childProcess: ChildProcess) => void;
}

interface RawSpawnOptions {
  /** Working directory for the child process */
  cwd?: string;
  /** Environment variables to pass to the child process */
  environment?: Record<string, any>;
  /** Optional stdin payload written immediately after spawn */
  stdin?: string | Buffer;
  /** Stdout mode for the child process */
  stdout?: "pipe" | "inherit" | "ignore";
  /** Stderr mode for the child process */
  stderr?: "pipe" | "inherit" | "ignore";
  /** Run the child in its own process group so it can outlive the parent (defaults stdio to 'ignore') */
  detached?: boolean;
}

/**
 * The ChildProcess feature provides utilities for executing external processes and commands.
 * 
 * This feature wraps Node.js child process functionality to provide convenient methods
 * for executing shell commands, spawning processes, and capturing their output.
 * It supports both synchronous and asynchronous execution with various options.
 * 
 * @example
 * ```typescript
 * const proc = container.feature('proc')
 * 
 * // Execute a simple command synchronously
 * const result = proc.exec('echo "Hello World"')
 * console.log(result) // 'Hello World'
 * 
 * // Execute and capture output asynchronously
 * const { stdout, stderr } = await proc.spawnAndCapture('npm', ['--version'])
 * console.log(`npm version: ${stdout}`)
 * 
 * // Execute with callbacks for real-time output
 * await proc.spawnAndCapture('npm', ['install'], {
 *   onOutput: (data) => console.log('OUT:', data),
 *   onError: (data) => console.log('ERR:', data)
 * })
 * ```
 * 
 * @extends Feature
 */
export class ChildProcess extends Feature {
  static override shortcut = "features.proc" as const
  static override stability = 'core' as const
  static override stateSchema = FeatureStateSchema
  static override optionsSchema = FeatureOptionsSchema
  // @ts-ignore TODO: fix this
  static { Feature.register(this, 'proc') }

  /**
   * Executes a command string and captures its output asynchronously.
   *
   * This method takes a complete command string, splits it into command and arguments,
   * and executes it using the spawnAndCapture method. It's a convenient wrapper
   * for simple command execution.
   *
   * **WARNING: the command string is split naively on spaces** — there is no shell
   * quoting or escaping. Quoted arguments containing spaces (paths like
   * `"/My Documents/file.txt"`, format strings like `--format="%h %s"`) get mangled
   * into multiple arguments, quotes included. If any argument contains spaces or
   * quotes, use `spawnAndCapture(command, argsArray)` instead and pass each argument
   * as its own array element.
   *
   * @param {string} cmd - The complete command string to execute (e.g., "git status --porcelain")
   * @param {any} [options] - Options to pass to the underlying spawn process
   * @returns {Promise<object>} Promise resolving to execution result with stdout, stderr, exitCode, pid, and error
   * 
   * @example
   * ```typescript
   * // Execute a git command
   * const result = await proc.execAndCapture('git status --porcelain')
   * if (result.exitCode === 0) {
   *   console.log('Git status:', result.stdout)
   * } else {
   *   console.error('Git error:', result.stderr)
   * }
   * 
   * // Execute with options
   * const result = await proc.execAndCapture('npm list --depth=0', {
   *   cwd: '/path/to/project'
   * })
   *
   * // WRONG: quoted args with spaces get split apart
   * // await proc.execAndCapture('git log --format="%h %ad %s" --date=short')
   * // RIGHT: use spawnAndCapture with an args array
   * const log = await proc.spawnAndCapture('git', ['log', '--format=%h %ad %s', '--date=short'])
   * ```
   */
  async execAndCapture(
    cmd: string,
    options?: any
  ): Promise<{
    stderr: string;
    stdout: string;
    error: null | any;
    exitCode: number;
    pid: number | null;
  }> {
    const [command, ...args] = cmd.split(" ");
    return this.spawnAndCapture(command!, args, options);
  }

  /**
   * Spawns a process and captures its output with real-time monitoring capabilities.
   *
   * This method provides comprehensive process execution with the ability to capture
   * output, monitor real-time data streams, and handle process lifecycle events.
   * It's ideal for long-running processes where you need to capture output as it happens.
   * 
   * @param {string} command - The command to execute (e.g., 'node', 'npm', 'git')
   * @param {string[]} args - Array of arguments to pass to the command
   * @param {SpawnOptions} [options] - Options for process execution and monitoring
   * @param {string} [options.cwd] - Working directory for the process
   * @param {Function} [options.onOutput] - Callback for stdout data
   * @param {Function} [options.onError] - Callback for stderr data  
   * @param {Function} [options.onExit] - Callback for process exit
   * @returns {Promise<object>} Promise resolving to complete execution result
   * 
   * @example
   * ```typescript
   * // Basic usage
   * const result = await proc.spawnAndCapture('node', ['--version'])
   * console.log(`Node version: ${result.stdout}`)
   * 
   * // With real-time output monitoring
   * const result = await proc.spawnAndCapture('npm', ['install'], {
   *   onOutput: (data) => console.log('📦 ', data.trim()),
   *   onError: (data) => console.error('❌ ', data.trim()),
   *   onExit: (code) => console.log(`Process exited with code ${code}`)
   * })
   * 
   * // Long-running process with custom working directory
   * const buildResult = await proc.spawnAndCapture('npm', ['run', 'build'], {
   *   cwd: '/path/to/project',
   *   onOutput: (data) => {
   *     if (data.includes('error')) {
   *       console.error('Build error detected:', data)
   *     }
   *   }
   * })
   * ```
   */
  async spawnAndCapture(
    command: string,
    args: string[],
    options?: SpawnOptions
  ): Promise<{
    stderr: string;
    stdout: string;
    error: null | any;
    exitCode: number;
    pid: number | null;
  }> {
    let stderr = "";
    let stdout = "";
    let pid: number | null = null;
    let exitCode: number = 0;
    let error: any = null;

    const {
      cwd = this.container.cwd,
      onError = (data: string) => {},
      onOutput = (data: string) => {},
      onExit = (code: number) => {} 
    } = options || {};

    const proc = asyncProc.spawn(command, args, {
      ...options,
      cwd,
    });

    const childProcess = proc.childProcess!;

    if (typeof options?.onStart === 'function') {
	    options.onStart(childProcess as any)
    }

    if (childProcess.stdout && childProcess.stderr) {
      childProcess.stdout.on("data", (buf: Buffer) => {
        stdout = stdout + buf.toString();
        onOutput(buf.toString());
      });

      childProcess.stderr.on("data", (buf: Buffer) => {
        stderr = stderr + buf.toString();
        onError(buf.toString());
      });
    } else {
      throw new Error(`Unable to spawn process ${command}`);
    }

    if (typeof childProcess.exitCode === "number") {
      exitCode = childProcess.exitCode;
    }

    if (typeof childProcess.pid === "number") {
      pid = childProcess.pid;
    }

    await proc.catch((err: any) => {
      error = err;
    });
    
    onExit(exitCode)

    return {
      stderr,
      stdout,
      exitCode,
      pid,
      error,
    };
  }

  /**
   * Spawn a raw child process and return the handle immediately.
   *
   * Useful when callers need streaming access to stdout/stderr and
   * direct lifecycle control (for example, cancellation via kill()).
   *
   * Pass `detached: true` to run the child in its own process group so it can
   * outlive the parent. When detached, stdio defaults to 'ignore' (piped stdio
   * would tie the child to the parent and keep the parent's event loop alive) —
   * call `.unref()` on the returned handle to let the parent exit.
   *
   * @param {string} command - The executable to run
   * @param {string[]} args - Arguments to pass to the command
   * @param {RawSpawnOptions} [options] - Spawn options
   * @param {boolean} [options.detached] - Run the child in its own process group so it survives parent exit
   * @param {string} [options.stdout] - 'pipe' | 'inherit' | 'ignore' (defaults to 'ignore' when detached)
   * @param {string} [options.stderr] - 'pipe' | 'inherit' | 'ignore' (defaults to 'ignore' when detached)
   * @returns {import('child_process').ChildProcess} The raw child process handle
   *
   * @example
   * ```typescript
   * // Streaming access with lifecycle control
   * const child = proc.spawn('bun', ['run', 'dev'])
   * child.stdout?.on('data', (buf) => console.log(buf.toString()))
   *
   * // Background worker that outlives the CLI process
   * const worker = proc.spawn('bun', ['worker.ts'], {
   *   detached: true,   // own process group — not reaped when the CLI exits
   *   stdout: 'ignore', // no pipes back to the parent
   *   stderr: 'ignore',
   * })
   * worker.unref()      // let the parent event loop exit
   * console.log('worker pid:', worker.pid)
   * ```
   */
  spawn(command: string, args: string[] = [], options: RawSpawnOptions = {}): import('child_process').ChildProcess {
    const cwd = options.cwd ?? this.container.cwd
    const detached = options.detached ?? false
    // Piped stdio keeps the parent alive and dies with it — detached children
    // default to 'ignore' so they can genuinely outlive the parent process.
    const stdout = options.stdout ?? (detached ? 'ignore' : 'pipe')
    const stderr = options.stderr ?? (detached ? 'ignore' : 'pipe')
    const stdin = options.stdin != null ? 'pipe' : (detached ? 'ignore' : 'pipe')
    const child = nodeSpawn(command, args, {
      cwd,
      env: { ...process.env, ...(options.environment ?? {}) },
      stdio: [stdin, stdout, stderr],
      detached,
    })

    if (options.stdin != null && child.stdin) {
      child.stdin.write(options.stdin)
      child.stdin.end()
    }

    return child
  }



  /**
   * Execute a command synchronously and return its output.
   *
   * Runs a shell command and waits for it to complete before returning.
   * Useful for simple commands where you need the result immediately.
   *
   * @param command - The command to execute
   * @param options - Options for command execution (cwd, encoding, etc.)
   * @returns The trimmed stdout from the command execution
   * @throws If the command fails or returns non-zero exit code
   *
   * @example
   * ```typescript
   * const branch = proc.exec('git branch --show-current')
   * const version = proc.exec('node --version')
   * ```
   */
  exec(command: string, options?: any): string {
    return execSync(command, {
      cwd: this.container.cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      ...options,
    })
      .toString()
      .trim();
  }

  execSync(command: string, options?: any): string {
	  return this.exec(command,options)
  }

  /**
   * Establishes a PID-file lock to prevent duplicate process instances.
   *
   * Writes the current process PID to the given file path. If the file already exists
   * and the PID inside it refers to a running process, the current process exits immediately.
   * Stale PID files (where the process is no longer running) are automatically cleaned up.
   *
   * Cleanup handlers are registered on SIGTERM, SIGINT, and process exit to remove the
   * PID file when the process shuts down.
   *
   * @param {string} pidPath - Path to the PID file, resolved relative to container.cwd
   * @returns {{ release: () => void }} Object with a release function to manually remove the lock
   *
   * @example
   * ```typescript
   * // In a command handler — exits if already running
   * const lock = proc.establishLock('tmp/luca-main.pid')
   *
   * // Later, if you need to release manually
   * lock.release()
   * ```
   */
  establishLock(pidPath: string): { release: () => void } {
    const fullPath = resolve(this.container.cwd, pidPath)

    mkdirSync(dirname(fullPath), { recursive: true })

    if (existsSync(fullPath)) {
      const existingPid = parseInt(readFileSync(fullPath, 'utf8').trim(), 10)

      if (!isNaN(existingPid)) {
        try {
          // signal 0 doesn't kill — just checks if process exists
          process.kill(existingPid, 0)
          // Process is alive — bail out
          console.error(`[lock] Process already running (PID ${existingPid}, lock: ${pidPath}). Exiting.`)
          process.exit(1)
        } catch {
          // Process is gone — stale PID file, clean it up
          unlinkSync(fullPath)
        }
      } else {
        // Corrupt PID file — remove it
        unlinkSync(fullPath)
      }
    }

    // Write our PID
    writeFileSync(fullPath, String(process.pid), 'utf8')

    let released = false

    const release = () => {
      if (released) return
      released = true
      try {
        // Only remove if it's still our PID (guard against race)
        if (existsSync(fullPath)) {
          const contents = readFileSync(fullPath, 'utf8').trim()
          if (contents === String(process.pid)) {
            unlinkSync(fullPath)
          }
        }
      } catch {
        // Best effort — process is dying anyway
      }
    }

    process.on('SIGTERM', release)
    process.on('SIGINT', release)
    process.on('exit', release)

    return { release }
  }

  /**
   * Kills a process by its PID.
   *
   * @param {number} pid - The process ID to kill
   * @param {NodeJS.Signals | number} [signal='SIGTERM'] - The signal to send (e.g. 'SIGTERM', 'SIGKILL', 9)
   * @returns {boolean} True if the signal was sent successfully, false if the process was not found (ESRCH). Other errors (e.g. EPERM for processes you lack permission to signal) are thrown.
   *
   * @example
   * ```typescript
   * // Gracefully terminate a process
   * proc.kill(12345)
   *
   * // Force kill a process
   * proc.kill(12345, 'SIGKILL')
   *
   * // Liveness check (supervisor pattern): signal 0 sends nothing but
   * // returns false if the PID is dead/recycled — it does not throw.
   * // Perfect for checking a PID persisted via diskCache from an earlier run.
   * const cache = container.feature('diskCache')
   * if (await cache.has('worker')) {
   *   const { pid } = await cache.get('worker')
   *   const alive = proc.kill(pid, 0)   // true = still running, false = gone
   * }
   * ```
   */
  kill(pid: number, signal: NodeJS.Signals | number = 'SIGTERM'): boolean {
    try {
      process.kill(pid, signal)
      return true
    } catch (err: any) {
      if (err.code === 'ESRCH') return false
      throw err
    }
  }

  /**
   * Finds PIDs of processes listening on a given port.
   *
   * Uses `lsof` on macOS/Linux to discover which processes have a socket bound to the specified port.
   *
   * @param {number} port - The port number to search for
   * @returns {number[]} Array of PIDs listening on that port (empty if none found)
   *
   * @example
   * ```typescript
   * const pids = proc.findPidsByPort(3000)
   * console.log(`Processes on port 3000: ${pids}`)
   *
   * // Kill everything on port 3000
   * for (const pid of proc.findPidsByPort(3000)) {
   *   proc.kill(pid)
   * }
   * ```
   */
  findPidsByPort(port: number): number[] {
    try {
      const isWindows = process.platform === 'win32'
      const cmd = isWindows
        ? `netstat -ano | findstr :${port} | findstr LISTENING`
        : `lsof -ti :${port}`
      const output = execSync(cmd, { stdio: ['pipe', 'pipe', 'pipe'] })
        .toString()
        .trim()

      if (!output) return []

      if (isWindows) {
        // netstat lines end with the PID: "  TCP  0.0.0.0:3000  0.0.0.0:0  LISTENING  1234"
        return [...new Set(
          output.split(/\r?\n/).map((line) => {
            const parts = line.trim().split(/\s+/)
            return parseInt(parts[parts.length - 1]!, 10)
          }).filter((pid) => !isNaN(pid))
        )]
      }

      return [...new Set(
        output.split(/\r?\n/).map((line) => parseInt(line.trim(), 10)).filter((pid) => !isNaN(pid))
      )]
    } catch {
      return []
    }
  }

  /**
   * Registers a handler for a process signal (e.g. SIGINT, SIGTERM, SIGUSR1).
   *
   * Returns a cleanup function that removes the listener when called.
   *
   * @param {NodeJS.Signals} signal - The signal name to listen for (e.g. 'SIGINT', 'SIGTERM', 'SIGUSR2')
   * @param {() => void} handler - The function to call when the signal is received
   * @returns {() => void} A function that removes the listener when called
   *
   * @example
   * ```typescript
   * // Graceful shutdown
   * proc.onSignal('SIGTERM', () => {
   *   console.log('Shutting down gracefully...')
   *   process.exit(0)
   * })
   *
   * // Remove the listener later
   * const off = proc.onSignal('SIGUSR2', () => {
   *   console.log('Received SIGUSR2')
   * })
   * off()
   * ```
   */
  /**
   * Checks whether any process matching a given name is currently running.
   *
   * Uses `pgrep -x` for an exact match against process names.
   *
   * @param {string} name - The process name to look for (e.g. 'afplay', 'node', 'nginx')
   * @returns {boolean} True if at least one matching process is running
   *
   * @example
   * ```typescript
   * if (proc.isProcessRunning('afplay')) {
   *   console.log('Audio is currently playing')
   * }
   * ```
   */
  isProcessRunning(name: string): boolean {
    try {
      const isWindows = process.platform === 'win32'
      const cmd = isWindows
        ? `tasklist /FI "IMAGENAME eq ${name}" /NH`
        : `pgrep -x ${name}`
      const output = execSync(cmd, { stdio: ['pipe', 'pipe', 'pipe'] })
        .toString()
        .trim()

      if (isWindows) {
        // tasklist returns "INFO: No tasks are running..." when not found
        return !output.toLowerCase().includes('no tasks') && output.length > 0
      }

      return output.length > 0
    } catch {
      return false
    }
  }

  onSignal(signal: NodeJS.Signals, handler: () => void): () => void {
    process.on(signal, handler)
    return () => process.removeListener(signal, handler)
  }
}

export default ChildProcess
