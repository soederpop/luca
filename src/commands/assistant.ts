import { z } from 'zod'
import { commands } from '../command.js'
import { CommandOptionsSchema } from '../schemas/base.js'
import type { ContainerContext } from '../container.js'
import { assistantFiles } from '../scaffolds/generated.js'
import { toCamelCase } from '../scaffolds/template.js'

declare module '../command.js' {
	interface AvailableCommands {
		assistant: ReturnType<typeof commands.registerHandler>
	}
}

export const argsSchema = CommandOptionsSchema.extend({
	all: z.boolean().default(false).describe('Bundle every discovered assistant (bundle subcommand)'),
	output: z.string().optional().describe('Output path. Bundle: .ts file. Export: target folder.'),
	force: z.boolean().default(false).describe('Overwrite existing files'),
})

type AssistantArgs = z.infer<typeof argsSchema>

const SUBCOMMANDS = ['create', 'bundle', 'export'] as const
type Sub = (typeof SUBCOMMANDS)[number]

const CANONICAL_FILES = ['CORE.md', 'tools.ts', 'hooks.ts', 'voice.yml', 'about.md'] as const

export default async function assistantCommand(
	options: AssistantArgs,
	context: ContainerContext,
) {
	const container = context.container as any
	const ui = container.feature('ui')
	const argv = container.argv._ as string[]

	const sub = argv[1] as Sub | undefined
	const rest = argv.slice(2)

	if (!sub || !SUBCOMMANDS.includes(sub)) {
		printHelp(ui)
		if (sub) ui.print.yellow(`  "${sub}" is not a valid subcommand.\n`)
		return
	}

	if (sub === 'create') return createSub(container, ui, rest, options)
	if (sub === 'bundle') return bundleSub(container, ui, rest, options)
	if (sub === 'export') return exportSub(container, ui, rest, options)
}

function printHelp(ui: any) {
	ui.print.cyan('\n  luca assistant — manage assistants\n')
	ui.print('  Usage:  luca assistant <subcommand> [args] [options]\n')
	ui.print('  Subcommands:')
	ui.print.green('    create <name>')
	ui.print('      Scaffold a new assistant folder (equivalent to `luca scaffold assistant <name>`)\n')
	ui.print.green('    bundle [path ...] [--all] [--output file.ts]')
	ui.print('      Pack one or more assistant folders into a single TS script that')
	ui.print('      registers them via assistantsManager.register at import time.\n')
	ui.print.green('    export <name> [outDir] [--force]')
	ui.print('      Serialize a runtime assistant (CORE.md, tools.ts, hooks.ts) to disk.\n')
	ui.print('  Examples:')
	ui.print('    luca assistant create chief-of-staff')
	ui.print('    luca assistant bundle assistants/researcher assistants/inkbot')
	ui.print('    luca assistant bundle --all --output assistants.bundle.ts')
	ui.print('    luca assistant export researcher ./out\n')
}

async function createSub(container: any, ui: any, rest: string[], options: AssistantArgs) {
	const name = rest[0]
	if (!name) {
		ui.print.cyan('\n  luca assistant create <name>\n')
		ui.print('    Example: luca assistant create chief-of-staff\n')
		return
	}

	if (!assistantFiles || Object.keys(assistantFiles).length === 0) {
		ui.print.yellow('No assistant scaffold files bundled. Rebuild with: luca build-scaffolds')
		return
	}

	const fs = container.feature('fs')
	const outputDir = options.output || `assistants/${toCamelCase(name)}`
	const resolvedDir = container.paths.resolve(outputDir)

	if (fs.existsSync(resolvedDir) && !options.force) {
		ui.print.yellow(`  ✗ Directory already exists: ${outputDir}`)
		ui.print.dim('  Pass --force to overwrite, or --output to choose another path.\n')
		return
	}

	await fs.ensureFolder(resolvedDir)
	for (const [fileName, content] of Object.entries(assistantFiles)) {
		await fs.writeFileAsync(container.paths.resolve(resolvedDir, fileName), content)
	}

	ui.print.green(`\n  ✓ Scaffolded assistant "${name}" in ${outputDir}/`)
	ui.print.dim('    CORE.md   — system prompt')
	ui.print.dim('    tools.ts  — tool functions the assistant can call')
	ui.print.dim('    hooks.ts  — lifecycle event handlers')
	ui.print(`\n  Start chatting:  luca chat ${name}\n`)
}

interface BundleEntry {
	id: string
	folder: string
	files: Record<string, string>
}

