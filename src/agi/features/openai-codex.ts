// @ts-nocheck
import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from '../../schemas/base.js'
import { type AvailableFeatures } from 'luca/feature'
import { Feature } from '../feature.js'

declare module 'luca/feature' {
  interface AvailableFeatures {
    openaiCodex: typeof OpenAICodex
  }
}

// --- Stream JSON types from the Codex CLI (codex exec --json) ---

export interface CodexItem {
  id: string
  type: 'agent_message' | 'reasoning' | 'command_execution' | string
  text?: string
  command?: string
  aggregated_output?: string
  exit_code?: number | null
  status?: 'in_progress' | 'completed' | string
}

export interface CodexItemEvent {
  type: 'item.completed' | 'item.started'
  item: CodexItem
}

export interface CodexTurnEvent {
  type: 'turn.completed' | 'turn.started'
  usage?: { input_tokens?: number; cached_input_tokens?: number; output_tokens?: number }
}

export interface CodexThreadEvent {
  type: 'thread.started'
  thread_id: string
}

/** Normalized message emitted via session:message for downstream consumers. */
export interface CodexMessageEvent {
  type: 'message'
  role: 'assistant' | 'system'
  content: Array<{ type: 'text'; text: string } | { type: string; [key: string]: any }>
}

export interface CodexExecEvent {
  type: 'exec'
  command: string
  cwd?: string
  exit_code?: number | null
  stdout?: string
  stderr?: string
}

export type CodexEvent =
  | CodexItemEvent
  | CodexTurnEvent
  | CodexThreadEvent
  | { type: string; [key: string]: any }

// --- Session types ---

export interface CodexSession {
  id: string
  status: 'idle' | 'running' | 'completed' | 'error'
  prompt: string
  result?: string
  error?: string
  turns: number
  messages: CodexMessageEvent[]
  executions: CodexExecEvent[]
  items: CodexItem[]
  process?: any
  threadId?: string
  usage?: { input_tokens?: number; output_tokens?: number }
}

/**
 * Metadata for a persisted Codex session on disk, mined from the rollout JSONL
 * files under ~/.codex/sessions/YYYY/MM/DD/ and the session_index.jsonl index.
 */
export interface CodexHistorySession {
  /** The Codex CLI session/thread ID (uuid). */
  sessionId: string
  /** Absolute path to the rollout JSONL transcript file. */
  filePath: string
  /** Working directory the session ran in. */
  cwd?: string
  /** ISO timestamp the session started at. */
  startedAt?: string
  /** Human-readable thread name from session_index.jsonl, when present. */
  threadName?: string
  /** Last-updated timestamp from session_index.jsonl, when present. */
  updatedAt?: string
  /** What launched the session (e.g. 'codex_exec', 'codex_cli'). */
  originator?: string
  /** Session source (e.g. 'exec', 'cli'). */
  source?: string
  /** Codex CLI version that wrote the transcript. */
  cliVersion?: string
}

/** A single user prompt entry from ~/.codex/history.jsonl. */
export interface CodexPromptHistoryEntry {
  sessionId: string
  /** Unix timestamp (seconds). */
  ts: number
  text: string
}

// --- Feature state and options ---

export const OpenAICodexStateSchema = FeatureStateSchema.extend({
  sessions: z.record(z.string(), z.any()).describe('Map of session IDs to CodexSession objects'),
  activeSessions: z.array(z.string()).describe('List of currently running session IDs'),
  codexAvailable: z.boolean().describe('Whether the codex CLI binary is available'),
  codexVersion: z.string().optional().describe('Detected codex CLI version string'),
})

export const OpenAICodexOptionsSchema = FeatureOptionsSchema.extend({
  codexPath: z.string().optional().describe('Path to the codex CLI binary'),
  model: z.string().optional().describe('Default model to use for sessions'),
  cwd: z.string().optional().describe('Default working directory for sessions'),
  sandbox: z.enum(['read-only', 'workspace-write', 'danger-full-access']).optional().describe('Sandbox policy for shell commands'),
  approvalMode: z.enum(['suggest', 'auto-edit', 'full-auto']).optional().describe('Approval mode for codex operations'),
  projectDoc: z.string().optional().describe('Path to additional project doc to include'),
  noProjectDoc: z.boolean().optional().describe('Disable automatic codex.md inclusion'),
  fullStdout: z.boolean().optional().describe('Do not truncate stdout/stderr from command outputs'),
})

