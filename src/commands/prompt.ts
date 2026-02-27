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
	'in-folder': z.string().optional().describe('Run the CLI agent in this directory (resolved via container.paths)'),
	'out-file': z.string().optional().describe('Save session output as a markdown file'),
	'include-output': z.boolean().default(false).describe('Include tool call outputs in the markdown (requires --out-file)'),
	'dont-touch-file': z.boolean().default(false).describe('Do not update the prompt file frontmatter with run stats'),
	'repeat-anyway': z.boolean().default(false).describe('Run even if repeatable is false and the prompt has already been run'),
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

interface RunStats {
	collectedEvents: any[]
	durationMs: number
	outputTokens: number
}

async function runClaudeOrCodex(target: 'claude' | 'codex', promptContent: string, container: any, options: z.infer<typeof argsSchema>): Promise<RunStats> {
	const ui = container.feature('ui')
	const featureName = target === 'claude' ? 'claudeCode' : 'openaiCodex'
	const feature = container.feature(featureName)

	const available = await feature.checkAvailability()
	if (!available) {
		console.error(`${target} CLI is not available. Make sure it is installed and in your PATH.`)
		process.exit(1)
	}

	let outputTokens = 0

	// Render complete messages — text gets markdown formatting, tool_use gets a summary line
	feature.on('session:message', ({ message }: { message: any }) => {
		const content = message?.message?.content
		if (!Array.isArray(content)) return

		const usage = message?.message?.usage
		if (usage?.output_tokens) outputTokens += usage.output_tokens

		for (const block of content) {
			if (block.type === 'text' && block.text) {
				process.stdout.write(ui.markdown(block.text))
			} else if (block.type === 'tool_use') {
				const argsStr = JSON.stringify(block.input).slice(0, 120)
				process.stdout.write(ui.colors.dim(`\n  ⟳ ${block.name}`) + ui.colors.dim(`(${argsStr})\n`))
			}
		}
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

	if (options['in-folder']) {
		runOptions.cwd = container.paths.resolve(options['in-folder'])
	}

	if (target === 'claude') {
		runOptions.permissionMode = options['permission-mode']
	}

	const startTime = Date.now()
	const sessionId = await feature.start(promptContent, runOptions)
	const session = await feature.waitForSession(sessionId)

	if (session.status === 'error') {
		console.error(session.error || 'Session failed')
		process.exit(1)
	}

	process.stdout.write('\n')

	return { collectedEvents, durationMs: Date.now() - startTime, outputTokens }
}

async function runAssistant(name: string, promptContent: string, options: z.infer<typeof argsSchema>, container: any): Promise<RunStats> {
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

	const startTime = Date.now()
	await assistant.ask(promptContent)
	process.stdout.write('\n')

	return { collectedEvents, durationMs: Date.now() - startTime, outputTokens: 0 }
}

function updateFrontmatter(fileContent: string, updates: Record<string, any>, container: any): string {
	const yaml = container.feature('yaml')

	if (fileContent.startsWith('---')) {
		const endIndex = fileContent.indexOf('\n---', 3)
		if (endIndex !== -1) {
			const existingYaml = fileContent.slice(4, endIndex)
			const meta = yaml.parse(existingYaml) || {}
			Object.assign(meta, updates)
			const newYaml = yaml.stringify(meta).trimEnd()
			return `---\n${newYaml}\n---${fileContent.slice(endIndex + 4)}`
		}
	}

	// No existing frontmatter — prepend one
	const newYaml = yaml.stringify(updates).trimEnd()
	return `---\n${newYaml}\n---\n\n${fileContent}`
}

export default async function prompt(options: z.infer<typeof argsSchema>, context: ContainerContext) {
	const container = context.container as any
	const { fs, paths } = container

	let target = container.argv._[1] as string | undefined
	let promptPath = container.argv._[2] as string | undefined

	// If only one arg given and it looks like a file path, default target to claude
	if (target && !promptPath) {
		const candidate = paths.resolve(target)
		if (fs.exists(candidate)) {
			promptPath = target
			target = 'claude'
		}
	}

	if (!target || !promptPath) {
		console.error('Usage: luca prompt [claude|codex|assistant-name] <path/to/prompt.md>')
		process.exit(1)
	}

	const resolvedPath = paths.resolve(promptPath)
	if (!fs.exists(resolvedPath)) {
		console.error(`Prompt file not found: ${resolvedPath}`)
		process.exit(1)
	}

	let promptContent = fs.readFile(resolvedPath) as string

	// Check repeatable gate: if frontmatter says repeatable: false and it has already run, bail out
	if (!options['repeat-anyway'] && promptContent.startsWith('---')) {
		const fmEnd = promptContent.indexOf('\n---', 3)
		if (fmEnd !== -1) {
			const yaml = container.feature('yaml')
			const meta = yaml.parse(promptContent.slice(4, fmEnd)) || {}
			if (meta.repeatable === false && meta.lastRanAt) {
				console.error(`This prompt has already been run (lastRanAt: ${new Date(meta.lastRanAt).toLocaleString()}) and repeatable is false.`)
				console.error('Use --repeat-anyway to run it again.')
				process.exit(1)
			}
		}
	}

	// Strip YAML frontmatter unless --preserve-frontmatter is set
	if (!options['preserve-frontmatter'] && promptContent.startsWith('---')) {
		const endIndex = promptContent.indexOf('\n---', 3)
		if (endIndex !== -1) {
			promptContent = promptContent.slice(endIndex + 4).trimStart()
		}
	}

	const ui = container.feature('ui')
	process.stdout.write(ui.markdown(promptContent))

	let stats: RunStats

	if (CLI_TARGETS.has(target)) {
		stats = await runClaudeOrCodex(target as 'claude' | 'codex', promptContent, container, options)
	} else {
		stats = await runAssistant(target, promptContent, options, container)
	}

	// Update prompt file frontmatter with run stats
	if (!options['dont-touch-file']) {
		const rawContent = fs.readFile(resolvedPath) as string
		const updates: Record<string, any> = {
			lastRanAt: Date.now(),
			durationMs: stats.durationMs,
		}
		if (stats.outputTokens > 0) {
			updates.outputTokens = stats.outputTokens
		}
		const updated = updateFrontmatter(rawContent, updates, container)
		await Bun.write(resolvedPath, updated)
	}

	if (options['out-file'] && stats.collectedEvents.length) {
		const markdown = formatSessionMarkdown(stats.collectedEvents, options['include-output'])
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
