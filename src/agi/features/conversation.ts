import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from '../../schemas/base.js'
import { type AvailableFeatures } from 'luca/feature'
import { Feature } from '../feature.js'
import type { OpenAIClient } from '../../clients/openai';
import type OpenAI from 'openai';
import type { ConversationHistory } from './conversation-history';
import { countMessageTokens, getContextWindow, calculateCost } from '../lib/token-counter.js';
import { toResponsesUserMessage, messagesToResponsesInput, OpenAIChatCompletionsTransport, OpenAIResponsesTransport, type ModelTool, type ModelToolCall, type ResolvedModelProvider } from './model-providers';

declare module 'luca/feature' {
	interface AvailableFeatures {
		conversation: typeof Conversation
	}
}

export type Message = OpenAI.Chat.Completions.ChatCompletionMessageParam

export type ContentPart =
	| { type: 'text'; text: string }
	| { type: 'image_url'; image_url: { url: string; detail?: 'low' | 'high' | 'auto' } }
	| { type: 'input_audio'; data: string; format: 'mp3' | 'wav' }
	| { type: 'input_file'; file_data: string; filename: string }

export interface ConversationTool {
	handler: (...args: any[]) => Promise<any>
	description: string
	parameters: Record<string, any>
}

export interface ConversationMCPServer {
	url: string
	headers?: Record<string, string>
	allowedTools?: string[] | { tool_names?: string[] }
	requireApproval?: 'always' | 'never' | {
		always?: { tool_names?: string[] }
		never?: { tool_names?: string[] }
	}
}

const INPUT_TOKEN_SIZES: Record<string, number> = {
	tiny: 8_000,
	small: 16_000,
	medium: 32_000,
	large: 64_000,
	xlarge: 256_000,
}

function resolveMaxInputTokens(value: number | string | undefined): number | undefined {
	if (value == null) return undefined
	if (typeof value === 'number') return value
	return INPUT_TOKEN_SIZES[value]
}

export const ConversationOptionsSchema = FeatureOptionsSchema.extend({
	/** A unique identifier for the conversation */
	id: z.string().optional().describe('A unique identifier for the conversation'),
	/** A human-readable title for the conversation */
	title: z.string().optional().describe('A human-readable title for the conversation'),
	/** A unique identifier for threads, an arbitrary grouping mechanism */
	thread: z.string().optional().describe('A unique identifier for threads, an arbitrary grouping mechanism'),
	/** Any available OpenAI model */
	model: z.string().optional().describe('Any available OpenAI model'),
	/** Initial message history to seed the conversation */
	history: z.array(z.any()).optional().describe('Initial message history to seed the conversation'),
	/** Tools the model can call during conversation */
	tools: z.record(z.string(), z.any()).optional().describe('Tools the model can call during conversation'),
	/** Remote MCP servers to expose as tools when using the OpenAI Responses API */
	mcpServers: z.record(z.string(), z.any()).optional().describe('Remote MCP servers keyed by server label'),
	/** Which OpenAI API to use for completions */
	api: z.enum(['auto', 'responses', 'chat']).optional().describe('Completion API mode. auto uses the Responses API; set to "chat" for OpenAI-compatible chat-completions endpoints (LM Studio, Ollama, vLLM, etc.)'),

	/** Model provider preset id or inline provider config, resolved through the modelProviders feature. Omit for the default OpenAI-compatible behavior. Set to 'codex' or 'claude-code' to route turns through those backends. */
	provider: z.any().optional().describe("Model provider preset id (e.g. 'codex', 'claude-code') or inline provider config. Omit for default OpenAI-compatible behavior"),
	/** Provider-specific transport options (e.g. cwd, askOptions, assistant for claude-session). */
	providerOptions: z.record(z.string(), z.any()).optional().describe('Provider-specific transport options passed to the resolved provider'),
	/** Maximum provider/tool turns before the generic (non-OpenAI) transport loop aborts. */
	maxTurns: z.number().optional().describe('Maximum provider/tool turns for non-OpenAI providers (default 8)'),
	/** Hard ceiling on native (Responses/Chat Completions) tool-calling turns per ask(). Default 75 — chosen from observed real-world depth (p99 was 24, deepest legitimate run 50). When the model still wants tools at the ceiling, the turn fails with ToolLoopLimitError instead of spinning. */
	maxToolTurns: z.number().optional().describe('Hard ceiling on native tool-calling turns per ask() (default 75). Hitting it fails the turn with ToolLoopLimitError'),
	/** Tags for categorizing and searching this conversation */
	tags: z.array(z.string()).optional().describe('Tags for categorizing and searching this conversation'),
	/** Arbitrary metadata to attach to this conversation */
	metadata: z.record(z.string(), z.any()).optional().describe('Arbitrary metadata to attach to this conversation'),

	clientOptions: z.record(z.string(), z.any()).optional().describe('Options for the OpenAI client (e.g. baseURL, apiKey). Point baseURL at any OpenAI-compatible server — local or remote — to override the default connection.'), // the type of options for OpenAI client

	/** Maximum number of output tokens per completion */
	maxTokens: z.number().optional().describe('Maximum number of output tokens per completion (default 512)'),

	/** Sampling temperature (0-2). Higher = more random, lower = more deterministic. */
	temperature: z.number().min(0).max(2).optional().describe('Sampling temperature (0-2). Higher = more random, lower = more deterministic'),
	/** Nucleus sampling: only consider tokens with top_p cumulative probability (0-1). */
	topP: z.number().min(0).max(1).optional().describe('Nucleus sampling cutoff (0-1). Lower = more focused'),
	/** Top-K sampling: only consider the K most likely tokens. Not supported by OpenAI — used with local/Anthropic models. */
	topK: z.number().optional().describe('Top-K sampling. Only supported by local/Anthropic models'),
	/** Penalizes tokens based on how often they already appeared (-2 to 2). */
	frequencyPenalty: z.number().min(-2).max(2).optional().describe('Frequency penalty (-2 to 2). Positive = discourage repetition'),
	/** Penalizes tokens based on whether they appeared at all (-2 to 2). */
	presencePenalty: z.number().min(-2).max(2).optional().describe('Presence penalty (-2 to 2). Positive = encourage new topics'),
	/** Stop sequences — model stops generating when it encounters any of these strings. */
	stop: z.array(z.string()).optional().describe('Stop sequences — generation halts when any of these strings is produced'),
	/** Extra keys merged verbatim into the chat-completions request body — for server-specific params the schema doesn't model, e.g. llama-server/vLLM's chat_template_kwargs. Chat API only; ignored by the Responses API and CLI transports. */
	extraBody: z.record(z.string(), z.any()).optional().describe("Extra keys merged verbatim into the chat-completions request body (e.g. { chat_template_kwargs: { enable_thinking: false } } for llama-server/vLLM). Chat API only"),

	/** Enable automatic compaction when estimated input tokens approach the context limit */
	autoCompact: z.boolean().optional().describe('Enable automatic compaction when input tokens approach the context limit'),
	/** Fraction of contextWindow at which auto-compact triggers (0.0–1.0, default 0.8) */
	compactThreshold: z.number().min(0).max(1).optional().describe('Fraction of context window at which auto-compact triggers (default 0.8)'),
	/** Override the inferred context window size for this model */
	contextWindow: z.number().optional().describe('Override the inferred context window size for this model'),
	/** Number of recent messages to preserve after compaction (default 4) */
	compactKeepRecent: z.number().optional().describe('Number of recent messages to preserve after compaction (default 4)'),

	/** Maximum input tokens to send to the API. When set, older messages are trimmed to stay within this budget, keeping the system prompt and most recent messages. Useful for avoiding long-context pricing tiers. Accepts a number or a named size: tiny (8k), small (16k), medium (32k), large (64k), xlarge (256k — max before long-context pricing). */
	maxInputTokens: z.union([
		z.number(),
		z.enum(['tiny', 'small', 'medium', 'large', 'xlarge']),
	]).default('large').describe('Maximum input tokens. Accepts a number or a named size: tiny (8k), small (16k), medium (32k), large (64k), xlarge (256k). Defaults to large (64k)'),
})

export const ConversationStateSchema = FeatureStateSchema.extend({
	id: z.string().describe('Unique identifier for this conversation instance'),
	thread: z.string().describe('Thread identifier for grouping conversations'),
	model: z.string().describe('The OpenAI model being used'),
	messages: z.array(z.any()).describe('Full message history of the conversation'),
	streaming: z.boolean().describe('Whether a streaming response is currently in progress'),
	lastResponse: z.string().describe('The last assistant response text'),
	toolCalls: z.number().describe('Total number of tool calls made in this conversation'),
	api: z.enum(['responses', 'chat']).describe('Which completion API is active for this conversation'),
	lastResponseId: z.string().nullable().describe('Most recent OpenAI Responses API response ID for continuing conversation state'),
	lastResponseMessageCount: z.number().nullable().describe('Local message count represented by lastResponseId, used to detect stale continuation chains'),
	lastProviderData: z.any().optional().describe('Provider-specific continuation data from the most recent response (e.g. codex/claude-session ids for resume)'),
	tokenUsage: z.object({
		prompt: z.number().describe('Total prompt tokens consumed'),
		completion: z.number().describe('Total completion tokens consumed'),
		total: z.number().describe('Total tokens consumed'),
		cachedTokens: z.number().describe('Input tokens served from cache (billed at reduced rate)'),
		reasoningTokens: z.number().describe('Output tokens used for reasoning (o-series models)'),
	}).describe('Cumulative token usage statistics including detail breakdowns from the API'),
	cost: z.object({
		inputCost: z.number().describe('Estimated cost in dollars for input tokens'),
		outputCost: z.number().describe('Estimated cost in dollars for output tokens'),
		totalCost: z.number().describe('Estimated total cost in dollars'),
	}).describe('Running cost estimate based on cumulative token usage and model pricing'),
	estimatedInputTokens: z.number().describe('Estimated input token count for the current messages array'),
	compactionCount: z.number().describe('Number of times compact() has been called'),
	contextWindow: z.number().describe('The context window size for the current model'),
	tools: z.record(z.string(), z.any()).describe('Active tools map including any runtime overrides'),
	callMaxTokens: z.number().nullable().describe('Per-call max tokens override, cleared after each ask()'),
	messagesVersion: z.number().describe('Increments on every change to the message list — lets observers detect out-of-band edits (clear, replace, compact) without diffing the array'),
	failedTurn: z.object({
		id: z.string().describe('Retry identity for this failure — pass it to retryFailedTurn() to retry exactly this turn'),
		userMessageIndex: z.number().describe('Index of the surviving user message that drove the failed turn'),
		error: z.object({
			name: z.string().describe('Error class name, e.g. ToolLoopLimitError'),
			message: z.string().describe('Human-readable error message'),
			status: z.number().optional().describe('HTTP status when the failure came from a provider response'),
		}).describe('What went wrong'),
		at: z.string().describe('ISO timestamp of the failure'),
		retryable: z.boolean().describe('Whether retryFailedTurn() can retry this turn'),
	}).nullable().describe('The most recent failed turn: its retry identity, the surviving input, and the error. Null when the last turn succeeded. The failed turn\'s input stays in history; its partial output is rolled back and never replayed as context'),

	/** Sampling parameters — state is the runtime source of truth, seeded from options at construction. */
	temperature: z.number().nullable().describe('Sampling temperature (0-2). Null means use model default'),
	topP: z.number().nullable().describe('Nucleus sampling cutoff (0-1). Null means use model default'),
	topK: z.number().nullable().describe('Top-K sampling. Null means use model default'),
	frequencyPenalty: z.number().nullable().describe('Frequency penalty (-2 to 2). Null means use model default'),
	presencePenalty: z.number().nullable().describe('Presence penalty (-2 to 2). Null means use model default'),
	stop: z.array(z.string()).nullable().describe('Stop sequences. Null means none'),
	maxTokens: z.number().nullable().describe('Maximum output tokens per completion. Null means use model default'),
	extraBody: z.record(z.string(), z.any()).nullable().describe('Extra keys merged verbatim into the chat-completions request body (e.g. chat_template_kwargs). Null means none'),
})

