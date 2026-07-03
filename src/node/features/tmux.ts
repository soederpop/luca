import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'
import { Feature } from '../feature.js'
import { execSync } from 'child_process'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

// ─── Schemas ────────────────────────────────────────────────────────────────

export const TmuxStateSchema = FeatureStateSchema.extend({
  /** Whether tmux binary was found on this system */
  available: z.boolean().describe('Whether tmux binary was found on this system'),
  /** Path to the tmux binary */
  tmuxPath: z.string().optional().describe('Path to the tmux binary'),
})
export type TmuxState = z.infer<typeof TmuxStateSchema>

export const TmuxOptionsSchema = FeatureOptionsSchema.extend({
  /** Explicit path to the tmux binary. Auto-detected if omitted. */
  tmuxPath: z.string().optional().describe('Explicit path to the tmux binary'),
  /** Default pane width for new sessions */
  defaultWidth: z.number().optional().default(220).describe('Default pane width for new sessions'),
  /** Default pane height for new sessions */
  defaultHeight: z.number().optional().default(50).describe('Default pane height for new sessions'),
})
export type TmuxOptions = z.infer<typeof TmuxOptionsSchema>

// ─── TmuxSession ─────────────────────────────────────────────────────────────

export interface CaptureOptions {
  /** Number of lines of scrollback history to include (negative = lines back from bottom) */
  lines?: number
}

export interface SessionInfo {
  name: string
  windows: number
  created: number
}

// ANSI escape code stripper
const ANSI_RE = /\x1B\[[0-9;]*[mGKHFJ]|\x1B\][^\x07]*\x07|\x1B[()][AB012]/g

function stripAnsi(str: string): string {
  return str.replace(ANSI_RE, '')
}

// ─── Shared prompt-detection logic ───────────────────────────────────────────

const DEFAULT_PROMPT_PATTERNS = [
  />\s*$/,
  /❯\s*$/,
  /\?\s*$/,
  /\$\s*$/,
  /%\s*$/,
  /#\s*$/,
  /…\s*$/,
  /\.\.\.\s*$/,
]

function checkWaitingForInput(
  raw: string,
  cmd: string | null,
  options: { patterns?: RegExp[]; commandName?: string }
): boolean {
  const { patterns = DEFAULT_PROMPT_PATTERNS, commandName } = options
  if (commandName !== undefined && cmd !== null && cmd !== commandName) return false
  const lines = raw.split('\n').map(l => l.trimEnd()).filter(l => l.length > 0)
  const lastLine = lines[lines.length - 1] ?? ''
  return patterns.some(p => p.test(lastLine))
}

// ─── TmuxPane ─────────────────────────────────────────────────────────────────

/**
 * A handle to a specific tmux pane, identified by its stable pane ID (e.g. `%3`).
 * Returned by `TmuxSession.createLayout()` and `TmuxSession.splitPane()`.
 *
 * Provides the same interaction surface as `TmuxSession` but scoped to a single pane:
 * send input, capture output, check foreground process, and kill the pane.
 *
 * @example
 * ```ts
 * const { panels } = await session.createLayout({
 *   panels: [{ name: 'claude' }, { name: 'codex' }],
 * })
 * const pane = panels.get('claude')!
 * await pane.send('fix the auth bug')
 * const output = await pane.capture({ lines: -200 })
 * ```
 */
export class TmuxPane {
  /** Stable tmux pane ID, e.g. `%3`. Unique across the tmux server. */
  readonly id: string
  /** Logical name assigned at creation time. */
  readonly name: string
  private _tmux: Tmux

  constructor(id: string, name: string, tmux: Tmux) {
    this.id = id
    this.name = name
    this._tmux = tmux
  }

  /**
   * Send text input followed by Enter.
   */
  async send(text: string): Promise<void> {
    await this._tmux.run(['send-keys', '-t', this.id, text, 'Enter'])
  }

