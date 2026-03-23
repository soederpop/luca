import { z } from 'zod'
import { FeatureStateSchema, FeatureEventsSchema } from '../../schemas/base.js'
import { Feature } from "../feature.js";
import { NodeContainer } from "../container.js";
import { Server, Socket } from "net";
import { existsSync } from "fs";

/**
 * Zod schema for the IpcSocket feature state.
 * Tracks the operational mode of the IPC socket (server or client).
 */
export const IpcStateSchema = FeatureStateSchema.extend({
  /** The current mode of the IPC socket - either 'server' or 'client' */
  mode: z.enum(['server', 'client']).optional().describe('The current mode of the IPC socket - either server or client'),
  /** The socket path this instance is listening on or connected to */
  socketPath: z.string().optional().describe('The socket path this instance is bound to'),
})
export type IpcState = z.infer<typeof IpcStateSchema>

export const IpcEventsSchema = FeatureEventsSchema.extend({
  connection: z.tuple([
    z.string().describe('The client ID assigned to the connection'),
    z.any().describe('The connected net.Socket instance'),
  ]).describe('Emitted on the server when a new client connects (clientId, socket)'),
  disconnection: z.tuple([
    z.string().describe('The client ID that disconnected'),
  ]).describe('Emitted on the server when a client disconnects'),
  message: z.tuple([
    z.any().describe('The parsed JSON message object received over the socket'),
    z.string().optional().describe('The client ID of the sender (server mode only)'),
  ]).describe('Emitted when a complete JSON message is received (data, clientId?)'),
})

/** Tracks a pending request awaiting a reply */
type PendingRequest = {
  resolve: (value: any) => void
  reject: (reason: any) => void
  timer: ReturnType<typeof setTimeout>
}

/** Metadata for a connected client */
type ClientInfo = {
  socket: Socket
  id: string
  name?: string
  connectedAt: number
}

/**
 * IpcSocket Feature - Inter-Process Communication via Unix Domain Sockets
 * 
 * This feature provides robust IPC (Inter-Process Communication) capabilities using Unix domain sockets.
 * It supports both server and client modes, allowing processes to communicate efficiently through
 * file system-based socket connections.
 * 
 * **Key Features:**
 * - Hub-and-spoke: one server, many named clients with identity tracking
 * - Targeted messaging: sendTo(clientId), broadcast(msg, excludeId)
 * - Request/reply: ask() + reply() with timeout-based correlation
 * - Auto-reconnect: clients reconnect with exponential backoff
 * - Stale socket detection: probeSocket() before listen()
 * - Clean shutdown: stopServer() removes socket file
 *
 * **Server (Hub):**
 * ```typescript
 * const ipc = container.feature('ipcSocket');
 * await ipc.listen('/tmp/hub.sock', true);
 *
 * ipc.on('connection', (clientId, socket) => {
 *   console.log('Client joined:', clientId);
 * });
 *
 * ipc.on('message', (data, clientId) => {
 *   console.log(`From ${clientId}:`, data);
 *   // Reply to sender, or ask and wait
 *   ipc.sendTo(clientId, { ack: true });
 * });
 * ```
 *
 * **Client (Spoke):**
 * ```typescript
 * const ipc = container.feature('ipcSocket');
 * await ipc.connect('/tmp/hub.sock', { reconnect: true, name: 'worker-1' });
 *
 * // Fire and forget
 * await ipc.send({ type: 'status', ready: true });
 *
 * // Request/reply
 * ipc.on('message', (data) => {
 *   if (data.requestId) ipc.reply(data.requestId, { result: 42 });
 * });
 * ```
 * 
 * @template T - The state type, defaults to IpcState
 * @extends {Feature<T>}
 */
export class IpcSocket<T extends IpcState = IpcState> extends Feature<T> {
  static { Feature.register(this, 'ipcSocket') }
  /** The shortcut path for accessing this feature */
  static override shortcut = "features.ipcSocket" as const
  static override stateSchema = IpcStateSchema
  static override eventsSchema = IpcEventsSchema

  /** The Node.js net Server instance (when in server mode) */
  server?: Server;

  /** Connected clients keyed by client ID (server mode only) */
  protected clients = new Map<string, ClientInfo>();

  /** Reverse lookup: socket → clientId */
  private _socketToClient = new WeakMap<Socket, string>();

  /** Per-socket NDJSON read buffers for accumulating partial lines */
  private _buffers = new WeakMap<Socket, string>();

  /** Pending request/reply correlation map */
  private _pending = new Map<string, PendingRequest>();

  /** Default timeout for ask() calls in ms */
  requestTimeoutMs = 10000;

