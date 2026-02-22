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
		printHelp()
		process.exit(1)
	}
}

function printHelp() {
	const ui = container.feature('ui') as any
	const c = ui.colors

	console.error(ui.banner('luca', { font: 'Small Slant', colors: ['cyan', 'blue', 'magenta'] }))
	console.error(c.dim('  Lightweight Universal Conversational Architecture'))
	console.error()
	console.error(c.white('  Usage: ') + c.cyan('luca') + c.dim(' <command|file>'))
	console.error()
	console.error(c.white('  Commands:'))
	console.error()

	for (const name of container.commands.available) {
		const Cmd = container.commands.lookup(name) as any
		const desc = Cmd.commandDescription || ''
		console.error(`  ${c.cyan(name.padEnd(16))}${c.dim(desc)}`)
	}

	console.error()
	console.error(c.dim('  Run ') + c.cyan('luca <file>') + c.dim(' to execute a script directly.'))
	console.error()
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

async function discoverUserCommands() {
	const { fs } = container
	const dir = join(homedir(), '.luca', 'commands')

	if (fs.exists(dir)) {
		await container.commands.discover({ directory: dir })
	}
}

main()
