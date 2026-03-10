import { z } from 'zod'
import { FeatureStateSchema, FeatureEventsSchema } from '../../schemas/base.js'
import { Feature } from "../feature.js";
import { NodeContainer } from "../container.js";
import { Server, Socket } from "net";

/**
 * Zod schema for the IpcSocket feature state.
 * Tracks the operational mode of the IPC socket (server or client).
 */
export const IpcStateSchema = FeatureStateSchema.extend({
  /** The current mode of the IPC socket - either 'server' or 'client' */
  mode: z.enum(['server', 'client']).optional().describe('The current mode of the IPC socket - either server or client'),
})
export type IpcState = z.infer<typeof IpcStateSchema>

export const IpcEventsSchema = FeatureEventsSchema.extend({
  connection: z.tuple([
    z.any().describe('The connected net.Socket instance'),
  ]).describe('Emitted on the server when a new client connects'),
  message: z.tuple([
    z.any().describe('The parsed JSON message object received over the socket'),
  ]).describe('Emitted when a complete JSON message is received (server or client)'),
})

/**
 * IpcSocket Feature - Inter-Process Communication via Unix Domain Sockets
 * 
 * This feature provides robust IPC (Inter-Process Communication) capabilities using Unix domain sockets.
 * It supports both server and client modes, allowing processes to communicate efficiently through
 * file system-based socket connections.
 * 
 * **Key Features:**
 * - Dual-mode operation: server and client functionality
 * - JSON message serialization/deserialization
 * - Multiple client connection support (server mode)
 * - Event-driven message handling
 * - Automatic socket cleanup and management
 * - Broadcast messaging to all connected clients
 * - Lock file management for socket paths
 * 
 * **Communication Pattern:**
 * - Messages are automatically JSON-encoded with unique IDs
 * - Both server and client emit 'message' events for incoming data
 * - Server can broadcast to all connected clients
 * - Client maintains single connection to server
 * 
 * **Socket Management:**
 * - Automatic cleanup of stale socket files
 * - Connection tracking and management
 * - Graceful shutdown procedures
 * - Lock file protection against conflicts
 * 
 * **Usage Examples:**
 * 
 * **Server Mode:**
 * ```typescript
 * const ipc = container.feature('ipcSocket');
 * await ipc.listen('/tmp/myapp.sock', true); // removeLock=true
 * 
 * ipc.on('connection', (socket) => {
 *   console.log('Client connected');
 * });
 * 
 * ipc.on('message', (data) => {
 *   console.log('Received:', data);
 *   ipc.broadcast({ reply: 'ACK', original: data });
 * });
 * ```
 * 
 * **Client Mode:**
 * ```typescript
 * const ipc = container.feature('ipcSocket');
 * await ipc.connect('/tmp/myapp.sock');
 * 
 * ipc.on('message', (data) => {
 *   console.log('Server says:', data);
 * });
 * 
 * await ipc.send({ type: 'request', payload: 'hello' });
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

  /** Set of connected client sockets (server mode only) */
  protected sockets: Set<Socket> = new Set();

  /** Per-socket NDJSON read buffers for accumulating partial lines */
  private _buffers = new WeakMap<Socket, string>();

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

    if (this.container.fs.exists(socketPath)) {
      if(removeLock) {
        await this.container.fs.rm(socketPath)
      } else {
        throw new Error('Lock already exists')
      }
    }

    if(this.isClient) {
      throw new Error("Cannot listen on a client socket.");
    }

    this.state.set('mode', 'server')

    if (this.server) {
      throw new Error("An IPC server is already running.");
    }

    this.server = new Server((socket) => {
      this.sockets.add(socket);
      this._buffers.set(socket, '');

      socket.on("close", () => {
        this.sockets.delete(socket);
      });

      socket.on('data', (chunk) => {
        this._handleChunk(socket, chunk)
      })

      this.emit('connection', socket)
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
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });

      this.sockets.forEach((socket) => socket.destroy());
      this.sockets.clear();
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
   * This method sends a JSON-encoded message with a unique ID to every client
   * currently connected to the server. Each message is automatically wrapped
   * with metadata including a UUID for tracking.
   * 
   * **Message Format:**
   * Messages are automatically wrapped in the format:
   * ```json
   * {
   *   "data": <your_message>,
   *   "id": "<uuid>"
   * }
   * ```
   * 
   * @param message - The message object to broadcast to all clients
   * @returns This instance for method chaining
   * 
   * @example
   * ```typescript
   * // Broadcast to all connected clients
   * ipc.broadcast({ 
   *   type: 'notification',
   *   message: 'Server is shutting down in 30 seconds',
   *   timestamp: Date.now()
   * });
   * 
   * // Chain multiple operations
   * ipc.broadcast({ status: 'ready' })
   *    .broadcast({ time: new Date().toISOString() });
   * ```
   */
  broadcast(message: any) {
    this.sockets.forEach((socket) => socket.write(JSON.stringify({
      data: message,
      id: this.container.utils.uuid()
    }) + '\n'))

    return this
  }

  /**
   * Sends a message to the server (client mode only).
   * 
   * This method sends a JSON-encoded message with a unique ID to the connected server.
   * The message is automatically wrapped with metadata for tracking purposes.
   * 
   * **Message Format:**
   * Messages are automatically wrapped in the format:
   * ```json
   * {
   *   "data": <your_message>,
   *   "id": "<uuid>"
   * }
   * ```
   * 
   * @param message - The message object to send to the server
   * @returns Promise that resolves when the message is sent
   * 
   * @throws {Error} When no connection is established
   * 
   * @example
   * ```typescript
   * // Send a simple message
   * await ipc.send({ type: 'ping' });
   * 
   * // Send complex data
   * await ipc.send({
   *   type: 'data_update',
   *   payload: { users: [...], timestamp: Date.now() }
   * });
   * ```
   */
  async send(message: any) {
    const id = this.container.utils.uuid()

    if(!this._connection) {
      throw new Error("No connection.")
    }
    
    this._connection.write(JSON.stringify({ id, data: message }) + '\n')
  }

  /**
   * Connects to an IPC server at the specified socket path (client mode).
   * 
   * This method establishes a client connection to an existing IPC server.
   * Once connected, the client can send messages to the server and receive
   * responses. The connection is maintained until explicitly closed or the
   * server terminates.
   * 
   * **Connection Behavior:**
   * - Sets the socket mode to 'client'
   * - Returns existing connection if already connected
   * - Automatically handles connection events and cleanup
   * - JSON-parses incoming messages and emits 'message' events
   * - Cleans up connection reference when socket closes
   * 
   * **Error Handling:**
   * - Throws error if already in server mode
   * - Rejects promise on connection failures
   * - Automatically cleans up on connection close
   * 
   * @param socketPath - The file system path to the server's Unix domain socket
   * @returns Promise resolving to the established Socket connection
   * 
   * @throws {Error} When already in server mode or connection fails
   * 
   * @example
   * ```typescript
   * // Connect to server
   * const socket = await ipc.connect('/tmp/myapp.sock');
   * console.log('Connected to IPC server');
   * 
   * // Handle incoming messages
   * ipc.on('message', (data) => {
   *   console.log('Server message:', data);
   * });
   * 
   * // Send messages
   * await ipc.send({ type: 'hello', client_id: 'client_001' });
   * ```
   */
  async connect(socketPath: string): Promise<Socket> {
    if(this.isServer) {
      throw new Error("Cannot connect on a server socket.")
    }

    if(this._connection) {
      return this._connection
    }

    const connection : Socket = await new Promise((resolve, reject) => {
      const socket = new Socket();
      socket.connect(socketPath, () => {
        resolve(socket);
      });

      socket.on("error", (err) => {
        reject(err);
      });
    });
    
    connection.on("close", () => {
      this._connection = undefined
    })

    this._buffers.set(connection, '');
    connection.on("data", (chunk) => {
      this._handleChunk(connection, chunk)
    })

    return this._connection = connection as Socket
  }

  /**
   * Accumulates incoming data into a per-socket buffer and emits
   * a `message` event for each complete NDJSON line (newline-delimited JSON).
   *
   * This handles the common stream framing issues:
   * - Partial messages split across multiple `data` events
   * - Multiple messages arriving in a single `data` event
   * - Malformed lines (silently skipped)
   *
   * @param socket - The socket the data arrived on
   * @param chunk - The raw data chunk
   */
  private _handleChunk(socket: Socket, chunk: Buffer): void {
    let buffer = (this._buffers.get(socket) || '') + chunk.toString()
    const lines = buffer.split('\n')
    // Last element is either empty (if chunk ended with \n) or an incomplete line
    this._buffers.set(socket, lines.pop() || '')

    for (const line of lines) {
      if (!line.trim()) continue
      try {
        this.emit('message', JSON.parse(line))
      } catch {
        // Malformed JSON line — skip
      }
    }
  }
}

export default IpcSocket