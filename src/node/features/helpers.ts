import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from '../../schemas/base.js'
import { Feature, features } from '../feature.js'
import { Feature as UniversalFeature } from '../../feature.js'
import { Client, clients } from '../../client.js'
import { Server, servers } from '../../server.js'
import { commands } from '../../command.js'
import { endpoints } from '../../endpoint.js'
import type { Registry } from '../../registry.js'
import type { FileManager } from './file-manager.js'
import { resolve, parse } from 'path'

export const HelpersStateSchema = FeatureStateSchema.extend({
  discovered: z.record(z.string(), z.boolean()).default({}).describe('Which registry types have been discovered'),
  registered: z.array(z.string()).default([]).describe('Names of project-level helpers that were discovered (type.name)'),
})

export type HelpersState = z.infer<typeof HelpersStateSchema>

export const HelpersOptionsSchema = FeatureOptionsSchema.extend({
  rootDir: z.string().optional().describe('Root directory to scan for helper folders. Defaults to container.cwd'),
})

export type HelpersOptions = z.infer<typeof HelpersOptionsSchema>

export const HelpersEventsSchema = FeatureEventsSchema.extend({
  discovered: z.tuple([
    z.string().describe('Registry type that was discovered'),
    z.array(z.string()).describe('Names of newly registered helpers'),
  ]).describe('Emitted after a registry type has been discovered'),
  registered: z.tuple([
    z.string().describe('Registry type'),
    z.string().describe('Helper name'),
    z.any().describe('The helper class or module'),
  ]).describe('Emitted when a single helper is registered'),
})

type RegistryType = 'features' | 'clients' | 'servers' | 'commands' | 'endpoints'

const CLASS_BASED: RegistryType[] = ['features', 'clients', 'servers']

/**
 * The Helpers feature is a unified gateway for discovering and registering
 * project-level helpers from conventional folder locations.
 *
 * It scans known folder names (features/, clients/, servers/, commands/, endpoints/)
 * and handles registration differently based on the helper type:
 *
 * - Class-based (features, clients, servers): Dynamic import, validate subclass, register
 * - Config-based (commands, endpoints): Delegate to existing discovery mechanisms
 *
 * @example
 * ```typescript
 * const helpers = container.feature('helpers', { enable: true })
 *
 * // Discover all helper types
 * await helpers.discoverAll()
 *
 * // Discover a specific type
 * await helpers.discover('features')
 *
 * // Unified view of all available helpers
 * console.log(helpers.available)
 * ```
 */
export class Helpers extends Feature<HelpersState, HelpersOptions> {
  static override shortcut = 'features.helpers' as const
  static override description = 'Unified gateway for discovering and registering project-level helpers'
  static override stateSchema = HelpersStateSchema
  static override optionsSchema = HelpersOptionsSchema
  static override eventsSchema = HelpersEventsSchema

  /**
   * Returns a mapping from registry type name to its registry singleton, base class, and conventional folder candidates.
   */
  private get registryMap(): Record<RegistryType, { registry: Registry<any>, baseClass: any, folders: string[] }> {
    return {
      features: { registry: this.container.features as any, baseClass: UniversalFeature, folders: ['features'] },
      clients: { registry: clients, baseClass: Client, folders: ['clients'] },
      servers: { registry: servers, baseClass: Server, folders: ['servers'] },
      commands: { registry: commands, baseClass: null, folders: ['commands'] },
      endpoints: { registry: endpoints, baseClass: null, folders: ['endpoints'] },
    }
  }

  /** The root directory to scan for helper folders. */
  get rootDir(): string {
    return this.options.rootDir || this.container.cwd
  }

  /**
   * Returns a unified view of all available helpers across all registries.
   * Each key is a registry type, each value is the list of helper names in that registry.
   *
   * @example
   * ```typescript
   * container.helpers.available
   * // { features: ['fs', 'git', ...], clients: ['rest', 'websocket'], ... }
   * ```
   */
  get available(): Record<string, string[]> {
    const result: Record<string, string[]> = {}
    for (const [type, { registry }] of Object.entries(this.registryMap)) {
      result[type] = registry.available
    }
    return result
  }

