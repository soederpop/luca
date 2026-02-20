import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from '../../schemas/base.js'
import { Feature, features } from '../feature.js'
import { Server as NetServer, Socket } from 'net'
import { homedir } from 'os'
import { join, dirname } from 'path'
import { randomUUID } from 'crypto'
import { existsSync, unlinkSync, mkdirSync } from 'fs'

const DEFAULT_SOCKET_PATH = join(
  homedir(),
  'Library',
  'Application Support',
  'NativeCommandLauncherApp',
  'ipc.sock'
)

const FALLBACK_SOCKET_PATH = `/tmp/native-command-launcher.${process.getuid?.() ?? 501}.sock`

const ErrorCodes = ['BadRequest', 'NotFound', 'EvalFailed', 'Internal', 'Timeout', 'Disconnected', 'NoClient'] as const
type WindowManagerErrorCode = typeof ErrorCodes[number]

/**
 * Custom error class for WindowManager operations.
 * Carries a `code` property for programmatic error handling.
 */
export class WindowManagerError extends Error {
  code: WindowManagerErrorCode

  constructor(message: string, code: WindowManagerErrorCode = 'Internal') {
    super(message)
    this.name = 'WindowManagerError'
    this.code = code
  }
}

// --- Schemas ---

export const WindowManagerOptionsSchema = FeatureOptionsSchema.extend({
  socketPath: z.string().default(DEFAULT_SOCKET_PATH)
    .describe('Path to the Unix domain socket the server listens on'),
  fallbackSocketPath: z.string().default(FALLBACK_SOCKET_PATH)
    .describe('Fallback socket path if primary is unavailable'),
  autoListen: z.boolean().optional()
    .describe('Automatically start listening when the feature is enabled'),
  requestTimeoutMs: z.number().default(10000)
    .describe('Per-request timeout in milliseconds for window operations'),
})
export type WindowManagerOptions = z.infer<typeof WindowManagerOptionsSchema>

export const WindowManagerStateSchema = FeatureStateSchema.extend({
  listening: z.boolean().default(false)
    .describe('Whether the IPC server is listening'),
  clientConnected: z.boolean().default(false)
    .describe('Whether the native launcher app is connected'),
  socketPath: z.string().optional()
    .describe('The socket path in use'),
  windowCount: z.number().default(0)
    .describe('Number of tracked windows'),
  lastError: z.string().optional()
    .describe('Last error message'),
})
export type WindowManagerState = z.infer<typeof WindowManagerStateSchema>

export const WindowManagerEventsSchema = FeatureEventsSchema.extend({
  listening: z.tuple([]).describe('Emitted when the IPC server starts listening'),
  clientConnected: z.tuple([z.any().describe('The client socket')]).describe('Emitted when the native app connects'),
  clientDisconnected: z.tuple([]).describe('Emitted when the native app disconnects'),
  message: z.tuple([z.any().describe('The parsed message object')]).describe('Emitted for any incoming message that is not a windowAck'),
  windowAck: z.tuple([z.any().describe('The window ack payload')]).describe('Emitted when a window ack is received from the app'),
  error: z.tuple([z.any().describe('The error')]).describe('Emitted on error'),
})

// --- Types ---

/**
 * Options for spawning a new native browser window.
 */
export interface SpawnOptions {
  url?: string
  width?: number
  height?: number
  x?: number
  y?: number
  alwaysOnTop?: boolean
  window?: {
    decorations?: 'normal' | 'hiddenTitleBar' | 'none'
    transparent?: boolean
    shadow?: boolean
    alwaysOnTop?: boolean
    opacity?: number
    clickThrough?: boolean
  }
}

/**
 * Options for spawning a native terminal window.
 */
export interface SpawnTTYOptions {
  /** Executable name or path (required). */
  command: string
  /** Arguments passed after the command. */
  args?: string[]
  /** Working directory for the process. */
  cwd?: string
  /** Environment variable overrides. */
  env?: Record<string, string>
  /** Initial terminal columns. */
  cols?: number
  /** Initial terminal rows. */
  rows?: number
  /** Window title. */
  title?: string
  /** Window width in points. */
  width?: number
  /** Window height in points. */
  height?: number
  /** Window x position. */
  x?: number
  /** Window y position. */
  y?: number
  /** Chrome options (decorations, alwaysOnTop, etc.) */
  window?: SpawnOptions['window']
}

