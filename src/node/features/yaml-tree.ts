import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'
import { Feature } from "../feature.js";
import { NodeContainer } from "../container.js";
import { camelCase, omit, set } from 'lodash-es'

/**
 * Zod schema for the YamlTree feature state.
 * Extends FeatureStateSchema and allows any additional string-keyed properties for tree data.
 */
export const YamlTreeStateSchema = FeatureStateSchema.extend({}).catchall(z.any()).describe('State schema for the YamlTree feature, stores loaded YAML tree data as arbitrary key-value pairs')
export type YamlTreeState = z.infer<typeof YamlTreeStateSchema>

/**
 * YamlTree Feature - A powerful YAML file tree loader and processor
 * 
 * This feature provides functionality to recursively load YAML files from a directory structure
 * and build a hierarchical tree representation. It automatically processes file paths to create
 * a nested object structure where file paths become object property paths.
 * 
 * **Key Features:**
 * - Recursive YAML file discovery in directory trees
 * - Automatic path-to-property mapping using camelCase conversion
 * - Integration with FileManager for efficient file operations
 * - State-based tree storage and retrieval
 * - Support for both .yml and .yaml file extensions
 *
 * This is the YAML counterpart to the `jsonTree` feature — same design in
 * every respect (recursive scan, camelCased property paths, a `tree` getter,
 * a custom key for namespacing). The only differences are the extensions it
 * looks for (`.yml`/`.yaml` vs `.json`) and the parser it uses (the `yaml`
 * feature vs `JSON.parse`). It is on-demand, so you must enable it before
 * use, and the tree starts empty until you load a directory into it.
 *
 * @example
 * ```typescript
 * // On-demand: enable it explicitly first.
 * const yamlTree = container.feature('yamlTree', { enable: true });
 * console.log(yamlTree.state.enabled);          // true
 * console.log(yamlTree.tree);                    // {} — empty until loaded
 *
 * // Scan a directory of YAML files. Paths become camelCased property paths:
 * //   config/database/production.yml -> tree.appConfig.database.production
 * //   config/app-settings.yaml       -> tree.appConfig.appSettings
 * await yamlTree.loadTree('config', 'appConfig');
 * const configData = yamlTree.tree.appConfig;
 * ```
 *
 * @template T - The state type, defaults to YamlTreeState
 * @extends {Feature<T>}
 */
export class YamlTree<T extends YamlTreeState = YamlTreeState> extends Feature<T> {
  static { Feature.register(this, 'yamlTree') }
  /** The shortcut path for accessing this feature */
  static override shortcut = "features.yamlTree" as const
  static override stability = 'stable' as const
  static override stateSchema = YamlTreeStateSchema
  static override optionsSchema = FeatureOptionsSchema

  /**
   * Attaches the YamlTree feature to a NodeContainer instance.
   * Registers the feature and creates an auto-enabled instance.
   * 
   * @param container - The NodeContainer to attach to
   * @returns The container for method chaining
   */
  static attach(container: NodeContainer & { yamlTree?: YamlTree }) {
    container.yamlTree = container.feature("yamlTree", { enable: true });
  }

  /**
   * Loads a tree of YAML files from the specified base path and stores them in state.
   * 
   * This method recursively scans the provided directory for YAML files (.yml and .yaml),
   * processes their content, and builds a hierarchical object structure. File paths are
   * converted to camelCase property names, and the resulting tree is stored in the feature's state.
   * 
   * **Path Processing:**
   * - Removes the base path prefix from file paths
   * - Converts directory/file names to camelCase
   * - Creates nested objects based on directory structure
   * - Removes file extensions (.yml/.yaml)
   * 
   * **Example:**
   * ```
   * config/
   *   database/
   *     production.yml  -> tree.config.database.production
   *     staging.yml     -> tree.config.database.staging
   *   api/
   *     endpoints.yaml  -> tree.config.api.endpoints
   * ```
   * 
   * @param basePath - The root directory path to scan for YAML files
   * @param key - The key to store the tree under in state (defaults to first segment of basePath)
   * @returns Promise resolving to the complete tree object
   * 
   * @throws {Error} When FileManager fails to start or files cannot be read
   * 
   * @example
   * ```typescript
   * // Given a directory of YAML files (create one for the demo):
   * const fs = container.feature('fs')
   * fs.writeFile('config/database/production.yml', 'host: db.example.com\nport: 5432\n')
   *
   * // Load all YAML files from 'config' directory into state.config
   * await yamlTree.loadTree('config');
   *
   * // Access the loaded data — file paths become camelCased property paths
   * const dbConfig = yamlTree.tree.config.database.production;
   * console.log(dbConfig.host); // 'db.example.com'
   *
   * // Load a different folder under a custom key
   * await yamlTree.loadTree('config', 'appSettings');
   * ```
   */
  async loadTree(basePath: string, key: string = basePath.split('/')[0]!  ) {
    const { container } = this;
    const yamlFeature = container.feature("yaml");
    const fileManager = container.feature("fileManager")
    const fileSystem = container.feature("fs");

    await fileManager.start()

    // Use the FileManager to find all YAML files in the tree.
    const yamlFiles = fileManager.matchFiles([
      `${basePath}/**/*.yml`, 
      `${basePath}/**/*.yaml`
    ]);

    const tree : any = {}

    for (const file of yamlFiles.filter(Boolean)) {
      if(file?.relativePath) {
        const fileContent = fileSystem.readFile(file.relativePath);
        const fileData = yamlFeature.parse(String(fileContent));
        const path = file.relativePath.replace(/\.ya?ml$/, "").replace(basePath + "/", "").split("/").filter(v => v?.length).map(p => camelCase(p));
        set(tree, path, fileData)
      }
    }

    // @ts-ignore-next-line
    this.setState({ ...this.tree, [key]: tree })
    
    return this.tree 
  }

  /**
   * Gets the current tree data, excluding the 'enabled' state property.
   * 
   * Returns a clean copy of the tree data without internal state management properties.
   * This provides access to only the YAML tree data that has been loaded.
   * 
   * @returns The tree object containing all loaded YAML data, organized by keys
   * 
   * @example
   * ```typescript
   * await yamlTree.loadTree('config');
   * const allTrees = yamlTree.tree;
   * // Returns: { config: { database: { ... }, api: { ... } } }
   * ```
   */
  get tree() {
    return omit(this.state.current, 'enabled')
  }
}

export default YamlTree