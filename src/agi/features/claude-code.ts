import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'
import type { Container } from '@/container'
import { type AvailableFeatures } from '@/feature'
import { features, Feature } from '@/feature'
import type { Subprocess } from 'bun'

declare module '@/feature' {
  interface AvailableFeatures {
    claudeCode: typeof ClaudeCode
  }
}

// --- Stream JSON types from the Claude CLI ---

export interface ClaudeInitEvent {
  type: 'system'
  subtype: 'init'
  session_id: string
  cwd: string
  model: string
  tools: string[]
  mcp_servers: string[]
  permissionMode: string
  claude_code_version: string
}

export interface ClaudeAssistantMessage {
  type: 'assistant'
  message: {
    id: string
    model: string
    role: 'assistant'
    content: Array<{ type: 'text'; text: string } | { type: 'tool_use'; id: string; name: string; input: any }>
    stop_reason: string | null
    usage: {
      input_tokens: number
      output_tokens: number
      cache_read_input_tokens?: number
      cache_creation_input_tokens?: number
    }
  }
  session_id: string
  parent_tool_use_id: string | null
}

export interface ClaudeToolResult {
  type: 'tool_result'
  tool_use_id: string
  content: string
  session_id: string
}

export interface ClaudeStreamEvent {
  type: 'stream_event'
  event: {
    type: 'message_start' | 'content_block_start' | 'content_block_delta' | 'content_block_stop' | 'message_delta' | 'message_stop'
    index?: number
    delta?: { type: string; text?: string }
    content_block?: { type: string; text?: string }
    message?: any
    usage?: any
  }
  session_id: string
  parent_tool_use_id: string | null
}

export interface ClaudeResultEvent {
  type: 'result'
  subtype: 'success' | 'error'
  is_error: boolean
  result: string
  session_id: string
  duration_ms: number
  num_turns: number
  total_cost_usd: number
  usage: Record<string, any>
}

export type ClaudeEvent = ClaudeInitEvent | ClaudeAssistantMessage | ClaudeToolResult | ClaudeStreamEvent | ClaudeResultEvent | { type: string; [key: string]: any }

// --- Session types ---

export interface ClaudeSession {
  id: string
  sessionId?: string
  status: 'idle' | 'running' | 'completed' | 'error'
  prompt: string
  result?: string
  error?: string
  costUsd: number
  turns: number
  messages: ClaudeAssistantMessage[]
  process?: Subprocess
}

// --- Feature state and options ---

export const ClaudeCodeStateSchema = FeatureStateSchema.extend({
  sessions: z.record(z.any()),
  activeSessions: z.array(z.string()),
  claudeAvailable: z.boolean(),
  claudeVersion: z.string().optional(),
})

export const ClaudeCodeOptionsSchema = FeatureOptionsSchema.extend({
  /** Path to the claude CLI binary. Defaults to 'claude'. */
  claudePath: z.string().optional(),
  /** Default model to use for sessions. */
  model: z.string().optional(),
  /** Default working directory for sessions. */
  cwd: z.string().optional(),
  /** Default system prompt prepended to all sessions. */
  systemPrompt: z.string().optional(),
  /** Default append system prompt for all sessions. */
  appendSystemPrompt: z.string().optional(),
  /** Default permission mode. */
  permissionMode: z.enum(['default', 'acceptEdits', 'bypassPermissions', 'plan']).optional(),
  /** Default allowed tools. */
  allowedTools: z.array(z.string()).optional(),
  /** Default disallowed tools. */
  disallowedTools: z.array(z.string()).optional(),
  /** Whether to stream partial messages (token-by-token). Defaults to false. */
  streaming: z.boolean().optional(),
  /** MCP config paths or JSON strings to pass to sessions. */
  mcpConfig: z.array(z.string()).optional(),
})

export type ClaudeCodeState = z.infer<typeof ClaudeCodeStateSchema>
export type ClaudeCodeOptions = z.infer<typeof ClaudeCodeOptionsSchema>

export interface RunOptions {
  /** Override model for this session. */
  model?: string
  /** Override working directory. */
  cwd?: string
  /** System prompt for this session. */
  systemPrompt?: string
  /** Append system prompt for this session. */
  appendSystemPrompt?: string
  /** Permission mode override. */
  permissionMode?: 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan'
  /** Allowed tools override. */
  allowedTools?: string[]
  /** Disallowed tools override. */
  disallowedTools?: string[]
  /** Whether to stream partial messages. */
  streaming?: boolean
  /** Resume a previous session by ID. */
  resumeSessionId?: string
  /** Continue the most recent conversation. */
  continue?: boolean
  /** Additional directories to allow tool access to. */
  addDirs?: string[]
  /** MCP config paths or JSON strings. */
  mcpConfig?: string[]
  /** Skip all permission checks (only for sandboxed environments). */
  dangerouslySkipPermissions?: boolean
  /** Additional arbitrary CLI flags. */
  extraArgs?: string[]
}

