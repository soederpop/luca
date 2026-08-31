import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from '../../schemas/base.js'
import { Feature } from '../feature.js'
import type { Helper } from '../../helper.js'

declare module 'luca/feature' {
  interface AvailableFeatures {
    memory: typeof Memory
  }
}

// --- Schemas ---

export const MemoryStateSchema = FeatureStateSchema.extend({
  dbReady: z.boolean().default(false).describe('Whether the SQLite database is initialized'),
  totalMemories: z.number().default(0).describe('Total memories across all categories'),
  epoch: z.number().default(1).describe('Current epoch for event grouping'),
})
export type MemoryState = z.infer<typeof MemoryStateSchema>

export const MemoryOptionsSchema = FeatureOptionsSchema.extend({
  dbPath: z.string().optional().describe('Path to SQLite database file. Defaults to .luca/agent-memory/<hash>.db in home dir'),
  embeddingModel: z.string().optional().describe('Embedding model to use. When omitted, defaults to text-embedding-3-large for the openai provider, or the provider default for local. Note: changing this for an existing memory database mixes vector dimensions and breaks similarity search — wipe and re-index to switch models'),
  embeddingProvider: z.enum(['local', 'openai']).default('openai').describe('Where to generate embeddings. "local" serves embedding-gemma via a resident llama-server (fully offline, run `luca setup --local-embeddings` once); "openai" hits an OpenAI-compatible endpoint'),
  embeddingBaseURL: z.string().optional().describe('Override the OpenAI-compatible base URL for embeddings (Ollama, vLLM, LiteLLM, etc.). Falls back to the OPENAI_BASE_URL env var. Only used when embeddingProvider is "openai"'),
  embeddingApiKey: z.string().optional().describe('API key for the embedding endpoint. Falls back to the OPENAI_API_KEY env var. Only used when embeddingProvider is "openai"'),
  namespace: z.string().default('default').describe('Namespace to isolate memory sets (e.g. per-assistant)'),
})
export type MemoryOptions = z.infer<typeof MemoryOptionsSchema>

export const MemoryEventsSchema = FeatureEventsSchema.extend({
  memoryCreated: z.tuple([z.object({ id: z.number(), category: z.string(), document: z.string() }).describe('The created memory')]).describe('Emitted when a memory is created'),
  memoryDeleted: z.tuple([z.object({ id: z.number(), category: z.string() }).describe('The deleted memory ref')]).describe('Emitted when a memory is deleted'),
  epochChanged: z.tuple([z.number().describe('New epoch value')]).describe('Emitted when the epoch changes'),
  dbInitialized: z.tuple([]).describe('Emitted when the database is ready'),
})

// --- Types ---

/** @internal Columns selected for MemoryRecord hydration (everything but the embedding blob). */
const MEMORY_COLUMNS = 'id, category, document, metadata, created_at, updated_at, layer, status, superseded_by, confirmations, usage_count, last_used_at, derived_from, reviewed_epoch'

/** @internal System prompt for the consolidation judge. Embeddings cluster rows that are about the same thing; this judge decides what the cluster means — the one job cosine similarity cannot do (it cannot see negation or which statement is current). */
const GARDENER_SYSTEM_PROMPT = [
  'You are a memory gardener. You review clusters of an AI assistant\'s memories that are about the same topic and decide how to consolidate them.',
  '',
  'Each memory has: id, layer ("episodic" = raw observation, "belief" = curated knowledge), text, created_at, confirmations, usage_count.',
  '',
  'Respond with ONLY a JSON object: {"actions": [...]}. Each action is one of:',
  '- {"type": "merge", "ids": [keepId, ...absorbedIds], "text": "optional improved canonical wording"} — the memories say the same thing. The first id is kept (and becomes a belief); the rest are absorbed into it as confirmations. Use this for duplicates and rephrasings, and for a single episodic observation worth keeping as a belief (ids with just one element).',
  '- {"type": "supersede", "ids": [winnerId, ...loserIds]} — the memories CONTRADICT each other. The winner is the statement that is currently true (usually the newest); the losers are outdated. Never merge contradictions.',
  '- {"type": "generalize", "ids": [...sourceIds], "text": "the general rule"} — several specific memories reveal a pattern worth stating once. Sources are kept; a new belief is added.',
  '- {"type": "keep", "ids": [...]} — leave these alone (distinct facts that merely share a topic, or a lone observation not worth promoting yet).',
  '',
  'Rules: be conservative — when unsure, keep. Watch for negation and corrections: "X" and "no longer X" are near-identical to a similarity metric but are contradictions to you. Only reference ids you were shown. Every id you were shown should appear in exactly one action.',
].join('\n')

export interface MemoryRecord {
  id: number
  category: string
  document: string
  metadata: Record<string, any>
  created_at: string
  updated_at: string
  /** 'episodic' rows are raw appended observations; 'belief' rows are curated knowledge. */
  layer: 'episodic' | 'belief'
  /** Only 'active' rows are returned by search/recall. Other statuses preserve history. */
  status: 'active' | 'superseded' | 'retracted' | 'dormant' | 'consolidated'
  /** When superseded, the id of the row that replaced this one. */
  superseded_by: number | null
  /** How many independent observations support this row. Merging duplicates sums them. */
  confirmations: number
  /** How many times search() has returned this row. */
  usage_count: number
  last_used_at: string | null
  /** Ids of the rows this row was distilled from during consolidation. */
  derived_from: number[]
  /** The epoch (sleep-cycle counter) this row was last reviewed in. */
  reviewed_epoch: number
}

export interface MemorySearchResult extends MemoryRecord {
  distance: number
}

export interface MemoryConsolidateOptions {
  /** Restrict the pass to these categories (default: all categories in the namespace). */
  categories?: string[]
  /** Cosine similarity at or above which two rows join the same cluster for review (default 0.7 — loose on purpose, so corrections land next to the beliefs they contradict). */
  clusterThreshold?: number
  /** Move never-used, never-confirmed episodic rows to 'dormant' when they haven't been reviewed for this many epochs (default 3). Set to 0 to disable decay. */
  dormantAfterEpochs?: number
  /** Report what would happen without changing anything. The epoch is not advanced. */
  dryRun?: boolean
  /** Override the LLM judge. Receives the cluster prompt, must return the model's raw text reply. Defaults to a conversation created at runtime. */
  judge?: (prompt: string) => Promise<string>
  /** Model for the default judge conversation. */
  model?: string
  /** Provider preset or config for the default judge conversation (e.g. 'claude-code'). */
  provider?: any
}

