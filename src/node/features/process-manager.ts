import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from '../../schemas/base.js'
import { Feature } from '../feature.js'
import { State } from '../../state.js'
import { Bus, type EventMap } from '../../bus.js'
import type { ChildProcess } from './proc.js'

// ─── Output Buffer ─────────────────────────────────────────────────────────

const HEAD_LINES = 20
const TAIL_LINES = 50

/**
 * A memory-efficient output buffer that keeps the first N lines (head)
 * and the last M lines (tail), discarding everything in between.
 */
class OutputBuffer {
  private _head: string[] = []
  private _tail: string[] = []
  private _totalLines = 0
  private _partial = ''
  private _headFull = false

  constructor(
    private _headLimit = HEAD_LINES,
    private _tailLimit = TAIL_LINES
  ) {}

  /** Append a chunk of output (may contain partial lines) */
  append(chunk: string): void {
    const text = this._partial + chunk
    const lines = text.split('\n')

    // Last element is a partial line (no trailing newline) — hold it
    this._partial = lines.pop()!

    for (const line of lines) {
      this._pushLine(line)
    }
  }

  /** Flush any remaining partial line */
  flush(): void {
    if (this._partial) {
      this._pushLine(this._partial)
      this._partial = ''
    }
  }

  get totalLines() { return this._totalLines }

  /** Get the head lines (first N lines of output) */
  get head(): string[] { return this._head }

  /** Get the tail lines (last M lines of output) */
  get tail(): string[] { return this._tail }

  /** Number of lines dropped between head and tail */
  get droppedLines(): number {
    return Math.max(0, this._totalLines - this._head.length - this._tail.length)
  }

  /** Format the buffer for display */
  toString(): string {
    const parts: string[] = []
    if (this._head.length) parts.push(this._head.join('\n'))
    if (this.droppedLines > 0) parts.push(`\n... (${this.droppedLines} lines omitted) ...\n`)
    if (this._tail.length && this._totalLines > this._headLimit) parts.push(this._tail.join('\n'))
    return parts.join('\n')
  }

  private _pushLine(line: string): void {
    this._totalLines++

    if (!this._headFull) {
      this._head.push(line)
      if (this._head.length >= this._headLimit) this._headFull = true
      return
    }

    this._tail.push(line)
    if (this._tail.length > this._tailLimit) {
      this._tail.shift()
    }
  }
}

// ─── Schemas ────────────────────────────────────────────────────────────────

const ProcessMetadataSchema = z.object({
  id: z.string().describe('Unique process identifier'),
  tag: z.string().optional().describe('User-defined tag for lookups'),
  command: z.string().describe('The command that was spawned'),
  args: z.array(z.string()).describe('Arguments passed to the command'),
  pid: z.number().optional().describe('OS process ID'),
  status: z.enum(['running', 'exited', 'crashed', 'killed']).describe('Current process lifecycle status'),
  exitCode: z.number().optional().describe('Exit code after process ends'),
  startedAt: z.number().describe('Timestamp when the process was spawned'),
  endedAt: z.number().optional().describe('Timestamp when the process ended'),
})

export const ProcessManagerStateSchema = FeatureStateSchema.extend({
  processes: z.record(z.string(), ProcessMetadataSchema)
    .describe('Map of process ID to metadata'),
  totalSpawned: z.number().default(0)
    .describe('Total number of processes spawned since feature creation'),
})
export type ProcessManagerState = z.infer<typeof ProcessManagerStateSchema>

export const ProcessManagerOptionsSchema = FeatureOptionsSchema.extend({
  autoCleanup: z.boolean().default(true)
    .describe('Register process.on exit/SIGINT/SIGTERM handlers to kill all tracked processes'),
})
export type ProcessManagerOptions = z.infer<typeof ProcessManagerOptionsSchema>

export const ProcessManagerEventsSchema = FeatureEventsSchema.extend({
  spawned: z.tuple([z.string().describe('process ID'), z.string().describe('process metadata')])
    .describe('Emitted when a new process is spawned'),
  exited: z.tuple([z.string().describe('process ID'), z.number().describe('exit code')])
    .describe('Emitted when a process exits normally'),
  crashed: z.tuple([z.string().describe('process ID'), z.number().describe('exit code'), z.string().describe('error info')])
    .describe('Emitted when a process exits with non-zero code'),
  killed: z.tuple([z.string().describe('process ID')])
    .describe('Emitted when a process is killed'),
  allStopped: z.tuple([])
    .describe('Emitted when all tracked processes have stopped'),
})

