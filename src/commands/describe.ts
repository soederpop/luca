import { z } from 'zod'
import { commands } from '../command.js'
import { CommandOptionsSchema } from '../schemas/base.js'
import type { ContainerContext } from '../container.js'
import type { HelperIntrospection, IntrospectionSection } from '../introspection/index.js'
import { __INTROSPECTION__, __BROWSER_INTROSPECTION__ } from '../introspection/index.js'
import { features } from '../feature.js'
import { ContainerDescriber, DescribeError } from '../container-describer.js'
import type { BrowserFeatureData } from '../container-describer.js'
import { presentIntrospectionAsTypeScript } from '../helper.js'

declare module '../command.js' {
	interface AvailableCommands {
		describe: ReturnType<typeof commands.registerHandler>
	}
}

export const argsSchema = CommandOptionsSchema.extend({
	json: z.boolean().default(false).describe('Output introspection data as JSON instead of markdown'),
	typescript: z.boolean().default(false).describe('Output introspection data as TypeScript interface declarations'),
	ts: z.boolean().default(false).describe('Alias for --typescript'),
	pretty: z.boolean().default(false).describe('Render markdown with terminal styling via ui.markdown'),
	title: z.boolean().default(true).describe('Include the title header in the output (use --no-title to omit)'),
	// Clean section flags (can be combined: --description --usage)
	description: z.boolean().default(false).describe('Show the description section'),
	usage: z.boolean().default(false).describe('Show the usage section'),
	methods: z.boolean().default(false).describe('Show the methods section'),
	getters: z.boolean().default(false).describe('Show the getters section'),
	events: z.boolean().default(false).describe('Show the events section'),
	state: z.boolean().default(false).describe('Show the state section'),
	options: z.boolean().default(false).describe('Show the options section'),
	'env-vars': z.boolean().default(false).describe('Show the envVars section'),
	envvars: z.boolean().default(false).describe('Show the envVars section'),
	examples: z.boolean().default(false).describe('Show the examples section'),
	// Legacy --only-* flags
	'only-methods': z.boolean().default(false).describe('Show only the methods section'),
	'only-getters': z.boolean().default(false).describe('Show only the getters section'),
	'only-events': z.boolean().default(false).describe('Show only the events section'),
	'only-state': z.boolean().default(false).describe('Show only the state section'),
	'only-options': z.boolean().default(false).describe('Show only the options section'),
	'only-env-vars': z.boolean().default(false).describe('Show only the envVars section'),
	'only-envvars': z.boolean().default(false).describe('Show only the envVars section'),
	'only-examples': z.boolean().default(false).describe('Show only the examples section'),
	platform: z.enum(['browser', 'web', 'server', 'node', 'all']).default('all').describe('Which platform features to show: browser/web, server/node, or all'),
	query: z.string().optional().describe('Search helpers, examples, and tutorials by meaning or keywords (e.g. --query "how do I build a rest server?")'),
	'calculate-embeddings': z.boolean().default(false).describe('Build/refresh the embedding index used by --query for semantic ranking. Uses the local model by default (requires `luca setup --local-embeddings`), or an OpenAI-compatible endpoint when LUCA_EMBEDDING_PROVIDER=openai'),
	limit: z.number().default(8).describe('Maximum results for --query'),
})

// --- Browser feature loading (build-time concern, lives here not in ContainerDescriber) ---

const WEB_FEATURE_IDS = ['speech', 'voice', 'assetLoader', 'network', 'vault', 'vm', 'esbuild', 'helpers', 'containerLink']

let _browserData: BrowserFeatureData | null = null

/**
 * Load web/browser feature introspection data into a separate map.
 * This is a build-time hack: we import web feature classes into the node process,
 * snapshot their introspection, then restore the node registry.
 * The ContainerDescriber itself knows nothing about this.
 */