export interface MemoryConsolidateAction {
  type: 'merge' | 'supersede' | 'generalize' | 'keep'
  category: string
  ids: number[]
  text?: string
}

export interface MemoryConsolidateReport {
  epoch: number
  categories: string[]
  rowsReviewed: number
  clusters: number
  merged: number
  superseded: number
  generalized: number
  dormant: number
  actions: MemoryConsolidateAction[]
  warnings: string[]
  dryRun: boolean
}

/**
 * Semantic memory storage and retrieval for AI agents.
 *
 * Provides categorized memory with embedding-based search, metadata filtering,
 * epoch tracking, and assistant tool integration. Built natively on Luca's
 * SQLite and semanticSearch features.
 *
 * @example
 * ```typescript
 * const mem = container.feature('memory')
 * await mem.create('user-prefs', 'Prefers dark mode', { source: 'onboarding' })
 * const results = await mem.search('user-prefs', 'UI preferences')
 * ```
 *
 * @extends Feature
 */
export class Memory extends Feature<MemoryState, MemoryOptions> {
  static override shortcut = 'features.memory' as const
  static override stability = 'stable' as const
  static override category = 'ai-assistants' as const
  static override stateSchema = MemoryStateSchema
  static override optionsSchema = MemoryOptionsSchema
  static override eventsSchema = MemoryEventsSchema

  static { Feature.register(this, 'memory') }

  // --- Tools for assistant integration via assistant.use(memory) ---

  static override tools: Record<string, { schema: z.ZodType; description?: string }> = {
    remember: {
      description: 'Persist a fact, preference, or piece of context to long-term memory so it can be recalled in future conversations. Safe to call liberally — duplicates are automatically detected and skipped.',
      schema: z.object({
        category: z.string().describe('A short, consistent label for grouping related memories. Use lowercase-kebab-case. Common categories: "facts" (things that are true about the user or world), "preferences" (how the user likes things done), "context" (project state, decisions, plans). When in doubt, use "facts". Always reuse existing categories — call listCategories first if unsure.'),
        text: z.string().describe('A single, self-contained statement of what to remember. Write it as a fact, not a conversation excerpt. Good: "User prefers dark mode". Bad: "The user said they like dark mode in our chat".'),
        metadata: z.record(z.string(), z.string()).optional().describe('Optional key-value tags for filtering later (e.g. {"source": "onboarding", "confidence": "high"})'),
      }).describe('Persist a fact, preference, or piece of context to long-term memory so it can be recalled in future conversations. Safe to call liberally — duplicates are automatically detected and skipped.'),
    },
    recall: {
      description: 'Search long-term memory using natural language. Returns the most semantically similar memories ranked by relevance. Call this BEFORE answering questions — you may already know something from a previous conversation.',
      schema: z.object({
        category: z.string().describe('The category to search in. If unsure which category holds what you need, call listCategories first, then search the most likely one. Use "facts" as a default.'),
        query: z.string().describe('A natural-language description of what you are looking for. Phrase it as a question or topic, not keywords. Good: "what programming languages does the user prefer". Bad: "languages".'),
        n_results: z.number().default(5).describe('How many results to return. Use 3-5 for focused lookups, up to 10 for broad exploration.'),
      }).describe('Search long-term memory using natural language. Returns the most semantically similar memories ranked by relevance. Call this BEFORE answering questions — you may already know something from a previous conversation.'),
    },
    forgetCategory: {
      description: 'Permanently delete all memories in a category. Use only when the user explicitly asks to forget something or when a category has become stale.',
      schema: z.object({
        category: z.string().describe('The category to wipe. This is irreversible — all memories in this category will be permanently deleted.'),
      }).describe('Permanently delete all memories in a category. Use only when the user explicitly asks to forget something or when a category has become stale.'),
    },
    listCategories: {
      description: 'List all memory categories and how many memories each contains. Call this at the start of a conversation to understand what you already know, and before recall if unsure which category to search.',
      schema: z.object({}).describe('List all memory categories and how many memories each contains. Call this at the start of a conversation to understand what you already know, and before recall if unsure which category to search.'),
    },
  }

  private _db: any = null
  private _searcher: any = null

  /** @internal */
  private get db() {
    if (!this._db) throw new Error('Memory not initialized. Call initDb() first.')
    return this._db
  }

  /** @internal */
  private get searcher() {
    if (!this._searcher) {
      // Preserve the historical openai default (text-embedding-3-large) so
      // existing memory databases keep the same 3072-dim vectors. For the
      // local provider, leave the model undefined so semanticSearch resolves
      // its own local default (embedding-gemma) rather than an openai name.
      const embeddingModel = this.options.embeddingModel
        ?? (this.options.embeddingProvider === 'openai' ? 'text-embedding-3-large' : undefined)

      this._searcher = this.container.feature('semanticSearch', {
        embeddingModel,
        embeddingProvider: this.options.embeddingProvider,
        embeddingBaseURL: this.options.embeddingBaseURL,
        embeddingApiKey: this.options.embeddingApiKey,
      })
    }
    return this._searcher
  }

