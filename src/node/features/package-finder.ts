import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'
import { Feature, features } from "../feature.js";
import { readdir, readFile } from 'fs/promises'
import { resolve, join, basename } from 'path'
import { mapValues, pickBy, uniqBy } from 'lodash-es'

/**
 * Index mapping package names to arrays of package manifests with their file paths.
 * Used for efficient lookup and duplicate detection.
 * 
 * @type PackageIndex
 */
type PackageIndex = {
  [name: string]: Array<PartialManifest & {
    /** The file system path to the package.json file */
    __path: string;
  }>;
};

/**
 * Zod schema for the PackageFinder feature state.
 * Tracks the initialization status of the package scanning process.
 */
export const PackageFinderStateSchema = FeatureStateSchema.extend({
  /** Whether the package finder has been started and initial scan completed */
  started: z.boolean().optional().describe('Whether the package finder has been started and initial scan completed'),
})
export type PackageFinderState = z.infer<typeof PackageFinderStateSchema>

/**
 * Zod schema for the PackageFinder feature options.
 */
export const PackageFinderOptionsSchema = FeatureOptionsSchema.extend({
  /** Optional configuration parameter (currently unused) */
  option: z.string().optional().describe('Optional configuration parameter'),
})
export type PackageFinderOptions = z.infer<typeof PackageFinderOptionsSchema>

/**
 * Partial representation of a package.json manifest file.
 * Contains the most commonly used fields for package analysis and dependency management.
 * 
 * @type PartialManifest
 */
export type PartialManifest = {
  /** The package name (e.g., 'lodash', '@types/node') */
  name: string;
  /** The package version (e.g., '1.0.0', '^2.1.3') */
  version: string;
  /** Optional package description */
  description?: string;
  /** Runtime dependencies with version constraints */
  dependencies?: Record<string, Record<string,string>>;
  /** Development dependencies with version constraints */
  devDependencies?: Record<string, Record<string,string>>;
  /** Peer dependencies with version constraints */
  peerDependencies?: Record<string, Record<string,string>>;
  /** Optional dependencies with version constraints */
  optionalDependencies?: Record<string, Record<string,string>>;
} 

/**
 * PackageFinder Feature - Comprehensive package discovery and analysis tool
 * 
 * This feature provides powerful capabilities for discovering, indexing, and analyzing
 * npm packages across the entire project workspace. It recursively scans all node_modules
 * directories and builds a comprehensive index of packages, enabling:
 * 
 * **Core Functionality:**
 * - Recursive node_modules scanning across the workspace
 * - Package manifest parsing and indexing
 * - Duplicate package detection and analysis
 * - Dependency relationship mapping
 * - Scoped package organization (@scope/package)
 * - Package count and statistics
 * 
 * **Use Cases:**
 * - Dependency auditing and analysis
 * - Duplicate package identification
 * - Package version conflict detection
 * - Dependency tree analysis
 * - Workspace package inventory
 * 
 * **Performance Features:**
 * - Parallel manifest reading for fast scanning
 * - Efficient duplicate detection using unique paths
 * - Lazy initialization - only scans when started
 * - In-memory indexing for fast queries
 * 
 * **Usage Example:**
 * ```typescript
 * const finder = container.feature('packageFinder');
 * await finder.start();
 * 
 * // Find duplicates
 * console.log('Duplicate packages:', finder.duplicates);
 * 
 * // Find package by name
 * const lodash = finder.findByName('lodash');
 * 
 * // Find dependents of a package
 * const dependents = finder.findDependentsOf('react');
 * ```
 * 
 * @template T - The state type, defaults to PackageFinderState
 * @template K - The options type, defaults to PackageFinderOptions
 * @extends {Feature<T, K>}
 */
export class PackageFinder<
  T extends PackageFinderState = PackageFinderState,
  K extends PackageFinderOptions = PackageFinderOptions