  /**
   * Send raw key sequences without appending Enter.
   *
   * @example
   * await pane.sendKeys('C-c')    // Ctrl+C — interrupt
   * await pane.sendKeys('Escape')
   */
  async sendKeys(keys: string): Promise<void> {
    await this._tmux.run(['send-keys', '-t', this.id, keys])
  }

  /**
   * Simulate typing text character by character with a configurable delay between
   * keystrokes. Useful for interactive programs that behave differently with streamed
   * input vs. pasted text.
   *
   * Does not submit — call `sendKeys('Enter')` or pass `submit: true` when ready.
   *
   * @param options.delay - Milliseconds between keystrokes (default: 50)
   * @param options.submit - If true, sends Enter after the last character
   *
   * @example
   * await pane.type('fix the auth bug')
   * await new Promise(r => setTimeout(r, 3000))
   * await pane.type(' in src/auth.ts', { submit: true })
   */
  async type(text: string, options: { delay?: number; submit?: boolean } = {}): Promise<void> {
    const delay = options.delay ?? 50
    for (const char of text) {
      await this._tmux.run(['send-keys', '-t', this.id, char])
      await new Promise(r => setTimeout(r, delay))
    }
    if (options.submit) {
      await this._tmux.run(['send-keys', '-t', this.id, 'Enter'])
    }
  }

  /**
   * Capture the current visible content of the pane. ANSI escape codes are stripped.
   *
   * @param options.lines - Negative value includes that many lines of scrollback history.
   */
  async capture(options: CaptureOptions = {}): Promise<string> {
    const args = ['capture-pane', '-t', this.id, '-p']
    if (options.lines !== undefined) args.push('-S', String(options.lines))
    const result = await this._tmux.run(args)
    return stripAnsi(result.stdout)
  }

  /**
   * Returns the name of the foreground process currently running in this pane.
   */
  async currentCommand(): Promise<string> {
    const result = await this._tmux.run([
      'display-message', '-t', this.id, '-p', '#{pane_current_command}',
    ])
    return result.stdout.trim()
  }

  /**
   * Heuristic: returns true if the pane appears to be waiting for user input.
   * See `TmuxSession.isWaitingForInput` for full option documentation.
   */
  async isWaitingForInput(options: {
    patterns?: RegExp[]
    commandName?: string
  } = {}): Promise<boolean> {
    const [raw, cmd] = await Promise.all([
      this.capture(),
      options.commandName ? this.currentCommand() : Promise.resolve(null),
    ])
    return checkWaitingForInput(raw, cmd, options)
  }

  /**
   * Kill this pane. If it is the last pane in its window, the window closes.
   */
  async kill(): Promise<void> {
    await this._tmux.run(['kill-pane', '-t', this.id])
  }

  /**
   * Resize this pane.
   */
  async resize(width: number, height: number): Promise<void> {
    await this._tmux.run(['resize-pane', '-t', this.id, '-x', String(width), '-y', String(height)])
  }
}

/**
 * A handle to a named tmux session. Use `tmux.session()` to get or create one.
 *
 * Sessions run as background processes independent of any terminal. They are
 * accessible from anywhere — no need to be inside a tmux session yourself.
 *
 * @example
 * ```ts
 * const session = await tmux.session('hermes', { command: 'hermes' })
 * await session.send('analyze this file')
 * const output = await session.capture()
 * const ready = await session.isWaitingForInput()
 * ```
 */
export class TmuxSession {
  readonly name: string
  private _tmux: Tmux

  constructor(name: string, tmux: Tmux) {
    this.name = name
    this._tmux = tmux
  }

  /**
   * Check if this session currently exists in tmux.
   */
  async exists(): Promise<boolean> {
    return this._tmux.hasSession(this.name)
  }

  /**
   * Send text input followed by Enter. This is the primary way to interact
   * with a coding assistant waiting for a prompt.
   */
  async send(text: string): Promise<void> {
    await this._tmux.run(['send-keys', '-t', this.name, text, 'Enter'])
  }

