import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'
import { Feature, features } from "../feature.js";
import vm from 'vm'
import readline from 'readline'
import { inspect } from 'util'

export const ReplStateSchema = FeatureStateSchema.extend({
  started: z.boolean().optional().describe('Whether the REPL server has been started'),
})
export type ReplState = z.infer<typeof ReplStateSchema>

export const ReplOptionsSchema = FeatureOptionsSchema.extend({
  prompt: z.string().optional().describe('The prompt string to display in the REPL (default: "> ")'),
  historyPath: z.string().optional().describe('Path to the REPL history file for command persistence'),
})
export type ReplOptions = z.infer<typeof ReplOptionsSchema>

/**
 * REPL feature — provides an interactive read-eval-print loop with tab completion and history.
 *
 * Launches a REPL session that evaluates JavaScript/TypeScript expressions in a sandboxed
 * VM context populated with the container and its helpers. Supports tab completion for
 * dot-notation property access, command history persistence, and async/await.
 *
 * @example
 * ```typescript
 * const repl = container.feature('repl', { enable: true })
 * await repl.start({ context: { myVar: 42 } })
 * ```
 */
export class Repl<
  T extends ReplState = ReplState,
  K extends ReplOptions = ReplOptions
> extends Feature<T, K> {
  static override shortcut = "features.repl" as const
  static override stateSchema = ReplStateSchema
  static override optionsSchema = ReplOptionsSchema

  /** Whether the REPL session is currently running. */
  get isStarted() {
    return !!this.state.get("started");
  }

  _rl?: readline.Interface
  _vmContext?: vm.Context
  _history: string[] = []
  _historyPath?: string

  /** The VM context object used for evaluating expressions in the REPL. */
  get vmContext() {
    return this._vmContext
  }

  /**
   * Start the REPL session.
   *
   * Creates a VM context populated with the container and its helpers, sets up
   * readline with tab completion and history, then enters the interactive loop.
   * Type `.exit` or `exit` to quit. Supports top-level await.
   *
   * @param options - Configuration for the REPL session
   * @param options.historyPath - Custom path for the history file (defaults to node_modules/.cache/.repl_history)
   * @param options.context - Additional variables to inject into the VM context
   * @returns The Repl instance
   *
   * @example
   * ```typescript
   * const repl = container.feature('repl', { enable: true })
   * await repl.start({
   *   context: { db: myDatabase },
   *   historyPath: '.repl-history'
   * })
   * ```
   */
  async start(options: { historyPath?: string, context?: any } = {}) {
    if (this.isStarted) {
      return this;
    }

    const { prompt = "> " } = this.options;

    // Set up history file
    const userHistoryPath = options.historyPath || this.options.historyPath
    this._historyPath = typeof userHistoryPath === 'string'
      ? this.container.paths.resolve(userHistoryPath)
      : this.container.paths.resolve('node_modules', '.cache', '.repl_history')

    this.container.fs.ensureFolder(this.container.paths.dirname(this._historyPath))

    // Load existing history
    try {
      const content = fs.readFileSync(this._historyPath, 'utf-8')
      this._history = content.split('\n').filter(Boolean).reverse()
    } catch {}

    // Build VM context
    this._vmContext = vm.createContext({
      ...this.container.context,
      ...options.context,
      // @ts-ignore
      client: (...args: any[]) => this.container.client(...args),
    })

    // Completer for tab autocomplete
    const ctx = this._vmContext!
    const completer = (line: string): [string[], string] => {
      // Dot-notation: e.g. container.fea<tab>
      const dotMatch = line.match(/([a-zA-Z_$][\w$]*(?:\.[a-zA-Z_$][\w$]*)*)\.([a-zA-Z_$][\w$]*)?$/)
      if (dotMatch) {
        const objPath = dotMatch[1]!
        const partial = dotMatch[2] || ''
        try {
          const obj = new vm.Script(objPath).runInContext(ctx)
          if (obj != null && typeof obj === 'object') {
            const own = Object.keys(obj)
            const proto = Object.getOwnPropertyNames(Object.getPrototypeOf(obj) || {})
            const all = [...new Set([...own, ...proto])]
              .filter(p => p.startsWith(partial))
              .sort()
              .map(p => `${objPath}.${p}`)
            return [all, dotMatch[0]!]
          }
        } catch {}
        return [[], line]
      }

      // Top-level identifiers
      const idMatch = line.match(/([a-zA-Z_$][\w$]*)$/)
      const partial = idMatch ? idMatch[1]! : ''
      const keys = Object.keys(ctx).filter(k => k.startsWith(partial)).sort()
      return [keys, partial]
    }

    // Create readline interface
    this._rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
      history: this._history,
      completer,
    })

    this.state.set('started', true)

    // REPL loop
    let lastResult: any
    const ask = (): void => {
      this._rl!.question(prompt, async (input) => {
        const trimmed = input.trim()
        if (!trimmed) { ask(); return }
        if (trimmed === '.exit' || trimmed === 'exit') {
          this._saveHistory(input)
          this._rl!.close()
          return
        }

        this._saveHistory(input)

        try {
          const script = new vm.Script(trimmed)
          let result = script.runInContext(ctx)

          if (result && typeof result.then === 'function') {
            result = await result
          }

          lastResult = result
          ctx._ = lastResult

          if (result !== undefined) {
            if (typeof result === 'object' && result !== null) {
              console.log(inspect(result, { colors: true, depth: 4 }))
            } else {
              console.log(result)
            }
          }
        } catch (err: any) {
          console.log(`\x1b[31mError: ${err.message}\x1b[0m`)
        }

        ask()
      })
    }

    ask()
    return this;
  }

  private _saveHistory(line: string) {
    if (!this._historyPath || !line.trim()) return
    try {
      fs.appendFileSync(this._historyPath, line + '\n')
    } catch {}
  }
}

export default features.register("repl", Repl);
