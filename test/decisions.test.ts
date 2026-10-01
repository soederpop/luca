import { describe, it, expect, afterEach } from 'bun:test'
import {
	choice,
	yesNo,
	score,
	validateQuestions,
	toSystemOneRequest,
	fromSystemOneAnswer,
	weightedScore,
	argmax,
	MAX_QUESTIONS,
} from '../src/node/features/decisions.js'
import { NodeContainer } from '../src/node/container'

describe('decisions helpers', () => {
	it('builds typed questions', () => {
		expect(choice('Which?', { a: 'A', b: 'B' })).toEqual({ type: 'choice', instructions: 'Which?', criteria: { a: 'A', b: 'B' } })
		expect(yesNo('Is it?')).toEqual({ type: 'yesNo', instructions: 'Is it?' })
		expect(score('How bad?', ['low', 'high'])).toEqual({ type: 'score', instructions: 'How bad?', criteria: ['low', 'high'] })
	})

	it('rejects empty sets, too many questions, and bad criteria counts', () => {
		expect(() => validateQuestions({})).toThrow('at least one')
		const many = Object.fromEntries(Array.from({ length: MAX_QUESTIONS + 1 }, (_, i) => [`q${i}`, yesNo('x')]))
		expect(() => validateQuestions(many)).toThrow('at most')
		expect(() => validateQuestions({ c: choice('x', { only: 'one' }) })).toThrow('2–26')
		expect(() => validateQuestions({ s: score('x', ['one']) })).toThrow('2–26')
		expect(() => validateQuestions({ s: yesNo('  ') })).toThrow('empty instructions')
	})

	it('maps yesNo to the Jev `noul` type and score criteria to an ordered object', () => {
		const req = toSystemOneRequest('nimble', 'state', {
			label: choice('Which?', { bug: 'Software errors' }),
			urgent: yesNo('Urgent?'),
			sev: score('Severity?', ['cosmetic', ['outage', 'Everything is down']]),
		})
		expect(req.model).toBe('nimble')
		expect(req.state).toBe('state')
		expect(req.questions.label).toEqual({ type: 'choice', instructions: 'Which?', criteria: { bug: 'Software errors' } })
		expect(req.questions.urgent).toEqual({ type: 'noul', instructions: 'Urgent?' })
		expect(req.questions.sev).toEqual({
			type: 'score',
			instructions: 'Severity?',
			criteria: { cosmetic: 'cosmetic', outage: 'Everything is down' },
		})
		expect(Object.keys(req.questions.sev!.criteria!)).toEqual(['cosmetic', 'outage'])
	})

	it('computes a normalized weighted score', () => {
		expect(weightedScore(['a', 'b', 'c'], { a: 1 })).toBe(0)
		expect(weightedScore(['a', 'b', 'c'], { c: 1 })).toBe(1)
		expect(weightedScore(['a', 'b', 'c'], { a: 0.5, c: 0.5 })).toBeCloseTo(0.5)
		expect(argmax({ a: 0.2, b: 0.7, c: 0.1 })).toBe('b')
	})

	it('normalizes choice answers, deriving missing fields from the distribution', () => {
		const q = choice('Which?', { a: 'A', b: 'B' })
		const full = fromSystemOneAnswer(q, { type: 'choice', choice: 'b', probabilities: { a: 0.1, b: 0.9 }, confidence: 0.8 }, 0.5)
		expect(full).toEqual({ type: 'choice', choice: 'b', probabilities: { a: 0.1, b: 0.9 }, confidence: 0.8 })
		const sparse = fromSystemOneAnswer(q, { probabilities: { a: 0.3, b: 0.7 } }, 0.5)
		expect(sparse.type === 'choice' && sparse.choice).toBe('b')
		expect(sparse.type === 'choice' && sparse.confidence).toBe(0.7)
	})

	it('normalizes yes/no answers against the threshold', () => {
		const q = yesNo('Urgent?')
		expect(fromSystemOneAnswer(q, { probability: 0.91 }, 0.5)).toEqual({ type: 'yesNo', value: true, probability: 0.91 })
		expect(fromSystemOneAnswer(q, { probability: 0.6 }, 0.75)).toEqual({ type: 'yesNo', value: false, probability: 0.6 })
		expect(fromSystemOneAnswer(q, { probabilities: { true: 0.2, false: 0.8 } }, 0.5)).toEqual({ type: 'yesNo', value: false, probability: 0.2 })
		expect(() => fromSystemOneAnswer(q, {}, 0.5)).toThrow('without a probability')
	})

	it('normalizes score answers from a distribution or a raw score', () => {
		const q = score('Severity?', ['cosmetic', 'degraded', 'outage'])
		const fromDist = fromSystemOneAnswer(q, { probabilities: { cosmetic: 0.1, degraded: 0.2, outage: 0.7 } }, 0.5)
		expect(fromDist.type).toBe('score')
		if (fromDist.type === 'score') {
			expect(fromDist.label).toBe('outage')
			expect(fromDist.score).toBeCloseTo((0.2 * 1 + 0.7 * 2) / 2)
		}
		const indexScale = fromSystemOneAnswer(q, { score: 2 }, 0.5)
		if (indexScale.type === 'score') {
			expect(indexScale.score).toBe(1)
			expect(indexScale.label).toBe('outage')
		}
		expect(() => fromSystemOneAnswer(q, {}, 0.5)).toThrow('neither a score nor a distribution')
	})

	it('fails loudly on a missing answer', () => {
		expect(() => fromSystemOneAnswer(yesNo('x'), undefined, 0.5)).toThrow('no answer')
	})
})

