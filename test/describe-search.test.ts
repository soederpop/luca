import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import '../src/commands/index'
import { z } from 'zod'
import { AGIContainer } from '../src/agi/container.server'
import { SemanticSearch } from '../src/node/features/semantic-search'
import type { DocumentInput } from '../src/node/features/semantic-search'
import {
	buildCatalogDocuments,
	getDescribeSearch,
	ensureKeywordIndex,
	embeddingsStale,
	buildDescribeEmbeddings,
	sanitizeFtsQuery,
	queryDescribeIndex,
	describeIndexDir,
} from '../src/describe-search'

function fakeEmbedding(dims: number, seed = 0.5): number[] {
	const vec: number[] = []
	for (let i = 0; i < dims; i++) {
		vec.push(Math.sin(seed * (i + 1)) * 0.5)
	}
	return vec
}

/** Deterministic fake embed — never touches the daemon or native deps. */
function fakeEmbed(texts: string[]): Promise<number[][]> {
	return Promise.resolve(texts.map((t, i) => fakeEmbedding(768, (t.length % 13) + i + 1)))
}

describe('describe-search', () => {
	let tmpHome: string
	let previousHome: string | undefined
	let container: AGIContainer

	beforeEach(() => {
		tmpHome = mkdtempSync(join(tmpdir(), 'describe-search-test-'))
		previousHome = process.env.LUCA_HOME
		process.env.LUCA_HOME = tmpHome
		container = new AGIContainer().use(SemanticSearch) as AGIContainer
	})

	afterEach(() => {
		if (previousHome === undefined) delete process.env.LUCA_HOME
		else process.env.LUCA_HOME = previousHome
		container.commands.unregister('catalog-fixture')
		try { rmSync(tmpHome, { recursive: true, force: true }) } catch {}
	})

	describe('describeIndexDir', () => {
		it('lives under LUCA_HOME', () => {
			expect(describeIndexDir()).toBe(join(tmpHome, 'describe-index'))
		})
	})

	describe('buildCatalogDocuments', () => {
		it('produces one document per registered feature, client, and server', async () => {
			const docs = await buildCatalogDocuments(container)
			const byId = new Map(docs.map(d => [d.pathId, d]))

			for (const id of container.features.available) {
				expect(byId.has(`helper:features.${id}`)).toBe(true)
			}
			for (const id of (container as any).clients.available) {
				expect(byId.has(`helper:clients.${id}`)).toBe(true)
			}
			for (const id of (container as any).servers.available) {
				expect(byId.has(`helper:servers.${id}`)).toBe(true)
			}
		})

		it('helper docs carry kind/name/category/ref meta pointing at luca describe', async () => {
			const docs = await buildCatalogDocuments(container)
			const fs = docs.find(d => d.pathId === 'helper:features.fs')!
			expect(fs.model).toBe('helper')
			expect(fs.meta!.kind).toBe('feature')
			expect(fs.meta!.name).toBe('fs')
			expect(fs.meta!.category).toBe('filesystem')
			expect(fs.meta!.ref).toBe('luca describe features.fs')
			expect(fs.content.length).toBeGreaterThan(0)
			// method-level docs are indexed as sections
			const methods = fs.sections!.find(s => s.heading === 'Methods')
			expect(methods).toBeDefined()
			expect(methods!.content).toContain('readFile')
		})

		it('includes bundled examples and tutorials with parsed titles and reference paths', async () => {
			const docs = await buildCatalogDocuments(container)
			const examples = docs.filter(d => d.model === 'example')
			const tutorials = docs.filter(d => d.model === 'tutorial')
			expect(examples.length).toBeGreaterThan(0)
			expect(tutorials.length).toBeGreaterThan(0)
			for (const doc of [...examples, ...tutorials]) {
				expect(doc.title!.length).toBeGreaterThan(0)
				expect(doc.title!.startsWith('---')).toBe(false)
				expect(doc.meta!.ref).toContain('.claude/skills/luca-framework/references/')
			}
		})
	})

	describe('command discovery', () => {
		it('indexes public help without executing handlers, including focused subcommand examples', async () => {
			let invoked = false
			container.commands.registerHandler('catalog-fixture', {
				description: 'Manage release attestations',
				argsSchema: z.object({ signingKey: z.string().describe('Signing credential for attestation') }),
				positionals: [{ name: 'artifact', description: 'Artifact to attest' }],
				examples: ['luca catalog-fixture artifact.zip'],
				subcommands: { verify: { description: 'Verify signatures', examples: ['luca catalog-fixture verify uniqueattestationtoken'] } },
				handler: () => { invoked = true },
			})
			const docs = await buildCatalogDocuments(container)
			const command = docs.find(d => d.pathId === 'command:catalog-fixture')!
			expect(command.meta!.ref).toBe('luca catalog-fixture --help')
			expect(command.content).toContain('--signingKey')
			expect(command.content).toContain('Signing credential')
			expect(command.content).toContain('artifact.zip')
			expect(invoked).toBe(false)
			const result = await queryDescribeIndex(container, 'uniqueattestationtoken', { limit: 1 })
			expect(result.results[0]!.pathId).toBe(command.pathId)
			expect(invoked).toBe(false)
			// Metadata edits and removal must refresh the shared keyword index.
			container.commands.lookup('catalog-fixture').subcommands = {}
			expect((await queryDescribeIndex(container, 'uniqueattestationtoken')).results).toHaveLength(0)
			container.commands.unregister('catalog-fixture')
			await queryDescribeIndex(container, 'attestations')
			const ss = await getDescribeSearch(container)
			expect(await ss.search('"catalog-fixture"')).toHaveLength(0)
		})

		it('finds the CLI for packaging, fresh queries, and declarations in a short result budget', async () => {
			for (const [query, command] of [
				['bundle standalone binary', 'bundle'],
				['force fresh cached selector query', 'select'],
				['install TypeScript declarations for my project', 'setup'],
				['generate lint metadata public methods', 'introspect'],
			]) {
				const result = await queryDescribeIndex(container, query!, { limit: 3 })
				expect(result.results.some(r => r.pathId === `command:${command}`)).toBe(true)
				expect(new Set(result.results.map(r => r.pathId)).size).toBe(result.results.length)
				expect(result.results.length).toBeLessThanOrEqual(3)
			}
		})

		it('keeps new CLI entries discoverable when only older documents have embeddings', async () => {
			const ss = await getDescribeSearch(container)
			ss.embed = fakeEmbed
			const docs = await buildCatalogDocuments(container)
			await ss.indexDocuments(docs.filter(d => d.model === 'helper'))
			const result = await queryDescribeIndex(container, 'bundle standalone binary', { limit: 1 })
			expect(result.mode).toBe('keyword')
			expect(result.hint).toContain('stale')
			expect(result.results[0]!.meta!.ref).toBe('luca bundle --help')
		})
	})

	describe('sanitizeFtsQuery', () => {
		it('quotes tokens and OR-joins them', () => {
			expect(sanitizeFtsQuery('how do I build a rest server?'))
				.toBe('"how" OR "do" OR "I" OR "build" OR "a" OR "rest" OR "server"')
		})

		it('produces a query FTS5 accepts even when the raw query is FTS syntax', async () => {
			const ss = await getDescribeSearch(container)
			const docs = await buildCatalogDocuments(container)
			ensureKeywordIndex(ss, docs)
			// raw '?' and quotes are FTS5 syntax errors — sanitized must not throw
			const results = await ss.search(sanitizeFtsQuery('rest server? "quoted" (parens)'))
			expect(Array.isArray(results)).toBe(true)
		})
	})

	describe('keyword tier (no embeddings)', () => {
		it('answers queries in keyword mode with a calculate-embeddings hint', async () => {
			const outcome = await queryDescribeIndex(container, 'how do I build a rest server?')
			expect(outcome.mode).toBe('keyword')
			expect(outcome.results.length).toBeGreaterThan(0)
			expect(outcome.hint).toContain('luca describe --calculate-embeddings')
			// helper results are quota'd in ahead of examples/tutorials
			const helperResults = outcome.results.filter(r => r.pathId.startsWith('helper:'))
			expect(helperResults.length).toBeGreaterThan(0)
			const ids = outcome.results.map(r => r.pathId)
			expect(ids.some(id => id.includes('rest') || id.includes('express') || id.includes('server'))).toBe(true)
		})

		it('refreshes section-only help edits and metadata-only navigation edits', async () => {
			const ss = await getDescribeSearch(container)
			const doc: DocumentInput = {
				pathId: 'command:fixture', model: 'command', title: 'Fixture', content: 'Stable description',
				sections: [{ heading: 'Examples', headingPath: 'Examples', content: 'oldexampletoken', level: 2 }],
				meta: { ref: 'old pointer' },
			}
			ensureKeywordIndex(ss, [doc])
			const changed = { ...doc, sections: [{ ...doc.sections![0]!, content: 'newexampletoken' }], meta: { ref: 'luca fixture --help' } }
			expect(ensureKeywordIndex(ss, [changed])).toBe(1)
			expect(await ss.search('oldexampletoken')).toHaveLength(0)
			expect((await ss.search('newexampletoken'))[0]!.meta!.ref).toBe('luca fixture --help')
			const redirected = { ...changed, meta: { ref: 'luca fixture verify --help' } }
			expect(ensureKeywordIndex(ss, [redirected])).toBe(1)
			expect((await ss.search('newexampletoken'))[0]!.meta!.ref).toBe('luca fixture verify --help')
			expect(ensureKeywordIndex(ss, [redirected])).toBe(0)
		})

		it('re-running the keyword refresh only reindexes changed documents', async () => {
			const ss = await getDescribeSearch(container)
			const docs = await buildCatalogDocuments(container)
			expect(ensureKeywordIndex(ss, docs)).toBe(docs.length)
			expect(ensureKeywordIndex(ss, docs)).toBe(0)
		})
	})

	describe('embedding staleness (sharp edge: needsReindex masking)', () => {
		const docV1: DocumentInput = {
			pathId: 'helper:features.fixture',
			model: 'helper',
			title: 'fixture (feature)',
			content: 'A fixture feature about authentication.',
			sections: [
				{ heading: 'Methods', headingPath: 'Methods', content: 'login() — authenticate a user', level: 2 },
			],
		}
		const docV2: DocumentInput = {
			...docV1,
			content: 'A fixture feature about deployment pipelines.',
			sections: [
				{ heading: 'Methods', headingPath: 'Methods', content: 'deploy() — ship it', level: 2 },
			],
		}

		it('keyword refresh must NOT mask embedding staleness', async () => {
			const ss = await getDescribeSearch(container)
			ss.embed = fakeEmbed

			ensureKeywordIndex(ss, [docV1])
			await ss.indexDocuments([docV1])
			expect(embeddingsStale(ss, docV1)).toBe(false)

			// The doc changes; the keyword tier refreshes it inline (as every
			// --query does). This updates documents.content_hash, so
			// needsReindex() is blind to the stale embeddings...
			ensureKeywordIndex(ss, [docV2])
			expect(ss.needsReindex(docV2)).toBe(false)
			// ...but chunk-hash comparison still sees them:
			expect(embeddingsStale(ss, docV2)).toBe(true)
		})
	})

	describe('buildDescribeEmbeddings', () => {
		it('embeds the catalog, then reports nothing to do on a second run', async () => {
			const ss = await getDescribeSearch(container)
			ss.embed = fakeEmbed

			const first = await buildDescribeEmbeddings(container)
			expect(first.indexed).toBe(first.total)
			expect(first.total).toBeGreaterThan(0)
			expect(ss.getStats().embeddingCount).toBeGreaterThan(0)

			const second = await buildDescribeEmbeddings(container)
			expect(second.indexed).toBe(0)
			expect(second.total).toBe(first.total)
		})

		it('reports progress in batches', async () => {
			const ss = await getDescribeSearch(container)
			ss.embed = fakeEmbed

			const ticks: Array<[number, number]> = []
			await buildDescribeEmbeddings(container, { onProgress: (i, t) => ticks.push([i, t]) })
			expect(ticks.length).toBeGreaterThan(1)
			const [lastIndexed, lastTotal] = ticks[ticks.length - 1]!
			expect(lastIndexed).toBe(lastTotal)
		})
	})

	describe('hybrid tier', () => {
		it('switches to hybrid mode once embeddings exist', async () => {
			const ss = await getDescribeSearch(container)
			ss.embed = fakeEmbed

			await buildDescribeEmbeddings(container)
			const outcome = await queryDescribeIndex(container, 'how do I build a rest server?')
			expect(outcome.mode).toBe('hybrid')
			expect(outcome.results.length).toBeGreaterThan(0)
			expect(outcome.hint).toBeUndefined()
		})
	})
})
