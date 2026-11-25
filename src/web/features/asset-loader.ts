import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'
import { Feature } from "../feature.js";

/**
 * Injects scripts and stylesheets into the page at runtime.
 *
 * Provides helpers for loading external libraries from unpkg.com,
 * injecting arbitrary script/link tags, and managing load state.
 * Used by other web features (e.g. Esbuild) to pull in dependencies on demand.
 *
 * @extends Feature
 *
 * @example
 * ```typescript
 * const loader = container.feature('assetLoader')
 * await loader.loadScript('https://unpkg.com/lodash')
 * await AssetLoader.loadStylesheet('https://unpkg.com/normalize.css')
 * ```
 */
export class AssetLoader extends Feature {
  static override stateSchema = FeatureStateSchema
  static override optionsSchema = FeatureOptionsSchema
  static override shortcut = "features.assetLoader" as const
  static override stability = 'stable' as const
  static override category = 'dev-tools' as const

  static { Feature.register(this, 'assetLoader') }

  static loadStylesheet(href: string) {
    return new Promise((resolve, reject) => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      link.onload = () => resolve(link);
      link.onerror = () => reject(new Error(`Failed to load stylesheet: ${href}`));

      document.head.appendChild(link);
    });
  }

  removeStylesheet(href:string) {
    const links = document.querySelectorAll(`link[href="${href}"]`);

    links.forEach((link) => {
      document.head.removeChild(link);
    });
  }

  async loadScript(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = url;
      script.async = true;

      script.onload = () => {
        resolve();
      };

      script.onerror = () => {
        reject(new Error(`Failed to load script: ${url}`));
      };

      document.head.appendChild(script);
    });
  }

  async unpkg(packageName: string, globalName: string): Promise<any> {
    const url = `https://unpkg.com/${packageName}`;
    await this.loadScript(url);
    return (window as any)[globalName];
  }

  /**
   * The unpkg URL of a package as an ES module. `?module` makes unpkg rewrite
   * the package's bare imports to unpkg URLs, so the module loads with no
   * bundler. A full URL is returned as is.
   *
   * @example
   * ```typescript
   * loader.unpkgModuleUrl('d3@7') // 'https://unpkg.com/d3@7?module'
   * ```
   */
  unpkgModuleUrl(specifier: string): string {
    if (/^https?:\/\//.test(specifier)) return specifier
    return `https://unpkg.com/${specifier.replace(/^\/+/, '')}?module`
  }

  /**
   * Import an ES module from unpkg (or from a full URL) and return its
   * namespace. Use it for packages that ship ESM and no UMD global.
   *
   * @example
   * ```typescript
   * const d3 = await loader.importModule('d3@7')
   * const THREE = await loader.importModule('three@0.170.0')
   * ```
   */
  async importModule(specifier: string): Promise<any> {
    const url = this.unpkgModuleUrl(specifier)
    // The URL is only known at runtime: keep bundlers from resolving it.
    return import(/* @vite-ignore */ /* webpackIgnore: true */ url)
  }
}

export default AssetLoader;