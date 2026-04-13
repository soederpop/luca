import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from '../../schemas/base.js'
import { type AvailableFeatures } from '@soederpop/luca/feature'
import { Feature } from '../feature.js'
import { parse } from 'contentbase'
import type { DocsReader } from './docs-reader.js'
import Assistant from './assistant.js'

declare module '@soederpop/luca/feature' {
	interface AvailableFeatures {
		skillsLibrary: typeof SkillsLibrary
	}
}

export interface SkillInfo {
	/** Skill name derived from folder name or frontmatter */
	name: string
	/** Description from frontmatter */
	description: string
	/** Absolute path to the skill folder (dirname of SKILL.md) */
	path: string
	/** Absolute path to SKILL.md */
	skillFilePath: string
	/** Which location this skill was found in */
	locationPath: string
	/** All frontmatter metadata */
	meta: Record<string, unknown>
}

export const SkillsLibraryStateSchema = FeatureStateSchema.extend({
	loaded: z.boolean().describe('Whether skill locations have been scanned'),
	locations: z.array(z.string()).describe('Tracked skill location folder paths'),
	skillCount: z.number().describe('Total number of discovered skills'),
	skills: z.record(z.string(), z.any()).describe('Discovered skills keyed by name'),
})

export const SkillsLibraryOptionsSchema = FeatureOptionsSchema.extend({
	configPath: z.string().optional().describe('Override path for skills.json (defaults to ~/.luca/skills.json)'),
	only: z.array(z.string()).optional().describe('Glob patterns to filter which skills are exposed. When set, only matching skills are available. Supports * wildcards (e.g. "luca-*", "react-ink").'),
	locations: z.array(z.string()).optional().describe('Additional skill location directories to scan for this instance only. Not persisted to skills.json — other consumers will not see these.'),
})

export const SkillsLibraryEventsSchema = FeatureEventsSchema.extend({
	started: z.tuple([]).describe('Fired after all skill locations have been scanned'),
	locationAdded: z.tuple([z.string().describe('The absolute path of the added location')]).describe('Fired when a new skill location is registered'),
	skillDiscovered: z.tuple([z.any().describe('The SkillInfo object')]).describe('Fired when a skill is discovered during scanning'),
}).describe('SkillsLibrary events')

export type SkillsLibraryState = z.infer<typeof SkillsLibraryStateSchema>
export type SkillsLibraryOptions = z.infer<typeof SkillsLibraryOptionsSchema>

/**
 * Manages a registry of skill locations — folders containing SKILL.md files.
 *
 * Persists known locations to ~/.luca/skills.json and scans them on start.
 * Each skill folder can be opened as a DocsReader for AI-assisted Q&A.
 * Exposes tools for assistant integration via assistant.use(skillsLibrary).
 *
 * @extends Feature
 * @example
 * ```typescript
 * const lib = container.feature('skillsLibrary')
 * await lib.start()
 * await lib.addLocation('~/.claude/skills')
 * lib.list() // => SkillInfo[]
 * const reader = lib.createSkillReader('my-skill')
 * ```
 */
export class SkillsLibrary extends Feature<SkillsLibraryState, SkillsLibraryOptions> {
	static override stateSchema = SkillsLibraryStateSchema
	static override optionsSchema = SkillsLibraryOptionsSchema
	static override eventsSchema = SkillsLibraryEventsSchema
	static override shortcut = 'features.skillsLibrary' as const

	static { Feature.register(this, 'skillsLibrary') }

