import { z } from 'zod'
import { isAbsolute } from 'path'
import { commands } from '../command.js'
import { CommandOptionsSchema } from '../schemas/base.js'
import type { ContainerContext } from '../container.js'
import {
	buildRuntimePackage,
	collectAssistantFolderFiles,
	expandVendorPackages,
	commandNameFromFile,
	generateAssistantsModule,
	generateConsumerEntry,
	generateConsumerManifest,
	generateZodShim,
	normalizeTargets,
	shouldIncludeBundleFile,
	type BundleAssistantEntry,
	type BundleCommandFile,
} from '../cli/bundle-utils.js'
// @ts-ignore — bun resolves JSON imports at bundle time
import pkg from '../../package.json'

declare module '../command.js' {
	interface AvailableCommands {
		bundle: ReturnType<typeof commands.registerHandler>
	}
}

export const positionals = ['name']

export const argsSchema = CommandOptionsSchema.extend({
	name: z.string().describe('Name of the binary to produce, e.g. loopy'),
	source: z.string().default('.').describe('Path to the source Luca project (default: cwd)'),
	outDir: z.string().default('dist').describe('Directory to write compiled binaries'),
	targets: z.string().default('darwin-arm64').describe('Comma-separated Bun target platforms'),
	builtins: z.string().default('').describe('Optional comma-separated Luca built-in commands to include'),
	runtime: z.string().default('embedded').describe("How to provide luca in the build: 'embedded' (default) uses the runtime carried inside this binary — no package installation. Any other value is a package spec (e.g. luca@3.3.0 or file:/path/to/luca) installed with bun."),
	dryRun: z.boolean().default(false).describe('Generate bundle files but skip bun install/build'),
})

const SELF_REGISTERING_DIRS = ['features', 'clients', 'servers', 'endpoints', 'selectors'] as const
const COMMAND_DIRS = ['commands'] as const

/**
 * Provides luca to the consumer build dir without any package installation by
 * writing a synthesized node_modules containing the prebundled runtime.
 *
 * In dev (running from the luca repo) the runtime is prebundled fresh from
 * source. In the compiled binary the artifacts produced by `luca build-runtime`
 * are carried inside the executable and extracted here via Bun.file().
 */