export class ConversationAbortError extends Error {
	/** The partial text accumulated before the abort. */
	readonly partial: string

	constructor(partial: string) {
		super('Conversation aborted')
		this.name = 'ConversationAbortError'
		this.partial = partial
	}
}

/**
 * Thrown when a native (Responses / Chat Completions) tool loop still wants
 * more tool calls at the configured `maxToolTurns` ceiling. Flows through the
 * failed-turn contract: the turn's partial output is rolled back, the input
 * survives with a retryable failed-turn record, and clients get a displayable
 * terminal error instead of a runaway loop.
 */
export class ToolLoopLimitError extends Error {
	/** The ceiling that was hit. */
	readonly limit: number
	/** Text accumulated across the turn before the ceiling stopped it. */
	readonly partial: string

	constructor(limit: number, partial: string) {
		super(`Tool-call loop stopped at the ${limit}-turn ceiling without a final answer. Raise maxToolTurns on this conversation if the work is legitimate.`)
		this.name = 'ToolLoopLimitError'
		this.limit = limit
		this.partial = partial
	}
}

/** The record kept for the most recent failed turn — see `state.failedTurn`. */
export type FailedTurnRecord = {
	/** Retry identity — pass to `retryFailedTurn()` to retry exactly this turn. */
	id: string
	/** Index of the surviving user message that drove the failed turn. */
	userMessageIndex: number
	error: { name: string; message: string; status?: number }
	/** ISO timestamp of the failure. */
	at: string
	retryable: boolean
}

export const ConversationEventsSchema = FeatureEventsSchema.extend({
	userMessage: z.tuple([z.any().describe('The user message content (string or ContentPart[])')]).describe('Fired when a user message is added to the conversation'),
	aborted: z.tuple([z.string().describe('Partial text accumulated before the abort')]).describe('Fired when the conversation is aborted mid-response'),
	turnStart: z.tuple([z.object({ turn: z.number(), isFollowUp: z.boolean() })]).describe('Fired at the start of each completion turn'),
	turnEnd: z.tuple([z.object({ turn: z.number(), hasToolCalls: z.boolean() })]).describe('Fired at the end of each completion turn'),
	toolCallsStart: z.tuple([z.any().describe('Array of tool call objects from the model')]).describe('Fired when the model begins a batch of tool calls'),
	toolCall: z.tuple([z.string().describe('Tool name'), z.any().describe('Parsed arguments object')]).describe('Fired before invoking a single tool handler'),
	toolResult: z.tuple([z.string().describe('Tool name'), z.string().describe('Serialized result')]).describe('Fired after a tool handler returns successfully'),
	toolError: z.tuple([z.string().describe('Tool name'), z.any().describe('Error object or message')]).describe('Fired when a tool handler throws or the tool is unknown'),
	toolCallsEnd: z.tuple([]).describe('Fired after all tool calls in a turn have been executed'),
	chunk: z.tuple([z.string().describe('Text delta from the stream')]).describe('Fired for each streaming text delta'),
	reasoning: z.tuple([z.string().describe('Reasoning/thinking text delta from the stream')]).describe('Fired for each reasoning delta a thinking model streams before its answer. Never part of the response text or message history. What arrives is provider-shaped: local models stream raw thinking (reasoning_content or inline <think> tags), the OpenAI Responses API streams reasoning summaries only'),
	preview: z.tuple([z.string().describe('Accumulated text so far')]).describe('Fired after each chunk with the full accumulated text'),
	response: z.tuple([z.string().describe('Final accumulated response text')]).describe('Fired when the final text response is produced'),
	responseCompleted: z.tuple([z.any().describe('The completed OpenAI Response object')]).describe('Fired when the Responses API stream completes'),
	rawEvent: z.tuple([z.any().describe('Raw stream event from the API')]).describe('Fired for every raw event from the Responses API stream'),
	mcpEvent: z.tuple([z.any().describe('MCP-related stream event')]).describe('Fired for MCP-related events from the Responses API'),
	summarizeStart: z.tuple([]).describe('Fired before generating a conversation summary'),
	summarizeEnd: z.tuple([z.string().describe('The generated summary text')]).describe('Fired after the summary is generated'),
	compactStart: z.tuple([z.object({ messageCount: z.number(), keepRecent: z.number() })]).describe('Fired before compacting the conversation history'),
	compactEnd: z.tuple([z.object({ summary: z.string(), removedCount: z.number(), estimatedTokens: z.number(), compactionCount: z.number() })]).describe('Fired after compaction completes'),
	autoCompactTriggered: z.tuple([z.object({ estimated: z.number(), limit: z.number(), contextWindow: z.number() })]).describe('Fired when auto-compact kicks in because tokens exceeded the threshold'),
	routingChanged: z.tuple([z.object({
		previous: z.any().describe('The routing in effect before the change'),
		current: z.any().describe('The routing the next turn will use'),
	})]).describe('Fired when setModel() or setProvider() changes which backend or model the next turn uses'),
	messagesCleared: z.tuple([z.object({
		changed: z.number().describe('How many messages were removed'),
		messageCount: z.number().describe('Messages remaining after the clear'),
		continuationInvalidated: z.boolean().describe('Whether a provider continuation handle was dropped'),
		version: z.number().describe('messagesVersion after the clear'),
	})]).describe('Fired after clearMessages() rewrites the message list'),
	turnFailed: z.tuple([z.object({
		id: z.string().describe('Retry identity for the failure'),
		userMessageIndex: z.number().describe('Index of the surviving user message'),
		error: z.object({
			name: z.string(),
			message: z.string(),
			status: z.number().optional(),
		}).describe('What went wrong'),
		at: z.string().describe('ISO timestamp of the failure'),
		retryable: z.boolean(),
	})]).describe('Fired when a turn fails: partial output has been rolled back, the input survives, and the record is retryable via retryFailedTurn()'),
	messageReplaced: z.tuple([z.object({
		index: z.number().describe('Index of the replaced message, or -1 when nothing matched'),
		changed: z.number().describe('1 when a message was rewritten, 0 when the selector matched nothing'),
		messageCount: z.number().describe('Messages in the conversation after the replacement'),
		continuationInvalidated: z.boolean().describe('Whether a provider continuation handle was dropped'),
		version: z.number().describe('messagesVersion after the replacement'),
	})]).describe('Fired after replaceMessage() rewrites one message'),
}).describe('Conversation events')

/** Where the next turn goes: the resolved backend, model, dialect, and turn loop. */
export type ConversationRouting = {
	/** The provider in effect: a registered preset id, an inline provider config, or null for the container default. */
	provider: string | Record<string, any> | null
	/** The model the next turn will request. */
	model: string
	/** The OpenAI dialect in effect. Not meaningful for generic-transport providers. */
	apiMode: 'responses' | 'chat'
	/** Which turn loop runs: the native OpenAI loops, or the provider-agnostic loop used by codex/claude-code. */
	transport: 'openai' | 'generic'
}

/** Options for `Conversation#setProvider` / `Assistant#setProvider`. */
export type SetProviderOptions = {
	/** Model to use on the new provider. Omit to let the provider's own default model take over. */
	model?: string
	/** Provider-specific transport options, replacing any currently configured. */
	providerOptions?: Record<string, any>
}

export type ConversationOptions = z.infer<typeof ConversationOptionsSchema>
export type ConversationState = z.infer<typeof ConversationStateSchema>

/** Options for `Conversation#clearMessages`. */
export type ClearMessagesOptions = {
	/**
	 * Keep the leading system/developer messages — the assistant's identity,
	 * not its transcript. Defaults to true. Pass false to empty the list.
	 */
	keepSystemPrompt?: boolean
}

/** What an explicit message edit (`clearMessages` / `replaceMessage`) did. */
export type MessageEdit = {
	/** How many messages the edit removed or rewrote. 0 means nothing matched. */
	changed: number
	/** Messages in the conversation after the edit. */
	messageCount: number
	/**
	 * Whether a provider continuation handle was actually dropped. False when
	 * the edit could not have invalidated one — either none was held, or the
	 * edited message sits after everything the provider has seen.
	 */
	continuationInvalidated: boolean
	/** `state.messagesVersion` after the edit. */
	version: number
}

/** Picks the message to replace: an index (negative counts from the end) or a predicate. */
export type MessageSelector = number | ((message: Message, index: number) => boolean)

export type AskOptions = {
	maxTokens?: number
	/**
	 * Additional instructions for this call only. They are sent to the model
	 * without being appended to the persisted conversation history.
	 */
	instructions?: string
	/**
	 * When provided, enables OpenAI Structured Outputs. The model is constrained
	 * to return JSON matching this Zod schema. The return value of ask() will be
	 * the parsed object instead of a raw string.
	 */
	schema?: z.ZodType
}

export type ForkOptions = Omit<Partial<ConversationOptions>, 'history'> & {
	/**
	 * Controls how much message history carries over to the fork.
	 * - `'full'` (default) — deep copy all messages
	 * - `'none'` — system prompt only, no chat history
	 * - `number` — keep system prompt + last N user/assistant exchanges
	 */
	history?: 'full' | 'none' | number
}

/**
 * Recursively set `additionalProperties: false` on every object-type node
 * in a JSON Schema tree. OpenAI strict mode requires this at every level.
 * Also ensures every object has a `required` array listing all its property keys.
 */
function strictifySchema(schema: Record<string, any>): Record<string, any> {
	const clone = { ...schema }

	if (clone.type === 'object' && clone.properties) {
		clone.additionalProperties = false
		clone.required = Object.keys(clone.properties)
		const props: Record<string, any> = {}
		for (const [key, val] of Object.entries(clone.properties)) {
			props[key] = strictifySchema(val as Record<string, any>)
		}
		clone.properties = props
	}

	if (clone.items) {
		clone.items = strictifySchema(clone.items)
	}

	// anyOf / oneOf / allOf
	for (const combiner of ['anyOf', 'oneOf', 'allOf'] as const) {
		if (Array.isArray(clone[combiner])) {
			clone[combiner] = clone[combiner].map((s: Record<string, any>) => strictifySchema(s))
		}
	}

	return clone
}

/**
 * A self-contained conversation with OpenAI that supports streaming,
 * tool calling, and message state management.
 *
 * @extends Feature
 *
 * @example
 * ```typescript
 * const conversation = container.feature('conversation', {
 *   model: 'gpt-4.1',
 *   tools: myToolMap,
 *   history: [{ role: 'system', content: 'You are a helpful assistant.' }]
 * })
 * const reply = await conversation.ask('What is the meaning of life?')
 * ```
 */
export class Conversation extends Feature<ConversationState, ConversationOptions> {
	static override stateSchema = ConversationStateSchema
	static override optionsSchema = ConversationOptionsSchema
	static override eventsSchema = ConversationEventsSchema
	static override shortcut = 'features.conversation' as const
	static override stability = 'stable' as const
	static override category = 'ai-assistants' as const

	static { Feature.register(this, 'conversation') }

	/**
	 * Pluggable tool executor. Called for each tool invocation with the tool
	 * name, parsed args, and the default handler. Return the serialized result string.
	 * The Assistant replaces this to wire in beforeToolCall/afterToolCall interceptors.
	 */
	toolExecutor: ((name: string, args: Record<string, any>, handler: (...args: any[]) => Promise<any>) => Promise<string>) | null = null

	/** The active structured output schema for the serialized ask() currently running. */
	private _activeSchema: z.ZodType | null = null

	/** Additional model instructions for the current ask() call only. */
	private _activeInstructions: string | null = null

	/** AbortController for the current ask() call, if any. */
	private _abortController: AbortController | null = null

	/** FIFO tail used to serialize ask() calls against this mutable conversation. */
	private _askQueue: Promise<void> = Promise.resolve()

	/** Registered stubs: matched against user input to short-circuit the API with a canned response. */
	private _stubs: Array<{ matcher: string | RegExp; response: string | (() => string) }> = []

	/** Resolved max tokens: per-call override > state-level. Undefined means no limit (model default). */
	private get maxTokens(): number | undefined {
		return (this.state.get('callMaxTokens') as number | null) ?? (this.state.get('maxTokens') as number | null) ?? undefined
	}

