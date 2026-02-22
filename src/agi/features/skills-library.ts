import { z } from 'zod'
import path from 'path'
import os from 'os'
import fs from 'fs/promises'
import yaml from 'js-yaml'
import { kebabCase } from 'lodash-es'
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'
import type { Container } from '@soederpop/luca/container'
import { type AvailableFeatures, features, Feature } from '@soederpop/luca/feature'
import { Collection, defineModel } from 'contentbase'
import type { ConversationTool } from './conversation'

declare module '@soederpop/luca/feature' {
	interface AvailableFeatures {
		skillsLibrary: typeof SkillsLibrary
	}
}

export interface SkillEntry {
	/** Skill name from frontmatter */
	name: string
	/** Skill description from frontmatter */
	description: string
	/** Markdown body (instructions) */
	body: string
	/** Raw content including frontmatter */
	raw: string
	/** Which collection this came from */
	source: 'project' | 'user'
	/** Directory/path id within its collection */
	pathId: string
	/** All frontmatter metadata */
	meta: Record<string, unknown>
}

const SkillMetaSchema = z.object({
	name: z.string().describe('Unique name identifier for the skill'),
	description: z.string().describe('What the skill does and when to use it'),
	version: z.string().optional().describe('Skill version'),
	tags: z.array(z.string()).optional().describe('Tags for categorization'),
	author: z.string().optional().describe('Skill author'),
	license: z.string().optional().describe('Skill license'),
})

const SkillModel = defineModel('Skill', {
	meta: SkillMetaSchema as any,
	match: (doc: { id: string; meta: Record<string, unknown> }) =>
		doc.id.endsWith('/SKILL') || doc.id === 'SKILL',
})

export const SkillsLibraryStateSchema = FeatureStateSchema.extend({
	loaded: z.boolean().describe('Whether both collections have been loaded'),
	projectSkillCount: z.number().describe('Number of skills in the project collection'),
	userSkillCount: z.number().describe('Number of skills in the user-level collection'),
	totalSkillCount: z.number().describe('Total number of skills across both collections'),
})

export const SkillsLibraryOptionsSchema = FeatureOptionsSchema.extend({
	/** Path to project-level skills directory. Defaults to .claude/skills relative to container cwd. */
	projectSkillsPath: z.string().optional().describe('Path to project-level skills directory'),
	/** Path to user-level skills directory. Defaults to ~/.luca/skills. */
	userSkillsPath: z.string().optional().describe('Path to user-level global skills directory'),
})

export type SkillsLibraryState = z.infer<typeof SkillsLibraryStateSchema>
export type SkillsLibraryOptions = z.infer<typeof SkillsLibraryOptionsSchema>

/**
 * Manages two contentbase collections of skills following the Claude Code SKILL.md format.
 * Project-level skills live in .claude/skills/ and user-level skills live in ~/.luca/skills/.
 * Skills can be discovered, searched, created, updated, and removed at runtime.
 *
 * @extends Feature
 */
export class SkillsLibrary extends Feature<SkillsLibraryState, SkillsLibraryOptions> {
	static override stateSchema = SkillsLibraryStateSchema
	static override optionsSchema = SkillsLibraryOptionsSchema
	static override shortcut = 'features.skillsLibrary' as const

	private _projectCollection?: Collection
	private _userCollection?: Collection

	static attach(container: Container<AvailableFeatures, any>) {
		features.register('skillsLibrary', SkillsLibrary)
		return container
	}

	override get initialState(): SkillsLibraryState {
		return {
			...super.initialState,
			loaded: false,
			projectSkillCount: 0,
			userSkillCount: 0,
			totalSkillCount: 0,
		}
	}

	/** Returns the project-level contentbase Collection, lazily initialized. */
	get projectCollection(): Collection {
		if (this._projectCollection) return this._projectCollection
		const rootPath =
			this.options.projectSkillsPath ||
			(this.container as any).paths.resolve('.claude', 'skills')
		this._projectCollection = new Collection({ rootPath, extensions: ['md'] })
		this._projectCollection.register(SkillModel)
		return this._projectCollection
	}

