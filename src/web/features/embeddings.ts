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

export type EmbeddingsDevice = 'auto' | 'webgpu' | 'wasm'
export type EmbeddingsDtype = 'fp32' | 'fp16' | 'q8' | 'q4'

/** The subset of a transformers.js feature-extraction pipeline that this feature calls. */
export interface EmbeddingsPipeline {
  (texts: string | string[], options?: { pooling?: 'mean' | 'cls' | 'none'; normalize?: boolean }): Promise<{
    dims: number[]
    data: Float32Array | number[]
    tolist?: () => number[][]
  }>
  dispose?: () => Promise<void> | void
}

/** The subset of the transformers.js module that this feature calls. */
export interface TransformersModule {
  pipeline(task: 'feature-extraction', model: string, options?: Record<string, unknown>): Promise<EmbeddingsPipeline>
  env?: {
    allowLocalModels?: boolean
    useBrowserCache?: boolean
    backends?: { onnx?: { wasm?: { numThreads?: number; proxy?: boolean } } }
  }
}

export const EmbeddingsOptionsSchema = FeatureOptionsSchema.extend({
  model: z.string().default('Xenova/all-MiniLM-L6-v2').describe('Hugging Face model id of an ONNX sentence-embedding model (~23MB for the default)'),
  device: z.enum(['auto', 'webgpu', 'wasm']).default('auto').describe("Execution backend. 'auto' picks WebGPU when navigator.gpu exists, else WASM"),
  dtype: z.enum(['fp32', 'fp16', 'q8', 'q4']).optional().describe('Weight precision. Defaults to fp32 on WebGPU and q8 on WASM'),
  moduleURL: z.string().default('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.2').describe('ESM URL the transformers.js module is dynamically imported from'),
  transformers: z.any().optional().describe('An already-loaded transformers.js module. Skips the CDN import (used by tests and by apps that bundle the library themselves)'),
})

export const EmbeddingsStateSchema = FeatureStateSchema.extend({
  status: z.enum(['idle', 'loading', 'ready', 'error']).default('idle').describe('Lifecycle of the model: idle until load(), loading while weights download, ready when embed() can run'),
  model: z.string().optional().describe('Model id that was loaded'),
  device: z.enum(['webgpu', 'wasm']).optional().describe('Backend that was actually selected after resolving auto'),
  dtype: z.string().optional().describe('Weight precision that was loaded'),
  dims: z.number().optional().describe('Vector length produced by the model (384 for MiniLM)'),
  loadMs: z.number().optional().describe('Wall-clock milliseconds load() took, including any model download'),
  error: z.string().optional().describe('Message of the last load or embed failure'),
})

export type EmbeddingsOptions = z.infer<typeof EmbeddingsOptionsSchema>
export type EmbeddingsState = z.infer<typeof EmbeddingsStateSchema>

/** One ranked hit returned by `rank()`. */
export interface EmbeddingsRankResult {
  /** Index into the documents array that was ranked. */
  index: number
  /** The original document text. */
  text: string
  /** Cosine similarity to the query, in [-1, 1]. */
  score: number
}

/** What `benchmark()` resolves to: timings for the device the feature was created with. */
export interface EmbeddingsBenchmarkResult {
  device: 'webgpu' | 'wasm'
  dtype: string
  model: string
  /** Milliseconds for load() (cold if the model was not cached by the browser). */
  loadMs: number
  /** Milliseconds for the first embed() after load — includes backend warm-up. */
  firstEmbedMs: number
  /** Mean milliseconds per batch over the measured iterations, warm-up excluded. */
  batchMs: number
  /** Texts embedded per second, derived from batchMs. */
  textsPerSecond: number
  batchSize: number
  iterations: number
}

/** The transformers module is loaded once per URL and shared by every feature instance. */
const moduleCache = new Map<string, Promise<TransformersModule>>()

