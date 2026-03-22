import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'
import { dirname, resolve, isAbsolute } from 'path';
import { State } from '../../state.js';
import { Feature } from '../feature.js'

type LsFilesOptions = {
    cached?: boolean;
    deleted?: boolean;
    modified?: boolean;
    others?: boolean;
    ignored?: boolean;
    status?: boolean;
    includeIgnored?: boolean;
    exclude?: string | string[];
    baseDir?: string;
}

const GitStateSchema = FeatureStateSchema.extend({
    /** Absolute path to the Git repository root directory */
    repoRoot: z.string().optional().describe('Absolute path to the Git repository root directory'),
})

type GitState = z.infer<typeof GitStateSchema>

/**
 * The Git feature provides utilities for interacting with Git repositories.
 * 
 * This feature allows you to check repository status, list files, get branch information,
 * and access Git metadata for projects within a Git repository.
 * 
 * @example
 * ```typescript
 * const git = container.feature('git')
 * 
 * if (git.isRepo) {
 *   console.log(`Current branch: ${git.branch}`)
 *   console.log(`Repository root: ${git.repoRoot}`)
 *   
 *   const allFiles = await git.lsFiles()
 *   const modifiedFiles = await git.lsFiles({ modified: true })
 * }
 * ```
 * 
 * @extends Feature
 */
export class Git extends Feature {
    static override shortcut = 'features.git' as const
    static override stateSchema = GitStateSchema
    static override optionsSchema = FeatureOptionsSchema
    static { Feature.register(this, 'git') }
    override state: State<GitState> = new State()

    private _resolvedGitPath: string | null = null

    /** Resolve the git binary path via `which`, caching the result. */
    get gitPath(): string {
        if (this._resolvedGitPath) return this._resolvedGitPath
        try {
            this._resolvedGitPath = this.container.feature('proc').exec('which git').trim()
        } catch {
            this._resolvedGitPath = 'git'
        }
        return this._resolvedGitPath
    }

    /**
     * Lists files in the Git repository using git ls-files command.
     * 
     * This method provides a flexible interface to the git ls-files command,
     * allowing you to filter files by various criteria such as cached, deleted,
     * modified, untracked, and ignored files.
     * 
     * @param {LsFilesOptions} [options={}] - Options to control which files are listed
     * @param {boolean} [options.cached=false] - Show cached/staged files
     * @param {boolean} [options.deleted=false] - Show deleted files
     * @param {boolean} [options.modified=false] - Show modified files
     * @param {boolean} [options.others=false] - Show untracked files
     * @param {boolean} [options.ignored=false] - Show ignored files
     * @param {boolean} [options.status=false] - Show file status information
     * @param {boolean} [options.includeIgnored=false] - Include ignored files when showing others
     * @param {string | string[]} [options.exclude] - Patterns to exclude from results
     * @param {string} [options.baseDir=''] - Base directory to list files from
     * @returns {Promise<string[]>} Promise that resolves to an array of file paths
     * 
     * @example
     * ```typescript
     * // Get all tracked files
     * const allFiles = await git.lsFiles()
     * 
     * // Get only modified files
     * const modified = await git.lsFiles({ modified: true })
     * 
     * // Get untracked files excluding certain patterns
     * const untracked = await git.lsFiles({ 
     *   others: true, 
     *   exclude: ['*.log', 'node_modules'] 
     * })
     * ```
     */
    async lsFiles(options: LsFilesOptions = {}) {
        const { 
            cached = false, 
            deleted = false, 
            modified = false, 
            others = false,
            ignored = false, 
            status = false, 
            baseDir = '',
            includeIgnored = false
        } = options || {}
        
        const exclude = Array.isArray(options.exclude) ? options.exclude : [options.exclude || ''].filter(v => v?.length)
        
        const flags = [
            cached ? '--cached' : '',
            deleted ? '--deleted' : '',
            modified ? '--modified' : '',
            others ? '--others' : '',
            ignored ? '--ignored' : '',
            status ? '-t' : '',
        ].filter(v => v?.length).flat()
        
        const gitIgnorePath = this.container.fs.findUp('.gitignore', { cwd: this.container.cwd })
        
        if (others && exclude.length) {
            flags.push(
                ...exclude.map((p:string) =>['--exclude', p]).flat()
            )
        }
        
        if (others && gitIgnorePath && !includeIgnored) {
            flags.push(...['--exclude-from', gitIgnorePath])
        }
        
        
        return this.container.feature('proc').exec(`${this.gitPath} ls-files ${baseDir} ${flags.join(' ')}`, { 
            cwd: this.repoRoot,
            maxBuffer: 1024 * 1024 * 100,
        }).trim().split("\n")
    }
    
