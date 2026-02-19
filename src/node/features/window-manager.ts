import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from '../../schemas/base.js'
import { Feature, features } from '../feature.js'
import { Socket } from 'net'
import { homedir } from 'os'
import { join } from 'path'

const DEFAULT_SOCKET_PATH = join(homedir(), 'Library', 'Application Support', 'MenuBarWebAgent', 'agent.sock')

// --- Error class ---

const ErrorCodes = ['AuthFailed', 'BadRequest', 'NotFound', 'EvalFailed', 'Internal', 'Timeout', 'Disconnected'] as const
type WindowManagerErrorCode = typeof ErrorCodes[number]

/**
 * Custom error class for WindowManager operations.
 * Carries a `code` property matching MBWA protocol error codes.
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
  projectId: z.string().default('p_luca')
    .describe('MBWA project ID for authentication'),
  token: z.string().default('t_wNDJ7TdyZXKkZzFk6eW7Ds2mGxbUCi65k7y0kTrO25o=')
    .describe('MBWA auth token for authentication'),
  socketPath: z.string().default(DEFAULT_SOCKET_PATH)
    .describe('Path to the MenuBarWebAgent Unix domain socket'),
  autoConnect: z.boolean().optional()
    .describe('Automatically connect to the socket when the feature is enabled'),
  reconnect: z.boolean().optional()
    .describe('Automatically reconnect on unexpected disconnect'),
  reconnectInterval: z.number().default(1000)
    .describe('Base milliseconds between reconnect retries'),
  maxReconnectAttempts: z.number().optional()
    .describe('Maximum number of reconnect attempts before giving up'),
  requestTimeoutMs: z.number().default(10000)
    .describe('Per-request timeout in milliseconds'),
})
export type WindowManagerOptions = z.infer<typeof WindowManagerOptionsSchema>

export const WindowManagerStateSchema = FeatureStateSchema.extend({
  connected: z.boolean().default(false)
    .describe('Whether the socket is currently connected'),
  socketPath: z.string().optional()
    .describe('The socket path in use'),
  projectId: z.string().optional()
    .describe('The authenticated project ID'),
  windowCount: z.number().default(0)
    .describe('Number of tracked windows'),
  serverVersion: z.string().optional()
    .describe('MBWA server version from ping'),
  lastError: z.string().optional()
    .describe('Last error message'),
  reconnectAttempts: z.number().default(0)
    .describe('Number of reconnect attempts made'),
})
export type WindowManagerState = z.infer<typeof WindowManagerStateSchema>

export const WindowManagerEventsSchema = FeatureEventsSchema.extend({
  connected: z.tuple([]).describe('Emitted when connected to MBWA socket'),
  disconnected: z.tuple([]).describe('Emitted when disconnected from MBWA socket'),
  reconnecting: z.tuple([z.number().describe('Attempt number')]).describe('Emitted when attempting to reconnect'),
  error: z.tuple([z.any().describe('The error')]).describe('Emitted on error'),
  windowOpened: z.tuple([z.any().describe('Window info')]).describe('Emitted when a window is opened'),
  windowClosed: z.tuple([z.any().describe('Close info')]).describe('Emitted when a window is closed'),
  navigationStarted: z.tuple([z.any().describe('Navigation info')]).describe('Emitted when navigation starts'),
  navigationFinished: z.tuple([z.any().describe('Navigation info')]).describe('Emitted when navigation finishes'),
})

// --- Spawn options type ---

export interface SpawnOptions {
  url?: string
  html?: string
  width?: number
  height?: number
  x?: number
  y?: number
  window?: {
    decorations?: 'normal' | 'hiddenTitleBar' | 'none'
    transparent?: boolean
    shadow?: boolean
    alwaysOnTop?: boolean
    opacity?: number
    clickThrough?: boolean
  }
}

export interface WindowInfo {
  windowId: string
  url?: string
  title?: string
  width?: number
  height?: number
  x?: number
  y?: number
}

// --- WindowHandle ---

/**
 * A lightweight handle to a single MBWA window.
 * Delegates all operations back to the WindowManager instance.
 */
