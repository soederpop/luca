import { Feature, features } from '../feature.js'
import { parse, Collection, extractSections, type ModelDefinition } from 'contentbase'
import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'

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

  /** Returns the lazily-initialized Collection instance for the configured rootPath. */
  get collection() {
    if (this._collection) return this._collection
    return this._collection = new Collection({ rootPath: this.options.rootPath })
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

export default features.register('contentDb', ContentDb)
