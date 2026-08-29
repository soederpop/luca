import * as readline from 'readline'

/**
 * The interactive chat TUI behind `luca chat`.
 *
 * One persistent ink app owns the whole session: completed turns flow into a
 * <Static> scrollback, the live region renders the streaming turn (text +
 * tool calls), and a custom input line provides persisted history, editing
 * keys, tab completion, and abort. Slash commands are registry-based so the
 * surface is discoverable via /help.
 */

export interface ChatTuiOptions {
	container: any
	manager: any
	historyMode: string
	createOptions: Record<string, any>
	/** Assistant to talk to. Undefined opens the lobby (@-mention routing). */
	initialAssistant?: string
	/** All discovered assistant entries ({ name, description }). */
	entries: Array<{ name: string; description?: string }>
	/** Thread to resume on the initial assistant. */
	resumeThreadId?: string
	/** Applied to every assistant this session creates (e.g. --use wiring). */
	setupAssistant?: (assistant: any) => void
}

export interface ChatTuiResult {
	/** name → currentThreadId for every assistant that saved history. */
	threads: Array<{ name: string; threadId: string }>
}

type ToolEv = {
	id: string
	name: string
	args: any
	status: 'running' | 'ok' | 'error'
	result?: any
	error?: string
}

type Part = { type: 'text'; text: string } | { type: 'tool'; ev: ToolEv }

type Item =
	| { id: string; kind: 'user'; who: string; text: string }
	| { id: string; kind: 'assistant'; who: string; parts: Part[]; durationMs: number; aborted?: boolean }
	| { id: string; kind: 'system'; lines: string[] }

const SPINNER = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
const MAX_INPUT_HISTORY = 500
const TOOL_RESULT_MAX_LINES = 12
const TOOL_RESULT_MAX_CHARS = 2000

