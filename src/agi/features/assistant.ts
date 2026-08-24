import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from '../../schemas/base.js'
import { type AvailableFeatures } from 'luca/feature'
import { Feature } from '../feature.js'
import type { Conversation, ConversationTool, ContentPart, AskOptions, ForkOptions, Message, ConversationRouting, SetProviderOptions, ClearMessagesOptions, MessageEdit, MessageSelector } from './conversation'
import type { ContentDb } from 'luca/node'
import type { ConversationHistory, ConversationMeta } from './conversation-history'
import hashObject from '../../hash-object.js'
import { InterceptorChain, type InterceptorFn, type InterceptorPoints, type InterceptorPoint } from '../lib/interceptor-chain.js'
import { deepMergeOptions } from '../lib/merge-options.js'
import type { Entity } from '../../entity.js'
import { State } from '../../state.js'
import type { ToolsBundle } from '../../helper.js'

declare module 'luca/feature' {
	interface AvailableFeatures {
		assistant: typeof Assistant
	}
}

export const AssistantEventsSchema = FeatureEventsSchema.extend({
	created: z.tuple([]).describe('Emitted immediately after the assistant loads its prompt, tools, and hooks.'),
	started: z.tuple([]).describe('Emitted when the assistant has been initialized'),
	turnStart: z.tuple([z.object({ turn: z.number(), isFollowUp: z.boolean() })]).describe('Emitted when a new completion turn begins. isFollowUp is true when resuming after tool calls'),
	turnEnd: z.tuple([z.object({ turn: z.number(), hasToolCalls: z.boolean() })]).describe('Emitted when a completion turn ends. hasToolCalls indicates whether tool calls will follow'),
	chunk: z.tuple([z.string().describe('A chunk of streamed text')]).describe('Emitted as tokens stream in'),
	preview: z.tuple([z.string().describe('The accumulated response so far')]).describe('Emitted with the full response text accumulated across all turns'),
	response: z.tuple([z.string().describe('The final response text')]).describe('Emitted when a complete response is produced (accumulated across all turns)'),
	rawEvent: z.tuple([z.any().describe('A raw streaming event from the active model API')]).describe('Emitted for each raw streaming event from the underlying conversation transport'),
	mcpEvent: z.tuple([z.any().describe('A raw MCP-related streaming event')]).describe('Emitted for MCP-specific streaming and output-item events when using Responses API MCP tools'),
	toolCall: z.tuple([z.string().describe('Tool name'), z.any().describe('Tool arguments')]).describe('Emitted when a tool is called'),
	toolResult: z.tuple([z.string().describe('Tool name'), z.any().describe('Result value')]).describe('Emitted when a tool returns a result'),
	toolError: z.tuple([z.string().describe('Tool name'), z.any().describe('Error')]).describe('Emitted when a tool call fails'),
	hookFired: z.tuple([z.string().describe('Hook/event name')]).describe('Emitted when a hook function is called'),
	visionDescription: z.tuple([z.object({ index: z.number(), description: z.string(), model: z.string(), batch: z.boolean().optional(), count: z.number().optional() })]).describe('Emitted when visionSupport delegates an image to the vision model and receives a description. In batch mode it fires once with batch: true and count set to the number of images described together'),
	reloaded: z.tuple([]).describe('Emitted after tools, hooks, and system prompt are reloaded from disk'),
	systemPromptExtensionsChanged: z.tuple([]).describe('Emitted when system prompt extensions are added or removed'),
})

export const AssistantStateSchema = FeatureStateSchema.extend({
	started: z.boolean().describe('Whether the assistant has been initialized'),
	conversationCount: z.number().describe('Number of ask() calls made'),
	lastResponse: z.string().describe('The most recent response text'),
	folder: z.string().describe('The resolved assistant folder path'),
	docsFolder: z.string().describe('The resolved docs folder'),
	conversationId: z.string().optional().describe('The active conversation persistence ID'),
	threadId: z.string().optional().describe('The active thread ID'),
	systemPrompt: z.string().describe('The loaded system prompt text'),
	systemPromptExtensions: z.record(z.string(), z.string()).describe('Named extensions appended to the system prompt'),
	meta: z.record(z.string(), z.any()).describe('Parsed YAML frontmatter from CORE.md'),
	tools: z.record(z.string(), z.any()).describe('Registered tool implementations'),
	hooks: z.record(z.string(), z.any()).describe('Loaded event hook functions'),
	resumeThreadId: z.string().optional().describe('Thread ID override for resume'),
	pendingPlugins: z.array(z.any()).describe('Pending async plugin promises'),
	conversation: z.any().nullable().describe('The active Conversation feature instance'),
	subagents: z.record(z.string(), z.any()).describe('Cached subagent instances'),
	forkDepth: z.number().describe('How many times this assistant has been forked from an ancestor. 0 = original.'),
})

export const AssistantOptionsSchema = FeatureOptionsSchema.extend({
	/** The folder containing the assistant definition (CORE.md, tools.ts, hooks.ts). Optional for runtime-created assistants. */
	folder: z.string().default('.').describe('The folder containing the assistant definition. Defaults to cwd for runtime-created assistants.'),

	/** If the docs folder is different from folder/docs */
	docsFolder: z.string().optional().describe('The folder containing the assistant documentation'),

	/** Provide a complete system prompt directly, bypassing CORE.md. Useful for runtime-created assistants. */
	systemPrompt: z.string().optional().describe('Provide a complete system prompt directly, bypassing CORE.md'),

	/** Text to prepend to the system prompt from CORE.md */
	prependPrompt: z.string().optional().describe('Text to prepend to the system prompt'),

	/** Text to append to the system prompt from CORE.md */
	appendPrompt: z.string().optional().describe('Text to append to the system prompt'),

	/** Human-readable description of the assistant. Falls back to about.md in folder mode. */
	about: z.string().optional().describe('Human-readable description of the assistant. Falls back to about.md in the assistant folder.'),

	/** Override or extend the tools loaded from tools.ts */

	tools: z.record(z.string(), z.any()).optional().describe('Override or extend the tools loaded from tools.ts'),
	/** Override or extend the schemas loaded from tools.ts */

	schemas: z.record(z.string(), z.any()).optional().describe('Override or extend schemas whose keys match tool names'),

	/** Model provider preset id or inline provider config. Omit for the default OpenAI-compatible behavior; set to 'codex' or 'claude-code' to route through those backends. */
	provider: z.any().optional().describe("Model provider preset id (e.g. 'codex', 'claude-code') or inline provider config. Omit for default OpenAI-compatible behavior"),

	/** Provider-specific transport options (e.g. cwd, askOptions, assistant for claude-session). */
	providerOptions: z.record(z.string(), z.any()).optional().describe('Provider-specific transport options passed to the resolved provider'),

	/** OpenAI model to use for the conversation */

	model: z.string().optional().describe('OpenAI model to use'),
	/** Maximum number of output tokens per completion */

	maxTokens: z.number().optional().describe('Maximum number of output tokens per completion'),

	/** The model's total context window in tokens. Drives auto-compaction thresholds — set this to your model's real limit (e.g. 16384 for the default local llama-server) so history compacts before the request overflows. Inferred from the model name when omitted. */
	contextWindow: z.number().optional().describe("The model's total context window in tokens. Drives auto-compaction; set to your model's real limit so history compacts before the request overflows. Inferred from the model name when omitted."),
	/** Sampling temperature (0-2). Higher = more random, lower = more deterministic. */
	temperature: z.number().min(0).max(2).optional().describe('Sampling temperature (0-2)'),
	/** Nucleus sampling cutoff (0-1). */
	topP: z.number().min(0).max(1).optional().describe('Nucleus sampling cutoff (0-1)'),
	/** Top-K sampling. Only supported by local/Anthropic models. */
	topK: z.number().optional().describe('Top-K sampling. Only supported by local/Anthropic models'),
	/** Frequency penalty (-2 to 2). */
	frequencyPenalty: z.number().min(-2).max(2).optional().describe('Frequency penalty (-2 to 2)'),
	/** Presence penalty (-2 to 2). */
	presencePenalty: z.number().min(-2).max(2).optional().describe('Presence penalty (-2 to 2)'),
	/** Stop sequences. */
	stop: z.array(z.string()).optional().describe('Stop sequences'),

	/** History persistence mode: lifecycle (ephemeral), daily (auto-resume per day), persistent (single long-running thread), session (unique per run, resumable) */
	historyMode: z.enum(['lifecycle', 'daily', 'persistent', 'session']).optional().describe('Conversation history persistence mode'),

	/** When true, prepend a timestamp to each user message so the assistant can track the passage of time across sessions */
	injectTimestamps: z.boolean().default(false).describe('Prepend timestamps to user messages so the assistant can perceive time passing between sessions'),

	/** Strict allowlist of tool names to include. Only these tools will be available. Supports "*" glob matching. */
	allowTools: z.array(z.string()).optional().describe('Strict allowlist of tool name patterns. Only matching tools are available. Supports * glob matching.'),

	/** Denylist of tool names to exclude. Matching tools will be removed. Supports "*" glob matching. */
	forbidTools: z.array(z.string()).optional().describe('Denylist of tool name patterns to exclude. Supports * glob matching.'),

	/** Convenience alias for allowTools — an explicit list of tool names (exact matches only). */
	toolNames: z.array(z.string()).optional().describe('Explicit list of tool names to include (exact match). Shorthand for allowTools without glob patterns.'),

	/** Skills to preload when the assistant uses the skillsLibrary. Also settable as `skills:` in CORE.md frontmatter. */
	skills: z.array(z.string()).optional().describe('Skill names to preload when the assistant uses the skillsLibrary'),

	/** Options passed through to the underlying OpenAI client (e.g. baseURL, apiKey). */
	clientOptions: z.record(z.string(), z.any()).optional().describe('Options for the OpenAI client, passed through to the conversation'),

	/**
	 * Delegate image understanding to a separate vision-capable model. Set this when the
	 * assistant's own model has no vision: any image parts passed to ask() are described
	 * (in parallel) by the configured vision model, and the descriptions replace the images
	 * before the question reaches the assistant's model. Pass `true` to enable with pure
	 * defaults, or an object with `prompt`, `model`, `url`, and `apiKey` overrides.
	 * Defaults: model from LUCA_VISION_SUPPORT_MODEL (else 'gpt-5.2'), url from
	 * LUCA_VISION_SUPPORT_URL (else OPENAI_BASE_URL), apiKey from LUCA_VISION_SUPPORT_API_KEY
	 * (else OPENAI_API_KEY).
	 */
	visionSupport: z.union([
		z.boolean(),
		z.object({
			prompt: z.string().optional().describe('Instruction sent to the vision model alongside each image'),
			model: z.string().optional().describe('Vision model name (default: LUCA_VISION_SUPPORT_MODEL or gpt-5.2)'),
			url: z.string().optional().describe('OpenAI-compatible base URL for the vision model (default: LUCA_VISION_SUPPORT_URL or OPENAI_BASE_URL)'),
			apiKey: z.string().optional().describe('API key for the vision endpoint (default: LUCA_VISION_SUPPORT_API_KEY or OPENAI_API_KEY)'),
			batch: z.boolean().optional().describe('Send every image in ONE vision call so the model can compare them — required for video frames and before/after screenshots (default: false, one call per image)'),
			batchPrompt: z.string().optional().describe('Instruction used instead of `prompt` when batch is on, framing the images as one ordered sequence'),
			concurrency: z.number().optional().describe('Max simultaneous vision calls in per-image mode (default: LUCA_VISION_SUPPORT_CONCURRENCY or 4). Ignored when batch is on'),
		}),
	]).optional().describe("Delegate images to a vision model when the assistant's own model has no vision. true for defaults, or { prompt, model, url, apiKey, batch, batchPrompt, concurrency }"),

	/**
	 * Free-form, assistant-specific settings that the framework never interprets.
	 * This is the supported place for arbitrary keys: every other option is
	 * validated and unknown top-level keys are stripped. tools.ts and hooks.ts
	 * read them back via `assistant.config` / `assistant.setting(path)`.
	 */
	config: z.record(z.string(), z.any()).optional().describe('Free-form assistant-specific settings, untouched by the framework and readable from tools.ts/hooks.ts via assistant.config'),
})

