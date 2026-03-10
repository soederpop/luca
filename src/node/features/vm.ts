import { z } from 'zod'
import { createRequire } from 'module'
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'
import vm from 'vm'
import { Feature } from "../feature.js";

export const VMStateSchema = FeatureStateSchema.extend({})
export type VMState = z.infer<typeof VMStateSchema>

export const VMOptionsSchema = FeatureOptionsSchema.extend({
  /** Default context object to inject into the VM execution environment */
  context: z.any().describe('Default context object to inject into the VM execution environment'),
})
export type VMOptions = z.infer<typeof VMOptionsSchema>

/**
 * The VM feature provides Node.js virtual machine capabilities for executing JavaScript code.
 * 
 * This feature wraps Node.js's built-in `vm` module to provide secure code execution
 * in isolated contexts. It's useful for running untrusted code, creating sandboxed
 * environments, or dynamically executing code with controlled access to variables and modules.
 * 
 * @example
 * ```typescript
 * const vm = container.feature('vm')
 * 
 * // Execute simple code
 * const result = vm.run('1 + 2 + 3')
 * console.log(result) // 6
 * 
 * // Execute code with custom context
 * const result2 = vm.run('greeting + " " + name', { 
 *   greeting: 'Hello', 
 *   name: 'World' 
 * })
 * console.log(result2) // 'Hello World'
 * ```
 * 
 * @extends Feature
 */
export class VM<
  T extends VMState = VMState,
  K extends VMOptions = VMOptions
