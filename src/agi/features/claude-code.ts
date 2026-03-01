// @ts-nocheck
import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'
import type { Container } from '@soederpop/luca/container'
import { type AvailableFeatures } from '@soederpop/luca/feature'
import { features, Feature } from '@soederpop/luca/feature'
import type { Subprocess } from 'bun'

declare module '@soederpop/luca/feature' {
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

// --- MCP server config types ---

export interface McpStdioServer {
  type: 'stdio'
  command: string
  args?: string[]
  env?: Record<string, string>
}

export interface McpHttpServer {
  type: 'http'
  url: string
  headers?: Record<string, string>
}

export interface McpSseServer {
  type: 'sse'
  url: string
  headers?: Record<string, string>
}

export type McpServerConfig = McpStdioServer | McpHttpServer | McpSseServer

// --- Feature state and options ---

export const ClaudeCodeStateSchema = FeatureStateSchema.extend({
  /** Map of session IDs to ClaudeSession objects */
  sessions: z.record(z.string(), z.any()).describe('Map of session IDs to ClaudeSession objects'),
  /** List of currently running session IDs */
  activeSessions: z.array(z.string()).describe('List of currently running session IDs'),
  /** Whether the Claude CLI binary is available */
  claudeAvailable: z.boolean().describe('Whether the Claude CLI binary is available'),
  /** Detected Claude CLI version string */
  claudeVersion: z.string().optional().describe('Detected Claude CLI version string'),
})

export const FileLogLevelSchema = z.enum(['verbose', 'normal', 'minimal']).describe(
  'Log verbosity: verbose=all events including stream deltas, normal=messages+tool calls+results, minimal=init+result/error only'
)

export type FileLogLevel = z.infer<typeof FileLogLevelSchema>

export const ClaudeCodeOptionsSchema = FeatureOptionsSchema.extend({
  /** Path to the claude CLI binary. Defaults to 'claude'. */
  claudePath: z.string().optional().describe('Path to the claude CLI binary'),
  /** Default model to use for sessions. */
  model: z.string().optional().describe('Default model to use for sessions'),
  /** Default working directory for sessions. */
  cwd: z.string().optional().describe('Default working directory for sessions'),
  /** Default system prompt prepended to all sessions. */
  systemPrompt: z.string().optional().describe('Default system prompt prepended to all sessions'),
  /** Default append system prompt for all sessions. */
  appendSystemPrompt: z.string().optional().describe('Default append system prompt for all sessions'),
  /** Default permission mode. */
  permissionMode: z.enum(['default', 'acceptEdits', 'bypassPermissions', 'plan', 'dontAsk']).optional().describe('Default permission mode for Claude CLI sessions'),
  /** Default allowed tools. */
  allowedTools: z.array(z.string()).optional().describe('Default allowed tools for sessions'),
  /** Default disallowed tools. */
  disallowedTools: z.array(z.string()).optional().describe('Default disallowed tools for sessions'),
  /** Whether to stream partial messages (token-by-token). Defaults to false. */
  streaming: z.boolean().optional().describe('Whether to stream partial messages token-by-token'),
  /** MCP config file paths to pass to sessions. */
  mcpConfig: z.array(z.string()).optional().describe('MCP config file paths to pass to sessions'),
  /** MCP servers to inject into sessions, keyed by server name. Automatically written to a temp config file. */
  mcpServers: z.record(z.string(), z.any()).optional().describe('MCP server configs keyed by name, injected into sessions via temp config file'),
  /** Path to write a parseable NDJSON session log file. Each line is a JSON object with timestamp, sessionId, event type, and event data. */
  fileLogPath: z.string().optional().describe('Path to write a parseable NDJSON session log file'),
  /** Verbosity level for file logging. Defaults to "normal". */
  fileLogLevel: FileLogLevelSchema.optional().describe('Verbosity level for file logging. Defaults to "normal"'),
  /** Default effort level for Claude reasoning. */
  effort: z.enum(['low', 'medium', 'high']).optional().describe('Default effort level for Claude reasoning'),
  /** Maximum cost budget in USD per session. */
  maxBudgetUsd: z.number().optional().describe('Maximum cost budget in USD per session'),
  /** Fallback model when the primary model is unavailable. */
  fallbackModel: z.string().optional().describe('Fallback model when the primary model is unavailable'),
  /** Default agent to use. */
  agent: z.string().optional().describe('Default agent to use'),
  /** Disable session persistence across runs. */
  noSessionPersistence: z.boolean().optional().describe('Disable session persistence across runs'),
  /** Default tools to make available. */
  tools: z.array(z.string()).optional().describe('Default tools to make available'),
  /** Require strict MCP config validation. */
  strictMcpConfig: z.boolean().optional().describe('Require strict MCP config validation'),
  /** Path to a custom settings file. */
  settingsFile: z.string().optional().describe('Path to a custom settings file'),
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
  permissionMode?: 'default' | 'acceptEdits' | 'bypassPermissions' | 'plan' | 'dontAsk'
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
  /** MCP config file paths. */
  mcpConfig?: string[]
  /** MCP servers to inject, keyed by server name. */
  mcpServers?: Record<string, McpServerConfig>
  /** Skip all permission checks (only for sandboxed environments). */
  dangerouslySkipPermissions?: boolean
  /** Additional arbitrary CLI flags. */
  extraArgs?: string[]
  /** Path to write a parseable NDJSON session log file. Overrides feature-level fileLogPath. */
  fileLogPath?: string
  /** Verbosity level for file logging. Overrides feature-level fileLogLevel. */
  fileLogLevel?: FileLogLevel
  /** Effort level for Claude reasoning. */
  effort?: 'low' | 'medium' | 'high'
  /** Maximum cost budget in USD. */
  maxBudgetUsd?: number
  /** Fallback model when the primary is unavailable. */
  fallbackModel?: string
  /** JSON schema for structured output validation. */
  jsonSchema?: string | object
  /** Agent to use for this session. */
  agent?: string
  /** Resume or fork a specific Claude session by ID. */
  sessionId?: string
  /** Disable session persistence for this run. */
  noSessionPersistence?: boolean
  /** Fork from an existing session instead of resuming. */
  forkSession?: boolean
  /** Tools to make available. */
  tools?: string[]
  /** Require strict MCP config validation. */
  strictMcpConfig?: boolean
  /** Enable debug output. Pass a string for specific debug channels, or true for all. */
  debug?: string | boolean
  /** Path to write debug output to a file. */
  debugFile?: string
  /** Path to a custom settings file. */
  settingsFile?: string
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
  static override envVars = ['TMPDIR']

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
   * Parsed semver components from the detected CLI version, or undefined if not yet checked.
   *
   * @returns {{ major: number; minor: number; patch: number } | undefined} Parsed version
   */
  get parsedVersion(): { major: number; minor: number; patch: number } | undefined {
    const ver = this.state.current.claudeVersion
    if (!ver) return undefined
    const match = ver.match(/^(\d+)\.(\d+)\.(\d+)/)
    if (!match) return undefined
    return { major: parseInt(match[1], 10), minor: parseInt(match[2], 10), patch: parseInt(match[3], 10) }
  }

  /**
   * Assert that the detected CLI version meets a minimum major.minor requirement.
   * Throws if the CLI version is below the specified minimum.
   *
   * @param {number} major - Minimum major version
   * @param {number} minor - Minimum minor version
   */
  assertMinVersion(major: number, minor: number): void {
    const v = this.parsedVersion
    if (!v) throw new Error('Claude CLI version not detected. Call checkAvailability() first.')
    if (v.major < major || (v.major === major && v.minor < minor)) {
      throw new Error(`Claude CLI ${this.state.current.claudeVersion} is below minimum ${major}.${minor}`)
    }
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

        const v = this.parsedVersion
        if (v && (v.major < 2 || (v.major === 2 && v.minor < 1))) {
          this.emit('session:warning', {
            message: `Claude CLI ${version} is below minimum 2.1. Some features may not work.`
          })
        }

        return true
      }

      this.setState({ claudeAvailable: false })
      return false
    } catch {
      this.setState({ claudeAvailable: false })
      return false
    }
  }

