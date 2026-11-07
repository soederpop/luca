import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'
import { Feature } from '../feature.js'
import { type ContainerContext } from '../container.js'
import type { Transformers } from './transformers.js'

/** One chat turn, in the shape chat templates expect. */
export interface LocalLlmMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LocalLlmGenerateOptions {
  /** Called with each new piece of text as it is decoded. */
  onToken?: (text: string) => void
  maxNewTokens?: number
  /** Sample instead of greedy decoding. */
  temperature?: number
  topK?: number
}

/** What `generate()` resolves to. */
export interface LocalLlmGenerateResult {
  text: string
  tokens: number
  /** Decoding speed, warm-up excluded. */
  tokensPerSecond: number
  ms: number
  /** True when stop() cut the generation short. */
  interrupted: boolean
}

export const LocalLlmOptionsSchema = FeatureOptionsSchema.extend({
  model: z.string().default('HuggingFaceTB/SmolLM2-360M-Instruct').describe('Hugging Face id of an ONNX chat model with a chat template. Default is ~250MB at q4'),
  device: z.enum(['auto', 'webgpu', 'wasm']).default('auto').describe("Execution backend. 'auto' picks WebGPU when navigator.gpu exists, else WASM"),
  dtype: z.string().optional().describe('Weight precision. Defaults to q4f16 on WebGPU and q4 on WASM'),
  systemPrompt: z.string().default('You are a helpful assistant running entirely inside the user\'s browser. Answer briefly.').describe('System message prepended to every conversation'),
  maxNewTokens: z.number().default(256).describe('Default cap on generated tokens per turn'),
  moduleURL: z.string().optional().describe('Passed through to the transformers feature'),
  transformers: z.any().optional().describe('An already-loaded transformers.js module, passed through to the transformers feature'),
})

export const LocalLlmStateSchema = FeatureStateSchema.extend({
  status: z.enum(['idle', 'loading', 'ready', 'generating', 'error']).default('idle').describe('Lifecycle: idle until load(), loading while weights download, ready between turns, generating while decoding'),
  model: z.string().optional().describe('Model id that was loaded'),
  device: z.enum(['webgpu', 'wasm']).optional().describe('Backend that was actually selected'),
  dtype: z.string().optional().describe('Weight precision that was loaded'),
  loadMs: z.number().optional().describe('Wall-clock milliseconds load() took, including any model download'),
  tokensPerSecond: z.number().optional().describe('Decoding speed of the last generation'),
  messages: z.array(z.object({
    role: z.enum(['system', 'user', 'assistant']),
    content: z.string(),
  })).default([]).describe('Conversation so far, system prompt excluded'),
  error: z.string().optional().describe('Message of the last load or generate failure'),
})

export type LocalLlmOptions = z.infer<typeof LocalLlmOptionsSchema>
export type LocalLlmState = z.infer<typeof LocalLlmStateSchema>

/**
 * A chat model that runs entirely in the browser through transformers.js.
 * Keeps the conversation in state, streams decoded text through `onToken`
 * and `token` events, and can be interrupted mid-generation. Small instruct
 * models (SmolLM2-360M, Qwen2.5-0.5B) are usable on WebGPU; expect a
 * 250MB-500MB first download that the browser then caches.
 *
 * @extends Feature
 *
 * @example
 * ```typescript
 * const llm = container.feature('localLlm')
 * await llm.load()
 * const reply = await llm.chat('What is a container?', { onToken: (t) => process.stdout.write(t) })
 * reply.tokensPerSecond // e.g. 40 on an M-series Mac
 * ```
 *
 * @example
 * ```typescript
 * // One-shot generation with explicit messages, no conversation state
 * const llm = container.feature('localLlm', { model: 'onnx-community/Qwen2.5-0.5B-Instruct' })
 * const { text } = await llm.generate([{ role: 'user', content: 'Say hi' }])
 * ```
 */
export class LocalLlm<
  T extends LocalLlmState = LocalLlmState,
  K extends LocalLlmOptions = LocalLlmOptions
