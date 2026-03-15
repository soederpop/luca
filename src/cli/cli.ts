#!/usr/bin/env bun
import container from '@soederpop/luca/agi'
import '@/commands/index.js'
import { homedir } from 'os'
import { join } from 'path'
import { existsSync } from 'fs'

/** True when node_modules exists in the project root — package imports are resolvable natively */
function hasNodeModules(): boolean {
	return existsSync(container.paths.resolve('node_modules'))
}

async function main() {
	// Load project-level CLI module (luca.cli.ts) for container customization
	await loadCliModule()

	// LUCA_COMMAND_DISCOVERY: "disable" skips all, "no-local" skips project, "no-home" skips user
	const discovery = process.env.LUCA_COMMAND_DISCOVERY || ''

	// Snapshot built-in commands before discovering external ones
	const builtinCommands = new Set(container.commands.available as string[])

	// Discover project-local commands (commands/ or src/commands/)
	if (discovery !== 'disable' && discovery !== 'no-local') {
		await discoverProjectCommands()
	}
	const afterProject = new Set(container.commands.available as string[])
	const projectCommands = new Set([...afterProject].filter((n) => !builtinCommands.has(n)))

	// Discover user-level commands (~/.luca/commands/)
	if (discovery !== 'disable' && discovery !== 'no-home') {
		await discoverUserCommands()
	}
	const afterUser = new Set(container.commands.available as string[])
	const userCommands = new Set([...afterUser].filter((n) => !builtinCommands.has(n) && !projectCommands.has(n)))

	// Store command sources for help display
	;(container as any)._commandSources = { builtinCommands, projectCommands, userCommands }

	// Load generated introspection data if present
	await loadProjectIntrospection()

	const commandName = container.argv._[0] as string

	if (commandName && container.commands.has(commandName)) {
		const cmd = container.command(commandName as any)
		await cmd.run()
	} else if (commandName) {
		// not a known command — treat as implicit `run`
		container.argv._.splice(0, 0, 'run')
		const cmd = container.command('run' as any)
		await cmd.run()
	} else {
		container.argv._.splice(0, 0, 'help')
		const cmd = container.command('help' as any)
		await cmd.run()
	}
}


async function loadCliModule() {
	const modulePath = container.paths.resolve('luca.cli.ts')
	if (!container.fs.exists(modulePath)) return

	let exports: any

	if (hasNodeModules()) {
		const mod = await import(modulePath)
		exports = mod.default || mod
	} else {
		// Use VM to load luca.cli.ts so it can resolve @soederpop/luca etc.
		const helpers = container.feature('helpers') as any
		helpers.seedVirtualModules?.()
		const vm = container.feature('vm') as any
		exports = vm.loadModule(modulePath)
	}

	if (typeof exports.main === 'function') {
		await exports.main(container)
	}

	if (typeof exports.onStart === 'function') {
		container.once('started', () => exports.onStart(container))
	}
}

async function discoverProjectCommands() {
	const { fs, paths } = container

	for (const candidate of ['commands', 'src/commands']) {
		const dir = paths.resolve(candidate)
		if (fs.exists(dir)) {
			if (hasNodeModules()) {
				await container.commands.discover({ directory: dir })
			} else {
				// Route through helpers feature for VM-based loading
				const helpers = container.feature('helpers') as any
				await helpers.discover('commands', { directory: dir })
			}
			return
		}
	}
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
	const { fs } = container
	const dir = join(homedir(), '.luca', 'commands')

	if (fs.exists(dir)) {
		await container.commands.discover({ directory: dir })
	}
}

main()
