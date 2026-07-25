import { Client, type ClientOptions, type ClientState } from '../client.js'
import type { HelperStability, HelperCategory } from '../introspection/index.js'
import type { ContainerContext } from '../container.js'
import { ClientStateSchema, ClientOptionsSchema, ClientEventsSchema } from '../schemas/base.js'
import { z } from 'zod'

declare module '../client' {
  interface AvailableClients {
    hermesAcp: typeof HermesAcpClient
  }
}

export const HermesAcpClientStateSchema = ClientStateSchema.extend({
  agentInfo: z.any().optional().describe('agentInfo returned by the ACP initialize handshake (name, version)'),
  capabilities: z.any().optional().describe('agentCapabilities returned by the ACP initialize handshake'),
}).describe('Hermes ACP client state')

export const HermesAcpClientOptionsSchema = ClientOptionsSchema.extend({
  hermesPath: z.string().optional().describe('Path to the hermes CLI binary (defaults to hermes on the PATH)'),
  bootTimeoutMs: z.number().optional().describe('Timeout in ms for adapter spawn + initialize handshake (default 60000; the adapter loads MCP servers and can take ~15s)'),
  environment: z.record(z.string(), z.string()).optional().describe('Extra environment variables for the hermes acp adapter process (e.g. HERMES_INFERENCE_MODEL, HERMES_YOLO_MODE)'),
  clientName: z.string().optional().describe('Client name reported in the ACP initialize handshake (default: luca)'),
}).describe('Hermes ACP client options')

export const HermesAcpClientEventsSchema = ClientEventsSchema.extend({
  notification: z.tuple([z.object({ method: z.string(), params: z.any() })]).describe('Emitted for every JSON-RPC notification from the adapter (e.g. session/update)'),
  crash: z.tuple([z.object({ error: z.any(), exitCode: z.number().optional() })]).describe('Emitted when the adapter process exits unexpectedly'),
  'parse-error': z.tuple([z.object({ line: z.string() })]).describe('Emitted when a stdout line from the adapter cannot be parsed as JSON'),
}).describe('Hermes ACP client events')

export type HermesAcpClientState = z.infer<typeof HermesAcpClientStateSchema>
export type HermesAcpClientOptions = z.infer<typeof HermesAcpClientOptionsSchema>

interface PendingRequest {
  resolve: (value: any) => void
  reject: (error: Error) => void
  timer?: ReturnType<typeof setTimeout>
}

/** Result of the ACP initialize handshake. */
export interface HermesAcpInitializeResult {
  protocolVersion: number
  agentInfo?: { name: string; version: string }
  agentCapabilities?: any
  authMethods?: any[]
}

/**
 * JSON-RPC 2.0 client for the Hermes Agent Client Protocol (ACP) adapter.
 * Spawns `hermes acp` as a long-lived subprocess and speaks newline-delimited
 * JSON-RPC over its stdio: outgoing requests/notifications on stdin, incoming
 * responses, notifications (session/update), and server-initiated requests
 * (session/request_permission) on stdout.
 *
 * This client is NOT registered at module load. The `hermesAgent` feature
 * registers it lazily when the feature is enabled, so it only appears in the
 * clients registry when Hermes control is actually in use.
 *
 * Server-initiated requests (like permission prompts) require a response —
 * install a handler with `setRequestHandler()`. Without one, such requests
 * are answered with a JSON-RPC "method not found" error.
 *
 * @example
 * ```typescript
 * // Registered lazily by the hermesAgent feature:
 * container.feature('hermesAgent')
 * const acp = container.client('hermesAcp', { environment: { HERMES_YOLO_MODE: '1' } })
 * acp.on('notification', ({ method, params }) => console.log(method, params))
 * await acp.connect()
 * const session = await acp.request('session/new', { cwd: process.cwd(), mcpServers: [] })
 * const result = await acp.request('session/prompt', {
 *   sessionId: session.sessionId,
 *   prompt: [{ type: 'text', text: 'Say hello' }],
 * })
 * await acp.disconnect()
 * ```
 */
