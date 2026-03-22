import type { IntrospectionSection, MethodIntrospection, GetterIntrospection, HelperIntrospection } from './introspection/index.js'
import { presentIntrospectionAsMarkdown } from './helper.js'

type Platform = 'browser' | 'server' | 'node' | 'all'

type ResolvedTarget =
	| { kind: 'container' }
	| { kind: 'registry'; name: string }
	| { kind: 'helper'; registry: string; id: string }
	| { kind: 'member'; registry: string; id: string; member: string; memberType: 'method' | 'getter' }
	| { kind: 'browser-helper'; id: string }
	| { kind: 'browser-member'; id: string; member: string; memberType: 'method' | 'getter' }

type DescribeOptions = {
	sections?: (IntrospectionSection | 'description')[]
	noTitle?: boolean
	headingDepth?: number
	platform?: Platform
}

type DescribeResult = { json: any; text: string }

type BrowserFeatureData = {
	introspection: Map<string, HelperIntrospection>
	constructors: Map<string, any>
	available: string[]
	collidingIds: Set<string>
}

class DescribeError extends Error {
	constructor(message: string) {
		super(message)
		this.name = 'DescribeError'
	}
}

/** Known top-level helper base class names — anything above these is "shared" */
const BASE_CLASS_NAMES = new Set(['Helper', 'Feature', 'Client', 'Server'])

/** Maps flag names to the section they represent. */
const SECTION_FLAGS: Record<string, IntrospectionSection | 'description'> = {
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
	'only-methods': 'methods',
	'only-getters': 'getters',
	'only-events': 'events',
	'only-state': 'state',
	'only-options': 'options',
	'only-env-vars': 'envVars',
	'only-envvars': 'envVars',
	'only-examples': 'examples',
}

/**
 * Encapsulates container introspection and description logic.
 * Discovers registries dynamically from the container's own state —
 * it knows nothing about which helpers exist until it asks the container.
 * Browser feature data can be injected externally via setBrowserData().
 */
export class ContainerDescriber {
	container: any
	private _browserData: BrowserFeatureData | null = null
	private _initialized = false

	constructor(container: any) {
		this.container = container
	}

	/** The registry names this container actually has, discovered at runtime. */
	private get registryNames(): string[] {
		return this.container.registryNames || ['features']
	}

	/**
	 * Discover all helpers. Must be called before resolve/getData.
	 */
	async initialize(): Promise<void> {
		if (this._initialized) return
		await this.container.helpers.discoverAll()
		this._initialized = true
	}

	/**
	 * Inject browser feature data from an external source.
	 * The describer doesn't own browser loading — that's the caller's job.
	 */
	setBrowserData(data: BrowserFeatureData): void {
		this._browserData = data
	}

	/**
	 * High-level: describe one or more targets, returning combined json and text.
	 */
	async describe(targets: string[], options: DescribeOptions = {}): Promise<DescribeResult> {
		const platform = this.normalizePlatform(options.platform || 'all')
		await this.initialize()

		const sections = options.sections || []
		const noTitle = options.noTitle || false

		const resolved: ResolvedTarget[] = []
		for (const target of targets) {
			resolved.push(...this.resolve(target, platform))
		}

		const isMulti = resolved.length > 1 || resolved.some((r) => r.kind === 'registry')
		const headingDepth = options.headingDepth ?? (isMulti ? 2 : 1)

		const results = resolved.map((item) => this.getData(item, { sections, noTitle, headingDepth, platform }))

		if (resolved.length === 1) {
			return results[0]!
		}

		return {
			json: results.map((r) => r.json),
			text: `# Luca Helper Descriptions\n\nBelow you'll find documentation.\n\n${results.map((r) => r.text).join('\n\n---\n\n')}`,
		}
	}

	/**
	 * Describe the container itself.
	 */
	async describeContainer(options: DescribeOptions = {}): Promise<DescribeResult> {
		await this.initialize()
		return this.getContainerData(options.sections || [], options.noTitle || false, options.headingDepth || 1)
	}

