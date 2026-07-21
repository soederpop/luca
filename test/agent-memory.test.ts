import { describe, it, expect } from 'bun:test'
import { AGIContainer } from '../src/agi/container.server'

// These tests assert how the memory feature wires its embedding backend
// through to the semanticSearch feature and the openai client. They never
// hit the network — embedding calls are covered by the integration suite
// (test-integration/memory.test.ts). The point here is the option
// pass-through and default resolution, which is pure config logic.

function makeContainer(): AGIContainer {
	return new AGIContainer()
}

// The searcher getter is private; reach it via any for white-box assertions.
function searcherFor(opts: Record<string, any>) {
	const mem = makeContainer().feature('memory', opts) as any
	return mem.searcher
}

describe('memory embedding backend wiring', () => {
	it('defaults to the openai provider with the back-compat 3072-dim model', () => {
		const s = searcherFor({ namespace: 'a' })
		expect(s.options.embeddingProvider).toBe('openai')
		expect(s.embeddingModel).toBe('text-embedding-3-large')
		expect(s.dimensions).toBe(3072)
	})

	it('resolves the local provider to embedding-gemma (not an openai model name)', () => {
		const s = searcherFor({ namespace: 'b', embeddingProvider: 'local' })
		expect(s.options.embeddingProvider).toBe('local')
		expect(s.embeddingModel).toBe('embedding-gemma-300M-Q8_0')
		expect(s.dimensions).toBe(768)
	})

	it('honors an explicit embeddingModel over the provider default', () => {
		const s = searcherFor({ namespace: 'c', embeddingModel: 'text-embedding-3-small' })
		expect(s.options.embeddingProvider).toBe('openai')
		expect(s.embeddingModel).toBe('text-embedding-3-small')
		expect(s.dimensions).toBe(1536)
	})

	it('threads embeddingBaseURL and embeddingApiKey to the searcher', () => {
		const s = searcherFor({
			namespace: 'd',
			embeddingBaseURL: 'http://localhost:11434/v1',
			embeddingApiKey: 'sk-test',
			embeddingModel: 'nomic-embed-text',
		})
		expect(s.options.embeddingBaseURL).toBe('http://localhost:11434/v1')
		expect(s.options.embeddingApiKey).toBe('sk-test')
	})
})

describe('memory openai client selection', () => {
	// _embedOpenAI builds the client WITH baseURL/apiKey so a custom endpoint
	// gets its own cached instance rather than colliding with the env-configured
	// default. Verify the client factory keys on those options.
	it('gives distinct baseURLs distinct client instances, and caches identical ones', () => {
		const c: any = makeContainer()
		const a = c.client('openai', { baseURL: 'http://localhost:11434/v1', apiKey: 'sk-a' })
		const b = c.client('openai', { baseURL: 'https://litellm.internal/v1', apiKey: 'sk-b' })
		const a2 = c.client('openai', { baseURL: 'http://localhost:11434/v1', apiKey: 'sk-a' })

		expect(a.openai.baseURL).toBe('http://localhost:11434/v1')
		expect(b.openai.baseURL).toBe('https://litellm.internal/v1')
		expect(a).not.toBe(b)
		expect(a).toBe(a2)
	})

	it('applies a stub key when a baseURL is set but no key is given', () => {
		const c: any = makeContainer()
		// Without a real OPENAI_API_KEY, a baseURL-only client must not throw —
		// the openai client falls back to a stub key for compatible endpoints.
		const client = c.client('openai', { baseURL: 'http://localhost:11434/v1' })
		expect(client.openai).toBeDefined()
		expect(client.openai.baseURL).toBe('http://localhost:11434/v1')
	})
})
