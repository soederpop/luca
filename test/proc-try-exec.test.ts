import { describe, it, expect } from 'bun:test'
import { NodeContainer } from '../src/node/container'

/**
 * Tests for proc.tryExec / proc.execJson — the async, real-shell exec variants.
 *
 * tryExec: shell quoting works, never throws, non-zero exit is data.
 * execJson: parses stdout as JSON, throws loudly on failure or bad JSON.
 */
describe('proc.tryExec', () => {
	const container = new NodeContainer()
	const proc = container.feature('proc')

	it('runs through a real shell so quoted arguments survive', async () => {
		const result = await proc.tryExec('echo "two words"')
		expect(result.exitCode).toBe(0)
		expect(result.stdout.trim()).toBe('two words')
	})

	it('supports shell features like pipes and substitution', async () => {
		const result = await proc.tryExec('printf "a\\nb\\nc" | wc -l')
		expect(result.exitCode).toBe(0)
		expect(parseInt(result.stdout.trim(), 10)).toBe(2)
	})

	it('never throws — non-zero exit comes back as data', async () => {
		const result = await proc.tryExec('sh -c "echo oops >&2; exit 3"')
		expect(result.exitCode).toBe(3)
		expect(result.stderr.trim()).toBe('oops')
	})

	it('never throws even for a nonexistent command', async () => {
		const result = await proc.tryExec('definitely-not-a-real-command-xyz')
		expect(result.exitCode).not.toBe(0)
	})

	it('respects the cwd option', async () => {
		const result = await proc.tryExec('pwd', { cwd: '/tmp' })
		expect(result.exitCode).toBe(0)
		// macOS /tmp is a symlink to /private/tmp
		expect(result.stdout.trim().endsWith('/tmp')).toBe(true)
	})
})

describe('proc.execJson', () => {
	const container = new NodeContainer()
	const proc = container.feature('proc')

	it('parses JSON stdout', async () => {
		const value = await proc.execJson<{ x: number }>(`echo '{"x": 1}'`)
		expect(value.x).toBe(1)
	})

	it('throws on non-zero exit with stderr in the message', async () => {
		let error: Error | null = null
		try {
			await proc.execJson('sh -c "echo broken >&2; exit 2"')
		} catch (e: any) {
			error = e
		}
		expect(error).not.toBeNull()
		expect(error!.message).toContain('exit code 2')
		expect(error!.message).toContain('broken')
	})

	it('throws on unparseable stdout with a snippet in the message', async () => {
		let error: Error | null = null
		try {
			await proc.execJson('echo this-is-not-json')
		} catch (e: any) {
			error = e
		}
		expect(error).not.toBeNull()
		expect(error!.message).toContain('not valid JSON')
		expect(error!.message).toContain('this-is-not-json')
	})
})

describe('proc.execSync', () => {
	const container = new NodeContainer()
	const proc = container.feature('proc')

	it('is a synchronous alias of exec', () => {
		expect(proc.execSync('echo hello')).toBe(proc.exec('echo hello'))
		expect(proc.execSync('echo hello')).toBe('hello')
	})
})
