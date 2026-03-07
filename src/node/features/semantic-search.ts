import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'
import type { Container } from '@soederpop/luca/container'
import { type AvailableFeatures } from '@soederpop/luca/feature'
import { features, Feature } from '../feature.js'
import { Database } from 'bun:sqlite'
import { createHash } from 'node:crypto'
import { mkdirSync, existsSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'

declare module '@soederpop/luca/feature' {
	interface AvailableFeatures {
		semanticSearch: typeof SemanticSearch
	}
}

// ── Schemas ─────────────────────────────────────────────────────────

export const SemanticSearchOptionsSchema = FeatureOptionsSchema.extend({
	dbPath: z.string().default('.contentbase/search.sqlite').describe('Path to the SQLite database file'),
	embeddingModel: z.string().default('text-embedding-3-small').describe('Embedding model name'),
	embeddingProvider: z.enum(['local', 'openai']).default('openai').describe('Where to generate embeddings'),
	chunkStrategy: z.enum(['section', 'fixed', 'document']).default('section').describe('How to split documents'),
	chunkSize: z.number().default(900).describe('Token limit per chunk for fixed strategy'),
	chunkOverlap: z.number().default(0.15).describe('Overlap ratio for fixed strategy'),
})

export const SemanticSearchStateSchema = FeatureStateSchema.extend({
	indexed: z.number().default(0).describe('Count of indexed documents'),
	embedded: z.number().default(0).describe('Count of documents with embeddings'),
	lastIndexedAt: z.string().nullable().default(null).describe('ISO timestamp of last indexing'),
	dbReady: z.boolean().default(false).describe('Whether SQLite is initialized'),
})

export type SemanticSearchOptions = z.infer<typeof SemanticSearchOptionsSchema>
export type SemanticSearchState = z.infer<typeof SemanticSearchStateSchema>

// ── Types ───────────────────────────────────────────────────────────

export interface Chunk {
	pathId: string
	section?: string
	headingPath?: string
	seq: number
	content: string
	contentHash: string
}

export interface SearchResult {
	pathId: string
	model: string
	title: string
	meta: Record<string, any>
	score: number
	snippet: string
	matchedSection?: string
	headingPath?: string
}

export interface SearchOptions {
	limit?: number
	model?: string
	where?: Record<string, any>
}

export interface HybridSearchOptions extends SearchOptions {
	ftsWeight?: number
	vecWeight?: number
}

export interface IndexStatus {
	documentCount: number
	chunkCount: number
	embeddingCount: number
	lastIndexedAt: string | null
	provider: string
	model: string
	dimensions: number
	dbSizeBytes: number
}

export interface DocumentInput {
	pathId: string
	model?: string
	title?: string
	slug?: string
	meta?: Record<string, any>
	content: string
	sections?: Array<{ heading: string; headingPath: string; content: string; level: number }>
}

// ── Dimension map ───────────────────────────────────────────────────

const DIMENSION_MAP: Record<string, number> = {
	'embedding-gemma-300M-Q8_0': 768,
	'text-embedding-3-small': 1536,
	'text-embedding-3-large': 3072,
}

function getDimensions(provider: string, model: string): number {
	if (provider === 'openai') {
		return DIMENSION_MAP[model] ?? 1536
	}
	return DIMENSION_MAP[model] ?? 768
}

// ── Model path resolution ───────────────────────────────────────────

const MODEL_FILENAMES: Record<string, string> = {
	'embedding-gemma-300M-Q8_0': 'hf_ggml-org_embeddinggemma-300M-Q8_0.gguf',
}

function resolveModelPath(modelName: string): string {
	const filename = MODEL_FILENAMES[modelName] ?? `${modelName}.gguf`
	const lucaCache = join(process.env.HOME!, '.cache/luca/models', filename)
	if (existsSync(lucaCache)) return lucaCache
	const qmdCache = join(process.env.HOME!, '.cache/qmd/models', filename)
	if (existsSync(qmdCache)) return qmdCache
	return lucaCache
}

// ── Content hashing ─────────────────────────────────────────────────

function contentHash(text: string): string {
	return createHash('sha256').update(text).digest('hex').slice(0, 16)
}

// ── Vector math ─────────────────────────────────────────────────────

function cosineSimilarity(a: Float32Array, b: Float32Array): number {
	let dot = 0, normA = 0, normB = 0
	for (let i = 0; i < a.length; i++) {
		dot += a[i]! * b[i]!
		normA += a[i]! * a[i]!
		normB += b[i]! * b[i]!
	}
	const denom = Math.sqrt(normA) * Math.sqrt(normB)
	return denom === 0 ? 0 : dot / denom
}

function vecToBlob(vec: Float32Array): Buffer {
	return Buffer.from(vec.buffer, vec.byteOffset, vec.byteLength)
}

function blobToVec(blob: Buffer | Uint8Array): Float32Array {
	const bytes = blob instanceof Uint8Array ? blob : new Uint8Array(blob)
	return new Float32Array(bytes.buffer, bytes.byteOffset, bytes.byteLength / 4)
}

// ── Chunking functions ──────────────────────────────────────────────

function chunkBySection(doc: DocumentInput, maxTokens: number): Chunk[] {
	const chunks: Chunk[] = []
	const sections = doc.sections || []

	if (sections.length === 0) {
		return chunkByFixed(doc, maxTokens, 0.15)
	}

	for (let i = 0; i < sections.length; i++) {
		const section = sections[i]!
		const prefix = doc.title ? `${doc.title} > ${section.headingPath}` : section.headingPath
		const text = `${prefix}\n\n${section.content}`

		const words = text.split(/\s+/)
		const wordLimit = Math.floor(maxTokens * 0.75)

		if (words.length <= wordLimit) {
			chunks.push({
				pathId: doc.pathId,
				section: section.heading,
				headingPath: section.headingPath,
				seq: chunks.length,
				content: text,
				contentHash: contentHash(text),
			})
		} else {
			const subChunks = splitAtParagraphs(text, wordLimit)
			for (const sub of subChunks) {
				chunks.push({
					pathId: doc.pathId,
					section: section.heading,
					headingPath: section.headingPath,
					seq: chunks.length,
					content: sub,
					contentHash: contentHash(sub),
				})
			}
		}
	}

	return chunks
}

function splitAtParagraphs(text: string, wordLimit: number): string[] {
	const paragraphs = text.split(/\n\n+/)
	const results: string[] = []
	let current: string[] = []
	let currentWords = 0

	for (const para of paragraphs) {
		const paraWords = para.split(/\s+/).length
		if (currentWords + paraWords > wordLimit && current.length > 0) {
			results.push(current.join('\n\n'))
			current = [para]
			currentWords = paraWords
		} else {
			current.push(para)
			currentWords += paraWords
		}
	}

	if (current.length > 0) {
		results.push(current.join('\n\n'))
	}

	return results
}

function chunkByFixed(doc: DocumentInput, maxTokens: number, overlapPct: number): Chunk[] {
	const words = doc.content.split(/\s+/)
	const chunkSize = Math.floor(maxTokens * 0.75)
	const overlap = Math.floor(chunkSize * overlapPct)
	const chunks: Chunk[] = []
	let start = 0

	while (start < words.length) {
		const end = Math.min(start + chunkSize, words.length)
		const text = words.slice(start, end).join(' ')
		chunks.push({
			pathId: doc.pathId,
			seq: chunks.length,
			content: text,
			contentHash: contentHash(text),
		})
		if (end >= words.length) break
		start = end - overlap
	}

	return chunks
}

function chunkByDocument(doc: DocumentInput): Chunk[] {
	return [{
		pathId: doc.pathId,
		seq: 0,
		content: doc.content,
		contentHash: contentHash(doc.content),
	}]
}

// ── Feature class ───────────────────────────────────────────────────

/**
 * Semantic search feature providing BM25 keyword search, vector similarity search,
 * and hybrid search with Reciprocal Rank Fusion over a SQLite-backed index.
 *
 * Uses bun:sqlite for FTS5 keyword search and BLOB-stored embeddings with
 * JavaScript cosine similarity for vector search.
 *
 * @extends Feature
 *
 * @example
 * ```typescript
 * const search = container.feature('semanticSearch', {
 *   dbPath: '.contentbase/search.sqlite',
 *   embeddingProvider: 'local',
 * })
 * await search.initDb()
 * await search.indexDocuments(docs)
 * const results = await search.hybridSearch('how does authentication work')
 * ```
 */
export class SemanticSearch extends Feature<SemanticSearchState, SemanticSearchOptions> {
	static override stateSchema = SemanticSearchStateSchema
	static override optionsSchema = SemanticSearchOptionsSchema
	static override shortcut = 'features.semanticSearch' as const

	private _db: Database | null = null
	private _llamaContext: any = null
	private _llamaModel: any = null
	private _llamaInstance: any = null
	private _idleTimer: ReturnType<typeof setTimeout> | null = null
	private _dimensions: number

	static attach(container: Container<AvailableFeatures, any>) {
		features.register('semanticSearch', SemanticSearch)
		return container
	}

	override get initialState(): SemanticSearchState {
		return {
			...super.initialState,
			indexed: 0,
			embedded: 0,
			lastIndexedAt: null,
			dbReady: false,
		}
	}

	constructor(options: SemanticSearchOptions, context: any) {
		super(options, context)
		this._dimensions = getDimensions(this.options.embeddingProvider, this.options.embeddingModel)
	}

	// ── Database path ───────────────────────────────────────────────

	private get resolvedDbPath(): string {
		const base = this.options.dbPath.replace(/\.sqlite$/, '')
		const suffix = `${this.options.embeddingProvider}-${this.options.embeddingModel}`
		return `${base}.${suffix}.sqlite`
	}

	get db(): Database {
		if (!this._db) throw new Error('Database not initialized. Call initDb() first.')
		return this._db
	}

	get dimensions(): number {
		return this._dimensions
	}

	// ── 2.2 Database Layer ──────────────────────────────────────────

	async initDb(): Promise<void> {
		const dbPath = this.resolvedDbPath
		const dir = dirname(dbPath)
		if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

		const isNew = !existsSync(dbPath)
		this._db = new Database(dbPath)

		this._db.exec('PRAGMA journal_mode = WAL')
		this._db.exec('PRAGMA foreign_keys = ON')

		if (isNew) {
			this._createTables()
			this._writeMeta()
		} else {
			this._verifyMeta()
		}

		this.state.set('dbReady', true)
		this.emit('dbReady')
	}

	private _createTables(): void {
		this.db.exec(`
			CREATE TABLE search_meta (
				key TEXT PRIMARY KEY,
				value TEXT NOT NULL
			)
		`)

		this.db.exec(`
			CREATE TABLE documents (
				path_id TEXT PRIMARY KEY,
				model TEXT,
				title TEXT,
				slug TEXT,
				meta_json TEXT,
				content TEXT,
				sections_json TEXT,
				content_hash TEXT,
				indexed_at TEXT
			)
		`)

		this.db.exec(`
			CREATE VIRTUAL TABLE documents_fts USING fts5(
				path_id, title, content, sections_text,
				tokenize='porter unicode61'
			)
		`)

		this.db.exec(`
			CREATE TABLE chunks (
				id INTEGER PRIMARY KEY AUTOINCREMENT,
				path_id TEXT NOT NULL,
				section TEXT,
				heading_path TEXT,
				seq INTEGER NOT NULL,
				content TEXT NOT NULL,
				content_hash TEXT NOT NULL,
				embedding BLOB,
				FOREIGN KEY (path_id) REFERENCES documents(path_id) ON DELETE CASCADE
			)
		`)
	}

	private _writeMeta(): void {
		const insert = this.db.prepare('INSERT INTO search_meta (key, value) VALUES (?, ?)')
		const tx = this.db.transaction(() => {
			insert.run('provider', this.options.embeddingProvider)
			insert.run('model', this.options.embeddingModel)
			insert.run('dims', String(this._dimensions))
			insert.run('createdAt', new Date().toISOString())
		})
		tx()
	}

	private _verifyMeta(): void {
		const getMeta = this.db.query('SELECT value FROM search_meta WHERE key = ?')
		const stored = {
			provider: (getMeta.get('provider') as any)?.value,
			model: (getMeta.get('model') as any)?.value,
			dims: (getMeta.get('dims') as any)?.value,
		}

		const expected = {
			provider: this.options.embeddingProvider,
			model: this.options.embeddingModel,
			dims: String(this._dimensions),
		}

		if (stored.provider !== expected.provider || stored.model !== expected.model || stored.dims !== expected.dims) {
			this._db?.close()
			this._db = null
			throw new Error(
				`Database provider/model mismatch. ` +
				`Stored: ${stored.provider}/${stored.model} (${stored.dims}d). ` +
				`Expected: ${expected.provider}/${expected.model} (${expected.dims}d). ` +
				`Delete the database and re-index to switch providers.`
			)
		}
	}

	insertDocument(doc: DocumentInput): void {
		const sectionsText = doc.sections?.map(s => `${s.heading}\n${s.content}`).join('\n\n') ?? ''

		const hash = contentHash(doc.content)
		const now = new Date().toISOString()

		this.db.prepare(
			`INSERT OR REPLACE INTO documents (path_id, model, title, slug, meta_json, content, sections_json, content_hash, indexed_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
		).run(
			doc.pathId,
			doc.model ?? null,
			doc.title ?? null,
			doc.slug ?? null,
			doc.meta ? JSON.stringify(doc.meta) : null,
			doc.content,
			doc.sections ? JSON.stringify(doc.sections) : null,
			hash,
			now,
		)

		// Sync FTS5
		this.db.prepare('DELETE FROM documents_fts WHERE path_id = ?').run(doc.pathId)
		this.db.prepare(
			'INSERT INTO documents_fts(path_id, title, content, sections_text) VALUES(?, ?, ?, ?)'
		).run(doc.pathId, doc.title ?? '', doc.content, sectionsText)
	}

	insertChunk(chunk: Chunk, embedding: Float32Array): void {
		this.db.prepare(
			`INSERT INTO chunks (path_id, section, heading_path, seq, content, content_hash, embedding)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`
		).run(
			chunk.pathId,
			chunk.section ?? null,
			chunk.headingPath ?? null,
			chunk.seq,
			chunk.content,
			chunk.contentHash,
			vecToBlob(embedding),
		)
	}

	removeDocument(pathId: string): void {
		this.db.prepare('DELETE FROM documents_fts WHERE path_id = ?').run(pathId)
		this.db.prepare('DELETE FROM chunks WHERE path_id = ?').run(pathId)
		this.db.prepare('DELETE FROM documents WHERE path_id = ?').run(pathId)
	}

	getStats(): IndexStatus {
		const docCount = (this.db.query('SELECT COUNT(*) as c FROM documents').get() as any).c
		const chunkCount = (this.db.query('SELECT COUNT(*) as c FROM chunks').get() as any).c
		const embCount = (this.db.query('SELECT COUNT(*) as c FROM chunks WHERE embedding IS NOT NULL').get() as any).c
		const lastDoc = this.db.query('SELECT indexed_at FROM documents ORDER BY indexed_at DESC LIMIT 1').get() as any

		let dbSize = 0
		try { dbSize = statSync(this.resolvedDbPath).size } catch {}

		return {
			documentCount: docCount,
			chunkCount: chunkCount,
			embeddingCount: embCount,
			lastIndexedAt: lastDoc?.indexed_at ?? null,
			provider: this.options.embeddingProvider,
			model: this.options.embeddingModel,
			dimensions: this._dimensions,
			dbSizeBytes: dbSize,
		}
	}

	// ── 2.3 Embedding Engine ────────────────────────────────────────

	async embed(texts: string[]): Promise<number[][]> {
		if (this.options.embeddingProvider === 'openai') {
			return this._embedOpenAI(texts)
		}
		return this._embedLocal(texts)
	}

	private async _embedLocal(texts: string[]): Promise<number[][]> {
		const ctx = await this._ensureLocalModel()
		const results: number[][] = []

		for (const text of texts) {
			try {
				const embedding = await ctx.getEmbeddingFor(text)
				results.push(Array.from(new Float32Array(embedding.vector)))
			} catch {
				const truncated = text.split(/\s+/).slice(0, 300).join(' ')
				try {
					const embedding = await ctx.getEmbeddingFor(truncated)
					results.push(Array.from(new Float32Array(embedding.vector)))
				} catch {
					results.push(new Array(this._dimensions).fill(0))
				}
			}
		}

		this._resetIdleTimer()
		return results
	}

	private async _embedOpenAI(texts: string[]): Promise<number[][]> {
		const openai = (this.container as any).client('openai') as any
		const results: number[][] = []

		for (let i = 0; i < texts.length; i += 2048) {
			const batch = texts.slice(i, i + 2048)
			const response = await openai.openai.embeddings.create({
				model: this.options.embeddingModel === 'embedding-gemma-300M-Q8_0'
					? 'text-embedding-3-small'
					: this.options.embeddingModel,
				input: batch,
			})
			for (const item of response.data) {
				results.push(item.embedding)
			}
		}

		return results
	}

	async ensureModel(): Promise<void> {
		if (this.options.embeddingProvider === 'local') {
			await this._ensureLocalModel()
		}
	}

	private async _ensureLocalModel(): Promise<any> {
		if (this._llamaContext) return this._llamaContext

		let getLlama: any
		try {
			// Try resolving from the project's node_modules first (for compiled binary),
			// then fall back to regular dynamic import
			const cwdModulePath = join(process.cwd(), 'node_modules', 'node-llama-cpp')
			try {
				;({ getLlama } = await import(cwdModulePath))
			} catch {
				;({ getLlama } = await import('node-llama-cpp'))
			}
		} catch {
			throw new Error(
				'Local embeddings require node-llama-cpp which is not installed.\n' +
				'Either:\n' +
				'  1. Use OpenAI embeddings (default): set embeddingProvider to "openai"\n' +
				'  2. Install node-llama-cpp: bun add --optional node-llama-cpp@3.17.1\n' +
				'  3. Use the helper: await semanticSearch.installLocalEmbeddings(process.cwd())'
			)
		}
		this._llamaInstance = await getLlama()

		const modelPath = resolveModelPath(this.options.embeddingModel)
		if (!existsSync(modelPath)) {
			throw new Error(
				`Embedding model not found at ${modelPath}. ` +
				`Download it to ~/.cache/luca/models/ or ~/.cache/qmd/models/`
			)
		}

		this._llamaModel = await this._llamaInstance.loadModel({ modelPath })
		this._llamaContext = await this._llamaModel.createEmbeddingContext({ contextSize: 2048 })

		this.emit('modelLoaded')
		return this._llamaContext
	}

	private _resetIdleTimer(): void {
		if (this._idleTimer) clearTimeout(this._idleTimer)
		this._idleTimer = setTimeout(() => this.disposeModel(), 5 * 60 * 1000)
	}

	async disposeModel(): Promise<void> {
		if (this._idleTimer) {
			clearTimeout(this._idleTimer)
			this._idleTimer = null
		}
		if (this._llamaContext) {
			await this._llamaContext.dispose()
			this._llamaContext = null
		}
		if (this._llamaModel) {
			await this._llamaModel.dispose()
			this._llamaModel = null
		}
		if (this._llamaInstance) {
			await this._llamaInstance.dispose()
			this._llamaInstance = null
		}
		this.emit('modelDisposed')
	}

	getDimensions(): number {
		return this._dimensions
	}

	// ── 2.4 Document Chunking ───────────────────────────────────────

	chunkDocument(doc: DocumentInput, strategy?: 'section' | 'fixed' | 'document'): Chunk[] {
		const strat = strategy ?? this.options.chunkStrategy

		switch (strat) {
			case 'section':
				return chunkBySection(doc, this.options.chunkSize)
			case 'fixed':
				return chunkByFixed(doc, this.options.chunkSize, this.options.chunkOverlap)
			case 'document':
				return chunkByDocument(doc)
			default:
				return chunkByFixed(doc, this.options.chunkSize, this.options.chunkOverlap)
		}
	}

	// ── 2.5 Search Engine ───────────────────────────────────────────

	async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
		const limit = options.limit ?? 10
		const whereClause = this._buildWhereClause(options)

		const stmt = this.db.query(`
			SELECT f.path_id, f.title, f.content,
				d.model, d.meta_json,
				bm25(documents_fts, 0, 1, 2, 1) as score,
				snippet(documents_fts, 2, '>>>', '<<<', '...', 40) as snippet
			FROM documents_fts f
			JOIN documents d ON d.path_id = f.path_id
			WHERE documents_fts MATCH ?
			${whereClause}
			ORDER BY score
			LIMIT ?
		`)

		const rows = stmt.all(query, limit) as any[]

		return rows.map(r => ({
			pathId: r.path_id,
			model: r.model ?? '',
			title: r.title ?? '',
			meta: r.meta_json ? JSON.parse(r.meta_json) : {},
			score: -r.score, // FTS5 bm25 returns negative (lower = better)
			snippet: r.snippet ?? '',
			matchedSection: undefined,
			headingPath: undefined,
		}))
	}

	async vectorSearch(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
		const limit = options.limit ?? 10
		const embeddings = await this.embed([query])
		const queryVec = new Float32Array(embeddings[0]!)

		// Fetch all chunks with embeddings
		const rows = this.db.query(`
			SELECT c.id, c.path_id, c.section, c.heading_path, c.content, c.embedding,
				d.model, d.title, d.meta_json
			FROM chunks c
			JOIN documents d ON d.path_id = c.path_id
			WHERE c.embedding IS NOT NULL
		`).all() as any[]

		// Compute cosine similarity and rank
		const scored: Array<{ row: any; similarity: number }> = []
		for (const r of rows) {
			if (!this._matchesFilters(r, options)) continue
			const chunkVec = blobToVec(r.embedding)
			const similarity = cosineSimilarity(queryVec, chunkVec)
			scored.push({ row: r, similarity })
		}

		scored.sort((a, b) => b.similarity - a.similarity)

		// Deduplicate by pathId, keep best score
		const seen = new Map<string, (typeof scored)[0]>()
		for (const s of scored) {
			if (!seen.has(s.row.path_id)) {
				seen.set(s.row.path_id, s)
			}
		}

		return Array.from(seen.values())
			.slice(0, limit)
			.map(s => ({
				pathId: s.row.path_id,
				model: s.row.model ?? '',
				title: s.row.title ?? '',
				meta: s.row.meta_json ? JSON.parse(s.row.meta_json) : {},
				score: s.similarity,
				snippet: (s.row.content ?? '').substring(0, 200),
				matchedSection: s.row.section ?? undefined,
				headingPath: s.row.heading_path ?? undefined,
			}))
	}

	async hybridSearch(query: string, options: HybridSearchOptions = {}): Promise<SearchResult[]> {
		const limit = options.limit ?? 10
		const fetchLimit = Math.max(limit * 2, 20)

		const [bm25Results, vecResults] = await Promise.all([
			this.search(query, { ...options, limit: fetchLimit }).catch(() => [] as SearchResult[]),
			this.vectorSearch(query, { ...options, limit: fetchLimit }),
		])

		return this._fuseRRF(bm25Results, vecResults, limit)
	}

	async deepSearch(_query: string, _options: SearchOptions = {}): Promise<SearchResult[]> {
		throw new Error('deepSearch is not yet implemented (planned for v2). Use hybridSearch() instead.')
	}

	private _fuseRRF(bm25Results: SearchResult[], vecResults: SearchResult[], limit: number): SearchResult[] {
		const RRF_K = 60
		const scores = new Map<string, { score: number; result: SearchResult }>()

		for (let i = 0; i < bm25Results.length; i++) {
			const r = bm25Results[i]!
			const rrfScore = 1 / (RRF_K + i + 1)
			scores.set(r.pathId, { score: rrfScore, result: r })
		}

		for (let i = 0; i < vecResults.length; i++) {
			const r = vecResults[i]!
			const rrfScore = 1 / (RRF_K + i + 1)
			const existing = scores.get(r.pathId)
			if (existing) {
				existing.score += rrfScore
				if (r.matchedSection) existing.result.matchedSection = r.matchedSection
				if (r.headingPath) existing.result.headingPath = r.headingPath
			} else {
				scores.set(r.pathId, { score: rrfScore, result: r })
			}
		}

		return Array.from(scores.values())
			.sort((a, b) => b.score - a.score)
			.slice(0, limit)
			.map(s => ({ ...s.result, score: s.score }))
	}

	private _buildWhereClause(options: SearchOptions): string {
		const conditions: string[] = []

		if (options.model) {
			conditions.push(`d.model = '${options.model.replace(/'/g, "''")}'`)
		}

		if (options.where) {
			for (const [key, value] of Object.entries(options.where)) {
				const escaped = String(value).replace(/'/g, "''")
				conditions.push(`json_extract(d.meta_json, '$.${key}') = '${escaped}'`)
			}
		}

		return conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : ''
	}

	private _matchesFilters(row: any, options: SearchOptions): boolean {
		if (options.model && row.model !== options.model) return false
		if (options.where && row.meta_json) {
			const meta = JSON.parse(row.meta_json)
			for (const [key, value] of Object.entries(options.where)) {
				if (meta[key] !== value) return false
			}
		}
		return true
	}

	// ── 2.6 Index Management ────────────────────────────────────────

	async indexDocuments(docs: DocumentInput[]): Promise<void> {
		const tx = this.db.transaction(() => {
			for (const doc of docs) {
				this.insertDocument(doc)
			}
		})
		tx()

		// Chunk and embed
		const allChunks: Chunk[] = []
		for (const doc of docs) {
			const chunks = this.chunkDocument(doc)
			for (const chunk of chunks) {
				allChunks.push(chunk)
			}
		}

		// Batch embed all chunks
		const texts = allChunks.map(c => c.content)
		const embeddings = await this.embed(texts)

		// Insert chunks + vectors in a transaction
		const insertTx = this.db.transaction(() => {
			for (let i = 0; i < allChunks.length; i++) {
				this.insertChunk(allChunks[i]!, new Float32Array(embeddings[i]!))
			}
		})
		insertTx()

		const now = new Date().toISOString()
		this.state.set('indexed', (this.state.get('indexed') ?? 0) + docs.length)
		this.state.set('embedded', (this.state.get('embedded') ?? 0) + allChunks.length)
		this.state.set('lastIndexedAt', now)

		this.emit('indexed', { documents: docs.length, chunks: allChunks.length })
	}

	async reindex(pathIds?: string[]): Promise<void> {
		if (pathIds) {
			for (const pathId of pathIds) {
				this.removeDocument(pathId)
			}
		} else {
			this.db.exec('DELETE FROM chunks')
			this.db.exec('DELETE FROM documents_fts')
			this.db.exec('DELETE FROM documents')
		}
	}

	removeStale(currentPathIds: string[]): void {
		const existing = (this.db.query('SELECT path_id FROM documents').all() as any[])
			.map(r => r.path_id)

		const currentSet = new Set(currentPathIds)
		const stale = existing.filter((id: string) => !currentSet.has(id))

		for (const pathId of stale) {
			this.removeDocument(pathId)
		}
	}

	needsReindex(doc: DocumentInput): boolean {
		const row = this.db.query('SELECT content_hash FROM documents WHERE path_id = ?').get(doc.pathId) as any
		if (!row) return true
		return row.content_hash !== contentHash(doc.content)
	}

	status(): IndexStatus {
		return this.getStats()
	}

	// ── Local Embeddings Install ────────────────────────────────────

	static readonly PINNED_LLAMA_VERSION = '3.17.1'

	/**
	 * Install node-llama-cpp into the user's project for local embedding support.
	 * Detects package manager from lockfile presence and verifies the native addon loads.
	 */
	async installLocalEmbeddings(cwd: string): Promise<void> {
		const { execSync } = await import('node:child_process')
		const pkg = `node-llama-cpp@${SemanticSearch.PINNED_LLAMA_VERSION}`

		let cmd: string
		if (existsSync(join(cwd, 'bun.lockb')) || existsSync(join(cwd, 'bun.lock'))) {
			cmd = `bun add --optional ${pkg}`
		} else if (existsSync(join(cwd, 'pnpm-lock.yaml'))) {
			cmd = `pnpm add --save-optional ${pkg}`
		} else if (existsSync(join(cwd, 'yarn.lock'))) {
			cmd = `yarn add --optional ${pkg}`
		} else {
			cmd = `npm install --save-optional ${pkg}`
		}

		try {
			execSync(cmd, { cwd, stdio: 'pipe', timeout: 120_000 })
		} catch (err: any) {
			const stderr = err?.stderr?.toString() ?? ''
			throw new Error(
				`Failed to install ${pkg} via: ${cmd}\n` +
				(stderr ? `stderr: ${stderr}\n` : '') +
				`If this is an ABI mismatch, ensure your Node/Bun version matches the prebuilt binary.`
			)
		}

		// Verify the native addon actually loads
		const modulePath = join(cwd, 'node_modules', 'node-llama-cpp')
		try {
			await import(modulePath)
		} catch (err: any) {
			throw new Error(
				`node-llama-cpp was installed but failed to load from ${modulePath}.\n` +
				`This usually means a native addon ABI mismatch.\n` +
				`Error: ${err?.message ?? err}`
			)
		}
	}

	// ── Lifecycle ───────────────────────────────────────────────────

	async close(): Promise<void> {
		await this.disposeModel()
		if (this._db) {
			this._db.close()
			this._db = null
		}
		this.state.set('dbReady', false)
	}
}
