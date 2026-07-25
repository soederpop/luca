// @ts-nocheck
import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from '../../schemas/base.js'
import { type AvailableFeatures } from 'luca/feature'
import { Feature } from '../feature.js'
import { Client } from '../../client.js'
import { HermesAcpClient } from '../../clients/hermes-acp.js'

declare module 'luca/feature' {
  interface AvailableFeatures {
    hermesAgent: typeof HermesAgent
  }
}

// --- ACP session/update payloads from the hermes acp adapter ---

export interface HermesSessionUpdate {
  sessionUpdate: 'agent_message_chunk' | 'agent_thought_chunk' | 'tool_call' | 'tool_call_update' | 'plan' | 'usage_update' | 'available_commands_update' | 'current_mode_update' | string
  content?: { type: string; text?: string }
  [key: string]: any
}

/** Normalized message emitted via session:message for downstream consumers. */
export interface HermesMessageEvent {
  type: 'message'
  role: 'assistant'
  content: Array<{ type: 'text'; text: string }>
}

export interface HermesUsage {
  inputTokens?: number
  outputTokens?: number
  thoughtTokens?: number
  cachedReadTokens?: number
  totalTokens?: number
}

// --- Session types ---

export interface HermesSession {
  id: string
  acpSessionId?: string
  status: 'idle' | 'running' | 'completed' | 'error'
  prompt: string
  result?: string
  stopReason?: string
  error?: string
  turns: number
  messages: HermesMessageEvent[]
  toolCalls: any[]
  usage?: HermesUsage
}

// --- Feature state and options ---

export const HermesAgentStateSchema = FeatureStateSchema.extend({
  sessions: z.record(z.string(), z.any()).describe('Map of session IDs to HermesSession objects'),
  activeSessions: z.array(z.string()).describe('List of currently running session IDs'),
  hermesAvailable: z.boolean().describe('Whether the hermes CLI binary is available'),
  hermesVersion: z.string().optional().describe('Detected hermes CLI version string'),
  adapterRunning: z.boolean().describe('Whether the persistent hermes acp adapter process is running'),
  adapterInfo: z.any().optional().describe('agentInfo returned by the ACP initialize handshake'),
})

export const HermesAgentOptionsSchema = FeatureOptionsSchema.extend({
  hermesPath: z.string().optional().describe('Path to the hermes CLI binary'),
  model: z.string().optional().describe('Default model for sessions (applied via session/set_model, and HERMES_INFERENCE_MODEL at adapter spawn)'),
  cwd: z.string().optional().describe('Default working directory for sessions'),
  permissionMode: z.enum(['default', 'acceptEdits', 'dontAsk']).optional().describe('Default ACP session mode, mapped to default/accept_edits/dont_ask; also drives how permission requests are answered'),
  mcpServers: z.array(z.any()).optional().describe('MCP server configs passed to session/new'),
  provider: z.string().optional().describe('Inference provider override (HERMES_INFERENCE_PROVIDER at adapter spawn; requires restartAdapter() to change)'),
  yolo: z.boolean().optional().describe('Bypass approval prompts: sets HERMES_YOLO_MODE=1 at adapter spawn and auto-approves ACP permission requests'),
  safeMode: z.boolean().optional().describe('Disable all hermes customizations — user config, rules, plugins, MCP servers (HERMES_SAFE_MODE=1 at adapter spawn)'),
  ignoreRules: z.boolean().optional().describe('Skip auto-injection of AGENTS.md, memory, and preloaded skills (HERMES_IGNORE_RULES=1 at adapter spawn)'),
  ignoreUserConfig: z.boolean().optional().describe('Ignore ~/.hermes/config.yaml and use built-in defaults (HERMES_IGNORE_USER_CONFIG=1 at adapter spawn)'),
  maxTurns: z.number().optional().describe('Maximum tool-calling iterations per turn (HERMES_MAX_ITERATIONS at adapter spawn)'),
  acceptHooks: z.boolean().optional().describe('Auto-approve unseen shell hooks without a TTY prompt (HERMES_ACCEPT_HOOKS=1 at adapter spawn)'),
  adapterBootTimeoutMs: z.number().optional().describe('Timeout for adapter spawn + ACP initialize handshake (default 60000; the adapter loads MCP servers and can take ~15s)'),
})