  /**
   * Send raw key sequences without automatically appending Enter.
   * Useful for special keys like Escape, ctrl sequences, arrow keys, etc.
   *
   * @example
   * await session.sendKeys('Escape')
   * await session.sendKeys('C-c')  // Ctrl+C
   * await session.sendKeys('Up')   // Arrow up
   */
  async sendKeys(keys: string): Promise<void> {
    await this._tmux.run(['send-keys', '-t', this.name, keys])
  }

  /**
   * Capture the current visible content of the pane, optionally including
   * scrollback history. ANSI escape codes are stripped.
   *
   * @param options.lines - Number of history lines to include before the visible area.
   *   Pass a negative number (e.g. -200) to go back 200 lines. Default: visible area only.
   */
  async capture(options: CaptureOptions = {}): Promise<string> {
    const args = ['capture-pane', '-t', this.name, '-p']
    if (options.lines !== undefined) {
      args.push('-S', String(options.lines))
    }
    const result = await this._tmux.run(args)
    return stripAnsi(result.stdout)
  }

  /**
   * Returns the name of the foreground process currently running in the pane.
   * Useful for knowing if the assistant is doing work (running a subprocess)
   * vs. idling at its own prompt.
   *
   * @example
   * // "hermes" means the assistant itself is in the foreground (likely waiting)
   * // "git" means it's running a git command (processing)
   * const cmd = await session.currentCommand()
   */
  async currentCommand(): Promise<string> {
    const result = await this._tmux.run([
      'display-message', '-t', this.name, '-p', '#{pane_current_command}',
    ])
    return result.stdout.trim()
  }

  /**
   * Heuristic: returns true if the pane appears to be waiting for user input.
   *
   * The check has two parts:
   * 1. The last non-empty line matches one of the provided prompt patterns.
   * 2. Optionally, the foreground process name matches `commandName` (so you can
   *    confirm it's the assistant itself waiting, not a subprocess).
   *
   * Default prompt patterns cover common coding-assistant prompts:
   * `>`, `❯`, `?`, `$`, `%`, `#`, `…` at the end of a line (with optional trailing space).
   *
   * @example
   * const ready = await session.isWaitingForInput()
   * const ready = await session.isWaitingForInput({
   *   patterns: [/>\s*$/, /Enter your message/],
   *   commandName: 'hermes',
   * })
   */
  async isWaitingForInput(options: {
    patterns?: RegExp[]
    commandName?: string
  } = {}): Promise<boolean> {
    const [raw, cmd] = await Promise.all([
      this.capture(),
      options.commandName ? this.currentCommand() : Promise.resolve(null),
    ])
    return checkWaitingForInput(raw, cmd, options)
  }

  /**
   * Kill this session. All processes inside it are terminated.
   */
  async kill(): Promise<void> {
    await this._tmux.run(['kill-session', '-t', this.name])
  }

  /**
   * Resize the session pane.
   */
  async resize(width: number, height: number): Promise<void> {
    await this._tmux.run(['resize-window', '-t', this.name, '-x', String(width), '-y', String(height)])
  }

  /**
   * Split a pane and return a `TmuxPane` handle to the new pane.
   *
   * @param options.target - Pane ID to split. Defaults to `$TMUX_PANE` (current pane).
   * @param options.direction - `'horizontal'` splits left/right; `'vertical'` splits top/bottom (default).
   * @param options.size - Size of the new pane in rows (vertical) or columns (horizontal).
   * @param options.before - Place the new pane above/left instead of below/right.
   * @param options.command - Command to run in the new pane (defaults to `$SHELL`).
   * @param options.name - Logical name for the returned `TmuxPane`.
   *
   * @example
   * ```ts
   * const rightPane = await session.splitPane({ direction: 'horizontal', name: 'editor' })
   * await rightPane.send('vim .')
   * ```
   */
  async splitPane(options: {
    target?: string
    direction?: 'horizontal' | 'vertical'
    size?: number
    before?: boolean
    command?: string
    name?: string
  } = {}): Promise<TmuxPane> {
    const target = options.target ?? process.env.TMUX_PANE
    if (!target) {
      throw new Error('splitPane requires a target pane or must be called from within a tmux session (TMUX_PANE not set)')
    }

    const args: string[] = ['split-window', '-t', target, '-P', '-F', '#{pane_id}']
    if (options.direction === 'horizontal') args.push('-h')
    else args.push('-v')
    if (options.before) args.push('-b')
    if (options.size !== undefined) args.push('-l', String(options.size))
    if (options.command) args.push(options.command)

    const result = await this._tmux.run(args)
    const id = result.stdout.trim()
    return new TmuxPane(id, options.name ?? id, this._tmux)
  }