/**
 * Sentence embeddings computed in the browser with transformers.js (ONNX runtime,
 * WebGPU or WASM). Mirrors the shape of the node-side embedding client — an array
 * of texts in, an array of float vectors out — so semantic search over something
 * like the `luca describe` index can run with no server at all.
 *
 * The library is not bundled into luca: `load()` dynamically imports it from a
 * CDN (override with `moduleURL`, or pass an already imported module via
 * `transformers`). The first load downloads model weights; transformers.js
 * stores them in the browser Cache API, so later loads are fast.
 *
 * @extends Feature
 *
 * @example
 * ```typescript
 * const embeddings = container.feature('embeddings')
 * await embeddings.load()
 * const [a, b] = await embeddings.embed(['a cat sat on the mat', 'a kitten on a rug'])
 * embeddings.similarity(a, b) // ~0.8
 * ```
 *
 * @example
 * ```typescript
 * // Semantic search over a list of docs, forced onto the WASM backend
 * const embeddings = container.feature('embeddings', { device: 'wasm', dtype: 'q8' })
 * const hits = await embeddings.rank('read a file', ['fs.readFile', 'ui.banner', 'proc.exec'])
 * hits[0].text // 'fs.readFile'
 * ```
 */
export class Embeddings<
  T extends EmbeddingsState = EmbeddingsState,
  K extends EmbeddingsOptions = EmbeddingsOptions
