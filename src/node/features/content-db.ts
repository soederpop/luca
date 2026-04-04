import { Feature } from '../feature.js'
import * as contentbaseExports from 'contentbase'
import { parse, Collection, extractSections, type ModelDefinition } from 'contentbase'
import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from '../../schemas/base.js'
import { realpathSync } from 'node:fs'
import type { GrepOptions } from './grep.js'
import type { Helper } from '../../helper.js'

export const ContentDbStateSchema = FeatureStateSchema.extend({
  loaded: z.boolean().default(false).describe('Whether the content collection has been loaded and parsed'),
  tableOfContents: z.string().default('').describe('Generated table of contents string for the collection'),
  modelSummary: z.string().default('').describe('Summary of all discovered content models and their document counts'),
})

export const ContentDbOptionsSchema = FeatureOptionsSchema.extend({
  rootPath: z.string().describe('Root directory path containing the structured markdown collection'),
})

export type ContentDbState = z.infer<typeof ContentDbStateSchema>
export type ContentDbOptions = z.infer<typeof ContentDbOptionsSchema>

export const ContentDbEventsSchema = FeatureEventsSchema.extend({
  reloaded: z.tuple([]).describe('When the content collection is reloaded from disk'),
}).describe('ContentDb events')

/**
 * Provides access to a Contentbase Collection for a folder of structured markdown files.
 *
 * Models are defined in the collection's models.ts file and auto-discovered on load.
 * This feature is a thin wrapper that manages the collection lifecycle and provides
 * convenience accessors for models and documents.
 *
 * @extends Feature
 * @example
 * ```typescript
 * const contentDb = container.feature('contentDb', { rootPath: './docs' })
 * await contentDb.load()
 * console.log(contentDb.modelNames) // ['Article', 'Page', ...]
 * ```
 */
export class ContentDb extends Feature<ContentDbState, ContentDbOptions> {
  static override shortcut = 'features.contentDb' as const
  static override stateSchema = ContentDbStateSchema
  static override optionsSchema = ContentDbOptionsSchema
  static override eventsSchema = ContentDbEventsSchema
  static { Feature.register(this, 'contentDb') }