  /**
   * Initialize the SQLite database and create tables.
   * Called automatically on first use, but can be called explicitly.
   *
   * @example
   * ```typescript
   * const mem = container.feature('memory')
   * await mem.initDb()
   * ```
   */
  async initDb() {
    if (this.state.get('dbReady')) return

    const homedir = this.container.feature('os').homedir
    const cwdHash = this.container.utils.hashObject(this.container.cwd)
    const dbPath = this.options.dbPath || this.container.paths.join(homedir, '.luca', 'agent-memory', `${cwdHash}.db`)
    const dir = dbPath.replace(/\/[^/]+$/, '')

    const fs = this.container.feature('fs')
    await fs.mkdirp(dir)

    this._db = this.container.feature('sqlite', { path: dbPath })

    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS memories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        namespace TEXT NOT NULL DEFAULT 'default',
        category TEXT NOT NULL,
        document TEXT NOT NULL,
        metadata TEXT NOT NULL DEFAULT '{}',
        embedding BLOB,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `)

    await this.db.execute(`
      CREATE INDEX IF NOT EXISTS idx_memories_ns_cat ON memories(namespace, category)
    `)

    // Idempotent migration for databases created before the belief/episodic
    // split. Existing rows become active beliefs, so prior behavior holds.
    const existingColumns = new Set(
      ((await this.db.query('PRAGMA table_info(memories)')) as { name: string }[]).map(c => c.name)
    )
    const migrations: Array<[string, string]> = [
      ['layer', "ALTER TABLE memories ADD COLUMN layer TEXT NOT NULL DEFAULT 'belief'"],
      ['status', "ALTER TABLE memories ADD COLUMN status TEXT NOT NULL DEFAULT 'active'"],
      ['superseded_by', 'ALTER TABLE memories ADD COLUMN superseded_by INTEGER'],
      ['confirmations', 'ALTER TABLE memories ADD COLUMN confirmations INTEGER NOT NULL DEFAULT 1'],
      ['usage_count', 'ALTER TABLE memories ADD COLUMN usage_count INTEGER NOT NULL DEFAULT 0'],
      ['last_used_at', 'ALTER TABLE memories ADD COLUMN last_used_at TEXT'],
      ['derived_from', "ALTER TABLE memories ADD COLUMN derived_from TEXT NOT NULL DEFAULT '[]'"],
      ['reviewed_epoch', 'ALTER TABLE memories ADD COLUMN reviewed_epoch INTEGER NOT NULL DEFAULT 0'],
    ]
    for (const [column, sql] of migrations) {
      if (!existingColumns.has(column)) await this.db.execute(sql)
    }

    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS epochs (
        namespace TEXT NOT NULL,
        value INTEGER NOT NULL DEFAULT 1,
        PRIMARY KEY (namespace)
      )
    `)

    const rows = await this.db.query(
      'SELECT value FROM epochs WHERE namespace = ?',
      [this.options.namespace]
    ) as { value: number }[]

    if (rows.length) {
      this.state.set('epoch', rows[0]!.value)
    } else {
      await this.db.execute('INSERT INTO epochs (namespace, value) VALUES (?, 1)', [this.options.namespace])
    }