	/** @returns Default state seeded from options: id, thread, model, initial history, and zero token usage. */
	override get initialState(): ConversationState {
		return {
			...super.initialState,
			id: this.options.id || this.uuid,
			thread: this.options.thread || 'default',
			model: this.options.model || this.configuredProviderDefaultModel || 'gpt-5.4-mini',
			messages: this.options.history || [],
			streaming: false,
			lastResponse: '',
			toolCalls: 0,
			api: this.apiMode,
			lastResponseId: null,
			lastResponseMessageCount: null,
			lastProviderData: undefined,
			tokenUsage: { prompt: 0, completion: 0, total: 0, cachedTokens: 0, reasoningTokens: 0 },
			cost: { inputCost: 0, outputCost: 0, totalCost: 0 },
			estimatedInputTokens: 0,
			compactionCount: 0,
			contextWindow: this.options.contextWindow || getContextWindow(this.options.model || 'gpt-5.4-mini'),
			tools: (this.options.tools || {}) as Record<string, ConversationTool>,
			callMaxTokens: null,
			messagesVersion: 0,
			failedTurn: null,
			temperature: this.options.temperature ?? null,
			topP: this.options.topP ?? null,
			topK: this.options.topK ?? null,
			frequencyPenalty: this.options.frequencyPenalty ?? null,
			presencePenalty: this.options.presencePenalty ?? null,
			stop: this.options.stop ?? null,
			maxTokens: this.options.maxTokens ?? null,
			extraBody: this.options.extraBody ?? null,
		}
	}

	/** Returns the registered tools available for the model to call. */
	get tools() : Record<string, ConversationTool> {
		return (this.state.get('tools') || {}) as Record<string, ConversationTool>
	}
	
	get availableTools() {
		return Object.keys(this.tools)
	}

	/**
	 * Add or replace a single tool by name.
	 * Uses the same format as tools passed at construction time.
	 */
	addTool(name: string, tool: ConversationTool): this {
		this.state.set('tools', { ...this.tools, [name]: tool })
		return this
	}

	/**
	 * Remove a tool by name.
	 */
	removeTool(name: string): this {
		const current = { ...this.tools }
		delete current[name]
		this.state.set('tools', current)
		return this
	}

	/**
	 * Merge new tools into the conversation, replacing any with the same name.
	 * Accepts the same Record<string, ConversationTool> format used at construction time.
	 */
	updateTools(tools: Record<string, ConversationTool>): this {
		this.state.set('tools', { ...this.tools, ...tools })
		return this
	}

	/**
	 * Register a hardcoded stub response that bypasses the API when the user's message matches.
	 * Streaming is still simulated — chunk/preview events fire word-by-word.
	 *
	 * @param matcher - Exact string match, substring, or RegExp tested against user input
	 * @param response - The text to stream back, or a zero-arg function that returns it
	 *
	 * @example
	 * conversation.stub('hello', 'Hi there!')
	 * conversation.stub(/weather/i, () => 'Sunny and 72°F.')
	 */
	stub(matcher: string | RegExp, response: string | (() => string)): this {
		this._stubs.push({ matcher, response })
		return this
	}

	/** Returns configured remote MCP servers keyed by server label. */
	get mcpServers(): Record<string, ConversationMCPServer> {
		return (this.options.mcpServers || {}) as Record<string, ConversationMCPServer>
	}

	/** Returns the full message history of the conversation. */
	get messages(): Message[] {
		return this.state.get('messages') || []
	}

	/**
	 * Fork the conversation into a new independent instance.
	 * The fork inherits the same system prompt, tools, and message history,
	 * but has its own identity and state — changes in either direction do not affect the other.
	 *
	 * @param overrides - Option overrides for the forked conversation. Supports a `history` field
	 *   that controls how much context carries over:
	 *   - `'full'` (default) — deep copy all messages
	 *   - `'none'` — system prompt only, no chat history
	 *   - `number` — keep the system prompt plus the last N user/assistant exchanges
	 *
	 * When called with an array, creates multiple independent forks in one call.
	 *
	 * @example
	 * ```typescript
	 * // Full context fork
	 * const fork = conversation.fork()
	 *
	 * // System prompt only — cheapest
	 * const lean = conversation.fork({ history: 'none', model: 'gpt-4o-mini' })
	 *
	 * // Last 3 exchanges + system prompt
	 * const recent = conversation.fork({ history: 3 })
	 *
	 * // Multiple forks at once
	 * const [a, b, c] = conversation.fork([
	 *   { history: 'none' },
	 *   { history: 'none' },
	 *   { history: 5 },
	 * ])
	 * ```
	 */
	fork(overrides?: ForkOptions): Conversation
	fork(overrides?: ForkOptions[]): Conversation[]
	fork(overrides: ForkOptions | ForkOptions[] = {}): Conversation | Conversation[] {
		if (Array.isArray(overrides)) {
			return overrides.map(o => this.fork(o))
		}

		const { history: historyMode = 'full', ...convOverrides } = overrides
		const allMessages = JSON.parse(JSON.stringify(this.messages)) as Message[]

		let history: Message[]
		if (historyMode === 'none') {
			// System prompt only
			const systemMsg = allMessages.find(m => m.role === 'system' || m.role === 'developer')
			history = systemMsg ? [systemMsg] : []
		} else if (historyMode === 'full') {
			history = allMessages
		} else {
			// Keep last N exchanges (user + assistant pairs) plus system prompt
			const systemMsg = allMessages.find(m => m.role === 'system' || m.role === 'developer')
			const nonSystem = allMessages.filter(m => m.role !== 'system' && m.role !== 'developer')

			// Walk backwards counting user messages as exchange boundaries.
			// An exchange starts at a user message and includes everything after it
			// until the next user message (assistant replies, tool calls, etc.).
			let exchangeCount = 0
			let cutoff = 0
			for (let i = nonSystem.length - 1; i >= 0; i--) {
				if (nonSystem[i]!.role === 'user') {
					exchangeCount++
					if (exchangeCount > historyMode) break
					cutoff = i
				}
			}

			const kept = nonSystem.slice(cutoff)
			history = systemMsg ? [systemMsg, ...kept] : kept
		}

		const forked = this.container.feature('conversation', {
			...this.options,
			id: undefined,
			history,
			tools: { ...this.tools },
			...convOverrides,
			// Forks must always be fresh instances — two forks with identical
			// history (e.g. parallel() fan-out) must never share cached state.
			cached: false,
		})

		// Copy stubs so forked conversations match the same patterns
		;(forked as any)._stubs = [...this._stubs]

		return forked
	}

	/**
	 * Fan out N questions in parallel using forked conversations, return the results.
	 * Each fork is independent and ephemeral — no history is saved.
	 *
	 * @param questions - Array of questions (strings) or objects with question + per-fork overrides
	 * @param defaults - Default fork options applied to all forks (individual overrides take precedence)
	 * @returns Array of response strings, one per question
	 *
	 * @example
	 * ```typescript
	 * const results = await conversation.research([
	 *   "What are the pros of approach A?",
	 *   "What are the pros of approach B?",
	 * ], { history: 'none', model: 'gpt-4o-mini' })
	 *
	 * // Per-fork overrides
	 * const results = await conversation.research([
	 *   "Quick factual question",
	 *   { question: "Needs recent context", forkOptions: { history: 5 } },
	 * ], { history: 'none' })
	 * ```
	 */
	async research(
		questions: (string | { question: string; forkOptions?: ForkOptions })[],
		defaults: ForkOptions = {}
	): Promise<string[]> {
		const forkConfigs = questions.map(q => ({
			...defaults,
			...(typeof q === 'string' ? {} : q.forkOptions),
		}))

		const forks = this.fork(forkConfigs)

		return Promise.all(
			forks.map((fork, i) => {
				const q = questions[i]!
				const question = typeof q === 'string' ? q : q.question
				return fork.ask(question)
			})
		)
	}

	/** Returns the OpenAI model name being used for completions. */
	get model(): string {
		return this.state.get('model')!
	}

	/**
	 * Where the next turn will go: the provider, the model, the OpenAI dialect,
	 * and which turn loop runs. Everything here is derived live, so it reflects
	 * any mid-conversation `setModel()` / `setProvider()` call.
	 *
	 * @example
	 * conversation.routing
	 * // => { provider: 'claude-code', model: 'sonnet', apiMode: 'chat', transport: 'generic' }
	 */
	get routing(): ConversationRouting {
		return {
			provider: (this.effectiveProvider as string | Record<string, any> | undefined) ?? null,
			model: this.model,
			apiMode: this.apiMode,
			transport: this.usesGenericTransportLoop ? 'generic' : 'openai',
		}
	}

	/**
	 * Switch the model for every subsequent turn. Safe to call mid-conversation —
	 * history is kept, and the next `ask()` uses the new model.
	 *
	 * Any provider-side continuation handle (an OpenAI Responses `previous_response_id`,
	 * a codex/claude-session id) is dropped, because it encodes the *old* routing.
	 * The full message history lives locally, so the next turn simply re-sends it.
	 *
	 * @param model - The model name to use from here on
	 *
	 * @example
	 * conversation.setModel('gpt-5.4')
	 * await conversation.ask('now try that again with more care')
	 */
	setModel(model: string): this {
		if (!model || typeof model !== 'string') {
			throw new Error('setModel(model) requires a model name, e.g. conversation.setModel("gpt-5.4")')
		}
		return this._applyRouting({ model })
	}

	/**
	 * Switch the backend for every subsequent turn. Safe to call mid-conversation:
	 * history is kept, tools stay registered, and the next `ask()` is routed through
	 * the new provider — including a switch between the native OpenAI loops and the
	 * generic transport loop (codex, claude-code).
	 *
	 * An unregistered provider id throws here rather than at the next `ask()`, and
	 * the previous routing is left intact when it does.
	 *
	 * With no explicit `model`, the new provider's own default model takes over —
	 * a model name from the old provider is rarely valid on the new one.
	 *
	 * @param provider - A registered provider id, an inline provider config, or null to fall back to the container default
	 * @param options - Optional `model` and `providerOptions` to apply along with the switch
	 *
	 * @example
	 * conversation.setProvider('claude-code', { model: 'sonnet' })
	 * conversation.setProvider(null) // back to the container's default provider
	 */
	setProvider(provider: string | Record<string, any> | null, options: SetProviderOptions = {}): this {
		return this._applyRouting({
			provider,
			providerGiven: true,
			model: options.model,
			providerOptions: options.providerOptions,
		})
	}

	/**
	 * Shared implementation behind setModel()/setProvider(): mutate the routing
	 * options, resync the derived state (model, context window, api), and drop
	 * continuation handles that belonged to the previous routing.
	 */
	private _applyRouting(change: {
		provider?: string | Record<string, any> | null
		providerGiven?: boolean
		model?: string
		providerOptions?: Record<string, any>
	}): this {
		const previous = this.routing
		const opts = this.options as Record<string, any>
		const restore = { provider: opts.provider, model: opts.model, providerOptions: opts.providerOptions }

		if (change.providerGiven) {
			opts.provider = change.provider ?? undefined
			// Provider options belong to one backend. Omitting replacements must
			// clear old credentials, permissions, clients, and transport knobs.
			opts.providerOptions = change.providerOptions
			try {
				this.assertConfiguredProviderResolvable()
			} catch (error) {
				Object.assign(opts, restore)
				throw error
			}
			// A model tied to the old provider would be sent to a backend that has
			// never heard of it — clear it so the new provider's default wins unless
			// the caller named one explicitly.
			opts.model = change.model
		} else if (change.model) {
			opts.model = change.model
		}

		const model = change.model
			?? (change.providerGiven ? (this.configuredProviderDefaultModel ?? previous.model) : previous.model)

		this.state.set('model', model)
		this.state.set('contextWindow', this.options.contextWindow || getContextWindow(model))
		this.state.set('api', this.apiMode)
		this.state.set('lastResponseId', null)
		this.state.set('lastResponseMessageCount', null)
		this.state.set('lastProviderData', undefined)

		const current = this.routing
		this.emit('routingChanged', { previous, current })
		return this
	}

