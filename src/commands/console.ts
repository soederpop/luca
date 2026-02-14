import { z } from 'zod'
import { commands } from '../command.js'
import { CommandOptionsSchema } from '../schemas/base.js'
import type { ContainerContext } from '../container.js'

declare module '../command.js' {
	interface AvailableCommands {
		console: ReturnType<typeof commands.registerHandler>
	}
}

export const argsSchema = CommandOptionsSchema.extend({})

export default async function lucaConsole(_options: z.infer<typeof argsSchema>, context: ContainerContext) {
	const container = context.container as any
	const ui = container.feature('ui')

	const featureContext: Record<string, any> = {}
	for (const name of container.features.available) {
		try {
			featureContext[name] = container.feature(name)
		} catch {}
	}

	const prompt = ui.colors.cyan('luca') + ui.colors.dim(' > ')

	console.log()
	console.log(ui.colors.dim('  Luca REPL — all container features in scope. Tab to autocomplete.'))
	console.log(ui.colors.dim('  Type .exit to quit.'))
	console.log()

	const repl = container.feature('repl', { prompt })
	await repl.start({
		context: {
			...featureContext,
			console,
			setTimeout,
			setInterval,
			clearTimeout,
			clearInterval,
			fetch,
			Bun,
		},
	})
}

commands.registerHandler('console', {
	description: 'Start an interactive REPL with all container features in scope',
	argsSchema,
	handler: lucaConsole,
})
