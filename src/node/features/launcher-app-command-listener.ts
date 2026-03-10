import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from '../../schemas/base.js'
import { Feature } from '../feature.js'
import { Server as NetServer, Socket } from 'net'
import { homedir } from 'os'
import { join, dirname } from 'path'
import { existsSync, unlinkSync, mkdirSync } from 'fs'

const DEFAULT_SOCKET_PATH = join(
  homedir(),
  'Library',
  'Application Support',
  'LucaVoiceLauncher',
  'ipc-command.sock'
)

// --- CommandHandle ---

/**
 * A handle to a single incoming command from the native app.
 * Provides methods to acknowledge, report progress, and finish the command.
 * All responses are automatically correlated by the command's `id`.
 */
export class CommandHandle {
  /** The correlation UUID from the app. */
  readonly id: string
  /** The command text (e.g. "open notes"). */
  readonly text: string
  /** The input source (e.g. "voice", "hotkey"). */
  readonly source: string
  /** The full payload object from the app. */
  readonly payload: any
  /** The entire raw message from the app. */
  readonly raw: any

  private _send: (msg: Record<string, any>) => boolean
  private _finished = false

  constructor(msg: any, send: (msg: Record<string, any>) => boolean) {
    this.id = msg.id
    this.text = msg.payload?.text ?? ''
    this.source = msg.payload?.source ?? ''
    this.payload = msg.payload ?? {}
    this.raw = msg
    this._send = send
  }

  /** Whether `finish()` or `fail()` has been called. */
  get isFinished(): boolean {
    return this._finished
  }

  /**
   * Send a processing acknowledgement to the app.
   * Optionally include a speech phrase for TTS or an audio file path for playback.
   *
   * @param speechOrOpts - Text the app will speak, or an options object with speech and/or audioFile
   */
  ack(speechOrOpts?: string | { speech?: string; audioFile?: string }): boolean {
    const opts = typeof speechOrOpts === 'string' ? { speech: speechOrOpts } : speechOrOpts
    return this._send({
      id: this.id,
      status: 'processing',
      ...(opts?.speech ? { speech: opts.speech } : {}),
      ...(opts?.audioFile ? { audioFile: opts.audioFile } : {}),
      timestamp: new Date().toISOString(),
    })
  }

  /**
   * Send a progress update to the app.
   *
   * @param progress - A number between 0 and 1
   * @param message - Optional human-readable progress message
   */
  progress(progress: number, message?: string): boolean {
    return this._send({
      id: this.id,
      status: 'progress',
      progress,
      ...(message ? { message } : {}),
      timestamp: new Date().toISOString(),
    })
  }

  /**
   * Mark the command as successfully finished.
   * Can only be called once per command. All arguments are optional.
   *
   * @param opts - Optional result payload, speech phrase, and/or audio file path
   */
  finish(opts?: { result?: Record<string, any>; speech?: string; audioFile?: string }): boolean {
    if (this._finished) return false
    this._finished = true
    return this._send({
      id: this.id,
      status: 'finished',
      success: true,
      ...(opts?.result ? { result: opts.result } : {}),
      ...(opts?.speech ? { speech: opts.speech } : {}),
      ...(opts?.audioFile ? { audioFile: opts.audioFile } : {}),
      timestamp: new Date().toISOString(),
    })
  }

  /**
   * Mark the command as failed.
   * Can only be called once per command.
   *
   * @param opts - Optional error description, speech phrase, and/or audio file path
   */
  fail(opts?: { error?: string; speech?: string; audioFile?: string }): boolean {
    if (this._finished) return false
    this._finished = true
    return this._send({
      id: this.id,
      status: 'finished',
      success: false,
      ...(opts?.error ? { error: opts.error } : {}),
      ...(opts?.speech ? { speech: opts.speech } : {}),
      ...(opts?.audioFile ? { audioFile: opts.audioFile } : {}),
      timestamp: new Date().toISOString(),
    })
  }
}

// --- Schemas ---

export const LauncherAppCommandListenerOptionsSchema = FeatureOptionsSchema.extend({
  socketPath: z.string().default(DEFAULT_SOCKET_PATH)
    .describe('Path to the Unix domain socket to listen on'),
  autoListen: z.boolean().optional()
    .describe('Automatically start listening when the feature is enabled'),
})
export type LauncherAppCommandListenerOptions = z.infer<typeof LauncherAppCommandListenerOptionsSchema>

export const LauncherAppCommandListenerStateSchema = FeatureStateSchema.extend({
  listening: z.boolean().default(false)
    .describe('Whether the IPC server is listening'),
  clientConnected: z.boolean().default(false)
    .describe('Whether the native launcher app is connected'),
  socketPath: z.string().optional()
    .describe('The socket path in use'),
  commandsReceived: z.number().default(0)
    .describe('Total number of commands received'),
  lastCommandText: z.string().optional()
    .describe('The text of the last received command'),
  lastError: z.string().optional()
    .describe('Last error message'),
})
export type LauncherAppCommandListenerState = z.infer<typeof LauncherAppCommandListenerStateSchema>

