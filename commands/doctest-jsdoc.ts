import { z } from 'zod'
import type { ContainerContext } from '../src/node'
import { CommandOptionsSchema } from '../src/schemas/base'
import { spawn } from 'child_process'
import * as os from 'os'
import * as nodePath from 'path'
import * as nodeFs from 'fs'

export const positionals = ['only']

export const argsSchema = CommandOptionsSchema.extend({
	only: z.string().optional().describe('Only doctest helpers whose id contains this substring'),
	timeout: z.number().default(20).describe('Per-example timeout in seconds'),
	concurrency: z.number().default(6).describe('How many example blocks to run at once'),
	includeSkipped: z.boolean().default(false).describe('Also run helpers on the default skip list (credentialed/external/interactive)'),
	report: z.string().default('docs/reports/jsdoc-doctest-report.md').describe('Where to write the markdown report'),
	json: z.boolean().default(false).describe('Print results as JSON instead of a summary'),
})

// Helpers whose examples need credentials, external services, or a human —
// their @example blocks are illustrative only. Override with --include-skipped.
const DEFAULT_SKIP = new Set([
	'googleAuth', 'googleCalendar', 'googleDocs', 'googleDrive', 'googleSheets', 'googleMail',
	'telegram', 'runpod', 'tts', 'opener', 'downloader', 'docker', 'postgres', 'redis',
	'secureShell', 'tmux', 'browser', 'repl', 'python',
	'openai', 'elevenlabs', 'voicebox', 'graph', 'socketio',
	'assistant', 'assistantsManager', 'claudeCode', 'openaiCodex', 'lucaCoder',
	'conversation', 'conversationHistory', 'conversationv2', 'memory', 'semanticSearch', 'mcpBridge',
	'mcp', 'containerLink', 'dns', 'skillsLibrary', 'docsReader', 'codingTools', 'fileTools', 'openapi',
	'browserUse', 'cipherSocial', 'claudeController', 'modelProviders', 'telnyxAssistantConnector', 'voiceMode', 'socketRepl',
])

type BlockResult = {
	helper: string
	member: string   // 'class', method name, or 'get <name>'
	status: 'pass' | 'fail' | 'fragment' | 'norun' | 'skipped'
	error?: string
}

type Job = { helper: string, factory: string, member: string, code: string }

function collectJobs(container: any, only?: string, includeSkipped?: boolean): { jobs: Job[], results: BlockResult[] } {
	const jobs: Job[] = []
	const results: BlockResult[] = []

	const registries: Array<[string, string]> = [['features', 'feature'], ['clients', 'client'], ['servers', 'server']]

	for (const [registryName, factory] of registries) {
		const registry = container[registryName]
		if (!registry?.available) continue

		for (const id of registry.available as string[]) {
			if (only && !id.includes(only)) continue

			// Introspection map keys are qualified ("features.yaml"); available yields short ids
			const intro = registry.introspect(`${registryName}.${id}`) ?? registry.introspect(id)
			if (!intro) continue

			const members: Array<[string, { code: string }[]]> = []
			if (intro.examples?.length) members.push(['class', intro.examples])
			for (const [name, m] of Object.entries(intro.methods ?? {}) as any) {
				if (m.examples?.length) members.push([name, m.examples])
			}
			for (const [name, g] of Object.entries(intro.getters ?? {}) as any) {
				if (g.examples?.length) members.push([`get ${name}`, g.examples])
			}

			for (const [member, examples] of members) {
				for (const example of examples) {
					if (!includeSkipped && DEFAULT_SKIP.has(id)) {
						results.push({ helper: id, member, status: 'skipped' })
					} else if (example.code.includes('(no-run)')) {
						results.push({ helper: id, member, status: 'norun' })
					} else {
						jobs.push({ helper: id, factory, member, code: example.code })
					}
				}
			}
		}
	}

	return { jobs, results }
}

/**
 * Examples written as method-level fragments assume the helper instance already
 * exists under some variable name. Bind the conventional name (the helper id)
 * plus whatever receiver the block actually calls, unless the block declares it.
 */