  /**
   * Create a layout with named column panels above a narrow control strip at the bottom.
   *
   * Must be called from within a tmux session (`$TMUX_PANE` must be set — i.e. the
   * calling script is running inside a tmux pane). The current pane becomes the leftmost
   * column; additional panels are split to the right. The control strip is split below
   * all columns and receives focus when the layout is complete.
   *
   * Panel commands are sent via `send-keys` so the pane shell survives if the command exits.
   *
   * @param options.panels - Column panels. Each needs a `name`; `command` is optional (defaults to `$SHELL`).
   * @param options.controlHeight - Height of the control strip in rows (default: 3).
   *
   * @returns `control` — `TmuxPane` for the bottom strip; `panels` — named map of column panes.
   *
   * @example
   * ```ts
   * const { control, panels } = await session.createLayout({
   *   panels: [
   *     { name: 'claude', command: 'claude' },
   *     { name: 'codex',  command: 'codex'  },
   *   ],
   *   controlHeight: 3,
   * })
   * await panels.get('claude')!.send('fix the auth bug in src/auth.ts')
   * ```
   */
  async createLayout(options: {
    panels: Array<{ name: string; command?: string; cwd?: string }>
    controlHeight?: number
  }): Promise<{ control: TmuxPane; panels: Map<string, TmuxPane> }> {
    const currentPaneId = process.env.TMUX_PANE
    if (!currentPaneId) {
      throw new Error('createLayout must be called from within a tmux session (TMUX_PANE not set)')
    }
    if (options.panels.length === 0) {
      throw new Error('createLayout requires at least one panel')
    }

    const controlHeight = options.controlHeight ?? 3

    // Split the control strip below the current pane (which becomes the top area)
    const controlResult = await this._tmux.run([
      'split-window', '-t', currentPaneId, '-v', '-l', String(controlHeight), '-P', '-F', '#{pane_id}',
    ])
    const controlId = controlResult.stdout.trim()
    const control = new TmuxPane(controlId, 'control', this._tmux)

    // Current pane is the first (leftmost) column panel
    const [firstPanel, ...restPanels] = options.panels as [{ name: string; command?: string; cwd?: string }, ...{ name: string; command?: string; cwd?: string }[]]
    const panelMap = new Map<string, TmuxPane>()
    panelMap.set(firstPanel.name, new TmuxPane(currentPaneId, firstPanel.name, this._tmux))
    // First panel cwd via cd since we can't set it on an existing pane
    if (firstPanel.cwd) {
      await this._tmux.run(['send-keys', '-t', currentPaneId, `cd ${JSON.stringify(firstPanel.cwd)}`, 'Enter'])
    }
    if (firstPanel.command) {
      await this._tmux.run(['send-keys', '-t', currentPaneId, firstPanel.command, 'Enter'])
    }

    // Additional columns — always split rightward from the last pane for left-to-right ordering
    let lastPaneId = currentPaneId
    for (const panelDef of restPanels) {
      const splitArgs = ['split-window', '-t', lastPaneId, '-h', '-P', '-F', '#{pane_id}']
      if (panelDef.cwd) splitArgs.push('-c', panelDef.cwd)
      const splitResult = await this._tmux.run(splitArgs)
      lastPaneId = splitResult.stdout.trim()
      panelMap.set(panelDef.name, new TmuxPane(lastPaneId, panelDef.name, this._tmux))
      if (panelDef.command) {
        await this._tmux.run(['send-keys', '-t', lastPaneId, panelDef.command, 'Enter'])
      }
    }

    // Focus lands on the control strip
    await this._tmux.run(['select-pane', '-t', controlId])

    return { control, panels: panelMap }
  }
}

