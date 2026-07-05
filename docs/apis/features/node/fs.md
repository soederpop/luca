# FS (features.fs)

> Stability: `core`

The FS feature provides methods for interacting with the file system, relative to the container's cwd.

## Usage

```ts
container.feature('fs')
```

## Methods

### readFile

Synchronously reads a file and returns its contents as a string. **Binary files: pass `null` as the encoding to get a raw Buffer.** The default encoding is utf-8, which silently corrupts binary content (images, zips, PDFs, compiled binaries) — invalid byte sequences are replaced and the data cannot be round-tripped. `fs.readFile('image.png')` returns garbage; `fs.readFile('image.png', null)` returns the real bytes.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | ✓ | The file path relative to the container's working directory |
| `encoding` | `BufferEncoding | null` |  | The encoding to use. Pass null to get a raw Buffer (required for binary files). |

**Returns:** `string | Buffer`

```ts
const content = fs.readFile('README.md')          // string (utf-8)
fs.writeFile('logo.png', Buffer.from([0x89, 0x50, 0x4e, 0x47]))
const buffer = fs.readFile('logo.png', null)      // Buffer — safe for binary data
```



### readFileSync

Synchronously reads a file and returns its contents as a string. added this method because AI Assistants are understandly confused by this deviation from 2000's era node style

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | ✓ | Parameter path |
| `encoding` | `BufferEncoding | null` |  | Parameter encoding |

**Returns:** `string | Buffer`



### readFileAsync

Asynchronously reads a file and returns its contents as a string.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | ✓ | The file path relative to the container's working directory |
| `encoding` | `BufferEncoding | null` |  | The encoding to use. Pass null to get a raw Buffer. |

**Returns:** `Promise<string | Buffer>`

```ts
const content = await fs.readFileAsync('README.md')
const buffer = await fs.readFileAsync('data.json', null) // pass null for a raw Buffer
```



### readJson

Synchronously reads and parses a JSON file.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | ✓ | The path to the JSON file |

**Returns:** `any`

```ts
const pkg = fs.readJson('package.json')
console.log(pkg.version)
```



### readJsonSync

Read and parse a JSON file synchronously

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | ✓ | Parameter path |

**Returns:** `any`



### readJsonAsync

Asynchronously reads and parses a JSON file.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | ✓ | The path to the JSON file |

**Returns:** `Promise<any>`

```ts
const pkg = await fs.readJsonAsync('package.json')
console.log(pkg.version)
```



### readdirSync

Synchronously reads the contents of a directory.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | ✓ | The directory path relative to the container's working directory |

**Returns:** `string[]`

```ts
const entries = fs.readdirSync('src')
console.log(entries) // ['index.ts', 'utils.ts', 'components']
```



### readdir

Asynchronously reads the contents of a directory.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | ✓ | The directory path relative to the container's working directory |

**Returns:** `Promise<string[]>`

```ts
const entries = await fs.readdir('src')
console.log(entries) // ['index.ts', 'utils.ts', 'components']
```



### readdirAsync

Asynchronously reads the contents of a directory.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | ✓ | Parameter path |

**Returns:** `Promise<string[]>`



### readDir

Asynchronously reads the contents of a directory (camelCase spelling).

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | ✓ | Parameter path |

**Returns:** `Promise<string[]>`



### readDirSync

Synchronously reads the contents of a directory (camelCase spelling).

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | ✓ | Parameter path |

**Returns:** `string[]`



### writeFile

Synchronously writes content to a file.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | ✓ | The file path where content should be written |
| `content` | `Buffer | string` | ✓ | The content to write to the file |

**Returns:** `void`

```ts
fs.writeFile('output.txt', 'Hello World')
fs.writeFile('data.bin', Buffer.from([1, 2, 3, 4]))
```



### writeFileSync