  /**
   * Ensures the fileManager feature is started before using it for discovery.
   *
   * @returns The started fileManager instance
   */
  private async ensureFileManager(): Promise<FileManager> {
    const fm = this.container.feature('fileManager', { enable: true }) as unknown as FileManager
    if (!fm.isStarted) {
      await fm.start()
    }
    return fm
  }

  /**
   * Resolves which conventional folder path exists for a given registry type.
   * Tries each candidate folder in order and returns the first one that exists.
   *
   * @param type - The registry type to resolve the folder for
   * @returns Absolute path to the folder, or null if none exist
   */
  private resolveFolderPath(type: RegistryType): string | null {
    const { folders } = this.registryMap[type]
    const { fs } = this.container

    for (const candidate of folders) {
      const dir = resolve(this.rootDir, candidate)
      if (fs.exists(dir)) {
        return dir
      }
    }

    return null
  }

  /**
   * Discover and register project-level helpers of the given type.
   *
   * For class-based types (features, clients, servers), scans the matching
   * directory for .ts files, dynamically imports each, validates the default
   * export is a subclass of the registry's base class, and registers it.
   *
   * For config-based types (commands, endpoints), delegates to existing discovery mechanisms.
   *
   * @param type - Which type of helpers to discover
   * @param options - Optional overrides
   * @param options.directory - Override the directory to scan
   * @returns Names of helpers that were discovered and registered
   *
   * @example
   * ```typescript
   * const names = await container.helpers.discover('features')
   * console.log(names) // ['myCustomFeature']
   * ```
   */
  async discover(type: RegistryType, options: { directory?: string } = {}): Promise<string[]> {
    const discovered = this.state.get('discovered') || {}

    if (discovered[type]) {
      return []
    }

    const dir = options.directory || this.resolveFolderPath(type)

    if (!dir) {
      this.state.set('discovered', { ...discovered, [type]: true })
      return []
    }

    let names: string[]

    if (CLASS_BASED.includes(type)) {
      names = await this.discoverClassBased(type, dir)
    } else {
      names = await this.discoverConfigBased(type, dir)
    }

    this.state.set('discovered', { ...this.state.get('discovered'), [type]: true })

    const existing = this.state.get('registered') || []
    this.state.set('registered', [...existing, ...names.map(n => `${type}.${n}`)])

    this.emit('discovered' as any, type, names)

    return names
  }

  /**
   * Discover all helper types from their conventional folder locations.
   *
   * @returns Map of registry type to discovered helper names
   *
   * @example
   * ```typescript
   * const results = await container.helpers.discoverAll()
   * // { features: ['myFeature'], clients: [], servers: [], commands: ['deploy'], endpoints: [] }
   * ```
   */
  async discoverAll(): Promise<Record<string, string[]>> {
    const results: Record<string, string[]> = {}

    for (const type of ['features', 'clients', 'servers', 'commands', 'endpoints'] as RegistryType[]) {
      results[type] = await this.discover(type)
    }

    return results
  }

  /**
   * Look up a helper class by type and name.
   *
   * @param type - The registry type (features, clients, servers, commands, endpoints)
   * @param name - The helper name within that registry
   * @returns The helper constructor
   *
   * @example
   * ```typescript
   * const FsClass = container.helpers.lookup('features', 'fs')
   * ```
   */
  lookup(type: RegistryType, name: string): any {
    const { registry } = this.registryMap[type]
    return registry.lookup(name)
  }

  /**
   * Get the introspection description for a specific helper.
   *
   * @param type - The registry type
   * @param name - The helper name
   * @returns Markdown description of the helper's interface
   */
  describe(type: RegistryType, name: string): string {
    const { registry } = this.registryMap[type]
    return registry.describe(name)
  }