// ─── Tmux Feature ────────────────────────────────────────────────────────────

/**
 * Tmux session manager for controlling coding assistants and long-running CLI tools.
 *
 * Creates and manages named tmux sessions that run as background processes,
 * fully independent of whether you're inside a tmux session yourself. Each
 * session can host a coding assistant (hermes, codex, claude, etc.) and you
 * can programmatically send input and inspect their state.
 *
 * Requires `tmux` to be installed (`brew install tmux` on macOS).
 *
 * @example
 * ```ts
 * const tmux = container.feature('tmux')
 *
 * // Start hermes in a background session
 * const hermes = await tmux.session('hermes', { command: 'hermes' })
 *
 * // Send it a task
 * await hermes.send('fix the authentication bug in src/auth.ts')
 *
 * // Poll until it's done
 * while (!(await hermes.isWaitingForInput({ commandName: 'hermes' }))) {
 *   await new Promise(r => setTimeout(r, 2000))
 * }
 *
 * // Read the output
 * const output = await hermes.capture({ lines: -200 })
 * console.log(output)
 * ```
 *
 * @extends Feature
 */
export class Tmux extends Feature<TmuxState, TmuxOptions> {
  static override shortcut = 'features.tmux' as const
  static override stability = 'stable' as const
  static override stateSchema = TmuxStateSchema
  static override optionsSchema = TmuxOptionsSchema
  static { Feature.register(this, 'tmux') }

  override get initialState(): TmuxState {
    return {
      ...super.initialState,
      available: false,
      tmuxPath: undefined,
    }
  }

  override async afterInitialize() {
    const path = this._resolveTmuxPath()
    this.setState({ available: !!path, tmuxPath: path ?? undefined })
  }

  private _resolveTmuxPath(): string | null {
    const explicit = this.options.tmuxPath
    if (explicit) return this._testBinary(explicit) ? explicit : null

    // Try common install locations directly (most reliable on macOS)
    const candidates = [
      '/opt/homebrew/bin/tmux',
      '/usr/local/bin/tmux',
      '/usr/bin/tmux',
    ]
    for (const p of candidates) {
      if (this._testBinary(p)) return p
    }

    // Fallback: try resolving via `which` in a login shell so Homebrew PATH is included
    try {
      const result = execSync('which tmux', {
        stdio: ['ignore', 'pipe', 'ignore'],
        shell: '/bin/zsh',
        env: { ...process.env, PATH: `/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:${process.env.PATH ?? ''}` },
      })
        .toString()
        .trim()
      if (result && this._testBinary(result)) return result
    } catch {
      // not found
    }

    return null
  }

  private _testBinary(p: string): boolean {
    try {
      execSync(`"${p}" -V`, { stdio: 'ignore' })
      return true
    } catch {
      return false
    }
  }

  /** Path to the resolved tmux binary, or null if not installed */
  get tmuxPath(): string | null {
    return this.state.get('tmuxPath') ?? null
  }

  /** Whether tmux is available on this system */
  get available(): boolean {
    return this.state.get('available') ?? false
  }

  private _assertAvailable() {
    if (!this.tmuxPath) {
      throw new Error(
        'tmux is not installed or not found in PATH. Install it with: brew install tmux'
      )
    }
  }