Synchronously writes content to a file (node's name).

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | ✓ | Parameter path |
| `content` | `Buffer | string` | ✓ | Parameter content |

**Returns:** `void`



### writeFileAsync

Asynchronously writes content to a file.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | ✓ | The file path where content should be written |
| `content` | `Buffer | string` | ✓ | The content to write to the file |

**Returns:** `Promise<void>`

```ts
await fs.writeFileAsync('output.txt', 'Hello World')
await fs.writeFileAsync('data.bin', Buffer.from([1, 2, 3, 4]))
```



### writeJson

Synchronously writes an object to a file as JSON.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | ✓ | The file path where the JSON should be written |
| `data` | `any` | ✓ | The data to serialize as JSON |
| `indent` | `number` |  | The number of spaces to use for indentation |

**Returns:** `void`

```ts
fs.writeJson('config.json', { version: '1.0.0', debug: false })
```



### writeJsonSync

Synchronously writes an object to a file as JSON.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | ✓ | Parameter path |
| `data` | `any` | ✓ | Parameter data |
| `indent` | `number` |  | Parameter indent |

**Returns:** `void`



### writeJsonAsync

Asynchronously writes an object to a file as JSON.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | ✓ | The file path where the JSON should be written |
| `data` | `any` | ✓ | The data to serialize as JSON |
| `indent` | `number` |  | The number of spaces to use for indentation |

**Returns:** `Promise<void>`

```ts
await fs.writeJsonAsync('config.json', { version: '1.0.0', debug: false })
```



### appendFile

Synchronously appends content to a file.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | ✓ | The file path to append to |
| `content` | `Buffer | string` | ✓ | The content to append |

**Returns:** `void`

```ts
fs.appendFile('log.txt', 'New line\n')
```



### appendFileSync

Synchronously appends content to a file (node's name).

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | ✓ | Parameter path |
| `content` | `Buffer | string` | ✓ | Parameter content |

**Returns:** `void`



### appendFileAsync

Asynchronously appends content to a file.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | ✓ | The file path to append to |
| `content` | `Buffer | string` | ✓ | The content to append |

**Returns:** `Promise<void>`

```ts
await fs.appendFileAsync('log.txt', 'New line\n')
```



### ensureFile

Synchronously ensures a file exists with the specified content, creating directories as needed.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | ✓ | The file path where the file should be created |
| `content` | `string` | ✓ | The content to write to the file |
| `overwrite` | `any` |  | Whether to overwrite the file if it already exists |

**Returns:** `string`

```ts
fs.ensureFile('logs/app.log', '', false)
```



### ensureFileAsync

Asynchronously ensures a file exists with the specified content, creating directories as needed.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | ✓ | The file path where the file should be created |
| `content` | `string` | ✓ | The content to write to the file |
| `overwrite` | `any` |  | Whether to overwrite the file if it already exists |

**Returns:** `Promise<string>`

```ts
await fs.ensureFileAsync('config/settings.json', '{}', true)
```



### ensureFolder

Synchronously ensures a directory exists, creating parent directories as needed.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | ✓ | The directory path to create |

**Returns:** `string`

```ts
fs.ensureFolder('logs/debug')
```



### ensureFolderAsync

Asynchronously ensures a directory exists, creating parent directories as needed.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | ✓ | The directory path to create |

**Returns:** `Promise<string>`

```ts
await fs.ensureFolderAsync('logs/debug')
```



### mkdirp

Alias for ensureFolder. Synchronously creates a directory and all parent directories.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `folder` | `string` | ✓ | The directory path to create |

**Returns:** `string`

```ts
fs.mkdirp('deep/nested/path')
```



### mkdir

Synchronously creates a directory, including parent directories — always recursive. Node-style options are accepted and ignored (`recursive` is always on).

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | ✓ | The directory path to create |
| `_options` | `{ recursive?: boolean }` |  | Accepted for node compatibility; creation is always recursive |

**Returns:** `string`

```ts
fs.mkdir('logs/debug')
```



### mkdirSync

Synchronously creates a directory, including parent directories — always recursive.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | ✓ | Parameter path |
| `_options` | `{ recursive?: boolean }` |  | Parameter _options |

**Returns:** `string`



### mkdirAsync

Asynchronously creates a directory, including parent directories — always recursive.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | ✓ | Parameter path |
| `_options` | `{ recursive?: boolean }` |  | Parameter _options |

**Returns:** `Promise<string>`



### ensureDir

Synchronously ensures a directory exists (fs-extra's name).

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | ✓ | Parameter path |

**Returns:** `string`



### ensureDirAsync

Asynchronously ensures a directory exists (fs-extra's name).

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | ✓ | Parameter path |

**Returns:** `Promise<string>`



### exists

Synchronously checks if a file or directory exists.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | ✓ | The path to check for existence |

**Returns:** `boolean`

```ts
if (fs.exists('config.json')) {
 console.log('Config file exists!')
}
```



### existsSync

Alias for exists. Synchronously checks if a file or directory exists.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | ✓ | The path to check for existence |

**Returns:** `boolean`

```ts
if (fs.existsSync('config.json')) {
 console.log('Config file exists!')
}
```



### existsAsync

Asynchronously checks if a file or directory exists.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | ✓ | The path to check for existence |

**Returns:** `Promise<boolean>`

```ts
if (await fs.existsAsync('config.json')) {
 console.log('Config file exists!')
}
```



### pathExists

Asynchronously checks if a path exists (fs-extra's name).

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | ✓ | Parameter path |

**Returns:** `Promise<boolean>`



### pathExistsSync

Synchronously checks if a path exists (fs-extra's name).

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | ✓ | Parameter path |

**Returns:** `boolean`



### isSymlink

Checks if a path is a symbolic link.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | ✓ | The path to check |

**Returns:** `boolean`



### realpath

Resolves a symlink to its real path. Returns the resolved path as-is if not a symlink.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | ✓ | The path to resolve |

**Returns:** `string`



### stat

Synchronously returns the stat object for a file or directory.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | ✓ | The path to stat |

**Returns:** `Stats`

```ts
const info = fs.stat('package.json')
console.log(info.size, info.mtime)
```



### statSync

Synchronously returns the stat object for a file or directory (node's name).

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | ✓ | Parameter path |

**Returns:** `Stats`



### statAsync

Asynchronously returns the stat object for a file or directory.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | ✓ | The path to stat |

**Returns:** `Promise<Stats>`

```ts
const info = await fs.statAsync('package.json')
console.log(info.size, info.mtime)
```



### isFile

Synchronously checks if a path is a file.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | ✓ | The path to check |

**Returns:** `boolean`

```ts
if (fs.isFile('package.json')) {
 console.log('It is a file')
}
```



### isFileAsync

Asynchronously checks if a path is a file.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | ✓ | The path to check |

**Returns:** `Promise<boolean>`

```ts
if (await fs.isFileAsync('package.json')) {
 console.log('It is a file')
}
```



### isDirectory

Synchronously checks if a path is a directory.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | ✓ | The path to check |

**Returns:** `boolean`

```ts
if (fs.isDirectory('src')) {
 console.log('It is a directory')
}
```



### isDirectoryAsync

Asynchronously checks if a path is a directory.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | ✓ | The path to check |

**Returns:** `Promise<boolean>`

```ts
if (await fs.isDirectoryAsync('src')) {
 console.log('It is a directory')
}
```



### rmSync

Synchronously removes a file. Accepts node-style `{ recursive, force }` options, so `fs.rmSync('dir', { recursive: true })` works on directories too.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | ✓ | The path of the file to remove |
| `options` | `{ recursive?: boolean; force?: boolean }` |  | Node-compatible options |

`{ recursive?: boolean; force?: boolean }` properties:

| Property | Type | Description |
|----------|------|-------------|
| `recursive` | `any` | Remove directories and their contents |
| `force` | `any` | Don't throw if the path doesn't exist |

**Returns:** `void`

```ts
fs.rmSync('temp/cache.tmp')
fs.rmSync('temp/cache', { recursive: true })
```



### rm

Asynchronously removes a file. Accepts node-style `{ recursive, force }` options, so `await fs.rm('dir', { recursive: true })` works on directories too.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | ✓ | The path of the file to remove |
| `options` | `{ recursive?: boolean; force?: boolean }` |  | Node-compatible options |

`{ recursive?: boolean; force?: boolean }` properties:

| Property | Type | Description |
|----------|------|-------------|
| `recursive` | `any` | Remove directories and their contents |
| `force` | `any` | Don't throw if the path doesn't exist |

**Returns:** `Promise<void>`

```ts
fs.ensureFile('temp/cache.tmp', '')
await fs.rm('temp/cache.tmp')
await fs.rm('temp/cache', { recursive: true, force: true })
```



### rmdirSync

Synchronously removes a directory and all its contents. Already recursive — node-style options are accepted and ignored for compatibility.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `dirPath` | `string` | ✓ | The path of the directory to remove |
| `_options` | `{ recursive?: boolean; force?: boolean }` |  | Accepted for node compatibility; removal is always recursive and forced |

**Returns:** `void`

```ts
fs.rmdirSync('temp/cache')
```



### rmdir

Asynchronously removes a directory and all its contents. Already recursive — node-style options are accepted and ignored for compatibility.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `dirPath` | `string` | ✓ | The path of the directory to remove |
| `_options` | `{ recursive?: boolean; force?: boolean }` |  | Accepted for node compatibility; removal is always recursive and forced |

**Returns:** `Promise<void>`

```ts
await fs.rmdir('temp/cache')
```



### remove

Removes a file or directory recursively — whatever the path is, it's gone (fs-extra's `remove`). No error if the path doesn't exist.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | ✓ | The file or directory to remove |

**Returns:** `Promise<void>`

```ts
await fs.remove('temp')          // directory
await fs.remove('temp/file.txt') // or file — both fine
```



### removeSync

Synchronously removes a file or directory recursively (fs-extra's `removeSync`). No error if the path doesn't exist.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | ✓ | The file or directory to remove |

**Returns:** `void`

```ts
fs.removeSync('temp')
```



### deleteFile

Synchronously deletes a file.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | ✓ | The path of the file to delete |

**Returns:** `void`

```ts
fs.deleteFile('temp/cache.tmp')
```



### deleteFileAsync

Asynchronously deletes a file.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | ✓ | The path of the file to delete |

**Returns:** `Promise<void>`

```ts
await fs.deleteFileAsync('temp/cache.tmp')
```



### unlink

Asynchronously removes a file (node's `fs/promises` name).

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | ✓ | Parameter path |

**Returns:** `void`



### unlinkSync

Synchronously removes a file (node's name).

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | ✓ | Parameter path |

**Returns:** `void`



### rmAsync

Asynchronously removes a file.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `path` | `string` | ✓ | Parameter path |
| `options` | `{ recursive?: boolean; force?: boolean }` |  | Parameter options |

**Returns:** `void`



### rmdirAsync

Asynchronously removes a directory and all its contents.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `dirPath` | `string` | ✓ | Parameter dirPath |

**Returns:** `void`



### copy

Synchronously copies a file or directory. Auto-detects whether the source is a file or directory and handles each appropriately (recursive for directories).

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `src` | `string` | ✓ | The source path to copy from |
| `dest` | `string` | ✓ | The destination path to copy to |
| `options` | `{ overwrite?: boolean }` |  | Copy options |

`{ overwrite?: boolean }` properties:

| Property | Type | Description |
|----------|------|-------------|
| `overwrite` | `any` | Whether to overwrite existing files at the destination |

**Returns:** `void`

```ts
fs.copy('src/index.ts', 'backup/index.ts')
fs.copy('src', 'backup/src')
```



### copySync

Synchronously copies a file or directory.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `src` | `string` | ✓ | Parameter src |
| `dest` | `string` | ✓ | Parameter dest |
| `options` | `{ overwrite?: boolean }` |  | Parameter options |

**Returns:** `void`



### cp

Asynchronously copies a file or directory (node's `fs/promises` name).

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `src` | `string` | ✓ | Parameter src |
| `dest` | `string` | ✓ | Parameter dest |
| `options` | `{ overwrite?: boolean }` |  | Parameter options |

**Returns:** `void`



### cpSync

Synchronously copies a file or directory (node's name).

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `src` | `string` | ✓ | Parameter src |
| `dest` | `string` | ✓ | Parameter dest |
| `options` | `{ overwrite?: boolean }` |  | Parameter options |

**Returns:** `void`



### copyAsync

Asynchronously copies a file or directory. Auto-detects whether the source is a file or directory and handles each appropriately (recursive for directories).

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `src` | `string` | ✓ | The source path to copy from |
| `dest` | `string` | ✓ | The destination path to copy to |
| `options` | `{ overwrite?: boolean }` |  | Copy options |

`{ overwrite?: boolean }` properties:

| Property | Type | Description |
|----------|------|-------------|
| `overwrite` | `any` | Whether to overwrite existing files at the destination |

**Returns:** `Promise<void>`

```ts
await fs.copyAsync('src/index.ts', 'backup/index.ts')
await fs.copyAsync('src', 'backup/src')
```



### move

Synchronously moves (renames) a file or directory. Falls back to copy + delete for cross-device moves.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `src` | `string` | ✓ | The source path to move from |
| `dest` | `string` | ✓ | The destination path to move to |

**Returns:** `void`

```ts
fs.ensureFile('temp/draft.txt', 'work in progress')
fs.move('temp/draft.txt', 'final/document.txt')

fs.ensureFolder('old-dir')
fs.move('old-dir', 'new-dir')
```



### moveAsync

Asynchronously moves (renames) a file or directory. Falls back to copy + delete for cross-device moves.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `src` | `string` | ✓ | The source path to move from |
| `dest` | `string` | ✓ | The destination path to move to |

**Returns:** `Promise<void>`

```ts
await fs.ensureFileAsync('temp/draft.txt', 'work in progress')
await fs.moveAsync('temp/draft.txt', 'final/document.txt')

await fs.ensureFolderAsync('old-dir')
await fs.moveAsync('old-dir', 'new-dir')
```



### moveSync

Synchronously moves a file or directory.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `src` | `string` | ✓ | Parameter src |
| `dest` | `string` | ✓ | Parameter dest |

**Returns:** `void`



### rename

Asynchronously moves (renames) a file or directory (node's `fs/promises` name).

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `src` | `string` | ✓ | Parameter src |
| `dest` | `string` | ✓ | Parameter dest |

**Returns:** `void`



### renameSync

Synchronously moves (renames) a file or directory (node's name).

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `src` | `string` | ✓ | Parameter src |
| `dest` | `string` | ✓ | Parameter dest |

**Returns:** `void`



### walk

Recursively walks a directory and returns arrays of file and directory paths. By default paths are absolute. Pass `relative: true` to get paths relative to `basePath`. Supports filtering with exclude and include glob patterns.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `basePath` | `string` | ✓ | The base directory path to start walking from |
| `options` | `WalkOptions` |  | Options to configure the walk behavior |

`WalkOptions` properties:

| Property | Type | Description |
|----------|------|-------------|
| `directories` | `boolean` | Whether to include directories in results |
| `files` | `boolean` | Whether to include files in results |
| `exclude` | `string | string[]` | ] - Glob patterns to exclude (e.g. 'node_modules', '*.log') |
| `include` | `string | string[]` | ] - Glob patterns to include (only matching paths are returned) |
| `relative` | `boolean` | When true, returned paths are relative to `baseDir` instead of absolute. |

**Returns:** `{ directories: string[], files: string[] }`

```ts
const result = fs.walk('src', { files: true, directories: false })
const filtered = fs.walk('.', { exclude: ['node_modules', '.git'], include: ['*.ts'] })

fs.ensureFile('inbox/contact-1.json', '{}')
const relative = fs.walk('inbox', { relative: true }) // => { files: ['contact-1.json'] }
```



### walkAsync

Asynchronously and recursively walks a directory and returns arrays of file and directory paths. By default paths are absolute. Pass `relative: true` to get paths relative to `baseDir`. Supports filtering with exclude and include glob patterns.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `baseDir` | `string` | ✓ | The base directory path to start walking from |
| `options` | `WalkOptions` |  | Options to configure the walk behavior |

`WalkOptions` properties:

| Property | Type | Description |
|----------|------|-------------|
| `directories` | `boolean` | Whether to include directories in results |
| `files` | `boolean` | Whether to include files in results |
| `exclude` | `string | string[]` | ] - Glob patterns to exclude (e.g. 'node_modules', '.git') |
| `include` | `string | string[]` | ] - Glob patterns to include (only matching paths are returned) |
| `relative` | `boolean` | When true, returned paths are relative to `baseDir` instead of absolute. |

**Returns:** `Promise<{ directories: string[], files: string[] }>`

```ts
const result = await fs.walkAsync('src', { exclude: ['node_modules'] })

await fs.ensureFileAsync('inbox/contact-1.json', '{}')
const files = await fs.walkAsync('inbox', { relative: true })
// files.files => ['contact-1.json']
```



### findUp

Synchronously finds a file by walking up the directory tree from the current working directory.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `fileName` | `string` | ✓ | The name of the file to search for |
| `options` | `{ cwd?: string }` |  | Options for the search |

`{ cwd?: string }` properties:

| Property | Type | Description |
|----------|------|-------------|
| `cwd` | `any` | The directory to start searching from (defaults to container.cwd) |

**Returns:** `string | null`

```ts
const packageJson = fs.findUp('package.json')
if (packageJson) {
 console.log(`Found package.json at: ${packageJson}`)
}
```



### findUpAsync

Asynchronously finds a file by walking up the directory tree.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `fileName` | `string` | ✓ | The name of the file to search for |
| `options` | `{ cwd?: string; multiple?: boolean }` |  | Options for the search |

`{ cwd?: string; multiple?: boolean }` properties:

| Property | Type | Description |
|----------|------|-------------|
| `cwd` | `any` | The directory to start searching from (defaults to container.cwd) |
| `multiple` | `any` | Whether to find multiple instances of the file |

**Returns:** `Promise<string | string[] | null>`

```ts
const packageJson = await fs.findUpAsync('package.json')
const allPackageJsons = await fs.findUpAsync('package.json', { multiple: true })
```



## State (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `boolean` | Whether this feature is currently enabled |

## Examples

**features.fs**

```ts
const fs = container.feature('fs')
const content = fs.readFile('package.json')
const exists = fs.exists('tsconfig.json')
await fs.writeFileAsync('output.txt', 'Hello World')
fs.writeFile('sync-output.txt', 'Hello Sync')
fs.copy('src', 'backup/src')
```



**readFile**

```ts
const content = fs.readFile('README.md')          // string (utf-8)
fs.writeFile('logo.png', Buffer.from([0x89, 0x50, 0x4e, 0x47]))
const buffer = fs.readFile('logo.png', null)      // Buffer — safe for binary data
```



**readFileAsync**

```ts
const content = await fs.readFileAsync('README.md')
const buffer = await fs.readFileAsync('data.json', null) // pass null for a raw Buffer
```



**readJson**

```ts
const pkg = fs.readJson('package.json')
console.log(pkg.version)
```



**readJsonAsync**

```ts
const pkg = await fs.readJsonAsync('package.json')
console.log(pkg.version)
```



**readdirSync**

```ts
const entries = fs.readdirSync('src')
console.log(entries) // ['index.ts', 'utils.ts', 'components']
```



**readdir**

```ts
const entries = await fs.readdir('src')
console.log(entries) // ['index.ts', 'utils.ts', 'components']
```



**writeFile**

```ts
fs.writeFile('output.txt', 'Hello World')
fs.writeFile('data.bin', Buffer.from([1, 2, 3, 4]))
```



**writeFileAsync**

```ts
await fs.writeFileAsync('output.txt', 'Hello World')
await fs.writeFileAsync('data.bin', Buffer.from([1, 2, 3, 4]))
```



**writeJson**

```ts
fs.writeJson('config.json', { version: '1.0.0', debug: false })
```



**writeJsonAsync**

```ts
await fs.writeJsonAsync('config.json', { version: '1.0.0', debug: false })
```



**appendFile**

```ts
fs.appendFile('log.txt', 'New line\n')
```



**appendFileAsync**

```ts
await fs.appendFileAsync('log.txt', 'New line\n')
```



**ensureFile**

```ts
fs.ensureFile('logs/app.log', '', false)
```



**ensureFileAsync**

```ts
await fs.ensureFileAsync('config/settings.json', '{}', true)
```



**ensureFolder**

```ts
fs.ensureFolder('logs/debug')
```



**ensureFolderAsync**

```ts
await fs.ensureFolderAsync('logs/debug')
```



**mkdirp**

```ts
fs.mkdirp('deep/nested/path')
```



**mkdir**

```ts
fs.mkdir('logs/debug')
```



**exists**

```ts
if (fs.exists('config.json')) {
 console.log('Config file exists!')
}
```



**existsSync**

```ts
if (fs.existsSync('config.json')) {
 console.log('Config file exists!')
}
```



**existsAsync**

```ts
if (await fs.existsAsync('config.json')) {
 console.log('Config file exists!')
}
```



**stat**

```ts
const info = fs.stat('package.json')
console.log(info.size, info.mtime)
```



**statAsync**

```ts
const info = await fs.statAsync('package.json')
console.log(info.size, info.mtime)
```



**isFile**

```ts
if (fs.isFile('package.json')) {
 console.log('It is a file')
}
```



**isFileAsync**

```ts
if (await fs.isFileAsync('package.json')) {
 console.log('It is a file')
}
```



**isDirectory**

```ts
if (fs.isDirectory('src')) {
 console.log('It is a directory')
}
```



**isDirectoryAsync**

```ts
if (await fs.isDirectoryAsync('src')) {
 console.log('It is a directory')
}
```



**rmSync**

```ts
fs.rmSync('temp/cache.tmp')
fs.rmSync('temp/cache', { recursive: true })
```



**rm**

```ts
fs.ensureFile('temp/cache.tmp', '')
await fs.rm('temp/cache.tmp')
await fs.rm('temp/cache', { recursive: true, force: true })
```



**rmdirSync**

```ts
fs.rmdirSync('temp/cache')
```



**rmdir**

```ts
await fs.rmdir('temp/cache')
```



**remove**

```ts
await fs.remove('temp')          // directory
await fs.remove('temp/file.txt') // or file — both fine
```



**removeSync**

```ts
fs.removeSync('temp')
```



**deleteFile**

```ts
fs.deleteFile('temp/cache.tmp')
```



**deleteFileAsync**

```ts
await fs.deleteFileAsync('temp/cache.tmp')
```



**copy**

```ts
fs.copy('src/index.ts', 'backup/index.ts')
fs.copy('src', 'backup/src')
```



**copyAsync**

```ts
await fs.copyAsync('src/index.ts', 'backup/index.ts')
await fs.copyAsync('src', 'backup/src')
```



**move**

```ts
fs.ensureFile('temp/draft.txt', 'work in progress')
fs.move('temp/draft.txt', 'final/document.txt')

fs.ensureFolder('old-dir')
fs.move('old-dir', 'new-dir')
```



**moveAsync**

```ts
await fs.ensureFileAsync('temp/draft.txt', 'work in progress')
await fs.moveAsync('temp/draft.txt', 'final/document.txt')

await fs.ensureFolderAsync('old-dir')
await fs.moveAsync('old-dir', 'new-dir')
```



**walk**

```ts
const result = fs.walk('src', { files: true, directories: false })
const filtered = fs.walk('.', { exclude: ['node_modules', '.git'], include: ['*.ts'] })

fs.ensureFile('inbox/contact-1.json', '{}')
const relative = fs.walk('inbox', { relative: true }) // => { files: ['contact-1.json'] }
```



**walkAsync**

```ts
const result = await fs.walkAsync('src', { exclude: ['node_modules'] })

await fs.ensureFileAsync('inbox/contact-1.json', '{}')
const files = await fs.walkAsync('inbox', { relative: true })
// files.files => ['contact-1.json']
```



**findUp**

```ts
const packageJson = fs.findUp('package.json')
if (packageJson) {
 console.log(`Found package.json at: ${packageJson}`)
}
```



**findUpAsync**

```ts
const packageJson = await fs.findUpAsync('package.json')
const allPackageJsons = await fs.findUpAsync('package.json', { multiple: true })
```

