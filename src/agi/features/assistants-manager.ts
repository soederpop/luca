import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from '../../schemas/base.js'
import { type AvailableFeatures } from '@soederpop/luca/feature'
import { Feature } from '@soederpop/luca/feature'
import type { AGIContainer } from '../container.server.js'
import type { Assistant } from './assistant.js'

declare module '@soederpop/luca/feature' {
	interface AvailableFeatures {
		assistantsManager: typeof AssistantsManager
	}
}

/**
 * Metadata for a discovered assistant subdirectory.
 */
export interface AssistantEntry {
	/** The subdirectory name, used as the assistant identifier. */
	name: string
	/** Absolute path to the assistant folder. */
	folder: string
	/** Whether a CORE.md system prompt file exists. */
	hasCorePrompt: boolean
	/** Whether a tools.ts file exists. */
	hasTools: boolean
	/** Whether a hooks.ts file exists. */
	hasHooks: boolean
	/** Whether a voice.yaml configuration file exists. */
	hasVoice: boolean
}

export const AssistantsManagerEventsSchema = FeatureEventsSchema.extend({
	discovered: z.tuple([]).describe('Emitted when assistant discovery scan completes'),
	assistantCreated: z.tuple([
		z.string().describe('The assistant name'),
		z.any().describe('The assistant instance'),
	]).describe('Emitted when a new assistant instance is created'),
	assistantRegistered: z.tuple([
		z.string().describe('The assistant id'),
	]).describe('Emitted when an assistant factory is registered at runtime'),
})

export const AssistantsManagerStateSchema = FeatureStateSchema.extend({
	discovered: z.boolean().describe('Whether discovery has been run'),
	assistantCount: z.number().describe('Number of discovered assistant definitions'),
	activeCount: z.number().describe('Number of currently instantiated assistants'),
})

export const AssistantsManagerOptionsSchema = FeatureOptionsSchema.extend({})

export type AssistantsManagerState = z.infer<typeof AssistantsManagerStateSchema>
export type AssistantsManagerOptions = z.infer<typeof AssistantsManagerOptionsSchema>

/**
 * Discovers and manages assistant definitions by looking for subdirectories
 * in two locations: ~/.luca/assistants/ and cwd/assistants/. Each subdirectory
 * containing a CORE.md is treated as an assistant definition.
 *
 * Use `discover()` to scan for available assistants, `list()` to enumerate them,
 * and `create(name)` to instantiate one as a running Assistant feature.
 *
 * @extends Feature
 *
 * @example
 * ```typescript
 * const manager = container.feature('assistantsManager')
 * manager.discover()
 * console.log(manager.list()) // [{ name: 'chief-of-staff', folder: '...', ... }]
 * const assistant = manager.create('chief-of-staff')
 * const answer = await assistant.ask('Hello!')
 * ```
 */
export class AssistantsManager extends Feature<AssistantsManagerState, AssistantsManagerOptions> {
	static override stateSchema = AssistantsManagerStateSchema
	static override optionsSchema = AssistantsManagerOptionsSchema
	static override eventsSchema = AssistantsManagerEventsSchema
	static override shortcut = 'features.assistantsManager' as const

	static { Feature.register(this, 'assistantsManager') }

	/** @returns Default state with discovery not yet run and zero counts. */
	override get initialState(): AssistantsManagerState {
		return {
			...super.initialState,
			discovered: false,
			assistantCount: 0,
			activeCount: 0,
		}
	}

	override get container(): AGIContainer {
		return super.container as AGIContainer
	}

	private _entries: Map<string, AssistantEntry> = new Map()
	private _instances: Map<string, Assistant> = new Map()
	private _factories: Map<string, (options: Record<string, any>) => Assistant> = new Map()

	/**
	 * Discovers assistants by listing subdirectories in ~/.luca/assistants/
	 * and cwd/assistants/. Each subdirectory containing a CORE.md is an assistant.
	 *
	 * @returns {Promise<this>} This instance, for chaining
	 */
	async discover(): Promise<this> {
		const { fs, paths, os } = this.container

		this._entries.clear()

		const locations = [
			`${os.homedir}/.luca/assistants`,
			paths.resolve('assistants'),
		]

		for (const location of locations) {
			if (!fs.exists(location)) continue

			const entries = fs.readdirSync(location)

			for (const entry of entries) {
				const folder = `${location}/${entry}`
				if (!fs.isDirectory(folder)) continue

				const hasCorePrompt = fs.exists(`${folder}/CORE.md`)
				if (!hasCorePrompt) continue

				// Don't overwrite earlier entries (home takes precedence for same name)
				if (!this._entries.has(entry)) {
					this._entries.set(entry, {
						name: entry,
						folder,
						hasCorePrompt: true,
						hasTools: fs.exists(`${folder}/tools.ts`),
						hasHooks: fs.exists(`${folder}/hooks.ts`),
						hasVoice: fs.exists(`${folder}/voice.yaml`),
					})
				}
			}
		}

		this.state.setState({
			discovered: true,
			assistantCount: this._entries.size,
		})

		this.emit('discovered')
		return this
	}

