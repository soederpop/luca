import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from '../../schemas/base.js'
import { type AvailableFeatures } from 'luca/feature'
import { Feature } from '../feature.js'
import type { Assistant } from './assistant.js'
import type { ConversationHistory, ConversationMeta, ConversationRecord } from './conversation-history.js'
import type { InterceptorFn, InterceptorPoint, InterceptorPoints } from '../lib/interceptor-chain.js'
import hashObject from '../../hash-object.js'

declare module 'luca/feature' {
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
	/** Whether a voice.yml configuration file exists. */
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
	workspaceOptionsLoaded: z.tuple([
		z.string().describe('Absolute path to the options.yml file that was loaded'),
	]).describe('Emitted when assistants/options.yml is parsed into option overrides'),
	workspaceHooksLoaded: z.tuple([
		z.string().describe('Absolute path to the hooks.ts file that was loaded'),
	]).describe('Emitted when assistants/hooks.ts is imported'),
	unusedOverrides: z.tuple([
		z.array(z.string()).describe('Override keys that do not match any known assistant name'),
	]).describe('Emitted after discovery when workspace options reference unknown assistants'),
})

/**
 * Optional lifecycle hooks module loaded from `assistants/hooks.ts` at the
 * workspace level. All exports are optional; hooks that throw are logged and
 * swallowed so a bad hook cannot break assistant creation. Distinct from
 * per-assistant hooks (which live in `assistants/<name>/hooks.ts` and use
 * event-name exports).
 */
export interface AssistantsManagerHooksModule {
	/**
	 * Called with the fully merged options (defaults + workspace overrides +
	 * call-site) right before an assistant is instantiated. Return a new options
	 * object to replace them, or return void to leave them unchanged. Since
	 * hooks.ts is workspace-owned code, its return value overrides even call-site
	 * options — you get the last word.
	 */
	beforeAssistantCreated?: (
		name: string,
		options: Record<string, any>,
		manager: AssistantsManager,
	) => Record<string, any> | void | undefined
	/**
	 * Called after an assistant is instantiated and wired to the manager.
	 * Use this to attach interceptors, subscribe to events, or otherwise
	 * observe the created assistant. Return value is ignored.
	 */
	onAssistantCreated?: (
		assistant: Assistant,
		name: string,
		manager: AssistantsManager,
	) => void
}

