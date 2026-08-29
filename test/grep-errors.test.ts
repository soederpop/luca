import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { NodeContainer } from '../src/node/container'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

/**
 * Tests for the grep feature's new error contract, maxResults semantics,
 * and before/after context parsing.
 *
 * Old behavior: every failure (bad regex, missing path) was swallowed into [],
 * indistinguishable from zero matches. New contract: exit code 1 = no matches
 * = []; any other non-zero exit throws with stderr in the message.
 */

// Fixture tree lives in a throwaway temp dir, never in the project
let fixtureDir: string

beforeAll(() => {
	fixtureDir = mkdtempSync(join(tmpdir(), 'luca-grep-test-'))
	// Three files, each with multiple 'needle' matches — used to prove
	// maxResults caps the TOTAL, not per-file
	for (const name of ['a.txt', 'b.txt', 'c.txt']) {
		writeFileSync(
			join(fixtureDir, name),
			'needle one\nneedle two\nneedle three\nneedle four\n'
		)
	}
	// A file with known context lines around a single match
	writeFileSync(
		join(fixtureDir, 'context.txt'),
		'line1\nline2\nline3\nMATCH_HERE\nline5\nline6\nline7\n'
	)
	// A subdir to prove searches recurse (and be excluded from context tests)
	mkdirSync(join(fixtureDir, 'sub'))
	writeFileSync(join(fixtureDir, 'sub', 'd.txt'), 'needle five\n')
})

afterAll(() => {
	rmSync(fixtureDir, { recursive: true, force: true })
})

describe('grep error contract', () => {
	const container = new NodeContainer()
	const grep = container.feature('grep')

	it('returns [] for genuinely zero matches', async () => {
		const results = await grep.search({ pattern: 'zzqq_not_present_anywhere', path: fixtureDir })
		expect(results).toEqual([])
	})

	it('throws on an invalid regex instead of returning []', async () => {
		let error: Error | null = null
		try {
			await grep.search({ pattern: '(unclosed', path: fixtureDir })
		} catch (e: any) {
			error = e
		}
		expect(error).not.toBeNull()
		expect(error!.message).toContain('grep search failed')
	})

	it('throws on a nonexistent search path instead of returning []', async () => {
		let error: Error | null = null
		try {
			await grep.search({ pattern: 'needle', path: '/not/a/real/dir/at/all' })
		} catch (e: any) {
			error = e
		}
		expect(error).not.toBeNull()
		expect(error!.message).toContain('grep search failed')
	})

	it('count throws too instead of returning a confident 0', async () => {
		let threw = false
		try {
			await grep.count('(unclosed', { path: fixtureDir })
		} catch {
			threw = true
		}
		expect(threw).toBe(true)
	})

	it('filesContaining throws on bad patterns as well', async () => {
		let threw = false
		try {
			await grep.filesContaining('(unclosed', { path: fixtureDir })
		} catch {
			threw = true
		}
		expect(threw).toBe(true)
	})
})

describe('grep maxResults', () => {
	const container = new NodeContainer()
	const grep = container.feature('grep')

	it('caps the TOTAL number of results, not per-file', async () => {
		// 3 files x 4 matches + 1 in sub — the old --max-count behavior
		// would have returned up to 2 per file (8 results)
		const results = await grep.search({ pattern: 'needle', path: fixtureDir, maxResults: 2 })
		expect(results.length).toBe(2)
	})

	it('returns everything when under the cap', async () => {
		const results = await grep.search({ pattern: 'needle', path: fixtureDir, maxResults: 100 })
		expect(results.length).toBe(13) // 3 files x 4 + 1 in sub
	})
})

describe('grep context lines', () => {
	const container = new NodeContainer()
	const grep = container.feature('grep')

	it('attaches before and after context to matches', async () => {
		const results = await grep.search({
			pattern: 'MATCH_HERE',
			path: join(fixtureDir, 'context.txt'),
			before: 2,
			after: 2,
		})
		expect(results.length).toBe(1)
		expect(results[0]!.content).toBe('MATCH_HERE')
		expect(results[0]!.before).toEqual(['line2', 'line3'])
		expect(results[0]!.after).toEqual(['line5', 'line6'])
	})

	it('attaches only the requested side', async () => {
		const results = await grep.search({
			pattern: 'MATCH_HERE',
			path: join(fixtureDir, 'context.txt'),
			after: 1,
		})
		expect(results.length).toBe(1)
		expect(results[0]!.after).toEqual(['line5'])
		expect(results[0]!.before).toBeUndefined()
	})

	it('omits context arrays entirely when no context was requested', async () => {
		const results = await grep.search({
			pattern: 'MATCH_HERE',
			path: join(fixtureDir, 'context.txt'),
		})
		expect(results.length).toBe(1)
		expect(results[0]!.before).toBeUndefined()
		expect(results[0]!.after).toBeUndefined()
	})

	it('works on single files (filename is forced in output)', async () => {
		// rg omits the filename for a single explicit file unless forced,
		// which used to silently break the parser
		const results = await grep.search({
			pattern: 'MATCH_HERE',
			path: join(fixtureDir, 'context.txt'),
		})
		expect(results.length).toBe(1)
		expect(results[0]!.line).toBe(4)
	})
})
