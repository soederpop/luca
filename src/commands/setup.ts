import { z } from 'zod'
import { commands } from '../command.js'
import { CommandOptionsSchema } from '../schemas/base.js'
import type { ContainerContext } from '../container.js'
import type { NodeContainer } from '../node/container.js'
import { lucaHome } from '../setup/paths.js'
import type { DiscoveredModelServer, ModelProviderConfigSuggestion } from '../agi/features/model-providers'
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
	providers: z.boolean().default(false).describe('Scan for running OpenAI-compatible servers (localhost + tailscale) and offer to write ~/.luca/model-providers.yml or assistants/options.yml'),
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

// ── `luca setup --providers` ────────────────────────────────────────────────

/** The two config files a discovered provider list can be written to. */
export interface ProvidersDestination {
	kind: 'machine' | 'project'
	path: string
}

export function providersDestinations(container: NodeContainer): ProvidersDestination[] {
	return [
		{ kind: 'machine', path: container.paths.resolve(lucaHome(), 'model-providers.yml') },
		{ kind: 'project', path: container.paths.resolve('assistants/options.yml') },
	]
}

function isPlainObject(value: any): value is Record<string, any> {
	return !!value && typeof value === 'object' && !Array.isArray(value)
}

/** One-line rendering of a suggestion entry for terminal output. */
function describeProviderEntry(entry: string | { host: string; model: string }): string {
	return typeof entry === 'string' ? entry : `${entry.host}/${entry.model}`
}

/** Loopback aliases and trailing slashes all describe the same endpoint. */
function normalizeURL(baseURL: string): string {
	return baseURL.replace(/\/+$/, '').replace('://localhost:', '://127.0.0.1:').replace('://0.0.0.0:', '://127.0.0.1:')
}

/**
 * `host:port` for an endpoint, with loopback aliases folded together. Used to
 * decide whether a discovered server is already configured — an existing entry
 * may name a tailscale peer by hostname while discovery reports its IP.
 */
function hostPortKey(url: string): string {
	try {
		const parsed = new URL(url)
		const host = ['localhost', '0.0.0.0', '::1'].includes(parsed.hostname) ? '127.0.0.1' : parsed.hostname
		const port = parsed.port || (parsed.protocol === 'https:' ? '443' : '80')
		return `${host}:${port}`
	} catch {
		return normalizeURL(url)
	}
}

/**
 * Fold a suggestion into an existing config document, preserving every other
 * key already in the file. Provider ids come from `suggestConfig()`, which
 * avoids collisions with ids already present, so nothing the user wrote is
 * replaced — only host names and new provider entries are added.
 */
export function mergeProviderConfig(doc: any, suggestion: ModelProviderConfigSuggestion, target: ProvidersDestination) {
	const next: Record<string, any> = isPlainObject(doc) ? { ...doc } : {}
	const nested = isPlainObject(next.providers)
	const section: Record<string, any> = nested ? { ...next.providers } : (target.kind === 'project' ? {} : next)
	const hosts = isPlainObject(section.hosts) ? { ...section.hosts } : {}
	Object.assign(hosts, suggestion.hosts)
	section.hosts = hosts
	for (const [id, entry] of Object.entries(suggestion.providers)) section[id] = entry
	if (nested || target.kind === 'project') next.providers = section
	return next
}

/** The `providers:` map already present in a document, or the whole document for the machine file. */
function existingProviderSection(doc: any, target: ProvidersDestination): Record<string, any> {
	if (!isPlainObject(doc)) return {}
	if (isPlainObject(doc.providers)) return doc.providers
	return target.kind === 'project' ? {} : doc
}

/**
 * `luca setup --providers`: scan for live OpenAI-compatible servers and offer
 * to write them into `~/.luca/model-providers.yml` (machine-wide) or the
 * `providers:` section of `assistants/options.yml` (this project). Interactive
 * when stdin is a TTY; otherwise it prints the suggested YAML and writes
 * nothing.
 */
