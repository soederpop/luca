// @ts-nocheck
import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'
import { type AvailableFeatures } from '@soederpop/luca/feature'
import { Feature } from '@soederpop/luca/feature'

declare module '@soederpop/luca/feature' {
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

export type OpenAICodexState = z.infer<typeof OpenAICodexStateSchema>
export type OpenAICodexOptions = z.infer<typeof OpenAICodexOptionsSchema>

export interface CodexRunOptions {
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
  static override shortcut = 'features.openaiCodex' as const

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
    await this.consumeStream(id, proc)

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