> extends Feature<T, K> {

  /** The shortcut path for accessing this feature */
  static override shortcut = "features.packageFinder" as const
  static override stateSchema = PackageFinderStateSchema
  static override optionsSchema = PackageFinderOptionsSchema

  /** Internal package index mapping names to manifest arrays */
  packages: PackageIndex = {}

  /**
   * Initializes the feature state after construction.
   * Sets the started flag to false, indicating the initial scan hasn't completed.
   */
  override afterInitialize() {
    this.state.set('started', false)
  }

  /**
   * Adds a package manifest to the internal index.
   * 
   * This method ensures uniqueness based on file path and maintains an array
   * of all versions/instances of each package found across the workspace.
   * Packages with the same name but different paths (versions) are tracked separately.
   * 
   * @param manifest - The package manifest data from package.json
   * @param path - The file system path to the package.json file
   * 
   * @example
   * ```typescript
   * finder.addPackage({
   *   name: 'lodash',
   *   version: '4.17.21',
   *   description: 'A modern JavaScript utility library'
   * }, '/project/node_modules/lodash/package.json');
   * ```
   */
  addPackage(manifest: PartialManifest, path: string) {
    const { name } = manifest
    
    if (!this.packages[name]) {
      this.packages[name] = []
    }
    
    this.packages[name] = uniqBy(this.packages[name].concat([{
      ...manifest,
      __path: path
    }]), '__path')
  }
  
  /**
   * Gets a list of package names that have multiple versions/instances installed.
   * 
   * This is useful for identifying potential dependency conflicts or 
   * opportunities for deduplication in the project.
   * 
   * @returns Array of package names that appear multiple times in the workspace
   * 
   * @example
   * ```typescript
   * const duplicates = finder.duplicates;
   * // ['lodash', 'react', '@types/node'] - packages with multiple versions
   * 
   * duplicates.forEach(name => {
   *   console.log(`${name} has ${finder.packages[name].length} versions`);
   * });
   * ```
   */
  get duplicates() {
    return Object.keys(
      pickBy(this.packages, (packages) => packages.length > 1)
    )
  }

  /**
   * Starts the package finder and performs the initial workspace scan.
   * 
   * This method is idempotent - calling it multiple times will not re-scan
   * if already started. It triggers the complete workspace scanning process.
   * 
   * @returns Promise resolving to this instance for method chaining
   * 
   * @example
   * ```typescript
   * await finder.start();
   * console.log(`Found ${finder.packageNames.length} unique packages`);
   * ```
   */
  async start() {
    if (this.isStarted) {
      return this;
    }
    
    await this.scan()
    
    this.state.set('started', true)
  }

  /**
   * Performs a comprehensive scan of all node_modules directories in the workspace.
   * 
   * This method orchestrates the complete scanning process:
   * 1. Discovers all node_modules directories recursively
   * 2. Finds all package directories (including scoped packages)
   * 3. Reads and parses all package.json files in parallel
   * 4. Indexes all packages for fast querying
   * 
   * The scan is performed in parallel for optimal performance, reading multiple
   * package.json files simultaneously.
   * 
   * @param options - Scanning options (currently unused)
   * @param options.exclude - Optional exclusion patterns (not implemented)
   * @returns Promise resolving to this instance for method chaining
   * 
   * @example
   * ```typescript
   * // Manual scan (usually called automatically by start())
   * await finder.scan();
   * 
   * // Check results
   * console.log(`Scanned ${finder.manifests.length} packages`);
   * ```
   */
  async scan(options: { exclude?: string | string[] } = {}) {
    const packageFolders = await this.findAllPackageFolders()
    const manifestPaths = packageFolders.map((folder) => `${folder}/package.json`)

    await Promise.all(
      manifestPaths.map((path) => 
        readFile(path).then((buf) => JSON.parse(String(buf))).then((manifest: PartialManifest) => {
          this.addPackage(manifest, path)
        })
      )
    )

    this.state.set('started', true)

    return this;
  }

  /**
   * Checks if the package finder has completed its initial scan.
   * 
   * @returns True if the finder has been started and scanning is complete
   */
  get isStarted() {
    return !!this.state.get("started");
  }
 
  /**
   * Gets an array of all unique package names discovered in the workspace.
   * 
   * @returns Array of package names (e.g., ['lodash', 'react', '@types/node'])
   * 
   * @example
   * ```typescript
   * const names = finder.packageNames;
   * console.log(`Found ${names.length} unique packages`);
   * ```
   */
  get packageNames() {
    return Object.keys(this.packages)
  }
  
  /**
   * Gets an array of all scoped package prefixes found in the workspace.
   * 
   * Scoped packages are those starting with '@' (e.g., @types/node, @babel/core).
   * This returns just the scope part (e.g., '@types', '@babel').
   * 
   * @returns Array of unique scope names without duplicates
   * 
   * @example
   * ```typescript
   * const scopes = finder.scopes;
   * // ['@types', '@babel', '@angular'] - all scopes in use
   * 
   * scopes.forEach(scope => {
   *   const scopedPackages = finder.packageNames.filter(name => name.startsWith(scope));
   *   console.log(`${scope}: ${scopedPackages.length} packages`);
   * });
   * ```
   */
  get scopes() {
    return Array.from(
      new Set(this.packageNames.filter(p => p.startsWith('@')).map(p => p.split('/')[0]))
    )
  }
 
  /**
   * Finds the first package manifest matching the given name.
   * 
   * If multiple versions of the package exist, returns the first one found.
   * Use the packages property directly if you need all versions.
   * 
   * @param name - The exact package name to search for
   * @returns The first matching package manifest, or undefined if not found
   * 
   * @example
   * ```typescript
   * const lodash = finder.findByName('lodash');
   * if (lodash) {
   *   console.log(`Found lodash version ${lodash.version}`);
   * }
   * ```
   */
  findByName(name: string) {
    return this.find((i) => i.name === name)  
  }

  /**
   * Finds all packages that declare the specified package as a dependency.
   * 
   * Searches through dependencies and devDependencies of all packages
   * to find which ones depend on the target package. Useful for impact
   * analysis when considering package updates or removals.
   * 
   * @param packageName - The name of the package to find dependents for
   * @returns Array of package manifests that depend on the specified package
   * 
   * @example
   * ```typescript
   * const reactDependents = finder.findDependentsOf('react');
   * console.log(`${reactDependents.length} packages depend on React:`);
   * reactDependents.forEach(pkg => {
   *   console.log(`- ${pkg.name}@${pkg.version}`);
   * });
   * ```
   */
  findDependentsOf(packageName: string) {
    return this.filter(({ dependencies = {}, devDependencies = {} }) => {
      return packageName in dependencies || packageName in devDependencies
    })
  }

  /**
   * Finds the first package manifest matching the provided filter function.
   * 
   * @param filter - Function that returns true for matching packages
   * @returns The first matching package manifest, or undefined if none found
   * 
   * @example
   * ```typescript
   * // Find a package with specific version
   * const specific = finder.find(pkg => pkg.name === 'lodash' && pkg.version.startsWith('4.'));
   * 
   * // Find a package with description containing keyword
   * const utility = finder.find(pkg => pkg.description?.includes('utility'));
   * ```
   */
  find(filter: (manifest: PartialManifest) => boolean) {
    return this.manifests.find(filter)
  }
  
  /**
   * Finds all package manifests matching the provided filter function.
   * 
   * @param filter - Function that returns true for matching packages
   * @returns Array of matching package manifests
   * 
   * @example
   * ```typescript
   * // Find all packages with 'babel' in the name
   * const babelPackages = finder.filter(pkg => pkg.name.includes('babel'));
   * 
   * // Find all packages with no description
   * const undocumented = finder.filter(pkg => !pkg.description);
   * 
   * // Find all scoped packages
   * const scoped = finder.filter(pkg => pkg.name.startsWith('@'));
   * ```
   */
  filter(filter: (manifest: PartialManifest) => boolean) {
    return this.manifests.filter(filter)
  }

  /**
   * Returns all packages that do NOT match the provided filter function.
   * 
   * This is the inverse of filter() - returns packages where filter returns false.
   * 
   * @param filter - Function that returns true for packages to exclude
   * @returns Array of package manifests that don't match the filter
   * 
   * @example
   * ```typescript
   * // Get all non-development packages (those not in devDependencies)
   * const prodPackages = finder.exclude(pkg => isDevDependency(pkg.name));
   * 
   * // Get all non-scoped packages
   * const unscoped = finder.exclude(pkg => pkg.name.startsWith('@'));
   * ```
   */
  exclude(filter: (manifest: PartialManifest) => boolean) {
    return this.manifests.filter((m) => !filter(m))
  }

  /**
   * Gets a flat array of all package manifests found in the workspace.
   * 
   * This includes all versions/instances of packages, unlike packageNames
   * which returns unique names only.
   * 
   * @returns Array of all package manifests with their metadata
   * 
   * @example
   * ```typescript
   * const all = finder.manifests;
   * console.log(`Total package instances: ${all.length}`);
   * 
   * // Group by name to see duplicates
   * const grouped = all.reduce((acc, pkg) => {
   *   acc[pkg.name] = (acc[pkg.name] || 0) + 1;
   *   return acc;
   * }, {});
   * ```
   */
  get manifests() {
    return Object.values(this.packages).flat()
  }
  
  /**
   * Gets a count of instances for each package name.
   * 
   * Useful for quickly identifying which packages have multiple versions
   * and how many instances of each exist.
   * 
   * @returns Object mapping package names to their instance counts
   * 
   * @example
   * ```typescript
   * const counts = finder.counts;
   * // { 'lodash': 3, 'react': 2, 'express': 1 }
   * 
   * Object.entries(counts)
   *   .filter(([name, count]) => count > 1)
   *   .forEach(([name, count]) => {
   *     console.log(`${name}: ${count} versions installed`);
   *   });
   * ```
   */
  get counts() {
    return mapValues(this.packages, (packages) => packages.length)
  }

  /**
   * Discovers all package directories within a specific node_modules directory.
   * 
   * Handles both regular packages and scoped packages (@scope/package).
   * Scoped packages require additional directory traversal as they are nested
   * under scope directories.
   * 
   * @param nodeModulesPath - Path to a node_modules directory to scan
   * @returns Promise resolving to array of package directory paths
   * 
   * @private
   */
  private async findPackageFolders(nodeModulesPath: string) {
    const topLevelFolders = await readdir(nodeModulesPath);
  
    const withScoped: Array<string[]> = await Promise.all(
      topLevelFolders.map(async (folder) => {
        const folderPath = join(nodeModulesPath, folder);
        if (folder.startsWith('@')) {
          return readdir(folderPath).then((subs) => subs.map((sub) => join(nodeModulesPath,folder,sub)))
        } else if (folder.startsWith('.')) {
          return []
        } else {
          return [folderPath];
        }
      })
    );
  
    const results = withScoped.flat()
  
    return results;
  }
   
  /**
   * Discovers all package directories across all node_modules in the workspace.
   * 
   * Combines results from all discovered node_modules directories to provide
   * a comprehensive list of all package installations.
   * 
   * @returns Promise resolving to array of all package directory paths
   * 
   * @private
   */
  private async findAllPackageFolders() {
    const nodeModuleFolders = await this.findNodeModulesFolders()

    const allPackages = await Promise.all(
      nodeModuleFolders.map((folder) => this.findPackageFolders(folder))
    )
    
    return allPackages.flat()
  }

  /**
   * Discovers all node_modules directories in the workspace hierarchy.
   * 
   * Uses the container's file system utilities to recursively search upward
   * from the current working directory to find all node_modules directories.
   * This supports monorepos and nested project structures.
   * 
   * @returns Promise resolving to array of node_modules directory paths
   * 
   * @private
   */
  private async findNodeModulesFolders() : Promise<string[]> {
    const folders = await this.container.fs.findUpAsync('node_modules', {
      multiple: true
    }) as string[]
    
    return folders || []
  }

}

export default features.register("packageFinder", PackageFinder);