export class WindowHandle {
  constructor(
    public readonly windowId: string,
    private manager: WindowManager
  ) {}

  /** Bring this window to the front. */
  async focus(): Promise<any> {
    return this.manager.focus(this.windowId)
  }

  /** Close this window. */
  async close(): Promise<any> {
    return this.manager.close(this.windowId)
  }

  /** Navigate this window to a URL. */
  async navigate(url: string): Promise<any> {
    return this.manager.navigate(this.windowId, url)
  }

  /** Evaluate JavaScript in this window's web view. */
  async eval(code: string, opts?: { timeoutMs?: number; returnJson?: boolean }): Promise<any> {
    return this.manager.eval(this.windowId, code, opts)
  }
}

// --- Feature ---

type PendingRequest = {
  resolve: (value: any) => void
  reject: (reason: any) => void
  timer: ReturnType<typeof setTimeout>
}

/**
 * WindowManager Feature — Native window control via MenuBarWebAgent
 *
 * Provides a typed client for the MenuBarWebAgent (MBWA) macOS menu bar app.
 * Communicates over a Unix domain socket using an NDJSON request/response protocol
 * with per-project authentication.
 *
 * **Capabilities:**
 * - Spawn native browser windows with configurable chrome (decorations, transparency, etc.)
 * - Navigate windows to URLs or load HTML content
 * - Evaluate arbitrary JavaScript in any window's web view
 * - Focus, close, and list windows
 * - Receive real-time events for window lifecycle and navigation changes
 * - Automatic reconnection with exponential backoff
 *
 * **Protocol:**
 * Uses NDJSON (newline-delimited JSON) over Unix domain sockets. Each request
 * includes an auto-incrementing `id` for response correlation and `projectId`/`token`
 * for authentication. Unsolicited server events are forwarded to the Luca event bus.
 *
 * @example
 * ```typescript
 * const wm = container.feature('windowManager', { enable: true, autoConnect: true })
 *
 * // Spawn a window
 * const result = await wm.spawn({ url: 'https://example.com', width: 800, height: 600 })
 *
 * // Use a WindowHandle for chainable operations
 * const win = wm.window(result.windowId)
 * await win.navigate('https://google.com')
 * const title = await win.eval('document.title')
 * await win.close()
 * ```
 */
export class WindowManager extends Feature<WindowManagerState, WindowManagerOptions> {
  static override shortcut = 'features.windowManager' as const
  static override stateSchema = WindowManagerStateSchema
  static override optionsSchema = WindowManagerOptionsSchema
  static override eventsSchema = WindowManagerEventsSchema

  private _socket?: Socket
  private _nextId = 1
  private _pending = new Map<number, PendingRequest>()
  private _buffer = ''
  private _intentionalClose = false

  override get initialState(): WindowManagerState {
    return {
      ...super.initialState,
      connected: false,
      windowCount: 0,
      reconnectAttempts: 0,
    }
  }

  /** Whether the socket is currently connected to MBWA. */
  get isConnected(): boolean {
    return this.state.get('connected') || false
  }

  override async enable(options: any = {}): Promise<this> {
    await super.enable(options)

    if (this.options.autoConnect) {
      await this.connect()
    }

    return this
  }