  /** Reconnection config (client mode) */
  private _reconnect = { enabled: false, attempts: 0, maxAttempts: 10, delayMs: 1000, maxDelayMs: 30000, timer: null as ReturnType<typeof setTimeout> | null }
  private _socketPath?: string;

  /**
   * Attaches the IpcSocket feature to a NodeContainer instance.
   * Registers the feature and creates an auto-enabled instance.
   *
   * @param container - The NodeContainer to attach to
   * @returns The container for method chaining
   */
  static attach(container: NodeContainer & { ipcSocket?: IpcSocket }) {
    container.ipcSocket = container.feature("ipcSocket", { enable: true });
  }

  /**
   * Checks if the IPC socket is operating in client mode.
   *
   * @returns True if the socket is configured as a client
   */
  get isClient() {
    return this.state.get('mode') === 'client'
  }

  /**
   * Checks if the IPC socket is operating in server mode.
   *
   * @returns True if the socket is configured as a server
   */
  get isServer() {
    return this.state.get('mode') === 'server'
  }

  /**
   * Returns the number of currently connected clients (server mode).
   */
  get clientCount() {
    return this.clients.size
  }

  /**
   * Returns info about all connected clients (server mode).
   */
  get connectedClients(): Array<{ id: string; name?: string; connectedAt: number }> {
    return Array.from(this.clients.values()).map(({ id, name, connectedAt }) => ({ id, name, connectedAt }))
  }

  /**
   * Starts the IPC server listening on the specified socket path.
   * 
   * This method sets up a Unix domain socket server that can accept multiple client connections.
   * Each connected client is tracked, and the server automatically handles connection lifecycle
   * events. Messages received from clients are JSON-parsed and emitted as 'message' events.
   * 
   * **Server Behavior:**
   * - Tracks all connected clients in the sockets Set
   * - Automatically removes clients when they disconnect
   * - JSON-parses incoming messages and emits 'message' events
   * - Emits 'connection' events when clients connect
   * - Prevents starting multiple servers on the same instance
   * 
   * **Socket File Management:**
   * - Resolves the socket path relative to the container's working directory
   * - Optionally removes existing socket files to prevent "address in use" errors
   * - Throws error if socket file exists and removeLock is false
   * 
   * @param socketPath - The file system path for the Unix domain socket
   * @param removeLock - Whether to remove existing socket file (default: false)
   * @returns Promise resolving to the created Node.js Server instance
   * 
   * @throws {Error} When already in client mode, server already running, or socket file exists
   * 
   * @example
   * ```typescript
   * // Basic server setup
   * const server = await ipc.listen('/tmp/myapp.sock');
   * 
   * // With automatic lock removal
   * const server = await ipc.listen('/tmp/myapp.sock', true);
   * 
   * // Handle connections and messages
   * ipc.on('connection', (socket) => {
   *   console.log('New client connected');
   * });
   * 
   * ipc.on('message', (data) => {
   *   console.log('Received message:', data);
   *   // Echo back to all clients
   *   ipc.broadcast({ echo: data });
   * });
   * ```
   */
  async listen(socketPath: string, removeLock = false): Promise<Server> {
    socketPath = this.container.paths.resolve(socketPath)

    if (existsSync(socketPath)) {
      if (removeLock) {
        const alive = await this.probeSocket(socketPath)
        if (alive) {
          throw new Error(`Socket ${socketPath} is already in use by a live process`)
        }
        await this.container.fs.rm(socketPath)
      } else {
        throw new Error('Lock already exists')
      }
    }

    if(this.isClient) {
      throw new Error("Cannot listen on a client socket.");
    }

    this.state.set('mode', 'server')
    this.state.set('socketPath', socketPath)
    this._socketPath = socketPath

    if (this.server) {
      throw new Error("An IPC server is already running.");
    }

    this.server = new Server((socket) => {
      const clientId = this.container.utils.uuid()
      const clientInfo: ClientInfo = { socket, id: clientId, connectedAt: Date.now() }
      this.clients.set(clientId, clientInfo)
      this._socketToClient.set(socket, clientId)
      this._buffers.set(socket, '');

      // Send the client its assigned ID
      socket.write(JSON.stringify({ type: '__ipc:welcome', clientId }) + '\n')

      socket.on("close", () => {
        this.clients.delete(clientId);
        this.emit('disconnection', clientId)
      });

      socket.on('data', (chunk) => {
        this._handleChunk(socket, chunk)
      })

      this.emit('connection', clientId, socket)
    });

    this.server.listen(socketPath);

    return this.server;
  }