async function materializeEmbeddedRuntime(container: any, ui: any, buildDir: string): Promise<void> {
	const fs = container.feature('fs') as any
	const nodeModulesDir = container.paths.resolve(buildDir, 'node_modules')
	const lucaDir = container.paths.resolve(nodeModulesDir, 'luca')
	const zodDir = container.paths.resolve(nodeModulesDir, 'zod')

	fs.rmdirSync(lucaDir)

	// Dev: this file lives at <repo>/src/commands, so the runtime barrel exists
	// on disk. In the compiled binary import.meta points into the executable's
	// virtual filesystem and this check misses.
	let devBarrelPath: string | null = null
	try {
		const candidate = container.paths.resolve(import.meta.dir, '..', 'bundle-runtime', 'runtime-barrel.ts')
		if (fs.existsSync(candidate)) devBarrelPath = candidate
	} catch {
		// virtual filesystem — fall through to the embedded blob
	}

	if (devBarrelPath) {
		ui.print.dim('  prebundling runtime from source (dev mode)')
		await buildRuntimePackage(container, {
			barrelPath: devBarrelPath,
			outDir: lucaDir,
			version: pkg.version,
		})
		const repoNodeModules = container.paths.resolve(devBarrelPath, '..', '..', '..', 'node_modules')
		for (const vendorName of expandVendorPackages(container, repoNodeModules)) {
			const src = container.paths.resolve(repoNodeModules, vendorName)
			const dest = container.paths.resolve(nodeModulesDir, vendorName)
			fs.rmdirSync(dest)
			fs.ensureFolder(container.paths.resolve(dest, '..'))
			fs.copy(src, dest, { overwrite: true })
		}
	} else {
		// Loaded lazily: the blob import only resolves inside a compiled binary
		// (or after build-runtime has run), and the dev path above never needs it.
		const { runtimeBlob, runtimeIndex } = await import('../bundle-runtime/embedded.generated.js')
		if (!runtimeBlob || runtimeIndex.length === 0) {
			throw new Error(
				'This luca build carries no embedded runtime. Recompile luca with `bun compile` '
				+ '(which runs build-runtime), or pass --runtime <package-spec> to install instead.'
			)
		}
		ui.print.dim(`  extracting embedded runtime (${runtimeIndex.length} file(s))`)
		const blob = Buffer.from(await Bun.file(runtimeBlob).arrayBuffer())
		for (const file of runtimeIndex) {
			// __vendor/<pkg>/... entries are original npm packages restored beside
			// luca; everything else belongs to the synthesized luca package.
			const dest = file.path.startsWith('__vendor/')
				? container.paths.resolve(nodeModulesDir, file.path.slice('__vendor/'.length))
				: container.paths.resolve(lucaDir, file.path)
			fs.ensureFolder(container.paths.resolve(dest, '..'))
			fs.writeFile(dest, blob.subarray(file.offset, file.offset + file.length))
		}
	}

	const zodShim = generateZodShim()
	fs.ensureFolder(zodDir)
	fs.writeFile(container.paths.resolve(zodDir, 'package.json'), zodShim.packageJson)
	fs.writeFile(container.paths.resolve(zodDir, 'index.js'), zodShim.index)
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
		const { files } = fs.walk(dirPath, { include: ['*.ts'] })
		for (const file of files) {
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

	// Built-in luca commands compiled into the binary. Bundling assistants
	// implies chat + assistant so the binary can actually run its agents.
	const builtins = new Set(options.builtins.split(',').map((s: string) => s.trim()).filter(Boolean))
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

	fs.writeFile(manifestPath, generateConsumerManifest({ helperFiles, commandFiles }))

	if (assistants.length > 0) {
		fs.writeFile(assistantsPath, generateAssistantsModule({
			binaryName: options.name,
			assistants,
			bundleHash: container.utils.hashObject({ assistants }),
		}))
		ui.print.dim(`  wrote ${assistantsPath}`)
	}

	fs.writeFile(entryPath, generateConsumerEntry({
		binaryName: options.name,
		manifestPath: './generated-consumer-manifest.ts',
		builtins: [...builtins],
		...(assistants.length > 0 && { assistantsPath: './generated-consumer-assistants.ts' }),
	}))
	const useEmbeddedRuntime = options.runtime === 'embedded'

	fs.writeFile(pkgPath, JSON.stringify({
		name: `luca-bundle-${options.name}`,
		version: '0.0.1',
		type: 'module',
		...(useEmbeddedRuntime ? {} : { dependencies: { luca: options.runtime } }),
	}, null, 2))

	ui.print.dim(`  wrote ${entryPath}`)
	ui.print.dim(`  wrote ${manifestPath}`)
	ui.print.dim(`  wrote ${pkgPath}`)
	console.log()

	if (options.dryRun) {
		ui.print.info('Dry run — skipping runtime materialization and bun build')
		return
	}

	if (useEmbeddedRuntime) {
		ui.print.info('Materializing luca runtime (no package installation)...')
		await materializeEmbeddedRuntime(container, ui, buildDir)
	} else {
		ui.print.info(`Installing build dependencies (${options.runtime})...`)
		const install = await proc.execAndCapture('bun install', { cwd: buildDir, silent: false })
		if (install.exitCode !== 0) {
			throw new Error(`bun install failed:\n${install.stderr}`)
		}
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
			'--external', 'node-llama-cpp',
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
	if (failed.length > 0) ui.print.error(`${failed.length} failed: ${failed.join(', ')}`)
}

commands.registerHandler('bundle', {
	description: 'Compile a Luca project into a standalone consumer binary',
	argsSchema,
	positionals,
	handler: bundleCommand,
})
