import * as yaml from 'js-yaml'
import { Feature, features } from '../feature.js'
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'
import { NodeContainer } from '../container.js'

/**
 * The YAML feature provides utilities for parsing and stringifying YAML data.
 * 
 * This feature wraps the js-yaml library to provide convenient methods for
 * converting between YAML strings and JavaScript objects. It's automatically
 * attached to Node containers for easy access.
 * 
 * @example
 * ```typescript
 * const yamlFeature = container.feature('yaml')
 * 
 * // Parse YAML string to object
 * const config = yamlFeature.parse(`
 *   name: MyApp
 *   version: 1.0.0
 *   settings:
 *     debug: true
 * `)
 * 
 * // Convert object to YAML string
 * const yamlString = yamlFeature.stringify(config)
 * console.log(yamlString)
 * ```
 * 
 * @extends Feature
 */
export class YAML extends Feature {
  static override shortcut = 'features.yaml' as const
  static override stateSchema = FeatureStateSchema
  static override optionsSchema = FeatureOptionsSchema

  /**
   * Automatically attaches the YAML feature to Node containers.
   * 
   * This static method ensures the YAML feature is automatically available
   * on Node containers without needing manual registration.
   * 
   * @param {NodeContainer} c - The Node container to attach to
   */
  static attach(c: NodeContainer) {
    c.feature('yaml', { enable: true })  
  }
  
  /**
   * Converts a JavaScript object to a YAML string.
   * 
   * This method serializes JavaScript data structures into YAML format,
   * which is human-readable and commonly used for configuration files.
   * 
   * @param {any} data - The data to convert to YAML format
   * @returns {string} The YAML string representation of the data
   * 
   * @example
   * ```typescript
   * const config = {
   *   name: 'MyApp',
   *   version: '1.0.0',
   *   settings: {
   *     debug: true,
   *     ports: [3000, 3001]
   *   }
   * }
   * 
   * const yamlString = yaml.stringify(config)
   * console.log(yamlString)
   * // Output:
   * // name: MyApp
   * // version: 1.0.0
   * // settings:
   * //   debug: true
   * //   ports:
   * //     - 3000
   * //     - 3001
   * ```
   */
  stringify(data: any) : string {
    return yaml.dump(data)
  }

  /**
   * Parses a YAML string into a JavaScript object.
   * 
   * This method deserializes YAML content into JavaScript data structures.
   * It supports all standard YAML features including nested objects, arrays,
   * and various data types.
   * 
   * @template T - The expected type of the parsed object
   * @param {string} yamlStr - The YAML string to parse
   * @returns {T} The parsed JavaScript object
   * @throws {Error} Throws an error if the YAML string is malformed
   * 
   * @example
   * ```typescript
   * const yamlContent = `
   *   name: MyApp
   *   version: 1.0.0
   *   settings:
   *     debug: true
   *     ports:
   *       - 3000
   *       - 3001
   * `
   * 
   * // Parse with type inference
   * const config = yaml.parse(yamlContent)
   * console.log(config.name) // 'MyApp'
   * 
   * // Parse with explicit typing
   * interface AppConfig {
   *   name: string
   *   version: string
   *   settings: {
   *     debug: boolean
   *     ports: number[]
   *   }
   * }
   * 
   * const typedConfig = yaml.parse<AppConfig>(yamlContent)
   * console.log(typedConfig.settings.ports) // [3000, 3001]
   * ```
   */
  parse<T extends object = any>(yamlStr: string) : T {
    return yaml.load(yamlStr) as T
  }
}

export default features.register('yaml', YAML)