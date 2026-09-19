import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from '../../schemas/base.js'
import { Feature } from '../feature.js'
import { ensureServerProcess, chatModelPath, CHAT_MODEL_SOURCES } from './llama-server.js'

declare module 'luca/feature' {
	interface AvailableFeatures {
		zeroshotClassifier: typeof ZeroshotClassifier
	}
}

// ── Schemas ─────────────────────────────────────────────────────────

const ClassifierOptionSchema = z.union([
	z.string().describe('A bare option label'),
	z.object({
		label: z.string().describe('The option label returned in results'),
		description: z.string().optional().describe('What this option means, shown to the model'),
	}).describe('An option with an explanatory description'),
])

export const ZeroshotClassifierOptionsSchema = FeatureOptionsSchema.extend({
	systemPrompt: z.string().default(
		'You are a precise classifier. Read the input and choose the single best matching option. Answer with only the letter of that option.'
	).describe('System prompt that frames the classification task'),
	availableOptions: z.array(ClassifierOptionSchema).default([]).describe('The options to classify into (max 20). Strings or { label, description } objects'),
	model: z.string().default('Qwen3-4B-Instruct-2507-Q4_K_M').describe('Local chat model to classify with (must exist in CHAT_MODEL_SOURCES or be an absolute GGUF path)'),
	port: z.number().default(8145).describe('Port the classifier llama-server listens on (separate from the default chat server so models never collide)'),
	contextSize: z.number().default(8192).describe('Context size (-c) passed to the classifier server'),
	readyTimeoutMs: z.number().default(180_000).describe('Max time to wait for a spawned server to answer /health'),
	idleTimeoutMs: z.number().default(900_000).describe('Idle shutdown window for the classifier server (0 disables)'),
})

export const ZeroshotClassifierStateSchema = FeatureStateSchema.extend({
	serverRunning: z.boolean().default(false).describe('Whether the classifier server answered its last health probe'),
})

export const ZeroshotClassifierEventsSchema = FeatureEventsSchema.extend({
	classified: z.tuple([z.object({
		input: z.string().describe('The classified input text'),
		probabilities: z.record(z.string(), z.number()).describe('Probability per option label, summing to 1'),
		label: z.string().describe('The winning option label'),
	}).describe('Classification result')]).describe('After every successful run()'),
}).describe('Zero-shot classifier events')

export type ZeroshotClassifierOptions = z.infer<typeof ZeroshotClassifierOptionsSchema>
export type ZeroshotClassifierState = z.infer<typeof ZeroshotClassifierStateSchema>
export type ClassifierOption = z.infer<typeof ClassifierOptionSchema>

/** A classification outcome: the winning label plus the full distribution. */
export interface ClassificationResult {
	/** The option label with the highest probability. */
	label: string
	/** That label's probability. */
	probability: number
	/** Probability per option label; values sum to 1. */
	probabilities: Record<string, number>
}

// ── Pure helpers (exported for tests) ───────────────────────────────

/**
 * Options are presented to the model as a lettered list (A, B, C…) and the
 * model answers with one letter. A single letter is a single token in every
 * tokenizer we serve, which is what makes the one-pass logprob trick work:
 * the top_logprobs of that one generated position hold the model's real
 * probability for every candidate letter at once. top_logprobs caps at 20,
 * hence the 20-option limit.
 */
export const OPTION_LETTERS = 'ABCDEFGHIJKLMNOPQRST'.split('')

/** Normalize a mixed string/object option list into { label, description? }. */
export function normalizeOptions(options: ClassifierOption[]): Array<{ label: string; description?: string }> {
	return options.map((o) => (typeof o === 'string' ? { label: o } : o))
}

/** GBNF grammar that constrains generation to exactly one option letter. */
export function optionGrammar(count: number): string {
	const letters = OPTION_LETTERS.slice(0, count)
	return `root ::= ${letters.map((l) => `"${l}"`).join(' | ')}`
}

