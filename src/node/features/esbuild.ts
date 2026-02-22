import { Feature, features } from '../feature.js'
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'
import { NodeContainer } from '../container.js'

/**
 * A Feature for compiling typescript / esm modules, etc to JavaScript
 * that the container can run at runtime. Uses Bun's built-in transpiler.
*/
export class ESBuild extends Feature {
  static override shortcut = 'features.esbuild' as const
  static override stateSchema = FeatureStateSchema
  static override optionsSchema = FeatureOptionsSchema

  static attach(c: NodeContainer) {
    return c
  }

  /**
   * Transform code synchronously
   * @param code - The code to transform
   * @param options - Transform options (loader defaults to 'ts')
   * @returns Object with code and warnings properties
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
   * @param options - Transform options (loader defaults to 'ts')
   * @returns Object with code and warnings properties
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