  /** Tools that any assistant can use to progressively explore this collection. */
  static override tools: Record<string, { schema: z.ZodType; handler?: Function }> = {
    getCollectionOverview: {
      schema: z.object({}).describe(
        'Get a high-level overview of the document collection: what models exist, how many documents each has, the directory tree, and search index status. Call this FIRST to understand the collection before exploring individual documents.'
      ),
    },
    listDocuments: {
      schema: z.object({
        model: z.string().optional().describe('Filter to documents of this model type (e.g. "Plan", "Task"). Get model names from getCollectionOverview.'),
        glob: z.string().optional().describe('Glob pattern to filter by document path (e.g. "guides/*", "apis/**/*.md")'),
      }).describe(
        'List document IDs in the collection. Use this to browse what\'s available before reading. Filter by model or glob to narrow results.'
      ),
    },
    readDocument: {
      schema: z.object({
        id: z.string().describe('The document path ID (e.g. "guides/intro", "apis/auth"). Get valid IDs from listDocuments.'),
        include: z.array(z.string()).optional().describe('Only return sections with these headings. Use to read specific parts of long documents without loading everything.'),
        exclude: z.array(z.string()).optional().describe('Skip sections with these headings. Use to filter out irrelevant parts.'),
        meta: z.boolean().optional().describe('Include the YAML frontmatter (title, status, tags, etc.) in the output. Useful for understanding document metadata.'),
      }).describe(
        'Read a document by its path ID. Use include/exclude to request only the sections you need — don\'t load an entire document when you only need one section.'
      ),
    },
    readMultipleDocuments: {
      schema: z.object({
        ids: z.array(z.string()).describe('Array of document path IDs to read. Get valid IDs from listDocuments.'),
        include: z.array(z.string()).optional().describe('Only return sections with these headings from each document.'),
        exclude: z.array(z.string()).optional().describe('Skip sections with these headings from each document.'),
        meta: z.boolean().optional().describe('Include YAML frontmatter for each document.'),
      }).describe(
        'Read multiple documents in one call. More efficient than calling readDocument in a loop. Returns documents concatenated with dividers.'
      ),
    },
    queryDocuments: {
      schema: z.object({
        model: z.string().describe('The model name to query (e.g. "Plan", "Task", "Guide"). Must match a model defined in the collection — check getCollectionOverview.'),
        where: z.string().optional().describe('MongoDB-style filter as a JSON string. Dot notation for nested fields. Examples: \'{"meta.status": "approved"}\', \'{"meta.priority": {"$gt": 3}}\', \'{"meta.tags": {"$in": ["urgent"]}}\''),
        sort: z.string().optional().describe('Sort as a JSON string. Example: \'{"meta.priority": "desc"}\', \'{"meta.createdAt": "asc"}\''),
        limit: z.number().optional().describe('Maximum number of results. Default: all matching documents.'),
        offset: z.number().optional().describe('Skip this many results (for pagination).'),
        select: z.array(z.string()).optional().describe('Only include these fields in output (e.g. ["id", "title", "meta.status"]). Reduces noise when you only need specific metadata.'),
      }).describe(
        'Query documents by model with filtering, sorting, and pagination. Use this when you need to find documents matching specific criteria (status, priority, tags, dates) rather than browsing by name.'
      ),
    },
    searchContent: {
      schema: z.object({
        pattern: z.string().describe('Regex pattern to search for across all document content. Examples: "TODO|FIXME", "authentication", "def.*handler"'),
        caseSensitive: z.boolean().optional().describe('Case-sensitive search. Default: false (case insensitive).'),
      }).describe(
        'Text/regex search (grep) across all documents. Use for exact pattern matching, code references, or finding specific terms. Returns matching lines with file context. For natural language questions, use semanticSearch instead.'
      ),
    },
    semanticSearch: {
      schema: z.object({
        query: z.string().describe('A natural language question or topic description. Example: "how does the authentication flow work?" or "deployment configuration options"'),
        limit: z.number().optional().describe('Maximum results to return. Default: 10.'),
      }).describe(
        'Search documents using natural language — combines keyword matching with semantic similarity. Best for questions and topic exploration. Falls back to text search if no vector index exists. For exact pattern matching, use searchContent instead.'
      ),
    },
  }

  /**
   * When an assistant uses contentDb, inject system prompt guidance
   * about progressive document exploration.
   */
  override setupToolsConsumer(consumer: Helper) {
    if (typeof (consumer as any).addSystemPromptExtension === 'function') {
      (consumer as any).addSystemPromptExtension('contentDb', [
        '## Document Collection',
        '',
        'You have access to a structured document collection (markdown files with frontmatter, organized by model/type).',
        '',
        '**Progressive exploration — go broad to narrow:**',
        '1. `getCollectionOverview` — start here. Shows models, document counts, and directory structure.',
        '2. `listDocuments` — browse document IDs, optionally filtered by model or glob.',
        '3. `readDocument` — read a specific document. Use `include`/`exclude` to skip irrelevant sections.',
        '4. `queryDocuments` — filter documents by metadata (status, priority, tags, etc.) with MongoDB-style queries.',
        '',
        '**Searching:**',
        '- `semanticSearch` — best for natural language questions ("how does authentication work?")',
        '- `searchContent` — best for exact patterns, code references, or regex across all documents',
        '',
        '**Efficiency:** Don\'t read entire documents when you only need one section. Use `include` to request specific headings. Use `readMultipleDocuments` to batch reads instead of calling `readDocument` in a loop.',
      ].join('\n'))
    }
  }

  override get initialState(): ContentDbState {
    return {
      ...super.initialState,
      loaded: false
    }
  }

