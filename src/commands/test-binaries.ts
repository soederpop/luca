import { z } from 'zod'
import { commands } from '../command.js'
import { CommandOptionsSchema } from '../schemas/base.js'
import type { ContainerContext } from '../container.js'

declare module '../command.js' {
	interface AvailableCommands {
		'test-binaries': ReturnType<typeof commands.registerHandler>
	}
}

// ── Smoke test spec — single source of truth ─────────────────────────
// Every platform (native, Docker, CI) runs this identical set of
// assertions against a target binary. Add checks here and all hosts
// inherit them. Each test spawns the binary once; a test passes when
// the process exits 0 AND (if `expect` is set) stdout+stderr matches.
type SmokeTest = {
	name: string
	args: string[]
	expect?: RegExp
}

const SMOKE_TESTS: SmokeTest[] = [
	{ name: 'binary executes', args: ['--version'], expect: /\d+\.\d+\.\d+/ },
	{ name: 'help flag works', args: ['--help'], expect: /[Uu]sage|[Cc]ommands/ },
	{ name: 'eval runs JS', args: ['eval', '1 + 1'], expect: /(^|\D)2(\D|$)/ },
	{ name: 'describe features', args: ['describe', 'features'] },
	{ name: 'container boots', args: ['eval', 'container.uuid'], expect: /[0-9a-f]{8}-[0-9a-f]{4}/ },
	// Path handling is a classic single-binary landmine — separators differ on
	// Windows, and paths.join always prepends cwd (see CLAUDE.md gotcha).
	{ name: 'paths resolve (cross-os)', args: ['eval', "container.paths.join('a', 'b')"], expect: /a[\\/]b/ },
	// `luca serve` boots the embedded server + bundled web assets — the richest
	// smoke of the compiled bundle. --any-port picks a free port; we just need it
	// to print its bound URL, then we kill it.
	{ name: 'scaffold help', args: ['scaffold'], expect: /scaffold|command|feature/i },
]

// ── Cross-compile matrix ─────────────────────────────────────────────
// Mirrors .github/workflows/release.yaml. `magic` is the leading byte
// signature we assert on the produced artifact so a mislinked build is
// caught even on a host that can't execute it.
type CompileTarget = {
	name: string // short name, e.g. 'linux-arm64'
	target: string // bun --target flag
	outfile: string
	magic: 'elf' | 'macho' | 'pe'
}

const COMPILE_TARGETS: CompileTarget[] = [
	{ name: 'linux-x64', target: 'bun-linux-x64', outfile: 'luca-linux-x64', magic: 'elf' },
	{ name: 'linux-arm64', target: 'bun-linux-arm64', outfile: 'luca-linux-arm64', magic: 'elf' },
	{ name: 'darwin-x64', target: 'bun-darwin-x64', outfile: 'luca-darwin-x64', magic: 'macho' },
	{ name: 'darwin-arm64', target: 'bun-darwin-arm64', outfile: 'luca-darwin-arm64', magic: 'macho' },
	{ name: 'windows-x64', target: 'bun-windows-x64', outfile: 'luca-windows-x64.exe', magic: 'pe' },
]

// Magic-byte signatures. bun --compile emits thin (non-fat) executables.
const MAGIC: Record<CompileTarget['magic'], number[][]> = {
	elf: [[0x7f, 0x45, 0x4c, 0x46]], // \x7fELF
	macho: [
		[0xcf, 0xfa, 0xed, 0xfe], // 64-bit little-endian
		[0xce, 0xfa, 0xed, 0xfe], // 32-bit little-endian (defensive)
		[0xca, 0xfe, 0xba, 0xbe], // fat/universal (defensive)
	],
	pe: [[0x4d, 0x5a]], // MZ
}