	/** Returns the active completion API mode after resolving auto behavior. */
	get apiMode(): 'responses' | 'chat' {
		// An explicitly configured OpenAI-family provider selects the dialect.
		const configured = this.configuredProviderApiMode
		if (configured === 'openai-responses') return 'responses'
		if (configured === 'openai-chat-completions') return 'chat'

		const mode = this.options.api || 'auto'
		if (mode === 'chat' || mode === 'responses') return mode
		// `auto` defaults to the Responses API. OpenAI-compatible endpoints
		// (LM Studio, Ollama, …) only speak chat completions — pass `api: 'chat'`.
		return 'responses'
	}

	/** Cached container-default provider id: undefined = not computed yet, null = none (or the legacy OpenAI path). */
	private _defaultProviderId: string | null | undefined

	/**
	 * The provider this conversation actually uses: the explicitly configured
	 * `provider` option, or — when no explicit connection is configured at all —
	 * the container's default provider from modelProviders (e.g. `local` backed
	 * by llama-server on a machine with no OPENAI_API_KEY).
	 *
	 * An `openai` default returns undefined so those conversations keep the
	 * battle-tested legacy OpenAI path (responses API, native loops). Explicit
	 * `clientOptions` also keep the legacy path — a custom baseURL/apiKey encodes
	 * a deliberate connection choice.
	 */
	private get effectiveProvider(): any {
		if (this.options.provider) return this.options.provider
		if (this.options.clientOptions) return undefined
		if (this._defaultProviderId === undefined) {
			try {
				const id = this.container.feature('modelProviders').resolveDefaultId()
				this._defaultProviderId = id && id !== 'openai' ? id : null
			} catch {
				this._defaultProviderId = null
			}
		}
		return this._defaultProviderId ?? undefined
	}

	/**
	 * The apiMode of the explicitly configured `provider` option, resolved
	 * synchronously through the modelProviders profile registry. Undefined when
	 * no provider is configured (the default OpenAI-compatible behavior).
	 */
	private get configuredProviderApiMode(): string | undefined {
		const provider = this.effectiveProvider
		if (!provider) return undefined
		if (typeof provider === 'string') {
			return this.container.feature('modelProviders').get(provider)?.apiMode
		}
		if (typeof provider === 'object') {
			if (provider.apiMode) return provider.apiMode
			if (provider.preset) return this.container.feature('modelProviders').get(provider.preset)?.apiMode
			// Inline provider objects with a baseURL are OpenAI-compatible by default.
			return 'openai-chat-completions'
		}
		return undefined
	}

	/**
	 * The named provider/preset id this conversation is configured to use, if the
	 * `provider` option references one by name. Inline provider objects (which
	 * carry their own apiMode/baseURL) return undefined — they resolve without a
	 * registry lookup.
	 */
	private get configuredProviderName(): string | undefined {
		const provider = this.effectiveProvider
		if (typeof provider === 'string') return provider
		if (provider && typeof provider === 'object' && !provider.apiMode && provider.preset) return provider.preset
		return undefined
	}

	/**
	 * Fail loudly when `provider` names a backend that isn't registered. Called at
	 * ask-time (not construction, so register-after-construct still works). Without
	 * this, an unresolved named provider silently fell through to the default
	 * OpenAI client, surfacing a confusing "OPENAI_API_KEY is missing" error
	 * instead of naming the real problem — the configured provider.
	 */
	private assertConfiguredProviderResolvable(): void {
		const name = this.configuredProviderName
		if (!name) return
		const modelProviders = this.container.feature('modelProviders')
		if (modelProviders.get(name)) return
		const available = Object.keys(modelProviders.profiles ?? {})
		throw new Error(
			`Unknown model provider: "${name}". It is not registered in modelProviders, so this conversation cannot resolve a backend. ` +
			`Register it (e.g. modelProviders.registerLocal('${name}', baseURL, model) in luca.cli.ts) or use one of the registered ids: ${available.join(', ') || '(none)'}.`
		)
	}

	/**
	 * The default model of the explicitly configured `provider`, resolved
	 * synchronously through the modelProviders registry. Lets the conversation
	 * seed `state.model` with the provider's own default (e.g. a local endpoint's
	 * model) instead of the OpenAI 'gpt-5.4-mini' fallback, so native OpenAI loops don't
	 * override the provider's model with 'gpt-5.4-mini'. Undefined when no provider is set.
	 */
	private get configuredProviderDefaultModel(): string | undefined {
		const provider = this.effectiveProvider
		if (!provider) return undefined
		const modelProviders = this.container.feature('modelProviders')
		if (typeof provider === 'string') {
			return modelProviders.get(provider)?.defaultModel
		}
		if (typeof provider === 'object') {
			return provider.model ?? provider.defaultModel ?? (provider.preset ? modelProviders.get(provider.preset)?.defaultModel : undefined)
		}
		return undefined
	}

	/**
	 * Whether turns are handled by the generic transport loop. True only when a
	 * provider is configured whose apiMode is not an OpenAI HTTP dialect — i.e.
	 * the codex and claude-code backends. Everything else uses the OpenAI loops.
	 */
	private get usesGenericTransportLoop(): boolean {
		const mode = this.configuredProviderApiMode
		return !!mode && mode !== 'openai-responses' && mode !== 'openai-chat-completions'
	}

	/** Whether a streaming response is currently in progress. */
	get isStreaming(): boolean {
		return !!this.state.get('streaming')
	}

	/**
	 * Abort the current ask() call. Cancels the in-flight network request and
	 * any pending tool executions. The ask() promise will reject with a
	 * ConversationAbortError whose `partial` property contains any text
	 * accumulated before the abort.
	 */
	abort(): void {
		this._abortController?.abort()
	}

	/** Race arbitrary provider/tool work against the active turn's abort signal. */
	private async abortable<T>(promise: Promise<T>, partial = ''): Promise<T> {
		const signal = this._abortController?.signal
		if (!signal) return promise
		if (signal.aborted) throw new ConversationAbortError(partial)
		return new Promise<T>((resolve, reject) => {
			const onAbort = () => reject(new ConversationAbortError(partial))
			signal.addEventListener('abort', onAbort, { once: true })
			promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', onAbort))
		})
	}

	/** Make custom async transports abortable even when they ignore request.signal. */
	private async *abortableStream<T>(stream: AsyncIterable<T>, partial: () => string): AsyncIterable<T> {
		const iterator = stream[Symbol.asyncIterator]()
		try {
			while (true) {
				const next = await this.abortable(iterator.next(), partial())
				if (next.done) return
				yield next.value
			}
		} finally {
			if (this._abortController?.signal.aborted) void iterator.return?.()
			else await iterator.return?.()
		}
	}

	/**
	 * Returns the correct parameter name for limiting output tokens.
	 * Local models (LM Studio, Ollama) and legacy OpenAI models use max_tokens.
	 * Newer OpenAI models (gpt-4o+, gpt-4.1, gpt-5, o1, o3, o4) require max_completion_tokens.
	 */
	private get maxTokensParam(): 'max_tokens' | 'max_completion_tokens' {
		const model = this.model
		const needsCompletionTokens = [
			'gpt-4o', 'gpt-4.1', 'gpt-5', 'o1', 'o3', 'o4',
		]

		if (needsCompletionTokens.some((prefix) => model.startsWith(prefix))) {
			return 'max_completion_tokens'
		}

		return 'max_tokens'
	}

	/** The context window size for the current model (from options override or auto-detected). */
	get contextWindow(): number {
		return this.options.contextWindow || getContextWindow(this.model)
	}

	/** Whether the conversation is approaching the context limit. */
	get isNearContextLimit(): boolean {
		const threshold = this.options.compactThreshold ?? 0.8
		return this.estimateTokens() >= this.contextWindow * threshold
	}

	/**
	 * Estimate the input token count for the current messages array
	 * using the js-tiktoken tokenizer. Updates state.
	 */
	estimateTokens(): number {
		const count = countMessageTokens(this.messages, this.model)
		this.state.set('estimatedInputTokens', count)
		return count
	}

	/**
	 * Generate a summary of the conversation so far using the LLM.
	 * Read-only — does not modify messages.
	 */
	async summarize(): Promise<string> {
		this.emit('summarizeStart')

		const transcript = this.messages
			.map(m => {
				const role = m.role
				const content = typeof m.content === 'string'
					? m.content
					: Array.isArray(m.content)
						? (m.content as any[]).filter((p: any) => p.type === 'text').map((p: any) => p.text).join('\n')
						: (m.content != null ? JSON.stringify(m.content) : '(no content)')
				return `[${role}]: ${content || '(no text content)'}`
			})
			.join('\n\n')

		const provider = await this.resolveTransportProvider('openai-chat-completions')

		let summary = ''
		for await (const event of provider.transport.stream({
			model: this.model,
			messages: [
				{
					role: 'system',
					content: 'You are a conversation summarizer. Produce a concise but comprehensive summary of the following conversation. Preserve all key facts, decisions, context, user preferences, and any important details needed to continue the conversation. Output only the summary.',
				},
				{ role: 'user', content: transcript },
			],
		}, provider)) {
			if (event.type === 'response') summary = event.response.content || ''
		}

		this.emit('summarizeEnd', summary)
		return summary
	}

	/**
	 * Compact the conversation by summarizing old messages and replacing them
	 * with a summary message. Keeps the system message (if any) and the most
	 * recent N messages.
	 */
	async compact(options?: { keepRecent?: number }): Promise<{ summary: string; removedCount: number; estimatedTokens: number }> {
		const keepRecent = options?.keepRecent ?? this.options.compactKeepRecent ?? 4
		const messages = this.messages

		if (messages.length <= keepRecent + 1) {
			return { summary: '', removedCount: 0, estimatedTokens: this.estimateTokens() }
		}

		this.emit('compactStart', { messageCount: messages.length, keepRecent })

		const summary = await this.summarize()

		const systemMessage = (messages[0]?.role === 'system' || messages[0]?.role === 'developer')
			? messages[0]
			: null

		let sliceStart = messages.length - keepRecent
		// Walk back to avoid splitting a tool call group — if we'd start on a tool message,
		// include the preceding assistant message (and its full tool response block)
		if (sliceStart > 0) {
			while (sliceStart > 0 && messages[sliceStart]?.role === 'tool') {
				sliceStart--
			}
		}
		const recentMessages = messages.slice(sliceStart)

		const newMessages: Message[] = []
		if (systemMessage) newMessages.push(systemMessage)

		newMessages.push({
			role: 'developer',
			content: `[Conversation Summary — the following is a summary of the earlier conversation that has been compacted to save context space]\n\n${summary}`,
		} as Message)

		newMessages.push(...recentMessages)

		const removedCount = messages.length - newMessages.length
		this._setMessages(newMessages)
		this.state.set('compactionCount', (this.state.get('compactionCount') || 0) + 1)

		// Clear server-side continuation chains since the message history changed.
		if (this.apiMode === 'responses') {
			this.state.set('lastResponseId', null)
			this.state.set('lastResponseMessageCount', null)
		}
		if (this.usesGenericTransportLoop) {
			this.state.set('lastProviderData', undefined)
		}

		const estimatedTokens = this.estimateTokens()

		this.emit('compactEnd', { summary, removedCount, estimatedTokens, compactionCount: this.state.get('compactionCount') })

		return { summary, removedCount, estimatedTokens }
	}

	/**
	 * Replace the message list and bump `messagesVersion`. Every write to
	 * `state.messages` goes through here, so an observer that watches the version
	 * sees every change — appends, compaction, and explicit edits alike.
	 *
	 * Always writes a *new* array and never mutates the old one, so a fork or a
	 * saved snapshot taken beforehand keeps the history it captured.
	 *
	 * @internal Not part of the public API. Callers outside luca should use
	 * `clearMessages()` / `replaceMessage()`, which also handle continuation
	 * invalidation. Kept accessible so `Assistant` can install a loaded
	 * transcript without the version silently falling behind.
	 */
	_setMessages(messages: Message[]): number {
		const version = (this.state.get('messagesVersion') ?? 0) + 1
		this.state.set('messages', messages)
		this.state.set('messagesVersion', version)
		return version
	}

