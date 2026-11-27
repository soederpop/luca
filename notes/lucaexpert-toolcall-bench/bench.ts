/**
 * Measures how lucaExpert uses its tools on one prompt.
 *
 * Run from a scratch Luca project (its folder is the assistant's cwd):
 *
 *   BENCH_FOLDER=/abs/path/to/lucaExpert BENCH_PROMPT=todoScout BENCH_OUT=/abs/out.json \
 *     lucadev run /abs/path/to/notes/lucaexpert-toolcall-bench/bench.ts
 *
 * BENCH_FOLDER is an assistant folder (CORE.md, tools.ts, hooks.ts, skills/)
 * extracted from the commit under test. BENCH_PROMPT is a key of PROMPTS.
 * Every tool call is recorded from the assistant's `toolCall` event, the final
 * answer from ask(), and the files the run left behind, so "completed" can be
 * judged afterwards. The provider is whatever the machine default is
 * (deepseek-v4-local here); both versions must use the same one.
 */

const PROMPTS: Record<string, string> = {
	todoScout: 'Build me an assistant called todoScout that lists TODO comments, preloaded with the luca-framework skill, on the local provider',
	untested: 'What features does this project have that no test covers?',
	httpCache: 'Add a feature that caches HTTP GET responses to disk',
}

const SHELL_TOOLS = new Set(['runShellCommand', 'runLucaCommand'])
const MAX_TOOL_TURNS = Number(process.env.BENCH_MAX_TURNS || 40)
const TIMEOUT_MS = Number(process.env.BENCH_TIMEOUT_MS || 15 * 60 * 1000)

export default async function main({ container }: any) {
	const fs = container.feature('fs')
	const folder = process.env.BENCH_FOLDER
	const promptKey = process.env.BENCH_PROMPT
	const out = process.env.BENCH_OUT
	if (!folder || !promptKey || !out || !PROMPTS[promptKey]) {
		throw new Error('Set BENCH_FOLDER, BENCH_PROMPT (' + Object.keys(PROMPTS).join('|') + ') and BENCH_OUT')
	}

	const filesBefore = new Set(await listProjectFiles(container))

	const assistant = container.feature('assistant', {
		folder,
		cached: false,
		maxToolTurns: MAX_TOOL_TURNS,
	})

	const calls: any[] = []
	const started = Date.now()
	assistant.on('toolCall', (name: string, args: any) => {
		const summary = summarize(args)
		calls.push({ t: Date.now() - started, name, args: summary })
		console.error(`[${promptKey}] tool ${calls.length}: ${name} ${summary.slice(0, 160)}`)
	})
	assistant.on('toolResult', (name: string, result: any) => {
		const last = calls[calls.length - 1]
		if (last && last.name === name && last.resultChars == null) {
			last.resultChars = typeof result === 'string' ? result.length : JSON.stringify(result ?? '').length
		}
	})

	let answer = ''
	let error: string | undefined
	try {
		answer = await Promise.race([
			assistant.ask(PROMPTS[promptKey]),
			container.utils.sleep(TIMEOUT_MS).then(() => { throw new Error(`timeout after ${TIMEOUT_MS}ms`) }),
		])
	} catch (err: any) {
		error = err?.message || String(err)
	}

	const filesAfter = await listProjectFiles(container)
	const newFiles = filesAfter.filter((f: string) => !filesBefore.has(f))

	const byTool: Record<string, number> = {}
	for (const c of calls) byTool[c.name] = (byTool[c.name] || 0) + 1

	const report = {
		prompt: promptKey,
		promptText: PROMPTS[promptKey],
		assistantFolder: folder,
		cwd: container.cwd,
		routing: safe(() => assistant.routing),
		durationMs: Date.now() - started,
		totalToolCalls: calls.length,
		shellCalls: calls.filter((c) => SHELL_TOOLS.has(c.name)).length,
		evalCodeCalls: calls.filter((c) => c.name === 'evalCode').length,
		byTool,
		calls,
		newFiles,
		error,
		answer,
	}

	fs.ensureFolder(container.paths.dirname(out))
	fs.writeFileSync(out, JSON.stringify(report, null, 2))
	console.error(`[${promptKey}] done: ${report.totalToolCalls} tool calls, ${report.shellCalls} shell, ${report.evalCodeCalls} evalCode${error ? ', ERROR ' + error : ''}`)
	// The assistant may hold servers or child processes open.
	setTimeout(() => process.exit(0), 500)
}

async function listProjectFiles(container: any): Promise<string[]> {
	const fs = container.feature('fs')
	const files = await fs.glob('**/*', { cwd: container.cwd, ignore: ['node_modules/**', '.git/**', '.luca/**', '.claude/**'], nodir: true })
	return (files as string[]).sort()
}

function summarize(args: any): string {
	if (!args || typeof args !== 'object') return String(args ?? '')
	const primary = args.code ?? args.command ?? args.args ?? args.path ?? args.name ?? args.query ?? args.pattern
	const rest = Object.keys(args).filter((k) => args[k] !== primary)
	return (primary != null ? String(primary) : JSON.stringify(args)).replace(/\s+/g, ' ').slice(0, 400) + (rest.length ? ` {${rest.join(',')}}` : '')
}

function safe<T>(fn: () => T): T | string {
	try { return fn() } catch (e: any) { return e?.message || String(e) }
}