async function loadBrowserFeatures(): Promise<BrowserFeatureData> {
	if (_browserData) return _browserData

	const nodeFeatureIds = new Set(features.available)
	const nodeIntrospection = new Map<string, HelperIntrospection>()
	const nodeConstructors = new Map<string, any>()

	for (const id of nodeFeatureIds) {
		const data = __INTROSPECTION__.get(`features.${id}`)
		if (data) nodeIntrospection.set(`features.${id}`, structuredClone(data))
		try { nodeConstructors.set(id, features.lookup(id)) } catch {}
	}

	await import('../introspection/generated.web.js')

	await Promise.all([
		import('../web/features/speech.js'),
		import('../web/features/voice-recognition.js'),
		import('../web/features/asset-loader.js'),
		import('../web/features/network.js'),
		import('../web/features/vault.js'),
		import('../web/features/vm.js'),
		import('../web/features/esbuild.js'),
		import('../web/features/helpers.js'),
		import('../web/features/container-link.js'),
	])

	const browserIntrospection = new Map<string, HelperIntrospection>()
	const browserConstructors = new Map<string, any>()
	const collidingIds = new Set<string>()

	for (const id of WEB_FEATURE_IDS) {
		const key = `features.${id}`
		const data = __INTROSPECTION__.get(key)
		if (data) browserIntrospection.set(key, structuredClone(data))
		try { browserConstructors.set(id, features.lookup(id)) } catch {}
		if (nodeFeatureIds.has(id)) collidingIds.add(id)
	}

	for (const [id, ctor] of nodeConstructors) {
		features.register(id, ctor)
	}

	for (const [key, data] of nodeIntrospection) {
		__INTROSPECTION__.set(key, data)
	}

	for (const id of WEB_FEATURE_IDS) {
		const key = `features.${id}`
		if (!nodeIntrospection.has(key)) __INTROSPECTION__.delete(key)
		if (!nodeFeatureIds.has(id)) features.unregister(id)
	}

	for (const [key, data] of browserIntrospection) {
		__BROWSER_INTROSPECTION__.set(key, data)
	}

	_browserData = {
		introspection: browserIntrospection,
		constructors: browserConstructors,
		available: WEB_FEATURE_IDS.filter(id => browserIntrospection.has(`features.${id}`)),
		collidingIds,
	}

	return _browserData
}

function shouldIncludeBrowser(platform: string): boolean {
	return platform === 'browser' || platform === 'web' || platform === 'all'
}

/** Normalize a name for fuzzy matching (strip extension, dashes/underscores, lowercase). */
function normalizeName(name: string): string {
	return name.replace(/\.[tj]sx?$/, '').replace(/[-_]/g, '').toLowerCase()
}

/** Resolve a target to its canonical command name, or undefined if it isn't a command. */
function resolveCommandName(container: any, target: string): string | undefined {
	// Member access (e.g. "fs.readFile") is never a command.
	if (target.includes('.')) return undefined
	const commands = container.commands
	if (!commands) return undefined
	if (commands.has(target)) return target
	const norm = normalizeName(target)
	return (commands.available as string[]).find((id) => normalizeName(id) === norm)
}

function isCommandTarget(container: any, target: string): boolean {
	return resolveCommandName(container, target) !== undefined
}

// --- Command handler ---

export default async function describe(options: z.infer<typeof argsSchema>, context: ContainerContext) {
	const container = context.container as any
	const describer = new ContainerDescriber(container)

	const args = container.argv._ as string[]
	const targets = args.slice(1)

	// --calculate-embeddings: build/refresh the embedding index for --query
	if (options['calculate-embeddings']) {
		await calculateEmbeddings(container, options)
		return
	}

	// --query: semantic/keyword search over helpers, examples, and tutorials
	if (options.query) {
		await runQuery(container, options)
		return
	}

	// No targets: show help screen
	if (targets.length === 0) {
		const { formatCommandHelp } = await import('./help.js')
		const ui = container.feature('ui') as any
		const Cmd = container.commands.lookup('describe')
		console.log(formatCommandHelp('describe', Cmd, ui.colors))
		return
	}

	// Steer users away from describing CLI commands. `describe` documents a
	// helper's programmatic API (methods, getters, events) — for a command that's
	// rarely what you want. You want to know how to *invoke* it, which lives in
	// the command's own `--help`. Warn before rendering, don't block.
	const commandTargets = targets.filter((t) => isCommandTarget(container, t))
	if (commandTargets.length > 0) {
		const ui = container.feature('ui') as any
		for (const cmd of commandTargets) {
			const resolved = resolveCommandName(container, cmd)
			const msg = `⚠️  "${cmd}" is a CLI command. \`luca describe\` shows its programmatic internals, not how to run it.\n    To learn its arguments, flags, and usage, run:  luca ${resolved} --help`
			console.error(ui?.colors ? ui.colors.yellow(msg) : msg)
		}
		console.error('')
	}

	// Build-time hack: load browser features into the describer if needed
	if (shouldIncludeBrowser(options.platform)) {
		const browserData = await loadBrowserFeatures()
		describer.setBrowserData(browserData)
	}

	const sections = ContainerDescriber.getSectionsFromFlags(options)

	let result: Awaited<ReturnType<typeof describer.describe>>
	try {
		result = await describer.describe(targets, {
			sections,
			noTitle: !options.title,
			platform: options.platform as any,
		})
	} catch (err: any) {
		// Known lookup misses (unknown helper/member/registry) are user errors, not
		// crashes — print the friendly message + suggestions without a stack trace.
		// Unexpected errors still propagate with their full stack.
		if (err instanceof DescribeError || err?.name === 'DescribeError') {
			console.error(err.message)
			process.exitCode = 1
			return
		}
		throw err
	}

	const wantsTypeScript = options.typescript || options.ts

	if (wantsTypeScript) {
		const output = renderResultAsTypeScript(result, targets, describer, sections)
		if (options.pretty) {
			const ui = container.feature('ui')
			console.log(ui.markdown('```ts\n' + output + '\n```'))
		} else {
			console.log(output)
		}
	} else if (options.json) {
		console.log(JSON.stringify(result.json, null, 2))
	} else if (options.pretty) {
		const ui = container.feature('ui')
		console.log(ui.markdown(result.text))
	} else {
		console.log(result.text)
	}
}

