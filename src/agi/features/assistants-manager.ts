import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from '../../schemas/base.js'
import { type AvailableFeatures } from '@soederpop/luca/feature'
import { Feature } from '../feature.js'
import type { Assistant } from './assistant.js'
import type { ConversationHistory, ConversationMeta, ConversationRecord } from './conversation-history.js'
import type { InterceptorFn, InterceptorPoint, InterceptorPoints } from '../lib/interceptor-chain.js'
import hashObject from '../../hash-object.js'

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
	/** Contents of ABOUT.md if present, undefined otherwise. */
	about?: string
	/** Frontmatter metadata parsed from CORE.md. */
	meta?: Record<string, any>
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
	entries: z.record(z.string(), z.any()).describe('Discovered assistant entries keyed by name'),
	instances: z.record(z.string(), z.any()).describe('Active assistant instances keyed by name'),
	factories: z.record(z.string(), z.any()).describe('Registered factory functions keyed by name'),
	extraFolders: z.array(z.string()).describe('Additional folders to scan during discovery'),
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
			entries: {},
			instances: {},
			factories: {},
			extraFolders: [],
		}
	}


	/** Discovered assistant entries keyed by name. */
	get entries(): Record<string, AssistantEntry> {
		return (this.state.get('entries') || {}) as Record<string, AssistantEntry>
	}

	/** Active assistant instances keyed by name. */
	get instances(): Record<string, Assistant> {
		return (this.state.get('instances') || {}) as Record<string, Assistant>
	}

	/** Registered factory functions keyed by name. */
	get factories(): Record<string, (options: Record<string, any>) => Assistant> {
		return (this.state.get('factories') || {}) as Record<string, (options: Record<string, any>) => Assistant>
	}

	/** Interceptor registrations to be applied to every assistant this manager creates. */
	private _interceptors: Array<{ point: InterceptorPoint; fn: InterceptorFn<any> }> = []

	/**
	 * Registers a pipeline interceptor that is applied to every assistant created by this manager.
	 * Interceptors are applied at the given interception point on each assistant at creation time.
	 * This mirrors the per-assistant `assistant.intercept(point, fn)` API, but scopes it globally
	 * across all assistants managed here — useful for cross-cutting concerns like logging, tracing,
	 * or policy enforcement.
	 *
	 * @param {InterceptorPoint} point - The interception point (beforeAsk, beforeTurn, beforeToolCall, afterToolCall, beforeResponse)
	 * @param {InterceptorFn<InterceptorPoints[K]>} fn - Middleware function receiving (ctx, next)
	 * @returns {this} This instance, for chaining
	 *
	 * @example
	 * ```typescript
	 * manager.intercept('beforeAsk', async (ctx, next) => {
	 *   console.log(`[${ctx.assistant.name}] asking: ${ctx.message}`)
	 *   await next()
	 * })
	 * ```
	 */
	intercept<K extends InterceptorPoint>(point: K, fn: InterceptorFn<InterceptorPoints[K]>): this {
		this._interceptors.push({ point, fn })
		return this
	}

	/**
	 * Discovers assistants by listing subdirectories in ~/.luca/assistants/
	 * and cwd/assistants/. Each subdirectory containing a CORE.md is an assistant.
	 *
	 * @returns {Promise<this>} This instance, for chaining
	 */
	/**
	 * Registers an additional folder to scan during assistant discovery and
	 * immediately triggers a new discovery pass.
	 *
	 * @param {string} folderPath - Absolute path to a folder containing assistant subdirectories
	 * @returns {Promise<this>} This instance, for chaining
	 *
	 * @example
	 * ```typescript
	 * await manager.addDiscoveryFolder('/path/to/more/assistants')
	 * console.log(manager.available) // includes assistants from the new folder
	 * ```
	 */
	async addDiscoveryFolder(folderPath: string): Promise<this> {
		const current = this.state.get('extraFolders') as string[]
		if (!current.includes(folderPath)) {
			this.state.set('extraFolders', [...current, folderPath])
		}
		return this.discover()
	}

	async discover(): Promise<this> {
		const { fs, paths, os } = this.container

		const discovered: Record<string, AssistantEntry> = {}

		const locations = [
			`${os.homedir}/.luca/assistants`,
			paths.resolve('assistants'),
			...(this.state.get('extraFolders') as string[]),
		]

		for (const location of locations) {
			if (!fs.exists(location)) continue

			const dirEntries = fs.readdirSync(location)

			for (const entry of dirEntries) {
				const folder = `${location}/${entry}`
				if (!fs.isDirectory(folder)) continue

				const hasCorePrompt = fs.exists(`${folder}/CORE.md`)
				if (!hasCorePrompt) continue

				// Don't overwrite earlier entries (home takes precedence for same name)
				if (!discovered[entry]) {
					const hasAbout = fs.exists(`${folder}/ABOUT.md`)
					let about: string | undefined
					let meta: Record<string, any> | undefined

					if (hasAbout) {
						about = fs.readFileSync(`${folder}/ABOUT.md`, 'utf8')
					}

					try {
						const coreContent = fs.readFileSync(`${folder}/CORE.md`, 'utf8')
						const fmMatch = coreContent.match(/^---\r?\n([\s\S]*?)\r?\n---/)
						if (fmMatch) {
							const yaml = this.container.feature('yaml')
							meta = yaml.parse(fmMatch[1])
						}
					} catch {
						// CORE.md exists but couldn't be parsed — skip meta
					}

					discovered[entry] = {
						name: entry,
						folder,
						hasCorePrompt: true,
						hasTools: fs.exists(`${folder}/tools.ts`),
						hasHooks: fs.exists(`${folder}/hooks.ts`),
						hasVoice: fs.exists(`${folder}/voice.yaml`),
						...(about != null && { about }),
						...(meta != null && { meta }),
					}
				}
			}
		}

		this.state.setState({
			entries: discovered,
			discovered: true,
			assistantCount: Object.keys(discovered).length,
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
		const entryKeys = Object.keys(this.entries)
		const factoryKeys = Object.keys(this.factories)
		return [...new Set([...entryKeys, ...factoryKeys])]
	}

	/**
	 * Returns all discovered assistant entries as an array.
	 *
	 * @returns {AssistantEntry[]} All discovered entries
	 */
	list(): AssistantEntry[] {
		return Object.values(this.entries)
	}

	/**
	 * Looks up a single assistant entry by name.
	 *
	 * @param {string} name - The assistant name (e.g. 'chief-of-staff')
	 * @returns {AssistantEntry | undefined} The entry, or undefined if not found
	 */
	get(name: string): AssistantEntry | undefined {
		return this.entries[name]
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
		this.state.set('factories', { ...this.factories, [id]: factory })
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
		const factory = this.factories[name]
		if (factory) {
			const instance = factory(options)
			this._bindAssistant(instance)
			const updated = { ...this.instances, [name]: instance }
			this.state.setState({ instances: updated, activeCount: Object.keys(updated).length })
			this.emit('assistantCreated', name, instance)
			return instance
		}

		const entry = this.get(name)

		if (!entry) {
			throw new Error(
				`Assistant "${name}" not found. Available assistants: ${this.available.join(', ') || '(none — run discover() first)'}`
			)
		}

		const instance = this.container.feature('assistant', {
			folder: entry.folder,
			...options,
		})

		this._bindAssistant(instance)
		const updated = { ...this.instances, [name]: instance }
		this.state.setState({ instances: updated, activeCount: Object.keys(updated).length })
		this.emit('assistantCreated', name, instance)

		return instance
	}

	/**
	 * Wires an assistant into the manager: bridges all assistant events up to the manager
	 * as `assistantEvent:<eventName>` with (assistant, ...originalArgs), and applies any
	 * globally registered interceptors.
	 */
	private _bindAssistant(instance: Assistant): void {
		instance.on('*', (event: string, ...args: any[]) => {
			this.emit(`assistantEvent:${event}` as any, instance, ...args)
		})

		for (const { point, fn } of this._interceptors) {
			instance.intercept(point, fn)
		}
	}

	/**
	 * Reload tools, hooks, and system prompt from disk for active assistants.
	 * When called with a name, reloads only that assistant. When called without
	 * arguments, reloads all active instances.
	 *
	 * @param {string} [name] - Optional assistant name to reload. Omit to reload all.
	 * @returns {{ reloaded: string[] }} Names of assistants that were reloaded
	 * @throws {Error} If a specific name is given but no active instance exists for it
	 *
	 * @example
	 * ```typescript
	 * manager.reload('researcher')       // reload one
	 * manager.reload()                    // reload all active
	 * ```
	 */
	reload(name?: string): { reloaded: string[] } {
		const reloaded: string[] = []

		if (name) {
			const instance = this.instances[name]
			if (!instance) {
				throw new Error(
					`No active assistant "${name}" to reload. Active: ${Object.keys(this.instances).join(', ') || '(none)'}`
				)
			}
			instance.reload()
			reloaded.push(name)
		} else {
			for (const [key, instance] of Object.entries(this.instances)) {
				instance.reload()
				reloaded.push(key)
			}
		}

		return { reloaded }
	}

	/**
	 * Build the thread prefix for a given assistant name, matching the
	 * convention used by the Assistant class: `name:cwdHash:`.
	 * This allows history lookups without an active instance.
	 *
	 * @param {string} assistantId - The assistant name
	 * @returns {string} The thread prefix
	 */
	threadPrefixFor(assistantId: string): string {
		const cwdHash = hashObject(this.container.cwd).slice(0, 8)
		return `${assistantId}:${cwdHash}:`
	}

	/**
	 * Load conversation history for an assistant. Works whether or not the
	 * assistant is currently instantiated — uses the thread prefix convention
	 * to query the conversationHistory feature directly.
	 *
	 * @param {string} assistantId - The assistant name (e.g. 'researcher')
	 * @param {object} [options] - Query options
	 * @param {number} [options.limit] - Maximum number of records to return
	 * @param {boolean} [options.includeMessages] - Load full records with messages (default: false, returns metadata only)
	 * @param {string} [options.thread] - Load a specific thread ID instead of all threads for this assistant
	 * @returns {Promise<ConversationMeta[] | ConversationRecord[]>} Metadata or full records, newest first
	 *
	 * @example
	 * ```typescript
	 * // List recent sessions (metadata only)
	 * const sessions = await manager.loadAssistantHistory('researcher', { limit: 5 })
	 *
	 * // Load full records with messages
	 * const full = await manager.loadAssistantHistory('researcher', { includeMessages: true, limit: 3 })
	 *
	 * // Load a specific thread
	 * const thread = await manager.loadAssistantHistory('researcher', { thread: 'researcher:abc12345:2026-04-12' })
	 * ```
	 */
	async loadAssistantHistory(
		assistantId: string,
		options?: { limit?: number; includeMessages?: boolean; thread?: string },
	): Promise<ConversationMeta[] | ConversationRecord[]> {
		const history = this.container.feature('conversationHistory') as ConversationHistory

		if (options?.thread) {
			const record = await history.findByThread(options.thread)
			return record ? [record] : []
		}

		const prefix = this.threadPrefixFor(assistantId)
		const metas = await history.findByThreadPrefix(prefix)
		const limited = options?.limit ? metas.slice(0, options.limit) : metas

		if (!options?.includeMessages) return limited

		const records: ConversationRecord[] = []
		for (const meta of limited) {
			const record = await history.load(meta.id)
			if (record) records.push(record)
		}
		return records
	}

	/**
	 * Returns a previously created assistant instance by name.
	 *
	 * @param {string} name - The assistant name
	 * @returns {Assistant | undefined} The instance, or undefined if not yet created
	 */
	getInstance(name: string): Assistant | undefined {
		return this.instances[name]
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
