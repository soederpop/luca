import { z } from 'zod'
import { Feature } from '../../feature'
import type { Helper } from '../../helper'
import type { FeatureState, FeatureOptions } from '../../schemas/base'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

// ── Schemas ──────────────────────────────────────────────────────────────────

const McpServerConfigSchema = z.object({
	command: z.string().describe('The executable to run (e.g. npx, bun, node)'),
	args: z.array(z.string()).optional().default([]).describe('Arguments to pass to the command'),
	env: z.record(z.string(), z.string()).optional().describe('Extra environment variables merged with process.env'),
	cwd: z.string().optional().describe('Working directory for the server process'),
	include: z.array(z.string()).optional().describe('Only expose tools whose names match these patterns'),
	exclude: z.array(z.string()).optional().describe('Hide tools whose names match these patterns'),
})

export type McpServerConfig = z.infer<typeof McpServerConfigSchema>

const McpBridgeOptionsSchema = z.object({
	servers: z.record(z.string(), McpServerConfigSchema).default({}).describe('MCP server configurations keyed by server name'),
	materializeTools: z.boolean().default(true).describe('Register discovered MCP tools as first-class assistant tools'),
	separator: z.string().default('__').describe('Separator between server name and tool name for materialized tools'),
})

export type McpBridgeOptions = z.infer<typeof McpBridgeOptionsSchema>

const McpBridgeStateSchema = z.looseObject({
	enabled: z.boolean().default(false).describe('Whether this feature is currently enabled'),
	servers: z.record(z.string(), z.object({
		status: z.enum(['connecting', 'connected', 'error', 'disconnected']).describe('Connection status'),
		toolCount: z.number().default(0).describe('Number of tools discovered'),
		resourceCount: z.number().default(0).describe('Number of resources discovered'),
		promptCount: z.number().default(0).describe('Number of prompts discovered'),
		error: z.string().optional().describe('Error message if connection failed'),
	})).default({}).describe('Status of each connected MCP server'),
})

export type McpBridgeState = z.infer<typeof McpBridgeStateSchema>

const McpBridgeEventsSchema = z.object({
	serverConnected: z.tuple([z.string().describe('server name'), z.number().describe('tool count')]).describe('Fired when an MCP server connects and its capabilities are discovered'),
	serverDisconnected: z.tuple([z.string().describe('server name')]).describe('Fired when an MCP server disconnects'),
	serverError: z.tuple([z.string().describe('server name'), z.string().describe('error message')]).describe('Fired when an MCP server connection fails'),
	toolCalled: z.tuple([z.string().describe('server name'), z.string().describe('tool name')]).describe('Fired when a tool call is proxied to an MCP server'),
})

// ── Internal types ───────────────────────────────────────────────────────────

interface McpToolInfo {
	name: string
	description?: string
	inputSchema: Record<string, any>
}

interface ConnectedServer {
	client: Client
	transport: StdioClientTransport
	tools: McpToolInfo[]
	resources: Array<{ uri: string; name: string; description?: string }>
	prompts: Array<{ name: string; description?: string; arguments?: Array<{ name: string; description?: string; required?: boolean }> }>
}

/**
 * Wraps a raw JSON Schema object so it can be passed to `assistant.addTool()`
 * which expects an object with a `.toJSONSchema()` method.
 */
function wrapJsonSchema(inputSchema: Record<string, any>, description?: string) {
	return {
		toJSONSchema() {
			return { ...inputSchema, description: description || inputSchema.description }
		},
		description: description || inputSchema.description || '',
	}
}

/**
 * Simple glob-style matching: supports `*` as a wildcard for any sequence of characters.
 */
