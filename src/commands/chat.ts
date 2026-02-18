import { z } from 'zod'
import * as readline from 'readline'
import { commands } from '../command'
import { CommandOptionsSchema } from '../schemas/base'
import type { ContainerContext } from '../container'

declare module '../command.js' {
	interface AvailableCommands {
		chat: ReturnType<typeof commands.registerHandler>
	}
}

export const argsSchema = CommandOptionsSchema.extend({
	model: z.string().optional().describe('Override the LLM model for the assistant'),
	folder: z.string().default('assistants').describe('Directory containing assistant definitions'),
})

export default async function chat(options: z.infer<typeof argsSchema>, context: ContainerContext) {
	const container = context.container as any
	const ui = container.feature('ui')

	const manager = container.feature('assistantsManager', { folder: options.folder })
	manager.discover()

	const entries = manager.list()

	if (entries.length === 0) {
		console.error(ui.colors.red('No assistants found.'))
		console.error(ui.colors.dim(`  Create an assistant directory in "${options.folder}/" with a CORE.md file.`))
		process.exit(1)
	}

	const requestedName = container.argv._[1] as string | undefined
	let name: string

	if (requestedName) {
		const entry = manager.get(requestedName)
		if (!entry) {
			const available = entries.map((e: any) => e.name).join(', ')
			console.error(ui.colors.red(`Assistant "${requestedName}" not found.`))
			console.error(ui.colors.dim(`  Available: ${available}`))
			process.exit(1)
		}
		name = requestedName
	} else if (entries.length === 1) {
		name = entries[0].name
	} else {
		const answers = await ui.wizard([
			{
				type: 'list',
				name: 'assistant',
				message: 'Choose an assistant',
				choices: entries.map((e: any) => ({ name: e.name, value: e.name })),
			},
		])
		name = answers.assistant
	}

	const createOptions: Record<string, any> = {}
	if (options.model) createOptions.model = options.model

	const assistant = manager.create(name, createOptions)

	let isFirstChunk = true

	assistant.on('chunk', (text: string) => {
		if (isFirstChunk) {
			process.stdout.write('\n')
			isFirstChunk = false
		}
		process.stdout.write(text)
	})

	assistant.on('toolCall', (toolName: string, args: any) => {
		const argsStr = JSON.stringify(args).slice(0, 120)
		process.stdout.write(ui.colors.dim(`\n  ⟳ ${toolName}`) + ui.colors.dim(`(${argsStr})\n`))
	})

	assistant.on('toolResult', (toolName: string, result: any) => {
		const preview = typeof result === 'string' ? result.slice(0, 100) : JSON.stringify(result).slice(0, 100)
		process.stdout.write(ui.colors.green(`  ✓ ${toolName}`) + ui.colors.dim(` → ${preview}${preview.length >= 100 ? '…' : ''}\n`))
	})

	assistant.on('toolError', (toolName: string, error: any) => {
		const msg = error?.message || String(error)
		process.stdout.write(ui.colors.red(`  ✗ ${toolName}: ${msg}\n`))
	})

	assistant.on('response', () => {
		process.stdout.write('\n')
		isFirstChunk = true
	})

	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	})

	function prompt(): Promise<string> {
		return new Promise((resolve) => {
			rl.question(ui.colors.dim(`\n${name} > `), (answer: string) => resolve(answer.trim()))
		})
	}

	console.log()
	console.log(ui.colors.dim(`  Chatting with ${ui.colors.cyan(name)}. Type .exit to quit.`))
	console.log()

	while (true) {
		const question = await prompt()

		if (!question) continue
		if (question === '.exit') break

		await assistant.ask(question)
	}

	rl.close()
}

commands.registerHandler('chat', {
	description: 'Start an interactive chat session with a local assistant',
	argsSchema,
	handler: chat,
})