  /** Tracks temp MCP config files created for cleanup */
  private mcpTempFiles: string[] = []

  /** Tracks active file log paths per session */
  private sessionLogPaths: Map<string, { path: string; level: FileLogLevel }> = new Map()

  /**
   * Resolve the file log path for a session, checking per-session options then feature-level defaults.
   *
   * @param {RunOptions} options - Per-session options
   * @returns {{ path: string; level: FileLogLevel } | undefined} Log config if logging is enabled
   */
  private resolveFileLog(options: RunOptions = {}): { path: string; level: FileLogLevel } | undefined {
    const path = options.fileLogPath ?? this.options.fileLogPath
    if (!path) return undefined
    const level = options.fileLogLevel ?? this.options.fileLogLevel ?? 'normal'
    return { path, level }
  }

  /**
   * Write a log entry to the session's NDJSON log file.
   * Each line is a self-contained JSON object with timestamp, sessionId, event type, and data.
   *
   * @param {string} sessionId - The local session ID
   * @param {string} type - Event type label (e.g. 'session:init', 'session:message')
   * @param {any} data - Event payload
   */
  private async writeLogEntry(sessionId: string, type: string, data: any): Promise<void> {
    const logConfig = this.sessionLogPaths.get(sessionId)
    if (!logConfig) return

    const entry = JSON.stringify({
      ts: new Date().toISOString(),
      session: sessionId,
      type,
      data
    }) + '\n'

    const { appendFile } = await import('node:fs/promises')
    try {
      await appendFile(logConfig.path, entry, 'utf-8')
    } catch (err) {
      this.emit('session:log-error', { sessionId, error: err })
    }
  }

