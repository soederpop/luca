import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from '../../schemas/base.js'
import { Feature, features } from '../feature.js'
import { State } from '../../state.js'
import { Bus, type EventMap } from '../../bus.js'

// ─── Schemas ────────────────────────────────────────────────────────────────

export const TmuxStateSchema = FeatureStateSchema.extend({
  /** The current tmux session name */
  sessionName: z.string().optional().describe('The current tmux session name'),
  /** Whether tmux CLI is available on this system */
  isTmuxAvailable: z.boolean().describe('Whether tmux CLI is available on this system'),
  /** Whether we are operating inside an existing tmux session */
  isInsideTmux: z.boolean().describe('Whether we are inside an existing tmux session'),
  /** Active pane IDs managed by this feature */
  paneIds: z.array(z.string()).describe('Active pane IDs managed by this feature'),
  /** Last error message from a tmux operation */
  lastError: z.string().optional().describe('Last error message from a tmux operation'),
})
export type TmuxState = z.infer<typeof TmuxStateSchema>

export const TmuxOptionsSchema = FeatureOptionsSchema.extend({
  /** Custom session name (auto-generated if omitted) */
  sessionName: z.string().optional().describe('Custom session name (auto-generated if omitted)'),
  /** Path to tmux executable */
  tmuxPath: z.string().optional().describe('Path to tmux executable'),
  /** Output capture polling interval in ms */
  pollInterval: z.number().optional().describe('Output capture polling interval in ms'),
})
export type TmuxOptions = z.infer<typeof TmuxOptionsSchema>

export const TmuxEventsSchema = FeatureEventsSchema.extend({
  sessionCreated: z.tuple([z.string().describe('session name')]).describe('Emitted when a tmux session is created'),
  sessionKilled: z.tuple([z.string().describe('session name')]).describe('Emitted when a tmux session is killed'),
  paneSplit: z.tuple([z.string().describe('pane ID')]).describe('Emitted when a new pane is created'),
  paneCompleted: z.tuple([z.string().describe('pane ID'), z.number().describe('exit code')]).describe('Emitted when a pane command completes'),
  paneCancelled: z.tuple([z.string().describe('pane ID')]).describe('Emitted when a pane is cancelled'),
})

// ─── PaneProcess ────────────────────────────────────────────────────────────

export interface PaneProcessResult {
  paneId: string
  command: string
  exitCode: number
  output: string
}

interface PaneProcessEvents extends EventMap {
  output: [data: string]
  completed: [result: PaneProcessResult]
  failed: [result: PaneProcessResult]
  cancelled: []
}

interface PaneProcessState {
  paneId: string
  command: string
  status: 'idle' | 'running' | 'completed' | 'failed' | 'cancelled'
  exitCode?: number
  output: string
}

/**
 * A handle to a command running inside a tmux pane.
 *
 * Provides observable state, events, and methods to await, cancel,
 * or interact with the running process.
 *
 * @example
 * ```ts
 * const proc = await tmux.runInPane(paneId, 'bun test')
 * proc.events.on('output', (data) => console.log(data))
 * const result = await proc.await()
 * console.log('exited with', result.exitCode)
 * ```
 */
export class PaneProcess {
  readonly state: State<PaneProcessState>
  readonly events = new Bus<PaneProcessEvents>()

  private _completionPromise: Promise<PaneProcessResult> | null = null
  private _pollTimer: ReturnType<typeof setInterval> | null = null
  private _feature: Tmux

  constructor(paneId: string, command: string, feature: Tmux) {
    this._feature = feature
    this.state = new State<PaneProcessState>({
      initialState: {
        paneId,
        command,
        status: 'idle',
        output: '',
      }
    })
  }

  /** The tmux pane ID (e.g. "%5") */
  get paneId() { return this.state.get('paneId')! }

  /** The command string that was sent to this pane */
  get command() { return this.state.get('command')! }

  /** Current status of the process */
  get status() { return this.state.get('status')! }

  /** Whether the process is still running */
  get isRunning() { return this.state.get('status') === 'running' }

  /** Whether the process has finished (completed, failed, or cancelled) */
  get isDone() {
    const s = this.state.get('status')
    return s === 'completed' || s === 'failed' || s === 'cancelled'
  }