	/**
	 * How many messages the provider has already been shown. The Responses API
	 * records the exact prefix its `previous_response_id` stands for; generic
	 * backends (codex, claude-session) hold the whole transcript server-side, so
	 * with one of their handles in hand every local message counts as sent.
	 */
	private get providerSeenMessageCount(): number {
		const represented = this.state.get('lastResponseMessageCount')
		if (typeof represented === 'number') return represented
		const holdsHandle = !!this.state.get('lastResponseId') || this.state.get('lastProviderData') !== undefined
		return holdsHandle ? this.messages.length : 0
	}

	/**
	 * Drop every provider-side continuation handle. They describe a transcript
	 * the provider holds; once local history is rewritten they point at a past
	 * that no longer exists, and sending one replays the un-edited version.
	 *
	 * @returns whether a handle was actually dropped
	 */
	private invalidateContinuation(): boolean {
		const held = !!this.state.get('lastResponseId')
			|| this.state.get('lastResponseMessageCount') != null
			|| this.state.get('lastProviderData') !== undefined
		this.state.set('lastResponseId', null)
		this.state.set('lastResponseMessageCount', null)
		this.state.set('lastProviderData', undefined)
		return held
	}

	/**
	 * Wipe the transcript without changing the conversation's identity —
	 * "start this discussion over". The leading system/developer messages are
	 * kept by default because they are the assistant's identity, not transcript.
	 *
	 * Always invalidates provider continuation handles: a cleared conversation
	 * that still sent `previous_response_id` would silently resume the
	 * transcript the caller just deleted.
	 *
	 * Prefer this to mutating `conversation.messages` — that array is a live
	 * projection, and splicing it leaves the continuation handles pointing at
	 * history that is gone.
	 *
	 * @param options - `keepSystemPrompt` (default true) keeps the leading system/developer messages
	 *
	 * @example
	 * ```typescript
	 * const edit = conversation.clearMessages()
	 * // => { changed: 6, messageCount: 1, continuationInvalidated: true, version: 8 }
	 * ```
	 */
	clearMessages(options: ClearMessagesOptions = {}): MessageEdit {
		const keepSystemPrompt = options.keepSystemPrompt ?? true
		const messages = this.messages
		const firstTurn = messages.findIndex(message => message.role !== 'system' && message.role !== 'developer')

		let retained: Message[]
		if (!keepSystemPrompt) retained = []
		else if (firstTurn >= 0) retained = messages.slice(0, firstTurn)
		else retained = [...messages]

		const continuationInvalidated = this.invalidateContinuation()
		const version = this._setMessages(retained)
		const result: MessageEdit = {
			changed: messages.length - retained.length,
			messageCount: retained.length,
			continuationInvalidated,
			version,
		}
		this.emit('messagesCleared', result)
		return result
	}

	/**
	 * Rewrite one message that is already in the history — the supported way to
	 * redact it. Use it to strip attachment pixels, secrets, or anything else
	 * that was fine to send to the model but must not stay in the transcript.
	 *
	 * The replacement is deep-copied into a new array, so forks and saved
	 * snapshots taken before the call keep the original message.
	 *
	 * Continuation handles are dropped only when the rewritten message is inside
	 * the prefix the provider has already seen. Editing a message the provider
	 * has never been shown leaves a live chain intact.
	 *
	 * @param selector - Index of the message (negative counts from the end) or a predicate
	 * @param replacement - The new message, or a function receiving the current one
	 * @returns What changed. `changed: 0` means a predicate matched nothing and state was untouched.
	 *
	 * @example
	 * ```typescript
	 * // Redact the pixels from the most recent user message, keep its text
	 * conversation.replaceMessage(
	 *   message => message.role === 'user',
	 *   message => ({ ...message, content: textPartsOf(message) }),
	 * )
	 * ```
	 */
	replaceMessage(selector: MessageSelector, replacement: Message | ((message: Message, index: number) => Message)): MessageEdit {
		const messages = this.messages

		let index: number
		if (typeof selector === 'number') {
			index = selector < 0 ? messages.length + selector : selector
			if (!Number.isInteger(index) || index < 0 || index >= messages.length) {
				throw new Error(
					`replaceMessage(${selector}) is out of range — this conversation has ${messages.length} message(s).`
				)
			}
		} else {
			// Search backwards: redaction almost always targets the most recent
			// match, and callers otherwise have to hand-roll the reverse scan.
			index = -1
			for (let position = messages.length - 1; position >= 0; position--) {
				if (selector(messages[position]!, position)) { index = position; break }
			}
			if (index < 0) {
				const miss: MessageEdit = {
					changed: 0,
					messageCount: messages.length,
					continuationInvalidated: false,
					version: this.state.get('messagesVersion') ?? 0,
				}
				this.emit('messageReplaced', { index: -1, ...miss })
				return miss
			}
		}

		const current = messages[index]!
		const next = typeof replacement === 'function' ? replacement(current, index) : replacement
		if (!next || typeof next !== 'object' || Array.isArray(next)) {
			throw new Error('replaceMessage(selector, replacement) requires a message object, e.g. { role, content }.')
		}

		const wasSent = index < this.providerSeenMessageCount
		const revised = messages.map((message, position) => (position === index ? structuredClone(next) : message))
		const continuationInvalidated = wasSent ? this.invalidateContinuation() : false
		const version = this._setMessages(revised)

		const result: MessageEdit = { changed: 1, messageCount: revised.length, continuationInvalidated, version }
		this.emit('messageReplaced', { index, ...result })
		return result
	}

	/**
	 * The native tool-loop ceiling. Default 75: measured across 358 real
	 * tool-using turns, p99 depth was 24 and the deepest legitimate run
	 * (a researcher deep-dive) reached 50 — 75 clears that with margin while
	 * still stopping a genuine runaway within one conversation.
	 */
	get maxToolTurns(): number {
		return this.options.maxToolTurns ?? 75
	}

	/** Returns the first system/developer text message to use as Responses instructions. */
	private get responsesInstructions(): string | undefined {
		for (const message of this.messages) {
			if ((message.role === 'system' || message.role === 'developer') && typeof message.content === 'string') {
				return message.content
			}
		}
		return undefined
	}

	/**
	 * Send a message and get a streamed response. Automatically handles
	 * tool calls by invoking the registered handlers and feeding results
	 * back to the model until a final text response is produced.
	 *
	 * @param {string | ContentPart[]} content - The user message, either a string or array of content parts (text + images)
	 * @returns {Promise<string>} The assistant's final text response
	 *
	 * @example
	 * const reply = await conversation.ask("What's the weather in SF?")
	 * // With image:
	 * const reply = await conversation.ask([
	 *   { type: 'text', text: 'What is in this diagram?' },
	 *   { type: 'image_url', image_url: { url: 'data:image/png;base64,...' } }
	 * ])
	 */
	async ask(content: string | ContentPart[], options?: AskOptions): Promise<string> {
		let release!: () => void
		const previous = this._askQueue
		this._askQueue = new Promise<void>((resolve) => { release = resolve })

		await previous
		try {
			return await this.runAsk(content, options)
		} finally {
			release()
		}
	}

	/** Execute one queued ask() with exclusive access to per-turn mutable state. */
	private async runAsk(content: string | ContentPart[], options?: AskOptions): Promise<string> {
		return this.executeTurn(options, async () => {
			// Auto-compact before adding the new message
			if (this.options.autoCompact) {
				const threshold = this.options.compactThreshold ?? 0.8
				const estimated = this.estimateTokens()
				const limit = this.contextWindow * threshold
				if (estimated >= limit) {
					this.emit('autoCompactTriggered', { estimated, limit, contextWindow: this.contextWindow })
					await this.compact()
				}
			}

			const userMessage: Message = { role: 'user', content: content as any }
			this.pushMessage(userMessage)
			// A new turn supersedes any failed one — the caller chose to move on.
			this.state.set('failedTurn', null)
			this.emit('userMessage', content)

			const stubText = this._matchStub(typeof content === 'string' ? content : '')
			if (stubText !== null) {
				return await this._streamStub(stubText)
			}

			return await this.runProviderTurn()
		})
	}

	/**
	 * Retry the turn recorded in `state.failedTurn`. The surviving user message
	 * is re-run against the provider without being duplicated in history, and
	 * the failed turn's partial output — already rolled back when the failure
	 * was recorded — is never replayed as context.
	 *
	 * Queued behind any in-flight ask() like every turn. On success the failed
	 * record clears; another failure records a fresh one (new id, same input).
	 *
	 * @param options - AskOptions plus `expectId`: when set, the retry only runs
	 * if it still targets that failed-turn record, so a client acting on a stale
	 * notification errors instead of retrying a different failure.
	 *
	 * @example
	 * ```typescript
	 * try { await conversation.ask('do the thing') }
	 * catch { await conversation.retryFailedTurn() }
	 * ```
	 */
	async retryFailedTurn(options?: AskOptions & { expectId?: string }): Promise<string> {
		let release!: () => void
		const previous = this._askQueue
		this._askQueue = new Promise<void>((resolve) => { release = resolve })

		await previous
		try {
			return await this.executeTurn(options, async () => {
				const failed = this.state.get('failedTurn') as FailedTurnRecord | null
				if (!failed) throw new Error('retryFailedTurn(): there is no failed turn to retry')
				if (options?.expectId && options.expectId !== failed.id) {
					throw new Error(`retryFailedTurn(): expected failed turn ${options.expectId} but the current one is ${failed.id}`)
				}
				if (!failed.retryable) throw new Error(`retryFailedTurn(): failed turn ${failed.id} is not retryable`)
				const input = this.messages[failed.userMessageIndex]
				if (failed.userMessageIndex !== this.messages.length - 1 || input?.role !== 'user') {
					this.state.set('failedTurn', null)
					throw new Error('retryFailedTurn(): the conversation has moved past the failed turn')
				}
				this.state.set('failedTurn', null)
				return await this.runProviderTurn()
			})
		} finally {
			release()
		}
	}

	/**
	 * Per-call state bracket shared by ask() and retryFailedTurn(): seeds the
	 * call-scoped schema/instructions/abort state, translates SDK aborts into
	 * ConversationAbortError, and always clears the per-call state.
	 */
	private async executeTurn(options: AskOptions | undefined, body: () => Promise<string>): Promise<string> {
		this.state.set('callMaxTokens', options?.maxTokens ?? null)
		this._activeSchema = options?.schema ?? null
		this._activeInstructions = options?.instructions?.trim() || null
		this._abortController = new AbortController()

		try {
			return await body()
		} catch (err: any) {
			if (err instanceof ConversationAbortError) {
				this.emit('aborted', err.partial)
				throw err
			}
			// Re-throw abort errors from the OpenAI SDK / DOM AbortController
			if (err.name === 'AbortError' || this._abortController?.signal.aborted) {
				const partial = this.state.get('lastResponse') || ''
				this.emit('aborted', partial)
				throw new ConversationAbortError(partial)
			}
			throw err
		} finally {
			this.state.set('callMaxTokens', null)
			this._activeSchema = null
			this._activeInstructions = null
			this._abortController = null
		}
	}