/**
 * The result returned from a window ack.
 */
export interface WindowAckResult {
  ok?: boolean
  windowId?: string
  value?: string
  json?: any
  [key: string]: any
}

// --- WindowHandle ---

/**
 * A lightweight handle to a single native window.
 * Delegates all operations back to the WindowManager instance.
 */
export class WindowHandle {
  constructor(
    public readonly windowId: string,
    private manager: WindowManager
  ) {}

  /** Bring this window to the front. */
  async focus(): Promise<WindowAckResult> {
    return this.manager.focus(this.windowId)
  }

  /** Close this window. */
  async close(): Promise<WindowAckResult> {
    return this.manager.close(this.windowId)
  }

  /** Navigate this window to a URL. */
  async navigate(url: string): Promise<WindowAckResult> {
    return this.manager.navigate(this.windowId, url)
  }

  /** Evaluate JavaScript in this window's web view. */
  async eval(code: string, opts?: { timeoutMs?: number; returnJson?: boolean }): Promise<WindowAckResult> {
    return this.manager.eval(this.windowId, code, opts)
  }
}

// --- Private types ---

type PendingRequest = {
  resolve: (value: any) => void
  reject: (reason: any) => void
  timer: ReturnType<typeof setTimeout>
}

interface ClientConnection {
  socket: Socket
  buffer: string
}

// --- Feature ---

/**
 * WindowManager Feature — Native window control via NativeCommandLauncher
 *
 * Acts as an IPC server that the native macOS launcher app connects to.
 * Communicates over a Unix domain socket using NDJSON (newline-delimited JSON).
 *
 * **Protocol:**
 * - Bun listens on a Unix domain socket; the native app connects as a client
 * - Window dispatch commands are sent as NDJSON with a `window` field
 * - The app executes window commands and sends back `windowAck` messages
 * - Any non-windowAck message from the app is emitted as a `message` event
 * - Other features can use `send()` to write arbitrary NDJSON to the app
 *
 * **Capabilities:**
 * - Spawn native browser windows with configurable chrome
 * - Navigate, focus, close, and eval JavaScript in windows
 * - Automatic socket file cleanup and fallback paths
 *
 * @example
 * ```typescript
 * const wm = container.feature('windowManager', { enable: true, autoListen: true })
 *
 * const result = await wm.spawn({ url: 'https://google.com', width: 800, height: 600 })
 * const handle = wm.window(result.windowId)
 * await handle.navigate('https://news.ycombinator.com')
 * const title = await handle.eval('document.title')
 * await handle.close()
 *
 * // Other features can listen for non-window messages
 * wm.on('message', (msg) => console.log('App says:', msg))
 *
 * // Other features can write raw NDJSON to the app
 * wm.send({ id: 'abc', status: 'processing', speech: 'Working on it' })
 * ```
 */
export class WindowManager extends Feature<WindowManagerState, WindowManagerOptions> {
  static override shortcut = 'features.windowManager' as const
  static override stateSchema = WindowManagerStateSchema
  static override optionsSchema = WindowManagerOptionsSchema
  static override eventsSchema = WindowManagerEventsSchema

  private _server?: NetServer
  private _client?: ClientConnection
  private _pending = new Map<string, PendingRequest>()

  override get initialState(): WindowManagerState {
    return {
      ...super.initialState,
      listening: false,
      clientConnected: false,
      windowCount: 0,
    }
  }

  /** Whether the IPC server is currently listening. */
  get isListening(): boolean {
    return this.state.get('listening') || false
  }

  /** Whether the native app client is currently connected. */
  get isClientConnected(): boolean {
    return this.state.get('clientConnected') || false
  }

  override async enable(options: any = {}): Promise<this> {
    await super.enable(options)

    if (this.options.autoListen) {
      this.listen()
    }

    return this
  }

