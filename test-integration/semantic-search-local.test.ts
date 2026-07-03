import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { requireEnv, describeWithRequirements } from './helpers'
import { AGIContainer } from '../src/agi/container.server'
import { SemanticSearch } from '../src/node/features/semantic-search'
import { mkdtempSync, rmSync, existsSync, statSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

// The gguf weights are a few hundred MB — opt in explicitly with
// LUCA_TEST_MODEL_DOWNLOAD=1 bun run test:integration
const optIn = requireEnv('LUCA_TEST_MODEL_DOWNLOAD')

describeWithRequirements('semanticSearch local model weight download', [optIn], () => {
  let cacheDir: string
  let originalXdg: string | undefined

  beforeAll(() => {
    cacheDir = mkdtempSync(join(tmpdir(), 'luca-model-download-'))
    originalXdg = process.env.XDG_CACHE_HOME
    process.env.XDG_CACHE_HOME = cacheDir
  })

  afterAll(() => {
    if (originalXdg === undefined) delete process.env.XDG_CACHE_HOME
    else process.env.XDG_CACHE_HOME = originalXdg
    rmSync(cacheDir, { recursive: true, force: true })
  })

  it('downloads the gguf weights to the cache and skips when present', async () => {
    const container = new AGIContainer().use(SemanticSearch) as AGIContainer
    const search = container.feature('semanticSearch', {
      embeddingProvider: 'local',
    }) as unknown as SemanticSearch

    const modelPath = await search.downloadModelWeights()
    expect(existsSync(modelPath)).toBe(true)
    expect(modelPath).toContain(join(cacheDir, 'luca', 'models'))
    // embedding-gemma Q8_0 is ~300MB — anything tiny means we saved an error page
    expect(statSync(modelPath).size).toBeGreaterThan(100_000_000)

    // Second call returns instantly with the same path (no re-download)
    const started = Date.now()
    const again = await search.downloadModelWeights()
    expect(again).toBe(modelPath)
    expect(Date.now() - started).toBeLessThan(1000)
  }, 600_000)
})