// ─── SpawnHandler ───────────────────────────────────────────────────────────

interface SpawnHandlerState {
  id: string
  tag?: string
  command: string
  args: string[]
  pid?: number
  status: 'running' | 'exited' | 'crashed' | 'killed'
  exitCode?: number
  startedAt: number
  endedAt?: number
}

interface SpawnHandlerEvents extends EventMap {
  stdout: [data: string]
  stderr: [data: string]
  exit: [code: number]
  crash: [code: number]
  killed: []
}

export interface SpawnOptions {
  /** User-defined tag for later lookups via getByTag() */
  tag?: string
  /** Working directory for the spawned process (defaults to container cwd) */
  cwd?: string
  /** Additional environment variables merged with process.env */
  env?: Record<string, string>
  /** stdin mode: 'pipe' to write to the process, 'inherit', or 'ignore' (default: 'ignore') */
  stdin?: 'pipe' | 'inherit' | 'ignore' | null
  /** stdout mode: 'pipe' to capture output, 'inherit', or 'ignore' (default: 'pipe') */
  stdout?: 'pipe' | 'inherit' | 'ignore' | null
  /** stderr mode: 'pipe' to capture errors, 'inherit', or 'ignore' (default: 'pipe') */
  stderr?: 'pipe' | 'inherit' | 'ignore' | null
}

/**
 * A handle to a spawned long-running process.
 *
 * Provides observable state, events, and methods to interact with
 * the running process. Returned immediately from `ProcessManager.spawn()`
 * without blocking. Maintains a memory-efficient output buffer that keeps
 * the first 20 lines and last 50 lines of stdout/stderr.
 *
 * @example
 * ```ts
 * const handler = pm.spawn('node', ['server.js'], { tag: 'api' })
 * handler.on('stdout', (data) => console.log(data))
 * handler.on('crash', (code) => console.error('crashed:', code))
 * const exitCode = await handler.await()
 * ```
 */
export class SpawnHandler {
  readonly state: State<SpawnHandlerState>
  readonly events = new Bus<SpawnHandlerEvents>()
  readonly stdout = new OutputBuffer(HEAD_LINES, TAIL_LINES)
  readonly stderr = new OutputBuffer(HEAD_LINES, TAIL_LINES)

  private _childProcess: any = null
  private _manager: ProcessManager
  private _exitPromise: Promise<number> | null = null
  private _exitResolve: ((code: number) => void) | null = null

  constructor(
    id: string,
    command: string,
    args: string[],
    manager: ProcessManager,
    options: SpawnOptions = {}
  ) {
    this._manager = manager
    this.state = new State<SpawnHandlerState>({
      initialState: {
        id,
        command,
        args,
        tag: options.tag,
        status: 'running',
        startedAt: Date.now(),
      }
    })

    this._exitPromise = new Promise<number>((resolve) => {
      this._exitResolve = resolve
    })
  }

  /** The unique process identifier */
  get id() { return this.state.get('id')! }

  /** The user-defined tag, if any */
  get tag() { return this.state.get('tag') }

  /** The OS process ID */
  get pid() { return this.state.get('pid') }

  /** Whether the process is still running */
  get isRunning() { return this.state.get('status') === 'running' }

  /** Whether the process has finished (exited, crashed, or killed) */
  get isDone() {
    const s = this.state.get('status')
    return s === 'exited' || s === 'crashed' || s === 'killed'
  }

  /** Current process lifecycle status */
  get status() { return this.state.get('status')! }

  /** Exit code after process ends */
  get exitCode() { return this.state.get('exitCode') }