export const AssistantsManagerStateSchema = FeatureStateSchema.extend({
	discovered: z.boolean().describe('Whether discovery has been run'),
	assistantCount: z.number().describe('Number of discovered assistant definitions'),
	activeCount: z.number().describe('Number of currently instantiated assistants'),
	entries: z.record(z.string(), z.any()).describe('Discovered assistant entries keyed by name'),
	instances: z.record(z.string(), z.any()).describe('Active assistant instances keyed by name'),
	factories: z.record(z.string(), z.any()).describe('Registered factory functions keyed by name'),
	extraFolders: z.array(z.string()).describe('Additional folders to scan during discovery'),
	optionOverrides: z.record(z.string(), z.any()).describe('Workspace-level option overrides keyed by assistant name, plus a reserved `defaults` key applied to all'),
	workspaceOptionsPath: z.string().nullable().describe('Absolute path to the loaded assistants/options.yml, or null if none'),
	workspaceHooksPath: z.string().nullable().describe('Absolute path to the loaded assistants/hooks.ts, or null if none'),
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
	static override stability = 'core' as const
	static override category = 'ai-assistants' as const

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
			optionOverrides: {},
			workspaceOptionsPath: null,
			workspaceHooksPath: null,
		}
	}

	/** Workspace-level hooks module loaded from `assistants/hooks.ts`, if present. */
	private _workspaceHooks: AssistantsManagerHooksModule | undefined


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

	/**
	 * Stores workspace-level option overrides applied to every assistant this
	 * manager creates. The map is keyed by assistant short name, with a reserved
	 * `defaults` key merged into every assistant. Overrides sit between an
	 * assistant's own CORE.md frontmatter (weaker) and explicit `create()`
	 * options (stronger).
	 *
	 * @param {Record<string, any>} map - e.g. `{ defaults: { model: 'x' }, chiefOfStaff: { temperature: 0.5 } }`
	 * @returns {this} This instance, for chaining
	 *
	 * @example
	 * ```typescript
	 * manager.setOptionOverrides({ defaults: { providerOptions: { cwd } }, chiefOfStaff: { model: 'qwen3-coder' } })
	 * ```
	 */
	setOptionOverrides(map: Record<string, any>): this {
		this.state.set('optionOverrides', map && typeof map === 'object' ? map : {})
		return this
	}

	/**
	 * Resolves the effective option overrides for an assistant name by deep-merging
	 * the `defaults` entry with the per-assistant entry. Accepts either the short
	 * name or the `assistants/`-prefixed full name. Returns `{}` when none are set.
	 *
	 * @param {string} name - The assistant name
	 * @returns {Record<string, any>} Merged overrides for this assistant
	 */
	overridesFor(name: string): Record<string, any> {
		const map = (this.state.get('optionOverrides') || {}) as Record<string, any>
		const shortName = name.replace(/^assistants\//, '')
		return deepMergeOptions(map.defaults || {}, map[shortName] || {})
	}

	/**
	 * Discovers assistants by listing subdirectories in ~/.luca/assistants/,
	 * cwd/assistants/, and any folders added via `addDiscoveryFolder()`.
	 * Each subdirectory containing a CORE.md is an assistant. Earlier locations
	 * take precedence when the same name appears in multiple folders.
	 *
	 * @returns {Promise<this>} This instance, for chaining
	 */
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
						about = fs.readFileSync(`${folder}/ABOUT.md`, 'utf8') as string
					}

					try {
						const coreContent = fs.readFileSync(`${folder}/CORE.md`, 'utf8') as string
						const fmMatch = coreContent.match(/^---\r?\n([\s\S]*?)\r?\n---/)
						if (fmMatch) {
							const yaml = this.container.feature('yaml')
							meta = yaml.parse(fmMatch[1]!)
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
						hasVoice: fs.exists(`${folder}/voice.yml`),
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

		this._loadWorkspaceOptions()
		this._loadWorkspaceHooks()
		this._reportUnusedOverrides()

		this.emit('discovered')
		return this
	}

	/**
	 * Parse `assistants/options.yml` (if present) and install its contents as
	 * workspace option overrides. Keyed by assistant short name with a reserved
	 * `defaults` key. Silent on missing/empty files; parse errors are logged
	 * and swallowed so a malformed YAML file can't break discovery.
	 */
	private _loadWorkspaceOptions(): void {
		const { fs, paths } = this.container
		const optionsPath = paths.resolve('assistants/options.yml')

		if (!fs.exists(optionsPath)) {
			this.state.set('workspaceOptionsPath', null)
			return
		}

		try {
			const yaml = this.container.feature('yaml')
			const raw = fs.readFileSync(optionsPath, 'utf8') as string
			const parsed = yaml.parse(raw)
			if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
				this.setOptionOverrides(parsed as Record<string, any>)
			}
			this.state.set('workspaceOptionsPath', optionsPath)
			this.emit('workspaceOptionsLoaded', optionsPath)
		} catch (err: any) {
			console.error(`[assistantsManager] Failed to parse ${optionsPath}: ${err?.message || err}`)
			this.state.set('workspaceOptionsPath', null)
		}
	}

	/**
	 * Import `assistants/hooks.ts` (if present) using the vm feature and cache
	 * its exports. Errors are logged and swallowed; a broken hooks file leaves
	 * `_workspaceHooks` unset rather than aborting discovery.
	 */
	private _loadWorkspaceHooks(): void {
		const { fs, paths } = this.container
		const hooksPath = paths.resolve('assistants/hooks.ts')

		if (!fs.exists(hooksPath)) {
			this._workspaceHooks = undefined
			this.state.set('workspaceHooksPath', null)
			return
		}

		try {
			const vm = this.container.feature('vm')
			const moduleExports = vm.loadModule(hooksPath, {
				container: this.container,
				manager: this,
				console: console,
			}) as AssistantsManagerHooksModule
			this._workspaceHooks = moduleExports
			this.state.set('workspaceHooksPath', hooksPath)
			this.emit('workspaceHooksLoaded', hooksPath)
		} catch (err: any) {
			console.error(`[assistantsManager] Failed to load ${hooksPath}: ${err?.message || err}`)
			this._workspaceHooks = undefined
			this.state.set('workspaceHooksPath', null)
		}
	}

	/**
	 * Emit `unusedOverrides` for any option-override keys that don't map to a
	 * known assistant. Silent when everything lines up. `defaults` is reserved
	 * and never reported.
	 */
	private _reportUnusedOverrides(): void {
		const map = (this.state.get('optionOverrides') || {}) as Record<string, any>
		const known = new Set(this.available)
		const unused = Object.keys(map).filter((k) => k !== 'defaults' && !known.has(k))
		if (unused.length > 0) this.emit('unusedOverrides', unused)
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

	/**
	 * Alias for `available`.
	 *
	 * @returns {string[]} Names of all available assistants
	 */
	get availableAssistants() {
		return this.available
	}

	/**
	 * Names of all available assistants — the union of discovered entries
	 * and runtime-registered factories, deduplicated.
	 *
	 * @returns {string[]} Assistant names
	 */
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
		const discovered = Object.values(this.entries)
		const discoveredNames = new Set(discovered.map((e) => e.name))

		// Include registered factories that weren't discovered on disk
		const registeredOnly = Object.keys(this.factories)
			.filter((name) => !discoveredNames.has(name))
			.map((name): AssistantEntry => ({
				name,
				folder: '',
				hasCorePrompt: false,
				hasTools: false,
				hasHooks: false,
				hasVoice: false,
			}))

		return [...discovered, ...registeredOnly]
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
		// Workspace overrides sit below explicit call-site options, which win.
		let merged = deepMergeOptions(this.overridesFor(name), options)

		// Workspace hooks.ts gets the last word on options — it's workspace-owned
		// code and can do dynamic things static YAML cannot.
		const before = this._workspaceHooks?.beforeAssistantCreated
		if (before) {
			try {
				const returned = before(name, merged, this)
				if (returned && typeof returned === 'object' && !Array.isArray(returned)) {
					merged = returned as Record<string, any>
				}
			} catch (err: any) {
				console.error(`[assistantsManager] beforeAssistantCreated threw for "${name}": ${err?.message || err}`)
			}
		}

		let instance: Assistant

		// Check registered factories first
		const factory = this.factories[name]
		if (factory) {
			instance = factory(merged)
		} else {
			const entry = this.get(name)
			if (!entry) {
				throw new Error(
					`Assistant "${name}" not found. Available assistants: ${this.available.join(', ') || '(none — run discover() first)'}`
				)
			}
			instance = this.container.feature('assistant', deepMergeOptions({ folder: entry.folder }, merged))
		}

		this._bindAssistant(instance)
		const updated = { ...this.instances, [name]: instance }
		this.state.setState({ instances: updated, activeCount: Object.keys(updated).length })

		const after = this._workspaceHooks?.onAssistantCreated
		if (after) {
			try {
				after(instance, name, this)
			} catch (err: any) {
				console.error(`[assistantsManager] onAssistantCreated threw for "${name}": ${err?.message || err}`)
			}
		}

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

/**
 * Deep-merges option objects left to right. Plain objects merge recursively;
 * arrays and every other value type are replaced wholesale (a later
 * `allowTools: [...]` fully replaces an earlier one rather than merging by index).
 */
function deepMergeOptions(...sources: Record<string, any>[]): Record<string, any> {
	// Realm-safe plain-object check: options may come from VM contexts (eval,
	// assistant hooks) whose object literals have a different Object constructor.
	const isPlainObject = (v: any) => {
		if (v === null || typeof v !== 'object' || Array.isArray(v)) return false
		const proto = Object.getPrototypeOf(v)
		return proto === null || proto.constructor === undefined || proto.constructor.name === 'Object'
	}

	const result: Record<string, any> = {}
	for (const source of sources) {
		if (!isPlainObject(source)) continue
		for (const [key, value] of Object.entries(source)) {
			if (value === undefined) continue
			result[key] = isPlainObject(value) && isPlainObject(result[key])
				? deepMergeOptions(result[key], value)
				: value
		}
	}
	return result
}

export default AssistantsManager

