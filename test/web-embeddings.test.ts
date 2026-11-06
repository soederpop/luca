import { describe, expect, it } from 'bun:test'
import { Embeddings, type TransformersModule, type EmbeddingsPipeline } from '../src/web/features/embeddings'
// Deliberately not the WebContainer: importing it registers the web vault/vm
// features into the shared registry and shadows the node ones for every test
// file that runs after this one. The feature only needs a container context.
import { NodeContainer } from '../src/node/container'

// A deterministic stand-in for a transformers.js feature-extraction pipeline:
// three-dimensional vectors derived from which keywords a text contains, so
// similarity rankings are predictable and no model download happens.
function fakeTransformers(log: string[] = []): TransformersModule {
  const pipe = (async (texts: string | string[], options?: { normalize?: boolean }) => {
    const inputs = Array.isArray(texts) ? texts : [texts]
    const data = new Float32Array(inputs.length * 3)
    inputs.forEach((text, i) => {
      const lower = text.toLowerCase()
      const v = [lower.includes('cat') ? 1 : 0, lower.includes('file') ? 1 : 0, 0.1]
      const norm = options?.normalize ? Math.hypot(...v) : 1
      v.forEach((x, j) => { data[i * 3 + j] = x / norm })
    })
    return { dims: [inputs.length, 3], data }
  }) as EmbeddingsPipeline
  return {
    env: {},
    pipeline: async (_task, model, options) => {
      log.push(`${model}:${options?.device}:${options?.dtype}`)
      return pipe
    },
  }
}

function makeContainer() {
  const container = new NodeContainer({}) as any
  container.use(Embeddings)
  return container
}

describe('web embeddings feature', () => {
  it('loads a pipeline through the injected module and reports dims and device', async () => {
    const log: string[] = []
    const container = makeContainer()
    const embeddings = container.feature('embeddings', { transformers: fakeTransformers(log), device: 'wasm' }) as Embeddings
    expect(embeddings.ready).toBe(false)
    await embeddings.load()
    expect(embeddings.ready).toBe(true)
    expect(embeddings.state.get('dims')).toBe(3)
    expect(embeddings.state.get('device')).toBe('wasm')
    expect(embeddings.state.get('dtype')).toBe('q8')
    expect(log).toEqual(['Xenova/all-MiniLM-L6-v2:wasm:q8'])
  })

  it('shares one in-flight load between concurrent callers', async () => {
    const log: string[] = []
    const container = makeContainer()
    const embeddings = container.feature('embeddings', { transformers: fakeTransformers(log), device: 'wasm' }) as Embeddings
    await Promise.all([embeddings.load(), embeddings.load(), embeddings.embed('x')])
    expect(log.length).toBe(1)
  })

  it('embeds in input order and returns normalized vectors', async () => {
    const container = makeContainer()
    const embeddings = container.feature('embeddings', { transformers: fakeTransformers(), device: 'wasm' }) as Embeddings
    const [cat, file] = await embeddings.embed(['a cat', 'a file'])
    expect(cat!.length).toBe(3)
    expect(cat![0]).toBeGreaterThan(cat![1]!)
    expect(file![1]).toBeGreaterThan(file![0]!)
    expect(Math.hypot(...cat!)).toBeCloseTo(1, 5)
    expect(await embeddings.embed([])).toEqual([])
  })

  it('ranks documents by cosine similarity to the query', async () => {
    const container = makeContainer()
    const embeddings = container.feature('embeddings', { transformers: fakeTransformers(), device: 'wasm' }) as Embeddings
    const hits = await embeddings.rank('read a file', ['ui.banner', 'the cat', 'fs.readFile'], { limit: 2 })
    expect(hits.length).toBe(2)
    expect(hits[0]!.text).toBe('fs.readFile')
    expect(hits[0]!.index).toBe(2)
    expect(hits[0]!.score).toBeGreaterThan(hits[1]!.score)
  })

  it('computes cosine similarity without assuming normalized input', () => {
    const container = makeContainer()
    const embeddings = container.feature('embeddings', { transformers: fakeTransformers() }) as Embeddings
    expect(embeddings.similarity([2, 0], [4, 0])).toBeCloseTo(1, 6)
    expect(embeddings.similarity([1, 0], [0, 1])).toBeCloseTo(0, 6)
    expect(embeddings.similarity([0, 0], [1, 1])).toBe(0)
    expect(() => embeddings.similarity([1], [1, 2])).toThrow(/mismatch/)
  })

  it('refuses webgpu when navigator.gpu is missing and records the error in state', async () => {
    const container = makeContainer()
    const embeddings = container.feature('embeddings', { transformers: fakeTransformers(), device: 'webgpu' }) as Embeddings
    await expect(embeddings.load()).rejects.toThrow(/WebGPU/)
    expect(embeddings.state.get('status')).toBe('error')
    expect(embeddings.state.get('error')).toMatch(/navigator.gpu/)
  })

  it('benchmark reports timings for the loaded device', async () => {
    const container = makeContainer()
    const embeddings = container.feature('embeddings', { transformers: fakeTransformers(), device: 'wasm' }) as Embeddings
    const result = await embeddings.benchmark({ batchSize: 4, iterations: 2 })
    expect(result.device).toBe('wasm')
    expect(result.batchSize).toBe(4)
    expect(result.iterations).toBe(2)
    expect(result.textsPerSecond).toBeGreaterThan(0)
  })
})