export const HermesAgentEventsSchema = FeatureEventsSchema.extend({
  'session:start': z.tuple([z.object({ sessionId: z.string(), prompt: z.string() })]).describe('Fired when a new Hermes run begins'),
  'session:init': z.tuple([z.object({ sessionId: z.string(), acpSessionId: z.string(), models: z.any().optional(), modes: z.any().optional() })]).describe('Fired when the ACP session is created or loaded'),
  'session:event': z.tuple([z.object({ sessionId: z.string(), event: z.any() })]).describe('Fired for every session/update notification from the adapter'),
  'session:delta': z.tuple([z.object({ sessionId: z.string(), text: z.string(), role: z.string() })]).describe('Fired for each agent_message_chunk text delta'),
  'session:reasoning': z.tuple([z.object({ sessionId: z.string(), text: z.string() })]).describe('Fired for agent_thought_chunk (model thinking) updates'),
  'session:tool-call': z.tuple([z.object({ sessionId: z.string(), toolCall: z.any() })]).describe('Fired for tool_call and tool_call_update session updates'),
  'session:plan': z.tuple([z.object({ sessionId: z.string(), plan: z.any() })]).describe('Fired for plan session updates'),
  'session:usage': z.tuple([z.object({ sessionId: z.string(), usage: z.any() })]).describe('Fired for usage_update notifications (context window size/used)'),
  'session:permission-request': z.tuple([z.object({ sessionId: z.string(), request: z.any(), outcome: z.any() })]).describe('Fired when hermes asks for permission and the feature answers it'),
  'session:message': z.tuple([z.object({ sessionId: z.string(), message: z.any() })]).describe('Fired when a turn completes, with the accumulated assistant message'),
  'session:result': z.tuple([z.object({ sessionId: z.string(), result: z.string(), stopReason: z.string().optional(), usage: z.any().optional() })]).describe('Fired when a run completes with a final result'),
  'session:error': z.tuple([z.object({ sessionId: z.string(), error: z.any(), exitCode: z.number().optional() })]).describe('Fired when a run or the adapter encounters an error'),
  'session:abort': z.tuple([z.object({ sessionId: z.string() })]).describe('Fired when a run is aborted by the user'),
  'session:parse-error': z.tuple([z.object({ sessionId: z.string(), line: z.string() })]).describe('Fired when a line from the adapter cannot be parsed as JSON'),
  'adapter:start': z.tuple([z.object({ agentInfo: z.any() })]).describe('Fired when the persistent ACP adapter finishes its initialize handshake'),
  'adapter:exit': z.tuple([z.object({ exitCode: z.number().optional(), error: z.any().optional() })]).describe('Fired when the adapter process exits'),
}).describe('HermesAgent events')

export type HermesAgentState = z.infer<typeof HermesAgentStateSchema>
export type HermesAgentOptions = z.infer<typeof HermesAgentOptionsSchema>

export interface HermesRunOptions {
  /** Model override for this run (applied via session/set_model). */
  model?: string
  /** Working directory for the ACP session. */
  cwd?: string
  /** ACP session mode for this run, mapped to default/accept_edits/dont_ask. */
  permissionMode?: 'default' | 'acceptEdits' | 'dontAsk'
  /** Auto-approve all permission requests for this run. */
  yolo?: boolean
  /** Resume a previous hermes session by its ACP/hermes session ID (session/load). */
  resumeSessionId?: string
  /** Continue the most recent ACP session created by this feature instance. */
  continue?: boolean
  /** MCP server configs passed to session/new. */
  mcpServers?: any[]
  /** Timeout in ms for the prompt turn. No timeout by default — agent turns can run long. */
  timeoutMs?: number
}

const ACP_MODE_IDS: Record<string, string> = {
  default: 'default',
  acceptEdits: 'accept_edits',
  dontAsk: 'dont_ask',
}

/**
 * Hermes Agent CLI wrapper feature. Controls the `hermes` agent CLI over the
 * Agent Client Protocol (ACP): a single persistent `hermes acp` adapter process is
 * lazily spawned on first use and shared across runs, with one ACP session
 * per `run()`/`start()` call. Streaming updates (message chunks, thoughts,
 * tool calls, plans, usage) are re-emitted as typed session events, mirroring
 * the claudeCode and openaiCodex agent-wrapper features.
 *
 * The adapter boot is slow (~15s — it loads MCP servers), which is why the
 * process is reused. Call `stopAdapter()` when you're done in short-lived
 * scripts, otherwise the adapter keeps the event loop alive.
 *
 * The underlying `hermesAcp` client is registered lazily when this feature
 * is enabled — it does not appear in the clients registry otherwise.
 *
 * Known limitations: hermes `--toolsets` / `--skills` preloading has no ACP
 * or env-var surface, so it is not supported. Options that map to spawn-time
 * env vars (provider, yolo, safeMode, ignoreRules, ignoreUserConfig,
 * maxTurns, acceptHooks) require `restartAdapter()` to change after the
 * adapter is running. Hermes reports token usage but no cost.
 *
 * @extends Feature
 *
 * @example
 * ```typescript
 * const hermes = container.feature('hermesAgent')
 *
 * hermes.on('session:delta', ({ text }) => process.stdout.write(text))
 *
 * const session = await hermes.run('Summarize the README in this folder')
 * console.log(session.result, session.usage)
 *
 * await hermes.stopAdapter()
 * ```
 */
