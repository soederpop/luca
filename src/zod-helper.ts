import { z } from 'zod'
import { Bus } from "./bus.js"
import uuid from 'node-uuid'
import type { ContainerContext } from './container.js'
import { ZodState } from './zod-state.js'
import { HelperStateSchema, HelperOptionsSchema } from './schemas/base.js'

/**
 * Schema-aware Helper base class using Zod for runtime validation.
 * 
 * This class provides the same functionality as the original Helper class
 * but adds runtime validation of options and state using Zod schemas.
 */
export abstract class ZodHelper<
  StateSchema extends z.ZodType = typeof HelperStateSchema,
  OptionsSchema extends z.ZodType = typeof HelperOptionsSchema
> {
  protected readonly _context: ContainerContext
  protected readonly _events = new Bus()
  protected readonly _options: z.infer<OptionsSchema>
  
  readonly state: ZodState<StateSchema>
  readonly uuid = uuid.v4()

  // Abstract schemas - must be implemented by subclasses
  abstract get stateSchema(): StateSchema
  abstract get optionsSchema(): OptionsSchema

  // Default state for subclasses to override
  get defaultState(): Partial<z.infer<StateSchema>> {
    return {}
  }

  constructor(
    options: unknown, 
    context: ContainerContext,
    stateSchema: StateSchema,
    optionsSchema: OptionsSchema
  ) {
    // Validate options at runtime
    this._options = optionsSchema.parse(options)
    this._context = context
    
    // Create validated state
    this.state = new ZodState(stateSchema, { 
      initialState: this.defaultState 
    })
    
    this.hide('_context', '_options', '_events', 'uuid')
    
    this.state.observe(() => {
      this.emit('stateChange', this.state.current)
    })
    
    this.afterInitialize()
    this.container.emit('helperInitialized', this)
  }

  /**
   * Hide properties from enumeration
   */
  protected hide(...props: string[]) {
    props.forEach(prop => {
      Object.defineProperty(this, prop, { enumerable: false })
    })
  }

  /**
   * Get the container from context
   */
  get container() {
    return this._context.container
  }

  /**
   * Get the context
   */
  get context() {
    return this._context
  }

  /**
   * Get the validated options
   */
  get options() {
    return this._options
  }

  /**
   * Get the cache key
   */
  get cacheKey() {
    return this._options._cacheKey
  }

  /**
   * Set state (delegated to state object)
   */
  setState(newState: any) {
    this.state.setState(newState)
    return this
  }

  /**
   * Hook called after initialization
   */
  protected afterInitialize() {
    // Override in subclasses
  }

  // Event system methods
  emit(event: string, ...args: any[]) {
    this._events.emit(event, ...args)
    return this
  }

  on(event: string, listener: (...args: any[]) => void) {
    this._events.on(event, listener)
    return this
  }

  off(event: string, listener: (...args: any[]) => void) {
    this._events.off(event, listener)
    return this
  }

  once(event: string, listener: (...args: any[]) => void) {
    this._events.once(event, listener)
    return this
  }

  async waitFor(event: string, timeout?: number): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeoutId = timeout ? setTimeout(() => {
        this.off(event, handler)
        reject(new Error(`Timeout waiting for event: ${event}`))
      }, timeout) : null

      const handler = (...args: any[]) => {
        if (timeoutId) clearTimeout(timeoutId)
        resolve(args.length === 1 ? args[0] : args)
      }

      this.once(event, handler)
    })
  }

  /**
   * Enhanced introspection with Zod schema information
   */
  introspect() {
    return {
      shortcut: (this.constructor as any).shortcut,
      stateSchema: this.stateSchema,
      optionsSchema: this.optionsSchema,
      documentation: this.getDocumentation(),
      state: this.state.current,
      isValid: this.state.isValid(),
      validationErrors: this.state.getValidationErrors()
    }
  }

  /**
   * Get documentation from Zod schemas
   */
  getDocumentation() {
    return {
      state: this.stateSchema.description || 'No description',
      options: this.optionsSchema.description || 'No description',
    }
  }

  /**
   * Validate current state and options
   */
  validate() {
    return {
      state: this.state.validate(),
      options: this.optionsSchema.parse(this._options)
    }
  }

  /**
   * Check if helper is in a valid state
   */
  isValid() {
    try {
      this.validate()
      return true
    } catch {
      return false
    }
  }
} 