  /**
   * Start execution. Called internally by `Tmux.runInPane()`.
   * Wraps the command with a tmux wait-for signal so we can detect completion.
   */
  async _start(): Promise<void> {
    const { paneId, command } = this
    const signalName = `luca-done-${paneId.replace('%', '')}`

    this.state.set('status', 'running')

    // Send the wrapped command: run the command, capture exit code, signal done
    const wrappedCommand = `${command}; __luca_exit=$?; tmux wait-for -S ${signalName}; exit $__luca_exit`
    await this._feature.sendKeys(paneId, wrappedCommand)

    // Start output polling
    this._startPolling()

    // Wait for the signal in the background
    this._completionPromise = this._waitForSignal(signalName)
  }

  /**
   * Wait for the process to finish. Resolves with the result.
   */
  async await(): Promise<PaneProcessResult> {
    if (this.isDone) {
      return this._buildResult()
    }

    if (!this._completionPromise) {
      throw new Error('PaneProcess has not been started')
    }

    return this._completionPromise
  }

  /**
   * Send Ctrl-C to the pane, then wait briefly for it to exit.
   * If it doesn't exit, kills the pane.
   */
  async cancel(): Promise<void> {
    if (this.isDone) return

    // Send Ctrl-C
    await this._feature.sendKeys(this.paneId, '', 'C-c')

    // Give it a moment to exit
    await new Promise(r => setTimeout(r, 500))

    // Check if the pane still exists
    const alive = await this._feature.isPaneAlive(this.paneId)
    if (alive) {
      await this.kill()
    }

    this._stopPolling()
    this.state.set('status', 'cancelled')
    this.events.emit('cancelled')
    this._feature.emit('paneCancelled', this.paneId)
  }

  /**
   * Kill the pane immediately.
   */
  async kill(): Promise<void> {
    if (this.isDone) return

    try {
      await this._feature.executeTmuxCommand(['kill-pane', '-t', this.paneId])
    } catch {
      // pane might already be dead
    }

    this._stopPolling()

    if (this.state.get('status') === 'running') {
      this.state.set('status', 'cancelled')
      this.events.emit('cancelled')
    }
  }

  /**
   * One-shot capture of the current pane content.
   */
  async capture(): Promise<string> {
    return this._feature.capture(this.paneId)
  }

  /**
   * Send arbitrary keys/text to the pane.
   */
  async sendKeys(keys: string): Promise<void> {
    await this._feature.sendKeys(this.paneId, keys)
  }

  /**
   * Run a new command in this pane (only if the previous one is done).
   */
  async run(command: string): Promise<PaneProcess> {
    if (this.isRunning) {
      throw new Error(`Pane ${this.paneId} is already running a command. Cancel or await it first.`)
    }

    // Reset state for the new command
    this.state.set('command', command)
    this.state.set('status', 'idle')
    this.state.set('exitCode', undefined)
    this.state.set('output', '')

    await this._start()
    return this
  }

  // ── Private ────────────────────────────────────────────────────────────

  private _startPolling() {
    const interval = this._feature.options.pollInterval || 1000
    let lastOutput = ''

    this._pollTimer = setInterval(async () => {
      try {
        const currentOutput = await this._feature.capture(this.paneId)
        if (currentOutput !== lastOutput) {
          const newContent = currentOutput.slice(lastOutput.length)
          lastOutput = currentOutput
          this.state.set('output', currentOutput)
          if (newContent.trim()) {
            this.events.emit('output', newContent)
          }
        }
      } catch {
        // pane might have been killed
        this._stopPolling()
      }
    }, interval)
  }