  /** Whether the content database has been loaded. */
  get isLoaded(): boolean {
    return !!this.state.get('started')
  }

  _collection?: Collection
  private _contentbaseSeeded = false

  /** Returns the lazily-initialized Collection instance for the configured rootPath. */
  get collection(): Collection {
    if (this._collection) return this._collection

    const opts: any = { rootPath: this.options.rootPath }

    // When contentbase isn't in node_modules (e.g. compiled luca binary),
    // provide a VM-based module loader so models.ts can resolve its imports
    if (!this._canNativeImportContentbase()) {
      opts.moduleLoader = (filePath: string) => {
        this._seedContentbaseVirtualModules()
        const vm = this.container.feature('vm') as any
        return vm.loadModule(filePath)
      }
    }

    return this._collection = new Collection(opts)
  }

  /** Check if contentbase is resolvable via native import from the project root */
  private _canNativeImportContentbase(): boolean {
    const cwd = this.container.cwd
    return this.container.fs.exists(this.container.paths.resolve(cwd, 'node_modules', 'contentbase'))
  }

  /** Seed the VM with virtual modules so models.ts can import from 'contentbase', 'zod', etc. */
  private _seedContentbaseVirtualModules(): void {
    if (this._contentbaseSeeded) return
    this._contentbaseSeeded = true

    const vm = this.container.feature('vm') as any

    // Seed luca modules first (helpers does this for @soederpop/luca)
    const helpers = this.container.feature('helpers') as any
    if (helpers?.seedVirtualModules) {
      helpers.seedVirtualModules()
    }

    // Register contentbase barrel — everything the library exports
    vm.defineModule('contentbase', contentbaseExports)

    // Common deps that models.ts files tend to use
    try { vm.defineModule('js-yaml', require('js-yaml')) } catch {}
    try { vm.defineModule('mdast-util-to-string', require('mdast-util-to-string')) } catch {}
  }

  /** Returns the absolute resolved path to the collection root directory. */
  get collectionPath(): string {
    return this.container.paths.resolve(this.options.rootPath)
  }

  /** Returns an object mapping model names to their model definitions, sourced from the collection. */
  get models(): Record<string, ModelDefinition> {
    const entries = this.collection.modelDefinitions.map((d) => [d.name, d] as const)
    return Object.fromEntries(entries)
  }

  /** Returns an array of all registered model names from the collection. */
  get modelNames(): string[] {
    return this.collection.modelDefinitions.map((d) => d.name)
  }

  /**
   * Returns the available document ids in the collection
  */
  get available() : string[] {
	  return this.collection.available
  }
  
  /**
   * Render a tree view of the collection directory structure.
   * Built with container.fs so it works without the `tree` binary.
   */
  renderTree(options?: { depth?: number; dirsOnly?: boolean }): string {
    const maxDepth = options?.depth ?? Infinity
    const dirsOnly = options?.dirsOnly ?? false
    const fs = this.container.fs
    const paths = this.container.paths
    const root = this.collectionPath
    const lines: string[] = [paths.basename(root)]

    const walk = (dir: string, prefix: string, currentDepth: number) => {
      if (currentDepth >= maxDepth) return
      const entries: string[] = fs.readdirSync(dir).sort()
      const filtered = entries.filter((e: string) => {
        if (e.startsWith('.')) return false
        if (dirsOnly) return fs.isDirectory(paths.resolve(dir, e))
        return true
      })

      filtered.forEach((entry: string, i: number) => {
        const isLast = i === filtered.length - 1
        const connector = isLast ? '└── ' : '├── '
        const fullPath = paths.resolve(dir, entry)
        lines.push(`${prefix}${connector}${entry}`)
        if (fs.isDirectory(fullPath)) {
          walk(fullPath, prefix + (isLast ? '    ' : '│   '), currentDepth + 1)
        }
      })
    }

    walk(root, '', 0)
    return lines.join('\n')
  }

