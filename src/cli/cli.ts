#!/usr/bin/env bun
import container from '@soederpop/luca/agi'
import '@/commands/index.js'
import { homedir } from 'os'
import { join } from 'path'

async function main() {
	// Load project-level CLI module (luca.cli.ts) for container customization
	await loadCliModule()
	// Discover project-local commands (commands/ or src/commands/)
	await discoverProjectCommands()
	// Discover user-level commands (~/.luca/commands/)
	await discoverUserCommands()
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

	const mod = await import(modulePath)
	const exports = mod.default || mod

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
			await container.commands.discover({ directory: dir })
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
