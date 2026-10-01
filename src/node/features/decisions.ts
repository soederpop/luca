import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from '../../schemas/base.js'
import { Feature } from '../feature.js'

declare module 'luca/feature' {
	interface AvailableFeatures {
		decisions: typeof Decisions
	}
}

// ── Schemas ─────────────────────────────────────────────────────────

export const DecisionsOptionsSchema = FeatureOptionsSchema.extend({
	baseURL: z.string().default('http://127.0.0.1:11434').describe('Root URL of an Ollama (or other Jev-compatible) server. The decision endpoint is POST {baseURL}/v1/systemone. Falls back to the LUCA_DECISIONS_BASE_URL env var'),
	model: z.string().default('nimble').describe('Decision model to ask. Ollama ships `nimble` (9B, ~9.5GB, needs a 16GB+ machine), `tev1` (4B, ~4.5GB) and `tev1:0.8b` (~800MB, runs anywhere)'),
	apiKey: z.string().optional().describe('Bearer token for the decision endpoint (falls back to the LUCA_DECISIONS_API_KEY env var). Local Ollama needs none'),
	provider: z.string().optional().describe('A modelProviders profile id to resolve baseURL/apiKey from (AGI containers only). Ignored when baseURL is set explicitly'),
	fallback: z.enum(['none', 'classifier']).default('none').describe('What to do when no decision model answers. `classifier` emulates every question with the zeroshotClassifier feature (a one-token logprob pass on a plain instruct model) — same API, lower accuracy, no new downloads'),
	classifier: z.record(z.string(), z.unknown()).default({}).describe('Options forwarded to the zeroshotClassifier feature when the fallback is used (model, baseURL, port, provider, …)'),
	yesNoThreshold: z.number().min(0).max(1).default(0.5).describe('Probability at or above which a yesNo answer resolves to true'),
	timeoutMs: z.number().default(30_000).describe('Per-request timeout for the decision endpoint'),
})

export const DecisionsStateSchema = FeatureStateSchema.extend({
	lastBackend: z.enum(['native', 'classifier']).optional().describe('Which backend answered the most recent decide() call'),
	decisionsMade: z.number().default(0).describe('Count of successful decide() calls this process'),
})

export const DecisionsEventsSchema = FeatureEventsSchema.extend({
	decided: z.tuple([z.object({
		state: z.string().describe('The input state the questions were asked about'),
		backend: z.enum(['native', 'classifier']).describe('Which backend produced the answers'),
		answers: z.record(z.string(), z.unknown()).describe('Answer per question key'),
		durationMs: z.number().describe('Wall-clock time of the call'),
	}).describe('Decision result')]).describe('After every successful decide()'),
	fallback: z.tuple([z.object({
		reason: z.string().describe('Why the native endpoint was abandoned'),
	}).describe('Fallback trigger')]).describe('When a decide() call falls back to the classifier emulation'),
}).describe('Decision feature events')

export type DecisionsOptions = z.infer<typeof DecisionsOptionsSchema>
export type DecisionsState = z.infer<typeof DecisionsStateSchema>

// ── Questions ───────────────────────────────────────────────────────

/** Criteria for a choice question: label → description. 2–26 entries. */
export type DecisionCriteria = Record<string, string>

export interface ChoiceQuestion {
	type: 'choice'
	instructions: string
	criteria: DecisionCriteria
}

export interface YesNoQuestion {
	type: 'yesNo'
	instructions: string
}

export interface ScoreQuestion {
	type: 'score'
	instructions: string
	/** Ordered lowest → highest. Each entry is a label, or a label → description pair. */
	criteria: Array<string | [label: string, description: string]>
}

export type DecisionQuestion = ChoiceQuestion | YesNoQuestion | ScoreQuestion

/** Jev wire limit: choice and score criteria take 2–26 entries (one letter each). */
export const MAX_CRITERIA = 26
/** Jev wire limit: questions per call. */
export const MAX_QUESTIONS = 64

