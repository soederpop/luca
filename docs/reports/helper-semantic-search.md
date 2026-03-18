---
tags:
  - feature-design
  - semantic-search
  - introspection
status: draft
---
# Helper Semantic Search Feature

Build semantic search over all describable luca helpers so AI assistants can find the right feature/client/server by describing what they need.

## Motivation

The `luca describe` system produces rich markdown for every helper (features, clients, servers, commands, endpoints, selectors). An AI assistant working with luca currently has to know the exact name of a helper to look it up. Semantic search would let it say "I need to run shell commands" and find `proc`, or "I need to cache things to disk" and find `diskCache`.

Storage location: `~/.luca/embeddings/`

## What Already Exists

Two systems that combine perfectly:

1. **SemanticSearch feature** (`src/node/features/semantic-search.ts`) — SQLite-backed embedding engine with OpenAI/local GGUF providers, section-based chunking, BM25 + vector + hybrid search with RRF fusion.

2. **Introspection system** (`src/introspection/`) — Every helper produces structured `HelperIntrospection` JSON and rendered markdown via `Helper.introspectAsText()`. Build-time AST scanning (JSDoc) + runtime Zod schema reflection. The `__INTROSPECTION__` map holds everything.

## Proposed Design

### Approach

Reuse the existing `SemanticSearch` feature directly. Create a new feature (e.g. `helperSearch`) that:

1. Iterates all registries, calls `introspectAsText()` on each helper to get markdown
2. Structures the markdown as `DocumentInput` objects with sections (methods, getters, events, state, options)
3. Feeds them to SemanticSearch for embedding and indexing
4. Exposes a `search(query)` method that delegates to hybridSearch

### Storage

DB stored at `~/.luca/embeddings/helpers.<provider>-<model>.sqlite`, scoped by provider+model like contentbase does.

### When to Build Index

- Lazy on first search if no index exists or if stale
- Explicit rebuild via `luca search --rebuild`
- Content hash gating from SemanticSearch handles incremental updates automatically

### CLI Surface

`luca search "file operations"` — returns ranked helpers with snippets showing why they matched.

### MCP / AI Assistant Surface

Expose as a tool in the luca-sandbox MCP so AI assistants can search for helpers by describing what they need.

## Open Questions

1. **Scope** — Index just core luca helpers, or also project-level commands/endpoints/selectors discovered at runtime? Suggestion: core always, project-level optionally.

2. **Granularity** — One document per helper (full describe output) vs chunked by section (methods, events, state). Suggestion: chunk by section so "run shell commands" matches `proc.exec` specifically.

3. **Primary consumer** — MCP tool for AI assistants, CLI for humans, or both? Suggestion: both.

4. **Embedding provider default** — OpenAI (higher quality, needs API key) or local GGUF (works offline, lower quality)? Suggestion: OpenAI default with local fallback.

## Key Files

- `src/node/features/semantic-search.ts` — The embedding engine to reuse
- `src/introspection/index.ts` — `__INTROSPECTION__` map, `HelperIntrospection` type
- `src/helper.ts` — `Helper.introspect()`, `Helper.introspectAsText()`, markdown renderers
- `src/registry.ts` — Registry base class, `describe()`, `describeAll()`
- `src/commands/describe.ts` — Current describe command (target resolution, rendering)
- `src/node/features/content-db.ts` — Reference for how contentDb wraps SemanticSearch
