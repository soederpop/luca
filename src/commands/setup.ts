import { z } from 'zod'
import { commands } from '../command.js'
import { CommandOptionsSchema } from '../schemas/base.js'
import type { ContainerContext } from '../container.js'
import type { NodeContainer } from '../node/container.js'
import { lucaHome } from '../setup/paths.js'
import { writeProjectTypes, TYPES_DIR } from '../setup/write-types.js'
import { resolveModelPath, DEFAULT_LOCAL_MODEL } from '../node/features/semantic-search.js'
import { installedBinaryPath, chatModelPath, DEFAULT_CHAT_MODEL, CHAT_MODEL_SOURCES, resolvedReleaseTag } from '../node/features/llama-server.js'
import { hasDescribeEmbeddings, buildDescribeEmbeddings } from '../describe-search.js'

declare module '../command.js' {
	interface AvailableCommands {
		setup: ReturnType<typeof commands.registerHandler>
	}
}

export const argsSchema = CommandOptionsSchema.extend({
	yes: z.boolean().default(false).describe('Non-interactive: llama-server binary + embedding model + describe index + project types (the chat model needs --chat-model, it is a multi-GB download)'),
	'local-embeddings': z.boolean().default(false).describe('Download the llama-server binary and the local embedding model weights'),
	'chat-model': z.boolean().default(false).describe(`Download the llama-server binary and the local chat model (${DEFAULT_CHAT_MODEL}, ${CHAT_MODEL_SOURCES[DEFAULT_CHAT_MODEL]?.approxSize})`),
	'skip-models': z.boolean().default(false).describe('Install the llama-server binary and write project types, but skip all model weight downloads'),
	types: z.boolean().default(false).describe('Only write TypeScript declarations + tsconfig.json into the current project'),
})

interface SetupState {
	home: string
	releaseTag: string
	binaryReady: boolean
	embedWeightsPath: string
	embedWeightsReady: boolean
	chatModel: string
	chatWeightsPath: string
	chatWeightsReady: boolean
	describeIndexReady: boolean
	projectRoot: string
	isProject: boolean
	tsconfigPresent: boolean
	typesPresent: boolean
}

async function scanState(container: NodeContainer, fs: any): Promise<SetupState> {
	const home = lucaHome()
	const projectRoot = container.paths.resolve('.')
	const embedWeightsPath = resolveModelPath(DEFAULT_LOCAL_MODEL)
	const chatModel = DEFAULT_CHAT_MODEL
	return {
		home,
		releaseTag: resolvedReleaseTag(),
		binaryReady: installedBinaryPath() !== null,
		embedWeightsPath,
		embedWeightsReady: fs.exists(embedWeightsPath),
		chatModel,
		chatWeightsPath: chatModelPath(chatModel),
		chatWeightsReady: fs.exists(chatModelPath(chatModel)),
		describeIndexReady: hasDescribeEmbeddings(),
		projectRoot,
		isProject: ['luca.cli.ts', 'commands', 'features', 'endpoints'].some(p => fs.exists(container.paths.resolve(projectRoot, p))),
		tsconfigPresent: fs.exists(container.paths.resolve(projectRoot, 'tsconfig.json')),
		typesPresent: fs.exists(container.paths.resolve(projectRoot, TYPES_DIR, 'node.d.ts')),
	}
}

