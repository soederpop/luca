#!/usr/bin/env bun
// @ts-ignore — bun resolves JSON imports at bundle time
import pkg from '../../package.json'
import { BUILD_SHA, BUILD_BRANCH, BUILD_DATE } from './build-info'

// Fast-path flags that don't need the container
const args = process.argv.slice(2)
if (args.includes('--version') || args.includes('-v')) {
	console.log(`luca v${pkg.version} (${BUILD_BRANCH}@${BUILD_SHA}) built ${BUILD_DATE}`)
	console.log(`  npm: https://www.npmjs.com/package/luca`)
	console.log(`  git: https://github.com/soederpop/luca`)
	process.exit(0)
}

// Internal entrypoint: the llama-server idle watchdog re-invokes luca with
// LUCA_INTERNAL set instead of exposing a CLI command. See ensureWatchdog()
// in src/node/features/llama-server.ts, which spawns this.
if (process.env.LUCA_INTERNAL === 'llama-watchdog') {
	const { runWatchdog } = await import('../node/features/llama-server.js')
	const outcome = await runWatchdog({
		port: Number(process.env.LUCA_WATCHDOG_PORT),
		idleMs: Number(process.env.LUCA_WATCHDOG_IDLE_MS || 900_000),
		pollMs: Number(process.env.LUCA_WATCHDOG_POLL_MS || 30_000),
		log: (message) => console.log(`[llama-watchdog] ${new Date().toISOString()} ${message}`),
	})
	console.log(`[llama-watchdog] exiting: ${outcome}`)
	process.exit(0)
}

import container from 'luca/agi'
import '@/commands/index.js'
import { runCli } from './runner.js'

await runCli(container, {
	binaryName: 'luca',
	onBeforeDispatch: (c: any) => {
		// Install a missing-command handler if userland hasn't.
		const existing = c.state.get('missingCommandHandler') as any
		if (typeof existing === 'function') return
		c.state.set('missingCommandHandler', async () => {
			c.argv._.splice(0, 0, 'help')
			await c.command('help' as any).dispatch()
		})
	},
})
