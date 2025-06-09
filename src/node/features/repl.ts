import { Feature, type FeatureOptions, type FeatureState, features } from "../feature.js";
import vm from 'vm'

/**
 * Starts a Node.js REPL server with the provided options.
 * 
 * @param options - Configuration options for the REPL server
 * @returns Promise resolving to the started REPL server instance
 */
async function start(options: any) {
  const repl = await import('node:repl')
  return repl.start(options)
}

/**
 * State interface for the Repl feature.
 * Tracks whether the REPL server has been started.
 * 
 * @interface ReplState
 * @extends {FeatureState}
 */
export interface ReplState extends FeatureState {
  /** Whether the REPL server has been started */
  started?: boolean;
}

/**
 * Configuration options for the Repl feature.
 * 
 * @interface ReplOptions
 * @extends {FeatureOptions}
 */
export interface ReplOptions extends FeatureOptions {
  /** The prompt string to display in the REPL (default: "> ") */
  prompt?: string;
  /** Path to the REPL history file for command persistence */
  historyPath?: string;
}

/**
 * Repl Feature - Interactive Node.js REPL (Read-Eval-Print Loop) server
 * 
 * This feature provides a fully-featured REPL server with support for:
 * - Custom evaluation context with container access
 * - Persistent command history
 * - Promise-aware evaluation (async/await support)
 * - Customizable prompts and settings
 * - Integration with the container's context and features
 * 
 * The REPL runs in a sandboxed VM context but provides access to the container
 * and all its features, making it perfect for interactive debugging and exploration.
 * 
 * **Key Features:**
 * - VM-based evaluation for security
 * - Automatic promise resolution in REPL output
 * - Persistent history across sessions
 * - Full container context access
 * - Colored terminal output support
 * 
 * **Usage Example:**
 * ```typescript
 * const repl = container.feature('repl');
 * await repl.start({
 *   historyPath: '.repl_history',
 *   context: { customVar: 'value' }
 * });
 * // REPL is now running and accessible
 * ```
 * 
 * @template T - The state type, defaults to ReplState
 * @template K - The options type, defaults to ReplOptions
 * @extends {Feature<T, K>}
 */
export class Repl<
  T extends ReplState = ReplState,
  K extends ReplOptions = ReplOptions
> extends Feature<T, K> {
  /** The shortcut path for accessing this feature */
  static override shortcut = "features.repl" as const

  /**
   * Checks if the REPL server has been started.
   * 
   * @returns True if the REPL server is currently running
   */
  get isStarted() {
    return !!this.state.get("started");
  }

  /** The internal REPL server instance */
  _server?: ReturnType<typeof start> 

  /**
   * Creates and configures a new REPL server instance.
   * 
   * This method sets up the REPL with custom evaluation logic that:
   * - Runs code in a VM context for isolation
   * - Automatically handles Promise resolution
   * - Provides colored terminal output
   * - Uses the configured prompt
   * 
   * The REPL evaluation supports both synchronous and asynchronous code execution,
   * automatically detecting and awaiting Promises in the result.
   * 
   * @returns Promise resolving to the configured REPL server
   * 
   * @example
   * ```typescript
   * const server = await repl.createServer();
   * // Server is configured but not yet listening
   * ```
   */
  async createServer() {
    if (this._server) {
      return this._server
    }

    const { prompt = "> " } = this.options;
    const server = start({
      useGlobal: false,
      useColors: true,
      terminal: true,
      prompt,
      eval: (
        command: string,
        context: any,
        file: string,
        cb: (err: any, result: any) => void
      ) => {
        const script = new vm.Script(command);
        const result = script.runInContext(context);

        if (typeof result?.then === "function") {
          result
            .then((result: any) => cb(null, result))
            .catch((e: any) => cb(null, e));
        } else {
          cb(null, result);
        }
      },
    });
   
    return this._server = server
  }

  /**
   * Starts the REPL server with the specified configuration.
   * 
   * This method initializes the REPL server, sets up command history persistence,
   * and configures the evaluation context. The context includes:
   * - All container features and properties
   * - Custom context variables passed in options
   * - Helper functions like `client()` for creating clients
   * 
   * **History Management:**
   * - Creates history file directory if it doesn't exist
   * - Uses provided historyPath or defaults to node_modules/.cache/.repl_history
   * - Persists command history across sessions
   * 
   * **Context Setup:**
   * - Inherits full container context
   * - Adds custom context variables
   * - Provides convenience methods for container interaction
   * 
   * @param options - Configuration options for starting the REPL
   * @param options.historyPath - Custom path for history file storage
   * @param options.context - Additional context variables to expose in REPL
   * @param options.exclude - Properties to exclude from context (unused currently)
   * @returns Promise resolving to this instance for chaining
   * 
   * @throws {Error} When REPL is already started or history setup fails
   * 
   * @example
   * ```typescript
   * // Basic usage
   * await repl.start();
   * 
   * // With custom history and context
   * await repl.start({
   *   historyPath: './my-repl-history',
   *   context: { myVar: 'available in REPL' }
   * });
   * 
   * // In the REPL:
   * // > container.feature('fileManager')
   * // > client('httpClient', { baseURL: 'https://api.example.com' })
   * // > myVar  // 'available in REPL'
   * ```
   */
  async start(options: { historyPath?: string, context?: any, exclude?: string | string[] } = {}) {
    if (this.isStarted) {
      return this;
    }
    
    const userHistoryPath = options.historyPath || this.options.historyPath
    
    const historyPath = typeof userHistoryPath === 'string' 
      ? this.container.paths.resolve(userHistoryPath)
      : this.container.paths.resolve('node_modules', '.cache', '.repl_history')
    
    this.container.fs.ensureFolder(this.container.paths.dirname(historyPath))
    //await this.container.fs.ensureFileAsync(historyPath, '', false)
   
    const server = await this.createServer()

    await new Promise((res,rej) => {
      server.setupHistory(historyPath, (err) => {
        err ? rej(err) : res(true)
      })
    })
    
    Object.assign(server.context, this.container.context, options.context || {}, {
      // @ts-ignore-next-line
      client: (...args) => this.container.client(...args)
    })

    return this;
  }
}

export default features.register("repl", Repl);
