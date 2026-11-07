import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'
import { Feature } from '../feature.js'
import { type ContainerContext } from '../container.js'
import type { Transformers } from './transformers.js'

/** Audio the transcriber accepts: raw 16kHz mono samples, encoded audio, or a URL to fetch. */
export type TranscriberInput = Float32Array | Blob | string

/** What `transcribe()` resolves to. */
export interface TranscriberResult {
  text: string
  /** Seconds of audio that were transcribed. */
  audioSeconds: number
  ms: number
  /** Seconds of audio processed per second of wall-clock; above 1 is faster than real time. */
  realtimeFactor: number
}

export const TranscriberOptionsSchema = FeatureOptionsSchema.extend({
  model: z.string().default('onnx-community/whisper-tiny.en').describe('Hugging Face id of an ONNX Whisper model. tiny.en is ~40MB; base.en is more accurate at ~75MB'),
  device: z.enum(['auto', 'webgpu', 'wasm']).default('auto').describe("Execution backend. 'auto' picks WebGPU when navigator.gpu exists, else WASM"),
  language: z.string().optional().describe('Spoken language hint for multilingual models (ignored by .en models)'),
  moduleURL: z.string().optional().describe('Passed through to the transformers feature'),
  transformers: z.any().optional().describe('An already-loaded transformers.js module, passed through to the transformers feature'),
})

export const TranscriberStateSchema = FeatureStateSchema.extend({
  status: z.enum(['idle', 'loading', 'ready', 'transcribing', 'error']).default('idle').describe('Lifecycle: idle until load(), loading while weights download, ready between calls'),
  model: z.string().optional().describe('Model id that was loaded'),
  device: z.enum(['webgpu', 'wasm']).optional().describe('Backend that was actually selected'),
  loadMs: z.number().optional().describe('Wall-clock milliseconds load() took, including any model download'),
  lastText: z.string().optional().describe('Text of the most recent transcription'),
  realtimeFactor: z.number().optional().describe('Speed of the most recent transcription relative to real time'),
  error: z.string().optional().describe('Message of the last load or transcribe failure'),
})

export type TranscriberOptions = z.infer<typeof TranscriberOptionsSchema>
export type TranscriberState = z.infer<typeof TranscriberStateSchema>

/** Whisper's expected input rate. */
export const TRANSCRIBER_SAMPLE_RATE = 16_000

/**
 * Speech-to-text in the browser with Whisper through transformers.js. Accepts
 * raw 16kHz samples, an encoded Blob (what MediaRecorder produces), or a URL,
 * decoding with the Web Audio API as needed, and returns plain text with a
 * speed measurement. Pair it with `localLlm` and the `speech` feature for a
 * voice loop that never leaves the page.
 *
 * @extends Feature
 *
 * @example
 * ```typescript
 * const transcriber = container.feature('transcriber')
 * await transcriber.load()
 * const recorder = new MediaRecorder(await navigator.mediaDevices.getUserMedia({ audio: true }))
 * recorder.ondataavailable = async (e) => {
 *   const { text, realtimeFactor } = await transcriber.transcribe(e.data)
 * }
 * ```
 */
export class Transcriber<
  T extends TranscriberState = TranscriberState,
  K extends TranscriberOptions = TranscriberOptions
