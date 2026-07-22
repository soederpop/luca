/**
 * describe-search — the search layer behind `luca describe --query`.
 *
 * Builds a searchable catalog of every registered helper (features, clients,
 * servers) plus the bundled examples and tutorials, indexes it with the
 * semanticSearch feature in a machine-wide store under ~/.luca/describe-index,
 * and answers natural-language queries with ranked pointers back to
 * `luca describe <name>` / skill references.
 *
 * Two tiers:
 *  - keyword (BM25/FTS5) — always available, zero native deps
 *  - hybrid (BM25 + local embeddings via RRF) — after `luca describe
 *    --calculate-embeddings` (requires `luca setup --local-embeddings`)
 *
 * Invalidation is per-document content hashing: the keyword index refreshes
 * inline on every query (sub-100ms for ~100 docs); embedding staleness is
 * detected by comparing chunk hashes against stored embedded chunks, NOT
 * `needsReindex()` — the keyword refresh updates `documents.content_hash`,
 * which would otherwise mask embedding staleness forever.
 */
import { join } from 'node:path'
import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { Database } from 'bun:sqlite'
import { lucaHome } from './setup/paths.js'
import { installedBinaryPath } from './node/features/llama-server.js'
import type { DocumentInput, SearchResult, SemanticSearch } from './node/features/semantic-search.js'
import { DEFAULT_LOCAL_MODEL, resolveModelPath } from './node/features/semantic-search.js'

/** Where the shared describe index lives. The catalog is a property of the binary (not the project), so all projects share one index. */
export function describeIndexDir(): string {
	return join(lucaHome(), 'describe-index')
}

const DB_BASENAME = 'search.sqlite'

/** The provider/model-namespaced sqlite file semanticSearch will actually create for our options. */
function resolvedDbFile(): string {
	return join(describeIndexDir(), `search.local-${DEFAULT_LOCAL_MODEL}.sqlite`)
}

const HINTS = {
	buildIndex: 'Semantic ranking is off — keyword (BM25) matches only. Run: luca describe --calculate-embeddings',
	installDeps: 'Semantic ranking is off — keyword (BM25) matches only. Run: luca setup --local-embeddings, then: luca describe --calculate-embeddings',
	stale: (n: number) => `Embedding index is stale for ${n} entr${n === 1 ? 'y' : 'ies'} — re-run: luca describe --calculate-embeddings`,
}

// ── Catalog construction ────────────────────────────────────────────

const REGISTRY_KINDS: Array<{ registry: string; kind: string }> = [
	{ registry: 'features', kind: 'feature' },
	{ registry: 'clients', kind: 'client' },
	{ registry: 'servers', kind: 'server' },
]

function firstSentence(text: string): string {
	const clean = (text || '').trim().replace(/\s+/g, ' ')
	const match = clean.match(/^.*?[.!?](\s|$)/)
	return (match ? match[0] : clean).trim()
}

/** Compact `name(params) — description` lines for a methods/getters map. */
function memberLines(members: Record<string, any>, withParams: boolean): string {
	return Object.entries(members || {})
		.map(([name, m]) => {
			const params = withParams ? `(${Object.keys(m?.parameters || {}).join(', ')})` : ''
			const desc = firstSentence(m?.description || '')
			return `${name}${params}${desc ? ` — ${desc}` : ''}`
		})
		.join('\n')
}

