import { Feature } from '../feature.js'
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'

/** Shell-escape a string using single quotes (safe for all characters) */
function shellQuote(s: string): string {
    return "'" + s.replace(/'/g, "'\\''") + "'"
}

export type GrepMatch = {
    file: string
    line: number
    column?: number
    content: string
    /** Context lines preceding the match (present when `before` was requested) */
    before?: string[]
    /** Context lines following the match (present when `after` was requested) */
    after?: string[]
}

export type GrepOptions = {
    /** Pattern to search for (string or regex) */
    pattern: string
    /** Directory or file to search in (defaults to container cwd) */
    path?: string
    /** Glob patterns to include (e.g. '*.ts') */
    include?: string | string[]
    /** Glob patterns to exclude (e.g. 'node_modules') */
    exclude?: string | string[]
    /** Case insensitive search */
    ignoreCase?: boolean
    /** Treat pattern as a fixed string, not regex */
    fixedStrings?: boolean
    /** Search recursively (default: true) */
    recursive?: boolean
    /** Include hidden files */
    hidden?: boolean
    /** Max total number of results to return (results are truncated after parsing; also passed to rg/grep as a per-file bound for performance) */
    maxResults?: number
    /** Number of context lines before match */
    before?: number
    /** Number of context lines after match */
    after?: number
    /** Only return filenames, not match details */
    filesOnly?: boolean
    /** Invert match (return lines that don't match) */
    invert?: boolean
    /** Match whole words only */
    wordMatch?: boolean
    /** Additional raw flags to pass to grep/ripgrep */
    rawFlags?: string[]
}

/**
 * The Grep feature provides utilities for searching file contents using ripgrep (rg) or grep.
 *
 * Returns structured results as arrays of `{ file, line, column, content }` objects
 * with paths relative to the container cwd. Also provides convenience methods for
 * common search patterns.
 *
 * @example
 * ```typescript
 * const grep = container.feature('grep')
 *
 * // Basic search
 * const results = await grep.search({ pattern: 'TODO' })
 * // [{ file: 'src/index.ts', line: 42, column: 5, content: '// TODO: fix this' }, ...]
 *
 * // Find all imports of a module
 * const imports = await grep.imports('lodash')
 *
 * // Find function/class/variable definitions
 * const defs = await grep.definitions('MyClass')
 *
 * // Just get filenames containing a pattern
 * const files = await grep.filesContaining('API_KEY')
 * ```
 *
 * @extends Feature
 */
export class Grep extends Feature {
    static override shortcut = 'features.grep' as const
    static override stability = 'core' as const
    static override category = 'filesystem' as const
    static override stateSchema = FeatureStateSchema
    static override optionsSchema = FeatureOptionsSchema
    static { Feature.register(this, 'grep') }

    private _hasRipgrep: boolean | null = null
    private _rgPath: string | null = null
    private _grepPath: string | null = null

    /** Whether ripgrep (rg) is available on this system */
    get hasRipgrep(): boolean {
        if (this._hasRipgrep !== null) return this._hasRipgrep
        try {
            this._rgPath = this.container.feature('proc').execSync('which rg').trim()
            this._hasRipgrep = true
        } catch {
            this._hasRipgrep = false
        }
        return this._hasRipgrep
    }

    /** Resolved path to the rg binary */
    get rgPath(): string {
        if (this._rgPath) return this._rgPath
        this.hasRipgrep // triggers resolution
        return this._rgPath || 'rg'
    }

    /** Resolved path to the grep binary */
    get grepPath(): string {
        if (this._grepPath) return this._grepPath
        try {
            this._grepPath = this.container.feature('proc').execSync('which grep').trim()
        } catch {
            this._grepPath = 'grep'
        }
        return this._grepPath
    }

    /**
     * Search for a pattern in files and return structured results.
     *
     * Zero matches returns `[]`. Any other failure — invalid regex, nonexistent
     * search path, unreadable files — THROWS with the underlying rg/grep stderr
     * in the message, so a broken pattern is never mistaken for "no matches".
     *
     * `maxResults` caps the TOTAL number of returned matches (sliced after
     * parsing). When `before`/`after` context is requested, each match gains
     * `before`/`after` arrays holding the surrounding lines' text.
     *
     * @param {GrepOptions} options - Search options
     * @returns {Promise<GrepMatch[]>} Array of match objects with relative file paths
     * @throws {Error} When rg/grep fails for any reason other than "no matches" (exit code 1) — the message includes the tool's stderr
     *
     * @example
     * ```typescript
     * // Search for a pattern in TypeScript files
     * const results = await grep.search({
     *   pattern: 'useState',
     *   include: '*.tsx',
     *   exclude: 'node_modules'
     * })
     *
     * // Case insensitive search with context
     * const withContext = await grep.search({
     *   pattern: 'error',
     *   ignoreCase: true,
     *   before: 2,
     *   after: 2
     * })
     *
     * // Cap the number of results
     * const firstFive = await grep.search({ pattern: 'container', include: '*.ts', maxResults: 5 })
     * ```
     */
    async search(options: GrepOptions): Promise<GrepMatch[]> {
        const cmd = this.buildCommand(options)
        const proc = this.container.feature('proc')

        const result = await proc.tryExec(cmd, { cwd: this.container.cwd })

        if (result.exitCode !== 0) {
            // rg and grep both use exit code 1 for "no matches" — that is a
            // valid empty result. Anything else (2 = regex/IO error) is a real
            // failure and must be loud, not an empty array.
            if (result.exitCode === 1 && !result.stdout.length) return []
            throw new Error(
                `grep search failed (exit code ${result.exitCode}): ${result.stderr.trim() || '(no stderr)'}\ncommand: ${cmd}`
            )
        }

        if (!result.stdout.length) return []

        let matches = this.parseResults(result.stdout, options)

        // --max-count is only a per-file bound; enforce the documented total here
        if (options.maxResults && matches.length > options.maxResults) {
            matches = matches.slice(0, options.maxResults)
        }

        return matches
    }

    /**
     * Find files containing a pattern. Returns just the relative file paths.
     *
     * @param {string} pattern - The pattern to search for
     * @param {Omit<GrepOptions, 'pattern' | 'filesOnly'>} [options] - Additional search options
     * @returns {Promise<string[]>} Array of relative file paths
     *
     * @example
     * ```typescript
     * const files = await grep.filesContaining('TODO')
     * // ['src/index.ts', 'src/utils.ts']
     * ```
     */
    async filesContaining(pattern: string, options: Omit<GrepOptions, 'pattern' | 'filesOnly'> = {}): Promise<string[]> {
        const results = await this.search({ ...options, pattern, filesOnly: true })
        return results.map(r => r.file)
    }

    /**
     * Find import/require statements for a module or path.
     *
     * @param {string} moduleOrPath - The module name or path to search for in imports
     * @param {Omit<GrepOptions, 'pattern'>} [options] - Additional search options
     * @returns {Promise<GrepMatch[]>} Array of matches
     *
     * @example
     * ```typescript
     * const lodashImports = await grep.imports('lodash')
     * const localImports = await grep.imports('./utils')
     * ```
     */
    async imports(moduleOrPath: string, options: Omit<GrepOptions, 'pattern'> = {}): Promise<GrepMatch[]> {
        const escaped = moduleOrPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const pattern = `(import|require).*['"\`]${escaped}[/'"\`]?`
        return this.search({ ...options, pattern })
    }

    /**
     * Find function, class, type, or variable definitions matching a name.
     *
     * @param {string} name - The identifier name to search for definitions of
     * @param {Omit<GrepOptions, 'pattern'>} [options] - Additional search options
     * @returns {Promise<GrepMatch[]>} Array of matches
     *
     * @example
     * ```typescript
     * const defs = await grep.definitions('MyComponent')
     * const classDefs = await grep.definitions('UserService')
     * ```
     */
    async definitions(name: string, options: Omit<GrepOptions, 'pattern'> = {}): Promise<GrepMatch[]> {
        const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const pattern = `(function|class|const|let|var|type|interface|enum|export)\\s+(async\\s+)?${escaped}\\b`
        return this.search({ ...options, pattern })
    }

    /**
     * Find lines containing TODO, FIXME, HACK, or XXX.
     *
     * NOTE: this is a plain substring/regex match against the whole line — it does
     * NOT parse comments. Any occurrence of these words matches, including inside
     * string literals, markdown prose, and documentation. In particular, a command
     * or script that generates a report about TODOs will match its own source
     * (e.g. `console.log('TODO report')`), so filter out the reporting file itself
     * or exclude string-literal matches when post-processing results.
     *
     * @param {Omit<GrepOptions, 'pattern'>} [options] - Additional search options
     * @returns {Promise<GrepMatch[]>} Array of matches
     *
     * @example
     * ```typescript
     * const todos = await grep.todos()
     * const fixmes = await grep.todos({ include: '*.ts' })
     *
     * // A report generator should exclude itself from the results
     * const filtered = todos.filter(m => !m.file.endsWith('commands/todo-report.ts'))
     * ```
     */
    async todos(options: Omit<GrepOptions, 'pattern'> = {}): Promise<GrepMatch[]> {
        return this.search({ ...options, pattern: '(TODO|FIXME|HACK|XXX)\\b' })
    }

    /**
     * Count the number of matches for a pattern.
     *
     * @param {string} pattern - The pattern to count
     * @param {Omit<GrepOptions, 'pattern'>} [options] - Additional search options
     * @returns {Promise<number>} Total number of matching lines
     *
     * @example
     * ```typescript
     * const count = await grep.count('console.log')
     * console.log(`Found ${count} console.log statements`)
     * ```
     */
    async count(pattern: string, options: Omit<GrepOptions, 'pattern'> = {}): Promise<number> {
        const results = await this.search({ ...options, pattern })
        return results.length
    }

    /**
     * Search and replace across files. Returns the list of files that would be affected.
     * Does NOT modify files — use the returned file list to do the replacement yourself.
     *
     * @param {string} pattern - The pattern to search for
     * @param {Omit<GrepOptions, 'pattern'>} [options] - Additional search options
     * @returns {Promise<{ file: string, matches: GrepMatch[] }[]>} Array of files with their matches, grouped by file
     *
     * @example
     * ```typescript
     * const affected = await grep.findForReplace('oldFunctionName')
     * // [{ file: 'src/a.ts', matches: [...] }, { file: 'src/b.ts', matches: [...] }]
     * ```
     */
    async findForReplace(pattern: string, options: Omit<GrepOptions, 'pattern'> = {}): Promise<{ file: string, matches: GrepMatch[] }[]> {
        const results = await this.search({ ...options, pattern })
        const grouped = new Map<string, GrepMatch[]>()

        for (const match of results) {
            if (!grouped.has(match.file)) grouped.set(match.file, [])
            grouped.get(match.file)!.push(match)
        }

        return Array.from(grouped.entries()).map(([file, matches]) => ({ file, matches }))
    }

    /** Build the grep/rg command from options */
    private buildCommand(options: GrepOptions): string {
        const {
            pattern,
            path,
            include,
            exclude,
            ignoreCase = false,
            fixedStrings = false,
            recursive = true,
            hidden = false,
            maxResults,
            before,
            after,
            filesOnly = false,
            invert = false,
            wordMatch = false,
            rawFlags = [],
        } = options

        const useRg = this.hasRipgrep
        const flags: string[] = []

        if (useRg) {
            // ripgrep mode
            // --with-filename: rg omits the filename when searching a single
            // explicit file, which would break the file:line:col parser
            flags.push('--no-heading', '--with-filename', '--line-number', '--column')

            if (filesOnly) flags.push('--files-with-matches')
            if (ignoreCase) flags.push('--ignore-case')
            if (fixedStrings) flags.push('--fixed-strings')
            if (hidden) flags.push('--hidden')
            if (invert) flags.push('--invert-match')
            if (wordMatch) flags.push('--word-regexp')
            if (maxResults) flags.push(`--max-count=${maxResults}`)
            if (before) flags.push(`--before-context=${before}`)
            if (after) flags.push(`--after-context=${after}`)

            const includes = Array.isArray(include) ? include : (include ? [include] : [])
            for (const g of includes) {
                flags.push(`--glob=${shellQuote(g)}`)
            }

            const excludes = Array.isArray(exclude) ? exclude : (exclude ? [exclude] : [])
            for (const g of excludes) {
                flags.push(`--glob=${shellQuote('!' + g)}`)
            }

            flags.push(...rawFlags)

            const searchPath = path || '.'
            return `${this.rgPath} ${flags.join(' ')} -e ${shellQuote(pattern)} ${shellQuote(searchPath)}`
        } else {
            // fallback to grep — use -E for extended regex (supports ?, +, |, (), {})
            // -H: force the filename prefix even for a single explicit file,
            // so the file:line parser always sees the same format
            flags.push('-r', '-n', '-E', '-H')

            if (filesOnly) flags.push('-l')
            if (ignoreCase) flags.push('-i')
            if (fixedStrings) flags.push('-F')
            if (invert) flags.push('-v')
            if (wordMatch) flags.push('-w')
            if (maxResults) flags.push(`-m ${maxResults}`)
            if (before) flags.push(`-B ${before}`)
            if (after) flags.push(`-A ${after}`)

            const includes = Array.isArray(include) ? include : (include ? [include] : [])
            for (const g of includes) {
                flags.push(`--include=${shellQuote(g)}`)
            }

            const excludes = Array.isArray(exclude) ? exclude : (exclude ? [exclude] : [])
            for (const g of excludes) {
                flags.push(`--exclude-dir=${shellQuote(g)}`)
            }

            if (!recursive) {
                const idx = flags.indexOf('-r')
                if (idx !== -1) flags.splice(idx, 1)
            }

            flags.push(...rawFlags)

            const searchPath = path || '.'
            return `${this.grepPath} ${flags.join(' ')} -e ${shellQuote(pattern)} ${shellQuote(searchPath)}`
        }
    }

    /** Parse raw grep/rg output into structured results */
    private parseResults(output: string, options: GrepOptions): GrepMatch[] {
        const cwd = this.container.cwd
        const lines = output.split('\n').filter(l => l.length > 0)
        const results: GrepMatch[] = []

        if (options.filesOnly) {
            for (const line of lines) {
                const filePath = line.trim()
                if (!filePath) continue
                results.push({
                    file: this.relativize(filePath, cwd),
                    line: 0,
                    content: '',
                })
            }
            return results
        }

        // Context lines (from -B/-A) use - as the separator instead of : and
        // groups are divided by bare -- lines. When context was requested we
        // attach those lines to the surrounding matches; otherwise any line
        // that isn't a match line is skipped.
        const useRg = this.hasRipgrep
        const wantContext = Boolean(options.before || options.after)

        // Lines seen before the next match in the current group
        let pendingBefore: string[] = []
        // The most recent match in the current group (context after it attaches here)
        let lastMatch: GrepMatch | null = null

        for (const line of lines) {
            if (line === '--') {
                // Group separator — context never crosses it
                pendingBefore = []
                lastMatch = null
                continue
            }

            // rg format: file:line:column:content
            // grep format: file:line:content
            let match: GrepMatch | null = null

            if (useRg) {
                const m = line.match(/^(.+?):(\d+):(\d+):(.*)$/)
                if (m) {
                    match = {
                        file: this.relativize(m[1]!, cwd),
                        line: parseInt(m[2]!, 10),
                        column: parseInt(m[3]!, 10),
                        content: m[4]!,
                    }
                }
            } else {
                const m = line.match(/^(.+?):(\d+):(.*)$/)
                if (m) {
                    match = {
                        file: this.relativize(m[1]!, cwd),
                        line: parseInt(m[2]!, 10),
                        content: m[3]!,
                    }
                }
            }

            if (match) {
                if (wantContext) {
                    if (options.before) match.before = pendingBefore
                    if (options.after) match.after = []
                    pendingBefore = []
                    lastMatch = match
                }
                results.push(match)
                continue
            }

            if (!wantContext) continue

            // Context line: file-line-content (rg and grep both use - separators)
            const c = line.match(/^(.+?)-(\d+)-(.*)$/)
            if (!c) continue

            if (lastMatch && options.after && (lastMatch.after?.length ?? 0) < (options.after ?? 0)) {
                // Fills the after-window of the previous match first; overlap
                // lines beyond that window become before-context for the next match
                lastMatch.after!.push(c[3]!)
            } else {
                pendingBefore.push(c[3]!)
            }
        }

        return results
    }

    /** Make a path relative to cwd */
    private relativize(filePath: string, cwd: string): string {
        // If already relative (starts with ./), just clean it
        if (filePath.startsWith('./')) return filePath.slice(2)
        if (filePath.startsWith('/')) return this.container.paths.relative(cwd, filePath)
        return filePath
    }
}

export default Grep