  /**
   * Start listening on the Unix domain socket for the native app to connect.
   * Fire-and-forget — binds the socket and returns immediately. Sits quietly
   * until the native app connects; does nothing visible if it never does.
   *
   * @param socketPath - Override the configured socket path
   */
  listen(socketPath?: string): this {
    if (this._server) return this

    socketPath = socketPath || this.options.socketPath || DEFAULT_SOCKET_PATH

    // Ensure the directory exists; fall back if it doesn't
    const dir = dirname(socketPath)
    if (!existsSync(dir)) {
      try {
        mkdirSync(dir, { recursive: true })
      } catch {
        socketPath = this.options.fallbackSocketPath || FALLBACK_SOCKET_PATH
      }
    }

    // Clean up stale socket file
    if (existsSync(socketPath)) {
      try {
        unlinkSync(socketPath)
      } catch {
        socketPath = this.options.fallbackSocketPath || FALLBACK_SOCKET_PATH
        if (existsSync(socketPath)) {
          unlinkSync(socketPath)
        }
      }
    }

    const server = new NetServer((socket) => {
      this.handleClientConnect(socket)
    })

    server.on('error', (err) => {
      this.setState({ lastError: err.message })
    })

    const finalPath = socketPath
    server.listen(finalPath, () => {
      this._server = server
      this.setState({ listening: true, socketPath: finalPath })
      this.emit('listening')
    })

    return this
  }

  /**
   * Stop the IPC server and clean up all connections.
   * Rejects any pending window operation requests.
   */
  async stop(): Promise<this> {
    for (const [, pending] of this._pending) {
      clearTimeout(pending.timer)
      pending.resolve({ ok: false, error: 'Server stopping' })
    }
    this._pending.clear()

    if (this._client) {
      this._client.socket.destroy()
      this._client = undefined
    }

    const socketPath = this.state.get('socketPath')

    if (this._server) {
      await new Promise<void>((resolve) => {
        this._server!.close(() => resolve())
      })
      this._server = undefined
    }

    // Clean up the socket file
    if (socketPath && existsSync(socketPath)) {
      try { unlinkSync(socketPath) } catch { /* ignore */ }
    }

    this.setState({ listening: false, clientConnected: false, socketPath: undefined })
    return this
  }

  // --- Window Operations ---

  /**
   * Spawn a new native browser window.
   * Sends a window dispatch to the app and waits for the ack.
   *
   * @param opts - Window configuration (url, dimensions, chrome options)
   * @returns The window ack result including `windowId`
   */
  async spawn(opts: SpawnOptions = {}): Promise<WindowAckResult> {
    const { window: windowChrome, ...flat } = opts

    if (windowChrome) {
      return this.sendWindowCommand({
        action: 'open',
        request: {
          ...flat,
          window: windowChrome,
        },
      })
    }

    return this.sendWindowCommand({
      action: 'open',
      ...flat,
      alwaysOnTop: flat.alwaysOnTop ?? false,
    })
  }

  /**
   * Spawn a native terminal window running a command.
   * The terminal is read-only — stdout/stderr are rendered with ANSI support.
   * Closing the window terminates the process.
   *
   * @param opts - Terminal configuration (command, args, cwd, dimensions, etc.)
   * @returns The window ack result including `windowId` and `pid`
   */
  async spawnTTY(opts: SpawnTTYOptions): Promise<WindowAckResult> {
    const { window: windowChrome, ...flat } = opts

    if (windowChrome) {
      return this.sendWindowCommand({
        action: 'terminal',
        ...flat,
        window: windowChrome,
      })
    }

    return this.sendWindowCommand({
      action: 'terminal',
      ...flat,
    })
  }

  /**
   * Bring a window to the front.
   *
   * @param windowId - The window ID. If omitted, the app uses the most recent window.
   */
  async focus(windowId?: string): Promise<WindowAckResult> {
    return this.sendWindowCommand({
      action: 'focus',
      ...(windowId ? { windowId } : {}),
    })
  }

  /**
   * Close a window.
   *
   * @param windowId - The window ID. If omitted, the app closes the most recent window.
   */
  async close(windowId?: string): Promise<WindowAckResult> {
    return this.sendWindowCommand({
      action: 'close',
      ...(windowId ? { windowId } : {}),
    })
  }

  /**
   * Navigate a window to a new URL.
   *
   * @param windowId - The window ID
   * @param url - The URL to navigate to
   */
  async navigate(windowId: string, url: string): Promise<WindowAckResult> {
    return this.sendWindowCommand({
      action: 'navigate',
      windowId,
      url,
    })
  }

