import { z } from 'zod'
import { commands } from '../command.js'
import { CommandOptionsSchema } from '../schemas/base.js'
import type { ContainerContext } from '../container.js'
import type { IntrospectionSection, MethodIntrospection, GetterIntrospection, HelperIntrospection } from '../introspection/index.js'
import { __INTROSPECTION__, __BROWSER_INTROSPECTION__ } from '../introspection/index.js'
import { features } from '../feature.js'
import { presentIntrospectionAsMarkdown } from '../helper.js'

declare module '../command.js' {
	interface AvailableCommands {
		describe: ReturnType<typeof commands.registerHandler>
	}
}

const REGISTRY_NAMES = ['features', 'clients', 'servers', 'commands', 'endpoints', 'selectors'] as const
type RegistryName = (typeof REGISTRY_NAMES)[number]

/** Maps flag names to the section they represent. 'description' is handled specially. */
const SECTION_FLAGS: Record<string, IntrospectionSection | 'description'> = {
	// Clean flag names (combinable)
	'description': 'description',
	'usage': 'usage',
	'methods': 'methods',
	'getters': 'getters',
	'events': 'events',
	'state': 'state',
	'options': 'options',
	'env-vars': 'envVars',
	'envvars': 'envVars',
	'examples': 'examples',
	// Legacy --only-* flags (still work, map into same system)
	'only-methods': 'methods',
	'only-getters': 'getters',
	'only-events': 'events',
	'only-state': 'state',
	'only-options': 'options',
	'only-env-vars': 'envVars',
	'only-envvars': 'envVars',
	'only-examples': 'examples',
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

type Platform = 'browser' | 'server' | 'node' | 'all'

type ResolvedTarget =
	| { kind: 'container' }
	| { kind: 'registry'; name: RegistryName }
	| { kind: 'helper'; registry: RegistryName; id: string }
	| { kind: 'member'; registry: RegistryName; id: string; member: string; memberType: 'method' | 'getter' }
	| { kind: 'browser-helper'; id: string }
	| { kind: 'browser-member'; id: string; member: string; memberType: 'method' | 'getter' }

class DescribeError extends Error {
	constructor(message: string) {
		super(message)
		this.name = 'DescribeError'
	}
}

// --- Browser feature loading ---

const WEB_FEATURE_IDS = ['speech', 'voice', 'assetLoader', 'network', 'vault', 'vm', 'esbuild', 'helpers', 'containerLink']

type BrowserFeatureData = {
	introspection: Map<string, HelperIntrospection>
	constructors: Map<string, any>
	available: string[]
	collidingIds: Set<string>
}

let _browserData: BrowserFeatureData | null = null

/**
 * Load web/browser feature introspection data into a separate map.
 * Imports the web feature class files to get full Zod-derived data,
 * then restores the node registry and introspection to their original state.
 */
async function loadBrowserFeatures(): Promise<BrowserFeatureData> {
	if (_browserData) return _browserData

	// Snapshot current node state
	const nodeFeatureIds = new Set(features.available)
	const nodeIntrospection = new Map<string, HelperIntrospection>()
	const nodeConstructors = new Map<string, any>()

	for (const id of nodeFeatureIds) {
		const data = __INTROSPECTION__.get(`features.${id}`)
		if (data) nodeIntrospection.set(`features.${id}`, structuredClone(data))
		try { nodeConstructors.set(id, features.lookup(id)) } catch {}
	}

	// Import generated web build-time data (descriptions, methods, getters from AST)
	await import('../introspection/generated.web.js')

	// Import web feature class files (triggers Feature.register → interceptRegistration → Zod data)
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

	// Capture browser introspection data and constructors
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

	// Restore node registry: re-register all node constructors
	for (const [id, ctor] of nodeConstructors) {
		features.register(id, ctor)
	}

	// Fully restore node introspection (overwrite whatever interceptRegistration did during re-register)
	for (const [key, data] of nodeIntrospection) {
		__INTROSPECTION__.set(key, data)
	}

	// Clean up: remove web-only entries from __INTROSPECTION__ and the registry
	for (const id of WEB_FEATURE_IDS) {
		const key = `features.${id}`
		if (!nodeIntrospection.has(key)) {
			__INTROSPECTION__.delete(key)
		}
		if (!nodeFeatureIds.has(id)) {
			features.unregister(id)
		}
	}

	// Store in __BROWSER_INTROSPECTION__ for other potential consumers
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

/** Render a browser feature's introspection data directly (no Ctor needed). */
function renderBrowserHelperText(data: HelperIntrospection, sections: (IntrospectionSection | 'description')[], noTitle = false, headingDepth = 1): string {
	const h = '#'.repeat(headingDepth)
	const className = data.className || data.id

	if (sections.length === 0) {
		const body = presentIntrospectionAsMarkdown(data, headingDepth)
		if (noTitle) {
			// Strip the title heading and return description + sections
			const lines = body.split('\n')
			const sectionHeading = '#'.repeat(headingDepth + 1) + ' '
			const firstSectionIdx = lines.findIndex((l, i) => i > 0 && l.startsWith(sectionHeading))
			const desc = data.description ? data.description + '\n\n' : ''
			if (firstSectionIdx > 0) {
				return desc + lines.slice(firstSectionIdx).join('\n')
			}
			// No subsections — just return the description
			return desc.trim() || 'No introspection data available.'
		}
		return body
	}

	const parts: string[] = []
	if (!noTitle) {
		parts.push(`${h} ${className} (${data.id})`)
		if (data.description) parts.push(data.description)
	}

	const introspectionSections = sections.filter((s): s is IntrospectionSection => s !== 'description')
	for (const section of introspectionSections) {
		const text = presentIntrospectionAsMarkdown(data, headingDepth, section)
		if (text) parts.push(text)
	}

	return parts.join('\n\n') || `${noTitle ? '' : `${h} ${className}\n\n`}No introspection data available.`
}

function renderBrowserHelperJson(data: HelperIntrospection, sections: (IntrospectionSection | 'description')[], noTitle = false): any {
	if (sections.length === 0) return data

	const result: Record<string, any> = {}
	if (!noTitle) {
		result.id = data.id
		if (data.className) result.className = data.className
	}
	for (const section of sections) {
		if (section === 'description') {
			result.id = data.id
			if (data.className) result.className = data.className
			result.description = data.description
		} else if (section === 'usage') {
			result.usage = { shortcut: data.shortcut, options: data.options }
		} else {
			result[section] = (data as any)[section]
		}
	}
	return result
}

/** Build a concise summary for a browser feature from introspection data. */
function buildBrowserHelperSummary(data: HelperIntrospection): string {
	const ownMethods = Object.keys(data.methods || {}).sort()
	const ownGetters = Object.keys(data.getters || {}).sort()
	const lines: string[] = []
	if (ownGetters.length) lines.push(`getters: ${ownGetters.join(', ')}`)
	if (ownMethods.length) lines.push(`methods: ${ownMethods.map(m => m + '()').join(', ')}`)
	return lines.join('\n')
}

function getBrowserHelperData(id: string, sections: (IntrospectionSection | 'description')[], noTitle = false, headingDepth = 1): { json: any; text: string } {
	const data = _browserData!.introspection.get(`features.${id}`)
	if (!data) return { json: {}, text: `No browser introspection data for ${id}` }

	const text = renderBrowserHelperText(data, sections, noTitle, headingDepth)

	// Inject summary after title for full renders
	let finalText = text
	if (sections.length === 0 && !noTitle) {
		const summary = buildBrowserHelperSummary(data)
		if (summary) {
			const sectionHeading = '#'.repeat(headingDepth + 1) + ' '
			const idx = text.indexOf('\n' + sectionHeading)
			if (idx >= 0) {
				finalText = text.slice(0, idx) + '\n\n' + summary + '\n' + text.slice(idx)
			}
		}
	}

	return {
		json: renderBrowserHelperJson(data, sections, noTitle),
		text: finalText,
	}
}

function getBrowserMemberData(id: string, member: string, memberType: 'method' | 'getter', headingDepth = 1): { json: any; text: string } {
	const data = _browserData!.introspection.get(`features.${id}`)
	if (!data) return { json: {}, text: `No browser introspection data for ${id}` }

	const h = '#'.repeat(headingDepth)
	const hSub = '#'.repeat(headingDepth + 1)

	if (memberType === 'method') {
		const method = data.methods?.[member] as MethodIntrospection | undefined
		if (!method) return { json: {}, text: `No introspection data for ${id}.${member}()` }

		const parts: string[] = [`${h} ${id}.${member}() (browser)`]
		parts.push(`> method on **${data.className || id}**`)
		if (method.description) parts.push(method.description)

		const paramEntries = Object.entries(method.parameters || {})
		if (paramEntries.length > 0) {
			const paramLines = [`${hSub} Parameters`, '']
			for (const [name, info] of paramEntries) {
				const req = (method.required || []).includes(name) ? ' *(required)*' : ''
				paramLines.push(`- **${name}** \`${info.type}\`${req}${info.description ? ' — ' + info.description : ''}`)
			}
			parts.push(paramLines.join('\n'))
		}

		if (method.returns && method.returns !== 'void') {
			parts.push(`${hSub} Returns\n\n\`${method.returns}\``)
		}

		return { json: { [member]: method, _helper: id, _type: 'method', _platform: 'browser' }, text: parts.join('\n\n') }
	}

	const getter = data.getters?.[member] as GetterIntrospection | undefined
	if (!getter) return { json: {}, text: `No introspection data for ${id}.${member}` }

	const parts: string[] = [`${h} ${id}.${member} (browser)`]
	parts.push(`> getter on **${data.className || id}** — returns \`${getter.returns || 'unknown'}\``)
	if (getter.description) parts.push(getter.description)

	return { json: { [member]: getter, _helper: id, _type: 'getter', _platform: 'browser' }, text: parts.join('\n\n') }
}

function getBrowserRegistryData(sections: (IntrospectionSection | 'description')[], noTitle = false, headingDepth = 1): { json: any; text: string } {
	const browserData = _browserData!
	const available = browserData.available

	if (available.length === 0) {
		return { json: {}, text: 'No browser features are registered.' }
	}

	if (sections.length === 0) {
		const h = '#'.repeat(headingDepth)
		const hSub = '#'.repeat(headingDepth + 1)
		const jsonResult: Record<string, any> = {}
		const textParts: string[] = [`${h} Available browser features (${available.length})\n`]

		for (const id of available.sort()) {
			const data = browserData.introspection.get(`features.${id}`)
			if (!data) continue

			const summary = extractSummary(data.description || 'No description provided')
			const featureGetters = Object.keys(data.getters || {}).sort()
			const featureMethods = Object.keys(data.methods || {}).sort()

			jsonResult[id] = { description: summary, methods: featureMethods, getters: featureGetters, platform: 'browser' }

			const memberLines: string[] = []
			if (featureGetters.length) memberLines.push(`  getters: ${featureGetters.join(', ')}`)
			if (featureMethods.length) memberLines.push(`  methods: ${featureMethods.map(m => m + '()').join(', ')}`)
			const memberBlock = memberLines.length ? '\n' + memberLines.join('\n') + '\n' : ''

			textParts.push(`${hSub} ${id}\n${summary}\n${memberBlock}`)
		}

		return { json: jsonResult, text: textParts.join('\n') }
	}

	// Sections specified: render each helper in detail
	const jsonResult: Record<string, any> = {}
	const textParts: string[] = []
	for (const id of available) {
		const data = browserData.introspection.get(`features.${id}`)
		if (!data) continue
		jsonResult[id] = renderBrowserHelperJson(data, sections, noTitle)
		textParts.push(renderBrowserHelperText(data, sections, noTitle, headingDepth))
	}

	return { json: jsonResult, text: textParts.join('\n\n---\n\n') }
}

function normalizePlatform(p: string): Platform {
	if (p === 'node') return 'server'
	if (p === 'web') return 'browser'
	return p as Platform
}

function shouldIncludeNode(platform: Platform): boolean {
	return platform === 'server' || platform === 'node' || platform === 'all'
}

function shouldIncludeBrowser(platform: Platform): boolean {
	return platform === 'browser' || platform === 'all'
}

// --- End browser feature loading ---

/**
 * Extract a short summary from a potentially long description string.
 * Takes text up to the first markdown heading, bullet list, or code block,
 * capped at ~300 chars on a sentence boundary.
 */
function extractSummary(description: string): string {
	// Strip from the first markdown heading/bullet/code block onward
	const cut = description.search(/\s\*\*[A-Z][\w\s]+:\*\*|```|^\s*[-*]\s/m)
	const text = cut > 0 ? description.slice(0, cut).trim() : description

	if (text.length <= 300) return text

	// Truncate on sentence boundary
	const sentenceEnd = text.lastIndexOf('. ', 300)
	if (sentenceEnd > 100) return text.slice(0, sentenceEnd + 1)
	return text.slice(0, 300).trim() + '...'
}

/**
 * Normalize an identifier to a comparable form by stripping file extensions,
 * converting kebab-case and snake_case to lowercase-no-separators.
 * e.g. "disk-cache.ts" | "diskCache" | "disk_cache" → "diskcache"
 */
function normalize(name: string): string {
	return name
		.replace(/\.[tj]sx?$/, '')   // strip .ts/.js/.tsx/.jsx
		.replace(/[-_]/g, '')        // remove dashes and underscores
		.toLowerCase()
}

/**
 * Find a registry entry by normalized name.
 * Returns the canonical registered id, or undefined if no match.
 */
function fuzzyFind(registry: any, input: string): string | undefined {
	// Exact match first
	if (registry.has(input)) return input

	const norm = normalize(input)
	return (registry.available as string[]).find((id: string) => normalize(id) === norm)
}

/**
 * Try to resolve "helperName.memberName" by searching all registries for the helper,
 * then checking if memberName is a method or getter on it.
 * Returns a 'member' target or null if no match.
 */
function resolveHelperMember(helperName: string, memberName: string, container: any): ResolvedTarget | null {
	for (const registryName of REGISTRY_NAMES) {
		const reg = container[registryName]
		if (!reg) continue
		const found = fuzzyFind(reg, helperName)
		if (!found) continue

		const Ctor = reg.lookup(found)
		const introspection = Ctor.introspect?.()
		if (!introspection) continue

		if (introspection.methods?.[memberName]) {
			return { kind: 'member', registry: registryName, id: found, member: memberName, memberType: 'method' }
		}
		if (introspection.getters?.[memberName]) {
			return { kind: 'member', registry: registryName, id: found, member: memberName, memberType: 'getter' }
		}

		// If we found the helper but not the member, give a helpful error
		const allMembers = [
			...Object.keys(introspection.methods || {}).map((m: string) => m + '()'),
			...Object.keys(introspection.getters || {}),
		].sort()
		throw new DescribeError(
			`"${memberName}" is not a known method or getter on ${found}.\n\nAvailable members:\n  ${allMembers.join(', ')}`
		)
	}
	return null
}

/** Find a browser feature by normalized name. */
function fuzzyFindBrowser(input: string): string | undefined {
	if (!_browserData) return undefined
	const norm = normalize(input)
	return _browserData.available.find(id => normalize(id) === norm)
}

/** Try to resolve "browserHelper.member" for browser features. */
function resolveBrowserHelperMember(helperName: string, memberName: string): ResolvedTarget | null {
	if (!_browserData) return null
	const found = fuzzyFindBrowser(helperName)
	if (!found) return null

	const data = _browserData.introspection.get(`features.${found}`)
	if (!data) return null

	if (data.methods?.[memberName]) {
		return { kind: 'browser-member', id: found, member: memberName, memberType: 'method' }
	}
	if (data.getters?.[memberName]) {
		return { kind: 'browser-member', id: found, member: memberName, memberType: 'getter' }
	}

	const allMembers = [
		...Object.keys(data.methods || {}).map((m: string) => m + '()'),
		...Object.keys(data.getters || {}),
	].sort()
	throw new DescribeError(
		`"${memberName}" is not a known method or getter on ${found} (browser).\n\nAvailable members:\n  ${allMembers.join(', ')}`
	)
}

/**
 * Parse a single target string into a resolved target.
 * Accepts: "container", "features", "features.fs", "fs", "ui.banner", etc.
 */
function resolveTarget(target: string, container: any, platform: Platform): ResolvedTarget[] {
	const lower = target.toLowerCase()
	const includeNode = shouldIncludeNode(platform)
	const includeBrowser = shouldIncludeBrowser(platform)

	// "container" or "self"
	if (lower === 'container' || lower === 'self') {
		return [{ kind: 'container' }]
	}

	// Registry name: "features", "clients", "servers", "commands", "endpoints"
	const registryMatch = REGISTRY_NAMES.find(
		(r) => r === lower || r === lower + 's' || r.replace(/s$/, '') === lower
	)
	if (registryMatch && !target.includes('.')) {
		return [{ kind: 'registry', name: registryMatch }]
	}

	// Qualified name: "features.fs", "clients.rest", etc.
	if (target.includes('.')) {
		const [prefix, ...rest] = target.split('.')
		const id = rest.join('.')
		const registry = REGISTRY_NAMES.find(
			(r) => r === prefix!.toLowerCase() || r === prefix!.toLowerCase() + 's' || r.replace(/s$/, '') === prefix!.toLowerCase()
		)

		if (registry) {
			const results: ResolvedTarget[] = []

			if (includeNode) {
				const reg = container[registry]
				const resolved = fuzzyFind(reg, id)
				if (resolved) results.push({ kind: 'helper', registry, id: resolved })
			}

			if (includeBrowser && registry === 'features') {
				const browserFound = fuzzyFindBrowser(id)
				if (browserFound) results.push({ kind: 'browser-helper', id: browserFound })
			}

			if (results.length === 0) {
				const reg = container[registry]
				const availableMsg = includeNode ? reg.available.join(', ') : ''
				const browserMsg = includeBrowser && _browserData ? _browserData.available.join(', ') : ''
				const combined = [availableMsg, browserMsg].filter(Boolean).join(', ')
				throw new DescribeError(`"${id}" is not registered in ${registry}. Available: ${combined}`)
			}

			return results
		}

		// Not a registry prefix — try "helper.member" (e.g. "ui.banner", "fs.readFile")
		const helperName = prefix!
		const memberName = rest.join('.')
		const results: ResolvedTarget[] = []

		if (includeNode) {
			const memberResult = resolveHelperMember(helperName, memberName, container)
			if (memberResult) results.push(memberResult)
		}

		if (includeBrowser) {
			try {
				const browserResult = resolveBrowserHelperMember(helperName, memberName)
				if (browserResult) results.push(browserResult)
			} catch (e) {
				if (results.length === 0) throw e
			}
		}

		if (results.length > 0) return results
	}

	// Unqualified name: search all registries (fuzzy) + browser features
	const matches: ResolvedTarget[] = []

	if (includeNode) {
		for (const registryName of REGISTRY_NAMES) {
			const reg = container[registryName]
			if (!reg) continue
			const found = fuzzyFind(reg, target)
			if (found) {
				matches.push({ kind: 'helper', registry: registryName, id: found })
			}
		}
	}

	if (includeBrowser) {
		const browserFound = fuzzyFindBrowser(target)
		if (browserFound) {
			// If there's already a node feature with the same id, include both
			matches.push({ kind: 'browser-helper', id: browserFound })
		}
	}

	if (matches.length === 0) {
		const lines = [`"${target}" was not found in any registry.`, '', 'Available:']
		if (includeNode) {
			for (const registryName of REGISTRY_NAMES) {
				const reg = container[registryName]
				if (reg && reg.available.length > 0) {
					lines.push(`  ${registryName}: ${reg.available.join(', ')}`)
				}
			}
		}
		if (includeBrowser && _browserData && _browserData.available.length > 0) {
			lines.push(`  browser features: ${_browserData.available.join(', ')}`)
		}
		throw new DescribeError(lines.join('\n'))
	}

	// For unqualified names with a single node match and no browser match (or vice versa), return as-is
	// For ambiguous node matches (multiple registries), report ambiguity
	const nodeMatches = matches.filter(m => m.kind === 'helper')
	if (nodeMatches.length > 1) {
		const lines = [`"${target}" is ambiguous — found in multiple registries:`]
		for (const m of nodeMatches) {
			if (m.kind === 'helper') lines.push(`  ${m.registry}.${m.id}`)
		}
		lines.push('', `Please qualify it, e.g.: ${(nodeMatches[0] as any).registry}.${target}`)
		throw new DescribeError(lines.join('\n'))
	}

	return matches
}

/** Collect all requested sections from flags. Empty array = show everything. */
function getSections(options: z.infer<typeof argsSchema>): (IntrospectionSection | 'description')[] {
	const sections: (IntrospectionSection | 'description')[] = []
	for (const [flag, section] of Object.entries(SECTION_FLAGS)) {
		if ((options as any)[flag] && !sections.includes(section)) {
			sections.push(section)
		}
	}
	return sections
}

/**
 * Build the title header for a helper. Includes className when available.
 * headingDepth controls the markdown heading level (1 = #, 2 = ##, etc.)
 */
function renderTitle(Ctor: any, headingDepth = 1): string {
	const data = Ctor.introspect?.()
	const id = data?.id || Ctor.shortcut || Ctor.name
	const className = data?.className || Ctor.name
	const h = '#'.repeat(headingDepth)
	return className ? `${h} ${className} (${id})` : `${h} ${id}`
}

/**
 * Render text output for a helper given requested sections.
 * When sections is empty, renders everything. When sections are specified,
 * renders only those sections (calling introspectAsText per section and concatenating).
 * 'description' is handled specially as the description paragraph (title is always included).
 * Pass noTitle to suppress the title header.
 * headingDepth controls the starting heading level (1 = #, 2 = ##, etc.)
 */
function renderHelperText(Ctor: any, sections: (IntrospectionSection | 'description')[], noTitle = false, headingDepth = 1): string {
	if (sections.length === 0) {
		if (noTitle) {
			// Render everything except the title
			const data = Ctor.introspect?.()
			if (!data) return 'No introspection data available.'
			const parts: string[] = [data.description]
			const text = Ctor.introspectAsText?.(headingDepth)
			if (text) {
				// Strip the first heading + description block that introspectAsText renders
				const lines = text.split('\n')
				const headingPrefix = '#'.repeat(headingDepth + 1) + ' '
				let startIdx = 0
				for (let i = 0; i < lines.length; i++) {
					if (i > 0 && lines[i]!.startsWith(headingPrefix)) {
						startIdx = i
						break
					}
				}
				if (startIdx > 0) {
					parts.length = 0
					parts.push(data.description)
					parts.push(lines.slice(startIdx).join('\n'))
				}
			}
			return parts.join('\n\n')
		}
		return Ctor.introspectAsText?.(headingDepth) ?? `${renderTitle(Ctor, headingDepth)}\n\nNo introspection data available.`
	}

	const introspectionSections = sections.filter((s): s is IntrospectionSection => s !== 'description')
	const parts: string[] = []

	// Always include the title and description unless noTitle
	if (!noTitle) {
		const data = Ctor.introspect?.()
		parts.push(renderTitle(Ctor, headingDepth))
		if (data?.description) {
			parts.push(data.description)
		}
	}

	for (const section of introspectionSections) {
		const text = Ctor.introspectAsText?.(section, headingDepth)
		if (text) parts.push(text)
	}

	return parts.join('\n\n') || `${noTitle ? '' : renderTitle(Ctor, headingDepth) + '\n\n'}No introspection data available.`
}

function renderHelperJson(Ctor: any, sections: (IntrospectionSection | 'description')[], noTitle = false): any {
	if (sections.length === 0) {
		return Ctor.introspect?.() ?? {}
	}

	const data = Ctor.introspect?.() ?? {}
	const result: Record<string, any> = {}

	// Always include id and className in JSON unless noTitle
	if (!noTitle) {
		result.id = data.id
		if (data.className) result.className = data.className
	}

	for (const section of sections) {
		if (section === 'description') {
			result.id = data.id
			if (data.className) result.className = data.className
			result.description = data.description
		} else if (section === 'usage') {
			// Usage is a derived section — include shortcut and options as its JSON form
			result.usage = { shortcut: data.shortcut, options: data.options }
		} else {
			const sectionData = Ctor.introspect?.(section)
			if (sectionData) {
				result[section] = sectionData[section]
			}
		}
	}

	return result
}

function getContainerData(container: any, sections: (IntrospectionSection | 'description')[], noTitle = false, headingDepth = 1): { json: any; text: string } {
	if (sections.length === 0) {
		const data = container.inspect()
		return { json: data, text: container.inspectAsText(undefined, headingDepth) }
	}

	const data = container.inspect()
	const introspectionSections = sections.filter((s): s is IntrospectionSection => s !== 'description')
	const textParts: string[] = []
	const jsonResult: Record<string, any> = {}
	const h = '#'.repeat(headingDepth)

	// Always include container title and description unless noTitle
	if (!noTitle) {
		const className = data.className || 'Container'
		textParts.push(`${h} ${className} (Container)`)
		jsonResult.className = className
		if (data.description) {
			textParts.push(data.description)
			jsonResult.description = data.description
		}
	}

	for (const section of introspectionSections) {
		textParts.push(container.inspectAsText(section, headingDepth))
		jsonResult[section] = data[section]
	}

	return {
		json: jsonResult,
		text: textParts.join('\n\n'),
	}
}

/**
 * Walk the prototype chain of a base class to collect shared methods and getters.
 * These are the methods/getters inherited by all helpers in a registry.
 */
function collectSharedMembers(baseClass: any): { methods: string[]; getters: string[] } {
	const methods: string[] = []
	const getters: string[] = []

	let proto = baseClass?.prototype
	while (proto && proto.constructor.name !== 'Object') {
		for (const k of Object.getOwnPropertyNames(proto)) {
			if (k === 'constructor' || k.startsWith('_')) continue
			const desc = Object.getOwnPropertyDescriptor(proto, k)
			if (!desc) continue
			if (desc.get && !getters.includes(k)) getters.push(k)
			else if (typeof desc.value === 'function' && !methods.includes(k)) methods.push(k)
		}
		proto = Object.getPrototypeOf(proto)
	}

	return { methods: methods.sort(), getters: getters.sort() }
}

/**
 * Find the intermediate parent class between a helper constructor and the registry's
 * base class (e.g. RestClient between ElevenLabsClient and Client).
 * Returns the intermediate class constructor, or null if the helper extends the base directly.
 */
function findIntermediateParent(Ctor: any, baseClass: any): { name: string; methods: string[]; getters: string[] } | null {
	if (!baseClass) return null

	// Walk up from Ctor's parent to find the chain
	let parent = Object.getPrototypeOf(Ctor)
	if (!parent || parent === baseClass) return null

	// Check if the parent itself is a direct child of baseClass (i.e., 2nd level)
	// We want to find the class between Ctor and baseClass
	const chain: any[] = []
	let current = parent
	while (current && current !== baseClass && current !== Function.prototype) {
		chain.push(current)
		current = Object.getPrototypeOf(current)
	}

	// If the chain is empty or parent IS the baseClass, no intermediate
	if (chain.length === 0 || current !== baseClass) return null

	// The first entry in the chain is the direct parent of Ctor — that's our intermediate
	const intermediate = chain[0]
	const methods: string[] = []
	const getters: string[] = []

	// Collect only the methods/getters defined directly on the intermediate class
	const proto = intermediate?.prototype
	if (proto) {
		for (const k of Object.getOwnPropertyNames(proto)) {
			if (k === 'constructor' || k.startsWith('_')) continue
			const desc = Object.getOwnPropertyDescriptor(proto, k)
			if (!desc) continue
			if (desc.get && !getters.includes(k)) getters.push(k)
			else if (typeof desc.value === 'function' && !methods.includes(k)) methods.push(k)
		}
	}

	return {
		name: intermediate.name,
		methods: methods.sort(),
		getters: getters.sort(),
	}
}

function getRegistryData(container: any, registryName: RegistryName, sections: (IntrospectionSection | 'description')[], noTitle = false, headingDepth = 1, platform: Platform = 'all'): { json: any; text: string } {
	const includeNode = shouldIncludeNode(platform)
	const includeBrowser = shouldIncludeBrowser(platform) && registryName === 'features' && _browserData

	const registry = container[registryName]
	const nodeAvailable: string[] = includeNode ? registry.available : []
	const browserAvailable: string[] = includeBrowser ? _browserData!.available : []

	// Deduplicate: for --platform all, colliding features appear in both lists
	const collidingIds = includeBrowser ? _browserData!.collidingIds : new Set<string>()

	const totalCount = nodeAvailable.length + browserAvailable.filter(id => !includeNode || !collidingIds.has(id)).length

	if (totalCount === 0) {
		return { json: {}, text: `No ${registryName} are registered.` }
	}

	// When no section filters are specified, render a concise index
	if (sections.length === 0) {
		const h = '#'.repeat(headingDepth)
		const hSub = '#'.repeat(headingDepth + 1)
		const jsonResult: Record<string, any> = {}
		const textParts: string[] = [`${h} Available ${registryName} (${totalCount})\n`]

		// Show shared methods/getters from the base class at the top
		if (includeNode) {
			const baseClass = registry.baseClass
			if (baseClass) {
				const shared = collectSharedMembers(baseClass)
				const label = registryName === 'features' ? 'Feature'
					: registryName === 'clients' ? 'Client'
					: registryName === 'servers' ? 'Server'
					: registryName[0]!.toUpperCase() + registryName.slice(1).replace(/s$/, '')

				if (shared.getters.length) {
					textParts.push(`**Shared ${label} Getters:** ${shared.getters.join(', ')}\n`)
				}
				if (shared.methods.length) {
					textParts.push(`**Shared ${label} Methods:** ${shared.methods.map(m => m + '()').join(', ')}\n`)
				}

				jsonResult._shared = { methods: shared.methods, getters: shared.getters }
			}
		}

		// Render node features
		if (includeNode) {
			const baseClass = registry.baseClass
			const sorted = [...nodeAvailable].sort((a, b) => {
				const aCtor = registry.lookup(a)
				const bCtor = registry.lookup(b)
				const aIsDirect = !findIntermediateParent(aCtor, baseClass)
				const bIsDirect = !findIntermediateParent(bCtor, baseClass)
				if (aIsDirect && !bIsDirect) return -1
				if (!aIsDirect && bIsDirect) return 1
				return 0
			})

			for (const id of sorted) {
				const Ctor = registry.lookup(id)
				const introspection = Ctor.introspect?.()
				const description = introspection?.description || Ctor.description || 'No description provided'
				const summary = extractSummary(description)
				const featureGetters = Object.keys(introspection?.getters || {}).sort()
				const featureMethods = Object.keys(introspection?.methods || {}).sort()
				const intermediate = findIntermediateParent(Ctor, baseClass)

				// Tag colliding features with (node) when showing both platforms
				const platformTag = includeBrowser && collidingIds.has(id) ? ' (node)' : ''

				const entryJson: Record<string, any> = { description: summary, methods: featureMethods, getters: featureGetters }
				if (intermediate) {
					entryJson.extends = intermediate.name
					entryJson.inheritedMethods = intermediate.methods
					entryJson.inheritedGetters = intermediate.getters
				}
				if (platformTag) entryJson.platform = 'node'
				jsonResult[id + (platformTag ? ':node' : '')] = entryJson

				const extendsLine = intermediate ? `\n> extends ${intermediate.name}\n` : ''
				const memberLines: string[] = []
				if (featureGetters.length) memberLines.push(`  getters: ${featureGetters.join(', ')}`)
				if (featureMethods.length) memberLines.push(`  methods: ${featureMethods.map(m => m + '()').join(', ')}`)
				if (intermediate) {
					if (intermediate.getters.length) memberLines.push(`  inherited getters: ${intermediate.getters.join(', ')}`)
					if (intermediate.methods.length) memberLines.push(`  inherited methods: ${intermediate.methods.map(m => m + '()').join(', ')}`)
				}
				const memberBlock = memberLines.length ? '\n' + memberLines.join('\n') + '\n' : ''
				textParts.push(`${hSub} ${id}${platformTag}${extendsLine}\n${summary}\n${memberBlock}`)
			}
		}

		// Render browser features
		if (includeBrowser) {
			for (const id of browserAvailable.sort()) {
				// Skip if already shown as a node feature and platform is not specifically browser
				if (includeNode && collidingIds.has(id)) {
					// Show the browser version too, tagged
					const data = _browserData!.introspection.get(`features.${id}`)
					if (!data) continue
					const summary = extractSummary(data.description || 'No description provided')
					const featureGetters = Object.keys(data.getters || {}).sort()
					const featureMethods = Object.keys(data.methods || {}).sort()

					jsonResult[id + ':browser'] = { description: summary, methods: featureMethods, getters: featureGetters, platform: 'browser' }

					const memberLines: string[] = []
					if (featureGetters.length) memberLines.push(`  getters: ${featureGetters.join(', ')}`)
					if (featureMethods.length) memberLines.push(`  methods: ${featureMethods.map(m => m + '()').join(', ')}`)
					const memberBlock = memberLines.length ? '\n' + memberLines.join('\n') + '\n' : ''
					textParts.push(`${hSub} ${id} (browser)\n${summary}\n${memberBlock}`)
					continue
				}

				const data = _browserData!.introspection.get(`features.${id}`)
				if (!data) continue
				const summary = extractSummary(data.description || 'No description provided')
				const featureGetters = Object.keys(data.getters || {}).sort()
				const featureMethods = Object.keys(data.methods || {}).sort()

				const platformTag = !includeNode ? '' : ' (browser)'
				jsonResult[id] = { description: summary, methods: featureMethods, getters: featureGetters, platform: 'browser' }

				const memberLines: string[] = []
				if (featureGetters.length) memberLines.push(`  getters: ${featureGetters.join(', ')}`)
				if (featureMethods.length) memberLines.push(`  methods: ${featureMethods.map(m => m + '()').join(', ')}`)
				const memberBlock = memberLines.length ? '\n' + memberLines.join('\n') + '\n' : ''
				textParts.push(`${hSub} ${id}${platformTag}\n${summary}\n${memberBlock}`)
			}
		}

		return { json: jsonResult, text: textParts.join('\n') }
	}

	// When specific sections are requested, render full detail for each helper
	const jsonResult: Record<string, any> = {}
	const textParts: string[] = []

	if (includeNode) {
		for (const id of nodeAvailable) {
			const Ctor = registry.lookup(id)
			jsonResult[id] = renderHelperJson(Ctor, sections, noTitle)
			textParts.push(renderHelperText(Ctor, sections, noTitle, headingDepth))
		}
	}

	if (includeBrowser) {
		for (const id of browserAvailable) {
			if (includeNode && collidingIds.has(id)) continue // already shown
			const data = _browserData!.introspection.get(`features.${id}`)
			if (!data) continue
			jsonResult[id] = renderBrowserHelperJson(data, sections, noTitle)
			textParts.push(renderBrowserHelperText(data, sections, noTitle, headingDepth))
		}
	}

	return { json: jsonResult, text: textParts.join('\n\n---\n\n') }
}

/** Known top-level helper base class names — anything above these is "shared" */
const BASE_CLASS_NAMES = new Set(['Helper', 'Feature', 'Client', 'Server'])

/**
 * Build a concise summary block for an individual helper listing its interface at a glance.
 * Shows extends line if there's an intermediate parent, then own methods/getters,
 * then inherited methods/getters from the intermediate parent.
 */
function buildHelperSummary(Ctor: any): string {
	const introspection = Ctor.introspect?.()
	const ownMethods = Object.keys(introspection?.methods || {}).sort()
	const ownGetters = Object.keys(introspection?.getters || {}).sort()

	// Walk up the prototype chain to find an intermediate parent
	const chain: any[] = []
	let current = Object.getPrototypeOf(Ctor)
	while (current && current.name && !BASE_CLASS_NAMES.has(current.name) && current !== Function.prototype) {
		chain.push(current)
		current = Object.getPrototypeOf(current)
	}

	const lines: string[] = []

	if (chain.length > 0) {
		lines.push(`> extends ${chain[0].name}`)
	}

	if (ownGetters.length) lines.push(`getters: ${ownGetters.join(', ')}`)
	if (ownMethods.length) lines.push(`methods: ${ownMethods.map(m => m + '()').join(', ')}`)

	// Collect inherited members from intermediate parent(s)
	for (const parent of chain) {
		const parentIntrospection = parent.introspect?.()
		const inheritedMethods = Object.keys(parentIntrospection?.methods || {}).sort()
		const inheritedGetters = Object.keys(parentIntrospection?.getters || {}).sort()
		if (inheritedGetters.length) lines.push(`inherited getters (${parent.name}): ${inheritedGetters.join(', ')}`)
		if (inheritedMethods.length) lines.push(`inherited methods (${parent.name}): ${inheritedMethods.map(m => m + '()').join(', ')}`)
	}

	return lines.join('\n')
}

function getMemberData(container: any, registryName: RegistryName, id: string, member: string, memberType: 'method' | 'getter', headingDepth = 1): { json: any; text: string } {
	const registry = container[registryName]
	const Ctor = registry.lookup(id)
	const introspection = Ctor.introspect?.()
	const h = '#'.repeat(headingDepth)
	const hSub = '#'.repeat(headingDepth + 1)

	if (memberType === 'method') {
		const method = introspection?.methods?.[member] as MethodIntrospection | undefined
		if (!method) return { json: {}, text: `No introspection data for ${id}.${member}()` }

		const parts: string[] = []
		parts.push(`${h} ${id}.${member}()`)
		parts.push(`> method on **${introspection.className || id}**`)

		if (method.description) parts.push(method.description)

		// Parameters
		const paramEntries = Object.entries(method.parameters || {})
		if (paramEntries.length > 0) {
			const paramLines = [`${hSub} Parameters`, '']
			for (const [name, info] of paramEntries) {
				const req = (method.required || []).includes(name) ? ' *(required)*' : ''
				paramLines.push(`- **${name}** \`${info.type}\`${req}${info.description ? ' — ' + info.description : ''}`)
				// Nested properties (e.g. options objects)
				if (info.properties) {
					for (const [propName, propInfo] of Object.entries(info.properties)) {
						paramLines.push(`  - **${propName}** \`${propInfo.type}\`${propInfo.description ? ' — ' + propInfo.description : ''}`)
					}
				}
			}
			parts.push(paramLines.join('\n'))
		}

		// Returns
		if (method.returns && method.returns !== 'void') {
			parts.push(`${hSub} Returns\n\n\`${method.returns}\``)
		}

		// Examples
		if (method.examples?.length) {
			parts.push(`${hSub} Examples`)
			for (const ex of method.examples) {
				parts.push(`\`\`\`${ex.language || 'typescript'}\n${ex.code}\n\`\`\``)
			}
		}

		return { json: { [member]: method, _helper: id, _type: 'method' }, text: parts.join('\n\n') }
	}

	// Getter
	const getter = introspection?.getters?.[member] as GetterIntrospection | undefined
	if (!getter) return { json: {}, text: `No introspection data for ${id}.${member}` }

	const parts: string[] = []
	parts.push(`${h} ${id}.${member}`)
	parts.push(`> getter on **${introspection.className || id}** — returns \`${getter.returns || 'unknown'}\``)

	if (getter.description) parts.push(getter.description)

	if (getter.examples?.length) {
		parts.push(`${hSub} Examples`)
		for (const ex of getter.examples) {
			parts.push(`\`\`\`${ex.language || 'typescript'}\n${ex.code}\n\`\`\``)
		}
	}

	return { json: { [member]: getter, _helper: id, _type: 'getter' }, text: parts.join('\n\n') }
}

