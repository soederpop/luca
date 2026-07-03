# YamlTree (features.yamlTree)

> Stability: `stable`

YamlTree Feature - A powerful YAML file tree loader and processor This feature provides functionality to recursively load YAML files from a directory structure and build a hierarchical tree representation. It automatically processes file paths to create a nested object structure where file paths become object property paths. **Key Features:** - Recursive YAML file discovery in directory trees - Automatic path-to-property mapping using camelCase conversion - Integration with FileManager for efficient file operations - State-based tree storage and retrieval - Support for both .yml and .yaml file extensions This is the YAML counterpart to the `jsonTree` feature — same design in every respect (recursive scan, camelCased property paths, a `tree` getter, a custom key for namespacing). The only differences are the extensions it looks for (`.yml`/`.yaml` vs `.json`) and the parser it uses (the `yaml` feature vs `JSON.parse`). It is on-demand, so you must enable it before use, and the tree starts empty until you load a directory into it.

## Usage

```ts
container.feature('yamlTree')
```

## Methods

### loadTree

Loads a tree of YAML files from the specified base path and stores them in state. This method recursively scans the provided directory for YAML files (.yml and .yaml), processes their content, and builds a hierarchical object structure. File paths are converted to camelCase property names, and the resulting tree is stored in the feature's state. **Path Processing:** - Removes the base path prefix from file paths - Converts directory/file names to camelCase - Creates nested objects based on directory structure - Removes file extensions (.yml/.yaml) **Example:** ``` config/ database/ production.yml  -> tree.config.database.production staging.yml     -> tree.config.database.staging api/ endpoints.yaml  -> tree.config.api.endpoints ```

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `basePath` | `string` | ✓ | The root directory path to scan for YAML files |
| `key` | `string` |  | The key to store the tree under in state (defaults to first segment of basePath) |

**Returns:** `void`

```ts
// Given a directory of YAML files (create one for the demo):
const fs = container.feature('fs')
fs.writeFile('config/database/production.yml', 'host: db.example.com\nport: 5432\n')

// Load all YAML files from 'config' directory into state.config
await yamlTree.loadTree('config');

// Access the loaded data — file paths become camelCased property paths
const dbConfig = yamlTree.tree.config.database.production;
console.log(dbConfig.host); // 'db.example.com'

// Load a different folder under a custom key
await yamlTree.loadTree('config', 'appSettings');
```



## Getters

| Property | Type | Description |
|----------|------|-------------|
| `tree` | `any` | Gets the current tree data, excluding the 'enabled' state property. Returns a clean copy of the tree data without internal state management properties. This provides access to only the YAML tree data that has been loaded. |

## State (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `boolean` | Whether this feature is currently enabled |

## Examples

**features.yamlTree**

```ts
// On-demand: enable it explicitly first.
const yamlTree = container.feature('yamlTree', { enable: true });
console.log(yamlTree.state.enabled);          // true
console.log(yamlTree.tree);                    // {} — empty until loaded

// Scan a directory of YAML files. Paths become camelCased property paths:
//   config/database/production.yml -> tree.appConfig.database.production
//   config/app-settings.yaml       -> tree.appConfig.appSettings
await yamlTree.loadTree('config', 'appConfig');
const configData = yamlTree.tree.appConfig;
```



**loadTree**

```ts
// Given a directory of YAML files (create one for the demo):
const fs = container.feature('fs')
fs.writeFile('config/database/production.yml', 'host: db.example.com\nport: 5432\n')

// Load all YAML files from 'config' directory into state.config
await yamlTree.loadTree('config');

// Access the loaded data — file paths become camelCased property paths
const dbConfig = yamlTree.tree.config.database.production;
console.log(dbConfig.host); // 'db.example.com'

// Load a different folder under a custom key
await yamlTree.loadTree('config', 'appSettings');
```



**tree**

```ts
await yamlTree.loadTree('config');
const allTrees = yamlTree.tree;
// Returns: { config: { database: { ... }, api: { ... } } }
```

