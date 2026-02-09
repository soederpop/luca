#!/usr/bin/env bun
import container from '@/agi'
import * as commands from './commands'

async function main() {
	const command = container.argv._[0] as keyof typeof commands;
	const arg = container.argv._[1];

	if (command && typeof commands[command] === 'function') {
		await commands[command]()
	} else {
		console.error(`Unknown command: ${String(command)}`);
		process.exit(1);
	}
}


main()