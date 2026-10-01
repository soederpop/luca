import { z } from 'zod'
import { isAbsolute } from 'path'
import { commands } from '../command.js'
import { CommandOptionsSchema } from '../schemas/base.js'
import type { ContainerContext } from '../container.js'
import {
	collectAsset,
	collectAssistantFolderFiles,
	commandNameFromFile,
	generateAssetsModule,
	generateAssistantsModule,
	generateConsumerEntry,
	generateConsumerManifest,
	generatePluginModule,
	normalizeRuntimeDependencySpec,
	normalizeTargets,
	relativeImportSpecifiers,
	resolveRelativeImport,
	shouldIncludeBundleFile,
	type BundleAssetEntry,
	type BundleAssistantEntry,
	type BundleCommandFile,
} from '../cli/bundle-utils.js'

declare module '../command.js' {
	interface AvailableCommands {
		bundle: ReturnType<typeof commands.registerHandler>
	}
}

export const positionals = ['name']

export const examples = [
	'luca bundle loopy',
	{ command: 'luca bundle loopy --targets darwin-arm64,linux-x64', description: 'Build for multiple platforms' },
	{ command: 'luca bundle loopy --dryRun', description: 'Generate bundle files without running bun install/build' },
	{ command: 'luca bundle loopy --assets skills,workflows,docs/templates', description: 'Embed on-disk assets; they materialize under ~/.luca/bundles/loopy/ at startup' },
	{ command: 'luca bundle loopy --builtins prompt,eval,serve', description: 'Compile extra luca core commands into the binary' },
]

/**
 * Per-project bundle defaults, read from the source package.json:
 *
 *   "luca": { "bundle": { "assets": [...], "builtins": [...], "include": [...] } }
 *
 * CLI flags add to these rather than replace them, so a project can declare
 * what its binary needs once and `luca bundle <name>` just works.
 */
interface ProjectBundleConfig {
	assets?: string[]
	builtins?: string[]
	include?: string[]
}

export const argsSchema = CommandOptionsSchema.extend({
	name: z.string().describe('Name of the binary to produce, e.g. loopy'),
	source: z.string().default('.').describe('Path to the source Luca project (default: cwd)'),
	outDir: z.string().default('dist').describe('Directory to write compiled binaries'),
	targets: z.string().default('darwin-arm64').describe('Comma-separated Bun target platforms'),
	builtins: z.string().default('').describe('Optional comma-separated Luca built-in commands to include'),
	include: z.string().default('').describe('Comma-separated extra source dirs to vendor wholesale (lib,shared). Files reached through relative imports from helpers/commands are vendored automatically.'),
	assets: z.string().default('').describe('Comma-separated project paths (dirs or files) to embed. They are materialized under ~/.luca/bundles/<name>/ at startup, and luca.plugin.ts attach() receives that root as pluginDir.'),
	// Boolean flags parse through minimist, which fills absent booleans with
	// false — so a default(true) boolean can never be on. Phrase it as an opt-out.
	skipPlugin: z.boolean().default(false).describe('Do not run the project\'s luca.plugin.ts attach() inside the binary'),
	runtime: z.string().default('auto').describe("Luca package spec for the generated build dir. 'auto' (default) uses the local repo (file:) when running from a luca checkout, otherwise the latest published luca. Also accepts explicit specs like luca@3.3.0 or file:/path/to/luca."),
	dryRun: z.boolean().default(false).describe('Generate bundle files but skip bun install/build'),
})

const SELF_REGISTERING_DIRS = ['features', 'clients', 'servers', 'endpoints', 'selectors'] as const
const COMMAND_DIRS = ['commands'] as const

/**
 * Resolves --runtime auto to a concrete package spec: file:<repo> when running
 * from a luca checkout (so dev bundling never depends on a publish), otherwise
 * the latest published luca. In the compiled binary import.meta points into
 * the executable's virtual filesystem, so the repo check misses there.
 */
