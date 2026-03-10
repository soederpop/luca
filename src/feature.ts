import { Helper } from './helper.js';
import { Registry } from './registry.js'
import type { ContainerContext } from './container.js'
import { kebabCase, camelCase } from 'lodash-es'
import type { YAML } from './node/features/yaml.js';
import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from './schemas/base.js'

/**
 * Use module augmentation to register features, the same way you would register
 * them at runtime.  This will help developers get autocomplete etc.
*/
export interface AvailableFeatures {
    yaml: typeof YAML
}

export type FeatureOptions = z.infer<typeof FeatureOptionsSchema>
export type FeatureState = z.infer<typeof FeatureStateSchema>

export abstract class Feature<T extends FeatureState = FeatureState, K extends FeatureOptions = FeatureOptions> extends Helper<T, K> {
    static override stateSchema = FeatureStateSchema
    static override optionsSchema = FeatureOptionsSchema
    static override eventsSchema = FeatureEventsSchema

    /** Self-register a Feature subclass from a static initialization block. */
    static register: (SubClass: typeof Feature, id?: string) => typeof Feature

    get shortcut() {
        return (this.constructor as any).shortcut as string
    }

    get isEnabled() {
        return this.state.get('enabled')
    }    
   
    constructor(options: K, context: ContainerContext) {
        super(options, context)

        if(typeof context.container !== 'object') {
            console.error(this, options, context)
            throw new Error('You should not instantiate a feature directly. Use container.feature() instead.')
        }


        if(options?.enable) {
          this.enable()
        }
    }

    /** 
     * For features where there only needs to be a single instance, you
     * can use this method to attach the feature to the container.
    */
    protected attachToContainer() {
        Object.defineProperty(this.container, this.shortcut.split('.').pop()!, {
            get: () => this,
            configurable: true,
            enumerable: true,
        })        
    }

    async enable(options: any = {}) : Promise<this> {
        this.attachToContainer()
        this.emit('enabled')
        this.state.set('enabled', true)
        
        this.container.emit('featureEnabled', this.shortcut, this)

        return this
    }
}

export class FeaturesRegistry extends Registry<Feature<any, any>> {
    override scope = "features"
    override baseClass = Feature as any
}

export const features = new FeaturesRegistry()

/**
 * Static registration method for Feature subclasses.
 * Call from a static initialization block to self-register at class definition time.
 *
 * @example
 * ```typescript
 * export default class DNS extends Feature {
 *   static { Feature.register(this, 'dns') }
 * }
 * ```
 */
Feature.register = function registerFeature(
  SubClass: typeof Feature,
  id?: string,
) {
  const registryId = id ?? SubClass.name[0]!.toLowerCase() + SubClass.name.slice(1)

  // Register in the features registry
  features.register(registryId, SubClass as any)

  // Auto-set shortcut if not explicitly overridden on this class
  if (!Object.getOwnPropertyDescriptor(SubClass, 'shortcut')?.value) {
    ;(SubClass as any).shortcut = `features.${registryId}` as const
  }

  // Generate default attach() if not explicitly overridden on this class
  if (!Object.getOwnPropertyDescriptor(SubClass, 'attach')) {
    ;(SubClass as any).attach = (container: any) => {
      features.register(registryId, SubClass as any)
      return container
    }
  }

  return SubClass
}