export class HermesAcpClient extends Client<HermesAcpClientState, HermesAcpClientOptions> {
  static override shortcut: string = 'clients.hermesAcp'
  static override stability: HelperStability = 'experimental'
  static override category: HelperCategory = 'agent-wrappers'
  static override stateSchema = HermesAcpClientStateSchema
  static override optionsSchema = HermesAcpClientOptionsSchema
  static override eventsSchema = HermesAcpClientEventsSchema
  // NOTE: no static register block — the hermesAgent feature registers this
  // class lazily via Client.register(HermesAcpClient, 'hermesAcp') on enable.

  private proc: any = null
  private nextId = 1
  private pending = new Map<number, PendingRequest>()
  private buffer = ''
  private stderrTail = ''
  private requestHandler: ((method: string, params: any) => Promise<any>) | null = null
  private _initializeResult: HermesAcpInitializeResult | undefined

  constructor(options: HermesAcpClientOptions, context: ContainerContext) {
    super(options, context)
  }

  /** The result of the ACP initialize handshake, once connected. */
  get initializeResult(): HermesAcpInitializeResult | undefined {
    return this._initializeResult
  }

  /** Whether the adapter process is alive and the handshake completed. */
  get running(): boolean {
    return !!this.proc && this.isConnected
  }

  /**
   * Install the handler for server-initiated JSON-RPC requests
   * (e.g. session/request_permission). The handler's resolved value is sent
   * back as the JSON-RPC result; a thrown error becomes a JSON-RPC error.
   *
   * @param fn - Handler receiving (method, params), returning the response payload
   */
  setRequestHandler(fn: (method: string, params: any) => Promise<any>): void {
    this.requestHandler = fn
  }

  /**
   * Spawn the `hermes acp` adapter and perform the ACP initialize handshake.
   * Resolves once the adapter reports its capabilities. On timeout the
   * process is killed and the error includes the adapter's recent stderr.
   *
   * @returns This client, connected
   */
  override async connect(): Promise<this> {
    if (this.running) return this

    const proc = (this.container as any).feature('proc')
    const hermesPath = this.options.hermesPath || 'hermes'
    const timeoutMs = this.options.bootTimeoutMs ?? 60_000

    this.proc = proc.spawn(hermesPath, ['acp'], {
      stdout: 'pipe',
      stderr: 'pipe',
      environment: { ...(this.options.environment ?? {}) },
    })

    this.proc.stdout?.on('data', (chunk: Buffer | string) => this.consume(chunk))
    this.proc.stderr?.on('data', (chunk: Buffer | string) => {
      this.stderrTail = (this.stderrTail + (Buffer.isBuffer(chunk) ? chunk.toString() : String(chunk))).slice(-8192)
    })

    this.proc.once('close', (code: number | null) => this.handleExit(code ?? undefined))
    this.proc.once('error', (err: Error) => this.handleExit(undefined, err))

    try {
      const result = await this.request<HermesAcpInitializeResult>('initialize', {
        protocolVersion: 1,
        clientCapabilities: { fs: { readTextFile: false, writeTextFile: false } },
        clientInfo: { name: this.options.clientName || 'luca', version: '1.0.0' },
      }, { timeoutMs })

      this._initializeResult = result
      this.state.set('connected', true)
      this.state.set('agentInfo', result?.agentInfo)
      this.state.set('capabilities', result?.agentCapabilities)
      return this
    } catch (err) {
      await this.disconnect()
      const detail = this.stderrTail ? `\nAdapter stderr:\n${this.stderrTail}` : ''
      throw new Error(`hermes acp adapter failed to initialize: ${err instanceof Error ? err.message : String(err)}${detail}`)
    }
  }