  async grep(options: string | GrepOptions) {
    if (typeof options === 'string') {
      options = { pattern: options }
    }
    return this.container.feature('grep').search({
      path: this.collectionPath,
      include: ['**/*.md'],
      exclude: ['.env', 'secrets'],
      ...options,
    })
  }

  /**
   * Query documents belonging to a specific model definition.
   *
   * @param model - The model definition to query against
   * @returns A query builder scoped to the given model's documents
   * @example
   * ```typescript
   * const contentDb = container.feature('contentDb', { rootPath: './docs' })
   * await contentDb.load()
   * const articles = await contentDb.query(contentDb.models.Article).fetchAll()
   * ```
   */
  query<T extends ModelDefinition>(model: T) {
    return this.collection.query(model)
  }

  /**
   * Parse a markdown file at the given path without loading the full collection.
   *
   * @param path - Absolute or relative path to the markdown file
   * @returns The parsed markdown document with frontmatter and content
   * @example
   * ```typescript
   * const doc = contentDb.parseMarkdownAtPath('./docs/getting-started.md')
   * console.log(doc.frontmatter, doc.content)
   * ```
   */
  parseMarkdownAtPath(path: string) {
    return parse(path)
  }

  /**
   * Load the collection, discovering models from models.ts and parsing all documents.
   *
   * @returns This ContentDb instance for chaining
   * @example
   * ```typescript
   * const contentDb = container.feature('contentDb', { rootPath: './docs' })
   * await contentDb.load()
   * console.log(contentDb.isLoaded) // true
   * ```
   */
  async load(): Promise<ContentDb> {
    if (this.isLoaded) {
      return this;
    }

    await this.collection.load()
    this.state.set('started', true)

    return this
  }

  /** Force-reload the collection from disk, picking up new/changed/deleted documents. */
  async reload(): Promise<ContentDb> {
    await this.collection.load({ refresh: true })
    this.emit('reloaded')
    return this
  }

  /**
   * Read a single document by its path ID, optionally filtering to specific sections.
   *
   * The document title (H1) is always included in the output. When using `include`,
   * the leading content (paragraphs between the H1 and first H2) is also included
   * by default, controlled by the `leadingContent` option.
   *
   * When `include` is provided, only those sections are returned (via extractSections in flat mode).
   * When `exclude` is provided, those sections are removed from the full document.
   * If both are set, `include` takes precedence.
   *
   * @param idStringOrObject - Document path ID string, or an object with an `id` property
   * @param options - Optional filtering and formatting options
   * @param options.include - Only return sections matching these heading names
   * @param options.exclude - Remove sections matching these heading names
   * @param options.meta - Whether to include YAML frontmatter in the output (default: false)
   * @param options.leadingContent - Include content between the H1 and first H2 when using include filter (default: true)
   * @returns The document content as a markdown string
   * @example
   * ```typescript
   * await contentDb.read('guides/intro')
   * await contentDb.read('guides/intro', { include: ['Installation', 'Usage'] })
   * await contentDb.read('guides/intro', { exclude: ['Changelog'], meta: true })
   * await contentDb.read('guides/intro', { include: ['API'], leadingContent: false })
   * ```
   */
  async read(idStringOrObject: string | { id: string }, options?: { exclude?: string[], include?: string[], meta?: boolean, leadingContent?: boolean }): Promise<string> {
    const id = typeof idStringOrObject === 'string' ? idStringOrObject : idStringOrObject.id

    if (!id) {
      throw new Error('Must supply a document id to read')
    }

    if (!this.isLoaded) await this.load()

    const doc = this.collection.document(id)
    const { include, exclude, meta, leadingContent = true } = options ?? {}
    const hasFilters = (include?.length ?? 0) > 0 || (exclude?.length ?? 0) > 0

    if (!hasFilters) {
      return meta ? doc.rawContent : doc.content
    }

    let content: string

    if (include?.length) {
      const extracted = extractSections([{ source: doc, sections: include }], { mode: 'flat' })
      let prefix = `# ${doc.title}\n\n`
      if (leadingContent) {
        const leading = this._getLeadingContent(doc)
        if (leading) prefix += leading + '\n\n'
      }
      content = prefix + extracted.content
    } else {
      let modified = doc
      for (const heading of exclude!) {
        modified = modified.removeSection(heading)
      }
      content = modified.content
    }

    if (meta) {
      const raw = doc.rawContent
      const secondDashIndex = raw.indexOf('---', 3)
      if (secondDashIndex !== -1) {
        return raw.slice(0, secondDashIndex + 3) + '\n\n' + content
      }
    }

    return content
  }

