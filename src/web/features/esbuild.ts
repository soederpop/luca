import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'
import { Feature, type FeatureState } from "../feature.js";
import type * as esbuild from 'esbuild-wasm';

export const EsbuildWebOptionsSchema = FeatureOptionsSchema.extend({
  transformOptions: z.any().describe('Partial<esbuild.TransformOptions>').optional(),
  tsconfig: z.string().optional().describe('Path to a tsconfig.json file for TypeScript compilation'),
})

export type EsbuildWebOptions = z.infer<typeof EsbuildWebOptionsSchema>

/**
 * Browser-side TypeScript/ESM compilation feature using esbuild-wasm.
 *
 * Loads esbuild's WebAssembly build via the AssetLoader, then provides
 * `compile()` and `transform()` methods that work entirely in the browser.
 * Useful for live playgrounds, in-browser REPLs, and client-side bundling.
 *
 * @extends Feature
 *
 * @example
 * ```typescript
 * const esbuild = container.feature('esbuild')
 * await esbuild.start()
 * const result = await esbuild.compile('const x: number = 1')
 * console.log(result.code)
 * ```
 */
export class Esbuild extends Feature<FeatureState, EsbuildWebOptions> {
  static override stateSchema = FeatureStateSchema
  static override optionsSchema = EsbuildWebOptionsSchema
  static override shortcut = "features.esbuild" as const

  static { Feature.register(this as any, 'esbuild') }
  
  /** Returns the assetLoader feature for loading external libraries from unpkg. */
  get assetLoader() {
    return this.container.feature("assetLoader");
  }
  
  compiler!: typeof esbuild

  async compile(code:string, options?: esbuild.TransformOptions) {
    if(!this.compiler) {
      throw new Error('esbuild not started')
    }
    
    const { hashObject } = this.container.utils
    
    const cacheKey = hashObject({ code, options })
    
    if (compileCache.has(cacheKey)) {
      return compileCache.get(cacheKey)
    }
    
    const result = await this.compiler.transform(code, {
      loader: 'ts',
      target: 'es2015',
      ...this.options.transformOptions,
      ...options
    })
    
    compileCache.set(cacheKey, result)
    
    return result
  }

  clearCache() {
    compileCache.clear()
    return this
  }

  async start() {
    if((this as any).compiler) {
      return this
    }

    const esbuild = await this.assetLoader.unpkg('esbuild-wasm', 'esbuild');
    await esbuild.initialize({
      wasmURL: 'https://unpkg.com/esbuild-wasm/esbuild.wasm'
    });
      
    this.compiler = esbuild
    
    return this
  }

}

export default Esbuild;

const compileCache = new Map()