  /**
   * Evaluate JavaScript in a window's web view.
   *
   * @param windowId - The window ID
   * @param code - JavaScript code to evaluate
   * @param opts - timeoutMs (default 5000), returnJson (default true)
   * @returns The evaluation result from the window ack
   */
  async eval(windowId: string, code: string, opts?: { timeoutMs?: number; returnJson?: boolean }): Promise<WindowAckResult> {
    return this.sendWindowCommand({
      action: 'eval',
      windowId,
      code,
      ...(opts?.timeoutMs != null ? { timeoutMs: opts.timeoutMs } : {}),
      ...(opts?.returnJson != null ? { returnJson: opts.returnJson } : {}),
    })
  }

  /**
   * Get a WindowHandle for chainable operations on a specific window.
   *
   * @param windowId - The window ID
   * @returns A WindowHandle instance
   */
  window(windowId: string): WindowHandle {
    return new WindowHandle(windowId, this)
  }

  // --- Private internals ---

  /**
   * Handle a new client connection from the native app.
   * Sets up NDJSON buffering and event forwarding.
   */
  private handleClientConnect(socket: Socket): void {
    const client: ClientConnection = { socket, buffer: '' }

    // Replace any existing client (single-client model)
    if (this._client) {
      this._client.socket.destroy()
    }
    this._client = client

    this.setState({ clientConnected: true })
    this.emit('clientConnected', socket)

    socket.on('data', (chunk) => {
      client.buffer += chunk.toString()
      const lines = client.buffer.split('\n')
      client.buffer = lines.pop() || ''
      for (const line of lines) {
        if (line.trim()) this.processLine(line)
      }
    })

    socket.on('close', () => {
      if (this._client === client) {
        this._client = undefined
        this.setState({ clientConnected: false })

        // Resolve all pending requests — the app is gone, no acks coming
        for (const [id, pending] of this._pending) {
          clearTimeout(pending.timer)
          pending.resolve({ ok: false, error: 'Client disconnected' })
        }
        this._pending.clear()

        this.emit('clientDisconnected')
      }
    })

    socket.on('error', (err) => {
      this.setState({ lastError: err.message })
    })
  }

  /**
   * Process a single complete NDJSON line from the app.
   * Resolves pending windowAck requests; emits `message` for everything else.
   */
  private processLine(line: string): void {
    let msg: any
    try {
      msg = JSON.parse(line)
    } catch {
      return // Malformed JSON ignored per spec
    }

    // WindowAck from app (response to a window dispatch)
    if (msg.type === 'windowAck') {
      this.emit('windowAck', msg)

      const ackId = typeof msg.id === 'string' ? msg.id.toLowerCase() : msg.id
      if (ackId && this._pending.has(ackId)) {
        const pending = this._pending.get(ackId)!
        this._pending.delete(ackId)
        clearTimeout(pending.timer)

        if (msg.success) {
          pending.resolve(msg.result ?? msg)
        } else {
          pending.resolve({ ok: false, error: msg.error || 'Window operation failed' })
        }
      }
      return
    }

    // Everything else is forwarded as a generic message
    this.emit('message', msg)
  }

  /**
   * Send a window dispatch command to the app and wait for the ack.
   * Generates a UUID for correlation and sets up a timeout.
   */
  private sendWindowCommand(windowPayload: Record<string, any>): Promise<WindowAckResult> {
    return new Promise<WindowAckResult>((resolve, reject) => {
      if (!this._client) {
        resolve({ ok: false })
        return
      }

      const id = randomUUID()
      const timeoutMs = this.options.requestTimeoutMs || 10000

      const timer = setTimeout(() => {
        this._pending.delete(id)
        resolve({ ok: false, error: `Window ${windowPayload.action} timed out after ${timeoutMs}ms` })
      }, timeoutMs)

      this._pending.set(id, { resolve, reject, timer })

      this.send({
        id,
        status: 'processing',
        window: windowPayload,
        timestamp: new Date().toISOString(),
      })
    })
  }

  /**
   * Write an NDJSON message to the connected app client.
   * Public so other features can send arbitrary protocol messages over the same socket.
   *
   * @param msg - The message object to send (will be JSON-serialized + newline)
   */
  send(msg: Record<string, any>): boolean {
    if (!this._client) return false
    this._client.socket.write(JSON.stringify(msg) + '\n')
    return true
  }
}

export default features.register('windowManager', WindowManager)