  /**
   * Start the process using proc.spawnAndCapture. Called internally by `ProcessManager.spawn()`.
   */
  _start(spawnOptions: SpawnOptions = {}): void {
    const command = this.state.get('command')!
    const args = this.state.get('args')!
    const proc = this._manager.container.feature('proc') as ChildProcess

    const cwd = spawnOptions.cwd ?? this._manager.container.cwd

    // Use proc.spawnAndCapture with hooks for real-time streaming
    proc.spawnAndCapture(command, args, {
      cwd,
      onStart: (childProcess: any) => {
        this._childProcess = childProcess
        if (childProcess.pid) {
          this.state.set('pid', childProcess.pid)
        }
      },
      onOutput: (data: string) => {
        this.stdout.append(data)
        this.events.emit('stdout', data)
      },
      onError: (data: string) => {
        this.stderr.append(data)
        this.events.emit('stderr', data)
      },
      onExit: (code: number) => {
        this.stdout.flush()
        this.stderr.flush()
        this._onExit(code)
      },
    }).catch((err: any) => {
      // spawnAndCapture rejected — treat as crash
      this.stdout.flush()
      this.stderr.flush()
      if (!this.isDone) {
        this._onExit(err?.code ?? 1)
      }
    })
  }

  /**
   * Kill the process.
   *
   * @param signal - Signal to send (default: SIGTERM)
   */
  kill(signal: NodeJS.Signals | number = 'SIGTERM'): void {
    if (this.isDone) return

    try {
      const pid = this.state.get('pid')
      if (pid) {
        process.kill(pid, signal)
      }
    } catch (err: any) {
      if (err.code !== 'ESRCH') throw err
    }

    this.stdout.flush()
    this.stderr.flush()
    this.state.set('status', 'killed')
    this.state.set('endedAt', Date.now())
    this.events.emit('killed')
    this._manager._onHandlerDone(this, 'killed')

    if (this._exitResolve) {
      this._exitResolve(-1)
      this._exitResolve = null
    }
  }

  /**
   * Returns a promise that resolves with the exit code when the process finishes.
   */
  async await(): Promise<number> {
    if (this.isDone) {
      return this.state.get('exitCode') ?? -1
    }
    return this._exitPromise!
  }

  /**
   * Write data to the process's stdin (requires `stdin: 'pipe'` in spawn options).
   *
   * @param data - String or Uint8Array to write
   */
  write(data: string | Uint8Array): void {
    const stdin = this._childProcess?.stdin
    if (!stdin) {
      throw new Error('stdin is not piped — pass { stdin: "pipe" } in spawn options')
    }
    stdin.write(data)
  }

  /**
   * Peek at the buffered output. Returns head (first 20 lines), tail (last 50 lines),
   * and metadata about how much was dropped.
   */
  peek(stream: 'stdout' | 'stderr' = 'stdout'): { head: string[]; tail: string[]; totalLines: number; droppedLines: number } {
    const buf = stream === 'stderr' ? this.stderr : this.stdout
    return {
      head: buf.head,
      tail: buf.tail,
      totalLines: buf.totalLines,
      droppedLines: buf.droppedLines,
    }
  }

  /** Subscribe to handler events */
  on<E extends string & keyof SpawnHandlerEvents>(event: E, listener: (...args: SpawnHandlerEvents[E]) => void) {
    this.events.on(event, listener)
    return this
  }

  /** Subscribe to a handler event once */
  once<E extends string & keyof SpawnHandlerEvents>(event: E, listener: (...args: SpawnHandlerEvents[E]) => void) {
    this.events.once(event, listener)
    return this
  }

  /** Unsubscribe from a handler event */
  off<E extends string & keyof SpawnHandlerEvents>(event: E, listener: (...args: SpawnHandlerEvents[E]) => void) {
    this.events.off(event, listener)
    return this
  }

  // ─── Internal ─────────────────────────────────────────────────────────────

  private _onExit(code: number): void {
    if (this.isDone) return

    const isCrash = code !== 0
    this.state.set('exitCode', code)
    this.state.set('endedAt', Date.now())

    if (isCrash) {
      this.state.set('status', 'crashed')
      this.events.emit('crash', code)
      this._manager._onHandlerDone(this, 'crashed', code)
    } else {
      this.state.set('status', 'exited')
      this.events.emit('exit', code)
      this._manager._onHandlerDone(this, 'exited', code)
    }

    if (this._exitResolve) {
      this._exitResolve(code)
      this._exitResolve = null
    }
  }
}

// ─── ProcessManager Feature ─────────────────────────────────────────────────

