# FileManager (features.fileManager)

> Stability: `core`

The FileManager feature creates a database-like, in-memory index of all of the files in the project, provides metadata about these files, and can watch for changes to them. Think of it as a fast, queryable snapshot of your file tree — useful for code analysis tools, documentation generators, or any script that needs to reason about project structure. After `start()` completes, every file is indexed under its project-relative path (its "file ID"). The scan skips common build/dependency folders (node_modules, dist, out) by default; pass `exclude` patterns to skip more. In a git repo the index is also cached on disk keyed by the current commit SHA and directory mtimes, so repeat scans of a clean repo are nearly instant. Each indexed file carries metadata: `relativePath`, `absolutePath`, `name`, `extension` (with leading dot, e.g. `.ts`), `dirname`, `relativeDirname`, `size`, `modifiedAt`, and `createdAt`.

## Usage

```ts
container.feature('fileManager', {
  // Glob patterns to exclude from file scanning
  exclude,
})
```

## Options (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `exclude` | `any` | Glob patterns to exclude from file scanning |

## Methods

### match

Matches the file IDs against the pattern(s) provided

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `patterns` | `string | string[]` | ✓ | The patterns to match against the file IDs |

**Returns:** `string[]`



### matchFiles

Matches the file IDs against the pattern(s) provided and returns the file objects for each.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `patterns` | `string | string[]` | ✓ | The patterns to match against the file IDs |

**Returns:** `(File | undefined)[]`



### start

Starts the file manager and scans the files in the project.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `{ exclude?: string | string[] }` |  | Options for the file manager |

`{ exclude?: string | string[] }` properties:

| Property | Type | Description |
|----------|------|-------------|
| `exclude` | `any` | The patterns to exclude from the scan |

**Returns:** `Promise<this>`



### scanFiles

Scans the files in the project and updates the file manager state.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `{ exclude?: string | string[] }` |  | Options for the file manager |

`{ exclude?: string | string[] }` properties:

| Property | Type | Description |
|----------|------|-------------|
| `exclude` | `any` | The patterns to exclude from the scan |

**Returns:** `Promise<this>`



### watch

Watches directories for file changes. Can be called multiple times to add more directories to an existing watcher. Tracks all watched paths in state. When called without `paths`, watches the project's `directoryIds` (default behavior). When called with `paths`, watches only those specific directories/globs. Subsequent calls add to the existing watcher — they never replace what's already watched.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `{ paths?: string | string[]; exclude?: string | string[] }` |  | Options for the file manager |

`{ paths?: string | string[]; exclude?: string | string[] }` properties:

| Property | Type | Description |
|----------|------|-------------|
| `paths` | `any` | Specific directories or globs to watch. Defaults to project directoryIds. |
| `exclude` | `any` | The patterns to exclude from the watch |

**Returns:** `Promise<void>`



### stopWatching

**Returns:** `Promise<void>`



### updateFile

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | ✓ | Parameter path |

**Returns:** `Promise<void>`



### removeFile

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | ✓ | Parameter path |

**Returns:** `Promise<void>`



## Getters

| Property | Type | Description |
|----------|------|-------------|
| `fileIds` | `string[]` | Returns an array of all relative file paths indexed by the file manager. |
| `fileObjects` | `File[]` | Returns an array of all file metadata objects indexed by the file manager. |
| `directoryIds` | `string[]` | Returns the directory IDs for all of the files in the project. |
| `uniqueExtensions` | `string[]` | Returns an array of unique file extensions found across all indexed files. |
| `isStarted` | `boolean` | Whether the file manager has completed its initial scan. |
| `isStarting` | `boolean` | Whether the file manager is currently performing its initial scan. |
| `isWatching` | `boolean` | Whether the file watcher is actively monitoring for changes. |
| `watchedPaths` | `string[]` | Returns the list of directories currently being watched. |
| `watchedFiles` | `Record<string, string[]>` | Returns the directories and files currently being watched by chokidar. |

## Events (Zod v4 schema)

### file:change

Emitted when a watched file is added, changed, or deleted

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `type` | `'add' | 'change' | 'delete'` | The type of file change |
| `path` | `string` | Absolute path to the changed file |



## State (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `boolean` | Whether this feature is currently enabled |
| `started` | `boolean` | Whether the file manager has completed its initial scan |
| `starting` | `boolean` | Whether the file manager is currently scanning files |
| `watching` | `boolean` | Whether the file watcher is actively monitoring for changes |
| `failed` | `boolean` | Whether the initial file scan failed |

## Examples

**features.fileManager**

```ts
const fm = container.feature('fileManager')
await fm.start()
console.log('Scan complete:', fm.isStarted)
console.log('Total files indexed:', fm.fileIds.length)

// Glob matching returns relative paths...
const tsFiles = fm.match('**' + '/*.ts')
console.log('TypeScript files:', tsFiles.length)

// ...or full metadata objects
for (const f of fm.matchFiles('package.json')) {
 console.log(f?.relativePath, f?.extension, f?.size)
}

// Understand the project at a glance
console.log('Extensions:', fm.uniqueExtensions.join(', ')) // e.g. .ts, .md, .json
console.log('Directories:', fm.directoryIds.length)
```

