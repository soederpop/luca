import { z } from 'zod'
import { Feature } from '../feature.js'
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'

export const MarkdownModelsStateSchema = FeatureStateSchema.extend({
  installed: z.boolean().default(false),
  models: z.array(z.string()).default([]).describe('Names of the models currently registered from the workspace model files'),
  sources: z.record(z.string(), z.string()).default({}).describe('Model name to the absolute file that defines it'),
  errors: z.array(z.object({ file: z.string(), model: z.string().nullable(), message: z.string() })).default([]),
})
export type MarkdownModelsState = z.infer<typeof MarkdownModelsStateSchema>

export const MarkdownModelsOptionsSchema = FeatureOptionsSchema.extend({})
export type MarkdownModelsOptions = z.infer<typeof MarkdownModelsOptionsSchema>

const CODE_LANGS = new Set(['ts', 'typescript', 'js', 'javascript'])
const MODELS_FILE_EXTS = ['ts', 'js', 'mjs']
const SOURCE_FILE = /\.(md|ts|js|mjs)$/
/** `<Model>.template.md` is that model's document template, not a model file. */
const TEMPLATE_FILE = /\.template\.mdx?$/i

/**
 * Ready-made section extractors, in scope as `extract` in markdown model
 * blocks. Tools that write model files use them by name, so a section's
 * kind can be read back from the definition (`extractorKind`).
 */
export function makeExtractors(toString: (node: any) => string) {
  return {
    /** Every paragraph of the section as one string. */
    text: (q: any) => q.selectAll('paragraph').map((n: any) => toString(n)).join('\n\n'),
    /** Each list item as one string. */
    list: (q: any) => q.selectAll('listItem').map((n: any) => toString(n)),
    /** The value of each code block. */
    code: (q: any) => q.selectAll('code').map((n: any) => String(n.value ?? '')),
  }
}

export type ExtractorKind = 'text' | 'list' | 'code'

/**
 * Workspace content models, next to the project's own `docs/models.ts`.
 *
 * - `docs/models.md`
 * - `docs/models/*.md`
 * - `docs/models/*.ts`
 *
 * `docs/models/<Model>.template.md` is not a model file: it is that model's
 * document template (`collection.readTemplate`), and never a document.
 *
 * In a markdown file each `## Heading` is one model. The prose under it is
 * the description. The `ts` block under it ends in a config object, the
 * same object `defineModel` takes. Blocks above the first `##` run first,
 * as shared setup.
 *
 * Blocks run in the luca VM with `z`, `section`, `hasMany`, `belongsTo`,
 * `AstQuery`, `toString`, `extract` (ready-made section extractors:
 * `extract.text`, `extract.list`, `extract.code`), `container`, and every
 * registered model in scope.
 *
 * A `docs/models/*.ts` file has every exported model definition registered,
 * the same as in `models.ts`.
 *
 * Models from `models.ts` always win a name collision. They also register
 * first, so they win a prefix overlap unless the workspace model has a
 * `match` function or the document sets `_model` in its frontmatter.
 *
 * contentDb installs this on load, so every project gets it.
 *
 * @example
 * ```typescript
 * await container.docs.load()
 * const m = container.feature('markdownModels')
 * console.log(m.state.get('models'), m.state.get('errors'))
 * ```
 */
export class MarkdownModels extends Feature<MarkdownModelsState, MarkdownModelsOptions> {
  static override shortcut = 'features.markdownModels' as const
  static override stability = 'core' as const
  static override category = 'data-storage' as const
  static override stateSchema = MarkdownModelsStateSchema
  static override optionsSchema = MarkdownModelsOptionsSchema
  static { Feature.register(this, 'markdownModels') }

  private _signature: string | null = null
  private _owned = new Set<string>()
  private _applying: Promise<void> | null = null
  private _extractors: ReturnType<typeof makeExtractors> | null = null

  /**
   * Hook the docs collection so workspace models register after every load
   * and refresh. Every caller of `docs.load()`, `docs.reload()` and
   * `collection.load({ refresh: true })` goes through `collection.load`.
   * A second install on the same collection does nothing.
   */
  async install(docs: any = (this.container as any).docs): Promise<this> {
    const collection = docs.collection
    if (collection.__markdownModels) return this
    collection.__markdownModels = true

    const load = collection.load.bind(collection)
    collection.load = async (options: { refresh?: boolean } = {}) => {
      const wasLoaded = collection.loaded
      const result = await load(options)
      if (!wasLoaded || options.refresh) await this.apply(docs)
      return result
    }

    this.state.set('installed', true)
    if (!this.state.get('models')) this.state.set('models', [])
    if (!this.state.get('sources')) this.state.set('sources', {})
    if (!this.state.get('errors')) this.state.set('errors', [])
    if (collection.loaded) await this.apply(docs)
    return this
  }