  /**
   * Read multiple documents by their path IDs, concatenated into a single string.
   *
   * By default each document is wrapped in `<!-- BEGIN: id -->` / `<!-- END: id -->`
   * dividers for easy identification. Supports the same filtering options as {@link read}.
   *
   * @param ids - Array of document path ID strings or objects with `id` properties
   * @param options - Optional filtering and formatting options (applied to each document)
   * @param options.dividers - Wrap each document in BEGIN/END comment dividers showing the ID (default: true)
   * @returns The concatenated document contents as a single markdown string
   * @example
   * ```typescript
   * await contentDb.readMultiple(['guides/intro', 'guides/setup'])
   * await contentDb.readMultiple([{ id: 'guides/intro' }], { include: ['Overview'], dividers: false })
   * ```
   */
  async readMultiple(ids: string[] | { id: string }[], options?: { exclude?: string[], include?: string[], meta?: boolean, leadingContent?: boolean, dividers?: boolean }): Promise<string> {
    const { dividers = true, ...readOptions } = options ?? {}
    const results = await Promise.all(
      ids.map(async (idOrObj) => {
        const docId = typeof idOrObj === 'string' ? idOrObj : idOrObj.id
        const content = await this.read(idOrObj, readOptions)
        if (dividers) {
          return `<!-- BEGIN: ${docId} -->\n${content}\n<!-- END: ${docId} -->`
        }
        return content
      })
    )
    return results.join('\n\n')
  }

  /**
   * Extracts the content between the H1 heading and the first H2 heading.
   * Returns an empty string if there's no leading content or no H2 sections.
   */
  private _getLeadingContent(doc: ReturnType<Collection['document']>): string {
    const h1 = doc.astQuery.headingsAtDepth(1)[0]
    const firstH2 = doc.astQuery.headingsAtDepth(2)[0]

    if (!h1 || !firstH2) return ''

    const betweenNodes = doc.astQuery.findBetween(h1, firstH2)
    if (!betweenNodes.length) return ''

    return doc.stringify({ type: 'root', children: betweenNodes } as any).trim()
  }

  async generateTableOfContents() {
	  return this.collection.tableOfContents()
  }

  async generateModelSummary(options: any) {
	  return this.collection.generateModelSummary(options)
  }
  
  get modelDefinitionTable(): Record<string, { description: string; glob: string; routePatterns: string[] }> {
    return Object.fromEntries(this.collection.modelDefinitions.map(d => {
      
      const prefixPattern = this.container.paths.relative(this.collection.resolve(d.prefix))

      return [d.name, {
        description: d.name === 'Base' ? 'Any markdown document not matched to a model' : d.description,
        glob: `${prefixPattern}/**/*.md`,
        routePatterns: Array(d.pattern).flatMap(p => p).filter(Boolean).map(p => `${prefixPattern}/${p}`)
      }]
    }))
  }
  
  get fileTree(): string {
    return this.collection.renderFileTree()
  }

  // ── Search Integration ─────────────────────────────────────────────

  private _semanticSearch: any = null

