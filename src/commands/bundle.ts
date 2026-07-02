import { z } from 'zod'
import { isAbsolute } from 'path'
import { commands } from '../command.js'
import { CommandOptionsSchema } from '../schemas/base.js'
import type { ContainerContext } from '../container.js'
import {
	collectAssistantFolderFiles,
	commandNameFromFile,
	generateAssistantsModule,
	generateConsumerEntry,
	generateConsumerManifest,
	normalizeTargets,
	shouldIncludeBundleFile,
	type BundleAssistantEntry,
	type BundleCommandFile,
} from '../cli/bundle-utils.js'

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
	runtime: z.string().default('luca').describe('Luca package spec for the generated build dir (e.g. luca or file:/path/to/luca)'),
	dryRun: z.boolean().default(false).describe('Generate bundle files but skip bun install/build'),
})

const SELF_REGISTERING_DIRS = ['features', 'clients', 'servers', 'endpoints', 'selectors'] as const
const COMMAND_DIRS = ['commands'] as const

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
	fs.writeFile(pkgPath, JSON.stringify({
		name: `luca-bundle-${options.name}`,
		version: '0.0.1',
		type: 'module',
		dependencies: {
			luca: options.runtime,
		},
	}, null, 2))

	ui.print.dim(`  wrote ${entryPath}`)
	ui.print.dim(`  wrote ${manifestPath}`)
	ui.print.dim(`  wrote ${pkgPath}`)
	console.log()

	if (options.dryRun) {
		ui.print.info('Dry run — skipping bun install and bun build')
		return
	}

	ui.print.info('Installing build dependencies...')
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