/** Fully resolved vision delegation settings, as returned by `assistant.visionSupport`. */
export interface VisionSupportConfig {
	prompt: string
	batchPrompt: string
	model: string
	url?: string
	apiKey?: string
	batch: boolean
	concurrency: number
}

export type AssistantState = z.infer<typeof AssistantStateSchema>
export type AssistantOptions = z.infer<typeof AssistantOptionsSchema>

export type ToolFilterDecision = {
	included: boolean
	excludedBy: string | null
}

/**
 * Resolve the assistant tool-filter precedence for one tool name.
 * This pure helper is shared by the runtime tool getter and introspection APIs.
 */
export function resolveToolFilterDecision(
	name: string,
	filters: Pick<AssistantOptions, 'allowTools' | 'forbidTools' | 'toolNames'>,
): ToolFilterDecision {
	const { allowTools, forbidTools, toolNames } = filters

	if (toolNames && !toolNames.includes(name)) {
		return { included: false, excludedBy: `toolNames: ${toolNames.join(', ')}` }
	}

	if (allowTools && !allowTools.some((pattern) => matchToolPattern(pattern, name))) {
		return { included: false, excludedBy: `allowTools: ${allowTools.join(', ')}` }
	}

	const forbiddenPattern = forbidTools?.find((pattern) => matchToolPattern(pattern, name))
	if (forbiddenPattern) {
		return { included: false, excludedBy: `forbidTools: ${forbiddenPattern}` }
	}

	return { included: true, excludedBy: null }
}

/** Match a tool name against the assistant's `*` glob syntax. */
export function matchToolPattern(pattern: string, name: string): boolean {
	if (pattern === '*') return true
	if (!pattern.includes('*')) return pattern === name
	const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')
	return new RegExp(`^${escaped}$`).test(name)
}

/** Fork options extended with assistant-specific tool filtering and lifecycle hooks. */
export type AssistantForkOptions = ForkOptions & {
	/** Denylist of tool name patterns to exclude from the fork. Supports "*" glob matching. */
	forbidTools?: string[]
	/** Strict allowlist of tool name patterns for the fork. Supports "*" glob matching. */
	allowTools?: string[]
	/** Explicit list of tool names to include in the fork (exact match). */
	toolNames?: string[]
	/**
	 * Called with the forked assistant after it has been fully initialized (started, interceptors cloned,
	 * system prompt extensions copied, forkDepth set). Use this to add/remove tools, tweak state,
	 * inject system prompt extensions, or anything else before the fork is used.
	 */
	onFork?: (fork: Assistant, parent: Assistant) => void | Promise<void>
}

export interface ResearchJobState {
	status: 'running' | 'completed' | 'failed'
	prompt: string
	questions: string[]
	results: (string | null)[]
	errors: (string | null)[]
	completed: number
	total: number
}

export interface ResearchJobOptions {
	prompt: string
	questions: string[]
	forkOptions: AssistantForkOptions
}

export type ResearchJobEvents = {
	forkCompleted: [number, string]
	forkError: [number, string]
	completed: [string[]]
	failed: [(string | null)[]]
}

export type ResearchJob = Entity<ResearchJobState, ResearchJobOptions, ResearchJobEvents>

/**
 * An Assistant is a combination of a system prompt and tool calls that has a
 * conversation with an LLM. You define an assistant by creating a folder with
 * CORE.md (system prompt), tools.ts (tool implementations), and hooks.ts (event handlers).
 *
 * @extends Feature
 *
 * @example
 * ```typescript
 * const assistant = container.feature('assistant', {
 *   folder: 'assistants/my-helper'
 * })
 * const answer = await assistant.ask('What capabilities do you have?')
 * ```
 */
export class Assistant extends Feature<AssistantState, AssistantOptions> {
	static override stateSchema = AssistantStateSchema
	static override optionsSchema = AssistantOptionsSchema
	static override eventsSchema = AssistantEventsSchema
	static override shortcut = 'features.assistant' as const
	static override stability = 'core' as const
	static override category = 'ai-assistants' as const

	static { Feature.register(this, 'assistant') }

	readonly interceptors = {
		beforeAsk: new InterceptorChain<InterceptorPoints['beforeAsk']>(),
		beforeTurn: new InterceptorChain<InterceptorPoints['beforeTurn']>(),
		beforeToolCall: new InterceptorChain<InterceptorPoints['beforeToolCall']>(),
		afterToolCall: new InterceptorChain<InterceptorPoints['afterToolCall']>(),
		beforeResponse: new InterceptorChain<InterceptorPoints['beforeResponse']>(),
	}

	/**
	 * Extension point for plugins, setupToolsConsumer, and hooks to attach
	 * arbitrary methods to the assistant instance (e.g. voice-mode adding
	 * mute/unmute). Access via `assistant.ext.myMethod()`.
	 */
	readonly ext: Record<string, (...args: any[]) => any> = {}

	/**
	 * Observable runtime state that the assistant can manipulate freely via
	 * tool calls, hooks, or extensions. Unlike the feature's own `state`
	 * (which tracks internal lifecycle), mentalState is a blank slate for
	 * the assistant's own use — tracking mood, goals, context, preferences,
	 * or anything else. Fully observable so UI or other systems can react.
	 */
	readonly mentalState = new State<Record<string, any>>()

	private _configuredUse: any[] = []
	private _toolSchemas: Record<string, z.ZodType> = {}
	private _toolSources: Record<string, string> = {}

	/**
	 * Register an interceptor at a given point in the pipeline.
	 *
	 * @param point - The interception point
	 * @param fn - Middleware function receiving (ctx, next)
	 * @returns this, for chaining
	 */
	intercept<K extends InterceptorPoint>(point: K, fn: InterceptorFn<InterceptorPoints[K]>): this {
		if (!(point in this.interceptors)) {
			const available = Object.keys(this.interceptors).join(', ')
			throw new Error(`Unknown intercept point "${point}". Available points: ${available}`)
		}
		this.interceptors[point].add(fn as any)
		return this
	}

	/**
	 * Trigger a named hook and await its completion. The hook function receives
	 * `(assistant, ...args)` and its return value is passed back to the caller.
	 * This ensures hooks run to completion BEFORE any subsequent logic executes,
	 * unlike the old bus-based approach where async hooks were fire-and-forget.
	 *
	 * Hooks that don't exist are silently skipped (returns undefined).
	 *
	 * @param hookName - The hook to trigger (matches an export name from hooks.ts)
	 * @param args - Arguments passed to the hook after the assistant instance
	 * @returns The hook's return value, or undefined if no hook exists
	 */
	async triggerHook(hookName: string, ...args: any[]): Promise<any> {
		const hooks = (this.state.get('hooks') || {}) as Record<string, (...args: any[]) => any>
		const hookFn = hooks[hookName]
		if (!hookFn) return undefined
		this.emit('hookFired', hookName)
		return await hookFn(this, ...args)
	}

	/** @returns Default state with the assistant not started, zero conversations, and the resolved folder path. */
	override get initialState(): AssistantState {
		return {
			...super.initialState,
			started: false,
			conversationCount: 0,
			lastResponse: '',
			folder: this.resolvedFolder,
			systemPrompt: '',
			systemPromptExtensions: {},
			meta: {},
			tools: {},
			hooks: {},
			resumeThreadId: undefined,
			pendingPlugins: [],
			conversation: null,
			subagents: {},
		}
	}


	get name() {
		return this.options.name || this.resolvedFolder.split('/').pop()
	}

	/** The absolute resolved path to the assistant folder. */
	get resolvedFolder(): string {
		return this.container.paths.resolve(this.options.folder)
	}

	/** The path to CORE.md which provides the system prompt. */
	get corePromptPath(): string {
		return this.paths.resolve('CORE.md')
	}

	/** The path to tools.ts which provides tool implementations and schemas. */
	get toolsModulePath(): string {
		return this.paths.resolve('tools.ts')
	}

	/** The path to hooks.ts which provides event handler functions. */
	get hooksModulePath(): string {
		return this.paths.resolve('hooks.ts')
	}

	/**
	 * The path to the about file which provides the human-readable assistant
	 * description. Prefers ABOUT.md (the casing used by discovery and scaffolds),
	 * falling back to about.md for older assistant folders.
	 */
	get aboutPath(): string {
		const canonical = this.paths.resolve('ABOUT.md')
		if (this.container.fs.exists(canonical)) return canonical
		return this.paths.resolve('about.md')
	}

	/**
	 * Human-readable description of the assistant. Returns the `about` option when
	 * provided, otherwise reads about.md from the assistant folder. Undefined when
	 * neither is available.
	 */
	get about(): string | undefined {
		if (this.options.about) return this.options.about
		if (this.container.fs.exists(this.aboutPath)) {
			return String(this.container.fs.readFile(this.aboutPath))
		}
		return undefined
	}

	/** Whether this assistant has a voice.yml configuration file. */
	get hasVoice(): boolean {
		return this.container.fs.exists(this.paths.resolve('voice.yml'))
	}

	/** Parsed voice configuration from voice.yml, or undefined if not present. */
	get voiceConfig(): Record<string, any> | undefined {
		if (!this.hasVoice) return undefined
		const yaml = this.container.feature('yaml')
		return yaml.parse(String(this.container.fs.readFile(this.paths.resolve('voice.yml'))))
	}

	get resolvedDocsFolder() {
		const { docsFolder = this.effectiveOptions.docsFolder || 'docs' } = this.state.current

		if (this.container.fs.exists(docsFolder)) {
			return this.container.paths.resolve(docsFolder)
		}

		const findUp = this.container.fs.findUp('docs', {
			cwd: this.resolvedFolder
		})

		if (typeof findUp === 'string' && this.container.fs.exists(findUp!)) {
			this.state.set('docsFolder', findUp!)
			return this.container.paths.resolve(findUp!)
		}

		return this.paths.resolve('docs')
	}

