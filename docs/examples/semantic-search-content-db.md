---
title: 'Searching a Document Collection: contentDb + semanticSearch'
tags:
  - contentDb
  - semanticSearch
  - search
  - bm25
  - embeddings
  - markdown
  - composition
lastTested: '2026-07-03'
lastTestPassed: true
---

# Searching a Document Collection: contentDb + semanticSearch

Two features compose into a searchable knowledge base: **contentDb** manages a folder of markdown documents (frontmatter, models, section-aware reads), and **semanticSearch** indexes them into SQLite for retrieval. The honest part up front — search has three tiers with different requirements:

1. **grep** — regex over the files. Always works.
2. **BM25 keyword search** — SQLite FTS5, ranked and snippeted. Works offline with zero credentials.
3. **Vector / hybrid search** — needs embeddings, which means either an `OPENAI_API_KEY` or a one-time local model install. It does **not** work out of the box; the setup is shown honestly at the end.

Everything through tier 2 runs live below. For each feature's full API: `luca describe contentDb`, `luca describe semanticSearch`.

## Write a small corpus

Five themed documents with frontmatter — the shape of any `docs/` folder contentDb manages. A collection doesn't require a `models.ts`; without one, every document falls under the built-in `Base` model.

```ts
// bare assignments (no const) so these survive into later blocks
corpusRoot = container.paths.resolve('tmp', `semantic-search-demo-${Date.now()}`)
docsDir = container.paths.resolve(corpusRoot, 'docs')
fs.ensureFolder(docsDir)

const corpus = {
  'caching.md': `---
title: Caching Guide
area: performance
---

# Caching Guide

Layered caches keep latency low.

## Strategy

Cache at the edge first, then in the application, then at the database.

## Invalidation

Cache invalidation is the hardest problem: prefer short TTLs over clever purging.
`,
  'authentication.md': `---
title: Authentication Guide
area: security
---

# Authentication Guide

Sessions and tokens identify users.

## Sessions

Server-side sessions store state; rotate identifiers after privilege changes.

## Tokens

Signed tokens carry claims; keep lifetimes short and refresh them.
`,
  'deployments.md': `---
title: Deployment Guide
area: operations
---

# Deployment Guide

Ship through a pipeline, never by hand.

## Rollbacks

Every deploy needs a one-command rollback path.
`,
  'observability.md': `---
title: Observability Guide
area: operations
---

# Observability Guide

Logs, metrics, and traces answer different questions.

## Alerting

Alert on symptoms users feel, not on every internal metric.
`,
  'testing.md': `---
title: Testing Guide
area: quality
---

# Testing Guide

Fast unit tests gate every change in the pipeline.

## Flakes

A flaky test is worse than no test: quarantine it the day it flakes.
`,
}

for (const [name, content] of Object.entries(corpus)) {
  fs.writeFile(container.paths.resolve(docsDir, name), content)
}
console.log('corpus written:', Object.keys(corpus).join(', '))
```

## Load it with contentDb

Point `contentDb` at the folder and `load()`. Document ids are file paths without the extension; frontmatter is parsed into `meta`; `read()` can slice out individual sections so you never load a whole document for one heading.

```ts
cdb = container.feature('contentDb', { rootPath: docsDir })
await cdb.load()

console.log('documents:', cdb.available.join(', '))
if (cdb.available.length !== 5) throw new Error(`expected 5 documents, got ${cdb.available.length}`)
if (!cdb.modelNames.includes('Base')) throw new Error('collections without models.ts should expose the Base model')

const caching = await cdb.document({ id: 'caching' })
if (caching.title !== 'Caching Guide') throw new Error('frontmatter title not parsed')
if (caching.meta.area !== 'performance') throw new Error('frontmatter meta not parsed')

// section-aware read: just the Invalidation section, not the whole doc
const invalidation = await cdb.read('caching', { include: ['Invalidation'] })
console.log(invalidation)
if (!invalidation.includes('hardest problem')) throw new Error('include filter should return the Invalidation section')
if (invalidation.includes('Cache at the edge')) throw new Error('include filter should drop the Strategy section')
```

Tier 1 search is already available — `cdb.grep(pattern)` runs the `grep` feature scoped to the collection:

```ts
const grepHits = await cdb.grep('rollback')
console.log(grepHits.map(h => `${h.file}:${h.line}`))
if (!grepHits.some(h => h.file.endsWith('deployments.md'))) throw new Error('grep should find rollback in deployments.md')
```

## Tier 2: BM25 keyword search — offline, no credentials

The `semanticSearch` feature is SQLite-backed: FTS5 for keyword search, BLOB-stored vectors for similarity. The keyword half needs no embeddings at all — `insertDocument()` syncs the FTS index directly, so we can compose the two features by feeding contentDb's documents in and get ranked, snippeted search immediately.