  /**
   * Discovers class-based helpers (features, clients, servers) from a directory.
   * Uses fileManager for fast file matching.
   */
  private async discoverClassBased(type: RegistryType, dir: string): Promise<string[]> {
    const { registry, baseClass } = this.registryMap[type]
    const fm = await this.ensureFileManager()
    const discovered: string[] = []

    const tests = [`${type}/*/*.ts`, `${type}/*.ts`]
    const files = fm.match(tests)

    for (const file of files) {
      const absPath = resolve(this.rootDir, file)
      const { name: fileName } = parse(absPath)

      if (fileName.includes('.test.') || fileName.includes('.spec.')) {
        continue
      }

      try {
        const mod = await import(absPath)
        const ExportedClass = mod.default || mod

        if (typeof ExportedClass !== 'function') {
          continue
        }

        if (!this.isSubclassOf(ExportedClass, baseClass)) {
          continue
        }

        const shortcut = ExportedClass.shortcut as string | undefined
        const registryName = shortcut
          ? shortcut.replace(`${type}.`, '')
          : this.fileNameToRegistryName(fileName)

        discovered.push(registryName)

        if (!registry.has(registryName)) {
          registry.register(registryName, ExportedClass)
          // this is only if they didn't export it by default
          this.emit('registered' as any, type, registryName, ExportedClass)
        }

      } catch (err: any) {
        if (err.message?.includes('name collision')) {
          throw err
        }
        console.warn(`Helpers gateway: failed to load ${type} from ${absPath}: ${err.message}`)
      }
    }

    return discovered
  }

  /**
   * Discovers config-based helpers (commands, endpoints) by delegating
   * to existing discovery mechanisms.
   */
  private async discoverConfigBased(type: RegistryType, dir: string): Promise<string[]> {
    const { registry } = this.registryMap[type]
    const beforeNames = new Set(registry.available)

    if (type === 'commands') {
      await commands.discover({ directory: dir })
    } else if (type === 'endpoints') {
      await this.discoverEndpoints(dir)
    }

    const afterNames = new Set(registry.available)
    return [...afterNames].filter(n => !beforeNames.has(n))
  }

  /**
   * Discovers endpoints from a directory, registering them for discoverability.
   * Actual mounting to an express server is handled separately by ExpressServer.useEndpoints().
   */
  private async discoverEndpoints(dir: string): Promise<void> {
    const { Glob } = globalThis.Bun || (await import('bun'))
    const glob = new Glob('**/*.ts')

    for await (const file of glob.scan({ cwd: dir, absolute: true })) {
      try {
        const mod = await import(file)
        const endpointModule = mod.default || mod

        if (endpointModule.path && typeof endpointModule.path === 'string') {
          const name = endpointModule.path.replace(/^\//, '').replace(/\//g, '_') || parse(file).name

          if (!endpoints.has(name)) {
            // Import the module so it's available, but don't mount it to a server
            // The express server's useEndpoints() handles the actual mounting
          }
        }
      } catch (err: any) {
        console.warn(`Helpers gateway: failed to load endpoint from ${file}: ${err.message}`)
      }
    }
  }

  /**
   * Check if a class is a subclass of a given base class by walking the prototype chain.
   * Uses identity comparison first, then falls back to name comparison to handle
   * cross-module boundaries (e.g. compiled binary vs dynamically imported modules
   * that resolve to separate module instances of the same class).
   */
  private isSubclassOf(candidate: any, base: any): boolean {
    if (!candidate || !base) return false
    if (candidate === base) return true

    let proto = Object.getPrototypeOf(candidate)
    while (proto) {
      if (proto === base || (base.name && proto.name === base.name)) return true
      proto = Object.getPrototypeOf(proto)
    }
    return false
  }

  /**
   * Convert a kebab-case or snake_case filename to a camelCase registry name.
   */
  private fileNameToRegistryName(fileName: string): string {
    return fileName
      .replace(/[-_](.)/g, (_, c: string) => c.toUpperCase())
      .replace(/^(.)/, (_, c: string) => c.toLowerCase())
  }
}

export default features.register('helpers', Helpers)