	/** Tools for assistant integration via assistant.use(skillsLibrary). */
	static override tools: Record<string, { schema: z.ZodType; handler?: Function }> = {
		searchAvailableSkills: {
			schema: z.object({
				query: z.string().optional().describe('A keyword or phrase to filter skills by name or description. Omit to list all available skills.'),
			}).describe('Discover what skills are available. Call this first when you need specialized knowledge — skills are curated guides and reference material for specific domains (frameworks, tools, patterns). Returns skill names and descriptions so you can decide which to load.'),
		},
		loadSkill: {
			schema: z.object({
				skillName: z.string().describe('The exact skill name as returned by searchAvailableSkills'),
			}).describe('Load a skill\'s full reference content (SKILL.md). This gives you detailed guidance, examples, and best practices for that domain. Load a skill before attempting work in an unfamiliar area — the content is curated to prevent common mistakes.'),
		},
		askSkillBasedQuestion: {
			schema: z.object({
				skillName: z.string().describe('The exact skill name to query'),
				question: z.string().describe('A specific question about the skill\'s domain. Be precise — "how do I add a new feature to the container?" is better than "tell me about features".'),
			}).describe('Ask a focused question about a skill\'s domain using AI-assisted document reading. Use this when you need a specific answer from a skill rather than reading the whole thing. More efficient than loadSkill for targeted lookups.'),
		},
	}

	/** @returns Default state. */
	override get initialState(): SkillsLibraryState {
		return {
			...super.initialState,
			started: false,
			locations: [],
			skillCount: 0,
			skills: {},
		}
	}
	
	override setupToolsConsumer(assistant: Feature) {
		if (!(assistant instanceof Assistant)) {
			throw new Error('Skills library tools require an Assistant instance (including subclasses).')
		}

		const a : Assistant = assistant as Assistant
		const { container } = a
		const skillsLibrary = this
		const skillCount = Object.keys(this.filteredSkills).length
		const isSmallSet = skillCount <= 10

		if (!isSmallSet && !this.options.only) {
			if (!process.env.LUCA_SKILLS_NO_WARN) {
				container.feature('ui').print.yellow(`SkillsLibrary: ${skillCount} skills loaded with no \`only\` filter. Use container.feature('skillsLibrary', { only: ['pattern*'] }) to limit, or set LUCA_SKILLS_NO_WARN=1 to silence.`)
			}
		}

		if (isSmallSet) {
			const table = Object.entries(this.skillsTable)
				.map(([name, desc]) => `- **${name}**: ${desc}`)
				.join('\n')

			a.addSystemPromptExtension('skillsLibrary', [
				'## Skills Library',
				'',
				'You have access to the following curated skills — domain-specific reference guides with examples, patterns, and best practices.',
				'',
				'**Available skills:**',
				table,
				'',
				'**When to use skills:**',
				'- When working in an unfamiliar domain or framework — load the skill before writing code',
				'- When you see "Required Skills" in a message — load those skills immediately with `loadSkill` before answering',
				'',
				'**Workflow:** Choose a skill from the list above → `loadSkill` to get the full guide → follow its patterns. Use `askSkillBasedQuestion` for targeted lookups when you don\'t need the whole guide.',
				'',
				'**Skills are authoritative.** When a loaded skill contradicts your general knowledge, follow the skill — it reflects project-specific conventions and decisions.',
			].join('\n'))
		} else {
			a.addSystemPromptExtension('skillsLibrary', [
				'## Skills Library',
				'',
				`You have access to a large library of ${skillCount} curated skills — domain-specific reference guides with examples, patterns, and best practices.`,
				'',
				'**When to use skills:**',
				'- When working in an unfamiliar domain or framework — search for a skill before writing code',
				'- When the user asks about a topic that might have a matching skill — search first',
				'- When you see "Required Skills" in a message — load those skills immediately with `loadSkill` before answering',
				'',
				'**Workflow:** `searchAvailableSkills` → find relevant skill → `loadSkill` to get the full guide → follow its patterns. Use `askSkillBasedQuestion` for targeted lookups when you don\'t need the whole guide.',
				'',
				'**Skills are authoritative.** When a loaded skill contradicts your general knowledge, follow the skill — it reflects project-specific conventions and decisions.',
			].join('\n'))
		}

		const preloadSkills : string[] = []
		if (a.meta.skills) {
			if (Array.isArray(a.meta.skills)) {
				preloadSkills.push(...a.meta.skills)
			} else {
				preloadSkills.push(a.meta.skills)
			}
		}

		// Only use the fork-based auto-detection for small skill sets
		if (isSmallSet) {
			async function beforeAskCheckIfWeNeedSkills(ctx: any, next: any) {
					const { question } = ctx
					const skills = await skillsLibrary.findRelevantSkillsForAssistant(a, question as string)

					const allSkillsToLoad : string[] = container.utils.lodash.uniq([
						...skills,
						...preloadSkills,
					])

					if (allSkillsToLoad.length) {
						ctx.question = `${ctx.question} \n\n## Required Skills\nYou will need to load the following skills to answer this question: ${allSkillsToLoad.join(', ')}`
					}

					a.interceptors.beforeAsk.remove(beforeAskCheckIfWeNeedSkills)

					await next()
			}

			assistant.intercept('beforeAsk', beforeAskCheckIfWeNeedSkills as any)
		}

		return assistant
	}