/**
 * Claude Code CLI wrapper feature. Spawns and manages Claude Code sessions
 * as subprocesses, streaming structured JSON events back through the
 * container's event system.
 *
 * Sessions are long-lived: each call to `run()` spawns a `claude -p` process
 * with `--output-format stream-json`, parses NDJSON from stdout line-by-line,
 * and emits typed events on the feature's event bus.
 *
 * @extends Feature
 *
 * @example
 * ```typescript
 * const cc = container.feature('claudeCode')
 *
 * // Listen for events
 * cc.on('session:delta', ({ sessionId, text }) => process.stdout.write(text))
 * cc.on('session:result', ({ sessionId, result }) => console.log('Done:', result))
 *
 * // Run a prompt
 * const session = await cc.run('Explain the architecture of this project')
 * console.log(session.result)
 * ```
 */
export class ClaudeCode extends Feature<ClaudeCodeState, ClaudeCodeOptions> {
  static override stateSchema = ClaudeCodeStateSchema
  static override optionsSchema = ClaudeCodeOptionsSchema
  static override shortcut = 'features.claudeCode' as const

  static attach(container: Container<AvailableFeatures, any>) {
    container.features.register('claudeCode', ClaudeCode)
    return container
  }

  override get initialState(): ClaudeCodeState {
    return {
      ...super.initialState,
      sessions: {},
      activeSessions: [],
      claudeAvailable: false
    }
  }

  /**
   * Resolve the path to the claude CLI binary.
   *
   * @returns {string} The path to the claude binary
   */
  get claudePath(): string {
    return this.options.claudePath || 'claude'
  }

  /**
   * Check if the Claude CLI is available and capture its version.
   *
   * @returns {Promise<boolean>} Whether the CLI is available
   *
   * @example
   * ```typescript
   * const available = await cc.checkAvailability()
   * if (!available) throw new Error('Claude CLI not found')
   * ```
   */
  async checkAvailability(): Promise<boolean> {
    try {
      const proc = Bun.spawn([this.claudePath, '--version'], {
        stdout: 'pipe',
        stderr: 'pipe'
      })
      const stdout = await new Response(proc.stdout).text()
      const exitCode = await proc.exited

      if (exitCode === 0) {
        const version = stdout.trim()
        this.setState({ claudeAvailable: true, claudeVersion: version })
        return true
      }

      this.setState({ claudeAvailable: false })
      return false
    } catch {
      this.setState({ claudeAvailable: false })
      return false
    }
  }

  /**
   * Build the argument array for a claude CLI invocation.
   *
   * @param {string} prompt - The prompt text
   * @param {RunOptions} options - Session options
   * @returns {string[]} CLI arguments
   */
  private buildArgs(prompt: string, options: RunOptions = {}): string[] {
    const args: string[] = ['-p', '--output-format', 'stream-json', '--verbose']

    const streaming = options.streaming ?? this.options.streaming ?? false
    if (streaming) {
      args.push('--include-partial-messages')
    }

    const model = options.model ?? this.options.model
    if (model) args.push('--model', model)

    const systemPrompt = options.systemPrompt ?? this.options.systemPrompt
    if (systemPrompt) args.push('--system-prompt', systemPrompt)

    const appendSystemPrompt = options.appendSystemPrompt ?? this.options.appendSystemPrompt
    if (appendSystemPrompt) args.push('--append-system-prompt', appendSystemPrompt)

    const permissionMode = options.permissionMode ?? this.options.permissionMode
    if (permissionMode) args.push('--permission-mode', permissionMode)

    const allowedTools = options.allowedTools ?? this.options.allowedTools
    if (allowedTools?.length) args.push('--allowed-tools', ...allowedTools)

    const disallowedTools = options.disallowedTools ?? this.options.disallowedTools
    if (disallowedTools?.length) args.push('--disallowed-tools', ...disallowedTools)

    const mcpConfig = options.mcpConfig ?? this.options.mcpConfig
    if (mcpConfig?.length) args.push('--mcp-config', ...mcpConfig)

    if (options.resumeSessionId) args.push('--resume', options.resumeSessionId)
    if (options.continue) args.push('--continue')
    if (options.dangerouslySkipPermissions) args.push('--dangerously-skip-permissions')

    if (options.addDirs?.length) {
      args.push('--add-dir', ...options.addDirs)
    }

    if (options.extraArgs?.length) {
      args.push(...options.extraArgs)
    }

    args.push(prompt)

    return args
  }

  /**
   * Create a unique session ID.
   *
   * @returns {string} A UUID-based session ID
   */
  private createSessionId(): string {
    return crypto.randomUUID()
  }

