import { z } from 'zod'
import { commands } from '../command.js'
import { CommandOptionsSchema } from '../schemas/base.js'
import type { ContainerContext } from '../container.js'

declare module '../command.js' {
	interface AvailableCommands {
		chat: ReturnType<typeof commands.registerHandler>
	}
}

export const argsSchema = CommandOptionsSchema.extend({})

export default async function chat(_options: z.infer<typeof argsSchema>, context: ContainerContext) {
	const container = context.container as any

	const expert = container.feature('expert', {
		folder: 'codebase',
		name: 'luca-codebase-expert',
	})

	await expert.start()

	expert.conversation!.on('preview', (chunk: string) => {
		console.clear()
		console.log(container.ui.markdown(chunk))
	})

	expert.conversation!.on('toolCall', (name: string, _args: any) => {
		console.log(container.ui.markdown(`\n> **Running skill:** \`${name}\`\n`))
	})

	expert.conversation!.on('toolResult', (name: string, _result: string) => {
		console.log(container.ui.markdown(`\n> **Skill result:** \`${name}\` returned\n`))
	})

	expert.conversation!.on('toolError', (name: string, err: any) => {
		console.log(container.ui.markdown(`\n> **Skill error:** \`${name}\` — ${err}\n`))
	})

	while (true) {
		const { question } = await container.ui.askQuestion('?')
		const result = await expert.ask(question)
		console.clear()
		console.log(container.ui.markdown(result))
	}
}

commands.registerHandler('chat', {
	description: 'Interactive chat with the codebase expert',
	argsSchema,
	handler: chat,
})
