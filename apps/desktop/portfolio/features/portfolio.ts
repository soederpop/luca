import { z } from 'zod'
import { Feature, FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from 'luca'

declare module 'luca' {
	interface AvailableFeatures {
		portfolio: typeof Portfolio
	}
}

export const PortfolioStateSchema = FeatureStateSchema.extend({
	scannedAt: z.number().optional().describe('When the last scan finished, in ms since the epoch'),
	projectCount: z.number().default(0).describe('How many Luca projects the last scan found'),
	scanning: z.boolean().default(false).describe('True while a scan runs'),
})
export type PortfolioState = z.infer<typeof PortfolioStateSchema>

export const PortfolioOptionsSchema = FeatureOptionsSchema.extend({
	configFile: z.string().optional().describe('The portfolio config file. Default: portfolio.yml in the current project'),
	maxAgeMs: z.number().optional().describe('How long a scan stays fresh before projects() scans again. Default: 5 minutes'),
})
export type PortfolioOptions = z.infer<typeof PortfolioOptionsSchema>

/** One helper for Luca Desktop to copy: the request of its change tile (`route=borrow&op=copy`). */
export const ReviewChangeSchema = z.object({
	registry: z.string().describe('The registry: features, clients, servers, commands, endpoints, selectors or assistants'),
	id: z.string().describe('The helper id'),
	file: z.string().describe('The absolute path of its file, or of its folder for an assistant'),
	root: z.string().describe('The absolute path of the source project'),
})
export type ReviewChange = z.infer<typeof ReviewChangeSchema>

export const PortfolioEventsSchema = FeatureEventsSchema.extend({
	review: z.tuple([z.object({
		target: z.string().describe('The absolute path of the receiving project'),
		changes: z.array(ReviewChangeSchema),
	})]).describe('Ask Luca Desktop to show copies for review: one change tile per helper, in the receiving project. The human writes each one there.'),
})

/** The helper folders a Luca project discovers, and the registry each one fills. */
const HELPER_FOLDERS: Record<string, string> = {
	features: 'features',
	clients: 'clients',
	servers: 'servers',
	commands: 'commands',
	endpoints: 'endpoints',
	selectors: 'selectors',
	assistants: 'assistants',
	workbench: 'workbench',
}

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.build', 'Library', 'Applications', 'Pictures', 'Movies', 'Music', 'Downloads', 'Desktop', 'Documents', 'Public'])

export type PortfolioConfig = {
	/** Folders whose children are checked for Luca projects. */
	roots: string[]
	/** Where newProject() creates projects. */
	newProjectsFolder: string
	/** Folder names never scanned. */
	skip: string[]
}

export type Helper = {
	registry: string
	id: string
	file: string
	summary: string
}

export type PortfolioProject = {
	/** A short unique name: the folder name, or more of its path when two share one. */
	name: string
	path: string
	pathDisplay: string
	description: string
	lastCommitAt: string | null
	lastCommitSubject: string | null
	lastOpenedAt: string | null
	/** The later of the last commit and the last time Luca Desktop opened it. */
	lastTouchedAt: string | null
	daysSinceTouched: number | null
	uncommitted: number | null
	gitRepo: boolean
	helperCounts: Record<string, number>
	insideProject: string | null
}

/** What reviewCopy sent to Luca Desktop, and what the human should hear about it. */
export type CopyReview = {
	from: string
	to: string
	/** One change tile each. */
	changes: { registry: string; id: string; file: string }[]
	/** Files that are not a helper: the change tiles copy helpers only. */
	notHelpers: string[]
	/** Project helpers the files call through container.feature() and the like, which the target lacks. */
	helperDeps: { helper: string; file: string }[]
	envVars: string[]
	notes: string[]
}

/**
 * The user's portfolio of Luca projects: every project folder under the
 * configured roots plus the ones Luca Desktop knows, with their helpers, git
 * activity and descriptions. It answers "which projects do we have", "what
 * has not been touched in a while", "do we have a Microsoft 365 integration
 * anywhere", and asks Luca Desktop to show a copy of a helper from one
 * project into another, which the human reviews and writes there.
 *
 * Config is `portfolio.yml` in the current project: `roots`,
 * `newProjectsFolder`, `skip`. A root's children are checked, and so are the
 * children of each child's `projects/` folder, the place Luca projects keep
 * nested projects.
 *
 * @example
 * ```typescript
 * const portfolio = container.feature('portfolio')
 * const projects = await portfolio.projects()
 * const hits = await portfolio.search({ terms: ['microsoft', 'graph', 'outlook'] })
 * ```
 */
export class Portfolio extends Feature<PortfolioState, PortfolioOptions> {
	static override shortcut = 'features.portfolio' as const
	static override stateSchema = PortfolioStateSchema
	static override optionsSchema = PortfolioOptionsSchema
	static override eventsSchema = PortfolioEventsSchema
	static override description = 'The Luca projects on this machine: list, search, compare activity, and send helpers from one to another for review in Luca Desktop'

	static { Feature.register(this, 'portfolio') }

	private cache: { at: number; projects: PortfolioProject[] } | null = null
	private scan: Promise<PortfolioProject[]> | null = null
	private helperCache = new Map<string, { mtime: number; helper: Helper }>()

	private get home(): string {
		return String(this.container.feature('os').homedir)
	}

	private expand(p: string): string {
		return this.container.paths.resolve(p.replace(/^~(?=\/|$)/, this.home))
	}

	private display(p: string): string {
		return p === this.home ? '~' : p.startsWith(this.home + '/') ? '~' + p.slice(this.home.length) : p
	}

	/**
	 * Read `portfolio.yml`. Missing keys get defaults: roots `~` and
	 * `~/projects`, new projects in `~/projects`.
	 *
	 * @returns The roots, the new projects folder and the folder names to skip, all expanded
	 * @example
	 * ```typescript
	 * const { roots } = await container.feature('portfolio').config()
	 * ```
	 */
	async config(): Promise<PortfolioConfig> {
		const fs = this.container.feature('fs')
		const file = this.options.configFile || this.container.paths.resolve('portfolio.yml')
		let raw: any = {}
		if (await fs.existsAsync(file)) {
			raw = this.container.feature('yaml').parse(String(await fs.readFileAsync(file))) || {}
		}
		const roots: string[] = Array.isArray(raw.roots) && raw.roots.length ? raw.roots : ['~', '~/projects']
		const newProjectsFolder = this.expand(String(raw.newProjectsFolder || '~/projects'))
		return {
			roots: [...new Set([...roots.map((r) => this.expand(r == null ? '~' : String(r))), newProjectsFolder])],
			newProjectsFolder,
			skip: Array.isArray(raw.skip) ? raw.skip.map(String) : [],
		}
	}

	private async isLucaProject(dir: string): Promise<boolean> {
		const fs = this.container.feature('fs')
		const p = (f: string) => this.container.paths.resolve(dir, f)
		if (await fs.existsAsync(p('luca.cli.ts'))) return true
		if (await fs.existsAsync(p('package.json'))) {
			try {
				const pkg = await fs.readJsonAsync(p('package.json'))
				const deps = { ...pkg?.dependencies, ...pkg?.devDependencies, ...pkg?.peerDependencies }
				if (deps.luca || deps['@soederpop/luca']) return true
			} catch {}
		}
		return false
	}

	private async childDirs(dir: string, skip: Set<string>): Promise<string[]> {
		const fs = this.container.feature('fs')
		let names: string[] = []
		try { names = await fs.readdirAsync(dir) } catch { return [] }
		const out: string[] = []
		for (const name of names) {
			if (name.startsWith('.') || SKIP_DIRS.has(name) || skip.has(name)) continue
			const full = this.container.paths.resolve(dir, name)
			try { if (await fs.isDirectoryAsync(full)) out.push(full) } catch {}
		}
		return out
	}

	/** Luca Desktop's known folders, with when each was last opened. */
	private async desktopProjects(): Promise<Map<string, string>> {
		const fs = this.container.feature('fs')
		const file = this.container.paths.resolve(this.home, '.luca/desktop/projects.json')
		const out = new Map<string, string>()
		try {
			const data = await fs.readJsonAsync(file)
			for (const p of data?.projects || []) {
				if (p.host || !p.path) continue
				out.set(String(p.path), String(p.lastOpened || ''))
			}
		} catch {}
		return out
	}

	private async git(dir: string, args: string[]): Promise<{ ok: boolean; out: string }> {
		const { stdout, exitCode } = await this.container.feature('proc').spawnAndCapture('git', ['-C', dir, ...args])
		return { ok: exitCode === 0, out: String(stdout || '').trim() }
	}

	private async describeProject(dir: string): Promise<string> {
		const fs = this.container.feature('fs')
		const p = (f: string) => this.container.paths.resolve(dir, f)
		try {
			const pkg = await fs.readJsonAsync(p('package.json'))
			if (pkg?.description) return String(pkg.description)
		} catch {}
		for (const f of ['README.md', 'CLAUDE.md', 'AGENTS.md']) {
			if (!(await fs.existsAsync(p(f)))) continue
			const text = String(await fs.readFileAsync(p(f)))
			// The first paragraph of prose: not a heading, a list, a link line or a code fence.
			const para = text.split(/\n\s*\n/).map((b) => b.trim())
				.find((b) => b && !/^(#|-|\*|>|```|\||<|!\[|\[)/.test(b) && b.length > 30)
			if (para) return para.replace(/\s+/g, ' ').slice(0, 300)
		}
		return ''
	}

	private async helperFiles(dir: string): Promise<{ registry: string; file: string }[]> {
		const fs = this.container.feature('fs')
		const out: { registry: string; file: string }[] = []
		for (const base of ['', 'src']) {
			for (const [folder, registry] of Object.entries(HELPER_FOLDERS)) {
				const root = this.container.paths.resolve(dir, base, folder)
				if (!(await fs.isDirectoryAsync(root).catch(() => false))) continue
				if (registry === 'assistants') {
					for (const sub of await this.childDirs(root, new Set())) {
						if (await fs.existsAsync(this.container.paths.resolve(sub, 'CORE.md'))) out.push({ registry, file: sub })
					}
					continue
				}
				const files = await fs.walkAsync(root, { directories: false, exclude: ['node_modules'] }).catch(() => ({ files: [] as string[] }))
				const list: string[] = Array.isArray(files) ? files : (files?.files || [])
				for (const f of list) {
					const full = this.container.paths.resolve(root, f)
					if (/\.(ts|js)$/.test(full) && !/\.(test|spec|d)\.(ts|js)$/.test(full)) out.push({ registry, file: full })
				}
			}
		}
		return out
	}

	private async readHelper(registry: string, file: string): Promise<Helper> {
		const fs = this.container.feature('fs')
		const paths = this.container.paths
		const isFolder = registry === 'assistants'
		const main = isFolder ? paths.resolve(file, 'ABOUT.md') : file
		const stat = await fs.statAsync(await fs.existsAsync(main) ? main : paths.resolve(file, 'CORE.md')).catch(() => null)
		const mtime = stat ? Number(stat.mtimeMs) : 0
		const cached = this.helperCache.get(file)
		if (cached && cached.mtime === mtime) return cached.helper

		const base = paths.basename(file).replace(/\.(ts|js)$/, '')
		let id = base
		let summary = ''
		if (isFolder) {
			for (const f of ['ABOUT.md', 'CORE.md']) {
				const full = paths.resolve(file, f)
				if (!(await fs.existsAsync(full))) continue
				const text = String(await fs.readFileAsync(full)).replace(/^---[\s\S]*?\n---\n/, '')
				const para = text.split(/\n\s*\n/).map((b) => b.trim()).find((b) => b && !b.startsWith('#'))
				if (para) { summary = para; break }
			}
		} else {
			const text = String(await fs.readFileAsync(file))
			const reg = text.match(/\.register\(\s*this\s*,\s*['"]([\w-]+)['"]/) || text.match(/static\s+(?:override\s+)?shortcut\s*=\s*['"]\w+\.([\w-]+)['"]/)
			if (reg) id = reg[1]!
			const desc = text.match(/export\s+const\s+description\s*=\s*(['"`])([\s\S]*?)\1/)
			const classDoc = text.match(/\/\*\*([\s\S]*?)\*\/\s*export\s+(?:default\s+)?class\s+\w+\s+extends\s+\w*(?:Feature|Client|Server|Selector)\b/)
				|| text.match(/\/\*\*([\s\S]*?)\*\/\s*export\s+(?:default\s+)?class\s+\w+\s+extends/)
			if (classDoc) {
				// Only the last doc block before the class: the lazy match can start earlier.
				const block = classDoc[1]!.split('/**').pop()!
				summary = block.split('\n').map((l) => l.replace(/^\s*\*\s?/, '')).join('\n').split(/\n\s*\n|@example|@extends/)[0]!.trim()
			} else if (desc) {
				summary = desc[2]!
			} else {
				const staticDesc = text.match(/static\s+(?:override\s+)?description\s*=\s*(['"`])([\s\S]*?)\1/)
				if (staticDesc) summary = staticDesc[2]!
			}
		}
		const helper: Helper = { registry, id, file, summary: summary.replace(/\s+/g, ' ').slice(0, 400) }
		this.helperCache.set(file, { mtime, helper })
		return helper
	}

	private async scanAll(): Promise<PortfolioProject[]> {
		const cfg = await this.config()
		const skip = new Set(cfg.skip)
		const fs = this.container.feature('fs')
		const self = fs.realpath(this.container.cwd)
		const found = new Set<string>()

		const consider = async (dir: string) => {
			let real = dir
			try { real = fs.realpath(dir) } catch { return }
			if (real === self || found.has(real)) return
			if (await this.isLucaProject(real)) found.add(real)
		}

		for (const root of cfg.roots) {
			for (const child of await this.childDirs(root, skip)) {
				await consider(child)
				const nested = this.container.paths.resolve(child, 'projects')
				if (await fs.isDirectoryAsync(nested).catch(() => false)) {
					for (const sub of await this.childDirs(nested, skip)) await consider(sub)
				}
			}
		}

		const desktop = await this.desktopProjects()
		for (const path of desktop.keys()) await consider(path)

		const now = Date.now()
		const dirs = [...found.keys()].sort()
		const projects = await Promise.all(dirs.map(async (dir): Promise<PortfolioProject> => {
			const [log, status, description, helpers] = await Promise.all([
				this.git(dir, ['log', '-1', '--format=%cI%x09%s', '--', '.']),
				this.git(dir, ['status', '--porcelain', '--', '.']),
				this.describeProject(dir),
				this.helperFiles(dir),
			])
			const [at, ...subject] = log.ok && log.out ? log.out.split('\t') : []
			const opened = desktop.get(dir) || [...desktop.entries()].find(([p]) => { try { return fs.realpath(p) === dir } catch { return false } })?.[1] || null
			const times = [at, opened].filter(Boolean).map((t) => Date.parse(t!)).filter((t) => !Number.isNaN(t))
			const touched = times.length ? Math.max(...times) : null
			const counts: Record<string, number> = {}
			for (const h of helpers) counts[h.registry] = (counts[h.registry] || 0) + 1
			const parent = dirs.filter((d) => d !== dir && dir.startsWith(d + '/')).sort((a, b) => b.length - a.length)[0]
			return {
				name: '',
				path: dir,
				pathDisplay: this.display(dir),
				description,
				lastCommitAt: at || null,
				lastCommitSubject: subject.join('\t') || null,
				lastOpenedAt: opened || null,
				lastTouchedAt: touched ? new Date(touched).toISOString() : null,
				daysSinceTouched: touched ? Math.floor((now - touched) / 86_400_000) : null,
				uncommitted: status.ok ? (status.out ? status.out.split('\n').length : 0) : null,
				gitRepo: log.ok,
				helperCounts: counts,
				insideProject: parent ? this.display(parent) : null,
			}
		}))

		// Names: the folder name, or enough of the path to be unique.
		for (const p of projects) {
			const parts = p.pathDisplay.split('/').filter((s) => s && s !== '~')
			let n = 1
			let name = parts.slice(-n).join('/')
			while (n < parts.length && projects.some((q) => q !== p && q.pathDisplay.split('/').filter((s) => s && s !== '~').slice(-n).join('/') === name)) {
				n++
				name = parts.slice(-n).join('/')
			}
			p.name = name
		}
		return projects
	}

	/**
	 * Every Luca project in the portfolio, newest activity first. A scan
	 * stays fresh for `maxAgeMs` (5 minutes); pass `refresh` to scan again.
	 *
	 * @param options - `refresh`: scan now even when the last scan is fresh
	 * @returns One summary per project: name, path, description, git activity, helper counts
	 * @example
	 * ```typescript
	 * const projects = await container.feature('portfolio').projects({ refresh: true })
	 * ```
	 */
	async projects(options: { refresh?: boolean } = {}): Promise<PortfolioProject[]> {
		const maxAge = this.options.maxAgeMs ?? 5 * 60_000
		if (!options.refresh && this.cache && Date.now() - this.cache.at < maxAge) return this.cache.projects
		if (!this.scan) {
			this.state.set('scanning', true)
			this.scan = this.scanAll().then((projects) => {
				projects.sort((a, b) => (Date.parse(b.lastTouchedAt || '') || 0) - (Date.parse(a.lastTouchedAt || '') || 0))
				this.cache = { at: Date.now(), projects }
				this.state.set('scannedAt', Date.now())
				this.state.set('projectCount', projects.length)
				return projects
			}).finally(() => {
				this.scan = null
				this.state.set('scanning', false)
			})
		}
		return this.scan
	}

	/**
	 * Find one project by name, path, or the end of its path.
	 *
	 * @param ref - `invoice-sync`, `@work/projects/invoice-sync`, `~/@work` or an absolute path
	 * @returns The project
	 * @throws When nothing matches, or more than one project does (the message lists them)
	 * @example
	 * ```typescript
	 * const p = await container.feature('portfolio').resolve('invoice-sync')
	 * ```
	 */
	async resolve(ref: string): Promise<PortfolioProject> {
		const projects = await this.projects()
		const wanted = ref.trim().replace(/\/+$/, '')
		const abs = wanted.startsWith('/') || wanted.startsWith('~') ? this.expand(wanted) : null
		const exact = projects.filter((p) => p.name === wanted || p.path === abs || p.pathDisplay === wanted)
		if (exact.length === 1) return exact[0]!
		const lower = wanted.toLowerCase()
		const loose = projects.filter((p) => p.path.toLowerCase().endsWith('/' + lower) || p.name.toLowerCase() === lower)
		if (loose.length === 1) return loose[0]!
		const pool = loose.length ? loose : projects.filter((p) => p.name.toLowerCase().includes(lower))
		if (pool.length === 1) return pool[0]!
		if (!pool.length) throw new Error(`No project in the portfolio matches "${ref}". Call listProjects to see them all.`)
		throw new Error(`"${ref}" matches ${pool.length} projects: ${pool.map((p) => p.name).join(', ')}. Use one of these names.`)
	}

	/**
	 * One project in detail: its summary, every helper with its id and the
	 * first paragraph of its docs, and the top of its README.
	 *
	 * @param ref - A project name or path (see resolve)
	 * @returns The project summary plus `helpers` and `readme`
	 * @example
	 * ```typescript
	 * const detail = await container.feature('portfolio').project('invoice-sync')
	 * ```
	 */
	async project(ref: string): Promise<PortfolioProject & { helpers: Helper[]; readme: string; instructions: string | null }> {
		const fs = this.container.feature('fs')
		const p = await this.resolve(ref)
		const helpers = await Promise.all((await this.helperFiles(p.path)).map((h) => this.readHelper(h.registry, h.file)))
		let readme = ''
		const readmeFile = this.container.paths.resolve(p.path, 'README.md')
		if (await fs.existsAsync(readmeFile)) readme = String(await fs.readFileAsync(readmeFile)).slice(0, 3000)
		const instructions = ['CLAUDE.md', 'AGENTS.md'].map((f) => this.container.paths.resolve(p.path, f)).find((f) => fs.existsSync(f)) || null
		return {
			...p,
			helpers: helpers.map((h) => ({ ...h, file: this.container.paths.relative(p.path, h.file) })),
			readme,
			instructions,
		}
	}

	/**
	 * Search every project's helpers for a capability. A helper matches when
	 * a term is in its id, file path or docs summary. With `content` (on by
	 * default) the helper folders, top-level markdown and `docs/` are also
	 * searched with ripgrep for any term, case-insensitively.
	 *
	 * @param options - `terms`: words or regexes, any of which may match. `content`: search file contents too. `limit`: most file hits per project
	 * @returns Projects with matches, the strongest first: `helpers` matched by name or docs, `files` matched by content with the first matching line
	 * @example
	 * ```typescript
	 * const hits = await container.feature('portfolio').search({ terms: ['microsoft', 'graph', 'o365'] })
	 * ```
	 */
	async search(options: { terms: string[]; content?: boolean; limit?: number; projects?: string[] }) {
		const terms = options.terms.map((t) => t.trim()).filter(Boolean)
		if (!terms.length) throw new Error('Give at least one search term.')
		const limit = options.limit ?? 8
		let projects = await this.projects()
		if (options.projects?.length) projects = await Promise.all(options.projects.map((r) => this.resolve(r)))
		const regexes = terms.map((t) => { try { return new RegExp(t, 'i') } catch { return new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') } })
		const grep = this.container.feature('grep')
		const fs = this.container.feature('fs')

		const results = await Promise.all(projects.map(async (p) => {
			const helpers = await Promise.all((await this.helperFiles(p.path)).map((h) => this.readHelper(h.registry, h.file)))
			const matched = helpers.filter((h) => regexes.some((r) => r.test(h.id) || r.test(this.container.paths.relative(p.path, h.file)) || r.test(h.summary)))
			let files: { file: string; line: number; text: string }[] = []
			if (options.content !== false) {
				const targets = [
					...Object.keys(HELPER_FOLDERS).flatMap((f) => [f, `src/${f}`]),
					'docs', 'README.md', 'CLAUDE.md', 'AGENTS.md', 'luca.cli.ts',
				].map((f) => this.container.paths.resolve(p.path, f)).filter((f) => fs.existsSync(f))
				const pattern = terms.map((t) => `(?:${t})`).join('|')
				const hits = await Promise.all(targets.map((path) => grep.search({
					pattern, path, ignoreCase: true, exclude: ['node_modules', '*.lock', '*.min.js', 'generated*'], maxResults: 40,
				}).catch(() => [] as any[])))
				const seen = new Map<string, { file: string; line: number; text: string }>()
				for (const h of hits.flat()) {
					const rel = this.container.paths.relative(p.path, this.container.paths.resolve(h.file))
					if (!seen.has(rel)) seen.set(rel, { file: rel, line: h.line, text: String(h.content || '').trim().slice(0, 200) })
				}
				files = [...seen.values()]
			}
			const helperFiles = new Set(matched.map((h) => this.container.paths.relative(p.path, h.file)))
			const fileHits = files.filter((f) => ![...helperFiles].some((hf) => f.file === hf || f.file.startsWith(hf + '/')))
			return {
				project: p.name,
				path: p.pathDisplay,
				helpers: matched.map((h) => ({ registry: h.registry, id: h.id, file: this.container.paths.relative(p.path, h.file), summary: h.summary })),
				files: fileHits.slice(0, limit),
				moreFiles: Math.max(0, fileHits.length - limit),
				score: matched.length * 10 + fileHits.length,
			}
		}))
		return results.filter((r) => r.score > 0).sort((a, b) => b.score - a.score)
	}

	/**
	 * Send helpers from one project to another for review. This writes
	 * nothing: it emits `review`, and Luca Desktop opens one change tile per
	 * helper in the receiving project. The tile shows the plan (files, clashes,
	 * relative imports, packages) and the human writes it there.
	 *
	 * A path inside an assistant folder means the whole assistant. A path that
	 * is not a helper is listed in `notHelpers` and not sent.
	 *
	 * @param options - `from` and `to`: project names or paths. `files`: paths relative to `from`, e.g. `features/microsoft-graph.ts`
	 * @returns The helpers sent, the files that are not helpers, helpers the code needs that the target lacks, and env vars the code reads
	 * @example
	 * ```typescript
	 * await container.feature('portfolio').reviewCopy({ from: 'office-tools', to: 'invoice-sync', files: ['features/microsoft-graph.ts'] })
	 * ```
	 */
	async reviewCopy(options: { from: string; to: string; files: string[] }): Promise<CopyReview> {
		const fs = this.container.feature('fs')
		const paths = this.container.paths
		const from = await this.resolve(options.from)
		const to = await this.resolve(options.to)
		if (from.path === to.path) throw new Error('The source and the target are the same project.')

		const sourceList = await this.helperFiles(from.path)
		const inside = (root: string, p: string) => p === root || p.startsWith(root + '/')
		const changes: ReviewChange[] = []
		const notHelpers: string[] = []
		for (const rel of options.files) {
			const abs = paths.resolve(from.path, rel)
			if (!inside(from.path, abs)) throw new Error(`${rel} is outside ${from.pathDisplay}.`)
			if (!(await fs.existsAsync(abs))) throw new Error(`${rel} does not exist in ${from.pathDisplay}.`)
			const entry = sourceList.find((h) => h.file === abs || (h.registry === 'assistants' && inside(h.file, abs)))
			if (!entry || entry.registry === 'workbench') { notHelpers.push(rel); continue }
			if (changes.some((c) => c.file === entry.file)) continue
			const helper = await this.readHelper(entry.registry, entry.file)
			changes.push({ registry: entry.registry, id: helper.id, file: entry.file, root: from.path })
		}

		// What the change tile cannot see: helpers the code calls that only the
		// source project defines, and env vars the code reads.
		const helperRefs = new Set<string>()
		const env = new Set<string>()
		const codeFiles: string[] = []
		for (const c of changes) {
			if (c.registry !== 'assistants') { codeFiles.push(c.file); continue }
			const listing = await fs.walkAsync(c.file, { directories: false, exclude: ['node_modules', '.DS_Store'] })
			const list: string[] = Array.isArray(listing) ? listing : (listing?.files || [])
			codeFiles.push(...list.map((f) => paths.resolve(c.file, f)))
		}
		for (const file of codeFiles) {
			if (!/\.(ts|js|tsx|jsx)$/.test(file)) continue
			const text = String(await fs.readFileAsync(file))
			for (const m of text.matchAll(/\.(feature|client|server)\(\s*['"]([\w-]+)['"]/g)) helperRefs.add(`${m[1]}s/${m[2]}`)
			for (const m of text.matchAll(/process\.env\.([A-Z0-9_]+)|process\.env\[['"]([A-Z0-9_]+)['"]\]/g)) env.add(m[1] || m[2]!)
		}
		const index = async (list: { registry: string; file: string }[]) => new Map((await Promise.all(list.map((h) => this.readHelper(h.registry, h.file))))
			.map((h) => [`${h.registry}/${h.id}`, h.file] as const))
		const [sourceHelpers, targetHelpers] = await Promise.all([index(sourceList), this.helperFiles(to.path).then(index)])
		const sent = new Set(changes.map((c) => c.file))
		const helperDeps = [...helperRefs].sort()
			.filter((ref) => sourceHelpers.has(ref) && !targetHelpers.has(ref) && !sent.has(sourceHelpers.get(ref)!))
			.map((ref) => ({ helper: ref, file: paths.relative(from.path, sourceHelpers.get(ref)!) }))

		const notes: string[] = []
		if (changes.length) notes.push(`Luca Desktop was asked to open ${changes.length} change tile${changes.length === 1 ? '' : 's'} in ${to.name}, beside this chat. The human reviews each one and writes it there; nothing is written until then.`)
		if (helperDeps.length) notes.push(`The code uses ${helperDeps.map((d) => `${d.helper} (${d.file})`).join(', ')}, which ${from.name} defines and ${to.name} does not have. Send those too, or the copy fails when it calls them.`)
		if (notHelpers.length) notes.push(`Not helpers, so not sent: ${notHelpers.join(', ')}. Tell the human; they can copy those by hand.`)
		if (env.size) notes.push(`The code reads ${[...env].sort().join(', ')}. They go in ${to.pathDisplay}/.env.`)

		if (changes.length) this.emit('review', { target: to.path, changes })
		return {
			from: from.pathDisplay,
			to: to.pathDisplay,
			changes: changes.map(({ registry, id, file }) => ({ registry, id, file: paths.relative(from.path, file) })),
			notHelpers,
			helperDeps,
			envVars: [...env].sort(),
			notes,
		}
	}
}

export default Portfolio