export async function runChatTui(options: ChatTuiOptions): Promise<ChatTuiResult> {
	const { container, manager, historyMode, createOptions, entries } = options
	const ui = container.feature('ui')
	const colors = ui.colors
	const fs = container.feature('fs')

	if (!process.stdin.isTTY || !process.stdout.isTTY) {
		return runPlainChat(options)
	}

	const ink = container.feature('ink', { enable: true })
	await ink.loadModules()
	const React = ink.React
	const h = React.createElement
	const { Box, Text, Static } = ink.components
	const { useApp, useInput } = ink.hooks
	const { useState, useEffect, useMemo, useSyncExternalStore } = React

	const lobby = !options.initialAssistant
	const multi = entries.length > 1

	// ── markdown: ui.markdown is typed string | Promise<string>; marked-terminal
	// is sync in practice, but never print "[object Promise]" if that changes
	function md(text: string): string {
		if (!text) return ''
		try {
			const rendered = ui.markdown(text)
			return typeof rendered === 'string' ? rendered.trimEnd() : text.trimEnd()
		} catch {
			return text.trimEnd()
		}
	}

	// ── external store the ink app subscribes to ──────────────────────────────
	let nextId = 1
	const uid = () => `i${nextId++}`

	const store = {
		version: 0,
		listeners: new Set<() => void>(),
		transcript: [] as Item[],
		// Static index base — reset after a /console detour so the remounted app
		// doesn't re-print scrollback that is already on screen
		staticBase: 0,
		current: null as null | { who: string; parts: Part[]; startedAt: number },
		busy: false,
		queue: [] as Array<{ target: string; text: string }>,
		target: options.initialAssistant ?? null,
		showToolResults: false,
		mode: 'input' as 'input' | 'picker',
		picker: null as null | {
			title: string
			items: Array<{ label: string; hint?: string; value: string }>
			index: number
			onPick: (value: string) => void | Promise<void>
		},
		notice: '',
		exitReason: null as null | 'exit' | 'console',
	}

	function bump() {
		store.version++
		for (const listener of store.listeners) listener()
	}

	function systemLine(...lines: string[]) {
		store.transcript.push({ id: uid(), kind: 'system', lines })
		bump()
	}

	function requestExit(reason: 'exit' | 'console') {
		store.exitReason = reason
		bump()
	}

	// ── assistants ────────────────────────────────────────────────────────────
	type Cell = { assistant: any; started: boolean; startPromise: Promise<void> | null }
	const cells = new Map<string, Cell>()

	function getCell(name: string): Cell {
		let cell = cells.get(name)
		if (cell) return cell
		const assistant = manager.create(name, { ...createOptions })
		options.setupAssistant?.(assistant)
		wireAssistant(name, assistant)
		cell = { assistant, started: false, startPromise: null }
		cells.set(name, cell)
		return cell
	}

	async function ensureStarted(name: string): Promise<Cell> {
		const cell = getCell(name)
		if (cell.started) return cell
		if (!cell.startPromise) {
			cell.startPromise = (async () => {
				await cell.assistant.start()
				cell.started = true
				const messageCount = cell.assistant.messages?.length || 0
				if (historyMode !== 'lifecycle' && messageCount > 1) {
					systemLine(colors.dim(`resumed ${colors.cyan(name)} (${messageCount} messages)`))
				}
			})()
		}
		await cell.startPromise
		return cell
	}

	function ensureCurrent(who: string) {
		if (!store.current) store.current = { who, parts: [], startedAt: Date.now() }
		return store.current
	}

	function wireAssistant(name: string, assistant: any) {
		assistant.on('chunk', (text: string) => {
			const current = ensureCurrent(name)
			const last = current.parts[current.parts.length - 1]
			if (last && last.type === 'text') last.text += text
			else current.parts.push({ type: 'text', text })
			bump()
		})

		assistant.on('toolCall', (toolName: string, args: any) => {
			const current = ensureCurrent(name)
			current.parts.push({ type: 'tool', ev: { id: uid(), name: toolName, args, status: 'running' } })
			bump()
		})

		const settleTool = (toolName: string, patch: Partial<ToolEv>) => {
			const parts = store.current?.parts ?? []
			for (let i = parts.length - 1; i >= 0; i--) {
				const part = parts[i]!
				if (part.type === 'tool' && part.ev.name === toolName && part.ev.status === 'running') {
					Object.assign(part.ev, patch)
					bump()
					return
				}
			}
		}

		assistant.on('toolResult', (toolName: string, result: any) => {
			settleTool(toolName, { status: 'ok', result })
		})

		assistant.on('toolError', (toolName: string, error: any) => {
			settleTool(toolName, { status: 'error', error: error?.message || String(error) })
		})

		assistant.on('autoCompactTriggered', () => {
			systemLine(colors.dim('⧗ context is getting long — auto-compacting…'))
		})
		assistant.on('compactEnd', (info: any) => {
			const removed = info?.removedCount
			systemLine(colors.dim(`⧗ compacted${typeof removed === 'number' ? ` (${removed} messages summarized)` : ''}`))
		})
	}

	// ── turns ─────────────────────────────────────────────────────────────────
	function flushCurrent(aborted: boolean) {
		const current = store.current
		if (current) {
			store.transcript.push({
				id: uid(),
				kind: 'assistant',
				who: current.who,
				parts: current.parts,
				durationMs: Date.now() - current.startedAt,
				aborted,
			})
		}
		store.current = null
	}

	async function runTurn(name: string, ask: (assistant: any) => Promise<any>, userText?: string) {
		store.busy = true
		if (userText != null) {
			store.transcript.push({ id: uid(), kind: 'user', who: name, text: userText })
		}
		store.current = { who: name, parts: [], startedAt: Date.now() }
		bump()

		let aborted = false
		let errorMsg: string | null = null
		try {
			const cell = await ensureStarted(name)
			await ask(cell.assistant)
		} catch (err: any) {
			if (err?.name === 'ConversationAbortError') aborted = true
			else errorMsg = err?.message || String(err)
		}

		flushCurrent(aborted)
		if (errorMsg) {
			systemLine(colors.red(`✗ turn failed: ${errorMsg}`), colors.dim('  /retry to try again'))
		}
		store.busy = false
		bump()

		const queued = store.queue.shift()
		if (queued) {
			bump()
			void runTurn(queued.target, (assistant) => assistant.ask(queued.text), queued.text)
		}
	}

	function sendMessage(target: string, text: string) {
		if (store.busy) {
			store.queue.push({ target, text })
			bump()
			return
		}
		void runTurn(target, (assistant) => assistant.ask(text), text)
	}

	function abortActive() {
		const target = store.current?.who || store.target
		if (!target) return
		const cell = cells.get(target)
		cell?.assistant?.abort?.()
	}

	// ── @mention parsing ──────────────────────────────────────────────────────
	function parseMention(text: string): { name: string; rest: string } | null {
		const match = text.match(/^@([\w-]+)\s*([\s\S]*)$/)
		if (!match) return null
		return { name: match[1]!, rest: match[2]!.trim() }
	}

	function assistantNames(): string[] {
		return entries.map((entry) => entry.name)
	}

	// ── slash commands ────────────────────────────────────────────────────────
	function activeAssistant(): any | null {
		if (!store.target) {
			systemLine(colors.yellow('no active assistant — @mention one first (tab completes names)'))
			return null
		}
		return getCell(store.target).assistant
	}

	function formatRouting(assistant: any): string {
		try {
			const routing = assistant.routing
			return `${routing.provider ?? 'default'} / ${routing.model ?? 'default model'}`
		} catch {
			return 'unresolved'
		}
	}

	const slashCommands: Record<string, { desc: string; usage?: string; run: (args: string[]) => void | Promise<void> }> = {
		help: {
			desc: 'Show commands and key bindings',
			run() {
				const lines: string[] = [colors.bold('commands')]
				for (const [cmdName, cmd] of Object.entries(slashCommands)) {
					lines.push(`  ${colors.cyan(`/${cmdName}${cmd.usage ? ' ' + cmd.usage : ''}`)}  ${colors.dim(cmd.desc)}`)
				}
				lines.push('')
				lines.push(colors.bold('keys'))
				lines.push(`  ${colors.cyan('esc / ctrl+c')}  ${colors.dim('interrupt the running turn')}`)
				lines.push(`  ${colors.cyan('ctrl+o')}        ${colors.dim('toggle expanded tool results')}`)
				lines.push(`  ${colors.cyan('↑ / ↓')}         ${colors.dim('input history (persisted per project)')}`)
				lines.push(`  ${colors.cyan('tab')}           ${colors.dim('complete /commands and @assistants')}`)
				lines.push(`  ${colors.cyan('\\ then enter')}  ${colors.dim('continue on a new line (multiline input)')}`)
				lines.push(`  ${colors.cyan('ctrl+c ctrl+c')} ${colors.dim('quit (or ctrl+d on an empty line)')}`)
				if (multi) lines.push(`  ${colors.cyan('@name …')}       ${colors.dim('route a message to another assistant')}`)
				systemLine(...lines)
			},
		},
		exit: {
			desc: 'Leave the chat',
			run() {
				requestExit('exit')
			},
		},
		clear: {
			desc: 'Clear the conversation context (history file keeps the old turns)',
			run() {
				const assistant = activeAssistant()
				if (!assistant) return
				try {
					const edit = assistant.clearMessages()
					systemLine(colors.dim(`cleared ${edit?.removedCount ?? ''} messages — fresh context`.replace('  ', ' ')))
				} catch (err: any) {
					systemLine(colors.red(`✗ ${err?.message || err}`))
				}
			},
		},
		resume: {
			desc: 'Switch to a saved conversation (picker without an id)',
			usage: '[threadId]',
			async run(args) {
				const assistant = activeAssistant()
				if (!assistant) return
				await ensureStarted(store.target!)
				if (args[0]) {
					await switchThread(assistant, args[0])
					return
				}
				const metas = await assistant.listHistory({ limit: 20 })
				if (!metas.length) {
					systemLine(colors.dim('no saved conversations'))
					return
				}
				store.mode = 'picker'
				store.picker = {
					title: 'Resume a conversation',
					index: 0,
					items: metas.map((meta: any) => ({
						label: meta.title || meta.thread,
						hint: `${new Date(meta.updatedAt).toLocaleString()} · ${meta.messageCount} messages`,
						value: meta.thread,
					})),
					onPick: (thread) => switchThread(assistant, thread),
				}
				bump()
			},
		},
		provider: {
			desc: 'Show or switch the model provider',
			usage: '[id] [model]',
			run(args) {
				const assistant = activeAssistant()
				if (!assistant) return
				const providers = container.feature('modelProviders')
				if (!args[0]) {
					systemLine(
						`${colors.bold('routing')} ${formatRouting(assistant)}`,
						colors.dim(`available: ${providers.available.join(', ')}`),
						colors.dim('switch with /provider <id> [model]'),
					)
					return
				}
				try {
					assistant.setProvider(args[0], args[1] ? { model: args[1] } : {})
					systemLine(colors.green(`→ now routing ${formatRouting(assistant)}`))
				} catch (err: any) {
					systemLine(colors.red(`✗ ${err?.message || err}`), colors.dim(`available: ${providers.available.join(', ')}`))
				}
			},
		},
		model: {
			desc: 'Switch the model on the current provider',
			usage: '<name>',
			run(args) {
				const assistant = activeAssistant()
				if (!assistant) return
				if (!args[0]) {
					systemLine(colors.dim('usage: /model <name>'))
					return
				}
				try {
					assistant.setModel(args[0])
					systemLine(colors.green(`→ now routing ${formatRouting(assistant)}`))
				} catch (err: any) {
					systemLine(colors.red(`✗ ${err?.message || err}`))
				}
			},
		},
		tools: {
			desc: 'List the tools the active assistant can call',
			run() {
				const assistant = activeAssistant()
				if (!assistant) return
				const names = Object.keys(assistant.tools || {})
				if (!names.length) {
					systemLine(colors.dim('no tools registered'))
					return
				}
				systemLine(colors.bold(`tools (${names.length})`), ...names.map((toolName) => {
					const desc = assistant.tools[toolName]?.description
					return `  ${colors.cyan(toolName)}${desc ? colors.dim(`  ${String(desc).split('\n')[0]}`) : ''}`
				}))
			},
		},
		compact: {
			desc: 'Summarize older messages to reclaim context',
			async run() {
				const assistant = activeAssistant()
				if (!assistant) return
				await ensureStarted(store.target!)
				try {
					const result = await assistant.conversation.compact()
					systemLine(colors.dim(`⧗ compacted — ${result.removedCount} messages summarized (~${result.estimatedTokens} tokens)`))
				} catch (err: any) {
					systemLine(colors.red(`✗ ${err?.message || err}`))
				}
			},
		},
		retry: {
			desc: 'Retry the last failed turn',
			run() {
				const target = store.target
				if (!target) return void activeAssistant()
				if (store.busy) return
				void runTurn(target, (assistant) => assistant.conversation.retryFailedTurn())
			},
		},
		history: {
			desc: 'List saved conversations for the active assistant',
			async run() {
				const assistant = activeAssistant()
				if (!assistant) return
				await ensureStarted(store.target!)
				const metas = await assistant.listHistory({ limit: 20 })
				if (!metas.length) {
					systemLine(colors.dim('no saved conversations'))
					return
				}
				systemLine(colors.bold('recent conversations'), ...metas.map((meta: any) =>
					`  ${colors.cyan(meta.thread)} ${colors.dim(`${new Date(meta.updatedAt).toLocaleString()} · ${meta.messageCount} messages · ${meta.title}`)}`,
				))
			},
		},
		assistants: {
			desc: 'List the assistants available in this project',
			run() {
				systemLine(colors.bold('assistants'), ...entries.map((entry) =>
					`  ${colors.cyan('@' + entry.name)}${entry.name === store.target ? colors.green(' ●') : ''}${entry.description ? colors.dim(`  ${entry.description}`) : ''}`,
				))
			},
		},
		console: {
			desc: 'Drop into a live REPL with the container in scope',
			run() {
				requestExit('console')
			},
		},
	}
	;(slashCommands as any).quit = slashCommands.exit

	async function switchThread(assistant: any, thread: string) {
		try {
			await assistant.switchThread(thread)
			const messageCount = assistant.messages?.length || 0
			systemLine(colors.dim(`switched to ${colors.cyan(thread)} (${messageCount} messages)`))
		} catch (err: any) {
			systemLine(colors.red(`✗ ${err?.message || err}`))
		}
	}

	// ── input history (persisted per project, like the repl feature) ──────────
	const cwdHash = container.utils.hashObject(container.cwd)
	const historyPath = container.paths.resolve(container.feature('os').cacheDir, `luca-chat-${cwdHash}.history`)
	let inputHistory: string[] = []
	try {
		fs.ensureFolder(container.paths.dirname(historyPath))
		const content = fs.readFile(historyPath, 'utf-8') as string
		inputHistory = content.split(/\r?\n/).filter(Boolean).map((line: string) => {
			try { return JSON.parse(line) } catch { return line }
		})
	} catch {}

	function saveHistoryEntry(text: string) {
		if (inputHistory[inputHistory.length - 1] === text) return
		inputHistory.push(text)
		if (inputHistory.length > MAX_INPUT_HISTORY) inputHistory = inputHistory.slice(-MAX_INPUT_HISTORY)
		try {
			fs.writeFile(historyPath, inputHistory.map((entry) => JSON.stringify(entry)).join('\n') + '\n')
		} catch {}
	}

	// ── submission ────────────────────────────────────────────────────────────
	function submit(raw: string) {
		const text = raw.trim()
		if (!text) return
		saveHistoryEntry(text)
		store.notice = ''

		if (text === '.exit') return requestExit('exit')

		if (text.startsWith('/')) {
			const [cmdWord, ...args] = text.slice(1).split(/\s+/)
			const cmd = slashCommands[cmdWord as keyof typeof slashCommands]
			if (!cmd) {
				systemLine(colors.red(`unknown command /${cmdWord}`), colors.dim('/help lists everything'))
				return
			}
			void Promise.resolve(cmd.run(args)).catch((err: any) => {
				systemLine(colors.red(`✗ /${cmdWord}: ${err?.message || err}`))
			})
			return
		}

		const mention = parseMention(text)
		if (mention) {
			if (!assistantNames().includes(mention.name)) {
				systemLine(colors.red(`no assistant named "${mention.name}"`), colors.dim(`available: ${assistantNames().map((n) => '@' + n).join(', ')}`))
				return
			}
			store.target = mention.name
			if (!mention.rest) {
				systemLine(colors.dim(`now talking to ${colors.cyan(mention.name)}`))
				bump()
				return
			}
			sendMessage(mention.name, mention.rest)
			return
		}

		if (!store.target) {
			systemLine(colors.yellow('pick an assistant first: @name your message'), colors.dim(`available: ${assistantNames().map((n) => '@' + n).join(', ')}`))
			return
		}
		sendMessage(store.target, text)
	}

	// ── tab completion ────────────────────────────────────────────────────────
	function complete(value: string, cursor: number): { value: string; cursor: number; notice: string } {
		const before = value.slice(0, cursor)
		const after = value.slice(cursor)
		let candidates: string[] = []
		let tokenStart = -1

		const slashMatch = before.match(/^\/([\w-]*)$/)
		const atMatch = before.match(/(?:^|\s)@([\w-]*)$/)
		if (slashMatch) {
			tokenStart = 1
			candidates = Object.keys(slashCommands).filter((cmdName) => cmdName.startsWith(slashMatch[1]!))
		} else if (atMatch) {
			tokenStart = before.length - atMatch[1]!.length
			candidates = assistantNames().filter((assistantName) => assistantName.startsWith(atMatch[1]!))
		}

		if (tokenStart < 0 || !candidates.length) return { value, cursor, notice: '' }

		let common = candidates[0]!
		for (const candidate of candidates.slice(1)) {
			while (!candidate.startsWith(common)) common = common.slice(0, -1)
		}
		const completed = candidates.length === 1 ? candidates[0]! + ' ' : common
		const newBefore = before.slice(0, tokenStart) + completed
		return {
			value: newBefore + after,
			cursor: newBefore.length,
			notice: candidates.length > 1 ? candidates.map((candidate) => (slashMatch ? '/' : '@') + candidate).join('  ') : '',
		}
	}

	// ── components ────────────────────────────────────────────────────────────
	function useStore() {
		return useSyncExternalStore(
			(listener: () => void) => {
				store.listeners.add(listener)
				return () => store.listeners.delete(listener)
			},
			() => store.version,
		)
	}

	function useTick(active: boolean, ms: number) {
		const [tick, setTick] = useState(0)
		useEffect(() => {
			if (!active) return
			const timer = setInterval(() => setTick((t: number) => t + 1), ms)
			return () => clearInterval(timer)
		}, [active, ms])
		return tick
	}

	function previewArgs(args: any): string {
		try {
			const str = JSON.stringify(args) ?? ''
			return str.length > 80 ? str.slice(0, 80) + '…' : str
		} catch {
			return ''
		}
	}

	function ToolLine({ ev, expanded }: { ev: ToolEv; expanded: boolean }) {
		const argsStr = previewArgs(ev.args)
		if (ev.status === 'running') {
			return h(Text, { dimColor: true }, `  ${colors.yellow('⟳')} ${ev.name}(${argsStr})`)
		}
		if (ev.status === 'error') {
			return h(Text, null, `  ${colors.red('✗')} ${ev.name} ${colors.red(ev.error || 'failed')}`)
		}
		const resultStr = typeof ev.result === 'string' ? ev.result : (() => {
			try { return JSON.stringify(ev.result, null, expanded ? 2 : 0) ?? '' } catch { return String(ev.result) }
		})()
		if (!expanded) {
			const preview = resultStr.replace(/\s+/g, ' ').slice(0, 100)
			return h(Text, null, `  ${colors.green('✓')} ${colors.dim(`${ev.name}(${argsStr})`)}${preview ? colors.dim(` → ${preview}${resultStr.length > 100 ? '…' : ''}`) : ''}`)
		}
		let body = resultStr.slice(0, TOOL_RESULT_MAX_CHARS)
		const lines = body.split('\n')
		const truncated = resultStr.length > TOOL_RESULT_MAX_CHARS || lines.length > TOOL_RESULT_MAX_LINES
		body = lines.slice(0, TOOL_RESULT_MAX_LINES).map((line) => '    ' + line).join('\n')
		return h(Box, { flexDirection: 'column' },
			h(Text, null, `  ${colors.green('✓')} ${colors.dim(`${ev.name}(${argsStr})`)}`),
			h(Text, { dimColor: true }, body + (truncated ? colors.dim('\n    …') : '')),
		)
	}

	function TurnParts({ parts, expanded }: { parts: Part[]; expanded: boolean }) {
		return h(Box, { flexDirection: 'column' },
			...parts.map((part, index) => {
				if (part.type === 'tool') return h(ToolLine, { key: part.ev.id, ev: part.ev, expanded })
				return h(Text, { key: `t${index}` }, md(part.text))
			}),
		)
	}

	function TranscriptItem({ item, expanded }: { item: Item; expanded: boolean }) {
		if (item.kind === 'user') {
			return h(Box, { flexDirection: 'column', marginTop: 1 },
				h(Text, null, `${colors.dim('❯')}${multi ? colors.dim(` @${item.who}`) : ''} ${item.text}`),
			)
		}
		if (item.kind === 'system') {
			return h(Box, { flexDirection: 'column', marginTop: 1 },
				...item.lines.map((line, index) => h(Text, { key: index }, line)),
			)
		}
		return h(Box, { flexDirection: 'column', marginTop: 1 },
			...(multi ? [h(Text, null, colors.cyan(colors.bold(item.who)))] : []),
			h(TurnParts, { parts: item.parts, expanded }),
			...(item.aborted ? [h(Text, null, colors.red('⏹ interrupted'))] : []),
		)
	}

	function StatusLine() {
		const parts: string[] = []
		if (store.target) {
			const cell = cells.get(store.target)
			parts.push(colors.cyan(store.target))
			if (cell) parts.push(formatRouting(cell.assistant))
			if (cell?.started) {
				try {
					const usage = cell.assistant.conversation.state.get('tokenUsage')
					const cost = cell.assistant.conversation.state.get('cost')
					if (usage?.total) {
						const k = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n))
						parts.push(`↑${k(usage.prompt)} ↓${k(usage.completion)}`)
					}
					if (cost?.totalCost) parts.push(`$${cost.totalCost.toFixed(4)}`)
				} catch {}
			}
		} else {
			parts.push('@mention an assistant')
		}
		parts.push(historyMode)
		parts.push(`ctrl+o tools ${store.showToolResults ? 'on' : 'off'}`)
		return h(Text, { dimColor: true }, '  ' + parts.join(' · '))
	}

	function Picker() {
		const picker = store.picker!
		return h(Box, { flexDirection: 'column', marginTop: 1 },
			h(Text, null, colors.bold(picker.title) + colors.dim('  ↑↓ move · enter select · esc cancel')),
			...picker.items.map((item, index) => h(Text, { key: item.value },
				(index === picker.index ? colors.cyan('❯ ') : '  ') +
				(index === picker.index ? colors.bold(item.label) : item.label) +
				(item.hint ? colors.dim(`  ${item.hint}`) : ''),
			)),
		)
	}

	function App() {
		useStore()
		const { exit } = useApp()
		const [value, setValue] = useState('')
		const [cursor, setCursor] = useState(0)
		const [historyIndex, setHistoryIndex] = useState(null as number | null)
		const [draft, setDraft] = useState('')
		const [ctrlCArmed, setCtrlCArmed] = useState(false)
		const busyTick = useTick(store.busy, 120)

		useEffect(() => {
			if (store.exitReason) exit()
		}, [store.version])

		const setInput = (nextValue: string, nextCursor: number) => {
			setValue(nextValue)
			setCursor(Math.max(0, Math.min(nextCursor, nextValue.length)))
		}

		useInput((input: string, key: any) => {
			setCtrlCArmed(false)

			if (store.mode === 'picker' && store.picker) {
				const picker = store.picker
				if (key.upArrow) { picker.index = Math.max(0, picker.index - 1); bump(); return }
				if (key.downArrow) { picker.index = Math.min(picker.items.length - 1, picker.index + 1); bump(); return }
				if (key.escape) { store.mode = 'input'; store.picker = null; bump(); return }
				if (key.return) {
					const chosen = picker.items[picker.index]
					store.mode = 'input'
					store.picker = null
					bump()
					if (chosen) void Promise.resolve(picker.onPick(chosen.value))
					return
				}
				return
			}

			if (key.ctrl && input === 'c') {
				if (store.busy) return abortActive()
				if (value) return setInput('', 0)
				if (ctrlCArmed) return requestExit('exit')
				setCtrlCArmed(true)
				store.notice = colors.dim('press ctrl+c again to quit')
				bump()
				return
			}
			if (key.ctrl && input === 'd') {
				if (!value) requestExit('exit')
				return
			}
			if (key.ctrl && input === 'o') {
				store.showToolResults = !store.showToolResults
				bump()
				return
			}
			if (key.escape) {
				if (store.busy) return abortActive()
				setInput('', 0)
				store.notice = ''
				bump()
				return
			}

			if (key.return) {
				if (value.endsWith('\\')) {
					setInput(value.slice(0, -1) + '\n', cursor)
					return
				}
				const text = value
				setInput('', 0)
				setHistoryIndex(null)
				submit(text)
				return
			}

			if (key.upArrow || key.downArrow) {
				if (value.includes('\n')) return
				if (key.upArrow) {
					if (!inputHistory.length) return
					const nextIndex = historyIndex === null ? inputHistory.length - 1 : Math.max(0, historyIndex - 1)
					if (historyIndex === null) setDraft(value)
					setHistoryIndex(nextIndex)
					const entry = inputHistory[nextIndex] ?? ''
					setInput(entry, entry.length)
				} else {
					if (historyIndex === null) return
					const nextIndex = historyIndex + 1
					if (nextIndex >= inputHistory.length) {
						setHistoryIndex(null)
						setInput(draft, draft.length)
					} else {
						setHistoryIndex(nextIndex)
						const entry = inputHistory[nextIndex] ?? ''
						setInput(entry, entry.length)
					}
				}
				return
			}

			if (key.leftArrow) return setCursor(Math.max(0, cursor - 1))
			if (key.rightArrow) return setCursor(Math.min(value.length, cursor + 1))
			if (key.ctrl && input === 'a') return setCursor(0)
			if (key.ctrl && input === 'e') return setCursor(value.length)
			if (key.ctrl && input === 'u') return setInput(value.slice(cursor), 0)
			if (key.ctrl && input === 'k') return setInput(value.slice(0, cursor), cursor)
			if (key.ctrl && input === 'w') {
				const before = value.slice(0, cursor).replace(/\S+\s*$/, '')
				return setInput(before + value.slice(cursor), before.length)
			}
			if (key.backspace || key.delete) {
				if (cursor === 0) return
				return setInput(value.slice(0, cursor - 1) + value.slice(cursor), cursor - 1)
			}
			if (key.tab) {
				const completion = complete(value, cursor)
				store.notice = completion.notice
				bump()
				return setInput(completion.value, completion.cursor)
			}
			if (key.ctrl || key.meta) return

			if (input) {
				const clean = input.replace(/\r\n?/g, '\n')
				setHistoryIndex(null)
				setInput(value.slice(0, cursor) + clean + value.slice(cursor), cursor + clean.length)
			}
		})

		const expanded = store.showToolResults
		const staticItems = store.transcript.slice(store.staticBase)
		const spinner = SPINNER[busyTick % SPINNER.length]
		const elapsed = store.current ? Math.round((Date.now() - store.current.startedAt) / 1000) : 0

		// input line with a block cursor; multiline drafts get a gutter
		const promptSymbol = colors.cyan('❯ ')
		let rendered: string
		if (cursor < value.length) {
			const cursorChar = value[cursor]!
			rendered = cursorChar === '\n'
				? value.slice(0, cursor) + colors.inverse(' ') + '\n' + value.slice(cursor + 1)
				: value.slice(0, cursor) + colors.inverse(cursorChar) + value.slice(cursor + 1)
		} else {
			rendered = value + colors.inverse(' ')
		}

		return h(Box, { flexDirection: 'column' },
			h(Static, { items: staticItems }, (item: Item) => h(TranscriptItem, { key: item.id, item, expanded })),
			...(store.current ? [h(Box, { flexDirection: 'column', marginTop: 1 },
				...(multi ? [h(Text, null, colors.cyan(colors.bold(store.current.who)))] : []),
				h(TurnParts, { parts: store.current.parts, expanded }),
			)] : []),
			...(store.busy ? [h(Text, null, `${colors.yellow(spinner ?? '·')} ${colors.dim(`thinking… ${elapsed}s · esc to interrupt`)}`)] : []),
			...store.queue.map((queued, index) => h(Text, { key: `q${index}`, dimColor: true }, `  ⧗ queued: ${queued.text.split('\n')[0]}`)),
			...(store.mode === 'picker' && store.picker ? [h(Picker, {})] : []),
			...(store.mode === 'input' ? [h(Box, { marginTop: 1 }, h(Text, null, promptSymbol + rendered.split('\n').join('\n' + colors.dim('… ')))) ] : []),
			...(store.notice ? [h(Text, { dimColor: true }, '  ' + store.notice)] : []),
			h(StatusLine, {}),
		)
	}

	// ── boot ──────────────────────────────────────────────────────────────────
	if (options.initialAssistant) {
		const cell = getCell(options.initialAssistant)
		if (options.resumeThreadId) cell.assistant.resumeThread(options.resumeThreadId)
		await ensureStarted(options.initialAssistant)
	}

	const bootLines = [
		lobby
			? colors.dim(`lobby — @mention an assistant to start (${entries.map((entry) => colors.cyan('@' + entry.name)).join(', ')})`)
			: colors.dim(`chatting with ${colors.cyan(options.initialAssistant!)}`),
		colors.dim('/help for commands · esc interrupts · ctrl+o expands tool results'),
	]
	store.transcript.unshift({ id: uid(), kind: 'system', lines: bootLines })

	// /console unmounts the app, runs a repl on the same stdin, then remounts
	// with the static base advanced so scrollback isn't reprinted
	while (true) {
		store.exitReason = null
		const instance = await ink.render(h(App, {}), { patchConsole: false, exitOnCtrlC: false })
		await instance.waitUntilExit()
		ink.unmount()
		if (store.exitReason === 'console') {
			await runConsole()
			store.staticBase = store.transcript.length
			systemLine(colors.dim(`back in chat${store.target ? ` with ${colors.cyan(store.target)}` : ''}`))
			continue
		}
		break
	}

	async function runConsole() {
		const featureContext: Record<string, any> = {}
		for (const featureName of container.features.available) {
			try { featureContext[featureName] = container.feature(featureName) } catch {}
		}
		const replPrompt = colors.magenta('console') + colors.dim(' > ')
		const repl = container.feature('repl', { prompt: replPrompt })
		console.log()
		console.log(colors.dim('  Dropping into console. The active assistant is available as `assistant`.'))
		console.log(colors.dim('  Type .exit to return to chat.'))
		console.log()
		await repl.start({
			context: {
				...featureContext,
				assistant: store.target ? getCell(store.target).assistant : undefined,
				assistants: Object.fromEntries([...cells.entries()].map(([cellName, cell]) => [cellName, cell.assistant])),
				console,
				setTimeout, setInterval, clearTimeout, clearInterval,
				fetch,
			},
		})
		await new Promise<void>((resolve) => {
			repl._rl!.on('close', resolve)
		})
	}

	return collectThreads()

	function collectThreads(): ChatTuiResult {
		const threads: Array<{ name: string; threadId: string }> = []
		if (historyMode !== 'lifecycle') {
			for (const [cellName, cell] of cells.entries()) {
				const threadId = cell.assistant.currentThreadId
				if (cell.started && threadId) threads.push({ name: cellName, threadId })
			}
		}
		return { threads }
	}
}