async function setupProviders(
	container: NodeContainer,
	ui: any,
	interactive: boolean,
): Promise<{ done?: string; skipped?: string }> {
	const fs = container.feature('fs')
	const yaml = container.feature('yaml')
	const mp = container.feature('modelProviders') as any

	ui.print('\n  Scanning for OpenAI-compatible model servers ...')
	let servers: DiscoveredModelServer[] = []
	try {
		servers = await mp.discover({ refresh: true })
	} catch (err: any) {
		ui.print.red(`  ✗ Discovery failed: ${err?.message ?? err}`)
		return { skipped: 'model providers (discovery failed)' }
	}

	if (!servers.length) {
		ui.print.dim('    · no server answered GET /v1/models on the known ports (localhost or tailscale)')
		ui.print.dim('      start a local server — `luca setup` installs llama-server — or add hosts, then retry')
		return { skipped: 'model providers (nothing discovered)' }
	}

	ui.print('')
	for (const server of servers) {
		const where = server.source === 'tailscale' ? `${server.hostname ?? server.host} (tailscale)` : server.host
		const models = server.models.length
			? server.models.slice(0, 3).join(', ') + (server.models.length > 3 ? ` … +${server.models.length - 3}` : '')
			: 'no models advertised'
		ui.print(`    ${ui.colors.green('●')} ${server.baseURL}  ${ui.colors.dim(`[${server.hint ?? 'unknown'} · ${where} · ${server.latencyMs}ms]`)}`)
		ui.print(`      ${ui.colors.dim(models)}`)
	}

	// An endpoint is "already usable" when a config file declares it, or when it
	// is the machine's own llama-server (`local`) — that one is a built-in and
	// needs no entry. Built-in lmstudio/ollama are deliberately *not* covered,
	// since a model-specific entry for them is the useful thing to generate.
	const covered = new Set(
		[
			...(mp.configuredProviderIds as string[]).map(id => mp.get(id)?.baseURL),
			mp.get('local')?.baseURL,
		]
			.filter((url: any): url is string => !!url)
			.map(hostPortKey),
	)
	const candidates = servers.filter((server: DiscoveredModelServer) => {
		if (covered.has(hostPortKey(server.baseURL))) return false
		// A configured tailscale entry names the peer, while discovery reports its IP.
		return !(server.hostname && covered.has(`${server.hostname}:${server.port}`))
	})

	if (!candidates.length) {
		ui.print.dim('\n  · every discovered server is already covered by a configured or built-in provider — nothing to add')
		return { skipped: 'model providers (all already configured)' }
	}

	if (!interactive) {
		const suggestion = mp.suggestConfig(candidates, { existingProviderIds: mp.configuredProviderIds })
		ui.print('\n  Non-interactive terminal — nothing written. Suggested ~/.luca/model-providers.yml:\n')
		ui.print(yaml.stringify({ hosts: suggestion.hosts, ...suggestion.providers }))
		return { skipped: 'model providers (non-interactive — printed suggestion instead)' }
	}

	const destinations = providersDestinations(container)
	const machine = destinations.find(d => d.kind === 'machine')!
	const project = destinations.find(d => d.kind === 'project')!

	const { destination } = await ui.wizard([{
		type: 'list',
		name: 'destination',
		message: 'Where should the discovered providers be written?',
		choices: [
			{ name: `Machine-wide — ${machine.path}`, value: 'machine' },
			{ name: `This project — ${project.path}`, value: 'project' },
			{ name: 'Neither — print the YAML instead', value: 'print' },
		],
		default: 'machine',
	}])

	if (destination === 'print') {
		const suggestion = mp.suggestConfig(candidates, { existingProviderIds: mp.configuredProviderIds })
		ui.print('')
		ui.print(yaml.stringify({ hosts: suggestion.hosts, ...suggestion.providers }))
		return { skipped: 'model providers (printed, nothing written)' }
	}

	const target = destination === 'project' ? project : machine
	const raw = fs.exists(target.path) ? String(fs.readFileSync(target.path, 'utf8')) : ''
	let doc: any
	if (raw) {
		try {
			doc = yaml.parse(raw)
		} catch (err: any) {
			ui.print.red(`\n  ✗ ${target.path} is not valid YAML — fix it before writing:`)
			ui.print.yellow(`    ${(err?.message ?? String(err)).split('\n').join('\n    ')}`)
			return { skipped: `model providers (${target.path} did not parse)` }
		}
	}

	const section = existingProviderSection(doc, target)
	const existingHosts = isPlainObject(section.hosts) ? section.hosts : {}
	const existingIds = Object.keys(section).filter(key => key !== 'hosts')

	const { chosen } = await ui.wizard([{
		type: 'checkbox',
		name: 'chosen',
		message: 'Which servers should be written?',
		choices: candidates.map(server => ({
			name: `${server.baseURL} — ${server.hint ?? server.host}`,
			value: server.baseURL,
			checked: true,
		})),
	}])
	const selected = candidates.filter(server => ((chosen as string[]) ?? []).includes(server.baseURL))
	if (!selected.length) {
		ui.print.dim('  Nothing selected — nothing written.')
		return { skipped: 'model providers (nothing selected)' }
	}

	const models: Record<string, string> = {}
	for (const server of selected) {
		if (server.models.length <= 1) continue
		const { model } = await ui.wizard([{
			type: 'list',
			name: 'model',
			message: `Default model for ${server.baseURL}`,
			choices: server.models,
			default: server.models[0],
		}])
		models[server.baseURL] = model
	}

	const suggestion = mp.suggestConfig(selected, { hosts: existingHosts, existingProviderIds: existingIds, models })
	const addedIds = Object.keys(suggestion.providers)
	const addedHosts = Object.entries(suggestion.hosts).filter(([key]) => !(key in existingHosts))

	ui.print('\n  Will add:')
	ui.print(`    hosts: ${addedHosts.map(([key, url]) => `${key}: ${url}`).join(', ') || '(none new)'}`)
	for (const id of addedIds) ui.print(`    ${id}: ${describeProviderEntry(suggestion.providers[id])}`)

	const next = mergeProviderConfig(doc, suggestion, target)
	const header = target.kind === 'machine'
		? `# Machine-wide model providers, available to every luca project on this machine.\n# Written by \`luca setup --providers\` on ${new Date().toISOString().slice(0, 10)}.\n# Shape: luca describe modelProviders\n\n`
		: ''
	const content = header + yaml.stringify(next)

	// A rewrite drops hand-written comments. Say so and let the user opt out
	// rather than silently flattening a file they curated.
	const commentCount = (raw.match(/^\s*#/gm) ?? []).length
	if (commentCount > 0) {
		const { action } = await ui.wizard([{
			type: 'list',
			name: 'action',
			message: `${target.path} has ${commentCount} comment line(s); rewriting will drop them.`,
			choices: [
				{ name: 'Rewrite it, keeping every provider entry', value: 'write' },
				{ name: 'Print the YAML and leave the file alone', value: 'print' },
				{ name: 'Cancel', value: 'cancel' },
			],
			default: 'print',
		}])
		if (action === 'cancel') {
			ui.print.dim('  Cancelled — nothing written.')
			return { skipped: 'model providers (cancelled)' }
		}
		if (action === 'print') {
			ui.print('')
			ui.print(content.trimEnd())
			return { skipped: 'model providers (printed, file untouched)' }
		}
	} else {
		const ok = await confirm(ui, `Write ${addedIds.length} provider(s) to ${target.path}?`, true)
		if (!ok) {
			ui.print.dim('  Skipped — nothing written.')
			return { skipped: 'model providers (cancelled)' }
		}
	}

	fs.ensureFolder(target.kind === 'machine' ? lucaHome() : container.paths.resolve('assistants'))
	fs.writeFileSync(target.path, content)
	ui.print.green(`\n  ✓ Wrote ${addedIds.length} provider(s) to ${target.path}`)
	ui.print.dim(`    ${addedIds.join(', ')}`)
	ui.print.dim("    Reload a running process with container.feature('modelProviders').loadConfigFiles()")
	return { done: `model providers (${addedIds.length} in ${target.path})` }
}


export async function setup(options: z.infer<typeof argsSchema>, context: ContainerContext) {
	const container = context.container as unknown as NodeContainer
	const fs = container.feature('fs')
	const ui = container.feature('ui')

	ui.print.cyan('\n  luca setup — one-time machine and project setup\n')

	const state = await scanState(container, fs)
	printStateReport(ui, state)

	const flagged = options.yes || options['local-embeddings'] || options['chat-model'] || options['skip-models'] || options.types || options.providers
	const doProviders = options.providers
	let doBinary: boolean
	let doEmbedWeights: boolean
	let doChatWeights: boolean
	let doTypes: boolean
	let doDescribeIndex = false

	const runStack = options.yes || options['local-embeddings'] || options['chat-model'] || options['skip-models']
	if (flagged) {
		if (runStack) {
			doBinary = true
			doEmbedWeights = options.yes || options['local-embeddings']
			doChatWeights = options['chat-model']
			doTypes = (options.yes || options['skip-models'] || options.types) && state.isProject
			if (options['skip-models']) { doEmbedWeights = false; doChatWeights = false }
			doDescribeIndex = (options.yes || options['local-embeddings']) && !state.describeIndexReady
		} else {
			// `--types` and/or `--providers` only — leave the llama-server stack alone
			doBinary = false
			doEmbedWeights = false
			doChatWeights = false
			doTypes = !!options.types && state.isProject
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

	// ── Model providers (independent of the llama-server stack) ──────
	if (doProviders) {
		const result = await setupProviders(container, ui, !!process.stdin.isTTY)
		if (result.done) done.push(result.done)
		else if (result.skipped) skipped.push(result.skipped)
	}

	// ── Summary ──────────────────────────────────────────────────────
	ui.print('')
	if (done.length) ui.print.green(`  ✓ Setup complete: ${done.join(', ')}`)
	else ui.print('  Nothing to do — everything was already set up or skipped.')
	for (const s of skipped) ui.print.dim(`    · skipped ${s}`)
	ui.print('')
}

commands.registerHandler('setup', {
	description: 'One-time machine setup: download the llama-server binary and local model weights (embedding + chat, each optional), write TypeScript types into your project, and optionally scan for running model servers to write a provider config',
	argsSchema,
	examples: [
		'luca setup',
		{ command: 'luca setup --yes', description: 'llama-server binary + embedding model + types, no prompts' },
		{ command: 'luca setup --local-embeddings', description: 'Download llama-server and the embedding model for local semantic search' },
		{ command: 'luca setup --chat-model', description: `Download llama-server and the local chat model (${DEFAULT_CHAT_MODEL}) for a fully offline assistant` },
		{ command: 'luca setup --types', description: 'Write TypeScript declarations + tsconfig.json into the current project' },
		{ command: 'luca setup --providers', description: 'Scan localhost + tailscale for OpenAI-compatible servers and write them to ~/.luca/model-providers.yml or assistants/options.yml' },
	],
	handler: setup,
})