  /**
   * Stops the IPC server and cleans up all connections.
   * 
   * This method gracefully shuts down the server by:
   * 1. Closing the server listener
   * 2. Destroying all active client connections
   * 3. Clearing the sockets tracking set
   * 4. Resetting the server instance
   * 
   * @returns Promise that resolves when the server is fully stopped
   * 
   * @throws {Error} When no server is currently running
   * 
   * @example
   * ```typescript
   * // Graceful shutdown
   * try {
   *   await ipc.stopServer();
   *   console.log('IPC server stopped successfully');
   * } catch (error) {
   *   console.error('Failed to stop server:', error.message);
   * }
   * ```
   */
  stopServer(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        reject(new Error("No IPC server is running."));
        return;
      }

      this.server.close((err) => {
        // Clean up socket file
        if (this._socketPath && existsSync(this._socketPath)) {
          try { this.container.fs.rm(this._socketPath) } catch {}
        }
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });

      for (const { socket } of this.clients.values()) {
        socket.destroy()
      }
      this.clients.clear();
      this._pending.forEach(({ timer }) => clearTimeout(timer))
      this._pending.clear()
      this.server = undefined;
    });
  }

  /** The client connection socket (client mode only) */
  _connection?: Socket

  /**
   * Gets the current client connection socket.
   * 
   * @returns The active Socket connection, or undefined if not connected
   */
  get connection() {
    return this._connection
  }

  /**
   * Broadcasts a message to all connected clients (server mode only).
   *
   * @param message - The message object to broadcast
   * @param exclude - Optional client ID to exclude from broadcast
   * @returns This instance for method chaining
   */
  broadcast(message: any, exclude?: string) {
    const envelope = JSON.stringify({
      data: message,
      id: this.container.utils.uuid()
    }) + '\n'

    for (const [clientId, { socket }] of this.clients) {
      if (clientId === exclude) continue
      if (!socket.writable) continue
      socket.write(envelope)
    }

    return this
  }

  /**
   * Sends a message to a specific client by ID (server mode only).
   *
   * @param clientId - The target client ID
   * @param message - The message to send
   * @returns True if the message was sent, false if client not found or not writable
   */
  sendTo(clientId: string, message: any): boolean {
    const client = this.clients.get(clientId)
    if (!client || !client.socket.writable) return false

    client.socket.write(JSON.stringify({
      data: message,
      id: this.container.utils.uuid()
    }) + '\n')

    return true
  }

  /**
   * Fire-and-forget: sends a message to the server (client mode only).
   * For server→client, use sendTo() or broadcast().
   *
   * @param message - The message to send
   */
  async send(message: any) {
    if(!this._connection) {
      throw new Error("No connection.")
    }

    const id = this.container.utils.uuid()
    this._connection.write(JSON.stringify({ id, data: message }) + '\n')
  }

  /**
   * Sends a message and waits for a correlated reply.
   * Works in both client and server mode.
   *
   * The recipient should call `reply(requestId, response)` to respond.
   *
   * @param message - The message to send
   * @param options - Optional: clientId (server mode target), timeoutMs
   * @returns The reply data
   */
  async ask(message: any, options?: { clientId?: string; timeoutMs?: number }): Promise<any> {
    const requestId = this.container.utils.uuid()
    const timeoutMs = options?.timeoutMs ?? this.requestTimeoutMs

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this._pending.delete(requestId)
        reject(new Error(`IPC ask timed out after ${timeoutMs}ms`))
      }, timeoutMs)

      this._pending.set(requestId, { resolve, reject, timer })

      const envelope = JSON.stringify({
        id: requestId,
        data: message,
        requestId,
      }) + '\n'

      if (this.isServer) {
        const clientId = options?.clientId
        if (!clientId) {
          clearTimeout(timer)
          this._pending.delete(requestId)
          reject(new Error('ask() in server mode requires options.clientId'))
          return
        }
        const client = this.clients.get(clientId)
        if (!client || !client.socket.writable) {
          clearTimeout(timer)
          this._pending.delete(requestId)
          reject(new Error(`Client ${clientId} not found or not writable`))
          return
        }
        client.socket.write(envelope)
      } else {
        if (!this._connection) {
          clearTimeout(timer)
          this._pending.delete(requestId)
          reject(new Error('No connection'))
          return
        }
        this._connection.write(envelope)
      }
    })
  }

  /**
   * Sends a reply to a previous ask() call, correlated by requestId.
   *
   * @param requestId - The requestId from the incoming message
   * @param data - The reply payload
   * @param clientId - Target client (server mode; for client mode, omit)
   */
  reply(requestId: string, data: any, clientId?: string) {
    const envelope = JSON.stringify({
      id: this.container.utils.uuid(),
      data,
      replyTo: requestId,
    }) + '\n'

    if (this.isServer && clientId) {
      const client = this.clients.get(clientId)
      if (client?.socket.writable) {
        client.socket.write(envelope)
      }
    } else if (this._connection) {
      this._connection.write(envelope)
    }
  }

  /** The server-assigned client ID (client mode only) */
  clientId?: string;

  /**
   * Connects to an IPC server at the specified socket path (client mode).
   *
   * @param socketPath - Path to the server's Unix domain socket
   * @param options - Optional: reconnect (enable auto-reconnect), name (identify this client)
   * @returns The established Socket connection
   */
  async connect(socketPath: string, options?: { reconnect?: boolean; name?: string }): Promise<Socket> {
    if(this.isServer) {
      throw new Error("Cannot connect on a server socket.")
    }

    if(this._connection) {
      return this._connection
    }

    this._socketPath = socketPath
    this.state.set('socketPath', socketPath)

    if (options?.reconnect !== undefined) {
      this._reconnect.enabled = options.reconnect
    }

    const connection: Socket = await this._doConnect(socketPath)

    connection.on("close", () => {
      this._connection = undefined
      this.clientId = undefined
      if (this._reconnect.enabled) {
        this._scheduleReconnect()
      }
    })

    this._buffers.set(connection, '');
    connection.on("data", (chunk) => {
      this._handleChunk(connection, chunk)
    })

    this._connection = connection
    this._reconnect.attempts = 0

    // Send identity if a name was provided
    if (options?.name) {
      connection.write(JSON.stringify({
        id: this.container.utils.uuid(),
        data: { type: '__ipc:identify', name: options.name }
      }) + '\n')
    }

    return connection
  }

  private _doConnect(socketPath: string): Promise<Socket> {
    return new Promise((resolve, reject) => {
      const socket = new Socket();
      socket.connect(socketPath, () => resolve(socket));
      socket.on("error", (err) => reject(err));
    })
  }

  private _scheduleReconnect() {
    if (this._reconnect.timer) return
    if (this._reconnect.attempts >= this._reconnect.maxAttempts) {
      this.emit('message', { type: '__ipc:reconnect_failed', attempts: this._reconnect.attempts })
      return
    }

    const delay = Math.min(
      this._reconnect.delayMs * Math.pow(2, this._reconnect.attempts),
      this._reconnect.maxDelayMs
    )
    this._reconnect.attempts++

    this._reconnect.timer = setTimeout(async () => {
      this._reconnect.timer = null
      if (!this._socketPath) return

      try {
        await this.connect(this._socketPath)
      } catch {
        this._scheduleReconnect()
      }
    }, delay)
  }

  /**
   * Disconnects the client and stops any reconnection attempts.
   */
  disconnect() {
    this._reconnect.enabled = false
    if (this._reconnect.timer) {
      clearTimeout(this._reconnect.timer)
      this._reconnect.timer = null
    }
    if (this._connection) {
      this._connection.destroy()
      this._connection = undefined
    }
    this._pending.forEach(({ timer }) => clearTimeout(timer))
    this._pending.clear()
  }

  /**
   * Probe an existing socket to see if a live listener is behind it.
   * Attempts a quick connect — if it succeeds, someone is listening.
   */
  probeSocket(socketPath: string): Promise<boolean> {
    if (!existsSync(socketPath)) return Promise.resolve(false)
    return new Promise<boolean>((resolve) => {
      const probe = new Socket()
      const timer = setTimeout(() => {
        probe.destroy()
        resolve(false)
      }, 500)

      probe.once('connect', () => {
        clearTimeout(timer)
        probe.destroy()
        resolve(true)
      })

      probe.once('error', () => {
        clearTimeout(timer)
        probe.destroy()
        resolve(false)
      })

      probe.connect(socketPath)
    })
  }

  private _handleChunk(socket: Socket, chunk: Buffer): void {
    let buffer = (this._buffers.get(socket) || '') + chunk.toString()
    const lines = buffer.split('\n')
    this._buffers.set(socket, lines.pop() || '')

    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const parsed = JSON.parse(line)

        // Handle protocol messages
        if (parsed.type === '__ipc:welcome' && parsed.clientId) {
          this.clientId = parsed.clientId
          this.state.set('mode', 'client')
          continue
        }

        if (parsed.data?.type === '__ipc:identify' && this.isServer) {
          const clientId = this._socketToClient.get(socket)
          if (clientId) {
            const client = this.clients.get(clientId)
            if (client) client.name = parsed.data.name
          }
          continue
        }

        // Handle reply correlation
        const replyTo = parsed.replyTo
        if (replyTo && this._pending.has(replyTo)) {
          const pending = this._pending.get(replyTo)!
          this._pending.delete(replyTo)
          clearTimeout(pending.timer)
          pending.resolve(parsed.data)
          continue
        }

        // Regular message — include sender clientId in server mode
        const clientId = this._socketToClient.get(socket)
        this.emit('message', parsed.data ?? parsed, clientId)
      } catch {
        // Malformed JSON line — skip
      }
    }
  }
}

export default IpcSocket