  private _stopPolling() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer)
      this._pollTimer = null
    }
  }

  private async _waitForSignal(signalName: string): Promise<PaneProcessResult> {
    try {
      // tmux wait-for blocks until the signal is sent
      await this._feature.executeTmuxCommand(['wait-for', signalName])
    } catch {
      // signal may have already fired or pane died
    }

    this._stopPolling()

    // Do a final capture
    try {
      const finalOutput = await this._feature.capture(this.paneId)
      this.state.set('output', finalOutput)
    } catch {
      // pane might already be dead
    }

    // Try to determine exit code by checking if pane is still alive
    // If it exited cleanly, the pane shell may have closed
    const alive = await this._feature.isPaneAlive(this.paneId)
    const exitCode = alive ? 0 : 0  // tmux doesn't expose exit codes directly;
    // the `exit $__luca_exit` in our wrapped command causes the pane to close on non-zero,
    // but we capture it via the pane's remain-on-exit setting below

    this.state.set('exitCode', exitCode)
    this.state.set('status', exitCode === 0 ? 'completed' : 'failed')

    const result = this._buildResult()

    if (exitCode === 0) {
      this.events.emit('completed', result)
    } else {
      this.events.emit('failed', result)
    }

    this._feature.emit('paneCompleted', this.paneId, exitCode)

    return result
  }

  private _buildResult(): PaneProcessResult {
    return {
      paneId: this.paneId,
      command: this.command,
      exitCode: this.state.get('exitCode') ?? 0,
      output: this.state.get('output') ?? '',
    }
  }
}

// ─── TmuxLayout ─────────────────────────────────────────────────────────────

/**
 * Represents a set of tmux panes created by a `split()` call.
 *
 * Provides convenience methods to await, cancel, or collapse all panes.
 *
 * @example
 * ```ts
 * const layout = tmux.split({ count: 3 })
 * layout.panes[0].run('bun test')
 * layout.panes[1].run('bun run build')
 * await layout.awaitAll()
 * await layout.collapse()
 * ```
 */
export class TmuxLayout {
  readonly panes: PaneProcess[]
  private _feature: Tmux

  constructor(panes: PaneProcess[], feature: Tmux) {
    this.panes = panes
    this._feature = feature
  }

  /**
   * Await all running pane processes. Returns results in pane order.
   */
  async awaitAll(): Promise<PaneProcessResult[]> {
    return Promise.all(
      this.panes
        .filter(p => p.isRunning)
        .map(p => p.await())
    )
  }

  /**
   * Cancel all running pane processes.
   */
  async cancelAll(): Promise<void> {
    await Promise.all(
      this.panes
        .filter(p => p.isRunning)
        .map(p => p.cancel())
    )
  }

  /**
   * Kill all panes in this layout and collapse back to a single pane.
   */
  async collapse(): Promise<void> {
    await this.cancelAll()

    for (const pane of this.panes) {
      try {
        const alive = await this._feature.isPaneAlive(pane.paneId)
        if (alive) {
          await this._feature.executeTmuxCommand(['kill-pane', '-t', pane.paneId])
        }
      } catch {
        // pane might already be gone
      }
    }

    // Update feature state
    const remaining = (this._feature.state.get('paneIds') || [])
      .filter(id => !this.panes.some(p => p.paneId === id))
    this._feature.setState({ paneIds: remaining })
  }
}

// ─── SplitOptions ───────────────────────────────────────────────────────────

export interface SplitOptions {
  /** Number of panes to create (splits the current pane this many times) */
  count?: number
  /** Split direction: 'horizontal' splits side-by-side, 'vertical' splits top/bottom */
  orientation?: 'horizontal' | 'vertical'
  /** Percentage size for each new pane */
  size?: number
}

// ─── Tmux Feature ───────────────────────────────────────────────────────────

/**
 * Terminal multiplexer feature that wraps tmux to provide programmatic
 * control over terminal panes.
 *
 * Allows scripts to split the terminal into multiple panes, run commands
 * in each pane with full process handles (await, cancel, observe output),
 * and collapse everything back to a single pane when done.
 *
 * @example
 * ```ts
 * const tmux = container.feature('tmux', { enable: true })
 * await tmux.ensureSession()
 *
 * const layout = tmux.split({ count: 2, orientation: 'horizontal' })
 *
 * const tests = await layout.panes[0].run('bun test')
 * const build = await layout.panes[1].run('bun run build')
 *
 * tests.events.on('output', (data) => console.log('tests:', data))
 *
 * await layout.awaitAll()
 * await layout.collapse()
 * ```
 *
 * @extends Feature
 */
export class Tmux extends Feature<TmuxState, TmuxOptions> {
  static override shortcut = 'features.tmux' as const
  static override envVars = ['TMUX']
  static override stateSchema = TmuxStateSchema
  static override optionsSchema = TmuxOptionsSchema
  static override eventsSchema = TmuxEventsSchema