	/**
	 * Returns an instance of a ContentDb feature for the resolved docs folder
	 */
	get contentDb() : ContentDb {
		return this.container.feature('contentDb', { rootPath: this.resolvedDocsFolder })
	}


	/**
	 * Called immediately after the assistant is constructed. Synchronously loads
	 * the system prompt, tools, and hooks. Hooks are invoked via triggerHook()
	 * at each emit site, ensuring async hooks are properly awaited.
	 */
	override afterInitialize() {
		this.state.set('pendingPlugins', [])

		// Load system prompt synchronously
		this.state.set('systemPrompt', this.loadSystemPrompt())

		// Load tools and hooks synchronously via vm.performSync
		this.state.set('tools', this.loadTools())
		this.state.set('hooks', this.loadHooks())

		// Defer created hook+event so external listeners can register first
		setTimeout(async () => {
			await this.triggerHook('created')
			this.emit('created')
		}, 1)
	}

	get conversation(): Conversation {
		let conv = this.state.get('conversation') as Conversation | null
		if (!conv) {
			const provider = this.effectiveOptions.provider
			const callerProviderOptions = this.effectiveOptions.providerOptions ?? {}
			const assistantToolFilters = this.providerToolFilters
			// With no provider configured, the conversation resolves the container's
			// default provider (openai when OPENAI_API_KEY is set, else a local
			// llama-server, else a registered custom endpoint). Only force the
			// OpenAI model default when that default IS the OpenAI path — any other
			// default must keep its own model.
			const defaultsToOpenAI = !provider && this.resolveDefaultProviderId() === 'openai'
			// A frontmatter `model` is a default tied to the frontmatter's own
			// provider. When the caller overrides the provider (CLI flag, workspace
			// overrides), that model would be sent to a backend that doesn't have
			// it — drop it so the new provider's default model wins. An explicit
			// caller `model` still takes precedence.
			const providerOverridden = this.options.provider != null && this.options.provider !== this.meta.provider
			const model = this.options.model || (providerOverridden ? undefined : this.meta.model)
			conv = this.container.feature('conversation', {
				// A conversation is per-assistant mutable state — never share a cached
				// instance between assistants whose initial options happen to match,
				// or history loads in one session would corrupt every other session.
				cached: false,
				// Only default the model for the OpenAI path; when a provider is
				// configured (or defaulted), leave it unset so the provider's default model wins.
				model: model || (defaultsToOpenAI ? 'gpt-5.4-mini' : undefined),
				tools: this.tools,
				api: 'chat',
				// When a provider is configured, thread it through. The `assistant`
				// providerOption drives claude-session's MCP tool wiring; default it
				// to this assistant's name so tools work without extra config.
				...(provider ? {
					provider,
					providerOptions: {
						...callerProviderOptions,
						assistant: callerProviderOptions.assistant ?? this.name,
						...(assistantToolFilters ? { assistantToolFilters } : {}),
					},
				} : {}),
				...(this.effectiveOptions.maxTokens ? { maxTokens: this.effectiveOptions.maxTokens } : {}),
				...(this.effectiveOptions.contextWindow ? { contextWindow: this.effectiveOptions.contextWindow } : {}),
				...(this.effectiveOptions.temperature != null ? { temperature: this.effectiveOptions.temperature } : {}),
				...(this.effectiveOptions.topP != null ? { topP: this.effectiveOptions.topP } : {}),
				...(this.effectiveOptions.topK != null ? { topK: this.effectiveOptions.topK } : {}),
				...(this.effectiveOptions.frequencyPenalty != null ? { frequencyPenalty: this.effectiveOptions.frequencyPenalty } : {}),
				...(this.effectiveOptions.presencePenalty != null ? { presencePenalty: this.effectiveOptions.presencePenalty } : {}),
				...(this.effectiveOptions.stop ? { stop: this.effectiveOptions.stop } : {}),
				...(this.effectiveOptions.clientOptions ? { clientOptions: this.effectiveOptions.clientOptions } : {}),
				history: [
					{ role: 'system', content: this.effectiveSystemPrompt },
				],
			})
			this.state.set('conversation', conv)
		}
		return conv
	}

	/**
	 * Where the assistant's next turn will go: provider, model, OpenAI dialect,
	 * and turn loop. Derived live from the underlying conversation.
	 *
	 * @example
	 * assistant.routing
	 * // => { provider: 'local', model: 'qwen3-coder', apiMode: 'chat', transport: 'openai' }
	 */
	get routing(): ConversationRouting {
		return this.conversation.routing
	}

	/**
	 * Switch the model for every subsequent turn. Safe to call mid-chat — the
	 * conversation, its history, and its tools are all preserved.
	 *
	 * @param model - The model name to use from here on
	 *
	 * @example
	 * assistant.setModel('gpt-5.4')
	 * await assistant.ask('try that again, more carefully')
	 */
	setModel(model: string): this {
		if (!model || typeof model !== 'string') {
			throw new Error('setModel(model) requires a model name, e.g. assistant.setModel("gpt-5.4")')
		}
		;(this.options as Record<string, any>).model = model
		const existing = this.state.get('conversation') as Conversation | null
		existing?.setModel(model)
		return this
	}

	/**
	 * Switch the backend for every subsequent turn — including across transport
	 * families (an OpenAI-compatible endpoint to claude-code, say). Safe to call
	 * mid-chat: history and tools survive, and an unregistered provider id throws
	 * immediately rather than at the next `ask()`.
	 *
	 * With no explicit `model`, the new provider's own default model takes over.
	 *
	 * @param provider - A registered provider id, an inline provider config, or null for the container default
	 * @param options - Optional `model` and `providerOptions` to apply along with the switch
	 *
	 * @example
	 * assistant.setProvider('claude-code', { model: 'sonnet' })
	 * await assistant.ask('pick up where we left off')
	 */
	setProvider(provider: string | Record<string, any> | null, options: SetProviderOptions = {}): this {
		const opts = this.options as Record<string, any>
		const restore = { provider: opts.provider, model: opts.model, providerOptions: opts.providerOptions }
		// Mirror the conversation's rule: a model tied to the old provider (including
		// one from CORE.md frontmatter) must not follow the switch unless named here.
		opts.provider = provider ?? undefined
		opts.model = options.model
		const replacementProviderOptions = provider ? {
			...(options.providerOptions ?? {}),
			assistant: options.providerOptions?.assistant ?? this.name,
			...(this.providerToolFilters ? { assistantToolFilters: this.providerToolFilters } : {}),
		} : undefined
		opts.providerOptions = replacementProviderOptions

		const existing = this.state.get('conversation') as Conversation | null
		try {
			if (existing) {
				existing.setProvider(provider, { ...options, providerOptions: replacementProviderOptions })
			} else if (typeof provider === 'string') {
				// No conversation yet, so nobody else will validate the id until the
				// first ask() — check it here so the caller learns now.
				const modelProviders = this.container.feature('modelProviders')
				if (!modelProviders.get(provider)) {
					const available = Object.keys(modelProviders.profiles ?? {})
					throw new Error(
						`Unknown model provider: "${provider}". It is not registered in modelProviders. ` +
						`Register it (e.g. modelProviders.registerLocal('${provider}', baseURL, model) in luca.cli.ts) or use one of the registered ids: ${available.join(', ') || '(none)'}.`
					)
				}
			}
		} catch (error) {
			Object.assign(opts, restore)
			throw error
		}
		return this
	}

	/** The container's default provider id (via modelProviders), or undefined when none is available. */
	private resolveDefaultProviderId(): string | undefined {
		try {
			return (this.container.feature('modelProviders') as any).resolveDefaultId()
		} catch {
			return undefined
		}
	}

	get availableTools() {
		return Object.keys(this.tools)
	}

	get messages() {
		return this.conversation.messages
	}

	/**
	 * Wipe this assistant's transcript, keeping its system prompt — "start over".
	 * Delegates to `Conversation#clearMessages`, so provider continuation handles
	 * are invalidated and `messagesVersion` bumps.
	 *
	 * Note this only clears the live conversation. A persisted thread is replayed
	 * on the next resume unless it is deleted too.
	 *
	 * @example
	 * assistant.clearMessages()
	 */
	clearMessages(options?: ClearMessagesOptions): MessageEdit {
		return this.conversation.clearMessages(options)
	}

	/**
	 * Rewrite one message already in this assistant's history — the supported way
	 * to redact it. Delegates to `Conversation#replaceMessage`.
	 *
	 * @example
	 * assistant.replaceMessage(-1, message => ({ ...message, content: '[redacted]' }))
	 */
	replaceMessage(selector: MessageSelector, replacement: Message | ((message: Message, index: number) => Message)): MessageEdit {
		return this.conversation.replaceMessage(selector, replacement)
	}

	/** Whether the assistant has been started and is ready to receive questions. */
	get isStarted(): boolean {
		return !!this.state.get('started')
	}

	/** Whether this assistant was created via fork(). */
	get isFork(): boolean {
		return (this.state.get('forkDepth') ?? 0) > 0
	}

	/** How many levels deep this fork is. 0 = original, 1 = direct fork, 2 = fork of a fork, etc. */
	get forkDepth(): number {
		return (this.state.get('forkDepth') as number) ?? 0
	}

	/** The current system prompt text. */
	get systemPrompt(): string {
		return this.state.get('systemPrompt') || ''
	}

	/** The named extensions appended to the system prompt. */
	get systemPromptExtensions(): Record<string, string> {
		return (this.state.get('systemPromptExtensions') || {}) as Record<string, string>
	}

	/** The system prompt with all extensions appended. This is the value passed to the conversation. */
	get effectiveSystemPrompt(): string {
		const base = this.systemPrompt
		const extensions = Object.values(this.systemPromptExtensions)
		if (!extensions.length) return base
		return [base, ...extensions].join('\n\n')
	}

	/**
	 * Add or update a named system prompt extension. The value is appended
	 * to the base system prompt when passed to the conversation.
	 *
	 * @param key - A unique identifier for this extension
	 * @param value - The text to append
	 * @returns this, for chaining
	 */
	addSystemPromptExtension(key: string, value: string): this {
		this.state.set('systemPromptExtensions', { ...this.systemPromptExtensions, [key]: value })
		this.syncSystemPromptToConversation()
		this.emit('systemPromptExtensionsChanged')
		return this
	}

	/**
	 * Remove a named system prompt extension.
	 *
	 * @param key - The identifier of the extension to remove
	 * @returns this, for chaining
	 */
	removeSystemPromptExtension(key: string): this {
		const current = { ...this.systemPromptExtensions }
		delete current[key]
		this.state.set('systemPromptExtensions', current)
		this.syncSystemPromptToConversation()
		this.emit('systemPromptExtensionsChanged')
		return this
	}

	/** Update the conversation's system message to reflect the current effective prompt. */
	private syncSystemPromptToConversation() {
		const conv = this.state.get('conversation') as Conversation | null
		if (!conv) return
		const messages = [...conv.messages]
		if (messages.length > 0 && (messages[0]!.role === 'system' || messages[0]!.role === 'developer')) {
			messages[0] = { ...messages[0]!, content: this.effectiveSystemPrompt }
			conv._setMessages(messages)
		}
	}