> extends Feature<T, K> {
  static override stateSchema = EmbeddingsStateSchema
  static override optionsSchema = EmbeddingsOptionsSchema
  static override shortcut = 'features.embeddings' as const
  static override stability = 'experimental' as const
  static override category = 'content-nlp' as const

  static { Feature.register(this as any, 'embeddings') }

  private pipe?: EmbeddingsPipeline
  private loading?: Promise<this>

  constructor(options: K, context: ContainerContext) {
    super(options, context)
    this.state.set('status', 'idle')
  }

  /** True when the page can use the WebGPU backend (`navigator.gpu` exists). */
  static get webgpuAvailable(): boolean {
    return typeof navigator !== 'undefined' && !!(navigator as any).gpu
  }

  /** True once load() finished and embed() can run. */
  get ready(): boolean {
    return this.state.get('status') === 'ready'
  }

  /** The backend this instance will use once loaded: resolves 'auto' against WebGPU availability. */
  get device(): 'webgpu' | 'wasm' {
    const requested = (this.options as EmbeddingsOptions).device ?? 'auto'
    if (requested === 'auto') return Embeddings.webgpuAvailable ? 'webgpu' : 'wasm'
    return requested
  }

  /** The weight precision this instance will load: fp32 on WebGPU, q8 on WASM, unless `dtype` was given. */
  get dtype(): EmbeddingsDtype {
    return (this.options as EmbeddingsOptions).dtype ?? (this.device === 'webgpu' ? 'fp32' : 'q8')
  }

  /**
   * Import transformers.js (from `moduleURL`, cached per URL) and build the
   * feature-extraction pipeline. Safe to call many times: concurrent callers
   * share one in-flight load. Throws if WebGPU was requested but is unavailable.
   */
  async load(): Promise<this> {
    if (this.ready) return this
    if (this.loading) return this.loading
    this.loading = this.doLoad().finally(() => { this.loading = undefined })
    return this.loading
  }

  private async doLoad(): Promise<this> {
    const opts = this.options as EmbeddingsOptions
    const device = this.device
    if (device === 'webgpu' && !Embeddings.webgpuAvailable) {
      throw this.fail(new Error('WebGPU requested but navigator.gpu is unavailable in this browser'))
    }
    this.state.set('status', 'loading')
    const started = now()
    try {
      const transformers = await this.loadModule()
      if (transformers.env) {
        // Weights come from the Hugging Face hub, never a local path, and the
        // browser Cache API keeps the download from repeating on reload.
        transformers.env.allowLocalModels = false
        transformers.env.useBrowserCache = true
      }
      this.pipe = await transformers.pipeline('feature-extraction', opts.model, {
        device,
        dtype: this.dtype,
      })
      const probe = await this.pipe('warmup', { pooling: 'mean', normalize: true })
      const dims = probe.dims[probe.dims.length - 1] ?? probe.data.length
      this.setState({
        status: 'ready',
        model: opts.model,
        device,
        dtype: this.dtype,
        dims,
        loadMs: Math.round(now() - started),
        error: undefined,
      } as Partial<T>)
      this.emit('ready', this.state.current)
      return this
    } catch (error) {
      throw this.fail(error)
    }
  }

  private loadModule(): Promise<TransformersModule> {
    const opts = this.options as EmbeddingsOptions
    if (opts.transformers) return Promise.resolve(opts.transformers as TransformersModule)
    const url = opts.moduleURL
    if (!moduleCache.has(url)) {
      // A non-literal specifier keeps bundlers from trying to resolve the CDN URL at build time.
      const specifier = url
      moduleCache.set(url, import(specifier).catch((error) => {
        moduleCache.delete(url)
        throw error
      }))
    }
    return moduleCache.get(url)!
  }

  private fail(error: unknown): Error {
    const err = error instanceof Error ? error : new Error(String(error))
    this.setState({ status: 'error', error: err.message } as Partial<T>)
    return err
  }

  /**
   * Embed one or more texts. Returns one L2-normalized vector per input, in
   * input order, so a dot product is a cosine similarity. Calls load() if needed.
   */
  async embed(texts: string | string[]): Promise<number[][]> {
    const inputs = Array.isArray(texts) ? texts : [texts]
    if (inputs.length === 0) return []
    await this.load()
    const output = await this.pipe!(inputs, { pooling: 'mean', normalize: true })
    const dims = output.dims[output.dims.length - 1] ?? this.state.get('dims')!
    const flat = output.data
    const vectors: number[][] = []
    for (let i = 0; i < inputs.length; i++) {
      vectors.push(Array.from(flat.slice(i * dims, (i + 1) * dims) as ArrayLike<number>))
    }
    return vectors
  }

  /** Cosine similarity between two vectors. Does not assume they are normalized. */
  similarity(a: ArrayLike<number>, b: ArrayLike<number>): number {
    if (a.length !== b.length) throw new Error(`Vector length mismatch: ${a.length} vs ${b.length}`)
    let dot = 0
    let normA = 0
    let normB = 0
    for (let i = 0; i < a.length; i++) {
      dot += a[i]! * b[i]!
      normA += a[i]! * a[i]!
      normB += b[i]! * b[i]!
    }
    if (normA === 0 || normB === 0) return 0
    return dot / (Math.sqrt(normA) * Math.sqrt(normB))
  }

  /**
   * Rank documents by cosine similarity to a query, best first. Embeds the
   * query and every document in one batch; for repeated queries over a fixed
   * corpus, embed the corpus once and use similarity() yourself.
   */
  async rank(query: string, documents: string[], options: { limit?: number } = {}): Promise<EmbeddingsRankResult[]> {
    if (documents.length === 0) return []
    const [queryVec, ...docVecs] = await this.embed([query, ...documents])
    const hits = docVecs.map((vec, index) => ({
      index,
      text: documents[index]!,
      score: this.similarity(queryVec!, vec),
    }))
    hits.sort((a, b) => b.score - a.score)
    return options.limit ? hits.slice(0, options.limit) : hits
  }

  /**
   * Time this instance's backend: load, first embed (warm-up), then steady-state
   * batches. Create one instance per device to compare WebGPU against WASM.
   */
  async benchmark(options: { batchSize?: number; iterations?: number; texts?: string[] } = {}): Promise<EmbeddingsBenchmarkResult> {
    const batchSize = options.batchSize ?? 16
    const iterations = options.iterations ?? 5
    const texts = options.texts ?? Array.from({ length: batchSize }, (_, i) =>
      `Sample sentence number ${i} about containers, features, and embedding vectors in the browser.`)
    await this.load()
    const firstStart = now()
    await this.embed(texts)
    const firstEmbedMs = now() - firstStart
    let total = 0
    for (let i = 0; i < iterations; i++) {
      const start = now()
      await this.embed(texts)
      total += now() - start
    }
    const batchMs = total / iterations
    return {
      device: this.state.get('device')!,
      dtype: this.state.get('dtype')!,
      model: this.state.get('model')!,
      loadMs: this.state.get('loadMs')!,
      firstEmbedMs: Math.round(firstEmbedMs),
      batchMs: Math.round(batchMs * 10) / 10,
      textsPerSecond: Math.round((texts.length / batchMs) * 1000),
      batchSize: texts.length,
      iterations,
    }
  }

  /** Release the ONNX session and return to idle so a different device or model can be loaded. */
  async dispose(): Promise<void> {
    await this.pipe?.dispose?.()
    this.pipe = undefined
    this.setState({ status: 'idle', dims: undefined, loadMs: undefined } as Partial<T>)
  }
}

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

export default Embeddings