/**
 * Piped / non-TTY fallback: no raw mode, no ink — a plain line loop so
 * `echo "question" | luca chat researcher` still works.
 */
async function runPlainChat(options: ChatTuiOptions): Promise<ChatTuiResult> {
	const { container, manager, historyMode, createOptions, entries } = options
	const ui = container.feature('ui')
	const colors = ui.colors

	let target = options.initialAssistant ?? (entries.length === 1 ? entries[0]!.name : null)
	const cells = new Map<string, any>()

	async function getAssistant(name: string) {
		let assistant = cells.get(name)
		if (assistant) return assistant
		assistant = manager.create(name, { ...createOptions })
		options.setupAssistant?.(assistant)
		assistant.on('toolCall', (toolName: string, args: any) => {
			process.stderr.write(colors.dim(`  ⟳ ${toolName}(${JSON.stringify(args).slice(0, 120)})\n`))
		})
		if (name === options.initialAssistant && options.resumeThreadId) {
			assistant.resumeThread(options.resumeThreadId)
		}
		await assistant.start()
		cells.set(name, assistant)
		return assistant
	}

	const rl = readline.createInterface({ input: process.stdin, terminal: false })
	for await (const line of rl) {
		const text = line.trim()
		if (!text || text === '.exit' || text === '/exit') {
			if (!text) continue
			break
		}
		const mention = text.match(/^@([\w-]+)\s*([\s\S]*)$/)
		let toSend = text
		if (mention && entries.some((entry) => entry.name === mention[1])) {
			target = mention[1]!
			toSend = mention[2]!.trim()
			if (!toSend) continue
		}
		if (!target) {
			process.stderr.write(colors.red('No assistant selected — prefix with @name.\n'))
			continue
		}
		const assistant = await getAssistant(target)
		const response = await assistant.ask(toSend)
		process.stdout.write(response + '\n')
	}

	const threads: Array<{ name: string; threadId: string }> = []
	if (historyMode !== 'lifecycle') {
		for (const [name, assistant] of cells.entries()) {
			if (assistant.currentThreadId) threads.push({ name, threadId: assistant.currentThreadId })
		}
	}
	return { threads }
}