function getHelperData(container: any, registryName: RegistryName, id: string, sections: (IntrospectionSection | 'description')[], noTitle = false, headingDepth = 1): { json: any; text: string } {
	const registry = container[registryName]
	const Ctor = registry.lookup(id)
	const text = renderHelperText(Ctor, sections, noTitle, headingDepth)

	// Inject summary after the title + description block for full (no-section) renders
	let finalText = text
	if (sections.length === 0 && !noTitle) {
		const summary = buildHelperSummary(Ctor)
		if (summary) {
			// Find the first ## heading and insert the summary before it
			const sectionHeading = '#'.repeat(headingDepth + 1) + ' '
			const idx = text.indexOf('\n' + sectionHeading)
			if (idx >= 0) {
				finalText = text.slice(0, idx) + '\n\n' + summary + '\n' + text.slice(idx)
			}
		}
	}

	return {
		json: renderHelperJson(Ctor, sections, noTitle),
		text: finalText,
	}
}

export default async function describe(options: z.infer<typeof argsSchema>, context: ContainerContext) {
	const container = context.container as any

	await container.helpers.discoverAll()

	const platform = normalizePlatform(options.platform)

	// Load browser features if needed
	if (shouldIncludeBrowser(platform)) {
		await loadBrowserFeatures()
	}

	const args = container.argv._ as string[]
	// args[0] is "describe", the rest are targets
	const targets = args.slice(1)
	const json = options.json
	const pretty = options.pretty
	const noTitle = !options.title
	const sections = getSections(options)

	function output(text: string) {
		if (pretty) {
			const ui = container.feature('ui')
			console.log(ui.markdown(text))
		} else {
			console.log(text)
		}
	}

	// No targets: show help screen
	if (targets.length === 0) {
		const { formatCommandHelp } = await import('./help.js')
		const ui = container.feature('ui') as any
		const Cmd = container.commands.lookup('describe')
		console.log(formatCommandHelp('describe', Cmd, ui.colors))
		return
	}

	const resolved: ResolvedTarget[] = []

	for (const target of targets) {
		try {
			resolved.push(...resolveTarget(target, container, platform))
		} catch (err: any) {
			if (err instanceof DescribeError) {
				console.error(err.message)
				return
			}
			throw err
		}
	}

	// Multiple docs when there are multiple targets or any target is a registry
	const isMulti = resolved.length > 1 || resolved.some((r) => r.kind === 'registry')
	const headingDepth = isMulti ? 2 : 1

	function getData(item: ResolvedTarget) {
		switch (item.kind) {
			case 'container':
				return getContainerData(container, sections, noTitle, headingDepth)
			case 'registry':
				return getRegistryData(container, item.name, sections, noTitle, headingDepth, platform)
			case 'helper':
				return getHelperData(container, item.registry, item.id, sections, noTitle, headingDepth)
			case 'member':
				return getMemberData(container, item.registry, item.id, item.member, item.memberType, headingDepth)
			case 'browser-helper':
				return getBrowserHelperData(item.id, sections, noTitle, headingDepth)
			case 'browser-member':
				return getBrowserMemberData(item.id, item.member, item.memberType, headingDepth)
		}
	}

	if (json) {
		if (resolved.length === 1) {
			console.log(JSON.stringify(getData(resolved[0]!).json, null, 2))
		} else {
			const combined = resolved.map((item) => getData(item).json)
			console.log(JSON.stringify(combined, null, 2))
		}
	} else {
		const parts = resolved.map((item) => getData(item).text)
		const body = parts.join('\n\n---\n\n')
		if (isMulti) {
			output(`# Luca Helper Descriptions\n\nBelow you'll find documentation.\n\n${body}`)
		} else {
			output(body)
		}
	}
}

commands.registerHandler('describe', {
	description: 'Describe the container, registries, or individual helpers',
	argsSchema,
	handler: describe,
})
