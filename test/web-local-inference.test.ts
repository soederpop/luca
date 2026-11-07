import { describe, expect, it } from 'bun:test'
import { Transformers, type TransformersModule } from '../src/web/features/transformers'
import { LocalLlm } from '../src/web/features/local-llm'
import { Transcriber } from '../src/web/features/transcriber'
import { Vision } from '../src/web/features/vision'
// A NodeContainer on purpose: importing WebContainer registers the web vault/vm
// features into the shared registry and shadows the node ones for later tests.
import { NodeContainer } from '../src/node/container'

// Stand-in for transformers.js: records pipeline requests, replays download
// progress through progress_callback, and returns task-specific fake pipelines.
function fakeModule(log: string[] = []): TransformersModule {
  return {
    env: {},
    TextStreamer: class {
      constructor(_tokenizer: unknown, public options: { callback_function: (s: string) => void }) {}
    },
    InterruptableStoppingCriteria: class { interrupted = false; interrupt() { this.interrupted = true } reset() { this.interrupted = false } },
    pipeline: async (task, model, options: any) => {
      log.push(`${task}:${model}:${options.device}`)
      options.progress_callback?.({ status: 'initiate', name: model, file: 'model.onnx' })
      options.progress_callback?.({ status: 'progress', name: model, file: 'model.onnx', loaded: 50, total: 200 })
      options.progress_callback?.({ status: 'progress', name: model, file: 'tokenizer.json', loaded: 10, total: 10 })
      if (task === 'text-generation') {
        const pipe: any = async (messages: Array<{ content: string }>, gen: any) => {
          for (const piece of ['Hello', ' from', ' the', ' page']) {
            if (gen.stopping_criteria?.interrupted) break
            gen.streamer.options.callback_function(piece)
          }
          return [{ generated_text: [...messages, { role: 'assistant', content: 'Hello from the page' }] }]
        }
        pipe.tokenizer = {}
        return pipe
      }
      if (task === 'automatic-speech-recognition') {
        return async (samples: Float32Array) => ({ text: ` heard ${samples.length} samples ` })
      }
      if (task === 'zero-shot-image-classification') {
        return async (_url: string, labels: string[]) => labels.map((label, i) => ({ label, score: i === 1 ? 0.7 : 0.3 / (labels.length - 1) }))
      }
      throw new Error(`unexpected task ${task}`)
    },
  }
}

function makeContainer(log?: string[]) {
  const container = new NodeContainer({}) as any
  container.use(Transformers).use(LocalLlm).use(Transcriber).use(Vision)
  const module = fakeModule(log)
  return { container, module }
}

describe('transformers loader', () => {
  it('tracks download progress across files and finishes at 100', async () => {
    const { container, module } = makeContainer()
    const t = container.feature('transformers', { module, device: 'wasm' }) as Transformers
    const seen: string[] = []
    t.on('progress', (e: any) => seen.push(e.status))
    await t.pipeline('zero-shot-image-classification', 'm', {})
    expect(seen).toEqual(['initiate', 'progress', 'progress'])
    // 60 of 210 bytes loaded across the two files still in flight
    expect(t.state.get('progress')).toBe(29)
    expect(Object.keys(t.state.get('downloading')!)).toEqual(['m/model.onnx', 'm/tokenizer.json'])
    expect(t.state.get('status')).toBe('ready')
  })

  it('refuses webgpu when navigator.gpu is missing', async () => {
    const { container, module } = makeContainer()
    const t = container.feature('transformers', { module }) as Transformers
    await expect(t.pipeline('x', 'm', { device: 'webgpu' })).rejects.toThrow(/WebGPU/)
  })
})

describe('localLlm', () => {
  it('streams tokens, keeps the conversation in state, and reports speed', async () => {
    const log: string[] = []
    const { container, module } = makeContainer(log)
    const llm = container.feature('localLlm', { transformers: module, device: 'wasm', systemPrompt: 'sys' }) as LocalLlm
    const pieces: string[] = []
    llm.on('token', (p: string) => pieces.push(p))
    const result = await llm.chat('hi', { onToken: () => {} })
    expect(log).toEqual(['text-generation:HuggingFaceTB/SmolLM2-360M-Instruct:wasm'])
    expect(pieces.join('')).toBe('Hello from the page')
    expect(result.text).toBe('Hello from the page')
    expect(result.tokens).toBe(4)
    expect(llm.messages).toEqual([{ role: 'user', content: 'hi' }, { role: 'assistant', content: 'Hello from the page' }])
    expect(llm.state.get('status')).toBe('ready')
    expect(llm.state.get('dtype')).toBe('q4')
    llm.reset()
    expect(llm.messages).toEqual([])
  })

  it('stop() interrupts generation and flags the result', async () => {
    const { container, module } = makeContainer()
    const llm = container.feature('localLlm', { transformers: module, device: 'wasm' }) as LocalLlm
    await llm.load()
    const result = await llm.generate([{ role: 'user', content: 'go' }], { onToken: () => llm.stop() })
    expect(result.interrupted).toBe(true)
    expect(result.tokens).toBe(1)
  })
})

describe('transcriber', () => {
  it('passes raw samples straight through and measures real-time factor', async () => {
    const { container, module } = makeContainer()
    const t = container.feature('transcriber', { transformers: module, device: 'wasm' }) as Transcriber
    const result = await t.transcribe(new Float32Array(32_000))
    expect(result.text).toBe('heard 32000 samples')
    expect(result.audioSeconds).toBe(2)
    expect(result.realtimeFactor).toBeGreaterThan(0)
    expect(t.state.get('lastText')).toBe('heard 32000 samples')
  })
})

describe('vision', () => {
  it('sorts labels best first and rejects an empty label list', async () => {
    const { container, module } = makeContainer()
    const v = container.feature('vision', { transformers: module, device: 'wasm' }) as Vision
    const result = await v.classify('blob:fake', ['cat', 'dog', 'bird'])
    expect(result.labels[0]).toEqual({ label: 'dog', score: 0.7 })
    expect(result.labels.length).toBe(3)
    await expect(v.classify('blob:fake', [])).rejects.toThrow(/at least one label/)
  })
})
