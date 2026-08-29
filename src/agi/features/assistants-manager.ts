import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from '../../schemas/base.js'
import { type AvailableFeatures } from 'luca/feature'
import { Feature } from '../feature.js'
import { AssistantOptionsSchema, type Assistant } from './assistant.js'
import type { ConversationHistory, ConversationMeta, ConversationRecord } from './conversation-history.js'
import type { InterceptorFn, InterceptorPoint, InterceptorPoints } from '../lib/interceptor-chain.js'
import hashObject from '../../hash-object.js'
import { deepMergeOptions } from '../lib/merge-options.js'
import type { Helper } from '../../helper.js'

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
	assistantDisabled: z.tuple([
		z.string().describe('The assistant name'),
		z.boolean().describe('True when the assistant was disabled, false when re-enabled'),
	]).describe('Emitted when an assistant is hidden or restored via disableAssistant()/enableAssistant()'),
})

/**
 * Option-override keys that the manager itself consumes rather than passing
 * through to the assistant. They are exempt from the "unknown option will be
 * stripped" warning and never reach `container.feature('assistant', ...)`.
 */
const RESERVED_OVERRIDE_KEYS = new Set(['disabled'])

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
	disabled: z.array(z.string()).describe('Assistant names disabled at runtime via disableAssistant(), hidden from available/list()'),
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

	static override tools: Record<string, { schema: z.ZodType; description?: string }> = {
		listAssistants: {
			description: 'List every discovered assistant and which definition files (CORE.md, tools.ts, hooks.ts) each one has. Call this FIRST to see what exists before creating or editing anything.',
			schema: z.object({}).describe('List every discovered assistant and which definition files each one has.'),
		},
		createAssistant: {
			description: 'Create a new assistant: a folder with a CORE.md system prompt and a minimal tools.ts. Fails if the assistant already exists — use writeDefinitionFile to modify an existing one.',
			schema: z.object({
				name: z.string().describe('camelCase folder name for the new assistant (e.g. "haikuWriter")'),
				corePrompt: z.string().describe('Full contents of CORE.md — the system prompt defining the assistant\'s identity and behavior. Optional YAML frontmatter (model, provider) goes at the top between --- markers.'),
			}).describe('Create a new assistant folder with a CORE.md and a minimal tools.ts.'),
		},
		readDefinitionFile: {
			description: 'Read one definition file of an assistant (CORE.md, ABOUT.md, tools.ts, hooks.ts, or voice.yml). ALWAYS read a file before writing it.',
			schema: z.object({
				name: z.string().describe('The assistant name, as listed by listAssistants'),
				file: z.string().describe('One of: CORE.md, ABOUT.md, tools.ts, hooks.ts, voice.yml'),
			}).describe('Read one definition file of an assistant.'),
		},
		writeDefinitionFile: {
			description: 'Overwrite one definition file of an assistant with complete new contents (whole-file writes only — no patches). TypeScript files are parse-checked before the write lands; a file that fails to load is rejected and the original is untouched. The previous version is backed up automatically, and any live instance is reloaded. In tools.ts, never use z.any() in schemas.',
			schema: z.object({
				name: z.string().describe('The assistant name'),
				file: z.string().describe('One of: CORE.md, ABOUT.md, tools.ts, hooks.ts, voice.yml'),
				content: z.string().describe('The COMPLETE new file contents. This replaces the whole file — read the current version first and include everything that should remain.'),
			}).describe('Overwrite one definition file of an assistant with complete new contents.'),
		},
		rollbackDefinitionFile: {
			description: 'Restore the most recent backup of a definition file, undoing the last writeDefinitionFile to it. Use when a change made the assistant worse. Reloads any live instance.',
			schema: z.object({
				name: z.string().describe('The assistant name'),
				file: z.string().describe('The definition file to restore (e.g. tools.ts)'),
			}).describe('Restore the most recent backup of a definition file.'),
		},
		listDefinitionHistory: {
			description: 'List the backed-up versions of an assistant\'s definition files, newest first. Every writeDefinitionFile creates one backup.',
			schema: z.object({
				name: z.string().describe('The assistant name'),
				file: z.string().optional().describe('Filter to backups of one file (e.g. tools.ts). Omit to list all.'),
			}).describe('List the backed-up versions of an assistant\'s definition files.'),
		},
		testAssistant: {
			description: 'Instantiate a fresh copy of an assistant and send it one message to verify it behaves as intended. Returns its reply, which tools it called with what arguments, and its available tool names. ALWAYS test after changing an assistant.',
			schema: z.object({
				name: z.string().describe('The assistant name'),
				message: z.string().describe('The message to send — pick one that exercises the behavior you just changed'),
			}).describe('Instantiate a fresh copy of an assistant and send it one message.'),
		},
		reloadAssistant: {
			description: 'Reload a running assistant\'s tools, hooks, and system prompt from disk. writeDefinitionFile already does this automatically — use this only after out-of-band file changes.',
			schema: z.object({
				name: z.string().describe('The assistant name (must have an active instance)'),
			}).describe('Reload a running assistant\'s definition from disk.'),
		},
	}

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
			disabled: [],
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
		const shortName = this._shortName(name)
		const merged = deepMergeOptions(map.defaults || {}, map[shortName] || {})
		return this.container.utils.lodash.omit(merged, [...RESERVED_OVERRIDE_KEYS])
	}

	/** Strips the optional `assistants/` prefix so all lookups use the short name. */
	private _shortName(name: string): string {
		return name.replace(/^assistants\//, '')
	}

	/**
	 * Whether an assistant is disabled in this workspace. Disabled assistants are
	 * hidden from `available`, `list()`, the `luca chat` picker, and an assistant's
	 * `availableSubagents` — but `get()` and `create()` still work, so naming one
	 * explicitly (`luca chat googleWorkspace`) runs it. Disabling is curation, not
	 * an access lock.
	 *
	 * Three sources, any of which disables: a runtime `disableAssistant()` call, a
	 * per-assistant `disabled: true` in `assistants/options.yml`, or the assistant's name
	 * appearing in a top-level `disabled:` list in that same file.
	 *
	 * @param {string} name - The assistant name, with or without an `assistants/` prefix
	 * @returns {boolean} True when the assistant should be hidden
	 *
	 * @example
	 * ```typescript
	 * const manager = container.feature('assistantsManager')
	 * manager.disableAssistant('googleWorkspace')
	 * console.log(manager.isDisabled('googleWorkspace')) // true
	 * ```
	 */
	isDisabled(name: string): boolean {
		const shortName = this._shortName(name)

		const runtime = (this.state.get('disabled') || []) as string[]
		if (runtime.includes(shortName)) return true

		const map = (this.state.get('optionOverrides') || {}) as Record<string, any>

		const perAssistant = map[shortName]
		if (perAssistant && typeof perAssistant === 'object' && perAssistant.disabled === true) return true

		return Array.isArray(map.disabled) && map.disabled.includes(shortName)
	}

	/**
	 * Hides an assistant from every listing surface. Use this from a plugin or
	 * `luca.cli.ts` when the assistant's dependencies aren't present in the host
	 * workspace — e.g. a googleWorkspace assistant in a project without gws.
	 *
	 * Named `disableAssistant` rather than `disable` because `Feature.enable()` is
	 * the base-class lifecycle method — this pair is about assistants, not about
	 * this feature's own enabled state.
	 *
	 * @param {string} name - The assistant name
	 * @returns {this} This instance, for chaining
	 *
	 * @example
	 * ```typescript
	 * const manager = container.feature('assistantsManager')
	 * if (!container.features.available.includes('gws')) manager.disableAssistant('googleWorkspace')
	 * ```
	 */
	disableAssistant(name: string): this {
		const shortName = this._shortName(name)
		const current = (this.state.get('disabled') || []) as string[]
		if (!current.includes(shortName)) {
			this.state.set('disabled', [...current, shortName])
			this.emit('assistantDisabled', shortName, true)
		}
		return this
	}

	/**
	 * Undoes a runtime `disableAssistant()`. Note this only clears the runtime flag —
	 * an assistant disabled by `assistants/options.yml` stays hidden, since that file
	 * is the workspace owner's declaration.
	 *
	 * @param {string} name - The assistant name
	 * @returns {this} This instance, for chaining
	 *
	 * @example
	 * ```typescript
	 * const manager = container.feature('assistantsManager')
	 * manager.disableAssistant('googleWorkspace').enableAssistant('googleWorkspace')
	 * console.log(manager.isDisabled('googleWorkspace')) // false
	 * ```
	 */
	enableAssistant(name: string): this {
		const shortName = this._shortName(name)
		const current = (this.state.get('disabled') || []) as string[]
		if (current.includes(shortName)) {
			this.state.set('disabled', current.filter((n) => n !== shortName))
			this.emit('assistantDisabled', shortName, false)
		}
		return this
	}

	/**
	 * The effective set of disabled assistant names — runtime `disableAssistant()` calls plus
	 * everything `assistants/options.yml` turns off. Only reports names the manager
	 * actually knows about.
	 *
	 * @returns {string[]} Disabled assistant names
	 */
	get disabledAssistants(): string[] {
		return this._allNames().filter((name) => this.isDisabled(name))
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
		// Unfiltered — an assistant this file disables must not then be reported
		// as an override that matches nothing.
		const known = new Set(this._allNames())
		const unused = Object.keys(map).filter(
			(k) => k !== 'defaults' && !RESERVED_OVERRIDE_KEYS.has(k) && !known.has(k),
		)
		if (unused.length > 0) this.emit('unusedOverrides', unused)
		this._warnAboutStrippedOverrideKeys(map)
	}

	/**
	 * Warn about option keys that AssistantOptionsSchema will silently strip.
	 * Without this, a workspace writes `googleWorkspace: { gwsProfile: x }` into
	 * options.yml, sees no error, and the value never reaches the assistant —
	 * the fix is to nest it under `config:`, which is what the warning says.
	 */
	private _warnAboutStrippedOverrideKeys(map: Record<string, any>): void {
		const shape = (AssistantOptionsSchema as any).shape || {}
		const declared = new Set(Object.keys(shape))

		for (const [section, overrides] of Object.entries(map)) {
			if (RESERVED_OVERRIDE_KEYS.has(section)) continue
			if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) continue
			const stripped = Object.keys(overrides).filter((k) => !declared.has(k) && !RESERVED_OVERRIDE_KEYS.has(k))
			if (!stripped.length) continue
			console.warn(
				`[assistantsManager] assistants/options.yml → ${section}: unknown option${stripped.length > 1 ? 's' : ''} ` +
				`${stripped.map((k) => `"${k}"`).join(', ')} will be ignored. ` +
				`Nest assistant-specific settings under "config:" to reach them via assistant.config / assistant.setting().`
			)
		}
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
	 * Alias for `available`. Excludes disabled assistants.
	 *
	 * @returns {string[]} Names of all available assistants
	 */
	get availableAssistants() {
		return this.available
	}

	/**
	 * Names of all available assistants — the union of discovered entries
	 * and runtime-registered factories, deduplicated, with disabled assistants
	 * removed. Use `entries` / `factories` for the unfiltered source.
	 *
	 * @returns {string[]} Assistant names
	 */
	get available() {
		return this._allNames().filter((name) => !this.isDisabled(name))
	}

	/**
	 * Every known assistant name, disabled ones included — the raw union of
	 * discovered entries and registered factories.
	 */
	private _allNames(): string[] {
		const entryKeys = Object.keys(this.entries)
		const factoryKeys = Object.keys(this.factories)
		return [...new Set([...entryKeys, ...factoryKeys])]
	}

	/**
	 * Returns all discovered assistant entries as an array, excluding disabled ones.
	 *
	 * @returns {AssistantEntry[]} All discovered entries
	 */
	list(): AssistantEntry[] {
		const discovered = Object.values(this.entries).filter((e) => !this.isDisabled(e.name))
		const discoveredNames = new Set(Object.keys(this.entries))

		// Include registered factories that weren't discovered on disk
		const registeredOnly = Object.keys(this.factories)
			.filter((name) => !discoveredNames.has(name) && !this.isDisabled(name))
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

	/** Definition files that the read/write/rollback tools may touch. */
	private static readonly DEFINITION_FILES = new Set(['CORE.md', 'ABOUT.md', 'tools.ts', 'hooks.ts', 'voice.yml'])

	/** Resolve an assistant entry + validated definition-file path, throwing on unknown names or files. */
	private _definitionPath(name: string, file: string): { entry: AssistantEntry; path: string } {
		if (!AssistantsManager.DEFINITION_FILES.has(file)) {
			throw new Error(
				`"${file}" is not a definition file. Allowed: ${[...AssistantsManager.DEFINITION_FILES].join(', ')}`
			)
		}
		const entry = this.get(name)
		if (!entry) {
			throw new Error(
				`Assistant "${name}" not found. Available: ${this.available.join(', ') || '(none — run discover() first)'}`
			)
		}
		return { entry, path: `${entry.folder}/${file}` }
	}

	/**
	 * Tool-facing wrapper around {@link toSummary}: markdown listing of every
	 * discovered assistant and its definition files. Runs discovery first if it
	 * hasn't happened yet, so the tool works on a cold container.
	 *
	 * @returns {Promise<string>} Markdown summary of discovered assistants
	 *
	 * @example
	 * ```typescript
	 * console.log(await manager.listAssistants({}))
	 * ```
	 */
	async listAssistants(_args: Record<string, never> = {}): Promise<string> {
		if (!this.state.get('discovered')) await this.discover()
		return this.toSummary()
	}

	/**
	 * Create a new assistant definition: `assistants/<name>/` with the given
	 * CORE.md and a minimal tools.ts, then re-run discovery so it is immediately
	 * available to `create()`. Refuses to touch an existing assistant.
	 *
	 * @param {object} args - Arguments
	 * @param {string} args.name - Folder name for the new assistant
	 * @param {string} args.corePrompt - Full CORE.md contents (system prompt, optional frontmatter)
	 * @returns {Promise<{ created: string; folder: string }>} The created assistant's name and folder
	 * @throws {Error} If an assistant with that name already exists
	 *
	 * @example
	 * ```typescript
	 * await manager.createAssistant({ name: 'haikuWriter', corePrompt: 'You write haiku about code.' })
	 * ```
	 */
	async createAssistant(args: { name: string; corePrompt: string }): Promise<{ created: string; folder: string }> {
		const { fs, paths } = this.container
		if (!this.state.get('discovered')) await this.discover()
		if (this.get(args.name)) {
			throw new Error(`Assistant "${args.name}" already exists — use writeDefinitionFile to modify it`)
		}
		const folder = paths.resolve('assistants', args.name)
		fs.mkdir(folder)
		fs.writeFile(`${folder}/CORE.md`, args.corePrompt)
		fs.writeFile(`${folder}/tools.ts`, [
			`declare const container: any`,
			``,
			`export const schemas = {}`,
			``,
		].join('\n'))
		await this.discover()
		return { created: args.name, folder }
	}

	/**
	 * Read one definition file of a discovered assistant. Only the known
	 * definition files (CORE.md, ABOUT.md, tools.ts, hooks.ts, voice.yml) are
	 * readable — anything else throws, so a tool call cannot traverse paths.
	 *
	 * @param {object} args - Arguments
	 * @param {string} args.name - The assistant name
	 * @param {string} args.file - The definition file to read
	 * @returns {string} The file contents
	 * @throws {Error} On unknown assistant, disallowed file name, or missing file
	 *
	 * @example
	 * ```typescript
	 * const core = manager.readDefinitionFile({ name: 'researcher', file: 'CORE.md' })
	 * ```
	 */
	readDefinitionFile(args: { name: string; file: string }): string {
		const { fs } = this.container
		const { path } = this._definitionPath(args.name, args.file)
		if (!fs.exists(path)) {
			throw new Error(`${args.name} has no ${args.file}`)
		}
		return fs.readFileSync(path, 'utf8') as string
	}

	/**
	 * Overwrite one definition file with complete new contents, guarded two ways:
	 * TypeScript files are first written to a staged copy and loaded through the
	 * vm feature — a file that fails to load is rejected and the original stays
	 * untouched (a broken tools.ts would otherwise silently cripple the
	 * assistant). The previous version is backed up to `.history/` in the
	 * assistant's folder (the rollback path — no git involved), and any live
	 * instance is reloaded so the edit takes effect immediately.
	 *
	 * @param {object} args - Arguments
	 * @param {string} args.name - The assistant name
	 * @param {string} args.file - The definition file to overwrite
	 * @param {string} args.content - The complete new file contents
	 * @returns {Promise<{ wrote: string; backedUp: string | null; reloaded: boolean }>} What happened
	 * @throws {Error} On unknown assistant, disallowed file, or a .ts file that fails to load
	 *
	 * @example
	 * ```typescript
	 * await manager.writeDefinitionFile({ name: 'haikuWriter', file: 'CORE.md', content: '# New prompt' })
	 * ```
	 */
	async writeDefinitionFile(args: { name: string; file: string; content: string }): Promise<{ wrote: string; backedUp: string | null; reloaded: boolean }> {
		const { fs } = this.container
		const { entry, path } = this._definitionPath(args.name, args.file)

		if (args.file.endsWith('.ts')) {
			// Discovery only looks for exact filenames, so a dotfile stage in the
			// assistant folder is invisible to it.
			const staged = `${entry.folder}/.staged-${args.file}`
			fs.writeFile(staged, args.content)
			try {
				this.container.feature('vm').loadModule(staged, { container: this.container, console })
			} catch (err: any) {
				throw new Error(`${args.file} failed to load, write rejected: ${err?.message || err}`)
			} finally {
				await fs.rm(staged)
			}
		}

		let backedUp: string | null = null
		if (fs.exists(path)) {
			const stamp = new Date().toISOString().replace(/[:.]/g, '-')
			backedUp = `.history/${stamp}-${args.file}`
			// ensureFile creates .history/ on first use; writeFile would throw.
			fs.ensureFile(`${entry.folder}/${backedUp}`, fs.readFileSync(path, 'utf8') as string, true)
		}

		fs.writeFile(path, args.content)
		await this.discover()

		const instance = this.getInstance(args.name)
		if (instance) instance.reload()
		return { wrote: `${args.name}/${args.file}`, backedUp, reloaded: Boolean(instance) }
	}

	/**
	 * List the `.history/` backups for an assistant, newest first. Every
	 * successful {@link writeDefinitionFile} over an existing file creates one.
	 *
	 * @param {object} args - Arguments
	 * @param {string} args.name - The assistant name
	 * @param {string} [args.file] - Filter to backups of one file
	 * @returns {string[]} Backup file names (e.g. "2026-08-28T12-00-00-000Z-tools.ts"), newest first
	 *
	 * @example
	 * ```typescript
	 * manager.listDefinitionHistory({ name: 'haikuWriter', file: 'tools.ts' })
	 * ```
	 */
	listDefinitionHistory(args: { name: string; file?: string }): string[] {
		const { fs } = this.container
		const entry = this.get(args.name)
		if (!entry) {
			throw new Error(`Assistant "${args.name}" not found. Available: ${this.available.join(', ') || '(none)'}`)
		}
		const historyDir = `${entry.folder}/.history`
		if (!fs.exists(historyDir)) return []
		const names = (fs.readdirSync(historyDir) as string[])
			.filter((n) => (args.file ? n.endsWith(`-${args.file}`) : true))
		return names.sort().reverse()
	}

	/**
	 * Restore the most recent `.history/` backup of a definition file — the undo
	 * for {@link writeDefinitionFile}. Reloads any live instance afterward. The
	 * backup itself is kept, so repeated rollbacks are safe.
	 *
	 * @param {object} args - Arguments
	 * @param {string} args.name - The assistant name
	 * @param {string} args.file - The definition file to restore
	 * @returns {Promise<{ restoredFrom: string; reloaded: boolean }>} Which backup was restored
	 * @throws {Error} If no backup exists for that file
	 *
	 * @example
	 * ```typescript
	 * await manager.rollbackDefinitionFile({ name: 'haikuWriter', file: 'tools.ts' })
	 * ```
	 */
	async rollbackDefinitionFile(args: { name: string; file: string }): Promise<{ restoredFrom: string; reloaded: boolean }> {
		const { fs } = this.container
		const { entry, path } = this._definitionPath(args.name, args.file)
		const [latest] = this.listDefinitionHistory(args)
		if (!latest) {
			throw new Error(`No history for ${args.name}/${args.file} — nothing has been written over yet`)
		}
		fs.writeFile(path, fs.readFileSync(`${entry.folder}/.history/${latest}`, 'utf8') as string)
		await this.discover()
		const instance = this.getInstance(args.name)
		if (instance) instance.reload()
		return { restoredFrom: latest, reloaded: Boolean(instance) }
	}

	/**
	 * Spin up a detached instance of an assistant and send it one message —
	 * the verification half of the edit → test loop. The instance is created
	 * uncached so it does not disturb (or get confused with) a live instance of
	 * the same assistant. Makes real model calls.
	 *
	 * @param {object} args - Arguments
	 * @param {string} args.name - The assistant name (must be a discovered entry)
	 * @param {string} args.message - The message to send
	 * @returns {Promise<{ reply: string; toolCalls: Array<{ tool: string; args: Record<string, any> }>; availableTools: string[] }>} The reply, tool calls made, and tool names available
	 *
	 * @example
	 * ```typescript
	 * const { reply, toolCalls } = await manager.testAssistant({ name: 'haikuWriter', message: 'Write one about zod' })
	 * ```
	 */
	async testAssistant(args: { name: string; message: string }): Promise<{ reply: string; toolCalls: Array<{ tool: string; args: Record<string, any> }>; availableTools: string[] }> {
		if (!this.state.get('discovered')) await this.discover()
		const entry = this.get(args.name)
		if (!entry) {
			throw new Error(`Assistant "${args.name}" not found. Available: ${this.available.join(', ') || '(none)'}`)
		}
		const instance = this.container.feature(
			'assistant',
			deepMergeOptions({ folder: entry.folder, cached: false }, this.overridesFor(args.name)),
		) as Assistant

		const toolCalls: Array<{ tool: string; args: Record<string, any> }> = []
		instance.on('toolCall', (tool: string, callArgs: Record<string, any>) => {
			toolCalls.push({ tool, args: callArgs })
		})

		const reply = await instance.ask(args.message)
		return { reply, toolCalls, availableTools: Object.keys((instance as any).tools ?? {}) }
	}

	/**
	 * Args-object wrapper around {@link reload} for tool consumption.
	 *
	 * @param {object} args - Arguments
	 * @param {string} args.name - The assistant to reload (must have an active instance)
	 * @returns {{ reloaded: string[] }} Names of reloaded assistants
	 *
	 * @example
	 * ```typescript
	 * manager.reloadAssistant({ name: 'researcher' })
	 * ```
	 */
	reloadAssistant(args: { name: string }): { reloaded: string[] } {
		return this.reload(args.name)
	}

	/**
	 * When an assistant consumes this manager via `use()`, inject the operating
	 * doctrine for editing assistants safely.
	 */
	override setupToolsConsumer(consumer: Helper) {
		if (typeof (consumer as any).addSystemPromptExtension === 'function') {
			(consumer as any).addSystemPromptExtension('assistantsManager', [
				'## Assistant Management Tools',
				'',
				'You can create, inspect, edit, test, and roll back assistant definitions.',
				'',
				'**Workflow:** `listAssistants` to see what exists → `readDefinitionFile` before ANY write → `writeDefinitionFile` with the COMPLETE new file → `testAssistant` to verify the change → `rollbackDefinitionFile` if it regressed.',
				'',
				'**Whole-file writes only.** `writeDefinitionFile` replaces the entire file. Always read the current version first and include everything that should remain.',
				'',
				'**tools.ts contract:** export a `schemas` object (zod, keys = tool names) plus a matching exported function per key. The luca `container` is a global — declare it with `declare const container: any`. Never use `z.any()` in schemas.',
				'',
				'**Broken TypeScript is rejected** at write time and the original file is kept — read the error, fix the code, write again.',
				'',
				'**Do not invent model/provider frontmatter** in CORE.md — omit it unless explicitly asked for a specific model. Workspace defaults handle routing.',
				'',
				'**Do not edit your own assistant folder** unless explicitly asked to; edits to yourself only take effect after a reload, mid-conversation behavior is undefined.',
			].join('\n'))
		}
	}
}

export default AssistantsManager

