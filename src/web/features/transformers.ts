import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'
import { Feature } from '../feature.js'
import { type ContainerContext } from '../container.js'

/*
 * Local shape of the parts of @huggingface/transformers we touch. The real
 * module is never installed: load() pulls it from a CDN at runtime (same
 * approach as the esbuild web feature), so importing its types would break
 * typechecking on a clean install and in the types we ship to consumers.
 */

export type TransformersDevice = 'auto' | 'webgpu' | 'wasm'

/** Progress messages transformers.js reports while downloading and loading a model. */
export interface TransformersProgressEvent {
  status: 'initiate' | 'download' | 'progress' | 'done' | 'ready' | string
  /** Model id the file belongs to. */
  name?: string
  /** File within the model repo (onnx/model.onnx, tokenizer.json, ...). */
  file?: string
  /** Percent complete for this file, 0-100. */
  progress?: number
  loaded?: number
  total?: number
}

/** The subset of the transformers.js module that the web features call. */
export interface TransformersModule {
  pipeline(task: string, model: string, options?: Record<string, unknown>): Promise<any>
  TextStreamer: new (tokenizer: any, options?: Record<string, unknown>) => any
  InterruptableStoppingCriteria?: new () => { interrupt(): void; reset(): void }
  RawImage?: { fromBlob(blob: Blob): Promise<any>; fromURL(url: string): Promise<any> }
  env?: {
    allowLocalModels?: boolean
    useBrowserCache?: boolean
    backends?: { onnx?: { wasm?: { numThreads?: number; proxy?: boolean } } }
  }
}

export const TransformersOptionsSchema = FeatureOptionsSchema.extend({
  moduleURL: z.string().default('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.2').describe('ESM URL the transformers.js module is dynamically imported from'),
  module: z.any().optional().describe('An already-loaded transformers.js module. Skips the CDN import (used by tests and by apps that bundle the library themselves)'),
  device: z.enum(['auto', 'webgpu', 'wasm']).default('auto').describe("Default execution backend for pipelines. 'auto' picks WebGPU when navigator.gpu exists, else WASM"),
})

export const TransformersStateSchema = FeatureStateSchema.extend({
  status: z.enum(['idle', 'loading', 'ready', 'error']).default('idle').describe('idle until load(), loading while the library downloads, ready once pipelines can be created'),
  version: z.string().optional().describe('Version string of the loaded library, when it reports one'),
  device: z.enum(['webgpu', 'wasm']).optional().describe('Backend pipelines get by default, after resolving auto'),
  downloading: z.record(z.string(), z.object({
    loaded: z.number(),
    total: z.number(),
  })).default({}).describe('Bytes loaded and total for every model file currently downloading, keyed by model/file'),
  progress: z.number().default(0).describe('Overall download percent (0-100) across all files in flight; 100 when nothing is downloading'),
  error: z.string().optional().describe('Message of the last load failure'),
})

export type TransformersOptions = z.infer<typeof TransformersOptionsSchema>
export type TransformersState = z.infer<typeof TransformersStateSchema>

/** Options every pipeline-creating method accepts. */
export interface TransformersPipelineOptions {
  device?: 'webgpu' | 'wasm'
  /** Weight precision, or a per-submodel map ({ encoder_model: 'fp32', decoder_model_merged: 'q4' }). */
  dtype?: string | Record<string, string>
  /** Receives every progress message in addition to the feature's `progress` event. */
  onProgress?: (event: TransformersProgressEvent) => void
  [key: string]: unknown
}

/** The library module is loaded once per URL and shared by every feature instance and subcontainer. */
const moduleCache = new Map<string, Promise<TransformersModule>>()

/**
 * Loads transformers.js (Hugging Face's ONNX inference library for the browser)
 * and hands out pipelines to the other local-inference web features:
 * `embeddings`, `localLlm`, `transcriber`, and `vision`. One instance owns the
 * library import, picks the execution backend (WebGPU or WASM), and turns the
 * library's per-file download callbacks into container state and events, so a
 * UI can show one progress bar no matter which feature is downloading.
 *
 * The library is not bundled into luca: `load()` dynamically imports it from a
 * CDN (override with `moduleURL`, or pass an already imported module via
 * `module`). Model weights come from the Hugging Face hub and are kept in the
 * browser Cache API, so a second visit loads in seconds.
 *
 * @extends Feature
 *
 * @example
 * ```typescript
 * const transformers = container.feature('transformers')
 * transformers.on('progress', (e) => console.log(e.file, e.progress))
 * const classify = await transformers.pipeline('text-classification', 'Xenova/distilbert-base-uncased-finetuned-sst-2-english')
 * await classify('luca makes local inference easy') // [{ label: 'POSITIVE', score: 0.99 }]
 * ```
 */