  /**
   * Update a session in state.
   *
   * @param {string} id - The local session ID
   * @param {Partial<ClaudeSession>} update - Fields to merge
   */
  private updateSession(id: string, update: Partial<ClaudeSession>): void {
    const sessions = { ...this.state.current.sessions }
    const existing = sessions[id]
    if (existing) {
      sessions[id] = { ...existing, ...update }
      this.setState({ sessions })
    }
  }

  /**
   * Process a parsed JSON event from the Claude CLI stream.
   *
   * @param {string} sessionId - The local session ID
   * @param {ClaudeEvent} event - The parsed event
   */
  private handleEvent(sessionId: string, event: ClaudeEvent): void {
    this.emit('session:event', { sessionId, event })

    switch (event.type) {
      case 'system': {
        const init = event as ClaudeInitEvent
        this.updateSession(sessionId, { sessionId: init.session_id })
        this.emit('session:init', { sessionId, init })
        break
      }

      case 'stream_event': {
        const streamEvent = event as ClaudeStreamEvent
        if (streamEvent.event.type === 'content_block_delta' && streamEvent.event.delta?.text) {
          this.emit('session:delta', {
            sessionId,
            text: streamEvent.event.delta.text,
            parentToolUseId: streamEvent.parent_tool_use_id
          })
        }
        this.emit('session:stream', { sessionId, streamEvent })
        break
      }

      case 'assistant': {
        const msg = event as ClaudeAssistantMessage
        const session = this.state.current.sessions[sessionId]
        if (session) {
          this.updateSession(sessionId, {
            messages: [...session.messages, msg]
          })
        }
        this.emit('session:message', { sessionId, message: msg })
        break
      }

      case 'result': {
        const result = event as ClaudeResultEvent
        this.updateSession(sessionId, {
          status: result.is_error ? 'error' : 'completed',
          result: result.result,
          error: result.is_error ? result.result : undefined,
          costUsd: result.total_cost_usd,
          turns: result.num_turns
        })

        const activeSessions = this.state.current.activeSessions.filter(id => id !== sessionId)
        this.setState({ activeSessions })

        this.emit('session:result', {
          sessionId,
          result: result.result,
          isError: result.is_error,
          costUsd: result.total_cost_usd,
          turns: result.num_turns,
          durationMs: result.duration_ms
        })
        break
      }
    }
  }