/**
 * Manages long-running child processes with tracking, events, and automatic cleanup.
 *
 * Unlike the `proc` feature whose spawn methods block until the child exits,
 * ProcessManager returns a SpawnHandler immediately — a handle object with its own
 * state, events, and lifecycle methods. The feature tracks all spawned processes,
 * maintains observable state, and can automatically kill them on parent exit.
 *
 * Each handler maintains a memory-efficient output buffer: the first 20 lines (head)
 * and last 50 lines (tail) of stdout/stderr are kept, everything in between is discarded.
 *
 * @example
 * ```typescript
 * const pm = container.feature('processManager', { enable: true })
 *
 * const server = pm.spawn('node', ['server.js'], { tag: 'api', cwd: '/app' })
 * server.on('stdout', (data) => console.log('[api]', data))
 * server.on('crash', (code) => console.error('API crashed:', code))
 *
 * // Peek at buffered output
 * const { head, tail } = server.peek()
 *
 * // Kill one
 * server.kill()
 *
 * // Kill all tracked processes
 * pm.killAll()
 *
 * // List and lookup
 * pm.list()              // SpawnHandler[]
 * pm.getByTag('api')     // SpawnHandler | undefined
 * ```
 *
 * @extends Feature
 */
export class ProcessManager extends Feature {
  static override shortcut = 'features.processManager' as const
  static override stateSchema = ProcessManagerStateSchema
  static override optionsSchema = ProcessManagerOptionsSchema
  static override eventsSchema = ProcessManagerEventsSchema
  static { Feature.register(this, 'processManager') }

  /** Tools that an assistant can use to spawn and manage processes. */
  static tools: Record<string, { schema: z.ZodType; handler?: Function }> = {
    spawnProcess: {
      schema: z.object({
        command: z.string().describe('The command to execute (e.g. "node", "bun", "python")'),
        args: z.string().optional().describe('Space-separated arguments to pass to the command'),
        tag: z.string().optional().describe('A label for this process so you can find it later'),
        cwd: z.string().optional().describe('Working directory for the process'),
      }).describe(
        'Spawn a long-running process (server, watcher, daemon) that runs in the background. Returns immediately with a process ID you can use to check status or kill it later.'
      ),
    },
    runCommand: {
      schema: z.object({
        command: z.string().describe('The command to execute (e.g. "npm install", "bun test")'),
        cwd: z.string().optional().describe('Working directory for the command'),
      }).describe(
        'Run a command and wait for it to complete. Returns the full stdout/stderr output and exit code. Use this for commands you expect to finish (builds, installs, tests).'
      ),
    },
    listProcesses: {
      schema: z.object({}).describe(
        'List all tracked processes with their status, PID, command, uptime, and a preview of recent output.'
      ),
    },
    getProcessOutput: {
      schema: z.object({
        id: z.string().optional().describe('The process ID to get output for'),
        tag: z.string().optional().describe('The tag of the process to get output for'),
        stream: z.string().optional().describe('Which stream to read: "stdout" (default) or "stderr"'),
      }).describe(
        'Peek at a process\'s buffered output — shows the first 20 lines and last 50 lines of stdout or stderr.'
      ),
    },
    killProcess: {
      schema: z.object({
        id: z.string().optional().describe('The process ID to kill'),
        tag: z.string().optional().describe('The tag of the process to kill'),
        signal: z.string().optional().describe('Signal to send: "SIGTERM" (default, graceful) or "SIGKILL" (force)'),
      }).describe(
        'Kill a running process by ID or tag.'
      ),
    },
  }

  private _handlers = new Map<string, SpawnHandler>()
  private _cleanupRegistered = false
  private _cleanupHandlers: Array<() => void> = []

  // ─── Tool Handlers ──────────────────────────────────────────────────────

  /**
   * Tool handler: spawn a long-running background process.
   */
  async spawnProcess(args: { command: string; args?: string; tag?: string; cwd?: string }) {
    const cmdArgs = args.args ? args.args.split(/\s+/) : []
    const handler = this.spawn(args.command, cmdArgs, {
      tag: args.tag,
      cwd: args.cwd,
    })

    return {
      id: handler.id,
      pid: handler.pid,
      tag: handler.tag,
      command: `${args.command} ${args.args ?? ''}`.trim(),
      status: 'running',
    }
  }

  /**
   * Tool handler: run a command to completion and return its output.
   */
  async runCommand(args: { command: string; cwd?: string }) {
    const proc = this.container.feature('proc') as ChildProcess
    const result = await proc.spawnAndCapture('sh', ['-c', args.command], {
      cwd: args.cwd ?? this.container.cwd,
    })

    return {
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      success: result.exitCode === 0,
    }
  }

