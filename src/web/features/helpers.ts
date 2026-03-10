import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from '../../schemas/base.js'
import { Feature } from '../feature.js'
import { Client } from '../../client.js'
import type { Registry } from '../../registry.js'
import type { AssetLoader } from './asset-loader.js'

export const HelpersStateSchema = FeatureStateSchema.extend({
  discovered: z.record(z.string(), z.boolean()).default({}).describe('Which registry types have been discovered'),
  registered: z.array(z.string()).default([]).describe('Names of project-level helpers that were discovered (type.name)'),
  manifestLoaded: z.boolean().default(false).describe('Whether the manifest has been fetched'),
})

export type HelpersState = z.infer<typeof HelpersStateSchema>

export const HelpersOptionsSchema = FeatureOptionsSchema.extend({
  manifestURL: z.string().optional().describe('URL to fetch the helpers manifest from. Defaults to /.well-known/luca.manifest.json'),
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
  ]).describe('Emitted when a single helper is registered'),
  manifestLoaded: z.tuple([
    z.any().describe('The parsed manifest object'),
  ]).describe('Emitted when the manifest is successfully fetched'),
  manifestError: z.tuple([
    z.any().describe('The error that occurred'),
  ]).describe('Emitted when the manifest fetch fails'),
})

type RegistryType = 'features' | 'clients'

interface ManifestEntry {
  id: string
  description?: string
  url: string
}

interface Manifest {
  features?: Record<string, ManifestEntry>
  clients?: Record<string, ManifestEntry>
}

/**
 * The Helpers feature discovers and loads project-level helpers from a JSON manifest
 * served over HTTP. Scripts are injected via AssetLoader and self-register into
 * the container's registries.
 *
 * This is the web equivalent of the node Helpers feature, which scans the filesystem.
 * Instead of filesystem scanning, this feature fetches a manifest from a well-known URL
 * and uses AssetLoader.loadScript() to inject each helper's script tag.
 *
 * @example
 * ```typescript
 * const helpers = container.feature('helpers', { enable: true })
 *
 * // Discover all helper types from the manifest
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
  static override description = 'Unified gateway for discovering and registering project-level helpers via HTTP manifest'
  static override stateSchema = HelpersStateSchema
  static override optionsSchema = HelpersOptionsSchema
  static override eventsSchema = HelpersEventsSchema

  static { Feature.register(this as any, 'helpers') }

  private _manifest: Manifest | null = null

  private get registryMap(): Record<RegistryType, { registry: Registry<any> }> {
    return {
      features: { registry: this.container.features as any },
      clients: { registry: (this.container as any).clients as Registry<any> },
    }
  }

  /** The URL to fetch the helpers manifest from. */
  get manifestURL(): string {
    return this.options.manifestURL || '/.well-known/luca.manifest.json'
  }

  /**
   * Set a new manifest URL. Invalidates any cached manifest.
   *
   * @param url - The new URL to fetch the manifest from
   */
  setManifestURL(url: string) {
    this.options.manifestURL = url
    this._manifest = null
    this.state.set('manifestLoaded', false)
  }

  /**
   * Returns a unified view of all available helpers across all registries.
   * Each key is a registry type, each value is the list of helper names in that registry.
   */
  get available(): Record<string, string[]> {
    const result: Record<string, string[]> = {}
    for (const [type, { registry }] of Object.entries(this.registryMap)) {
      result[type] = registry.available
    }
    return result
  }

  /**
   * Fetch and cache the manifest JSON. Returns cached version on subsequent calls
   * unless invalidated by setManifestURL().
   */
  private async fetchManifest(): Promise<Manifest> {
    if (this._manifest) {
      return this._manifest
    }

    try {
      const response = await fetch(this.manifestURL)

      if (!response.ok) {
        const err = new Error(`Manifest fetch failed: ${response.status} ${response.statusText}`)
        this.emit('manifestError' as any, err)
        return {}
      }

      const manifest: Manifest = await response.json()
      this._manifest = manifest
      this.state.set('manifestLoaded', true)
      this.emit('manifestLoaded' as any, manifest)
      return manifest
    } catch (err: any) {
      this.emit('manifestError' as any, err)
      return {}
    }
  }

  /**
   * Get the AssetLoader instance from the container.
   */
  private get assetLoader(): AssetLoader {
    return this.container.feature('assetLoader') as unknown as AssetLoader
  }

  /**
   * Discover and register helpers of the given type from the manifest.
   *
   * Fetches the manifest, then for each entry of the requested type,
   * loads the script via AssetLoader and checks what got newly registered.
   *
   * @param type - Which type of helpers to discover ('features' or 'clients')
   * @returns Names of helpers that were discovered and registered
   */
  async discover(type: RegistryType): Promise<string[]> {
    const discovered = this.state.get('discovered') || {}

    if (discovered[type]) {
      return []
    }

    const manifest = await this.fetchManifest()
    const entries = manifest[type] || {}
    const { registry } = this.registryMap[type]
    const newNames: string[] = []

    for (const [name, entry] of Object.entries(entries)) {
      const beforeNames = new Set(registry.available)

      try {
        await this.assetLoader.loadScript(entry.url)
      } catch (err: any) {
        console.warn(`Helpers: failed to load ${type}/${name} from ${entry.url}: ${err.message}`)
        continue
      }

      const afterNames = registry.available
      const added = afterNames.filter((n: string) => !beforeNames.has(n))

      if (added.length > 0) {
        for (const addedName of added) {
          newNames.push(addedName)
          this.emit('registered' as any, type, addedName)
        }
      } else if (registry.has(name)) {
        // Script may have already been registered under the expected name
        if (!beforeNames.has(name)) {
          newNames.push(name)
          this.emit('registered' as any, type, name)
        }
      }
    }

    this.state.set('discovered', { ...this.state.get('discovered'), [type]: true })

    const existing = this.state.get('registered') || []
    this.state.set('registered', [...existing, ...newNames.map(n => `${type}.${n}`)])

    this.emit('discovered' as any, type, newNames)

    return newNames
  }

  /**
   * Discover all helper types from the manifest.
   *
   * @returns Map of registry type to discovered helper names
   */
  async discoverAll(): Promise<Record<string, string[]>> {
    const results: Record<string, string[]> = {}

    for (const type of ['features', 'clients'] as RegistryType[]) {
      results[type] = await this.discover(type)
    }

    return results
  }

  /**
   * Convenience method to discover only features.
   */
  async discoverFeatures(): Promise<string[]> {
    return this.discover('features')
  }

  /**
   * Convenience method to discover only clients.
   */
  async discoverClients(): Promise<string[]> {
    return this.discover('clients')
  }

  /**
   * Look up a helper class by type and name.
   *
   * @param type - The registry type
   * @param name - The helper name within that registry
   * @returns The helper constructor
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
}

export default Helpers
