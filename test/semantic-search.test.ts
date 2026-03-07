import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { SemanticSearch } from '../src/node/features/semantic-search'
import type { DocumentInput, Chunk } from '../src/node/features/semantic-search'
import { mkdtempSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { AGIContainer } from '../src/agi/container.server'

function makeTmpDir(): string {
	return mkdtempSync(join(tmpdir(), 'semantic-search-test-'))
}

function makeContainer(): AGIContainer {
	return new AGIContainer().use(SemanticSearch) as AGIContainer
}

function makeTestDoc(overrides: Partial<DocumentInput> = {}): DocumentInput {
	return {
		pathId: 'test/doc-1',
		model: 'Plan',
		title: 'Test Document',
		slug: 'test-doc-1',
		meta: { status: 'approved', priority: 'high' },
		content: 'This is a test document about authentication and login flows.',
		sections: [
			{ heading: 'Overview', headingPath: 'Overview', content: 'This section covers authentication basics.', level: 2 },
			{ heading: 'Implementation', headingPath: 'Overview > Implementation', content: 'We implement login using OAuth2 tokens and session management.', level: 3 },
		],
		...overrides,
	}
}

function fakeEmbedding(dims: number, seed = 0.5): Float32Array {
	const vec = new Float32Array(dims)
	for (let i = 0; i < dims; i++) {
		vec[i] = Math.sin(seed * (i + 1)) * 0.5
	}
	return vec
}

describe('SemanticSearch', () => {
	let tmpDir: string
	let container: AGIContainer
	let search: SemanticSearch

	beforeEach(() => {
		tmpDir = makeTmpDir()
		container = makeContainer()
		search = container.feature('semanticSearch', {
			dbPath: join(tmpDir, 'search.sqlite'),
			embeddingProvider: 'local',
			embeddingModel: 'embedding-gemma-300M-Q8_0',
			chunkStrategy: 'section',
		}) as unknown as SemanticSearch
	})

	afterEach(async () => {
		try { await search.close() } catch {}
		try { rmSync(tmpDir, { recursive: true, force: true }) } catch {}
	})

	describe('Feature scaffolding', () => {
		it('registers in the container', () => {
			expect(container.features.available).toContain('semanticSearch')
		})

		it('has correct shortcut', () => {
			expect(SemanticSearch.shortcut).toBe('features.semanticSearch')
		})

		it('initializes with default state', () => {
			expect(search.state.get('indexed')).toBe(0)
			expect(search.state.get('embedded')).toBe(0)
			expect(search.state.get('lastIndexedAt')).toBeNull()
			expect(search.state.get('dbReady')).toBe(false)
		})
	})

	describe('Database layer (2.2)', () => {
		it('initializes database and creates tables', async () => {
			await search.initDb()
			expect(search.state.get('dbReady')).toBe(true)

			const tables = search.db.query(
				"SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
			).all() as any[]
			const tableNames = tables.map((t: any) => t.name)

			expect(tableNames).toContain('search_meta')
			expect(tableNames).toContain('documents')
			expect(tableNames).toContain('chunks')
		})

		it('writes search_meta with provider, model, dims on init', async () => {
			await search.initDb()

			const getMeta = (key: string) =>
				(search.db.query('SELECT value FROM search_meta WHERE key = ?').get(key) as any)?.value

			expect(getMeta('provider')).toBe('local')
			expect(getMeta('model')).toBe('embedding-gemma-300M-Q8_0')
			expect(getMeta('dims')).toBe('768')
			expect(getMeta('createdAt')).toBeTruthy()
		})

		it('refuses to load with mismatched provider/model/dims', async () => {
			await search.initDb()
			// Get the actual db file path that was created
			const dbFile = join(tmpDir, 'search.local-embedding-gemma-300M-Q8_0.sqlite')
			expect(existsSync(dbFile)).toBe(true)
			await search.close()

			// Create a new instance that resolves to the SAME db file but expects different meta
			// We achieve this by directly constructing with options that resolve to the same path
			const search2 = container.feature('semanticSearch', {
				dbPath: join(tmpDir, 'search.sqlite'),
				embeddingProvider: 'local',
				embeddingModel: 'embedding-gemma-300M-Q8_0',
			}) as unknown as SemanticSearch

			// Manually tamper with the meta to simulate a mismatch
			await search2.initDb() // should work since same config

			// Now manually update meta to simulate mismatch
			search2.db.run("UPDATE search_meta SET value = 'openai' WHERE key = 'provider'")
			await search2.close()

			// Re-open with original config — should fail
			const search3 = container.feature('semanticSearch', {
				dbPath: join(tmpDir, 'search.sqlite'),
				embeddingProvider: 'local',
				embeddingModel: 'embedding-gemma-300M-Q8_0',
			}) as unknown as SemanticSearch

			try {
				await search3.initDb()
				expect(true).toBe(false)
			} catch (err: any) {
				expect(err.message).toContain('mismatch')
			}
		})

		it('creates FTS5 virtual table', async () => {
			await search.initDb()

			// FTS5 tables appear as regular tables in sqlite_master
			const vtables = search.db.query(
				"SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%fts%'"
			).all() as any[]
			const names = vtables.map((t: any) => t.name)
			expect(names.some((n: string) => n.includes('documents_fts'))).toBe(true)
		})

		it('dimensions are 768 for local gemma model', () => {
			expect(search.dimensions).toBe(768)
		})

		it('insertDocument stores document with correct metadata', async () => {
			await search.initDb()
			const doc = makeTestDoc()
			search.insertDocument(doc)

			const row = search.db.query('SELECT * FROM documents WHERE path_id = ?').get('test/doc-1') as any
			expect(row).toBeTruthy()
			expect(row.model).toBe('Plan')
			expect(row.title).toBe('Test Document')
			expect(row.content_hash).toBeTruthy()
			expect(row.indexed_at).toBeTruthy()
			expect(JSON.parse(row.meta_json)).toEqual({ status: 'approved', priority: 'high' })
		})

		it('insertDocument creates FTS5 entry', async () => {
			await search.initDb()
			search.insertDocument(makeTestDoc())

			const results = search.db.query(
				"SELECT * FROM documents_fts WHERE documents_fts MATCH 'authentication'"
			).all() as any[]
			expect(results.length).toBeGreaterThan(0)
		})

		it('removeDocument removes document, chunks, and FTS entry', async () => {
			await search.initDb()
			search.insertDocument(makeTestDoc())

			const chunk: Chunk = {
				pathId: 'test/doc-1',
				section: 'Overview',
				headingPath: 'Overview',
				seq: 0,
				content: 'test content',
				contentHash: 'abc123',
			}
			search.insertChunk(chunk, fakeEmbedding(768))

			expect((search.db.query('SELECT COUNT(*) as c FROM chunks').get() as any).c).toBe(1)

			search.removeDocument('test/doc-1')

			expect((search.db.query('SELECT COUNT(*) as c FROM documents').get() as any).c).toBe(0)
			expect((search.db.query('SELECT COUNT(*) as c FROM chunks').get() as any).c).toBe(0)
			expect((search.db.query("SELECT COUNT(*) as c FROM documents_fts WHERE documents_fts MATCH 'authentication'").get() as any).c).toBe(0)
		})

		it('getStats returns accurate counts', async () => {
			await search.initDb()
			search.insertDocument(makeTestDoc())

			const stats = search.getStats()
			expect(stats.documentCount).toBe(1)
			expect(stats.provider).toBe('local')
			expect(stats.model).toBe('embedding-gemma-300M-Q8_0')
			expect(stats.dimensions).toBe(768)
		})

		it('insertChunk stores chunk with embedding BLOB', async () => {
			await search.initDb()
			search.insertDocument(makeTestDoc())

			const chunk: Chunk = {
				pathId: 'test/doc-1',
				section: 'Overview',
				headingPath: 'Overview',
				seq: 0,
				content: 'test chunk content',
				contentHash: 'hash123',
			}

			const vec = fakeEmbedding(768, 0.7)
			search.insertChunk(chunk, vec)

			const chunkRow = search.db.query('SELECT * FROM chunks WHERE path_id = ?').get('test/doc-1') as any
			expect(chunkRow).toBeTruthy()
			expect(chunkRow.section).toBe('Overview')
			expect(chunkRow.heading_path).toBe('Overview')
			expect(chunkRow.content).toBe('test chunk content')
			expect(chunkRow.embedding).toBeTruthy()

			// Verify embedding roundtrip
			const restored = new Float32Array(
				new Uint8Array(chunkRow.embedding).buffer,
				chunkRow.embedding.byteOffset ?? 0,
				768,
			)
			expect(Math.abs(restored[0]! - vec[0]!)).toBeLessThan(0.0001)
		})
	})

	describe('Document chunking (2.4)', () => {
		it('section strategy splits at h2/h3 boundaries', () => {
			const doc = makeTestDoc()
			const chunks = search.chunkDocument(doc, 'section')

			expect(chunks.length).toBe(2)
			expect(chunks[0]!.section).toBe('Overview')
			expect(chunks[1]!.section).toBe('Implementation')
		})

		it('section strategy stores headingPath for each chunk', () => {
			const doc = makeTestDoc()
			const chunks = search.chunkDocument(doc, 'section')

			expect(chunks[0]!.headingPath).toBe('Overview')
			expect(chunks[1]!.headingPath).toBe('Overview > Implementation')
		})

		it('fixed strategy respects token limit and overlap', () => {
			const longContent = Array(1000).fill('word').join(' ')
			const doc = makeTestDoc({ content: longContent, sections: undefined })

			const chunks = search.chunkDocument(doc, 'fixed')
			expect(chunks.length).toBeGreaterThan(1)

			for (const chunk of chunks) {
				const wordCount = chunk.content.split(/\s+/).length
				expect(wordCount).toBeLessThanOrEqual(900 * 0.75 + 1)
			}
		})

		it('document strategy produces one chunk per doc', () => {
			const doc = makeTestDoc()
			const chunks = search.chunkDocument(doc, 'document')
			expect(chunks.length).toBe(1)
			expect(chunks[0]!.content).toBe(doc.content)
		})

		it('section strategy falls back to fixed for docs without sections', () => {
			const doc = makeTestDoc({ sections: undefined })
			const chunks = search.chunkDocument(doc, 'section')
			expect(chunks.length).toBeGreaterThan(0)
			expect(chunks[0]!.section).toBeUndefined()
		})

		it('pathId is used consistently in chunks', () => {
			const doc = makeTestDoc({ pathId: 'projects/my-project' })
			const chunks = search.chunkDocument(doc)
			for (const chunk of chunks) {
				expect(chunk.pathId).toBe('projects/my-project')
			}
		})

		it('chunks have content hashes', () => {
			const doc = makeTestDoc()
			const chunks = search.chunkDocument(doc)
			for (const chunk of chunks) {
				expect(chunk.contentHash).toBeTruthy()
				expect(chunk.contentHash.length).toBe(16)
			}
		})
	})

	describe('Search engine (2.5)', () => {
		it('BM25 search returns results for keyword queries', async () => {
			await search.initDb()
			search.insertDocument(makeTestDoc())
			search.insertDocument(makeTestDoc({
				pathId: 'test/doc-2',
				title: 'Deployment Guide',
				content: 'This document covers deployment and CI/CD pipelines.',
				sections: [
					{ heading: 'Pipelines', headingPath: 'Pipelines', content: 'CI/CD deployment pipelines.', level: 2 },
				],
			}))

			const results = await search.search('authentication')
			expect(results.length).toBeGreaterThan(0)
			expect(results[0]!.pathId).toBe('test/doc-1')
		})

		it('BM25 search with model filter', async () => {
			await search.initDb()
			search.insertDocument(makeTestDoc({ model: 'Plan' }))
			search.insertDocument(makeTestDoc({
				pathId: 'test/doc-2',
				model: 'Task',
				title: 'Auth Task',
				content: 'Authentication task for the sprint.',
				sections: [],
			}))

			const results = await search.search('authentication', { model: 'Plan' })
			for (const r of results) {
				expect(r.model).toBe('Plan')
			}
		})

		it('BM25 search with where filter applies json_extract', async () => {
			await search.initDb()
			search.insertDocument(makeTestDoc({ meta: { status: 'approved' } }))
			search.insertDocument(makeTestDoc({
				pathId: 'test/doc-2',
				meta: { status: 'draft' },
				content: 'Authentication draft document.',
				sections: [],
			}))

			const results = await search.search('authentication', { where: { status: 'approved' } })
			expect(results.length).toBe(1)
			expect(results[0]!.meta.status).toBe('approved')
		})

		it('vector search returns results ranked by similarity', async () => {
			await search.initDb()
			search.insertDocument(makeTestDoc())

			// Insert chunks with known embeddings
			const authVec = fakeEmbedding(768, 1.0)
			const deployVec = fakeEmbedding(768, 5.0)

			search.insertChunk({
				pathId: 'test/doc-1',
				section: 'Overview',
				headingPath: 'Overview',
				seq: 0,
				content: 'authentication and login flows',
				contentHash: 'hash1',
			}, authVec)

			search.insertDocument(makeTestDoc({
				pathId: 'test/doc-2',
				title: 'Deploy Guide',
				content: 'deployment pipelines',
				sections: [],
			}))

			search.insertChunk({
				pathId: 'test/doc-2',
				seq: 0,
				content: 'deployment and CI/CD',
				contentHash: 'hash2',
			}, deployVec)

			// Mock embed to return a vector similar to authVec
			const origEmbed = search.embed.bind(search)
			search.embed = async () => [Array.from(fakeEmbedding(768, 1.1))]

			const results = await search.vectorSearch('auth')
			expect(results.length).toBe(2)
			// First result should be closer to authVec (seed 1.0 vs 5.0)
			expect(results[0]!.pathId).toBe('test/doc-1')
			expect(results[0]!.score).toBeGreaterThan(results[1]!.score)

			search.embed = origEmbed
		})

		it('hybrid search combines BM25 and vector results via RRF', async () => {
			await search.initDb()
			search.insertDocument(makeTestDoc())
			search.insertChunk({
				pathId: 'test/doc-1',
				section: 'Overview',
				headingPath: 'Overview',
				seq: 0,
				content: 'authentication and login flows',
				contentHash: 'hash1',
			}, fakeEmbedding(768, 1.0))

			// Mock embed
			search.embed = async () => [Array.from(fakeEmbedding(768, 1.1))]

			const results = await search.hybridSearch('authentication')
			expect(results.length).toBeGreaterThan(0)
			expect(results[0]!.pathId).toBe('test/doc-1')
			// RRF score should be > single source score
			expect(results[0]!.score).toBeGreaterThan(0)
		})

		it('deepSearch throws v2 message', async () => {
			await search.initDb()
			try {
				await search.deepSearch('test')
				expect(true).toBe(false)
			} catch (err: any) {
				expect(err.message).toContain('v2')
			}
		})

		it('SearchResult includes citation fields', async () => {
			await search.initDb()
			search.insertDocument(makeTestDoc())

			const results = await search.search('authentication')
			expect(results.length).toBeGreaterThan(0)
			const r = results[0]!
			expect(r).toHaveProperty('pathId')
			expect(r).toHaveProperty('snippet')
			expect(r).toHaveProperty('matchedSection')
			expect(r).toHaveProperty('headingPath')
		})
	})

	describe('Index management (2.6)', () => {
		it('needsReindex detects changed documents', async () => {
			await search.initDb()
			const doc = makeTestDoc()
			search.insertDocument(doc)

			expect(search.needsReindex(doc)).toBe(false)

			const changed = { ...doc, content: 'completely new content' }
			expect(search.needsReindex(changed)).toBe(true)
		})

		it('needsReindex returns true for new documents', async () => {
			await search.initDb()
			expect(search.needsReindex(makeTestDoc())).toBe(true)
		})

		it('removeStale deletes documents no longer in collection', async () => {
			await search.initDb()
			search.insertDocument(makeTestDoc({ pathId: 'keep-this' }))
			search.insertDocument(makeTestDoc({ pathId: 'remove-this' }))

			search.removeStale(['keep-this'])

			const count = (search.db.query('SELECT COUNT(*) as c FROM documents').get() as any).c
			expect(count).toBe(1)
			const remaining = search.db.query('SELECT path_id FROM documents').get() as any
			expect(remaining.path_id).toBe('keep-this')
		})

		it('status returns accurate health information', async () => {
			await search.initDb()
			search.insertDocument(makeTestDoc())

			const status = search.status()
			expect(status.documentCount).toBe(1)
			expect(status.provider).toBe('local')
			expect(status.dimensions).toBe(768)
			expect(status.dbSizeBytes).toBeGreaterThan(0)
		})

		it('reindex clears all data when called without args', async () => {
			await search.initDb()
			search.insertDocument(makeTestDoc())

			await search.reindex()

			expect((search.db.query('SELECT COUNT(*) as c FROM documents').get() as any).c).toBe(0)
			expect((search.db.query('SELECT COUNT(*) as c FROM chunks').get() as any).c).toBe(0)
		})
	})

	describe('Embedding engine (2.3)', () => {
		it('getDimensions returns correct value for local provider', () => {
			expect(search.getDimensions()).toBe(768)
		})

		it('getDimensions returns 1536 for openai text-embedding-3-small', () => {
			const search2 = container.feature('semanticSearch', {
				dbPath: join(tmpDir, 'search-openai.sqlite'),
				embeddingProvider: 'openai',
				embeddingModel: 'text-embedding-3-small',
			}) as unknown as SemanticSearch
			expect(search2.getDimensions()).toBe(1536)
		})

		it('disposeModel can be called safely even without loaded model', async () => {
			await search.disposeModel()
			// Should not throw
		})
	})

	describe('Database path scoping', () => {
		it('scopes db path by provider and model', async () => {
			await search.initDb()
			const dbPath = join(tmpDir, 'search.local-embedding-gemma-300M-Q8_0.sqlite')
			expect(existsSync(dbPath)).toBe(true)
		})
	})

	describe('pathId consistency', () => {
		it('uses pathId consistently in all operations', async () => {
			await search.initDb()
			const pathId = 'projects/semantic-search/plan-1'
			const doc = makeTestDoc({ pathId })
			search.insertDocument(doc)

			const row = search.db.query('SELECT path_id FROM documents').get() as any
			expect(row.path_id).toBe(pathId)

			const chunks = search.chunkDocument(doc)
			for (const chunk of chunks) {
				expect(chunk.pathId).toBe(pathId)
			}

			expect(search.needsReindex(doc)).toBe(false)
		})
	})
})