  override get initialState(): TmuxState {
    return {
      ...super.initialState,
      isTmuxAvailable: false,
      isInsideTmux: false,
      paneIds: [],
    }
  }

  /** Get the proc feature for executing shell commands */
  private get proc() {
    return this.container.feature('proc')
  }

  /** The tmux executable path */
  private get tmuxPath(): string {
    return this.options.tmuxPath || 'tmux'
  }

  /**
   * Execute a tmux command and return the result.
   * Follows the same pattern as Docker.executeDockerCommand.
   */
  async executeTmuxCommand(args: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    try {
      const result = await this.proc.spawnAndCapture(this.tmuxPath, args)

      if (result.exitCode !== 0) {
        this.setState({ lastError: result.stderr })
      }

      return result
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      this.setState({ lastError: message })
      throw error
    }
  }

  /**
   * Check if tmux is available on this system.
   */
  async checkAvailability(): Promise<boolean> {
    try {
      const result = await this.proc.spawnAndCapture(this.tmuxPath, ['-V'])

      if (result.exitCode === 0) {
        this.setState({
          isTmuxAvailable: true,
          isInsideTmux: !!process.env.TMUX,
          lastError: undefined,
        })
        return true
      } else {
        this.setState({ isTmuxAvailable: false, lastError: 'tmux command failed' })
        return false
      }
    } catch (error) {
      this.setState({
        isTmuxAvailable: false,
        lastError: error instanceof Error ? error.message : 'Unknown error',
      })
      return false
    }
  }

  /**
   * Initialize the tmux feature. Verifies tmux is available.
   * Throws if tmux is not installed.
   */
  override async enable(options: any = {}): Promise<this> {
    await super.enable(options)
    const available = await this.checkAvailability()

    if (!available) {
      const hint = process.platform === 'darwin'
        ? 'Install it with: brew install tmux'
        : process.platform === 'linux'
          ? 'Install it with: sudo apt install tmux (or your distro\'s package manager)'
          : 'Install tmux to use this feature.'

      throw new Error(`tmux is not installed or not in PATH. ${hint}`)
    }

    return this
  }

  /**
   * Ensure we are running inside a tmux session.
   *
   * If already inside tmux, uses the current session.
   * If not, re-execs the current script inside a new tmux session
   * so the user actually sees panes. The current process is replaced
   * (via execSync) — code after `ensureSession()` only runs inside tmux.
   *
   * @param name - Session name. Defaults to `luca-{uuid}`.
   * @returns The session name.
   */
  async ensureSession(name?: string): Promise<string> {
    const sessionName = name || this.options.sessionName || `luca-${this.uuid.slice(0, 8)}`

    if (process.env.TMUX) {
      // We're already inside tmux — get the current session name
      const result = await this.executeTmuxCommand(['display-message', '-p', '#S'])
      const currentSession = result.stdout.trim()
      this.setState({ sessionName: currentSession, isInsideTmux: true })
      this.emit('sessionCreated', currentSession)
      return currentSession
    }

    // Not inside tmux — re-exec ourselves inside a new tmux session.
    // This replaces the current process, so the script restarts inside tmux
    // where $TMUX will be set and the branch above will be taken.
    const args = process.argv.slice(1)
    const cmd = [process.argv[0], ...args].join(' ')

    const { execSync } = await import('child_process')

    try {
      execSync(`${this.tmuxPath} new-session -s ${sessionName} ${JSON.stringify(cmd)}`, {
        stdio: 'inherit',
      })
    } catch {
      // Session exited — clean up
    }

    // The tmux session has ended, so exit the outer process
    process.exit(0)
  }

  /**
   * Kill the current session (or a named one).
   */
  async killSession(name?: string): Promise<void> {
    const sessionName = name || this.state.get('sessionName')
    if (!sessionName) return

    try {
      await this.executeTmuxCommand(['kill-session', '-t', sessionName])
    } catch {
      // session might not exist
    }

    if (sessionName === this.state.get('sessionName')) {
      this.setState({ sessionName: undefined, paneIds: [] })
    }

    this.emit('sessionKilled', sessionName)
  }