function printStateReport(ui: any, state: SetupState) {
	const mark = (ok: boolean) => (ok ? ui.colors.green('✓') : ui.colors.dim('·'))
	ui.print('  Current state:\n')
	ui.print(`    ${mark(state.binaryReady)} llama-server binary (llama.cpp ${state.releaseTag}) in ${state.home}/llama-cpp`)
	ui.print(`    ${mark(state.embedWeightsReady)} local embedding model weights (${DEFAULT_LOCAL_MODEL})`)
	ui.print(`    ${mark(state.chatWeightsReady)} local chat model weights (${state.chatModel})`)
	ui.print(`    ${mark(state.describeIndexReady)} \`luca describe --query\` search index`)
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

/** Render a single-line progress bar for a large download. */
function progressLine(label: string) {
	return ({ received, total }: { received: number; total: number }) => {
		const mb = (n: number) => (n / (1024 * 1024)).toFixed(0)
		const pct = total > 0 ? ` ${Math.floor((received / total) * 100)}%` : ''
		process.stdout.write(`\r  ${label}: ${mb(received)}MB${total ? `/${mb(total)}MB` : ''}${pct}   `)
	}
}

export async function setup(options: z.infer<typeof argsSchema>, context: ContainerContext) {
	const container = context.container as unknown as NodeContainer
	const fs = container.feature('fs')
	const ui = container.feature('ui')

	ui.print.cyan('\n  luca setup — one-time machine and project setup\n')

	const state = await scanState(container, fs)
	printStateReport(ui, state)

	const flagged = options.yes || options['local-embeddings'] || options['chat-model'] || options['skip-models'] || options.types
	let doBinary: boolean
	let doEmbedWeights: boolean
	let doChatWeights: boolean
	let doTypes: boolean
	let doDescribeIndex = false

	if (flagged) {
		if (options.types) {
			doBinary = false
			doEmbedWeights = false
			doChatWeights = false
			doTypes = true
		} else {
			doBinary = true
			doEmbedWeights = options.yes || options['local-embeddings']
			doChatWeights = options['chat-model']
			doTypes = (options.yes || options['skip-models']) && state.isProject
			if (options['skip-models']) { doEmbedWeights = false; doChatWeights = false }
			doDescribeIndex = (options.yes || options['local-embeddings']) && !state.describeIndexReady
		}
	} else if (process.stdin.isTTY) {
		// ── Guided walkthrough ───────────────────────────────────────
		if (state.binaryReady) {
			ui.print.green('  ✓ llama-server binary already installed — skipping')
			doBinary = false
		} else {
			ui.print('  Local AI runs through llama-server — a small, self-contained binary')
			ui.print('  from the llama.cpp project. It serves models over an OpenAI-compatible')
			ui.print(`  API on localhost, installs once per machine into ${state.home}/llama-cpp,`)
			ui.print('  and never touches your projects. Both local embeddings and the local')
			ui.print('  chat model need it.')
			ui.print('')
			doBinary = await confirm(ui, 'Download the llama-server binary now?', true)
			if (!doBinary) ui.print.dim('  Skipped — run `luca setup` any time.\n')
		}

		if (state.embedWeightsReady) {
			ui.print.green('  ✓ Embedding model weights already downloaded — skipping')
			doEmbedWeights = false
		} else {
			ui.print('')
			ui.print(`  The embedding model (${DEFAULT_LOCAL_MODEL}, ~300MB) is what turns text`)
			ui.print('  into vectors for local semantic search. It downloads once from')
			ui.print(`  HuggingFace to ${state.embedWeightsPath}`)
			ui.print('  and is shared by every project on this machine. Without it, luca')
			ui.print('  falls back to OpenAI embeddings (requires OPENAI_API_KEY).')
			ui.print('')
			doEmbedWeights = await confirm(ui, 'Download the embedding model now (~300MB)?', doBinary || state.binaryReady)
			if (!doEmbedWeights) ui.print.dim('  Skipped — run `luca setup --local-embeddings` any time.\n')
		}

		if (state.chatWeightsReady) {
			ui.print.green('  ✓ Local chat model weights already downloaded — skipping')
			doChatWeights = false
		} else {
			const approx = CHAT_MODEL_SOURCES[state.chatModel]?.approxSize ?? 'multi-GB'
			ui.print('')
			ui.print(`  The local chat model (${state.chatModel}, ${approx}) gives you a`)
			ui.print('  fully offline assistant. When no OPENAI_API_KEY is set and no custom')
			ui.print('  provider is registered, luca assistants use this model automatically.')
			ui.print('  With an API key set, the key wins and this model is optional.')
			ui.print('')
			doChatWeights = await confirm(ui, `Download the local chat model now (${approx})?`, !process.env.OPENAI_API_KEY && (doBinary || state.binaryReady))
			if (!doChatWeights) ui.print.dim('  Skipped — run `luca setup --chat-model` any time.\n')
		}

		if (state.describeIndexReady) {
			ui.print.green('  ✓ `luca describe --query` search index already built — skipping')
		} else if ((doBinary || state.binaryReady) && (doEmbedWeights || state.embedWeightsReady)) {
			ui.print('')
			ui.print('  With embeddings installed, `luca describe --query "..."` can search')
			ui.print('  every helper, example, and tutorial by meaning. Building its index')
			ui.print('  takes a minute the first time.')
			ui.print('')
			doDescribeIndex = await confirm(ui, 'Build the describe search index now?', true)
			if (!doDescribeIndex) ui.print.dim('  Skipped — run `luca describe --calculate-embeddings` any time.\n')
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
		ui.print.dim('    luca setup --yes                # binary + embedding model + types, no prompts')
		ui.print.dim('    luca setup --local-embeddings   # llama-server binary + embedding model')
		ui.print.dim('    luca setup --chat-model         # llama-server binary + local chat model')
		ui.print.dim('    luca setup --skip-models        # llama-server binary + types only')
		ui.print.dim('    luca setup --types              # project types only')
		ui.print('')
		return
	}

	// ── Execute ──────────────────────────────────────────────────────
	const done: string[] = []
	const skipped: string[] = []
	const llama = container.feature('llamaServer')

	let binaryFailed = false
	if (doBinary && !state.binaryReady) {
		ui.print(`\n  Downloading llama-server (llama.cpp ${state.releaseTag}) into ${state.home}/llama-cpp ...`)
		const onProgress = progressLine('llama-server')
		llama.on('downloadProgress', onProgress)
		try {
			const binaryPath = await llama.downloadBinary()
			ui.print('')
			ui.print.green(`  ✓ llama-server installed at ${binaryPath}`)
			done.push('llama-server binary')
		} catch (err: any) {
			binaryFailed = true
			ui.print.red('\n  ✗ Could not download llama-server:')
			ui.print.yellow(`    ${(err?.message ?? String(err)).split('\n').join('\n    ')}`)
			skipped.push('llama-server binary (download failed — see above)')
		} finally {
			llama.off('downloadProgress', onProgress)
		}
	} else if (state.binaryReady) {
		skipped.push('llama-server binary (already installed)')
	} else {
		skipped.push('llama-server binary — install later with `luca setup`')
	}

	const binaryNowReady = state.binaryReady || (doBinary && !binaryFailed)

	// Model weights are useless without the server binary that loads them
	if (doEmbedWeights && !state.embedWeightsReady && !binaryNowReady) {
		skipped.push('embedding model weights (skipped — llama-server is not installed)')
	} else if (doEmbedWeights && !state.embedWeightsReady) {
		ui.print(`\n  Downloading ${DEFAULT_LOCAL_MODEL} weights (~300MB, one time) ...`)
		const semanticSearch = container.feature('semanticSearch')
		const path = await semanticSearch.downloadModelWeights(DEFAULT_LOCAL_MODEL)
		ui.print.green(`  ✓ Embedding model weights ready at ${path}`)
		done.push('embedding model weights')
	} else if (state.embedWeightsReady) {
		skipped.push('embedding model weights (already downloaded)')
	} else {
		skipped.push('embedding model weights — download later with `luca setup --local-embeddings`')
	}

	if (doChatWeights && !state.chatWeightsReady && !binaryNowReady) {
		skipped.push('chat model weights (skipped — llama-server is not installed)')
	} else if (doChatWeights && !state.chatWeightsReady) {
		const approx = CHAT_MODEL_SOURCES[state.chatModel]?.approxSize ?? ''
		ui.print(`\n  Downloading ${state.chatModel} weights (${approx}, one time) ...`)
		const onProgress = progressLine(state.chatModel)
		llama.on('downloadProgress', onProgress)
		try {
			const path = await llama.downloadChatModel()
			ui.print('')
			ui.print.green(`  ✓ Chat model weights ready at ${path}`)
			done.push('chat model weights')
		} catch (err: any) {
			ui.print.red('\n  ✗ Could not download the chat model:')
			ui.print.yellow(`    ${(err?.message ?? String(err)).split('\n').join('\n    ')}`)
			skipped.push('chat model weights (download failed — retry with `luca setup --chat-model`)')
		} finally {
			llama.off('downloadProgress', onProgress)
		}
	} else if (state.chatWeightsReady) {
		skipped.push('chat model weights (already downloaded)')
	} else if (!doChatWeights) {
		skipped.push('chat model weights — download later with `luca setup --chat-model`')
	}

	// ── Describe search index (needs binary + embedding weights) ─────
	const embedNowReady = state.embedWeightsReady || (doEmbedWeights && binaryNowReady)
	if (doDescribeIndex && binaryNowReady && embedNowReady) {
		ui.print('\n  Building the `luca describe --query` search index ...')
		try {
			const result = await buildDescribeEmbeddings(container, {
				onProgress: (indexed: number, total: number) => {
					process.stdout.write(`\r  embedded ${indexed}/${total} documents`)
				},
			})
			ui.print('')
			ui.print.green(`  ✓ Describe search index ready (${result.total} documents)`)
			done.push('describe search index')
		} catch (err: any) {
			ui.print.red('\n  ✗ Could not build the describe search index:')
			ui.print.yellow(`    ${(err?.message ?? String(err)).split('\n').join('\n    ')}`)
			skipped.push('describe search index (build failed — run `luca describe --calculate-embeddings` to retry)')
		}
	} else if (doDescribeIndex) {
		skipped.push('describe search index (needs llama-server and the embedding model)')
	} else if (!state.describeIndexReady && !options.types) {
		skipped.push('describe search index — build later with `luca describe --calculate-embeddings`')
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
	description: 'One-time machine setup: download the llama-server binary and local model weights (embedding + chat, each optional), and write TypeScript types into your project',
	argsSchema,
	examples: [
		'luca setup',
		{ command: 'luca setup --yes', description: 'llama-server binary + embedding model + types, no prompts' },
		{ command: 'luca setup --local-embeddings', description: 'Download llama-server and the embedding model for local semantic search' },
		{ command: 'luca setup --chat-model', description: `Download llama-server and the local chat model (${DEFAULT_CHAT_MODEL}) for a fully offline assistant` },
		{ command: 'luca setup --types', description: 'Write TypeScript declarations + tsconfig.json into the current project' },
	],
	handler: setup,
})