	/**
	 * Run the provider portion of one turn: the user message driving it is
	 * already the last message in history. On a non-abort failure the turn's
	 * partial output is rolled back and a retryable failed-turn record is
	 * written before the error propagates — see `recordFailedTurn`.
	 */
	private async runProviderTurn(): Promise<string> {
		const inputIndex = this.messages.length - 1
		const content = this.messages[inputIndex]!.content as string | ContentPart[]
		// Continuation handles as they stood before this turn ran. If the turn
		// fails without minting new ones, the pre-turn chain is still valid.
		const handlesBefore = {
			lastResponseId: this.state.get('lastResponseId') ?? null,
			lastProviderData: this.state.get('lastProviderData'),
		}

		try {
			let raw: string

			// A named `provider:` that isn't registered must fail loudly here
			// rather than silently routing to the default OpenAI client below.
			this.assertConfiguredProviderResolvable()

			// A conversation with no provider, no explicit connection, and no
			// OPENAI_API_KEY has nothing to talk to — surface the setup guidance
			// now instead of a downstream auth error from the OpenAI client. Only
			// when the request would hit the builtin OpenAI transports, though: a
			// replacement transport brings its own connection and needs no key.
			if (!this.effectiveProvider && !this.options.clientOptions && !process.env.OPENAI_API_KEY) {
				const modelProviders = this.container.feature('modelProviders')
				const mode = this.apiMode === 'responses' ? 'openai-responses' : 'openai-chat-completions'
				const transport = modelProviders.getTransport(mode)
				if (transport instanceof OpenAIChatCompletionsTransport || transport instanceof OpenAIResponsesTransport) {
					modelProviders.requireDefaultId()
				}
			}

			if (this.usesGenericTransportLoop) {
				// Non-OpenAI providers (codex, claude-code) run through the
				// provider-agnostic turn loop driven by ModelStreamEvents.
				const beforeTransportMessages = this.messages.length
				try {
					raw = await this.runGenericTransportLoop()
				} catch (error) {
					if (!this.shouldRetryWithoutContinuation(error, 'lastProviderData', beforeTransportMessages)) throw error
					this.state.set('lastProviderData', undefined)
					raw = await this.runGenericTransportLoop()
				}
			} else if (this.apiMode === 'responses') {
				const budgetedMessages = this.getMessagesWithinBudget()
				const representedCount = this.state.get('lastResponseMessageCount')
				const chainIsCurrent = representedCount != null && representedCount === this.messages.length - 1
				// Continue server-side only while the continuation represents the exact
				// local prefix and no history had to be trimmed for the input budget.
				const canChain = chainIsCurrent && budgetedMessages.length === this.messages.length
				const previousResponseId = canChain ? (this.state.get('lastResponseId') || undefined) : undefined
				let input: OpenAI.Responses.ResponseInput

				if (previousResponseId) {
					// Can chain via previous_response_id — only send the new user message
					input = [toResponsesUserMessage(content)]
				} else {
					// No previous response ID (first call, resumed from disk, or maxInputTokens active).
					// Convert (possibly trimmed) message history to Responses API input.
					input = messagesToResponsesInput(budgetedMessages as any)
				}

				const beforeTransportMessages = this.messages.length
				try {
					raw = await this.runResponsesLoop({ turn: 1, accumulated: '', input, previousResponseId })
				} catch (error) {
					if (!previousResponseId || !this.shouldRetryWithoutContinuation(error, 'lastResponseId', beforeTransportMessages)) throw error
					this.state.set('lastResponseId', null)
					this.state.set('lastResponseMessageCount', null)
					raw = await this.runResponsesLoop({
						turn: 1,
						accumulated: '',
						input: messagesToResponsesInput(this.getMessagesWithinBudget() as any),
					})
				}
			} else {
				raw = await this.runChatCompletionLoop({ turn: 1, accumulated: '' })
			}

			// When a structured output schema is active, parse the JSON response
			if (this._activeSchema) {
				const parsed = JSON.parse(raw)
				return this._activeSchema.parse(parsed) as any
			}

			return raw
		} catch (err: any) {
			// An abort is the user's own action, not a failure — executeTurn
			// translates it. Everything else becomes a retryable failed turn.
			const aborted = err instanceof ConversationAbortError
				|| err?.name === 'AbortError'
				|| this._abortController?.signal.aborted
			if (!aborted) this.recordFailedTurn(inputIndex, handlesBefore, err)
			throw err
		}
	}

	/**
	 * Roll a failed turn back to its input and record it as retryable.
	 *
	 * The contract (option 3 of the coordination note): the turn's input
	 * survives in history with a failure marker and a retry identity, but any
	 * partial output — assistant tool-call messages, tool results, half-streamed
	 * text — is dropped so it can never be replayed as model context. A
	 * continuation handle minted mid-turn describes a transcript that includes
	 * that partial output, so it is dropped too; a handle untouched by the turn
	 * still represents the pre-turn prefix and survives for the retry.
	 */
	private recordFailedTurn(
		inputIndex: number,
		handlesBefore: { lastResponseId: string | null; lastProviderData: any },
		err: any,
	): FailedTurnRecord {
		if (this.messages.length > inputIndex + 1) {
			this._setMessages(this.messages.slice(0, inputIndex + 1))
		}
		const mintedMidTurn = (this.state.get('lastResponseId') ?? null) !== handlesBefore.lastResponseId
			|| this.state.get('lastProviderData') !== handlesBefore.lastProviderData
		if (mintedMidTurn) this.invalidateContinuation()

		const status = err?.status ?? err?.statusCode ?? err?.response?.status
		const record: FailedTurnRecord = {
			id: `ft_${crypto.randomUUID()}`,
			userMessageIndex: inputIndex,
			error: {
				name: err?.name || 'Error',
				message: err?.message || String(err),
				...(typeof status === 'number' ? { status } : {}),
			},
			at: new Date().toISOString(),
			retryable: true,
		}
		this.state.set('failedTurn', record)
		this.emit('turnFailed', record)
		return record
	}

	/** Retry only failures that explicitly identify an invalid/expired continuation handle. */
	private shouldRetryWithoutContinuation(
		error: unknown,
		stateKey: 'lastResponseId' | 'lastProviderData',
		messageCountBeforeTransport: number,
	): boolean {
		if (!this.state.get(stateKey as any)) return false
		if (this.messages.length !== messageCountBeforeTransport) return false
		const value = error as any
		const status = value?.status ?? value?.statusCode ?? value?.response?.status
		const message = String(value?.message ?? value ?? '').toLowerCase()
		const namesContinuation = /previous[_ ]response|continuation|resume|session|thread/.test(message)
		const saysInvalid = /invalid|expired|not found|unknown|does not exist|no longer exists/.test(message)
		return namesContinuation && saysInvalid && (status == null || status === 400 || status === 404)
	}

	/**
	 * Build the OpenAI response_format / text.format config from the active Zod schema.
	 * Returns undefined when no schema is active.
	 */
	private get structuredOutputConfig(): { name: string; schema: Record<string, any>; strict: true } | undefined {
		if (!this._activeSchema) return undefined

		const raw = (this._activeSchema as any).toJSONSchema() as Record<string, any>
		const strict = strictifySchema(raw)

		// Derive a name from the schema description or fall back to a default.
		// OpenAI requires [a-zA-Z0-9_-] max 64 chars.
		const desc = raw.description || 'structured_output'
		const name = desc.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64)

