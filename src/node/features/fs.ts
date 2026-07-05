import { Feature } from "../feature.js";
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'
import {
  mkdirSync,
  writeFileSync,
  appendFileSync,
  readdirSync,
  statSync,
  readFileSync,
  cpSync,
  renameSync,
  lstatSync,
  realpathSync,

  rmSync as nodeRmSync,
  type Stats,
} from "fs";
import { join, resolve, dirname, relative } from "path";
import { readFile, stat, lstat, realpath, unlink, mkdir, writeFile, appendFile, readdir, cp, rename, rm as nodeRm } from "fs/promises";
import { native as rimraf } from 'rimraf'
import micromatch from 'micromatch'

type WalkOptions = {
  directories?: boolean;
  files?: boolean;
  exclude?: string | string[];
  include?: string | string[];
  /** When true, returned paths are relative to `baseDir` instead of absolute. */
  relative?: boolean;
};

/**
 * Checks whether a path matches any of the given glob-like patterns.
 * Delegates to micromatch for correct glob semantics (**, *, {}, etc.).
 */
function matchesPattern(filePath: string, patterns: string[]): boolean {
  return micromatch.isMatch(filePath, patterns, { dot: true })
}

/** Sync: check if a symlink target is a directory */
function lstatFollowIsDir(fullPath: string): boolean {
  try { return statSync(fullPath).isDirectory() } catch { return false }
}

/** Async: check if a symlink target is a directory */
async function lstatFollowIsDirAsync(fullPath: string): Promise<boolean> {
  try { return (await stat(fullPath)).isDirectory() } catch { return false }
}

/**
 * The FS feature provides methods for interacting with the file system, relative to the
 * container's cwd.
 *
 * @extends Feature
 *
 * @example
 * ```typescript
 * const fs = container.feature('fs')
 * const content = fs.readFile('package.json')
 * const exists = fs.exists('tsconfig.json')
 * await fs.writeFileAsync('output.txt', 'Hello World')
 * fs.writeFile('sync-output.txt', 'Hello Sync')
 * fs.copy('src', 'backup/src')
 * ```
 */
export class FS extends Feature {
  static override shortcut = "features.fs" as const
  static override stability = 'core' as const
  static override stateSchema = FeatureStateSchema
  static override optionsSchema = FeatureOptionsSchema
  static { Feature.register(this, 'fs') }

  // ---------------------------------------------------------------------------
  // Read
  // ---------------------------------------------------------------------------

  /**
   * Synchronously reads a file and returns its contents as a string.
   *
   * **Binary files: pass `null` as the encoding to get a raw Buffer.** The default
   * encoding is utf-8, which silently corrupts binary content (images, zips, PDFs,
   * compiled binaries) — invalid byte sequences are replaced and the data cannot be
   * round-tripped. `fs.readFile('image.png')` returns garbage;
   * `fs.readFile('image.png', null)` returns the real bytes.
   *
   * @param {string} path - The file path relative to the container's working directory
   * @param {BufferEncoding | null} [encoding='utf-8'] - The encoding to use. Pass null to get a raw Buffer (required for binary files).
   * @returns {string | Buffer} The file contents as a string (default) or Buffer if encoding is null
   * @throws {Error} Throws an error if the file doesn't exist or cannot be read
   *
   * @example
   * ```typescript
   * const content = fs.readFile('README.md')          // string (utf-8)
   * fs.writeFile('logo.png', Buffer.from([0x89, 0x50, 0x4e, 0x47]))
   * const buffer = fs.readFile('logo.png', null)      // Buffer — safe for binary data
   * ```
   */
  readFile(path: string, encoding?: BufferEncoding | null): string | Buffer {
    const filePath = this.container.paths.resolve(path);
    if (encoding === null) {
      return readFileSync(filePath)
    }
    return readFileSync(filePath, encoding ?? 'utf-8')
  }

  /**
   * Synchronously reads a file and returns its contents as a string.
   * added this method because AI Assistants are understandly confused by this deviation from 2000's era node style
   * @alias readFile
   */
  readFileSync(path: string, encoding?: BufferEncoding | null): string | Buffer {
    return this.readFile(path,encoding)
  }
  

  /**
   * Asynchronously reads a file and returns its contents as a string.
   *
   * @param {string} path - The file path relative to the container's working directory
   * @param {BufferEncoding | null} [encoding='utf-8'] - The encoding to use. Pass null to get a raw Buffer.
   * @returns {Promise<string | Buffer>} A promise that resolves to the file contents as a string (default) or Buffer
   * @throws {Error} Throws an error if the file doesn't exist or cannot be read
   *
   * @example
   * ```typescript
   * const content = await fs.readFileAsync('README.md')
   * const buffer = await fs.readFileAsync('data.json', null) // pass null for a raw Buffer
   * ```
   */
  async readFileAsync(path: string, encoding?: BufferEncoding | null): Promise<string | Buffer> {
    const filePath = this.container.paths.resolve(path);
    if (encoding === null) {
      return await readFile(filePath)
    }
    return await readFile(filePath, encoding ?? 'utf-8')
  }

