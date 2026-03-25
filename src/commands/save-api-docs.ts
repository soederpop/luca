import { z } from 'zod'
import { commands } from '../command.js'
import { CommandOptionsSchema } from '../schemas/base.js'
import type { ContainerContext } from '../container.js'

declare module '../command.js' {
	interface AvailableCommands {
		introspect: ReturnType<typeof commands.registerHandler>
	}
}

export const argsSchema = CommandOptionsSchema.extend({ 
	outputPath: z.string().default('docs/luca').describe('The path to save generated API docs to')
})

export async function apiDocs(options: z.infer<typeof argsSchema>, context: ContainerContext) {
	const { container } = context
	await container.helpers.discoverAll()
	const outputFolder = options.outputPath ? container.paths.resolve(options.outputPath) : container.paths.resolve('docs','luca')

	await container.fs.ensureFolder(
		outputFolder
	)

	const mkPath = (...args) => container.paths.resolve(outputFolder, ...args)

	const result = await container.fs.writeFileAsync(mkPath('agi-container.md'), container.introspectAsText())

	for(let reg of ['features','clients','servers']) {
		const helperIds = container[reg].available
		const folder = mkPath(reg) 
		await container.fs.ensureFolder(folder)

		await Promise.all(
			helperIds.map((helperId) => container.fs.writeFileAsync(
				container.paths.resolve(folder, `${helperId}.md`),
				container[reg].describe(helperId)
			))
		)
	}

	container.ui.print.green(`Finished saving API Docs`)
}

commands.registerHandler('api-docs', {
	description: 'Save the helper introspection() content as markdown API docs in docs/luca',
	argsSchema,
	handler: apiDocs,
})