export class HermesAgent extends Feature<HermesAgentState, HermesAgentOptions> {
  static override stateSchema = HermesAgentStateSchema
  static override optionsSchema = HermesAgentOptionsSchema
  static override eventsSchema = HermesAgentEventsSchema
  static override shortcut = 'features.hermesAgent' as const
  static override stability = 'stable' as const
  static override category = 'agent-wrappers' as const
  static override envVars = ['HERMES_INFERENCE_MODEL', 'HERMES_INFERENCE_PROVIDER', 'HERMES_YOLO_MODE', 'HERMES_ACCEPT_HOOKS']

  static { Feature.register(this, 'hermesAgent') }

  constructor(options: any, context: any) {
    super(options, context)
    // Lazy client registration: the hermesAcp client only enters the clients
    // registry once this feature is actually instantiated.
    HermesAgent.registerAcpClient()
  }

  /** Register the hermesAcp client class in the clients registry (idempotent). */
  static registerAcpClient(): void {
    Client.register(HermesAcpClient, 'hermesAcp')
  }

  override get initialState(): HermesAgentState {
    return {
      ...super.initialState,
      sessions: {},
      activeSessions: [],
      hermesAvailable: false,
      adapterRunning: false,
    }
  }

  private _resolvedHermesPath: string | null = null
  private acpClient: HermesAcpClient | null = null
  private adapterStarting: Promise<HermesAcpClient> | null = null
  private acpToLocal = new Map<string, string>()
  private lastAcpSessionId: string | undefined
  private exitCleanupRegistered = false

  /** @returns The path to the hermes CLI binary, falling back to 'hermes' on the PATH. */
  get hermesPath(): string {
    if (this.options.hermesPath) return this.options.hermesPath
    if (this._resolvedHermesPath) return this._resolvedHermesPath
    try {
      this._resolvedHermesPath = this.container.feature('proc').resolveRealPath('hermes')
    } catch {
      this._resolvedHermesPath = 'hermes'
    }
    return this._resolvedHermesPath
  }

  /**
   * Parse the detected hermes version string into components.
   *
   * @returns {{ major: number; minor: number; patch: number } | undefined} Parsed version, or undefined if unknown
   */
  get parsedVersion(): { major: number; minor: number; patch: number } | undefined {
    const version = this.state.current.hermesVersion
    if (!version) return undefined
    const match = version.match(/v?(\d+)\.(\d+)\.(\d+)/)
    if (!match) return undefined
    return { major: Number(match[1]), minor: Number(match[2]), patch: Number(match[3]) }
  }

  /**
   * Check if the Hermes CLI is available and capture its version.
   *
   * @returns {Promise<boolean>} True if the hermes binary was found and responded to --version
   *
   * @example
   * ```typescript
   * const hermes = container.feature('hermesAgent')
   * if (await hermes.checkAvailability()) {
   *   console.log(hermes.state.current.hermesVersion) // "Hermes Agent v0.19.0 ..."
   * }
   * ```
   */
  async checkAvailability(): Promise<boolean> {
    try {
      const proc = this.container.feature('proc')
      const result = await proc.spawnAndCapture(this.hermesPath, ['--version'])

      if (result.exitCode === 0) {
        const version = result.stdout.trim().split('\n')[0]
        this.setState({ hermesAvailable: true, hermesVersion: version })
        return true
      }

      this.setState({ hermesAvailable: false })
      return false
    } catch {
      this.setState({ hermesAvailable: false })
      return false
    }
  }

  /**
   * Build the environment variables for the adapter process from feature options.
   */
  private buildAdapterEnv(): Record<string, string> {
    const env: Record<string, string> = {}
    if (this.options.model) env.HERMES_INFERENCE_MODEL = this.options.model
    if (this.options.provider) env.HERMES_INFERENCE_PROVIDER = this.options.provider
    if (this.options.yolo) env.HERMES_YOLO_MODE = '1'
    if (this.options.safeMode) env.HERMES_SAFE_MODE = '1'
    if (this.options.ignoreRules) env.HERMES_IGNORE_RULES = '1'
    if (this.options.ignoreUserConfig) env.HERMES_IGNORE_USER_CONFIG = '1'
    if (this.options.maxTurns != null) env.HERMES_MAX_ITERATIONS = String(this.options.maxTurns)
    if (this.options.acceptHooks) env.HERMES_ACCEPT_HOOKS = '1'
    return env
  }