> extends Feature<T, K> {
  static { Feature.register(this, 'vm') }
  static override shortcut = "features.vm" as const
  static override stateSchema = VMStateSchema
  static override optionsSchema = VMOptionsSchema

  /** Map of virtual module IDs to their exports, consulted before Node's native require */
  modules: Map<string, any> = new Map()

  /**
   * Register a virtual module that will be available to `require()` inside VM-executed code.
   * Modules registered here take precedence over Node's native resolution.
   *
   * @param id - The module specifier (e.g. `'@soederpop/luca'`, `'zod'`)
   * @param exports - The module's exports object
   *
   * @example
   * ```typescript
   * const vm = container.feature('vm')
   * vm.defineModule('@soederpop/luca', { Container, Feature, fs, proc })
   * vm.defineModule('zod', { z })
   *
   * // Now loadModule can resolve these in user code:
   * // import { Container } from '@soederpop/luca'  → works
   * ```
   */
  defineModule(id: string, exports: any) {
    this.modules.set(id, exports)
  }

  /**
   * Build a require function that resolves from the virtual modules map first,
   * falling back to Node's native `createRequire` for everything else.
   *
   * @param filePath - The file path to scope native require resolution to
   * @returns A require function with `.resolve` preserved from the native require
   */
  createRequireFor(filePath: string) {
    const nodeRequire = createRequire(filePath)
    const modules = this.modules

    const customRequire = (id: string) => {
      if (modules.has(id)) return modules.get(id)
      return nodeRequire(id)
    }

    customRequire.resolve = nodeRequire.resolve.bind(nodeRequire)
    return customRequire
  }

  /**
   * Creates a new VM script from the provided code.
   * 
   * This method compiles JavaScript code into a VM script that can be executed
   * multiple times in different contexts. The script is pre-compiled for better
   * performance when executing the same code repeatedly.
   * 
   * @param {string} code - The JavaScript code to compile into a script
   * @param {vm.ScriptOptions} [options] - Options for script compilation
   * @returns {vm.Script} A compiled VM script ready for execution
   * 
   * @example
   * ```typescript
   * const script = vm.createScript('Math.max(a, b)')
   * 
   * // Execute the script multiple times with different contexts
   * const result1 = script.runInContext(vm.createContext({ a: 5, b: 3 }))
   * const result2 = script.runInContext(vm.createContext({ a: 10, b: 20 }))
   * ```
   */
  createScript(code: string, options?: vm.ScriptOptions) {
    return new vm.Script(code, {
      ...options
    })
  }
 
  /**
   * Check whether an object has already been contextified by `vm.createContext()`.
   *
   * Useful to avoid double-contextifying when you're not sure if the caller
   * passed a plain object or an existing context.
   *
   * @param ctx - The object to check
   * @returns True if the object is a VM context
   *
   * @example
   * ```typescript
   * const ctx = vm.createContext({ x: 1 })
   * vm.isContext(ctx)   // true
   * vm.isContext({ x: 1 }) // false
   * ```
   */
  isContext(ctx: unknown): ctx is vm.Context {
    return typeof ctx === 'object' && ctx !== null && vm.isContext(ctx as vm.Context)
  }

  /**
   * Create an isolated JavaScript execution context.
   *
   * Combines the container's context with any additional variables provided.
   * If the input is already a VM context, it is returned as-is.
   *
   * @param ctx - Additional context variables to include
   * @returns A VM context ready for script execution
   *
   * @example
   * ```typescript
   * const context = vm.createContext({ user: { name: 'John' } })
   * const result = vm.runSync('user.name', context)
   * ```
   */
  createContext(ctx: any = {}) {
    if (this.isContext(ctx)) return ctx
    return vm.createContext({
      ...this.container.context,
      ...ctx
    })
  }
  
  /**
   * Executes JavaScript code in a controlled environment.
   * 
   * This method creates a script from the provided code, sets up an execution context
   * with the specified variables, and runs the code safely. It handles errors gracefully
   * and returns either the result or the error object.
   * 
   * @param {string} code - The JavaScript code to execute
   * @param {any} [ctx={}] - Context variables to make available to the executing code
   * @returns {any} The result of the code execution, or an Error object if execution failed
   * 
   * @example
   * ```typescript
   * // Simple calculation
   * const result = vm.run('2 + 3 * 4')
   * console.log(result) // 14
   * 
   * // Using context variables
   * const greeting = vm.run('`Hello ${name}!`', { name: 'Alice' })
   * console.log(greeting) // 'Hello Alice!'
   * 
   * // Array operations
   * const sum = vm.run('numbers.reduce((a, b) => a + b, 0)', { 
   *   numbers: [1, 2, 3, 4, 5] 
   * })
   * console.log(sum) // 15
   * 
   * // Error handling
   * const error = vm.run('invalidFunction()')
   * if (error instanceof Error) {
   *   console.log('Execution failed:', error.message)
   * }
   * ```
   */
  /**
   * Wrap code containing top-level `await` in an async IIFE, injecting
   * `return` before the last expression so the value is not lost.
   *
   * If the code does not contain `await`, or is already wrapped in an
   * async function/arrow, it is returned unchanged.
   */
  wrapTopLevelAwait(code: string): string {
    if (!/\bawait\b/.test(code) || /^\s*\(?\s*async\b/.test(code)) {
      return code
    }

    const lines = code.split('\n')

    // Find the last non-empty line
    let lastIdx = lines.length - 1
    while (lastIdx > 0 && !lines[lastIdx].trim()) lastIdx--

    let lastLine = lines[lastIdx]!

    // For single-line code with semicolons (e.g. CLI eval), split the last line
    // into statements and only try to return the final statement.
    const stmts = lastLine.split(';').map(s => s.trim()).filter(Boolean)
    if (stmts.length > 1) {
      const finalStmt = stmts[stmts.length - 1]!
      if (!/^\s*(var|let|const|if|for|while|switch|try|throw|class|function|return)\b/.test(finalStmt)) {
        stmts[stmts.length - 1] = `return ${finalStmt}`
      }
      lines[lastIdx] = stmts.join('; ')
    } else if (!/^\s*(var|let|const|if|for|while|switch|try|throw|class|function|return)\b/.test(lastLine)) {
      lines[lastIdx] = `return ${lastLine}`
    }

    return `(async () => {\n${lines.join('\n')}\n})()`
  }

  async run<T extends any>(code: string, ctx: any = {}): Promise<T> {
    const wrapped = this.wrapTopLevelAwait(code)
    const script = this.createScript(wrapped)
    const context = this.isContext(ctx) ? ctx : this.createContext(ctx)

    return (await script.runInContext(context)) as T
  }

  /**
   * Execute JavaScript code synchronously in a controlled environment.
   *
   * @param code - The JavaScript code to execute
   * @param ctx - Context variables to make available to the executing code
   * @returns The result of the code execution
   *
   * @example
   * ```typescript
   * const sum = vm.runSync('a + b', { a: 2, b: 3 })
   * console.log(sum) // 5
   * ```
   */
  runSync<T extends any = any>(code: string, ctx: any = {}): T {
    const script = this.createScript(code)
    const context = this.isContext(ctx) ? ctx : this.createContext(ctx)

    return script.runInContext(context) as T
  }

  /**
   * Execute code asynchronously and return both the result and the execution context.
   *
   * Unlike `run`, this method also returns the context object, allowing you to inspect
   * variables set during execution.
   *
   * @param code - The JavaScript code to execute
   * @param ctx - Context variables to make available to the executing code
   * @returns The execution result and the context object
   *
   * @example
   * ```typescript
   * const { result, context } = await vm.perform('x = 42; x * 2', { x: 0 })
   * console.log(result)     // 84
   * console.log(context.x)  // 42
   * ```
   */
  async perform<T extends any>(code: string, ctx: any = {}): Promise<{ result: T, context: vm.Context }> {
    const script = this.createScript(code)
    const context = this.isContext(ctx) ? ctx : this.createContext(ctx)

    return { result: (await script.runInContext(context)) as T, context }
  }

  /**
   * Executes JavaScript code synchronously and returns both the result and the execution context.
   *
   * Unlike `runSync`, this method also returns the context object, allowing you to inspect
   * variables set during execution (e.g. `module.exports`). This is the synchronous equivalent
   * of `perform()`.
   *
   * @param {string} code - The JavaScript code to execute
   * @param {any} [ctx={}] - Context variables to make available to the executing code
   * @returns {{ result: T, context: vm.Context }} The execution result and the context object
   *
   * @example
   * ```typescript
   * const { result, context } = vm.performSync(code, {
   *   exports: {},
   *   module: { exports: {} },
   * })
   * const moduleExports = context.module?.exports || context.exports
   * ```
   */
  performSync<T extends any = any>(code: string, ctx: any = {}): { result: T, context: vm.Context } {
    const script = this.createScript(code)
    const context = this.isContext(ctx) ? ctx : this.createContext(ctx)

    return { result: script.runInContext(context) as T, context }
  }

  /**
   * Synchronously loads a JavaScript/TypeScript module from a file path, executing it
   * in an isolated VM context and returning its exports. The module gets `require`,
   * `exports`, and `module` globals automatically, plus any additional context you provide.
   *
   * @param {string} filePath - Absolute path to the module file to load
   * @param {any} [ctx={}] - Additional context variables to inject into the module's execution environment
   * @returns {Record<string, any>} The module's exports (from `module.exports` or `exports`)
   *
   * @example
   * ```typescript
   * const vm = container.feature('vm')
   *
   * // Load a tools module, injecting the container
   * const tools = vm.loadModule('/path/to/tools.ts', { container, me: assistant })
   * // tools.myFunction, tools.schemas, etc.
   * ```
   */
  loadModule(filePath: string, ctx: any = {}): Record<string, any> {
    const { fs } = this.container

    if (!fs.exists(filePath)) return {}

    const raw = fs.readFile(filePath)
    const { code } = this.container.feature('esbuild').transformSync(raw, { format: 'cjs' })

    const { context } = this.performSync(code, {
      require: this.createRequireFor(filePath),
      exports: {},
      module: { exports: {} },
      console,
      ...ctx,
    })

    return context.module?.exports || context.exports || {}
  }
}

export default VM