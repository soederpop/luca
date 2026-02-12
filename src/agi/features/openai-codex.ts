import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'
import type { Container } from '@/container'
import { type AvailableFeatures } from '@/feature'
import { features, Feature } from '@/feature'
import type { Subprocess } from 'bun'

declare module '@/feature' {
  interface AvailableFeatures {
    openaiCodex: typeof OpenAICodex
  }
}

// --- Stream JSON types from the Codex CLI ---

export interface CodexMessageEvent {
  type: 'message'
  role: 'assistant' | 'system'
  content: Array<{ type: 'text'; text: string } | { type: 'tool_use'; id: string; name: string; input: any } | { type: string; [key: string]: any }>
}

export interface CodexToolCallEvent {
  type: 'function_call'
  id: string
  name: string
  arguments: string
  call_id?: string
}

export interface CodexToolResultEvent {
  type: 'function_call_output'
  call_id: string
  output: string
}

export interface CodexExecEvent {
  type: 'exec'
  command: string[]
  cwd?: string
  exit_code?: number
  stdout?: string
  stderr?: string
}

export interface CodexPatchEvent {
  type: 'patch'
  path: string
  content?: string
  diff?: string
}

export type CodexEvent =
  | CodexMessageEvent
  | CodexToolCallEvent
  | CodexToolResultEvent
  | CodexExecEvent
  | CodexPatchEvent
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
  patches: CodexPatchEvent[]
  executions: CodexExecEvent[]
  process?: Subprocess
}

// --- Feature state and options ---

