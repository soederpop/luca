import { z } from 'zod'
import { commands } from '../command.js'
import { CommandOptionsSchema } from '../schemas/base.js'
import type { ContainerContext } from '../container.js'
import { runWatchdog, DEFAULT_IDLE_TIMEOUT_MS } from '../node/features/llama-server.js'

declare module '../command.js' {
	interface AvailableCommands {
		'llama-watchdog': ReturnType<typeof commands.registerHandler>
	}
}

export const argsSchema = CommandOptionsSchema.extend({
	port: z.number().describe('Port of the llama-server to watch'),
	'idle-ms': z.number().default(DEFAULT_IDLE_TIMEOUT_MS).describe('Stop the server after this long with no requests (default 15 minutes)'),
	'poll-ms': z.number().default(30_000).describe('How often to poll the server /metrics for activity'),
})

/**
 * Internal: the detached idle watchdog behind local llama-server processes.
 * Spawned automatically whenever luca ensures a local server — you should not
 * need to run it yourself. Polls the server's /metrics request counters and
 * stops the server once they have been still for the idle window, so an
 * unused local model does not hog memory.
 */
export default async function llamaWatchdog(options: z.infer<typeof argsSchema>, _context: ContainerContext) {
	const outcome = await runWatchdog({
		port: options.port,
		idleMs: options['idle-ms'],
		pollMs: options['poll-ms'],
		log: (message) => console.log(`[llama-watchdog] ${new Date().toISOString()} ${message}`),
	})
	console.log(`[llama-watchdog] exiting: ${outcome}`)
}

commands.registerHandler('llama-watchdog', {
	description: 'Internal: idle watchdog that stops an unused local llama-server (spawned automatically; 15-minute default window)',
	argsSchema,
	examples: [
		{ command: 'luca llama-watchdog --port 8143', description: 'Watch the local chat server with the default 15-minute idle window' },
	],
	handler: llamaWatchdog,
})
