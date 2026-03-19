import * as esbuild from 'esbuild-wasm'
import { Feature } from '../feature.js'
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'

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
  static { Feature.register(this, 'esbuild') }

  /**
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
      target: 'esnext',
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
      target: 'esnext',
      sourcemap: false,
      minify: false,
      ...options
    })
  }

  /**
   * Bundle one or more entry points, resolving imports and requires into a single output.
   * Supports Node platform by default so require() and Node builtins are handled.
   * Returns in-memory output files unless write is enabled in options.
   * @param entryPoints - File paths to bundle from
   * @param options - esbuild BuildOptions overrides
   * @returns The build result with outputFiles when write is false
   */
  async bundle(entryPoints: string[], options?: esbuild.BuildOptions) {
    return esbuild.build({
      entryPoints,
      bundle: true,
      platform: 'node',
      format: 'esm',
      target: 'esnext',
      write: false,
      ...options
    })
  }
}

export default ESBuild