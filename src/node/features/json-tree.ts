import { z } from 'zod'
import { FeatureStateSchema } from '../../schemas/base.js'
import { Feature, features } from "../feature.js";
import { NodeContainer } from "../container.js";
import { camelCase, omit, set } from 'lodash-es';

/**
 * Zod schema for the JsonTree feature state.
 * Extends FeatureStateSchema and allows any additional string-keyed properties for tree data.
 */
export const JsonTreeStateSchema = FeatureStateSchema.extend({}).catchall(z.any())
export type JsonTreeState = z.infer<typeof JsonTreeStateSchema>

/**
 * JsonTree Feature - A powerful JSON file tree loader and processor
 * 
 * This feature provides functionality to recursively load JSON files from a directory structure
 * and build a hierarchical tree representation. It automatically processes file paths to create
 * a nested object structure where file paths become object property paths.
 * 
 * **Key Features:**
 * - Recursive JSON file discovery in directory trees
 * - Automatic path-to-property mapping using camelCase conversion
 * - Integration with FileManager for efficient file operations
 * - State-based tree storage and retrieval
 * - Native JSON parsing for optimal performance
 * 
 * **Path Processing:**
 * Files are processed to create a nested object structure:
 * - Directory names become object properties (camelCased)
 * - File names become the final property names (without .json extension)
 * - Nested directories create nested objects
 * 
 * **Usage Example:**
 * ```typescript
 * const jsonTree = container.feature('jsonTree', { enable: true });
 * await jsonTree.loadTree('data', 'appData');
 * const userData = jsonTree.tree.appData.users.profiles;
 * ```
 * 
 * **Directory Structure Example:**
 * ```
 * data/
 *   users/
 *     profiles.json    -> tree.data.users.profiles
 *     settings.json    -> tree.data.users.settings
 *   config/
 *     app-config.json  -> tree.data.config.appConfig
 * ```
 * 
 * @template T - The state type, defaults to JsonTreeState
 * @extends {Feature<T>}
 */
export class JsonTree<T extends JsonTreeState = JsonTreeState> extends Feature<T> {
  /** The shortcut path for accessing this feature */
  static override shortcut = "features.jsonTree" as const
  static override stateSchema = JsonTreeStateSchema

  /**
   * Attaches the JsonTree feature to a NodeContainer instance.
   * Registers the feature in the container's feature registry for later use.
   * 
   * @param container - The NodeContainer to attach to
   * @returns The container for method chaining
   */
  static attach(container: NodeContainer & { jsonTree?: JsonTree }) {
    container.features.register("jsonTree", JsonTree);
  }

  /**
   * Loads a tree of JSON files from the specified base path and stores them in state.
   * 
   * This method recursively scans the provided directory for JSON files, processes their
   * content, and builds a hierarchical object structure. File paths are converted to
   * camelCase property names, and the resulting tree is stored in the feature's state.
   * 
   * **Processing Steps:**
   * 1. Uses FileManager to discover all .json files recursively
   * 2. Reads each file's content using the file system feature
   * 3. Parses JSON content using native JSON.parse()
   * 4. Converts file paths to nested object properties
   * 5. Stores the complete tree in feature state
   * 
   * **Path Transformation:**
   * - Removes the base path prefix from file paths
   * - Converts directory/file names to camelCase
   * - Creates nested objects based on directory structure
   * - Removes .json file extension
   * 
   * **Example Transformation:**
   * ```
   * config/
   *   database/
   *     production.json  -> tree.config.database.production
   *     staging.json     -> tree.config.database.staging
   *   api/
   *     endpoints.json   -> tree.config.api.endpoints
   * ```
   * 
   * @param basePath - The root directory path to scan for JSON files
   * @param key - The key to store the tree under in state (defaults to first segment of basePath)
   * @returns Promise resolving to the complete tree object
   * 
   * @throws {Error} When FileManager fails to start or files cannot be read/parsed
   * 
   * @example
   * ```typescript
   * // Load all JSON files from 'data' directory into state.data
   * await jsonTree.loadTree('data');
   * 
   * // Load with custom key
   * await jsonTree.loadTree('app/config', 'configuration');
   * 
   * // Access the loaded data
   * const dbConfig = jsonTree.tree.data.database.production;
   * const apiEndpoints = jsonTree.tree.data.api.endpoints;
   * ```
   */
  async loadTree(basePath: string, key: string = basePath.split('/')[0]!) {
    const { container } = this  ;
    const fileManager = container.feature("fileManager");
    const fileSystem = container.feature("fs");

    await fileManager.start()

    // Use the FileManager to find all JSON files in the tree.
    const jsonFiles = fileManager.matchFiles([`${basePath}/**/*.json`]);

    const tree: any = {};

    for (const file of jsonFiles.filter(Boolean)) {
      if (file?.relativePath) {
        const fileContent = fileSystem.readFile(file.relativePath);
        const fileData = JSON.parse(fileContent);
        const path = file.relativePath
          .replace(/\.json$/, "")
          .replace(basePath + "/", "")
          .split("/")
          .filter((v) => v?.length)
          .map((p) => camelCase(p));
        set(tree, path, fileData);
      }
    }

    // @ts-ignore-next-line
    this.setState({ ...this.tree, [key]: tree });

    return this.tree;
  }

  /**
   * Gets the current tree data, excluding the 'enabled' state property.
   * 
   * Returns a clean copy of the tree data without internal state management properties.
   * This provides access to only the JSON tree data that has been loaded through loadTree().
   * 
   * @returns The tree object containing all loaded JSON data, organized by keys
   * 
   * @example
   * ```typescript
   * await jsonTree.loadTree('data');
   * await jsonTree.loadTree('config', 'appConfig');
   * 
   * const allTrees = jsonTree.tree;
   * // Returns: { 
   * //   data: { users: { ... }, products: { ... } },
   * //   appConfig: { database: { ... }, api: { ... } }
   * // }
   * 
   * // Access specific trees
   * const userData = jsonTree.tree.data.users;
   * const dbConfig = jsonTree.tree.appConfig.database;
   * ```
   */
  get tree() {
    return omit(this.state.current, 'enabled');
  }
}

export default features.register("jsonTree", JsonTree);