  /**
   * Execute a raw tmux command. Returns stdout/stderr strings.
   * This is the low-level escape hatch for any tmux operation not covered by the API.
   *
   * @example
   * ```typescript
   * await tmux.run(['new-session', '-d', '-s', 'myapp', 'bash'])
   *
   * // Read the stdout of any tmux query, e.g. pane dimensions
   * const info = await tmux.run(['display-message', '-t', 'myapp', '-p', '#{pane_width}x#{pane_height}'])
   * console.log('pane dimensions:', info.stdout.trim())
   * ```
   */
  async run(args: string[]): Promise<{ stdout: string; stderr: string }> {
    this._assertAvailable()
    try {
      const result = await execFileAsync(this.tmuxPath!, args)
      return { stdout: result.stdout ?? '', stderr: result.stderr ?? '' }
    } catch (err: any) {
      // execFileAsync throws on non-zero exit — extract stdout/stderr from the error
      return {
        stdout: err.stdout ?? '',
        stderr: err.stderr ?? '',
      }
    }
  }

  /**
   * Check whether a named session exists.
   */
  async hasSession(name: string): Promise<boolean> {
    this._assertAvailable()
    try {
      execSync(`${this.tmuxPath} has-session -t ${JSON.stringify(name)} 2>/dev/null`, { stdio: 'ignore' })
      return true
    } catch {
      return false
    }
  }

  /**
   * Create a new detached named session. If a session with that name already
   * exists this is a no-op (returns a handle to the existing session).
   *
   * @param name - Session name (used to target it in all subsequent commands)
   * @param options.command - Shell command to run in the session (e.g. `'hermes'`)
   * @param options.width - Pane width in columns (default: feature option or 220)
   * @param options.height - Pane height in rows (default: feature option or 50)
   * @param options.cwd - Working directory for the session
   */
  async createSession(
    name: string,
    options: {
      command?: string
      width?: number
      height?: number
      cwd?: string
    } = {}
  ): Promise<TmuxSession> {
    if (await this.hasSession(name)) {
      return new TmuxSession(name, this)
    }

    const width = options.width ?? this.options.defaultWidth ?? 220
    const height = options.height ?? this.options.defaultHeight ?? 50

    const args = ['new-session', '-d', '-s', name, '-x', String(width), '-y', String(height)]
    if (options.cwd) args.push('-c', options.cwd)
    if (options.command) args.push(options.command)

    await this.run(args)
    return new TmuxSession(name, this)
  }

  /**
   * Get or create a named session. If the session already exists, returns a
   * handle to it without restarting. If it doesn't exist, creates it (running
   * `options.command` if provided).
   *
   * This is the primary entry point for managing coding-assistant sessions.
   *
   * @example
   * const hermes = await tmux.session('hermes', { command: 'hermes' })
   * const codex = await tmux.session('codex', { command: 'codex' })
   */
  async session(
    name: string,
    options: {
      command?: string
      width?: number
      height?: number
      cwd?: string
    } = {}
  ): Promise<TmuxSession> {
    return this.createSession(name, options)
  }

  /**
   * List all active tmux sessions.
   *
   * @returns Array of session info objects with name, window count, and creation timestamp.
   *
   * @example
   * ```typescript
   * const sessions = await tmux.listSessions()
   * sessions.forEach(s => console.log(s.name, '— windows:', s.windows))
   * ```
   */
  async listSessions(): Promise<SessionInfo[]> {
    const result = await this.run([
      'list-sessions',
      '-F',
      '#{session_name}\t#{session_windows}\t#{session_created}',
    ])

    if (!result.stdout.trim()) return []

    return result.stdout
      .trim()
      .split('\n')
      .filter(Boolean)
      .map(line => {
        const [name, windows, created] = line.split('\t')
        return {
          name: name ?? '',
          windows: parseInt(windows ?? '1', 10),
          created: parseInt(created ?? '0', 10),
        }
      })
  }

  /**
   * Kill a named session by name.
   */
  async killSession(name: string): Promise<void> {
    await this.run(['kill-session', '-t', name])
  }
}

export default Tmux
