import vm from 'vm'
import { Feature, type FeatureOptions, type FeatureState, features } from "../feature.js";

export interface VMState extends FeatureState { }

export interface VMOptions extends FeatureOptions {
  context?: any
}

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
  createContext(ctx: any = {}) {
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
    const context = this.createContext(ctx)
     
    return (await script.runInContext(context)) as T
  }
}

export default features.register("vm", VM);