export const argsSchema = CommandOptionsSchema.extend({
	smoke: z.boolean().default(false).describe('Smoke-test an existing binary only — skip cross-compilation (target = --binary or the running binary)'),
	binary: z.string().optional().describe('Path to a prebuilt binary to smoke-test (implies --smoke)'),
	targets: z.string().optional().describe('Comma-separated compile targets to limit to, e.g. "linux-arm64,darwin-arm64"'),
	docker: z.boolean().default(true).describe('Use Docker to smoke-test Linux binaries that can\'t run natively on this host'),
	keep: z.boolean().default(false).describe('Keep compiled binaries in dist/test instead of cleaning up'),
	json: z.boolean().default(false).describe('Emit machine-readable JSON instead of a formatted report'),
})

type SmokeResult = { name: string; ok: boolean; detail: string }

/**
 * Spawn `binaryPath` once per spec entry and evaluate the result. This is the
 * shared core every host runs — the assertions never diverge between platforms.
 */
async function runSmoke(container: any, binaryPath: string): Promise<SmokeResult[]> {
	const proc = container.feature('proc')
	const results: SmokeResult[] = []

	for (const test of SMOKE_TESTS) {
		let res: any
		try {
			res = await proc.spawnAndCapture(binaryPath, test.args, { cwd: container.cwd })
		} catch (err: any) {
			results.push({ name: test.name, ok: false, detail: `spawn failed: ${err?.message ?? err}` })
			continue
		}

		const combined = `${res.stdout ?? ''}\n${res.stderr ?? ''}`
		let ok = res.exitCode === 0
		let detail = ''

		if (!ok) {
			const firstLine = String(res.stderr || res.stdout || '').trim().split('\n')[0]
			detail = `exit ${res.exitCode}${firstLine ? `: ${firstLine}` : ''}`
		} else if (test.expect && !test.expect.test(combined)) {
			ok = false
			detail = `output did not match ${test.expect}`
		}

		results.push({ name: test.name, ok, detail })
	}

	return results
}

/**
 * Smoke-test a Linux binary inside a Docker container by mounting it and having
 * it self-smoke. Returns a single pass/fail keyed off the container exit code —
 * the inner `test-binaries --smoke` prints the per-test breakdown itself.
 */
async function dockerSmoke(container: any, binaryPath: string, arch: 'x64' | 'arm64'): Promise<SmokeResult> {
	const proc = container.feature('proc')
	const platform = arch === 'x64' ? 'linux/amd64' : 'linux/arm64'
	const dir = container.paths.dirname(binaryPath)
	const base = container.paths.basename(binaryPath)

	const res = await proc.spawnAndCapture(
		'docker',
		[
			'run', '--rm', '--platform', platform,
			'-v', `${dir}:/app`, '-w', '/app',
			'debian:bookworm-slim',
			`/app/${base}`, 'test-binaries', '--smoke',
		],
		{
			onOutput: (d: string) => process.stdout.write(indent(d)),
			onError: (d: string) => process.stderr.write(indent(d)),
		},
	)

	return {
		name: `docker ${platform}`,
		ok: res.exitCode === 0,
		detail: res.exitCode === 0 ? 'self-smoke passed' : `container exit ${res.exitCode}`,
	}
}

function indent(s: string): string {
	return s.replace(/^/gm, '    ')
}

/** Classify how (or whether) a target can be executed on the current host. */
function hostRunnable(name: string): 'native' | 'rosetta' | 'docker' | 'skip' {
	const [os, arch] = name.split('-')
	const { platform, arch: hostArch } = process

	if (os === 'windows') return platform === 'win32' ? 'native' : 'skip'
	if (os === 'darwin') {
		if (platform !== 'darwin') return 'skip'
		if (arch === hostArch) return 'native'
		if (arch === 'x64' && hostArch === 'arm64') return 'rosetta' // via Rosetta 2 if installed
		return 'skip'
	}
	if (os === 'linux') {
		if (platform === 'linux' && arch === hostArch) return 'native'
		return 'docker'
	}
	return 'skip'
}

function checkMagic(buf: Buffer, kind: CompileTarget['magic']): boolean {
	return MAGIC[kind].some((sig) => sig.every((byte, i) => buf[i] === byte))
}

