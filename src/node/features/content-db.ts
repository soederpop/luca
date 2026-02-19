import { Feature, features } from '../feature.js'
import { parse, Collection, type ModelDefinition } from 'contentbase'
import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'

export const ContentDbStateSchema = FeatureStateSchema.extend({
  loaded: z.boolean().default(false),
})

export const ContentDbOptionsSchema = FeatureOptionsSchema.extend({
  rootPath: z.string(),
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
 */
export class ContentDb extends Feature<ContentDbState, ContentDbOptions> {
  static override shortcut = 'features.contentDb' as const

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

  /** Returns an object mapping model names to their model definitions, sourced from the collection. */
  get models(): Record<string, ModelDefinition> {
    const entries = this.collection.modelDefinitions.map((d) => [d.name, d] as const)
    return Object.fromEntries(entries)
  }

  /** Returns an array of all registered model names from the collection. */
  get modelNames(): string[] {
    return this.collection.modelDefinitions.map((d) => d.name)
  }

  /** Parse a markdown file at the given path without loading the full collection. */
  parseMarkdownAtPath(path: string) {
    return parse(path)
  }

  /** Load the collection, discovering models from models.ts and parsing all documents. */
  async load(): Promise<ContentDb> {
    if (this.isLoaded) {
      return this;
    }

    await this.collection.load()
    this.state.set('loaded', true)

    return this
  }
}

export default features.register('contentDb', ContentDb)
