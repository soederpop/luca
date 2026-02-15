import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from '../../schemas/base.js'
import type { Container } from '@/container'
import { type AvailableFeatures } from '@/feature'
import { features, Feature } from '@/feature'
import type { AGIContainer } from '../container.server.js'
import type { Assistant } from './assistant.js'

declare module '@/feature' {
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
	/** Whether a docs/ subfolder exists. */
	hasDocs: boolean
}

export const AssistantsManagerEventsSchema = FeatureEventsSchema.extend({
	discovered: z.tuple([]).describe('Emitted when assistant discovery scan completes'),
	assistantCreated: z.tuple([
		z.string().describe('The assistant name'),
		z.any().describe('The assistant instance'),
	]).describe('Emitted when a new assistant instance is created'),
})

export const AssistantsManagerStateSchema = FeatureStateSchema.extend({
	discovered: z.boolean().describe('Whether discovery has been run'),
	assistantCount: z.number().describe('Number of discovered assistant definitions'),
	activeCount: z.number().describe('Number of currently instantiated assistants'),
})

export const AssistantsManagerOptionsSchema = FeatureOptionsSchema.extend({
	/** The folder to scan for assistant subdirectories, relative to cwd. */
	folder: z.string().default('assistants').describe('Folder to scan for assistant subdirectories'),
	/** Whether to automatically run discovery after initialization. */
	autoDiscover: z.boolean().default(false).describe('Automatically discover assistants on init'),
})

export type AssistantsManagerState = z.infer<typeof AssistantsManagerStateSchema>
export type AssistantsManagerOptions = z.infer<typeof AssistantsManagerOptionsSchema>

/**
 * Discovers and manages assistant definitions from a local directory.
 * Each subdirectory in the configured folder is treated as an assistant
 * definition that can contain CORE.md, tools.ts, hooks.ts, and a docs/ folder.
 *
 * Use `discover()` to scan for available assistants, `list()` to enumerate them,
 * and `create(name)` to instantiate one as a running Assistant feature.
 *
 * @extends Feature
 *
 * @example
 * ```typescript
 * const manager = container.feature('assistantsManager', { folder: 'assistants' })
 * await manager.discover()
 * console.log(manager.list()) // [{ name: 'my-helper', folder: '...', ... }]
 * const assistant = manager.create('my-helper')
 * const answer = await assistant.ask('Hello!')
 * ```
 */
export class AssistantsManager extends Feature<AssistantsManagerState, AssistantsManagerOptions> {
	static override stateSchema = AssistantsManagerStateSchema
	static override optionsSchema = AssistantsManagerOptionsSchema
	static override eventsSchema = AssistantsManagerEventsSchema
	static override shortcut = 'features.assistantsManager' as const

	static attach(container: Container<AvailableFeatures, any>) {
		features.register('assistantsManager', AssistantsManager)
		return container
	}

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

	/** The absolute path to the assistants folder. */
	get assistantsFolder(): string {
		return this.container.paths.resolve(this.options.folder || 'assistants')
	}

	override afterInitialize() {
		if (this.options.autoDiscover) {
			this.discover()
		}
	}

	/**
	 * Scans the assistants folder for subdirectories and probes each
	 * for CORE.md, tools.ts, hooks.ts, and docs/. Populates the
	 * internal entries map.
	 *
	 * @returns {this} This instance, for chaining
	 */
	discover(): this {
		const { fs, paths } = this.container
		const folder = this.assistantsFolder

		this._entries.clear()

		if (!fs.exists(folder)) {
			this.state.setState({ discovered: true, assistantCount: 0 })
			this.emit('discovered')
			return this
		}

		const result = fs.walk(folder, { directories: true, files: false })

		for (const dir of result.directories) {
			// Only include top-level children of the assistants folder
			if (paths.dirname(dir) !== folder) continue

			const name = dir.split('/').pop()!

			const entry: AssistantEntry = {
				name,
				folder: dir,
				hasCorePrompt: fs.exists(paths.resolve(dir, 'CORE.md')),
				hasTools: fs.exists(paths.resolve(dir, 'tools.ts')),
				hasHooks: fs.exists(paths.resolve(dir, 'hooks.ts')),
				hasDocs: fs.exists(paths.resolve(dir, 'docs')),
			}

			this._entries.set(name, entry)
		}

		this.state.setState({
			discovered: true,
			assistantCount: this._entries.size,
		})

		this.emit('discovered')
		return this
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
	 * @param {string} name - The assistant subdirectory name
	 * @returns {AssistantEntry | undefined} The entry, or undefined if not found
	 */
	get(name: string): AssistantEntry | undefined {
		return this._entries.get(name)
	}

	/**
	 * Creates and returns a new Assistant feature instance for the given name.
	 * The assistant is configured with the discovered folder path. Any additional
	 * options are merged in.
	 *
	 * @param {string} name - The assistant name (must match a discovered entry)
	 * @param {Record<string, any>} options - Additional options to pass to the Assistant constructor
	 * @returns {Assistant} The created assistant instance
	 * @throws {Error} If the name is not found among discovered assistants
	 *
	 * @example
	 * ```typescript
	 * const assistant = manager.create('my-helper', { model: 'gpt-4.1' })
	 * ```
	 */
	create(name: string, options: Record<string, any> = {}): Assistant {
		const entry = this._entries.get(name)

		if (!entry) {
			const available = Array.from(this._entries.keys())
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
				e.hasDocs && 'docs/',
			].filter(Boolean)

			return `- **${e.name}** — ${files.join(', ')}`
		})

		return `## Assistants\n\n${lines.join('\n')}`
	}
}

export default features.register('assistantsManager', AssistantsManager)