	/** The tools registered with this assistant. */
	get tools(): Record<string, ConversationTool> {
		return this.applyToolFilters(this.allTools)
	}

	/** Filter policy forwarded to assistant-backed MCP subprocesses. */
	private get providerToolFilters(): Pick<AssistantOptions, 'allowTools' | 'forbidTools' | 'toolNames'> | undefined {
		const { allowTools, forbidTools, toolNames } = this.effectiveOptions
		if (!allowTools && !forbidTools && !toolNames) return undefined
		return {
			...(allowTools ? { allowTools: [...allowTools] } : {}),
			...(forbidTools ? { forbidTools: [...forbidTools] } : {}),
			...(toolNames ? { toolNames: [...toolNames] } : {}),
		}
	}

	/** Every known tool before allow/forbid/toolNames filters are applied. */
	get allTools(): Record<string, ConversationTool> {
		return (this.state.get('tools') || {}) as Record<string, ConversationTool>
	}

	/** Live Zod schemas keyed by tool name. */
	get schemas(): Record<string, z.ZodType> {
		return { ...this._toolSchemas }
	}

	/** Provenance for every live tool: feature id, tools.ts, or runtime. */
	get toolSources(): Record<string, string> {
		return { ...this._toolSources }
	}

	/** Resolved entries exported by tools.ts as `use`, retained after startup. */
	get configuredUse(): any[] {
		return [...this._configuredUse]
	}

	/** Resolve whether one tool survives the assistant's current filters. */
	toolFilterDecision(name: string): ToolFilterDecision {
		return resolveToolFilterDecision(name, this.effectiveOptions)
	}

	/**
	 * Apply allowTools, forbidTools, and toolNames filters from options.
	 * toolNames is treated as an exact-match allowlist. allowTools/forbidTools support "*" glob patterns.
	 * allowTools is applied first (strict allowlist), then forbidTools removes from whatever remains.
	 */
	private applyToolFilters(tools: Record<string, ConversationTool>): Record<string, ConversationTool> {
		const { allowTools, forbidTools, toolNames } = this.effectiveOptions
		if (!allowTools && !forbidTools && !toolNames) return tools

		const names = Object.keys(tools).filter((name) => this.toolFilterDecision(name).included)

		const result: Record<string, ConversationTool> = {}
		for (const n of names) {
			const tool = tools[n]
			if (tool) result[n] = tool
		}
		return result
	}

	/**
	 * Apply a setup function or a Helper instance to this assistant.
	 *
	 * When passed a function, it receives the assistant and can configure
	 * tools, hooks, event listeners, etc.
	 *
	 * When passed a Helper instance that exposes tools via toTools(),
	 * those tools are automatically added to this assistant.
	 *
	 * @param fnOrHelper - Setup function or Helper instance
	 * @returns this, for chaining
	 *
	 * @example
	 * ```typescript
	 * assistant
	 *   .use(setupLogging)
	 *   .use(container.feature('git'))
	 * ```
	 */
	use(fnOrHelper: ((assistant: this) => void | Promise<void>) | { toTools: () => ToolsBundle } | ToolsBundle): this {
		if (typeof fnOrHelper === 'function') {
			const result = fnOrHelper(this)
			if (result && typeof (result as any).then === 'function') {
				const pending = this.state.get('pendingPlugins') as Promise<void>[]
				this.state.set('pendingPlugins', [...pending, result as Promise<void>])
			}
		} else if (fnOrHelper && typeof (fnOrHelper as any).toTools === 'function') {
			try {
				const provided = (fnOrHelper as any).toTools() as ToolsBundle
				const source = provided.provider?.name || this.describeToolsProvider(fnOrHelper)
				this._registerTools(provided, source)
				if (typeof (fnOrHelper as any).setupToolsConsumer === 'function') {
					(fnOrHelper as any).setupToolsConsumer(this)
				}
			} catch (err: any) {
				this.reportToolsProviderFailure(this.describeToolsProvider(fnOrHelper), err)
			}
		} else if (fnOrHelper && 'schemas' in fnOrHelper && 'handlers' in fnOrHelper) {
			const source = (fnOrHelper as ToolsBundle).provider?.name || this.describeToolsProvider(fnOrHelper)
			try {
				this._registerTools(fnOrHelper as ToolsBundle, source)
				if (typeof (fnOrHelper as any).setup === 'function') {
					(fnOrHelper as any).setup(this)
				}
			} catch (err: any) {
				this.reportToolsProviderFailure(source, err)
			}
		}
		return this
	}

	/**
	 * Best-effort label for something passed to `use()`, so failures can name
	 * the helper at fault instead of surfacing anonymously.
	 */
	private describeToolsProvider(entry: any): string {
		const candidates = [entry?.shortcut, entry?.name, entry?.constructor?.name]
		const label = candidates.find((value) => typeof value === 'string' && value.length)
		return label || 'an anonymous tools provider'
	}

	/**
	 * Log a tools-registration failure without taking the assistant down. A
	 * single bad entry in `export const use = [...]` should cost that helper's
	 * tools, not the whole session.
	 */
	private reportToolsProviderFailure(source: string, err: any) {
		console.error(`Assistant "${this.name}" could not register tools from ${source}: ${err?.message || err}`)
	}

	/** Register tools from a `{ schemas, handlers }` object. */
	private _registerTools(provided: ToolsBundle, source = 'a tools provider') {
		const expected = '{ schemas: Record<string, ZodType>, handlers: Record<string, Function> }'
		const isPlainObject = (value: any) => !!value && typeof value === 'object' && !Array.isArray(value)

		if (!isPlainObject(provided)) {
			const got = provided === null ? 'null' : Array.isArray(provided) ? 'an array' : typeof provided
			throw new Error(`${source} produced ${got} instead of ${expected}`)
		}

		const { schemas, handlers } = provided as any
		if (!isPlainObject(schemas) || !isPlainObject(handlers)) {
			const keys = Object.keys(provided)
			throw new Error(
				`${source} produced { ${keys.join(', ') || 'no keys'} } — expected ${expected}`,
			)
		}

		for (const name of Object.keys(schemas)) {
			if (typeof handlers[name] === 'function') {
				this.addTool(name, handlers[name] as any, schemas[name])
				this._runtimeToolNames?.delete(name)
				this._toolSources[name] = source.replace(/^features\./, '')
			}
		}
	}

	/**
	 * Add a tool to this assistant. The tool name is derived from the
	 * handler's function name.
	 *
	 * @param handler - A named function that implements the tool
	 * @param schema - Optional Zod schema describing the tool's parameters
	 * @returns this, for chaining
	 *
	 * @example
	 * ```typescript
	 * assistant.addTool(function getWeather(args) {
	 *   return { temp: 72 }
	 * }, z.object({ city: z.string() }).describe('Get weather for a city'))
	 * ```
	 */
	addTool(name: string, handler: (...args: any[]) => any, schema?: z.ZodType): this
	addTool(handler: (...args: any[]) => any, schema?: z.ZodType): this
	addTool(nameOrHandler: string | ((...args: any[]) => any), handlerOrSchema?: ((...args: any[]) => any) | z.ZodType, maybeSchema?: z.ZodType): this {
		let name: string
		let handler: (...args: any[]) => any
		let schema: z.ZodType | undefined

		if (typeof nameOrHandler === 'function') {
			// addTool(handler, schema?) — extract name from function
			handler = nameOrHandler
			name = handler.name
			schema = handlerOrSchema as z.ZodType | undefined
		} else {
			// addTool(name, handler, schema?)
			name = nameOrHandler
			handler = handlerOrSchema as (...args: any[]) => any
			schema = maybeSchema
		}

		if (!name) throw new Error('addTool handler must be a named function')
		if (!this._runtimeToolNames) this._runtimeToolNames = new Set()
		this._runtimeToolNames.add(name)

		const current = { ...this.allTools }

		if (schema) {
			const jsonSchema = (schema as any).toJSONSchema() as Record<string, any>
			this._toolSchemas[name] = schema
			// OpenAI requires `required` to list ALL property keys — optional params
			// must still appear in `required` but use a default value in the schema.
			const properties = jsonSchema.properties || {}
			const required = Object.keys(properties)
			current[name] = {
				handler: handler as ConversationTool['handler'],
				description: jsonSchema.description || name,
				parameters: {
					type: jsonSchema.type || 'object',
					properties,
					required,
				},
			}
		} else {
			delete this._toolSchemas[name]
			current[name] = {
				handler: handler as ConversationTool['handler'],
				description: name,
				parameters: { type: 'object', properties: {} },
			}
		}
		this._toolSources[name] = 'runtime'

		this.state.set('tools', current)
		this.emit('toolsChanged')

		return this
	}

	/**
	 * Remove a tool by name or handler function reference.
	 *
	 * @param nameOrHandler - The tool name string, or the handler function to match
	 * @returns this, for chaining
	 */
	removeTool(nameOrHandler: string | ((...args: any[]) => any)): this {
		const current = { ...this.allTools }

		if (typeof nameOrHandler === 'string') {
			delete current[nameOrHandler]
			this._runtimeToolNames?.delete(nameOrHandler)
			delete this._toolSchemas[nameOrHandler]
			delete this._toolSources[nameOrHandler]
		} else {
			for (const [name, tool] of Object.entries(current)) {
				if (tool.handler === nameOrHandler) {
					delete current[name]
					this._runtimeToolNames?.delete(name)
					delete this._toolSchemas[name]
					delete this._toolSources[name]
					break
				}
			}
		}

		this.state.set('tools', current)
		this.emit('toolsChanged')

		return this
	}

