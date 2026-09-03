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

/** Run fn with OPENAI_API_KEY / OPENAI_BASE_URL pinned to specific values (undefined = unset). */
function withEnv(vars: Record<string, string | undefined>, fn: () => void) {
	const saved: Record<string, string | undefined> = {}
	for (const [k, v] of Object.entries(vars)) {
		saved[k] = process.env[k]
		if (v === undefined) delete process.env[k]
		else process.env[k] = v
	}
	try { fn() } finally {
		for (const [k, v] of Object.entries(saved)) {
			if (v === undefined) delete process.env[k]
			else process.env[k] = v
		}
	}
}

describe('memory embedding backend wiring', () => {
	it('defaults to the openai provider (back-compat 3072-dim model) when a key is configured', () => {
		withEnv({ OPENAI_API_KEY: 'sk-test' }, () => {
			const s = searcherFor({ namespace: 'a' })
			expect(s.options.embeddingProvider).toBe('openai')
			expect(s.embeddingModel).toBe('text-embedding-3-large')
			expect(s.dimensions).toBe(3072)
		})
	})

	it('falls back to local embeddings on a keyless machine instead of a guaranteed failure', () => {
		withEnv({ OPENAI_API_KEY: undefined, OPENAI_BASE_URL: undefined }, () => {
			const s = searcherFor({ namespace: 'a2' })
			expect(s.options.embeddingProvider).toBe('local')
			expect(s.embeddingModel).toBe('embedding-gemma-300M-Q8_0')
			expect(s.dimensions).toBe(768)
		})
	})

	it('an explicit embeddingProvider always wins over the smart default', () => {
		withEnv({ OPENAI_API_KEY: undefined, OPENAI_BASE_URL: undefined }, () => {
			const s = searcherFor({ namespace: 'a3', embeddingProvider: 'openai' })
			expect(s.options.embeddingProvider).toBe('openai')
		})
	})

	it('resolves the local provider to embedding-gemma (not an openai model name)', () => {
		const s = searcherFor({ namespace: 'b', embeddingProvider: 'local' })
		expect(s.options.embeddingProvider).toBe('local')
		expect(s.embeddingModel).toBe('embedding-gemma-300M-Q8_0')
		expect(s.dimensions).toBe(768)
	})

	it('honors an explicit embeddingModel over the provider default', () => {
		const s = searcherFor({ namespace: 'c', embeddingModel: 'text-embedding-3-small', embeddingApiKey: 'sk-test' })
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

// --- Belief lifecycle + consolidation ---
//
// These tests run against a real sqlite file but stub the embedder with
// hand-picked 3-dim vectors, so similarity is fully controlled and nothing
// hits the network. The consolidation judge is scripted the same way.

const VECS: Record<string, number[]> = {
	'User prefers codex': [1, 0, 0],
	'The user prefers codex for coding tasks': [0.98, 0.2, 0],
	'User no longer prefers codex; now prefers claude-code': [0.8, 0.6, 0],
	'User drinks black coffee': [0, 0, 1],
	'which provider does the user prefer': [1, 0.1, 0],
}

let dbCounter = 0
function makeMem() {
	const c = makeContainer()
	const tmp = c.feature('os').tmpdir
	const dbPath = c.paths.resolve(tmp, `agent-memory-test-${process.pid}-${Date.now()}-${dbCounter++}.db`)
	const mem = c.feature('memory', { namespace: 'test', dbPath }) as any
	mem._searcher = { embed: async (texts: string[]) => texts.map(t => VECS[t] ?? [0.577, 0.577, 0.577]) }
	return mem
}

describe('memory belief lifecycle', () => {
	it('observe appends episodic rows without dedup', async () => {
		const mem = makeMem()
		const a = await mem.observe('facts', 'User prefers codex')
		const b = await mem.observe('facts', 'User prefers codex')
		expect(a.layer).toBe('episodic')
		expect(a.status).toBe('active')
		expect(a.confirmations).toBe(1)
		expect(a.reviewed_epoch).toBe(0)
		expect(b.id).not.toBe(a.id)
		expect(await mem.count('facts')).toBe(2)
	})

	it('revise supersedes the old row and keeps the audit trail', async () => {
		const mem = makeMem()
		const old = await mem.create('facts', 'User prefers codex')
		const revised = await mem.revise('facts', old.id, 'User no longer prefers codex; now prefers claude-code')
		expect(revised).not.toBeNull()
		expect(revised.status).toBe('active')
		expect(revised.layer).toBe('belief')
		expect(revised.derived_from).toEqual([old.id])

		const oldAfter = await mem.get('facts', old.id)
		expect(oldAfter.status).toBe('superseded')
		expect(oldAfter.superseded_by).toBe(revised.id)

		const active = await mem.search('facts', 'which provider does the user prefer', 10)
		expect(active.map((r: any) => r.id)).toEqual([revised.id])

		const all = await mem.search('facts', 'which provider does the user prefer', 10, { includeInactive: true })
		expect(all.length).toBe(2)
	})

	it('retract removes a row from search results', async () => {
		const mem = makeMem()
		const row = await mem.create('facts', 'User prefers codex')
		expect(await mem.retract('facts', row.id)).toBe(true)
		const results = await mem.search('facts', 'which provider does the user prefer', 10)
		expect(results.length).toBe(0)
	})

	it('search bumps usage_count unless tracking is off', async () => {
		const mem = makeMem()
		const row = await mem.create('facts', 'User prefers codex')
		await mem.search('facts', 'which provider does the user prefer', 5)
		await mem.search('facts', 'which provider does the user prefer', 5, { trackUsage: false })
		const after = await mem.get('facts', row.id)
		expect(after.usage_count).toBe(1)
		expect(after.last_used_at).not.toBeNull()
	})
})

describe('memory consolidate', () => {
	// The scripted judge: for the codex cluster, merge the duplicate into the
	// original and let the correction supersede it. For anything else, keep.
	function scriptedJudge(calls: string[] = []) {
		return async (prompt: string) => {
			calls.push(prompt)
			const rows = prompt.split('\n').filter(l => l.startsWith('{')).map(l => JSON.parse(l))
			const correction = rows.find(r => r.text.includes('no longer'))
			if (correction) {
				const original = rows.find(r => r.text === 'User prefers codex')
				const dup = rows.find(r => r.text.includes('coding tasks'))
				return JSON.stringify({ actions: [
					{ type: 'merge', ids: [original.id, dup.id] },
					{ type: 'supersede', ids: [correction.id, original.id] },
				] })
			}
			return JSON.stringify({ actions: [{ type: 'keep', ids: rows.map(r => r.id) }] })
		}
	}

	async function seed(mem: any) {
		const original = await mem.create('facts', 'User prefers codex')
		const dup = await mem.observe('facts', 'The user prefers codex for coding tasks')
		const correction = await mem.observe('facts', 'User no longer prefers codex; now prefers claude-code')
		const coffee = await mem.observe('facts', 'User drinks black coffee')
		return { original, dup, correction, coffee }
	}

	it('merges duplicates, resolves contradictions, and advances the epoch', async () => {
		const mem = makeMem()
		const { original, dup, correction, coffee } = await seed(mem)

		const report = await mem.consolidate({ judge: scriptedJudge() })

		expect(report.merged).toBe(1)
		expect(report.superseded).toBe(1)
		expect(report.warnings).toEqual([])
		expect(mem.getEpoch()).toBe(2)

		const originalAfter = await mem.get('facts', original.id)
		expect(originalAfter.status).toBe('superseded')
		expect(originalAfter.superseded_by).toBe(correction.id)
		expect(originalAfter.confirmations).toBe(2) // absorbed the duplicate first

		const dupAfter = await mem.get('facts', dup.id)
		expect(dupAfter.status).toBe('consolidated')
		expect(dupAfter.superseded_by).toBe(original.id)

		const correctionAfter = await mem.get('facts', correction.id)
		expect(correctionAfter.status).toBe('active')
		expect(correctionAfter.layer).toBe('belief')

		const coffeeAfter = await mem.get('facts', coffee.id)
		expect(coffeeAfter.status).toBe('active')
		expect(coffeeAfter.reviewed_epoch).toBe(1)

		// Recall now surfaces only the current belief — the stale rows are gone
		// from the read path, not outranked but unreachable.
		const results = await mem.search('facts', 'which provider does the user prefer', 10)
		expect(results.map((r: any) => r.id)).toContain(correction.id)
		expect(results.map((r: any) => r.id)).not.toContain(original.id)
		expect(results.map((r: any) => r.id)).not.toContain(dup.id)
	})

	it('dryRun reports actions without changing anything', async () => {
		const mem = makeMem()
		const { original, dup } = await seed(mem)

		const report = await mem.consolidate({ judge: scriptedJudge(), dryRun: true })

		expect(report.dryRun).toBe(true)
		expect(report.merged).toBe(1)
		expect(report.superseded).toBe(1)
		expect(mem.getEpoch()).toBe(1)
		expect((await mem.get('facts', original.id)).status).toBe('active')
		expect((await mem.get('facts', dup.id)).status).toBe('active')
	})

	it('kept singletons are judged once, then decay after going unused', async () => {
		const mem = makeMem()
		await mem.create('facts', 'User prefers codex')
		const coffee = await mem.observe('facts', 'User drinks black coffee')

		const firstCalls: string[] = []
		await mem.consolidate({ judge: scriptedJudge(firstCalls) })
		expect((await mem.get('facts', coffee.id)).reviewed_epoch).toBe(1)

		// Jump ahead: the row was reviewed in epoch 1 and never recalled since.
		await mem.setEpoch(5)
		const secondCalls: string[] = []
		await mem.consolidate({ judge: scriptedJudge(secondCalls) })

		// Not re-judged (already reviewed), and decayed to dormant.
		expect(secondCalls.some(p => p.includes('coffee'))).toBe(false)
		const coffeeAfter = await mem.get('facts', coffee.id)
		expect(coffeeAfter.status).toBe('dormant')
	})
})

describe('remember tool intent routing', () => {
	it('observation appends; correction with regarding supersedes; confirmation strengthens', async () => {
		const mem = makeMem()

		const obs = await mem.remember({ category: 'facts', text: 'User prefers codex' })
		expect(obs.stored).toBe(true)
		expect((await mem.get('facts', obs.id)).layer).toBe('episodic')

		const conf = await mem.remember({ category: 'facts', text: 'User prefers codex', intent: 'confirmation', regarding: obs.id })
		expect(conf.confirmed).toBe(true)
		expect(conf.confirmations).toBe(2)

		const corr = await mem.remember({ category: 'facts', text: 'User no longer prefers codex; now prefers claude-code', intent: 'correction', regarding: obs.id })
		expect(corr.stored).toBe(true)
		expect(corr.superseded).toBe(obs.id)
		expect((await mem.get('facts', obs.id)).status).toBe('superseded')
		expect((await mem.get('facts', corr.id)).status).toBe('active')
	})

	it('correction without regarding returns candidates instead of storing a contradiction', async () => {
		const mem = makeMem()
		const old = await mem.create('facts', 'User prefers codex')

		const result = await mem.remember({ category: 'facts', text: 'User no longer prefers codex; now prefers claude-code', intent: 'correction' })
		expect(result.stored).toBe(false)
		expect(result.candidates.map((c: any) => c.id)).toContain(old.id)
		// The old belief is untouched until the model re-calls with the id.
		expect((await mem.get('facts', old.id)).status).toBe('active')
		expect(await mem.count('facts')).toBe(1)
	})

	it('correction with nothing to correct falls back to an observation', async () => {
		const mem = makeMem()
		const result = await mem.remember({ category: 'facts', text: 'User drinks black coffee', intent: 'correction' })
		expect(result.stored).toBe(true)
		expect(result.note).toContain('stored as a new observation')
	})

	it('forget retracts by id and keeps the reason in metadata', async () => {
		const mem = makeMem()
		const row = await mem.create('facts', 'User prefers codex')
		const result = await mem.forget({ category: 'facts', id: row.id, reason: 'user said to drop it' })
		expect(result.retracted).toBe(true)
		const after = await mem.get('facts', row.id)
		expect(after.status).toBe('retracted')
		expect(after.metadata.retracted_reason).toBe('user said to drop it')
	})
})

describe('memory feature-level judge/decay options', () => {
	it('accepts provider, model, and dormantAfterEpochs as feature options', () => {
		const c = makeContainer()
		const mem = c.feature('memory', { namespace: 'opts', provider: 'deepseek-v4-local', model: 'x', dormantAfterEpochs: 5 }) as any
		expect(mem.options.provider).toBe('deepseek-v4-local')
		expect(mem.options.model).toBe('x')
		expect(mem.options.dormantAfterEpochs).toBe(5)
	})

	it('consolidate uses the feature-level dormantAfterEpochs default', async () => {
		const c = makeContainer()
		const tmp = c.feature('os').tmpdir
		const dbPath = c.paths.resolve(tmp, `agent-memory-test-${process.pid}-${Date.now()}-opts.db`)
		const mem = c.feature('memory', { namespace: 'test', dbPath, dormantAfterEpochs: 1 }) as any
		mem._searcher = { embed: async (texts: string[]) => texts.map(t => VECS[t] ?? [0.577, 0.577, 0.577]) }

		const keepJudge = async (prompt: string) => {
			const rows = prompt.split('\n').filter(l => l.startsWith('{')).map(l => JSON.parse(l))
			return JSON.stringify({ actions: [{ type: 'keep', ids: rows.map(r => r.id) }] })
		}

		const row = await mem.observe('facts', 'User drinks black coffee')
		await mem.consolidate({ judge: keepJudge })       // reviewed in epoch 1
		await mem.setEpoch(3)
		await mem.consolidate({ judge: keepJudge })       // 1 <= 3-1 → dormant
		expect((await mem.get('facts', row.id)).status).toBe('dormant')
	})
})