	/** Discovered skills keyed by name (unfiltered). */
	get skills(): Record<string, SkillInfo> {
		return (this.state.get('skills') || {}) as Record<string, SkillInfo>
	}

	/** Skills filtered by the `only` option when set. */
	get filteredSkills(): Record<string, SkillInfo> {
		const all = this.skills
		const only = this.options.only
		if (!only || only.length === 0) return all

		const result: Record<string, SkillInfo> = {}
		for (const [name, info] of Object.entries(all)) {
			if (only.some(pattern => this.matchPattern(pattern, name))) {
				result[name] = info
			}
		}
		return result
	}

	get availableSkills() {
		return Object.keys(this.filteredSkills)
	}

	get skillsTable() : Record<string, string> {
		const skills = this.filteredSkills

		return Object.fromEntries(
			Object.keys(skills).map((name) => [name, skills[name]!.description])
		)
	}

	/** Match a name against a glob pattern (* wildcards). */
	private matchPattern(pattern: string, name: string): boolean {
		if (pattern === '*') return true
		if (!pattern.includes('*')) return pattern === name
		const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
		return new RegExp(`^${escaped}$`).test(name)
	}

	/** Resolved path to the skills.json config file. */
	get configPath(): string {
		if (this.options.configPath) return this.options.configPath
		const { os, paths } = this.container
		return paths.resolve(os.homedir, '.luca', 'skills.json')
	}

	/** Whether the library has been loaded. */
	get isStarted(): boolean {
		return !!this.state.get('started')
	}
	
	/** Expand ~ to home directory in a path. */
	private expandHome(p: string): string {
		return p.replace(/^\~/, this.container.os.homedir)
	}

	/** Read the persisted config, creating it if it doesn't exist. */
	private readConfig(): { locations: string[] } {
		const { fs } = this.container

		if (!fs.exists(this.configPath)) {
			const defaultConfig = { locations: [] as string[] }
			this.writeConfig(defaultConfig)
			return defaultConfig
		}

		return fs.readJson(this.configPath)
	}

	/** Write the config back to disk. */
	private writeConfig(config: { locations: string[] }): void {
		const { fs, os, paths } = this.container
		fs.mkdirp(paths.resolve(os.homedir, '.luca'))
		fs.writeJson(this.configPath, config, 2)
	}

	/**
	 * Start the skills library: read config, scan all locations.
	 *
	 * @returns This instance for chaining
	 */
	async start(): Promise<SkillsLibrary> {
		if (this.isStarted) return this

	  const { uniq } = this.container.utils.lodash
		const config = this.readConfig()
		const configLocations = config.locations.map(l => this.expandHome(l))
		const instanceLocations = (this.options.locations || []).map(l => this.expandHome(l))
		const allLocations = uniq([
			...configLocations,
			...instanceLocations,
			(this.container as any).paths.resolve((this.container as any).os.homedir, '.claude', 'skills'),
			(this.container as any).paths.resolve((this.container as any).cwd, '.claude', 'skills')
		]).filter(Boolean).filter(l => (this.container as any).fs.exists(l))
		this.state.set('locations', allLocations)

		for (const loc of allLocations) {
			await this.scanLocation(loc)
		}

		this.state.set('started', true)
		this.state.set('skillCount', Object.keys(this.skills).length)
		this.emit('started')

		return this
	}

