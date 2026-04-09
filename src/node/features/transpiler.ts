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
  const exportedNames: string[] = []

  let result = code
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
    // export { a, b as c } → exports.a = a; exports.c = b;
    .replace(/^export\s+\{([^}]*)\}\s*;?$/gm, (_match, body: string) => {
      return body.split(',').map(s => {
        const parts = s.trim().split(/\s+as\s+/)
        const local = (parts[0] ?? '').trim()
        const exported = (parts[1] ?? parts[0] ?? '').trim()
        return local ? `exports['${exported}'] = ${local};` : ''
      }).filter(Boolean).join(' ')
    })
    // export const/let/var NAME → const/let/var NAME (track for deferred export)
    .replace(/^export\s+(const|let|var)\s+(\w+)/gm, (_match, decl: string, name: string) => {
      exportedNames.push(name)
      return `${decl} ${name}`
    })
    // export function NAME / export class NAME → function/class NAME (track for deferred export)
    .replace(/^export\s+(function|class)\s+(\w+)/gm, (_match, type: string, name: string) => {
      exportedNames.push(name)
      return `${type} ${name}`
    })
    // export async function NAME → async function NAME (track for deferred export)
    .replace(/^export\s+(async\s+function)\s+(\w+)/gm, (_match, type: string, name: string) => {
      exportedNames.push(name)
      return `${type} ${name}`
    })

  // Append exports for all tracked named exports
  if (exportedNames.length > 0) {
    result += '\n' + exportedNames.map(n => `exports['${n}'] = ${n};`).join('\n')
  }

  return result
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

  /**
   * Bundle a file using Bun.build, inlining all imports except those marked external.
   * Returns CJS code ready for VM execution.
   *
   * @param filePath - Absolute path to the entrypoint file
   * @param external - Module IDs to leave as require() calls (e.g. virtual modules)
   * @returns The bundled CJS code string
   */
  async bundle(filePath: string, external: string[] = []): Promise<string> {
    const result = await Bun.build({
      entrypoints: [filePath],
      target: 'bun',
      format: 'cjs',
      bundle: true,
      external,
    })

    if (!result.success) {
      const msgs = result.logs.map((l: any) => l.message || String(l)).join('\n')
      throw new Error(`Bundle failed for ${filePath}:\n${msgs}`)
    }

    return await result.outputs[0].text()
  }
}

export default Transpiler
