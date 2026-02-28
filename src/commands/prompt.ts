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
	'parallel': z.boolean().default(false).describe('Run multiple prompt files in parallel with side-by-side terminal UI'),
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

interface PreparedPrompt {
	resolvedPath: string
	promptContent: string
	filename: string
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

async function runParallel(
	target: string,
	prepared: PreparedPrompt[],
	options: z.infer<typeof argsSchema>,
	container: any,
): Promise<void> {
	const { fs, paths } = container
	const ink = container.feature('ink', { enable: true })
	await ink.loadModules()

	const React = ink.React
	const h = React.createElement
	const { Box, Text } = ink.components
	const { useApp, useInput, useStdout } = ink.hooks
	const { useState, useEffect } = React

	const MAX_LINES = 500

	// Mutable state that event handlers write to directly.
	// The Ink component reads this on a timer to trigger re-renders.
	const promptStates = prepared.map((p) => ({
		filename: p.filename,
		resolvedPath: p.resolvedPath,
		status: 'running' as 'running' | 'done' | 'error',
		lines: [] as string[],
		outputTokens: 0,
		startTime: Date.now(),
		durationMs: 0,
		collectedEvents: [] as any[],
		error: undefined as string | undefined,
	}))

	const sessionMap = new Map<string, number>()
	let allDone = false
	let userAborted = false

	function pushLines(idx: number, text: string) {
		const newLines = text.split('\n')
		promptStates[idx].lines.push(...newLines)
		if (promptStates[idx].lines.length > MAX_LINES) {
			promptStates[idx].lines = promptStates[idx].lines.slice(-MAX_LINES)
		}
	}

	function pushToolLine(idx: number, text: string) {
		promptStates[idx].lines.push(text)
		if (promptStates[idx].lines.length > MAX_LINES) {
			promptStates[idx].lines.splice(0, 1)
		}
	}

	const runOptions: Record<string, any> = { streaming: true }
	if (options['in-folder']) {
		runOptions.cwd = container.paths.resolve(options['in-folder'])
	}

	const isCli = CLI_TARGETS.has(target)
	let sessionPromise: Promise<any>

	if (isCli) {
		const featureName = target === 'claude' ? 'claudeCode' : 'openaiCodex'
		const feature = container.feature(featureName)

		const available = await feature.checkAvailability()
		if (!available) {
			console.error(`${target} CLI is not available. Make sure it is installed and in your PATH.`)
			process.exit(1)
		}

		if (target === 'claude') {
			runOptions.permissionMode = options['permission-mode']
		}

		feature.on('session:message', ({ sessionId, message }: { sessionId: string; message: any }) => {
			const idx = sessionMap.get(sessionId)
			if (idx === undefined) return

			const content = message?.message?.content
			if (!Array.isArray(content)) return

			const usage = message?.message?.usage
			if (usage?.output_tokens) promptStates[idx].outputTokens += usage.output_tokens

			for (const block of content) {
				if (block.type === 'text' && block.text) {
					pushLines(idx, block.text)
				} else if (block.type === 'tool_use') {
					const argsStr = JSON.stringify(block.input).slice(0, 80)
					pushToolLine(idx, `  > ${block.name}(${argsStr})`)
				}
			}
		})

		if (options['out-file']) {
			feature.on('session:event', ({ sessionId, event }: { sessionId: string; event: any }) => {
				const idx = sessionMap.get(sessionId)
				if (idx === undefined) return
				if (event.type === 'assistant' || event.type === 'tool_result') {
					promptStates[idx].collectedEvents.push(event)
				}
			})
		}

		// Start all sessions
		for (let i = 0; i < prepared.length; i++) {
			const id = await feature.start(prepared[i].promptContent, runOptions)
			sessionMap.set(id, i)
		}

		const ids = [...sessionMap.keys()]
		sessionPromise = Promise.allSettled(ids.map((id) => feature.waitForSession(id))).then((results) => {
			results.forEach((r, ri) => {
				const id = ids[ri]
				const idx = sessionMap.get(id)!
				promptStates[idx].durationMs = Date.now() - promptStates[idx].startTime
				if (r.status === 'fulfilled' && r.value?.status === 'error') {
					promptStates[idx].status = 'error'
					promptStates[idx].error = r.value?.error || 'Session failed'
				} else if (r.status === 'rejected') {
					promptStates[idx].status = 'error'
					promptStates[idx].error = String(r.reason)
				} else {
					promptStates[idx].status = 'done'
				}
			})
			allDone = true
		})
	} else {
		// Assistant targets
		const manager = container.feature('assistantsManager', { folder: options.folder })
		manager.discover()

		const entry = manager.get(target)
		if (!entry) {
			const entries = manager.list()
			const available = entries.length ? entries.map((e: any) => e.name).join(', ') : '(none)'
			console.error(`Assistant "${target}" not found. Available: ${available}`)
			process.exit(1)
		}

		const createOptions: Record<string, any> = {}
		if (options.model) createOptions.model = options.model

		const lineBuffers: string[] = prepared.map(() => '')

		const assistants = prepared.map((p, i) => {
			const assistant = manager.create(target, createOptions)

			assistant.on('chunk', (text: string) => {
				lineBuffers[i] += text
				const parts = lineBuffers[i].split('\n')
				lineBuffers[i] = parts.pop() || ''
				if (parts.length) {
					promptStates[i].lines.push(...parts)
					if (promptStates[i].lines.length > MAX_LINES) {
						promptStates[i].lines = promptStates[i].lines.slice(-MAX_LINES)
					}
				}
				if (options['out-file']) {
					promptStates[i].collectedEvents.push({ type: 'assistant', message: { content: [{ type: 'text', text }] } })
				}
			})

			assistant.on('toolCall', (toolName: string, args: any) => {
				const argsStr = JSON.stringify(args).slice(0, 80)
				pushToolLine(i, `  > ${toolName}(${argsStr})`)
				if (options['out-file']) {
					promptStates[i].collectedEvents.push({
						type: 'assistant',
						message: { content: [{ type: 'tool_use', name: toolName, input: args }] },
					})
				}
			})

			assistant.on('toolResult', (toolName: string, result: any) => {
				const preview = typeof result === 'string' ? result.slice(0, 60) : JSON.stringify(result).slice(0, 60)
				pushToolLine(i, `  ✓ ${toolName} → ${preview}`)
				if (options['out-file']) {
					promptStates[i].collectedEvents.push({
						type: 'tool_result',
						content: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
					})
				}
			})

			assistant.on('toolError', (toolName: string, error: any) => {
				const msg = error?.message || String(error)
				pushToolLine(i, `  ✗ ${toolName}: ${msg}`)
			})

			return assistant
		})

		sessionPromise = Promise.allSettled(assistants.map((a, i) => a.ask(prepared[i].promptContent))).then(
			(results) => {
				results.forEach((r, i) => {
					promptStates[i].durationMs = Date.now() - promptStates[i].startTime
					// Flush remaining line buffer
					if (lineBuffers[i]) {
						promptStates[i].lines.push(lineBuffers[i])
						lineBuffers[i] = ''
					}
					if (r.status === 'rejected') {
						promptStates[i].status = 'error'
						promptStates[i].error = String(r.reason)
					} else {
						promptStates[i].status = 'done'
					}
				})
				allDone = true
			},
		)
	}

	// --- Ink React Component ---
	function App() {
		const { exit } = useApp()
		const { stdout } = useStdout()
		const [tick, setTick] = useState(0)

		const cols = stdout?.columns || 120
		const rows = stdout?.rows || 30
		const numPrompts = prepared.length
		const colWidth = Math.max(30, Math.floor(cols / numPrompts))
		const visibleLines = Math.max(5, rows - 7)

		useEffect(() => {
			const timer = setInterval(() => setTick((t: number) => t + 1), 200)
			return () => clearInterval(timer)
		}, [])

		useEffect(() => {
			if (allDone) {
				setTimeout(() => exit(), 400)
			}
		}, [tick])

		useInput((input: string, key: any) => {
			if (input === 'q' || (key.ctrl && input === 'c')) {
				userAborted = true
				if (isCli) {
					const featureName = target === 'claude' ? 'claudeCode' : 'openaiCodex'
					const feature = container.feature(featureName)
					for (const [sid] of sessionMap) {
						try {
							feature.abort(sid)
						} catch {}
					}
				}
				exit()
			}
		})

		const formatElapsed = (ms: number) => {
			const s = Math.floor(ms / 1000)
			const m = Math.floor(s / 60)
			const sec = s % 60
			return `${m}:${String(sec).padStart(2, '0')}`
		}

		const runningCount = promptStates.filter((p) => p.status === 'running').length

		return h(
			Box,
			{ flexDirection: 'column', width: cols },
			// Header
			h(
				Box,
				{ justifyContent: 'space-between', paddingX: 1, marginBottom: 1 },
				h(Text, { bold: true, color: '#61dafb' }, 'LUCA PROMPT // PARALLEL'),
				h(Text, { dimColor: true }, `${runningCount} running / ${numPrompts} total`),
			),
			// Columns
			h(
				Box,
				{ flexDirection: 'row' },
				...promptStates.map((ps, i) => {
					const elapsed = ps.status === 'running' ? Date.now() - ps.startTime : ps.durationMs
					const borderColor = ps.status === 'running' ? 'cyan' : ps.status === 'done' ? 'green' : 'red'
					const statusLabel =
						ps.status === 'running'
							? `RUNNING ${formatElapsed(elapsed)}`
							: ps.status === 'done'
								? `DONE ${formatElapsed(ps.durationMs)}`
								: `ERROR`
					const tail = ps.lines.slice(-visibleLines)

					return h(
						Box,
						{
							key: String(i),
							flexDirection: 'column',
							width: colWidth,
							borderStyle: 'round',
							borderColor,
							paddingX: 1,
							height: visibleLines + 4,
						},
						h(Text, { bold: true }, ps.filename),
						h(Text, { color: borderColor, dimColor: ps.status === 'done' }, statusLabel),
						h(Text, { dimColor: true }, '\u2500'.repeat(Math.max(1, colWidth - 4))),
						h(Text, { wrap: 'truncate' }, tail.join('\n')),
					)
				}),
			),
			// Footer
			h(Box, { paddingX: 1 }, h(Text, { dimColor: true }, 'q: quit all')),
		)
	}

	await ink.render(h(App))
	await ink.waitUntilExit()

	if (userAborted) return

	// Wait for sessions to fully settle
	await sessionPromise

	// Post-completion: update frontmatter
	if (!options['dont-touch-file']) {
		for (let i = 0; i < promptStates.length; i++) {
			const ps = promptStates[i]
			if (ps.status === 'error') continue
			const rawContent = fs.readFile(prepared[i].resolvedPath) as string
			const updates: Record<string, any> = {
				lastRanAt: Date.now(),
				durationMs: ps.durationMs,
			}
			if (ps.outputTokens > 0) {
				updates.outputTokens = ps.outputTokens
			}
			const updated = updateFrontmatter(rawContent, updates, container)
			await Bun.write(prepared[i].resolvedPath, updated)
		}
	}

	// Post-completion: out-files
	if (options['out-file']) {
		const base = options['out-file']
		const dotIdx = base.lastIndexOf('.')
		const ext = dotIdx > 0 ? base.slice(dotIdx) : '.md'
		const stem = dotIdx > 0 ? base.slice(0, dotIdx) : base

		for (let i = 0; i < promptStates.length; i++) {
			const ps = promptStates[i]
			if (!ps.collectedEvents.length) continue
			const promptBasename = paths.basename(prepared[i].resolvedPath)
			const promptStem = promptBasename.lastIndexOf('.') > 0 ? promptBasename.slice(0, promptBasename.lastIndexOf('.')) : promptBasename
			const outPath = paths.resolve(`${stem}-${promptStem}${ext}`)
			const markdown = formatSessionMarkdown(ps.collectedEvents, options['include-output'])
			await Bun.write(outPath, markdown)
			console.log(`Session saved to ${outPath}`)
		}
	}

	// Print summary
	const errors = promptStates.filter((p) => p.status === 'error')
	if (errors.length) {
		console.error(`\n${errors.length} prompt(s) failed:`)
		for (const ps of errors) {
			console.error(`  ${ps.filename}: ${ps.error}`)
		}
	}
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

function preparePrompt(
	filePath: string,
	options: z.infer<typeof argsSchema>,
	container: any,
): PreparedPrompt | null {
	const { fs, paths } = container

	const resolvedPath = paths.resolve(filePath)
	if (!fs.exists(resolvedPath)) {
		console.error(`Prompt file not found: ${resolvedPath}`)
		return null
	}

	let content = fs.readFile(resolvedPath) as string

	// Check repeatable gate
	if (!options['repeat-anyway'] && content.startsWith('---')) {
		const fmEnd = content.indexOf('\n---', 3)
		if (fmEnd !== -1) {
			const yaml = container.feature('yaml')
			const meta = yaml.parse(content.slice(4, fmEnd)) || {}
			if (meta.repeatable === false && meta.lastRanAt) {
				console.error(`${filePath}: already run (lastRanAt: ${new Date(meta.lastRanAt).toLocaleString()}) and repeatable is false. Skipping.`)
				return null
			}
		}
	}

	// Strip YAML frontmatter unless --preserve-frontmatter is set
	let promptContent = content
	if (!options['preserve-frontmatter'] && promptContent.startsWith('---')) {
		const endIndex = promptContent.indexOf('\n---', 3)
		if (endIndex !== -1) {
			promptContent = promptContent.slice(endIndex + 4).trimStart()
		}
	}

	return {
		resolvedPath,
		promptContent,
		filename: paths.basename(resolvedPath),
	}
}

export default async function prompt(options: z.infer<typeof argsSchema>, context: ContainerContext) {
	const container = context.container as any
	const { fs, paths } = container

	let target = container.argv._[1] as string | undefined
	const allPaths = (container.argv._.slice(2) as string[]).filter(Boolean)

	// If only one arg given and it looks like a file path, default target to claude
	if (target && allPaths.length === 0) {
		const candidate = paths.resolve(target)
		if (fs.exists(candidate)) {
			allPaths.push(target)
			target = 'claude'
		}
	}

	if (!target || allPaths.length === 0) {
		console.error('Usage: luca prompt [claude|codex|assistant-name] <path/to/prompt.md> [more paths...]')
		process.exit(1)
	}

	// --- Parallel mode ---
	if (options.parallel && allPaths.length > 1) {
		if (allPaths.length > 4) {
			console.error('--parallel supports a maximum of 4 concurrent prompts')
			process.exit(1)
		}

		const prepared: PreparedPrompt[] = []
		for (const pp of allPaths) {
			const p = preparePrompt(pp, options, container)
			if (p) prepared.push(p)
		}

		if (prepared.length === 0) {
			console.error('No prompt files to run (all skipped).')
			process.exit(1)
		}

		if (prepared.length > 1) {
			await runParallel(target, prepared, options, container)
			return
		}
		// Only 1 left after filtering — fall through to single mode
	}

	// --- Single prompt mode ---
	const promptPath = allPaths[0]
	const p = preparePrompt(promptPath, options, container)

	if (!p) {
		process.exit(1)
	}

	const ui = container.feature('ui')
	process.stdout.write(ui.markdown(p.promptContent))

	let stats: RunStats

	if (CLI_TARGETS.has(target)) {
		stats = await runClaudeOrCodex(target as 'claude' | 'codex', p.promptContent, container, options)
	} else {
		stats = await runAssistant(target, p.promptContent, options, container)
	}

	// Update prompt file frontmatter with run stats
	if (!options['dont-touch-file']) {
		const rawContent = fs.readFile(p.resolvedPath) as string
		const updates: Record<string, any> = {
			lastRanAt: Date.now(),
			durationMs: stats.durationMs,
		}
		if (stats.outputTokens > 0) {
			updates.outputTokens = stats.outputTokens
		}
		const updated = updateFrontmatter(rawContent, updates, container)
		await Bun.write(p.resolvedPath, updated)
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
