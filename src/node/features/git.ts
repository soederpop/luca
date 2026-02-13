import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'
import { dirname, resolve, isAbsolute } from 'path';
import { State } from '../../state.js';
import { features, Feature } from '../feature.js'

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
    override state: State<GitState> = new State()

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
        
        
        return this.container.feature('proc').exec(`git ls-files ${baseDir} ${flags.join(' ')}`, { 
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
        return this.container.feature('proc').exec('git branch').split("\n").filter(line => line.startsWith('*')).map(line => line.replace('*', '').trim()).pop()
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
        return this.container.feature('proc').exec('git rev-parse HEAD', { cwd: this.repoRoot })
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
            `git log -n ${numberOfChanges} --pretty=format:"%s${fieldSep}%b${fieldSep}%an${separator}"`,
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
            `git log --pretty=format:"%H${fieldSep}%s${fieldSep}%b${separator}" -- ${resolved.map(p => `"${p}"`).join(' ')}`,
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
                `git diff-tree --no-commit-id --name-only -r ${commit.sha}`,
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

export default features.register('git', Git)