  /** The extractors in scope as `extract`. The same function objects every time. */
  extractors(docs: any = (this.container as any).docs) {
    return this._extractors ??= makeExtractors(docs.contentbase.toString)
  }

  /** Which ready-made extractor a section uses, or null for its own function. */
  extractorKind(fn: unknown, docs: any = (this.container as any).docs): ExtractorKind | null {
    const all = this.extractors(docs) as Record<string, unknown>
    for (const [kind, f] of Object.entries(all)) if (f === fn) return kind as ExtractorKind
    return null
  }

  /** Absolute paths of the workspace model files, `models.md` first. */
  sourceFiles(docs: any = (this.container as any).docs): string[] {
    const fs = this.container.feature('fs') as any
    const { paths } = this.container as any
    const root = docs.collection.rootPath
    const files: string[] = []

    const single = paths.resolve(root, 'models.md')
    if (fs.exists(single)) files.push(single)

    const dir = paths.resolve(root, 'models')
    if (fs.exists(dir)) {
      const names = (fs.readdirSync(dir) as string[]).filter((name) => SOURCE_FILE.test(name) && !name.endsWith('.d.ts') && !TEMPLATE_FILE.test(name)).sort()
      for (const name of names) files.push(paths.resolve(dir, name))
    }
    return files
  }

  /**
   * Parse the workspace model files and register what they define. Never
   * throws: a broken block is recorded in `state.errors` and the other
   * models still load.
   */
  async apply(docs: any = (this.container as any).docs): Promise<void> {
    if (this._applying) return this._applying
    this._applying = this._apply(docs).finally(() => { this._applying = null })
    return this._applying
  }

  private async _apply(docs: any): Promise<void> {
    const fs = this.container.feature('fs') as any
    const collection = docs.collection
    const files = this.sourceFiles(docs)
    if (!files.length && !this._owned.size) return

    const sources = files.map((file) => ({ file, raw: String(fs.readFileSync(file, 'utf-8')) }))
    const signature = JSON.stringify(sources)
    if (signature === this._signature) return

    // A models.ts that exists but registered nothing failed to load. contentDb
    // detects that by "only Base is registered" and raises a clear error.
    // Registering here would hide it.
    const stock = collection.modelDefinitions.filter((def: any) => def.name !== 'Base' && !this._owned.has(def.name))
    if (!stock.length && this.modelsFileExists(collection.rootPath)) return

    const errors: MarkdownModelsState['errors'] = []
    const defined = new Map<string, { def: any; file: string }>()

    for (const { file } of sources) {
      try {
        if (file.endsWith('.md')) await this.loadFile(file, docs, defined, errors)
        else this.loadModule(file, docs, defined, errors)
      } catch (error: any) {
        errors.push({ file, model: null, message: error?.message ?? String(error) })
      }
    }

    // contentbase has no unregister. A removed model keeps its name but is
    // replaced with one that matches no document.
    for (const name of this._owned) {
      if (defined.has(name)) continue
      const stub = docs.contentbase.defineModel(name, {
        match: () => false,
        description: 'Removed from the workspace models. Restart to drop it.',
      })
      // Lets readers (the workbench) leave it out of model lists.
      stub.removed = true
      collection.register(stub)
    }

    this._signature = signature
    this.state.set('models', [...defined.keys()])
    this.state.set('sources', Object.fromEntries([...defined].map(([name, v]) => [name, v.file])))
    this.state.set('errors', errors)
    for (const error of errors) {
      console.warn(`[markdown-models] ${error.file}${error.model ? ` (${error.model})` : ''}: ${error.message}`)
    }
  }

  private modelsFileExists(root: string): boolean {
    const fs = this.container.feature('fs') as any
    return MODELS_FILE_EXTS.some((ext) => fs.exists((this.container as any).paths.resolve(root, `models.${ext}`)))
  }

