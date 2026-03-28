import { Feature } from '../feature.js'
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'

export interface TransformOptions {
  loader?: 'ts' | 'tsx' | 'jsx' | 'js'
  format?: 'esm' | 'cjs'
  minify?: boolean
}

export interface TransformResult {
  code: string
  map: string
  warnings: any[]
}

/**
 * Convert ESM import/export statements to CJS require/module.exports
 * so the code can run in a vm context that provides `require`.
 */
function esmToCjs(code: string): string {
  return code
    // import Foo, { bar, baz } from 'x' → const Foo = require('x').default ?? require('x'); const { bar, baz } = require('x')
    .replace(/^import\s+(\w+)\s*,\s*\{([^}]+)\}\s+from\s+(['"][^'"]+['"])\s*;?$/gm,
      'const $1 = require($3).default ?? require($3); const {$2} = require($3);')
    // import { a, b } from 'x' → const { a, b } = require('x')
    .replace(/^import\s+\{([^}]+)\}\s+from\s+(['"][^'"]+['"])\s*;?$/gm,
      'const {$1} = require($2);')
    // import x from 'y' → const x = require('y').default ?? require('y')
    .replace(/^import\s+(\w+)\s+from\s+(['"][^'"]+['"])\s*;?$/gm,
      'const $1 = require($2).default ?? require($2);')
    // import * as x from 'y' → const x = require('y')
    .replace(/^import\s+\*\s+as\s+(\w+)\s+from\s+(['"][^'"]+['"])\s*;?$/gm,
      'const $1 = require($2);')
    // import 'y' → require('y')
    .replace(/^import\s+(['"][^'"]+['"])\s*;?$/gm,
      'require($1);')
    // export default → module.exports.default =
    .replace(/^export\s+default\s+/gm, 'module.exports.default = ')
    // export { a, b } from 'x' → Object.assign(module.exports, require('x'))  (re-exports)
    .replace(/^export\s+\{[^}]*\}\s+from\s+(['"][^'"]+['"])\s*;?$/gm,
      'Object.assign(module.exports, require($1));')
    // export { ... } → strip (vars already in scope)
    .replace(/^export\s+\{[^}]*\}\s*;?$/gm, '')
    // export const/let/var → const/let/var
    .replace(/^export\s+(const|let|var)\s+/gm, '$1 ')
    // export function → function (keep declaration, strip export keyword)
    .replace(/^export\s+(function|class)\s+/gm, '$1 ')
    // export async function → async function
    .replace(/^export\s+(async\s+function)\s+/gm, '$1 ')
}

/**
 * Transpile TypeScript, TSX, and JSX to JavaScript at runtime using Bun's
 * built-in transpiler. Compile code strings on the fly without touching the
 * filesystem or spawning external processes.
 *
 * @example
 * ```typescript
 * const transpiler = container.feature('transpiler')
 * const result = transpiler.transformSync('const x: number = 1')
 * console.log(result.code) // 'const x = 1;\n'
 * ```
 */
export class Transpiler extends Feature {
  static override shortcut = 'features.transpiler' as const
  static override stateSchema = FeatureStateSchema
  static override optionsSchema = FeatureOptionsSchema
  static { Feature.register(this, 'transpiler') }

  /**
   * Transform code synchronously
   * @param code - The code to transform
   * @param options - Transform options (loader, format, minify)
   * @returns The transformed code as { code, map, warnings }
   */
  transformSync(code: string, options: TransformOptions = {}): TransformResult {
    const loader = options.loader || 'ts'
    const format = options.format || 'esm'

    const transpiler = new Bun.Transpiler({ loader })
    let result = transpiler.transformSync(code)

    if (format === 'cjs') {
      result = esmToCjs(result)
    }

    return { code: result, map: '', warnings: [] }
  }

  /**
   * Transform code asynchronously
   * @param code - The code to transform
   * @param options - Transform options (loader, format, minify)
   * @returns The transformed code as { code, map, warnings }
   */
  async transform(code: string, options: TransformOptions = {}): Promise<TransformResult> {
    const loader = options.loader || 'ts'
    const format = options.format || 'esm'

    const transpiler = new Bun.Transpiler({ loader })
    let result = await transpiler.transform(code)

    if (format === 'cjs') {
      result = esmToCjs(result)
    }

    return { code: result, map: '', warnings: [] }
  }
}

export default Transpiler