// ── Answers ─────────────────────────────────────────────────────────

export interface ChoiceAnswer {
	type: 'choice'
	/** The winning criteria label. */
	choice: string
	/** Probability per label, summing to 1. */
	probabilities: Record<string, number>
	/** Model-reported confidence in the pick when the backend provides one, else the winner's probability. */
	confidence: number
}

export interface YesNoAnswer {
	type: 'yesNo'
	/** probability >= yesNoThreshold. */
	value: boolean
	/** Probability that the statement holds, 0–1. */
	probability: number
}

export interface ScoreAnswer {
	type: 'score'
	/** Probability-weighted position on the rubric, normalized to 0 (lowest) – 1 (highest). */
	score: number
	/** The single most likely rubric label. */
	label: string
	/** Probability per rubric label, summing to 1. */
	probabilities: Record<string, number>
}

export type DecisionAnswer = ChoiceAnswer | YesNoAnswer | ScoreAnswer

/** Maps a question to its answer type so decide() results are typed per key. */
export type AnswerFor<Q extends DecisionQuestion> =
	Q extends ChoiceQuestion ? ChoiceAnswer :
	Q extends YesNoQuestion ? YesNoAnswer :
	Q extends ScoreQuestion ? ScoreAnswer :
	never

export type AnswersFor<Q extends Record<string, DecisionQuestion>> = { [K in keyof Q]: AnswerFor<Q[K]> }

// ── Question builders (pure, exported for tests and for callers who skip the instance) ──

/**
 * A pick-one question. Criteria map a label to the description the model
 * reads; labels come back verbatim in the answer.
 */
export function choice(instructions: string, criteria: DecisionCriteria): ChoiceQuestion {
	return { type: 'choice', instructions, criteria }
}

/** A true/false question. Phrase it as a statement or a yes/no question. */
export function yesNo(instructions: string): YesNoQuestion {
	return { type: 'yesNo', instructions }
}

/** An ordered-rubric question. List criteria from lowest to highest. */
export function score(instructions: string, criteria: ScoreQuestion['criteria']): ScoreQuestion {
	return { type: 'score', instructions, criteria }
}

/** Normalize score criteria to an ordered label/description list. */
export function scoreLabels(criteria: ScoreQuestion['criteria']): Array<{ label: string; description: string }> {
	return criteria.map((c) => (typeof c === 'string' ? { label: c, description: c } : { label: c[0], description: c[1] }))
}

/** Throw a clear error if a question set breaks a wire limit. */
export function validateQuestions(questions: Record<string, DecisionQuestion>): void {
	const keys = Object.keys(questions)
	if (keys.length === 0) throw new Error('decide() needs at least one question.')
	if (keys.length > MAX_QUESTIONS) throw new Error(`decide() supports at most ${MAX_QUESTIONS} questions per call (got ${keys.length}).`)
	for (const key of keys) {
		const q = questions[key]!
		if (!q.instructions?.trim()) throw new Error(`Question "${key}" has empty instructions.`)
		if (q.type === 'choice') {
			const n = Object.keys(q.criteria).length
			if (n < 2 || n > MAX_CRITERIA) throw new Error(`Choice question "${key}" needs 2–${MAX_CRITERIA} criteria (got ${n}).`)
		} else if (q.type === 'score') {
			const n = q.criteria.length
			if (n < 2 || n > MAX_CRITERIA) throw new Error(`Score question "${key}" needs 2–${MAX_CRITERIA} ordered criteria (got ${n}).`)
		}
	}
}

// ── Wire adapter (the only place that knows the Jev / systemone shape) ──

/** Request body for POST /v1/systemone. */
export interface SystemOneRequest {
	model: string
	state: string
	questions: Record<string, { type: 'choice' | 'noul' | 'score'; instructions: string; criteria?: Record<string, string> }>
}