	/** Returns the user-level contentbase Collection, lazily initialized. */
	get userCollection(): Collection {
		if (this._userCollection) return this._userCollection
		const rootPath =
			this.options.userSkillsPath || path.resolve(os.homedir(), '.luca', 'skills')
		this._userCollection = new Collection({ rootPath, extensions: ['md'] })
		this._userCollection.register(SkillModel)
		return this._userCollection
	}

	/** Whether the skills library has been loaded. */
	get isLoaded(): boolean {
		return !!this.state.get('loaded')
	}

	/** Array of all skill names across both collections. */
	get skillNames(): string[] {
		return this.list().map((s) => s.name)
	}

	/**
	 * Loads both project and user skill collections from disk.
	 * Gracefully handles missing directories.
	 *
	 * @returns {Promise<SkillsLibrary>} This instance
	 */
	async load(): Promise<SkillsLibrary> {
		if (this.isLoaded) return this

		try {
			await this.projectCollection.load()
		} catch {
			// Directory doesn't exist yet - zero project skills
		}

		try {
			await this.userCollection.load()
		} catch {
			// Directory doesn't exist yet - zero user skills
		}

		this.updateCounts()
		this.state.set('loaded', true)
		this.emit('loaded')
		return this
	}

	/**
	 * Lists all skills from both collections. Project skills come first.
	 *
	 * @returns {SkillEntry[]} All available skills
	 */
	list(): SkillEntry[] {
		const projectSkills = this.listFromCollection(this.projectCollection, 'project')
		const userSkills = this.listFromCollection(this.userCollection, 'user')
		return [...projectSkills, ...userSkills]
	}

	/**
	 * Finds a skill by name. Project skills take precedence over user skills.
	 *
	 * @param {string} name - The skill name to find (case-insensitive)
	 * @returns {SkillEntry | undefined} The skill entry, or undefined if not found
	 */
	find(name: string): SkillEntry | undefined {
		const lower = name.toLowerCase()
		return this.list().find((s) => s.name.toLowerCase() === lower)
	}