  /**
   * Lazily spawn (or reuse) the persistent `hermes acp` adapter process.
   * Concurrent callers share a single boot.
   */
  private async ensureAdapter(): Promise<HermesAcpClient> {
    if (this.acpClient?.running) return this.acpClient
    if (this.adapterStarting) return this.adapterStarting

    this.adapterStarting = (async () => {
      const client = this.container.client('hermesAcp', {
        hermesPath: this.hermesPath,
        bootTimeoutMs: this.options.adapterBootTimeoutMs,
        environment: this.buildAdapterEnv(),
        // A fresh cache key per boot — a crashed client instance must not be reused
        _cacheKey: `hermesAcp:${crypto.randomUUID()}`,
      }) as HermesAcpClient

      client.on('notification', ({ method, params }) => this.handleNotification(method, params))
      client.on('parse-error', ({ line }) => {
        this.emit('session:parse-error', { sessionId: this.lastActiveLocalId() ?? '', line })
      })
      client.on('crash', ({ error, exitCode }) => this.handleAdapterCrash(error, exitCode))
      client.setRequestHandler((method, params) => this.handleServerRequest(method, params))

      await client.connect()

      this.acpClient = client
      this.setState({ adapterRunning: true, adapterInfo: client.initializeResult?.agentInfo })
      this.registerExitCleanup()
      this.emit('adapter:start', { agentInfo: client.initializeResult?.agentInfo })
      return client
    })()

    try {
      return await this.adapterStarting
    } finally {
      this.adapterStarting = null
    }
  }

  /**
   * Stop the persistent adapter process. Safe to call when not running.
   * Call this from short-lived scripts — the adapter otherwise keeps the
   * event loop alive.
   *
   * @returns {Promise<void>}
   *
   * @example
   * ```typescript
   * const session = await hermes.run('Do the thing')
   * await hermes.stopAdapter()
   * ```
   */
  async stopAdapter(): Promise<void> {
    const client = this.acpClient
    this.acpClient = null
    this.acpToLocal.clear()
    this.setState({ adapterRunning: false })
    if (client) await client.disconnect()
  }

  /**
   * Restart the adapter process. Use after changing spawn-time options
   * (model, provider, yolo, safeMode, ignoreRules, maxTurns, acceptHooks).
   *
   * @returns {Promise<void>}
   */
  async restartAdapter(): Promise<void> {
    await this.stopAdapter()
    await this.ensureAdapter()
  }

  private registerExitCleanup(): void {
    if (this.exitCleanupRegistered) return
    this.exitCleanupRegistered = true
    process.once('exit', () => {
      try { this.acpClient?.disconnect() } catch { /* best effort */ }
    })
  }

  private handleAdapterCrash(error: any, exitCode?: number): void {
    this.acpClient = null
    this.setState({ adapterRunning: false })
    this.emit('adapter:exit', { exitCode, error })

    // Fail any sessions still marked active — their prompt requests were rejected
    for (const sessionId of [...this.state.current.activeSessions]) {
      const session = this.state.current.sessions[sessionId]
      if (session && session.status === 'running') {
        this.updateSession(sessionId, { status: 'error', error: error instanceof Error ? error.message : String(error) })
        this.emit('session:error', { sessionId, error, exitCode })
      }
    }
    this.setState({ activeSessions: [] })
    this.acpToLocal.clear()
  }

  private lastActiveLocalId(): string | undefined {
    const active = this.state.current.activeSessions
    return active[active.length - 1]
  }

  private createSessionId(): string {
    return crypto.randomUUID()
  }

  private updateSession(id: string, update: Partial<HermesSession>): void {
    const sessions = { ...this.state.current.sessions }
    const existing = sessions[id]
    if (existing) {
      sessions[id] = { ...existing, ...update }
      this.setState({ sessions })
    }
  }

  // --- ACP notification / request handling ---

  private handleNotification(method: string, params: any): void {
    if (method !== 'session/update') return
    const acpSessionId = params?.sessionId
    const sessionId = acpSessionId ? this.acpToLocal.get(acpSessionId) : undefined
    if (!sessionId) return
    this.handleUpdate(sessionId, params.update ?? {})
  }

