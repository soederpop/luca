import { describe, expect, it } from 'bun:test'
import { AGIContainer } from '../src/agi/container.server'
import type { DiscoveredModelServer } from '../src/agi/features/model-providers'

/**
 * `suggestConfig()` is the pure half of `luca setup --providers`: it turns
 * discovery hits into a model-providers.yml-shaped document. Hermetic
 * container so the developer's machine config can't leak in.
 */
const createProviders = (container = new AGIContainer()) =>
  container.feature('modelProviders', { useConfigFiles: false } as any)

const server = (overrides: Partial<DiscoveredModelServer> = {}): DiscoveredModelServer => ({
  baseURL: 'http://127.0.0.1:1234/v1',
  host: '127.0.0.1',
  port: 1234,
  source: 'localhost',
  hint: 'LM Studio',
  models: ['qwen3-27b'],
  latencyMs: 12,
  ...overrides,
})

describe('ModelProviders.suggestConfig', () => {
  it('names loopback servers `local` and ids them host-port', () => {
    const suggestion = createProviders().suggestConfig([server()])
    expect(suggestion.hosts).toEqual({ local: 'http://127.0.0.1:1234/v1' })
    expect(suggestion.providers).toEqual({ 'local-1234': 'local/qwen3-27b' })
  })

  it('uses the tailscale hostname as the host name', () => {
    const suggestion = createProviders().suggestConfig([
      server({
        baseURL: 'http://spark-f941:8888/v1',
        host: '100.64.0.2',
        port: 8888,
        source: 'tailscale',
        hostname: 'spark-f941',
        models: ['deepseek-v4-flash-vision-exp'],
      }),
    ])
    expect(suggestion.hosts).toEqual({ 'spark-f941': 'http://spark-f941:8888/v1' })
    expect(suggestion.providers).toEqual({ 'spark-f941-8888': 'spark-f941/deepseek-v4-flash-vision-exp' })
  })

  it('reuses an existing host name when the baseURL already has one', () => {
    const suggestion = createProviders().suggestConfig([server()], {
      hosts: { local: 'http://localhost:1234/v1' },
    })
    expect(suggestion.hosts).toEqual({ local: 'http://localhost:1234/v1' })
    expect(suggestion.providers).toEqual({ 'local-1234': 'local/qwen3-27b' })
  })

  it('appends the port rather than overwrite a host name taken by another URL', () => {
    const suggestion = createProviders().suggestConfig([server()], {
      hosts: { local: 'http://127.0.0.1:9999/v1' },
    })
    expect(suggestion.hosts).toEqual({
      local: 'http://127.0.0.1:9999/v1',
      'local-1234': 'http://127.0.0.1:1234/v1',
    })
    expect(suggestion.providers['local-1234']).toBe('local-1234/qwen3-27b')
  })

  it('suffixes a provider id that would collide with an existing one', () => {
    const suggestion = createProviders().suggestConfig([server()], {
      existingProviderIds: ['local-1234'],
    })
    expect(suggestion.providers).toEqual({ 'local-1234-2': 'local/qwen3-27b' })
  })

  it('honours a per-baseURL model override and falls back for empty model lists', () => {
    const suggestion = createProviders().suggestConfig(
      [server(), server({ baseURL: 'http://127.0.0.1:8080/v1', port: 8080, models: [] })],
      { models: { 'http://127.0.0.1:1234/v1': 'chosen-model' } },
    )
    expect(suggestion.providers['local-1234']).toBe('local/chosen-model')
    expect(suggestion.providers['local-8080']).toBe('local-8080/local-model')
  })

  it('uses the object form when a model id contains a slash', async () => {
    const mp = createProviders()
    const suggestion = mp.suggestConfig([server({ models: ['/Users/me/.cache/models/gemma-4.gguf'] })])
    expect(suggestion.providers['local-1234']).toEqual({ host: 'local', model: '/Users/me/.cache/models/gemma-4.gguf' })

    const [id] = mp.registerFromConfig({ hosts: suggestion.hosts, ...suggestion.providers })
    const resolved = await mp.resolve({ provider: id })
    expect(resolved.baseURL).toBe('http://127.0.0.1:1234/v1')
    expect(resolved.model).toBe('/Users/me/.cache/models/gemma-4.gguf')
  })

  it('produces a document the config loader reads back verbatim', async () => {
    const mp = createProviders()
    const suggestion = mp.suggestConfig([
      server(),
      server({ baseURL: 'http://spark-f941:8888/v1', host: '100.64.0.2', port: 8888, source: 'tailscale', hostname: 'spark-f941', models: ['deepseek-v4'] }),
    ])

    const ids = mp.registerFromConfig({ hosts: suggestion.hosts, ...suggestion.providers })
    expect(ids).toEqual(['local-1234', 'spark-f941-8888'])

    const resolved = await mp.resolve({ provider: 'spark-f941-8888' })
    expect(resolved.baseURL).toBe('http://spark-f941:8888/v1')
    expect(resolved.model).toBe('deepseek-v4')
    expect(resolved.auth).toBe('none')
    expect(resolved.apiMode).toBe('openai-chat-completions')
  })
})
