import { z } from 'zod'
import { Document } from 'contentbase'
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
	'preserve-frontmatter': z.boolean().default(false).describe('Keep YAML frontmatter in the prompt instead of stripping it before sending to the agent.'),
	'permission-mode': z.enum(['default', 'acceptEdits', 'bypassPermissions', 'plan']).default('acceptEdits').describe('Permission mode for CLI agents (default: acceptEdits)'),
	'in-folder': z.string().optional().describe('Run the CLI agent in this directory (resolved via container.paths)'),
	'out-file': z.string().optional().describe('Save session output as a markdown file'),
	'include-output': z.boolean().default(false).describe('Include tool call outputs in the markdown (requires --out-file)'),
	'inputs-file': z.string().optional().describe('Path to a JSON or YAML file supplying input values'),
	'parallel': z.boolean().default(false).describe('Run multiple prompt files in parallel with side-by-side terminal UI'),
	'exclude-sections': z.string().optional().describe('Comma-separated list of section headings to exclude from the prompt'),
	'chrome': z.boolean().default(false).describe('Launch Claude Code with a Chrome browser tool'),
	'dry-run': z.boolean().default(false).describe('Display the resolved prompt and options without running the assistant'),
	'local': z.boolean().default(false).describe('Use local models for assistant mode'),
})

function normalizeTarget(raw: string): string {
	const lower = raw.toLowerCase().replace(/[-_]/g, '')
	if (/claude/.test(lower)) return 'claude'
	if (/codex/.test(lower) || /openai/.test(lower)) return 'codex'
	return raw
}

const CLI_TARGETS = new Set(['claude', 'codex'])

function formatSessionMarkdown(events: any[], includeOutput: boolean): string {
	const lines: string[] = []

	for (const event of events) {
		if (event.type === 'assistant' || event.type === 'message') {
			const role = event.message?.role ?? event.role
			if (role && role !== 'assistant') continue

			const content = event.message?.content ?? event.content
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
		} else if ((event.type === 'tool_result' || event.type === 'function_call_output') && includeOutput) {
			const rawContent = event.type === 'function_call_output' ? event.output : event.content
			const content = typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent, null, 2)
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
	agentOptions: Record<string, any>
}

async function runClaudeOrCodex(target: 'claude' | 'codex', promptContent: string, container: any, options: z.infer<typeof argsSchema>, agentOptions: Record<string, any> = {}): Promise<RunStats> {
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
		const role = message?.message?.role ?? message?.role
		if (role && role !== 'assistant') return

		const content = message?.message?.content ?? message?.content
		if (!Array.isArray(content)) return

		const usage = message?.message?.usage ?? message?.usage
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
			if (event.type === 'assistant' || event.type === 'tool_result' || event.type === 'message' || event.type === 'function_call_output' || event.type === 'item.completed' || event.type === 'turn.completed') {
				collectedEvents.push(event)
			}
		})
	}

	const runOptions: Record<string, any> = { streaming: true, ...agentOptions }

	if (options['in-folder']) {
		runOptions.cwd = container.paths.resolve(options['in-folder'])
	}

	if (target === 'claude') {
		runOptions.permissionMode = options['permission-mode']
		if (options.chrome) runOptions.chrome = true
	}

	// CLI flags override agentOptions from frontmatter
	if (options.model) runOptions.model = options.model

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

