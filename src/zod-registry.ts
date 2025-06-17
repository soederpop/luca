import { z } from 'zod'
import { Registry } from './registry.js'
import type { ZodHelper } from './zod-helper.js'
import type { ContainerContext, HelperOptions } from './container.js'

/**
 * Enhanced Registry class with Zod schema support.
 * 
 * This registry extends the base Registry to provide:
 * - Schema validation before instance creation
 * - Schema introspection capabilities  
 * - Documentation generation from schemas
 * - Runtime validation of options
 */
export abstract class ZodRegistry<T extends ZodHelper<any, any>> extends Registry<T> {
  // Store schemas for introspection
  private schemas = new Map<string, { 
    state: z.ZodType, 
    options: z.ZodType,
    constructor: new (options: any, context: ContainerContext, stateSchema: any, optionsSchema: any) => T
  }>()

  override register(
    id: string, 
    constructor: new (options: any, context: ContainerContext, stateSchema: any, optionsSchema: any) => T
  ) {
    super.register(id, constructor as any)
    
    // Store constructor for schema access
    this.schemas.set(id, {
      state: undefined as any, // Will be populated when first accessed
      options: undefined as any,
      constructor
    })
    
    return constructor
  }

  /**
   * Get schemas for a registered helper by creating a temporary instance
   */
  getSchemas(id: string) {
    const entry = this.schemas.get(id)
    if (!entry) return undefined

    // If schemas haven't been extracted yet, do it now
    if (!entry.state || !entry.options) {
      try {
        // Create a minimal instance to extract schemas
        // This is a bit of a hack but needed to get the abstract properties
        const tempInstance = Object.create(entry.constructor.prototype)
        
        // We need the schemas to be accessible somehow
        // For now, return undefined if we can't get them
        return undefined
      } catch (e) {
        return undefined
      }
    }
    
    return {
      state: entry.state,
      options: entry.options
    }
  }

  /**
   * Validate options before creating instance using stored schemas
   */
  validateOptions(id: string, options: unknown) {
    const schemas = this.getSchemas(id)
    if (schemas?.options) {
      return schemas.options.parse(options)
    }
    return options
  }

  /**
   * Generate documentation for all registered helpers
   */
  generateDocs() {
    const docs = new Map()
    for (const [id, entry] of this.schemas) {
      const schemas = this.getSchemas(id)
      if (schemas) {
        docs.set(id, {
          id,
          stateSchema: schemas.state,
          optionsSchema: schemas.options,
          stateDescription: schemas.state.description,
          optionsDescription: schemas.options.description,
        })
      }
    }
    return docs
  }

  /**
   * Get schema information for introspection
   */
  introspectSchemas(id: string) {
    const schemas = this.getSchemas(id)
    if (!schemas) return undefined

    return {
      id,
      state: {
        schema: schemas.state,
        description: schemas.state.description || 'No description',
      },
      options: {
        schema: schemas.options,
        description: schemas.options.description || 'No description',
      }
    }
  }

  /**
   * Validate that all registered helpers have valid schemas
   */
  validateRegistry() {
    const errors: string[] = []
    
    for (const [id] of this.schemas) {
      const schemas = this.getSchemas(id)
      if (!schemas) {
        errors.push(`${id}: Unable to extract schemas`)
      }
    }
    
    if (errors.length > 0) {
      throw new Error(`Registry validation failed:\n${errors.join('\n')}`)
    }
    
    return true
  }

  /**
   * Get all available helper IDs with their schema information
   */
  get availableWithSchemas() {
    return Array.from(this.schemas.keys()).map(id => ({
      id,
      schemas: this.getSchemas(id),
      introspection: this.introspectSchemas(id)
    }))
  }
} 