	/**
	 * Simulate a tool call and its result by appending the appropriate
	 * messages to the conversation history. Useful for injecting context
	 * that looks like the assistant performed a tool call.
	 *
	 * @param toolCallName - The name of the tool
	 * @param args - The arguments that were "passed" to the tool
	 * @param result - The result the tool "returned"
	 * @returns this, for chaining
	 */
	simulateToolCallWithResult(toolCallName: string, args: Record<string, any>, result: any): this {
		if (!this.conversation) {
			throw new Error('Cannot simulate: assistant has no active conversation. Call start() first.')
		}

		const callId = `call_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

		this.conversation.pushMessage({
			role: 'assistant',
			content: null,
			tool_calls: [{
				id: callId,
				type: 'function',
				function: {
					name: toolCallName,
					arguments: JSON.stringify(args),
				},
			}],
		} as Message)

		this.conversation.pushMessage({
			role: 'tool',
			tool_call_id: callId,
			content: typeof result === 'string' ? result : JSON.stringify(result),
		} as Message)

		return this
	}

	/**
	 * Simulate a user question and assistant response by appending both
	 * messages to the conversation history.
	 *
	 * @param question - The user's question
	 * @param response - The assistant's response
	 * @returns this, for chaining
	 */
	simulateQuestionAndResponse(question: string, response: string): this {
		if (!this.conversation) {
			throw new Error('Cannot simulate: assistant has no active conversation. Call start() first.')
		}

		this.conversation.pushMessage({ role: 'user', content: question })
		this.conversation.pushMessage({ role: 'assistant', content: response })

		return this
	}

	/**
	 * Parsed YAML frontmatter from CORE.md, or empty object if none.
	 */
	get meta(): Record<string, any> {
		return (this.state.get('meta') || {}) as Record<string, any>
	}

	/**
	 * Merged options where CORE.md frontmatter provides defaults and
	 * constructor options take precedence. Prefer this over `this.options`
	 * anywhere model parameters or runtime config is consumed.
	 */
	get effectiveOptions(): AssistantOptions & Record<string, any> {
		// Zod keeps explicitly-undefined optional keys, so a caller spreading a partial
		// options bag — `{ ...opts }` where `opts.model` was never set — would otherwise
		// clobber the frontmatter default with undefined. An option that was not given a
		// value is an option that was not given, so drop those before layering.
		const given = Object.fromEntries(
			Object.entries(this.options as Record<string, any>).filter(([, value]) => value !== undefined),
		) as AssistantOptions & Record<string, any>
		return { ...this.meta, ...given }
	}

	/**
	 * Assistant-specific settings the framework never interprets — the supported
	 * home for arbitrary configuration. Every other option is schema-validated,
	 * so unknown top-level keys are silently stripped; keys nested under `config`
	 * survive untouched.
	 *
	 * Three layers deep-merge, weakest first: a `config:` block in the
	 * assistant's own CORE.md frontmatter, then the workspace's
	 * `assistants/options.yml` (`defaults.config` then `<name>.config`), then
	 * `config` passed to `create()`. The options.yml layer is what lets a project
	 * configure assistants it does not own — ones contributed by a plugin, or
	 * discovered from `~/.luca/assistants`.
	 *
	 * @example
	 * ```yaml
	 * # <workspace>/assistants/options.yml — configures a plugin's assistant
	 * googleWorkspace:
	 *   config:
	 *     gwsProfile: northchief
	 * ```
	 *
	 * @example
	 * ```typescript
	 * // assistants/googleWorkspace/tools.ts
	 * export const use = [container.feature('gws', { profile: me.config.gwsProfile })]
	 * ```
	 */
	get config(): Record<string, any> {
		return deepMergeOptions(
			(this.meta.config as Record<string, any>) || {},
			(this.options.config as Record<string, any>) || {},
		)
	}

	/**
	 * Read one value out of {@link config} by dot path, with an optional fallback.
	 * Use this in tools.ts/hooks.ts so a missing config block doesn't throw on
	 * nested access.
	 *
	 * @param {string} path - Dot path into the merged config (e.g. 'gws.profile')
	 * @param {any} fallback - Returned when the path is absent or undefined
	 * @returns {any} The configured value, or the fallback
	 *
	 * @example
	 * ```typescript
	 * const profile = me.setting('gwsProfile', 'default')
	 * const budget = me.setting('limits.maxDownloads', 25)
	 * ```
	 */
	setting<T = any>(path: string, fallback?: T): T {
		const found = this.container.utils.lodash.get(this.config, path)
		return (found === undefined ? fallback : found) as T
	}

	/**
	 * Load the system prompt from CORE.md, applying any prepend/append options.
	 * YAML frontmatter (between --- fences) is stripped from the prompt and
	 * stored in `_meta`.
	 *
	 * @returns {string} The assembled system prompt
	 */
	loadSystemPrompt(): string {
		const { fs } = this.container
		let prompt = ''
		this.state.set('meta', {})

		if (this.options.systemPrompt) {
			prompt = this.options.systemPrompt
		} else if (fs.exists(this.corePromptPath)) {
			const raw = fs.readFile(this.corePromptPath).toString()
			const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)

			if (fmMatch) {
				const yaml = this.container.feature('yaml')
				this.state.set('meta', yaml.parse(fmMatch[1]!) ?? {})
				prompt = raw.slice(fmMatch[0].length)
			} else {
				prompt = raw
			}
		}

		if (this.options.prependPrompt) {
			prompt = this.options.prependPrompt + '\n\n' + prompt
		}

		if (this.options.appendPrompt) {
			prompt = prompt + '\n\n' + this.options.appendPrompt
		}

		if (this.options.injectTimestamps) {
			prompt = prompt + '\n\n' + [
				'## Timestamps',
				'Each user message is prefixed with a timestamp in [YYYY-MM-DD HH:MM] format.',
				'Use these to understand the passage of time between interactions.',
				'The user may return hours or days later within the same conversation — acknowledge the time gap naturally when relevant, and use timestamps to contextualize when topics were previously discussed.',
			].join('\n')
		}

		return prompt.trim()
	}

	/**
	 * Load tools from tools.ts using the container's VM feature, injecting
	 * the container and assistant as globals. Merges with any tools
	 * provided in the constructor options. Runs synchronously via vm.loadModule.
	 *
	 * @returns {Record<string, ConversationTool>} The assembled tool map
	 */
	loadTools(): Record<string, ConversationTool> {
		const tools: Record<string, ConversationTool> = {}
		this._configuredUse = []
		this._toolSchemas = {}
		this._toolSources = {}

		// Skip loading if no tools file exists (runtime-created assistants)
		if (!this.container.fs.exists(this.toolsModulePath)) {
			return this.mergeOptionTools(tools)
		}

		// Ensure virtual modules (zod, luca, etc.) are seeded so tools
		// files outside the project tree can resolve them through the VM
		if (this.container.features.has('helpers')) {
			const helpers = this.container.feature('helpers') as any
			helpers.seedVirtualModules()
		}

		const vm = this.container.feature('vm')

		let moduleExports: Record<string, any>
		try {
			moduleExports = vm.loadModule(this.toolsModulePath, {
				container: this.container,
				me: this,
				my: this,
				assistant: this,
				console: console,
			})
		} catch (err: any) {
			console.error(`Failed to load tools from ${this.toolsModulePath}`)
			const message = err?.message || String(err)
			// Only blame syntax when it actually is a parse failure — unregistered
			// features and other runtime errors need their own message, not a
			// misleading "check your syntax" nudge.
			const isSyntaxError = err instanceof SyntaxError
				|| err?.name === 'SyntaxError'
				|| /syntaxerror|unexpected (token|identifier|end of)|parse error/i.test(message)
			if (isSyntaxError) {
				console.error(`There may be a syntax error in this file. Please check it.`)
			}
			console.error(message)
			return this.mergeOptionTools(tools)
		}

		// Stash `export const use = [...]` for deferred processing during start(),
		// since the assistant isn't fully constructed yet when loadTools() runs
		if (Array.isArray(moduleExports.use)) {
			this._configuredUse = [...moduleExports.use]
			this.state.set('deferredUse', moduleExports.use)
		}

		if (Object.keys(moduleExports).length) {
			const schemas: Record<string, z.ZodType> = moduleExports.schemas || {}

			for (const [name, fn] of Object.entries(moduleExports)) {
				if (name === 'schemas' || name === 'default' || name === 'use' || typeof fn !== 'function') continue

				const schema = schemas[name]
				this._toolSources[name] = 'tools.ts'
				if (schema) {
					this._toolSchemas[name] = schema
					const jsonSchema = (schema as any).toJSONSchema() as Record<string, any>
					tools[name] = {
						handler: fn as ConversationTool['handler'],
						description: jsonSchema.description || name,
						parameters: {
							type: jsonSchema.type || 'object',
							properties: jsonSchema.properties || {},
							...(jsonSchema.required ? { required: jsonSchema.required } : {}),
						},
					}
				} else {
					tools[name] = {
						handler: fn as ConversationTool['handler'],
						description: name,
						parameters: { type: 'object', properties: {} },
					}
				}
			}
		}

		return this.mergeOptionTools(tools)
	}

	/**
	 * Merge tools provided via constructor options into the tool map.
	 * This allows runtime-created assistants to define tools entirely via options.
	 */
	private mergeOptionTools(tools: Record<string, ConversationTool>): Record<string, ConversationTool> {
		if (this.options.tools) {
			const optionSchemas = this.options.schemas || {}

			for (const [name, fn] of Object.entries(this.options.tools)) {
				if (typeof fn !== 'function') continue

				const schema = optionSchemas[name]
				this._toolSources[name] = 'runtime'
				if (schema) {
					this._toolSchemas[name] = schema
					const jsonSchema = (schema as any).toJSONSchema() as Record<string, any>
					tools[name] = {
						handler: fn as ConversationTool['handler'],
						description: jsonSchema.description || name,
						parameters: {
							type: jsonSchema.type || 'object',
							properties: jsonSchema.properties || {},
							...(jsonSchema.required ? { required: jsonSchema.required } : {}),
						},
					}
				} else {
					tools[name] = {
						handler: fn as ConversationTool['handler'],
						description: name,
						parameters: { type: 'object', properties: {} },
					}
				}
			}
		}

		return tools
	}

	/**
	 * Load event hooks from hooks.ts. Each exported function name should
	 * match an event the assistant emits. When that event fires, the
	 * corresponding hook function is called. Runs synchronously via vm.loadModule.
	 *
	 * @returns {Record<string, Function>} The hook function map
	 */
	loadHooks(): Record<string, (...args: any[]) => any> {
		const hooks: Record<string, (...args: any[]) => any> = {}

		// Skip loading if no hooks file exists (runtime-created assistants)
		if (!this.container.fs.exists(this.hooksModulePath)) {
			return hooks
		}

		const vm = this.container.feature('vm')

		let moduleExports: Record<string, any>
		try {
			moduleExports = vm.loadModule(this.hooksModulePath, {
				container: this.container,
				me: this,
				my: this,
				assistant: this,
				console: console,
			})
		} catch (err: any) {
			console.error(`Failed to load hooks from ${this.hooksModulePath}`)
			console.error(`There may be a syntax error in this file. Please check it.`)
			console.error(err.message || err)
			return hooks
		}

		for (const [name, fn] of Object.entries(moduleExports)) {
			if (name === 'default' || typeof fn !== 'function') continue
			hooks[name] = fn as (...args: any[]) => any
		}

		return hooks
	}

	/**
	 * Provides a helper for creating paths off of the assistant's base folder
	 */
	get paths() {
		const { container } = this
		const base = this.resolvedFolder

		return {
			resolve(...args: any[]) {
				return container.paths.resolve(base, ...args)		
			},
			join(...args: any[]) {
				return container.paths.resolve(base, ...args)
			}
		}
	}

	/**
	 * Prepend a [YYYY-MM-DD HH:MM] timestamp to user message content.
	 */
	private prependTimestamp(content: string | ContentPart[]): string | ContentPart[] {
		const now = new Date()
		const pad = (n: number) => String(n).padStart(2, '0')
		const stamp = `[${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}]`

		if (typeof content === 'string') {
			return `${stamp} ${content}`
		}

		const firstPart = content[0]
		if (firstPart && firstPart.type === 'text') {
			return [{ type: 'text' as const, text: `${stamp} ${firstPart.text}` }, ...content.slice(1)]
		}

		return [{ type: 'text' as const, text: stamp }, ...content]
	}

	// -- History mode helpers --

	/** The assistant name derived from the folder basename. */
	get assistantName(): string {
		return this.resolvedFolder.split('/').pop() || 'assistant'
	}

	/** An 8-char hash of the container cwd for per-project thread isolation. */
	get cwdHash(): string {
		return hashObject(this.container.cwd).slice(0, 8)
	}

	/** The thread prefix for this assistant+project combination. */
	get threadPrefix(): string {
		return `${this.assistantName}:${this.cwdHash}:`
	}

	/** Build a thread ID based on the history mode. */
	private buildThreadId(mode: string): string {
		const prefix = this.threadPrefix
		switch (mode) {
			case 'daily': {
				const today = new Date().toISOString().slice(0, 10)
				return `${prefix}${today}`
			}
			case 'persistent':
				return `${prefix}persistent`
			case 'session':
				return `${prefix}${this.uuid}`
			default:
				return `${prefix}${this.uuid}`
		}
	}

	/** The conversationHistory feature instance. */
	get conversationHistory(): ConversationHistory {
		return this.container.feature('conversationHistory') as ConversationHistory
	}

	/** The active thread ID (undefined in lifecycle mode). */
	get currentThreadId(): string | undefined {
		return this.state.get('threadId')
	}

	/**
	 * Override thread for resume. Call before start().
	 *
	 * @param threadId - The thread ID to resume
	 * @returns this, for chaining
	 */
	resumeThread(threadId: string): this {
		this.state.set('resumeThreadId', threadId)
		return this
	}

	/**
	 * List saved conversations for this assistant+project.
	 *
	 * @param opts - Optional limit
	 * @returns Conversation metadata records
	 */
	async listHistory(opts?: { limit?: number }): Promise<ConversationMeta[]> {
		const metas = await this.conversationHistory.findByThreadPrefix(this.threadPrefix)
		if (opts?.limit) return metas.slice(0, opts.limit)
		return metas
	}

	/**
	 * Delete all history for this assistant+project.
	 *
	 * @returns Number of conversations deleted
	 */
	async clearHistory(): Promise<number> {
		return this.conversationHistory.deleteByThreadPrefix(this.threadPrefix)
	}

	/**
	 * Load history into the conversation after it's been created.
	 * Called from start() for non-lifecycle modes.
	 */
	private async loadConversationHistory(): Promise<void> {
		const mode = this.effectiveOptions.historyMode || 'lifecycle'
		if (mode === 'lifecycle') return

		const threadId = (this.state.get('resumeThreadId') as string | undefined) || this.buildThreadId(mode)
		this.state.set('threadId', threadId)

		const existing = await this.conversationHistory.findByThread(threadId)

		if (existing) {
			// Replace conversation messages with loaded history
			const messages = [...existing.messages]

			// Swap in fresh system prompt if it changed
			if (messages.length > 0 && (messages[0]!.role === 'system' || messages[0]!.role === 'developer')) {
				messages[0] = { role: messages[0]!.role, content: this.effectiveSystemPrompt }
			}

			this.conversation.state.set('id', existing.id)
			this.conversation.state.set('thread', threadId)
			this.conversation._setMessages(messages)
			this.state.set('conversationId', existing.id)

			// Restore lastResponseId so the Responses API can continue the chain
			if (existing.metadata?.lastResponseId) {
				this.conversation.state.set('lastResponseId', existing.metadata.lastResponseId)
				this.conversation.state.set(
					'lastResponseMessageCount',
					existing.metadata.lastResponseMessageCount ?? messages.length,
				)
			}
			if (existing.metadata?.lastProviderData) {
				this.conversation.state.set('lastProviderData', existing.metadata.lastProviderData)
			}
			if (existing.tokenUsage) {
				this.conversation.state.set('tokenUsage', {
					prompt: existing.tokenUsage.prompt,
					completion: existing.tokenUsage.completion,
					total: existing.tokenUsage.total,
					cachedTokens: existing.tokenUsage.cachedTokens ?? 0,
					reasoningTokens: existing.tokenUsage.reasoningTokens ?? 0,
				})
			}
			if (existing.cost) this.conversation.state.set('cost', { ...existing.cost })
		} else {
			// Fresh conversation — just set thread
			this.conversation.state.set('thread', threadId)
			this.state.set('conversationId', this.conversation.state.get('id') as string)
		}
	}

	/** Tool names added at runtime via addTool(), so reload() can preserve them. */
	private _runtimeToolNames!: Set<string>

	/**
	 * Materialize the `export const use = [...]` entries loaded from tools.ts.
	 * Safe to call before start(); entries are consumed once while configuredUse
	 * remains available for runtime introspection.
	 */
	resolveConfiguredUse(): this {
		const deferredUse = this.state.get('deferredUse') as any[] | undefined
		if (deferredUse?.length) {
			for (const entry of deferredUse) this.use(entry)
			this.state.set('deferredUse', undefined)
		}
		return this
	}

	/**
	 * Reload tools, hooks, and system prompt from disk. Useful during development
	 * or when tool/hook files have been modified and you want the assistant to
	 * pick up changes without restarting.
	 *
	 * @returns this, for chaining
	 */
	reload(): this {
		// Snapshot runtime-added tools before reloading from disk
		const runtimeTools: Record<string, ConversationTool> = {}
		const runtimeSchemas: Record<string, z.ZodType> = {}
		if (this._runtimeToolNames?.size) {
			const current = this.allTools
			for (const name of this._runtimeToolNames) {
				if (current[name]) runtimeTools[name] = current[name]
				if (this._toolSchemas[name]) runtimeSchemas[name] = this._toolSchemas[name]!
			}
		}

		// Reload system prompt from disk
		this.state.set('systemPrompt', this.loadSystemPrompt())

		// Reload tools from disk (merges with option tools), then restore runtime tools
		const diskTools = this.loadTools()
		this.state.set('tools', { ...diskTools, ...runtimeTools })
		for (const [name, schema] of Object.entries(runtimeSchemas)) this._toolSchemas[name] = schema
		for (const name of Object.keys(runtimeTools)) this._toolSources[name] = 'runtime'

		// Re-process deferred `use` entries (export const use = [...] in tools.ts).
		// These replace tools from the same features, which is a no-op when unchanged.
		this.resolveConfiguredUse()

		this.emit('toolsChanged')

		// Reload hooks from disk — triggerHook reads from state so new hooks are active immediately
		this.state.set('hooks', this.loadHooks())

		this.emit('reloaded')

		return this
	}

	/**
	 * Start the assistant by creating the conversation and wiring up events.
	 * The system prompt, tools, and hooks are already loaded synchronously
	 * during initialization.
	 *
	 * @returns {Promise<this>} The initialized assistant
	 */
	async start(): Promise<this> {
		// Prevent duplicate listener registration if already started
		if (this.isStarted) return this

		// Keep the conversation's tool set in sync with the assistant's. This must
		// be registered BEFORE anything below can add a tool: `use()` entries and
		// pending plugins (mcpBridge materializes its tools there) call addTool(),
		// which emits `toolsChanged`. Usually the conversation doesn't exist yet and
		// its lazy getter picks up the final tool set — but a caller that touched
		// `assistant.conversation` before start() already froze a snapshot of the
		// tools, and without this listener in place those later additions would
		// live on the assistant and never reach the model.
		this.on('toolsChanged', () => {
			const conv = this.state.get('conversation') as Conversation | null
			if (conv) {
				conv.updateTools(this.tools)
			}
		})

		// Process deferred `use` entries from tools.ts (stashed during loadTools
		// because the assistant isn't fully constructed at that point)
		this.resolveConfiguredUse()

		// Allow hooks to run before the assistant starts (blocks until complete)
		await this.triggerHook('beforeStart')

		// Wait for any async .use() plugins to finish before starting
		const pending = this.state.get('pendingPlugins') as Promise<void>[]
		if (pending.length) {
			await Promise.all(pending)
			this.state.set('pendingPlugins', [])
		}

		// Allow hooks.ts to export a formatSystemPrompt(assistant, prompt) => string
		// that transforms the system prompt before the conversation is created.
		const formatted = await this.triggerHook('formatSystemPrompt', this.systemPrompt)
		if (typeof formatted === 'string') {
			this.state.set('systemPrompt', formatted)
		}

		// Wire up event forwarding from conversation to assistant.
		// Each forwarded event triggers its hook (awaited) before emitting on the assistant bus.
		const conversation = this.conversation as any

		conversation.on('turnStart', async (info: any) => {
			await this.triggerHook('turnStart', info)
			this.emit('turnStart', info)
		})
		conversation.on('turnEnd', async (info: any) => {
			await this.triggerHook('turnEnd', info)
			this.emit('turnEnd', info)
		})
		conversation.on('chunk', async (chunk: string) => {
			await this.triggerHook('chunk', chunk)
			this.emit('chunk', chunk)
		})
		conversation.on('preview', async (text: string) => {
			await this.triggerHook('preview', text)
			this.emit('preview', text)
		})
		conversation.on('response', async (text: string) => {
			await this.triggerHook('response', text)
			this.emit('response', text)
			this.state.set('lastResponse', text)
		})
		conversation.on('rawEvent', async (event: any) => {
			await this.triggerHook('rawEvent', event)
			this.emit('rawEvent', event)
		})
		conversation.on('mcpEvent', async (event: any) => {
			await this.triggerHook('mcpEvent', event)
			this.emit('mcpEvent', event)
		})
		conversation.on('toolCall', async (name: string, args: any) => {
			await this.triggerHook('toolCall', name, args)
			this.emit('toolCall', name, args)
		})
		conversation.on('toolResult', async (name: string, result: any) => {
			await this.triggerHook('toolResult', name, result)
			this.emit('toolResult', name, result)
		})
		conversation.on('toolError', async (name: string, error: any) => {
			await this.triggerHook('toolError', name, error)
			this.emit('toolError', name, error)
		})

		// Install interceptor-aware tool executor on the conversation
		this.conversation.toolExecutor = async (name: string, args: Record<string, any>, handler: (...a: any[]) => Promise<any>) => {
			const ctx = { name, args, result: undefined as string | undefined, error: undefined, skip: false }

			// Hook runs first (awaited), then interceptor chain
			await this.triggerHook('beforeToolCall', ctx)
			await this.interceptors.beforeToolCall.run(ctx, async () => {})

			if (ctx.skip) {
				const result = ctx.result ?? JSON.stringify({ skipped: true })
				await this.triggerHook('toolResult', ctx.name, result)
				this.emit('toolResult', ctx.name, result)
				return result
			}

			try {
				await this.triggerHook('toolCall', ctx.name, ctx.args)
				this.emit('toolCall', ctx.name, ctx.args)
				const output = await handler(ctx.args)
				ctx.result = typeof output === 'string' ? output : JSON.stringify(output)
			} catch (err: any) {
				ctx.error = err
				ctx.result = JSON.stringify({ error: err.message || String(err) })
			}

			// Hook runs first (awaited), then interceptor chain
			await this.triggerHook('afterToolCall', ctx)
			await this.interceptors.afterToolCall.run(ctx, async () => {})

			if (ctx.error && !ctx.result?.includes('"error"')) {
				await this.triggerHook('toolError', ctx.name, ctx.error)
				this.emit('toolError', ctx.name, ctx.error)
			} else {
				await this.triggerHook('toolResult', ctx.name, ctx.result!)
				this.emit('toolResult', ctx.name, ctx.result!)
			}

			return ctx.result!
		}

		// Load conversation history for non-lifecycle modes
		await this.loadConversationHistory()

		// Enable autoCompact for modes that accumulate history
		const mode = this.effectiveOptions.historyMode || 'lifecycle'
		if (mode === 'daily' || mode === 'persistent') {
			(this.conversation.options as any).autoCompact = true
		}

		this.state.set('started', true)
		await this.triggerHook('started')
		this.emit('started')

		// afterStart blocks until complete — use for setup that needs the full assistant ready
		await this.triggerHook('afterStart')

		return this
	}

	/**
	 * Resolved vision delegation config, or undefined when visionSupport is not enabled.
	 * Merges the option (constructor or CORE.md frontmatter) with env-var defaults:
	 * LUCA_VISION_SUPPORT_MODEL, LUCA_VISION_SUPPORT_URL, LUCA_VISION_SUPPORT_API_KEY,
	 * falling back to OPENAI_BASE_URL / OPENAI_API_KEY and the 'gpt-5.2' model.
	 */
	get visionSupport(): VisionSupportConfig | undefined {
		const raw = this.effectiveOptions.visionSupport
		if (!raw) return undefined
		const opts = raw === true ? {} : raw as Partial<VisionSupportConfig>
		const envConcurrency = Number(process.env.LUCA_VISION_SUPPORT_CONCURRENCY)
		return {
			prompt: opts.prompt || Assistant.defaultVisionPrompt,
			batchPrompt: opts.batchPrompt || Assistant.defaultBatchVisionPrompt,
			model: opts.model || process.env.LUCA_VISION_SUPPORT_MODEL || 'gpt-5.2',
			url: opts.url || process.env.LUCA_VISION_SUPPORT_URL || process.env.OPENAI_BASE_URL,
			apiKey: opts.apiKey || process.env.LUCA_VISION_SUPPORT_API_KEY || process.env.OPENAI_API_KEY,
			batch: opts.batch ?? false,
			// Guard against a bad env value silently serializing every call
			concurrency: opts.concurrency ?? (Number.isFinite(envConcurrency) && envConcurrency > 0 ? envConcurrency : 4),
		}
	}

	/** The default instruction sent to the vision model alongside each delegated image. */
	static readonly defaultVisionPrompt = [
		'You are the eyes for a text-only AI assistant. Describe this image in comprehensive detail',
		'so the assistant can reason about it without seeing it.',
		'Transcribe ALL visible text, code, numbers, and labels exactly as written.',
		'Describe the layout and spatial relationships, objects, people, colors, and setting.',
		'For charts, diagrams, or UI screenshots, explain their structure and the data or state they convey.',
		'Note anything unusual, ambiguous, or potentially important. Be thorough but organized — do not speculate beyond what is visible.',
	].join(' ')

	/** The default instruction used when batch mode sends every image in a single call. */
	static readonly defaultBatchVisionPrompt = [
		'You are the eyes for a text-only AI assistant. The following images are ONE ordered sequence —',
		'they may be video frames, a before/after pair, or steps in a flow. Describe them together, not in isolation.',
		'First give a short account of the sequence as a whole: what it depicts and what changes across it.',
		'Then, for each image in order, label it "Image N:" and describe its contents,',
		'transcribing ALL visible text, code, numbers, and labels exactly as written.',
		'Call out explicitly what moved, appeared, disappeared, or changed value between consecutive images,',
		'and note anything unusual or ambiguous. Be thorough but organized — do not speculate beyond what is visible.',
	].join(' ')

	/**
	 * Replace image parts in a content array with text descriptions produced by the
	 * configured vision model. Used by ask() when visionSupport is enabled; also
	 * callable directly, and `overrides` lets a single call opt into batch mode
	 * without reconfiguring the assistant.
	 *
	 * Two modes:
	 * - default: one vision call per image, run `concurrency` at a time. Each image is
	 *   described in isolation, so the model cannot compare them.
	 * - batch: ONE call containing every image, described as an ordered sequence. Use this
	 *   for video frames or before/after pairs — it is the only mode that can report what
	 *   changed between images. All image parts collapse into a single text part where the
	 *   first image was, so the returned array is shorter than the input.
	 *
	 * @param parts - Content parts possibly containing image_url entries
	 * @param overrides - Per-call overrides for batch, prompt, batchPrompt, concurrency
	 * @returns The parts with images replaced by descriptive text parts
	 *
	 * @example
	 * ```typescript
	 * // Describe video frames as one sequence, so motion survives the hand-off
	 * const described = await assistant.describeImages(frames, { batch: true })
	 * ```
	 */
	async describeImages(
		parts: ContentPart[],
		overrides?: Partial<Pick<VisionSupportConfig, 'batch' | 'prompt' | 'batchPrompt' | 'concurrency'>>,
	): Promise<ContentPart[]> {
		const resolved = this.visionSupport
		if (!resolved) return parts
		const config = { ...resolved, ...overrides }

		const imageIndexes = parts
			.map((part, index) => (part.type === 'image_url' ? index : -1))
			.filter(index => index !== -1)
		if (!imageIndexes.length) return parts

		const client = (this.container as any).client('openai', {
			defaultModel: config.model,
			...(config.url ? { baseURL: config.url } : {}),
			...(config.apiKey ? { apiKey: config.apiKey } : {}),
		}) as import('../../clients/openai').OpenAIClient

		const images = imageIndexes.map(index => parts[index] as Extract<ContentPart, { type: 'image_url' }>)

		const describe = async (prompt: string, batchOf: typeof images) => {
			const response = await client.createChatCompletion([
				{ role: 'user', content: [{ type: 'text', text: prompt }, ...batchOf] },
			], { model: config.model })
			return response.choices[0]?.message?.content || ''
		}

		const announce = async (payload: { index: number; description: string; model: string; batch?: boolean; count?: number }) => {
			await this.triggerHook('visionDescription', payload)
			this.emit('visionDescription', payload)
		}

		// Batch mode: every image in one call so the model can see change across them.
		// A lone image gets the single-image prompt — the sequence framing would only mislead.
		if (config.batch && images.length > 1) {
			let description: string
			try {
				description = await describe(config.batchPrompt, images)
				await announce({ index: 0, description, model: config.model, batch: true, count: images.length })
			} catch (err: any) {
				description = `(The images could not be analyzed: ${err?.message || err})`
			}

			const collapsed = `[${images.length} images — described together as one sequence by a vision model on the user's behalf]\n${description || '(no description produced)'}`
			const firstImage = imageIndexes[0]
			return parts.flatMap((part, index) => {
				if (part.type !== 'image_url') return [part]
				return index === firstImage ? [{ type: 'text' as const, text: collapsed }] : []
			})
		}

		// Per-image mode: describe in windows of `concurrency` so a 50-frame ask
		// doesn't open 50 sockets at once.
		const descriptions: string[] = []
		const window = Math.max(1, Math.floor(config.concurrency))
		for (let offset = 0; offset < images.length; offset += window) {
			const slice = images.slice(offset, offset + window)
			const settled = await Promise.all(slice.map(async (part, sliceIndex) => {
				const imageNumber = offset + sliceIndex
				try {
					const description = await describe(config.prompt, [part])
					await announce({ index: imageNumber, description, model: config.model })
					return description
				} catch (err: any) {
					return `(The image could not be analyzed: ${err?.message || err})`
				}
			}))
			descriptions.push(...settled)
		}

		return parts.map((part, index) => {
			if (part.type !== 'image_url') return part
			const imageNumber = imageIndexes.indexOf(index)
			const description = descriptions[imageNumber] || '(no description produced)'
			return {
				type: 'text' as const,
				text: `[Image ${imageNumber + 1} of ${imageIndexes.length} — described by a vision model on the user's behalf]\n${description}`,
			}
		})
	}