	/**
	 * Searches skills by substring match against name and description.
	 *
	 * @param {string} query - The search query
	 * @returns {SkillEntry[]} Matching skills
	 */
	search(query: string): SkillEntry[] {
		const q = query.toLowerCase()
		return this.list().filter(
			(s) =>
				s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q)
		)
	}

	/**
	 * Gets a skill by name. Alias for find().
	 *
	 * @param {string} name - The skill name
	 * @returns {SkillEntry | undefined} The skill entry
	 */
	getSkill(name: string): SkillEntry | undefined {
		return this.find(name)
	}

	/**
	 * Creates a new SKILL.md file in the specified collection.
	 * Maintains the directory-per-skill structure (skill-name/SKILL.md).
	 *
	 * @param {object} skill - The skill to create
	 * @param {'project' | 'user'} target - Which collection to write to (default: 'project')
	 * @returns {Promise<SkillEntry>} The created skill entry
	 */
	async create(
		skill: {
			name: string
			description: string
			body: string
			meta?: Record<string, unknown>
		},
		target: 'project' | 'user' = 'project'
	): Promise<SkillEntry> {
		const collection =
			target === 'project' ? this.projectCollection : this.userCollection

		const frontmatter = (yaml.dump({
			name: skill.name,
			description: skill.description,
			...skill.meta,
		}) as string).trim()

		const content = `---\n${frontmatter}\n---\n\n${skill.body}`
		const dirName = kebabCase(skill.name)
		const pathId = `${dirName}/SKILL`

		await fs.mkdir((collection as any).rootPath, { recursive: true })
		await collection.saveItem(pathId, { content, extension: '.md' })
		await collection.load({ refresh: true })
		this.updateCounts()

		const entry: SkillEntry = {
			name: skill.name,
			description: skill.description,
			body: skill.body,
			raw: content,
			source: target,
			pathId,
			meta: { name: skill.name, description: skill.description, ...skill.meta },
		}

		this.emit('skillCreated', entry)
		return entry
	}

	/**
	 * Updates an existing skill's content or metadata.
	 *
	 * @param {string} name - The skill name to update
	 * @param {object} updates - Fields to update
	 * @returns {Promise<SkillEntry>} The updated skill entry
	 */
	async update(
		name: string,
		updates: {
			description?: string
			body?: string
			meta?: Record<string, unknown>
		}
	): Promise<SkillEntry> {
		const existing = this.find(name)
		if (!existing) throw new Error(`Skill "${name}" not found`)

		const collection =
			existing.source === 'project' ? this.projectCollection : this.userCollection

		const newMeta = { ...existing.meta, ...updates.meta }
		if (updates.description) newMeta.description = updates.description

		const frontmatter = (yaml.dump(newMeta) as string).trim()
		const body = updates.body ?? existing.body
		const content = `---\n${frontmatter}\n---\n\n${body}`

		await collection.saveItem(existing.pathId, { content, extension: '.md' })
		await collection.load({ refresh: true })
		this.updateCounts()

		const entry: SkillEntry = {
			name: existing.name,
			description: updates.description ?? existing.description,
			body,
			raw: content,
			source: existing.source,
			pathId: existing.pathId,
			meta: newMeta,
		}

		this.emit('skillUpdated', entry)
		return entry
	}

	/**
	 * Removes a skill by name, deleting its SKILL.md and cleaning up the directory.
	 *
	 * @param {string} name - The skill name to remove
	 * @returns {Promise<boolean>} Whether the skill was found and removed
	 */
	async remove(name: string): Promise<boolean> {
		const existing = this.find(name)
		if (!existing) return false

		const collection =
			existing.source === 'project' ? this.projectCollection : this.userCollection

		await collection.deleteItem(existing.pathId)

		const skillDir = path.resolve(
			(collection as any).rootPath,
			existing.pathId.split('/')[0]!
		)
		try {
			await fs.rm(skillDir, { recursive: true })
		} catch {
			// directory might have other files or already be gone
		}

		await collection.load({ refresh: true })
		this.updateCounts()
		this.emit('skillRemoved', existing.name)
		return true
	}

	/**
	 * Converts all skills into ConversationTool format for use with Conversation.
	 * Each skill becomes a tool that returns its instruction body when invoked.
	 *
	 * @returns {Record<string, ConversationTool>} Tools keyed by sanitized skill name
	 */
	toConversationTools(): Record<string, ConversationTool> {
		const tools: Record<string, ConversationTool> = {}

		for (const skill of this.list()) {
			const toolName = `skill_${skill.name.replace(/[^a-zA-Z0-9_]/g, '_')}`
			tools[toolName] = {
				handler: async () => skill.body,
				description: skill.description,
				parameters: {
					type: 'object',
					properties: {},
				},
			}
		}

		return tools
	}

	/**
	 * Generates a markdown block listing all available skills with names and descriptions.
	 * Suitable for injecting into a system prompt.
	 *
	 * @returns {string} Markdown listing, or empty string if no skills
	 */
	toSystemPromptBlock(): string {
		const skills = this.list()
		if (skills.length === 0) return ''

		const lines = skills.map((s) => `- **${s.name}**: ${s.description}`)
		return `## Available Skills\n\n${lines.join('\n')}`
	}

	// --- Private ---

	private listFromCollection(
		collection: Collection,
		source: 'project' | 'user'
	): SkillEntry[] {
		if (!(collection as any).loaded) return []

		const entries: SkillEntry[] = []
		for (const pathId of collection.available) {
			if (!pathId.endsWith('/SKILL') && pathId !== 'SKILL') continue

			const item = collection.items.get(pathId)!
			entries.push({
				name: (item.meta.name as string) || pathId.split('/')[0] || pathId,
				description: (item.meta.description as string) || '',
				body: item.content,
				raw: item.raw,
				source,
				pathId,
				meta: item.meta,
			})
		}

		return entries
	}

	private updateCounts(): void {
		const projectCount = this.listFromCollection(
			this.projectCollection,
			'project'
		).length
		const userCount = this.listFromCollection(this.userCollection, 'user').length
		this.state.setState({
			projectSkillCount: projectCount,
			userSkillCount: userCount,
			totalSkillCount: projectCount + userCount,
		})
	}
}

export default features.register('skillsLibrary', SkillsLibrary)