```ts
ss = container.feature('semanticSearch', {
  dbPath: container.paths.resolve(corpusRoot, 'index', 'search.sqlite'),
})
await ss.initDb()

for (const id of cdb.available) {
  const doc = await cdb.document({ id })
  ss.insertDocument({
    pathId: id,
    title: doc.title,
    meta: doc.meta,
    content: doc.content,
  })
}

const stats = ss.getStats()
console.log(`indexed ${stats.documentCount} documents, ${stats.embeddingCount} embeddings`)
if (stats.documentCount !== 5) throw new Error('expected 5 documents in the index')
if (stats.embeddingCount !== 0) throw new Error('keyword indexing should not have created embeddings')
```

Queries are ranked by BM25 and come back with highlighted snippets. Metadata from the frontmatter travels along, and `where` filters on it:

```ts
const ranked = await ss.search('cache invalidation')
console.log(ranked.map(r => `${r.score.toFixed(2)} ${r.pathId} — ${r.snippet}`))
if (ranked[0]?.pathId !== 'caching') throw new Error(`expected caching to rank first, got ${ranked[0]?.pathId}`)

// 'pipeline' appears in both deployments and testing — filter by frontmatter
const filtered = await ss.search('pipeline', { where: { area: 'quality' } })
if (filtered.length !== 1 || filtered[0].pathId !== 'testing') {
  throw new Error('where filter should narrow pipeline hits to the quality doc')
}
console.log('metadata filter verified:', filtered[0].pathId)
```

## What happens without an embedding index

contentDb has search built in too — `cdb.search()`, `cdb.vectorSearch()`, `cdb.hybridSearch()`, plus a `semanticSearch` tool method it exposes to assistants (contentDb is itself a tool provider — see the [tool provider example](./feature-as-tool-provider.md)). These expect an embedding index under `~/.luca/contentbase/` for the collection. When there is none, the tool method degrades gracefully to grep and says so:

```ts
if (cdb.searchIndexStatus.exists) throw new Error('fresh corpus should have no embedding index yet')

const fallback = await cdb.semanticSearch({ query: 'rollback' })
console.log(fallback.note)
if (!fallback.note || !fallback.note.includes('fell back to text search')) {
  throw new Error('expected the graceful grep fallback with an explanatory note')
}
if (!fallback.results.some(h => h.file.endsWith('deployments.md'))) throw new Error('fallback grep should still find the answer')
```

## Tier 3: real embeddings — the honest requirements

Vector and hybrid search find documents by meaning ("how do I undo a bad release" should hit the deployments doc without sharing a keyword). That requires generating embeddings, and there is no credential-free, download-free path:

**Option A — OpenAI (default provider).** Requires `OPENAI_API_KEY` in the environment. `cdb.buildSearchIndex()` chunks every document by section, embeds the chunks with `text-embedding-3-small`, and stores vectors in the collection's index:

```ts skip
// requires OPENAI_API_KEY
await cdb.buildSearchIndex({ onProgress: (done, total) => console.log(`${done}/${total}`) })

// hybrid = BM25 + vector similarity, fused with Reciprocal Rank Fusion
const hits = await cdb.hybridSearch('how do I undo a bad release', { limit: 3 })
console.log(hits.map(h => `${h.score.toFixed(3)} ${h.pathId}`))
// 'deployments' ranks despite zero keyword overlap with "undo a bad release"
```

**Option B — local embeddings.** Fully offline *after* a one-time setup that is not free: `installLocalEmbeddings()` runs a package-manager install of `node-llama-cpp` (a native addon) into your project and downloads the embedding-gemma-300M weights (~300 MB) to `~/.cache/luca/models/`. Until that completes, `embeddingProvider: 'local'` throws with instructions — it does not silently work:

```ts skip
const localSearch = container.feature('semanticSearch', {
  dbPath: '.contentbase/search.sqlite',
  embeddingProvider: 'local',   // embedding-gemma-300M-Q8_0, the only supported local model
})
await localSearch.installLocalEmbeddings(process.cwd()) // installs node-llama-cpp + downloads ~300MB of weights
await localSearch.initDb()
// from here on, indexing and vectorSearch/hybridSearch run with no network at all
```

One more constraint worth knowing: the index file is stamped with its provider/model/dimensions (`search.openai-text-embedding-3-small.sqlite` vs `search.local-embedding-gemma-300M-Q8_0.sqlite`). Switching providers means re-indexing — `initDb()` refuses a mismatched database rather than mixing vector spaces.

## Clean up

```ts
await ss.close()
await fs.rmdir(corpusRoot)
console.log('index closed, corpus removed')
```

## Summary

`contentDb` turns a folder of markdown into queryable documents; `semanticSearch` turns those documents into a search index. Grep and BM25 keyword search work immediately and offline — compose them by piping `cdb.document(id)` into `ss.insertDocument()`. Semantic (vector/hybrid) search is a deliberate upgrade with real prerequisites: an OpenAI key, or a one-time `installLocalEmbeddings()` that installs a native addon and downloads model weights. When no embedding index exists, contentDb's assistant-facing `semanticSearch` tool falls back to grep and tells you so.