    /**
     * Gets the current Git branch name.
     * 
     * @returns {string | null} The current branch name, or null if not in a Git repository
     * 
     * @example
     * ```typescript
     * const currentBranch = git.branch
     * if (currentBranch) {
     *   console.log(`Currently on branch: ${currentBranch}`)
     * }
     * ```
     */
    get branch() {
        if(!this.isRepo) { return null }
        return this.container.feature('proc').exec(`${this.gitPath} branch`).split("\n").filter(line => line.startsWith('*')).map(line => line.replace('*', '').trim()).pop()
    }
    
    /**
     * Gets the current Git commit SHA hash.
     * 
     * @returns {string | null} The current commit SHA, or null if not in a Git repository
     * 
     * @example
     * ```typescript
     * const commitSha = git.sha
     * if (commitSha) {
     *   console.log(`Current commit: ${commitSha}`)
     * }
     * ```
     */
    get sha() {
        if(!this.isRepo) { return null }
        return this.container.feature('proc').exec(`${this.gitPath} rev-parse HEAD`, { cwd: this.repoRoot })
    }
    
    /**
     * Checks if the current directory is within a Git repository.
     * 
     * @returns {boolean} True if currently in a Git repository, false otherwise
     * 
     * @example
     * ```typescript
     * if (git.isRepo) {
     *   console.log('This is a Git repository!')
     * } else {
     *   console.log('Not in a Git repository')
     * }
     * ```
     */
    get isRepo() {
        return !!this.repoRoot
    }
    
    /**
     * Checks if the current working directory is the root of the Git repository.
     * 
     * @returns {boolean} True if currently at the repository root, false otherwise
     * 
     * @example
     * ```typescript
     * if (git.isRepoRoot) {
     *   console.log('At the repository root')
     * } else {
     *   console.log('In a subdirectory of the repository')
     * }
     * ```
     */
    get isRepoRoot() {
        return this.repoRoot == this.container.cwd
    }
    
    /**
     * Gets the absolute path to the Git repository root directory.
     * 
     * This method caches the repository root path for performance. It searches upward
     * from the current directory to find the .git directory.
     * 
     * @returns {string | null} The absolute path to the repository root, or null if not in a Git repository
     * 
     * @example
     * ```typescript
     * const repoRoot = git.repoRoot
     * if (repoRoot) {
     *   console.log(`Repository root: ${repoRoot}`)
     * }
     * ```
     */
    get repoRoot() {
        if (this.state.has('repoRoot')) {
            return this.state.get('repoRoot')
        }

        const repoRoot = this.container.fs.findUp('.git')

        if(typeof repoRoot === 'string') {
            this.state.set('repoRoot', dirname(repoRoot))
            return dirname(repoRoot)
        }

        return null
    }

    /**
     * Gets the latest commits from the repository.
     *
     * Returns an array of commit objects containing the title (first line of commit message),
     * full message body, and author name for each commit.
     *
     * @param {number} [numberOfChanges=10] - The number of recent commits to return
     * @returns {Promise<Array<{ title: string, message: string, author: string }>>} Array of commit objects
     *
     * @example
     * ```typescript
     * const changes = await git.getLatestChanges(5)
     * for (const commit of changes) {
     *   console.log(`${commit.author}: ${commit.title}`)
     * }
     * ```
     */
    async getLatestChanges(numberOfChanges: number = 10) {
        if (!this.isRepo) return []

        const separator = '---COMMIT---'
        const fieldSep = '---FIELD---'

        const output = this.container.feature('proc').exec(
            `${this.gitPath} log -n ${numberOfChanges} --pretty=format:"%s${fieldSep}%b${fieldSep}%an${separator}"`,
            { cwd: this.repoRoot }
        )

        return output
            .split(separator)
            .filter((entry: string) => entry.trim().length > 0)
            .map((entry: string) => {
                const [title = '', message = '', author = ''] = entry.split(fieldSep).map((s: string) => s.trim())
                return { title, message, author }
            })
    }

