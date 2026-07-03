import { describe, it, expect } from 'bun:test'
import { NodeContainer } from '../src/node/container'

/**
 * Regression tests for spawnAndCapture/execAndCapture exit codes.
 *
 * Previously childProcess.exitCode was read BEFORE awaiting process
 * completion, so the returned exitCode was always 0 regardless of the
 * child's actual exit status — `if (result.exitCode === 0)` was always
 * true and callers had to dig the real code out of error.code.
 */
describe('proc exit codes', () => {
	const container = new NodeContainer()
	const proc = container.feature('proc')

	it('reports 0 for a successful command', async () => {
		const result = await proc.spawnAndCapture('true', [])
		expect(result.exitCode).toBe(0)
		expect(result.error).toBeNull()
	})

	it('reports the real nonzero exit code for a failing command', async () => {
		const result = await proc.spawnAndCapture('sh', ['-c', 'exit 3'])
		expect(result.exitCode).toBe(3)
		expect(result.error).not.toBeNull()
	})

	it('execAndCapture surfaces the nonzero exit code too', async () => {
		const result = await proc.execAndCapture('false')
		expect(result.exitCode).toBe(1)
	})

	it('onExit receives the settled exit code, not a premature 0', async () => {
		let seen: number | null = null
		await proc.spawnAndCapture('sh', ['-c', 'exit 7'], {
			onExit: (code: number) => { seen = code },
		})
		expect(seen).toBe(7)
	})

	it('still captures output from failing commands', async () => {
		const result = await proc.spawnAndCapture('sh', ['-c', 'echo out; echo err >&2; exit 2'])
		expect(result.stdout.trim()).toBe('out')
		expect(result.stderr.trim()).toBe('err')
		expect(result.exitCode).toBe(2)
	})
})