/** Strip YAML frontmatter, returning { title, body }. Title falls back to the first heading, then the filename. */
function parseFrontmatter(raw: string, fallbackTitle: string): { title: string; body: string } {
	let body = raw
	let title = ''
	const fm = raw.match(/^---\n([\s\S]*?)\n---\n?/)
	if (fm) {
		body = raw.slice(fm[0].length)
		const titleMatch = fm[1]!.match(/^title:\s*['"]?(.+?)['"]?\s*$/m)
		if (titleMatch) title = titleMatch[1]!.trim()
	}
	if (!title) {
		const heading = body.match(/^#\s+(.+)$/m)
		title = heading ? heading[1]!.trim() : fallbackTitle
	}
	return { title, body }
}

/** Split a markdown body into `##`-delimited sections (mirrors content-db's splitter). */
function splitSections(body: string): DocumentInput['sections'] {
	const sections: NonNullable<DocumentInput['sections']> = []
	let currentHeading: string | null = null
	let currentContent: string[] = []

	for (const line of body.split('\n')) {
		const h2 = line.match(/^## (.+)/)
		if (h2) {
			if (currentHeading) {
				sections.push({ heading: currentHeading, headingPath: currentHeading, content: currentContent.join('\n').trim(), level: 2 })
			}
			currentHeading = h2[1]!.trim()
			currentContent = []
		} else if (currentHeading) {
			currentContent.push(line)
		}
	}
	if (currentHeading) {
		sections.push({ heading: currentHeading, headingPath: currentHeading, content: currentContent.join('\n').trim(), level: 2 })
	}
	return sections
}

/**
 * Build one DocumentInput per registered helper (from in-memory introspection,
 * zero I/O) plus one per bundled example and tutorial.
 */
export async function buildCatalogDocuments(container: any): Promise<DocumentInput[]> {
	const docs: DocumentInput[] = []

	for (const { registry: registryName, kind } of REGISTRY_KINDS) {
		const registry = container[registryName]
		if (!registry?.available) continue

		for (const id of registry.available as string[]) {
			let Ctor: any
			try { Ctor = registry.lookup(id) } catch { continue }
			const intro = Ctor?.introspect?.()
			const description = intro?.description || Ctor?.description || ''

			const sections: NonNullable<DocumentInput['sections']> = []
			const methodsText = memberLines(intro?.methods || {}, true)
			const gettersText = memberLines(intro?.getters || {}, false)
			const eventsText = memberLines(intro?.events || {}, false)
			const optionsText = Object.entries(intro?.options || {})
				.map(([name, o]: [string, any]) => `${name} — ${firstSentence(o?.description || '')}`)
				.join('\n')
			if (methodsText) sections.push({ heading: 'Methods', headingPath: 'Methods', content: methodsText, level: 2 })
			if (gettersText) sections.push({ heading: 'Getters', headingPath: 'Getters', content: gettersText, level: 2 })
			if (eventsText) sections.push({ heading: 'Events', headingPath: 'Events', content: eventsText, level: 2 })
			if (optionsText) sections.push({ heading: 'Options', headingPath: 'Options', content: optionsText, level: 2 })

			docs.push({
				pathId: `helper:${registryName}.${id}`,
				model: 'helper',
				title: `${id} (${kind})`,
				content: description,
				sections,
				meta: {
					kind,
					name: id,
					category: intro?.category || Ctor?.category || '',
					stability: intro?.stability || Ctor?.stability || '',
					ref: `luca describe ${id}`,
				},
			})
		}
	}

	// Bundled examples and tutorials — embedded in the binary, so this works
	// outside any project. Bootstrapped projects have them materialized under
	// .claude/skills/luca-framework/references/.
	const { bootstrapExamples, bootstrapTutorials } = await import('./bootstrap/generated.js')
	const bundles: Array<{ model: string; refDir: string; entries: Record<string, string> }> = [
		{ model: 'example', refDir: 'examples', entries: bootstrapExamples },
		{ model: 'tutorial', refDir: 'tutorials', entries: bootstrapTutorials },
	]
	for (const { model, refDir, entries } of bundles) {
		for (const [filename, raw] of Object.entries(entries || {})) {
			const { title, body } = parseFrontmatter(raw, filename)
			docs.push({
				pathId: `${model}:${filename}`,
				model,
				title,
				content: body,
				sections: splitSections(body),
				meta: {
					kind: model,
					name: filename,
					ref: `.claude/skills/luca-framework/references/${refDir}/${filename} (run \`luca bootstrap --update-skill\` if missing)`,
				},
			})
		}
	}

	return docs
}

// ── Store ───────────────────────────────────────────────────────────

/**
 * Open (and init) the semanticSearch feature over the shared describe index.
 * Safe with no native deps installed — the constructor and initDb never touch
 * embeddings. Self-heals a provider/model mismatch by recreating the db.
 */
export async function getDescribeSearch(container: any): Promise<SemanticSearch> {
	const { SemanticSearch } = await import('./node/features/semantic-search.js')
	if (!container.features.available.includes('semanticSearch')) {
		;(SemanticSearch as any).attach(container)
	}

	mkdirSync(describeIndexDir(), { recursive: true })
	const ss = container.feature('semanticSearch', {
		dbPath: join(describeIndexDir(), DB_BASENAME),
		embeddingProvider: 'local',
		chunkStrategy: 'section',
	}) as SemanticSearch

	if (ss.state.get('dbReady')) return ss

	try {
		await ss.initDb()
	} catch (err: any) {
		if (String(err?.message || '').includes('mismatch')) {
			// A previous luca version wrote this index with different settings —
			// it's a pure cache, so recreate it.
			try { rmSync(resolvedDbFile(), { force: true }) } catch {}
			await ss.initDb()
		} else {
			throw err
		}
	}
	return ss
}

// ── Keyword tier ────────────────────────────────────────────────────

/**
 * Refresh the FTS/document rows for the current catalog (insert new/changed,
 * drop stale). Runs on every --query; ~100 hash comparisons, sub-100ms.
 * Returns the number of refreshed documents.
 */
export function ensureKeywordIndex(ss: SemanticSearch, docs: DocumentInput[]): number {
	ss.removeStale(docs.map(d => d.pathId))
	const stale = docs.filter(d => ss.needsReindex(d))
	if (stale.length > 0) {
		const tx = ss.db.transaction(() => {
			for (const doc of stale) ss.insertDocument(doc)
		})
		tx()
	}
	return stale.length
}

/**
 * Turn a natural-language query into a valid FTS5 MATCH expression:
 * quoted tokens OR-joined (raw `?`/quotes are FTS5 syntax errors).
 */
export function sanitizeFtsQuery(query: string): string {
	const tokens = query.split(/[^\p{L}\p{N}]+/u).filter(Boolean)
	return tokens.map(t => `"${t}"`).join(' OR ')
}

// ── Embedding tier ──────────────────────────────────────────────────

/**
 * Whether a doc's embeddings are missing or out of date. Compares the multiset
 * of current chunk hashes against stored chunks that HAVE an embedding — this
 * is deliberately not `needsReindex()` (see module docblock).
 */
export function embeddingsStale(ss: SemanticSearch, doc: DocumentInput): boolean {
	const want = ss.chunkDocument(doc).map(c => c.contentHash).sort()
	const rows = ss.db
		.query('SELECT content_hash FROM chunks WHERE path_id = ? AND embedding IS NOT NULL')
		.all(doc.pathId) as Array<{ content_hash: string }>
	const have = rows.map(r => r.content_hash).sort()
	if (want.length !== have.length) return true
	return want.some((h, i) => h !== have[i])
}

/** Is the local embedding stack (llama-server binary + model weights) installed? */
export async function localEmbeddingReadiness(): Promise<'ready' | 'deps-missing'> {
	const binaryReady = installedBinaryPath() !== null
	const weightsReady = existsSync(resolveModelPath(DEFAULT_LOCAL_MODEL))
	return binaryReady && weightsReady ? 'ready' : 'deps-missing'
}

/**
 * Build/refresh the embedding index for the describe catalog
 * (`luca describe --calculate-embeddings`). Only re-embeds documents whose
 * chunk hashes changed unless `force` is set. The first call spins up the
 * resident bun embedding daemon.
 */
export async function buildDescribeEmbeddings(
	container: any,
	opts: { force?: boolean; onProgress?: (indexed: number, total: number) => void } = {},
): Promise<{ indexed: number; total: number }> {
	const docs = await buildCatalogDocuments(container)
	const ss = await getDescribeSearch(container)
	ensureKeywordIndex(ss, docs)

	const toEmbed = opts.force ? docs : docs.filter(d => embeddingsStale(ss, d))
	if (toEmbed.length === 0) return { indexed: 0, total: docs.length }

	const batchSize = 5
	let indexed = 0
	for (let i = 0; i < toEmbed.length; i += batchSize) {
		const batch = toEmbed.slice(i, i + batchSize)
		await ss.indexDocuments(batch)
		indexed += batch.length
		opts.onProgress?.(indexed, toEmbed.length)
	}

	return { indexed, total: docs.length }
}

// ── Query ───────────────────────────────────────────────────────────

export interface DescribeSearchOutcome {
	mode: 'hybrid' | 'keyword'
	results: SearchResult[]
	hint?: string
}

/**
 * Run a search twice — helpers-only and overall — and merge with helpers
 * first. `--query` exists to surface modules worth a `luca describe`, but
 * example/tutorial documents are much larger and would otherwise crowd
 * helpers out of a single ranked list.
 */
async function searchWithHelperQuota(
	searchFn: (opts: { limit: number; model?: string }) => Promise<SearchResult[]>,
	limit: number,
): Promise<SearchResult[]> {
	const helperQuota = Math.ceil(limit / 2)
	const [helpers, overall] = await Promise.all([
		searchFn({ limit: helperQuota, model: 'helper' }),
		searchFn({ limit }),
	])

	const merged = [...helpers]
	const seen = new Set(helpers.map(r => r.pathId))
	for (const r of overall) {
		if (merged.length >= limit) break
		if (seen.has(r.pathId)) continue
		merged.push(r)
		seen.add(r.pathId)
	}
	return merged
}

/**
 * Answer a `luca describe --query` request. Hybrid (BM25 + vector, RRF) when
 * embeddings exist; otherwise keyword-only with a hint on how to enable
 * semantic ranking. Never fails just because embeddings are missing.
 */
export async function queryDescribeIndex(
	container: any,
	query: string,
	opts: { limit?: number } = {},
): Promise<DescribeSearchOutcome> {
	const limit = opts.limit ?? 8
	const docs = await buildCatalogDocuments(container)
	const ss = await getDescribeSearch(container)
	ensureKeywordIndex(ss, docs)

	const sanitized = sanitizeFtsQuery(query)

	if (ss.getStats().embeddingCount > 0) {
		try {
			const results = await searchWithHelperQuota(
				o => ss.hybridSearch(query, { ...o, ftsQuery: sanitized }),
				limit,
			)
			const staleCount = docs.filter(d => embeddingsStale(ss, d)).length
			return {
				mode: 'hybrid',
				results,
				...(staleCount > 0 ? { hint: HINTS.stale(staleCount) } : {}),
			}
		} catch {
			// Vector leg failed (e.g. weights deleted after indexing) — degrade
			// to the keyword tier below.
		}
	}

	const results = await searchWithHelperQuota(o => ss.search(sanitized, o), limit)
	const readiness = await localEmbeddingReadiness()
	return {
		mode: 'keyword',
		results,
		hint: readiness === 'ready' ? HINTS.buildIndex : HINTS.installDeps,
	}
}

/** Does a built (embedded) describe index exist? Used by `luca setup`'s state report. */
export function hasDescribeEmbeddings(): boolean {
	const file = resolvedDbFile()
	if (!existsSync(file)) return false
	try {
		const db = new Database(file, { readonly: true })
		try {
			const row = db.query('SELECT COUNT(*) as c FROM chunks WHERE embedding IS NOT NULL').get() as any
			return (row?.c ?? 0) > 0
		} finally {
			db.close()
		}
	} catch {
		return false
	}
}
