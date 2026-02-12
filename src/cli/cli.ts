#!/usr/bin/env bun
import container from '@/agi'
import '@/commands/index.js'

async function main() {
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
		console.error('Usage: luca <command|file>\n')
		console.error('Available commands:')
		for (const name of container.commands.available) {
			const Cmd = container.commands.lookup(name) as any
			const desc = Cmd.commandDescription || ''
			console.error(`  ${name.padEnd(12)} ${desc}`)
		}
		process.exit(1)
	}
}

main()
