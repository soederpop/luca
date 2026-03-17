import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from '../../schemas/base.js'
import { Feature } from '../feature.js'
import { Feature as UniversalFeature } from '../../feature.js'
import { Client, clients } from '../../client.js'
import { Server, servers } from '../../server.js'
import { Command, commands } from '../../command.js'
import { graftModule, isNativeHelperClass } from '../../graft.js'
import { endpoints } from '../../endpoint.js'
import { Selector, selectors } from '../../selector.js'
import type { Registry } from '../../registry.js'
import type { FileManager } from './file-manager.js'
import type { VM } from './vm.js'
import { resolve, parse } from 'path'
import { existsSync } from 'fs'

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

type RegistryType = 'features' | 'clients' | 'servers' | 'commands' | 'endpoints' | 'selectors'

const CLASS_BASED: RegistryType[] = ['features', 'clients', 'servers']

/**
 * The Helpers feature is a unified gateway for discovering and registering
 * project-level helpers from conventional folder locations.
 *
 * It scans known folder names (features/, clients/, servers/, commands/, endpoints/, selectors/)
 * and handles registration differently based on the helper type:
 *
 * - Class-based (features, clients, servers): Dynamic import, validate subclass, register
 * - Config-based (commands, endpoints, selectors): Delegate to existing discovery mechanisms
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
  static { Feature.register(this, 'helpers') }

  /** In-flight or completed discovery promises, keyed by registry type */
  private _discoveryPromises: Map<string, Promise<string[]>> = new Map()
  /** Cached results from completed discoveries */
  private _discoveryResults: Map<string, string[]> = new Map()
  /** In-flight or completed discoverAll promise */
  private _discoverAllPromise: Promise<Record<string, string[]>> | null = null

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
      selectors: { registry: selectors, baseClass: null, folders: ['selectors'] },
    }
  }

  /** The root directory to scan for helper folders. */
  get rootDir(): string {
    return this.options.rootDir || this.container.cwd
  }

  /**
   * Whether to use native `import()` for loading project helpers.
   * True only if `@soederpop/luca` is actually resolvable in `node_modules`.
   * Warns when `node_modules` exists but the package is missing.
   */
  get useNativeImport(): boolean {
    const hasNodeModules = existsSync(resolve(this.rootDir, 'node_modules'))
    const hasLuca = hasNodeModules && existsSync(resolve(this.rootDir, 'node_modules', '@soederpop', 'luca'))

    if (hasNodeModules && !hasLuca && !this._warnedNativeImport) {
      this._warnedNativeImport = true
      console.warn(
        `Helpers: node_modules exists but @soederpop/luca wasn't found. ` +
        `Did you forget to \`bun install\` or add @soederpop/luca as a dependency? ` +
        `Using the VM virtual module system instead until this is resolved.`
      )
    }

    return hasLuca
  }

  /** Prevent repeated warnings about missing @soederpop/luca */
  private _warnedNativeImport = false

  /** Track whether we've seeded the VM with virtual modules */
  private _vmSeeded = false

  /**
   * Seeds the VM feature with virtual modules so that project-level files
   * can `import` / `require('@soederpop/luca')`, `zod`, etc. without
   * needing them in `node_modules`.
   *
   * Called automatically when `useNativeImport` is false.
   * Can also be called externally (e.g. from the CLI) to pre-seed before discovery.
   */
  seedVirtualModules(): void {
    if (this._vmSeeded) return
    this._vmSeeded = true

    const vm = this.container.feature('vm') as unknown as VM

    // Provide the full @soederpop/luca barrel — everything node.ts exports
    // We build the exports object from the already-loaded modules in memory
    const lucaExports: Record<string, any> = {
      // Core classes
      Feature: UniversalFeature,
      Container: this.container.constructor,
      Helper: Object.getPrototypeOf(UniversalFeature.prototype).constructor,
      Client,
      Server,
      Command,
      Registry: Object.getPrototypeOf(this.container.features).constructor,

      // Utilities
      graftModule,
      isNativeHelperClass,

      // Registries
      features: this.container.features,
      clients,
      servers,
      commands,
      endpoints,
      selectors,

      // Registry classes
      ClientsRegistry: clients.constructor,
      CommandsRegistry: commands.constructor,
      EndpointsRegistry: endpoints.constructor,
      ServersRegistry: servers.constructor,
      SelectorsRegistry: selectors.constructor,
      FeaturesRegistry: this.container.features.constructor,

      // Helper subclasses
      Selector,

      // The singleton container
      default: this.container,

      // Convenient feature instances
      fs: this.container.feature('fs'),
      ui: this.container.feature('ui'),
      vm,
      proc: this.container.feature('proc'),

      // Zod re-export
      z,
    }

    // Schemas
    const schemasModule = { CommandOptionsSchema: commands.baseClass?.optionsSchema || z.object({}) }
    try {
      // Pull all base schemas from the already-loaded schemas/base module
      const baseSchemas = require('../../schemas/base.js')
      Object.assign(lucaExports, baseSchemas)
      Object.assign(schemasModule, baseSchemas)
    } catch {
      // Fallback: provide the essentials
      lucaExports.FeatureStateSchema = FeatureStateSchema
      lucaExports.FeatureOptionsSchema = FeatureOptionsSchema
      lucaExports.FeatureEventsSchema = FeatureEventsSchema
      schemasModule.FeatureStateSchema = FeatureStateSchema
      schemasModule.FeatureOptionsSchema = FeatureOptionsSchema
      schemasModule.FeatureEventsSchema = FeatureEventsSchema
    }

    vm.defineModule('@soederpop/luca', lucaExports)
    vm.defineModule('@soederpop/luca/schemas', schemasModule)
    vm.defineModule('@soederpop/luca/node', lucaExports)
    vm.defineModule('zod', { z, default: { z } })
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
   * Idempotent: the first caller triggers the actual scan. Subsequent callers
   * receive the cached results. If discovery is in-flight, callers await the
   * same promise — no duplicate work.
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
    // Key by type + resolved directory so that different directories
    // (e.g. project commands/ vs ~/.luca/commands/) are discovered independently
    // while concurrent calls to the same directory coalesce on one promise.
    const dir = options.directory || this.resolveFolderPath(type)
    const cacheKey = dir ? `${type}:${dir}` : type

    // Return cached results if already completed
    if (this._discoveryResults.has(cacheKey)) {
      return this._discoveryResults.get(cacheKey)!
    }

    // If in-flight, await the same promise
    if (this._discoveryPromises.has(cacheKey)) {
      return this._discoveryPromises.get(cacheKey)!
    }

    // First caller — start the work and store the promise
    const promise = this._doDiscover(type, { directory: dir || undefined })
    this._discoveryPromises.set(cacheKey, promise)

    const names = await promise

    // Cache the final results
    this._discoveryResults.set(cacheKey, names)

    return names
  }

  /** Internal: performs the actual discovery work for a single type. */
  private async _doDiscover(type: RegistryType, options: { directory?: string } = {}): Promise<string[]> {
    const dir = options.directory || this.resolveFolderPath(type)

    if (!dir) {
      return []
    }

    let names: string[]

    if (CLASS_BASED.includes(type)) {
      names = await this.discoverClassBased(type, dir)
    } else {
      names = await this.discoverConfigBased(type, dir)
    }

    // Update state for observability
    const discovered = this.state.get('discovered') || {}
    this.state.set('discovered', { ...discovered, [type]: true })

    const existing = this.state.get('registered') || []
    this.state.set('registered', [...existing, ...names.map(n => `${type}.${n}`)])

    this.emit('discovered' as any, type, names)

    return names
  }

  /**
   * Discover all helper types from their conventional folder locations.
   *
   * Idempotent: safe to call from multiple places (luca.cli.ts, commands, etc.).
   * The first caller triggers discovery; all others receive the same results.
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
    if (this._discoverAllPromise) {
      return this._discoverAllPromise
    }

    this._discoverAllPromise = this._doDiscoverAll()
    return this._discoverAllPromise
  }

  /** Internal: performs the actual discoverAll work. */
  private async _doDiscoverAll(): Promise<Record<string, string[]>> {
    const results: Record<string, string[]> = {}

    for (const type of ['features', 'clients', 'servers', 'commands', 'endpoints', 'selectors'] as RegistryType[]) {
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
   * Load a module either via native `import()` or the VM's virtual module system.
   * Uses the same `useNativeImport` check as discovery to decide the loading strategy.
   *
   * @param absPath - Absolute path to the module file
   * @returns The module's exports
   */
  async loadModuleExports(absPath: string): Promise<Record<string, any>> {
    if (this.useNativeImport) {
      const mod = await import(absPath)
      return mod
    }

    this.seedVirtualModules()
    const vm = this.container.feature('vm') as unknown as VM
    return vm.loadModule(absPath)
  }

  /**
   * Discovers class-based helpers (features, clients, servers) from a directory.
   * Uses fileManager when available (fast in git repos), falls back to Glob.
   */
  private async discoverClassBased(type: RegistryType, dir: string): Promise<string[]> {
    const { registry, baseClass } = this.registryMap[type]
    const discovered: string[] = []

    // Load build-time introspection data before importing helpers so that
    // interceptRegistration() can merge JSDoc descriptions from the generated file.
    const introspectionFile = resolve(dir, 'introspection.generated.ts')
    try {
      if (existsSync(introspectionFile)) {
        await import(introspectionFile)
      }
    } catch {}

    // Try fileManager first (faster in git repos), fall back to Glob
    let files: string[] = []
    try {
      const fm = await this.ensureFileManager()
      // fileManager may store absolute or relative keys — use absolute patterns
      const absPatterns = [`${dir}/*.ts`, `${dir}/**/*.ts`]
      const relPatterns = [`${type}/*.ts`, `${type}/**/*.ts`]
      const matched = fm.match([...absPatterns, ...relPatterns])
      files = matched.map((f: string) => f.startsWith('/') ? f : resolve(this.rootDir, f))
    } catch {}

    // Fall back to Glob if fileManager found nothing
    if (files.length === 0) {
      const { Glob } = globalThis.Bun || (await import('bun'))
      const glob = new Glob('**/*.ts')
      for await (const file of glob.scan({ cwd: dir })) {
        files.push(resolve(dir, file))
      }
    }

    for (const absPath of files) {
      const { name: fileName } = parse(absPath)

      if (fileName.includes('.test.') || fileName.includes('.spec.')) {
        continue
      }
      try {
        const mod = await this.loadModuleExports(absPath)
        const ExportedClass = mod.default || mod

        // Class-based: default export is a subclass of the base
        if (typeof ExportedClass === 'function' && isNativeHelperClass(ExportedClass, baseClass)) {
          const shortcut = ExportedClass.shortcut as string | undefined
          const registryName = shortcut
            ? shortcut.replace(`${type}.`, '')
            : this.fileNameToRegistryName(fileName)

          discovered.push(registryName)

          if (!registry.has(registryName)) {
            registry.register(registryName, ExportedClass)
            this.emit('registered' as any, type, registryName, ExportedClass)
          }
        } else {
          // Module-based: graft exports onto a generated subclass
          const moduleExports = mod.default && typeof mod.default === 'object' ? mod.default : mod
          const isGraftable = (
            moduleExports.description !== undefined ||
            moduleExports.stateSchema !== undefined ||
            moduleExports.optionsSchema !== undefined ||
            typeof moduleExports.run === 'function' ||
            typeof moduleExports.handler === 'function'
          )

          if (isGraftable) {
            const registryName = this.fileNameToRegistryName(fileName)
            const GraftedClass = graftModule(baseClass, moduleExports, registryName, type as any)

            discovered.push(registryName)

            if (!registry.has(registryName)) {
              registry.register(registryName, GraftedClass as any)
              this.emit('registered' as any, type, registryName, GraftedClass)
            }
          }
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
      if (this.useNativeImport) {
        await commands.discover({ directory: dir })
      } else {
        await this.discoverCommandsViaVM(dir)
      }
    } else if (type === 'endpoints') {
      await this.discoverEndpoints(dir)
    } else if (type === 'selectors') {
      if (this.useNativeImport) {
        await selectors.discover({ directory: dir })
      } else {
        await this.discoverSelectorsViaVM(dir)
      }
    }

    const afterNames = new Set(registry.available)
    return [...afterNames].filter(n => !beforeNames.has(n))
  }

  /**
   * Discovers commands using the VM's virtual module system.
   * Mirrors CommandsRegistry.discover() but uses vm.loadModule() instead of import().
   */
  private async discoverCommandsViaVM(dir: string): Promise<void> {
    this.seedVirtualModules()
    const { Glob } = globalThis.Bun || (await import('bun'))
    const glob = new Glob('*.ts')

    for await (const file of glob.scan({ cwd: dir })) {
      if (file === 'index.ts') continue

      const absPath = resolve(dir, file)
      const name = file.replace(/\.ts$/, '')

      if (commands.has(name)) continue

      try {
        const mod = await this.loadModuleExports(absPath)

        // 1. Class-based: default export extends Command
        if (isNativeHelperClass(mod.default, Command)) {
          const ExportedClass = mod.default
          if (!ExportedClass.shortcut || ExportedClass.shortcut === 'commands.base') {
            ExportedClass.shortcut = `commands.${name}`
          }
          if (!ExportedClass.commandDescription && ExportedClass.description) {
            ExportedClass.commandDescription = ExportedClass.description
          }
          commands.register(name, ExportedClass)
          continue
        }

        const commandModule = mod.default || mod

        // 2. Module-based with `run` export (new SimpleCommand pattern)
        if (typeof commandModule.run === 'function') {
          const Grafted = graftModule(Command as any, commandModule, name, 'commands')
          commands.register(name, Grafted as any)
          continue
        }

        // 3. Legacy: `handler` export
        if (typeof commandModule.handler === 'function') {
          const Grafted = graftModule(Command as any, {
            description: commandModule.description,
            argsSchema: commandModule.argsSchema,
            handler: commandModule.handler,
          }, name, 'commands')
          commands.register(name, Grafted as any)
        }
      } catch (err: any) {
        console.warn(`Helpers gateway: failed to load command from ${absPath}: ${err.message}`)
      }
    }
  }

  /**
   * Discovers selectors using the VM's virtual module system.
   * Mirrors discoverCommandsViaVM but uses selectors registry and Selector base class.
   */
  private async discoverSelectorsViaVM(dir: string): Promise<void> {
    this.seedVirtualModules()
    const { Glob } = globalThis.Bun || (await import('bun'))
    const glob = new Glob('*.ts')

    for await (const file of glob.scan({ cwd: dir })) {
      if (file === 'index.ts') continue

      const absPath = resolve(dir, file)
      const name = file.replace(/\.ts$/, '')

      if (selectors.has(name)) continue

      try {
        const mod = await this.loadModuleExports(absPath)

        // 1. Class-based: default export extends Selector
        if (isNativeHelperClass(mod.default, Selector)) {
          const ExportedClass = mod.default
          if (!ExportedClass.shortcut || ExportedClass.shortcut === 'selectors.base') {
            ExportedClass.shortcut = `selectors.${name}`
          }
          selectors.register(name, ExportedClass)
          continue
        }

        const selectorModule = mod.default || mod

        // 2. Module-based with `run` export
        if (typeof selectorModule.run === 'function') {
          const Grafted = graftModule(Selector as any, selectorModule, name, 'selectors')
          selectors.register(name, Grafted as any)
        }
      } catch (err: any) {
        console.warn(`Helpers gateway: failed to load selector from ${absPath}: ${err.message}`)
      }
    }
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
        const mod = await this.loadModuleExports(file)
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

export default Helpers