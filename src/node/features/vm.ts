import { z } from 'zod'
import { createRequire } from 'module'
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'
import vm from 'vm'
import { Feature, features } from "../feature.js";

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
  static override shortcut = "features.vm" as const
  static override stateSchema = VMStateSchema
  static override optionsSchema = VMOptionsSchema

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
   * Creates a new execution context for running VM scripts.
   * 
   * This method creates an isolated JavaScript execution context that combines
   * the container's context with any additional context variables provided.
   * The resulting context can be used to run scripts with controlled variable access.
   * 
   * @param {any} [ctx={}] - Additional context variables to include in the execution environment
   * @returns {vm.Context} A VM context ready for script execution
   * 
   * @example
   * ```typescript
   * // Create context with custom variables
   * const context = vm.createContext({ 
   *   user: { name: 'John', age: 30 },
   *   config: { debug: true }
   * })
   * 
   * // Create context inheriting from container
   * const containerContext = vm.createContext()
   * ```
   */
  /**
   * Returns true if the given object has already been contextified by `vm.createContext()`.
   * Use this to avoid double-contextifying when you're not sure if the caller passed a plain object or an existing context.
   */
  isContext(ctx: unknown): ctx is vm.Context {
    return typeof ctx === 'object' && ctx !== null && vm.isContext(ctx as vm.Context)
  }

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
  async run<T extends any>(code: string, ctx: any = {}): Promise<T> {
    const script = this.createScript(code)
    const context = this.isContext(ctx) ? ctx : this.createContext(ctx)

    return (await script.runInContext(context)) as T
  }

  /*
   * Executes JavaScript code in a controlled environment synchronously.
   * @param {string} code - The JavaScript code to execute
   * @param {any} [ctx={}] - Context variables to make available to the executing code
   * @returns {any} The result of the code execution, or an Error object if execution failed
  */
  runSync<T extends any = any>(code: string, ctx: any = {}): T {
    const script = this.createScript(code)
    const context = this.isContext(ctx) ? ctx : this.createContext(ctx)

    return script.runInContext(context) as T
  }

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
      require: createRequire(filePath),
      exports: {},
      module: { exports: {} },
      ...ctx,
    })

    return context.module?.exports || context.exports || {}
  }
}

export default features.register("vm", VM);
