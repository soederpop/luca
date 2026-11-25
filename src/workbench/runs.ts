/**
 * Command runs for the workbench: each run is a child `luca <command> <args>`
 * in the project folder, started the way the host itself was started, so a
 * crash or `process.exit` in the command never takes the host down. Output
 * goes to the socket as it comes; a stop kills the child's process group.
 */
import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync } from 'node:fs'

export type RunChunk = { seq: number; stream: 'stdout' | 'stderr' | 'note'; text: string }

export type RunView = {
	runId: string
	command: string
	argv: string[]
	/** `luca describe fs --json`: the line the transcript shows on top. */
	display: string
	status: 'running' | 'exited'
	code: number | null
	signal: string | null
	stopped: boolean
	/** `exit 0 · 1.2 s`, or `running`. */
	statusText: string
	startedAt: number
	ms: number
	/** Every chunk kept so far, oldest first. `dropped` were let go to stay in budget. */
	chunks: RunChunk[]
	dropped: number
}

/** A field of a command's form, as the host reads its `argsSchema` and `positionals`. */
export type CommandField = {
	name: string
	/** `--dry-run`. Empty for the extra-arguments field. */
	flag: string
	type: 'string' | 'number' | 'boolean' | 'enum' | 'array' | 'unknown'
	options?: string[]
	/** The default as the form shows it; null when there is none. */
	default: string | null
	description: string
	required: boolean
	positional: boolean
	/** Index among the positionals. */
	position?: number
	/** True for the free-text field of more arguments. */
	extra?: boolean
}

const RUN_TEXT_BUDGET = 1_000_000
const KEEP_FINISHED = 20
const STOP_GRACE_MS = 3000
export const EXTRA_FIELD = '__extra__'

