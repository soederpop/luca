import { z } from 'zod'
import { commands } from '../command.js'
import { CommandOptionsSchema } from '../schemas/base.js'
import type { ContainerContext } from '../container.js'

declare module '../command.js' {
	interface AvailableCommands {
		console: ReturnType<typeof commands.registerHandler>
	}
}

export const argsSchema = CommandOptionsSchema.extend({
	model: z.string().default('gpt-4o').describe('The model to use for the oracle'),
})

export default async function oracleConsole(options: z.infer<typeof argsSchema>, context: ContainerContext) {
	const container = context.container as any
	const model = options.model || container.argv.model || 'gpt-4o'

	const oracle = container.feature('oracle', { model })
	await oracle.start()
}

commands.registerHandler('console', {
	description: 'Start an interactive oracle console',
	argsSchema,
	handler: oracleConsole,
})
