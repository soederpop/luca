import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'
import { Feature } from '../feature.js'
import { type ContainerContext } from '../container.js'
import type { Transformers } from './transformers.js'

/** An image the vision feature accepts: a URL (http, blob, or data) or a Blob/File. */
export type VisionInput = string | Blob

/** One label with its probability, from `classify()`. */
export interface VisionLabel {
  label: string
  /** Probability in [0, 1]; the labels of one call sum to 1. */
  score: number
}

/** What `classify()` resolves to. */
export interface VisionResult {
  labels: VisionLabel[]
  ms: number
}

export const VisionOptionsSchema = FeatureOptionsSchema.extend({
  model: z.string().default('Xenova/clip-vit-base-patch32').describe('Hugging Face id of an ONNX CLIP-style model for zero-shot image classification (~150MB at q8)'),
  device: z.enum(['auto', 'webgpu', 'wasm']).default('auto').describe("Execution backend. 'auto' picks WebGPU when navigator.gpu exists, else WASM"),
  template: z.string().default('a photo of {}').describe('How each label is phrased for the text encoder; {} is replaced with the label'),
  moduleURL: z.string().optional().describe('Passed through to the transformers feature'),
  transformers: z.any().optional().describe('An already-loaded transformers.js module, passed through to the transformers feature'),
})

export const VisionStateSchema = FeatureStateSchema.extend({
  status: z.enum(['idle', 'loading', 'ready', 'classifying', 'error']).default('idle').describe('Lifecycle: idle until load(), loading while weights download, ready between calls'),
  model: z.string().optional().describe('Model id that was loaded'),
  device: z.enum(['webgpu', 'wasm']).optional().describe('Backend that was actually selected'),
  loadMs: z.number().optional().describe('Wall-clock milliseconds load() took, including any model download'),
  lastMs: z.number().optional().describe('Milliseconds the most recent classify() took'),
  error: z.string().optional().describe('Message of the last load or classify failure'),
})

export type VisionOptions = z.infer<typeof VisionOptionsSchema>
export type VisionState = z.infer<typeof VisionStateSchema>

/**
 * Zero-shot image classification in the browser with CLIP through
 * transformers.js: give it an image and any list of labels, get a probability
 * per label. No training, no server, and the labels can change per call, so
 * it doubles as a cheap "is this screenshot showing X" check for agents.
 *
 * @extends Feature
 *
 * @example
 * ```typescript
 * const vision = container.feature('vision')
 * const { labels } = await vision.classify(file, ['a cat', 'a dog', 'a terminal window'])
 * labels[0] // { label: 'a terminal window', score: 0.91 }
 * ```
 */
export class Vision<
  T extends VisionState = VisionState,
  K extends VisionOptions = VisionOptions
> extends Feature<T, K> {
  static override stateSchema = VisionStateSchema
  static override optionsSchema = VisionOptionsSchema
  static override shortcut = 'features.vision' as const
  static override stability = 'experimental' as const
  static override category = 'media-browser' as const

  static { Feature.register(this as any, 'vision') }

  private pipe?: any
  private loading?: Promise<this>

  constructor(options: K, context: ContainerContext) {
    super(options, context)
    this.setState({ status: 'idle' } as Partial<T>)
  }

  /** The shared transformers.js loader this feature creates its pipeline through. */
  get transformers(): Transformers {
    const opts = this.options as VisionOptions
    // Only pass keys that were set, so this resolves to the same cached
    // instance as a bare container.feature('transformers') call elsewhere.
    const loaderOptions: Record<string, unknown> = {}
    if (opts.moduleURL) loaderOptions.moduleURL = opts.moduleURL
    if (opts.transformers) loaderOptions.module = opts.transformers
    return this.container.feature('transformers' as any, loaderOptions) as Transformers
  }

  /** The backend this instance will use once loaded: resolves 'auto' against WebGPU availability. */
  get device(): 'webgpu' | 'wasm' {
    const requested = (this.options as VisionOptions).device ?? 'auto'
    if (requested === 'auto') return this.transformers.device
    return requested
  }

  /** True once load() finished and classify() can run. */
  get ready(): boolean {
    const status = this.state.get('status')
    return status === 'ready' || status === 'classifying'
  }

  /** Download (first time) and load the model. Concurrent callers share one in-flight load. */
  async load(): Promise<this> {
    if (this.ready) return this
    if (this.loading) return this.loading
    this.loading = this.doLoad().finally(() => { this.loading = undefined })
    return this.loading
  }

  private async doLoad(): Promise<this> {
    const opts = this.options as VisionOptions
    const device = this.device
    this.setState({ status: 'loading' } as Partial<T>)
    const started = now()
    try {
      this.pipe = await this.transformers.pipeline('zero-shot-image-classification', opts.model, {
        device,
        dtype: device === 'webgpu' ? 'fp32' : 'q8',
      })
      this.setState({
        status: 'ready',
        model: opts.model,
        device,
        loadMs: Math.round(now() - started),
        error: undefined,
      } as Partial<T>)
      this.emit('ready', this.state.current)
      return this
    } catch (error) {
      throw this.fail(error)
    }
  }

  private fail(error: unknown): Error {
    const err = error instanceof Error ? error : new Error(String(error))
    this.setState({ status: 'error', error: err.message } as Partial<T>)
    return err
  }

  /** Score an image against candidate labels. Results are sorted best first. Calls load() if needed. */
  async classify(image: VisionInput, labels: string[]): Promise<VisionResult> {
    if (labels.length === 0) throw new Error('classify() needs at least one label')
    await this.load()
    const opts = this.options as VisionOptions
    const url = typeof image === 'string' ? image : URL.createObjectURL(image)
    this.setState({ status: 'classifying' } as Partial<T>)
    const started = now()
    try {
      const output: VisionLabel[] = await this.pipe(url, labels, { hypothesis_template: opts.template })
      const ms = Math.round(now() - started)
      const sorted = [...output].sort((a, b) => b.score - a.score)
      this.setState({ status: 'ready', lastMs: ms } as Partial<T>)
      const result = { labels: sorted, ms }
      this.emit('classified', result)
      return result
    } catch (error) {
      throw this.fail(error)
    } finally {
      if (typeof image !== 'string') URL.revokeObjectURL(url)
    }
  }

  /** Release the model and return to idle. */
  async dispose(): Promise<void> {
    await this.pipe?.dispose?.()
    this.pipe = undefined
    this.setState({ status: 'idle', loadMs: undefined } as Partial<T>)
  }
}

function now(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now()
}

export default Vision