function buildScript(job: Job): string {
	const lines: string[] = []
	const declared = (name: string) => new RegExp(`(const|let|var)\\s+${name}\\b`).test(job.code)

	const bindings = new Set<string>()
	if (job.code.includes(`${job.helper}.`) && !declared(job.helper)) bindings.add(job.helper)

	if (job.member !== 'class' && !job.member.startsWith('get ')) {
		const receiver = job.code.match(new RegExp(`(\\w+)\\.${job.member}\\s*\\(`))
		if (receiver?.[1] && receiver[1] !== 'container' && !declared(receiver[1])) bindings.add(receiver[1])
	} else if (job.member.startsWith('get ')) {
		const getter = job.member.slice(4)
		const receiver = job.code.match(new RegExp(`(\\w+)\\.${getter}\\b`))
		if (receiver?.[1] && receiver[1] !== 'container' && !declared(receiver[1])) bindings.add(receiver[1])
	}

	for (const name of bindings) {
		lines.push(`const ${name} = container.${job.factory}('${job.helper}')`)
	}

	lines.push(job.code)

	// The markdown runner handles top-level await; plain-script mode does not.
	return [
		'---',
		`title: "doctest ${job.helper}.${job.member}"`,
		'---',
		'',
		'```ts',
		lines.join('\n'),
		'```',
		'',
	].join('\n')
}

/** Minimal fixture files so examples that read conventional project paths have something to find. */
function seedFixture(dir: string) {
	nodeFs.writeFileSync(nodePath.join(dir, 'package.json'), JSON.stringify({ name: 'doctest-fixture', version: '0.0.1', dependencies: {} }, null, 2))
	nodeFs.writeFileSync(nodePath.join(dir, 'README.md'), '# doctest fixture\n\nA minimal project used to execute JSDoc @example blocks.\n')
	nodeFs.mkdirSync(nodePath.join(dir, 'src'), { recursive: true })
	nodeFs.writeFileSync(nodePath.join(dir, 'src', 'index.ts'), 'export const hello = () => "world"\n// TODO: expand the fixture\n')
	nodeFs.mkdirSync(nodePath.join(dir, 'config'), { recursive: true })
	nodeFs.writeFileSync(nodePath.join(dir, 'config', 'settings.yml'), 'app:\n  name: doctest-fixture\n  port: 3000\n')
	nodeFs.writeFileSync(nodePath.join(dir, 'data.json'), JSON.stringify({ items: [1, 2, 3] }, null, 2))
}

function runBlock(cliArgs: string[], cwd: string, timeoutMs: number): Promise<{ ok: boolean, output: string }> {
	return new Promise((resolve) => {
		const [cmd, ...args] = cliArgs
		const child = spawn(cmd!, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] })
		let output = ''
		const timer = setTimeout(() => {
			output += '\n[doctest timeout]'
			child.kill('SIGKILL')
		}, timeoutMs)
		child.stdout?.on('data', (d) => { output += d.toString() })
		child.stderr?.on('data', (d) => { output += d.toString() })
		child.on('close', (code) => { clearTimeout(timer); resolve({ ok: code === 0 && !output.includes('[doctest timeout]'), output }) })
		child.on('error', (err) => { clearTimeout(timer); resolve({ ok: false, output: output + String(err) }) })
	})
}