    /**
     * Gets a lightweight commit log for one or more files.
     *
     * Returns the SHA and message for each commit that touched the given files,
     * without the per-commit overhead of resolving which specific files matched.
     * For richer per-file matching, see {@link getChangeHistoryForFiles}.
     *
     * @param {...string} files - File paths (absolute or relative to container.cwd)
     * @returns {Array<{ sha: string, message: string }>} Array of commits
     *
     * @example
     * ```typescript
     * const log = git.fileLog('package.json')
     * const log = git.fileLog('src/index.ts', 'src/helper.ts')
     * for (const entry of log) {
     *   console.log(`${entry.sha.slice(0, 8)} ${entry.message}`)
     * }
     * ```
     */
    fileLog(...files: string[]) {
        if (!this.isRepo || !files.length) return []

        const proc = this.container.feature('proc')
        const root = this.repoRoot!

        const resolved = files.map(p =>
            isAbsolute(p) ? p : resolve(this.container.cwd, p)
        )

        const separator = '---COMMIT---'
        const fieldSep = '---FIELD---'

        const output = proc.exec(
            `${this.gitPath} log --pretty=format:"%H${fieldSep}%s${separator}" -- ${resolved.map(p => `"${p}"`).join(' ')}`,
            { cwd: root }
        )

        if (!output.trim()) return []

        return output
            .split(separator)
            .filter((entry: string) => entry.trim().length > 0)
            .map((entry: string) => {
                const [sha = '', message = ''] = entry.split(fieldSep).map((s: string) => s.trim())
                return { sha, message }
            })
    }

    /**
     * Gets the diff for a file between two refs.
     *
     * By default compares from the current HEAD to the given ref. You can
     * supply both `compareTo` and `compareFrom` to diff between any two commits,
     * branches, or tags.
     *
     * @param {string} file - File path (absolute or relative to container.cwd)
     * @param {string} compareTo - The target ref (commit SHA, branch, tag) to compare to
     * @param {string} [compareFrom] - The base ref to compare from (defaults to current HEAD)
     * @returns {string} The diff output, or an empty string if there are no changes
     *
     * @example
     * ```typescript
     * // Diff package.json between HEAD and a specific commit
     * const d = git.diff('package.json', 'abc1234')
     *
     * // Diff between two branches
     * const d = git.diff('src/index.ts', 'feature-branch', 'main')
     * ```
     */
    diff(file: string, compareTo: string, compareFrom?: string) {
        if (!this.isRepo) return ''

        const proc = this.container.feature('proc')
        const root = this.repoRoot!
        const from = compareFrom ?? this.sha!
        const resolved = isAbsolute(file) ? file : resolve(this.container.cwd, file)

        return proc.exec(
            `${this.gitPath} diff ${from} ${compareTo} -- "${resolved}"`,
            { cwd: root }
        ).trim()
    }