function resolveRuntimeSpec(container: any, requested: string): string {
	if (requested !== 'auto') return requested

	const fs = container.feature('fs') as any

	const lucaRepoRootFrom = (candidate: string): string | null => {
		try {
			const pkgPath = container.paths.resolve(candidate, 'package.json')
			if (!fs.existsSync(pkgPath)) return null
			const pkg = JSON.parse(String(fs.readFile(pkgPath)))
			return pkg?.name === 'luca' ? candidate : null
		} catch {
			return null
		}
	}

	// Dev CLI: import.meta.dir sits inside the checkout.
	const fromSource = lucaRepoRootFrom(container.paths.resolve(import.meta.dir, '..', '..'))
	if (fromSource) return `file:${fromSource}`

	// Compiled binary: import.meta points into the executable's virtual
	// filesystem, but a binary built from a checkout lives at <repo>/dist/luca.
	// Resolving the executable's real path (through symlinks) and walking up
	// finds that checkout, so dev-machine bundles never lag behind npm.
	try {
		const realExec = fs.realpath(process.execPath)
		const fromBinary = lucaRepoRootFrom(container.paths.resolve(realExec, '..', '..'))
		if (fromBinary) return `file:${fromBinary}`
	} catch {
		// unreadable exec path — fall through to npm
	}

	return 'luca'
}

/**
 * Collects assistant definitions (subdirectories of assistants/ containing a
 * CORE.md) from the source project, reading every file so it can be embedded
 * in the generated bundle. Binary files are encoded as base64.
 */
export function collectAssistants(container: any, source: string): BundleAssistantEntry[] {
	const fs = container.feature('fs') as any
	const assistantsDir = container.paths.resolve(source, 'assistants')
	if (!fs.existsSync(assistantsDir)) return []

	const collected: BundleAssistantEntry[] = []

	for (const entryName of fs.readdirSync(assistantsDir)) {
		const folder = container.paths.resolve(assistantsDir, entryName)
		if (!fs.isDirectory(folder)) continue
		if (!fs.existsSync(container.paths.resolve(folder, 'CORE.md'))) continue

		collected.push({ name: entryName, files: collectAssistantFolderFiles(container, folder) })
	}

	return collected
}

function resolveAbsolute(container: any, input: string): string {
	const os = container.feature('os') as any
	const expanded = input.replace(/^~/, os.homedir)
	if (isAbsolute(expanded)) return expanded
	return container.paths.resolve(expanded)
}

