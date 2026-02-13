import { Feature, features } from '../feature.js'
import { parse, Collection, defineModel, section, hasMany, belongsTo, type ModelDefinition } from 'contentbase'
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
 * Turns an organized folder of structured markdown files into an ORM like database
 * 
 * This is a wrapper around the Contentbase library essentially.
 * 
 * You can access raw document objects and query them, without having to define models or anything.
 *
 * @extends Feature
 */
export class ContentDb extends Feature<ContentDbState, ContentDbOptions> {
  static override shortcut = 'features.contentDb' as const

  /** Returns the Contentbase library utilities: Collection, defineModel, section, hasMany, belongsTo. */
  get library() {
    return {
      Collection,
      defineModel,
      section,
      hasMany,
      belongsTo
    }
  }

  override get initialState(): ContentDbState {
    return {
      ...super.initialState,
      loaded: false
    }
  }

  /**
   * TODO: describe this method.
   *
   * @returns {Promise<void>}
   */

  modelDefinitions: Map<string, ModelDefinition> = new Map()

  /** Returns an object mapping model names to their model definitions. */
  get models() {
    return Object.fromEntries(this.modelDefinitions.entries())
  }

  /** Whether the content database has been loaded. */
  get isLoaded() {
    return this.state.get('loaded')
  }

  /** Returns an array of all registered model names. */
  get modelNames() {
    return Array.from(this.modelDefinitions.keys())
  }

  _collection?: Collection

  parseMarkdownAtPath(path: string) {
    return parse(path)
  }

  /** Returns the lazily-initialized Collection instance for the configured rootPath. */
  get collection() {
    if (this._collection) return this._collection
    return this._collection = new Collection({ rootPath: this.options.rootPath })
  }

  async load(): Promise<ContentDb> {
    if (this.isLoaded) {
      return this;
    }

    await this.collection.load()
    this.state.set('loaded', true)

    return this
  }

  defineModel(definerFunction: (library: typeof this.library) => ModelDefinition) {
    const model = definerFunction(this.library)

    this.modelDefinitions.set(model.name, model)

    return model
  } 
}

export default features.register('contentDb', ContentDb)