	/**
	 * Ask the assistant a question. It will use its tools to produce
	 * a streamed response. The assistant auto-starts if needed.
	 *
	 * @param {string | ContentPart[]} question - The question to ask
	 * @returns {Promise<string>} The assistant's response
	 *
	 * @example
	 * ```typescript
	 * const answer = await assistant.ask('What capabilities do you have?')
	 * ```
	 */
	async ask(question: string | ContentPart[], options?: AskOptions): Promise<string> {
		if (!this.isStarted) {
			await this.start()
		}

		if (!this.conversation) {
			return 'Assistant is not started'
		}

		const count = (this.state.get('conversationCount') || 0) + 1
		this.state.set('conversationCount', count)

		if (this.effectiveOptions.injectTimestamps) {
			question = this.prependTimestamp(question)
		}

		// Trigger beforeInitialAsk only on the first ask() call
		if (count === 1) {
			await this.triggerHook('beforeInitialAsk', question, options)
		}

		// Trigger beforeAsk hook on every ask() call — can modify question via return value
		const hookResult = await this.triggerHook('beforeAsk', question, options)
		if (typeof hookResult === 'string') {
			question = hookResult
		}

		// Run beforeAsk interceptors — they can rewrite the question or short-circuit
		if (this.interceptors.beforeAsk.hasInterceptors) {
			const ctx = { question, options } as InterceptorPoints['beforeAsk']
			await this.interceptors.beforeAsk.run(ctx, async () => {})
			if (ctx.result !== undefined) return ctx.result
			question = ctx.question
			options = ctx.options
		}

		// Vision delegation: when the assistant's model has no vision, describe
		// image parts via the configured vision model and substitute the text.
		if (Array.isArray(question) && this.visionSupport) {
			question = await this.describeImages(question)
		}

		let result = await this.conversation.ask(question, options)

		// Run beforeResponse interceptors — they can rewrite the final text
		if (this.interceptors.beforeResponse.hasInterceptors) {
			const ctx = { text: result }
			await this.interceptors.beforeResponse.run(ctx, async () => {})
			result = ctx.text
		}

		// Auto-save for non-lifecycle modes
		if (this.effectiveOptions.historyMode !== 'lifecycle' && this.state.get('threadId')) {
			await this.conversation.save({ thread: this.state.get('threadId') })
		}

		await this.triggerHook('answered', result)
		this.emit('answered', result)

		return result
	}

