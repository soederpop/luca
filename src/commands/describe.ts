import { z } from 'zod'
import { commands } from '../command.js'
import { CommandOptionsSchema } from '../schemas/base.js'
import type { ContainerContext } from '../container.js'
import type { IntrospectionSection } from '../introspection/index.js'

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
})

type ResolvedTarget =
	| { kind: 'container' }
	| { kind: 'registry'; name: RegistryName }
	| { kind: 'helper'; registry: RegistryName; id: string }

class DescribeError extends Error {
	constructor(message: string) {
		super(message)
		this.name = 'DescribeError'
	}
}

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
 * Parse a single target string into a resolved target.
 * Accepts: "container", "features", "features.fs", "fs", etc.
 */
function resolveTarget(target: string, container: any): ResolvedTarget {
	const lower = target.toLowerCase()

	// "container" or "self"
	if (lower === 'container' || lower === 'self') {
		return { kind: 'container' }
	}

	// Registry name: "features", "clients", "servers", "commands", "endpoints"
	const registryMatch = REGISTRY_NAMES.find(
		(r) => r === lower || r === lower + 's' || r.replace(/s$/, '') === lower
	)
	if (registryMatch && !target.includes('.')) {
		return { kind: 'registry', name: registryMatch }
	}

	// Qualified name: "features.fs", "clients.rest", etc.
	if (target.includes('.')) {
		const [prefix, ...rest] = target.split('.')
		const id = rest.join('.')
		const registry = REGISTRY_NAMES.find(
			(r) => r === prefix!.toLowerCase() || r === prefix!.toLowerCase() + 's' || r.replace(/s$/, '') === prefix!.toLowerCase()
		)

		if (registry) {
			const reg = container[registry]
			const resolved = fuzzyFind(reg, id)
			if (!resolved) {
				throw new DescribeError(`"${id}" is not registered in ${registry}. Available: ${reg.available.join(', ')}`)
			}
			return { kind: 'helper', registry, id: resolved }
		}
	}

	// Unqualified name: search all registries (fuzzy)
	const matches: { registry: RegistryName; id: string }[] = []
	for (const registryName of REGISTRY_NAMES) {
		const reg = container[registryName]
		if (!reg) continue
		const found = fuzzyFind(reg, target)
		if (found) {
			matches.push({ registry: registryName, id: found })
		}
	}

	if (matches.length === 0) {
		const lines = [`"${target}" was not found in any registry.`, '', 'Available:']
		for (const registryName of REGISTRY_NAMES) {
			const reg = container[registryName]
			if (reg && reg.available.length > 0) {
				lines.push(`  ${registryName}: ${reg.available.join(', ')}`)
			}
		}
		throw new DescribeError(lines.join('\n'))
	}

	if (matches.length > 1) {
		const lines = [`"${target}" is ambiguous — found in multiple registries:`]
		for (const m of matches) {
			lines.push(`  ${m.registry}.${m.id}`)
		}
		lines.push('', `Please qualify it, e.g.: ${matches[0]!.registry}.${target}`)
		throw new DescribeError(lines.join('\n'))
	}

	return { kind: 'helper', registry: matches[0]!.registry, id: matches[0]!.id }
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

function getRegistryData(container: any, registryName: RegistryName, sections: (IntrospectionSection | 'description')[], noTitle = false, headingDepth = 1): { json: any; text: string } {
	const registry = container[registryName]
	const available: string[] = registry.available

	if (available.length === 0) {
		return { json: {}, text: `No ${registryName} are registered.` }
	}

	// When no section filters are specified, render a concise index (like describeAll)
	// rather than full introspection for every single helper
	if (sections.length === 0) {
		const h = '#'.repeat(headingDepth)
		const hSub = '#'.repeat(headingDepth + 1)
		const jsonResult: Record<string, any> = {}
		const textParts: string[] = [`${h} Available ${registryName} (${available.length})\n`]

		// Show shared methods/getters from the base class at the top
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

		for (const id of available) {
			const Ctor = registry.lookup(id)
			const introspection = Ctor.introspect?.()
			const description = introspection?.description || Ctor.description || 'No description provided'
			// Take only the first 1-2 sentences as the summary
			const summary = extractSummary(description)

			const featureGetters = Object.keys(introspection?.getters || {}).sort()
			const featureMethods = Object.keys(introspection?.methods || {}).sort()

			jsonResult[id] = { description: summary, methods: featureMethods, getters: featureGetters }

			const memberLines: string[] = []
			if (featureGetters.length) memberLines.push(`  getters: ${featureGetters.join(', ')}`)
			if (featureMethods.length) memberLines.push(`  methods: ${featureMethods.map(m => m + '()').join(', ')}`)

			const memberBlock = memberLines.length ? '\n' + memberLines.join('\n') + '\n' : ''
			textParts.push(`${hSub} ${id}\n\n${summary}\n${memberBlock}`)
		}

		return { json: jsonResult, text: textParts.join('\n') }
	}

	// When specific sections are requested, render full detail for each helper
	const jsonResult: Record<string, any> = {}
	const textParts: string[] = []
	for (const id of available) {
		const Ctor = registry.lookup(id)
		jsonResult[id] = renderHelperJson(Ctor, sections, noTitle)
		textParts.push(renderHelperText(Ctor, sections, noTitle, headingDepth))
	}

	return { json: jsonResult, text: textParts.join('\n\n---\n\n') }
}

function getHelperData(container: any, registryName: RegistryName, id: string, sections: (IntrospectionSection | 'description')[], noTitle = false, headingDepth = 1): { json: any; text: string } {
	const registry = container[registryName]
	const Ctor = registry.lookup(id)

	return {
		json: renderHelperJson(Ctor, sections, noTitle),
		text: renderHelperText(Ctor, sections, noTitle, headingDepth),
	}
}

export default async function describe(options: z.infer<typeof argsSchema>, context: ContainerContext) {
	const container = context.container as any

	await container.helpers.discoverAll()

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
			resolved.push(resolveTarget(target, container))
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
				return getRegistryData(container, item.name, sections, noTitle, headingDepth)
			case 'helper':
				return getHelperData(container, item.registry, item.id, sections, noTitle, headingDepth)
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