export const OpenAICodexEventsSchema = FeatureEventsSchema.extend({
  'session:start': z.tuple([z.object({ sessionId: z.string(), prompt: z.string() })]).describe('Fired when a new Codex session is spawned'),
  'session:event': z.tuple([z.object({ sessionId: z.string(), event: z.any() })]).describe('Fired for every parsed JSON event from the Codex CLI stream'),
  'session:delta': z.tuple([z.object({ sessionId: z.string(), text: z.string(), role: z.string() })]).describe('Fired for each text delta from an agent message'),
  'session:message': z.tuple([z.object({ sessionId: z.string(), message: z.any() })]).describe('Fired when a complete agent message is received'),
  'session:exec': z.tuple([z.object({ sessionId: z.string(), exec: z.any() })]).describe('Fired when a command execution item completes'),
  'session:exec-start': z.tuple([z.object({ sessionId: z.string(), command: z.string() })]).describe('Fired when a command execution item starts'),
  'session:reasoning': z.tuple([z.object({ sessionId: z.string(), text: z.string() })]).describe('Fired when a reasoning item is received'),
  'session:result': z.tuple([z.object({ sessionId: z.string(), result: z.string() })]).describe('Fired when a session completes with a final result'),
  'session:error': z.tuple([z.object({ sessionId: z.string(), error: z.any(), exitCode: z.number().optional() })]).describe('Fired when a session encounters an error'),
  'session:abort': z.tuple([z.object({ sessionId: z.string() })]).describe('Fired when a session is aborted by the user'),
  'session:parse-error': z.tuple([z.object({ sessionId: z.string(), line: z.string() })]).describe('Fired when a JSON line from the CLI cannot be parsed'),
}).describe('OpenAICodex events')

export type OpenAICodexState = z.infer<typeof OpenAICodexStateSchema>
export type OpenAICodexOptions = z.infer<typeof OpenAICodexOptionsSchema>

export interface CodexRunOptions {
  /** Abort the spawned Codex process. */
  signal?: AbortSignal
  model?: string
  cwd?: string
  sandbox?: 'read-only' | 'workspace-write' | 'danger-full-access'
  approvalMode?: 'suggest' | 'auto-edit' | 'full-auto'
  projectDoc?: string
  noProjectDoc?: boolean
  fullStdout?: boolean
  images?: string[]
  fullAuto?: boolean
  /** Resume a previous session by ID. */
  resumeSessionId?: string
  /** Resume the most recent session. */
  resumeLast?: boolean
  /** Skip all approvals and sandboxing. */
  dangerouslyAutoApproveEverything?: boolean
  /**
   * Inline config overrides forwarded to codex as `-c key=value` flags. Values
   * are TOML-encoded (strings get JSON-quoted; booleans, numbers, and arrays
   * are passed through). Use this to set things like `developer_instructions`,
   * `base_instructions`, `model_reasoning_effort`, etc. without writing a
   * profile file.
   */
  config?: Record<string, unknown>
  /** Codex profile name to layer (codex -p <name>). Reads `$CODEX_HOME/<name>.config.toml`. */
  profile?: string
  /** Additional CLI flags. */
  extraArgs?: string[]
}

/**
 * OpenAI Codex CLI wrapper feature. Spawns and manages Codex sessions
 * as subprocesses, streaming structured JSON events back through the
 * container's event system.
 *
 * Mirrors the ClaudeCode feature pattern: each call to `run()` spawns a
 * `codex exec --json` process, parses NDJSON from stdout line-by-line,
 * and emits typed events on the feature's event bus.
 *
 * @extends Feature
 *
 * @example
 * ```typescript
 * const codex = container.feature('openaiCodex')
 *
 * // Listen for events
 * codex.on('session:message', ({ sessionId, message }) => console.log(message))
 * codex.on('session:patch', ({ sessionId, patch }) => console.log('File changed:', patch.path))
 *
 * // Run a prompt
 * const session = await codex.run('Fix the failing tests in src/')
 * console.log(session.result)
 * ```
 */
export class OpenAICodex extends Feature<OpenAICodexState, OpenAICodexOptions> {
  static override stateSchema = OpenAICodexStateSchema
  static override optionsSchema = OpenAICodexOptionsSchema
  static override eventsSchema = OpenAICodexEventsSchema
  static override shortcut = 'features.openaiCodex' as const
  static override stability = 'stable' as const
  static override category = 'agent-wrappers' as const

  static { Feature.register(this, 'openaiCodex') }

  override get initialState(): OpenAICodexState {
    return {
      ...super.initialState,
      sessions: {},
      activeSessions: [],
      codexAvailable: false
    }
  }

  private _resolvedCodexPath: string | null = null

