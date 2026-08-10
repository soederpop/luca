import { describe, it, expect } from 'bun:test'
import {
	parseFenceMeta,
	normalizeEvalMode,
	resolveEvalMode,
	decideBlock,
	transpileBlock,
	sliceNodeSource,
} from '../src/commands/lib/markdown-eval.js'

describe('parseFenceMeta', () => {
	it('tokenizes whitespace-separated words, lowercased', () => {
		expect(parseFenceMeta('Skip SILENT title=x')).toEqual(new Set(['skip', 'silent', 'title=x']))
	})

	it('returns an empty set for non-strings and blank strings', () => {
		expect(parseFenceMeta(undefined).size).toBe(0)
		expect(parseFenceMeta(null).size).toBe(0)
		expect(parseFenceMeta('   ').size).toBe(0)
	})

	it('does NOT match substrings — the old .includes bug', () => {
		expect(parseFenceMeta('skip-this').has('skip')).toBe(false)
		expect(parseFenceMeta('noskip').has('skip')).toBe(false)
		expect(parseFenceMeta('file=skipper.ts').has('skip')).toBe(false)
	})
})

describe('normalizeEvalMode', () => {
	it('accepts canonical and forgiving spellings', () => {
		expect(normalizeEvalMode('all')).toBe('all')
		expect(normalizeEvalMode('ALL ')).toBe('all')
		expect(normalizeEvalMode('optIn')).toBe('optIn')
		expect(normalizeEvalMode('opt-in')).toBe('optIn')
		expect(normalizeEvalMode('opt_in')).toBe('optIn')
		expect(normalizeEvalMode('None')).toBe('none')
	})

	it('rejects everything else', () => {
		expect(normalizeEvalMode('yes')).toBeNull()
		expect(normalizeEvalMode(true)).toBeNull()
		expect(normalizeEvalMode(undefined)).toBeNull()
	})
})

describe('resolveEvalMode', () => {
	it('flag beats frontmatter beats fallback', () => {
		expect(resolveEvalMode({ flag: 'none', frontmatter: 'all', fallback: 'all' })).toBe('none')
		expect(resolveEvalMode({ frontmatter: 'optIn', fallback: 'none' })).toBe('optIn')
		expect(resolveEvalMode({ fallback: 'none' })).toBe('none')
	})

	it('reports invalid values and falls through', () => {
		const invalid: any[] = []
		const mode = resolveEvalMode({
			frontmatter: 'sometimes',
			fallback: 'none',
			onInvalid: (source, value) => invalid.push([source, value]),
		})
		expect(mode).toBe('none')
		expect(invalid).toEqual([['frontmatter', 'sometimes']])
	})

	it('an invalid flag falls through to valid frontmatter', () => {
		expect(resolveEvalMode({ flag: 'bogus', frontmatter: 'all', fallback: 'none' })).toBe('all')
	})
})

describe('decideBlock', () => {
	it('non-executable languages are always literal', () => {
		expect(decideBlock('markdown', undefined, 'all')).toBe('literal')
		expect(decideBlock(null, undefined, 'all')).toBe('literal')
		expect(decideBlock('python', 'eval', 'optIn')).toBe('literal')
	})

	it('skip token wins in every mode', () => {
		expect(decideBlock('ts', 'skip', 'all')).toBe('skip')
		expect(decideBlock('ts', 'eval skip', 'optIn')).toBe('skip')
		expect(decideBlock('ts', 'skip', 'none')).toBe('skip')
	})

	it('mode all executes plain executable fences', () => {
		expect(decideBlock('ts', undefined, 'all')).toBe('execute')
		expect(decideBlock('js', '', 'all')).toBe('execute')
	})

	it('mode optIn executes only eval-marked fences', () => {
		expect(decideBlock('ts', 'eval', 'optIn')).toBe('execute')
		expect(decideBlock('ts', undefined, 'optIn')).toBe('literal')
	})

	it('mode none never executes, even with an eval marker', () => {
		expect(decideBlock('ts', undefined, 'none')).toBe('literal')
		expect(decideBlock('ts', 'eval', 'none')).toBe('literal')
	})
})

describe('transpileBlock', () => {
	const calls: any[] = []
	const fakeTranspiler = {
		transformSync(source: string, opts: any) {
			calls.push(opts)
			return { code: `T(${source})` }
		},
	}

	it('strips ts types via esm, transforms tsx/jsx via cjs, leaves js raw', () => {
		calls.length = 0
		expect(transpileBlock(fakeTranspiler, 'ts', 'x')).toBe('T(x)')
		expect(calls[0]).toEqual({ loader: 'ts', format: 'esm' })

		expect(transpileBlock(fakeTranspiler, 'tsx', 'y')).toBe('T(y)')
		expect(calls[1]).toEqual({ loader: 'tsx', format: 'cjs' })

		expect(transpileBlock(fakeTranspiler, 'js', 'z')).toBe('z')
		expect(calls.length).toBe(2)
	})
})

describe('sliceNodeSource', () => {
	const raw = '# Title\n\n| a | b |\n|---|---|\n'

	it('prefers the verbatim raw slice', () => {
		const node = { position: { start: { offset: 9 }, end: { offset: raw.length - 1 } } }
		expect(sliceNodeSource(node, raw, () => 'stringified')).toBe('| a | b |\n|---|---|')
	})

	it('falls back to stringify without offsets, and to empty when stringify throws', () => {
		expect(sliceNodeSource({}, raw, () => 'stringified')).toBe('stringified')
		expect(sliceNodeSource({}, raw, () => { throw new Error('no GFM') })).toBe('')
	})
})