describe('decisions feature', () => {
	const realFetch = globalThis.fetch
	afterEach(() => { globalThis.fetch = realFetch })

	it('posts to /v1/systemone and returns typed answers per key', async () => {
		const seen: Array<{ url: string; body: any }> = []
		globalThis.fetch = (async (url: any, init: any) => {
			seen.push({ url: String(url), body: JSON.parse(init.body) })
			return new Response(JSON.stringify({
				model: 'nimble',
				answers: {
					label: { type: 'choice', choice: 'bug', probabilities: { billing: 0.01, bug: 0.98, account: 0.01 }, confidence: 0.89 },
					urgent: { type: 'noul', probability: 0.93 },
					severity: { type: 'score', probabilities: { cosmetic: 0.05, degraded: 0.15, outage: 0.8 } },
				},
				usage: { input_tokens: 174, output_tokens: 3 },
			}), { headers: { 'content-type': 'application/json' } })
		}) as any

		const container = new NodeContainer()
		const d = container.feature('decisions', { baseURL: 'http://decisions.test:11434/' })
		const events: any[] = []
		d.on('decided', (e: any) => events.push(e))

		const r = await d.decide('Checkout has returned 500 errors since 9am.', {
			label: d.choice('Which label fits?', { billing: 'Payments', bug: 'Software errors', account: 'Login' }),
			urgent: d.yesNo('Needs a response within the hour.'),
			severity: d.score('How severe?', ['cosmetic', 'degraded', 'outage']),
		})

		expect(seen).toHaveLength(1)
		expect(seen[0]!.url).toBe('http://decisions.test:11434/v1/systemone')
		expect(seen[0]!.body.model).toBe('nimble')
		expect(seen[0]!.body.questions.urgent.type).toBe('noul')

		expect(r.label.choice).toBe('bug')
		expect(r.label.confidence).toBe(0.89)
		expect(r.urgent.value).toBe(true)
		expect(r.urgent.probability).toBe(0.93)
		expect(r.severity.label).toBe('outage')
		expect(r.severity.score).toBeCloseTo((0.15 + 1.6) / 2)

		expect(events).toHaveLength(1)
		expect(events[0].backend).toBe('native')
		expect(d.state.get('lastBackend')).toBe('native')
		expect(d.state.get('decisionsMade')).toBe(1)
	})

	it('explains a 404 as a missing endpoint and does not fall back by default', async () => {
		globalThis.fetch = (async () => new Response('not found', { status: 404 })) as any
		const container = new NodeContainer()
		const d = container.feature('decisions', { baseURL: 'http://decisions.test:11434' })
		await expect(d.decide('x', { q: d.yesNo('y') })).rejects.toThrow('Ollama 0.35+')
	})

	it('decideMany keeps input order', async () => {
		globalThis.fetch = (async (_url: any, init: any) => {
			const body = JSON.parse(init.body)
			const p = body.state === 'spam!' ? 0.95 : 0.05
			return new Response(JSON.stringify({ answers: { spam: { probability: p } } }))
		}) as any
		const container = new NodeContainer()
		const d = container.feature('decisions', { baseURL: 'http://decisions.test:11434' })
		const results = await d.decideMany(['hello', 'spam!', 'hi again'], { spam: d.yesNo('Unsolicited marketing.') }, 2)
		expect(results.map((r) => r.spam.value)).toEqual([false, true, false])
	})
})