  /**
   * Send a JSON-RPC request to the adapter and await its response.
   *
   * @param method - JSON-RPC method (e.g. 'session/new', 'session/prompt')
   * @param params - Method parameters
   * @param opts - Optional timeout in ms (no timeout when omitted — agent turns can run long)
   * @returns The JSON-RPC result payload
   */
  request<T = any>(method: string, params?: any, opts: { timeoutMs?: number } = {}): Promise<T> {
    if (!this.proc?.stdin) {
      return Promise.reject(new Error('hermes acp adapter is not running'))
    }

    const id = this.nextId++
    return new Promise<T>((resolve, reject) => {
      const entry: PendingRequest = { resolve, reject }
      if (opts.timeoutMs) {
        entry.timer = setTimeout(() => {
          this.pending.delete(id)
          reject(new Error(`hermes acp request '${method}' timed out after ${opts.timeoutMs}ms`))
        }, opts.timeoutMs)
      }
      this.pending.set(id, entry)
      this.write({ jsonrpc: '2.0', id, method, params })
    })
  }

  /**
   * Send a JSON-RPC notification (no response expected, e.g. session/cancel).
   *
   * @param method - JSON-RPC method
   * @param params - Method parameters
   */
  notify(method: string, params?: any): void {
    if (!this.proc?.stdin) return
    this.write({ jsonrpc: '2.0', method, params })
  }

  /**
   * Kill the adapter process and reject all in-flight requests.
   */
  async disconnect(): Promise<void> {
    const proc = this.proc
    this.proc = null
    this.state.set('connected', false)
    this.rejectAllPending(new Error('hermes acp adapter disconnected'))
    if (proc) {
      try { proc.kill() } catch { /* already dead */ }
    }
  }

  private write(message: Record<string, any>): void {
    try {
      this.proc?.stdin?.write(JSON.stringify(message) + '\n')
    } catch {
      // stdin already closed — the close handler cleans up pending requests
    }
  }

  private consume(chunk: Buffer | string): void {
    this.buffer += Buffer.isBuffer(chunk) ? chunk.toString() : String(chunk)
    const lines = this.buffer.split('\n')
    this.buffer = lines.pop() || ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue

      let message: any
      try {
        message = JSON.parse(trimmed)
      } catch {
        this.emit('parse-error', { line: trimmed })
        continue
      }

      this.dispatch(message)
    }
  }

  private dispatch(message: any): void {
    if (message.id != null && message.method) {
      // Server-initiated request — must be answered
      this.answerServerRequest(message)
    } else if (message.method) {
      // Notification (e.g. session/update)
      this.emit('notification', { method: message.method, params: message.params })
    } else if (message.id != null) {
      // Response to one of our requests
      const entry = this.pending.get(message.id)
      if (!entry) return
      this.pending.delete(message.id)
      if (entry.timer) clearTimeout(entry.timer)
      if (message.error) {
        entry.reject(new Error(message.error.message || JSON.stringify(message.error)))
      } else {
        entry.resolve(message.result)
      }
    }
  }

  private async answerServerRequest(message: any): Promise<void> {
    if (!this.requestHandler) {
      this.write({ jsonrpc: '2.0', id: message.id, error: { code: -32601, message: `No handler for server request '${message.method}'` } })
      return
    }
    try {
      const result = await this.requestHandler(message.method, message.params)
      this.write({ jsonrpc: '2.0', id: message.id, result: result ?? null })
    } catch (err) {
      this.write({ jsonrpc: '2.0', id: message.id, error: { code: -32603, message: err instanceof Error ? err.message : String(err) } })
    }
  }

  private handleExit(exitCode?: number, error?: Error): void {
    if (!this.proc) return // already disconnected deliberately
    const wasConnected = this.isConnected
    this.proc = null
    this.state.set('connected', false)
    const err = error ?? new Error(`hermes acp adapter exited${exitCode != null ? ` with code ${exitCode}` : ''}${this.stderrTail ? `\nAdapter stderr:\n${this.stderrTail}` : ''}`)
    this.rejectAllPending(err)
    if (wasConnected) {
      this.emit('crash', { error: err, exitCode })
    }
  }

  private rejectAllPending(error: Error): void {
    for (const [, entry] of this.pending) {
      if (entry.timer) clearTimeout(entry.timer)
      entry.reject(error)
    }
    this.pending.clear()
  }
}

export default HermesAcpClient