  /** @returns The path to the codex CLI binary, falling back to 'codex' on the PATH. */
  get codexPath(): string {
    if (this.options.codexPath) return this.options.codexPath
    if (this._resolvedCodexPath) return this._resolvedCodexPath
    try {
      this._resolvedCodexPath = this.container.feature('proc').resolveRealPath('codex')
    } catch {
      this._resolvedCodexPath = 'codex'
    }
    return this._resolvedCodexPath
  }

  /**
   * Check if the Codex CLI is available and capture its version.
   *
   * @returns {Promise<boolean>} True if the codex binary was found and responded to --version
   */
  async checkAvailability(): Promise<boolean> {
    try {
      const proc = this.container.feature('proc')
      const result = await proc.spawnAndCapture(this.codexPath, ['--version'])
      const stdout = result.stdout
      const exitCode = result.exitCode

      if (exitCode === 0) {
        const version = stdout.trim()
        this.setState({ codexAvailable: true, codexVersion: version })
        return true
      }

      this.setState({ codexAvailable: false })
      return false
    } catch {
      this.setState({ codexAvailable: false })
      return false
    }
  }

  /**
   * Build the argument array for a codex CLI invocation.
   */
  private buildArgs(options: CodexRunOptions = {}): string[] {
    const args: string[] = ['exec', '--json']

    if (options.profile) args.push('--profile', options.profile)

    if (options.config) {
      for (const [key, value] of Object.entries(options.config)) {
        if (value === undefined || value === null) continue
        args.push('-c', `${key}=${this.encodeTomlValue(value)}`)
      }
    }

    const model = options.model ?? this.options.model
    if (model) args.push('--model', model)

    const sandbox = options.sandbox ?? this.options.sandbox
    if (sandbox) args.push('--sandbox', sandbox)

    if (options.fullAuto) {
      args.push('--full-auto')
    } else {
      const approvalMode = options.approvalMode ?? this.options.approvalMode
      if (approvalMode === 'auto-edit') args.push('--auto-edit')
      else if (approvalMode === 'full-auto') args.push('--full-auto')
    }

    const noProjectDoc = options.noProjectDoc ?? this.options.noProjectDoc
    if (noProjectDoc) args.push('--no-project-doc')

    const projectDoc = options.projectDoc ?? this.options.projectDoc
    if (projectDoc) args.push('--project-doc', projectDoc)

    const fullStdout = options.fullStdout ?? this.options.fullStdout
    if (fullStdout) args.push('--full-stdout')

    if (options.images?.length) {
      for (const img of options.images) {
        args.push('--image', img)
      }
    }

    if (options.resumeSessionId) {
      args.push('resume', options.resumeSessionId)
    } else if (options.resumeLast) {
      args.push('resume', '--last')
    }

    if (options.dangerouslyAutoApproveEverything) {
      args.push('--dangerously-auto-approve-everything')
    }

    if (options.extraArgs?.length) {
      args.push(...options.extraArgs)
    }

    // Read the prompt from stdin to avoid prompt content being parsed as flags.
    args.push('-')

    return args
  }

  private encodeTomlValue(value: unknown): string {
    if (typeof value === 'string') return JSON.stringify(value)
    if (typeof value === 'boolean' || typeof value === 'number') return String(value)
    return JSON.stringify(value)
  }

  private createSessionId(): string {
    return crypto.randomUUID()
  }

  private updateSession(id: string, update: Partial<CodexSession>): void {
    const sessions = { ...this.state.current.sessions }
    const existing = sessions[id]
    if (existing) {
      sessions[id] = { ...existing, ...update }
      this.setState({ sessions })
    }
  }