async function bundleSub(container: any, ui: any, rest: string[], options: AssistantArgs) {
	const fs = container.feature('fs')
	const entries: BundleEntry[] = []
	const seenIds = new Set<string>()

	const addEntry = (folderPath: string) => {
		const absFolder = container.paths.resolve(folderPath)
		if (!fs.existsSync(absFolder)) {
			ui.print.yellow(`  ! Skipping missing folder: ${folderPath}`)
			return
		}
		const corePath = container.paths.resolve(absFolder, 'CORE.md')
		if (!fs.existsSync(corePath)) {
			ui.print.yellow(`  ! Skipping ${folderPath} (no CORE.md)`)
			return
		}
		const id = absFolder.split('/').pop() as string
		if (seenIds.has(id)) {
			ui.print.dim(`  · ${id} already collected, skipping duplicate at ${folderPath}`)
			return
		}
		const files: Record<string, string> = {}
		for (const fname of CANONICAL_FILES) {
			const fp = container.paths.resolve(absFolder, fname)
			if (fs.existsSync(fp)) {
				files[fname] = String(fs.readFile(fp))
			}
		}
		entries.push({ id, folder: absFolder, files })
		seenIds.add(id)
	}

	if (options.all) {
		const manager = container.feature('assistantsManager')
		await manager.discover()
		for (const [id, entry] of Object.entries(manager.entries as Record<string, any>)) {
			if (!entry?.folder) continue
			if (seenIds.has(id)) continue
			addEntry(entry.folder)
		}
	}

	for (const p of rest) {
		addEntry(p)
	}

	if (entries.length === 0) {
		ui.print.yellow('  No assistants to bundle.')
		ui.print.dim('  Pass folder paths or --all to bundle every discovered assistant.\n')
		return
	}

	const outputPath = container.paths.resolve(options.output || 'assistants.bundle.ts')

	if (fs.existsSync(outputPath) && !options.force) {
		ui.print.yellow(`  ✗ Output already exists: ${outputPath}`)
		ui.print.dim('  Pass --force to overwrite or --output <path> to choose another location.\n')
		return
	}

	const script = renderBundle(entries)
	await fs.ensureFolder(container.paths.resolve(outputPath, '..'))
	await fs.writeFileAsync(outputPath, script)

	ui.print.green(`\n  ✓ Bundled ${entries.length} assistant(s) → ${outputPath}`)
	for (const entry of entries) {
		const fileList = Object.keys(entry.files).join(', ')
		ui.print.dim(`    ${entry.id}  (${fileList})`)
	}
	ui.print('\n  Use it:')
	ui.print.dim(`    import '${container.paths.relative(container.cwd, outputPath)}'`)
	ui.print.dim('    // assistants are now registered on container.feature(\'assistantsManager\')\n')
}

function renderBundle(entries: BundleEntry[]): string {
	const ASSISTANTS = entries
		.map((entry) => {
			const fileLines = Object.entries(entry.files)
				.map(([name, content]) => `    ${JSON.stringify(name)}: ${JSON.stringify(content)},`)
				.join('\n')
			return `  ${JSON.stringify(entry.id)}: {\n${fileLines}\n  },`
		})
		.join('\n')

	return [
		'// Generated by `luca assistant bundle`. Do not edit by hand.',
		'// Importing this module materializes the embedded assistants on disk',
		'// (under os.tmpdir()/luca-bundled-assistants/<id>) and registers each',
		'// one with the running container\'s assistantsManager.',
		'',
		"import container from 'luca/agi'",
		'',
		'const ASSISTANTS: Record<string, Record<string, string>> = {',
		ASSISTANTS,
		'}',
		'',
		"const fs = container.feature('fs')",
		"const os = container.feature('os')",
		"const manager = container.feature('assistantsManager')",
		'',
		"const bundleRoot = container.paths.resolve(os.tmpdir, 'luca-bundled-assistants')",
		'fs.ensureFolder(bundleRoot)',
		'',
		'for (const [id, files] of Object.entries(ASSISTANTS)) {',
		'  const folder = container.paths.resolve(bundleRoot, id)',
		'  fs.ensureFolder(folder)',
		'  for (const [name, content] of Object.entries(files)) {',
		'    fs.writeFile(container.paths.resolve(folder, name), content)',
		'  }',
		'  manager.register(id, (options: Record<string, any> = {}) =>',
		"    container.feature('assistant', { folder, ...options })",
		'  )',
		'}',
		'',
		'export const bundledAssistantIds = Object.keys(ASSISTANTS)',
		'',
	].join('\n')
}

async function exportSub(container: any, ui: any, rest: string[], options: AssistantArgs) {
	const name = rest[0]
	if (!name) {
		ui.print.cyan('\n  luca assistant export <name> [outDir]\n')
		ui.print('    Writes CORE.md, tools.ts, hooks.ts for the assistant.\n')
		return
	}

	const outDirInput = options.output || rest[1] || `assistants/${toCamelCase(name)}`
	const fs = container.feature('fs')
	const manager = container.feature('assistantsManager')
	await manager.discover()

	let assistant
	try {
		assistant = manager.create(name)
	} catch (err: any) {
		ui.print.red(`  ✗ ${err.message || err}`)
		return
	}

	const outDir = container.paths.resolve(outDirInput)
	if (fs.existsSync(outDir) && !options.force) {
		const corePath = container.paths.resolve(outDir, 'CORE.md')
		if (fs.existsSync(corePath)) {
			ui.print.yellow(`  ✗ ${outDirInput} already has CORE.md`)
			ui.print.dim('  Pass --force to overwrite.\n')
			return
		}
	}
	await fs.ensureFolder(outDir)

	const sourceFolder: string | undefined = assistant.resolvedFolder
	const written: string[] = []

	for (const fname of CANONICAL_FILES) {
		let content: string | null = null

		if (sourceFolder) {
			const srcPath = container.paths.resolve(sourceFolder, fname)
			if (fs.existsSync(srcPath)) content = String(fs.readFile(srcPath))
		}

		if (!content && fname === 'CORE.md') {
			const prompt: string = assistant.systemPrompt || assistant.loadSystemPrompt?.() || ''
			const meta = assistant.meta
			if (prompt) {
				if (meta && Object.keys(meta).length) {
					const yaml = container.feature('yaml')
					content = `---\n${yaml.stringify(meta)}---\n\n${prompt}\n`
				} else {
					content = `${prompt}\n`
				}
			}
		}

		if (!content) continue

		await fs.writeFileAsync(container.paths.resolve(outDir, fname), content)
		written.push(fname)
	}

	if (written.length === 0) {
		ui.print.yellow(`  ! Nothing to export for "${name}" — no canonical files found in memory.`)
		return
	}

	ui.print.green(`\n  ✓ Exported "${name}" → ${outDirInput}`)
	for (const f of written) ui.print.dim(`    ${f}`)
	ui.print('')
}

commands.registerHandler('assistant', {
	description: 'Manage assistants: create, bundle, and export',
	argsSchema,
	handler: assistantCommand,
})