// --- --query / --calculate-embeddings handlers ---

/** Strip the FTS5 snippet highlight markers and collapse whitespace. */
function normalizeSnippet(snippet: string): string {
	return (snippet || '').replace(/>>>|<<</g, '').replace(/\s+/g, ' ').trim()
}

async function runQuery(container: any, options: z.infer<typeof argsSchema>) {
	const { queryDescribeIndex } = await import('../describe-search.js')
	const outcome = await queryDescribeIndex(container, options.query!, { limit: options.limit })

	if (options.json) {
		console.log(JSON.stringify({
			query: options.query,
			mode: outcome.mode,
			results: outcome.results.map(r => ({
				id: r.pathId,
				kind: r.meta?.kind ?? r.model,
				name: r.meta?.name ?? r.title,
				...(r.meta?.category ? { category: r.meta.category } : {}),
				...(r.meta?.stability ? { stability: r.meta.stability } : {}),
				score: r.score,
				snippet: normalizeSnippet(r.snippet),
				describe: r.meta?.ref ?? '',
			})),
			...(outcome.hint ? { hint: outcome.hint } : {}),
		}, null, 2))
		return
	}

	const ui = container.feature('ui') as any
	if (outcome.results.length === 0) {
		console.log(`No matches for "${options.query}". Try different keywords, or browse with: luca describe features`)
	} else {
		for (let i = 0; i < outcome.results.length; i++) {
			const r = outcome.results[i]!
			const kind = r.meta?.kind ?? r.model ?? ''
			const category = r.meta?.category ? `, ${r.meta.category}` : ''
			const label = kind === 'feature' || kind === 'client' || kind === 'server'
				? `${r.meta?.name ?? r.title} (${kind}${category})`
				: `${r.title} (${kind})`
			const snippet = normalizeSnippet(r.snippet)
			console.log(`${i + 1}. ${label}${snippet ? ` — ${snippet}` : ''}`)
			if (r.meta?.ref) console.log(`   → ${r.meta.ref}`)
		}
	}

	// Hint goes to stderr so piped stdout stays clean
	if (outcome.hint) {
		console.error(ui?.colors ? ui.colors.dim(outcome.hint) : outcome.hint)
	}
}

