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

const REGISTRY_NAMES = ['features', 'clients', 'servers', 'commands', 'endpoints'] as const
type RegistryName = (typeof REGISTRY_NAMES)[number]

const SECTION_FLAGS: Record<string, IntrospectionSection> = {
	'only-methods': 'methods',
	'only-getters': 'getters',
	'only-events': 'events',
	'only-state': 'state',
	'only-options': 'options',
	'only-env-vars': 'envVars',
	'only-envvars': 'envVars',
}

export const argsSchema = CommandOptionsSchema.extend({
	json: z.boolean().default(false).describe('Output introspection data as JSON instead of markdown'),
	'only-methods': z.boolean().default(false).describe('Show only the methods section'),
	'only-getters': z.boolean().default(false).describe('Show only the getters section'),
	'only-events': z.boolean().default(false).describe('Show only the events section'),
	'only-state': z.boolean().default(false).describe('Show only the state section'),
	'only-options': z.boolean().default(false).describe('Show only the options section'),
	'only-env-vars': z.boolean().default(false).describe('Show only the envVars section'),
	'only-envvars': z.boolean().default(false).describe('Show only the envVars section'),
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

	// "container"
	if (lower === 'container') {
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

function getSection(options: z.infer<typeof argsSchema>): IntrospectionSection | undefined {
	for (const [flag, section] of Object.entries(SECTION_FLAGS)) {
		if ((options as any)[flag]) return section
	}
	return undefined
}

function getContainerData(container: any, section?: IntrospectionSection): { json: any; text: string } {
	const data = container.inspect()
	return {
		json: section ? { [section]: data[section] } : data,
		text: container.inspectAsText(section),
	}
}

function getRegistryData(container: any, registryName: RegistryName, section?: IntrospectionSection): { json: any; text: string } {
	const registry = container[registryName]
	const available: string[] = registry.available

	if (available.length === 0) {
		return { json: {}, text: `No ${registryName} are registered.` }
	}

	const jsonResult: Record<string, any> = {}
	const textParts: string[] = []
	for (const id of available) {
		const Ctor = registry.lookup(id)
		jsonResult[id] = Ctor.introspect?.(section) ?? {}
		textParts.push(Ctor.introspectAsText?.(section) ?? `# ${id}\n\nNo introspection data available.`)
	}

	return { json: jsonResult, text: textParts.join('\n\n---\n\n') }
}

function getHelperData(container: any, registryName: RegistryName, id: string, section?: IntrospectionSection): { json: any; text: string } {
	const registry = container[registryName]
	const Ctor = registry.lookup(id)

	return {
		json: Ctor.introspect?.(section) ?? {},
		text: Ctor.introspectAsText?.(section) ?? `# ${id}\n\nNo introspection data available.`,
	}
}

export default async function describe(options: z.infer<typeof argsSchema>, context: ContainerContext) {
	const container = context.container as any
	const args = container.argv._ as string[]
	// args[0] is "describe", the rest are targets
	const targets = args.slice(1)
	const json = options.json
	const section = getSection(options)

	// Default: describe the container
	if (targets.length === 0) {
		const data = getContainerData(container, section)
		console.log(json ? JSON.stringify(data.json, null, 2) : data.text)
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

	function getData(item: ResolvedTarget) {
		switch (item.kind) {
			case 'container':
				return getContainerData(container, section)
			case 'registry':
				return getRegistryData(container, item.name, section)
			case 'helper':
				return getHelperData(container, item.registry, item.id, section)
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
		console.log(parts.join('\n\n---\n\n'))
	}
}

commands.registerHandler('describe', {
	description: 'Describe the container, registries, or individual helpers',
	argsSchema,
	handler: describe,
})
