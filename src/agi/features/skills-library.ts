import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from '../../schemas/base.js'
import { type AvailableFeatures, Feature } from '@soederpop/luca/feature'
import { parse } from 'contentbase'
import type { DocsReader } from './docs-reader.js'

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
})

export const SkillsLibraryOptionsSchema = FeatureOptionsSchema.extend({
	configPath: z.string().optional().describe('Override path for skills.json (defaults to ~/.luca/skills.json)'),
})

export const SkillsLibraryEventsSchema = FeatureEventsSchema.extend({
	loaded: z.tuple([]).describe('Fired after all skill locations have been scanned'),
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
	static tools: Record<string, { schema: z.ZodType; handler?: Function }> = {
		searchAvailableSkills: {
			schema: z.object({
				query: z.string().optional().describe('Optional search term to filter skills by name or description'),
			}).describe('Search for available skills in the library. Returns matching skill names and descriptions.'),
		},
		loadSkill: {
			schema: z.object({
				skillName: z.string().describe('The name of the skill to load'),
			}).describe('Load a skill by name and return its full SKILL.md content and metadata.'),
		},
		askSkillBasedQuestion: {
			schema: z.object({
				skillName: z.string().describe('The name of the skill to query'),
				question: z.string().describe('The question to ask about the skill'),
			}).describe('Ask a question about a specific skill using AI-assisted document reading.'),
		},
	}

	/** Internal map of discovered skills keyed by name. */
	private _skills = new Map<string, SkillInfo>()

	/** @returns Default state. */
	override get initialState(): SkillsLibraryState {
		return {
			...super.initialState,
			loaded: false,
			locations: [],
			skillCount: 0,
		}
	}

	/** Resolved path to the skills.json config file. */
	get configPath(): string {
		if (this.options.configPath) return this.options.configPath
		const { os, paths } = this.container
		return paths.join(os.homedir, '.luca', 'skills.json')
	}

	/** Whether the library has been loaded. */
	get isLoaded(): boolean {
		return !!this.state.get('loaded')
	}

	/** Expand ~ to home directory in a path. */
	private expandHome(p: string): string {
		if (!p.startsWith('~')) return p
		const { os, paths } = this.container
		return paths.join(os.homedir, p.slice(1))
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
		fs.mkdirp(paths.join(os.homedir, '.luca'))
		fs.writeJson(this.configPath, config, 2)
	}

	/**
	 * Start the skills library: read config, scan all locations.
	 *
	 * @returns This instance for chaining
	 */
	async start(): Promise<SkillsLibrary> {
		if (this.isLoaded) return this

		const config = this.readConfig()
		const locations = config.locations.map(l => this.expandHome(l))
		this.state.set('locations', locations)

		for (const loc of locations) {
			await this.scanLocation(loc)
		}

		this.state.set('loaded', true)
		this.state.set('skillCount', this._skills.size)
		this.emit('loaded')

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
		this.state.set('skillCount', this._skills.size)
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
		for (const [name, info] of this._skills) {
			if (info.locationPath === resolved) {
				this._skills.delete(name)
			}
		}
		this.state.set('skillCount', this._skills.size)

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
			const skillDir = paths.join(locationPath, entry)
			const skillFile = paths.join(skillDir, 'SKILL.md')

			if (!fs.exists(skillFile)) continue

			try {
				const parsed = await parse(skillFile)
				const meta = (parsed.meta || {}) as Record<string, unknown>
				const name = (meta.name as string) || entry

				const info: SkillInfo = {
					name,
					description: (meta.description as string) || '',
					path: skillDir,
					skillFilePath: skillFile,
					locationPath,
					meta,
				}

				this._skills.set(name, info)
				this.emit('skillDiscovered', info)
			} catch {
				// Skip unparseable skill files
			}
		}
	}

	/** Return all discovered skills. */
	list(): SkillInfo[] {
		return Array.from(this._skills.values())
	}

	/** Find a skill by name. */
	find(skillName: string): SkillInfo | undefined {
		return this._skills.get(skillName)
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
		const dir = paths.join(os.tmpdir, 'luca-skills', hash)

		if (fs.exists(dir)) return dir

		fs.mkdirp(dir)

		for (const name of skillNames) {
			const skill = this.find(name)
			if (!skill) throw new Error(`Skill "${name}" not found in the library`)

			const dest = paths.join(dir, name)
			if (!fs.exists(dest)) {
				fs.copy(skill.path, dest)
			}
		}

		return dir
	}

	// --- Tool handlers for assistant.use(skillsLibrary) ---

	/** Search available skills, optionally filtered by a query string. */
	async searchAvailableSkills({ query }: { query?: string } = {}): Promise<string> {
		if (!this.isLoaded) await this.start()

		let skills = this.list()

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
		if (!this.isLoaded) await this.start()

		const skill = this.find(skillName)
		if (!skill) return `Skill "${skillName}" not found.`

		const content = this.container.fs.readFile(skill.skillFilePath)

		return `# Skill: ${skill.name}\n\n**Description:** ${skill.description}\n**Path:** ${skill.path}\n\n---\n\n${content}`
	}

	/** Ask a question about a specific skill using a DocsReader. */
	async askSkillBasedQuestion({ skillName, question }: { skillName: string; question: string }): Promise<string> {
		if (!this.isLoaded) await this.start()

		const reader = this.createSkillReader(skillName)
		const answer = await reader.ask(question)
		return answer
	}
}

export default SkillsLibrary
