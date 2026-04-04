import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from '../../schemas/base.js'
import { Feature } from '../feature.js'
import type { Helper } from '../../helper.js'

declare module '@soederpop/luca/feature' {
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
  embeddingModel: z.string().default('text-embedding-3-large').describe('OpenAI embedding model to use'),
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

export interface MemoryRecord {
  id: number
  category: string
  document: string
  metadata: Record<string, any>
  created_at: string
  updated_at: string
}

export interface MemorySearchResult extends MemoryRecord {
  distance: number
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
      this._searcher = this.container.feature('semanticSearch', {
        embeddingModel: this.options.embeddingModel,
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

    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS epochs (
        namespace TEXT NOT NULL,
        value INTEGER NOT NULL DEFAULT 1,
        PRIMARY KEY (namespace)
      )
    `)

    const rows = await this.db.query<{ value: number }>(
      'SELECT value FROM epochs WHERE namespace = ?',
      [this.options.namespace]
    )

    if (rows.length) {
      this.state.set('epoch', rows[0].value)
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
    await this.ensureDb()

    const embedding = await this.embed(text)
    const embeddingBlob = this.float64ToBlob(embedding)
    const metaJson = JSON.stringify({ ...metadata, epoch: this.state.get('epoch') })

    const { lastInsertRowid } = await this.db.execute(
      'INSERT INTO memories (namespace, category, document, metadata, embedding) VALUES (?, ?, ?, ?, ?)',
      [this.options.namespace, category, text, metaJson, embeddingBlob]
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

    const results = await this.search(category, text, 1)
    if (results.length > 0 && (1 - results[0].distance) >= similarityThreshold) {
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

    const rows = await this.db.query<any>(
      'SELECT id, category, document, metadata, created_at, updated_at FROM memories WHERE namespace = ? AND category = ? AND id = ?',
      [this.options.namespace, category, id]
    )

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

    let rows = await this.db.query<any>(
      `SELECT id, category, document, metadata, created_at, updated_at FROM memories WHERE namespace = ? AND category = ? ORDER BY created_at ${sortOrder === 'asc' ? 'ASC' : 'DESC'} LIMIT ?`,
      [this.options.namespace, category, limit]
    )

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
      const rows = await this.db.query<{ cnt: number }>(
        'SELECT COUNT(*) as cnt FROM memories WHERE namespace = ? AND category = ?',
        [this.options.namespace, category]
      )
      return rows[0].cnt
    }

    const rows = await this.db.query<{ cnt: number }>(
      'SELECT COUNT(*) as cnt FROM memories WHERE namespace = ?',
      [this.options.namespace]
    )
    return rows[0].cnt
  }

  /**
   * List all categories that have memories.
   *
   * @returns {Promise<string[]>} Array of category names
   */
  async categories(): Promise<string[]> {
    await this.ensureDb()

    const rows = await this.db.query<{ category: string }>(
      'SELECT DISTINCT category FROM memories WHERE namespace = ?',
      [this.options.namespace]
    )

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
   * @returns {Promise<MemorySearchResult[]>} Memories sorted by similarity (closest first)
   */
  async search(category: string, query: string, nResults = 5, options: { maxDistance?: number; filterMetadata?: Record<string, any> } = {}): Promise<MemorySearchResult[]> {
    await this.ensureDb()

    const queryEmbedding = await this.embed(query)

    const rows = await this.db.query<any>(
      'SELECT id, category, document, metadata, embedding, created_at, updated_at FROM memories WHERE namespace = ? AND category = ? AND embedding IS NOT NULL',
      [this.options.namespace, category]
    )

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

    return scored.slice(0, nResults)
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

  // --- Import / Export ---

  /**
   * Export all memories in this namespace to a JSON-serializable object.
   */
  async exportToJson(): Promise<{ namespace: string; epoch: number; memories: MemoryRecord[] }> {
    await this.ensureDb()

    const rows = await this.db.query<any>(
      'SELECT id, category, document, metadata, created_at, updated_at FROM memories WHERE namespace = ? ORDER BY category, id',
      [this.options.namespace]
    )

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
      buf.writeDoubleLE(arr[i], i * 8)
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
    let dot = 0, magA = 0, magB = 0
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i]
      magA += a[i] * a[i]
      magB += b[i] * b[i]
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
    }
  }
}

export default Memory
