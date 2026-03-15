import { Feature } from '../feature.js'
import * as contentbaseExports from 'contentbase'
import { parse, Collection, extractSections, type ModelDefinition } from 'contentbase'
import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'
import { join, dirname } from 'node:path'
import { existsSync, readdirSync } from 'node:fs'

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
  static { Feature.register(this, 'contentDb') }

  override get initialState(): ContentDbState {
    return {
      ...super.initialState,
      loaded: false
    }
  }

  /** Whether the content database has been loaded. */
  get isLoaded() {
    return this.state.get('loaded')
  }

  _collection?: Collection
  private _contentbaseSeeded = false

  /** Returns the lazily-initialized Collection instance for the configured rootPath. */
  get collection() {
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
    return existsSync(join(cwd, 'node_modules', 'contentbase'))
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
  get collectionPath() {
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
    this.state.set('loaded', true)

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

  // ── Search Integration ─────────────────────────────────────────────

  private _semanticSearch: any = null

  /**
   * Lazily initialize the semanticSearch feature, attaching it to the container if needed.
   * The dbPath defaults to `.contentbase/search.sqlite` relative to the collection root.
   */
  private async _getSemanticSearch(options?: { dbPath?: string; embeddingProvider?: string; embeddingModel?: string }) {
    if (this._semanticSearch?.state?.get('dbReady')) return this._semanticSearch

    // Dynamically import and attach SemanticSearch if not already registered
    const { SemanticSearch } = await import('./semantic-search.js')
    if (!this.container.features.available.includes('semanticSearch')) {
      SemanticSearch.attach(this.container as any)
    }

    // Put .contentbase at project root (dirname of docs/), not inside the docs folder
    const projectRoot = dirname(this.collectionPath)
    const dbPath = options?.dbPath ?? join(projectRoot, '.contentbase/search.sqlite')
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
    const dbDir = join(dirname(this.collectionPath), '.contentbase')
    if (!existsSync(dbDir)) return false
    try {
      const files = readdirSync(dbDir) as string[]
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
  get searchIndexStatus() {
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
      const queryChain = this.query(this.models[modelName])
      const pluralized = this.container.utils.stringUtils.pluralize(modelName).toLowerCase()
      queryChains.push([modelName.toLowerCase(), queryChain])
      queryChains.push([pluralized, queryChain])
    }
    return Object.fromEntries(queryChains)
  }
}

export default ContentDb