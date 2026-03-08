import { features, Feature } from "../feature.js";
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'
import {
  mkdirSync,
  writeFileSync,
  appendFileSync,
  readdirSync,
  statSync,
  readFileSync,
} from "fs";
import { join, resolve, dirname } from "path";
import { readFile, stat, unlink, mkdir, writeFile, appendFile, readdir } from "fs/promises";
import { native as rimraf } from 'rimraf'

type WalkOptions = {
  directories?: boolean;
  files?: boolean;
  exclude?: string | string[];
  include?: string | string[];
};

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
 * await fs.ensureFileAsync('output/result.json', '{}')
 * ```
 */
export class FS extends Feature {
  static override shortcut = "features.fs" as const
  static override stateSchema = FeatureStateSchema
  static override optionsSchema = FeatureOptionsSchema

  /**
   * Asynchronously reads a file and returns its contents as a Buffer.
   *
   * @param {string} path - The file path relative to the container's working directory
   * @returns {Promise<Buffer>} A promise that resolves to the file contents as a Buffer
   * @throws {Error} Throws an error if the file doesn't exist or cannot be read
   *
   * @example
   * ```typescript
   * const fs = container.feature('fs')
   * const buffer = await fs.readFileAsync('data.txt')
   * console.log(buffer.toString())
   * ```
   */
  async readFileAsync(path: string) {
    return await readFile(this.container.paths.resolve(path)) 
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
   * const fs = container.feature('fs')
   * const entries = await fs.readdir('src')
   * console.log(entries) // ['index.ts', 'utils.ts', 'components']
   * ```
   */
  async readdir(path: string) {
    return await readdir(this.container.paths.resolve(path))
  }

  /**
   * Recursively walks a directory and returns an array of relative path names for each file and directory.
   *
   * @param {string} basePath - The base directory path to start walking from
   * @param {WalkOptions} options - Options to configure the walk behavior
   * @param {boolean} [options.directories=true] - Whether to include directories in results
   * @param {boolean} [options.files=true] - Whether to include files in results
   * @param {string | string[]} [options.exclude=[]] - Patterns to exclude from results
   * @param {string | string[]} [options.include=[]] - Patterns to include in results
   * @returns {{ directories: string[], files: string[] }} Object containing arrays of directory and file paths
   * 
   * @example
   * ```typescript
   * const result = fs.walk('src', { files: true, directories: false })
   * console.log(result.files) // ['src/index.ts', 'src/utils.ts', 'src/components/Button.tsx']
   * ```
   */
  walk(basePath: string, options: WalkOptions = {}) {
    const {
      directories = true,
      files = true,
      exclude = [],
      include = [],
    } = options;

    const walk = (baseDir: string) => {
      const results = {
        directories: [] as string[],
        files: [] as string[],
      };

      const entries = readdirSync(baseDir, { withFileTypes: true });

      for (const entry of entries) {
        const name = entry.name;
        const path = join(baseDir, name);
        const isDir = entry.isDirectory();

        if (isDir && directories) {
          results.directories.push(path);
        }

        if (!isDir && files) {
          results.files.push(path);
        }

        if (isDir) {
          const subResults = walk(path);
          results.files.push(...subResults.files);
          results.directories.push(...subResults.directories);
        }
      }

      return results;
    };

    return walk(this.container.paths.resolve(basePath));
  }

  /**
   * Asynchronously and recursively walks a directory and returns an array of relative path names.
   *
   * @param {string} baseDir - The base directory path to start walking from
   * @param {WalkOptions} options - Options to configure the walk behavior
   * @param {boolean} [options.directories=true] - Whether to include directories in results
   * @param {boolean} [options.files=true] - Whether to include files in results
   * @param {string | string[]} [options.exclude=[]] - Patterns to exclude from results
   * @param {string | string[]} [options.include=[]] - Patterns to include in results
   * @returns {Promise<{ directories: string[], files: string[] }>} Promise resolving to object with directory and file paths
   * @throws {Error} Throws an error if the directory cannot be accessed
   * 
   * @example
   * ```typescript
   * const result = await fs.walkAsync('src', { exclude: ['node_modules'] })
   * console.log(`Found ${result.files.length} files and ${result.directories.length} directories`)
   * ```
   */
  async walkAsync(baseDir: string, options: WalkOptions = {}) {
    const {
      directories = true,
      files = true,
      exclude = [],
      include = [],
    } = options;

    const walk = async (baseDir: string) => {
      const results = {
        directories: [] as string[],
        files: [] as string[],
      };

      const entries = await readdir(baseDir, { withFileTypes: true });

      for (const entry of entries) {
        const name = entry.name;
        const path = join(baseDir, name);
        const isDir = entry.isDirectory();

        if (isDir && directories) {
          results.directories.push(path);
        }

        if (!isDir && files) {
          results.files.push(path);
        }

        if (isDir) {
          const subResults = await walk(path);
          results.files.push(...subResults.files);
          results.directories.push(...subResults.directories);
        }
      }

      return results;
    };

    return walk(this.container.paths.resolve(baseDir));
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
   * // Creates config directory and settings.json file with '{}' content
   * ```
   */
  async ensureFileAsync(path: string, content: string, overwrite = false) {
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
  async writeFileAsync(path:string, content: Buffer | string) {
    return writeFile(this.container.paths.resolve(path), content)
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
  appendFile(path: string, content: Buffer | string) {
    appendFileSync(this.container.paths.resolve(path), content)
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
   * // Creates logs and logs/debug directories if they don't exist
   * ```
   */
  ensureFolder(path: string) {
    mkdirSync(this.container.paths.resolve(path), { recursive: true });
    return this.container.paths.resolve(path);
  }

  mkdirp(folder: string) {
	  return this.ensureFolder(folder)
  }

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
   * // Creates logs directory and app.log file if they don't exist
   * ```
   */
  ensureFile(path: string, content: string, overwrite = false) {
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

    // walk up the tree until we find the fileName exists
    if (this.exists(join(startAt, fileName))) {
      return resolve(startAt, fileName);
    }

    // walk up the tree until we find the fileName exists
    while (startAt !== dirname(startAt)) {
      startAt = dirname(startAt);
      if (this.exists(join(startAt, fileName))) {
        return resolve(startAt, fileName);
      }
    }

    return null;
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
  async existsAsync(path: string) {
    const { container } = this;
    const filePath = container.paths.resolve(path);
    const exists = await stat(filePath)
      .then(() => true)
      .catch((e) => false);
      
    return exists
  }

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
    const { container } = this;
    const filePath = container.paths.resolve(path);

    try {
      statSync(filePath);
      return true;
    } catch (error) {
      return false;
    }
  }

  existsSync(path: string): boolean {
	  return this.exists(path)
  }

  /**
   * Asynchronously removes a file.
   *
   * @param {string} path - The path of the file to remove
   * @returns {Promise<void>} A promise that resolves when the file is removed
   * @throws {Error} Throws an error if the file cannot be removed or doesn't exist
   * 
   * @example
   * ```typescript
   * await fs.rm('temp/cache.tmp')
   * ```
   */
  async rm(path: string) {
    return await unlink(this.container.paths.resolve(path));
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
   * const config = fs.readJson('config.json')
   * console.log(config.version)
   * ```
   */
  readJson(path: string) {
    const { container } = this;
    const filePath = container.paths.resolve(path);
    return JSON.parse(readFileSync(filePath).toString());
  }

  /**
   * Synchronously reads a file and returns its contents as a string.
   *
   * @param {string} path - The path to the file
   * @returns {string} The file contents as a string
   * @throws {Error} Throws an error if the file doesn't exist or cannot be read
   * 
   * @example
   * ```typescript
   * const content = fs.readFile('README.md')
   * console.log(content)
   * ```
   */
  readFile(path: string) {
    const { container } = this;
    const filePath = container.paths.resolve(path);
    return readFileSync(filePath).toString();
  }

  /**
   * Asynchronously removes a directory and all its contents.
   *
   * @param {string} dirPath - The path of the directory to remove
   * @returns {Promise<void>} A promise that resolves when the directory is removed
   * @throws {Error} Throws an error if the directory cannot be removed
   * 
   * @example
   * ```typescript
   * await fs.rmdir('temp/cache')
   * // Removes the cache directory and all its contents
   * ```
   */
  async rmdir(dirPath: string) {
    await rimraf(this.container.paths.resolve(dirPath));
  }

  /**
   * Asynchronously finds a file by walking up the directory tree.
   *
   * @param {string} fileName - The name of the file to search for
   * @param {object} [options={}] - Options for the search
   * @param {string} [options.cwd] - The directory to start searching from (defaults to container.cwd)
   * @param {boolean} [options.multiple=false] - Whether to find multiple instances of the file
   * @returns {Promise<string | string[] | null>} The path(s) to the found file(s), or null if not found
   * @throws {Error} Throws an error if the search encounters filesystem issues
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

export default features.register("fs", FS);