/**
 * Jev calls yes/no questions `noul`. Score criteria go over the wire as an
 * ordered object (JSON preserves insertion order for string keys), one entry
 * per rubric step, lowest first.
 */
export function toSystemOneRequest(model: string, state: string, questions: Record<string, DecisionQuestion>): SystemOneRequest {
	const wire: SystemOneRequest['questions'] = {}
	for (const [key, q] of Object.entries(questions)) {
		if (q.type === 'choice') wire[key] = { type: 'choice', instructions: q.instructions, criteria: q.criteria }
		else if (q.type === 'yesNo') wire[key] = { type: 'noul', instructions: q.instructions }
		else {
			const criteria: Record<string, string> = {}
			for (const { label, description } of scoreLabels(q.criteria)) criteria[label] = description
			wire[key] = { type: 'score', instructions: q.instructions, criteria }
		}
	}
	return { model, state, questions: wire }
}

/** The subset of a systemone response we read. Fields are defensive: the spec is young. */
export interface SystemOneResponse {
	model?: string
	answers?: Record<string, {
		type?: string
		choice?: string
		probability?: number
		probabilities?: Record<string, number>
		confidence?: number
		score?: number
		value?: unknown
	}>
	usage?: { input_tokens?: number; output_tokens?: number }
}

/** Highest-probability key of a distribution. */
export function argmax(probabilities: Record<string, number>): string {
	let best: string | undefined
	for (const [k, v] of Object.entries(probabilities)) {
		if (best === undefined || v > probabilities[best]!) best = k
	}
	if (best === undefined) throw new Error('Empty probability distribution.')
	return best
}

/**
 * Expected rubric position, normalized to 0–1. With labels L0..Ln-1 and
 * probabilities p, score = Σ p_i · i / (n - 1).
 */
export function weightedScore(labels: string[], probabilities: Record<string, number>): number {
	if (labels.length < 2) return 0
	let total = 0
	let acc = 0
	labels.forEach((label, i) => {
		const p = probabilities[label] ?? 0
		total += p
		acc += p * i
	})
	if (total <= 0) throw new Error('The score distribution has no probability mass on any rubric label.')
	return acc / total / (labels.length - 1)
}

/**
 * Normalize one systemone answer into our typed shape. Missing fields are
 * derived from the distribution where possible so a slightly different
 * server build still yields a usable answer.
 */
export function fromSystemOneAnswer(
	question: DecisionQuestion,
	raw: NonNullable<SystemOneResponse['answers']>[string] | undefined,
	yesNoThreshold: number,
): DecisionAnswer {
	if (!raw) throw new Error('The decision endpoint returned no answer for a question it was asked.')
	if (question.type === 'choice') {
		const probabilities = raw.probabilities ?? {}
		const pick = raw.choice ?? argmax(probabilities)
		return {
			type: 'choice',
			choice: pick,
			probabilities,
			confidence: raw.confidence ?? probabilities[pick] ?? 1,
		}
	}
	if (question.type === 'yesNo') {
		const probability =
			raw.probability ??
			raw.probabilities?.true ??
			raw.probabilities?.yes ??
			(typeof raw.value === 'boolean' ? (raw.value ? 1 : 0) : undefined)
		if (probability === undefined) throw new Error('The decision endpoint returned a yes/no answer without a probability.')
		return { type: 'yesNo', value: probability >= yesNoThreshold, probability }
	}
	const labels = scoreLabels(question.criteria).map((c) => c.label)
	const probabilities = raw.probabilities ?? {}
	const hasDistribution = Object.keys(probabilities).length > 0
	let normalized: number
	if (typeof raw.score === 'number') {
		// Servers may report the score on the rubric's index scale (0..n-1) or already normalized.
		normalized = raw.score > 1 ? raw.score / (labels.length - 1) : raw.score
	} else if (hasDistribution) {
		normalized = weightedScore(labels, probabilities)
	} else {
		throw new Error('The decision endpoint returned a score answer with neither a score nor a distribution.')
	}
	const label = hasDistribution ? argmax(probabilities) : labels[Math.round(normalized * (labels.length - 1))]!
	return { type: 'score', score: normalized, label, probabilities }
}