	/**
	 * Downloads the core assistants that ship with luca from GitHub
	 * into ~/.luca/assistants.
	 *
	 * @returns {Promise<{ files: string[] }>} The files extracted
	 *
	 * @example
	 * ```typescript
	 * const manager = container.feature('assistantsManager')
	 * await manager.downloadLucaCoreAssistants()
	 * await manager.discover()
	 * console.log(manager.available)
	 * ```
	 */
	async downloadLucaCoreAssistants() {
		const { os, paths } = this.container
		const dest = `${os.homedir}/.luca/assistants`
		const git = this.container.feature('git') as any

		return await git.extractFolder({
			source: 'soederpop/luca/assistants',
			destination: dest,
		})
	}

	get available() {
		const entryKeys = Array.from(this._entries.keys())
		const factoryKeys = Array.from(this._factories.keys())
		return [...new Set([...entryKeys, ...factoryKeys])]
	}

	/**
	 * Returns all discovered assistant entries as an array.
	 *
	 * @returns {AssistantEntry[]} All discovered entries
	 */
	list(): AssistantEntry[] {
		return Array.from(this._entries.values())
	}

	/**
	 * Looks up a single assistant entry by name.
	 *
	 * @param {string} name - The assistant name (e.g. 'chief-of-staff')
	 * @returns {AssistantEntry | undefined} The entry, or undefined if not found
	 */
	get(name: string): AssistantEntry | undefined {
		return this._entries.get(name)
	}

	/**
	 * Registers a factory function that creates an assistant at runtime.
	 * Registered factories take precedence over discovered entries when
	 * calling `create()`.
	 *
	 * @param {string} id - The assistant identifier
	 * @param {(options: Record<string, any>) => Assistant} factory - Factory function that receives create options and returns an Assistant
	 * @returns {this} This instance, for chaining
	 *
	 * @example
	 * ```typescript
	 * manager.register('custom-bot', (options) => {
	 *   return container.feature('assistant', {
	 *     systemPrompt: 'You are a custom bot.',
	 *     ...options,
	 *   })
	 * })
	 * const bot = manager.create('custom-bot')
	 * ```
	 */
	register(id: string, factory: (options: Record<string, any>) => Assistant): this {
		this._factories.set(id, factory)
		this.emit('assistantRegistered', id)
		return this
	}

	/**
	 * Creates and returns a new Assistant feature instance for the given name.
	 * Checks runtime-registered factories first, then falls back to discovered entries.
	 * The assistant is configured with the discovered folder path. Any additional
	 * options are merged in.
	 *
	 * @param {string} name - The assistant name (must match a registered factory or discovered entry)
	 * @param {Record<string, any>} options - Additional options to pass to the Assistant constructor
	 * @returns {Assistant} The created assistant instance
	 * @throws {Error} If the name is not found among registered factories or discovered assistants
	 *
	 * @example
	 * ```typescript
	 * const assistant = manager.create('chief-of-staff', { model: 'gpt-4.1' })
	 * ```
	 */
	create(name: string, options: Record<string, any> = {}): Assistant {
		// Check registered factories first
		const factory = this._factories.get(name)
		if (factory) {
			const instance = factory(options)
			this._instances.set(name, instance)
			this.state.set('activeCount', this._instances.size)
			this.emit('assistantCreated', name, instance)
			return instance
		}

		const entry = this.get(name)

		if (!entry) {
			const available = [...this._entries.keys(), ...this._factories.keys()]
			throw new Error(
				`Assistant "${name}" not found. Available assistants: ${available.join(', ') || '(none — run discover() first)'}`
			)
		}

		const instance = this.container.feature('assistant', {
			folder: entry.folder,
			...options,
		})

		this._instances.set(name, instance)
		this.state.set('activeCount', this._instances.size)
		this.emit('assistantCreated', name, instance)

		return instance
	}

	/**
	 * Returns a previously created assistant instance by name.
	 *
	 * @param {string} name - The assistant name
	 * @returns {Assistant | undefined} The instance, or undefined if not yet created
	 */
	getInstance(name: string): Assistant | undefined {
		return this._instances.get(name)
	}

	/**
	 * Generates a markdown summary of all discovered assistants,
	 * listing their names and which definition files are present.
	 *
	 * @returns {string} Markdown-formatted summary
	 */
	toSummary(): string {
		const entries = this.list()

		if (entries.length === 0) {
			return '## Assistants\n\nNo assistants discovered.'
		}

		const lines = entries.map((e) => {
			const files = [
				e.hasCorePrompt && 'CORE.md',
				e.hasTools && 'tools.ts',
				e.hasHooks && 'hooks.ts',
			].filter(Boolean)

			return `- **${e.name}** — ${files.join(', ')}`
		})

		return `## Assistants\n\n${lines.join('\n')}`
	}
}

export default AssistantsManager