  /**
   * Run a prompt in a new Claude Code session. Spawns a subprocess,
   * streams NDJSON events, and resolves when the session completes.
   *
   * @param {string} prompt - The instruction/prompt to send
   * @param {RunOptions} [options] - Session configuration overrides
   * @returns {Promise<ClaudeSession>} The completed session with result
   *
   * @example
   * ```typescript
   * // Simple one-shot
   * const session = await cc.run('What files are in this project?')
   * console.log(session.result)
   *
   * // With options
   * const session = await cc.run('Refactor the auth module', {
   *   model: 'opus',
   *   cwd: '/path/to/project',
   *   permissionMode: 'acceptEdits',
   *   streaming: true
   * })
   *
   * // Resume a previous session
   * const session = await cc.run('Now add tests for that', {
   *   resumeSessionId: previousSession.sessionId
   * })
   * ```
   */
  async run(prompt: string, options: RunOptions = {}): Promise<ClaudeSession> {
    const id = this.createSessionId()
    const args = this.buildArgs(prompt, options)
    const cwd = options.cwd ?? this.options.cwd ?? (this.container as any).cwd

    const session: ClaudeSession = {
      id,
      status: 'running',
      prompt,
      costUsd: 0,
      turns: 0,
      messages: []
    }

    // Register session in state
    const sessions = { ...this.state.current.sessions, [id]: session }
    const activeSessions = [...this.state.current.activeSessions, id]
    this.setState({ sessions, activeSessions })

    this.emit('session:start', { sessionId: id, prompt })

    const proc = Bun.spawn([this.claudePath, ...args], {
      cwd,
      stdout: 'pipe',
      stderr: 'pipe',
      env: { ...process.env }
    })

    this.updateSession(id, { process: proc })

    // Read stdout line-by-line as NDJSON
    const reader = proc.stdout.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue

          try {
            const event = JSON.parse(trimmed) as ClaudeEvent
            this.handleEvent(id, event)
          } catch {
            this.emit('session:parse-error', { sessionId: id, line: trimmed })
          }
        }
      }

      // Process remaining buffer
      if (buffer.trim()) {
        try {
          const event = JSON.parse(buffer.trim()) as ClaudeEvent
          this.handleEvent(id, event)
        } catch {
          // ignore trailing partial data
        }
      }
    } catch (err) {
      this.updateSession(id, {
        status: 'error',
        error: err instanceof Error ? err.message : String(err)
      })
      this.emit('session:error', { sessionId: id, error: err })
    }

    // Collect stderr
    const stderr = await new Response(proc.stderr).text()
    const exitCode = await proc.exited

    if (exitCode !== 0 && this.state.current.sessions[id]?.status !== 'completed') {
      this.updateSession(id, {
        status: 'error',
        error: stderr || `Process exited with code ${exitCode}`
      })
      this.emit('session:error', { sessionId: id, error: stderr, exitCode })
    }

    return this.state.current.sessions[id]!
  }

  /**
   * Run a prompt without waiting for completion. Returns the session ID
   * immediately so you can subscribe to events.
   *
   * @param {string} prompt - The instruction/prompt to send
   * @param {RunOptions} [options] - Session configuration overrides
   * @returns {string} The session ID to track via events
   *
   * @example
   * ```typescript
   * const sessionId = cc.start('Build a REST API for users')
   *
   * cc.on('session:delta', ({ sessionId: sid, text }) => {
   *   if (sid === sessionId) process.stdout.write(text)
   * })
   *
   * cc.on('session:result', ({ sessionId: sid, result }) => {
   *   if (sid === sessionId) console.log('\nDone:', result)
   * })
   * ```
   */
  start(prompt: string, options: RunOptions = {}): string {
    const id = this.createSessionId()
    const args = this.buildArgs(prompt, options)
    const cwd = options.cwd ?? this.options.cwd ?? (this.container as any).cwd

    const session: ClaudeSession = {
      id,
      status: 'running',
      prompt,
      costUsd: 0,
      turns: 0,
      messages: []
    }

    const sessions = { ...this.state.current.sessions, [id]: session }
    const activeSessions = [...this.state.current.activeSessions, id]
    this.setState({ sessions, activeSessions })

    this.emit('session:start', { sessionId: id, prompt })

    const proc = Bun.spawn([this.claudePath, ...args], {
      cwd,
      stdout: 'pipe',
      stderr: 'pipe',
      env: { ...process.env }
    })

    this.updateSession(id, { process: proc })

    // Process in background
    this.consumeStream(id, proc)

    return id
  }

  /**
   * Consume the stdout stream of a running process in the background.
   *
   * @param {string} sessionId - The local session ID
   * @param {Subprocess} proc - The Bun subprocess
   */
  private async consumeStream(sessionId: string, proc: Subprocess): Promise<void> {
    const reader = proc.stdout.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue

          try {
            const event = JSON.parse(trimmed) as ClaudeEvent
            this.handleEvent(sessionId, event)
          } catch {
            this.emit('session:parse-error', { sessionId, line: trimmed })
          }
        }
      }

      if (buffer.trim()) {
        try {
          const event = JSON.parse(buffer.trim()) as ClaudeEvent
          this.handleEvent(sessionId, event)
        } catch { /* ignore */ }
      }
    } catch (err) {
      this.updateSession(sessionId, {
        status: 'error',
        error: err instanceof Error ? err.message : String(err)
      })
      this.emit('session:error', { sessionId, error: err })
    }

    const stderr = await new Response(proc.stderr).text()
    const exitCode = await proc.exited

    if (exitCode !== 0 && this.state.current.sessions[sessionId]?.status !== 'completed') {
      this.updateSession(sessionId, {
        status: 'error',
        error: stderr || `Process exited with code ${exitCode}`
      })
      this.emit('session:error', { sessionId, error: stderr, exitCode })
    }
  }

  /**
   * Kill a running session's subprocess.
   *
   * @param {string} sessionId - The local session ID to abort
   *
   * @example
   * ```typescript
   * const sessionId = cc.start('Do something long')
   * // ... later
   * cc.abort(sessionId)
   * ```
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
   * Get a session by its local ID.
   *
   * @param {string} sessionId - The local session ID
   * @returns {ClaudeSession | undefined} The session if it exists
   *
   * @example
   * ```typescript
   * const session = cc.getSession(sessionId)
   * if (session?.status === 'completed') {
   *   console.log(session.result)
   * }
   * ```
   */
  getSession(sessionId: string): ClaudeSession | undefined {
    return this.state.current.sessions[sessionId]
  }

  /**
   * Wait for a running session to complete.
   *
   * @param {string} sessionId - The local session ID
   * @returns {Promise<ClaudeSession>} The completed session
   *
   * @example
   * ```typescript
   * const id = cc.start('Build something cool')
   * const session = await cc.waitForSession(id)
   * console.log(session.result)
   * ```
   */
  async waitForSession(sessionId: string): Promise<ClaudeSession> {
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
   * Initialize the feature.
   *
   * @param {any} [options] - Enable options
   * @returns {Promise<this>} The enabled feature
   */
  override async enable(options: any = {}): Promise<this> {
    await super.enable(options)
    return this
  }
}

export default features.register('claudeCode', ClaudeCode)
