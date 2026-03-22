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
	additionalLocations: z.array(z.string()).describe('Additional directories scanned for assistant definitions'),
})

export const AssistantsManagerOptionsSchema = FeatureOptionsSchema.extend({
	/** Whether to automatically run discovery after initialization. */
	autoDiscover: z.boolean().default(false).describe('Automatically discover assistants on init'),
	/** Additional directories to scan for assistant definitions (folders containing CORE.md). Defaults to node_modules/@soederpop/luca. */
	additionalLocations: z.array(z.string()).default([]).describe('Additional directories to scan for CORE.md assistant definitions'),
})

export type AssistantsManagerState = z.infer<typeof AssistantsManagerStateSchema>
export type AssistantsManagerOptions = z.infer<typeof AssistantsManagerOptionsSchema>

/**
 * Discovers and manages assistant definitions by finding all CORE.md files
 * in the project using the fileManager. Each directory containing a CORE.md
 * is treated as an assistant definition that can also contain tools.ts,
 * hooks.ts, voice.yaml, and a docs/ folder.
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
 * console.log(manager.list()) // [{ name: 'assistants/chief-of-staff', folder: '...', ... }]
 * const assistant = manager.create('assistants/chief-of-staff')
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
			additionalLocations: [],
		}
	}

	override get container(): AGIContainer {
		return super.container as AGIContainer
	}

	private _entries: Map<string, AssistantEntry> = new Map()
	private _instances: Map<string, Assistant> = new Map()
	private _factories: Map<string, (options: Record<string, any>) => Assistant> = new Map()

	override async afterInitialize() {
		if (this.options.autoDiscover) {
			await this.discover()
		}
	}

	/** Resolved path to the assistants.json config file. */
	get configPath(): string {
		const { os, paths } = this.container
		return paths.join(os.homedir, '.luca', 'assistants.json')
	}

	/** Read the persisted config, creating it if it doesn't exist. */
	private _readConfig(): { locations: string[] } {
		const { fs } = this.container
		if (!fs.exists(this.configPath)) {
			return { locations: [] }
		}
		return fs.readJson(this.configPath)
	}

	/** Write the config back to disk. */
	private _writeConfig(config: { locations: string[] }): void {
		const { fs, os, paths } = this.container
		fs.mkdirp(paths.join(os.homedir, '.luca'))
		fs.writeJson(this.configPath, config, 2)
	}

	/**
	 * Returns the default additional locations to scan for assistants.
	 * Includes node_modules/@soederpop/luca if it exists, plus any
	 * locations persisted in ~/.luca/assistants.json.
	 */
	get defaultAdditionalLocations(): string[] {
		const { fs, paths, os } = this.container
		const lucaPkgDir = paths.resolve('node_modules', '@soederpop', 'luca')
		const locations: string[] = []

		if (fs.exists(lucaPkgDir)) {
			locations.push(lucaPkgDir)
		}

		// Include persisted locations from config
		const config = this._readConfig()
		for (const loc of config.locations) {
			const expanded = loc.startsWith('~') ? paths.join(os.homedir, loc.slice(1)) : loc
			if (!locations.includes(expanded)) {
				locations.push(expanded)
			}
		}

		return locations
	}

	/**
	 * Returns the resolved list of additional locations: explicit options merged with defaults.
	 */
	get resolvedAdditionalLocations(): string[] {
		return [...this.defaultAdditionalLocations, ...this.options.additionalLocations]
	}

	/**
	 * Downloads the core assistants that ship with luca from GitHub
	 * into ~/.luca/assistants and registers that directory as a
	 * persistent discovery location.
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
		const dest = paths.resolve(os.homedir, '.luca', 'assistants')
		const git = this.container.feature('git') as any

		const result = await git.extractFolder({
			source: 'soederpop/luca/assistants',
			destination: dest,
		})

		// Persist ~/.luca/assistants as a discovery location
		const config = this._readConfig()
		const portable = '~/.luca/assistants'
		if (!config.locations.includes(portable)) {
			config.locations.push(portable)
			this._writeConfig(config)
		}

		// Also add to the in-memory locations so the next discover() picks it up
		this.addLocation(dest)

		return result
	}

	/**
	 * Discovers assistants by finding all CORE.md files in the project
	 * using the fileManager, plus any additional locations. Each directory
	 * containing a CORE.md is treated as an assistant definition.
	 *
	 * @returns {Promise<this>} This instance, for chaining
	 */
	async discover(): Promise<this> {
		const { fs, paths } = this.container
		const fileManager = this.container.feature('fileManager') as any

		await fileManager.start()

		this._entries.clear()

		// Scan the project using fileManager
		const coreFiles = fileManager.matchFiles('**/CORE.md')

		for (const file of coreFiles) {
			const dir = file.dirname
			const name = file.relativeDirname

			this._entries.set(name, {
				name,
				folder: dir,
				hasCorePrompt: true,
				hasTools: fs.exists(paths.resolve(dir, 'tools.ts')),
				hasHooks: fs.exists(paths.resolve(dir, 'hooks.ts')),
				hasVoice: fs.exists(paths.resolve(dir, 'voice.yaml')),
			})
		}

		// Scan additional locations
		const additionalLocations = this.resolvedAdditionalLocations

		for (const location of additionalLocations) {
			if (!fs.exists(location)) continue
			await this._scanLocation(location)
		}

		this.state.setState({
			discovered: true,
			assistantCount: this._entries.size,
			additionalLocations,
		})

		this.emit('discovered')
		return this
	}

	/**
	 * Adds a directory to scan during discovery. Call discover() again
	 * to pick up assistants from the new location.
	 *
	 * @param {string} location - Absolute path to a directory to scan for CORE.md files
	 * @returns {this} This instance, for chaining
	 */
	addLocation(location: string): this {
		const current = this.options.additionalLocations || []
		if (!current.includes(location)) {
			current.push(location)
			this.options.additionalLocations = current
		}
		return this
	}

	/**
	 * Scans a directory recursively for CORE.md files and adds them as entries.
	 */
	private async _scanLocation(location: string): Promise<void> {
		const { fs, paths } = this.container

		try {
			const { files } = fs.walk(location, {
				include: ['CORE.md'],
				exclude: ['node_modules', '.git'],
			})

			for (const filePath of files) {
				const dir = paths.dirname(filePath)
				// Use a name relative to the scanned location, prefixed to avoid collisions
				const relativePath = paths.relative(location, dir)
				const locationBasename = paths.basename(location)
				const name = `${locationBasename}/${relativePath}`

				// Don't overwrite project-local entries
				if (!this._entries.has(name)) {
					this._entries.set(name, {
						name,
						folder: dir,
						hasCorePrompt: true,
						hasTools: fs.exists(paths.resolve(dir, 'tools.ts')),
						hasHooks: fs.exists(paths.resolve(dir, 'hooks.ts')),
						hasVoice: fs.exists(paths.resolve(dir, 'voice.yaml')),
					})
				}
			}
		} catch {
			// Location might not exist or walk may fail — just skip it
		}
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
	 * @param {string} name - The assistant name (e.g. 'assistants/chief-of-staff')
	 * @returns {AssistantEntry | undefined} The entry, or undefined if not found
	 */
	get(name: string): AssistantEntry | undefined {
		const found = this._entries.get(name)

		if (found) {
			return found
		}

		const aliases = this.available.filter(key => key === name || key.endsWith(`/${name}`))

		if (aliases.length === 1) {
			return this._entries.get(aliases[0]!)
		} else if (aliases.length > 1) {
			throw new Error(`Ambiguous assistant name "${name}", matches: ${aliases.join(', ')}`)
		}

		return undefined
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
	 * const assistant = manager.create('assistants/chief-of-staff', { model: 'gpt-4.1' })
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