  /**
   * Determine if an event should be logged based on the configured log level.
   *
   * - verbose: all events (stream deltas, partial messages, everything)
   * - normal: assistant messages, tool results, init, result, errors (no stream_event)
   * - minimal: init and result/error only
   *
   * @param {string} eventType - The Claude event type
   * @param {FileLogLevel} level - The configured log level
   * @returns {boolean} Whether to log this event
   */
  private shouldLog(eventType: string, level: FileLogLevel): boolean {
    switch (level) {
      case 'verbose':
        return true
      case 'normal':
        return eventType !== 'stream_event'
      case 'minimal':
        return eventType === 'system' || eventType === 'result'
      default:
        return true
    }
  }

  /**
   * Write an MCP server config map to a temp file suitable for `--mcp-config`.
   *
   * @param {Record<string, McpServerConfig>} servers - Server configs keyed by name
   * @returns {Promise<string>} Path to the generated temp config file
   *
   * @example
   * ```typescript
   * const configPath = await cc.writeMcpConfig({
   *   'my-api': { type: 'http', url: 'https://api.example.com/mcp' },
   *   'local-tool': { type: 'stdio', command: 'bun', args: ['run', 'server.ts'] }
   * })
   * ```
   */
  async writeMcpConfig(servers: Record<string, McpServerConfig>): Promise<string> {
    const config = { mcpServers: servers }
    const tmpDir = process.env.TMPDIR || '/tmp'
    const tmpPath = `${tmpDir}/luca-mcp-${crypto.randomUUID()}.json`
    await Bun.write(tmpPath, JSON.stringify(config, null, 2))
    this.mcpTempFiles.push(tmpPath)
    return tmpPath
  }

