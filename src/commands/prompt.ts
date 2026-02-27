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
	'preserve-frontmatter': z.boolean().default(false).describe('Keep YAML frontmatter in the prompt instead of stripping it'),
	'permission-mode': z.enum(['default', 'acceptEdits', 'bypassPermissions', 'plan']).default('acceptEdits').describe('Permission mode for CLI agents (default: acceptEdits)'),
	'out-file': z.string().optional().describe('Save session output as a markdown file'),
	'include-output': z.boolean().default(false).describe('Include tool call outputs in the markdown (requires --out-file)'),
	'dont-touch-file': z.boolean().default(false).describe('Do not update the prompt file frontmatter with run stats'),
})

const CLI_TARGETS = new Set(['claude', 'codex'])

function formatSessionMarkdown(events: any[], includeOutput: boolean): string {
	const lines: string[] = []

	for (const event of events) {
		if (event.type === 'assistant') {
			const content = event.message?.content
			if (!Array.isArray(content)) continue

			for (const block of content) {
				if (block.type === 'text' && block.text) {
					lines.push(block.text)
					lines.push('')
				} else if (block.type === 'tool_use') {
					lines.push(`**${block.name}**`)
					lines.push('```json')
					lines.push(JSON.stringify(block.input, null, 2))
					lines.push('```')
					lines.push('')
				}
			}
		} else if (event.type === 'tool_result' && includeOutput) {
			const content = typeof event.content === 'string' ? event.content : JSON.stringify(event.content, null, 2)
			lines.push('```')
			lines.push(content)
			lines.push('```')
			lines.push('')
		}
	}

	return lines.join('\n')
}

async function runClaudeOrCodex(target: 'claude' | 'codex', promptContent: string, container: any, options: z.infer<typeof argsSchema>) {
	const featureName = target === 'claude' ? 'claudeCode' : 'openai-codex'
	const feature = container.feature(featureName)

	const available = await feature.checkAvailability()
	if (!available) {
		console.error(`${target} CLI is not available. Make sure it is installed and in your PATH.`)
		process.exit(1)
	}

	feature.on('session:delta', ({ text }: { text: string }) => {
		if (text) process.stdout.write(text)
	})

	// Collect structured events for --out-file
	const collectedEvents: any[] = []
	if (options['out-file']) {
		feature.on('session:event', ({ event }: { event: any }) => {
			if (event.type === 'assistant' || event.type === 'tool_result') {
				collectedEvents.push(event)
			}
		})
	}

	const runOptions: Record<string, any> = { streaming: true }

	if (target === 'claude') {
		runOptions.permissionMode = options['permission-mode']
	}

	const sessionId = await feature.start(promptContent, runOptions)
	const session = await feature.waitForSession(sessionId)

	if (session.status === 'error') {
		console.error(session.error || 'Session failed')
		process.exit(1)
	}

	process.stdout.write('\n')

	return collectedEvents
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

	// Collect structured events for --out-file
	const collectedEvents: any[] = []

	assistant.on('chunk', (text: string) => {
		if (isFirstChunk) {
			process.stdout.write('\n')
			isFirstChunk = false
		}
		process.stdout.write(text)
		if (options['out-file']) {
			collectedEvents.push({ type: 'assistant', message: { content: [{ type: 'text', text }] } })
		}
	})

	assistant.on('toolCall', (toolName: string, args: any) => {
		const argsStr = JSON.stringify(args).slice(0, 120)
		process.stdout.write(ui.colors.dim(`\n  ⟳ ${toolName}`) + ui.colors.dim(`(${argsStr})\n`))
		if (options['out-file']) {
			collectedEvents.push({ type: 'assistant', message: { content: [{ type: 'tool_use', name: toolName, input: args }] } })
		}
	})

	assistant.on('toolResult', (toolName: string, result: any) => {
		const preview = typeof result === 'string' ? result.slice(0, 100) : JSON.stringify(result).slice(0, 100)
		process.stdout.write(ui.colors.green(`  ✓ ${toolName}`) + ui.colors.dim(` → ${preview}${preview.length >= 100 ? '…' : ''}\n`))
		if (options['out-file']) {
			collectedEvents.push({ type: 'tool_result', content: typeof result === 'string' ? result : JSON.stringify(result, null, 2) })
		}
	})

	assistant.on('toolError', (toolName: string, error: any) => {
		const msg = error?.message || String(error)
		process.stdout.write(ui.colors.red(`  ✗ ${toolName}: ${msg}\n`))
	})

	await assistant.ask(promptContent)
	process.stdout.write('\n')

	return collectedEvents
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

	let promptContent = fs.readFile(resolvedPath) as string

	// Strip YAML frontmatter unless --preserve-frontmatter is set
	if (!options['preserve-frontmatter'] && promptContent.startsWith('---')) {
		const endIndex = promptContent.indexOf('\n---', 3)
		if (endIndex !== -1) {
			promptContent = promptContent.slice(endIndex + 4).trimStart()
		}
	}

	let collectedEvents: any[] = []

	if (CLI_TARGETS.has(target)) {
		collectedEvents = await runClaudeOrCodex(target as 'claude' | 'codex', promptContent, container, options)
	} else {
		collectedEvents = await runAssistant(target, promptContent, options, container)
	}

	if (options['out-file'] && collectedEvents.length) {
		const markdown = formatSessionMarkdown(collectedEvents, options['include-output'])
		const outPath = paths.resolve(options['out-file'])
		await Bun.write(outPath, markdown)
		console.log(`Session saved to ${outPath}`)
	}
}

commands.registerHandler('prompt', {
	description: 'Send a prompt file to an assistant, Claude Code, or OpenAI Codex',
	argsSchema,
	handler: prompt,
})
