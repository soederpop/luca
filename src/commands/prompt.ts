import { z } from 'zod'
import { commands } from '../command.js'
import { CommandOptionsSchema } from '../schemas/base.js'
import type { ContainerContext } from '../container.js'

declare module '../command.js' {
	interface AvailableCommands {
		prompt: ReturnType<typeof commands.registerHandler>
	}
}

export const argsSchema = CommandOptionsSchema.extend({
	model: z.string().optional().describe('Override the LLM model (assistant mode only)'),
	folder: z.string().default('assistants').describe('Directory containing assistant definitions'),
})

const CLI_TARGETS = new Set(['claude', 'codex'])

async function runClaudeOrCodex(target: 'claude' | 'codex', promptContent: string, container: any) {
	const featureName = target === 'claude' ? 'claude-code' : 'openai-codex'
	const feature = container.feature(featureName)

	const available = await feature.checkAvailability()
	if (!available) {
		console.error(`${target} CLI is not available. Make sure it is installed and in your PATH.`)
		process.exit(1)
	}

	feature.on('session:delta', ({ text }: { text: string }) => {
		if (text) process.stdout.write(text)
	})

	await feature.run(promptContent)
	process.stdout.write('\n')
}

async function runAssistant(name: string, promptContent: string, options: z.infer<typeof argsSchema>, container: any) {
	const ui = container.feature('ui')
	const manager = container.feature('assistantsManager', { folder: options.folder })
	manager.discover()

	const entry = manager.get(name)
	if (!entry) {
		const entries = manager.list()
		const available = entries.length ? entries.map((e: any) => e.name).join(', ') : '(none)'
		console.error(`Assistant "${name}" not found. Available: ${available}`)
		process.exit(1)
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

	await assistant.ask(promptContent)
	process.stdout.write('\n')
}

export default async function prompt(options: z.infer<typeof argsSchema>, context: ContainerContext) {
	const container = context.container as any
	const { fs, paths } = container

	const target = container.argv._[1] as string | undefined
	const promptPath = container.argv._[2] as string | undefined

	if (!target || !promptPath) {
		console.error('Usage: luca prompt <claude|codex|assistant-name> <path/to/prompt.md>')
		process.exit(1)
	}

	const resolvedPath = paths.resolve(promptPath)
	if (!fs.exists(resolvedPath)) {
		console.error(`Prompt file not found: ${resolvedPath}`)
		process.exit(1)
	}

	const promptContent = fs.readFile(resolvedPath)

	if (CLI_TARGETS.has(target)) {
		await runClaudeOrCodex(target as 'claude' | 'codex', promptContent, container)
	} else {
		await runAssistant(target, promptContent, options, container)
	}
}

commands.registerHandler('prompt', {
	description: 'Send a prompt file to an assistant, Claude Code, or OpenAI Codex',
	argsSchema,
	handler: prompt,
})
