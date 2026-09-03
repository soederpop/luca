import { describe, it, expect } from 'bun:test'
import { NodeContainer } from '../src/node/container'

/**
 * readOnly: true opens the session with default_transaction_read_only=on via
 * the libpq `options` startup parameter and disables execute() locally.
 * Bun's SQL client connects lazily, so these tests need no running server.
 */
describe('postgres readOnly option', () => {
	const url = 'postgres://user@localhost:5432/testdb'

	it('appends the read-only startup parameter to the connection URL', () => {
		const pg = new NodeContainer().feature('postgres', { url, readOnly: true })
		const stateUrl = decodeURIComponent(pg.state.current.url)
		expect(stateUrl).toContain('options=-c default_transaction_read_only=on')
	})

	it('preserves options the caller already set on the URL', () => {
		const pg = new NodeContainer().feature('postgres', {
			url: `${url}?options=${encodeURIComponent('-c statement_timeout=5000')}`,
			readOnly: true,
		})
		const stateUrl = decodeURIComponent(pg.state.current.url)
		expect(stateUrl).toContain('-c statement_timeout=5000 -c default_transaction_read_only=on')
	})

	it('leaves the URL untouched without readOnly', () => {
		const pg = new NodeContainer().feature('postgres', { url })
		expect(pg.state.current.url).toBe(url)
	})

	it('execute() throws immediately on a read-only instance', async () => {
		const pg = new NodeContainer().feature('postgres', { url, readOnly: true })
		await expect(pg.execute('DELETE FROM users')).rejects.toThrow(/read-only/)
	})
})
