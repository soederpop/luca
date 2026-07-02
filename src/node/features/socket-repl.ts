import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from '../../schemas/base.js'
import { Feature } from "../feature.js";
import vm from 'vm'
import { inspect } from 'util'

export const SocketReplStateSchema = FeatureStateSchema.extend({
  started: z.boolean().optional().describe('Whether the socket REPL server is running'),
  port: z.number().optional().describe('The port the WebSocket server is listening on'),
  activeClients: z.number().default(0).describe('Number of connected REPL clients'),
})
export type SocketReplState = z.infer<typeof SocketReplStateSchema>

export const SocketReplOptionsSchema = FeatureOptionsSchema.extend({
  port: z.number().optional().describe('Port for the WebSocket server (default: 8282)'),
  prompt: z.string().optional().describe('The prompt string sent to clients (default: "> ")'),
  historyPath: z.string().optional().describe('Path to the REPL history file for command persistence'),
})
export type SocketReplOptions = z.infer<typeof SocketReplOptionsSchema>

export const SocketReplEventsSchema = FeatureEventsSchema.extend({
  'client:connected': z.tuple([z.string().describe('Client ID')]).describe('A REPL client connected'),
  'client:disconnected': z.tuple([z.string().describe('Client ID')]).describe('A REPL client disconnected'),
  'eval': z.tuple([z.string().describe('The input expression'), z.string().describe('Client ID')]).describe('An expression was evaluated'),
  'eval:result': z.tuple([z.any().describe('The result'), z.string().describe('Client ID')]).describe('An expression produced a result'),
  'eval:error': z.tuple([z.string().describe('Error message'), z.string().describe('Client ID')]).describe('An expression threw an error'),
})

/**
 * Socket REPL — a WebSocket-powered interactive read-eval-print loop.
 *
 * Exposes a REPL session over WebSocket so remote clients (browser, other process,
 * terminal UI) can evaluate expressions in a sandboxed VM context populated with
 * the container and its helpers. Each connected client gets its own session tracking
 * but shares the same VM context. Supports tab completion and async/await.
 *
 * Messages use JSON framing:
 * - Client → Server: `{ type: "eval", input: "expression" }`
 * - Client → Server: `{ type: "complete", partial: "container.fea" }`
 * - Server → Client: `{ type: "prompt", prompt: "> " }`
 * - Server → Client: `{ type: "result", value: "..." }`
 * - Server → Client: `{ type: "error", message: "..." }`
 * - Server → Client: `{ type: "completions", items: ["feature", "features"], partial: "fea" }`
 *
 * @example
 * ```typescript
 * const socketRepl = container.feature('socketRepl', { enable: true })
 * await socketRepl.start({ port: 8282, context: { myVar: 42 } })
 * ```
 */
export class SocketRepl<
  T extends SocketReplState = SocketReplState,
  K extends SocketReplOptions = SocketReplOptions
