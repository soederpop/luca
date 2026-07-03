import { describe, it, expect } from 'bun:test'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { tmpdir } from 'node:os'

/**
 * Regression test: `luca run <doc.md>` used to crash with
 * "Cannot handle unknown node 'table'" when a runnable doc contained a GFM
 * table, because prose nodes were re-serialized through contentbase's
 * toMarkdown (which lacks the GFM extensions). The runner now renders prose
 * from raw source slices, so GFM constructs are safe in runnable docs.
 */
describe('luca run markdown with GFM content', () => {
	it('runs a doc containing a table and executes its code blocks', async () => {
		const dir = mkdtempSync(join(tmpdir(), 'luca-run-gfm-'))
		const docPath = join(dir, 'table-doc.md')
		writeFileSync(docPath, [
			'---',
			'title: gfm table regression',
			'---',
			'',
			'# Table doc',
			'',
			'| Option | Notes |',
			'|--------|-------|',
			'| a      | first |',
			'| b      | ~~second~~ |',
			'',
			'```ts',
			"console.log('BLOCK_RAN_OK')",
			'```',
			'',
		].join('\n'))

		try {
			const cli = resolve(import.meta.dir, '..', 'src', 'cli', 'cli.ts')
			const proc = Bun.spawn(['bun', 'run', cli, 'run', docPath], {
				cwd: resolve(import.meta.dir, '..'),
				stdout: 'pipe',
				stderr: 'pipe',
			})
			const exitCode = await proc.exited
			const stdout = await new Response(proc.stdout).text()
			const stderr = await new Response(proc.stderr).text()

			expect(stdout).toContain('BLOCK_RAN_OK')
			expect(stdout + stderr).not.toContain("Cannot handle unknown node")
			expect(exitCode).toBe(0)
		} finally {
			rmSync(dir, { recursive: true, force: true })
		}
	}, 30000)
})
