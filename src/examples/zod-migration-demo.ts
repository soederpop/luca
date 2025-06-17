/**
 * Zod Migration Demo
 * 
 * This file demonstrates the key concepts of the Zod migration plan
 * without getting caught up in complex type system issues.
 * 
 * It shows:
 * 1. How schemas provide runtime validation
 * 2. Enhanced introspection capabilities  
 * 3. Better error messages
 * 4. Type safety improvements
 */

import { z } from 'zod'
import { ZodState } from '../zod-state.js'

// 1. Define schemas for a simple feature
const SimpleFeatureStateSchema = z.object({
  enabled: z.boolean().default(false),
  count: z.number().default(0),
  lastAction: z.string().optional(),
}).describe('Simple feature state for demonstration')

const SimpleFeatureOptionsSchema = z.object({
  name: z.string().optional(),
  maxCount: z.number().positive().default(100),
  autoEnable: z.boolean().default(false),
}).describe('Simple feature options for demonstration')

// 2. Create a simple class that uses Zod validation
class SimpleZodFeature {
  private state: ZodState<typeof SimpleFeatureStateSchema>
  private options: z.infer<typeof SimpleFeatureOptionsSchema>

  constructor(options: unknown) {
    // Runtime validation of options
    this.options = SimpleFeatureOptionsSchema.parse(options)
    
    // Create validated state
    this.state = new ZodState(SimpleFeatureStateSchema, {
      initialState: {
        enabled: this.options.autoEnable,
        count: 0
      }
    })
  }

  // Methods that benefit from validation
  increment(amount: number = 1) {
    const currentCount = this.state.get('count') || 0
    const newCount = currentCount + amount
    
    if (newCount > this.options.maxCount) {
      throw new Error(`Count ${newCount} exceeds maximum ${this.options.maxCount}`)
    }
    
    this.state.set('count', newCount)
    this.state.set('lastAction', `incremented by ${amount}`)
  }

  enable() {
    this.state.set('enabled', true)
    this.state.set('lastAction', 'enabled')
  }

  disable() {
    this.state.set('enabled', false)  
    this.state.set('lastAction', 'disabled')
  }

  // Enhanced introspection
  introspect() {
    return {
      schemas: {
        state: SimpleFeatureStateSchema,
        options: SimpleFeatureOptionsSchema,
      },
      currentState: this.state.current,
      isValid: this.state.isValid(),
      validationErrors: this.state.getValidationErrors(),
      documentation: {
        state: SimpleFeatureStateSchema.description,
        options: SimpleFeatureOptionsSchema.description,
      }
    }
  }

  getState() {
    return this.state.current
  }

  getOptions() {
    return this.options
  }
}

// 3. Demonstration function
export function demonstrateZodMigration() {
  console.log('=== Zod Migration Demo ===\n')

  // Valid options
  console.log('1. Creating feature with valid options:')
  const feature1 = new SimpleZodFeature({
    name: 'demo-feature',
    maxCount: 50,
    autoEnable: true
  })
  console.log('✅ Success! State:', feature1.getState())
  console.log()

  // Invalid options (will throw)
  console.log('2. Attempting to create feature with invalid options:')
  try {
    const feature2 = new SimpleZodFeature({
      name: 123, // Invalid: should be string
      maxCount: -5, // Invalid: should be positive
    })
  } catch (error) {
    console.log('❌ Validation error:', (error as Error).message)
  }
  console.log()

  // State validation
  console.log('3. Demonstrating state validation:')
  feature1.increment(10)
  console.log('After increment:', feature1.getState())
  
  try {
    feature1.increment(50) // This will exceed maxCount
  } catch (error) {
    console.log('❌ Business logic error:', (error as Error).message)
  }
  console.log()

  // Introspection
  console.log('4. Enhanced introspection:')
  const introspection = feature1.introspect()
  console.log('State schema description:', introspection.documentation.state)
  console.log('Options schema description:', introspection.documentation.options)
  console.log('Current validation status:', introspection.isValid)
  console.log()

  // Schema-based documentation generation
  console.log('5. Schema-based documentation:')
  console.log('State schema:')
  console.log(JSON.stringify(introspection.schemas.state.shape, null, 2))
  console.log()

  return {
    feature: feature1,
    introspection,
    success: true
  }
}

// 4. Example of how this enhances the existing Feature pattern
export function createConfigValidationExample() {
  // Schema for application configuration
  const AppConfigSchema = z.object({
    api: z.object({
      baseUrl: z.string().url(),
      timeout: z.number().positive().default(5000),
      retries: z.number().nonnegative().default(3),
    }),
    database: z.object({
      host: z.string(),
      port: z.number().positive().default(5432),
      name: z.string(),
      ssl: z.boolean().default(true),
    }),
    features: z.object({
      enableLogging: z.boolean().default(true),
      enableMetrics: z.boolean().default(false),
      maxUsers: z.number().positive().default(1000),
    }).optional(),
  }).describe('Application configuration with API, database, and feature settings')

  // Function that validates config at runtime
  function validateConfig(config: unknown) {
    try {
      const validatedConfig = AppConfigSchema.parse(config)
      console.log('✅ Configuration is valid!')
      return { valid: true, config: validatedConfig, errors: null }
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.log('❌ Configuration validation failed:')
        error.errors.forEach(err => {
          console.log(`  - ${err.path.join('.')}: ${err.message}`)
        })
        return { valid: false, config: null, errors: error.errors }
      }
      throw error
    }
  }

  // Example usage
  const validConfig = {
    api: {
      baseUrl: 'https://api.example.com',
      timeout: 3000,
    },
    database: {
      host: 'localhost',
      name: 'myapp',
    }
  }

  const invalidConfig = {
    api: {
      baseUrl: 'not-a-url', // Invalid URL
      timeout: -1000, // Negative timeout
    },
    database: {
      port: 'not-a-number', // Should be number
    }
    // Missing required 'name' field
  }

  console.log('\n=== Configuration Validation Example ===\n')
  
  console.log('Testing valid config:')
  const result1 = validateConfig(validConfig)
  
  console.log('\nTesting invalid config:')
  const result2 = validateConfig(invalidConfig)

  return { AppConfigSchema, validateConfig, results: [result1, result2] }
}

// Export the demo function
export default demonstrateZodMigration 