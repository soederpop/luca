import { describe, expect, it } from 'bun:test'
import { AGIContainer } from '../src/agi/container.server'

describe('OpenAIClient credential resolution', () => {
  it('stubs the api key when a custom baseURL is set and no key is available', () => {
    const c = new AGIContainer()
    const client = c.client('openai', { baseURL: 'http://localhost:1234/v1', apiKey: undefined }) as any
    // Should construct without throwing and carry a stub key.
    expect(client.raw.apiKey).toBe('not-needed')
    expect(client.raw.baseURL).toBe('http://localhost:1234/v1')
  })

  it('passes an explicit api key through even with a custom baseURL', () => {
    const c = new AGIContainer()
    const client = c.client('openai', { baseURL: 'http://localhost:1234/v1', apiKey: 'sk-real' }) as any
    expect(client.raw.apiKey).toBe('sk-real')
  })

  it('reaches a local endpoint through a Conversation with only clientOptions.baseURL', () => {
    const c = new AGIContainer()
    // The repro: baseURL in clientOptions, no apiKey / OPENAI_API_KEY.
    const conv = c.feature('conversation', {
      model: 'qwen',
      clientOptions: { baseURL: 'http://localhost:1234/v1' },
    }) as any
    // Accessing the client used to throw "missing OPENAI_API_KEY"; now it stubs.
    expect(conv.openai.raw.apiKey).toBe('not-needed')
    expect(conv.openai.raw.baseURL).toBe('http://localhost:1234/v1')
  })
})