  /**
   * Connect to the MenuBarWebAgent Unix domain socket.
   * Wires up data, close, and error handlers for NDJSON communication.
   *
   * @returns Promise that resolves when the connection is established
   * @throws {WindowManagerError} When the connection fails
   */
  async connect(): Promise<this> {
    if (this.isConnected && this._socket) {
      return this
    }

    const socketPath = this.options.socketPath || DEFAULT_SOCKET_PATH

    try {
      const socket = await new Promise<Socket>((resolve, reject) => {
        const s = new Socket()

        s.connect(socketPath, () => {
          resolve(s)
        })

        s.on('error', (err) => {
          reject(err)
        })
      })

      this._socket = socket
      this._buffer = ''
      this._intentionalClose = false

      socket.on('data', (chunk) => {
        this.handleData(chunk)
      })

      socket.on('close', () => {
        this.setState({ connected: false })
        this.emit('disconnected')

        if (!this._intentionalClose) {
          this.maybeReconnect()
        }
        this._intentionalClose = false
      })

      socket.on('error', (err) => {
        this.setState({ lastError: err.message })
        this.emit('error', err)
      })

      this.setState({
        connected: true,
        socketPath,
        projectId: this.options.projectId,
        reconnectAttempts: 0,
        lastError: undefined,
      })

      this.emit('connected')
    } catch (err: any) {
      this.setState({ lastError: err.message })
      this.emit('error', err)
      throw new WindowManagerError(`Failed to connect to MBWA at ${socketPath}: ${err.message}`, 'Disconnected')
    }

    return this
  }

  /**
   * Disconnect from the MenuBarWebAgent socket.
   * Suppresses automatic reconnection.
   */
  async disconnect(): Promise<this> {
    this._intentionalClose = true

    if (this._socket) {
      this._socket.destroy()
      this._socket = undefined
    }

    // Reject all pending requests
    for (const [id, pending] of this._pending) {
      clearTimeout(pending.timer)
      pending.reject(new WindowManagerError('Disconnected', 'Disconnected'))
    }
    this._pending.clear()
    this._buffer = ''

    this.setState({ connected: false })
    return this
  }

  /**
   * Ping the MBWA server. Does not require authentication.
   *
   * @returns Server response (typically includes version info)
   */
  async ping(): Promise<any> {
    await this.ensureConnected()
    return this.send('ping', {})
  }

  /**
   * Spawn a new native browser window.
   *
   * @param opts - Window configuration (url/html, dimensions, chrome options)
   * @returns The spawn response including `windowId`
   */
  async spawn(opts: SpawnOptions = {}): Promise<{ windowId: string } & Record<string, any>> {
    await this.ensureConnected()
    return this.send('spawnWindow', {
      ...opts,
      projectId: this.options.projectId,
      token: this.options.token,
    })
  }

  /**
   * List all windows for the authenticated project.
   *
   * @returns Object with `windows` array of WindowInfo
   */
  async list(): Promise<{ windows: WindowInfo[] }> {
    await this.ensureConnected()
    return this.send('listWindows', {
      projectId: this.options.projectId,
      token: this.options.token,
    })
  }

  /**
   * Bring a window to the front.
   *
   * @param windowId - The ID of the window to focus
   */
  async focus(windowId: string): Promise<any> {
    await this.ensureConnected()
    return this.send('focusWindow', {
      windowId,
      projectId: this.options.projectId,
      token: this.options.token,
    })
  }

  /**
   * Close a window.
   *
   * @param windowId - The ID of the window to close
   */
  async close(windowId: string): Promise<any> {
    await this.ensureConnected()
    return this.send('closeWindow', {
      windowId,
      projectId: this.options.projectId,
      token: this.options.token,
    })
  }

  /**
   * Navigate a window to a new URL.
   *
   * @param windowId - The ID of the window
   * @param url - The URL to navigate to
   */
  async navigate(windowId: string, url: string): Promise<any> {
    await this.ensureConnected()
    return this.send('navigate', {
      windowId,
      url,
      projectId: this.options.projectId,
      token: this.options.token,
    })
  }

  /**
   * Evaluate JavaScript in a window's web view.
   *
   * @param windowId - The ID of the window
   * @param code - JavaScript code to evaluate
   * @param opts - Options: timeoutMs, returnJson
   * @returns The evaluation result
   */
  async eval(windowId: string, code: string, opts?: { timeoutMs?: number; returnJson?: boolean }): Promise<any> {
    await this.ensureConnected()
    return this.send('eval', {
      windowId,
      code,
      ...(opts?.timeoutMs != null ? { timeoutMs: opts.timeoutMs } : {}),
      ...(opts?.returnJson != null ? { returnJson: opts.returnJson } : {}),
      projectId: this.options.projectId,
      token: this.options.token,
    })
  }

