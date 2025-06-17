import { z } from 'zod'
import { State, type SetStateValue } from './state.js'

/**
 * Enhanced State class with Zod schema validation support.
 * 
 * This class extends the existing State class to add runtime validation
 * for state updates using Zod schemas. It provides:
 * - Validation of initial state
 * - Validation of individual field updates  
 * - Validation of partial state updates
 * - Complete state validation
 * - Schema introspection
 */
export class ZodState<T extends z.ZodType> extends State<z.infer<T>> {
  constructor(
    private schema: T,
    options?: { initialState?: Partial<z.infer<T>> }
  ) {
    // Validate initial state using partial schema if it's an object schema
    let validatedInitial: any = options?.initialState || {}
    
    if (schema instanceof z.ZodObject) {
      validatedInitial = schema.partial().parse(validatedInitial)
    }
    
    super({ initialState: validatedInitial })
  }

  override set<K extends keyof z.infer<T>>(key: K, value: z.infer<T>[K]): this {
    // For object schemas, validate individual field updates
    if (this.schema instanceof z.ZodObject) {
      const fieldSchema = this.schema.shape[key]
      if (fieldSchema) {
        const validatedValue = fieldSchema.parse(value)
        return super.set(key, validatedValue)
      }
    }
    return super.set(key, value)
  }

  override setState(value: SetStateValue<z.infer<T>>): void {
    const newState = typeof value === 'function' ? value(this.current, this) : value
    
    // Validate partial state updates for object schemas
    let validatedState: any = newState
    if (this.schema instanceof z.ZodObject) {
      validatedState = this.schema.partial().parse(newState)
    }
    
    super.setState(validatedState)
  }

  /**
   * Validate the complete current state against the schema
   */
  validate(): z.infer<T> {
    return this.schema.parse(this.current)
  }

  /**
   * Get the schema for introspection
   */
  getSchema(): T {
    return this.schema
  }

  /**
   * Check if the current state is valid according to the schema
   */
  isValid(): boolean {
    try {
      this.validate()
      return true
    } catch {
      return false
    }
  }

  /**
   * Get validation errors for the current state
   */
  getValidationErrors(): z.ZodError | null {
    try {
      this.validate()
      return null
    } catch (error) {
      if (error instanceof z.ZodError) {
        return error
      }
      return null
    }
  }
} 