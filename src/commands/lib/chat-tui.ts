import * as readline from 'readline'
import * as util from 'util'
import { createInkSurface, type ShowWidgetArgs, type AskUserResult } from './ink-surface'

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
	/**
	 * Terminal lines the splash left on screen. Subtracted from the viewport
	 * padding so the intro art stays visible above the session at boot instead
	 * of being pushed into scrollback.
	 */
	splashLines?: number
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

type Part = { type: 'text'; text: string } | { type: 'reasoning'; text: string } | { type: 'tool'; ev: ToolEv }

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
		staticBase: 0,
		current: null as null | { who: string; parts: Part[]; startedAt: number },
		busy: false,
		queue: [] as Array<{ target: string; text: string }>,
		target: options.initialAssistant ?? null,
		showToolResults: false,
		showThinking: false,
		// Only surface the ctrl+t hint once a model has actually streamed reasoning
		sawReasoning: false,
		mode: 'input' as 'input' | 'picker' | 'console' | 'ui',
		picker: null as null | {
			title: string
			items: Array<{ label: string; hint?: string; value: string }>
			index: number
			onPick: (value: string) => void | Promise<void>
			/** Called when the picker is dismissed (esc, or the turn aborts). */
			onCancel?: () => void
		},
		/** Assistant-authored ink component mounted by the renderUi tool. */
		ui: null as null | {
			Component: any
			title: string
			settle: (result: { value: unknown } | { cancelled: true } | { error: string }) => void
		},
		notice: '',
		exitRequested: false,
	}

	function bump() {
		store.version++
		for (const listener of store.listeners) listener()
	}

	function systemLine(...lines: string[]) {
		store.transcript.push({ id: uid(), kind: 'system', lines })
		bump()
	}

	function requestExit() {
		store.exitRequested = true
		bump()
	}

	// ── assistant UI surface (showWidget / askUser tools) ─────────────────────
	function renderWidget(spec: ShowWidgetArgs): string[] {
		const lines: string[] = []
		if (spec.title) lines.push(colors.bold(spec.title))
		if (spec.widget === 'banner') {
			lines.push(colors.cyan(colors.bold(spec.text ?? '')))
		} else if (spec.widget === 'markdown') {
			lines.push(...md(spec.text ?? '').split('\n'))
		} else if (spec.widget === 'list') {
			for (const item of spec.items ?? []) lines.push(`  ${colors.dim('•')} ${item}`)
		} else if (spec.widget === 'table') {
			const columns = spec.columns ?? []
			const rows = spec.rows ?? []
			const widths = columns.map((col, i) => Math.max(col.length, ...rows.map((row) => (row[i] ?? '').length)))
			const pad = (cell: string, i: number) => cell.padEnd(widths[i] ?? cell.length)
			lines.push('  ' + colors.dim(columns.map(pad).join('  ')))
			lines.push('  ' + colors.dim(widths.map((w) => '─'.repeat(w)).join('  ')))
			for (const row of rows) lines.push('  ' + columns.map((_, i) => pad(row[i] ?? '', i)).join('  '))
		}
		return lines
	}

	// renderUi: compile assistant-authored TSX against the session's single
	// React/ink instance. A second React copy breaks every hook, so imports of
	// 'react'/'ink' are resolved to the live modules via this require shim —
	// never to node_modules.
	const uiModuleShim: Record<string, any> = {}
	function uiRequire(id: string) {
		if (id === 'react') return React
		if (id === 'ink') {
			if (!uiModuleShim.ink) {
				// The error boundary catches render/effect crashes, but React never
				// routes event-handler errors through boundaries — and useInput
				// callbacks are where most assistant UI code runs. Wrap the hook so
				// a throw mid-keystroke settles the tool call as { error } (which
				// the assistant sees and can fix) instead of escaping ink's input
				// loop and taking the app down.
				const realUseInput = ink.hooks.useInput
				const guardedUseInput = (handler: any, opts?: any) => realUseInput((input: string, key: any) => {
					try {
						handler(input, key)
					} catch (err: any) {
						settleUi({ error: `component crashed in input handler: ${err?.message || err}` })
					}
				}, opts)
				uiModuleShim.ink = { ...ink.components, ...ink.hooks, useInput: guardedUseInput }
			}
			return uiModuleShim.ink
		}
		throw new Error(`import "${id}" is not available in renderUi — only "react" and "ink" can be imported`)
	}

	// Scope proxy backing the `with` block in compiled UI components: resolves
	// bare identifiers against container.context on every lookup. Names our
	// factory already binds are excluded so context keys can never shadow the
	// tool contract (done/cancel/require/...).
	const UI_SCOPE_RESERVED = new Set(['module', 'exports', 'require', 'container', 'done', 'cancel', 'React'])
	function makeContextScope() {
		return new Proxy({}, {
			has: (_target, key) => typeof key === 'string' && !UI_SCOPE_RESERVED.has(key) && key in (container.context ?? {}),
			get: (_target, key) => {
				if (key === Symbol.unscopables) return undefined
				return (container.context as any)?.[key]
			},
		})
	}

	function compileUiComponent(source: string, scope: { done: (value: unknown) => void; cancel: () => void }): any {
		const transpiler = container.feature('transpiler')
		const out = transpiler.transformSync(source, { loader: 'tsx', format: 'cjs' })
		// Classic JSX compiles to React.createElement calls. If the source
		// imported React itself the CJS transform already declared it — injecting
		// our own binding then would be a duplicate-declaration SyntaxError, so
		// only add the prelude when the code doesn't bind React.
		const bindsReact = /\b(?:const|let|var|function|class)\s+React\b/.test(out.code)
		// Strip a leading "use strict" — the context scope below relies on
		// sloppy-mode `with`, and the directive would make it a SyntaxError.
		const userCode = out.code.replace(/^\s*(['"])use strict\1;?\s*/, '')
		const code = (bindsReact ? '' : "const React = require('react');\n") + userCode
		const moduleRef = { exports: {} as any }
		// done/cancel are in module scope as well as props: a component that
		// forgets to destructure its props and calls bare done() still settles
		// the tool call instead of throwing "done is not defined" mid-keystroke.
		//
		// The `with` block spreads container.context into scope by NAME: every
		// feature instance and everything added via container.addContext resolves
		// as a bare identifier, live (values added after compile are seen too,
		// since the proxy consults container.context per lookup). Unlike injecting
		// context keys as parameters, the component's own `const ui = ...` simply
		// shadows a context key instead of being a duplicate-declaration error.
		const factory = new Function(
			'module', 'exports', 'require', 'container', 'done', 'cancel', '__containerContext',
			`with (__containerContext) {\n${code}\n}`,
		)
		factory(moduleRef, moduleRef.exports, uiRequire, container, scope.done, scope.cancel, makeContextScope())
		const exported = moduleRef.exports
		const Component = exported?.default ?? exported?.Widget ?? (typeof exported === 'function' ? exported : null)
		if (typeof Component !== 'function') {
			throw new Error('source must export default a function component (or export one named Widget)')
		}
		return Component
	}

	// Class error boundary: a render crash inside assistant-authored UI settles
	// the tool call with the error instead of taking down the whole chat app.
	class UiErrorBoundary extends (React.Component as any) {
		state = { failed: false }
		static getDerivedStateFromError() { return { failed: true } }
		componentDidCatch(err: any) {
			settleUi({ error: `component crashed while rendering: ${err?.message || err}` })
		}
		render() {
			return (this.state as any).failed ? null : (this.props as any).children
		}
	}

	function settleUi(result: { value: unknown } | { cancelled: true } | { error: string }) {
		const active = store.ui
		if (!active) return
		store.ui = null
		store.mode = 'input'
		const outcome = 'error' in result
			? colors.red(result.error)
			: 'cancelled' in result ? colors.yellow('cancelled') : colors.cyan('done')
		store.transcript.push({ id: uid(), kind: 'system', lines: [colors.dim(`◫ ${active.title} → `) + outcome] })
		bump()
		active.settle(result)
	}

	const inkSurface = createInkSurface({
		show(spec) {
			store.transcript.push({ id: uid(), kind: 'system', lines: renderWidget(spec) })
			bump()
		},
		ask(spec) {
			return new Promise((resolve) => {
				if (store.mode === 'picker') {
					// Another widget already owns the keyboard — fail the tool call
					// instead of silently replacing what the user is looking at.
					resolve({ cancelled: true })
					return
				}
				const items = spec.kind === 'confirm'
					? [{ label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' }]
					: (spec.options ?? []).map((opt) => ({ label: opt.label, value: opt.value ?? opt.label, hint: opt.hint }))
				const settle = (result: AskUserResult) => {
					store.transcript.push({
						id: uid(),
						kind: 'system',
						lines: [colors.dim(`? ${spec.question} → `) + ('cancelled' in result ? colors.yellow('cancelled') : colors.cyan(result.label))],
					})
					bump()
					resolve(result)
				}
				store.mode = 'picker'
				store.picker = {
					title: spec.question,
					items,
					index: 0,
					onPick: (value) => settle({ value, label: items.find((item) => item.value === value)?.label ?? value }),
					onCancel: () => settle({ cancelled: true }),
				}
				bump()
			})
		},
		renderUi(spec) {
			return new Promise((resolve) => {
				if (store.mode !== 'input') {
					resolve({ error: `cannot mount UI while the terminal is in ${store.mode} mode` })
					return
				}
				let Component: any
				try {
					Component = compileUiComponent(spec.source, {
						done: (value) => settleUi({ value: value === undefined ? null : value }),
						cancel: () => settleUi({ cancelled: true }),
					})
				} catch (err: any) {
					resolve({ error: `failed to compile component: ${err?.message || err}` })
					return
				}
				store.mode = 'ui'
				store.ui = { Component, title: spec.title || 'custom ui', settle: resolve }
				bump()
			})
		},
	})

	// ── assistants ────────────────────────────────────────────────────────────
	type Cell = { assistant: any; started: boolean; startPromise: Promise<void> | null }
	const cells = new Map<string, Cell>()

	function getCell(name: string): Cell {
		let cell = cells.get(name)
		if (cell) return cell
		const assistant = manager.create(name, { ...createOptions })
		options.setupAssistant?.(assistant)
		assistant.use(inkSurface)
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

		assistant.on('reasoning', (text: string) => {
			const current = ensureCurrent(name)
			store.sawReasoning = true
			const last = current.parts[current.parts.length - 1]
			if (last && last.type === 'reasoning') last.text += text
			else current.parts.push({ type: 'reasoning', text })
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
		// A pending askUser/renderUi widget holds the turn open — settle it first
		// so the tool promise resolves and the abort doesn't leave it dangling.
		if (store.mode === 'picker' && store.picker?.onCancel) {
			const cancel = store.picker.onCancel
			store.mode = 'input'
			store.picker = null
			bump()
			cancel()
		}
		if (store.mode === 'ui' && store.ui) settleUi({ cancelled: true })
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
				lines.push(`  ${colors.cyan('ctrl+t')}        ${colors.dim('toggle thinking/reasoning output (also /thinking)')}`)
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
				requestExit()
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
		thinking: {
			desc: 'Toggle reasoning/thinking output (or /thinking on|off)',
			usage: '[on|off]',
			run(args) {
				if (args[0] === 'on') store.showThinking = true
				else if (args[0] === 'off') store.showThinking = false
				else store.showThinking = !store.showThinking
				const note = store.showThinking
					? 'thinking shown — what appears depends on the provider (raw thinking from local models, summaries from openai, nothing from codex/claude-code)'
					: 'thinking hidden (a dim ✻ line marks where it happened)'
				systemLine(colors.dim(note))
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
			desc: 'Console mode — evaluate JS with the container in scope (.exit returns)',
			run() {
				enterConsole()
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

	// ── console mode: evaluate JS in the repl's VM without leaving ink ────────
	// (Tearing ink down for a readline repl is not survivable in bun: once a
	// readline interface has been through fd 0 after an ink app, the next ink
	// render never receives another byte. So the console lives inside the app.)
	let consoleContext: Record<string, any> | null = null

	function enterConsole() {
		const featureContext: Record<string, any> = {}
		for (const featureName of container.features.available) {
			try { featureContext[featureName] = container.feature(featureName) } catch {}
		}
		consoleContext = {
			...featureContext,
			assistant: store.target ? getCell(store.target).assistant : undefined,
			assistants: Object.fromEntries([...cells.entries()].map(([cellName, cell]) => [cellName, cell.assistant])),
			console,
			setTimeout, setInterval, clearTimeout, clearInterval,
			fetch,
		}
		store.mode = 'console'
		systemLine(
			colors.magenta('console mode') + colors.dim(' — evaluate JS with every feature in scope; the active assistant is `assistant`, `_` holds the last result'),
			colors.dim('.exit returns to chat'),
		)
	}

	async function runConsoleLine(code: string) {
		const repl = container.feature('repl')
		const { value, error } = await repl.evaluate(code, consoleContext ? { context: consoleContext } : {})
		consoleContext = null // merged into the VM on first use; later lines see the same globals
		if (error) systemLine(colors.red(`Error: ${error.message}`))
		else if (value !== undefined) systemLine(util.inspect(value, { colors: true, depth: 4 }))
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

		if (store.mode === 'console') {
			if (text === '.exit' || text === 'exit') {
				store.mode = 'input'
				systemLine(colors.dim(`back in chat${store.target ? ` with ${colors.cyan(store.target)}` : ''}`))
				return
			}
			store.transcript.push({ id: uid(), kind: 'system', lines: [colors.magenta('console ❯ ') + text] })
			bump()
			void runConsoleLine(text)
			return
		}

		if (text === '.exit') return requestExit()

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

	function ReasoningBlock({ text, streaming }: { text: string; streaming: boolean }) {
		const approxTokens = Math.max(1, Math.round(text.length / 4))
		if (!store.showThinking) {
			return h(Text, { dimColor: true },
				`✻ ${streaming ? 'thinking…' : 'thought'} (~${approxTokens} tokens) · ctrl+t to show`)
		}
		return h(Box, { flexDirection: 'column' },
			h(Text, { dimColor: true }, `✻ ${streaming ? 'thinking…' : 'thinking'}`),
			h(Text, { dimColor: true, italic: true }, text.trim() || '…'),
		)
	}

	function TurnParts({ parts, expanded, streaming }: { parts: Part[]; expanded: boolean; streaming?: boolean }) {
		return h(Box, { flexDirection: 'column' },
			...parts.map((part, index) => {
				if (part.type === 'tool') return h(ToolLine, { key: part.ev.id, ev: part.ev, expanded })
				if (part.type === 'reasoning') {
					const isLive = !!streaming && index === parts.length - 1
					return h(ReasoningBlock, { key: `r${index}`, text: part.text, streaming: isLive })
				}
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
		if (store.sawReasoning) parts.push(`ctrl+t thinking ${store.showThinking ? 'on' : 'off'}`)
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
			if (store.exitRequested) exit()
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
				if (key.escape) {
					const cancel = picker.onCancel
					store.mode = 'input'
					store.picker = null
					bump()
					cancel?.()
					return
				}
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

			if (store.mode === 'ui') {
				// The assistant's component owns the keyboard (its own useInput
				// hooks receive every key) — the app only keeps the escape hatch.
				if (key.ctrl && input === 'c') settleUi({ cancelled: true })
				return
			}

			if (key.ctrl && input === 'c') {
				if (store.busy) return abortActive()
				if (value) return setInput('', 0)
				if (ctrlCArmed) return requestExit()
				setCtrlCArmed(true)
				store.notice = colors.dim('press ctrl+c again to quit')
				bump()
				return
			}
			if (key.ctrl && input === 'd') {
				if (!value) requestExit()
				return
			}
			if (key.ctrl && input === 'o') {
				store.showToolResults = !store.showToolResults
				bump()
				return
			}
			if (key.ctrl && input === 't') {
				store.showThinking = !store.showThinking
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
		const promptSymbol = store.mode === 'console' ? colors.magenta('console ❯ ') : colors.cyan('❯ ')
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
				h(TurnParts, { parts: store.current.parts, expanded, streaming: store.busy }),
			)] : []),
			// "working", not "thinking" — the ✻ reasoning line owns that word
			...(store.busy ? [h(Text, null, `${colors.yellow(spinner ?? '·')} ${colors.dim(`working… ${elapsed}s · esc to interrupt`)}`)] : []),
			...store.queue.map((queued, index) => h(Text, { key: `q${index}`, dimColor: true }, `  ⧗ queued: ${queued.text.split('\n')[0]}`)),
			...(store.mode === 'picker' && store.picker ? [h(Picker, {})] : []),
			...(store.mode === 'ui' && store.ui ? [h(Box, { flexDirection: 'column', marginTop: 1 },
				h(UiErrorBoundary, {},
					h(store.ui.Component, {
						done: (value: unknown) => settleUi({ value: value === undefined ? null : value }),
						cancel: () => settleUi({ cancelled: true }),
						container,
					}),
				),
				h(Text, { dimColor: true }, '  ctrl+c dismisses'),
			)] : []),
			...(store.mode !== 'picker' && store.mode !== 'ui' ? [h(Box, { marginTop: 1 }, h(Text, null, promptSymbol + rendered.split('\n').join('\n' + colors.dim('… ')))) ] : []),
			...(store.notice ? [h(Text, { dimColor: true }, '  ' + store.notice)] : []),
			h(StatusLine, {}),
		)
	}

	// ── boot ──────────────────────────────────────────────────────────────────
	// Assistant startup (feature warnings, skill preloads) writes straight to
	// stdout/stderr, which lands between the splash art and the ink mount and
	// wrecks the layout. Capture it and fold it into the transcript instead.
	const startupLogs: string[] = []
	if (options.initialAssistant) {
		const stdoutWrite = process.stdout.write.bind(process.stdout)
		const stderrWrite = process.stderr.write.bind(process.stderr)
		const chunks: string[] = []
		const capture = (chunk: any) => {
			chunks.push(typeof chunk === 'string' ? chunk : String(chunk))
			return true
		}
		process.stdout.write = capture as any
		process.stderr.write = capture as any
		try {
			const cell = getCell(options.initialAssistant)
			if (options.resumeThreadId) cell.assistant.resumeThread(options.resumeThreadId)
			await ensureStarted(options.initialAssistant)
		} finally {
			process.stdout.write = stdoutWrite as any
			process.stderr.write = stderrWrite as any
			startupLogs.push(...chunks.join('').split('\n').map((line) => line.trimEnd()).filter(Boolean))
		}
	}

	const bootLines = [
		lobby
			? colors.dim(`lobby — @mention an assistant to start (${entries.map((entry) => colors.cyan('@' + entry.name)).join(', ')})`)
			: colors.dim(`chatting with ${colors.cyan(options.initialAssistant!)}`),
		colors.dim('/help for commands · esc interrupts · ctrl+o expands tool results'),
	]
	store.transcript.unshift({ id: uid(), kind: 'system', lines: bootLines })
	if (startupLogs.length) {
		// re-dim uniformly (stripping original colors) — boot chatter shouldn't
		// shout in yellow above the conversation
		const stripAnsi = (line: string) => line.replace(/\x1b\[[0-9;]*m/g, '')
		store.transcript.push({ id: uid(), kind: 'system', lines: startupLogs.map((line) => colors.dim('  ' + stripAnsi(line))) })
	}

	// Bottom-anchor the session: pad the viewport so the input line starts at
	// the bottom of the terminal and the transcript grows upward, chat-app
	// style. Deliberately NOT the alternate screen buffer — <Static> scrollback
	// keeps finished turns in the terminal's native scrollback (mouse scroll,
	// copy, search), which alt-screen would forfeit.
	const viewportRows = process.stdout.rows || 24
	process.stdout.write('\n'.repeat(Math.max(0, viewportRows - 1 - (options.splashLines ?? 0))))

	const instance = await ink.render(h(App, {}), { patchConsole: false, exitOnCtrlC: false })
	await instance.waitUntilExit()
	ink.unmount()

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