> extends Feature<T, K> {
  static override stateSchema = TranscriberStateSchema
  static override optionsSchema = TranscriberOptionsSchema
  static override shortcut = 'features.transcriber' as const
  static override stability = 'experimental' as const
  static override category = 'media-browser' as const

  static { Feature.register(this as any, 'transcriber') }

  private pipe?: any
  private loading?: Promise<this>

  constructor(options: K, context: ContainerContext) {
    super(options, context)
    this.setState({ status: 'idle' } as Partial<T>)
  }

  /** The shared transformers.js loader this feature creates its pipeline through. */
  get transformers(): Transformers {
    const opts = this.options as TranscriberOptions
    // Only pass keys that were set, so this resolves to the same cached
    // instance as a bare container.feature('transformers') call elsewhere.
    const loaderOptions: Record<string, unknown> = {}
    if (opts.moduleURL) loaderOptions.moduleURL = opts.moduleURL
    if (opts.transformers) loaderOptions.module = opts.transformers
    return this.container.feature('transformers' as any, loaderOptions) as Transformers
  }

  /** The backend this instance will use once loaded: resolves 'auto' against WebGPU availability. */
  get device(): 'webgpu' | 'wasm' {
    const requested = (this.options as TranscriberOptions).device ?? 'auto'
    if (requested === 'auto') return this.transformers.device
    return requested
  }

  /** True once load() finished and transcribe() can run. */
  get ready(): boolean {
    const status = this.state.get('status')
    return status === 'ready' || status === 'transcribing'
  }

  /** Download (first time) and load the model. Concurrent callers share one in-flight load. */
  async load(): Promise<this> {
    if (this.ready) return this
    if (this.loading) return this.loading
    this.loading = this.doLoad().finally(() => { this.loading = undefined })
    return this.loading
  }

  private async doLoad(): Promise<this> {
    const opts = this.options as TranscriberOptions
    const device = this.device
    this.setState({ status: 'loading' } as Partial<T>)
    const started = now()
    try {
      this.pipe = await this.transformers.pipeline('automatic-speech-recognition', opts.model, {
        device,
        // The encoder is the heavy part and quantizes badly; the decoder is fine at q4.
        dtype: device === 'webgpu' ? { encoder_model: 'fp32', decoder_model_merged: 'q4' } : 'q8',
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

  /**
   * Decode any accepted input to 16kHz mono Float32 samples. Blobs and URLs go
   * through an OfflineAudioContext so the browser does the resampling.
   */
  async toSamples(input: TranscriberInput): Promise<Float32Array> {
    if (input instanceof Float32Array) return input
    const bytes = typeof input === 'string'
      ? await (await fetch(input)).arrayBuffer()
      : await input.arrayBuffer()
    const AudioContextCtor = (globalThis as any).AudioContext ?? (globalThis as any).webkitAudioContext
    if (!AudioContextCtor) throw new Error('Web Audio API is unavailable; pass 16kHz Float32Array samples instead')
    const decoder = new AudioContextCtor({ sampleRate: TRANSCRIBER_SAMPLE_RATE })
    try {
      const decoded: AudioBuffer = await decoder.decodeAudioData(bytes)
      if (decoded.sampleRate === TRANSCRIBER_SAMPLE_RATE && decoded.numberOfChannels === 1) {
        return decoded.getChannelData(0)
      }
      const offline = new OfflineAudioContext(1, Math.ceil(decoded.duration * TRANSCRIBER_SAMPLE_RATE), TRANSCRIBER_SAMPLE_RATE)
      const source = offline.createBufferSource()
      source.buffer = decoded
      source.connect(offline.destination)
      source.start()
      const rendered = await offline.startRendering()
      return rendered.getChannelData(0)
    } finally {
      await decoder.close?.()
    }
  }

  /** Transcribe audio to text. Calls load() if needed. */
  async transcribe(input: TranscriberInput): Promise<TranscriberResult> {
    await this.load()
    const samples = await this.toSamples(input)
    const audioSeconds = samples.length / TRANSCRIBER_SAMPLE_RATE
    this.setState({ status: 'transcribing' } as Partial<T>)
    const started = now()
    try {
      const opts = this.options as TranscriberOptions
      const output = await this.pipe(samples, {
        chunk_length_s: 30,
        stride_length_s: 5,
        ...(opts.language ? { language: opts.language } : {}),
      })
      const ms = now() - started
      const text = String(output?.text ?? '').trim()
      const realtimeFactor = ms > 0 ? Math.round((audioSeconds / (ms / 1000)) * 10) / 10 : 0
      this.setState({ status: 'ready', lastText: text, realtimeFactor } as Partial<T>)
      const result = { text, audioSeconds: Math.round(audioSeconds * 100) / 100, ms: Math.round(ms), realtimeFactor }
      this.emit('transcribed', result)
      return result
    } catch (error) {
      throw this.fail(error)
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

export default Transcriber