  /**
   * Lazily initialize the semanticSearch feature, attaching it to the container if needed.
   * The dbPath defaults to `~/.luca/contentbase/{hash}/search.sqlite` where hash is derived from the resolved collection path.
   */
  private async _getSemanticSearch(options?: { dbPath?: string; embeddingProvider?: string; embeddingModel?: string }) {
    if (this._semanticSearch?.state?.get('dbReady')) return this._semanticSearch

    // Dynamically import and attach SemanticSearch if not already registered
    const { SemanticSearch } = await import('./semantic-search.js')
    if (!this.container.features.available.includes('semanticSearch')) {
      ;(SemanticSearch as any).attach(this.container as any)
    }

    // Store search index in ~/.luca/contentbase/{hash}/ keyed by the real (symlink-resolved) collection path
    const realPath = realpathSync(this.collectionPath)
    const pathHash = this.container.utils.hashObject(realPath).slice(0, 12)
    const dbPath = options?.dbPath ?? this.container.paths.resolve(this.container.os.homedir, '.luca', 'contentbase', pathHash, 'search.sqlite')
    this._semanticSearch = (this.container as any).feature('semanticSearch', {
      dbPath,
      ...(options?.embeddingProvider ? { embeddingProvider: options.embeddingProvider } : {}),
      ...(options?.embeddingModel ? { embeddingModel: options.embeddingModel } : {}),
    })

    await this._semanticSearch.initDb()
    return this._semanticSearch
  }

  /**
   * Check if a search index exists for this collection.
   */
  private _hasSearchIndex(): boolean {
    const realPath = realpathSync(this.collectionPath)
    const pathHash = this.container.utils.hashObject(realPath).slice(0, 12)
    const dbDir = this.container.paths.resolve(this.container.os.homedir, '.luca', 'contentbase', pathHash)

    if (!this.container.fs.exists(dbDir)) return false

    try {
      const files = this.container.fs.readdirSync(dbDir)
      return files.some((f: string) => f.startsWith('search.') && f.endsWith('.sqlite'))
    } catch {
      return false
    }
  }

  /**
   * BM25 keyword search across indexed documents.
   * If no search index exists, throws with an actionable message.
   */
  async search(query: string, options?: { limit?: number; model?: string; where?: Record<string, any> }) {
    if (!this._hasSearchIndex() && !this._semanticSearch) {
      throw new Error('No search index found. Run: cbase embed')
    }
    const ss = await this._getSemanticSearch()
    return ss.search(query, options)
  }

  /**
   * Vector similarity search using embeddings.
   * Finds conceptually related documents even without keyword matches.
   */
  async vectorSearch(query: string, options?: { limit?: number; model?: string; where?: Record<string, any> }) {
    if (!this._hasSearchIndex() && !this._semanticSearch) {
      throw new Error('No search index found. Run: cbase embed')
    }
    const ss = await this._getSemanticSearch()
    return ss.vectorSearch(query, options)
  }

  /**
   * Combined keyword + semantic search with Reciprocal Rank Fusion.
   * Best for general questions about the collection.
   */
  async hybridSearch(query: string, options?: { limit?: number; model?: string; where?: Record<string, any>; ftsWeight?: number; vecWeight?: number }) {
    if (!this._hasSearchIndex() && !this._semanticSearch) {
      throw new Error('No search index found. Run: cbase embed')
    }
    const ss = await this._getSemanticSearch()
    return ss.hybridSearch(query, options)
  }

  /**
   * Build the search index from all documents in the collection.
   * Chunks documents and generates embeddings.
   */
  async buildSearchIndex(options?: { force?: boolean; embeddingProvider?: string; embeddingModel?: string; onProgress?: (indexed: number, total: number) => void }) {
    if (!this.isLoaded) await this.load()

    const ss = await this._getSemanticSearch({
      embeddingProvider: options?.embeddingProvider,
      embeddingModel: options?.embeddingModel,
    })

    const docs = this._collectDocumentInputs()
    const toIndex = options?.force ? docs : docs.filter((doc: any) => ss.needsReindex(doc))

    if (toIndex.length === 0) return { indexed: 0, total: docs.length }

    // Remove stale documents
    ss.removeStale(docs.map((d: any) => d.pathId))

    // Index in batches for progress reporting
    const batchSize = 5
    let indexed = 0
    for (let i = 0; i < toIndex.length; i += batchSize) {
      const batch = toIndex.slice(i, i + batchSize)
      await ss.indexDocuments(batch)
      indexed += batch.length
      options?.onProgress?.(indexed, toIndex.length)
    }

    return { indexed, total: docs.length }
  }

