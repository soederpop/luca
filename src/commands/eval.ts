import { z } from 'zod'
import { commands } from '../command.js'
import { CommandOptionsSchema } from '../schemas/base.js'
import type { ContainerContext } from '../container.js'

declare module '../command.js' {
	interface AvailableCommands {
		eval: ReturnType<typeof commands.registerHandler>
	}
}

export const argsSchema = CommandOptionsSchema.extend({
	json: z.boolean().default(false).describe('Serialize output as JSON'),
})

export default async function evalCommand(options: z.infer<typeof argsSchema>, context: ContainerContext) {
	const container = context.container as any

	await container.helpers.discoverAll()
	
	const args = container.argv._ as string[]
	// args[0] is "eval", the rest is the code snippet
	const code = args.slice(1).join(' ')

	if (!code.trim()) {
		console.error('Usage: luca eval "<code>" [--json]')
		return
	}

	const vm = container.feature('vm')

	// Build context with container and all enabled feature instances
	const ctx: Record<string, any> = { container }
	for (const [name, instance] of Object.entries(container.enabledFeatures ?? {})) {
		ctx[name] = instance
	}

	const result = await vm.run(code, ctx)

	if (options.json) {
		console.log(JSON.stringify(result, null, 2))
	} else {
		console.log(result)
	}
}

commands.registerHandler('eval', {
	description: 'Evaluate a JavaScript/TypeScript expression with the container in scope',
	argsSchema,
	handler: evalCommand,
})