export class Transformers<
  T extends TransformersState = TransformersState,
  K extends TransformersOptions = TransformersOptions
> extends Feature<T, K> {
  static override stateSchema = TransformersStateSchema
  static override optionsSchema = TransformersOptionsSchema
  static override shortcut = 'features.transformers' as const
  static override stability = 'experimental' as const
  static override category = 'content-nlp' as const

  static { Feature.register(this as any, 'transformers') }

  private module?: TransformersModule
  private loading?: Promise<TransformersModule>

  constructor(options: K, context: ContainerContext) {
    super(options, context)
    this.setState({ status: 'idle', downloading: {}, progress: 100 } as Partial<T>)
  }

  /** True when the page can use the WebGPU backend (`navigator.gpu` exists). */
  static get webgpuAvailable(): boolean {
    return typeof navigator !== 'undefined' && !!(navigator as any).gpu
  }

  /** The backend pipelines get unless they ask for another: resolves 'auto' against WebGPU availability. */
  get device(): 'webgpu' | 'wasm' {
    const requested = (this.options as TransformersOptions).device ?? 'auto'
    if (requested === 'auto') return Transformers.webgpuAvailable ? 'webgpu' : 'wasm'
    return requested
  }

  /** True once the library module is imported. */
  get ready(): boolean {
    return !!this.module
  }

  /**
   * Import the library (cached per URL across all instances). Safe to call many
   * times: concurrent callers share one in-flight import.
   */
  async load(): Promise<TransformersModule> {
    if (this.module) return this.module
    if (this.loading) return this.loading
    this.loading = this.doLoad().finally(() => { this.loading = undefined })
    return this.loading
  }

  private async doLoad(): Promise<TransformersModule> {
    const opts = this.options as TransformersOptions
    this.setState({ status: 'loading', device: this.device } as Partial<T>)
    try {
      let promise: Promise<TransformersModule>
      if (opts.module) {
        promise = Promise.resolve(opts.module as TransformersModule)
      } else {
        const url = opts.moduleURL
        if (!moduleCache.has(url)) {
          // A non-literal specifier keeps bundlers from trying to resolve the CDN URL at build time.
          const specifier = url
          moduleCache.set(url, import(specifier).catch((error) => {
            moduleCache.delete(url)
            throw error
          }))
        }
        promise = moduleCache.get(url)!
      }
      const mod = await promise
      if (mod.env) {
        // Weights come from the Hugging Face hub, never a local path, and the
        // browser Cache API keeps the download from repeating on reload.
        mod.env.allowLocalModels = false
        mod.env.useBrowserCache = true
      }
      this.module = mod
      this.setState({ status: 'ready', version: (mod as any).env?.version, error: undefined } as Partial<T>)
      this.emit('ready', mod)
      return mod
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      this.setState({ status: 'error', error: err.message } as Partial<T>)
      throw err
    }
  }

  /**
   * Create a transformers.js pipeline for a task and model. Download progress
   * for the model's files flows into `state.downloading` / `state.progress`
   * and is emitted as `progress` events. Throws if WebGPU was requested but
   * is unavailable.
   */
  async pipeline<P = any>(task: string, model: string, options: TransformersPipelineOptions = {}): Promise<P> {
    const { onProgress, ...rest } = options
    const device = options.device ?? this.device
    if (device === 'webgpu' && !Transformers.webgpuAvailable) {
      throw new Error('WebGPU requested but navigator.gpu is unavailable in this browser')
    }
    const mod = await this.load()
    const pipe = await mod.pipeline(task, model, {
      ...rest,
      device,
      progress_callback: (event: TransformersProgressEvent) => {
        this.trackProgress(event)
        onProgress?.(event)
        this.emit('progress', event)
      },
    })
    this.emit('pipelineReady', { task, model, device })
    return pipe as P
  }

  private trackProgress(event: TransformersProgressEvent) {
    if (!event.file) return
    const key = `${event.name ?? ''}/${event.file}`
    const downloading = { ...(this.state.get('downloading') ?? {}) } as Record<string, { loaded: number; total: number }>
    if (event.status === 'progress' && typeof event.loaded === 'number' && typeof event.total === 'number') {
      downloading[key] = { loaded: event.loaded, total: event.total }
    } else if (event.status === 'done') {
      delete downloading[key]
    }
    const files = Object.values(downloading)
    const total = files.reduce((sum, f) => sum + f.total, 0)
    const loaded = files.reduce((sum, f) => sum + f.loaded, 0)
    const progress = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 100
    this.setState({ downloading, progress } as Partial<T>)
  }
}

export default Transformers
