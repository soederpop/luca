import { z } from 'zod'
import { commands } from '../command.js'
import { CommandOptionsSchema } from '../schemas/base.js'
import type { ContainerContext } from '../container.js'
import { createWorkbenchHost } from '../workbench/host.js'
// @ts-ignore — bun resolves JSON imports at bundle time
import pkg from '../../package.json'

declare module '../command.js' {
	interface AvailableCommands {
		workbench: ReturnType<typeof commands.registerHandler>
	}
}

export const argsSchema = CommandOptionsSchema.extend({})

/**
 * Starts the workbench host for the current project and talks to its parent over stdio.
 * stdout: one JSON line `{"port":N,"token":"..."}`, nothing else. Logs go to stderr.
 * The process exits when stdin closes, so the parent app owns its lifetime.
 */
export default async function workbench(_options: z.infer<typeof argsSchema>, context: ContainerContext) {
	const container = context.container as any

	const host = await createWorkbenchHost(container, { lucaVersion: String((pkg as any).version || '0.0.0') })
	process.stdout.write(JSON.stringify({ port: host.port, token: host.token }) + '\n')
	console.error(`[workbench] listening on 127.0.0.1:${host.port} for ${container.cwd}`)

	let shuttingDown = false
	const shutdown = async () => {
		if (shuttingDown) return
		shuttingDown = true
		try { await host.close() } catch {}
		process.exit(0)
	}

	// A crash still ends the command children, never only the host.
	process.on('exit', () => host.killChildren())
	process.stdin.on('end', shutdown)
	process.stdin.on('close', shutdown)
	process.stdin.on('error', shutdown)
	process.on('SIGINT', shutdown)
	process.on('SIGTERM', shutdown)
	process.stdin.resume()

	// Keep the command alive until shutdown() calls process.exit.
	await new Promise(() => {})
}

export const examples = [
	{ command: 'luca workbench', description: 'Start the workbench host; prints {"port","token"} on the first line, exits when stdin closes' },
]

commands.registerHandler('workbench', {
	description: 'Start the workbench host: a token-guarded 127.0.0.1 HTTP + WebSocket API over this project\'s container',
	argsSchema,
	examples,
	handler: workbench,
})