> extends Feature<T, K> {
  static override shortcut = "features.socketRepl" as const
  static override stability = 'stable' as const
  static override stateSchema = SocketReplStateSchema
  static override optionsSchema = SocketReplOptionsSchema
  static override eventsSchema = SocketReplEventsSchema
  static { Feature.register(this, 'socketRepl') }

  _vmContext?: vm.Context
  _wsServer?: any
  _history: string[] = []
  _historyPath?: string
  _clientIds = new WeakMap<any, string>()

  /** The VM context object used for evaluating expressions. */
  get vmContext() {
    return this._vmContext
  }

  /** Whether the REPL server is currently running. */
  get isStarted() {
    return !!this.state.get('started')
  }

  /**
   * Start the socket REPL server.
   *
   * Creates a VM context populated with the container and its helpers,
   * starts a WebSocket server, and begins accepting REPL connections.
   *
   * @param options - Configuration for the REPL session
   * @param options.port - Port to listen on (default: 8282)
   * @param options.context - Additional variables to inject into the VM context
   * @param options.historyPath - Custom path for the history file
   * @returns The SocketRepl instance
   *
   * @example
   * ```typescript
   * const socketRepl = container.feature('socketRepl', { enable: true })
   * await socketRepl.start({
   *   port: 8282,
   *   context: { db: myDatabase },
   * })
   * ```
   */
  async start(options: { port?: number, context?: any, historyPath?: string } = {}) {
    if (this.isStarted) {
      // Merge any new context into the existing VM context
      if (options.context) {
        for (const [k, v] of Object.entries(options.context)) {
          this._vmContext![k] = v
        }
      }
      return this
    }

    const port = options.port || this.options.port || 8282

    // Set up history file
    const userHistoryPath = options.historyPath || this.options.historyPath
    if (typeof userHistoryPath === 'string') {
      this._historyPath = this.container.paths.resolve(userHistoryPath)
    } else {
      const cwdHash = this.container.utils.hashObject(this.container.cwd)
      this._historyPath = this.container.paths.resolve(
        this.container.feature('os').cacheDir,
        `socket-repl-${cwdHash}.history`
      )
    }

    this.container.fs.ensureFolder(this.container.paths.dirname(this._historyPath))

    // Load existing history
    try {
      const content = this.container.fs.readFile(this._historyPath, 'utf-8') as string
      this._history = content.split(/\r?\n/).filter(Boolean)
    } catch {}

    // Build VM context
    this._vmContext = vm.createContext({
      ...this.container.context,
      ...options.context,
      setTimeout, setInterval, process, clearInterval, clearTimeout, Buffer, URL, URLSearchParams,
      // @ts-ignore
      client: (...args: any[]) => this.container.client(...args),
    })

    // Start websocket server
    const ws = this.container.server('websocket', { json: true })
    this._wsServer = ws

    ws.on('connection', (client: any) => {
      const clientId = this.container.utils.uuid()
      this._clientIds.set(client, clientId)
      this.state.set('activeClients', (this.state.get('activeClients') || 0) + 1)
      this.emit('client:connected', clientId)

      // Send initial prompt and history
      ws.send(client, {
        type: 'prompt',
        prompt: this.options.prompt || '> ',
        history: this._history.slice(-100),
      })

      client.on('close', () => {
        const id = this._clientIds.get(client) || 'unknown'
        const count = this.state.get('activeClients') || 1
        this.state.set('activeClients', Math.max(0, count - 1))
        this.emit('client:disconnected', id)
      })
    })

    ws.on('message', async (data: any, client: any) => {
      const clientId = this._clientIds.get(client) || 'unknown'

      if (data.type === 'eval') {
        await this._handleEval(data.input, client, clientId)
      } else if (data.type === 'complete') {
        this._handleComplete(data.partial, client)
      }
    })

    await ws.start({ port })

    this.state.set('started', true)
    this.state.set('port', port)

    return this
  }

  /**
   * Stop the socket REPL server and disconnect all clients.
   */
  async stop() {
    if (!this.isStarted || !this._wsServer) return this

    await this._wsServer.stop()
    this._wsServer = undefined
    this.state.set('started', false)
    this.state.set('activeClients', 0)

    return this
  }

  /** Evaluate an expression and send the result back to the client. */
  private async _handleEval(input: string, ws: any, clientId: string) {
    const trimmed = (input || '').trim()
    if (!trimmed) {
      this._sendPrompt(ws)
      return
    }

    this._saveHistory(trimmed)
    this.emit('eval', trimmed, clientId)
    const ctx = this._vmContext!

    try {
      // Wrap top-level await in an async IIFE so vm.Script can handle it
      const code = /\bawait\b/.test(trimmed)
        ? `(async () => { return (${trimmed}); })()`
        : trimmed
      const script = new vm.Script(code)
      let result = script.runInContext(ctx)

      if (result && typeof result.then === 'function') {
        result = await result
      }

      ctx._ = result

      const display = this._formatResult(result)
      this.emit('eval:result', result, clientId)

      this._wsServer.send(ws, {
        type: 'result',
        value: display,
      })
    } catch (err: any) {
      this.emit('eval:error', err.message, clientId)
      this._wsServer.send(ws, {
        type: 'error',
        message: err.message,
      })
    }

    this._sendPrompt(ws)
  }

  /** Handle tab completion requests. */
  private _handleComplete(partial: string, ws: any) {
    const ctx = this._vmContext!
    if (!ctx) return

    // Dot-notation completion: e.g. container.fea
    const dotMatch = partial.match(/([a-zA-Z_$][\w$]*(?:\.[a-zA-Z_$][\w$]*)*)\.([a-zA-Z_$][\w$]*)?$/)
    if (dotMatch) {
      const objPath = dotMatch[1]!
      const fragment = dotMatch[2] || ''
      try {
        const obj = new vm.Script(objPath).runInContext(ctx)
        if (obj != null && typeof obj === 'object') {
          const all: string[] = Object.keys(obj)
          let proto = Object.getPrototypeOf(obj)
          while (proto && proto !== Object.prototype) {
            all.push(...Object.getOwnPropertyNames(proto))
            proto = Object.getPrototypeOf(proto)
          }
          const items = [...new Set(all)]
            .filter(p => p.startsWith(fragment) && p !== 'constructor')
            .sort()
          this._wsServer.send(ws, { type: 'completions', items, partial: fragment, prefix: objPath + '.' })
          return
        }
      } catch {}
    }

    // Top-level identifiers
    const idMatch = partial.match(/([a-zA-Z_$][\w$]*)$/)
    const fragment = idMatch ? idMatch[1]! : ''
    const items = Object.keys(ctx).filter(k => k.startsWith(fragment)).sort()
    this._wsServer.send(ws, { type: 'completions', items, partial: fragment, prefix: '' })
  }

  /** Format a result value to a string suitable for sending over the wire. */
  private _formatResult(value: any): string {
    if (value === undefined) return 'undefined'
    if (value === null) return 'null'
    if (typeof value !== 'object') return String(value)

    const hasCustomInspect = typeof value[Symbol.for('nodejs.util.inspect.custom')] === 'function'
    const ctorName = value.constructor?.name
    const BUILTIN_TYPES = new Set(['Object', 'Array', 'Map', 'Set', 'Date', 'RegExp', 'Promise', 'Error', 'Number', 'String', 'Boolean'])
    const isClassInstance = ctorName && !BUILTIN_TYPES.has(ctorName)

    if (hasCustomInspect || !isClassInstance) {
      return inspect(value, { colors: false, depth: 4 })
    }

    // Class instances: show clean data
    const data: Record<string, any> = {}
    for (const [k, v] of Object.entries(value)) {
      if (k.startsWith('_') || typeof v === 'function') continue
      data[k] = v
    }
    const body = inspect(data, { colors: false, depth: 3 })

    const methods: string[] = []
    const getters: string[] = []
    for (const [k, v] of Object.entries(value)) {
      if (k.startsWith('_')) continue
      if (typeof v === 'function') methods.push(k)
    }
    let proto = Object.getPrototypeOf(value)
    while (proto && proto !== Object.prototype) {
      for (const k of Object.getOwnPropertyNames(proto)) {
        if (k === 'constructor' || k.startsWith('_')) continue
        const desc = Object.getOwnPropertyDescriptor(proto, k)
        if (!desc) continue
        if (desc.get && !getters.includes(k)) getters.push(k)
        else if (typeof desc.value === 'function' && !methods.includes(k)) methods.push(k)
      }
      proto = Object.getPrototypeOf(proto)
    }

    const parts = [`${ctorName} ${body}`]
    if (getters.length) parts.push(`  getters: ${getters.sort().join(', ')}`)
    if (methods.length) parts.push(`  methods: ${methods.sort().map(m => m + '()').join(', ')}`)
    return parts.join('\n')
  }

  private _sendPrompt(ws: any) {
    this._wsServer?.send(ws, { type: 'prompt', prompt: this.options.prompt || '> ' })
  }

  private _saveHistory(line: string) {
    if (!this._historyPath || !line.trim()) return
    this._history.push(line)
    try {
      this.container.fs.appendFile(this._historyPath, line + '\n')
    } catch {}
  }
}

export default SocketRepl
