import { z } from 'zod'
import type { ContainerContext } from 'luca'
import { CommandOptionsSchema } from 'luca/schemas'
import { spawn } from 'child_process'

export const positionals = ['only']

export const argsSchema = CommandOptionsSchema.extend({
	only: z.string().optional().describe('Only run example docs whose filename contains this substring'),
	timeout: z.number().default(180).describe('Per-example timeout in seconds'),
	stamp: z.boolean().default(true).describe('Write lastTested/lastTestPassed frontmatter back to each file'),
	json: z.boolean().default(false).describe('Print results as JSON instead of a summary table'),
})

type ExampleResult = {
	file: string
	passed: boolean
	durationMs: number
	timedOut: boolean
	errorTail?: string
}

function runDoc(cliArgs: string[], cwd: string, timeoutMs: number): Promise<{ exitCode: number | null, timedOut: boolean, output: string }> {
	return new Promise((resolve) => {
		const [cmd, ...args] = cliArgs
		const child = spawn(cmd!, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] })
		let output = ''
		let timedOut = false

		const timer = setTimeout(() => {
			timedOut = true
			child.kill('SIGKILL')
		}, timeoutMs)

		child.stdout?.on('data', (d) => { output += d.toString() })
		child.stderr?.on('data', (d) => { output += d.toString() })
		child.on('close', (code) => {
			clearTimeout(timer)
			resolve({ exitCode: code, timedOut, output })
		})
		child.on('error', (err) => {
			clearTimeout(timer)
			resolve({ exitCode: 1, timedOut, output: output + String(err) })
		})
	})
}

async function testExamples(options: z.infer<typeof argsSchema>, context: ContainerContext) {
	const container = context.container as any
	const fs = container.feature('fs')
	const yaml = container.feature('yaml')
	const ui = container.feature('ui')

	const examplesDir = container.paths.resolve('docs', 'examples')
	if (!fs.exists(examplesDir)) {
		console.error('No docs/examples directory found')
		process.exitCode = 1
		return
	}

	let files: string[] = (await fs.readdir(examplesDir))
		.filter((f: string) => f.endsWith('.md'))
		.filter((f: string) => !options.only || f.includes(options.only))
		.sort()

	if (!files.length) {
		console.error(options.only ? `No example docs match "${options.only}"` : 'No example docs found')
		process.exitCode = 1
		return
	}

	// In the framework repo run through the dev CLI so untested changes are exercised;
	// in a consumer project fall back to the installed binary.
	const devCli = container.paths.resolve('src', 'cli', 'cli.ts')
	const baseCmd = fs.exists(devCli) ? ['bun', 'run', devCli, 'run'] : ['luca', 'run']

	const today = new Date().toISOString().slice(0, 10)
	const results: ExampleResult[] = []

	for (const file of files) {
		const fullPath = container.paths.resolve(examplesDir, file)
		if (!options.json) ui.print.dim(`running ${file} ...`)

		const started = Date.now()
		const { exitCode, timedOut, output } = await runDoc(
			[...baseCmd, fullPath],
			container.cwd,
			options.timeout * 1000,
		)
		const passed = !timedOut && exitCode === 0

		results.push({
			file,
			passed,
			durationMs: Date.now() - started,
			timedOut,
			errorTail: passed ? undefined : output.split('\n').slice(-15).join('\n'),
		})

		if (options.stamp) {
			const raw = fs.readFile(fullPath) as string
			const match = raw.match(/^---\n([\s\S]*?)\n---\n/)
			let updated: string
			if (match) {
				const meta = (yaml.parse(match[1]!) as Record<string, any>) ?? {}
				meta.lastTested = today
				meta.lastTestPassed = passed
				updated = `---\n${yaml.stringify(meta).trimEnd()}\n---\n` + raw.slice(match[0].length)
			} else {
				updated = `---\nlastTested: "${today}"\nlastTestPassed: ${passed}\n---\n\n` + raw
			}
			await fs.writeFileAsync(fullPath, updated)
		}
	}

	const failed = results.filter(r => !r.passed)

	if (options.json) {
		console.log(JSON.stringify({ total: results.length, passed: results.length - failed.length, failed: failed.length, results }, null, 2))
	} else {
		console.log('')
		for (const r of results) {
			const secs = (r.durationMs / 1000).toFixed(1)
			if (r.passed) ui.print.green(`  PASS  ${r.file} (${secs}s)`)
			else ui.print.red(`  FAIL  ${r.file} (${secs}s)${r.timedOut ? ' [timeout]' : ''}`)
		}
		console.log('')
		if (failed.length) {
			ui.print.red(`${failed.length}/${results.length} example docs failed`)
			for (const r of failed) {
				console.log(`\n--- ${r.file} ---\n${r.errorTail}`)
			}
		} else {
			ui.print.green(`All ${results.length} example docs passed`)
		}
	}

	if (failed.length) process.exitCode = 1
}

export default {
	description: 'Run every docs/examples/*.md through `luca run` and stamp lastTested/lastTestPassed frontmatter',
	argsSchema,
	handler: testExamples,
}
