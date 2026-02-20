import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from '../../schemas/base.js'
import { Feature, features } from '../feature.js'
import { Server as NetServer, Socket } from 'net'
import { homedir } from 'os'
import { join, dirname } from 'path'
import { existsSync, unlinkSync, mkdirSync } from 'fs'

const DEFAULT_SOCKET_PATH = join(
  homedir(),
  'Library',
  'Application Support',
  'NativeCommandLauncherApp',
  'ipc.sock'
)

const FALLBACK_SOCKET_PATH = `/tmp/native-command-launcher.${process.getuid?.() ?? 501}.sock`

const ACK_MESSAGES = [
  'On it!',
  'Working on it',
  'Let me handle that',
  'Got it, one sec',
  'Sure thing',
  'Coming right up',
  'Heard you loud and clear',
  'Processing that now',
  'One moment',
  'Right away',
]

// --- Schemas ---

export const LauncherAppCommandListenerOptionsSchema = FeatureOptionsSchema.extend({
  socketPath: z.string().default(DEFAULT_SOCKET_PATH)
    .describe('Path to the Unix domain socket to listen on'),
  fallbackSocketPath: z.string().default(FALLBACK_SOCKET_PATH)
    .describe('Fallback socket path if primary is unavailable'),
  autoListen: z.boolean().optional()
    .describe('Automatically start listening when the feature is enabled'),
  sleepMs: z.number().default(2000)
    .describe('How long to sleep while "processing" a command, in milliseconds'),
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
  commandsCompleted: z.number().default(0)
    .describe('Total number of commands completed'),
  processing: z.boolean().default(false)
    .describe('Whether a command is currently being processed'),
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
  commandReceived: z.tuple([z.any().describe('The command event')]).describe('Emitted when a command is received from the app'),
  commandCompleted: z.tuple([z.any().describe('The command event')]).describe('Emitted when a command finishes processing'),
  message: z.tuple([z.any().describe('The parsed message')]).describe('Emitted for any non-command message from the app'),
  error: z.tuple([z.any().describe('The error')]).describe('Emitted on error'),
})

// --- Private types ---

interface ClientConnection {
  socket: Socket
  buffer: string
}

// --- Feature ---

/**
 * LauncherAppCommandListener — IPC server that processes commands from the NativeCommandLauncher app
 *
 * Listens on a Unix domain socket for the native macOS launcher app to connect.
 * When a command event arrives (voice, hotkey, text input), it acknowledges receipt
 * with a friendly TTS message, processes the command, and sends a finished response.
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
 * listener.on('commandReceived', (cmd) => {
 *   console.log('Processing:', cmd.payload.text)
 * })
 *
 * listener.on('commandCompleted', (cmd) => {
 *   console.log('Done:', cmd.payload.text)
 * })
 * ```
 */
export class LauncherAppCommandListener extends Feature<LauncherAppCommandListenerState, LauncherAppCommandListenerOptions> {
  static override shortcut = 'features.launcherAppCommandListener' as const
  static override stateSchema = LauncherAppCommandListenerStateSchema
  static override optionsSchema = LauncherAppCommandListenerOptionsSchema
  static override eventsSchema = LauncherAppCommandListenerEventsSchema

  private _server?: NetServer
  private _client?: ClientConnection

  override get initialState(): LauncherAppCommandListenerState {
    return {
      ...super.initialState,
      listening: false,
      clientConnected: false,
      commandsReceived: 0,
      commandsCompleted: 0,
      processing: false,
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
      await this.listen()
    }

    return this
  }

  /**
   * Start listening on the Unix domain socket for the native app to connect.
   * Cleans up stale socket files automatically. Falls back to the secondary
   * path if the primary directory doesn't exist.
   *
   * @param socketPath - Override the configured socket path
   */
  async listen(socketPath?: string): Promise<this> {
    if (this._server) return this

    socketPath = socketPath || this.options.socketPath || DEFAULT_SOCKET_PATH

    const dir = dirname(socketPath)
    if (!existsSync(dir)) {
      try {
        mkdirSync(dir, { recursive: true })
      } catch {
        socketPath = this.options.fallbackSocketPath || FALLBACK_SOCKET_PATH
      }
    }

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

    return new Promise<this>((resolve, reject) => {
      const server = new NetServer((socket) => {
        this.handleClientConnect(socket)
      })

      server.on('error', (err) => {
        this.setState({ lastError: err.message })
        this.emit('error', err)
        reject(err)
      })

      server.listen(socketPath, () => {
        this._server = server
        this.setState({ listening: true, socketPath })
        this.emit('listening')
        resolve(this)
      })
    })
  }

  /**
   * Stop the IPC server and clean up all connections.
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
   */
  send(msg: Record<string, any>): void {
    if (!this._client) {
      throw new Error('No app client connected')
    }
    this._client.socket.write(JSON.stringify(msg) + '\n')
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
      this.emit('error', err)
    })
  }

  /** Process a single NDJSON line. Handles commands; emits `message` for everything else. */
  private processLine(line: string): void {
    let msg: any
    try {
      msg = JSON.parse(line)
    } catch {
      return
    }

    if (msg.type === 'command') {
      this.handleCommand(msg)
      return
    }

    this.emit('message', msg)
  }

  /** Acknowledge, process, and finish a command. */
  private async handleCommand(cmd: any): Promise<void> {
    const id: string = cmd.id
    const text: string = cmd.payload?.text ?? ''

    this.setState({
      commandsReceived: (this.state.get('commandsReceived') ?? 0) + 1,
      processing: true,
      lastCommandText: text,
    })
    this.emit('commandReceived', cmd)

    // Acknowledge immediately with a random friendly message
    const ackMessage = ACK_MESSAGES[Math.floor(Math.random() * ACK_MESSAGES.length)]
    this.send({
      id,
      status: 'processing',
      speech: ackMessage,
      timestamp: new Date().toISOString(),
    })

    // "Do something" — sleep for now
    await new Promise((resolve) => setTimeout(resolve, this.options.sleepMs ?? 2000))

    // Mark finished
    this.send({
      id,
      status: 'finished',
      success: true,
      result: { action: 'completed', text },
      speech: 'Done.',
      timestamp: new Date().toISOString(),
    })

    this.setState({
      commandsCompleted: (this.state.get('commandsCompleted') ?? 0) + 1,
      processing: false,
    })
    this.emit('commandCompleted', cmd)
  }
}

export default features.register('launcherAppCommandListener', LauncherAppCommandListener)