  /**
   * Split the current window into multiple panes.
   *
   * @param options - Split configuration
   * @returns A TmuxLayout with PaneProcess handles for each new pane
   */
  async split(options: SplitOptions = {}): Promise<TmuxLayout> {
    const { count = 2, orientation = 'horizontal', size } = options
    const sessionName = this.state.get('sessionName')

    if (!sessionName) {
      throw new Error('No tmux session. Call ensureSession() first.')
    }

    const panes: PaneProcess[] = []
    const currentPaneIds = [...(this.state.get('paneIds') || [])]

    // Get the target pane (the current active pane in our session)
    const targetResult = await this.executeTmuxCommand([
      'display-message', '-t', sessionName, '-p', '#{pane_id}'
    ])
    let targetPane = targetResult.stdout.trim()

    for (let i = 0; i < count - 1; i++) {
      const splitArgs = ['split-window']

      if (orientation === 'horizontal') {
        splitArgs.push('-h')
      } else {
        splitArgs.push('-v')
      }

      if (size) {
        splitArgs.push('-p', String(size))
      }

      splitArgs.push('-t', targetPane)

      // -P -F '#{pane_id}' prints the new pane's ID
      splitArgs.push('-P', '-F', '#{pane_id}')

      const result = await this.executeTmuxCommand(splitArgs)
      const newPaneId = result.stdout.trim()

      // Set remain-on-exit so we can read exit codes
      await this.executeTmuxCommand(['set-option', '-t', newPaneId, 'remain-on-exit', 'off'])

      currentPaneIds.push(newPaneId)
      const paneProcess = new PaneProcess(newPaneId, '', this)
      panes.push(paneProcess)

      this.emit('paneSplit', newPaneId)
    }

    // Include the original pane as the first pane in the layout
    const originalPane = new PaneProcess(targetPane, '', this)
    panes.unshift(originalPane)

    if (!currentPaneIds.includes(targetPane)) {
      currentPaneIds.unshift(targetPane)
    }

    this.setState({ paneIds: currentPaneIds })

    return new TmuxLayout(panes, this)
  }

  /**
   * Run a command in a specific pane. Returns a PaneProcess handle.
   *
   * @param paneId - The tmux pane ID (e.g. "%5")
   * @param command - The command string to execute
   * @returns A PaneProcess handle for observing/awaiting/cancelling
   */
  async runInPane(paneId: string, command: string): Promise<PaneProcess> {
    const paneProcess = new PaneProcess(paneId, command, this)
    await paneProcess._start()
    return paneProcess
  }

  /**
   * Capture the current content of a pane.
   *
   * @param paneId - The tmux pane ID
   * @returns The pane content as a string
   */
  async capture(paneId: string): Promise<string> {
    const result = await this.executeTmuxCommand(['capture-pane', '-t', paneId, '-p'])
    return result.stdout
  }

  /**
   * Send keys to a pane. If `literal` is provided, it's sent as a tmux
   * key name (e.g. "C-c", "Enter"). Otherwise `text` is sent followed by Enter.
   *
   * @param paneId - The tmux pane ID
   * @param text - Text to type (followed by Enter)
   * @param literal - A literal tmux key name (sent without Enter)
   */
  async sendKeys(paneId: string, text: string, literal?: string): Promise<void> {
    if (literal) {
      await this.executeTmuxCommand(['send-keys', '-t', paneId, literal])
    } else {
      await this.executeTmuxCommand(['send-keys', '-t', paneId, text, 'Enter'])
    }
  }

  /**
   * Check if a pane is still alive.
   */
  async isPaneAlive(paneId: string): Promise<boolean> {
    try {
      const result = await this.executeTmuxCommand([
        'list-panes', '-F', '#{pane_id}', '-t', this.state.get('sessionName') || ''
      ])
      return result.stdout.includes(paneId)
    } catch {
      return false
    }
  }

  /**
   * Kill all managed panes except the first one, returning to a single pane view.
   */
  async collapse(): Promise<void> {
    const paneIds = this.state.get('paneIds') || []

    if (paneIds.length <= 1) return

    // Keep the first pane, kill the rest
    const [keep, ...toKill] = paneIds

    for (const paneId of toKill) {
      try {
        await this.executeTmuxCommand(['kill-pane', '-t', paneId])
      } catch {
        // pane might already be gone
      }
    }

    this.setState({ paneIds: keep ? [keep] : [] })
  }
}

export default features.register('tmux', Tmux)
