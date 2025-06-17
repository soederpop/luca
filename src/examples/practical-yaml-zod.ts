import * as yaml from 'js-yaml'
import { z } from 'zod'
import { Feature } from '../feature.js'
import type { FeatureState, FeatureOptions } from '../feature.js'
import type { ContainerContext } from '../container.js'

/**
 * Practical example: Adding Zod validation to YAML feature
 * 
 * This demonstrates how to enhance an existing feature with Zod
 * validation without a complete rewrite.
 */

// 1. Define schemas for the YAML feature
const YAMLStateSchema = z.object({
  enabled: z.boolean().default(false),
  parseCount: z.number().default(0),
  stringifyCount: z.number().default(0),
  lastError: z.string().optional(),
}).describe('YAML feature state with usage tracking')

const YAMLOptionsSchema = z.object({
  name: z.string().optional(),
  _cacheKey: z.string().optional(),
  cached: z.boolean().optional(),
  enable: z.boolean().optional(),
  safeLoad: z.boolean().default(true),
  indent: z.number().positive().default(2),
}).describe('YAML feature configuration options')

// 2. Enhanced YAML feature with Zod validation
export class EnhancedYAML extends Feature {
  static override shortcut = 'features.yaml' as const

  // Schema validation methods
  validateOptions(options: unknown) {
    return YAMLOptionsSchema.parse(options)
  }

  validateState(state: unknown) {
    return YAMLStateSchema.parse(state)
  }

  // Enhanced constructor with validation
  constructor(options: any, context: ContainerContext) {
    // Validate options before calling super
    const validatedOptions = YAMLOptionsSchema.safeParse(options)
    
    if (!validatedOptions.success) {
      console.warn('YAML feature options validation failed:', validatedOptions.error.errors)
      // Continue with original options for backwards compatibility
    }

    super(validatedOptions.success ? validatedOptions.data : options, context)

    // Initialize validated state
    const initialState = YAMLStateSchema.parse({
      enabled: false,
      parseCount: 0,
      stringifyCount: 0
    })

    this.state.setState(initialState)
  }

  // Enhanced methods with validation and tracking
  stringify(data: any, options?: { indent?: number }): string {
    if (!this.state.get('enabled')) {
      throw new Error('YAML feature must be enabled before use')
    }

    try {
      const indent = options?.indent || this.validateOptions(this.options).indent
      const result = yaml.dump(data, { indent })
      
      // Update state with validation
      const currentCount = this.state.get('stringifyCount') || 0
      this.state.set('stringifyCount', currentCount + 1)
      this.state.set('lastError', undefined)
      
      this.emit('stringify', { data, result, count: currentCount + 1 })
      
      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.state.set('lastError', errorMessage)
      this.emit('error', { operation: 'stringify', error: errorMessage })
      throw error
    }
  }

  parse<T = any>(yamlStr: string): T {
    if (!this.state.get('enabled')) {
      throw new Error('YAML feature must be enabled before use')
    }

    // Input validation
    if (typeof yamlStr !== 'string') {
      throw new Error('YAML input must be a string')
    }

    try {
      const options = this.validateOptions(this.options)
      const result = options.safeLoad ? yaml.safeLoad(yamlStr) : yaml.load(yamlStr)
      
      // Update state with validation
      const currentCount = this.state.get('parseCount') || 0
      this.state.set('parseCount', currentCount + 1)
      this.state.set('lastError', undefined)
      
      this.emit('parse', { yamlStr, result, count: currentCount + 1 })
      
      return result as T
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      this.state.set('lastError', errorMessage)
      this.emit('error', { operation: 'parse', error: errorMessage })
      throw error
    }
  }

  // Parse with schema validation
  parseWithSchema<T extends z.ZodType>(yamlStr: string, schema: T): z.infer<T> {
    const parsed = this.parse(yamlStr)
    return schema.parse(parsed)
  }

  // Get usage statistics
  getStats() {
    const state = this.validateState(this.state.current)
    return {
      parseCount: state.parseCount,
      stringifyCount: state.stringifyCount,
      lastError: state.lastError,
      isEnabled: state.enabled,
    }
  }

  // Enhanced introspection
  override introspect() {
    const baseIntrospection = super.introspect()
    
    return {
      ...baseIntrospection,
      schemas: {
        state: YAMLStateSchema,
        options: YAMLOptionsSchema,
      },
      documentation: {
        state: YAMLStateSchema.description,
        options: YAMLOptionsSchema.description,
      },
      stats: this.getStats(),
      validation: {
        stateValid: YAMLStateSchema.safeParse(this.state.current).success,
        optionsValid: YAMLOptionsSchema.safeParse(this.options).success,
      }
    }
  }

  // Validate current state
  validateCurrentState() {
    const result = YAMLStateSchema.safeParse(this.state.current)
    if (!result.success) {
      throw new Error(`State validation failed: ${result.error.errors.map(e => e.message).join(', ')}`)
    }
    return result.data
  }
}

// 3. Example usage and benefits demonstration
export function demonstratePracticalYAML() {
  console.log('=== Practical YAML with Zod Demo ===\n')

  // Create feature with valid options
  const yaml1 = new EnhancedYAML({ safeLoad: true, indent: 4, enable: true }, { container: {} as any })
  
  console.log('1. Feature created with validation')
  console.log('Initial stats:', yaml1.getStats())
  console.log()

  // Test parsing with validation
  const testYaml = `
name: MyApp
version: 1.0.0
settings:
  debug: true
  ports: [3000, 3001]
`

  console.log('2. Parsing YAML with tracking:')
  const config = yaml1.parse(testYaml)
  console.log('Parsed config:', config)
  console.log('Stats after parse:', yaml1.getStats())
  console.log()

  // Test schema-validated parsing
  console.log('3. Schema-validated parsing:')
  const AppConfigSchema = z.object({
    name: z.string(),
    version: z.string(),
    settings: z.object({
      debug: z.boolean(),
      ports: z.array(z.number())
    })
  })

  try {
    const validatedConfig = yaml1.parseWithSchema(testYaml, AppConfigSchema)
    console.log('✅ Config validation passed:', validatedConfig.name)
  } catch (error) {
    console.log('❌ Config validation failed:', (error as Error).message)
  }
  console.log()

  // Test stringification
  console.log('4. Stringifying with validation:')
  const yamlOutput = yaml1.stringify(config)
  console.log('YAML output length:', yamlOutput.length)
  console.log('Stats after stringify:', yaml1.getStats())
  console.log()

  // Enhanced introspection
  console.log('5. Enhanced introspection:')
  const introspection = yaml1.introspect()
  console.log('State schema description:', introspection.documentation?.state)
  console.log('Options schema description:', introspection.documentation?.options)
  console.log('Current validation status:', introspection.validation)
  console.log()

  return { yaml: yaml1, config, introspection }
}

// 4. Benefits summary
export function listBenefits() {
  return [
    '✓ Runtime validation of options and state',
    '✓ Better error messages with detailed validation info',
    '✓ Automatic type inference from schemas',
    '✓ Schema-based documentation generation',
    '✓ Usage tracking and statistics',
    '✓ Backwards compatibility with existing code',
    '✓ Enhanced introspection capabilities',
    '✓ Parse-time validation with custom schemas',
    '✓ State integrity checking',
    '✓ Automatic default value handling'
  ]
}

export default { EnhancedYAML, demonstratePracticalYAML, listBenefits } 