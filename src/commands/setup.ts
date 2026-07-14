import { z } from 'zod'
import { commands } from '../command.js'
import { CommandOptionsSchema } from '../schemas/base.js'
import type { ContainerContext } from '../container.js'
import type { NodeContainer } from '../node/container.js'
import { lucaHome } from '../setup/paths.js'
import { installSharedModule, sharedModuleLoads } from '../setup/native-install.js'
import { writeProjectTypes, TYPES_DIR } from '../setup/write-types.js'
import { SemanticSearch, resolveModelPath, DEFAULT_LOCAL_MODEL } from '../node/features/semantic-search.js'

declare module '../command.js' {
	interface AvailableCommands {
		setup: ReturnType<typeof commands.registerHandler>
	}
}

export const argsSchema = CommandOptionsSchema.extend({
	yes: z.boolean().default(false).describe('Non-interactive: do everything (native addon + model weights + project types)'),
	'local-embeddings': z.boolean().default(false).describe('Install the node-llama-cpp native addon into ~/.luca and download the embedding model weights'),
	'skip-models': z.boolean().default(false).describe('Install the native addon and write project types, but skip the model weights download'),
	types: z.boolean().default(false).describe('Only write TypeScript declarations + tsconfig.json into the current project'),
})

const NATIVE_MODULE = 'node-llama-cpp'

interface SetupState {
	home: string
	addonReady: boolean
	weightsPath: string
	weightsReady: boolean
	projectRoot: string
	isProject: boolean
	tsconfigPresent: boolean
	typesPresent: boolean
}

async function scanState(container: NodeContainer, fs: any): Promise<SetupState> {
	const home = lucaHome()
	const projectRoot = container.paths.resolve('.')
	const weightsPath = resolveModelPath(DEFAULT_LOCAL_MODEL)
	return {
		home,
		addonReady: await sharedModuleLoads(NATIVE_MODULE, home),
		weightsPath,
		weightsReady: fs.exists(weightsPath),
		projectRoot,
		isProject: ['luca.cli.ts', 'commands', 'features', 'endpoints'].some(p => fs.exists(container.paths.resolve(projectRoot, p))),
		tsconfigPresent: fs.exists(container.paths.resolve(projectRoot, 'tsconfig.json')),
		typesPresent: fs.exists(container.paths.resolve(projectRoot, TYPES_DIR, 'node.d.ts')),
	}
}

function printStateReport(ui: any, state: SetupState) {
	const mark = (ok: boolean) => (ok ? ui.colors.green('✓') : ui.colors.dim('·'))
	ui.print('  Current state:\n')
	ui.print(`    ${mark(state.addonReady)} native addon (${NATIVE_MODULE}) in ${state.home}/node_modules`)
	ui.print(`    ${mark(state.weightsReady)} local embedding model weights (${DEFAULT_LOCAL_MODEL})`)
	if (state.isProject) {
		ui.print(`    ${mark(state.typesPresent)} TypeScript declarations in ${TYPES_DIR}/`)
		ui.print(`    ${mark(state.tsconfigPresent)} tsconfig.json`)
	} else {
		ui.print(ui.colors.dim('    · current directory is not a luca project — the types step is skipped'))
	}
	ui.print('')
}

async function confirm(ui: any, message: string, def: boolean): Promise<boolean> {
	const { answer } = await ui.wizard([{ type: 'confirm', name: 'answer', message, default: def }])
	return answer
}

