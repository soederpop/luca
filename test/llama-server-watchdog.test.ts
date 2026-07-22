import { describe, expect, it, beforeEach, afterEach } from 'bun:test'
import { mkdtempSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseMetricsActivity, runWatchdog } from '../src/node/features/llama-server'

// Fake llama-server exposing /health and mutable /metrics counters.
function startFakeServer() {
	const state = { promptTokens: 0, processing: 0, up: true }
	const server = Bun.serve({
		port: 0,
		fetch(req) {
			if (!state.up) return new Response('down', { status: 503 })
			const url = new URL(req.url)
			if (url.pathname === '/health') return new Response('{"status":"ok"}')
			if (url.pathname === '/metrics') {
				return new Response(
					'# HELP llamacpp:prompt_tokens_total Number of prompt tokens processed.\n' +
					'# TYPE llamacpp:prompt_tokens_total counter\n' +
					`llamacpp:prompt_tokens_total ${state.promptTokens}\n` +
					`llamacpp:requests_processing ${state.processing}\n`
				)
			}
			return new Response('not found', { status: 404 })
		},
	})
	return { server, state, port: server.port }
}

let savedHome: string | undefined
beforeEach(() => {
	savedHome = process.env.LUCA_HOME
	process.env.LUCA_HOME = mkdtempSync(join(tmpdir(), 'luca-watchdog-'))
})
afterEach(() => {
	if (savedHome === undefined) delete process.env.LUCA_HOME
	else process.env.LUCA_HOME = savedHome
})

describe('parseMetricsActivity', () => {
	it('sums _total counters and reads the processing gauge', () => {
		const activity = parseMetricsActivity(
			'# HELP llamacpp:prompt_tokens_total tokens\n' +
			'llamacpp:prompt_tokens_total 120\n' +
			'llamacpp:tokens_predicted_total 30\n' +
			'llamacpp:requests_processing 2\n' +
			'llamacpp:kv_cache_usage_ratio 0.5\n'
		)
		expect(activity.counterSum).toBe(150)
		expect(activity.processing).toBe(2)
	})

	it('handles labeled metrics and ignores garbage lines', () => {
		const activity = parseMetricsActivity('foo_total{model="x"} 7\nnot a metric\n')
		expect(activity.counterSum).toBe(7)
		expect(activity.processing).toBe(0)
	})
})

describe('runWatchdog', () => {
	it('stops an idle server after the idle window', async () => {
		const { server, port } = startFakeServer()
		try {
			// No pid file for the fake server — stopServerOnPort is a no-op, but the
			// watchdog's decision and exit reason are what we're testing.
			const outcome = await runWatchdog({ port, idleMs: 250, pollMs: 50 })
			expect(outcome).toBe('stopped-idle')
			// The watchdog cleaned up its own pid file.
			expect(existsSync(join(process.env.LUCA_HOME!, `llama-watchdog-${port}.pid`))).toBe(false)
		} finally {
			server.stop(true)
		}
	})

	it('counter movement resets the idle clock', async () => {
		const { server, state, port } = startFakeServer()
		try {
			const started = Date.now()
			// Bump the request counter for a while, then go quiet.
			const bumper = setInterval(() => { state.promptTokens += 10 }, 40)
			setTimeout(() => clearInterval(bumper), 400)
			const outcome = await runWatchdog({ port, idleMs: 250, pollMs: 50 })
			const elapsed = Date.now() - started
			expect(outcome).toBe('stopped-idle')
			// Must have outlived the activity period plus a full idle window.
			expect(elapsed).toBeGreaterThanOrEqual(600)
		} finally {
			server.stop(true)
		}
	})

	it('exits when the server disappears', async () => {
		const { server, port } = startFakeServer()
		setTimeout(() => server.stop(true), 150)
		const outcome = await runWatchdog({ port, idleMs: 60_000, pollMs: 50 })
		expect(outcome).toBe('server-gone')
	})

	it('refuses to double-watch a port', async () => {
		const { server, port } = startFakeServer()
		try {
			// A live pid (this test process) already owns the watchdog pid file.
			writeFileSync(join(process.env.LUCA_HOME!, `llama-watchdog-${port}.pid`), String(process.pid))
			const outcome = await runWatchdog({ port, idleMs: 60_000, pollMs: 50 })
			expect(outcome).toBe('already-watched')
		} finally {
			server.stop(true)
		}
	})
})