	/**
	 * Save the conversation to disk via conversationHistory.
	 *
	 * @param opts - Optional overrides for title, tags, thread, or metadata
	 * @returns The saved conversation record
	 */
	async save(opts?: { title?: string; tags?: string[]; thread?: string; metadata?: Record<string, any> }) {
		if (!this.conversation) {
			throw new Error('Cannot save: assistant has no active conversation')
		}

		return this.conversation.save(opts)
	}

	// -- Fork & Research API --

	/**
	 * Fork the assistant into a new independent instance. The fork gets its own
	 * conversation (with configurable history truncation) but preserves the
	 * assistant's full identity: interceptors, tools, hooks, system prompt extensions.
	 *
	 * @param options - Fork options including history truncation and conversation overrides
	 *   - `history: 'full'` (default) — deep copy all messages
	 *   - `history: 'none'` — system prompt only
	 *   - `history: number` — keep last N exchanges + system prompt
	 *   - Plus any conversation creation overrides (model, maxTokens, temperature, etc.)
	 *
	 * When called with an array, creates multiple independent forks.
	 *
	 * @example
	 * ```typescript
	 * // Single fork with no history, cheap model
	 * const fork = await assistant.fork({ history: 'none', model: 'gpt-4o-mini' })
	 * const answer = await fork.ask('Quick factual question')
	 *
	 * // Multiple forks
	 * const [a, b] = await assistant.fork([
	 *   { history: 'none' },
	 *   { history: 3 },
	 * ])
	 * ```
	 */
	async fork(options?: AssistantForkOptions): Promise<Assistant>
	async fork(options?: AssistantForkOptions[]): Promise<Assistant[]>
	async fork(options: AssistantForkOptions | AssistantForkOptions[] = {}): Promise<Assistant | Assistant[]> {
		if (Array.isArray(options)) {
			return Promise.all(options.map(o => this.fork(o)))
		}

		if (!this.isStarted) {
			await this.start()
		}

		// Separate assistant-level options from conversation-level options
		const { history: historyMode, forbidTools, allowTools, toolNames, onFork, ...convOverrides } = options

		// Fork the conversation with history truncation
		const forkedConv = (this.conversation as any).fork({ history: historyMode ?? 'full', ...convOverrides })

		// Create a new assistant that reuses the forked conversation
		const forkedAssistant = this.container.feature('assistant', {
			...this.options,
			// Pass through conversation overrides that map to assistant options
			...(convOverrides.model ? { model: convOverrides.model } : {}),
			...(convOverrides.maxTokens ? { maxTokens: convOverrides.maxTokens } : {}),
			...(convOverrides.temperature != null ? { temperature: convOverrides.temperature } : {}),
			...(convOverrides.topP != null ? { topP: convOverrides.topP } : {}),
			...(convOverrides.topK != null ? { topK: convOverrides.topK } : {}),
			...(convOverrides.frequencyPenalty != null ? { frequencyPenalty: convOverrides.frequencyPenalty } : {}),
			...(convOverrides.presencePenalty != null ? { presencePenalty: convOverrides.presencePenalty } : {}),
			...(convOverrides.stop ? { stop: convOverrides.stop } : {}),
			// Pass through tool filtering options
			...(forbidTools ? { forbidTools } : {}),
			...(allowTools ? { allowTools } : {}),
			...(toolNames ? { toolNames } : {}),
		}) as Assistant
		// Preserve runtime-added tools as part of the assistant identity. The new
		// assistant was constructed from disk/options and would otherwise know only
		// its statically declared tools.
		forkedAssistant.state.set('tools', { ...this.allTools })

		// Inject the forked conversation directly, bypassing the lazy getter
		forkedAssistant.state.set('conversation', forkedConv)
		// The conversation was forked before assistant-level filters were applied.
		// Synchronize the filtered map so native transports cannot offer excluded tools.
		forkedConv.state.set('tools', { ...forkedAssistant.tools })
		if (forkedConv.options.provider) {
			const providerOptions = { ...(forkedConv.options.providerOptions ?? {}) }
			if (forkedAssistant.providerToolFilters) providerOptions.assistantToolFilters = forkedAssistant.providerToolFilters
			;(forkedConv.options as any).providerOptions = providerOptions
		}

		// Track fork depth so forks know they are forks
		forkedAssistant.state.set('forkDepth', this.forkDepth + 1)

		// Clone interceptors so the fork behaves like the original
		forkedAssistant.interceptors.beforeAsk = this.interceptors.beforeAsk.clone()
		forkedAssistant.interceptors.beforeTurn = this.interceptors.beforeTurn.clone()
		forkedAssistant.interceptors.beforeToolCall = this.interceptors.beforeToolCall.clone()
		forkedAssistant.interceptors.afterToolCall = this.interceptors.afterToolCall.clone()
		forkedAssistant.interceptors.beforeResponse = this.interceptors.beforeResponse.clone()

		// Copy system prompt extensions
		forkedAssistant.state.set('systemPromptExtensions', { ...this.systemPromptExtensions })

		// Start wires up event forwarding and the interceptor-aware tool executor
		await forkedAssistant.start()

		// Call the onFork hook if provided — lets callers customize the fork before use
		if (onFork) {
			await onFork(forkedAssistant, this)
		}

		return forkedAssistant
	}

