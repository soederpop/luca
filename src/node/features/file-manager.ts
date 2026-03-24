import { z } from 'zod'
import { FeatureEventsSchema, FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'
import { State } from "../../state.js";
import { Feature } from "../feature.js";
import { parse, relative, join as pathJoin } from "path";
import { statSync, readFileSync, existsSync, readdirSync, lstatSync } from "fs";
import micromatch from "micromatch";
import { castArray } from "lodash-es";
import chokidar from "chokidar";
import type { FSWatcher } from "chokidar";

type File = {
  absolutePath: string;
  relativePath: string;
  relativeDirname: string;
  dirname: string;
  name: string;
  extension: string;
  size: number;
  modifiedAt: Date;
  createdAt: Date;
};

export const FileManagerStateSchema = FeatureStateSchema.extend({
  /** Whether the file manager has completed its initial scan */
  started: z.boolean().optional().describe('Whether the file manager has completed its initial scan'),
  /** Whether the file manager is currently scanning files */
  starting: z.boolean().optional().describe('Whether the file manager is currently scanning files'),
  /** Whether the file watcher is actively monitoring for changes */
  watching: z.boolean().optional().describe('Whether the file watcher is actively monitoring for changes'),
  /** Whether the initial scan failed */
  failed: z.boolean().optional().describe('Whether the initial file scan failed'),
})

export const FileManagerOptionsSchema = FeatureOptionsSchema.extend({
  /** Glob patterns to exclude from file scanning */
  exclude: z.union([z.string(), z.array(z.string())]).optional().describe('Glob patterns to exclude from file scanning'),
})

export const FileManagerEventsSchema = FeatureEventsSchema.extend({
  'file:change': z.tuple([
    z.object({
      type: z.enum(['add', 'change', 'delete']).describe('The type of file change'),
      path: z.string().describe('Absolute path to the changed file'),
    }).describe('File change event payload'),
  ]).describe('Emitted when a watched file is added, changed, or deleted'),
}).describe('FileManager events')

export type FileManagerState = z.infer<typeof FileManagerStateSchema>
export type FileManagerOptions = z.infer<typeof FileManagerOptionsSchema>

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

  static override shortcut = 'features.fileManager' as const
  static override stateSchema = FileManagerStateSchema
  static override optionsSchema = FileManagerOptionsSchema
  static override eventsSchema = FileManagerEventsSchema
  static { Feature.register(this, 'fileManager') }
  
  files: State<Record<string, File>> = new State<Record<string, File>>({
    initialState: {},
  });

  /** Returns an array of all relative file paths indexed by the file manager. */
  get fileIds() {
    return Array.from(this.files.keys());
  }

  /** Returns an array of all file metadata objects indexed by the file manager. */
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

  /** Returns an array of unique file extensions found across all indexed files. */
  get uniqueExtensions() {
    return Array.from(
      new Set(
        this.files.values().map((file) => file.extension)
      )
    );
  }

  /** Whether the file manager has completed its initial scan. */
  get isStarted() {
    return !!this.state.get("started");
  }

  /** Whether the file manager is currently performing its initial scan. */
  get isStarting() {
    return !!this.state.get("starting");
  }

  /** Whether the file watcher is actively monitoring for changes. */
  get isWatching() {
    return !!this.state.get("watching");
  }

  /** Returns the list of directories currently being watched. */
  get watchedPaths(): string[] {
    return this.state.get("watchedPaths") || [];
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
      const loaded = await this.loadFromCache();
      if (!loaded) {
        await this.scanFiles(options);
        await this.writeToCache();
      }
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
   * Attempts to load the file index from disk cache.
   * Only uses cache when in a clean git repo (sha hasn't changed, no dirty files).
   * @returns true if cache was loaded successfully, false otherwise
   */
  /**
   * Reads the current git SHA by reading .git/HEAD directly,
   * avoiding the ~19ms cost of shelling out to `git rev-parse HEAD`.
   */
  private readGitShaFast(): string | null {
    try {
      const { git } = this.container;
      if (!git.isRepo) return null;

      const gitDir = pathJoin(git.repoRoot, '.git');
      const head = readFileSync(pathJoin(gitDir, 'HEAD'), 'utf8').trim();

      // Detached HEAD — already a sha
      if (!head.startsWith('ref: ')) return head;

      // Resolve the ref
      const refPath = pathJoin(gitDir, head.slice(5));
      if (existsSync(refPath)) {
        return readFileSync(refPath, 'utf8').trim();
      }

      // Packed refs fallback
      const packedRefsPath = pathJoin(gitDir, 'packed-refs');
      if (existsSync(packedRefsPath)) {
        const ref = head.slice(5);
        const packed = readFileSync(packedRefsPath, 'utf8');
        const match = packed.match(new RegExp(`^([0-9a-f]{40}) ${ref}`, 'm'));
        if (match) return match[1];
      }

      return null;
    } catch {
      return null;
    }
  }

  private async loadFromCache(): Promise<boolean> {
    try {
      const sha = this.readGitShaFast();
      if (!sha) return false;

      const cache = this.container.feature('diskCache') as any;
      const cacheKey = `file-index:${sha}`;

      if (!(await cache.has(cacheKey))) return false;

      const cached = await cache.get(cacheKey, true) as { dirs: Record<string, number>, files: Record<string, any> };
      if (!cached?.files || !cached?.dirs) return false;

      // Check if any directory mtime has changed — catches new/deleted/renamed files
      for (const [dir, cachedMtimeMs] of Object.entries(cached.dirs)) {
        try {
          const current = statSync(dir).mtimeMs;
          if (current !== cachedMtimeMs) return false;
        } catch {
          // Directory no longer exists
          return false;
        }
      }

      for (const [relativePath, file] of Object.entries(cached.files)) {
        this.files.set(relativePath, {
          ...file as File,
          modifiedAt: new Date((file as any).modifiedAt),
          createdAt: new Date((file as any).createdAt),
        });
      }

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Writes the current file index to disk cache, keyed by git sha.
   * Stores directory mtimes alongside file data so the cache can be
   * invalidated when files are added/removed without a new commit.
   */
  private async writeToCache(): Promise<void> {
    try {
      const sha = this.readGitShaFast();
      if (!sha) return;

      const cache = this.container.feature('diskCache') as any;
      const cacheKey = `file-index:${sha}`;

      // Collect unique directories and their mtimes
      const dirs: Record<string, number> = {};
      const files: Record<string, any> = {};

      for (const [key, file] of this.files.entries()) {
        files[key] = file;
        if (!dirs[file.dirname]) {
          try {
            dirs[file.dirname] = statSync(file.dirname).mtimeMs;
          } catch {}
        }
      }

      await cache.set(cacheKey, { dirs, files });
    } catch {
      // Cache write failure is non-fatal
    }
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
      const repoRoot = git.repoRoot;
      const cwdRelative = repoRoot ? relative(repoRoot, cwd) : '';
      const baseDir = cwdRelative || '';

      const deleted = await git.lsFiles({ deleted: true, baseDir })
      await git.lsFiles({ baseDir }).then((results) => fileIds.push(...results.filter((id:string) => !deleted.includes(id))));
      await git
        .lsFiles({ others: true, includeIgnored: true, exclude, baseDir })
        .then((results) => fileIds.push(...results.filter((id:string) => !deleted.includes(id))));

      // git ls-files returns paths relative to repo root; make them relative to cwd
      if (cwdRelative) {
        const prefix = cwdRelative + '/';
        for (let i = 0; i < fileIds.length; i++) {
          if (fileIds[i].startsWith(prefix)) {
            fileIds[i] = fileIds[i].slice(prefix.length);
          }
        }
      }

      // git ls-files doesn't traverse symlinked directories — walk them via fs
      // to pick up their contents. fs.walk now follows symlinks natively.
      try {
        const topEntries = readdirSync(cwd, { withFileTypes: true });
        for (const entry of topEntries) {
          if (entry.isSymbolicLink()) {
            const fullPath = pathJoin(cwd, entry.name);
            try {
              const target = statSync(fullPath);
              if (target.isDirectory()) {
                const walked = await fs.walkAsync(fullPath, { exclude });
                for (const absFile of walked.files) {
                  fileIds.push(relative(cwd, absFile));
                }
              }
            } catch {}
          }
        }
      } catch {}
    } else {
      // fs.walkAsync follows symlinks, so non-git repos get symlink support for free
      await fs.walkAsync(cwd).then(({ files } : { files: string[] }) => fileIds.push(...files));
    }

    fileIds.forEach((relativePath) => {
      const absolutePath = this.container.paths.resolve(relativePath);
      const { name, ext, dir } = parse(absolutePath);

      let size = 0
      let modifiedAt = new Date(0)
      let createdAt = new Date(0)

      try {
        const stats = statSync(absolutePath);
        size = stats.size;
        modifiedAt = stats.mtime;
        createdAt = stats.birthtime;
      } catch (error) {
      }

      this.files.set(relativePath, {
        dirname: dir,
        absolutePath,
        relativePath,
	relativeDirname: this.container.paths.relative(dir),
        name,
        extension: ext,
        size,
        modifiedAt,
        createdAt,
      });
    });

    return this;
  }

  watcher: FSWatcher | null = null;

  /** Returns the directories and files currently being watched by chokidar. */
  get watchedFiles(): Record<string, string[]> {
    return this.watcher?.getWatched() || {};
  }

  /**
   * Watches directories for file changes. Can be called multiple times to add
   * more directories to an existing watcher. Tracks all watched paths in state.
   *
   * When called without `paths`, watches the project's `directoryIds` (default behavior).
   * When called with `paths`, watches only those specific directories/globs.
   * Subsequent calls add to the existing watcher — they never replace what's already watched.
   *
   * @param {object} [options={}] - Options for the file manager
   * @param {string | string[]} [options.paths] - Specific directories or globs to watch. Defaults to project directoryIds.
   * @param {string | string[]} [options.exclude] - The patterns to exclude from the watch
   * @returns {Promise<void>}
  */
  async watch(options: { paths?: string | string[]; exclude?: string | string[] } = {}) {
    const pathsToWatch = castArray(options.paths || this.directoryIds.map(id => this.container.paths.resolve(id)))
      .map(p => this.container.paths.resolve(p));

    // If already watching, just add the new paths
    if (this.isWatching && this.watcher) {
      const currentPaths: string[] = this.state.get("watchedPaths") || [];
      const newPaths = pathsToWatch.filter(p => !currentPaths.includes(p));

      if (newPaths.length) {
        this.watcher.add(newPaths);
        this.state.set("watchedPaths", [...currentPaths, ...newPaths]);
      }

      return;
    }

    if (!Array.isArray(options.exclude)) {
      options.exclude = [options.exclude!].filter((v) => v?.length);
    }

    const {
      exclude = [".git/**", "dist/**", "node_modules/**", "out/**", "build/**"],
    } = options;

    exclude.push(...castArray(this.options.exclude!).filter((v) => v?.length));

    const watcher = chokidar.watch(pathsToWatch, {
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
        this.updateFile(path);
        this.emit("file:change", {
          type: "add",
          path,
        });
      })
      .on("change", (path) => {
        this.updateFile(path);
        this.emit("file:change", {
          type: "change",
          path,
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
      this.state.set("watchedPaths", pathsToWatch);
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
      this.state.set("watchedPaths", []);
      this.watcher = null;
    }
  }

  async updateFile(path: string) {
    const absolutePath = this.container.paths.resolve(path);
    const { name, ext, dir } = parse(absolutePath);

    try {
      const stats = statSync(absolutePath);
      this.files.set(path, {
        dirname: dir,
        absolutePath,
        relativePath: path,
        name,
        extension: ext,
        size: stats.size,
        modifiedAt: stats.mtime,
        createdAt: stats.birthtime,
      });
    } catch (err: any) {
      // File may have been moved or deleted by an event handler — remove from index gracefully
      if (err.code === 'ENOENT') {
        this.files.delete(path);
      } else {
        throw err;
      }
    }
  }

  async removeFile(path: string) {
    this.files.delete(path);
  }
}

export default FileManager