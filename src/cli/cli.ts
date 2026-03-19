#!/usr/bin/env bun
// @ts-ignore — bun resolves JSON imports at bundle time
import pkg from '../../package.json'

// Fast-path flags that don't need the container
const args = process.argv.slice(2)
if (args.includes('--version') || args.includes('-v')) {
	console.log(`luca v${pkg.version}`)
	console.log(`  npm: https://www.npmjs.com/package/@soederpop/luca`)
	console.log(`  git: https://github.com/soederpop/luca`)
	process.exit(0)
}

import container from '@soederpop/luca/agi'
import '@/commands/index.js'
import { homedir } from 'os'
import { join } from 'path'

async function main() {
	const profile = process.env.LUCA_PROFILE === '1'
	const t = (label?: string) => {
		if (!profile) return () => {}
		const start = performance.now()
		return (suffix?: string) => {
			const ms = (performance.now() - start).toFixed(1)
			console.error(`[profile] ${label}${suffix ? ` ${suffix}` : ''}: ${ms}ms`)
		}
	}

	const tTotal = t('total boot')

	// LUCA_COMMAND_DISCOVERY: "disable" skips all, "no-local" skips project, "no-home" skips user
	const discovery = process.env.LUCA_COMMAND_DISCOVERY || ''

	// Snapshot built-in commands BEFORE loadCliModule — luca.cli.ts may call
	// helpers.discoverAll() which registers project commands early
	const builtinCommands = new Set(container.commands.available as string[])

	// Load project-level CLI module (luca.cli.ts) for container customization
	let done = t('loadCliModule')
	await loadCliModule()
	done()

	// Discover project-local commands (commands/ or src/commands/)
	done = t('discoverProjectCommands')
	if (discovery !== 'disable' && discovery !== 'no-local') {
		await discoverProjectCommands()
	}
	done()
	const afterProject = new Set(container.commands.available as string[])
	const projectCommands = new Set([...afterProject].filter((n) => !builtinCommands.has(n)))

	// Discover user-level commands (~/.luca/commands/)
	done = t('discoverUserCommands')
	if (discovery !== 'disable' && discovery !== 'no-home') {
		await discoverUserCommands()
	}
	done()
	const afterUser = new Set(container.commands.available as string[])
	const userCommands = new Set([...afterUser].filter((n) => !builtinCommands.has(n) && !projectCommands.has(n)))

	// Store command sources for help display
	;(container as any)._commandSources = { builtinCommands, projectCommands, userCommands }

	// Load generated introspection data if present
	done = t('loadProjectIntrospection')
	await loadProjectIntrospection()
	done()

	const commandName = container.argv._[0] as string

	done = t('dispatch')
	if (container.argv.help && !commandName) {
		// --help with no command is the same as `luca` with no args
		// Clear the help flag so the help command's handler runs (not the --help intercept)
		delete container.argv.help
		container.argv._.splice(0, 0, 'help')
		const cmd = container.command('help' as any)
		await cmd.dispatch()
	} else if (commandName && container.commands.has(commandName)) {
		const cmd = container.command(commandName as any)
		await cmd.dispatch()
	} else if (commandName) {
		// not a known command — treat as implicit `run`
		container.argv._.splice(0, 0, 'run')
		const cmd = container.command('run' as any)
		await cmd.dispatch()
	} else {
		container.argv._.splice(0, 0, 'help')
		const cmd = container.command('help' as any)
		await cmd.dispatch()
	}
	done()
	tTotal()
}


async function loadCliModule() {
	const modulePath = container.paths.resolve('luca.cli.ts')
	if (!container.fs.exists(modulePath)) return

	// Use the helpers feature to load the module — it handles the native import
	// vs VM decision using the same useNativeImport check as discovery
	const helpers = container.feature('helpers') as any
	const exports = await helpers.loadModuleExports(modulePath)

	if (typeof exports?.main === 'function') {
		await exports.main(container)
	}

	if (typeof exports?.onStart === 'function') {
		container.once('started', () => exports.onStart(container))
	}
}

async function discoverProjectCommands() {
	// Always route through the helpers feature — it handles native import vs VM
	// internally, and deduplicates concurrent/repeated discovery via promise caching.
	// If luca.cli.ts already called helpers.discoverAll(), this resolves instantly.
	const helpers = container.feature('helpers') as any
	await helpers.discover('commands')
}

async function loadProjectIntrospection() {
	const candidates = [
		'features/introspection.generated.ts',
		'src/introspection.generated.ts',
		'introspection.generated.ts',
	]

	for (const candidate of candidates) {
		const filePath = container.paths.resolve(candidate)
		if (container.fs.exists(filePath)) {
			try {
				await import(filePath)
			} catch {
				// Generated file may be stale or malformed — skip silently
			}
			return
		}
	}
}

async function discoverUserCommands() {
	const dir = join(homedir(), '.luca', 'commands')

	if (container.fs.exists(dir)) {
		// Route through helpers for consistent dedup and VM/native handling
		const helpers = container.feature('helpers') as any
		await helpers.discover('commands', { directory: dir })
	}
}

main()