		return {
			name,
			schema: { type: strict.type || 'object', properties: strict.properties, required: strict.required, additionalProperties: false },
			strict: true,
		}
	}

	/** Returns the OpenAI client instance from the container. */
	get openai() {
		const baseURL = this.options.clientOptions?.baseURL ? this.options.clientOptions.baseURL : undefined

		return (this.container as any).client('openai', {
			defaultModel: this.model || "gpt-5.4-mini",
			...this.options.clientOptions,
			...(baseURL ? { baseURL } : {}),
		}) as OpenAIClient
	}

	/**
	 * Resolve a model provider for the given API mode through the modelProviders
	 * feature. The conversation's own OpenAI client (which already encodes
	 * clientOptions, local mode, and auth) is injected as the transport client so
	 * connection behavior is unchanged — modelProviders supplies the transport.
	 */
	private resolveTransportProvider(apiMode: 'openai-responses' | 'openai-chat-completions'): Promise<ResolvedModelProvider> {
		// When an OpenAI-family provider is explicitly configured — e.g. a local
		// OpenAI-compatible endpoint registered via modelProviders.registerLocal —
		// route through ITS connection (baseURL, apiKey, headers, default model)
		// rather than the container's default OpenAI client. Without this a
		// `provider:` pointing at http://my-box/v1 silently hits api.openai.com.
		if (this.configuredProviderApiMode === apiMode) {
			return this.resolveConfiguredProvider(apiMode)
		}
		return this.container.feature('modelProviders').resolve({
			provider: { id: `conversation-${apiMode}`, apiMode, auth: 'none' },
			model: this.model,
			providerOptions: {
				// Lazy so replacement transports that bring their own connection
				// never force construction of the OpenAI client (and its API key).
				clientFactory: () => this.openai.raw,
				...(apiMode === 'openai-chat-completions' ? { maxTokensParam: this.maxTokensParam } : {}),
				...(Object.keys(this.mcpServers).length ? { mcpServers: this.mcpServers } : {}),
			},
		})
	}

	/** The registered tools in normalized ModelTool form for provider transports. */
	private get modelTools(): ModelTool[] {
		return Object.entries(this.tools).map(([name, tool]) => ({
			type: 'function' as const,
			function: {
				name,
				description: tool.description,
				parameters: tool.parameters,
			},
		}))
	}

	/**
	 * Resolve the explicitly configured `provider` through the modelProviders
	 * feature, threading through providerOptions and any continuation data
	 * (codex/claude-session ids) captured from the previous response.
	 */
	private resolveConfiguredProvider(apiMode?: 'openai-responses' | 'openai-chat-completions'): Promise<ResolvedModelProvider> {
		const previousProviderData = this.state.get('lastProviderData')
		return this.container.feature('modelProviders').resolve({
			provider: this.effectiveProvider,
			model: this.options.model,
			providerOptions: {
				// Preserve the native OpenAI-loop hints when a configured provider
				// drives that loop; the caller's providerOptions still win.
				...(apiMode === 'openai-chat-completions' ? { maxTokensParam: this.maxTokensParam } : {}),
				...(Object.keys(this.mcpServers).length ? { mcpServers: this.mcpServers } : {}),
				...(this.options.providerOptions ?? {}),
				...(previousProviderData ? { previousProviderData } : {}),
			},
		})
	}

	/**
	 * Provider-agnostic turn loop for non-OpenAI backends (codex, claude-code).
	 * Drives the resolved transport purely through ModelStreamEvents and uses
	 * provider-supplied continuation data to resume sessions across turns. The
	 * user message has already been pushed by ask() before this runs.
	 *
	 * Feature-lighter than the OpenAI loops by design: no structured-output
	 * parsing and no maxInputTokens trimming, but tool calls, streaming events,
	 * cost accounting (when usage is returned), and history are all preserved.
	 */
	private async runGenericTransportLoop(): Promise<string> {
		const provider = await this.resolveConfiguredProvider()
		const tools = this.modelTools
		const maxTurns = this.options.maxTurns ?? 8
		let accumulated = ''
		let finalProviderData: any = undefined

		for (let turn = 1; turn <= maxTurns; turn++) {
			this.state.set('streaming', true)
			this.emit('turnStart', { turn, isFollowUp: turn > 1 })

			let turnContent = ''
			let toolCalls: ModelToolCall[] = []

			try {
				const stream = provider.transport.stream({
					// provider.model already honors options.model ?? profile default,
					// so codex/claude-code fall back to their own default model.
					model: provider.model,
					messages: this.sanitizeMessages(this.getMessagesWithinBudget()) as any,
					tools: tools.length ? tools : undefined,
					maxTokens: this.maxTokens,
					instructions: this._activeInstructions ?? undefined,
					responseFormat: this.structuredOutputConfig,
					temperature: this.state.get('temperature') ?? undefined,
					extraBody: this.state.get('extraBody') ?? undefined,
					signal: this._abortController?.signal,
					providerOptions: provider.providerOptions,
				}, provider)

				for await (const event of this.abortableStream(stream, () => accumulated)) {
					if (event.type === 'chunk') {
						turnContent += event.text
						accumulated += event.text
						this.state.set('lastResponse', accumulated)
						this.emit('chunk', event.text)
						this.emit('preview', accumulated)
					} else if (event.type === 'reasoning') {
						this.emit('reasoning', event.text)
					} else if (event.type === 'toolCall') {
						toolCalls.push(event.toolCall)
					} else if (event.type === 'rawEvent') {
						this.emit('rawEvent', event.event)
					} else if (event.type === 'response') {
						// Transports that don't stream deltas deliver content whole here.
						if (event.response.content && !turnContent) {
							turnContent = event.response.content
							accumulated += event.response.content
							this.state.set('lastResponse', accumulated)
							this.emit('chunk', event.response.content)
							this.emit('preview', accumulated)
						}
						if (event.response.toolCalls?.length) toolCalls = event.response.toolCalls
						if (event.response.providerData !== undefined) finalProviderData = event.response.providerData
						if (event.response.usage) this.applyGenericUsage(event.response.usage)
					}
				}
			} finally {
				this.state.set('streaming', false)
			}

			// Persist the assistant turn in the same wire format the OpenAI loops
			// use, so save()/history and inspection stay consistent.
			const assistantMessage: OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam = {
				role: 'assistant',
				content: turnContent || null,
				...(toolCalls.length ? {
					tool_calls: toolCalls.map((call) => ({
						id: call.id || '',
						type: 'function' as const,
						function: { name: call.name, arguments: call.rawArguments ?? JSON.stringify(call.arguments ?? {}) },
					})),
				} : {}),
			}
			this.pushMessage(assistantMessage)
			this.emit('turnEnd', { turn, hasToolCalls: toolCalls.length > 0 })

			if (!toolCalls.length) break

			this.emit('toolCallsStart', toolCalls)
			for (const call of toolCalls) {
				if (this._abortController?.signal.aborted) {
					throw new ConversationAbortError(accumulated)
				}
				const result = await this.executeTool(call.name, call.rawArguments ?? JSON.stringify(call.arguments ?? {}))
				this.pushMessage({ role: 'tool', tool_call_id: call.id || '', content: result })
			}
			this.emit('toolCallsEnd')
		}

		if (finalProviderData !== undefined) {
			this.state.set('lastProviderData', finalProviderData)
		}
		this.state.set('lastResponse', accumulated)
		this.emit('response', accumulated)
		return accumulated
	}

	/**
	 * Apply usage from a generic provider response to the running token/cost
	 * counters. Handles both OpenAI (prompt/completion) and Responses-style
	 * (input/output) usage shapes.
	 */
	private applyGenericUsage(usage: Record<string, any>) {
		const prompt = usage.prompt_tokens ?? usage.input_tokens ?? 0
		const completion = usage.completion_tokens ?? usage.output_tokens ?? 0
		const total = usage.total_tokens ?? (prompt + completion)
		const cached = usage.prompt_tokens_details?.cached_tokens ?? usage.input_tokens_details?.cached_tokens ?? 0
		const reasoning = usage.completion_tokens_details?.reasoning_tokens ?? usage.output_tokens_details?.reasoning_tokens ?? 0
		this.applyUsageDelta({ prompt, completion, total, cached, reasoning, costUsd: usage.costUsd })
	}

	/** Returns the conversationHistory feature for persistence. */
	get history(): ConversationHistory {
		return this.container.feature('conversationHistory') as ConversationHistory
	}

	/**
	 * Persist this conversation to disk via conversationHistory.
	 * Creates a new record if this conversation hasn't been saved before,
	 * or updates the existing one.
	 *
	 * @param opts - Optional overrides for title, tags, thread, or metadata
	 * @returns The saved conversation record
	 */
	async save(opts?: { title?: string; tags?: string[]; thread?: string; metadata?: Record<string, any> }) {
		const id = this.state.get('id')!
		const existing = await this.history.load(id)

		// Persist continuation data so the chain can resume: lastResponseId for the
		// Responses API, lastProviderData for codex/claude-session backends.
		const lastResponseId = this.state.get('lastResponseId')
		const lastProviderData = this.state.get('lastProviderData')
		const failedTurn = this.state.get('failedTurn')
		const responseMeta = {
			...(lastResponseId ? { lastResponseId } : {}),
			...(lastResponseId ? { lastResponseMessageCount: this.state.get('lastResponseMessageCount') } : {}),
			...(lastProviderData ? { lastProviderData } : {}),
			...(failedTurn ? { failedTurn } : {}),
		}

		// Grab the live token usage and cost from state
		const tokenUsage = this.state.get('tokenUsage')!
		const cost = this.state.get('cost')!

		if (existing) {
			existing.messages = this.messages
			existing.model = this.model
			existing.tokenUsage = tokenUsage
			existing.cost = cost
			if (opts?.title) existing.title = opts.title
			if (opts?.tags) existing.tags = opts.tags
			if (opts?.thread) existing.thread = opts.thread
			existing.metadata = { ...existing.metadata, ...responseMeta, ...(opts?.metadata || {}) }
			// A cleared failure must clear from the record too, or a resume would
			// resurrect a failed turn the user already retried past.
			if (!failedTurn) delete existing.metadata.failedTurn
			await this.history.save(existing)
			return existing
		}

		return this.history.create({
			id,
			title: opts?.title || this.options.title,
			model: this.model,
			messages: this.messages,
			tags: opts?.tags || this.options.tags || [],
			thread: opts?.thread || this.options.thread || this.state.get('thread'),
			tokenUsage,
			cost,
			metadata: { ...responseMeta, ...(opts?.metadata || this.options.metadata || {}) },
		})
	}

	/**
	 * Execute a single tool call, routing through the pluggable toolExecutor
	 * if one is set (e.g. by the Assistant's interceptor chain).
	 */
	private async executeTool(toolName: string, rawArgs: string): Promise<string> {
		const tool = this.tools[toolName]
		const callCount = (this.state.get('toolCalls') || 0) + 1
		this.state.set('toolCalls', callCount)

		if (!tool) {
			const result = JSON.stringify({ error: `Unknown tool: ${toolName}` })
			this.emit('toolError', toolName, result)
			return result
		}

		let args: Record<string, any>
		try {
			args = rawArgs ? JSON.parse(rawArgs) : {}
		} catch (parseErr: any) {
			const result = JSON.stringify({ error: `Failed to parse tool arguments: ${parseErr.message}`, rawArgs })
			this.emit('toolError', toolName, parseErr)
			return result
		}

		if (this.toolExecutor) {
			return this.abortable(this.toolExecutor(toolName, args, tool.handler), this.state.get('lastResponse') || '')
		}

		try {
			this.emit('toolCall', toolName, args)
			const output = await this.abortable(Promise.resolve(tool.handler(args)), this.state.get('lastResponse') || '')
			const result = typeof output === 'string' ? output : JSON.stringify(output)
			this.emit('toolResult', toolName, result)
			return result
		} catch (err: any) {
			if (err instanceof ConversationAbortError || err?.name === 'AbortError' || this._abortController?.signal.aborted) {
				throw err
			}
			const result = JSON.stringify({ error: err.message || String(err) })
			this.emit('toolError', toolName, err)
			return result
		}
	}

	/** Check registered stubs against user input. Returns the response text, or null if no match. */
	private _matchStub(input: string): string | null {
		for (const { matcher, response } of this._stubs) {
			const matched = typeof matcher === 'string'
				? input === matcher || input.includes(matcher)
				: matcher.test(input)
			if (matched) {
				return typeof response === 'function' ? response() : response
			}
		}
		return null
	}

	/**
	 * Simulate a streaming response for a hardcoded stub text.
	 * Emits chunk/preview events word-by-word, yielding between each to keep the event loop alive.
	 */
	private async _streamStub(text: string): Promise<string> {
		this.state.set('streaming', true)
		this.emit('turnStart', { turn: 1, isFollowUp: false })

		let accumulated = ''
		const chunks = text.match(/\S+\s*/g) ?? [text]

		try {
			for (const chunk of chunks) {
				if (this._abortController?.signal.aborted) throw new ConversationAbortError(accumulated)
				accumulated += chunk
				this.emit('chunk', chunk)
				this.emit('preview', accumulated)
				await Promise.resolve()
			}
		} finally {
			this.state.set('streaming', false)
		}

		const trimmed = text
		this.pushMessage({ role: 'assistant', content: trimmed })
		this.state.set('lastResponse', trimmed)
		this.emit('turnEnd', { turn: 1, hasToolCalls: false })
		this.emit('response', trimmed)

		return trimmed
	}

	/**
	 * Runs the streaming Responses API loop. Handles local function calls by
	 * executing handlers and submitting `function_call_output` items until
	 * the model produces a final text response.
	 */
	private async runResponsesLoop(context: {
		turn: number
		accumulated: string
		input: OpenAI.Responses.ResponseInput
		previousResponseId?: string
	}): Promise<string> {

		const { turn } = context
		let accumulated = context.accumulated
		let turnContent = ''
		let finalResponse: OpenAI.Responses.Response | undefined

		const provider = await this.resolveTransportProvider('openai-responses')
		const tools = this.modelTools

		this.state.set('streaming', true)
		this.emit('turnStart', { turn, isFollowUp: turn > 1 })

		try {
			const stream = provider.transport.stream({
				model: this.model,
				messages: [],
				tools: tools.length ? tools : undefined,
				maxTokens: this.maxTokens,
				instructions: this._activeInstructions ?? undefined,
				temperature: this.state.get('temperature') ?? undefined,
				topP: this.state.get('topP') ?? undefined,
				topK: this.state.get('topK') ?? undefined,
				frequencyPenalty: this.state.get('frequencyPenalty') ?? undefined,
				presencePenalty: this.state.get('presencePenalty') ?? undefined,
				stop: this.state.get('stop') ?? undefined,
				responseFormat: this.structuredOutputConfig,
				signal: this._abortController?.signal,
				stream: true,
				providerOptions: {
					input: context.input,
					previousResponseId: context.previousResponseId,
					instructions: this.responsesInstructions,
				},
			}, provider)

			for await (const transportEvent of this.abortableStream(stream, () => accumulated)) {
				if (transportEvent.type === 'rawEvent') {
					const event = transportEvent.event
					this.emit('rawEvent', event)
					if (event.type?.startsWith?.('response.mcp_')) {
						this.emit('mcpEvent', event)
					}
					if ((event.type === 'response.output_item.added' || event.type === 'response.output_item.done')
						&& event.item?.type?.startsWith?.('mcp_')) {
						this.emit('mcpEvent', event)
					}
					if (event.type === 'response.completed') {
						this.emit('responseCompleted', event.response)
					}
				} else if (transportEvent.type === 'chunk') {
					const delta = transportEvent.text
					turnContent += delta
					accumulated += delta
					this.state.set('lastResponse', accumulated)
					this.emit('chunk', delta)
					this.emit('preview', accumulated)
				} else if (transportEvent.type === 'reasoning') {
					this.emit('reasoning', transportEvent.text)
				} else if (transportEvent.type === 'response') {
					finalResponse = (transportEvent.response.providerData?.response ?? finalResponse) as OpenAI.Responses.Response | undefined
				}
			}
		} finally {
			this.state.set('streaming', false)
		}

		if (!finalResponse) {
			throw new Error('Responses stream ended without a completed response')
		}

		this.state.set('lastResponseId', finalResponse.id)
		this.applyResponsesUsage(finalResponse.usage || undefined)

		const functionCalls = (finalResponse.output || []).filter((item) => item.type === 'function_call') as OpenAI.Responses.ResponseFunctionToolCall[]
		if (functionCalls.length > 0) {
			// The model still wants tools at the ceiling: stop the recursion here,
			// before executing them, so a tool-calls-tool loop cannot spin until a
			// provider or budget kills it. Flows through the failed-turn contract.
			if (turn >= this.maxToolTurns) {
				throw new ToolLoopLimitError(this.maxToolTurns, accumulated)
			}
			const assistantMessage: OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam = {
				role: 'assistant',
				content: turnContent || null,
				tool_calls: functionCalls.map((call) => ({
					id: call.call_id,
					type: 'function',
					function: {
						name: call.name,
						arguments: call.arguments || '{}',
					}
				}))
			}
			this.pushMessage(assistantMessage)

			this.emit('toolCallsStart', functionCalls)

			const functionOutputs: OpenAI.Responses.ResponseInputItem.FunctionCallOutput[] = []
			for (const call of functionCalls) {
				if (this._abortController?.signal.aborted) {
					throw new ConversationAbortError(accumulated)
				}
				const result = await this.executeTool(call.name, call.arguments || '{}')

				this.pushMessage({
					role: 'tool',
					tool_call_id: call.call_id,
					content: result,
				})

				functionOutputs.push({
					type: 'function_call_output',
					call_id: call.call_id,
					output: result,
				})
			}

			this.emit('toolCallsEnd')
			this.emit('turnEnd', { turn, hasToolCalls: true })

			return this.runResponsesLoop({
				turn: turn + 1,
				accumulated,
				input: functionOutputs,
				previousResponseId: finalResponse.id,
			})
		}

		const finalText = turnContent || finalResponse.output_text || ''
		const assistantMessage: Message = { role: 'assistant', content: finalText }
		this.pushMessage(assistantMessage)
		this.state.set('lastResponseMessageCount', this.messages.length)
		this.state.set('lastResponse', accumulated || finalText)

		this.emit('turnEnd', { turn, hasToolCalls: false })
		this.emit('response', accumulated || finalText)

		return accumulated || finalText
	}

	/** Apply one response's usage without repricing earlier turns after a model switch. */
	private applyUsageDelta(delta: {
		prompt: number
		completion: number
		total: number
		cached: number
		reasoning: number
		costUsd?: number
	}) {
		const prevUsage = this.state.get('tokenUsage')!
		this.state.set('tokenUsage', {
			prompt: prevUsage.prompt + delta.prompt,
			completion: prevUsage.completion + delta.completion,
			total: prevUsage.total + delta.total,
			cachedTokens: prevUsage.cachedTokens + delta.cached,
			reasoningTokens: prevUsage.reasoningTokens + delta.reasoning,
		})

		const prevCost = this.state.get('cost')!
		const estimated = calculateCost(this.model, delta.prompt, delta.completion, {
			cachedTokens: delta.cached,
			reasoningTokens: delta.reasoning,
		})
		const providerTotal = Number.isFinite(delta.costUsd) ? Number(delta.costUsd) : estimated.totalCost
		this.state.set('cost', {
			inputCost: prevCost.inputCost + estimated.inputCost,
			outputCost: prevCost.outputCost + estimated.outputCost,
			totalCost: prevCost.totalCost + providerTotal,
		})
	}

	/** Apply Responses API usage stats to this conversation's token usage counters. */
	private applyResponsesUsage(usage?: OpenAI.Responses.ResponseUsage) {
		if (!usage) return
		this.applyUsageDelta({
			prompt: usage.input_tokens || 0,
			completion: usage.output_tokens || 0,
			total: usage.total_tokens || 0,
			cached: usage.input_tokens_details?.cached_tokens || 0,
			reasoning: usage.output_tokens_details?.reasoning_tokens || 0,
		})
	}

	/**
	 * Runs the streaming completion loop. If the model requests tool calls,
	 * executes them and loops again until a text response is produced.
	 *
	 * @returns {Promise<string>} The final assistant text response
	 */
	/**
	 * Runs the streaming completion loop. If the model requests tool calls,
	 * executes them and loops again until a text response is produced.
	 *
	 * @param context - Turn tracking: turn number and text accumulated across all turns
	 * @returns {Promise<string>} The final assistant text response (accumulated across all turns)
	 */
	private async runChatCompletionLoop(context: { turn: number; accumulated: string } = { turn: 1, accumulated: '' }): Promise<string> {
		
		const { turn } = context
		let accumulated = context.accumulated

		const tools = this.modelTools
		const provider = await this.resolveTransportProvider('openai-chat-completions')

		this.state.set('streaming', true)
		this.emit('turnStart', { turn, isFollowUp: turn > 1 })

		let turnContent = ''
		let toolCalls: Array<{ id: string; function: { name: string; arguments: string }; type: 'function' }> = []

		try {
			const stream = provider.transport.stream({
				model: this.model,
				messages: this.sanitizeMessages(this.getMessagesWithinBudget()) as any,
				tools: tools.length ? tools : undefined,
				maxTokens: this.maxTokens,
				instructions: this._activeInstructions ?? undefined,
				temperature: this.state.get('temperature') ?? undefined,
				topP: this.state.get('topP') ?? undefined,
				topK: this.state.get('topK') ?? undefined,
				frequencyPenalty: this.state.get('frequencyPenalty') ?? undefined,
				presencePenalty: this.state.get('presencePenalty') ?? undefined,
				stop: this.state.get('stop') ?? undefined,
				responseFormat: this.structuredOutputConfig,
				extraBody: this.state.get('extraBody') ?? undefined,
				signal: this._abortController?.signal,
				stream: true,
			}, provider)

			for await (const transportEvent of this.abortableStream(stream, () => accumulated)) {
				if (transportEvent.type === 'chunk') {
					const delta = transportEvent.text
					turnContent += delta
					accumulated += delta
					this.state.set('lastResponse', accumulated)
					this.emit('chunk', delta)
					this.emit('preview', accumulated)
				} else if (transportEvent.type === 'reasoning') {
					this.emit('reasoning', transportEvent.text)
				} else if (transportEvent.type === 'response') {
					const response = transportEvent.response

					// Fallback for transports that don't stream chunks (content arrives whole)
					if (response.content && !turnContent) {
						turnContent = response.content
						accumulated += response.content
						this.state.set('lastResponse', accumulated)
						this.emit('chunk', response.content)
						this.emit('preview', accumulated)
					}

					// Reconstruct the OpenAI tool_calls shape — it is part of the message
					// history format and the toolCallsStart event payload contract.
					toolCalls = (response.toolCalls ?? []).map((call: ModelToolCall) => ({
						id: call.id || '',
						type: 'function' as const,
						function: {
							name: call.name,
							arguments: call.rawArguments ?? JSON.stringify(call.arguments ?? {}),
						},
					}))

					if (response.usage) {
						const usage = response.usage
						this.applyUsageDelta({
							prompt: usage.prompt_tokens || 0,
							completion: usage.completion_tokens || 0,
							total: usage.total_tokens || 0,
							cached: usage.prompt_tokens_details?.cached_tokens || 0,
							reasoning: usage.completion_tokens_details?.reasoning_tokens || 0,
						})
					}
				}
			}
		} finally {
			this.state.set('streaming', false)
		}

		// If the model produced tool calls, execute them and loop
		if (toolCalls.length > 0) {
			// Same ceiling as the Responses loop — stop before executing another
			// round of tools once the model has had maxToolTurns chances to answer.
			if (turn >= this.maxToolTurns) {
				throw new ToolLoopLimitError(this.maxToolTurns, accumulated)
			}
			const assistantMessage: OpenAI.Chat.Completions.ChatCompletionAssistantMessageParam = {
				role: 'assistant',
				content: turnContent || null,
				tool_calls: toolCalls
			}
			this.pushMessage(assistantMessage)

			this.emit('toolCallsStart', toolCalls)

			for (const tc of toolCalls) {
				if (this._abortController?.signal.aborted) {
					throw new ConversationAbortError(accumulated)
				}
				const result = await this.executeTool(tc.function.name, tc.function.arguments)

				const toolMessage: OpenAI.Chat.Completions.ChatCompletionToolMessageParam = {
					role: 'tool',
					tool_call_id: tc.id,
					content: result
				}
				this.pushMessage(toolMessage)
			}

			this.emit('toolCallsEnd')
			this.emit('turnEnd', { turn, hasToolCalls: true })

			// Loop: let the model respond to tool results
			return this.runChatCompletionLoop({ turn: turn + 1, accumulated })
		}

		// Final text response — use this turn's content for the message history,
		// but accumulated for the response event and return value
		const assistantMessage: Message = { role: 'assistant', content: turnContent }
		this.pushMessage(assistantMessage)
		this.state.set('lastResponse', accumulated)

		this.emit('turnEnd', { turn, hasToolCalls: false })
		this.emit('response', accumulated)

		return accumulated
	}

	/**
	 * Returns the messages array trimmed to fit within the maxInputTokens budget.
	 * Keeps the system/developer message and drops oldest atomic groups first.
	 *
	 * Messages are grouped into atomic units so tool call/response pairs are never
	 * split (which would cause a 400 from OpenAI):
	 *   - assistant with tool_calls + its subsequent tool response messages = one group
	 *   - standalone user, assistant (no tools), system = one group each
	 *
	 * If no maxInputTokens is set, returns messages as-is.
	 */
	private getMessagesWithinBudget(): Message[] {
		const budget = resolveMaxInputTokens(this.options.maxInputTokens)
		if (!budget) return this.messages

		const messages = this.messages
		if (messages.length === 0) return messages

		// Check if the full history already fits
		const fullCount = countMessageTokens(messages, this.model)
		if (fullCount <= budget) return messages

		// Separate system prompt from the rest
		const systemMsg = (messages[0]?.role === 'system' || messages[0]?.role === 'developer')
			? messages[0]
			: null
		const nonSystem = systemMsg ? messages.slice(1) : [...messages]

		// Group messages into atomic units.
		// An assistant message with tool_calls and its subsequent tool responses form one group.
		type MessageGroup = Message[]
		const groups: MessageGroup[] = []
		let i = 0
		while (i < nonSystem.length) {
			const msg = nonSystem[i]!
			if (msg.role === 'assistant' && (msg as any).tool_calls?.length) {
				// Collect the assistant + all following tool responses that belong to it
				const expectedIds = new Set(((msg as any).tool_calls as any[]).map((tc: any) => tc.id))
				const group: Message[] = [msg]
				let j = i + 1
				while (j < nonSystem.length && nonSystem[j]!.role === 'tool' && expectedIds.has((nonSystem[j] as any).tool_call_id)) {
					group.push(nonSystem[j]!)
					j++
				}
				groups.push(group)
				i = j
			} else {
				groups.push([msg])
				i++
			}
		}

		// Walk backwards through groups, accumulating tokens until we exceed the budget
		const systemTokens = systemMsg ? countMessageTokens([systemMsg], this.model) : 0
		let running = systemTokens
		let cutoff = groups.length // start with nothing included

		for (let g = groups.length - 1; g >= 0; g--) {
			const groupTokens = countMessageTokens(groups[g]!, this.model)
			// The newest atomic group contains the active request (or the latest
			// tool-call/result pair). It must survive even when it alone exceeds the
			// configured budget; dropping it would send an unintended empty request.
			if (g === groups.length - 1) {
				running += groupTokens
				cutoff = g
				continue
			}
			if (running + groupTokens > budget) break
			running += groupTokens
			cutoff = g
		}

		const kept = groups.slice(cutoff).flat()
		return systemMsg ? [systemMsg, ...kept] : kept
	}

	private sanitizeMessages(messages: Message[]): Message[] {
		const result: Message[] = []

		for (let i = 0; i < messages.length; i++) {
			const msg = messages[i]!
			result.push(msg)

			// Check if this is an assistant message with tool_calls
			if (msg.role === 'assistant' && (msg as any).tool_calls?.length) {
				const toolCalls: Array<{ id: string }> = (msg as any).tool_calls
				const expectedIds = new Set(toolCalls.map(tc => tc.id))

				// Scan forward for matching tool responses
				const foundIds = new Set<string>()
				for (let j = i + 1; j < messages.length; j++) {
					const next = messages[j]!
					if (next.role === 'tool' && expectedIds.has((next as any).tool_call_id)) {
						foundIds.add((next as any).tool_call_id)
					} else if (next.role !== 'tool') {
						break
					}
				}

				// Add stub responses for any missing tool_call_ids
				for (const id of expectedIds) {
					if (!foundIds.has(id)) {
						result.push({
							role: 'tool',
							tool_call_id: id,
							content: '[tool execution was interrupted]',
						} as any)
					}
				}
			}
		}

		return result
	}

	/**
	 * Append a message to the conversation state.
	 *
	 * @param {Message} message - The message to append
	 */
	pushMessage(message: Message) {
		// Explicit message injection outside ask() invalidates provider-side state:
		// those handles represent the old local prefix and cannot see this mutation.
		if (!this._abortController) {
			this.state.set('lastResponseId', null)
			this.state.set('lastResponseMessageCount', null)
			this.state.set('lastProviderData', undefined)
		}
		this._setMessages([...this.messages, message])
	}
}

export default Conversation