    this.state.set('dbReady', true)
    this.emit('dbInitialized')
  }

  /** @internal Ensure db is ready before any operation */
  private async ensureDb() {
    if (!this.state.get('dbReady')) await this.initDb()
  }

  // --- Tool handler methods (auto-wired by toTools via matching names) ---

  /** Tool handler: store a memory, deduplicating by similarity. */
  async remember(args: { category: string; text: string; metadata?: Record<string, any> }) {
    const mem = await this.createUnique(args.category, args.text, args.metadata || {})
    if (mem) return { stored: true, id: mem.id, category: mem.category }
    return { stored: false, reason: 'A similar memory already exists' }
  }

  /** Tool handler: search memories by semantic similarity. */
  async recall(args: { category: string; query: string; n_results?: number }) {
    const results = await this.search(args.category, args.query, args.n_results ?? 5)
    return results.map(r => ({
      document: r.document,
      metadata: r.metadata,
      distance: Math.round(r.distance * 1000) / 1000,
      created_at: r.created_at,
      confirmations: r.confirmations,
    }))
  }

  /** Tool handler: wipe all memories in a category. */
  async forgetCategory(args: { category: string }) {
    const deleted = await this.wipeCategory(args.category)
    return { deleted, category: args.category }
  }

  /** Tool handler: list all categories with counts. */
  async listCategories() {
    const cats = await this.categories()
    const counts: Record<string, number> = {}
    for (const cat of cats) {
      counts[cat] = await this.count(cat)
    }
    return { categories: counts }
  }

  /**
   * When an assistant uses memory, inject system prompt guidance.
   */
  override setupToolsConsumer(consumer: Helper) {
    if (typeof (consumer as any).addSystemPromptExtension === 'function') {
      (consumer as any).addSystemPromptExtension('memory', [
        '## Long-Term Memory',
        '',
        'You have persistent memory that survives across conversations. Use it proactively:',
        '',
        '**Start of conversation:** Call `listCategories` to see what you already know. If categories exist, call `recall` with a broad query related to the user\'s first message. Do this before responding — context from prior sessions makes your answers dramatically better.',
        '',
        '**During conversation:** When the user shares facts about themselves, their preferences, decisions, or project context, call `remember` immediately. Don\'t wait — if it\'s worth noting, store it now. Duplicates are auto-detected so over-remembering is safe, under-remembering is not.',
        '',
        '**Before answering questions:** Call `recall` to check if you already have relevant knowledge. A user asking "what\'s my deploy target?" may have told you last week. Always check before saying "I don\'t know".',
        '',
        '**Categories:** Use consistent, descriptive kebab-case categories. Prefer a few broad categories ("facts", "preferences", "context") over many narrow ones. Always reuse existing categories rather than creating similar new ones.',
      ].join('\n'))
    }
  }

  // --- Core CRUD ---

  /**
   * Create a new memory in the given category.
   *
   * @param {string} category - The category to store the memory in
   * @param {string} text - The text content of the memory
   * @param {Record<string, any>} metadata - Optional metadata key-value pairs
   * @returns {Promise<MemoryRecord>} The created memory
   *
   * @example
   * ```typescript
   * const mem = container.feature('memory')
   * await mem.create('facts', 'The user lives in Austin', { confidence: 0.9 })
   * ```
   */
  async create(category: string, text: string, metadata: Record<string, any> = {}): Promise<MemoryRecord> {
    return this._insert(category, text, metadata, { layer: 'belief' })
  }

  /**
   * Append a raw observation to the episodic layer — no dedup, no judgment.
   * This is the cheap write path: repeated observations are welcome (they
   * become confirmation strength during consolidate()), and nothing is ever
   * silently dropped. Consolidation later distills these into beliefs.
   *
   * @param {string} category - The category to store the observation in
   * @param {string} text - What was observed
   * @param {Record<string, any>} metadata - Optional metadata (e.g. provenance)
   * @returns {Promise<MemoryRecord>} The created episodic memory
   *
   * @example
   * ```typescript
   * const mem = container.feature('memory')
   * await mem.observe('facts', 'User said they moved to Denver', { source: 'chat' })
   * ```
   */
  async observe(category: string, text: string, metadata: Record<string, any> = {}): Promise<MemoryRecord> {
    return this._insert(category, text, metadata, { layer: 'episodic' })
  }

  /**
   * Replace a memory with a corrected statement. The old row is kept but
   * marked superseded (and excluded from search); the new row records what
   * it replaced. This is the honest alternative to deleting or overwriting —
   * the history of what was believed remains auditable.
   *
   * @param {string} category - The category the memory belongs to
   * @param {number} id - The id of the memory being corrected
   * @param {string} newText - The corrected statement
   * @param {Record<string, any>} metadata - Optional metadata for the new row
   * @returns {Promise<MemoryRecord | null>} The new active memory, or null if the old id wasn't found
   *
   * @example
   * ```typescript
   * const mem = container.feature('memory')
   * await mem.revise('facts', 42, 'User now prefers claude-code over codex')
   * ```
   */
  async revise(category: string, id: number, newText: string, metadata: Record<string, any> = {}): Promise<MemoryRecord | null> {
    await this.ensureDb()

    const existing = await this.get(category, id)
    if (!existing) return null

    const created = await this._insert(category, newText, metadata, {
      layer: 'belief',
      derivedFrom: [id],
      confirmations: existing.confirmations,
    })

    await this.db.execute(
      "UPDATE memories SET status = 'superseded', superseded_by = ?, updated_at = datetime('now') WHERE id = ? AND namespace = ?",
      [created.id, id, this.options.namespace]
    )

    return created
  }

  /**
   * Mark a memory as retracted — no longer believed, but kept for audit.
   * Retracted rows are excluded from search results.
   *
   * @param {string} category - The category the memory belongs to
   * @param {number} id - The memory id
   * @returns {Promise<boolean>} True if a row was retracted
   */
  async retract(category: string, id: number): Promise<boolean> {
    await this.ensureDb()

    const { changes } = await this.db.execute(
      "UPDATE memories SET status = 'retracted', updated_at = datetime('now') WHERE id = ? AND namespace = ? AND category = ?",
      [id, this.options.namespace, category]
    )
    return changes > 0
  }

  /** @internal Shared insert used by create/observe/revise/consolidate. */
  private async _insert(
    category: string,
    text: string,
    metadata: Record<string, any>,
    opts: { layer?: 'episodic' | 'belief'; derivedFrom?: number[]; confirmations?: number } = {}
  ): Promise<MemoryRecord> {
    await this.ensureDb()

    const embedding = await this.embed(text)
    const embeddingBlob = this.float64ToBlob(embedding)
    const metaJson = JSON.stringify({ ...metadata, epoch: this.state.get('epoch') })

    const { lastInsertRowid } = await this.db.execute(
      'INSERT INTO memories (namespace, category, document, metadata, embedding, layer, confirmations, derived_from, reviewed_epoch) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        this.options.namespace, category, text, metaJson, embeddingBlob,
        opts.layer ?? 'belief',
        opts.confirmations ?? 1,
        JSON.stringify(opts.derivedFrom ?? []),
        0, // reviewed_epoch: never reviewed — the next consolidate() pass judges it
      ]
    )

    const id = Number(lastInsertRowid)
    const memory = await this.get(category, id)
    this.emit('memoryCreated', { id, category, document: text })
    return memory!
  }

  /**
   * Create a memory only if no sufficiently similar memory exists.
   *
   * @param {string} category - The category to store the memory in
   * @param {string} text - The text content of the memory
   * @param {Record<string, any>} metadata - Optional metadata
   * @param {number} similarityThreshold - Minimum cosine similarity to consider a duplicate (0-1, default 0.95)
   * @returns {Promise<MemoryRecord | null>} The created memory, or null if a similar one exists
   *
   * @example
   * ```typescript
   * const mem = container.feature('memory')
   * await mem.createUnique('facts', 'User prefers dark mode', {}, 0.9)
   * ```
   */
  async createUnique(category: string, text: string, metadata: Record<string, any> = {}, similarityThreshold = 0.95): Promise<MemoryRecord | null> {
    await this.ensureDb()

    const results = await this.search(category, text, 1, { trackUsage: false })
    if (results.length > 0 && (1 - results[0]!.distance) >= similarityThreshold) {
      return null
    }

    return this.create(category, text, metadata)
  }

  /**
   * Get a memory by ID.
   *
   * @param {string} category - The category the memory belongs to
   * @param {number} id - The memory ID
   * @returns {Promise<MemoryRecord | null>} The memory, or null if not found
   */
  async get(category: string, id: number): Promise<MemoryRecord | null> {
    await this.ensureDb()

    const rows = await this.db.query(
      `SELECT ${MEMORY_COLUMNS} FROM memories WHERE namespace = ? AND category = ? AND id = ?`,
      [this.options.namespace, category, id]
    ) as any[]

    if (!rows.length) return null
    return this.rowToMemory(rows[0])
  }

  /**
   * Get all memories in a category, with optional metadata filtering.
   *
   * @param {string} category - The category to query
   * @param {object} options - Query options
   * @param {number} options.limit - Max results (default 20)
   * @param {string} options.sortOrder - 'asc' or 'desc' by created_at (default 'desc')
   * @param {Record<string, any>} options.filterMetadata - Filter by metadata key-value pairs
   * @returns {Promise<MemoryRecord[]>} Array of memories
   */
  async getAll(category: string, options: { limit?: number; sortOrder?: 'asc' | 'desc'; filterMetadata?: Record<string, any> } = {}): Promise<MemoryRecord[]> {
    await this.ensureDb()

    const { limit = 20, sortOrder = 'desc', filterMetadata } = options

    let rows = await this.db.query(
      `SELECT ${MEMORY_COLUMNS} FROM memories WHERE namespace = ? AND category = ? ORDER BY created_at ${sortOrder === 'asc' ? 'ASC' : 'DESC'} LIMIT ?`,
      [this.options.namespace, category, limit]
    ) as any[]

    if (filterMetadata) {
      rows = rows.filter((row: any) => {
        const meta = JSON.parse(row.metadata)
        return Object.entries(filterMetadata).every(([k, v]) => meta[k] === v)
      })
    }

    return rows.map((r: any) => this.rowToMemory(r))
  }

  /**
   * Update a memory's text and/or metadata.
   *
   * @param {string} category - The category the memory belongs to
   * @param {number} id - The memory ID
   * @param {object} updates - Fields to update
   * @param {string} updates.text - New text content (re-embeds automatically)
   * @param {Record<string, any>} updates.metadata - Metadata to merge
   * @returns {Promise<MemoryRecord | null>} The updated memory
   */
  async update(category: string, id: number, updates: { text?: string; metadata?: Record<string, any> }): Promise<MemoryRecord | null> {
    await this.ensureDb()

    const existing = await this.get(category, id)
    if (!existing) return null

    const newText = updates.text ?? existing.document
    const newMeta = updates.metadata ? { ...existing.metadata, ...updates.metadata } : existing.metadata

    let embeddingBlob: Buffer | null = null
    if (updates.text) {
      const embedding = await this.embed(newText)
      embeddingBlob = this.float64ToBlob(embedding)
    }

    if (embeddingBlob) {
      await this.db.execute(
        "UPDATE memories SET document = ?, metadata = ?, embedding = ?, updated_at = datetime('now') WHERE id = ? AND namespace = ?",
        [newText, JSON.stringify(newMeta), embeddingBlob, id, this.options.namespace]
      )
    } else {
      await this.db.execute(
        "UPDATE memories SET document = ?, metadata = ?, updated_at = datetime('now') WHERE id = ? AND namespace = ?",
        [newText, JSON.stringify(newMeta), id, this.options.namespace]
      )
    }

    return this.get(category, id)
  }

  /**
   * Delete a specific memory.
   *
   * @param {string} category - The category
   * @param {number} id - The memory ID
   * @returns {Promise<boolean>} True if deleted
   */
  async delete(category: string, id: number): Promise<boolean> {
    await this.ensureDb()

    const { changes } = await this.db.execute(
      'DELETE FROM memories WHERE namespace = ? AND category = ? AND id = ?',
      [this.options.namespace, category, id]
    )

    if (changes > 0) {
      this.emit('memoryDeleted', { id, category })
    }

    return changes > 0
  }

  /**
   * Delete all memories in a category.
   *
   * @param {string} category - The category to wipe
   * @returns {Promise<number>} Number of deleted memories
   */
  async wipeCategory(category: string): Promise<number> {
    await this.ensureDb()

    const { changes } = await this.db.execute(
      'DELETE FROM memories WHERE namespace = ? AND category = ?',
      [this.options.namespace, category]
    )

    return changes
  }

  /**
   * Delete all memories across all categories in this namespace.
   *
   * @returns {Promise<number>} Number of deleted memories
   */
  async wipeAll(): Promise<number> {
    await this.ensureDb()

    const { changes } = await this.db.execute(
      'DELETE FROM memories WHERE namespace = ?',
      [this.options.namespace]
    )

    await this.setEpoch(1)

    return changes
  }

  /**
   * Count memories in a category (or all categories if omitted).
   *
   * @param {string} category - Optional category to count
   * @returns {Promise<number>} The count
   */
  async count(category?: string): Promise<number> {
    await this.ensureDb()

    if (category) {
      const rows = await this.db.query(
        'SELECT COUNT(*) as cnt FROM memories WHERE namespace = ? AND category = ?',
        [this.options.namespace, category]
      ) as { cnt: number }[]
      return rows[0]!.cnt
    }

    const rows = await this.db.query(
      'SELECT COUNT(*) as cnt FROM memories WHERE namespace = ?',
      [this.options.namespace]
    ) as { cnt: number }[]
    return rows[0]!.cnt
  }

  /**
   * List all categories that have memories.
   *
   * @returns {Promise<string[]>} Array of category names
   */
  async categories(): Promise<string[]> {
    await this.ensureDb()

    const rows = await this.db.query(
      'SELECT DISTINCT category FROM memories WHERE namespace = ?',
      [this.options.namespace]
    ) as { category: string }[]

    return rows.map((r: { category: string }) => r.category)
  }

  // --- Semantic Search ---

  /**
   * Search memories by semantic similarity.
   *
   * @param {string} category - The category to search in
   * @param {string} query - The search query (will be embedded)
   * @param {number} nResults - Maximum number of results (default 5)
   * @param {object} options - Additional search options
   * @param {number} options.maxDistance - Maximum cosine distance threshold (0-2, default none)
   * @param {Record<string, any>} options.filterMetadata - Filter by metadata key-value pairs
   * @param {boolean} options.includeInactive - Also return superseded/retracted/dormant/consolidated rows (default false)
   * @param {boolean} options.trackUsage - Bump usage_count/last_used_at on the returned rows (default true). Internal comparisons pass false so bookkeeping reads don't count as recalls
   * @returns {Promise<MemorySearchResult[]>} Memories sorted by similarity (closest first)
   */
  async search(category: string, query: string, nResults = 5, options: { maxDistance?: number; filterMetadata?: Record<string, any>; includeInactive?: boolean; trackUsage?: boolean } = {}): Promise<MemorySearchResult[]> {
    await this.ensureDb()

    const queryEmbedding = await this.embed(query)

    const statusClause = options.includeInactive ? '' : " AND status = 'active'"
    const rows = await this.db.query(
      `SELECT ${MEMORY_COLUMNS}, embedding FROM memories WHERE namespace = ? AND category = ? AND embedding IS NOT NULL${statusClause}`,
      [this.options.namespace, category]
    ) as any[]

    let scored = rows.map((row: any) => {
      const stored = this.blobToFloat64(row.embedding)
      const distance = this.cosineDistance(queryEmbedding, stored)
      return { ...this.rowToMemory(row), distance }
    })

    if (options.filterMetadata) {
      scored = scored.filter((m: MemorySearchResult) =>
        Object.entries(options.filterMetadata!).every(([k, v]) => m.metadata[k] === v)
      )
    }

    if (options.maxDistance !== undefined) {
      scored = scored.filter((m: MemorySearchResult) => m.distance <= options.maxDistance!)
    }

    scored.sort((a: MemorySearchResult, b: MemorySearchResult) => a.distance - b.distance)

    const results = scored.slice(0, nResults)

    // Usage feeds the consolidation loop: recalled memories earn their keep,
    // never-recalled ones become decay candidates.
    if ((options.trackUsage ?? true) && results.length) {
      const ids = results.map(r => r.id)
      await this.db.execute(
        `UPDATE memories SET usage_count = usage_count + 1, last_used_at = datetime('now') WHERE id IN (${ids.map(() => '?').join(', ')})`,
        ids
      )
    }

    return results
  }

  // --- Epoch / Events ---

  /**
   * Get the current epoch value.
   * @returns {number} The current epoch
   */
  getEpoch(): number {
    return this.state.get('epoch') ?? 1
  }

  /**
   * Set the epoch to a specific value.
   * @param {number} value - The new epoch value
   */
  async setEpoch(value: number) {
    await this.ensureDb()
    await this.db.execute('UPDATE epochs SET value = ? WHERE namespace = ?', [value, this.options.namespace])
    this.state.set('epoch', value)
    this.emit('epochChanged', value)
  }

  /**
   * Increment the epoch by 1.
   * @returns {Promise<number>} The new epoch value
   */
  async incrementEpoch(): Promise<number> {
    const next = this.getEpoch() + 1
    await this.setEpoch(next)
    return next
  }

  /**
   * Create a timestamped event memory in the 'events' category,
   * automatically tagged with the current epoch.
   *
   * @param {string} text - The event description
   * @param {Record<string, any>} metadata - Optional additional metadata
   * @returns {Promise<MemoryRecord>} The created event memory
   */
  async createEvent(text: string, metadata: Record<string, any> = {}): Promise<MemoryRecord> {
    return this.create('events', text, { ...metadata, type: 'event', epoch: this.getEpoch() })
  }

  /**
   * Get events, optionally filtered by epoch.
   *
   * @param {object} options - Query options
   * @param {number} options.epoch - Filter to a specific epoch
   * @param {number} options.limit - Max results (default 10)
   * @returns {Promise<MemoryRecord[]>} Array of event memories
   */
  async getEvents(options: { epoch?: number; limit?: number } = {}): Promise<MemoryRecord[]> {
    const filterMetadata = options.epoch !== undefined ? { type: 'event', epoch: options.epoch } : { type: 'event' }
    return this.getAll('events', { limit: options.limit ?? 10, filterMetadata })
  }

  // --- Consolidation (the sleep cycle) ---

  /**
   * Run a consolidation pass over this namespace — the memory's sleep cycle.
   *
   * Embedding similarity is used only to propose clusters of rows that are
   * about the same thing; an LLM judge (created at runtime, or injected via
   * options.judge) then decides what each cluster means: duplicates merge
   * into one belief with summed confirmations, contradictions resolve by
   * superseding the outdated row, patterns across observations become
   * generalized beliefs, and everything else is left alone. Old, never-used
   * episodic rows decay to dormant. Nothing is ever deleted — every outcome
   * is a status change with an audit trail (superseded_by, derived_from),
   * so a wrong judgment is always reversible.
   *
   * Finishing a pass increments the epoch, so epoch counts sleep cycles and
   * reviewed_epoch records when each row was last considered.
   *
   * @param {MemoryConsolidateOptions} options - Pass configuration
   * @returns {Promise<MemoryConsolidateReport>} What happened, cluster by cluster
   *
   * @example
   * ```typescript
   * const mem = container.feature('memory', { namespace: 'my-assistant' })
   * const report = await mem.consolidate({ provider: 'claude-code' })
   * console.log(`epoch ${report.epoch}: merged ${report.merged}, superseded ${report.superseded}`)
   * ```
   */
  async consolidate(options: MemoryConsolidateOptions = {}): Promise<MemoryConsolidateReport> {
    await this.ensureDb()

    const clusterThreshold = options.clusterThreshold ?? 0.7
    const dormantAfterEpochs = options.dormantAfterEpochs ?? 3
    const dryRun = options.dryRun ?? false
    const epoch = this.getEpoch()
    const judge = options.judge ?? this.defaultJudge(options)

    const categories = options.categories ?? await this.categories()
    const report: MemoryConsolidateReport = {
      epoch, categories, rowsReviewed: 0, clusters: 0,
      merged: 0, superseded: 0, generalized: 0, dormant: 0,
      actions: [], warnings: [], dryRun,
    }

    for (const category of categories) {
      const rows = await this.db.query(
        `SELECT ${MEMORY_COLUMNS}, embedding FROM memories WHERE namespace = ? AND category = ? AND status = 'active' AND embedding IS NOT NULL`,
        [this.options.namespace, category]
      ) as any[]
      if (!rows.length) continue

      const records = rows.map((r: any) => ({ ...this.rowToMemory(r), vector: this.blobToFloat64(r.embedding) }))
      report.rowsReviewed += records.length

      const clusters = this.clusterBySimilarity(records, clusterThreshold, report.warnings)

      for (const cluster of clusters) {
        // Only clusters that need a decision cost a judge call: multi-row
        // clusters (possible duplicates/contradictions) and lone episodic
        // observations not yet reviewed (promote to belief, or leave?).
        // A kept singleton is NOT re-stamped on later passes — it must earn
        // usage or confirmations, or decay will eventually claim it.
        const needsJudgment = cluster.length > 1
          || (cluster[0]!.layer === 'episodic' && cluster[0]!.reviewed_epoch === 0)
        if (!needsJudgment) continue

        report.clusters++
        let reply: string
        try {
          reply = await judge(this.clusterPrompt(category, cluster))
        } catch (error) {
          report.warnings.push(`judge failed for cluster [${cluster.map(m => m.id).join(', ')}] in ${category}: ${error}`)
          continue
        }

        const actions = this.parseJudgeReply(reply, cluster, category, report.warnings)
        for (const action of actions) {
          report.actions.push(action)
          if (!dryRun) await this.applyAction(action, epoch, report)
          else this.tallyAction(action, report)
        }
      }
    }

    if (!dryRun && dormantAfterEpochs > 0) {
      const { changes } = await this.db.execute(
        `UPDATE memories SET status = 'dormant', updated_at = datetime('now')
         WHERE namespace = ? AND status = 'active' AND layer = 'episodic'
           AND usage_count = 0 AND confirmations <= 1
           AND reviewed_epoch > 0 AND reviewed_epoch <= ?`,
        [this.options.namespace, epoch - dormantAfterEpochs]
      )
      report.dormant = changes
    }

    if (!dryRun) await this.incrementEpoch()

    return report
  }

  /** @internal Build the default runtime judge: a fresh, zero-temperature conversation per cluster. */
  private defaultJudge(options: MemoryConsolidateOptions): (prompt: string) => Promise<string> {
    return async (prompt: string) => {
      const conversation = this.container.feature('conversation', {
        id: `memory-consolidate-${this.container.utils.uuid()}`,
        model: options.model,
        provider: options.provider,
        maxTokens: 1500,
        temperature: 0,
        history: [{ role: 'system', content: GARDENER_SYSTEM_PROMPT }],
      })
      return conversation.ask(prompt)
    }
  }

  /** @internal Greedy single-link clustering on stored embeddings. Similarity proposes, it never decides. */
  private clusterBySimilarity(
    records: Array<MemoryRecord & { vector: number[] }>,
    threshold: number,
    warnings: string[]
  ): Array<Array<MemoryRecord & { vector: number[] }>> {
    const clusters: Array<Array<MemoryRecord & { vector: number[] }>> = []

    for (const record of records) {
      let placed = false
      for (const cluster of clusters) {
        try {
          const similarity = 1 - this.cosineDistance(record.vector, cluster[0]!.vector)
          if (similarity >= threshold) {
            cluster.push(record)
            placed = true
            break
          }
        } catch {
          // Dimension mismatch (embedding model changed mid-database). Leave
          // the row unclustered rather than failing the whole pass.
          warnings.push(`memory ${record.id} has a different embedding dimension — run reembedAll()`)
          placed = true
          break
        }
      }
      if (!placed) clusters.push([record])
    }

    return clusters
  }

  /** @internal Render one cluster as a judgment prompt. */
  private clusterPrompt(category: string, cluster: Array<MemoryRecord & { vector: number[] }>): string {
    const rows = cluster.map(m => JSON.stringify({
      id: m.id,
      layer: m.layer,
      text: m.document,
      created_at: m.created_at,
      confirmations: m.confirmations,
      usage_count: m.usage_count,
    }))
    return `Category: ${category}\nMemories:\n${rows.join('\n')}\n\nRespond with the JSON verdict.`
  }

  /** @internal Extract and validate the judge's JSON actions. Anything malformed is skipped with a warning — the conservative failure mode is to change nothing. */
  private parseJudgeReply(reply: string, cluster: MemoryRecord[], category: string, warnings: string[]): MemoryConsolidateAction[] {
    const clusterIds = new Set(cluster.map(m => m.id))
    const match = reply.match(/\{[\s\S]*\}/)
    if (!match) {
      warnings.push(`judge reply had no JSON for cluster [${[...clusterIds].join(', ')}]`)
      return []
    }

    let parsed: any
    try {
      parsed = JSON.parse(match[0])
    } catch {
      warnings.push(`judge reply was not valid JSON for cluster [${[...clusterIds].join(', ')}]`)
      return []
    }

    const actions: MemoryConsolidateAction[] = []
    for (const raw of Array.isArray(parsed?.actions) ? parsed.actions : []) {
      const type = raw?.type
      const ids = Array.isArray(raw?.ids) ? raw.ids.filter((id: any) => Number.isInteger(id)) : []
      if (!['merge', 'supersede', 'generalize', 'keep'].includes(type)) {
        warnings.push(`judge proposed unknown action type "${type}"`)
        continue
      }
      if (!ids.length || !ids.every((id: number) => clusterIds.has(id))) {
        warnings.push(`judge action "${type}" referenced ids outside the cluster — skipped`)
        continue
      }
      actions.push({ type, category, ids, text: typeof raw.text === 'string' ? raw.text : undefined })
    }
    return actions
  }

  /** @internal Count an action into the report without applying it (dry run). */
  private tallyAction(action: MemoryConsolidateAction, report: MemoryConsolidateReport) {
    if (action.type === 'merge') report.merged++
    if (action.type === 'supersede') report.superseded++
    if (action.type === 'generalize') report.generalized++
  }

  /** @internal Apply one judged action. All outcomes are status changes plus audit links — never deletion. */
  private async applyAction(action: MemoryConsolidateAction, epoch: number, report: MemoryConsolidateReport) {
    const { category, ids, text } = action
    const ns = this.options.namespace

    if (action.type === 'keep') {
      await this.stampReviewed(ids, epoch)
      return
    }

    if (action.type === 'merge') {
      const [keepId, ...absorbedIds] = ids as [number, ...number[]]
      const keeper = await this.get(category, keepId)
      if (!keeper) return

      let confirmations = keeper.confirmations
      const derivedFrom = new Set<number>(keeper.derived_from)
      for (const id of absorbedIds) {
        const absorbed = await this.get(category, id)
        if (!absorbed) continue
        confirmations += absorbed.confirmations
        derivedFrom.add(id)
        for (const src of absorbed.derived_from) derivedFrom.add(src)
        await this.db.execute(
          "UPDATE memories SET status = 'consolidated', superseded_by = ?, updated_at = datetime('now') WHERE id = ? AND namespace = ?",
          [keepId, id, ns]
        )
      }

      // A merge always promotes the keeper to the belief layer — a confirmed
      // observation is a belief. A rewritten canonical text re-embeds.
      if (text && text !== keeper.document) {
        const embedding = await this.embed(text)
        await this.db.execute(
          "UPDATE memories SET document = ?, embedding = ?, layer = 'belief', confirmations = ?, derived_from = ?, reviewed_epoch = ?, updated_at = datetime('now') WHERE id = ? AND namespace = ?",
          [text, this.float64ToBlob(embedding), confirmations, JSON.stringify([...derivedFrom]), epoch, keepId, ns]
        )
      } else {
        await this.db.execute(
          "UPDATE memories SET layer = 'belief', confirmations = ?, derived_from = ?, reviewed_epoch = ?, updated_at = datetime('now') WHERE id = ? AND namespace = ?",
          [confirmations, JSON.stringify([...derivedFrom]), epoch, keepId, ns]
        )
      }
      report.merged++
      return
    }

    if (action.type === 'supersede') {
      const [winnerId, ...loserIds] = ids as [number, ...number[]]
      for (const id of loserIds) {
        await this.db.execute(
          "UPDATE memories SET status = 'superseded', superseded_by = ?, updated_at = datetime('now') WHERE id = ? AND namespace = ?",
          [winnerId, id, ns]
        )
      }
      await this.db.execute(
        "UPDATE memories SET layer = 'belief', reviewed_epoch = ?, updated_at = datetime('now') WHERE id = ? AND namespace = ?",
        [epoch, winnerId, ns]
      )
      report.superseded++
      return
    }

    if (action.type === 'generalize') {
      if (!text) return
      await this._insert(category, text, { source: 'consolidation' }, { layer: 'belief', derivedFrom: ids })
      await this.stampReviewed(ids, epoch)
      report.generalized++
    }
  }

  /** @internal Mark rows as reviewed in the given epoch. */
  private async stampReviewed(ids: number[], epoch: number) {
    if (!ids.length) return
    await this.db.execute(
      `UPDATE memories SET reviewed_epoch = ? WHERE id IN (${ids.map(() => '?').join(', ')}) AND namespace = ?`,
      [epoch, ...ids, this.options.namespace]
    )
  }

  /**
   * Re-embed every memory in this namespace with the currently configured
   * embedding model. Use this after changing embeddingModel or
   * embeddingProvider — search compares vectors directly, so a database holding
   * two different dimensionalities cannot be searched.
   *
   * @returns {Promise<number>} Number of memories re-embedded
   *
   * @example
   * ```typescript
   * const mem = container.feature('memory', { embeddingProvider: 'local' })
   * await mem.reembedAll()
   * ```
   */
  async reembedAll(): Promise<number> {
    await this.ensureDb()

    const rows = await this.db.query(
      'SELECT id, document FROM memories WHERE namespace = ?',
      [this.options.namespace]
    ) as { id: number; document: string }[]

    for (const row of rows) {
      const embedding = await this.embed(row.document)
      await this.db.execute(
        'UPDATE memories SET embedding = ? WHERE id = ? AND namespace = ?',
        [this.float64ToBlob(embedding), row.id, this.options.namespace]
      )
    }

    return rows.length
  }

  // --- Import / Export ---

  /**
   * Export all memories in this namespace to a JSON-serializable object.
   */
  async exportToJson(): Promise<{ namespace: string; epoch: number; memories: MemoryRecord[] }> {
    await this.ensureDb()

    const rows = await this.db.query(
      `SELECT ${MEMORY_COLUMNS} FROM memories WHERE namespace = ? ORDER BY category, id`,
      [this.options.namespace]
    ) as any[]

    return {
      namespace: this.options.namespace,
      epoch: this.getEpoch(),
      memories: rows.map((r: any) => this.rowToMemory(r)),
    }
  }

  /**
   * Import memories from a JSON export. Optionally replaces all existing memories.
   *
   * @param {object} data - The exported data object
   * @param {boolean} replace - If true, wipe existing memories before importing (default true)
   * @returns {Promise<number>} Number of memories imported
   */
  async importFromJson(data: { namespace?: string; epoch?: number; memories: Array<{ category: string; document: string; metadata?: Record<string, any> }> }, replace = true): Promise<number> {
    await this.ensureDb()

    if (replace) {
      await this.wipeAll()
    }

    let count = 0
    for (const mem of data.memories) {
      await this.create(mem.category, mem.document, mem.metadata || {})
      count++
    }

    if (data.epoch !== undefined) {
      await this.setEpoch(data.epoch)
    }

    return count
  }

  // --- Internal Helpers ---

  /** @internal Embed a single text string, returns flat number array */
  private async embed(text: string): Promise<number[]> {
    const results = await this.searcher.embed([text])
    return results[0]
  }

  /** @internal Convert number[] to a Buffer for BLOB storage */
  private float64ToBlob(arr: number[]): Buffer {
    const buf = Buffer.alloc(arr.length * 8)
    for (let i = 0; i < arr.length; i++) {
      buf.writeDoubleLE(arr[i]!, i * 8)
    }
    return buf
  }

  /** @internal Convert a BLOB back to number[] */
  private blobToFloat64(blob: Buffer | Uint8Array): number[] {
    const buf = Buffer.from(blob)
    const arr = new Array(buf.length / 8)
    for (let i = 0; i < arr.length; i++) {
      arr[i] = buf.readDoubleLE(i * 8)
    }
    return arr
  }

  /** @internal Cosine distance between two vectors (0 = identical, 2 = opposite) */
  private cosineDistance(a: number[], b: number[]): number {
    // Without this guard a shorter query vector silently scores against a
    // prefix of the stored one and returns a plausible-looking but meaningless
    // distance. That happens whenever the embedding model changes underneath an
    // existing database (e.g. openai/3072 rows searched with local/768 queries).
    if (a.length !== b.length) {
      throw new Error(
        `Embedding dimension mismatch: query is ${a.length}-dim but a stored memory is ${b.length}-dim. ` +
        `The embedding model changed since these memories were written — re-index them with reembedAll(), ` +
        `or switch back to the model that produced ${b.length}-dim vectors.`
      )
    }

    let dot = 0, magA = 0, magB = 0
    for (let i = 0; i < a.length; i++) {
      dot += a[i]! * b[i]!
      magA += a[i]! * a[i]!
      magB += b[i]! * b[i]!
    }
    const similarity = dot / (Math.sqrt(magA) * Math.sqrt(magB))
    return 1 - similarity
  }

  /** @internal Convert a SQLite row to a MemoryRecord object */
  private rowToMemory(row: any): MemoryRecord {
    return {
      id: row.id,
      category: row.category,
      document: row.document,
      metadata: typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata,
      created_at: row.created_at,
      updated_at: row.updated_at,
      layer: row.layer ?? 'belief',
      status: row.status ?? 'active',
      superseded_by: row.superseded_by ?? null,
      confirmations: row.confirmations ?? 1,
      usage_count: row.usage_count ?? 0,
      last_used_at: row.last_used_at ?? null,
      derived_from: typeof row.derived_from === 'string' ? JSON.parse(row.derived_from) : (row.derived_from ?? []),
      reviewed_epoch: row.reviewed_epoch ?? 0,
    }
  }
}

export default Memory
