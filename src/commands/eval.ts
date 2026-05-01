import { z } from 'zod'
import { commands } from '../command.js'
import { displayResult } from '../node/features/display-result.js'
import { CommandOptionsSchema } from '../schemas/base.js'
import type { ContainerContext } from '../container.js'

declare module '../command.js' {
	interface AvailableCommands {
		eval: ReturnType<typeof commands.registerHandler>
	}
}

export const argsSchema = CommandOptionsSchema.extend({
	json: z.boolean().default(false).describe('Serialize output as JSON'),
	enable: z.string().optional().describe('Enable a feature before evaluating (e.g. --enable diskCache)'),
})

export default async function evalCommand(options: z.infer<typeof argsSchema>, context: ContainerContext) {
	const container = context.container as any

	container.addContext('feature', (...args: any) => container.feature(...args))

	await container.helpers.discoverAll()
	
	const args = container.argv._ as string[]
	// args[0] is "eval", the rest is the code snippet
	let code = args.slice(1).join(' ')

	// Read from stdin if no inline code was provided
	if (!code.trim()) {
		code = await Bun.stdin.text()
	}

	if (!code.trim()) {
		console.error('Usage: luca eval "<code>" [--json]')
		return
	}

	const vm = container.feature('vm')

	// HACK
	Array(container.argv.enable).filter(Boolean).map((id) => {
		container.feature(id, { ...container.argv, enable: true }).enable()
	})

	// Build context with container and all enabled feature instances
	const ctx: Record<string, any> = { container }
	for (const [name, instance] of Object.entries(container.enabledFeatures ?? {})) {
		ctx[name] = instance
	}

	const result = await vm.run(code, ctx)

	if (options.json) {
		console.log(JSON.stringify(result, null, 2))
	} else {
		displayResult(result)
	}
}

export { displayResult } from '../node/features/display-result.js'

commands.registerHandler('eval', {
	description: 'Evaluate a JavaScript/TypeScript expression with the container in scope',
	argsSchema,
	handler: evalCommand,
})