  /**
   * Process a session/update payload from the adapter.
   *
   * The hermes acp adapter emits these update types:
   *   agent_message_chunk  — { content: { type: 'text', text } } assistant text delta
   *   agent_thought_chunk  — model thinking delta
   *   tool_call            — a tool invocation started
   *   tool_call_update     — tool invocation progress/result
   *   plan                 — agent plan entries
   *   usage_update         — { size, used } context window accounting
   *   available_commands_update, current_mode_update — session metadata
   */
  private handleUpdate(sessionId: string, update: HermesSessionUpdate): void {
    this.emit('session:event', { sessionId, event: update })

    switch (update.sessionUpdate) {
      case 'agent_message_chunk': {
        const text = update.content?.text ?? ''
        if (text) {
          const session = this.state.current.sessions[sessionId]
          if (session) {
            this.updateSession(sessionId, { result: (session.result ?? '') + text })
          }
          this.emit('session:delta', { sessionId, text, role: 'assistant' })
        }
        break
      }

      case 'agent_thought_chunk': {
        const text = update.content?.text ?? ''
        if (text) this.emit('session:reasoning', { sessionId, text })
        break
      }

      case 'tool_call':
      case 'tool_call_update': {
        const session = this.state.current.sessions[sessionId]
        if (session) {
          this.updateSession(sessionId, { toolCalls: [...session.toolCalls, update] })
        }
        this.emit('session:tool-call', { sessionId, toolCall: update })
        break
      }

      case 'plan': {
        this.emit('session:plan', { sessionId, plan: update })
        break
      }

      case 'usage_update': {
        this.emit('session:usage', { sessionId, usage: update })
        break
      }

      default: {
        // Forward unknown update types for extensibility
        this.emit(`session:${update.sessionUpdate}`, { sessionId, event: update })
        break
      }
    }
  }

  /**
   * Answer server-initiated ACP requests. Permission requests are resolved
   * from the session's effective policy (yolo / permissionMode); everything
   * else is rejected as unsupported (we declare no fs/terminal capabilities).
   */
  private async handleServerRequest(method: string, params: any): Promise<any> {
    if (method === 'session/request_permission') {
      const acpSessionId = params?.sessionId
      const sessionId = (acpSessionId && this.acpToLocal.get(acpSessionId)) ?? this.lastActiveLocalId() ?? ''
      const session = sessionId ? this.state.current.sessions[sessionId] : undefined
      const outcome = this.resolvePermission(params, (session as any)?.runPolicy)
      this.emit('session:permission-request', { sessionId, request: params, outcome })
      return outcome
    }

    throw new Error(`Unsupported ACP request '${method}'`)
  }

  /**
   * Pick a permission option based on the effective policy for a run.
   * yolo → allow_always (or any allow); acceptEdits/dontAsk → allow_once
   * preferred; default policy → reject_once.
   */
  private resolvePermission(request: any, policy?: { yolo?: boolean; permissionMode?: string }): any {
    const options: Array<{ optionId: string; kind?: string }> = request?.options ?? []
    const byKind = (kinds: string[]) => {
      for (const kind of kinds) {
        const found = options.find((o) => o.kind === kind)
        if (found) return found
      }
      return undefined
    }

    const yolo = policy?.yolo ?? this.options.yolo
    const mode = policy?.permissionMode ?? this.options.permissionMode

    let selected
    if (yolo) {
      selected = byKind(['allow_always', 'allow_once']) ?? options[0]
    } else if (mode === 'dontAsk') {
      selected = byKind(['allow_always', 'allow_once']) ?? options[0]
    } else if (mode === 'acceptEdits') {
      selected = byKind(['allow_once', 'allow_always']) ?? options[0]
    } else {
      selected = byKind(['reject_once', 'reject_always']) ?? options[options.length - 1]
    }

    if (!selected) return { outcome: { outcome: 'cancelled' } }
    return { outcome: { outcome: 'selected', optionId: selected.optionId } }
  }

  // --- Core run API ---

  /**
   * Run a prompt in a new Hermes session and wait for completion. Boots the
   * shared `hermes acp` adapter on first use (~15s), creates an ACP session,
   * streams update events, and resolves with the completed session.
   *
   * @param {string} prompt - The natural language instruction for the Hermes agent
   * @param {HermesRunOptions} [options] - Per-run overrides (model, cwd, permissionMode, resume, ...)
   * @returns {Promise<HermesSession>} The completed session with result, messages, toolCalls, and usage
   *
   * @example
   * ```typescript
   * const session = await hermes.run('List the files in this folder and summarize them')
   * console.log(session.result)
   *
   * // Resume a previous hermes session
   * const followUp = await hermes.run('Now write that summary to NOTES.md', {
   *   resumeSessionId: session.acpSessionId,
   *   permissionMode: 'acceptEdits',
   * })
   * ```
   */
  async run(prompt: string, options: HermesRunOptions = {}): Promise<HermesSession> {
    const id = await this.start(prompt, options)
    return this.waitForSession(id)
  }