> extends Feature<T, K> {
  static override stateSchema = LocalLlmStateSchema
  static override optionsSchema = LocalLlmOptionsSchema
  static override shortcut = 'features.localLlm' as const
  static override stability = 'experimental' as const
  static override category = 'ai-assistants' as const

  static { Feature.register(this as any, 'localLlm') }

  private pipe?: any
  private loading?: Promise<this>
  private stopper?: { interrupt(): void; reset(): void }

  constructor(options: K, context: ContainerContext) {
    super(options, context)
    this.setState({ status: 'idle', messages: [] as LocalLlmMessage[] } as Partial<T>)
  }

  /** The shared transformers.js loader this feature creates its pipeline through. */
  get transformers(): Transformers {
    const opts = this.options as LocalLlmOptions
    // Only pass keys that were set, so this resolves to the same cached
    // instance as a bare container.feature('transformers') call elsewhere.
    const loaderOptions: Record<string, unknown> = {}
    if (opts.moduleURL) loaderOptions.moduleURL = opts.moduleURL
    if (opts.transformers) loaderOptions.module = opts.transformers
    return this.container.feature('transformers' as any, loaderOptions) as Transformers
  }

  /** The backend this instance will use once loaded: resolves 'auto' against WebGPU availability. */
  get device(): 'webgpu' | 'wasm' {
    const requested = (this.options as LocalLlmOptions).device ?? 'auto'
    if (requested === 'auto') return this.transformers.device
    return requested
  }

  /** The weight precision this instance will load: q4f16 on WebGPU, q4 on WASM, unless `dtype` was given. */
  get dtype(): string {
    return (this.options as LocalLlmOptions).dtype ?? (this.device === 'webgpu' ? 'q4f16' : 'q4')
  }

  /** True once load() finished and generate() can run. */
  get ready(): boolean {
    const status = this.state.get('status')
    return status === 'ready' || status === 'generating'
  }

  /** The conversation so far, system prompt excluded. */
  get messages(): LocalLlmMessage[] {
    return (this.state.get('messages') ?? []) as LocalLlmMessage[]
  }

  /**
   * Download (first time) and load the model. Safe to call many times:
   * concurrent callers share one in-flight load.
   */
  async load(): Promise<this> {
    if (this.ready) return this
    if (this.loading) return this.loading
    this.loading = this.doLoad().finally(() => { this.loading = undefined })
    return this.loading
  }

  private async doLoad(): Promise<this> {
    const opts = this.options as LocalLlmOptions
    const device = this.device
    this.setState({ status: 'loading' } as Partial<T>)
    const started = now()
    try {
      this.pipe = await this.transformers.pipeline('text-generation', opts.model, { device, dtype: this.dtype })
      this.setState({
        status: 'ready',
        model: opts.model,
        device,
        dtype: this.dtype,
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
   * Generate a reply to an explicit message list. The system prompt is added
   * unless the list already starts with one. Does not touch the conversation
   * in state; use chat() for that.
   */
  async generate(messages: LocalLlmMessage[], options: LocalLlmGenerateOptions = {}): Promise<LocalLlmGenerateResult> {
    await this.load()
    const opts = this.options as LocalLlmOptions
    const mod = await this.transformers.load()
    const input = messages[0]?.role === 'system' || !opts.systemPrompt
      ? messages
      : [{ role: 'system' as const, content: opts.systemPrompt }, ...messages]

    let text = ''
    let tokens = 0
    let firstTokenAt = 0
    const started = now()
    const streamer = new mod.TextStreamer(this.pipe.tokenizer, {
      skip_prompt: true,
      skip_special_tokens: true,
      callback_function: (piece: string) => {
        if (!firstTokenAt) firstTokenAt = now()
        tokens++
        text += piece
        options.onToken?.(piece)
        this.emit('token', piece)
      },
    })
    this.stopper = mod.InterruptableStoppingCriteria ? new mod.InterruptableStoppingCriteria() : undefined
    this.setState({ status: 'generating' } as Partial<T>)
    let interrupted = false
    try {
      const generation: Record<string, unknown> = {
        max_new_tokens: options.maxNewTokens ?? opts.maxNewTokens,
        do_sample: options.temperature !== undefined && options.temperature > 0,
        streamer,
        return_full_text: false,
      }
      if (options.temperature) generation.temperature = options.temperature
      if (options.topK) generation.top_k = options.topK
      if (this.stopper) generation.stopping_criteria = this.stopper
      const output = await this.pipe(input, generation)
      // Prefer the pipeline's own text when it reports one: it has the final
      // detokenization, while streamed pieces can miss a trailing partial token.
      const generated = output?.[0]?.generated_text
      if (typeof generated === 'string') text = generated
      else if (Array.isArray(generated)) text = generated[generated.length - 1]?.content ?? text
      interrupted = !!(this.stopper as any)?.interrupted
    } catch (error) {
      throw this.fail(error)
    } finally {
      this.stopper = undefined
    }
    const ms = now() - started
    const decodeMs = firstTokenAt ? now() - firstTokenAt : ms
    const tokensPerSecond = tokens > 1 ? Math.round(((tokens - 1) / decodeMs) * 1000 * 10) / 10 : 0
    this.setState({ status: 'ready', tokensPerSecond } as Partial<T>)
    const result = { text: text.trim(), tokens, tokensPerSecond, ms: Math.round(ms), interrupted }
    this.emit('generated', result)
    return result
  }

  /** Append a user turn to the conversation, generate the reply, and store both in state. */
  async chat(content: string, options: LocalLlmGenerateOptions = {}): Promise<LocalLlmGenerateResult> {
    const messages: LocalLlmMessage[] = [...this.messages, { role: 'user', content }]
    this.setState({ messages } as Partial<T>)
    const result = await this.generate(messages, options)
    this.setState({ messages: [...messages, { role: 'assistant', content: result.text }] } as Partial<T>)
    return result
  }

  /** Interrupt the generation in progress; generate() resolves with what was decoded so far. */
  stop(): void {
    if (this.stopper) {
      ;(this.stopper as any).interrupted = true
      this.stopper.interrupt()
    }
  }

  /** Forget the conversation. The model stays loaded. */
  reset(): void {
    this.setState({ messages: [] as LocalLlmMessage[] } as Partial<T>)
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

export default LocalLlm