// ── Feature ─────────────────────────────────────────────────────────

/**
 * Ask a local decision model (Ollama `nimble` / `tev1` over the Jev-style
 * `/v1/systemone` endpoint) several typed questions about one piece of input
 * in a single forward pass. Decision models don't generate text: each
 * question comes back as a choice with probabilities, a yes/no probability,
 * or a weighted score on an ordered rubric. Use it for triage, routing,
 * moderation, and any "look at this and decide" step that would otherwise
 * be a chat call you have to parse.
 *
 * Expect a few hundred milliseconds per call on Apple Silicon for `nimble`
 * (9.5GB, 16GB+ RAM) and much less for `tev1:0.8b` (800MB). Ollama 0.35 or
 * newer is required for the endpoint.
 *
 * With `fallback: 'classifier'` the same questions are answered by the
 * zeroshotClassifier feature when the decision endpoint is unreachable —
 * a one-token logprob trick on a plain instruct model. Lower accuracy, but
 * the API and answer shapes are identical, so callers don't branch.
 *
 * @example
 * ```typescript
 * const d = container.feature('decisions', { model: 'nimble' })
 * const r = await d.decide('Checkout has returned 500 errors since 9am.', {
 *   label: d.choice('Which label fits this ticket?', {
 *     billing: 'Payments and refunds',
 *     bug: 'Software errors',
 *     account: 'Login and account access',
 *   }),
 *   urgent: d.yesNo('This needs a human response within the hour.'),
 *   severity: d.score('How severe is the impact?', ['cosmetic', 'degraded', 'outage']),
 * })
 * r.label.choice        // 'bug'
 * r.urgent.value        // true
 * r.severity.score      // 0.9
 * r.severity.label      // 'outage'
 * ```
 */
export class Decisions extends Feature<DecisionsState, DecisionsOptions> {
	static override description = 'Typed multi-question decisions (choice, yes/no, score) from a local decision model such as Ollama nimble over /v1/systemone, with optional zeroshotClassifier emulation.'
	static override stateSchema = DecisionsStateSchema
	static override optionsSchema = DecisionsOptionsSchema
	static override eventsSchema = DecisionsEventsSchema
	static override shortcut = 'features.decisions' as const
	static override stability = 'experimental' as const
	static override category = 'ai-assistants' as const
	static { Feature.register(this, 'decisions') }

	/** Build a pick-one question. See the module-level `choice()`. */
	choice = choice
	/** Build a true/false question. See the module-level `yesNo()`. */
	yesNo = yesNo
	/** Build an ordered-rubric question. See the module-level `score()`. */
	score = score

	/** The decision model name sent on every request. */
	get model(): string {
		return this.options.model
	}

	/** Root URL of the decision server (explicit option, else env, else local Ollama). */
	get baseURL(): string {
		return (process.env.LUCA_DECISIONS_BASE_URL ?? this.options.baseURL).replace(/\/$/, '')
	}

	/** Full URL of the decision endpoint. */
	get endpoint(): string {
		return `${this.baseURL}/v1/systemone`
	}

	/**
	 * Probe the decision server. Resolves true when it answers and the
	 * configured model is pulled, false otherwise. Never throws.
	 *
	 * @example
	 * ```typescript
	 * if (!(await d.isAvailable())) console.log('run: ollama pull nimble')
	 * ```
	 */
	async isAvailable(): Promise<boolean> {
		try {
			const { baseURL, apiKey } = await this.resolveEndpoint()
			const res = await fetch(`${baseURL}/api/tags`, {
				headers: apiKey ? { authorization: `Bearer ${apiKey}` } : {},
				signal: AbortSignal.timeout(2000),
			})
			if (!res.ok) return false
			const json = await res.json() as { models?: Array<{ name?: string; model?: string }> }
			const names = (json.models ?? []).flatMap((m) => [m.name, m.model]).filter(Boolean) as string[]
			return names.some((n) => n === this.model || n.split(':')[0] === this.model.split(':')[0])
		} catch {
			return false
		}
	}