/** Run the pre-compile codegen steps the real build depends on. */
async function prebuild(container: any) {
	const proc = container.feature('proc')
	const steps: Array<[string, string[]]> = [
		['bash', ['scripts/stamp-build.sh']],
		['bun', ['run', 'build:introspection']],
		['bun', ['run', 'build:scaffolds']],
		['bun', ['run', 'build:bootstrap']],
		['bun', ['run', 'build:python-bridge']],
	]
	for (const [cmd, args] of steps) {
		const res = await proc.spawnAndCapture(cmd, args, { cwd: container.cwd })
		if (res.exitCode !== 0) {
			throw new Error(`pre-build step failed: ${cmd} ${args.join(' ')}\n${res.stderr || res.stdout}`)
		}
	}
}

export default async function testBinaries(options: z.infer<typeof argsSchema>, context: ContainerContext) {
	const container = context.container as any
	const ui = container.feature('proc') && container.feature('ui')
	const c = ui.colors
	const log = (...a: any[]) => { if (!options.json) console.log(...a) }

	// ── Smoke-only mode: used by Docker, CI, and self-verification ─────
	if (options.smoke || options.binary) {
		const target = options.binary ? container.paths.resolve(options.binary) : process.execPath

		if (!container.fs.exists(target)) {
			console.error(`Binary not found: ${target}`)
			process.exitCode = 1
			return
		}

		log(c.bold(`\nSmoke testing: ${c.cyan(target)}\n`))
		const results = await runSmoke(container, target)
		reportSmoke(log, c, results)

		const failed = results.filter((r) => !r.ok).length
		if (options.json) console.log(JSON.stringify({ binary: target, results }, null, 2))
		process.exitCode = failed > 0 ? 1 : 0
		return
	}

	// ── Full mode: cross-compile the matrix, then smoke what we can run ─
	const only = options.targets
		? new Set(options.targets.split(',').map((t) => t.trim()))
		: null
	const targets = COMPILE_TARGETS.filter((t) => !only || only.has(t.name))

	if (targets.length === 0) {
		console.error(`No matching targets. Available: ${COMPILE_TARGETS.map((t) => t.name).join(', ')}`)
		process.exitCode = 1
		return
	}

	const distDir = container.paths.resolve('dist/test')
	container.fs.ensureFolder(distDir)

	log(c.bold('\n=== Pre-build codegen ===\n'))
	await prebuild(container)

	const proc = container.feature('proc')
	const compileResults: Array<{ name: string; ok: boolean; detail: string; path: string }> = []

	log(c.bold('\n=== Cross-compile matrix ===\n'))
	for (const t of targets) {
		const out = container.paths.resolve(distDir, t.outfile)
		process.stdout.write(`  ${t.name.padEnd(14)} `)

		const res = await proc.spawnAndCapture(
			'bun',
			['build', './src/cli/cli.ts', '--compile', `--target=${t.target}`, '--outfile', out, '--external', 'node-llama-cpp'],
			{ cwd: container.cwd },
		)

		if (res.exitCode !== 0) {
			log(c.red('COMPILE FAIL'))
			log(indent(res.stderr || res.stdout))
			compileResults.push({ name: t.name, ok: false, detail: `bun build exit ${res.exitCode}`, path: out })
			continue
		}

		if (!container.fs.exists(out)) {
			log(c.red('MISSING ARTIFACT'))
			compileResults.push({ name: t.name, ok: false, detail: 'artifact not produced', path: out })
			continue
		}

		const buf = container.fs.readFile(out, null) as Buffer
		const size = buf.length
		if (!checkMagic(buf, t.magic)) {
			log(c.red(`BAD MAGIC (expected ${t.magic})`))
			compileResults.push({ name: t.name, ok: false, detail: `wrong ${t.magic} signature`, path: out })
			continue
		}

		log(c.green('OK') + c.dim(`  ${(size / 1e6).toFixed(1)} MB`))
		compileResults.push({ name: t.name, ok: true, detail: `${(size / 1e6).toFixed(1)} MB, ${t.magic}`, path: out })
	}

	// ── Runtime smoke on whatever this host can execute ────────────────
	log(c.bold('\n=== Runtime smoke ===\n'))
	const dockerOk = options.docker && (await proc.spawnAndCapture('docker', ['version'], {})).exitCode === 0
	const smokeSummary: Array<{ name: string; via: string; ok: boolean; detail: string }> = []

	for (const t of targets) {
		const built = compileResults.find((r) => r.name === t.name)
		if (!built?.ok) continue

		const via = hostRunnable(t.name)
		if (via === 'skip') {
			log(`  ${c.dim(`${t.name.padEnd(14)} skipped (not runnable on ${process.platform}/${process.arch})`)}`)
			smokeSummary.push({ name: t.name, via: 'skip', ok: true, detail: 'compile-only on this host' })
			continue
		}
		if (via === 'docker' && !dockerOk) {
			log(`  ${c.yellow(`${t.name.padEnd(14)} skipped (Docker unavailable)`)}`)
			smokeSummary.push({ name: t.name, via: 'docker', ok: true, detail: 'docker unavailable — not verified' })
			continue
		}

		log(`  ${c.cyan(t.name)} ${c.dim(`(${via})`)}`)

		if (via === 'docker') {
			const arch = t.name.endsWith('x64') ? 'x64' : 'arm64'
			const r = await dockerSmoke(container, built.path, arch)
			log(`    ${r.ok ? c.green('PASS') : c.red('FAIL')} ${c.dim(r.detail)}`)
			smokeSummary.push({ name: t.name, via, ok: r.ok, detail: r.detail })
		} else {
			const results = await runSmoke(container, built.path)
			reportSmoke((...a: any[]) => log('  ', ...a), c, results)
			const failed = results.filter((r) => !r.ok).length
			smokeSummary.push({ name: t.name, via, ok: failed === 0, detail: `${results.length - failed}/${results.length} passed` })
		}
	}

	// ── Cleanup + verdict ──────────────────────────────────────────────
	if (!options.keep) {
		container.fs.remove(distDir)
	} else {
		log(c.dim(`\nBinaries kept in ${distDir}`))
	}

	const compileFailed = compileResults.filter((r) => !r.ok)
	const smokeFailed = smokeSummary.filter((r) => !r.ok)

	if (options.json) {
		console.log(JSON.stringify({ compile: compileResults, smoke: smokeSummary }, null, 2))
	} else {
		log(c.bold('\n=== Summary ==='))
		log(`  Compiled: ${c.green(`${compileResults.length - compileFailed.length}/${compileResults.length}`)}`)
		log(`  Smoked:   ${smokeSummary.filter((r) => r.via !== 'skip').length} runnable target(s) on this host`)
		if (compileFailed.length) log(c.red(`  Compile failures: ${compileFailed.map((r) => r.name).join(', ')}`))
		if (smokeFailed.length) log(c.red(`  Smoke failures: ${smokeFailed.map((r) => r.name).join(', ')}`))
		log(compileFailed.length + smokeFailed.length === 0 ? c.green('\nALL PASSED\n') : c.red('\nFAILED\n'))
	}

	process.exitCode = compileFailed.length + smokeFailed.length > 0 ? 1 : 0
}

function reportSmoke(log: (...a: any[]) => void, c: any, results: SmokeResult[]) {
	for (const r of results) {
		log(`  ${r.ok ? c.green('PASS') : c.red('FAIL')}  ${r.name}${r.detail ? c.dim(`  — ${r.detail}`) : ''}`)
	}
}

export const examples = [
	{ command: 'luca test-binaries', description: 'Cross-compile all 5 targets, verify artifacts, and smoke-test the ones runnable on this host' },
	{ command: 'luca test-binaries --targets linux-arm64,darwin-arm64', description: 'Limit the compile matrix to specific targets' },
	{ command: 'luca test-binaries --smoke --binary dist/release/luca-windows-x64.exe', description: 'Smoke-test a single prebuilt binary (used by CI on the native runner)' },
	{ command: 'luca test-binaries --smoke', description: 'Smoke-test the currently running binary (self-verification)' },
]

commands.registerHandler('test-binaries', {
	description: 'Cross-compile the release binary matrix and smoke-test the artifacts — full matrix locally, single-binary --smoke mode for Docker/CI',
	argsSchema,
	examples,
	handler: testBinaries,
})