async function runAssistant(name: string, promptContent: string, options: z.infer<typeof argsSchema>, container: any, agentOptions: Record<string, any> = {}): Promise<RunStats> {
	const ui = container.feature('ui')
	const manager = container.feature('assistantsManager')
	await manager.discover()

	const entry = manager.get(name)
	if (!entry) {
		const entries = manager.list()
		const available = entries.length ? entries.map((e: any) => e.name).join(', ') : '(none)'
		console.error(`Assistant "${name}" not found. Available: ${available}`)
		process.exit(1)
	}

	const createOptions: Record<string, any> = { ...agentOptions }
	// CLI flags override agentOptions from frontmatter
	if (options.model) createOptions.model = options.model
	if (options.local) createOptions.local = true

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
			if (options.chrome) runOptions.chrome = true
		}

		feature.on('session:message', ({ sessionId, message }: { sessionId: string; message: any }) => {
			const idx = sessionMap.get(sessionId)
			if (idx === undefined) return

			const role = message?.message?.role ?? message?.role
			if (role && role !== 'assistant') return

			const content = message?.message?.content ?? message?.content
			if (!Array.isArray(content)) return

			const usage = message?.message?.usage ?? message?.usage
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
				if (event.type === 'assistant' || event.type === 'tool_result' || event.type === 'message' || event.type === 'function_call_output') {
					promptStates[idx].collectedEvents.push(event)
				}
			})
		}

		// Start all sessions — merge per-prompt agentOptions with shared runOptions
		for (let i = 0; i < prepared.length; i++) {
			const perPromptOptions = { ...prepared[i].agentOptions, ...runOptions }
			if (options.model) perPromptOptions.model = options.model
			const id = await feature.start(prepared[i].promptContent, perPromptOptions)
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
		const manager = container.feature('assistantsManager')
		await manager.discover()

		const entry = manager.get(target)
		if (!entry) {
			const entries = manager.list()
			const available = entries.length ? entries.map((e: any) => e.name).join(', ') : '(none)'
			console.error(`Assistant "${target}" not found. Available: ${available}`)
			process.exit(1)
		}

		const lineBuffers: string[] = prepared.map(() => '')

		const assistants = prepared.map((p, i) => {
			const createOptions: Record<string, any> = { ...p.agentOptions }
			if (options.model) createOptions.model = options.model
			if (options.local) createOptions.local = true
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

interface InputDef {
	description?: string
	required?: boolean
	default?: any
	type?: string
	choices?: string[]
}

function parseInputDefs(meta: Record<string, any>): Record<string, InputDef> | null {
	if (!meta?.inputs || typeof meta.inputs !== 'object') return null
	const defs: Record<string, InputDef> = {}
	for (const [key, val] of Object.entries(meta.inputs)) {
		if (typeof val === 'object' && val !== null) {
			defs[key] = val as InputDef
		} else {
			// Shorthand: `topic: "What to write about"` means description-only, required
			defs[key] = { description: typeof val === 'string' ? val : String(val) }
		}
	}
	return Object.keys(defs).length ? defs : null
}

async function resolveInputs(
	inputDefs: Record<string, InputDef>,
	options: z.infer<typeof argsSchema>,
	container: any,
): Promise<Record<string, any>> {
	const { fs, paths } = container
	const yaml = container.feature('yaml')
	const ui = container.feature('ui')

	// Layer 1: inputs-file (lowest priority of supplied values)
	let fileInputs: Record<string, any> = {}
	if (options['inputs-file']) {
		const filePath = paths.resolve(options['inputs-file'])
		const raw = fs.readFile(filePath) as string
		if (filePath.endsWith('.json')) {
			fileInputs = JSON.parse(raw)
		} else {
			fileInputs = yaml.parse(raw) || {}
		}
	}

	// Layer 2: CLI flags (highest priority) — any unknown option that matches an input name
	const cliInputs: Record<string, any> = {}
	const argv = container.argv as Record<string, any>
	for (const key of Object.keys(inputDefs)) {
		if (argv[key] !== undefined) {
			cliInputs[key] = argv[key]
		}
	}

	// Merge: CLI > file > defaults
	const supplied: Record<string, any> = {}
	for (const [key, def] of Object.entries(inputDefs)) {
		if (cliInputs[key] !== undefined) {
			supplied[key] = cliInputs[key]
		} else if (fileInputs[key] !== undefined) {
			supplied[key] = fileInputs[key]
		} else if (def.default !== undefined) {
			supplied[key] = def.default
		}
	}

	// Find missing required inputs
	const missing: string[] = []
	for (const [key, def] of Object.entries(inputDefs)) {
		const isRequired = def.required !== false // default to required
		if (isRequired && supplied[key] === undefined) {
			missing.push(key)
		}
	}

	if (missing.length === 0) return supplied

	// In parallel mode, we can't run an interactive wizard
	if ((options as any).parallel) {
		console.error(`Missing required inputs for parallel mode (use --inputs-file or CLI flags): ${missing.join(', ')}`)
		process.exit(1)
	}

	// Build wizard questions for missing inputs
	const questions = missing.map((key) => {
		const def = inputDefs[key]
		const q: Record<string, any> = {
			name: key,
			message: def.description || key,
		}

		// Auto-infer type
		if (def.choices?.length) {
			q.type = 'list'
			q.choices = def.choices
		} else if (def.type) {
			q.type = def.type
		} else {
			q.type = 'input'
		}

		if (def.default !== undefined) {
			q.default = def.default
		}

		return q
	})

	const answers = await ui.wizard(questions, supplied)
	return { ...supplied, ...answers }
}

function substituteInputs(content: string, inputs: Record<string, any>): string {
	return content.replace(/\{\{(\w+)\}\}/g, (match, key) => {
		return inputs[key] !== undefined ? String(inputs[key]) : match
	})
}

async function executePromptFile(resolvedPath: string, container: any, inputs?: Record<string, any>): Promise<string> {
	if (!container.docs.isLoaded) await container.docs.load()
	const doc = await container.docs.parseMarkdownAtPath(resolvedPath)
	const vm = container.feature('vm')
	const parts: string[] = []

	const capturedLines: string[] = []
	const captureConsole = {
		log: (...args: any[]) => capturedLines.push(args.map(String).join(' ')),
		error: (...args: any[]) => capturedLines.push(args.map(String).join(' ')),
		warn: (...args: any[]) => capturedLines.push(args.map(String).join(' ')),
		info: (...args: any[]) => capturedLines.push(args.map(String).join(' ')),
	}

	const shared = vm.createContext({
		...container.context,
		INPUTS: inputs || {},
		console: captureConsole,
		setTimeout, clearTimeout, setInterval, clearInterval,
		fetch, URL, URLSearchParams,
	})

	for (const node of doc.ast.children) {
		if (node.type === 'code') {
			const { value, lang, meta } = node
			if (!lang || !['ts', 'js', 'tsx', 'jsx'].includes(lang)) {
				parts.push(doc.stringify({ type: 'root', children: [node] }))
				continue
			}
			if (meta && typeof meta === 'string' && meta.toLowerCase().includes('skip')) continue

			capturedLines.length = 0
			let code = value
			if (lang === 'tsx' || lang === 'jsx') {
				const esbuild = container.feature('esbuild')
				const { code: transformed } = esbuild.transformSync(value, { loader: lang as 'tsx' | 'jsx', format: 'cjs' })
				code = transformed
			}

				await vm.run(code, shared)
			Object.assign(shared, container.context)

			if (capturedLines.length) {
				parts.push(capturedLines.join('\n'))
			}
		} else {
			parts.push(doc.stringify({ type: 'root', children: [node] }))
		}
	}

	return parts.join('\n\n')
}

async function preparePrompt(
	filePath: string,
	options: z.infer<typeof argsSchema>,
	container: any,
): Promise<PreparedPrompt | null> {
	const { fs, paths } = container

	let resolvedPath = paths.resolve(filePath)
	if (!fs.exists(resolvedPath)) {
		// Try common fallbacks: add .md extension, docs/ prefix, or both
		const candidates = [
			`${resolvedPath}.md`,
			paths.resolve('docs', filePath),
			paths.resolve('docs', `${filePath}.md`),
		]
		const found = candidates.find((c) => fs.exists(c))
		if (!found) {
			console.error(`Prompt file not found: ${resolvedPath}`)
			return null
		}
		resolvedPath = found
	}

	let content = fs.readFile(resolvedPath) as string

	// Parse frontmatter for input definitions and agentOptions
	let resolvedInputs: Record<string, any> = {}
	let agentOptions: Record<string, any> = {}
	let hasInputDefs = false
	if (content.startsWith('---')) {
		const fmEnd = content.indexOf('\n---', 3)
		if (fmEnd !== -1) {
			const yaml = container.feature('yaml')
			const meta = yaml.parse(content.slice(4, fmEnd)) || {}
			const inputDefs = parseInputDefs(meta)
			if (inputDefs) {
				hasInputDefs = true
				resolvedInputs = await resolveInputs(inputDefs, options, container)
			}
			if (meta.agentOptions && typeof meta.agentOptions === 'object') {
				agentOptions = { ...meta.agentOptions }
			}
		}
	}

	if (options['inputs-file'] && !hasInputDefs) {
		console.warn(`Warning: --inputs-file was provided but ${filePath} does not define any inputs in its frontmatter`)
	}

	let promptContent: string
	if (options['preserve-frontmatter']) {
		promptContent = content
	} else {
		promptContent = await executePromptFile(resolvedPath, container, resolvedInputs)
	}

	// Substitute {{key}} placeholders with resolved input values
	if (Object.keys(resolvedInputs).length) {
		promptContent = substituteInputs(promptContent, resolvedInputs)
	}

	// Exclude sections by heading name
	if (options['exclude-sections']) {
		const headings = options['exclude-sections'].split(',').map((s) => s.trim()).filter(Boolean)
		let doc = new Document({ id: filePath, content: promptContent, collection: null as any })

		for (const heading of headings) {
			try {
				doc = doc.removeSection(heading)
			} catch {
				// Section not found — skip silently
			}
		}

		promptContent = doc.content
	}

	return {
		resolvedPath,
		promptContent,
		filename: paths.basename(resolvedPath),
		agentOptions,
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
			// this gives a way for you to say on a per project basis what you want the default coding assistant to be for the prompt command	
			// TODO need to document this somewhere
			const { codingAssistant } = (container.manifest.luca || {})
			target = codingAssistant || 'claude'
		}
	}

	// Normalize target aliases (e.g. claude-code → claude, openai-codex → codex)
	if (target) target = normalizeTarget(target)

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
			const p = await preparePrompt(pp, options, container)
			if (p) prepared.push(p)
		}

		if (prepared.length === 0) {
			console.error('No prompt files to run (all skipped).')
			process.exit(1)
		}

		if (options['dry-run']) {
			const ui = container.feature('ui')
			console.log(ui.colors.bold('\n── Dry Run (Parallel) ──\n'))
			console.log(ui.colors.bold('Target:'), target)
			console.log(ui.colors.bold('Prompts:'), prepared.length)
			for (const p of prepared) {
				console.log(ui.colors.bold(`\n── ${p.filename} ──`))
				console.log(ui.colors.dim(`  Path: ${p.resolvedPath}`))
				console.log(ui.colors.dim(`  Length: ${p.promptContent.length} chars`))
				if (Object.keys(p.agentOptions).length) {
					console.log(ui.colors.dim('  Agent options:'))
					for (const [key, val] of Object.entries(p.agentOptions)) {
						const display = typeof val === 'object' ? JSON.stringify(val) : val
						console.log(ui.colors.dim(`    ${key}: ${display}`))
					}
				}
				console.log('')
				process.stdout.write(ui.markdown(p.promptContent))
			}
			return
		}

		if (prepared.length > 1) {
			await runParallel(target, prepared, options, container)
			return
		}
		// Only 1 left after filtering — fall through to single mode
	}

	// --- Single prompt mode ---
	const promptPath = allPaths[0]
	const p = await preparePrompt(promptPath, options, container)

	if (!p) {
		process.exit(1)
	}

	const ui = container.feature('ui')

	if (options['dry-run']) {
		const runOptions: Record<string, any> = { ...p.agentOptions }
		if (options.model) runOptions.model = options.model
		if (options['in-folder']) runOptions.cwd = container.paths.resolve(options['in-folder'])
		if (options['out-file']) runOptions.outFile = options['out-file']
		if (options['include-output']) runOptions.includeOutput = true
		if (options['exclude-sections']) runOptions.excludeSections = options['exclude-sections']
		if (CLI_TARGETS.has(target)) {
			runOptions.permissionMode = options['permission-mode']
			if (options.chrome) runOptions.chrome = true
		}

		console.log(ui.colors.bold('\n── Dry Run ──\n'))
		console.log(ui.colors.bold('Target:'), target)
		console.log(ui.colors.bold('Prompt file:'), p.resolvedPath)
		console.log(ui.colors.bold('Prompt length:'), `${p.promptContent.length} chars`)
		if (Object.keys(runOptions).length) {
			console.log(ui.colors.bold('Options:'))
			for (const [key, val] of Object.entries(runOptions)) {
				const display = typeof val === 'object' ? JSON.stringify(val) : val
				console.log(`  ${key}: ${display}`)
			}
		}
		console.log(ui.colors.bold('\n── Prompt Content ──\n'))
		process.stdout.write(ui.markdown(p.promptContent))
		return
	}

	process.stdout.write(ui.markdown(p.promptContent))

	let stats: RunStats

	if (CLI_TARGETS.has(target)) {
		stats = await runClaudeOrCodex(target as 'claude' | 'codex', p.promptContent, container, options, p.agentOptions)
	} else {
		stats = await runAssistant(target, p.promptContent, options, container, p.agentOptions)
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
