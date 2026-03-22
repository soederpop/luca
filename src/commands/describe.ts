import { z } from 'zod'
import { commands } from '../command.js'
import { CommandOptionsSchema } from '../schemas/base.js'
import type { ContainerContext } from '../container.js'
import type { HelperIntrospection } from '../introspection/index.js'
import { __INTROSPECTION__, __BROWSER_INTROSPECTION__ } from '../introspection/index.js'
import { features } from '../feature.js'
import { ContainerDescriber } from '../container-describer.js'
import type { BrowserFeatureData } from '../container-describer.js'

declare module '../command.js' {
	interface AvailableCommands {
		describe: ReturnType<typeof commands.registerHandler>
	}
}

export const argsSchema = CommandOptionsSchema.extend({
	json: z.boolean().default(false).describe('Output introspection data as JSON instead of markdown'),
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

// --- Command handler ---

export default async function describe(options: z.infer<typeof argsSchema>, context: ContainerContext) {
	const container = context.container as any
	const describer = new ContainerDescriber(container)

	const args = container.argv._ as string[]
	const targets = args.slice(1)

	// No targets: show help screen
	if (targets.length === 0) {
		const { formatCommandHelp } = await import('./help.js')
		const ui = container.feature('ui') as any
		const Cmd = container.commands.lookup('describe')
		console.log(formatCommandHelp('describe', Cmd, ui.colors))
		return
	}

	// Build-time hack: load browser features into the describer if needed
	if (shouldIncludeBrowser(options.platform)) {
		const browserData = await loadBrowserFeatures()
		describer.setBrowserData(browserData)
	}

	const sections = ContainerDescriber.getSectionsFromFlags(options)

	const result = await describer.describe(targets, {
		sections,
		noTitle: !options.title,
		platform: options.platform as any,
	})

	if (options.json) {
		console.log(JSON.stringify(result.json, null, 2))
	} else if (options.pretty) {
		const ui = container.feature('ui')
		console.log(ui.markdown(result.text))
	} else {
		console.log(result.text)
	}
}

commands.registerHandler('describe', {
	description: 'Describe the container, registries, or individual helpers',
	argsSchema,
	handler: describe,
})