  /**
   * Process a parsed JSON event from the Codex CLI stream.
   *
   * The codex CLI (codex exec --json) emits NDJSON with these event types:
   *   thread.started   — { thread_id }
   *   turn.started     — (no payload)
   *   item.started     — { item: { id, type, ... } }
   *   item.completed   — { item: { id, type, text?, command?, exit_code?, ... } }
   *   turn.completed   — { usage: { input_tokens, output_tokens } }
   *
   * Item types within item.completed:
   *   agent_message      — assistant text response
   *   reasoning          — model thinking/reasoning
   *   command_execution  — shell command with output
   */
  private handleEvent(sessionId: string, event: CodexEvent): void {
    this.emit('session:event', { sessionId, event })

    switch (event.type) {
      case 'thread.started': {
        const threadEvent = event as CodexThreadEvent
        this.updateSession(sessionId, { threadId: threadEvent.thread_id })
        break
      }

      case 'turn.started': {
        const session = this.state.current.sessions[sessionId]
        if (session) {
          this.updateSession(sessionId, { turns: session.turns + 1 })
        }
        break
      }

      case 'item.completed': {
        const { item } = event as CodexItemEvent
        const session = this.state.current.sessions[sessionId]
        if (!session) break

        this.updateSession(sessionId, { items: [...session.items, item] })

        if (item.type === 'agent_message' && item.text) {
          // Normalize to a CodexMessageEvent for downstream consumers
          const msg: CodexMessageEvent = {
            type: 'message',
            role: 'assistant',
            content: [{ type: 'text', text: item.text }]
          }
          this.updateSession(sessionId, { messages: [...session.messages, msg] })
          this.emit('session:delta', { sessionId, text: item.text, role: 'assistant' })
          this.emit('session:message', { sessionId, message: msg })
        } else if (item.type === 'command_execution') {
          const exec: CodexExecEvent = {
            type: 'exec',
            command: item.command || '',
            exit_code: item.exit_code,
            stdout: item.aggregated_output,
          }
          this.updateSession(sessionId, { executions: [...session.executions, exec] })
          this.emit('session:exec', { sessionId, exec })
        } else if (item.type === 'reasoning' && item.text) {
          this.emit('session:reasoning', { sessionId, text: item.text })
        }
        break
      }

      case 'item.started': {
        const { item } = event as CodexItemEvent
        if (item.type === 'command_execution' && item.command) {
          this.emit('session:exec-start', { sessionId, command: item.command })
        }
        break
      }

      case 'turn.completed': {
        const turnEvent = event as CodexTurnEvent
        if (turnEvent.usage) {
          this.updateSession(sessionId, { usage: turnEvent.usage })
        }
        break
      }

      default: {
        // Forward unknown events for extensibility
        this.emit(`session:${event.type}`, { sessionId, event })
        break
      }
    }
  }

  /**
   * Run a prompt in a new Codex session. Spawns a subprocess,
   * streams NDJSON events, and resolves when the session completes.
   *
   * @param {string} prompt - The natural language instruction for the Codex agent
   * @param {CodexRunOptions} [options] - Optional overrides for model, cwd, sandbox policy, etc.
   * @returns {Promise<CodexSession>} The completed session with result, messages, patches, and executions
   *
   * @example
   * ```typescript
   * const session = await codex.run('Fix the failing tests')
   * console.log(session.result)
   *
   * const session = await codex.run('Refactor the auth module', {
   *   model: 'o4-mini',
   *   fullAuto: true,
   *   cwd: '/path/to/project'
   * })
   * ```
   */
  async run(prompt: string, options: CodexRunOptions = {}): Promise<CodexSession> {
    if (options.signal?.aborted) {
      const error = new Error('The operation was aborted')
      error.name = 'AbortError'
      throw error
    }
    const id = this.createSessionId()
    const args = this.buildArgs(options)
    const cwd = options.cwd ?? this.options.cwd ?? (this.container as any).cwd

    const session: CodexSession = {
      id,
      status: 'running',
      prompt,
      turns: 0,
      messages: [],
      executions: [],
      items: []
    }

    const sessions = { ...this.state.current.sessions, [id]: session }
    const activeSessions = [...this.state.current.activeSessions, id]
    this.setState({ sessions, activeSessions })

    this.emit('session:start', { sessionId: id, prompt })

    const proc = this.container.feature('proc').spawn(this.codexPath, args, {
      cwd,
      stdout: 'pipe',
      stderr: 'pipe',
      stdin: Buffer.from(prompt),
      environment: { ...process.env },
    })

    this.updateSession(id, { process: proc })
    const onAbort = () => proc.kill()
    options.signal?.addEventListener('abort', onAbort, { once: true })
    try {
      await this.consumeStream(id, proc)
    } finally {
      options.signal?.removeEventListener('abort', onAbort)
    }
    if (options.signal?.aborted) {
      const error = new Error('The operation was aborted')
      error.name = 'AbortError'
      throw error
    }

    return this.state.current.sessions[id]!
  }

