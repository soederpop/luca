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
	local: z.boolean().default(false).describe('Whether to use a local API server'),
	resume: z.string().optional().describe('Thread ID or conversation ID to resume'),
	list: z.boolean().optional().describe('List recent conversations and exit'),
	historyMode: z.enum(['lifecycle', 'daily', 'persistent', 'session']).optional().describe('Override history persistence mode'),
	offRecord: z.boolean().optional().describe('Alias for --history-mode lifecycle (ephemeral, no persistence)'),
	clear: z.boolean().optional().describe('Clear the conversation history for the resolved history mode and exit'),
})

export default async function chat(options: z.infer<typeof argsSchema>, context: ContainerContext) {
	const container = context.container as any
	const ui = container.feature('ui')

	const manager = container.feature('assistantsManager')
	await manager.discover()

	const entries = manager.list()

	if (entries.length === 0) {
		console.error(ui.colors.red('No assistants found.'))
		console.error(ui.colors.dim(`  Create a directory with a CORE.md file anywhere in the project.`))
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

	// Resolve history mode: --off-record overrides everything to lifecycle
	// CLI defaults to 'daily' for interactive persistence
	const historyMode = options.offRecord
		? 'lifecycle'
		: (options.historyMode || 'daily')

	const createOptions: Record<string, any> = { historyMode }
	if (options.model) createOptions.model = options.model
	if (options.local) createOptions.local = options.local

	const assistant = manager.create(name, createOptions)

	// --clear: wipe history for the current mode and exit
	if (options.clear) {
		const deleted = await assistant.clearHistory()
		if (deleted > 0) {
			console.log(ui.colors.green(`  Cleared ${deleted} conversation(s) for ${ui.colors.cyan(name)} (${historyMode} mode).`))
		} else {
			console.log(ui.colors.dim(`  No history to clear for ${ui.colors.cyan(name)} (${historyMode} mode).`))
		}
		return
	}

	// --list: show recent conversations and exit
	if (options.list) {
		const history = await assistant.listHistory({ limit: 20 })
		if (history.length === 0) {
			console.log(ui.colors.dim('  No saved conversations.'))
		} else {
			console.log()
			console.log(ui.colors.dim('  Recent conversations:'))
			console.log()
			for (const meta of history) {
				const date = new Date(meta.updatedAt).toLocaleString()
				const msgs = ui.colors.dim(`(${meta.messageCount} messages)`)
				console.log(`  ${ui.colors.cyan(meta.thread)} ${msgs}`)
				console.log(`    ${ui.colors.dim(date)} - ${meta.title}`)
			}
			console.log()
			console.log(ui.colors.dim(`  Resume with: luca chat ${name} --resume <thread-id>`))
		}
		return
	}

	// --resume: set thread override before start
	if (options.resume) {
		assistant.resumeThread(options.resume)
	}

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

	// Start the assistant (loads history if applicable)
	await assistant.start()

	const messageCount = assistant.messages?.length || 0
	const isResuming = historyMode !== 'lifecycle' && messageCount > 1

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
	if (isResuming) {
		console.log(ui.colors.dim(`  Resuming conversation with ${ui.colors.cyan(name)} (${messageCount} messages). Type .exit to quit.`))
	} else {
		console.log(ui.colors.dim(`  Chatting with ${ui.colors.cyan(name)}. Type .exit to quit.`))
	}
	if (historyMode !== 'lifecycle') {
		console.log(ui.colors.dim(`  Mode: ${historyMode}`))
	}
	console.log()

	while (true) {
		const question = await prompt()

		if (!question) continue
		if (question === '.exit') break

		await assistant.ask(question)
	}

	rl.close()

	// Show resume instruction for non-lifecycle modes
	if (historyMode !== 'lifecycle' && assistant.currentThreadId) {
		console.log()
		console.log(ui.colors.dim(`  Session saved. To resume this conversation:`))
		console.log(ui.colors.dim(`    luca chat ${name} --resume ${assistant.currentThreadId}`))
		console.log()
	}
}

commands.registerHandler('chat', {
	description: 'Start an interactive chat session with a local assistant',
	argsSchema,
	handler: chat,
})