  /**
   * Rebuild the entire search index from scratch.
   */
  async rebuildSearchIndex(options?: { embeddingProvider?: string; embeddingModel?: string; onProgress?: (indexed: number, total: number) => void }) {
    const ss = await this._getSemanticSearch({
      embeddingProvider: options?.embeddingProvider,
      embeddingModel: options?.embeddingModel,
    })
    await ss.reindex()
    return this.buildSearchIndex({ force: true, ...options })
  }

  /**
   * Get the current search index status.
   */
  get searchIndexStatus(): { exists: boolean; documentCount: number; chunkCount: number; embeddingCount: number; lastIndexedAt: any; provider: any; model: any; dimensions: number; dbSizeBytes: number } {
    if (!this._semanticSearch?.state?.get('dbReady')) {
      if (!this._hasSearchIndex()) {
        return { exists: false, documentCount: 0, chunkCount: 0, embeddingCount: 0, lastIndexedAt: null, provider: null, model: null, dimensions: 0, dbSizeBytes: 0 }
      }
      return { exists: true, documentCount: -1, chunkCount: -1, embeddingCount: -1, lastIndexedAt: null, provider: null, model: null, dimensions: 0, dbSizeBytes: 0 }
    }
    const stats = this._semanticSearch.getStats()
    return { exists: true, ...stats }
  }