  /**
   * Run a prompt without waiting for completion. Returns the session ID
   * immediately so you can subscribe to events. The adapter boot, session
   * creation, and prompt all happen in the background.
   *
   * @param {string} prompt - The natural language instruction for the Hermes agent
   * @param {HermesRunOptions} [options] - Per-run overrides (model, cwd, permissionMode, resume, ...)
   * @returns {Promise<string>} The local session ID for getSession()/waitForSession()
   *
   * @example
   * ```typescript
   * const sessionId = await hermes.start('Refactor the utils module')
   *
   * hermes.on('session:delta', ({ sessionId: sid, text }) => {
   *   if (sid === sessionId) process.stdout.write(text)
   * })
   *
   * const session = await hermes.waitForSession(sessionId)
   * ```
   */
  async start(prompt: string, options: HermesRunOptions = {}): Promise<string> {
    const id = this.createSessionId()

    const session: HermesSession = {
      id,
      status: 'running',
      prompt,
      turns: 0,
      messages: [],
      toolCalls: [],
    }
    // Remember the per-run permission policy for handleServerRequest
    ;(session as any).runPolicy = { yolo: options.yolo, permissionMode: options.permissionMode }

    const sessions = { ...this.state.current.sessions, [id]: session }
    const activeSessions = [...this.state.current.activeSessions, id]
    this.setState({ sessions, activeSessions })

    this.emit('session:start', { sessionId: id, prompt })

    // Run the ACP conversation in the background
    this.executeSession(id, prompt, options).catch((err) => {
      this.finalizeError(id, err)
    })

    return id
  }

  private async executeSession(id: string, prompt: string, options: HermesRunOptions): Promise<void> {
    const client = await this.ensureAdapter()
    const cwd = options.cwd ?? this.options.cwd ?? (this.container as any).cwd
    const mcpServers = options.mcpServers ?? this.options.mcpServers ?? []

    // Create, load, or continue an ACP session
    let acpSessionId: string
    let initPayload: any
    const resumeId = options.resumeSessionId ?? (options.continue ? this.lastAcpSessionId : undefined)

    if (resumeId) {
      // session/load replays history as session/update notifications — register
      // the mapping first so they route to this local session
      this.acpToLocal.set(resumeId, id)
      initPayload = await client.request('session/load', { sessionId: resumeId, cwd, mcpServers })
      acpSessionId = resumeId
    } else {
      initPayload = await client.request('session/new', { cwd, mcpServers })
      acpSessionId = initPayload?.sessionId
      if (!acpSessionId) throw new Error('hermes acp session/new returned no sessionId')
      this.acpToLocal.set(acpSessionId, id)
    }

    this.lastAcpSessionId = acpSessionId
    this.updateSession(id, { acpSessionId })
    this.emit('session:init', { sessionId: id, acpSessionId, models: initPayload?.models, modes: initPayload?.modes })

    // Apply per-run model/mode — failures are non-fatal
    const model = options.model ?? this.options.model
    const currentModelId = initPayload?.models?.currentModelId
    if (model && currentModelId && model !== currentModelId) {
      const available: Array<{ modelId: string; name?: string }> = initPayload?.models?.availableModels ?? []
      const target = available.find((m) => m.modelId === model || m.name === model)
      try {
        await client.request('session/set_model', { sessionId: acpSessionId, modelId: target?.modelId ?? model })
      } catch { /* model switching unavailable — keep the session default */ }
    }

    const mode = options.permissionMode ?? this.options.permissionMode
    if (mode && ACP_MODE_IDS[mode] && ACP_MODE_IDS[mode] !== initPayload?.modes?.currentModeId) {
      try {
        await client.request('session/set_mode', { sessionId: acpSessionId, modeId: ACP_MODE_IDS[mode] })
      } catch { /* mode switching unavailable */ }
    }

    // Send the prompt and wait for the turn to finish
    const response = await client.request('session/prompt', {
      sessionId: acpSessionId,
      prompt: [{ type: 'text', text: prompt }],
    }, { timeoutMs: options.timeoutMs })

    this.finalizeResult(id, response)
  }

  private finalizeResult(id: string, response: any): void {
    const session = this.state.current.sessions[id]
    if (!session || session.status !== 'running') return

    const stopReason = response?.stopReason
    const usage: HermesUsage | undefined = response?.usage
    const result = session.result ?? ''

    if (stopReason === 'cancelled') {
      this.updateSession(id, { status: 'error', stopReason, usage, error: 'Aborted by user' })
      this.removeActive(id)
      this.emit('session:abort', { sessionId: id })
      this.emit('session:error', { sessionId: id, error: 'Aborted by user' })
      return
    }

    const message: HermesMessageEvent = {
      type: 'message',
      role: 'assistant',
      content: [{ type: 'text', text: result }],
    }

    this.updateSession(id, {
      status: 'completed',
      stopReason,
      usage,
      turns: session.turns + 1,
      messages: [...session.messages, message],
    })
    this.removeActive(id)

    this.emit('session:message', { sessionId: id, message })
    this.emit('session:result', { sessionId: id, result, stopReason, usage })
  }