  /**
   * Run a prompt without waiting for completion. Returns the session ID
   * immediately so you can subscribe to events.
   *
   * @param {string} prompt - The natural language instruction for the Codex agent
   * @param {CodexRunOptions} [options] - Optional overrides for model, cwd, sandbox policy, etc.
   * @returns {string} The session ID, which can be used with getSession() or waitForSession()
   *
   * @example
   * ```typescript
   * const sessionId = codex.start('Build a REST API for users')
   *
   * codex.on('session:delta', ({ sessionId: sid, text }) => {
   *   if (sid === sessionId) process.stdout.write(text)
   * })
   * ```
   */
  start(prompt: string, options: CodexRunOptions = {}): string {
    const id = this.createSessionId()
    const args = this.buildArgs(options)
    const cwd = options.cwd ?? this.options.cwd ?? (this.container as any).cwd

    const session: CodexSession = {
      id,
      status: 'running',
      prompt,
      turns: 0,
      messages: [],
      executions: [],
      items: []
    }

    const sessions = { ...this.state.current.sessions, [id]: session }
    const activeSessions = [...this.state.current.activeSessions, id]
    this.setState({ sessions, activeSessions })

    this.emit('session:start', { sessionId: id, prompt })

    const proc = this.container.feature('proc').spawn(this.codexPath, args, {
      cwd,
      stdout: 'pipe',
      stderr: 'pipe',
      stdin: Buffer.from(prompt),
      environment: { ...process.env },
    })

    this.updateSession(id, { process: proc })
    this.consumeStream(id, proc)

    return id
  }

  private async consumeStream(sessionId: string, proc: any): Promise<void> {
    if (!proc?.stdout || !proc?.stderr) {
      const error = 'Process streams are not available'
      this.updateSession(sessionId, { status: 'error', error })
      this.emit('session:error', { sessionId, error })
      return
    }

    let buffer = ''
    let lastText = ''
    let stderr = ''

    proc.stderr.on('data', (chunk: Buffer | string) => {
      stderr += Buffer.isBuffer(chunk) ? chunk.toString() : String(chunk)
    })

    const stdoutDone = new Promise<void>((resolve, reject) => {
      proc.stdout.on('data', (chunk: Buffer | string) => {
        buffer += Buffer.isBuffer(chunk) ? chunk.toString() : String(chunk)
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue

          try {
            const event = JSON.parse(trimmed) as CodexEvent
            this.handleEvent(sessionId, event)

            if (event.type === 'item.completed') {
              const { item } = event as CodexItemEvent
              if (item.type === 'agent_message' && item.text) {
                lastText = item.text
              }
            }
          } catch {
            this.emit('session:parse-error', { sessionId, line: trimmed })
          }
        }
      })

      proc.stdout.on('end', () => {
        if (buffer.trim()) {
          try {
            const event = JSON.parse(buffer.trim()) as CodexEvent
            this.handleEvent(sessionId, event)
          } catch {
            // ignore trailing partial data
          }
        }
        resolve()
      })

      proc.stdout.on('error', reject)
    })

    const exitCodePromise = new Promise<number>((resolve, reject) => {
      proc.once('error', reject)
      proc.once('close', (code: number | null) => resolve(code ?? 0))
    })

    try {
      await stdoutDone
    } catch (err) {
      this.updateSession(sessionId, {
        status: 'error',
        error: err instanceof Error ? err.message : String(err)
      })
      this.emit('session:error', { sessionId, error: err })
    }

    let exitCode = 1
    try {
      exitCode = await exitCodePromise
    } catch (err) {
      this.updateSession(sessionId, {
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      })
      this.emit('session:error', { sessionId, error: err })
    }

