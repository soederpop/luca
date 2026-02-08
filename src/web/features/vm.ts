// @ts-nocheck
//
import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'
import vm from '../shims/isomorphic-vm'
import { Feature, features } from "../feature.js";
import { Container } from '../../container.js';

export const VMStateSchema = FeatureStateSchema.extend({})

export const VMOptionsSchema = FeatureOptionsSchema.extend({
  context: z.any().describe('VM context object').optional(),
})

export type VMState = z.infer<typeof VMStateSchema>
export type VMOptions = z.infer<typeof VMOptionsSchema>

export class VM<
  T extends VMState = VMState,
  K extends VMOptions = VMOptions
> extends Feature<T, K> {

  static attach(container: Container) {
    container.features.register('vm', VM)    
  }

  static override stateSchema = VMStateSchema
  static override optionsSchema = VMOptionsSchema
  static override shortcut = "features.vm" as const

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

export default features.register("vm", VM);
