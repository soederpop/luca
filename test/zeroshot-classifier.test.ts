import { describe, it, expect } from 'bun:test'
import {
	OPTION_LETTERS,
	normalizeOptions,
	optionGrammar,
	buildMessages,
	probabilitiesFromLogprobs,
} from '../src/node/features/zeroshot-classifier.js'

describe('zeroshotClassifier helpers', () => {
	it('normalizes mixed string/object options', () => {
		expect(normalizeOptions(['spam', { label: 'ham', description: 'not spam' }])).toEqual([
			{ label: 'spam' },
			{ label: 'ham', description: 'not spam' },
		])
	})

	it('builds a grammar of exactly the option letters', () => {
		expect(optionGrammar(3)).toBe('root ::= "A" | "B" | "C"')
	})

	it('puts options in the system message and input in the user message', () => {
		const messages = buildMessages('Classify it.', [{ label: 'spam' }, { label: 'ham', description: 'not spam' }], 'hello')
		expect(messages[0]!.role).toBe('system')
		expect(messages[0]!.content).toContain('A. spam')
		expect(messages[0]!.content).toContain('B. ham — not spam')
		expect(messages[1]).toEqual({ role: 'user', content: 'INPUT:\nhello' })
	})

	it('turns letter logprobs into a normalized distribution', () => {
		const probs = probabilitiesFromLogprobs(
			[
				{ token: 'A', logprob: Math.log(0.6) },
				{ token: ' B', logprob: Math.log(0.3) }, // leading-space token variant
				{ token: 'C', logprob: Math.log(0.1) },
				{ token: 'the', logprob: Math.log(0.9) }, // non-option noise is ignored
			],
			[{ label: 'x' }, { label: 'y' }, { label: 'z' }],
		)
		expect(probs.x).toBeCloseTo(0.6)
		expect(probs.y).toBeCloseTo(0.3)
		expect(probs.z).toBeCloseTo(0.1)
		expect(probs.x! + probs.y! + probs.z!).toBeCloseTo(1)
	})

	it('gives missing options zero and renormalizes the rest', () => {
		const probs = probabilitiesFromLogprobs(
			[{ token: 'A', logprob: Math.log(0.5) }, { token: 'B', logprob: Math.log(0.25) }],
			[{ label: 'x' }, { label: 'y' }, { label: 'z' }],
		)
		expect(probs.x).toBeCloseTo(2 / 3)
		expect(probs.y).toBeCloseTo(1 / 3)
		expect(probs.z).toBe(0)
	})

	it('falls back to the sampled token when no logprobs come back', () => {
		const probs = probabilitiesFromLogprobs([], [{ label: 'x' }, { label: 'y' }], 'B')
		expect(probs).toEqual({ x: 0, y: 1 })
	})

	it('throws when nothing matches any option', () => {
		expect(() => probabilitiesFromLogprobs([{ token: 'Q', logprob: -1 }], [{ label: 'x' }, { label: 'y' }])).toThrow()
	})

	it('has 20 distinct option letters', () => {
		expect(new Set(OPTION_LETTERS).size).toBe(20)
	})
})