	/**
	 * Ask every question about one state in a single call. Answers are typed
	 * per key from the question builders you passed.
	 *
	 * @param state - The input the questions are about (a ticket, a message, a game frame…)
	 * @param questions - Named questions built with choice()/yesNo()/score(); at most 64
	 *
	 * @example
	 * ```typescript
	 * const { route } = await d.decide(userMessage, {
	 *   route: d.choice('Which model should handle this?', {
	 *     fast: 'Short factual lookups and chit-chat',
	 *     deep: 'Multi-step reasoning, code, or long documents',
	 *   }),
	 * })
	 * const model = route.choice === 'deep' ? 'claude-opus-5-5' : 'claude-haiku-4-5-20251001'
	 * ```
	 */
	async decide<Q extends Record<string, DecisionQuestion>>(state: string, questions: Q): Promise<AnswersFor<Q>> {
		validateQuestions(questions)
		const started = Date.now()
		let answers: Record<string, DecisionAnswer>
		let backend: 'native' | 'classifier'
		try {
			answers = await this.decideNative(state, questions)
			backend = 'native'
		} catch (error) {
			if (this.options.fallback !== 'classifier') throw error
			const reason = error instanceof Error ? error.message : String(error)
			this.emit('fallback', { reason })
			answers = await this.decideWithClassifier(state, questions)
			backend = 'classifier'
		}
		this.state.set('lastBackend', backend)
		this.state.set('decisionsMade', (this.state.get('decisionsMade') ?? 0) + 1)
		this.emit('decided', { state, backend, answers, durationMs: Date.now() - started })
		return answers as AnswersFor<Q>
	}

