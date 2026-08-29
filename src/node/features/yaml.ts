import * as yaml from 'js-yaml'
import { Feature } from '../feature.js'
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'
import { NodeContainer } from '../container.js'

/**
 * The YAML feature provides utilities for parsing and stringifying YAML data.
 * 
 * This feature wraps the js-yaml library to provide convenient methods for
 * converting between YAML strings and JavaScript objects. It's automatically
 * attached to Node containers for easy access. The API is two methods:
 * `parse()` (YAML string → object) and `stringify()` (object → YAML string).
 *
 * The parser handles nested objects, arrays, numbers, and booleans
 * automatically, and nulls serialize cleanly on the way back out. A
 * parse → modify → stringify round-trip preserves data intact, which makes
 * this the standard tool for reading a config file, mutating a value, and
 * writing it back.
 *
 * @example
 * ```typescript
 * const yml = container.feature('yaml')
 *
 * // Parse YAML string to object — nested objects, arrays, numbers,
 * // and booleans are all handled automatically.
 * const config = yml.parse(`
 *   name: my-app
 *   version: 2.1.0
 *   database:
 *     host: localhost
 *     port: 5432
 *   features:
 *     - auth
 *     - logging
 * `)
 * console.log(config.database.host) // 'localhost'
 * console.log(config.features)      // ['auth', 'logging']
 *
 * // Convert an object back to a human-readable YAML string.
 * const output = yml.stringify({
 *   server: { host: '0.0.0.0', port: 3000 },
 *   cors: { origins: ['https://example.com'] },
 * })
 *
 * // Round-trip: parse → modify → stringify preserves data intact.
 * const parsed = yml.parse('replicas: 3\nmemory: 256Mi\n')
 * parsed.replicas = 5
 * const updated = yml.stringify(parsed)
 * const reparsed = yml.parse(updated)
 * console.log(reparsed.replicas) // 5 — survives the cycle
 * ```
 *
 * @extends Feature
 */
export class YAML extends Feature {
  static override shortcut = 'features.yaml' as const
  static override stability = 'core' as const
  static override category = 'ui-output' as const
  static override stateSchema = FeatureStateSchema
  static override optionsSchema = FeatureOptionsSchema
  static { Feature.register(this, 'yaml') }

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
   * Deeply nested and mixed-type structures serialize cleanly — nulls,
   * booleans, numbers, and nested arrays of objects all round-trip
   * without special handling.
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

  /**
   * Parses a YAML string and guarantees the result is an object (mapping or
   * sequence). Unlike {@link parse} — which returns `undefined` for empty
   * input, `null` for comments-only input, and bare scalars for scalar
   * documents — this method throws a descriptive error in all of those
   * cases, so a typo'd or empty config file fails here instead of as
   * `undefined is not an object` far away.
   *
   * Use this when you expect a config-shaped document; use `parse()` when
   * any YAML value (including scalars or nothing at all) is acceptable.
   *
   * @template T - The expected object type of the parsed document
   * @param {string} yamlStr - The YAML string to parse
   * @returns {T} The parsed object (a mapping or sequence)
   * @throws {Error} When the input parses to `undefined`/`null` (empty or comments-only) or to a non-object scalar, or when the YAML is malformed
   *
   * @example
   * ```typescript
   * const yml = container.feature('yaml')
   *
   * const config = yml.parseObject('host: localhost\nport: 5432\n')
   * console.log(config.host) // 'localhost'
   *
   * // Empty or comments-only input throws instead of returning undefined/null
   * try { yml.parseObject('') } catch (err) { console.log(err.message) }
   * try { yml.parseObject('# just a comment') } catch (err) { console.log(err.message) }
   *
   * // A bare scalar document throws too
   * try { yml.parseObject('just a string') } catch (err) { console.log(err.message) }
   * ```
   */
  parseObject<T extends object = any>(yamlStr: string) : T {
    const result = yaml.load(yamlStr)

    if (result === undefined || result === null) {
      throw new Error(
        `yaml.parseObject: input parsed to ${result === undefined ? 'undefined' : 'null'} — ` +
        `the YAML string is empty or contains only comments. Use parse() if that is acceptable.`
      )
    }

    if (typeof result !== 'object') {
      const preview = JSON.stringify(result)
      const shown = preview.length > 60 ? preview.slice(0, 60) + '…' : preview
      throw new Error(
        `yaml.parseObject: expected a YAML mapping or sequence, got a ${typeof result} scalar (${shown}). ` +
        `Use parse() for scalar documents.`
      )
    }

    return result as T
  }
}

export default YAML