  /**
   * Tool handler: list all tracked processes.
   */
  async listProcesses() {
    const handlers = this.list()
    if (handlers.length === 0) return { processes: [], message: 'No tracked processes.' }

    return {
      processes: handlers.map(h => {
        const now = Date.now()
        const startedAt = h.state.get('startedAt')!
        const endedAt = h.state.get('endedAt')
        const duration = (endedAt ?? now) - startedAt
        const lastStdout = h.stdout.tail.length ? h.stdout.tail.slice(-3) : h.stdout.head.slice(-3)

        return {
          id: h.id,
          tag: h.tag,
          pid: h.pid,
          command: `${h.state.get('command')} ${(h.state.get('args') ?? []).join(' ')}`.trim(),
          status: h.status,
          exitCode: h.exitCode,
          uptimeMs: duration,
          uptime: formatDuration(duration),
          outputLines: h.stdout.totalLines,
          errorLines: h.stderr.totalLines,
          recentOutput: lastStdout,
        }
      }),
    }
  }

  /**
   * Tool handler: peek at a process's buffered output.
   */
  async getProcessOutput(args: { id?: string; tag?: string; stream?: string }) {
    const handler = args.id ? this.get(args.id) : args.tag ? this.getByTag(args.tag) : undefined
    if (!handler) return { error: `Process not found. Provide a valid id or tag.` }

    const streamName = (args.stream === 'stderr' ? 'stderr' : 'stdout') as 'stdout' | 'stderr'
    const peek = handler.peek(streamName)

    return {
      id: handler.id,
      tag: handler.tag,
      status: handler.status,
      stream: streamName,
      totalLines: peek.totalLines,
      droppedLines: peek.droppedLines,
      head: peek.head,
      tail: peek.tail,
    }
  }

  /**
   * Tool handler: kill a process by ID or tag.
   */
  async killProcess(args: { id?: string; tag?: string; signal?: string }) {
    const handler = args.id ? this.get(args.id) : args.tag ? this.getByTag(args.tag) : undefined
    if (!handler) return { error: `Process not found. Provide a valid id or tag.` }

    if (handler.isDone) {
      return { id: handler.id, status: handler.status, message: 'Process already finished.' }
    }

    const signal = (args.signal ?? 'SIGTERM') as NodeJS.Signals
    handler.kill(signal)

    return { id: handler.id, status: handler.status, signal, message: 'Process killed.' }
  }

  // ─── Core API ───────────────────────────────────────────────────────────

  /**
   * Spawn a long-running process and return a handle immediately.
   *
   * The returned SpawnHandler provides events for stdout/stderr streaming,
   * exit/crash notifications, and methods to kill or await the process.
   *
   * @param command - The command to execute (e.g. 'node', 'bun', 'python')
   * @param args - Arguments to pass to the command
   * @param options - Spawn configuration
   * @param options.tag - User-defined tag for later lookups via getByTag()
   * @param options.cwd - Working directory (defaults to container cwd)
   * @param options.env - Additional environment variables
   * @param options.stdin - stdin mode: 'pipe', 'inherit', 'ignore' (default: 'ignore')
   * @param options.stdout - stdout mode: 'pipe', 'inherit', 'ignore' (default: 'pipe')
   * @param options.stderr - stderr mode: 'pipe', 'inherit', 'ignore' (default: 'pipe')
   * @returns SpawnHandler — a non-blocking handle to the process
   */
  spawn(command: string, args: string[] = [], options: SpawnOptions = {}): SpawnHandler {
    const id = crypto.randomUUID()
    const handler = new SpawnHandler(id, command, args, this, options)

    this._handlers.set(id, handler)

    // Register cleanup on first spawn
    if (!this._cleanupRegistered && (this.options as ProcessManagerOptions).autoCleanup !== false) {
      this._registerCleanup()
    }

    handler._start(options)

    // Update feature-level state
    const totalSpawned = ((this.state.get('totalSpawned' as any) as number) ?? 0) + 1
    this.state.set('totalSpawned' as any, totalSpawned)

    const processes = { ...(this.state.get('processes' as any) as Record<string, any> ?? {}) }
    processes[id] = {
      id,
      tag: options.tag,
      command,
      args,
      pid: handler.pid,
      status: 'running',
      startedAt: Date.now(),
    }
    this.state.set('processes' as any, processes)

    this.emit('spawned', id, processes[id])

    return handler
  }

