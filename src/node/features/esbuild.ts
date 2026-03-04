import * as esbuild from 'esbuild-wasm'
import { Feature, features } from '../feature.js'
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'
import { NodeContainer } from '../container.js'

/**
 * A Feature for compiling typescript / esm modules, etc to JavaScript
 * that the container can run at runtime. Uses esbuild for fast, reliable
 * TypeScript/ESM transformation with full format support (esm, cjs, iife).
 *
 * @example
 * ```typescript
 * const esbuild = container.feature('esbuild')
 * const result = esbuild.transformSync('const x: number = 1')
 * console.log(result.code) // 'const x = 1;\n'
 * ```
*/
export class ESBuild extends Feature {
  static override shortcut = 'features.esbuild' as const
  static override stateSchema = FeatureStateSchema
  static override optionsSchema = FeatureOptionsSchema

  /**
   * Attaches the ESBuild feature to a NodeContainer instance.
   *
   * @param c - The NodeContainer to attach to
   * @returns The container for method chaining
   */
  static attach(c: NodeContainer) {
    return c
  }

  /**
   * Transform code synchronously
   * @param code - The code to transform
   * @param options - The options to pass to esbuild
   * @returns The transformed code
   */
  transformSync(code: string, options?: esbuild.TransformOptions) {
    return esbuild.transformSync(code, {
      loader: 'ts',
      format: 'esm',
      target: 'es2020',
      sourcemap: false,
      minify: false,
      ...options
    })
  }

  /**
   * Transform code asynchronously
   * @param code - The code to transform
   * @param options - The options to pass to esbuild
   * @returns The transformed code
   */
  async transform(code: string, options?: esbuild.TransformOptions) {
    return esbuild.transform(code, {
      loader: 'ts',
      format: 'esm',
      target: 'es2020',
      sourcemap: false,
      minify: false,
      ...options
    })
  }
}

export default features.register('esbuild', ESBuild)
