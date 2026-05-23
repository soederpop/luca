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
    const {
      patterns = [
        />\s*$/,
        /❯\s*$/,
        /\?\s*$/,
        /\$\s*$/,
        /%\s*$/,
        /#\s*$/,
        /…\s*$/,
        /\.\.\.\s*$/,
      ],
      commandName,
    } = options

    const [raw, cmd] = await Promise.all([
      this.capture(),
      commandName ? this.currentCommand() : Promise.resolve(null),
    ])

    // If commandName is given, the foreground process must match
    if (commandName !== undefined && cmd !== null && cmd !== commandName) {
      return false
    }

    // Find the last non-empty line
    const lines = raw.split('\n').map(l => l.trimEnd()).filter(l => l.length > 0)
    const lastLine = lines[lines.length - 1] ?? ''

    return patterns.some(p => p.test(lastLine))
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
   * await tmux.run(['new-session', '-d', '-s', 'myapp', 'bash'])
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