    /**
     * Pretty prints a unified diff string to the terminal using colors.
     *
     * Parses the diff output and applies color coding:
     * - File headers (`diff --git`, `---`, `+++`) are rendered bold
     * - Hunk headers (`@@ ... @@`) are rendered in cyan
     * - Added lines (`+`) are rendered in green
     * - Removed lines (`-`) are rendered in red
     * - Context lines are rendered dim
     *
     * Can be called with a raw diff string, or with the same arguments as
     * {@link diff} to fetch and display in one step.
     *
     * @param diffOrFile - A raw diff string, or a file path to pass to {@link diff}
     * @param compareTo - When diffOrFile is a file path, the target ref to compare to
     * @param compareFrom - When diffOrFile is a file path, the base ref to compare from
     * @returns The colorized diff string (also prints to stdout)
     *
     * @example
     * ```typescript
     * // Display a pre-fetched diff
     * const raw = git.diff('src/index.ts', 'main')
     * git.displayDiff(raw)
     *
     * // Fetch and display in one call
     * git.displayDiff('src/index.ts', 'abc1234')
     * ```
     */
    displayDiff(diffOrFile: string, compareTo?: string, compareFrom?: string): string {
        const raw = compareTo
            ? this.diff(diffOrFile, compareTo, compareFrom)
            : diffOrFile

        if (!raw.trim()) return ''

        const { colors } = this.container.feature('ui')

        const lines = raw.split('\n')
        const colored = lines.map(line => {
            if (line.startsWith('diff --git') || line.startsWith('index ')) {
                return colors.bold(line)
            }
            if (line.startsWith('--- ') || line.startsWith('+++ ')) {
                return colors.bold(line)
            }
            if (line.startsWith('@@')) {
                return colors.cyan(line)
            }
            if (line.startsWith('+')) {
                return colors.green(line)
            }
            if (line.startsWith('-')) {
                return colors.red(line)
            }
            return colors.dim(line)
        })

        const output = colored.join('\n')
        console.log(output)
        return output
    }

    /**
     * Extracts a folder (or entire repo) from a remote GitHub repository without cloning.
     *
     * Downloads the repo as a tarball and extracts only the specified subfolder,
     * similar to how degit works. No .git history is included — just the files.
     *
     * Supports shorthand (`user/repo/path`), branch refs (`user/repo/path#branch`),
     * and full GitHub URLs (`https://github.com/user/repo/tree/branch/path`).
     *
     * @param {object} options
     * @param {string} options.source - Repository source in degit-style shorthand
     * @param {string} options.destination - Local path to extract files into
     * @param {string} [options.branch] - Branch, tag, or commit ref (overrides ref in source string)
     * @returns {Promise<{ files: string[], source: { user: string, repo: string, ref: string, subdir: string } }>}
     *
     * @example
     * ```typescript
     * // Extract a subfolder
     * await git.extractFolder({ source: 'soederpop/luca/src/assistants', destination: './my-assistants' })
     *
     * // Specific branch
     * await git.extractFolder({ source: 'sveltejs/template', destination: './my-app', branch: 'main' })
     *
     * // Full GitHub URL
     * await git.extractFolder({ source: 'https://github.com/user/repo/tree/main/examples', destination: './examples' })
     * ```
     */
    async extractFolder({ source, destination, branch }: { source: string, destination: string, branch?: string }) {
        const parsed = this._parseRemoteSource(source)
        if (branch) parsed.ref = branch

        const tarballUrl = `https://github.com/${parsed.user}/${parsed.repo}/archive/${parsed.ref}.tar.gz`
        const stamp = Date.now()
        const fs = this.container.feature('fs')
        const proc = this.container.feature('proc')
        const tmpBase = this.container.paths.resolve(this.container.feature('os').tmpdir, 'luca-degit')
        fs.ensureFolder(tmpBase)
        const tarPath = this.container.paths.resolve(tmpBase, `.degit-${stamp}.tar.gz`)
        const tmpExtract = this.container.paths.resolve(tmpBase, `.degit-extract-${stamp}`)
        const dest = destination.startsWith('/') ? destination : this.container.paths.resolve(destination)

        const dl = this.container.feature('downloader')

        await dl.download(tarballUrl, tarPath)

        // Extract everything, strip the root archive directory (e.g. repo-commitsha/)
        fs.ensureFolder(tmpExtract)
        const extractResult = await proc.execAndCapture(`tar xzf ${tarPath} -C ${tmpExtract} --strip-components=1`)
        if (extractResult.exitCode !== 0) {
            await fs.rmdir(tmpExtract)
            await fs.rm(tarPath)
            throw new Error(`Failed to extract tarball: ${extractResult.stderr}`)
        }

        // Copy the subfolder (or everything) to destination
        const sourceDir = parsed.subdir ? `${tmpExtract}/${parsed.subdir}` : tmpExtract
        if (fs.existsSync(dest)) await fs.rmdir(dest)
        fs.ensureFolder(dest)
        fs.copy(sourceDir, dest, { overwrite: true })

        // Cleanup temp files
        await fs.rm(tarPath)
        await fs.rmdir(tmpExtract)

        const files = fs.readdirSync(dest)
        return { files, source: parsed }
    }