  private finalizeError(id: string, err: any): void {
    const session = this.state.current.sessions[id]
    if (!session || session.status !== 'running') return

    // A prompt that fails after abort() was requested IS the abort — the
    // adapter may answer the in-flight session/prompt with a generic error
    // instead of stopReason 'cancelled' when the cancel lands early.
    if ((session as any).aborting) {
      this.updateSession(id, { status: 'error', error: 'Aborted by user' })
      this.removeActive(id)
      this.emit('session:abort', { sessionId: id })
      this.emit('session:error', { sessionId: id, error: 'Aborted by user' })
      return
    }

    this.updateSession(id, { status: 'error', error: err instanceof Error ? err.message : String(err) })
    this.removeActive(id)
    this.emit('session:error', { sessionId: id, error: err })
  }

  private removeActive(id: string): void {
    this.setState({ activeSessions: this.state.current.activeSessions.filter((s) => s !== id) })
  }

  /**
   * Cancel a running session's turn via ACP session/cancel. The shared
   * adapter process stays alive (other runs may be using it). If the turn
   * doesn't settle within 10s of the cancel, the adapter is restarted.
   *
   * @param {string} sessionId - The local session ID to abort
   * @returns {void}
   */
  abort(sessionId: string): void {
    const session = this.state.current.sessions[sessionId]
    if (!session || session.status !== 'running') return

    if (session.acpSessionId && this.acpClient?.running) {
      this.updateSession(sessionId, { aborting: true } as any)
      this.acpClient.notify('session/cancel', { sessionId: session.acpSessionId })

      // Watchdog: if the prompt doesn't resolve after cancel, the adapter is wedged
      setTimeout(() => {
        const current = this.state.current.sessions[sessionId]
        if (current && current.status === 'running') {
          this.updateSession(sessionId, { status: 'error', error: 'Aborted by user' })
          this.removeActive(sessionId)
          this.emit('session:abort', { sessionId })
          this.emit('session:error', { sessionId, error: 'Aborted by user' })
          this.restartAdapter().catch(() => {})
        }
      }, 10_000).unref?.()
    } else {
      // Adapter never came up for this run — fail it locally
      this.updateSession(sessionId, { status: 'error', error: 'Aborted by user' })
      this.removeActive(sessionId)
      this.emit('session:abort', { sessionId })
      this.emit('session:error', { sessionId, error: 'Aborted by user' })
    }
  }

  /**
   * Retrieve the current state of a session by its ID.
   *
   * @param {string} sessionId - The session ID to look up
   * @returns {HermesSession | undefined} The session object, or undefined if not found
   */
  getSession(sessionId: string): HermesSession | undefined {
    return this.state.current.sessions[sessionId]
  }

  /**
   * Wait for a running session to complete or error. Resolves immediately
   * if the session is already in a terminal state.
   *
   * @param {string} sessionId - The session ID to wait for
   * @returns {Promise<HermesSession>} The completed or errored session
   * @throws {Error} If the session ID is not found
   */
  async waitForSession(sessionId: string): Promise<HermesSession> {
    const session = this.state.current.sessions[sessionId]
    if (!session) throw new Error(`Session ${sessionId} not found`)
    if (session.status === 'completed' || session.status === 'error') return session

    return new Promise((resolve) => {
      const handler = (data: { sessionId: string }) => {
        if (data.sessionId === sessionId) {
          this.off('session:result', handler)
          this.off('session:error', handler)
          resolve(this.state.current.sessions[sessionId]!)
        }
      }
      this.on('session:result', handler)
      this.on('session:error', handler)
    })
  }

