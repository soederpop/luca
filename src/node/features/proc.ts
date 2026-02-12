import { features, Feature } from "../feature.js";
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'
import { execSync } from "child_process";
import * as asyncProc from "child-process-promise";

interface SpawnOptions {
  stdio?: "ignore" | "inherit";
  stdout?: "ignore" | "inherit";
  stderr?: "ignore" | "inherit";
  cwd?: string;
  environment?: Record<string, any>;
  onError?: (data: string) => void;
  onOutput?: (data: string) => void;
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
   * Executes a command synchronously and returns its output.
   * 
   * This method runs a command and waits for it to complete before returning.
   * It's useful for simple commands where you need the result immediately
   * and don't require real-time output monitoring.
   * 
   * @param {string} command - The command to execute
   * @param {any} [options] - Options for command execution (cwd, encoding, etc.)
   * @returns {string} The trimmed stdout from the command execution
   * @throws {Error} Throws an error if the command fails or returns non-zero exit code
   * 
   * @example
   * ```typescript
   * // Get current git branch
   * const branch = proc.exec('git branch --show-current')
   * console.log(`Current branch: ${branch}`)
   * 
   * // Get Node.js version
   * const nodeVersion = proc.exec('node --version')
   * console.log(`Node.js: ${nodeVersion}`)
   * 
   * // Execute in specific directory
   * const packageName = proc.exec('node -p "require(\'./package.json\').name"', {
   *   cwd: '/path/to/project'
   * })
   * 
   * // Handle potential errors
   * try {
   *   const output = proc.exec('some-command-that-might-fail')
   *   console.log(output)
   * } catch (error) {
   *   console.error('Command failed:', error.message)
   * }
   * ```
   */
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

  exec(command: string, options?: any): string {
    return execSync(command, {
      cwd: this.container.cwd,
      ...options,
    })
      .toString()
      .trim();
  }
}

export default features.register("proc", ChildProcess);
