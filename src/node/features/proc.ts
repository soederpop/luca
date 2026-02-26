import { features, Feature } from "../feature.js";
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'
import { execSync } from "child_process";
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
  static override stateSchema = FeatureStateSchema
  static override optionsSchema = FeatureOptionsSchema

  /**
   * Executes a command string and captures its output asynchronously.
   * 
   * This method takes a complete command string, splits it into command and arguments,
   * and executes it using the spawnAndCapture method. It's a convenient wrapper
   * for simple command execution.
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
   * Runs a script file with Bun, inheriting stdout for full TTY passthrough
   * (animations, colors, cursor movement) while capturing stderr in a rolling buffer.
   *
   * @param {string} scriptPath - Absolute path to the script file
   * @param {object} [options] - Options
   * @param {string} [options.cwd] - Working directory
   * @param {number} [options.maxLines=100] - Max stderr lines to keep
   * @param {Record<string, string>} [options.env] - Extra environment variables
   * @returns {Promise<{ exitCode: number, stderr: string[] }>}
   *
   * @example
   * ```typescript
   * const { exitCode, stderr } = await proc.runScript('/path/to/script.ts')
   * if (exitCode !== 0) {
   *   console.log('Error:', stderr.join('\n'))
   * }
   * ```
   */
  async runScript(
    scriptPath: string,
    options?: { cwd?: string; maxLines?: number; env?: Record<string, string> }
  ): Promise<{ exitCode: number; stderr: string[] }> {
    const cwd = options?.cwd ?? this.container.cwd
    const maxLines = options?.maxLines ?? 100

    const proc = Bun.spawn(['bun', 'run', scriptPath], {
      cwd,
      stdout: 'inherit',
      stderr: 'pipe',
      env: { ...process.env, ...options?.env },
    })

    const stderrLines: string[] = []

    const reader = proc.stderr.getReader()
    const decoder = new TextDecoder()
    let partial = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const text = partial + decoder.decode(value, { stream: true })
      const lines = text.split('\n')
      partial = lines.pop() || ''

      for (const line of lines) {
        process.stderr.write(line + '\n')
        stderrLines.push(line)
        if (stderrLines.length > maxLines) stderrLines.shift()
      }
    }

    if (partial) {
      process.stderr.write(partial + '\n')
      stderrLines.push(partial)
      if (stderrLines.length > maxLines) stderrLines.shift()
    }

    const exitCode = await proc.exited

    return { exitCode, stderr: stderrLines }
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
      ...options,
    })
      .toString()
      .trim();
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
   * @returns {boolean} True if the signal was sent successfully, false if the process was not found
   *
   * @example
   * ```typescript
   * // Gracefully terminate a process
   * proc.kill(12345)
   *
   * // Force kill a process
   * proc.kill(12345, 'SIGKILL')
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
  /**
   * Registers a handler for a process signal (e.g. SIGINT, SIGTERM, SIGUSR1).
   *
   * Returns a cleanup function that removes the listener when called.
   *
   * @param {NodeJS.Signals} signal - The signal name to listen for (e.g. 'SIGINT', 'SIGTERM', 'SIGUSR2')
   * @param {() => void} handler - The function to call when the signal is received
   * @returns {{ off: () => void }} Object with an off function to remove the listener
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
   * const { off } = proc.onSignal('SIGUSR2', () => {
   *   console.log('Received SIGUSR2')
   * })
   * off()
   * ```
   */
  onSignal(signal: NodeJS.Signals, handler: () => void): { off: () => void } {
    process.on(signal, handler)
    return {
      off: () => {
        process.removeListener(signal, handler)
      }
    }
  }

  findPidsByPort(port: number): number[] {
    try {
      const output = execSync(`lsof -ti :${port}`, { stdio: ['pipe', 'pipe', 'pipe'] })
        .toString()
        .trim()

      if (!output) return []

      return [...new Set(
        output.split('\n').map((line) => parseInt(line.trim(), 10)).filter((pid) => !isNaN(pid))
      )]
    } catch {
      return []
    }
  }
}

export default features.register("proc", ChildProcess);