  /**
   * Synchronously reads and parses a JSON file.
   *
   * @param {string} path - The path to the JSON file
   * @returns {any} The parsed JSON content
   * @throws {Error} Throws an error if the file doesn't exist, cannot be read, or contains invalid JSON
   *
   * @example
   * ```typescript
   * const pkg = fs.readJson('package.json')
   * console.log(pkg.version)
   * ```
   */
  readJson(path: string): any {
    return JSON.parse(this.readFile(path) as string)
  }
  
  /**
    * Read and parse a JSON file synchronously
    * @alias readJson
   */
  readJsonSync(path: string): any {
    return this.readJson(path)
  }

  /**
   * Asynchronously reads and parses a JSON file.
   *
   * @param {string} path - The path to the JSON file
   * @returns {Promise<any>} A promise that resolves to the parsed JSON content
   * @throws {Error} Throws an error if the file doesn't exist, cannot be read, or contains invalid JSON
   *
   * @example
   * ```typescript
   * const pkg = await fs.readJsonAsync('package.json')
   * console.log(pkg.version)
   * ```
   */
  async readJsonAsync(path: string): Promise<any> {
    const content = await this.readFileAsync(path)
    return JSON.parse(content as string)
  }

  /**
   * Synchronously reads the contents of a directory.
   *
   * @param {string} path - The directory path relative to the container's working directory
   * @returns {string[]} An array of file and directory names
   * @throws {Error} Throws an error if the directory doesn't exist or cannot be read
   *
   * @example
   * ```typescript
   * const entries = fs.readdirSync('src')
   * console.log(entries) // ['index.ts', 'utils.ts', 'components']
   * ```
   */
  readdirSync(path: string): string[] {
    return readdirSync(this.container.paths.resolve(path))
  }

  /**
   * Asynchronously reads the contents of a directory.
   *
   * @param {string} path - The directory path relative to the container's working directory
   * @returns {Promise<string[]>} A promise that resolves to an array of file and directory names
   * @throws {Error} Throws an error if the directory doesn't exist or cannot be read
   *
   * @example
   * ```typescript
   * const entries = await fs.readdir('src')
   * console.log(entries) // ['index.ts', 'utils.ts', 'components']
   * ```
   */
  async readdir(path: string): Promise<string[]> {
    return await readdir(this.container.paths.resolve(path))
  }

  /**
   * Asynchronously reads the contents of a directory.
   * @alias readdir
   */
  async readdirAsync(path: string): Promise<string[]> {
    return this.readdir(path)
  }

  /**
   * Asynchronously reads the contents of a directory (camelCase spelling).
   * @alias readdir
   */
  async readDir(path: string): Promise<string[]> {
    return this.readdir(path)
  }

  /**
   * Synchronously reads the contents of a directory (camelCase spelling).
   * @alias readdirSync
   */
  readDirSync(path: string): string[] {
    return this.readdirSync(path)
  }

  // ---------------------------------------------------------------------------
  // Write
  // ---------------------------------------------------------------------------

  /**
   * Synchronously writes content to a file.
   *
   * @param {string} path - The file path where content should be written
   * @param {Buffer | string} content - The content to write to the file
   * @throws {Error} Throws an error if the file cannot be written
   *
   * @example
   * ```typescript
   * fs.writeFile('output.txt', 'Hello World')
   * fs.writeFile('data.bin', Buffer.from([1, 2, 3, 4]))
   * ```
   */
  writeFile(path: string, content: Buffer | string): void {
    writeFileSync(this.container.paths.resolve(path), content)
  }

  /**
   * Synchronously writes content to a file (node's name).
   * @alias writeFile
   */
  writeFileSync(path: string, content: Buffer | string): void {
    this.writeFile(path, content)
  }

  /**
   * Asynchronously writes content to a file.
   *
   * @param {string} path - The file path where content should be written
   * @param {Buffer | string} content - The content to write to the file
   * @returns {Promise<void>} A promise that resolves when the file is written
   * @throws {Error} Throws an error if the file cannot be written
   *
   * @example
   * ```typescript
   * await fs.writeFileAsync('output.txt', 'Hello World')
   * await fs.writeFileAsync('data.bin', Buffer.from([1, 2, 3, 4]))
   * ```
   */
  async writeFileAsync(path: string, content: Buffer | string) {
    return writeFile(this.container.paths.resolve(path), content)
  }

  /**
   * Synchronously writes an object to a file as JSON.
   *
   * @param {string} path - The file path where the JSON should be written
   * @param {any} data - The data to serialize as JSON
   * @param {number} [indent=2] - The number of spaces to use for indentation
   * @throws {Error} Throws an error if the file cannot be written
   *
   * @example
   * ```typescript
   * fs.writeJson('config.json', { version: '1.0.0', debug: false })
   * ```
   */
  writeJson(path: string, data: any, indent: number = 2): void {
    this.writeFile(path, JSON.stringify(data, null, indent) + '\n')
  }

  /**
   * Synchronously writes an object to a file as JSON.
   * @alias writeJson
   */
  writeJsonSync(path: string, data: any, indent: number = 2): void {
    this.writeJson(path, data, indent)
  }

  /**
   * Asynchronously writes an object to a file as JSON.
   *
   * @param {string} path - The file path where the JSON should be written
   * @param {any} data - The data to serialize as JSON
   * @param {number} [indent=2] - The number of spaces to use for indentation
   * @returns {Promise<void>} A promise that resolves when the file is written
   * @throws {Error} Throws an error if the file cannot be written
   *
   * @example
   * ```typescript
   * await fs.writeJsonAsync('config.json', { version: '1.0.0', debug: false })
   * ```
   */
  async writeJsonAsync(path: string, data: any, indent: number = 2) {
    return this.writeFileAsync(path, JSON.stringify(data, null, indent) + '\n')
  }