export async function bundleCommand(
	options: z.infer<typeof argsSchema>,
	context: ContainerContext,
) {
	const container = context.container as any
	const fs = container.feature('fs') as any
	const proc = container.feature('proc') as any
	const ui = container.feature('ui') as any

	const source = resolveAbsolute(container, options.source)
	const outDir = resolveAbsolute(container, options.outDir)
	const buildDir = container.paths.resolve(outDir, '.luca-bundle-build', options.name)

	ui.print.info(`Bundling ${options.name}`)
	ui.print.dim(`  source : ${source}`)
	ui.print.dim(`  out    : ${outDir}`)
	ui.print.dim(`  build  : ${buildDir}`)
	console.log()

	if (!fs.existsSync(source)) {
		throw new Error(`Source path does not exist: ${source}`)
	}

	const sourcePkgPath = container.paths.resolve(source, 'package.json')
	const sourcePkg: any = fs.existsSync(sourcePkgPath) ? JSON.parse(String(fs.readFile(sourcePkgPath))) : {}
	const projectConfig: ProjectBundleConfig = sourcePkg?.luca?.bundle ?? {}

	const helperFiles: string[] = []
	for (const dir of SELF_REGISTERING_DIRS) {
		const dirPath = container.paths.resolve(source, dir)
		if (!fs.existsSync(dirPath)) continue
		const { files } = fs.walk(dirPath, { include: ['**/*.ts'] })
		for (const file of files) {
			if (!shouldIncludeBundleFile(file)) continue
			helperFiles.push(file)
		}
	}

	const commandFiles: BundleCommandFile[] = []
	for (const dir of COMMAND_DIRS) {
		const dirPath = container.paths.resolve(source, dir)
		if (!fs.existsSync(dirPath)) continue
		// Commands are top-level only. walk's '*.ts' now matches nested files
		// too (basename semantics), so keep only files directly in dirPath.
		const { files } = fs.walk(dirPath, { include: ['*.ts'] })
		for (const file of files) {
			if (container.paths.dirname(file) !== dirPath) continue
			if (!shouldIncludeBundleFile(file)) continue
			const name = commandNameFromFile(file)
			if (!name) continue
			commandFiles.push({ file, name })
		}
	}

	const assistants = collectAssistants(container, source)

	ui.print.dim(`  discovered ${helperFiles.length} helper file(s), ${commandFiles.length} command file(s), ${assistants.length} assistant(s)`)
	if (assistants.length > 0) {
		for (const assistant of assistants) {
			ui.print.dim(`    assistant: ${assistant.name} (${assistant.files.length} file(s))`)
		}
	}
	console.log()

	fs.ensureFolder(outDir)
	fs.ensureFolder(buildDir)

	// Built-in luca commands compiled into the binary. The consumer help
	// screen advertises `<binary> <file>` script execution, so 'run' is always
	// included. Bundling assistants implies chat + assistant so the binary can
	// actually run its agents.
	const builtins = new Set(splitList(options.builtins).concat(projectConfig.builtins ?? []))
	builtins.add('run')
	if (assistants.length > 0) {
		builtins.add('chat')
		builtins.add('assistant')
	}
	for (const builtin of builtins) {
		if (!container.commands.has(builtin)) {
			ui.print.yellow(`  ! "${builtin}" is not a known luca command — the compiled build may fail to resolve luca/commands/${builtin}`)
		}
	}

	const manifestPath = container.paths.resolve(buildDir, 'generated-consumer-manifest.ts')
	const entryPath = container.paths.resolve(buildDir, 'entry.ts')
	const pkgPath = container.paths.resolve(buildDir, 'package.json')
	const assistantsPath = container.paths.resolve(buildDir, 'generated-consumer-assistants.ts')

	// Vendor the project sources into the build dir. Importing them in place
	// breaks for any project without luca in a reachable node_modules: bun
	// resolves each file's bare `import 'luca'` by walking up from THAT file,
	// not from the build dir. Copying them under buildDir/project makes every
	// bare specifier resolve against the build dir's own install.
	const vendorFile = (file: string): string => {
		const rel = container.paths.relative(source, file).split('\\').join('/')
		const dest = container.paths.resolve(buildDir, 'project', rel)
		fs.ensureFolder(container.paths.resolve(dest, '..'))
		fs.writeFile(dest, fs.readFile(file))
		return `./project/${rel}`
	}

	const vendoredHelperFiles = helperFiles.map(vendorFile)
	const vendoredCommandFiles = commandFiles.map(({ file, name }) => ({ file: vendorFile(file), name }))

	// Projects import out of the self-registering dirs into lib/, shared/, etc.
	// Follow every relative import transitively and vendor what it reaches, so
	// the build dir is a closed graph. --include vendors whole dirs on top.
	const vendored = new Set<string>([...helperFiles, ...commandFiles.map((c) => c.file)])
	const queue = [...vendored]
	const pluginEntry = ['luca.plugin.ts', 'plugin.ts']
		.map((candidate) => container.paths.resolve(source, candidate))
		.find((candidate) => fs.existsSync(candidate))
	let vendoredPluginEntry: string | null = null
	if (!options.skipPlugin && pluginEntry) {
		ui.print.dim(`  plugin entry: ${pluginEntry}`)
		vendoredPluginEntry = vendorFile(pluginEntry)
		vendored.add(pluginEntry)
		queue.push(pluginEntry)
	}
	for (const dir of splitList(options.include).concat(projectConfig.include ?? [])) {
		const dirPath = container.paths.resolve(source, dir)
		if (!fs.existsSync(dirPath)) {
			ui.print.yellow(`  ! --include dir not found: ${dir}`)
			continue
		}
		const { files } = fs.walk(dirPath, { include: ['**/*.ts'], exclude: ['node_modules', '.git'] })
		for (const file of files) {
			if (!shouldIncludeBundleFile(file) || vendored.has(file)) continue
			vendorFile(file)
			vendored.add(file)
			queue.push(file)
		}
	}
	let followed = 0
	while (queue.length) {
		const file = queue.pop()!
		if (!/\.(ts|tsx|mts|js|mjs)$/.test(file)) continue
		for (const spec of relativeImportSpecifiers(String(fs.readFile(file)))) {
			const resolved = resolveRelativeImport(container, file, spec)
			if (!resolved || vendored.has(resolved)) continue
			if (!resolved.startsWith(source + '/') || resolved.includes('/node_modules/')) continue
			vendorFile(resolved)
			vendored.add(resolved)
			queue.push(resolved)
			followed++
		}
	}
	if (followed > 0) ui.print.dim(`  vendored ${followed} file(s) reached through relative imports`)

	fs.writeFile(manifestPath, generateConsumerManifest({ helperFiles: vendoredHelperFiles, commandFiles: vendoredCommandFiles }))

	if (assistants.length > 0) {
		fs.writeFile(assistantsPath, generateAssistantsModule({
			binaryName: options.name,
			assistants,
			bundleHash: container.utils.hashObject({ assistants }),
		}))
		ui.print.dim(`  wrote ${assistantsPath}`)
	}

	const assetsPath = container.paths.resolve(buildDir, 'generated-consumer-assets.ts')
	const pluginPath = container.paths.resolve(buildDir, 'generated-consumer-plugin.ts')
	const assets: BundleAssetEntry[] = []
	for (const rel of uniq(splitList(options.assets).concat(projectConfig.assets ?? []))) {
		const asset = collectAsset(container, source, rel)
		if (!asset) {
			ui.print.yellow(`  ! asset not found: ${rel}`)
			continue
		}
		assets.push(asset)
	}
	if (assets.length > 0) {
		fs.writeFile(assetsPath, generateAssetsModule({
			binaryName: options.name,
			assets,
			bundleHash: container.utils.hashObject({ assets }),
		}))
		const fileCount = assets.reduce((n, a) => n + a.files.length, 0)
		ui.print.dim(`  wrote ${assetsPath} (${assets.length} asset(s), ${fileCount} file(s))`)
	}
	if (vendoredPluginEntry) {
		fs.writeFile(pluginPath, generatePluginModule({
			binaryName: options.name,
			pluginEntryPath: vendoredPluginEntry,
			hasAssets: assets.length > 0,
		}))
		ui.print.dim(`  wrote ${pluginPath}`)
	}

	fs.writeFile(entryPath, generateConsumerEntry({
		binaryName: options.name,
		manifestPath: './generated-consumer-manifest.ts',
		builtins: [...builtins],
		...(assistants.length > 0 && { assistantsPath: './generated-consumer-assistants.ts' }),
		...(assets.length > 0 && { assetsPath: './generated-consumer-assets.ts' }),
		...(vendoredPluginEntry && { pluginPath: './generated-consumer-plugin.ts' }),
	}))
	const runtimeSpec = resolveRuntimeSpec(container, options.runtime)

	// The project's own runtime deps (slack, mammoth, ...) must resolve inside
	// the build dir too. luca itself always comes from --runtime.
	const projectDeps: Record<string, string> = { ...(sourcePkg.dependencies ?? {}) }
	delete projectDeps.luca
	fs.writeFile(pkgPath, JSON.stringify({
		name: `luca-bundle-${options.name}`,
		version: '0.0.1',
		type: 'module',
		dependencies: { ...projectDeps, luca: normalizeRuntimeDependencySpec(runtimeSpec) },
	}, null, 2))

	ui.print.dim(`  wrote ${entryPath}`)
	ui.print.dim(`  wrote ${manifestPath}`)
	ui.print.dim(`  wrote ${pkgPath}`)
	console.log()

	if (options.dryRun) {
		ui.print.info('Dry run — skipping bun install and bun build')
		return
	}

	ui.print.info(`Installing build dependencies (luca: ${runtimeSpec})...`)
	const install = await proc.execAndCapture('bun install', { cwd: buildDir, silent: false })
	if (install.exitCode !== 0) {
		throw new Error(`bun install failed:\n${install.stderr}`)
	}
	console.log()

	const targets = normalizeTargets(options.targets)
	ui.print.info(`Compiling for ${targets.length} target(s)...`)

	const built: string[] = []
	const failed: string[] = []

	for (const target of targets) {
		const suffix = target === 'windows-x64' ? '.exe' : ''
		const outFile = container.paths.resolve(outDir, `${options.name}-${target}${suffix}`)
		const args = [
			'build', 'entry.ts',
			'--compile',
			`--target=bun-${target}`,
			'--outfile', outFile,
		]
		process.stdout.write(`  ${target.padEnd(18)} `)
		const result = await proc.spawnAndCapture('bun', args, { cwd: buildDir, silent: true })
		const succeeded = result.exitCode === 0 && fs.existsSync(outFile)
		if (!succeeded) {
			console.log(ui.colors.red('✗'))
			if (result.stderr) console.error(result.stderr)
			else console.error('bun build did not produce an output binary')
			failed.push(target)
		} else {
			console.log(ui.colors.green('✓') + ui.colors.dim(` → ${outFile}`))
			built.push(outFile)
		}
	}

	console.log()
	if (built.length > 0) ui.print.success(`${built.length} binary(ies) written to ${outDir}`)
	if (failed.length > 0) {
		// A failed target must fail the command — CI gating on exit code would
		// otherwise ship a stale or missing binary.
		throw new Error(`${failed.length} target(s) failed to compile: ${failed.join(', ')}`)
	}
}

function splitList(input: string): string[] {
	return input.split(',').map((s) => s.trim()).filter(Boolean)
}

function uniq<T>(items: T[]): T[] {
	return [...new Set(items)]
}

commands.registerHandler('bundle', {
	description: 'Compile a Luca project into a standalone consumer binary',
	argsSchema,
	positionals,
	examples,
	handler: bundleCommand,
})
