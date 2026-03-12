// @ts-nocheck
//
import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'
import vm from '../shims/isomorphic-vm'
import { Feature } from "../feature.js";

export const VMStateSchema = FeatureStateSchema.extend({})

export const VMOptionsSchema = FeatureOptionsSchema.extend({
  context: z.any().describe('VM context object').optional(),
})

export type VMState = z.infer<typeof VMStateSchema>
export type VMOptions = z.infer<typeof VMOptionsSchema>

/**
 * Sandboxed JavaScript execution environment for the browser.
 *
 * Automatically injects the container's context object into the global scope,
 * so evaluated code can use anything provided by the container. Useful for
 * live code playgrounds, plugin systems, and dynamic script evaluation.
 *
 * @extends Feature
 *
 * @example
 * ```typescript
 * const vm = container.feature('vm')
 * const result = vm.run('1 + 2 + 3') // 6
 * const greeting = vm.run('container.uuid') // accesses container globals
 * ```
 */
export class VM<
  T extends VMState = VMState,
  K extends VMOptions = VMOptions
> extends Feature<T, K> {

  static override stateSchema = VMStateSchema
  static override optionsSchema = VMOptionsSchema
  static override shortcut = "features.vm" as const

  static { Feature.register(this, 'vm') }

  createScript(code: string) {
    return new vm.Script(code)
  }
 
  createContext(ctx: any = {}) {
    return vm.createContext({
      ...this.container.context,
      ...ctx
    })
  }
  
  async run(code: string, ctx: any = {}, options : any = {}) {
    let script = this.createScript(code)
    
    if (options.transform) {
      const esbuild = this.container.feature('esbuild')
      await esbuild.start()
      const result = await esbuild.compile(code, options.transform)
      script = this.createScript(result.code)
    }

    const context = this.createContext(ctx)
    
    try {
      const result = script.runInContext({
        ...context,
        ...(options.exports && { exports: options.exports })
      })
  
      if (options.exports) {
        return { result, exports: options.exports, context }
      }
      
      return result
    } catch(error) {
      console.error(`Error running code`, error)
      return error
    }
  }
}

export default VM;