  /**
   * Build the argument array for a claude CLI invocation.
   *
   * @param {string} prompt - The prompt text
   * @param {RunOptions} options - Session options
   * @returns {Promise<string[]>} CLI arguments
   */
  private async buildArgs(prompt: string, options: RunOptions = {}): Promise<string[]> {
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

    // Collect all --mcp-config paths
    const configPaths: string[] = []

    const mcpConfig = options.mcpConfig ?? this.options.mcpConfig
    if (mcpConfig?.length) configPaths.push(...mcpConfig)

    // Merge mcpServers from feature-level defaults and per-session overrides
    const defaultServers = this.options.mcpServers as Record<string, McpServerConfig> | undefined
    const sessionServers = options.mcpServers
    const mergedServers = { ...defaultServers, ...sessionServers }

    if (Object.keys(mergedServers).length > 0) {
      const tmpPath = await this.writeMcpConfig(mergedServers)
      configPaths.push(tmpPath)
    }

    if (configPaths.length) args.push('--mcp-config', ...configPaths)

    if (options.resumeSessionId) args.push('--resume', options.resumeSessionId)
    if (options.continue) args.push('--continue')
    if (options.dangerouslySkipPermissions) args.push('--dangerously-skip-permissions')

    if (options.addDirs?.length) {
      args.push('--add-dir', ...options.addDirs)
    }

    // --- New v2.1 flags ---
    const effort = options.effort ?? this.options.effort
    if (effort) args.push('--effort', effort)

    const maxBudgetUsd = options.maxBudgetUsd ?? this.options.maxBudgetUsd
    if (maxBudgetUsd != null) args.push('--max-budget-usd', String(maxBudgetUsd))

    const fallbackModel = options.fallbackModel ?? this.options.fallbackModel
    if (fallbackModel) args.push('--fallback-model', fallbackModel)

    const agent = options.agent ?? this.options.agent
    if (agent) args.push('--agent', agent)

    const noSessionPersistence = options.noSessionPersistence ?? this.options.noSessionPersistence
    if (noSessionPersistence) args.push('--no-session-persistence')

    const tools = options.tools ?? this.options.tools
    if (tools?.length) args.push('--tools', ...tools)

    const strictMcpConfig = options.strictMcpConfig ?? this.options.strictMcpConfig
    if (strictMcpConfig) args.push('--strict-mcp-config')

    const settingsFile = options.settingsFile ?? this.options.settingsFile
    if (settingsFile) args.push('--settings', settingsFile)

    // Per-session only flags
    if (options.jsonSchema) {
      const schemaStr = typeof options.jsonSchema === 'string' ? options.jsonSchema : JSON.stringify(options.jsonSchema)
      args.push('--json-schema', schemaStr)
    }

    if (options.sessionId) args.push('--session-id', options.sessionId)
    if (options.forkSession) args.push('--fork-session')

    if (options.debug != null) {
      if (typeof options.debug === 'string') {
        args.push('--debug', options.debug)
      } else if (options.debug) {
        args.push('--debug')
      }
    }

    if (options.debugFile) args.push('--debug-file', options.debugFile)

    if (options.extraArgs?.length) {
      args.push(...options.extraArgs)
    }

    // Prompt is piped via stdin rather than passed as a positional arg,
    // to avoid content like '---' being parsed as CLI flags.
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

    // File logging
    const logConfig = this.sessionLogPaths.get(sessionId)
    if (logConfig && this.shouldLog(event.type, logConfig.level)) {
      this.writeLogEntry(sessionId, event.type, event)
    }

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
   * // With injected MCP servers
   * const session = await cc.run('Use the database tools to list tables', {
   *   mcpServers: {
   *     'db-tools': { type: 'stdio', command: 'bun', args: ['run', 'db-mcp.ts'] },
   *     'api': { type: 'http', url: 'https://api.example.com/mcp' }
   *   }
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
    const args = await this.buildArgs(prompt, options)
    const cwd = options.cwd ?? this.options.cwd ?? (this.container as any).cwd

    // Set up file logging for this session
    const fileLog = this.resolveFileLog(options)
    if (fileLog) {
      this.sessionLogPaths.set(id, fileLog)
      this.writeLogEntry(id, 'session:start', { prompt, cwd, args: [this.claudePath, ...args] })
    }

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
      stdin: Buffer.from(prompt),
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

    // Finalize file log
    if (this.sessionLogPaths.has(id)) {
      const finalSession = this.state.current.sessions[id]!
      await this.writeLogEntry(id, 'session:end', {
        status: finalSession.status,
        result: finalSession.result,
        error: finalSession.error,
        costUsd: finalSession.costUsd,
        turns: finalSession.turns,
        messageCount: finalSession.messages.length
      })
      this.sessionLogPaths.delete(id)
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
  async start(prompt: string, options: RunOptions = {}): Promise<string> {
    const id = this.createSessionId()
    const args = await this.buildArgs(prompt, options)
    const cwd = options.cwd ?? this.options.cwd ?? (this.container as any).cwd

    // Set up file logging for this session
    const fileLog = this.resolveFileLog(options)
    if (fileLog) {
      this.sessionLogPaths.set(id, fileLog)
      this.writeLogEntry(id, 'session:start', { prompt, cwd, args: [this.claudePath, ...args] })
    }

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
      stdin: Buffer.from(prompt),
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

    // Finalize file log
    if (this.sessionLogPaths.has(sessionId)) {
      const finalSession = this.state.current.sessions[sessionId]!
      await this.writeLogEntry(sessionId, 'session:end', {
        status: finalSession.status,
        result: finalSession.result,
        error: finalSession.error,
        costUsd: finalSession.costUsd,
        turns: finalSession.turns,
        messageCount: finalSession.messages.length
      })
      this.sessionLogPaths.delete(sessionId)
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

      if (this.sessionLogPaths.has(sessionId)) {
        this.writeLogEntry(sessionId, 'session:abort', { reason: 'Aborted by user' })
        this.sessionLogPaths.delete(sessionId)
      }
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
   * Clean up any temp MCP config files created during sessions.
   */
  async cleanupMcpTempFiles(): Promise<void> {
    const { unlink } = await import('node:fs/promises')
    for (const path of this.mcpTempFiles) {
      try { await unlink(path) } catch { /* already gone */ }
    }
    this.mcpTempFiles = []
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