  /**
   * Get a SpawnHandler by its unique ID.
   *
   * @param id - The process ID returned by spawn
   * @returns The SpawnHandler, or undefined if not found
   */
  get(id: string): SpawnHandler | undefined {
    return this._handlers.get(id)
  }

  /**
   * Find a SpawnHandler by its user-defined tag.
   *
   * @param tag - The tag passed to spawn()
   * @returns The first matching SpawnHandler, or undefined
   */
  getByTag(tag: string): SpawnHandler | undefined {
    for (const handler of this._handlers.values()) {
      if (handler.tag === tag) return handler
    }
    return undefined
  }

  /**
   * List all tracked SpawnHandlers (running and finished).
   *
   * @returns Array of all SpawnHandlers
   */
  list(): SpawnHandler[] {
    return Array.from(this._handlers.values())
  }

  /**
   * Kill all running processes.
   *
   * @param signal - Signal to send (default: SIGTERM)
   */
  killAll(signal?: NodeJS.Signals | number): void {
    for (const handler of this._handlers.values()) {
      if (handler.isRunning) {
        handler.kill(signal)
      }
    }
  }

  /**
   * Stop the process manager: kill all running processes and remove cleanup handlers.
   */
  async stop(): Promise<void> {
    this.killAll()
    this._removeCleanup()
  }

  /**
   * Remove a finished handler from tracking.
   *
   * @param id - The process ID to remove
   * @returns True if the handler was found and removed
   */
  remove(id: string): boolean {
    const handler = this._handlers.get(id)
    if (!handler) return false
    if (handler.isRunning) {
      throw new Error(`Cannot remove running process ${id} — kill it first`)
    }

    this._handlers.delete(id)

    const processes = { ...(this.state.get('processes') as any ?? {}) }
    delete processes[id]
    this.state.set('processes' as any, processes)

    return true
  }

  override async enable(options: any = {}): Promise<this> {
    await super.enable(options)
    return this
  }

  // ─── Internal ─────────────────────────────────────────────────────────────

  /** Called by SpawnHandler when a process finishes. Updates feature-level state. */
  _onHandlerDone(handler: SpawnHandler, status: 'exited' | 'crashed' | 'killed', exitCode?: number): void {
    const id = handler.id

    // Update feature-level process record
    const processes = { ...(this.state.get('processes') as any ?? {}) }
    if (processes[id]) {
      processes[id] = {
        ...processes[id],
        status,
        exitCode: exitCode ?? (status === 'killed' ? -1 : undefined),
        endedAt: Date.now(),
      }
      this.state.set('processes' as any, processes)
    }

    // Emit feature-level events
    if (status === 'exited') {
      this.emit('exited', id, exitCode ?? 0)
    } else if (status === 'crashed') {
      this.emit('crashed', id, exitCode ?? 1, { command: handler.state.get('command'), args: handler.state.get('args') })
    } else if (status === 'killed') {
      this.emit('killed', id)
    }

    // Check if all processes are done
    const allDone = Array.from(this._handlers.values()).every(h => h.isDone)
    if (allDone && this._handlers.size > 0) {
      this.emit('allStopped')
    }
  }

  private _registerCleanup(): void {
    if (this._cleanupRegistered) return
    this._cleanupRegistered = true

    const onExit = () => { this.killAll() }
    const onSignal = (signal: NodeJS.Signals) => {
      this.killAll()
      process.removeListener(signal, onSignal as any)
      process.kill(process.pid, signal)
    }

    const onSigInt = () => onSignal('SIGINT')
    const onSigTerm = () => onSignal('SIGTERM')

    process.on('exit', onExit)
    process.on('SIGINT', onSigInt)
    process.on('SIGTERM', onSigTerm)

    this._cleanupHandlers = [
      () => process.removeListener('exit', onExit),
      () => process.removeListener('SIGINT', onSigInt),
      () => process.removeListener('SIGTERM', onSigTerm),
    ]
  }

  private _removeCleanup(): void {
    for (const remove of this._cleanupHandlers) {
      remove()
    }
    this._cleanupHandlers = []
    this._cleanupRegistered = false
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (minutes < 60) return `${minutes}m ${secs}s`
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours}h ${mins}m`
}

export default ProcessManager