export const LauncherAppCommandListenerEventsSchema = FeatureEventsSchema.extend({
  listening: z.tuple([]).describe('Emitted when the IPC server starts listening'),
  clientConnected: z.tuple([z.any().describe('The client socket')]).describe('Emitted when the native app connects'),
  clientDisconnected: z.tuple([]).describe('Emitted when the native app disconnects'),
  command: z.tuple([z.any().describe('A CommandHandle for the incoming command')]).describe('Emitted when a command is received. The listener is responsible for calling ack(), finish(), or fail() on the handle.'),
  message: z.tuple([z.any().describe('The parsed message')]).describe('Emitted for any non-command message from the app'),
})

// --- Private types ---

interface ClientConnection {
  socket: Socket
  buffer: string
}

// --- Feature ---

/**
 * LauncherAppCommandListener — IPC transport for commands from the LucaVoiceLauncher app
 *
 * Listens on a Unix domain socket for the native macOS launcher app to connect.
 * When a command event arrives (voice, hotkey, text input), it wraps it in a
 * `CommandHandle` and emits a `command` event. The consumer is responsible for
 * acknowledging, processing, and finishing the command via the handle.
 *
 * Uses NDJSON (newline-delimited JSON) over the socket per the CLIENT_SPEC protocol.
 *
 * @example
 * ```typescript
 * const listener = container.feature('launcherAppCommandListener', {
 *   enable: true,
 *   autoListen: true,
 * })
 *
 * listener.on('command', async (cmd) => {
 *   cmd.ack('Working on it!')     // or just cmd.ack() for silent
 *
 *   // ... do your actual work ...
 *   cmd.progress(0.5, 'Halfway there')
 *
 *   cmd.finish()                   // silent finish
 *   cmd.finish({ result: { action: 'completed' }, speech: 'All done!' })
 *   // or: cmd.fail({ error: 'not found', speech: 'Sorry, that failed.' })
 * })
 * ```
 */
export class LauncherAppCommandListener extends Feature<LauncherAppCommandListenerState, LauncherAppCommandListenerOptions> {
  static override shortcut = 'features.launcherAppCommandListener' as const
  static override stateSchema = LauncherAppCommandListenerStateSchema
  static override optionsSchema = LauncherAppCommandListenerOptionsSchema
  static override eventsSchema = LauncherAppCommandListenerEventsSchema
  static { Feature.register(this, 'launcherAppCommandListener') }

  private _server?: NetServer
  private _client?: ClientConnection

  override get initialState(): LauncherAppCommandListenerState {
    return {
      ...super.initialState,
      listening: false,
      clientConnected: false,
      commandsReceived: 0,
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
   * @returns This feature instance for chaining
   */
  listen(socketPath?: string): this {
    if (this._server) return this

    socketPath = socketPath || this.options.socketPath || DEFAULT_SOCKET_PATH

    const dir = dirname(socketPath)
    if (!existsSync(dir)) {
      try {
        mkdirSync(dir, { recursive: true })
      } catch (error: any) {
        this.setState({ lastError: `Failed to create socket directory ${dir}: ${error?.message || String(error)}` })
        return this
      }
    }

    if (existsSync(socketPath)) {
      try {
        unlinkSync(socketPath)
      } catch (error: any) {
        this.setState({ lastError: `Failed to remove stale socket at ${socketPath}: ${error?.message || String(error)}` })
        return this
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
   *
   * @returns This feature instance for chaining
   */
  async stop(): Promise<this> {
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

    if (socketPath && existsSync(socketPath)) {
      try { unlinkSync(socketPath) } catch { /* ignore */ }
    }

    this.setState({ listening: false, clientConnected: false, socketPath: undefined })
    return this
  }

  /**
   * Write an NDJSON message to the connected app client.
   *
   * @param msg - The message object to send (will be JSON-serialized + newline)
   * @returns True if the message was written, false if no client is connected
   */
  send(msg: Record<string, any>): boolean {
    if (!this._client) return false
    this._client.socket.write(JSON.stringify(msg) + '\n')
    return true
  }

  // --- Private ---

  /** Handle a new client connection from the native app. */
  private handleClientConnect(socket: Socket): void {
    const client: ClientConnection = { socket, buffer: '' }

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
        this.emit('clientDisconnected')
      }
    })

    socket.on('error', (err) => {
      this.setState({ lastError: err.message })
    })
  }

  /** Process a single NDJSON line. Wraps commands in a CommandHandle; emits `message` for everything else. */
  private processLine(line: string): void {
    let msg: any
    try {
      msg = JSON.parse(line)
    } catch {
      return
    }

    if (msg.type === 'command') {
      const handle = new CommandHandle(msg, (m) => this.send(m))

      this.setState({
        commandsReceived: (this.state.get('commandsReceived') ?? 0) + 1,
        lastCommandText: handle.text,
      })

      this.emit('command', handle)
      return
    }

    this.emit('message', msg)
  }
}

export default LauncherAppCommandListener