async function setup(options: z.infer<typeof argsSchema>, context: ContainerContext) {
	const container = context.container as unknown as NodeContainer
	const fs = container.feature('fs')
	const ui = container.feature('ui')

	ui.print.cyan('\n  luca setup — one-time machine and project setup\n')

	const state = await scanState(container, fs)
	printStateReport(ui, state)

	const flagged = options.yes || options['local-embeddings'] || options['skip-models'] || options.types
	let doAddon: boolean
	let doWeights: boolean
	let doTypes: boolean

	if (flagged) {
		if (options.types) {
			doAddon = false
			doWeights = false
			doTypes = true
		} else {
			doAddon = true
			doWeights = options.yes || options['local-embeddings']
			doTypes = (options.yes || options['skip-models']) && state.isProject
			if (options['skip-models']) doWeights = false
		}
	} else if (process.stdin.isTTY) {
		// ── Guided walkthrough ───────────────────────────────────────
		if (state.addonReady) {
			ui.print.green(`  ✓ Native addon already installed and loading — skipping`)
			doAddon = false
		} else {
			ui.print('  Local semantic search runs entirely on your machine, but it needs')
			ui.print(`  ${NATIVE_MODULE} — a platform-specific native addon that can't live`)
			ui.print('  inside the luca binary. It installs once per machine into')
			ui.print(`  ${state.home}/node_modules and never touches your projects.`)
			ui.print('')
			doAddon = await confirm(ui, 'Install the native addon now?', true)
			if (!doAddon) ui.print.dim('  Skipped — run `luca setup --local-embeddings` any time.\n')
		}

		if (state.weightsReady) {
			ui.print.green(`  ✓ Embedding model weights already downloaded — skipping`)
			doWeights = false
		} else {
			ui.print('')
			ui.print(`  The embedding model (${DEFAULT_LOCAL_MODEL}, ~300MB) is what turns text`)
			ui.print('  into vectors for local semantic search. It downloads once from')
			ui.print(`  HuggingFace to ${state.weightsPath}`)
			ui.print('  and is shared by every project on this machine. Without it, luca')
			ui.print('  falls back to OpenAI embeddings (requires OPENAI_API_KEY).')
			ui.print('')
			doWeights = await confirm(ui, 'Download the model weights now (~300MB)?', doAddon || state.addonReady)
			if (!doWeights) ui.print.dim('  Skipped — run `luca setup --local-embeddings` any time.\n')
		}

		if (state.isProject) {
			ui.print('')
			ui.print('  Luca ships its own TypeScript declarations inside the binary — no npm,')
			ui.print(`  no node_modules. This writes them to ${TYPES_DIR}/ plus a tsconfig.json`)
			ui.print("  (if you don't have one) so your IDE gets full autocomplete for")
			ui.print("  `import ... from 'luca'` and `import { z } from 'zod'`.")
			ui.print('')
			doTypes = await confirm(ui, 'Set up TypeScript types for this project?', true)
			if (!doTypes) ui.print.dim('  Skipped — run `luca setup --types` any time.\n')
		} else {
			doTypes = false
		}
	} else {
		// Non-TTY with no flags: report only, change nothing
		ui.print('  Non-interactive terminal — nothing changed. Use flags to run steps:')
		ui.print.dim('    luca setup --yes                # everything, no prompts')
		ui.print.dim('    luca setup --local-embeddings   # native addon + model weights')
		ui.print.dim('    luca setup --skip-models        # native addon + types only')
		ui.print.dim('    luca setup --types              # project types only')
		ui.print('')
		return
	}

	// ── Execute ──────────────────────────────────────────────────────
	const done: string[] = []
	const skipped: string[] = []

	let addonFailed = false
	if (doAddon && !state.addonReady) {
		ui.print(`\n  Installing ${NATIVE_MODULE}@${SemanticSearch.PINNED_LLAMA_VERSION} into ${state.home} ...`)
		try {
			const modulePath = await installSharedModule(`${NATIVE_MODULE}@${SemanticSearch.PINNED_LLAMA_VERSION}`)
			ui.print.green(`  ✓ Native addon installed and verified at ${modulePath}`)
			done.push('native addon')
		} catch (err: any) {
			addonFailed = true
			ui.print.red(`\n  ✗ Could not install the native addon:`)
			ui.print.yellow(`    ${(err?.message ?? String(err)).split('\n').join('\n    ')}`)
			skipped.push('native addon (install failed — see above)')
		}
	} else if (state.addonReady) {
		skipped.push('native addon (already installed)')
	} else {
		skipped.push('native addon — enable later with `luca setup --local-embeddings`')
	}

	// The weights are useless without the addon — don't download 300MB if the install just failed
	if (doWeights && !state.weightsReady && addonFailed) {
		skipped.push('model weights (skipped — native addon is not installed)')
	} else if (doWeights && !state.weightsReady) {
		ui.print(`\n  Downloading ${DEFAULT_LOCAL_MODEL} weights (~300MB, one time) ...`)
		const semanticSearch = container.feature('semanticSearch')
		const path = await semanticSearch.downloadModelWeights(DEFAULT_LOCAL_MODEL)
		ui.print.green(`  ✓ Model weights ready at ${path}`)
		done.push('model weights')
	} else if (state.weightsReady) {
		skipped.push('model weights (already downloaded)')
	} else {
		skipped.push('model weights — download later with `luca setup --local-embeddings`')
	}

	if (doTypes) {
		if (!state.isProject) {
			ui.print.yellow('\n  ⚠ Current directory does not look like a luca project — skipping types.')
			skipped.push('project types (not a luca project)')
		} else {
			const result = await writeProjectTypes(fs, state.projectRoot)
			ui.print.green(`\n  ✓ Wrote ${result.filesWritten} declaration files (luca ${result.version}) to ${TYPES_DIR}/`)
			if (result.tsconfigWritten) {
				ui.print.green('  ✓ Wrote tsconfig.json')
			} else {
				ui.print.dim(`  tsconfig.json already exists — left untouched (map "luca" and "zod" to ${TYPES_DIR}/ via compilerOptions.paths to use the shipped types)`)
			}
			done.push('project types')
		}
	} else if (state.isProject) {
		skipped.push('project types — write later with `luca setup --types`')
	}

	// ── Summary ──────────────────────────────────────────────────────
	ui.print('')
	if (done.length) ui.print.green(`  ✓ Setup complete: ${done.join(', ')}`)
	else ui.print('  Nothing to do — everything was already set up or skipped.')
	for (const s of skipped) ui.print.dim(`    · skipped ${s}`)
	ui.print('')
}

commands.registerHandler('setup', {
	description: 'One-time machine setup: install native addons into ~/.luca, download local embedding model weights, and write TypeScript types into your project',
	argsSchema,
	examples: [
		'luca setup',
		{ command: 'luca setup --yes', description: 'Do everything without prompts' },
		{ command: 'luca setup --local-embeddings', description: 'Install the native addon and model weights for local semantic search' },
		{ command: 'luca setup --types', description: 'Write TypeScript declarations + tsconfig.json into the current project' },
	],
	handler: setup,
})