  /**
   * Get aggregated token usage across all sessions, or for a specific session.
   * Hermes reports tokens only — there is no cost accounting.
   *
   * @param {string} [sessionId] - Optional session ID to get usage for a single session
   * @returns {{ totalInputTokens: number; totalOutputTokens: number; totalThoughtTokens: number; totalCachedReadTokens: number; totalTokens: number; totalTurns: number; sessionCount: number; sessions: Array<{ id: string; turns: number; inputTokens: number; outputTokens: number; status: string }> }} Usage statistics
   *
   * @example
   * ```typescript
   * const stats = hermes.usage()
   * console.log(`Tokens: ${stats.totalInputTokens} in / ${stats.totalOutputTokens} out`)
   * ```
   */
  usage(sessionId?: string) {
    const allSessions = this.state.current.sessions
    const entries = sessionId
      ? (allSessions[sessionId] ? [allSessions[sessionId]] : [])
      : Object.values(allSessions)

    let totalInputTokens = 0
    let totalOutputTokens = 0
    let totalThoughtTokens = 0
    let totalCachedReadTokens = 0
    let totalTokens = 0
    let totalTurns = 0
    const sessions: Array<{ id: string; turns: number; inputTokens: number; outputTokens: number; status: string }> = []

    for (const session of entries as HermesSession[]) {
      const u = session.usage || {}
      totalInputTokens += u.inputTokens || 0
      totalOutputTokens += u.outputTokens || 0
      totalThoughtTokens += u.thoughtTokens || 0
      totalCachedReadTokens += u.cachedReadTokens || 0
      totalTokens += u.totalTokens || 0
      totalTurns += session.turns || 0

      sessions.push({
        id: session.id,
        turns: session.turns || 0,
        inputTokens: u.inputTokens || 0,
        outputTokens: u.outputTokens || 0,
        status: session.status,
      })
    }

    return {
      totalInputTokens,
      totalOutputTokens,
      totalThoughtTokens,
      totalCachedReadTokens,
      totalTokens,
      totalTurns,
      sessionCount: sessions.length,
      sessions,
    }
  }

  /**
   * The hermes/ACP session ID of the most recent session, useful for
   * resuming with `resumeSessionId` later (including across processes —
   * hermes persists sessions in its SQLite store).
   *
   * @returns {string | undefined} The hermes session ID
   */
  get sessionId(): string | undefined {
    return this.lastAcpSessionId
  }

  // --- Session store readers (hermes SQLite store via the sessions CLI) ---

  /**
   * List recent sessions from the hermes SQLite session store.
   *
   * @param {{ source?: string; limit?: number; workspace?: string }} [options] - Filters passed to `hermes sessions list`
   * @returns {Promise<{ raw: string; lines: string[] }>} Raw CLI output plus non-empty lines
   *
   * @example
   * ```typescript
   * const { lines } = await hermes.listSessions({ limit: 10 })
   * lines.forEach((l) => console.log(l))
   * ```
   */
  async listSessions(options: { source?: string; limit?: number; workspace?: string } = {}): Promise<{ raw: string; lines: string[] }> {
    const proc = this.container.feature('proc')
    const args = ['sessions', 'list']
    if (options.source) args.push('--source', options.source)
    if (options.limit != null) args.push('--limit', String(options.limit))
    if (options.workspace) args.push('--workspace', options.workspace)

    const result = await proc.spawnAndCapture(this.hermesPath, args)
    if (result.exitCode !== 0) {
      throw new Error(`hermes sessions list failed: ${result.stderr || result.stdout}`)
    }
    const raw = result.stdout
    return { raw, lines: raw.split('\n').map((l: string) => l.trim()).filter(Boolean) }
  }

  /**
   * Read a session's full history from the hermes SQLite session store as
   * parsed JSONL records (via `hermes sessions export --format jsonl`).
   *
   * @param {string} sessionId - The hermes session ID (e.g. session.acpSessionId)
   * @returns {Promise<any[]>} Parsed JSONL records; malformed lines are skipped
   *
   * @example
   * ```typescript
   * const session = await hermes.run('Say hello')
   * const history = await hermes.getSessionHistory(session.acpSessionId)
   * ```
   */
  async getSessionHistory(sessionId: string): Promise<any[]> {
    const proc = this.container.feature('proc')
    const result = await proc.spawnAndCapture(this.hermesPath, ['sessions', 'export', '--format', 'jsonl', '--session-id', sessionId, '--yes', '-'])
    if (result.exitCode !== 0) {
      throw new Error(`hermes sessions export failed: ${result.stderr || result.stdout}`)
    }

    const records: any[] = []
    for (const line of result.stdout.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed) continue
      try {
        records.push(JSON.parse(trimmed))
      } catch {
        // skip non-JSON lines (progress output etc.)
      }
    }
    return records
  }

  /**
   * Enable the feature. Lazily registers the `hermesAcp` client class in the
   * clients registry (it is not registered at module load) and delegates to
   * the base Feature enable() lifecycle. Does NOT spawn the adapter — that
   * happens on the first run()/start().
   *
   * @param {object} [options] - Options to merge into the feature configuration
   * @returns {Promise<this>} This instance, for chaining
   */
  override async enable(options: any = {}): Promise<this> {
    HermesAgent.registerAcpClient()
    await super.enable(options)
    return this
  }
}

export default HermesAgent