const ANSI = /[\u001b\u009b][[\]()#;?]*(?:(?:(?:[a-zA-Z\d]*(?:;[a-zA-Z\d]*)*)?\u0007)|(?:(?:\d{1,4}(?:;\d{0,4})*)?[\dA-PR-TZcf-ntqry=><~]))/g

export function stripAnsi(text: string): string {
	return text.replace(ANSI, '')
}

/**
 * How to start a child the way this process was started: the runtime and
 * the entry script (`bun /x/cli.ts`), or the compiled binary alone (its
 * script lives in a virtual `/$bunfs` path).
 */
export function childPrefix(execPath = process.execPath, argv = process.argv, exists: (p: string) => boolean = existsSync): string[] {
	const script = argv[1]
	if (script && /\.(ts|js|mjs|cjs|tsx)$/.test(script) && !script.startsWith('/$bunfs') && exists(script)) return [execPath, script]
	return [execPath]
}

/** Split typed arguments the way a shell does for words and quotes. No expansion. */
export function splitWords(text: string): string[] {
	const words: string[] = []
	let current = ''
	let has = false
	let quote: string | null = null
	for (let i = 0; i < text.length; i++) {
		const ch = text[i]!
		if (quote) {
			if (ch === quote) quote = null
			else if (ch === '\\' && quote === '"' && i + 1 < text.length) current += text[++i]
			else current += ch
			continue
		}
		if (ch === '"' || ch === "'") { quote = ch; has = true; continue }
		if (ch === '\\' && i + 1 < text.length) { current += text[++i]; has = true; continue }
		if (/\s/.test(ch)) {
			if (has) { words.push(current); current = ''; has = false }
			continue
		}
		current += ch
		has = true
	}
	if (has) words.push(current)
	return words
}

function quoteWord(word: string): string {
	return /^[\w@%+=:,./-]+$/.test(word) ? word : `'${word.replace(/'/g, `'\\''`)}'`
}

export function displayArgv(command: string, args: string[]): string {
	return ['luca', command, ...args].map(quoteWord).join(' ')
}

/**
 * The command line for the values a form holds. Positionals go first, in
 * order, up to the first empty one; a positional after a gap goes as its
 * flag, which the command maps to the same field. A boolean is `--flag`
 * when on, `--no-flag` when off against a default of on, else nothing.
 * Empty values are left out, so the command's defaults apply.
 */
export function buildArgs(fields: CommandField[], values: Record<string, any>): string[] {
	const isEmpty = (v: any) => v === undefined || v === null || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0)
	const words = (v: any): string[] => (Array.isArray(v) ? v.map(String) : splitWords(String(v)))
	const positional: string[] = []
	const flags: string[] = []
	let gap = false
	const ordered = fields.filter((f) => f.positional).sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
	for (const field of ordered) {
		const v = values[field.name]
		if (isEmpty(v)) { gap = true; continue }
		const list = field.type === 'array' ? words(v) : [String(v)]
		if (!gap) positional.push(...list)
		else for (const item of list) flags.push(`--${field.name}`, item)
	}
	for (const field of fields) {
		if (field.positional || field.extra) continue
		const v = values[field.name]
		if (field.type === 'boolean') {
			const on = v === true || v === 'true'
			const off = v === false || v === 'false'
			if (on && field.default !== 'true') flags.push(field.flag)
			else if (off && field.default === 'true') flags.push(`--no-${field.flag.slice(2)}`)
			continue
		}
		if (isEmpty(v)) continue
		if (field.type === 'array') for (const item of words(v)) flags.push(field.flag, item)
		else flags.push(field.flag, String(v))
	}
	const extra = values[EXTRA_FIELD]
	return [...positional, ...flags, ...(isEmpty(extra) ? [] : splitWords(String(extra)))]
}

type Run = {
	view: RunView
	child: ChildProcess
	textSize: number
	killTimer?: any
	onExit?: (view: RunView) => void
}

/** Every run of one host. `emit` sends a frame to the socket. */
export class CommandRuns {
	private runs = new Map<string, Run>()
	private next = 0

	constructor(
		private cwd: string,
		private emit: (frame: any) => void,
		private prefix: string[] = childPrefix(),
	) {}

	/** `onExit` hears the end of this run, after its `run-exit` frame. */
	start(command: string, args: string[], onExit?: (view: RunView) => void): RunView {
		const runId = `run-${Date.now().toString(36)}-${++this.next}`
		const [program, ...pre] = this.prefix
		const argv = [...pre, command, ...args]
		const view: RunView = {
			runId, command, argv: [command, ...args], display: displayArgv(command, args),
			status: 'running', code: null, signal: null, stopped: false, statusText: 'running',
			startedAt: Date.now(), ms: 0, chunks: [], dropped: 0,
		}
		// Its own process group, so a stop also ends what the command started.
		const child = spawn(program!, argv, {
			cwd: this.cwd,
			env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1', LUCA_WORKBENCH_RUN: runId },
			stdio: ['ignore', 'pipe', 'pipe'],
			detached: true,
		})
		const run: Run = { view, child, textSize: 0, onExit }
		this.runs.set(runId, run)
		this.emit({ type: 'run-start', runId, command, display: view.display, at: view.startedAt })
		child.stdout?.setEncoding('utf8')
		child.stderr?.setEncoding('utf8')
		child.stdout?.on('data', (text: string) => this.add(run, 'stdout', text))
		child.stderr?.on('data', (text: string) => this.add(run, 'stderr', text))
		child.on('error', (err) => {
			this.add(run, 'note', `could not start: ${err.message}\n`)
			this.finish(run, null, null)
		})
		child.on('close', (code, signal) => this.finish(run, code, signal))
		this.trim()
		return this.copy(view)
	}

	private add(run: Run, stream: RunChunk['stream'], raw: string) {
		const text = stripAnsi(raw)
		if (!text) return
		const chunk: RunChunk = { seq: run.view.chunks.length + run.view.dropped, stream, text }
		run.view.chunks.push(chunk)
		run.textSize += text.length
		while (run.textSize > RUN_TEXT_BUDGET && run.view.chunks.length > 1) {
			run.textSize -= run.view.chunks.shift()!.text.length
			run.view.dropped++
		}
		this.emit({ type: 'run-output', runId: run.view.runId, ...chunk, at: Date.now() })
	}

	private finish(run: Run, code: number | null, signal: NodeJS.Signals | null) {
		if (run.view.status === 'exited') return
		clearTimeout(run.killTimer)
		const v = run.view
		v.status = 'exited'
		v.code = code
		v.signal = signal
		v.ms = Date.now() - v.startedAt
		v.statusText = statusText(v)
		this.emit({ type: 'run-exit', runId: v.runId, code, signal, stopped: v.stopped, ms: v.ms, text: v.statusText, at: Date.now() })
		try { run.onExit?.(this.copy(v)) } catch {}
	}

	/** The text of a run's last lines, for a one-line reason it failed. */
	tail(runId: string, lines = 3): string {
		const run = this.runs.get(runId)
		if (!run) return ''
		const text = run.view.chunks.slice(-20).map((c) => c.text).join('')
		return text.split('\n').map((l) => l.trim()).filter(Boolean).slice(-lines).join('\n')
	}

	get(runId: string): RunView | undefined {
		const run = this.runs.get(runId)
		if (!run) return undefined
		if (run.view.status === 'running') run.view.ms = Date.now() - run.view.startedAt
		return this.copy(run.view)
	}

	/** SIGTERM to the group, SIGKILL after a grace. False for an unknown run. */
	stop(runId: string): boolean {
		const run = this.runs.get(runId)
		if (!run) return false
		if (run.view.status === 'exited') return true
		run.view.stopped = true
		signalGroup(run.child, 'SIGTERM')
		clearTimeout(run.killTimer)
		run.killTimer = setTimeout(() => signalGroup(run.child, 'SIGKILL'), STOP_GRACE_MS)
		return true
	}

	/** The host is going: every child now, no grace. */
	killAll() {
		for (const run of this.runs.values()) {
			if (run.view.status !== 'running') continue
			run.view.stopped = true
			signalGroup(run.child, 'SIGKILL')
		}
	}

	get running(): number {
		let n = 0
		for (const run of this.runs.values()) if (run.view.status === 'running') n++
		return n
	}

	private trim() {
		const finished = [...this.runs.values()].filter((r) => r.view.status === 'exited')
		for (const run of finished.slice(0, Math.max(0, finished.length - KEEP_FINISHED))) this.runs.delete(run.view.runId)
	}

	private copy(view: RunView): RunView {
		return { ...view, chunks: [...view.chunks] }
	}
}

function signalGroup(child: ChildProcess, signal: NodeJS.Signals) {
	if (!child.pid) return
	try { process.kill(-child.pid, signal) } catch {
		try { child.kill(signal) } catch {}
	}
}

export function statusText(v: Pick<RunView, 'status' | 'code' | 'signal' | 'stopped' | 'ms'>): string {
	if (v.status === 'running') return 'running'
	const secs = v.ms < 1000 ? `${v.ms} ms` : `${(v.ms / 1000).toFixed(1)} s`
	if (v.stopped) return `stopped · ${secs}`
	if (v.code === null) return `${v.signal ?? 'killed'} · ${secs}`
	return `exit ${v.code} · ${secs}`
}