  /**
   * Get a WindowHandle for chainable operations on a specific window.
   *
   * @param windowId - The ID of the window
   * @returns A WindowHandle instance
   */
  window(windowId: string): WindowHandle {
    return new WindowHandle(windowId, this)
  }

  // --- Private internals ---

  /**
   * Ensure the socket is connected, connecting lazily if needed.
   */
  private async ensureConnected(): Promise<void> {
    if (!this.isConnected || !this._socket) {
      await this.connect()
    }
  }

  /**
   * Send an NDJSON request and wait for the correlated response.
   *
   * @param method - The MBWA protocol method name
   * @param params - The request parameters
   * @returns Promise resolving to the response result
   */
  private send<T = any>(method: string, params: Record<string, any>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      if (!this._socket) {
        reject(new WindowManagerError('Not connected', 'Disconnected'))
        return
      }

      const id = this._nextId++
      const timeoutMs = this.options.requestTimeoutMs || 10000

      const timer = setTimeout(() => {
        this._pending.delete(id)
        reject(new WindowManagerError(`Request ${method} (id=${id}) timed out after ${timeoutMs}ms`, 'Timeout'))
      }, timeoutMs)

      this._pending.set(id, { resolve, reject, timer })

      const line = JSON.stringify({ id, method, params }) + '\n'
      this._socket.write(line)
    })
  }

  /**
   * Handle incoming data chunks from the socket.
   * Buffers partial lines and processes complete NDJSON lines.
   */
  private handleData(chunk: Buffer): void {
    this._buffer += chunk.toString()

    const lines = this._buffer.split('\n')
    // Keep the last (possibly incomplete) segment in the buffer
    this._buffer = lines.pop() || ''

    for (const line of lines) {
      if (line.trim()) {
        this.processLine(line)
      }
    }
  }

  /**
   * Process a single complete NDJSON line.
   * If it has an `id`, resolves/rejects the matching pending request.
   * If it has a `method`, emits the corresponding event.
   */
  private processLine(line: string): void {
    let msg: any
    try {
      msg = JSON.parse(line)
    } catch {
      return
    }

    // Response to a pending request
    if (msg.id != null && this._pending.has(msg.id)) {
      const pending = this._pending.get(msg.id)!
      this._pending.delete(msg.id)
      clearTimeout(pending.timer)

      if (msg.error) {
        const code = (ErrorCodes.includes(msg.error.code) ? msg.error.code : 'Internal') as WindowManagerErrorCode
        pending.reject(new WindowManagerError(msg.error.message || 'Unknown error', code))
      } else {
        pending.resolve(msg.result ?? msg)
      }
      return
    }

    // Unsolicited server event
    if (msg.method) {
      // Only process events for our project
      if (msg.projectId && msg.projectId !== this.options.projectId) {
        return
      }

      const eventMap: Record<string, string> = {
        windowOpened: 'windowOpened',
        windowClosed: 'windowClosed',
        navigationStarted: 'navigationStarted',
        navigationFinished: 'navigationFinished',
      }

      const eventName = eventMap[msg.method]
      if (eventName) {
        this.emit(eventName as any, msg.params || msg)
      }
    }
  }

  /**
   * Attempt to reconnect using exponential backoff.
   * Mirrors the WebSocketClient reconnection pattern.
   */
  private maybeReconnect(): void {
    if (!this.options.reconnect) return

    const maxAttempts = this.options.maxReconnectAttempts ?? Infinity
    const baseInterval = this.options.reconnectInterval ?? 1000
    const attempts = (this.state.get('reconnectAttempts') ?? 0) + 1

    if (attempts > maxAttempts) return

    this.setState({ reconnectAttempts: attempts })
    this.emit('reconnecting', attempts)

    const delay = Math.min(baseInterval * Math.pow(2, attempts - 1), 30000)
    setTimeout(() => {
      this.connect().catch(() => {})
    }, delay)
  }
}

export default features.register('windowManager', WindowManager)
