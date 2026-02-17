#!/usr/bin/env bun
import container from '@/agi'
import '@/commands/index.js'

async function main() {
	// Discover project-local commands (commands/ or src/commands/)
	await discoverProjectCommands()

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

main()
