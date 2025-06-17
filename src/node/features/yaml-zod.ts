import * as yaml from 'js-yaml'
import { z } from 'zod'
import { ZodHelper } from '../../zod-helper.js'
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'
import type { ContainerContext } from '../../container.js'
import { features } from '../feature.js'
import { NodeContainer } from '../container.js'

/**
 * Schema for YAML feature state
 */
export const YAMLStateSchema = FeatureStateSchema.extend({
  lastParsed: z.any().optional(),
  lastStringified: z.string().optional(),
  parseCount: z.number().default(0),
  stringifyCount: z.number().default(0),
}).describe('YAML feature state with parsing history and counters')

/**
 * Schema for YAML feature options
 */
export const YAMLOptionsSchema = FeatureOptionsSchema.extend({
  safeLoad: z.boolean().default(true).describe('Use safe YAML loading to prevent code execution'),
  schema: z.enum(['DEFAULT_SAFE_SCHEMA', 'DEFAULT_FULL_SCHEMA', 'FAILSAFE_SCHEMA', 'JSON_SCHEMA']).optional(),
}).describe('YAML feature options for parsing behavior')

/**
 * Zod-based YAML feature with runtime validation.
 * 
 * This feature provides utilities for parsing and stringifying YAML data
 * with enhanced runtime validation and state tracking.
 */
export class ZodYAML extends ZodHelper<typeof YAMLStateSchema, typeof YAMLOptionsSchema> {
  static override shortcut = 'features.yaml' as const

  get stateSchema() {
    return YAMLStateSchema
  }

  get optionsSchema() {
    return YAMLOptionsSchema
  }

  override get defaultState() {
    return {
      ...super.defaultState,
      enabled: false,
      parseCount: 0,
      stringifyCount: 0,
    }
  }

  constructor(options: unknown, context: ContainerContext) {
    super(options, context, YAMLStateSchema, YAMLOptionsSchema)
  }

  /**
   * Automatically attaches the YAML feature to Node containers.
   */
  static attach(c: NodeContainer) {
    c.feature('yaml', { enable: true })
  }

  /**
   * Get the shortcut identifier for this feature
   */
  get shortcut() {
    return ZodYAML.shortcut
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
   * Converts a JavaScript object to a YAML string.
   * 
   * This method serializes JavaScript data structures into YAML format
   * with validation and state tracking.
   * 
   * @param {any} data - The data to convert to YAML format
   * @returns {string} The YAML string representation of the data
   */
  stringify(data: any): string {
    if (!this.isEnabled) {
      throw new Error('YAML feature must be enabled before use')
    }

    const result = yaml.dump(data)
    
    // Update state with validation
    this.state.set('lastStringified', result)
    this.state.set('stringifyCount', this.state.get('stringifyCount') + 1)
    
    this.emit('stringify', { data, result, count: this.state.get('stringifyCount') })
    
    return result
  }

  /**
   * Parses a YAML string into a JavaScript object with Zod validation.
   * 
   * @template T - Zod schema type for validation
   * @param {string} yamlStr - The YAML string to parse
   * @param {T} [schema] - Optional Zod schema to validate the result
   * @returns {z.infer<T> | any} The parsed and optionally validated object
   */
  parse<T extends z.ZodType = z.ZodAny>(yamlStr: string, schema?: T): T extends z.ZodType ? z.infer<T> : any {
    if (!this.isEnabled) {
      throw new Error('YAML feature must be enabled before use')
    }

    // Input validation
    if (typeof yamlStr !== 'string') {
      throw new Error('YAML input must be a string')
    }

    const options = this.options
    const loadOptions: any = {}
    
    if (options.schema) {
      loadOptions.schema = (yaml as any)[options.schema]
    }

    const result = options.safeLoad 
      ? yaml.safeLoad(yamlStr, loadOptions)
      : yaml.load(yamlStr, loadOptions)

    // Validate with provided schema if given
    const validatedResult = schema ? schema.parse(result) : result

    // Update state with validation
    this.state.set('lastParsed', validatedResult)
    this.state.set('parseCount', this.state.get('parseCount') + 1)
    
    this.emit('parse', { yamlStr, result: validatedResult, count: this.state.get('parseCount') })
    
    return validatedResult
  }

  /**
   * Parse with explicit type validation
   */
  parseWithSchema<T extends z.ZodType>(yamlStr: string, schema: T): z.infer<T> {
    return this.parse(yamlStr, schema)
  }

  /**
   * Get parsing statistics
   */
  getStats() {
    return {
      parseCount: this.state.get('parseCount'),
      stringifyCount: this.state.get('stringifyCount'),
      lastParsed: this.state.get('lastParsed'),
      lastStringified: this.state.get('lastStringified'),
    }
  }

  /**
   * Reset statistics
   */
  resetStats() {
    this.state.setState({
      parseCount: 0,
      stringifyCount: 0,
      lastParsed: undefined,
      lastStringified: undefined,
    })
    this.emit('statsReset')
  }

  /**
   * Enhanced introspection for YAML feature
   */
  override introspect() {
    return {
      ...super.introspect(),
      type: 'feature',
      shortcut: this.shortcut,
      isEnabled: this.isEnabled,
      stats: this.getStats(),
    }
  }
}

export default features.register('yaml', ZodYAML) 