  /**
   * Convert collection documents to DocumentInput format for the semantic search feature.
   */
  private _collectDocumentInputs() {
    const inputs: any[] = []
    for (const pathId of this.collection.available) {
      const doc = this.collection.document(pathId) as any
      const modelDef = (this.collection as any).findModelDefinition?.(pathId)

      // Extract sections from the document content using heading markers
      const sections: any[] = []
      const lines = doc.content.split('\n')
      let currentHeading: string | null = null
      let currentContent: string[] = []

      for (const line of lines) {
        const h2Match = line.match(/^## (.+)/)
        if (h2Match) {
          if (currentHeading) {
            sections.push({
              heading: currentHeading,
              headingPath: currentHeading,
              content: currentContent.join('\n').trim(),
              level: 2,
            })
          }
          currentHeading = h2Match[1].trim()
          currentContent = []
        } else if (currentHeading) {
          currentContent.push(line)
        }
      }
      if (currentHeading) {
        sections.push({
          heading: currentHeading,
          headingPath: currentHeading,
          content: currentContent.join('\n').trim(),
          level: 2,
        })
      }

      inputs.push({
        pathId,
        model: modelDef?.name ?? undefined,
        title: doc.title,
        slug: doc.slug,
        meta: doc.meta,
        content: doc.content,
        sections: sections.length > 0 ? sections : undefined,
      })
    }
    return inputs
  }

  /**
   * Returns an object with query builders keyed by model name (singular and plural, lowercased).
   *
   * Provides a convenient shorthand for querying without looking up model definitions manually.
   *
   * @example
   * ```typescript
   * const contentDb = container.feature('contentDb', { rootPath: './docs' })
   * await contentDb.load()
   * const allArticles = await contentDb.queries.articles.fetchAll()
   * const firstTask = await contentDb.queries.task.first()
   * ```
   */
  get queries(): Record<string, ReturnType<typeof this.query>> {
    const queryChains: [string, ReturnType<typeof this.query>][] = []
    for (const modelName of this.modelNames) {
      const queryChain = this.query(this.models[modelName]!)
      const pluralized = this.container.utils.stringUtils.pluralize(modelName).toLowerCase()
      queryChains.push([modelName.toLowerCase(), queryChain])
      queryChains.push([pluralized, queryChain])
    }
    return Object.fromEntries(queryChains)
  }
  // ── Tool Methods ─────────────────────────────────────────────────
  // These methods are auto-bound as tool handlers by toTools() because
  // their names match the keys in static tools above.

  /** Returns a high-level overview of the collection. */
  async getCollectionOverview() {
    if (!this.isLoaded) await this.load()

    const modelCounts: Record<string, number> = {}
    for (const def of this.collection.modelDefinitions) {
      const count = await this.collection.query(def).count()
      modelCounts[def.name] = count
    }

    return {
      rootPath: this.collectionPath,
      totalDocuments: this.available.length,
      models: modelCounts,
      tree: this.renderTree({ depth: 2 }),
      hasSearchIndex: this._hasSearchIndex(),
    }
  }

  /** List document IDs, optionally filtered by model or glob. */
  async listDocuments(args: { model?: string; glob?: string }) {
    if (!this.isLoaded) await this.load()

    let ids = this.available

    if (args.model) {
      const def = this.models[args.model]
      if (!def) return { error: `Unknown model "${args.model}". Available: ${this.modelNames.join(', ')}` }
      const instances = await this.collection.query(def).fetchAll()
      ids = instances.map((inst: any) => inst.id)
    }

    if (args.glob) {
      const matched = this.collection.matchPaths(args.glob)
      ids = ids.filter((id: string) => matched.includes(id))
    }

    return ids
  }

  /** Read a single document with optional section filtering. */
  async readDocument(args: { id: string; include?: string[]; exclude?: string[]; meta?: boolean }) {
    return this.read(args.id, args)
  }

  /** Read multiple documents with optional section filtering. */
  async readMultipleDocuments(args: { ids: string[]; include?: string[]; exclude?: string[]; meta?: boolean }) {
    return this.readMultiple(args.ids, args)
  }

  /** Query documents by model with filters, sort, limit. */
  async queryDocuments(args: { model: string; where?: string; sort?: string; limit?: number; offset?: number; select?: string[] }) {
    if (!this.isLoaded) await this.load()

    const def = this.models[args.model]
    if (!def) return { error: `Unknown model "${args.model}". Available: ${this.modelNames.join(', ')}` }

    let q = this.collection.query(def)

    if (args.where) {
      const where: Record<string, any> = typeof args.where === 'string' ? JSON.parse(args.where) : args.where
      for (const [path, value] of Object.entries(where)) {
        q = q.where(path, value)
      }
    }
    if (args.sort) {
      const sort: Record<string, string> = typeof args.sort === 'string' ? JSON.parse(args.sort) : args.sort
      for (const [path, dir] of Object.entries(sort)) {
        q = q.sort(path, dir as 'asc' | 'desc')
      }
    }
    if (args.limit) q = q.limit(args.limit)
    if (args.offset) q = q.offset(args.offset)

    const results = await q.fetchAll()

    return results.map((inst: any) => {
      const json = inst.toJSON()
      if (args.select?.length) {
        const picked: Record<string, any> = {}
        for (const field of args.select) {
          picked[field] = this.container.utils.lodash.get(json, field)
        }
        return picked
      }
      return json
    })
  }

  /** Grep/text search across the collection. */
  async searchContent(args: { pattern: string; caseSensitive?: boolean }) {
    return this.grep({
      pattern: args.pattern,
      caseSensitive: args.caseSensitive ?? false,
    } as GrepOptions)
  }

  /** Hybrid semantic search with graceful fallback to grep. */
  async semanticSearch(args: { query: string; limit?: number }) {
    try {
      return await this.hybridSearch(args.query, { limit: args.limit ?? 10 })
    } catch {
      const grepResults = await this.grep({ pattern: args.query })
      return {
        results: grepResults,
        note: 'No search index available — fell back to text search. Run `cbase embed` to enable semantic search.',
      }
    }
  }
}

export default ContentDb