	/**
	 * Add a new skill location folder and scan it for skills.
	 *
	 * @param locationPath - Path to a directory containing skill subfolders with SKILL.md
	 */
	async addLocation(locationPath: string): Promise<void> {
		const resolved = this.expandHome(locationPath)
		const current = this.state.get('locations') as string[]

		if (current.includes(resolved)) return

		const updated = [...current, resolved]
		this.state.set('locations', updated)

		// Persist — store the original (unexpanded) path for portability
		const config = this.readConfig()
		if (!config.locations.includes(locationPath)) {
			config.locations.push(locationPath)
			this.writeConfig(config)
		}

		await this.scanLocation(resolved)
		this.state.set('skillCount', Object.keys(this.skills).length)
		this.emit('locationAdded', resolved)
	}

	/**
	 * Remove a skill location and its skills from the library.
	 *
	 * @param locationPath - The location path to remove
	 */
	async removeLocation(locationPath: string): Promise<void> {
		const resolved = this.expandHome(locationPath)
		const current = this.state.get('locations') as string[]
		this.state.set('locations', current.filter(l => l !== resolved))

		// Remove skills from this location
		const remaining: Record<string, SkillInfo> = {}
		for (const [name, info] of Object.entries(this.skills)) {
			if (info.locationPath !== resolved) {
				remaining[name] = info
			}
		}
		this.state.set('skills', remaining)
		this.state.set('skillCount', Object.keys(remaining).length)

		// Persist
		const config = this.readConfig()
		config.locations = config.locations.filter(l => this.expandHome(l) !== resolved)
		this.writeConfig(config)
	}

	/**
	 * Scan a location folder for skill subfolders containing SKILL.md.
	 *
	 * @param locationPath - Absolute path to scan
	 */
	async scanLocation(locationPath: string): Promise<void> {
		const { fs, paths } = this.container
		if (!fs.exists(locationPath)) return

		const entries = fs.readdirSync(locationPath)

		for (const entry of entries) {
			const skillDir = paths.resolve(locationPath, entry)
			const skillFile = paths.resolve(skillDir, 'SKILL.md')

			if (!fs.exists(skillFile)) continue

			try {
				const parsed = await parse(skillFile)
				const meta = (parsed.meta || {}) as Record<string, unknown>
				const name = entry

				const info: SkillInfo = {
					name,
					description: (meta.description as string) || '',
					path: skillDir,
					skillFilePath: skillFile,
					locationPath,
					meta,
				}

				this.state.set('skills', { ...this.skills, [name]: info })
				this.emit('skillDiscovered', info)
			} catch {
				// Skip unparseable skill files
			}
		}
	}

	/** Return all discovered skills (respects the `only` filter). */
	list(): SkillInfo[] {
		return Object.values(this.filteredSkills)
	}

	/** Find a skill by name. */
	find(skillName: string): SkillInfo | undefined {
		return this.skills[skillName]
	}

	/**
	 * Create a DocsReader for a skill's folder, enabling AI-assisted Q&A.
	 *
	 * @param skillName - Name of the skill to create a reader for
	 * @returns A DocsReader instance rooted at the skill's folder
	 */
	createSkillReader(skillName: string): DocsReader {
		const skill = this.find(skillName)
		if (!skill) throw new Error(`Skill "${skillName}" not found in the library`)

		return this.container.feature('docsReader', { contentDb: skill.path })
	}