/**
 * Build the chat messages. The options live in the system message so every
 * run() against the same classifier shares a stable prompt prefix — the
 * server's prompt cache then only has to process the input tokens.
 */
export function buildMessages(systemPrompt: string, options: Array<{ label: string; description?: string }>, input: string) {
	const optionLines = options
		.map((o, i) => `${OPTION_LETTERS[i]}. ${o.label}${o.description ? ` — ${o.description}` : ''}`)
		.join('\n')
	return [
		{
			role: 'system',
			content: `${systemPrompt}\n\nOPTIONS:\n${optionLines}\n\nAnswer with only the single letter of the best option.`,
		},
		{ role: 'user', content: `INPUT:\n${input}` },
	]
}

/**
 * Turn the top_logprobs of the generated letter position into a probability
 * per label. Tokenizers sometimes emit the letter with leading whitespace, so
 * tokens are matched trimmed. Matched probabilities are renormalized to sum
 * to 1; options the model put outside the top-K get 0.
 */
export function probabilitiesFromLogprobs(
	topLogprobs: Array<{ token: string; logprob: number }>,
	options: Array<{ label: string }>,
	sampledToken?: string,
): Record<string, number> {
	const byLetter = new Map<string, number>()
	for (const entry of topLogprobs) {
		const letter = entry.token.trim()
		if (!byLetter.has(letter)) byLetter.set(letter, Math.exp(entry.logprob))
	}
	// Grammar-constrained servers can omit top_logprobs content — fall back to
	// certainty on whatever letter was actually sampled.
	if (byLetter.size === 0 && sampledToken) byLetter.set(sampledToken.trim(), 1)

	const raw = options.map((o, i) => byLetter.get(OPTION_LETTERS[i]!) ?? 0)
	const total = raw.reduce((a, b) => a + b, 0)
	if (total <= 0) {
		throw new Error('The model returned no probability mass on any option letter — check the model and prompt.')
	}
	const result: Record<string, number> = {}
	options.forEach((o, i) => { result[o.label] = raw[i]! / total })
	return result
}

/**
 * Zero-shot text classifier backed by a local llama-server. Configure it with
 * a system prompt and a set of options; run() returns a probability for every
 * option in a single forward pass.
 *
 * How it works: the options are presented as a lettered list, a GBNF grammar
 * forces the model to answer with exactly one letter token, and the logprobs
 * of that single position are read as the probability distribution over all
 * options — no sampling noise, no output parsing, one token generated.
 *
 * The classifier runs its own llama-server (default port 8145, Qwen3-4B
 * Instruct) so it never fights the default chat server over which model a
 * port serves. Weights download on first ensureReady().
 *
 * @example
 * ```typescript
 * const classifier = container.feature('zeroshotClassifier', {
 *   systemPrompt: 'Classify the customer message.',
 *   availableOptions: [
 *     { label: 'refund_request', description: 'wants money back' },
 *     { label: 'bug_report', description: 'something is broken' },
 *     'other',
 *   ],
 * })
 * const probabilities = await classifier.run('my order arrived broken, please send my money back')
 * // { refund_request: 0.93, bug_report: 0.06, other: 0.01 }
 * ```
 */
export class ZeroshotClassifier extends Feature<ZeroshotClassifierState, ZeroshotClassifierOptions> {
	static override description = 'Zero-shot text classification over arbitrary labels via a local llama-server, returning a probability per option from a single constrained forward pass.'
	static override stateSchema = ZeroshotClassifierStateSchema
	static override optionsSchema = ZeroshotClassifierOptionsSchema
	static override eventsSchema = ZeroshotClassifierEventsSchema
	static override shortcut = 'features.zeroshotClassifier' as const
	static override stability = 'experimental' as const
	static override category = 'ai-assistants' as const
	static { Feature.register(this, 'zeroshotClassifier') }

	/** The configured options, normalized to { label, description? }. */
	get availableOptions(): Array<{ label: string; description?: string }> {
		return normalizeOptions(this.options.availableOptions)
	}