export const OpenAICodexStateSchema = FeatureStateSchema.extend({
  sessions: z.record(z.any()).describe('Map of session IDs to CodexSession objects'),
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

  static attach(container: Container<AvailableFeatures, any>) {
    container.features.register('openaiCodex', OpenAICodex)
    return container
  }

  override get initialState(): OpenAICodexState {
    return {
      ...super.initialState,
      sessions: {},
      activeSessions: [],
      codexAvailable: false
    }
  }

  get codexPath(): string {
    return this.options.codexPath || 'codex'
  }

  /**
   * Check if the Codex CLI is available and capture its version.
   */
  async checkAvailability(): Promise<boolean> {
    try {
      const proc = Bun.spawn([this.codexPath, '--version'], {
        stdout: 'pipe',
        stderr: 'pipe'
      })
      const stdout = await new Response(proc.stdout).text()
      const exitCode = await proc.exited

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
  private buildArgs(prompt: string, options: CodexRunOptions = {}): string[] {
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

    args.push(prompt)

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
   */
  private handleEvent(sessionId: string, event: CodexEvent): void {
    this.emit('session:event', { sessionId, event })

    switch (event.type) {
      case 'message': {
        const msg = event as CodexMessageEvent
        const session = this.state.current.sessions[sessionId]
        if (session) {
          this.updateSession(sessionId, {
            messages: [...session.messages, msg]
          })

          // Extract text content for convenience
          const textParts = msg.content
            ?.filter((c: any) => c.type === 'text')
            .map((c: any) => c.text)
            .join('')

          if (textParts) {
            this.emit('session:delta', { sessionId, text: textParts, role: msg.role })
          }
        }
        this.emit('session:message', { sessionId, message: msg })
        break
      }

      case 'function_call': {
        this.emit('session:tool-call', { sessionId, toolCall: event })
        break
      }

      case 'function_call_output': {
        this.emit('session:tool-result', { sessionId, toolResult: event })
        break
      }

      case 'exec': {
        const exec = event as CodexExecEvent
        const session = this.state.current.sessions[sessionId]
        if (session) {
          this.updateSession(sessionId, {
            executions: [...session.executions, exec],
            turns: session.turns + 1
          })
        }
        this.emit('session:exec', { sessionId, exec })
        break
      }

      case 'patch': {
        const patch = event as CodexPatchEvent
        const session = this.state.current.sessions[sessionId]
        if (session) {
          this.updateSession(sessionId, {
            patches: [...session.patches, patch]
          })
        }
        this.emit('session:patch', { sessionId, patch })
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
    const args = this.buildArgs(prompt, options)
    const cwd = options.cwd ?? this.options.cwd ?? (this.container as any).cwd

    const session: CodexSession = {
      id,
      status: 'running',
      prompt,
      turns: 0,
      messages: [],
      patches: [],
      executions: []
    }

    const sessions = { ...this.state.current.sessions, [id]: session }
    const activeSessions = [...this.state.current.activeSessions, id]
    this.setState({ sessions, activeSessions })

    this.emit('session:start', { sessionId: id, prompt })

    const proc = Bun.spawn([this.codexPath, ...args], {
      cwd,
      stdout: 'pipe',
      stderr: 'pipe',
      env: { ...process.env }
    })

    this.updateSession(id, { process: proc })

    const reader = proc.stdout.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let lastText = ''

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
            const event = JSON.parse(trimmed) as CodexEvent
            this.handleEvent(id, event)

            // Track the last text content for the result
            if (event.type === 'message' && (event as CodexMessageEvent).role === 'assistant') {
              const texts = (event as CodexMessageEvent).content
                ?.filter((c: any) => c.type === 'text')
                .map((c: any) => c.text)
                .join('')
              if (texts) lastText = texts
            }
          } catch {
            this.emit('session:parse-error', { sessionId: id, line: trimmed })
          }
        }
      }

      // Process remaining buffer
      if (buffer.trim()) {
        try {
          const event = JSON.parse(buffer.trim()) as CodexEvent
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

    const stderr = await new Response(proc.stderr).text()
    const exitCode = await proc.exited

    if (exitCode !== 0 && this.state.current.sessions[id]?.status !== 'completed') {
      this.updateSession(id, {
        status: 'error',
        error: stderr || `Process exited with code ${exitCode}`
      })
      this.emit('session:error', { sessionId: id, error: stderr, exitCode })
    } else if (this.state.current.sessions[id]?.status === 'running') {
      this.updateSession(id, {
        status: 'completed',
        result: lastText || undefined
      })

      const activeSessions = this.state.current.activeSessions.filter(s => s !== id)
      this.setState({ activeSessions })

      this.emit('session:result', {
        sessionId: id,
        result: lastText,
      })
    }

    return this.state.current.sessions[id]!
  }

  /**
   * Run a prompt without waiting for completion. Returns the session ID
   * immediately so you can subscribe to events.
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
    const args = this.buildArgs(prompt, options)
    const cwd = options.cwd ?? this.options.cwd ?? (this.container as any).cwd

    const session: CodexSession = {
      id,
      status: 'running',
      prompt,
      turns: 0,
      messages: [],
      patches: [],
      executions: []
    }

    const sessions = { ...this.state.current.sessions, [id]: session }
    const activeSessions = [...this.state.current.activeSessions, id]
    this.setState({ sessions, activeSessions })

    this.emit('session:start', { sessionId: id, prompt })

    const proc = Bun.spawn([this.codexPath, ...args], {
      cwd,
      stdout: 'pipe',
      stderr: 'pipe',
      env: { ...process.env }
    })

    this.updateSession(id, { process: proc })
    this.consumeStream(id, proc)

    return id
  }

  private async consumeStream(sessionId: string, proc: Subprocess): Promise<void> {
    const reader = proc.stdout.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let lastText = ''

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
            const event = JSON.parse(trimmed) as CodexEvent
            this.handleEvent(sessionId, event)

            if (event.type === 'message' && (event as CodexMessageEvent).role === 'assistant') {
              const texts = (event as CodexMessageEvent).content
                ?.filter((c: any) => c.type === 'text')
                .map((c: any) => c.text)
                .join('')
              if (texts) lastText = texts
            }
          } catch {
            this.emit('session:parse-error', { sessionId, line: trimmed })
          }
        }
      }

      if (buffer.trim()) {
        try {
          const event = JSON.parse(buffer.trim()) as CodexEvent
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

  getSession(sessionId: string): CodexSession | undefined {
    return this.state.current.sessions[sessionId]
  }

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

  override async enable(options: any = {}): Promise<this> {
    await super.enable(options)
    return this
  }
}

export default features.register('openaiCodex', OpenAICodex)
