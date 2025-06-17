import { z } from 'zod'
import { ZodHelper } from './zod-helper.js'
import { FeatureStateSchema, FeatureOptionsSchema } from './schemas/base.js'
import type { ContainerContext } from './container.js'

/**
 * Zod-based Feature class with runtime validation.
 * 
 * Features are pluggable functionality modules that can be enabled/disabled.
 * This class provides the same functionality as the original Feature class
 * but adds runtime validation of options and state using Zod schemas.
 */
export abstract class ZodFeature<
  StateSchema extends z.ZodType = typeof FeatureStateSchema,
  OptionsSchema extends z.ZodType = typeof FeatureOptionsSchema
> extends ZodHelper<StateSchema, OptionsSchema> {
  
  // Default schemas for features
  get stateSchema(): StateSchema {
    return FeatureStateSchema as unknown as StateSchema
  }

  get optionsSchema(): OptionsSchema {
    return FeatureOptionsSchema as unknown as OptionsSchema
  }

  override get defaultState() {
    return {
      ...super.defaultState,
      enabled: false,
    }
  }

  constructor(options: unknown, context: ContainerContext) {
    super(options, context, FeatureStateSchema as unknown as StateSchema, FeatureOptionsSchema as unknown as OptionsSchema)

    if (typeof context.container !== 'object') {
      console.error(this, options, context)
      throw new Error('You should not instantiate a feature directly. Use container.feature() instead.')
    }

    const parsedOptions = this.optionsSchema.parse(options)
    if ((parsedOptions as any)?.enable) {
      this.enable()
    }
  }

  /**
   * Get the shortcut identifier for this feature
   */
  get shortcut() {
    return (this.constructor as any).shortcut as string
  }

  /**
   * Check if the feature is enabled
   */
  get isEnabled() {
    return this.state.get('enabled')
  }

  /**
   * For features where there only needs to be a single instance, you
   * can use this method to attach the feature to the container.
   */
  protected attachToContainer() {
    Object.defineProperty(this.container, this.shortcut, {
      get: () => this
    })
  }

  /**
   * Enable the feature with optional configuration
   */
  async enable(options: any = {}): Promise<this> {
    this.attachToContainer()
    this.emit('enabled')
    this.state.set('enabled', true)

    this.container.emit('featureEnabled', this.shortcut, this)

    return this
  }

  /**
   * Disable the feature
   */
  async disable(): Promise<this> {
    this.emit('disabled')
    this.state.set('enabled', false)

    this.container.emit('featureDisabled', this.shortcut, this)

    return this
  }

  /**
   * Toggle the feature enabled state
   */
  async toggle(): Promise<this> {
    return this.isEnabled ? this.disable() : this.enable()
  }

  /**
   * Enhanced introspection for features
   */
  override introspect() {
    return {
      ...super.introspect(),
      type: 'feature',
      shortcut: this.shortcut,
      isEnabled: this.isEnabled,
    }
  }
} 