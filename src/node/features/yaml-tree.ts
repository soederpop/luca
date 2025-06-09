import { Feature, type FeatureState, features } from "../feature.js";
import { NodeContainer } from "../container.js";
import { camelCase, omit, set } from 'lodash-es'

/**
 * State interface for the YamlTree feature.
 * Extends FeatureState and allows any additional string-keyed properties for tree data.
 * 
 * @interface YamlTreeState
 * @extends {FeatureState}
 */
export interface YamlTreeState extends FeatureState {
  /** Dynamic tree data stored as key-value pairs */
  [k: string] : any
}

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
 * @example
 * ```typescript
 * const yamlTree = container.feature('yamlTree', { enable: true });
 * await yamlTree.loadTree('config', 'appConfig');
 * const configData = yamlTree.tree.appConfig;
 * ```
 * 
 * @template T - The state type, defaults to YamlTreeState
 * @extends {Feature<T>}
 */
export class YamlTree<T extends YamlTreeState = YamlTreeState> extends Feature<T> {
  /** The shortcut path for accessing this feature */
  static override shortcut = "features.yamlTree" as const

  /**
   * Attaches the YamlTree feature to a NodeContainer instance.
   * Registers the feature and creates an auto-enabled instance.
   * 
   * @param container - The NodeContainer to attach to
   * @returns The container for method chaining
   */
  static attach(container: NodeContainer & { yamlTree?: YamlTree }) {
    container.features.register("yamlTree", YamlTree);
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
   * // Load all YAML files from 'config' directory into state.config
   * await yamlTree.loadTree('config');
   * 
   * // Load with custom key
   * await yamlTree.loadTree('app/settings', 'appSettings');
   * 
   * // Access the loaded data
   * const dbConfig = yamlTree.tree.config.database.production;
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
        const fileData = yamlFeature.parse(fileContent);
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

export default features.register("yamlTree", YamlTree);