async function calculateEmbeddings(container: any, options: z.infer<typeof argsSchema>) {
	const { buildDescribeEmbeddings, describeEmbeddingConfig, describeEmbeddingReadiness } = await import('../describe-search.js')

	const cfg = describeEmbeddingConfig()
	if (await describeEmbeddingReadiness(cfg) === 'deps-missing') {
		if (cfg.provider === 'openai') {
			console.error('No embedding endpoint configured. Set LUCA_EMBEDDING_API_KEY (or OPENAI_API_KEY / LUCA_EMBEDDING_BASE_URL), then re-run: luca describe --calculate-embeddings')
		} else {
			console.error('Local embeddings are not installed. Run: luca setup --local-embeddings, then re-run: luca describe --calculate-embeddings')
		}
		process.exitCode = 1
		return
	}

	try {
		if (!options.json) {
			console.log('Building the describe search index (the first run may take a minute while the embedding daemon starts)...')
		}
		const result = await buildDescribeEmbeddings(container, {
			onProgress: options.json ? undefined : (indexed, total) => {
				process.stdout.write(`\r  embedded ${indexed}/${total} documents`)
			},
		})
		if (options.json) {
			console.log(JSON.stringify(result))
		} else if (result.indexed === 0) {
			console.log(`Index already up to date (${result.total} documents).`)
		} else {
			console.log(`\nDone — embedded ${result.indexed} of ${result.total} documents. Try: luca describe --query "how do I build a rest server?"`)
		}
	} catch (err: any) {
		// e.g. weights removed between the readiness check and embedding —
		// the feature's error already says how to fix it; no stack needed.
		console.error(err?.message || String(err))
		process.exitCode = 1
	}
}

/**
 * Renders the describe result as TypeScript interface declarations.
 * Handles single helpers, arrays of helpers (registry describes), and the container.
 */
function renderResultAsTypeScript(result: { json: any; text: string }, targets: string[], describer: ContainerDescriber, sections: (IntrospectionSection | 'description')[]): string {
	const json = result.json
	const section = sections.length === 1 && sections[0] !== 'description' ? sections[0] as IntrospectionSection : undefined

	// Single helper introspection object (has shortcut = full data, or id = filtered data)
	if (json && (json.shortcut || json.id)) {
		// If sections were applied, the JSON is partial — get full data and pass section to renderer
		const fullData = json.shortcut ? json : __INTROSPECTION__.get(json.id) || json
		return presentIntrospectionAsTypeScript(fullData, section)
	}

	// Container introspection (has className, registries, factories)
	if (json && json.className && json.registries) {
		const container = (describer as any).container
		return container.introspectAsType()
	}

	// Array of results (e.g. from registry describe or multiple targets)
	if (Array.isArray(json)) {
		const interfaces = json
			.filter((item: any) => item && (item.shortcut || item.id))
			.map((item: any) => {
				const fullData = item.shortcut ? item : __INTROSPECTION__.get(item.id) || item
				return presentIntrospectionAsTypeScript(fullData, section)
			})
		return interfaces.join('\n\n')
	}

	// Object keyed by helper id (registry describe format — has _shared and per-helper summaries)
	if (json && typeof json === 'object' && !json._helper && json._shared) {
		const ids = Object.keys(json).filter(k => k !== '_shared')
		const interfaces = ids
			.map((id: string) => {
				// Try qualified key first (e.g. "clients.rest"), then scan the introspection map
				for (const prefix of ['features', 'clients', 'servers', 'commands', 'endpoints']) {
					const data = __INTROSPECTION__.get(`${prefix}.${id}`)
					if (data) return presentIntrospectionAsTypeScript(data, section)
				}
				return null
			})
			.filter(Boolean)
		if (interfaces.length > 0) return interfaces.join('\n\n')
	}

	// Member-level result (has _helper and _type) — render the full helper interface
	if (json && json._helper) {
		const fullData = __INTROSPECTION__.get(json._helper) || __INTROSPECTION__.get(`features.${json._helper}`)
		if (fullData) return presentIntrospectionAsTypeScript(fullData)
	}

	return result.text
}

export const positionals = [
	{ name: 'target', description: 'What to describe: a helper (fs), a member (ui.banner), or a registry (features, clients, servers, commands). Omit to describe the container itself.', required: false },
]

export const examples = [
	{ command: 'luca describe features', description: 'Index of all available features, grouped by category' },
	'luca describe fs',
	{ command: 'luca describe ui.banner', description: 'Docs for a specific method or getter' },
	{ command: 'luca describe fs --methods --examples', description: 'Show only selected sections' },
	{ command: 'luca describe --query "how do I build a rest server?"', description: 'Search helpers, examples, and tutorials by meaning' },
	{ command: 'luca describe --calculate-embeddings', description: 'Build the local embedding index for semantic --query ranking' },
]

commands.registerHandler('describe', {
	description: 'Describe the container, registries, or individual helpers',
	argsSchema,
	positionals,
	examples,
	handler: describe,
})
