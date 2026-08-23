import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'
import { Feature, type FeatureState } from "../feature.js";
/*
 * Local shape of the parts of esbuild-wasm we touch. The real module is never
 * installed: start() pulls it from unpkg at runtime, so importing its types
 * would break typechecking on a clean install (and in the types we ship to
 * consumers via .luca/types). Mirrors esbuild 0.17's public transform API.
 */

export type EsbuildLoader = 'base64' | 'binary' | 'copy' | 'css' | 'dataurl' | 'default' | 'empty' | 'file' | 'js' | 'json' | 'jsx' | 'text' | 'ts' | 'tsx'
export type EsbuildFormat = 'iife' | 'cjs' | 'esm'
export type EsbuildPlatform = 'browser' | 'node' | 'neutral'
export type EsbuildCharset = 'ascii' | 'utf8'
export type EsbuildDrop = 'console' | 'debugger'
export type EsbuildLogLevel = 'verbose' | 'debug' | 'info' | 'warning' | 'error' | 'silent'

/** A warning or error emitted by a transform. */
export interface EsbuildMessage {
  id: string
  pluginName: string
  text: string
  location: {
    file: string
    namespace: string
    /** 1-based */
    line: number
    /** 0-based, in bytes */
    column: number
    /** in bytes */
    length: number
    lineText: string
    suggestion: string
  } | null
  notes: Array<{ text: string; location: EsbuildMessage['location'] }>
  detail: any
}

/** Options accepted by `compile()`, passed straight through to esbuild's transform API. */
export interface EsbuildTransformOptions {
  /** Which syntax to parse the input as. Defaults to `'ts'`. */
  loader?: EsbuildLoader
  /** Name reported in error messages and source maps. */
  sourcefile?: string
  banner?: string
  footer?: string
  tsconfigRaw?: string | {
    compilerOptions?: {
      alwaysStrict?: boolean
      importsNotUsedAsValues?: 'remove' | 'preserve' | 'error'
      jsx?: 'react' | 'react-jsx' | 'react-jsxdev' | 'preserve'
      jsxFactory?: string
      jsxFragmentFactory?: string
      jsxImportSource?: string
      preserveValueImports?: boolean
      target?: string
      useDefineForClassFields?: boolean
    }
  }

  sourcemap?: boolean | 'linked' | 'inline' | 'external' | 'both'
  sourceRoot?: string
  sourcesContent?: boolean
  legalComments?: 'none' | 'inline' | 'eof' | 'linked' | 'external'

  format?: EsbuildFormat
  globalName?: string
  /** Language level to downlevel to, e.g. `'es2015'`. */
  target?: string | string[]
  supported?: Record<string, boolean>
  platform?: EsbuildPlatform

  minify?: boolean
  minifyWhitespace?: boolean
  minifyIdentifiers?: boolean
  minifySyntax?: boolean
  mangleProps?: RegExp
  reserveProps?: RegExp
  mangleQuoted?: boolean
  mangleCache?: Record<string, string | false>
  drop?: EsbuildDrop[]
  charset?: EsbuildCharset
  treeShaking?: boolean
  ignoreAnnotations?: boolean

  jsx?: 'transform' | 'preserve' | 'automatic'
  jsxFactory?: string
  jsxFragment?: string
  jsxImportSource?: string
  jsxDev?: boolean
  jsxSideEffects?: boolean

  define?: { [key: string]: string }
  pure?: string[]
  keepNames?: boolean

  color?: boolean
  logLevel?: EsbuildLogLevel
  logLimit?: number
  logOverride?: Record<string, EsbuildLogLevel>
}

/** What `compile()` resolves to. */
export interface EsbuildTransformResult {
  code: string
  map: string
  warnings: EsbuildMessage[]
  /** Only set when `mangleCache` was passed. */
  mangleCache?: Record<string, string | false>
  /** Only set when `legalComments` is `'external'`. */
  legalComments?: string
}

/** The subset of the esbuild-wasm module that this feature calls. */
export interface EsbuildWasmModule {
  initialize(options: { wasmURL?: string | URL; wasmModule?: WebAssembly.Module; worker?: boolean }): Promise<void>
  transform(code: string, options?: EsbuildTransformOptions): Promise<EsbuildTransformResult>
  version: string
}

export const EsbuildWebOptionsSchema = FeatureOptionsSchema.extend({
  transformOptions: z.any().describe('Partial<EsbuildTransformOptions>').optional(),
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
  static override stability = 'stable' as const
  static override category = 'dev-tools' as const

  static { Feature.register(this as any, 'esbuild') }
  
  /** Returns the assetLoader feature for loading external libraries from unpkg. */
  get assetLoader() {
    return this.container.feature("assetLoader");
  }
  
  compiler!: EsbuildWasmModule

  async compile(code:string, options?: EsbuildTransformOptions): Promise<EsbuildTransformResult> {
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