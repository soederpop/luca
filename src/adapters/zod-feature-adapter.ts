import { z } from 'zod'
import { Feature } from '../feature.js'
import type { FeatureState, FeatureOptions } from '../feature.js'
import type { ContainerContext } from '../container.js'
import { ZodState } from '../zod-state.js'

/**
 * Adapter that adds Zod validation to existing Feature classes.
 * 
 * This allows gradual migration by wrapping existing features with
 * Zod validation without changing their core implementation.
 */
export abstract class ZodFeatureAdapter<
  T extends FeatureState = FeatureState,
  K extends FeatureOptions = FeatureOptions,
  StateSchema extends z.ZodType = z.ZodType,
  OptionsSchema extends z.ZodType = z.ZodType
> extends Feature<T, K> {

  // Abstract schemas that subclasses must provide
  abstract get stateSchema(): StateSchema
  abstract get optionsSchema(): OptionsSchema

  // Enhanced state with validation
  protected zodState: ZodState<StateSchema>

  constructor(options: K, context: ContainerContext) {
    // First validate options if we have a schema
    let validatedOptions: K
    try {
      validatedOptions = this.optionsSchema.parse(options) as K
    } catch (error) {
      if (error instanceof z.ZodError) {
        const formattedErrors = error.errors.map(err => 
          `${err.path.join('.')}: ${err.message}`
        ).join('; ')
        throw new Error(`Feature options validation failed: ${formattedErrors}`)
      }
      validatedOptions = options
    }

    // Call parent constructor with validated options
    super(validatedOptions, context)

    // Create enhanced state with Zod validation
    this.zodState = new ZodState(this.stateSchema, {
      initialState: this.initialState
    })

    // Sync the original state with the Zod state
    this.zodState.observe(() => {
      // Update the original state to keep everything in sync
      Object.assign(this.state.current, this.zodState.current)
    })
  }

  /**
   * Enhanced state setter with validation
   */
  override setState(newState: any) {
    // Use Zod state for validation
    this.zodState.setState(newState)
    // Also update the parent state to maintain compatibility
    return super.setState(newState)
  }

  /**
   * Get validated state
   */
  getValidatedState(): z.infer<StateSchema> {
    return this.zodState.validate()
  }

  /**
   * Check if current state is valid
   */
  isStateValid(): boolean {
    return this.zodState.isValid()
  }

  /**
   * Get state validation errors
   */
  getStateValidationErrors(): z.ZodError | null {
    return this.zodState.getValidationErrors()
  }

  /**
   * Enhanced introspection with schema information
   */
  override introspect() {
    return {
      ...super.introspect(),
      schemas: {
        state: this.stateSchema,
        options: this.optionsSchema,
      },
      validation: {
        isStateValid: this.isStateValid(),
        stateErrors: this.getStateValidationErrors(),
      },
      documentation: {
        state: this.stateSchema.description || 'No description',
        options: this.optionsSchema.description || 'No description',
      }
    }
  }

  /**
   * Validate that the feature is properly configured
   */
  validate() {
    const stateValidation = this.zodState.validate()
    const optionsValidation = this.optionsSchema.parse(this.options)
    
    return {
      state: stateValidation,
      options: optionsValidation,
      isValid: true
    }
  }
}

/**
 * Helper function to create a Zod adapter for an existing feature
 */
export function createZodAdapter<
  T extends FeatureState,
  K extends FeatureOptions,
  StateSchema extends z.ZodType,
  OptionsSchema extends z.ZodType
>(
  OriginalFeature: new (options: K, context: ContainerContext) => Feature<T, K>,
  stateSchema: StateSchema,
  optionsSchema: OptionsSchema
) {
  return class ZodAdaptedFeature extends ZodFeatureAdapter<T, K, StateSchema, OptionsSchema> {
    get stateSchema() { return stateSchema }
    get optionsSchema() { return optionsSchema }

    // Delegate to original feature implementation
    private originalFeature = new OriginalFeature(this.options, this.context)

    // Proxy methods to original implementation while maintaining validation
    constructor(options: K, context: ContainerContext) {
      super(options, context)
      
      // Copy any additional properties from original
      Object.getOwnPropertyNames(this.originalFeature).forEach(prop => {
        if (prop !== 'state' && prop !== 'options' && !(prop in this)) {
          Object.defineProperty(this, prop, {
            get: () => (this.originalFeature as any)[prop],
            enumerable: true,
            configurable: true
          })
        }
      })
    }
  }
}

/**
 * Factory function to easily wrap features with Zod validation
 */
export function withZodValidation<T extends Feature<any, any>>(
  FeatureClass: new (...args: any[]) => T,
  stateSchema: z.ZodType,
  optionsSchema: z.ZodType
) {
  return class extends (FeatureClass as any) {
    private zodState: ZodState<typeof stateSchema>

    constructor(...args: any[]) {
      // Validate options before calling super
      if (args[0]) {
        try {
          args[0] = optionsSchema.parse(args[0])
        } catch (error) {
          if (error instanceof z.ZodError) {
            throw new Error(`Options validation failed: ${error.errors.map(e => e.message).join(', ')}`)
          }
        }
      }

      super(...args)

      // Add Zod state validation
      this.zodState = new ZodState(stateSchema, {
        initialState: this.state.current
      })

      // Keep states in sync
      this.zodState.observe(() => {
        Object.assign(this.state.current, this.zodState.current)
      })
    }

    override setState(newState: any) {
      this.zodState.setState(newState)
      return super.setState(newState)
    }

    getValidationInfo() {
      return {
        isValid: this.zodState.isValid(),
        errors: this.zodState.getValidationErrors(),
        schemas: { state: stateSchema, options: optionsSchema }
      }
    }
  }
} 