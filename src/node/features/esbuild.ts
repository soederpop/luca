import { Feature, features } from '../feature.js'
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'
import { NodeContainer } from '../container.js'

/**
 * A Feature for compiling typescript / esm modules, etc to JavaScript
 * that the container can run at runtime. Uses Bun's built-in transpiler.
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
   * @param options - Transform options
   * @param options.loader - The source language loader (e.g. 'ts', 'tsx', 'jsx'). Defaults to 'ts'.
   * @param options.minify - Whether to minify whitespace in the output. Defaults to false.
   * @returns Object with code and warnings properties
   *
   * @example
   * ```typescript
   * const esbuild = container.feature('esbuild')
   * const result = esbuild.transformSync('const x: number = 1', { loader: 'ts', minify: true })
   * console.log(result.code)
   * ```
   */
  transformSync(code: string, options?: { loader?: string; minify?: boolean; [key: string]: any }) {
    const transpiler = new Bun.Transpiler({
      loader: (options?.loader as any) ?? 'ts',
      minifyWhitespace: options?.minify ?? false,
    })
    return {
      code: transpiler.transformSync(code),
      warnings: [] as string[],
    }
  }

  /**
   * Transform code asynchronously
   * @param code - The code to transform
   * @param options - Transform options
   * @param options.loader - The source language loader (e.g. 'ts', 'tsx', 'jsx'). Defaults to 'ts'.
   * @param options.minify - Whether to minify whitespace in the output. Defaults to false.
   * @returns Promise resolving to object with code and warnings properties
   *
   * @example
   * ```typescript
   * const esbuild = container.feature('esbuild')
   * const result = await esbuild.transform('const x: number = 1', { loader: 'tsx' })
   * console.log(result.code)
   * ```
   */
  async transform(code: string, options?: { loader?: string; minify?: boolean; [key: string]: any }) {
    const transpiler = new Bun.Transpiler({
      loader: (options?.loader as any) ?? 'ts',
      minifyWhitespace: options?.minify ?? false,
    })
    const result = await transpiler.transform(code)
    return {
      code: result,
      warnings: [] as string[],
    }
  }
}

export default features.register('esbuild', ESBuild)