function matchesPattern(name: string, pattern: string): boolean {
	const regex = new RegExp('^' + pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$')
	return regex.test(name)
}

function matchesAnyPattern(name: string, patterns: string[]): boolean {
	return patterns.some(p => matchesPattern(name, p))
}

// ── Feature ──────────────────────────────────────────────────────────────────

/**
 * Bridges local stdio MCP servers to Luca assistants by connecting to them,
 * discovering their tools/resources/prompts, and exposing them as first-class
 * assistant tool calls. To the model, MCP tools look like ordinary tools.
 *
 * @example
 * ```ts
 * const bridge = container.feature('mcpBridge', {
 *   servers: {
 *     github: {
 *       command: 'npx',
 *       args: ['-y', '@modelcontextprotocol/server-github'],
 *       env: { GITHUB_TOKEN: process.env.GITHUB_TOKEN },
 *     },
 *   },
 * })
 * ```
 */
export class McpBridge extends Feature<McpBridgeState, McpBridgeOptions & FeatureOptions> {
	static override shortcut = 'features.mcpBridge' as const
	static override optionsSchema = McpBridgeOptionsSchema
	static override stateSchema = McpBridgeStateSchema
	static override eventsSchema = McpBridgeEventsSchema
	static override description = 'Bridges local stdio MCP servers to Luca assistants by discovering their tools and exposing them as first-class assistant tool calls.'

	private _connections = new Map<string, ConnectedServer>()
	private _connected = false

	/** Generic tools for discovery and ad-hoc invocation. */
	static override tools: Record<string, { schema: z.ZodType; description?: string }> = {
		listMcpCapabilities: {
			description: 'List all connected MCP servers and their available tools, resources, and prompts.',
			schema: z.object({
				server: z.string().optional().describe('Filter to a specific server name. Omit to list all.'),
			}).describe('List all connected MCP servers and their capabilities'),
		},
		useMcpTool: {
			description: 'Call a tool on a specific MCP server. Use this for tools that are not materialized as first-class tools, or when you need to call a tool by dynamic name.',
			schema: z.object({
				server: z.string().describe('The MCP server name'),
				tool: z.string().describe('The tool name on that server'),
				arguments: z.string().optional().describe('JSON-encoded arguments object to pass to the tool'),
			}).describe('Call an MCP tool on a specific server'),
		},
		readMcpResource: {
			description: 'Read a resource from a connected MCP server by URI.',
			schema: z.object({
				server: z.string().describe('The MCP server name'),
				uri: z.string().describe('The resource URI to read'),
			}).describe('Read an MCP resource by URI'),
		},
		getMcpPrompt: {
			description: 'Get a prompt template from a connected MCP server.',
			schema: z.object({
				server: z.string().describe('The MCP server name'),
				name: z.string().describe('The prompt name'),
				arguments: z.string().optional().describe('JSON-encoded arguments for the prompt'),
			}).describe('Get an MCP prompt template'),
		},
	}

	static { Feature.register(this, 'mcpBridge') }

	// ── Connection lifecycle ────────────────────────────────────────────────

	/**
	 * Connect to all configured MCP servers, discover their capabilities,
	 * and cache the results. Safe to call multiple times (no-ops if already connected).
	 */
	async connectAll(): Promise<void> {
		if (this._connected) return

		const opts = this.options as McpBridgeOptions
		if (!opts.servers || Object.keys(opts.servers).length === 0) {
			this._connected = true
			return
		}

		const results = await Promise.allSettled(
			Object.entries(opts.servers).map(([name, config]) =>
				this.connectServer(name, config)
			)
		)

		// Log failures but don't throw — partial connectivity is fine
		for (let i = 0; i < results.length; i++) {
			if (results[i]!.status === 'rejected') {
				const name = Object.keys(opts.servers)[i]!
				const err = (results[i] as PromiseRejectedResult).reason
				this.emit('serverError', name, String(err?.message || err))
			}
		}

		this._connected = true
	}

	/**
	 * Connect to a single MCP server, discover its tools/resources/prompts.
	 */
	async connectServer(name: string, config: McpServerConfig): Promise<ConnectedServer> {
		// Update state to connecting
		this._updateServerState(name, { status: 'connecting', toolCount: 0, resourceCount: 0, promptCount: 0 })

		const transport = new StdioClientTransport({
			command: config.command,
			args: config.args || [],
			env: config.env ? { ...process.env, ...config.env } as Record<string, string> : undefined,
			cwd: config.cwd,
		})

		const client = new Client({ name: `luca-mcp-bridge/${name}`, version: '1.0.0' })

		try {
			await client.connect(transport)

			// Discover capabilities (don't fail if a server doesn't support all types)
			const [toolsResult, resourcesResult, promptsResult] = await Promise.allSettled([
				client.listTools(),
				client.listResources(),
				client.listPrompts(),
			])

			const rawTools: McpToolInfo[] = toolsResult.status === 'fulfilled'
				? (toolsResult.value.tools as McpToolInfo[])
				: []
			const resources = resourcesResult.status === 'fulfilled'
				? resourcesResult.value.resources
				: []
			const prompts = promptsResult.status === 'fulfilled'
				? (promptsResult.value.prompts as ConnectedServer['prompts'])
				: []

			// Apply include/exclude filters
			const tools = this._filterTools(rawTools, config.include, config.exclude)

			const conn: ConnectedServer = { client, transport, tools, resources, prompts }
			this._connections.set(name, conn)

			this._updateServerState(name, {
				status: 'connected',
				toolCount: tools.length,
				resourceCount: resources.length,
				promptCount: prompts.length,
			})

			this.emit('serverConnected', name, tools.length)

			// Wire up disconnect detection
			transport.onclose = () => {
				this._updateServerState(name, { status: 'disconnected', toolCount: 0, resourceCount: 0, promptCount: 0 })
				this._connections.delete(name)
				this.emit('serverDisconnected', name)
			}

			return conn
		} catch (err: any) {
			this._updateServerState(name, {
				status: 'error',
				toolCount: 0,
				resourceCount: 0,
				promptCount: 0,
				error: err.message || String(err),
			})
			throw err
		}
	}

	/**
	 * Disconnect from all MCP servers and clean up.
	 */
	async disconnectAll(): Promise<void> {
		const closePromises: Promise<void>[] = []

		for (const [name, conn] of this._connections) {
			closePromises.push(
				conn.transport.close().catch(() => {}).then(() => {
					this._updateServerState(name, { status: 'disconnected', toolCount: 0, resourceCount: 0, promptCount: 0 })
					this.emit('serverDisconnected', name)
				})
			)
		}

		await Promise.allSettled(closePromises)
		this._connections.clear()
		this._connected = false
	}

	/**
	 * Disconnect a single server.
	 */
	async disconnectServer(name: string): Promise<void> {
		const conn = this._connections.get(name)
		if (!conn) return

		await conn.transport.close().catch(() => {})
		this._connections.delete(name)
		this._updateServerState(name, { status: 'disconnected', toolCount: 0, resourceCount: 0, promptCount: 0 })
		this.emit('serverDisconnected', name)
	}

	// ── Tool handlers (generic bridge tools) ────────────────────────────────

	/**
	 * List capabilities across all connected servers or a specific one.
	 */
	async listMcpCapabilities(args: { server?: string }) {
		const result: Record<string, any> = {}

		for (const [name, conn] of this._connections) {
			if (args.server && args.server !== name) continue
			result[name] = {
				status: 'connected',
				tools: conn.tools.map(t => ({ name: t.name, description: t.description })),
				resources: conn.resources.map(r => ({ uri: r.uri, name: r.name, description: r.description })),
				prompts: conn.prompts.map(p => ({ name: p.name, description: p.description })),
			}
		}

		if (args.server && !result[args.server]) {
			return { error: `Server "${args.server}" is not connected. Connected servers: ${[...this._connections.keys()].join(', ') || 'none'}` }
		}

		return result
	}

	/**
	 * Call a tool on a specific MCP server.
	 */
	async useMcpTool(args: { server: string; tool: string; arguments?: string }) {
		const conn = this._connections.get(args.server)
		if (!conn) {
			return { error: `Server "${args.server}" is not connected. Connected servers: ${[...this._connections.keys()].join(', ') || 'none'}` }
		}

		const parsedArgs = args.arguments ? JSON.parse(args.arguments) : {}

		this.emit('toolCalled', args.server, args.tool)

		const result = await conn.client.callTool({
			name: args.tool,
			arguments: parsedArgs,
		})

		return this._formatCallToolResult(result)
	}

	/**
	 * Read a resource from a connected MCP server.
	 */
	async readMcpResource(args: { server: string; uri: string }) {
		const conn = this._connections.get(args.server)
		if (!conn) {
			return { error: `Server "${args.server}" is not connected.` }
		}

		const result = await conn.client.readResource({ uri: args.uri })
		const contents = result.contents.map((c: any) => c.text || c.blob || '').join('\n')
		return { uri: args.uri, contents }
	}

	/**
	 * Get a prompt from a connected MCP server.
	 */
	async getMcpPrompt(args: { server: string; name: string; arguments?: string }) {
		const conn = this._connections.get(args.server)
		if (!conn) {
			return { error: `Server "${args.server}" is not connected.` }
		}

		const parsedArgs = args.arguments ? JSON.parse(args.arguments) : undefined

		const result = await conn.client.getPrompt({
			name: args.name,
			arguments: parsedArgs,
		})

		return {
			description: result.description,
			messages: result.messages.map((m: any) => ({
				role: m.role,
				content: typeof m.content === 'string' ? m.content : m.content?.text || '',
			})),
		}
	}

	// ── Assistant integration ────────────────────────────────────────────────

	/**
	 * When an assistant consumes this feature via `assistant.use(bridge)`:
	 * 1. Inject system prompt guidance about MCP capabilities.
	 * 2. Schedule async connection + tool materialization via the assistant's
	 *    pending plugins mechanism (awaited during `assistant.start()`).
	 */
	override setupToolsConsumer(consumer: Helper) {
		const assistant = consumer as any

		// Inject system prompt guidance
		if (typeof assistant.addSystemPromptExtension === 'function') {
			assistant.addSystemPromptExtension('mcpBridge', [
				'## MCP Bridge — Local Tool Servers',
				'',
				'You have access to local MCP-backed capabilities. These appear as normal tools.',
				'Materialized tools are named `serverName__toolName` and have full schemas.',
				'For discovery or ad-hoc invocation, use the generic bridge tools:',
				'- `listMcpCapabilities` — see all connected servers and their tools',
				'- `useMcpTool` — call any MCP tool by server and name',
				'- `readMcpResource` — read an MCP resource by URI',
				'- `getMcpPrompt` — get an MCP prompt template',
				'',
				'Prefer materialized tools when available. Use generic tools for discovery.',
			].join('\n'))
		}

		// Schedule async connection + materialization as a pending plugin.
		// The assistant awaits all pending plugins during start().
		if (typeof assistant.use === 'function') {
			assistant.use(async (asst: any) => {
				await this.connectAll()
				this._materializeToolsOnAssistant(asst)
			})
		}
	}

	// ── Accessors ────────────────────────────────────────────────────────────

	/** Get a connected server by name. */
	getServer(name: string): ConnectedServer | undefined {
		return this._connections.get(name)
	}

	/** List all connected server names. */
	get connectedServers(): string[] {
		return [...this._connections.keys()]
	}

	/** Get all discovered tools across all servers, with their server name prefix. */
	get allTools(): Array<{ server: string; tool: McpToolInfo; materializedName: string }> {
		const sep = (this.options as McpBridgeOptions).separator || '__'
		const result: Array<{ server: string; tool: McpToolInfo; materializedName: string }> = []

		for (const [serverName, conn] of this._connections) {
			for (const tool of conn.tools) {
				result.push({
					server: serverName,
					tool,
					materializedName: `${serverName}${sep}${tool.name}`,
				})
			}
		}

		return result
	}

	// ── Internals ────────────────────────────────────────────────────────────

	private _updateServerState(name: string, state: Record<string, any>) {
		const servers = { ...(this.state.get('servers') as Record<string, any> || {}) }
		servers[name] = { ...(servers[name] || {}), ...state }
		this.state.set('servers' as any, servers)
	}

	private _filterTools(tools: McpToolInfo[], include?: string[], exclude?: string[]): McpToolInfo[] {
		let filtered = tools
		if (include?.length) {
			filtered = filtered.filter(t => matchesAnyPattern(t.name, include))
		}
		if (exclude?.length) {
			filtered = filtered.filter(t => !matchesAnyPattern(t.name, exclude))
		}
		return filtered
	}

	/**
	 * Register materialized tools on an assistant. Each MCP tool becomes
	 * `serverName__toolName` with the MCP input schema passed through directly.
	 */
	private _materializeToolsOnAssistant(assistant: any) {
		const opts = this.options as McpBridgeOptions
		if (opts.materializeTools === false) return

		const sep = opts.separator || '__'

		for (const [serverName, conn] of this._connections) {
			for (const tool of conn.tools) {
				const materializedName = `${serverName}${sep}${tool.name}`
				const schemaWrapper = wrapJsonSchema(
					tool.inputSchema || { type: 'object', properties: {} },
					tool.description,
				)

				const handler = async (args: Record<string, any>) => {
					this.emit('toolCalled', serverName, tool.name)
					const result = await conn.client.callTool({
						name: tool.name,
						arguments: args,
					})
					return this._formatCallToolResult(result)
				}

				assistant.addTool(materializedName, handler, schemaWrapper)
			}
		}
	}

	/**
	 * Flatten an MCP CallToolResult into a plain string or object for the model.
	 */
	private _formatCallToolResult(result: any): any {
		if (result.isError) {
			const errorText = result.content
				?.map((c: any) => c.text || '')
				.filter(Boolean)
				.join('\n')
			return { error: errorText || 'MCP tool call failed' }
		}

		// If there's structured content, return it directly
		if (result.structuredContent) {
			return result.structuredContent
		}

		// Flatten content array
		const parts: string[] = []
		for (const c of result.content || []) {
			if (c.type === 'text' && c.text) {
				parts.push(c.text)
			} else if (c.type === 'resource' && c.resource) {
				parts.push(c.resource.text || c.resource.blob || `[resource: ${c.resource.uri}]`)
			} else if (c.type === 'image') {
				parts.push(`[image: ${c.mimeType || 'unknown'}]`)
			}
		}

		// Single text content → return as string; multiple → return as object
		if (parts.length === 1) return parts[0]
		if (parts.length > 1) return { results: parts }
		return { ok: true }
	}
}

export default McpBridge