	/** Absolute path of the classifier model's GGUF weights. */
	get modelPath(): string {
		return this.options.model.startsWith('/') ? this.options.model : chatModelPath(this.options.model)
	}

	/** The OpenAI-compatible base URL of the classifier server. */
	get baseURL(): string {
		return `http://127.0.0.1:${this.options.port}/v1`
	}

	/**
	 * Download the classifier model's weights if missing (delegates to the
	 * llamaServer feature's downloader) and ensure the server is healthy.
	 *
	 * @returns The OpenAI-compatible base URL of the classifier server
	 *
	 * @example
	 * ```typescript
	 * await container.feature('zeroshotClassifier').ensureReady()
	 * ```
	 */
	async ensureReady(): Promise<string> {
		const llama = this.container.feature('llamaServer')
		if (!llama.binaryInstalled) await llama.downloadBinary()
		if (CHAT_MODEL_SOURCES[this.options.model]) await llama.downloadChatModel(this.options.model)
		return this.ensureServer()
	}

	/**
	 * Classify an input against the configured options.
	 *
	 * @param input - The text to classify
	 * @returns Probability per option label, summing to 1
	 *
	 * @example
	 * ```typescript
	 * const probabilities = await classifier.run('this app crashes on launch')
	 * // { refund_request: 0.04, bug_report: 0.95, other: 0.01 }
	 * ```
	 */
	async run(input: string): Promise<Record<string, number>> {
		return (await this.classify(input)).probabilities
	}

	/**
	 * Classify an input and return the winning label alongside the full
	 * distribution.
	 *
	 * @param input - The text to classify
	 *
	 * @example
	 * ```typescript
	 * const { label, probability } = await classifier.classify('where is my refund??')
	 * ```
	 */
	async classify(input: string): Promise<ClassificationResult> {
		const options = this.availableOptions
		if (options.length < 2) throw new Error('zeroshotClassifier needs at least 2 availableOptions.')
		if (options.length > OPTION_LETTERS.length) {
			throw new Error(`zeroshotClassifier supports at most ${OPTION_LETTERS.length} options (top_logprobs caps at 20).`)
		}

		const baseURL = await this.ensureServer()
		const response = await fetch(`${baseURL}/chat/completions`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				model: this.options.model,
				messages: buildMessages(this.options.systemPrompt, options, input),
				max_tokens: 1,
				temperature: 0,
				grammar: optionGrammar(options.length),
				logprobs: true,
				top_logprobs: 20,
			}),
		})
		if (!response.ok) {
			const body = await response.text().catch(() => '')
			throw new Error(`Classification request failed: HTTP ${response.status} ${body.slice(0, 300)}`)
		}
		const json = await response.json() as {
			choices?: Array<{
				message?: { content?: string }
				logprobs?: { content?: Array<{ token: string; logprob: number; top_logprobs?: Array<{ token: string; logprob: number }> }> }
			}>
		}
		const choice = json.choices?.[0]
		const position = choice?.logprobs?.content?.[0]
		const probabilities = probabilitiesFromLogprobs(
			position?.top_logprobs ?? [],
			options,
			position?.token ?? choice?.message?.content ?? undefined,
		)

		let label = options[0]!.label
		for (const [key, value] of Object.entries(probabilities)) {
			if (value > probabilities[label]!) label = key
		}
		const result: ClassificationResult = { label, probability: probabilities[label]!, probabilities }
		this.emit('classified', { input, probabilities, label })
		return result
	}

	// ── Internals ─────────────────────────────────────────────────────

	private async ensureServer(): Promise<string> {
		const baseURL = await ensureServerProcess({
			modelPath: this.modelPath,
			port: this.options.port,
			contextSize: this.options.contextSize,
			readyTimeoutMs: this.options.readyTimeoutMs,
			idleTimeoutMs: this.options.idleTimeoutMs,
		})
		this.state.set('serverRunning', true)
		return baseURL
	}
}

export default ZeroshotClassifier