	/**
	 * Describe a registry by name.
	 */
	async describeRegistry(registryName: string, options: DescribeOptions = {}): Promise<DescribeResult> {
		const platform = this.normalizePlatform(options.platform || 'all')
		await this.initialize()
		const name = this.matchRegistryName(registryName)
		if (!name) throw new DescribeError(`Unknown registry: ${registryName}. Available: ${this.registryNames.join(', ')}`)
		return this.getRegistryData(name, options.sections || [], options.noTitle || false, options.headingDepth || 1, platform)
	}

	/**
	 * Describe a specific helper by name (qualified or unqualified).
	 */
	async describeHelper(target: string, options: DescribeOptions = {}): Promise<DescribeResult> {
		const platform = this.normalizePlatform(options.platform || 'all')
		await this.initialize()

		const resolved = this.resolve(target, platform)
		if (resolved.length === 0) throw new DescribeError(`Could not resolve: ${target}`)

		const headingDepth = options.headingDepth ?? (resolved.length > 1 ? 2 : 1)
		const results = resolved.map((item) => this.getData(item, { ...options, headingDepth, platform }))

		if (results.length === 1) return results[0]!
		return {
			json: results.map((r) => r.json),
			text: results.map((r) => r.text).join('\n\n---\n\n'),
		}
	}

	/**
	 * Describe a specific member (method or getter) on a helper.
	 */
	async describeMember(helperAndMember: string, options: DescribeOptions = {}): Promise<DescribeResult> {
		return this.describeHelper(helperAndMember, options)
	}

	/**
	 * Collect sections from a flags object (as produced by the CLI args schema).
	 */
	static getSectionsFromFlags(flags: Record<string, any>): (IntrospectionSection | 'description')[] {
		const sections: (IntrospectionSection | 'description')[] = []
		for (const [flag, section] of Object.entries(SECTION_FLAGS)) {
			if (flags[flag] && !sections.includes(section)) {
				sections.push(section)
			}
		}
		return sections
	}

	/**
	 * Generate tool definitions suitable for use with AI assistant tool-calling interfaces.
	 * Registry names in the enum are populated dynamically from the container.
	 */
	toTools(): Array<{ name: string; description: string; parameters: Record<string, any>; execute: (args: any) => Promise<string> }> {
		const registryEnum = this.registryNames

		return [
			{
				name: 'describe_container',
				description: 'Describe the container itself — its class, registries, and configuration.',
				parameters: {
					type: 'object',
					properties: {
						sections: {
							type: 'array',
							items: { type: 'string', enum: ['description', 'usage', 'methods', 'getters', 'events', 'state', 'options', 'envVars', 'examples'] },
							description: 'Which sections to include. Omit for all.',
						},
					},
					required: [],
				},
				execute: async (args: any) => {
					const result = await this.describeContainer({ sections: args.sections })
					return result.text
				},
			},
			{
				name: 'describe_registry',
				description: `List all helpers in a registry with concise summaries. Available registries: ${registryEnum.join(', ')}`,
				parameters: {
					type: 'object',
					properties: {
						registry: {
							type: 'string',
							enum: registryEnum,
							description: 'Which registry to describe.',
						},
						platform: {
							type: 'string',
							enum: ['browser', 'server', 'all'],
							description: 'Filter by platform. Defaults to all.',
						},
						sections: {
							type: 'array',
							items: { type: 'string', enum: ['description', 'usage', 'methods', 'getters', 'events', 'state', 'options', 'envVars', 'examples'] },
							description: 'Which sections to include per helper. Omit for concise index.',
						},
					},
					required: ['registry'],
				},
				execute: async (args: any) => {
					const result = await this.describeRegistry(args.registry, {
						sections: args.sections,
						platform: args.platform,
					})
					return result.text
				},
			},
			{
				name: 'describe_helper',
				description: 'Describe a specific helper by name. Supports qualified names like "features.fs" or unqualified like "fs". Also supports member access like "fs.readFile" or "ui.banner".',
				parameters: {
					type: 'object',
					properties: {
						target: {
							type: 'string',
							description: 'The helper to describe. Examples: "fs", "features.fs", "fs.readFile", "ui.banner"',
						},
						platform: {
							type: 'string',
							enum: ['browser', 'server', 'all'],
							description: 'Filter by platform. Defaults to all.',
						},
						sections: {
							type: 'array',
							items: { type: 'string', enum: ['description', 'usage', 'methods', 'getters', 'events', 'state', 'options', 'envVars', 'examples'] },
							description: 'Which sections to include. Omit for all.',
						},
					},
					required: ['target'],
				},
				execute: async (args: any) => {
					const result = await this.describeHelper(args.target, {
						sections: args.sections,
						platform: args.platform,
					})
					return result.text
				},
			},
		]
	}