  /**
   * Register one model. Returns the definition, or null when the name is
   * taken by models.ts or by an earlier workspace model.
   */
  private register(def: any, file: string, docs: any, defined: Map<string, { def: any; file: string }>, errors: MarkdownModelsState['errors']): any {
    const collection = docs.collection
    if (collection.getModelDefinition(def.name) && !this._owned.has(def.name)) {
      errors.push({ file, model: def.name, message: 'A model with this name already exists in models.ts. This model was skipped.' })
      return null
    }
    if (defined.has(def.name)) {
      errors.push({ file, model: def.name, message: 'This model name is defined more than once in the workspace models.' })
      return null
    }
    collection.register(def)
    this._owned.add(def.name)
    defined.set(def.name, { def, file })
    return def
  }

  /**
   * Load a `docs/models/*.ts` file and register every model it exports. The
   * VM loader runs the file again on each call, so edits apply on refresh.
   */
  private loadModule(file: string, docs: any, defined: Map<string, { def: any; file: string }>, errors: MarkdownModelsState['errors']) {
    docs._seedContentbaseVirtualModules?.()
    const vm = this.container.feature('vm') as any
    if (!vm.modules.has('contentbase')) vm.defineModule('contentbase', docs.contentbase)
    const exports = vm.loadModule(file) ?? {}
    for (const value of Object.values(exports) as any[]) {
      // Same test contentbase applies to the exports of models.ts.
      const isModel = value && typeof value === 'object' && typeof value.name === 'string' && typeof value.prefix === 'string' && 'meta' in value
      if (isModel) this.register(value, file, docs, defined, errors)
    }
  }

  /** Run one file's blocks in order and register a model for each `##`. */
  private async loadFile(file: string, docs: any, defined: Map<string, { def: any; file: string }>, errors: MarkdownModelsState['errors']) {
    const cb = docs.contentbase
    const collection = docs.collection
    const vm = this.container.feature('vm') as any
    const transpiler = this.container.feature('transpiler') as any
    const doc = await docs.parseMarkdownAtPath(file)

    const scope: Record<string, any> = {
      console,
      container: this.container,
      z: cb.z,
      section: cb.section,
      hasMany: cb.hasMany,
      belongsTo: cb.belongsTo,
      AstQuery: cb.AstQuery,
      toString: cb.toString,
      extract: this.extractors(docs),
    }
    for (const def of collection.modelDefinitions) scope[def.name] = def
    const context = vm.createContext(scope)

    const run = async (node: any) => {
      const loader = node.lang.startsWith('t') ? 'ts' : 'js'
      const { code } = transpiler.transformSync(node.value, { loader, format: 'esm' })
      return vm.run(code, context)
    }

    let current: { name: string; description: string[]; config: any; failed: boolean } | null = null

    const finish = () => {
      const model = current
      current = null
      if (!model || model.failed) return
      if (!model.config || typeof model.config !== 'object') {
        errors.push({ file, model: model.name, message: 'No ts block under this heading ends in a config object.' })
        return
      }
      try {
        const description = model.description.join('\n\n')
        const def = cb.defineModel(model.name, { ...(description ? { description } : {}), ...model.config })
        // Later models in this file can refer to this one by name.
        if (this.register(def, file, docs, defined, errors)) context[model.name] = def
      } catch (error: any) {
        errors.push({ file, model: model.name, message: error?.message ?? String(error) })
      }
    }

    for (const node of doc.ast.children as any[]) {
      if (node.type === 'heading' && node.depth === 2) {
        finish()
        current = { name: modelName(cb.toString(node)), description: [], config: null, failed: false }
        continue
      }

      if (node.type === 'paragraph' && current && !current.config) {
        current.description.push(cb.toString(node))
        continue
      }

      if (node.type !== 'code' || !CODE_LANGS.has(node.lang ?? '')) continue

      try {
        const result = await run(node)
        if (current && result && typeof result === 'object') current.config = result
      } catch (error: any) {
        errors.push({ file, model: current?.name ?? null, message: error?.message ?? String(error) })
        if (current) current.failed = true
      }
    }
    finish()
  }
}

/** "Customer account" becomes "CustomerAccount". A plain identifier is kept as written. */
export function modelName(heading: string): string {
  const text = heading.trim()
  if (/^[A-Za-z_]\w*$/.test(text)) return text
  return text.split(/[^A-Za-z0-9]+/).filter(Boolean).map((word) => word[0]!.toUpperCase() + word.slice(1)).join('')
}

export default MarkdownModels