  /**
   * Synchronously appends content to a file.
   *
   * @param {string} path - The file path to append to
   * @param {Buffer | string} content - The content to append
   *
   * @example
   * ```typescript
   * fs.appendFile('log.txt', 'New line\n')
   * ```
   */
  appendFile(path: string, content: Buffer | string): void {
    appendFileSync(this.container.paths.resolve(path), content)
  }

  /**
   * Synchronously appends content to a file (node's name).
   * @alias appendFile
   */
  appendFileSync(path: string, content: Buffer | string): void {
    this.appendFile(path, content)
  }

  /**
   * Asynchronously appends content to a file.
   *
   * @param {string} path - The file path to append to
   * @param {Buffer | string} content - The content to append
   * @returns {Promise<void>} A promise that resolves when the content is appended
   *
   * @example
   * ```typescript
   * await fs.appendFileAsync('log.txt', 'New line\n')
   * ```
   */
  async appendFileAsync(path: string, content: Buffer | string) {
    return appendFile(this.container.paths.resolve(path), content)
  }

  // ---------------------------------------------------------------------------
  // Ensure (create if missing)
  // ---------------------------------------------------------------------------

  /**
   * Synchronously ensures a file exists with the specified content, creating directories as needed.
   *
   * @param {string} path - The file path where the file should be created
   * @param {string} content - The content to write to the file
   * @param {boolean} [overwrite=false] - Whether to overwrite the file if it already exists
   * @returns {string} The resolved file path
   * @throws {Error} Throws an error if the file cannot be created or written
   *
   * @example
   * ```typescript
   * fs.ensureFile('logs/app.log', '', false)
   * ```
   */
  ensureFile(path: string, content: string, overwrite = false): string {
    path = this.container.paths.resolve(path);

    if (this.exists(path) && !overwrite) {
      return path;
    }

    const { dir } = this.container.paths.parse(path);
    mkdirSync(dir, { recursive: true });
    writeFileSync(path, content);
    return path;
  }

  /**
   * Asynchronously ensures a file exists with the specified content, creating directories as needed.
   *
   * @param {string} path - The file path where the file should be created
   * @param {string} content - The content to write to the file
   * @param {boolean} [overwrite=false] - Whether to overwrite the file if it already exists
   * @returns {Promise<string>} A promise that resolves to the absolute file path
   * @throws {Error} Throws an error if the file cannot be created or written
   *
   * @example
   * ```typescript
   * await fs.ensureFileAsync('config/settings.json', '{}', true)
   * ```
   */
  async ensureFileAsync(path: string, content: string, overwrite = false): Promise<string> {
    path = this.container.paths.resolve(path);

    if (this.exists(path) && !overwrite) {
      return path;
    }

    const { dir } = this.container.paths.parse(path);
    await mkdir(dir, { recursive: true });
    await writeFile(path, content);
    return path;
  }

  /**
   * Synchronously ensures a directory exists, creating parent directories as needed.
   *
   * @param {string} path - The directory path to create
   * @returns {string} The resolved directory path
   * @throws {Error} Throws an error if the directory cannot be created
   *
   * @example
   * ```typescript
   * fs.ensureFolder('logs/debug')
   * ```
   */
  ensureFolder(path: string): string {
    mkdirSync(this.container.paths.resolve(path), { recursive: true });
    return this.container.paths.resolve(path);
  }

  /**
   * Asynchronously ensures a directory exists, creating parent directories as needed.
   *
   * @param {string} path - The directory path to create
   * @returns {Promise<string>} A promise that resolves to the resolved directory path
   * @throws {Error} Throws an error if the directory cannot be created
   *
   * @example
   * ```typescript
   * await fs.ensureFolderAsync('logs/debug')
   * ```
   */
  async ensureFolderAsync(path: string): Promise<string> {
    const resolved = this.container.paths.resolve(path);
    await mkdir(resolved, { recursive: true });
    return resolved;
  }

  /**
   * Alias for ensureFolder. Synchronously creates a directory and all parent directories.
   *
   * @param {string} folder - The directory path to create
   * @returns {string} The resolved directory path
   *
   * @example
   * ```typescript
   * fs.mkdirp('deep/nested/path')
   * ```
   */
  mkdirp(folder: string): string {
    return this.ensureFolder(folder)
  }

  /**
   * Synchronously creates a directory, including parent directories — always recursive.
   * Node-style options are accepted and ignored (`recursive` is always on).
   * @alias ensureFolder
   *
   * @param {string} path - The directory path to create
   * @param {object} [_options] - Accepted for node compatibility; creation is always recursive
   * @returns {string} The resolved directory path
   *
   * @example
   * ```typescript
   * fs.mkdir('logs/debug')
   * ```
   */
  mkdir(path: string, _options: { recursive?: boolean } = {}): string {
    return this.ensureFolder(path)
  }

  /**
   * Synchronously creates a directory, including parent directories — always recursive.
   * @alias ensureFolder
   */
  mkdirSync(path: string, _options: { recursive?: boolean } = {}): string {
    return this.ensureFolder(path)
  }

