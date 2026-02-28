import { z } from 'zod'
import { commands } from '../command.js'
import { CommandOptionsSchema } from '../schemas/base.js'
import type { ContainerContext } from '../container.js'
import { scaffolds } from '../scaffolds/generated.js'
import { generateScaffold, toCamelCase } from '../scaffolds/template.js'

declare module '../command.js' {
	interface AvailableCommands {
		scaffold: ReturnType<typeof commands.registerHandler>
	}
}

const validTypes = Object.keys(scaffolds)

export const argsSchema = CommandOptionsSchema.extend({
	description: z.string().optional().describe('Brief description of the helper'),
	output: z.string().optional().describe('Output file path (defaults to stdout)'),
	tutorial: z.boolean().default(false).describe('Show the full tutorial instead of generating code'),
})

export default async function scaffoldCommand(options: z.infer<typeof argsSchema>, context: ContainerContext) {
	const container = context.container as any
	const args = container.argv._ as string[]

	// args: ["scaffold", type?, name?]
	const type = args[1]
	const name = args[2]

	if (!type || !validTypes.includes(type)) {
		console.log(`Usage: luca scaffold <type> <name> [--description "..."] [--output path] [--tutorial]`)
		console.log(`\nTypes: ${validTypes.join(', ')}`)
		console.log(`\nExamples:`)
		console.log(`  luca scaffold feature diskCache --description "File-backed key-value cache"`)
		console.log(`  luca scaffold command deploy --output commands/deploy.ts`)
		console.log(`  luca scaffold endpoint healthCheck`)
		console.log(`  luca scaffold feature --tutorial`)
		return
	}

	// Tutorial mode — show the full scaffold doc
	if (options.tutorial) {
		const scaffold = scaffolds[type]
		if (scaffold?.tutorial) {
			const ui = container.feature('ui')
			console.log(ui.markdown(scaffold.tutorial))
		} else {
			console.log(`No tutorial available for type: ${type}`)
		}
		return
	}

	if (!name) {
		console.log(`Usage: luca scaffold ${type} <name> [--description "..."] [--output path]`)
		return
	}

	const code = generateScaffold(type, name, options.description)

	if (!code) {
		console.log(`No scaffold template available for type: ${type}`)
		return
	}

	// Write to file or stdout
	if (options.output) {
		const fs = container.feature('fs')
		await fs.writeFileAsync(options.output, code)
		console.log(`Wrote ${type} scaffold to ${options.output}`)
	} else {
		console.log(code)
	}
}

commands.registerHandler('scaffold', {
	description: 'Generate boilerplate for a new luca feature, client, server, command, or endpoint',
	argsSchema,
	handler: scaffoldCommand,
})