	/**
	 * Ask the same questions about many states. Runs calls with bounded
	 * concurrency; results keep input order.
	 *
	 * @param states - Inputs to decide on
	 * @param questions - The shared question set
	 * @param concurrency - Parallel requests in flight (default 4)
	 *
	 * @example
	 * ```typescript
	 * const results = await d.decideMany(tickets.map(t => t.body), {
	 *   spam: d.yesNo('This message is unsolicited marketing.'),
	 * })
	 * const clean = tickets.filter((_, i) => !results[i]!.spam.value)
	 * ```
	 */
	async decideMany<Q extends Record<string, DecisionQuestion>>(states: string[], questions: Q, concurrency = 4): Promise<Array<AnswersFor<Q>>> {
		const results: Array<AnswersFor<Q>> = new Array(states.length)
		let next = 0
		const worker = async () => {
			while (next < states.length) {
				const i = next++
				results[i] = await this.decide(states[i]!, questions)
			}
		}
		await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, states.length)) }, worker))
		return results
	}

	// ── Internals ─────────────────────────────────────────────────────

	private async decideNative(state: string, questions: Record<string, DecisionQuestion>): Promise<Record<string, DecisionAnswer>> {
		const { baseURL, apiKey } = await this.resolveEndpoint()
		const body = toSystemOneRequest(this.model, state, questions)
		const response = await fetch(`${baseURL}/v1/systemone`, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
			},
			body: JSON.stringify(body),
			signal: AbortSignal.timeout(this.options.timeoutMs),
		})
		if (!response.ok) {
			const text = await response.text().catch(() => '')
			const hint = response.status === 404
				? ' (404: the server has no /v1/systemone — Ollama 0.35+ is required, or the model is not a decision model)'
				: ''
			throw new Error(`Decision request failed: HTTP ${response.status}${hint} ${text.slice(0, 300)}`)
		}
		const json = await response.json() as SystemOneResponse
		const answers: Record<string, DecisionAnswer> = {}
		for (const [key, q] of Object.entries(questions)) {
			answers[key] = fromSystemOneAnswer(q, json.answers?.[key], this.options.yesNoThreshold)
		}
		return answers
	}

	/**
	 * Emulate each question as a zeroshotClassifier run. Every question type
	 * is a multiple-choice over labels for a plain instruct model: yes/no is
	 * {yes, no}, score is the ordered rubric itself.
	 */
	private async decideWithClassifier(state: string, questions: Record<string, DecisionQuestion>): Promise<Record<string, DecisionAnswer>> {
		const answers: Record<string, DecisionAnswer> = {}
		for (const [key, q] of Object.entries(questions)) {
			if (q.type === 'choice') {
				const probabilities = await this.classify(state, q.instructions, Object.entries(q.criteria).map(([label, description]) => ({ label, description })))
				const pick = argmax(probabilities)
				answers[key] = { type: 'choice', choice: pick, probabilities, confidence: probabilities[pick]! }
			} else if (q.type === 'yesNo') {
				const probabilities = await this.classify(
					state,
					`${q.instructions}\n\nDecide whether the statement/question is true for the input.`,
					[{ label: 'yes', description: 'true / applies' }, { label: 'no', description: 'false / does not apply' }],
				)
				const probability = probabilities.yes ?? 0
				answers[key] = { type: 'yesNo', value: probability >= this.options.yesNoThreshold, probability }
			} else {
				const rubric = scoreLabels(q.criteria)
				const probabilities = await this.classify(
					state,
					`${q.instructions}\n\nThe options are an ordered scale from lowest to highest.`,
					rubric,
				)
				const labels = rubric.map((r) => r.label)
				answers[key] = { type: 'score', score: weightedScore(labels, probabilities), label: argmax(probabilities), probabilities }
			}
		}
		return answers
	}

	private async classify(state: string, systemPrompt: string, options: Array<{ label: string; description?: string }>): Promise<Record<string, number>> {
		if (options.length > 20) {
			throw new Error('The classifier fallback supports at most 20 criteria per question (top_logprobs caps at 20).')
		}
		const classifier = this.container.feature('zeroshotClassifier', {
			...(this.options.classifier as Record<string, unknown>),
			systemPrompt,
			availableOptions: options,
		})
		return classifier.run(state)
	}

	/** Explicit baseURL/env wins; else a modelProviders profile; else the default local Ollama. */
	private async resolveEndpoint(): Promise<{ baseURL: string; apiKey?: string }> {
		const apiKey = this.options.apiKey ?? process.env.LUCA_DECISIONS_API_KEY
		const envBaseURL = process.env.LUCA_DECISIONS_BASE_URL
		if (envBaseURL) return { baseURL: envBaseURL.replace(/\/$/, ''), apiKey }

		const defaultBaseURL = DecisionsOptionsSchema.shape.baseURL.parse(undefined)
		if (this.options.provider && this.options.baseURL === defaultBaseURL) {
			if (!this.container.features.available.includes('modelProviders')) {
				throw new Error('The provider option needs a container with the modelProviders feature (an AGI container). Use baseURL/apiKey instead.')
			}
			const resolved = await (this.container.feature('modelProviders' as any) as any).resolve({ provider: this.options.provider, model: this.model })
			if (!resolved.baseURL) throw new Error(`Provider "${this.options.provider}" resolved without a baseURL.`)
			// Provider profiles point at the OpenAI-compatible /v1 root; systemone hangs off the server root.
			return { baseURL: String(resolved.baseURL).replace(/\/v1\/?$/, '').replace(/\/$/, ''), apiKey: resolved.apiKey ?? apiKey }
		}

		return { baseURL: this.baseURL, apiKey }
	}
}

export default Decisions