  /**
   * Asynchronously creates a directory, including parent directories — always recursive.
   * @alias ensureFolderAsync
   */
  async mkdirAsync(path: string, _options: { recursive?: boolean } = {}): Promise<string> {
    return this.ensureFolderAsync(path)
  }

  /**
   * Synchronously ensures a directory exists (fs-extra's name).
   * @alias ensureFolder
   */
  ensureDir(path: string): string {
    return this.ensureFolder(path)
  }

  /**
   * Asynchronously ensures a directory exists (fs-extra's name).
   * @alias ensureFolderAsync
   */
  async ensureDirAsync(path: string): Promise<string> {
    return this.ensureFolderAsync(path)
  }

  // ---------------------------------------------------------------------------
  // Existence & stat
  // ---------------------------------------------------------------------------

  /**
   * Synchronously checks if a file or directory exists.
   *
   * @param {string} path - The path to check for existence
   * @returns {boolean} True if the path exists, false otherwise
   *
   * @example
   * ```typescript
   * if (fs.exists('config.json')) {
   *   console.log('Config file exists!')
   * }
   * ```
   */
  exists(path: string): boolean {
    const filePath = this.container.paths.resolve(path);
    try {
      statSync(filePath);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Alias for exists. Synchronously checks if a file or directory exists.
   *
   * @param {string} path - The path to check for existence
   * @returns {boolean} True if the path exists, false otherwise
   *
   * @example
   * ```typescript
   * if (fs.existsSync('config.json')) {
   *   console.log('Config file exists!')
   * }
   * ```
   */
  existsSync(path: string): boolean {
    return this.exists(path)
  }

  /**
   * Asynchronously checks if a file or directory exists.
   *
   * @param {string} path - The path to check for existence
   * @returns {Promise<boolean>} A promise that resolves to true if the path exists, false otherwise
   *
   * @example
   * ```typescript
   * if (await fs.existsAsync('config.json')) {
   *   console.log('Config file exists!')
   * }
   * ```
   */
  async existsAsync(path: string): Promise<boolean> {
    const filePath = this.container.paths.resolve(path);
    return stat(filePath).then(() => true).catch(() => false)
  }

  /**
   * Asynchronously checks if a path exists (fs-extra's name).
   * @alias existsAsync
   */
  async pathExists(path: string): Promise<boolean> {
    return this.existsAsync(path)
  }

  /**
   * Synchronously checks if a path exists (fs-extra's name).
   * @alias exists
   */
  pathExistsSync(path: string): boolean {
    return this.exists(path)
  }

  /**
   * Checks if a path is a symbolic link.
   *
   * @param {string} path - The path to check
   * @returns {boolean} True if the path is a symlink
   */
  isSymlink(path: string): boolean {
    const filePath = this.container.paths.resolve(path);
    try { return lstatSync(filePath).isSymbolicLink() } catch { return false }
  }

  /**
   * Resolves a symlink to its real path. Returns the resolved path as-is if not a symlink.
   *
   * @param {string} path - The path to resolve
   * @returns {string} The real path after resolving all symlinks
   */
  realpath(path: string): string {
    const filePath = this.container.paths.resolve(path);
    return realpathSync(filePath)
  }

  /**
   * Synchronously returns the stat object for a file or directory.
   *
   * @param {string} path - The path to stat
   * @returns {import('fs').Stats} The Stats object with size, timestamps, and type checks
   * @throws {Error} Throws an error if the path doesn't exist
   *
   * @example
   * ```typescript
   * const info = fs.stat('package.json')
   * console.log(info.size, info.mtime)
   * ```
   */
  stat(path: string): Stats {
    return statSync(this.container.paths.resolve(path))
  }

  /**
   * Synchronously returns the stat object for a file or directory (node's name).
   * @alias stat
   */
  statSync(path: string): Stats {
    return this.stat(path)
  }

  /**
   * Asynchronously returns the stat object for a file or directory.
   *
   * @param {string} path - The path to stat
   * @returns {Promise<import('fs').Stats>} A promise that resolves to the Stats object
   * @throws {Error} Throws an error if the path doesn't exist
   *
   * @example
   * ```typescript
   * const info = await fs.statAsync('package.json')
   * console.log(info.size, info.mtime)
   * ```
   */
  async statAsync(path: string): Promise<Stats> {
    return stat(this.container.paths.resolve(path))
  }

  /**
   * Synchronously checks if a path is a file.
   *
   * @param {string} path - The path to check
   * @returns {boolean} True if the path is a file, false otherwise
   *
   * @example
   * ```typescript
   * if (fs.isFile('package.json')) {
   *   console.log('It is a file')
   * }
   * ```
   */
  isFile(path: string): boolean {
    try {
      return statSync(this.container.paths.resolve(path)).isFile()
    } catch {
      return false
    }
  }

  /**
   * Asynchronously checks if a path is a file.
   *
   * @param {string} path - The path to check
   * @returns {Promise<boolean>} A promise that resolves to true if the path is a file
   *
   * @example
   * ```typescript
   * if (await fs.isFileAsync('package.json')) {
   *   console.log('It is a file')
   * }
   * ```
   */
  async isFileAsync(path: string): Promise<boolean> {
    return stat(this.container.paths.resolve(path)).then(s => s.isFile()).catch(() => false)
  }

  /**
   * Synchronously checks if a path is a directory.
   *
   * @param {string} path - The path to check
   * @returns {boolean} True if the path is a directory, false otherwise
   *
   * @example
   * ```typescript
   * if (fs.isDirectory('src')) {
   *   console.log('It is a directory')
   * }
   * ```
   */
  isDirectory(path: string): boolean {
    try {
      return statSync(this.container.paths.resolve(path)).isDirectory()
    } catch {
      return false
    }
  }

  /**
   * Asynchronously checks if a path is a directory.
   *
   * @param {string} path - The path to check
   * @returns {Promise<boolean>} A promise that resolves to true if the path is a directory
   *
   * @example
   * ```typescript
   * if (await fs.isDirectoryAsync('src')) {
   *   console.log('It is a directory')
   * }
   * ```
   */
  async isDirectoryAsync(path: string): Promise<boolean> {
    return stat(this.container.paths.resolve(path)).then(s => s.isDirectory()).catch(() => false)
  }

  // ---------------------------------------------------------------------------
  // Delete
  // ---------------------------------------------------------------------------

  /**
   * Synchronously removes a file. Accepts node-style `{ recursive, force }` options,
   * so `fs.rmSync('dir', { recursive: true })` works on directories too.
   *
   * @param {string} path - The path of the file to remove
   * @param {object} [options={}] - Node-compatible options
   * @param {boolean} [options.recursive=false] - Remove directories and their contents
   * @param {boolean} [options.force=true] - Don't throw if the path doesn't exist
   * @throws {Error} Throws an error if the path cannot be removed
   *
   * @example
   * ```typescript
   * fs.rmSync('temp/cache.tmp')
   * fs.rmSync('temp/cache', { recursive: true })
   * ```
   */
  rmSync(path: string, options: { recursive?: boolean; force?: boolean } = {}): void {
    const { recursive = false, force = true } = options
    nodeRmSync(this.container.paths.resolve(path), { recursive, force })
  }

  /**
   * Asynchronously removes a file. Accepts node-style `{ recursive, force }` options,
   * so `await fs.rm('dir', { recursive: true })` works on directories too.
   *
   * @param {string} path - The path of the file to remove
   * @param {object} [options={}] - Node-compatible options
   * @param {boolean} [options.recursive=false] - Remove directories and their contents
   * @param {boolean} [options.force=false] - Don't throw if the path doesn't exist
   * @returns {Promise<void>} A promise that resolves when the file is removed
   * @throws {Error} Throws an error if the path cannot be removed or doesn't exist
   *
   * @example
   * ```typescript
   * fs.ensureFile('temp/cache.tmp', '')
   * await fs.rm('temp/cache.tmp')
   * await fs.rm('temp/cache', { recursive: true, force: true })
   * ```
   */
  async rm(path: string, options: { recursive?: boolean; force?: boolean } = {}) {
    const resolved = this.container.paths.resolve(path)
    if (options.recursive || options.force) {
      return await nodeRm(resolved, { recursive: options.recursive ?? false, force: options.force ?? false })
    }
    return await unlink(resolved);
  }

  /**
   * Synchronously removes a directory and all its contents. Already recursive —
   * node-style options are accepted and ignored for compatibility.
   *
   * @param {string} dirPath - The path of the directory to remove
   * @param {object} [_options] - Accepted for node compatibility; removal is always recursive and forced
   * @throws {Error} Throws an error if the directory cannot be removed
   *
   * @example
   * ```typescript
   * fs.rmdirSync('temp/cache')
   * ```
   */
  rmdirSync(dirPath: string, _options: { recursive?: boolean; force?: boolean } = {}): void {
    nodeRmSync(this.container.paths.resolve(dirPath), { recursive: true, force: true })
  }

  /**
   * Asynchronously removes a directory and all its contents. Already recursive —
   * node-style options are accepted and ignored for compatibility.
   *
   * @param {string} dirPath - The path of the directory to remove
   * @param {object} [_options] - Accepted for node compatibility; removal is always recursive and forced
   * @returns {Promise<void>} A promise that resolves when the directory is removed
   * @throws {Error} Throws an error if the directory cannot be removed
   *
   * @example
   * ```typescript
   * await fs.rmdir('temp/cache')
   * ```
   */
  async rmdir(dirPath: string, _options: { recursive?: boolean; force?: boolean } = {}) {
    await rimraf(this.container.paths.resolve(dirPath));
  }

  /**
   * Removes a file or directory recursively — whatever the path is, it's gone
   * (fs-extra's `remove`). No error if the path doesn't exist.
   *
   * @param {string} path - The file or directory to remove
   * @returns {Promise<void>} A promise that resolves when the path is removed
   *
   * @example
   * ```typescript
   * await fs.remove('temp')          // directory
   * await fs.remove('temp/file.txt') // or file — both fine
   * ```
   */
  async remove(path: string) {
    await rimraf(this.container.paths.resolve(path))
  }

  /**
   * Synchronously removes a file or directory recursively (fs-extra's `removeSync`).
   * No error if the path doesn't exist.
   *
   * @param {string} path - The file or directory to remove
   *
   * @example
   * ```typescript
   * fs.removeSync('temp')
   * ```
   */
  removeSync(path: string): void {
    nodeRmSync(this.container.paths.resolve(path), { recursive: true, force: true })
  }

  /**
   * Synchronously deletes a file.
   * @alias rmSync
   *
   * @param {string} path - The path of the file to delete
   *
   * @example
   * ```typescript
   * fs.deleteFile('temp/cache.tmp')
   * ```
   */
  deleteFile(path: string): void {
    this.rmSync(path)
  }

  /**
   * Asynchronously deletes a file.
   * @alias rm
   *
   * @param {string} path - The path of the file to delete
   * @returns {Promise<void>} A promise that resolves when the file is deleted
   *
   * @example
   * ```typescript
   * await fs.deleteFileAsync('temp/cache.tmp')
   * ```
   */
  async deleteFileAsync(path: string) {
    return this.rm(path, { force: true })
  }

  /**
   * Asynchronously removes a file (node's `fs/promises` name).
   * @alias rm
   */
  async unlink(path: string) {
    return this.rm(path)
  }

  /**
   * Synchronously removes a file (node's name).
   * @alias rmSync
   */
  unlinkSync(path: string): void {
    this.rmSync(path)
  }

  /**
   * Asynchronously removes a file.
   * @alias rm
   */
  async rmAsync(path: string, options: { recursive?: boolean; force?: boolean } = {}) {
    return this.rm(path, options)
  }

  /**
   * Asynchronously removes a directory and all its contents.
   * @alias rmdir
   */
  async rmdirAsync(dirPath: string) {
    return this.rmdir(dirPath)
  }

  // ---------------------------------------------------------------------------
  // Copy & Move
  // ---------------------------------------------------------------------------

  /**
   * Synchronously copies a file or directory. Auto-detects whether the source is a file or directory
   * and handles each appropriately (recursive for directories).
   *
   * @param {string} src - The source path to copy from
   * @param {string} dest - The destination path to copy to
   * @param {object} [options={}] - Copy options
   * @param {boolean} [options.overwrite=true] - Whether to overwrite existing files at the destination
   * @throws {Error} Throws an error if the source doesn't exist or the copy fails
   *
   * @example
   * ```typescript
   * fs.copy('src/index.ts', 'backup/index.ts')
   * fs.copy('src', 'backup/src')
   * ```
   */
  copy(src: string, dest: string, options: { overwrite?: boolean } = {}): void {
    const { overwrite = true } = options
    const resolvedSrc = this.container.paths.resolve(src)
    const resolvedDest = this.container.paths.resolve(dest)
    cpSync(resolvedSrc, resolvedDest, { recursive: true, force: overwrite })
  }

  /**
   * Synchronously copies a file or directory.
   * @alias copy
   */
  copySync(src: string, dest: string, options: { overwrite?: boolean } = {}): void {
    this.copy(src, dest, options)
  }

  /**
   * Asynchronously copies a file or directory (node's `fs/promises` name).
   * @alias copyAsync
   */
  async cp(src: string, dest: string, options: { overwrite?: boolean } = {}) {
    return this.copyAsync(src, dest, options)
  }

  /**
   * Synchronously copies a file or directory (node's name).
   * @alias copy
   */
  cpSync(src: string, dest: string, options: { overwrite?: boolean } = {}): void {
    this.copy(src, dest, options)
  }

  /**
   * Asynchronously copies a file or directory. Auto-detects whether the source is a file or directory
   * and handles each appropriately (recursive for directories).
   *
   * @param {string} src - The source path to copy from
   * @param {string} dest - The destination path to copy to
   * @param {object} [options={}] - Copy options
   * @param {boolean} [options.overwrite=true] - Whether to overwrite existing files at the destination
   * @returns {Promise<void>} A promise that resolves when the copy is complete
   * @throws {Error} Throws an error if the source doesn't exist or the copy fails
   *
   * @example
   * ```typescript
   * await fs.copyAsync('src/index.ts', 'backup/index.ts')
   * await fs.copyAsync('src', 'backup/src')
   * ```
   */
  async copyAsync(src: string, dest: string, options: { overwrite?: boolean } = {}) {
    const { overwrite = true } = options
    const resolvedSrc = this.container.paths.resolve(src)
    const resolvedDest = this.container.paths.resolve(dest)
    await cp(resolvedSrc, resolvedDest, { recursive: true, force: overwrite })
  }

  /**
   * Synchronously moves (renames) a file or directory. Falls back to copy + delete for cross-device moves.
   *
   * @param {string} src - The source path to move from
   * @param {string} dest - The destination path to move to
   * @throws {Error} Throws an error if the source doesn't exist or the move fails
   *
   * @example
   * ```typescript
   * fs.ensureFile('temp/draft.txt', 'work in progress')
   * fs.move('temp/draft.txt', 'final/document.txt')
   *
   * fs.ensureFolder('old-dir')
   * fs.move('old-dir', 'new-dir')
   * ```
   */
  move(src: string, dest: string): void {
    const resolvedSrc = this.container.paths.resolve(src)
    const resolvedDest = this.container.paths.resolve(dest)
    const destDir = dirname(resolvedDest)
    mkdirSync(destDir, { recursive: true })
    try {
      renameSync(resolvedSrc, resolvedDest)
    } catch (err: any) {
      if (err.code === 'EXDEV') {
        cpSync(resolvedSrc, resolvedDest, { recursive: true, force: true })
        nodeRmSync(resolvedSrc, { recursive: true, force: true })
      } else {
        throw err
      }
    }
  }

  /**
   * Asynchronously moves (renames) a file or directory. Falls back to copy + delete for cross-device moves.
   *
   * @param {string} src - The source path to move from
   * @param {string} dest - The destination path to move to
   * @returns {Promise<void>} A promise that resolves when the move is complete
   * @throws {Error} Throws an error if the source doesn't exist or the move fails
   *
   * @example
   * ```typescript
   * await fs.ensureFileAsync('temp/draft.txt', 'work in progress')
   * await fs.moveAsync('temp/draft.txt', 'final/document.txt')
   *
   * await fs.ensureFolderAsync('old-dir')
   * await fs.moveAsync('old-dir', 'new-dir')
   * ```
   */
  async moveAsync(src: string, dest: string) {
    const resolvedSrc = this.container.paths.resolve(src)
    const resolvedDest = this.container.paths.resolve(dest)
    const destDir = dirname(resolvedDest)
    await mkdir(destDir, { recursive: true })
    try {
      await rename(resolvedSrc, resolvedDest)
    } catch (err: any) {
      if (err.code === 'EXDEV') {
        await cp(resolvedSrc, resolvedDest, { recursive: true, force: true })
        await nodeRm(resolvedSrc, { recursive: true, force: true })
      } else {
        throw err
      }
    }
  }

  /**
   * Synchronously moves a file or directory.
   * @alias move
   */
  moveSync(src: string, dest: string): void {
    this.move(src, dest)
  }

  /**
   * Asynchronously moves (renames) a file or directory (node's `fs/promises` name).
   * @alias moveAsync
   */
  async rename(src: string, dest: string) {
    return this.moveAsync(src, dest)
  }

  /**
   * Synchronously moves (renames) a file or directory (node's name).
   * @alias move
   */
  renameSync(src: string, dest: string): void {
    this.move(src, dest)
  }

  // ---------------------------------------------------------------------------
  // Walk
  // ---------------------------------------------------------------------------

  /**
   * Recursively walks a directory and returns arrays of file and directory paths.
   * By default paths are absolute. Pass `relative: true` to get paths relative to `basePath`.
   * Supports filtering with exclude and include glob patterns.
   *
   * @param {string} basePath - The base directory path to start walking from
   * @param {WalkOptions} options - Options to configure the walk behavior
   * @param {boolean} [options.directories=true] - Whether to include directories in results
   * @param {boolean} [options.files=true] - Whether to include files in results
   * @param {string | string[]} [options.exclude=[]] - Glob patterns to exclude (e.g. 'node_modules', '*.log')
   * @param {string | string[]} [options.include=[]] - Glob patterns to include (only matching paths are returned)
   * @param {boolean} [options.relative=false] - When true, returned paths are relative to basePath
   * @returns {{ directories: string[], files: string[] }} Object containing arrays of directory and file paths
   *
   * @example
   * ```typescript
   * const result = fs.walk('src', { files: true, directories: false })
   * const filtered = fs.walk('.', { exclude: ['node_modules', '.git'], include: ['*.ts'] })
   *
   * fs.ensureFile('inbox/contact-1.json', '{}')
   * const relative = fs.walk('inbox', { relative: true }) // => { files: ['contact-1.json'] }
   * ```
   */
  walk(basePath: string, options: WalkOptions = {}): { directories: string[], files: string[] } {
    const {
      directories = true,
      files = true,
      exclude = [],
      include = [],
      relative: useRelative = false,
    } = options;

    const excludePatterns = Array.isArray(exclude) ? exclude : [exclude]
    const includePatterns = Array.isArray(include) ? include : [include]
    const resolvedBase = this.container.paths.resolve(basePath)

    const walk = (baseDir: string) => {
      const results = {
        directories: [] as string[],
        files: [] as string[],
      };

      const entries = readdirSync(baseDir, { withFileTypes: true });

      for (const entry of entries) {
        const name = entry.name;
        const fullPath = join(baseDir, name);
        const relativePath = relative(resolvedBase, fullPath)
        const outputPath = useRelative ? relativePath : fullPath;
        // Follow symlinks: isDirectory() returns false for symlinks,
        // so check isSymbolicLink() and resolve to the real target
        const isDir = entry.isDirectory() || (entry.isSymbolicLink() && lstatFollowIsDir(fullPath));

        if (excludePatterns.length && matchesPattern(relativePath, excludePatterns)) {
          continue
        }

        const passes = !includePatterns.length || matchesPattern(relativePath, includePatterns)

        if (isDir && directories && passes) {
          results.directories.push(outputPath);
        }

        if (!isDir && files && passes) {
          results.files.push(outputPath);
        }

        if (isDir) {
          const subResults = walk(fullPath);
          results.files.push(...subResults.files);
          results.directories.push(...subResults.directories);
        }
      }

      return results;
    };

    return walk(resolvedBase);
  }

  /**
   * Asynchronously and recursively walks a directory and returns arrays of file and directory paths.
   * By default paths are absolute. Pass `relative: true` to get paths relative to `baseDir`.
   * Supports filtering with exclude and include glob patterns.
   *
   * @param {string} baseDir - The base directory path to start walking from
   * @param {WalkOptions} options - Options to configure the walk behavior
   * @param {boolean} [options.directories=true] - Whether to include directories in results
   * @param {boolean} [options.files=true] - Whether to include files in results
   * @param {string | string[]} [options.exclude=[]] - Glob patterns to exclude (e.g. 'node_modules', '.git')
   * @param {string | string[]} [options.include=[]] - Glob patterns to include (only matching paths are returned)
   * @param {boolean} [options.relative=false] - When true, returned paths are relative to baseDir
   * @returns {Promise<{ directories: string[], files: string[] }>} Promise resolving to object with directory and file paths
   * @throws {Error} Throws an error if the directory cannot be accessed
   *
   * @example
   * ```typescript
   * const result = await fs.walkAsync('src', { exclude: ['node_modules'] })
   *
   * await fs.ensureFileAsync('inbox/contact-1.json', '{}')
   * const files = await fs.walkAsync('inbox', { relative: true })
   * // files.files => ['contact-1.json']
   * ```
   */
  async walkAsync(baseDir: string, options: WalkOptions = {}): Promise<{ directories: string[], files: string[] }> {
    const {
      directories = true,
      files = true,
      exclude = [],
      include = [],
      relative: useRelative = false,
    } = options;

    const excludePatterns = Array.isArray(exclude) ? exclude : [exclude]
    const includePatterns = Array.isArray(include) ? include : [include]
    const resolvedBase = this.container.paths.resolve(baseDir)

    const walk = async (currentDir: string) => {
      const results = {
        directories: [] as string[],
        files: [] as string[],
      };

      const entries = await readdir(currentDir, { withFileTypes: true });

      for (const entry of entries) {
        const name = entry.name;
        const fullPath = join(currentDir, name);
        const relativePath = relative(resolvedBase, fullPath)
        const outputPath = useRelative ? relativePath : fullPath;
        // Follow symlinks: isDirectory() returns false for symlinks,
        // so check isSymbolicLink() and resolve to the real target
        const isDir = entry.isDirectory() || (entry.isSymbolicLink() && await lstatFollowIsDirAsync(fullPath));

        if (excludePatterns.length && matchesPattern(relativePath, excludePatterns)) {
          continue
        }

        const passes = !includePatterns.length || matchesPattern(relativePath, includePatterns)

        if (isDir && directories && passes) {
          results.directories.push(outputPath);
        }

        if (!isDir && files && passes) {
          results.files.push(outputPath);
        }

        if (isDir) {
          const subResults = await walk(fullPath);
          results.files.push(...subResults.files);
          results.directories.push(...subResults.directories);
        }
      }

      return results;
    };

    return walk(resolvedBase);
  }

  // ---------------------------------------------------------------------------
  // Find Up
  // ---------------------------------------------------------------------------

  /**
   * Synchronously finds a file by walking up the directory tree from the current working directory.
   *
   * @param {string} fileName - The name of the file to search for
   * @param {object} [options={}] - Options for the search
   * @param {string} [options.cwd] - The directory to start searching from (defaults to container.cwd)
   * @returns {string | null} The absolute path to the found file, or null if not found
   *
   * @example
   * ```typescript
   * const packageJson = fs.findUp('package.json')
   * if (packageJson) {
   *   console.log(`Found package.json at: ${packageJson}`)
   * }
   * ```
   */
  findUp(fileName: string, options: { cwd?: string } = {}): string | null {
    const { cwd = this.container.cwd } = options;
    let startAt = cwd;

    if (this.exists(join(startAt, fileName))) {
      return resolve(startAt, fileName);
    }

    while (startAt !== dirname(startAt)) {
      startAt = dirname(startAt);
      if (this.exists(join(startAt, fileName))) {
        return resolve(startAt, fileName);
      }
    }

    return null;
  }

  /**
   * Asynchronously finds a file by walking up the directory tree.
   *
   * @param {string} fileName - The name of the file to search for
   * @param {object} [options={}] - Options for the search
   * @param {string} [options.cwd] - The directory to start searching from (defaults to container.cwd)
   * @param {boolean} [options.multiple=false] - Whether to find multiple instances of the file
   * @returns {Promise<string | string[] | null>} The path(s) to the found file(s), or null if not found
   *
   * @example
   * ```typescript
   * const packageJson = await fs.findUpAsync('package.json')
   * const allPackageJsons = await fs.findUpAsync('package.json', { multiple: true })
   * ```
   */
  async findUpAsync(
    fileName: string,
    options: { cwd?: string; multiple?: boolean } = {}
  ): Promise<string | string[] | null> {
    const { cwd = this.container.cwd, multiple = false } = options;
    let startAt = cwd;
    const foundFiles = [];

    const fileExistsInDir = async (dir: string, file: string) => {
      try {
        await stat(join(dir, file));
        return true;
      } catch (error) {
        return false;
      }
    };

    if (await fileExistsInDir(startAt, fileName)) {
      if (multiple) {
        foundFiles.push(resolve(startAt, fileName));
      } else {
        return resolve(startAt, fileName);
      }
    }

    while (startAt !== dirname(startAt)) {
      startAt = dirname(startAt);
      if (await fileExistsInDir(startAt, fileName)) {
        if (multiple) {
          foundFiles.push(resolve(startAt, fileName));
        } else {
          return resolve(startAt, fileName);
        }
      }
    }

    if (multiple && foundFiles.length > 0) {
      return foundFiles;
    }

    return null;
  }
}

export default FS