async function doctestJsdoc(options: z.infer<typeof argsSchema>, context: ContainerContext) {
	const container = context.container as any
	const fs = container.feature('fs')
	const ui = container.feature('ui')

	const devCli = container.paths.resolve('src', 'cli', 'cli.ts')
	const useDev = fs.exists(devCli)

	const { jobs, results } = collectJobs(container, options.only, options.includeSkipped)

	if (!options.json) {
		ui.print.dim(`doctesting ${jobs.length} example blocks (${results.filter(r => r.status === 'skipped').length} on skip list, ${results.filter(r => r.status === 'norun').length} marked no-run)`)
	}

	// Each block runs in a throwaway cwd so examples that write relative paths
	// never touch the repo.
	const runRoot = nodeFs.mkdtempSync(nodePath.join(os.tmpdir(), 'luca-doctest-'))

	let cursor = 0
	async function worker() {
		while (cursor < jobs.length) {
			const job = jobs[cursor++]!
			const blockDir = nodePath.join(runRoot, `${job.helper}-${job.member.replace(/\W+/g, '_')}-${cursor}`)
			nodeFs.mkdirSync(blockDir, { recursive: true })
			seedFixture(blockDir)
			const scriptPath = nodePath.join(blockDir, 'block.md')
			nodeFs.writeFileSync(scriptPath, buildScript(job))

			const cmd = useDev ? ['bun', 'run', devCli, 'run', scriptPath] : ['luca', 'run', scriptPath]
			const { ok, output } = await runBlock(cmd, blockDir, options.timeout * 1000)

			if (ok) {
				results.push({ helper: job.helper, member: job.member, status: 'pass' })
			} else {
				const isFragment = /ReferenceError|is not defined/.test(output)
				results.push({
					helper: job.helper,
					member: job.member,
					status: isFragment ? 'fragment' : 'fail',
					error: output.split('\n').filter(Boolean).slice(-6).join('\n'),
				})
			}
			if (!options.json) {
				const last = results[results.length - 1]!
				const line = `  ${last.status.toUpperCase().padEnd(8)} ${job.helper}.${job.member}`
				if (last.status === 'pass') ui.print.green(line)
				else if (last.status === 'fragment') ui.print.yellow(line)
				else ui.print.red(line)
			}
		}
	}

	await Promise.all(Array.from({ length: options.concurrency }, () => worker()))
	nodeFs.rmSync(runRoot, { recursive: true, force: true })

	const counts = {
		pass: results.filter(r => r.status === 'pass').length,
		fail: results.filter(r => r.status === 'fail').length,
		fragment: results.filter(r => r.status === 'fragment').length,
		norun: results.filter(r => r.status === 'norun').length,
		skipped: results.filter(r => r.status === 'skipped').length,
	}

	// ── Report ──────────────────────────────────────────────────────────
	const today = new Date().toISOString().slice(0, 10)
	const failures = results.filter(r => r.status === 'fail' || r.status === 'fragment')
	const byHelper = new Map<string, BlockResult[]>()
	for (const r of results) {
		if (!byHelper.has(r.helper)) byHelper.set(r.helper, [])
		byHelper.get(r.helper)!.push(r)
	}

	const reportLines = [
		'---',
		'title: JSDoc Doctest Report',
		`generated: "${today}"`,
		'---',
		'',
		'# JSDoc @example Doctest Report',
		'',
		`Generated by \`luca doctest-jsdoc\` on ${today}. Executes every @example block from the introspection data in a throwaway cwd. \`fragment\` means the block references variables it never defines (illustrative fragment, not necessarily rot); \`no-run\` blocks carry an explicit \`(no-run)\` marker; skipped helpers need credentials/external services.`,
		'',
		`**${counts.pass} pass / ${counts.fail} fail / ${counts.fragment} fragments / ${counts.norun} no-run / ${counts.skipped} skipped**`,
		'',
		'| Helper | Pass | Fail | Fragment | No-run | Skipped |',
		'|---|---|---|---|---|---|',
	]
	for (const [helper, rs] of Array.from(byHelper.entries()).sort()) {
		const c = (s: string) => rs.filter(r => r.status === s).length
		reportLines.push(`| ${helper} | ${c('pass')} | ${c('fail')} | ${c('fragment')} | ${c('norun')} | ${c('skipped')} |`)
	}
	if (failures.length) {
		reportLines.push('', '## Failures', '')
		for (const f of failures) {
			reportLines.push(`### ${f.helper}.${f.member} (${f.status})`, '', '```', f.error ?? '', '```', '')
		}
	}

	const reportPath = container.paths.resolve(options.report)
	await fs.ensureFolder(nodePath.dirname(reportPath))
	await fs.writeFileAsync(reportPath, reportLines.join('\n'))

	if (options.json) {
		console.log(JSON.stringify({ counts, results }, null, 2))
	} else {
		console.log('')
		const summary = `${counts.pass} pass, ${counts.fail} fail, ${counts.fragment} fragments, ${counts.norun} no-run, ${counts.skipped} skipped — report: ${options.report}`
		if (counts.fail) ui.print.red(summary)
		else ui.print.green(summary)
	}

	if (counts.fail) process.exitCode = 1
}

export default {
	description: 'Execute every JSDoc @example block from the introspection data and report rot',
	argsSchema,
	handler: doctestJsdoc,
}