    if (exitCode !== 0 && this.state.current.sessions[sessionId]?.status !== 'completed') {
      this.updateSession(sessionId, {
        status: 'error',
        error: stderr || `Process exited with code ${exitCode}`
      })
      this.emit('session:error', { sessionId, error: stderr, exitCode })
    } else if (this.state.current.sessions[sessionId]?.status === 'running') {
      this.updateSession(sessionId, {
        status: 'completed',
        result: lastText || undefined
      })

      const activeSessions = this.state.current.activeSessions.filter(s => s !== sessionId)
      this.setState({ activeSessions })

      this.emit('session:result', {
        sessionId,
        result: lastText,
      })
    }
  }

  /**
   * Kill a running session's subprocess.
   *
   * @param {string} sessionId - The session ID to abort
   * @returns {void}
   */
  abort(sessionId: string): void {
    const session = this.state.current.sessions[sessionId]
    if (session?.process && session.status === 'running') {
      session.process.kill()
      this.updateSession(sessionId, { status: 'error', error: 'Aborted by user' })
      const activeSessions = this.state.current.activeSessions.filter(id => id !== sessionId)
      this.setState({ activeSessions })
      this.emit('session:abort', { sessionId })
    }
  }

  /**
   * Retrieve the current state of a session by its ID.
   *
   * @param {string} sessionId - The session ID to look up
   * @returns {CodexSession | undefined} The session object, or undefined if not found
   */
  getSession(sessionId: string): CodexSession | undefined {
    return this.state.current.sessions[sessionId]
  }

  /**
   * Wait for a running session to complete or error. Resolves immediately
   * if the session is already in a terminal state.
   *
   * @param {string} sessionId - The session ID to wait for
   * @returns {Promise<CodexSession>} The completed or errored session
   * @throws {Error} If the session ID is not found
   */
  async waitForSession(sessionId: string): Promise<CodexSession> {
    const session = this.state.current.sessions[sessionId]
    if (!session) throw new Error(`Session ${sessionId} not found`)
    if (session.status === 'completed' || session.status === 'error') return session

    return new Promise((resolve) => {
      const handler = (data: { sessionId: string }) => {
        if (data.sessionId === sessionId) {
          this.off('session:result')
          this.off('session:error')
          resolve(this.state.current.sessions[sessionId]!)
        }
      }
      this.on('session:result', handler)
      this.on('session:error', handler)
    })
  }

  // ---------------------------------------------------------------------------
  // Session history mining (~/.codex on disk)
  // ---------------------------------------------------------------------------

  /**
   * The Codex home directory. Honors the CODEX_HOME environment variable,
   * falling back to ~/.codex.
   *
   * @returns {string} Absolute path to the Codex home directory
   */
  get codexHome(): string {
    return process.env.CODEX_HOME ?? `${this.container.feature('os').homedir}/.codex`
  }

  /**
   * Read the lightweight session index at ~/.codex/session_index.jsonl, which maps
   * session IDs to human-readable thread names. Incomplete by design — Codex only
   * indexes named/interactive threads, not every rollout file.
   */
  private async readSessionIndex(): Promise<Map<string, { threadName?: string; updatedAt?: string }>> {
    const fs = this.container.feature('fs')
    const index = new Map<string, { threadName?: string; updatedAt?: string }>()
    try {
      const raw = await fs.readFileAsync(`${this.codexHome}/session_index.jsonl`, 'utf-8') as string
      for (const line of raw.split('\n')) {
        if (!line.trim()) continue
        try {
          const entry = JSON.parse(line)
          if (entry.id) index.set(entry.id, { threadName: entry.thread_name, updatedAt: entry.updated_at })
        } catch { /* skip malformed lines */ }
      }
    } catch { /* no index file */ }
    return index
  }

  /**
   * List Codex sessions persisted on disk by mining the rollout transcripts under
   * ~/.codex/sessions/. Unlike Claude Code, Codex buckets transcripts by date rather
   * than by project directory, so only the first line (the session_meta record) of
   * each file is read to recover the cwd — full transcripts are never loaded.
   *
   * Thread names are merged in from ~/.codex/session_index.jsonl when available.
   * Results are sorted newest-first.
   *
   * @param {object} [options] - Filtering options
   * @param {string} [options.cwd] - Only return sessions that ran in this working directory
   * @param {number} [options.limit] - Maximum number of sessions to return
   * @returns {Promise<CodexHistorySession[]>} Session metadata, newest first
   *
   * @example
   * ```typescript
   * const codex = container.feature('openaiCodex')
   * const sessions = await codex.listHistorySessions({ cwd: container.cwd, limit: 10 })
   * for (const s of sessions) {
   *   console.log(s.startedAt, s.threadName ?? s.sessionId, s.cwd)
   * }
   * ```
   */
  async listHistorySessions(options: { cwd?: string; limit?: number } = {}): Promise<CodexHistorySession[]> {
    const fs = this.container.feature('fs')
    const sessionsDir = `${this.codexHome}/sessions`

    let files: string[]
    try {
      const walked = await fs.walkAsync(sessionsDir, { directories: false, include: ['**/*.jsonl'] })
      files = walked.files
    } catch {
      return []
    }

    const index = await this.readSessionIndex()

    const results = await Promise.all(files.map(async (filePath: string): Promise<CodexHistorySession | null> => {
      try {
        const firstLine = await fs.readFirstLineAsync(filePath)
        const record = JSON.parse(firstLine)
        if (record.type !== 'session_meta') return null
        const meta = record.payload ?? {}
        // Newer CLI versions write session_id; older ones write id
        const sessionId = meta.session_id ?? meta.id
        if (!sessionId) return null
        const indexed = index.get(sessionId)
        return {
          sessionId,
          filePath,
          cwd: meta.cwd,
          startedAt: meta.timestamp ?? record.timestamp,
          threadName: indexed?.threadName,
          updatedAt: indexed?.updatedAt,
          originator: meta.originator,
          source: meta.source,
          cliVersion: meta.cli_version,
        }
      } catch {
        return null
      }
    }))

    let sessions = results.filter(Boolean) as CodexHistorySession[]

    if (options.cwd) {
      const target = this.container.paths.resolve(options.cwd)
      sessions = sessions.filter(s => s.cwd && this.container.paths.resolve(s.cwd) === target)
    }

    sessions.sort((a, b) => (b.startedAt ?? '').localeCompare(a.startedAt ?? ''))

    if (options.limit != null) sessions = sessions.slice(0, options.limit)

    return sessions
  }

  /**
   * Locate the rollout JSONL file for a Codex session ID. Rollout filenames end
   * with the session uuid, so this walks ~/.codex/sessions/ matching on suffix.
   */
  private async findSessionFile(sessionId: string): Promise<string | null> {
    const fs = this.container.feature('fs')
    try {
      const walked = await fs.walkAsync(`${this.codexHome}/sessions`, {
        directories: false,
        include: [`**/*${sessionId}.jsonl`],
      })
      return walked.files[0] ?? null
    } catch {
      return null
    }
  }

  /**
   * Read the full conversation history for a persisted Codex session from its
   * rollout JSONL file. Accepts either a Codex session/thread ID (from
   * listHistorySessions or a session's threadId) or this feature's local session
   * ID, which is resolved to its threadId automatically.
   *
   * Returns the raw parsed records: session_meta, response_item (messages, tool
   * calls, reasoning), event_msg, and turn_context entries. Malformed lines are
   * skipped so format drift between CLI versions degrades gracefully.
   *
   * @param {string} sessionId - Codex session/thread ID or local session ID
   * @returns {Promise<any[]>} Array of parsed JSONL records (empty if not found)
   *
   * @example
   * ```typescript
   * const [latest] = await codex.listHistorySessions({ limit: 1 })
   * const records = await codex.getConversationHistory(latest.sessionId)
   * const messages = records.filter(r => r.type === 'response_item' && r.payload?.type === 'message')
   * ```
   */
  async getConversationHistory(sessionId: string): Promise<any[]> {
    const fs = this.container.feature('fs')
    // Resolve a local session ID to its Codex thread ID
    const local = this.state.current.sessions[sessionId]
    const codexId = local?.threadId ?? sessionId

    const filePath = await this.findSessionFile(codexId)
    if (!filePath) return []

    try {
      const raw = await fs.readFileAsync(filePath, 'utf-8') as string
      const records: any[] = []
      for (const line of raw.split('\n')) {
        if (!line.trim()) continue
        try {
          records.push(JSON.parse(line))
        } catch { /* skip malformed lines */ }
      }
      return records
    } catch {
      return []
    }
  }

  /**
   * Search the user's prompt history across all Codex sessions. Reads
   * ~/.codex/history.jsonl, which logs every user prompt with its session ID
   * and timestamp — handy for "which session did I ask about X in?".
   *
   * @param {string} query - Case-insensitive substring to match against prompt text
   * @param {object} [options] - Search options
   * @param {number} [options.limit=50] - Maximum number of matches to return
   * @returns {Promise<CodexPromptHistoryEntry[]>} Matching prompts, newest first
   *
   * @example
   * ```typescript
   * const hits = await codex.searchUserPrompts('websocket')
   * for (const hit of hits) console.log(new Date(hit.ts * 1000), hit.text)
   * ```
   */
  async searchUserPrompts(query: string, options: { limit?: number } = {}): Promise<CodexPromptHistoryEntry[]> {
    const fs = this.container.feature('fs')
    const limit = options.limit ?? 50
    const needle = query.toLowerCase()

    let raw: string
    try {
      raw = await fs.readFileAsync(`${this.codexHome}/history.jsonl`, 'utf-8') as string
    } catch {
      return []
    }

    const matches: CodexPromptHistoryEntry[] = []
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue
      try {
        const entry = JSON.parse(line)
        if (typeof entry.text === 'string' && entry.text.toLowerCase().includes(needle)) {
          matches.push({ sessionId: entry.session_id, ts: entry.ts, text: entry.text })
        }
      } catch { /* skip malformed lines */ }
    }

    matches.sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0))
    return matches.slice(0, limit)
  }

  /**
   * Export a persisted Codex session's history as a readable markdown document.
   * Mirrors claudeCode.sessionHistoryToMarkdown().
   *
   * The source can be:
   * - A path to a rollout JSONL file
   * - A Codex session/thread ID (located via ~/.codex/sessions/)
   * - A local session ID from this feature's state (resolved via its threadId)
   * - Omitted, in which case the most recent session on disk is used
   *
   * @param {string} [source] - Path to a rollout JSONL file, a session ID, or omit for the most recent session
   * @returns {Promise<string>} Markdown-formatted session history
   * @throws {Error} If no session can be located for the given source
   *
   * @example
   * ```typescript
   * // Most recent session on this machine
   * const md = await codex.sessionHistoryToMarkdown()
   *
   * // A specific session
   * const [latest] = await codex.listHistorySessions({ cwd: container.cwd, limit: 1 })
   * const doc = await codex.sessionHistoryToMarkdown(latest.sessionId)
   * ```
   */
  async sessionHistoryToMarkdown(source?: string): Promise<string> {
    let filePath: string | null = null

    if (source && (source.includes('/') || source.endsWith('.jsonl'))) {
      filePath = source
    } else if (source) {
      const local = this.state.current.sessions[source]
      filePath = await this.findSessionFile(local?.threadId ?? source)
      if (!filePath) throw new Error(`No rollout file found for session ${source}`)
    } else {
      const [latest] = await this.listHistorySessions({ limit: 1 })
      if (!latest) throw new Error('No Codex sessions found on disk. Pass a rollout JSONL file path or run a session first.')
      filePath = latest.filePath
    }

    return this.rolloutToMarkdown(filePath)
  }

  /**
   * Parse a rollout JSONL file and render its records as markdown. Lenient by
   * design: unknown record and payload types are skipped, since the rollout
   * format drifts between Codex CLI versions.
   */
  private async rolloutToMarkdown(filePath: string): Promise<string> {
    const fs = this.container.feature('fs')
    const raw = await fs.readFileAsync(filePath, 'utf-8') as string

    const records: any[] = []
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue
      try {
        records.push(JSON.parse(line))
      } catch { /* skip malformed lines */ }
    }

    const lines: string[] = []
    const meta = records.find(r => r.type === 'session_meta')?.payload

    lines.push('# Codex Session History')
    lines.push(`**Source:** \`${filePath}\``)
    if (meta) {
      const sessionId = meta.session_id ?? meta.id
      if (sessionId) lines.push(`**Session ID:** \`${sessionId}\``)
      if (meta.cwd) lines.push(`**Working Directory:** \`${meta.cwd}\``)
      if (meta.cli_version) lines.push(`**CLI Version:** ${meta.cli_version}`)
      if (meta.timestamp) lines.push(`**Started:** ${meta.timestamp}`)
      if (meta.originator) lines.push(`**Originator:** ${meta.originator}`)
    }
    lines.push('')
    lines.push('## Conversation')
    lines.push('')

    const truncate = (text: string, max: number) =>
      text.length > max ? text.slice(0, max) + '\n... (truncated)' : text

    for (const record of records) {
      if (record.type !== 'response_item') continue
      const payload = record.payload
      if (!payload?.type) continue

      switch (payload.type) {
        case 'message': {
          // Developer/system messages are injected harness context, not conversation
          if (payload.role !== 'user' && payload.role !== 'assistant') break
          const texts = (payload.content ?? [])
            .filter((block: any) => typeof block?.text === 'string')
            .map((block: any) => block.text)
          if (!texts.length) break
          lines.push(payload.role === 'user' ? '### User' : '### Assistant')
          lines.push('')
          for (const text of texts) {
            lines.push(payload.role === 'user' ? truncate(text, 4000) : text)
            lines.push('')
          }
          break
        }

        case 'reasoning': {
          const summaries = (payload.summary ?? [])
            .filter((block: any) => typeof block?.text === 'string')
            .map((block: any) => block.text)
          for (const text of summaries) {
            lines.push(`*${text}*`)
            lines.push('')
          }
          break
        }

        case 'function_call':
        case 'custom_tool_call': {
          const input = payload.arguments ?? payload.input ?? ''
          lines.push(`**Tool Use:** \`${payload.name ?? 'unknown'}\``)
          lines.push('```')
          lines.push(truncate(typeof input === 'string' ? input : JSON.stringify(input, null, 2), 2000))
          lines.push('```')
          lines.push('')
          break
        }

        case 'function_call_output':
        case 'custom_tool_call_output': {
          const output = payload.output ?? ''
          const text = typeof output === 'string' ? output : JSON.stringify(output, null, 2)
          lines.push('<details>')
          lines.push('<summary>Tool Result</summary>')
          lines.push('')
          lines.push('```')
          lines.push(truncate(text, 2000))
          lines.push('```')
          lines.push('</details>')
          lines.push('')
          break
        }
      }
    }

    return lines.join('\n')
  }

  /**
   * Enable the feature. Delegates to the base Feature enable() lifecycle.
   *
   * @param {object} [options] - Options to merge into the feature configuration
   * @returns {Promise<this>} This instance, for chaining
   */
  override async enable(options: any = {}): Promise<this> {
    await super.enable(options)
    return this
  }
}

export default OpenAICodex
