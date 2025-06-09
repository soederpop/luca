import { State } from "../../state.js";
import { Feature, type FeatureOptions, type FeatureState, features } from "../feature.js";
import { parse } from "path";
import { statSync } from "fs";
import micromatch from "micromatch";
import { castArray } from "lodash-es";
import chokidar from "chokidar";
import type { FSWatcher } from "chokidar";

type File = {
  absolutePath: string;
  relativePath: string;
  dirname: string;
  name: string;
  extension: string;
  size: number;
};

export interface FileManagerState extends FeatureState {
  started?: boolean;
  starting?: boolean;
  watching?: boolean;
  failed?: boolean;
}

export interface FileManagerOptions extends FeatureOptions {
  exclude?: string | string[];
}

/** 
 * The FileManager feature creates a database like index of all of the files in the project,
 * and provides metadata about these files, and also provides a way to watch for changes to the files.
 *
 * @example
 * ```typescript
 * const fileManager = container.feature('fileManager')
 * await fileManager.start()
 * 
 * const fileIds = fileManager.fileIds
 * const typescriptFiles = fileManager.matchFiles("**ts")
 * ```
*/
export class FileManager<
  T extends FileManagerState = FileManagerState,
  K extends FileManagerOptions = FileManagerOptions
> extends Feature<T, K> {
  files: State<Record<string, File>> = new State<Record<string, File>>({
    initialState: {},
  });

  get fileIds() {
    return Array.from(this.files.keys());
  }
  
  get fileObjects() {
    return Array.from(this.files.values());
  }

  /** 
   * Matches the file IDs against the pattern(s) provided
   * @param {string | string[]} patterns - The patterns to match against the file IDs
   * @returns {string[]} The file IDs that match the patterns
  */
  match(patterns: string | string[]) {
    return micromatch(this.files.keys(), patterns);
  }

  /** 
   * Matches the file IDs against the pattern(s) provided and returns the file objects for each.
   * 
   * @param {string | string[]} patterns - The patterns to match against the file IDs
   * @returns {File[]} The file objects that match the patterns
  */
  matchFiles(patterns: string | string[]) {
    const fileIds = this.match(Array.isArray(patterns) ? patterns : [patterns]);
    return fileIds.map((fileId) => this.files.get(fileId));
  }

  /** 
   * Returns the directory IDs for all of the files in the project.
  */
  get directoryIds() {
    return Array.from(
      new Set(
        this.files
          .values()
          .map((file) => this.container.paths.relative(file.dirname))
          .filter(v => v.length)
      )
    );
  }

  get isStarted() {
    return !!this.state.get("started");
  }

  get isStarting() {
    return !!this.state.get("starting");
  }

  get isWatching() {
    return !!this.state.get("watching");
  }

  /** 
   * Starts the file manager and scans the files in the project.
   * @param {object} [options={}] - Options for the file manager
   * @param {string | string[]} [options.exclude] - The patterns to exclude from the scan
   * @returns {Promise<FileManager>} The file manager instance
  */
  async start(options: { exclude?: string | string[] } = {}) {
    if (this.isStarted) {
      return this;
    }

    if (this.isStarting) {
      await this.waitFor("started");
      return this;
    } else {
      this.state.set("starting", true);
    }

    try {
      await this.scanFiles(options);
    } catch (error) {
      console.error(error);
      this.state.set("failed", true);
    } finally {
      this.state.set("started", true);
      this.state.set("starting", false);
    }

    return this;
  }

  /** 
   * Scans the files in the project and updates the file manager state.
   * @param {object} [options={}] - Options for the file manager
   * @param {string | string[]} [options.exclude] - The patterns to exclude from the scan
   * @returns {Promise<FileManager>} The file manager instance
  */
  async scanFiles(options: { exclude?: string | string[] } = {}) {
    const { cwd, git, fs } = this.container;

    const fileIds: string[] = [];

    if (!Array.isArray(options.exclude)) {
      options.exclude = [options.exclude!].filter((v) => v?.length);
    }

    const { exclude = ["dist", "node_modules", "out"] } = options;

    exclude.push(...castArray(this.options.exclude!).filter((v) => v?.length));

    exclude.push("node_modules");
    exclude.push("out");
    exclude.push("dist");

    if (git.isRepo) {
      const deleted = await git.lsFiles({ deleted: true })
      await git.lsFiles().then((results) => fileIds.push(...results.filter((id:string) => !deleted.includes(id))));
      await git
        .lsFiles({ others: true, includeIgnored: true, exclude })
        .then((results) => fileIds.push(...results.filter((id:string) => !deleted.includes(id))));
    } else {
      await fs.walkAsync(cwd).then(({ files } : { files: string[] }) => fileIds.push(...files));
    }

    fileIds.forEach((relativePath) => {
      const absolutePath = this.container.paths.resolve(relativePath);
      const { name, ext, dir } = parse(absolutePath);
      const size = statSync(absolutePath).size;

      this.files.set(relativePath, {
        dirname: dir,
        absolutePath,
        relativePath,
        name,
        extension: ext,
        size,
      });
    });

    return this;
  }

  watcher: FSWatcher | null = null;

  get watchedFiles(): Record<string, string[]> {
    return this.watcher?.getWatched() || {};
  }

  /** 
   * Watches the files in the project and updates the file manager state.
   * @param {object} [options={}] - Options for the file manager
   * @param {string | string[]} [options.exclude] - The patterns to exclude from the watch
   * @returns {Promise<void>} The file manager instance
  */
  async watch(options: { exclude?: string | string[] } = {}) {
    if (this.isWatching) {
      return;
    }

    if (!Array.isArray(options.exclude)) {
      options.exclude = [options.exclude!].filter((v) => v?.length);
    }

    const {
      exclude = [".git/**", "dist/**", "node_modules/**", "out/**", "build/**"],
    } = options;

    exclude.push(...castArray(this.options.exclude!).filter((v) => v?.length));

    const { cwd } = this.container;

    const watcher = chokidar.watch(
      this.directoryIds.map(id => this.container.paths.resolve(id)) 
      , {
      ignoreInitial: true,
      persistent: true,
      ignored: [
        '.git/**',
        ...[".git", "dist/**", "node_modules/**", "out/**", "build/**"],
        ...exclude,
      ].map((pattern) => micromatch.makeRe(pattern)).concat([
        /\.git/,
        /node_modules/
      ]),
    });

    watcher
      .on("add", (path) => {
        this.emit("file:change", {
          type: "add",
          path,
        });
        this.updateFile(path);
      })
      .on("change", (path) => {
        this.updateFile(path);
        this.emit("file:change", {
          path,
          type: "change",
        });
      })
      .on("unlink", (path) => {
        this.removeFile(path);
        this.emit("file:change", {
          type: "delete",
          path,
        });
      });

    watcher.on("ready", () => {
      this.state.set("watching", true);
    });

    this.watcher = watcher;
  }

  async stopWatching() {
    if (!this.isWatching) {
      return;
    }

    if (this.watcher) {
      this.watcher.close();
      this.state.set("watching", false);
      this.watcher = null;
    }
  }

  async updateFile(path: string) {
    // Reuse the logic from the scanFiles method to update a single file
    const absolutePath = this.container.paths.resolve(path);
    const { name, ext, dir } = parse(absolutePath);
    const size = statSync(absolutePath).size;

    this.files.set(path, {
      dirname: dir,
      absolutePath,
      relativePath: path,
      name,
      extension: ext,
      size,
    });
  }

  async removeFile(path: string) {
    this.files.delete(path);
  }
}

export default features.register("fileManager", FileManager);