	/**
	 * Create a tmp directory containing symlinked/copied skill folders by name,
	 * suitable for passing to claude --add-dir.
	 *
	 * @param skillNames - Array of skill names to include
	 * @returns Absolute path to the created directory
	 */
	ensureFolderCreatedWithSkillsByName(skillNames: string[]): string {
		const { fs, paths, os } = this.container
		const hash = this.container.utils.hashObject(skillNames.sort())
		const dir = paths.resolve(os.tmpdir, 'luca-skills', hash)

		if (fs.exists(dir)) return dir

		fs.mkdirp(dir)

		for (const name of skillNames) {
			const skill = this.find(name)
			if (!skill) throw new Error(`Skill "${name}" not found in the library`)

			const dest = paths.resolve(dir, name)
			if (!fs.exists(dest)) {
				fs.copy(skill.path, dest)
			}
		}

		return dir
	}

	// --- Tool handlers for assistant.use(skillsLibrary) ---

	/** Search available skills, optionally filtered by a query string. Respects the `only` filter. */
	async searchAvailableSkills({ query }: { query?: string } = {}): Promise<string> {
		if (!this.isStarted) await this.start()

		let skills = Object.values(this.filteredSkills)

		if (query) {
			const q = query.toLowerCase()
			skills = skills.filter(s =>
				s.name.toLowerCase().includes(q) ||
				s.description.toLowerCase().includes(q)
			)
		}

		if (skills.length === 0) return 'No skills found.'

		return skills.map(s => `- **${s.name}**: ${s.description || '(no description)'}\n  Path: ${s.path}`).join('\n')
	}

	/** Load a skill's full SKILL.md content and metadata. */
	async loadSkill({ skillName }: { skillName: string }): Promise<string> {
		if (!this.isStarted) await this.start()

		const skill = this.find(skillName)
		if (!skill) return `Skill "${skillName}" not found.`

		const content = this.container.fs.readFile(skill.skillFilePath)

		return `# Skill: ${skill.name}\n\n**Description:** ${skill.description}\n**Path:** ${skill.path}\n\n---\n\n${content}`
	}

	/** Ask a question about a specific skill using a DocsReader. */
	async askSkillBasedQuestion({ skillName, question }: { skillName: string; question: string }): Promise<string> {
		if (!this.isStarted) await this.start()

		const reader = this.createSkillReader(skillName)
		const answer = await reader.ask(question)
		return answer
	}

	/**
	 * Fork the given assistant and ask it which skills (if any) are relevant
	 * to the user's query. Returns an array of skill names that should be loaded
	 * before the real question is answered.
	 *
	 * The fork is ephemeral (historyMode: 'none') and uses structured output so
	 * the result is always a clean string array — never free text.
	 *
	 * @param assistant - The assistant instance to fork
	 * @param userQuery - The user's original question
	 * @returns Array of skill names relevant to the query (may be empty)
	 */
	async findRelevantSkillsForAssistant(assistant: Assistant, userQuery: string): Promise<string[]> {
		if (!this.isStarted) await this.start()

		const skills = this.list()
		if (skills.length === 0) return []

		const responseSchema = z.object({
			skills: z.array(z.string()).describe('Names of skills relevant to the query. Empty array if none apply.'),
		})
	
		const skillsDescription = Object.entries(this.skillsTable)
			.map(([title,description]) => `- **${title}**: ${description}`)
			.join("\n")

		const prompt = this.container.ui.endent(`You are a routing assistant. Given a user query and a list of available skills, determine which skills (if any) should be loaded to help answer the query.
Available skills:
-------
${skillsDescription}

User query: ${userQuery}

Return only the skill names that are directly relevant. Return an empty array if none apply. Do not load skills speculatively — only include ones that would materially help answer this specific query.`)
			
			const fork = assistant.conversation.fork()
			const result = await fork.ask(prompt, { schema: responseSchema }) as unknown as { skills: string[] }

			const found = result.skills.filter(name => this.find(name) !== undefined)
			
			this.emit('foundSkills', found, assistant, userQuery)
			
			return found
	}
}

export default SkillsLibrary