    /** Parses degit-style source strings into components. */
    private _parseRemoteSource(input: string) {
        let ref = 'HEAD'
        let str = input.replace(/^https?:\/\//, '')

        // Handle github.com/user/repo/tree/branch/path URLs
        const treeMatch = str.match(/^github\.com\/([^/]+)\/([^/]+)\/tree\/([^/]+)(?:\/(.+))?$/)
        if (treeMatch) {
            return { user: treeMatch[1], repo: treeMatch[2], ref: treeMatch[3], subdir: treeMatch[4] || '' }
        }

        if (str.startsWith('github.com/')) str = str.replace('github.com/', '')
        if (str.includes('#')) {
            const parts = str.split('#')
            str = parts[0]
            ref = parts[1]
        }

        const parts = str.split('/')
        return { user: parts[0], repo: parts[1], ref, subdir: parts.slice(2).join('/') }
    }

    /**
     * Gets the commit history for a set of files or glob patterns.
     *
     * Accepts absolute paths, relative paths (resolved from container.cwd),
     * or glob patterns. Returns commits that touched any of the matched files,
     * with each entry noting which of your queried files were in that commit.
     *
     * @param {...string} paths - File paths or glob patterns to get history for
     * @returns {Array<{ sha: string, message: string, longMessage: string, filesMatched: string[] }>}
     *
     * @example
     * ```typescript
     * const history = git.getChangeHistoryForFiles('src/container.ts', 'src/helper.ts')
     * const history = git.getChangeHistoryForFiles('src/node/features/*.ts')
     * ```
     */
    getChangeHistoryForFiles(...paths: string[]) {
        if (!this.isRepo || !paths.length) return []

        const proc = this.container.feature('proc')
        const root = this.repoRoot!

        // resolve each path relative to cwd (globs stay as-is for git, but we resolve for matching)
        const resolved = paths.map(p =>
            isAbsolute(p) ? p : resolve(this.container.cwd, p)
        )

        const separator = '---COMMIT---'
        const fieldSep = '---FIELD---'

        const output = proc.exec(
            `${this.gitPath} log --pretty=format:"%H${fieldSep}%s${fieldSep}%b${separator}" -- ${resolved.map(p => `"${p}"`).join(' ')}`,
            { cwd: root }
        )

        if (!output.trim()) return []

        const commits = output
            .split(separator)
            .filter((entry: string) => entry.trim().length > 0)
            .map((entry: string) => {
                const [sha = '', message = '', longMessage = ''] = entry.split(fieldSep).map((s: string) => s.trim())
                return { sha, message, longMessage }
            })

        // build matchers: Bun.Glob for patterns with wildcards, exact match otherwise
        const matchers = resolved.map(p => {
            const hasGlob = /[*?{}\[\]]/.test(p)
            return {
                original: p,
                match: hasGlob
                    ? (file: string) => new Bun.Glob(p).match(file)
                    : (file: string) => file === p,
            }
        })

        return commits.map(commit => {
            const changedFiles = proc.exec(
                `${this.gitPath} diff-tree --no-commit-id --name-only -r ${commit.sha}`,
                { cwd: root }
            ).trim().split('\n').filter(Boolean)

            const changedAbsolute = changedFiles.map(f => resolve(root, f))

            const filesMatched = matchers
                .filter(m => changedAbsolute.some(f => m.match(f)))
                .map(m => m.original)

            return {
                sha: commit.sha,
                message: commit.message,
                longMessage: commit.longMessage,
                filesMatched,
            }
        })
    }
}

export default Git