	// --- Resolution ---

	/**
	 * Parse a target string into one or more resolved targets.
	 */
	resolve(target: string, platform: Platform = 'all'): ResolvedTarget[] {
		const lower = target.toLowerCase()
		const includeNode = this.shouldIncludeNode(platform)
		const includeBrowser = this.shouldIncludeBrowser(platform)

		if (lower === 'container' || lower === 'self') {
			return [{ kind: 'container' }]
		}

		// Check if it matches a registry name
		const registryMatch = this.matchRegistryName(target)
		if (registryMatch && !target.includes('.')) {
			return [{ kind: 'registry', name: registryMatch }]
		}

		if (target.includes('.')) {
			const [prefix, ...rest] = target.split('.')
			const id = rest.join('.')
			const registry = this.matchRegistryName(prefix!)

			if (registry) {
				const results: ResolvedTarget[] = []

				if (includeNode) {
					const reg = this.container[registry]
					const resolved = this.fuzzyFind(reg, id)
					if (resolved) results.push({ kind: 'helper', registry, id: resolved })
				}

				if (includeBrowser && registry === 'features') {
					const browserFound = this.fuzzyFindBrowser(id)
					if (browserFound) results.push({ kind: 'browser-helper', id: browserFound })
				}

				if (results.length === 0) {
					const reg = this.container[registry]
					const availableMsg = includeNode ? reg.available.join(', ') : ''
					const browserMsg = includeBrowser && this._browserData ? this._browserData.available.join(', ') : ''
					const combined = [availableMsg, browserMsg].filter(Boolean).join(', ')
					throw new DescribeError(`"${id}" is not registered in ${registry}. Available: ${combined}`)
				}

				return results
			}

			// Not a registry prefix — try "helper.member"
			const helperName = prefix!
			const memberName = rest.join('.')
			const results: ResolvedTarget[] = []

			if (includeNode) {
				const memberResult = this.resolveHelperMember(helperName, memberName)
				if (memberResult) results.push(memberResult)
			}

			if (includeBrowser) {
				try {
					const browserResult = this.resolveBrowserHelperMember(helperName, memberName)
					if (browserResult) results.push(browserResult)
				} catch (e) {
					if (results.length === 0) throw e
				}
			}

			if (results.length > 0) return results
		}

		// Unqualified name: search all registries
		const matches: ResolvedTarget[] = []

		if (includeNode) {
			for (const registryName of this.registryNames) {
				const reg = this.container[registryName]
				if (!reg) continue
				const found = this.fuzzyFind(reg, target)
				if (found) {
					matches.push({ kind: 'helper', registry: registryName, id: found })
				}
			}
		}

		if (includeBrowser) {
			const browserFound = this.fuzzyFindBrowser(target)
			if (browserFound) {
				matches.push({ kind: 'browser-helper', id: browserFound })
			}
		}

		if (matches.length === 0) {
			const lines = [`"${target}" was not found in any registry.`, '', 'Available:']
			if (includeNode) {
				for (const registryName of this.registryNames) {
					const reg = this.container[registryName]
					if (reg && reg.available.length > 0) {
						lines.push(`  ${registryName}: ${reg.available.join(', ')}`)
					}
				}
			}
			if (includeBrowser && this._browserData && this._browserData.available.length > 0) {
				lines.push(`  browser features: ${this._browserData.available.join(', ')}`)
			}
			throw new DescribeError(lines.join('\n'))
		}

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

	/**
	 * Get data for a resolved target.
	 */
	getData(item: ResolvedTarget, options: DescribeOptions = {}): DescribeResult {
		const sections = options.sections || []
		const noTitle = options.noTitle || false
		const headingDepth = options.headingDepth || 1
		const platform = options.platform || 'all'

		switch (item.kind) {
			case 'container':
				return this.getContainerData(sections, noTitle, headingDepth)
			case 'registry':
				return this.getRegistryData(item.name, sections, noTitle, headingDepth, platform)
			case 'helper':
				return this.getHelperData(item.registry, item.id, sections, noTitle, headingDepth)
			case 'member':
				return this.getMemberData(item.registry, item.id, item.member, item.memberType, headingDepth)
			case 'browser-helper':
				return this.getBrowserHelperData(item.id, sections, noTitle, headingDepth)
			case 'browser-member':
				return this.getBrowserMemberData(item.id, item.member, item.memberType, headingDepth)
		}
	}

	// --- Private: Platform helpers ---

	private normalizePlatform(p: string): Platform {
		if (p === 'node') return 'server'
		if (p === 'web') return 'browser'
		return p as Platform
	}

	private shouldIncludeNode(platform: Platform): boolean {
		return platform === 'server' || platform === 'node' || platform === 'all'
	}

	private shouldIncludeBrowser(platform: Platform): boolean {
		return platform === 'browser' || platform === 'all'
	}

	// --- Private: Fuzzy matching ---

	private normalize(name: string): string {
		return name.replace(/\.[tj]sx?$/, '').replace(/[-_]/g, '').toLowerCase()
	}

	private fuzzyFind(registry: any, input: string): string | undefined {
		if (registry.has(input)) return input
		const norm = this.normalize(input)
		return (registry.available as string[]).find((id: string) => this.normalize(id) === norm)
	}

	private fuzzyFindBrowser(input: string): string | undefined {
		if (!this._browserData) return undefined
		const norm = this.normalize(input)
		return this._browserData.available.find(id => this.normalize(id) === norm)
	}

	/**
	 * Match a user-provided name to an actual registry name on the container.
	 * Handles pluralization and case variations dynamically.
	 */
	private matchRegistryName(name: string): string | undefined {
		const lower = name.toLowerCase()
		return this.registryNames.find(
			(r) => r === lower || r === lower + 's' || r.replace(/s$/, '') === lower
		)
	}

	// --- Private: Member resolution ---

	private resolveHelperMember(helperName: string, memberName: string): ResolvedTarget | null {
		for (const registryName of this.registryNames) {
			const reg = this.container[registryName]
			if (!reg) continue
			const found = this.fuzzyFind(reg, helperName)
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

	private resolveBrowserHelperMember(helperName: string, memberName: string): ResolvedTarget | null {
		if (!this._browserData) return null
		const found = this.fuzzyFindBrowser(helperName)
		if (!found) return null

		const data = this._browserData.introspection.get(`features.${found}`)
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

	// --- Private: Data getters ---

	private getContainerData(sections: (IntrospectionSection | 'description')[], noTitle: boolean, headingDepth: number): DescribeResult {
		const container = this.container

		if (sections.length === 0) {
			const data = container.inspect()
			return { json: data, text: container.inspectAsText(undefined, headingDepth) }
		}

		const data = container.inspect()
		const introspectionSections = sections.filter((s): s is IntrospectionSection => s !== 'description')
		const textParts: string[] = []
		const jsonResult: Record<string, any> = {}
		const h = '#'.repeat(headingDepth)

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

		return { json: jsonResult, text: textParts.join('\n\n') }
	}

	private getHelperData(registryName: string, id: string, sections: (IntrospectionSection | 'description')[], noTitle: boolean, headingDepth: number): DescribeResult {
		const registry = this.container[registryName]
		const Ctor = registry.lookup(id)
		const text = this.renderHelperText(Ctor, sections, noTitle, headingDepth)

		let finalText = text
		if (sections.length === 0 && !noTitle) {
			const summary = this.buildHelperSummary(Ctor)
			if (summary) {
				const sectionHeading = '#'.repeat(headingDepth + 1) + ' '
				const idx = text.indexOf('\n' + sectionHeading)
				if (idx >= 0) {
					finalText = text.slice(0, idx) + '\n\n' + summary + '\n' + text.slice(idx)
				}
			}
		}

		return {
			json: this.renderHelperJson(Ctor, sections, noTitle),
			text: finalText,
		}
	}

	private getMemberData(registryName: string, id: string, member: string, memberType: 'method' | 'getter', headingDepth: number): DescribeResult {
		const registry = this.container[registryName]
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

			const paramEntries = Object.entries(method.parameters || {})
			if (paramEntries.length > 0) {
				const paramLines = [`${hSub} Parameters`, '']
				for (const [name, info] of paramEntries) {
					const req = (method.required || []).includes(name) ? ' *(required)*' : ''
					paramLines.push(`- **${name}** \`${info.type}\`${req}${info.description ? ' — ' + info.description : ''}`)
					if (info.properties) {
						for (const [propName, propInfo] of Object.entries(info.properties)) {
							paramLines.push(`  - **${propName}** \`${propInfo.type}\`${propInfo.description ? ' — ' + propInfo.description : ''}`)
						}
					}
				}
				parts.push(paramLines.join('\n'))
			}

			if (method.returns && method.returns !== 'void') {
				parts.push(`${hSub} Returns\n\n\`${method.returns}\``)
			}

			if (method.examples?.length) {
				parts.push(`${hSub} Examples`)
				for (const ex of method.examples) {
					parts.push(`\`\`\`${ex.language || 'typescript'}\n${ex.code}\n\`\`\``)
				}
			}

			return { json: { [member]: method, _helper: id, _type: 'method' }, text: parts.join('\n\n') }
		}

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

	private getBrowserHelperData(id: string, sections: (IntrospectionSection | 'description')[], noTitle: boolean, headingDepth: number): DescribeResult {
		const data = this._browserData!.introspection.get(`features.${id}`)
		if (!data) return { json: {}, text: `No browser introspection data for ${id}` }

		const text = this.renderBrowserHelperText(data, sections, noTitle, headingDepth)

		let finalText = text
		if (sections.length === 0 && !noTitle) {
			const summary = this.buildBrowserHelperSummary(data)
			if (summary) {
				const sectionHeading = '#'.repeat(headingDepth + 1) + ' '
				const idx = text.indexOf('\n' + sectionHeading)
				if (idx >= 0) {
					finalText = text.slice(0, idx) + '\n\n' + summary + '\n' + text.slice(idx)
				}
			}
		}

		return {
			json: this.renderBrowserHelperJson(data, sections, noTitle),
			text: finalText,
		}
	}

	private getBrowserMemberData(id: string, member: string, memberType: 'method' | 'getter', headingDepth: number): DescribeResult {
		const data = this._browserData!.introspection.get(`features.${id}`)
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

	private getRegistryData(registryName: string, sections: (IntrospectionSection | 'description')[], noTitle: boolean, headingDepth: number, platform: Platform): DescribeResult {
		const includeNode = this.shouldIncludeNode(platform)
		const includeBrowser = this.shouldIncludeBrowser(platform) && registryName === 'features' && this._browserData

		const registry = this.container[registryName]
		const nodeAvailable: string[] = includeNode ? registry.available : []
		const browserAvailable: string[] = includeBrowser ? this._browserData!.available : []

		const collidingIds = includeBrowser ? this._browserData!.collidingIds : new Set<string>()
		const totalCount = nodeAvailable.length + browserAvailable.filter(id => !includeNode || !collidingIds.has(id)).length

		if (totalCount === 0) {
			return { json: {}, text: `No ${registryName} are registered.` }
		}

		if (sections.length === 0) {
			const h = '#'.repeat(headingDepth)
			const hSub = '#'.repeat(headingDepth + 1)
			const jsonResult: Record<string, any> = {}
			const textParts: string[] = [`${h} Available ${registryName} (${totalCount})\n`]

			if (includeNode) {
				const baseClass = registry.baseClass
				if (baseClass) {
					const shared = this.collectSharedMembers(baseClass)
					const label = registryName[0]!.toUpperCase() + registryName.slice(1).replace(/s$/, '')

					if (shared.getters.length) textParts.push(`**Shared ${label} Getters:** ${shared.getters.join(', ')}\n`)
					if (shared.methods.length) textParts.push(`**Shared ${label} Methods:** ${shared.methods.map(m => m + '()').join(', ')}\n`)
					jsonResult._shared = { methods: shared.methods, getters: shared.getters }
				}

				const baseClassRef = registry.baseClass
				const sorted = [...nodeAvailable].sort((a, b) => {
					const aCtor = registry.lookup(a)
					const bCtor = registry.lookup(b)
					const aIsDirect = !this.findIntermediateParent(aCtor, baseClassRef)
					const bIsDirect = !this.findIntermediateParent(bCtor, baseClassRef)
					if (aIsDirect && !bIsDirect) return -1
					if (!aIsDirect && bIsDirect) return 1
					return 0
				})

				for (const id of sorted) {
					const Ctor = registry.lookup(id)
					const introspection = Ctor.introspect?.()
					const description = introspection?.description || Ctor.description || 'No description provided'
					const summary = this.extractSummary(description)
					const featureGetters = Object.keys(introspection?.getters || {}).sort()
					const featureMethods = Object.keys(introspection?.methods || {}).sort()
					const intermediate = this.findIntermediateParent(Ctor, baseClassRef)

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

			if (includeBrowser) {
				for (const id of browserAvailable.sort()) {
					if (includeNode && collidingIds.has(id)) {
						const data = this._browserData!.introspection.get(`features.${id}`)
						if (!data) continue
						const summary = this.extractSummary(data.description || 'No description provided')
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

					const data = this._browserData!.introspection.get(`features.${id}`)
					if (!data) continue
					const summary = this.extractSummary(data.description || 'No description provided')
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

		// Sections specified: render each helper in detail
		const jsonResult: Record<string, any> = {}
		const textParts: string[] = []

		if (includeNode) {
			for (const id of nodeAvailable) {
				const Ctor = registry.lookup(id)
				jsonResult[id] = this.renderHelperJson(Ctor, sections, noTitle)
				textParts.push(this.renderHelperText(Ctor, sections, noTitle, headingDepth))
			}
		}

		if (includeBrowser) {
			for (const id of browserAvailable) {
				if (includeNode && collidingIds.has(id)) continue
				const data = this._browserData!.introspection.get(`features.${id}`)
				if (!data) continue
				jsonResult[id] = this.renderBrowserHelperJson(data, sections, noTitle)
				textParts.push(this.renderBrowserHelperText(data, sections, noTitle, headingDepth))
			}
		}

		return { json: jsonResult, text: textParts.join('\n\n---\n\n') }
	}

	// --- Private: Rendering helpers ---

	private renderTitle(Ctor: any, headingDepth = 1): string {
		const data = Ctor.introspect?.()
		const id = data?.id || Ctor.shortcut || Ctor.name
		const className = data?.className || Ctor.name
		const h = '#'.repeat(headingDepth)
		return className ? `${h} ${className} (${id})` : `${h} ${id}`
	}

	private renderHelperText(Ctor: any, sections: (IntrospectionSection | 'description')[], noTitle: boolean, headingDepth: number): string {
		if (sections.length === 0) {
			if (noTitle) {
				const data = Ctor.introspect?.()
				if (!data) return 'No introspection data available.'
				const parts: string[] = [data.description]
				const text = Ctor.introspectAsText?.(headingDepth)
				if (text) {
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
			return Ctor.introspectAsText?.(headingDepth) ?? `${this.renderTitle(Ctor, headingDepth)}\n\nNo introspection data available.`
		}

		const introspectionSections = sections.filter((s): s is IntrospectionSection => s !== 'description')
		const parts: string[] = []

		if (!noTitle) {
			const data = Ctor.introspect?.()
			parts.push(this.renderTitle(Ctor, headingDepth))
			if (data?.description) parts.push(data.description)
		}

		for (const section of introspectionSections) {
			const text = Ctor.introspectAsText?.(section, headingDepth)
			if (text) parts.push(text)
		}

		return parts.join('\n\n') || `${noTitle ? '' : this.renderTitle(Ctor, headingDepth) + '\n\n'}No introspection data available.`
	}

	private renderHelperJson(Ctor: any, sections: (IntrospectionSection | 'description')[], noTitle: boolean): any {
		if (sections.length === 0) return Ctor.introspect?.() ?? {}

		const data = Ctor.introspect?.() ?? {}
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
				const sectionData = Ctor.introspect?.(section)
				if (sectionData) result[section] = sectionData[section]
			}
		}

		return result
	}

	private renderBrowserHelperText(data: HelperIntrospection, sections: (IntrospectionSection | 'description')[], noTitle: boolean, headingDepth: number): string {
		const h = '#'.repeat(headingDepth)
		const className = data.className || data.id

		if (sections.length === 0) {
			const body = presentIntrospectionAsMarkdown(data, headingDepth)
			if (noTitle) {
				const lines = body.split('\n')
				const sectionHeading = '#'.repeat(headingDepth + 1) + ' '
				const firstSectionIdx = lines.findIndex((l, i) => i > 0 && l.startsWith(sectionHeading))
				const desc = data.description ? data.description + '\n\n' : ''
				if (firstSectionIdx > 0) return desc + lines.slice(firstSectionIdx).join('\n')
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

	private renderBrowserHelperJson(data: HelperIntrospection, sections: (IntrospectionSection | 'description')[], noTitle: boolean): any {
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

	// --- Private: Summary builders ---

	private extractSummary(description: string): string {
		const cut = description.search(/\s\*\*[A-Z][\w\s]+:\*\*|```|^\s*[-*]\s/m)
		const text = cut > 0 ? description.slice(0, cut).trim() : description
		if (text.length <= 300) return text
		const sentenceEnd = text.lastIndexOf('. ', 300)
		if (sentenceEnd > 100) return text.slice(0, sentenceEnd + 1)
		return text.slice(0, 300).trim() + '...'
	}

	private buildHelperSummary(Ctor: any): string {
		const introspection = Ctor.introspect?.()
		const ownMethods = Object.keys(introspection?.methods || {}).sort()
		const ownGetters = Object.keys(introspection?.getters || {}).sort()

		const chain: any[] = []
		let current = Object.getPrototypeOf(Ctor)
		while (current && current.name && !BASE_CLASS_NAMES.has(current.name) && current !== Function.prototype) {
			chain.push(current)
			current = Object.getPrototypeOf(current)
		}

		const lines: string[] = []
		if (chain.length > 0) lines.push(`> extends ${chain[0].name}`)
		if (ownGetters.length) lines.push(`getters: ${ownGetters.join(', ')}`)
		if (ownMethods.length) lines.push(`methods: ${ownMethods.map(m => m + '()').join(', ')}`)

		for (const parent of chain) {
			const parentIntrospection = parent.introspect?.()
			const inheritedMethods = Object.keys(parentIntrospection?.methods || {}).sort()
			const inheritedGetters = Object.keys(parentIntrospection?.getters || {}).sort()
			if (inheritedGetters.length) lines.push(`inherited getters (${parent.name}): ${inheritedGetters.join(', ')}`)
			if (inheritedMethods.length) lines.push(`inherited methods (${parent.name}): ${inheritedMethods.map(m => m + '()').join(', ')}`)
		}

		return lines.join('\n')
	}

	private buildBrowserHelperSummary(data: HelperIntrospection): string {
		const ownMethods = Object.keys(data.methods || {}).sort()
		const ownGetters = Object.keys(data.getters || {}).sort()
		const lines: string[] = []
		if (ownGetters.length) lines.push(`getters: ${ownGetters.join(', ')}`)
		if (ownMethods.length) lines.push(`methods: ${ownMethods.map(m => m + '()').join(', ')}`)
		return lines.join('\n')
	}

	// --- Private: Prototype chain helpers ---

	private collectSharedMembers(baseClass: any): { methods: string[]; getters: string[] } {
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

	private findIntermediateParent(Ctor: any, baseClass: any): { name: string; methods: string[]; getters: string[] } | null {
		if (!baseClass) return null

		let parent = Object.getPrototypeOf(Ctor)
		if (!parent || parent === baseClass) return null

		const chain: any[] = []
		let current = parent
		while (current && current !== baseClass && current !== Function.prototype) {
			chain.push(current)
			current = Object.getPrototypeOf(current)
		}

		if (chain.length === 0 || current !== baseClass) return null

		const intermediate = chain[0]
		const methods: string[] = []
		const getters: string[] = []

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
}

export { DescribeError, SECTION_FLAGS }
export type { ResolvedTarget, Platform, DescribeOptions, DescribeResult, BrowserFeatureData }
