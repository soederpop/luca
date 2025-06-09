import { FeatureOptions, Feature, FeatureState, features } from "../feature.js";
import { Container } from "../container.js";
import type * as esbuild from 'esbuild-wasm';

export interface EsbuildWebOptions extends FeatureOptions {
  transformOptions?: Partial<esbuild.TransformOptions>,
  tsconfig?: string;
}

export class Esbuild extends Feature<FeatureState, EsbuildWebOptions> {
  static attach(container: Container & { assetLoader?: Esbuild}) {
    container.features.register("esbuild", Esbuild);
  }

  static override shortcut = "features.esbuild" as const
  
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

export default features.register("esbuild", Esbuild);

const compileCache = new Map()