	/** Active and completed research jobs, keyed by job entity ID. */
	readonly researchJobs = new Map<string, ResearchJob>()

	/**
	 * Create a non-blocking research job that fans out questions across forked assistants.
	 * The forks fire immediately and the returned entity tracks progress via observable
	 * state and events. Each fork preserves the full assistant identity (interceptors,
	 * tools, hooks).
	 *
	 * @param prompt - Shared context/framing prompt prepended to each fork's system prompt
	 * @param questions - Array of questions (strings) or objects with question + per-fork overrides
	 * @param defaults - Default fork options applied to all forks
	 * @returns A research job entity with observable state and events
	 *
	 * @example
	 * ```typescript
	 * // Fire and forget — check later
	 * const job = await assistant.createResearchJob(
	 *   "Analyze this codebase for security issues",
	 *   ["Look for SQL injection", "Look for XSS", "Look for auth bypass"],
	 *   { history: 'none', model: 'gpt-4o-mini' }
	 * )
	 *
	 * // Check progress
	 * job.state.get('completed') // 2 of 3
	 * job.state.get('results')   // [answer1, answer2, null]
	 *
	 * // React to events
	 * job.on('forkCompleted', (index, result) => console.log(`Fork ${index} done`))
	 *
	 * // Or just wait
	 * await job.waitFor('completed')
	 * ```
	 */
	async createResearchJob(
		prompt: string,
		questions: (string | { question: string; forkOptions?: AssistantForkOptions })[],
		defaults: AssistantForkOptions = {}
	): Promise<ResearchJob> {
		if (!this.isStarted) {
			await this.start()
		}

		const jobId = `research:${this.container.utils.uuid()}`
		const total = questions.length

		const job = this.container.entity<ResearchJobState, ResearchJobOptions, ResearchJobEvents>(
			jobId,
			{ prompt, questions: questions.map(q => typeof q === 'string' ? q : q.question), forkOptions: defaults },
		) as ResearchJob

		job.setState({
			status: 'running',
			prompt,
			questions: questions.map(q => typeof q === 'string' ? q : q.question),
			results: new Array(total).fill(null),
			errors: new Array(total).fill(null),
			completed: 0,
			total,
		})

		this.researchJobs.set(jobId, job)

		// Build fork configs and create forks
		const forkConfigs = questions.map(q => ({
			...defaults,
			...(typeof q === 'string' ? {} : q.forkOptions),
		}))

		const forks = await this.fork(forkConfigs)

		// Apply shared prompt as a system prompt extension on each fork
		if (prompt) {
			for (const fork of forks) {
				fork.addSystemPromptExtension('researchPrompt', prompt)
			}
		}

		// Fire all forks — don't await the batch, let them resolve individually
		for (let i = 0; i < forks.length; i++) {
			const fork = forks[i]!
			const q = questions[i]!
			const question = typeof q === 'string' ? q : q.question

			fork.ask(question).then(
				(result) => {
					const results = [...job.state.get('results')!]
					results[i] = result
					const completed = job.state.get('completed')! + 1

					job.setState({ results, completed })
					job.emit('forkCompleted', i, result)

					if (completed === total) {
						job.setState({ status: 'completed' })
						job.emit('completed', results as string[])
					}
				},
				(err) => {
					const errors = [...job.state.get('errors')!]
					errors[i] = err?.message || String(err)
					const completed = job.state.get('completed')! + 1

					job.setState({ errors, completed })
					job.emit('forkError', i, errors[i]!)

					if (completed === total) {
						const results = job.state.get('results')!
						const hasAnyResult = results.some(r => r !== null)
						job.setState({ status: hasAnyResult ? 'completed' : 'failed' })

						if (hasAnyResult) {
							job.emit('completed', results as string[])
						} else {
							job.emit('failed', errors)
						}
					}
				}
			)
		}

		return job
	}

	/**
	 * Fan out N questions in parallel using forked assistants, return the results.
	 * Sugar over createResearchJob — blocks until all forks complete.
	 *
	 * @param questions - Array of questions (strings) or objects with question + per-fork overrides
	 * @param defaults - Default fork options applied to all forks
	 * @returns Array of response strings, one per question
	 *
	 * @example
	 * ```typescript
	 * const results = await assistant.research([
	 *   "What are best practices for X?",
	 *   "What are common pitfalls of X?",
	 * ], { history: 'none', model: 'gpt-4o-mini' })
	 * ```
	 */
	async research(
		questions: (string | { question: string; forkOptions?: AssistantForkOptions })[],
		defaults: AssistantForkOptions & { prompt?: string } = {}
	): Promise<(string | null)[]> {
		const { prompt = '', ...forkDefaults } = defaults
		const job = await this.createResearchJob(prompt, questions, forkDefaults)
		await job.waitFor('completed')
		return job.state.get('results')!
	}

	// -- Subagent API --

	/**
	 * Names of assistants available as subagents, discovered via the assistantsManager.
	 *
	 * @returns {string[]} Available assistant names
	 */
	get availableSubagents(): string[] {
		try {
			const manager = this.container.feature('assistantsManager')
			return manager.available
		} catch {
			return []
		}
	}

	/**
	 * Get or create a subagent assistant. Uses the assistantsManager to discover
	 * and create the assistant, then caches the instance for reuse across tool calls.
	 *
	 * @param id - The assistant name (e.g. 'codingAssistant')
	 * @param options - Additional options to pass to the assistant constructor
	 * @returns {Promise<Assistant>} The subagent assistant instance, started and ready
	 *
	 * @example
	 * ```typescript
	 * const researcher = await assistant.subagent('codingAssistant')
	 * const answer = await researcher.ask('Find all usages of container.feature("fs")')
	 * ```
	 */
	async subagent(id: string, options: Record<string, any> = {}): Promise<Assistant> {
		const subagents = (this.state.get('subagents') || {}) as Record<string, Assistant>
		if (subagents[id]) return subagents[id]

		const manager = this.container.feature('assistantsManager')

		if (!manager.state.get('discovered')) {
			await manager.discover()
		}

		const instance = manager.create(id, options)
		await instance.start()

		this.state.set('subagents', { ...subagents, [id]: instance })
		return instance
	}
}

export default Assistant
