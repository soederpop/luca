import { z } from 'zod'
import { Feature } from '../../feature'
import type { Helper } from '../../helper'
import type { NodeContainer } from '../../node/container'
import type { FeatureState, FeatureOptions } from '../../feature'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import { UnauthorizedError } from '@modelcontextprotocol/sdk/client/auth.js'
import { AjvJsonSchemaValidator } from '@modelcontextprotocol/sdk/validation/ajv-provider.js'
import { McpOAuthConfigSchema, McpOAuthProvider, mcpOAuthKey, mcpOAuthStore } from './mcp-oauth'

// Servers written against protobuf/OpenAPI conventions (cua-driver, for one)
// annotate numbers with formats Ajv has never heard of. Ajv logs
// "unknown format ... ignored in schema" for every occurrence, which buries a
// connect in noise. Teach it the numeric formats rather than muting the logger,
// so a genuinely malformed schema still warns.
//
// We extend the SDK's own Ajv instance instead of importing ajv here: the
// hoisted top-level ajv is a different major than the one the SDK bundles, and
// a validator built from the wrong major silently fails to apply.
const NUMERIC_FORMATS: Record<string, { type: 'number'; validate: (n: number) => boolean }> = {
	int32: { type: 'number', validate: n => Number.isInteger(n) && n >= -2147483648 && n <= 2147483647 },
	uint32: { type: 'number', validate: n => Number.isInteger(n) && n >= 0 && n <= 4294967295 },
	int64: { type: 'number', validate: n => Number.isInteger(n) },
	uint64: { type: 'number', validate: n => Number.isInteger(n) && n >= 0 },
	float: { type: 'number', validate: () => true },
	double: { type: 'number', validate: () => true },
}

let _schemaValidator: AjvJsonSchemaValidator | undefined

function schemaValidator(): AjvJsonSchemaValidator {
	if (_schemaValidator) return _schemaValidator

	const validator = new AjvJsonSchemaValidator()
	const ajv = (validator as any)._ajv

	// Private field — if the SDK ever renames it, fall back to the stock
	// validator (noisy, but correct) rather than throwing on every connect.
	if (ajv && typeof ajv.addFormat === 'function') {
		for (const [name, def] of Object.entries(NUMERIC_FORMATS)) {
			if (!ajv.formats?.[name]) ajv.addFormat(name, def)
		}
	}

	_schemaValidator = validator
	return validator
}

// ── Schemas ──────────────────────────────────────────────────────────────────

const McpServerConfigSchema = z.object({
	command: z.string().optional().describe('The executable to run for a stdio server (e.g. npx, bun, node). Mutually exclusive with url.'),
	url: z.string().optional().describe('URL of a remote MCP server using the Streamable HTTP transport (e.g. https://example.com/mcp). Takes precedence over command.'),
	headers: z.record(z.string(), z.string()).optional().describe('Headers sent with every request to an http server (e.g. Authorization). Ignored for stdio servers.'),
	oauth: z.union([McpOAuthConfigSchema, z.literal(false)]).optional().describe('OAuth settings for an http server. HTTP servers without an Authorization header use OAuth automatically when the server asks for it; set this only for a pre-registered client or a fixed callback port, or false to turn OAuth off.'),
	args: z.array(z.string()).optional().default([]).describe('Arguments to pass to the command (stdio only)'),
	env: z.record(z.string(), z.string()).optional().describe('Extra environment variables merged with process.env (stdio only)'),
	cwd: z.string().optional().describe('Working directory for the server process (stdio only)'),
	include: z.array(z.string()).optional().describe('Only expose tools whose names match these patterns'),
	exclude: z.array(z.string()).optional().describe('Hide tools whose names match these patterns'),
})

export type McpServerConfig = z.infer<typeof McpServerConfigSchema>

const ENV_VAR_PATTERN = /\$\{([A-Za-z_][A-Za-z0-9_]*)(?::-([^}]*))?\}/g

/**
 * Expand `${VAR}` and `${VAR:-default}` in every string of a config file's
 * servers, the same syntax Claude Code's .mcp.json uses, so one file can be
 * shared without committing secrets. An unset variable with no default
 * throws instead of passing the literal `${VAR}` along as a credential.
 */
function expandEnvVars<T>(value: T, path: string): T {
	const missing = new Set<string>()
	const walk = (v: unknown): unknown => {
		if (typeof v === 'string') {
			return v.replace(ENV_VAR_PATTERN, (match, name: string, fallback: string | undefined) => {
				const env = process.env[name]
				if (env !== undefined) return env
				if (fallback !== undefined) return fallback
				missing.add(name)
				return match
			})
		}
		if (Array.isArray(v)) return v.map(walk)
		if (v && typeof v === 'object') {
			return Object.fromEntries(Object.entries(v).map(([k, inner]) => [k, walk(inner)]))
		}
		return v
	}
	const expanded = walk(value) as T
	if (missing.size) {
		throw new Error(`MCP config file "${path}" references unset environment variables: ${[...missing].join(', ')}`)
	}
	return expanded
}

const McpBridgeOptionsSchema = z.object({
	configFile: z.string().optional().describe('Path to a JSON file containing an mcpServers map, resolved relative to the container working directory. Loaded when connecting; a missing file warns and loads no servers. Strings may use ${VAR} or ${VAR:-default} to read environment variables.'),
	servers: z.record(z.string(), McpServerConfigSchema).default({}).describe('MCP server configurations keyed by server name. Explicit entries replace matching entries from configFile.'),
	skipServers: z.array(z.string()).default([]).describe('Server names to leave out, from configFile or servers. Lets one assistant share a project .mcp.json without getting every server in it.'),
	materializeTools: z.boolean().default(true).describe('Register discovered MCP tools as first-class assistant tools'),
	separator: z.string().default('__').describe('Separator between server name and tool name for materialized tools'),
	interactiveAuth: z.boolean().default(false).describe('When an OAuth server has no valid login, open a browser and wait for it during connect. Default false: the server is marked auth-required and the others connect, so headless runs never hang. Log in ahead of time with bridge.login() or `luca mcp-auth login`.'),
})

export type McpBridgeOptions = z.infer<typeof McpBridgeOptionsSchema>

const McpBridgeStateSchema = z.looseObject({
	enabled: z.boolean().default(false).describe('Whether this feature is currently enabled'),
	servers: z.record(z.string(), z.object({
		status: z.enum(['connecting', 'connected', 'error', 'disconnected', 'auth-required']).describe('Connection status. auth-required means the server needs an OAuth login first.'),
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
	authRequired: z.tuple([z.string().describe('server name'), z.string().describe('authorization URL')]).describe('Fired when an http server needs an OAuth login. In interactive mode the browser is opening; otherwise the server is left in auth-required.'),
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
	transport: Transport
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

/** Thrown by connectServer when an OAuth server has no usable login and interactiveAuth is off. */
export class McpAuthRequiredError extends Error {
	constructor(readonly serverName: string, readonly authorizationUrl: URL) {
		super(`MCP server "${serverName}" needs an OAuth login. Run \`luca mcp-auth login ${serverName}\` (or bridge.login('${serverName}')) once; the login is then reused.`)
		this.name = 'McpAuthRequiredError'
	}
}

// ── Feature ──────────────────────────────────────────────────────────────────

/**
 * Bridges MCP servers to Luca assistants by connecting to them,
 * discovering their tools/resources/prompts, and exposing them as first-class
 * assistant tool calls. To the model, MCP tools look like ordinary tools.
 *
 * Servers with a `command` are spawned locally over stdio; servers with a
 * `url` are reached over the Streamable HTTP transport.
 * Pass `configFile: 'mcp.json'` to load an `mcpServers` map from disk.
 * Strings in that file may use `${VAR}` or `${VAR:-default}` to read from
 * the environment, as in Claude Code's .mcp.json.
 * Explicit `servers` entries replace file entries with the same name.
 *
 * HTTP servers that use OAuth (most hosted MCP servers) need no config: the
 * bridge discovers the server's authorization server, registers a client,
 * and stores the login in `~/.luca/store/mcp-oauth.json` (mode 0600), keyed by
 * server URL and shared by every project on the machine. Tokens refresh on
 * their own. Log in once with `luca mcp-auth login` or `bridge.login()`;
 * until then the server reports `auth-required` and the others still connect.
 * The same `.mcp.json` works in Claude Code, which keeps its own login.
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
 *     remote: {
 *       url: 'https://mcp.example.com/mcp',
 *       headers: { Authorization: `Bearer ${token}` },
 *     },
 *     fellow: { url: 'https://fellow.app/mcp' }, // OAuth, discovered automatically
 *   },
 * })
 * await bridge.login('fellow') // opens a browser once; later runs reuse the stored login
 * ```
 */
export class McpBridge extends Feature<McpBridgeState, McpBridgeOptions & FeatureOptions> {
	static override shortcut = 'features.mcpBridge' as const
	static override stability = 'stable' as const
	static override category = 'ai-assistants' as const
	static override optionsSchema = McpBridgeOptionsSchema
	static override stateSchema = McpBridgeStateSchema
	static override eventsSchema = McpBridgeEventsSchema
	static override description = 'Bridges MCP servers (local stdio or remote Streamable HTTP) to Luca assistants by discovering their tools and exposing them as first-class assistant tool calls.'

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
	 * Loads and validates configFile before connecting. A missing file warns and
	 * loads no servers; an unreadable or invalid file rejects.
	 */
	async connectAll(): Promise<void> {
		if (this._connected) return

		const servers = await this.loadServerConfigs()
		if (Object.keys(servers).length === 0) {
			this._connected = true
			return
		}

		const results = await Promise.allSettled(
			Object.entries(servers).map(([name, config]) =>
				this.connectServer(name, config)
			)
		)

		// Log failures but don't throw — partial connectivity is fine
		for (let i = 0; i < results.length; i++) {
			if (results[i]!.status === 'rejected') {
				const name = Object.keys(servers)[i]!
				const err = (results[i] as PromiseRejectedResult).reason
				this.emit('serverError', name, String(err?.message || err))
			}
		}

		this._connected = true
	}

	/**
	 * The merged server map: configFile entries (with ${VAR} expanded) overlaid
	 * by explicit `servers` options. Does not connect anything.
	 */
	async loadServerConfigs(): Promise<Record<string, McpServerConfig>> {
		const opts = this.options as McpBridgeOptions
		let fileServers: Record<string, McpServerConfig> = {}
		if (opts.configFile) {
			const container = this.container as NodeContainer
			const path = container.paths.resolve(opts.configFile)
			const fs = container.feature('fs')
			// A missing file is an empty config, so a project can point at
			// .mcp.json before it has one. A file that exists but is broken
			// still throws: silently dropping its servers would hide the typo.
			if (!(await fs.existsAsync(path))) {
				console.warn(`Warning: MCP config file "${path}" not found, no MCP servers loaded from it`)
			} else {
				try {
					const config = await fs.readJsonAsync(path)
					fileServers = z.object({
						mcpServers: z.record(z.string(), McpServerConfigSchema),
					}).parse(config).mcpServers
				} catch (cause) {
					throw new Error(`Failed to load MCP config file "${path}"`, { cause })
				}
				fileServers = expandEnvVars(fileServers, path)
			}
		}
		const servers: Record<string, McpServerConfig> = { ...fileServers, ...opts.servers }
		for (const name of opts.skipServers || []) delete servers[name]
		return servers
	}

	/**
	 * Connect to a single MCP server, discover its tools/resources/prompts.
	 */
	async connectServer(name: string, config: McpServerConfig, connectOptions: { interactiveAuth?: boolean } = {}): Promise<ConnectedServer> {
		// Update state to connecting
		this._updateServerState(name, { status: 'connecting', toolCount: 0, resourceCount: 0, promptCount: 0 })

		const interactive = connectOptions.interactiveAuth ?? (this.options as McpBridgeOptions).interactiveAuth ?? false
		const authProvider = this._oauthProviderFor(name, config, interactive)
		if (authProvider) await authProvider.prepare()

		let transport: Transport
		let client: Client
		const newClient = () => new Client(
			{ name: `luca-mcp-bridge/${name}`, version: '1.0.0' },
			{ jsonSchemaValidator: schemaValidator() },
		)
		const newHttpTransport = () => new StreamableHTTPClientTransport(new URL(config.url!), {
			...(config.headers ? { requestInit: { headers: config.headers } } : {}),
			...(authProvider ? { authProvider } : {}),
		})

		if (config.url) {
			transport = newHttpTransport()
		} else if (config.command) {
			transport = new StdioClientTransport({
				command: config.command,
				args: config.args || [],
				env: config.env ? { ...process.env, ...config.env } as Record<string, string> : undefined,
				cwd: config.cwd,
			})
		} else {
			const err = new Error(`Server "${name}" needs either a command (stdio) or a url (http) in its config`)
			this._updateServerState(name, { status: 'error', toolCount: 0, resourceCount: 0, promptCount: 0, error: err.message })
			throw err
		}

		client = newClient()

		try {
			try {
				await client.connect(transport)
			} catch (err) {
				if (!(err instanceof UnauthorizedError) || !authProvider?.authorizationUrl) throw err

				this.emit('authRequired', name, authProvider.authorizationUrl.toString())
				if (!interactive) {
					throw new McpAuthRequiredError(name, authProvider.authorizationUrl)
				}

				// Browser is open; trade the redirect's code for tokens, then
				// reconnect on a fresh transport (a failed one can't restart).
				const code = await authProvider.waitForAuthorizationCode()
				await (transport as StreamableHTTPClientTransport).finishAuth(code)
				await transport.close().catch(() => {})
				transport = newHttpTransport()
				client = newClient()
				await client.connect(transport)
			}

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
				status: err instanceof McpAuthRequiredError ? 'auth-required' : 'error',
				toolCount: 0,
				resourceCount: 0,
				promptCount: 0,
				error: err.message || String(err),
			})
			throw err
		}
	}

	/**
	 * OAuth applies to http servers unless the config sends its own
	 * Authorization header or sets `oauth: false`. Attaching a provider to a
	 * server that never asks for auth costs nothing: it is only used on a 401.
	 */
	private _oauthProviderFor(name: string, config: McpServerConfig, interactive: boolean): McpOAuthProvider | undefined {
		if (!config.url || config.oauth === false) return undefined
		const hasAuthHeader = Object.keys(config.headers || {}).some(h => h.toLowerCase() === 'authorization')
		if (hasAuthHeader) return undefined
		return new McpOAuthProvider(this.container as NodeContainer, {
			serverName: name,
			serverUrl: config.url,
			config: config.oauth || undefined,
			interactive,
		})
	}

	/**
	 * Log in to OAuth servers by opening a browser, then connect them. With no
	 * name, logs in to every configured http server that needs it. A server
	 * with a valid stored login connects without opening anything.
	 *
	 * @param name - One server name from the config. Omit for all.
	 * @returns Each server's resulting status
	 *
	 * @example
	 * ```ts
	 * const bridge = container.feature('mcpBridge', { configFile: '.mcp.json' })
	 * await bridge.login('fellow')
	 * ```
	 */
	async login(name?: string): Promise<Record<string, { status: string; error?: string }>> {
		const servers = await this.loadServerConfigs()
		if (name && !servers[name]) throw new Error(`No MCP server named "${name}". Configured: ${Object.keys(servers).join(', ') || 'none'}`)
		const names = name ? [name] : Object.keys(servers).filter(n => this._oauthProviderFor(n, servers[n]!, false))

		const results: Record<string, { status: string; error?: string }> = {}
		// One at a time: each login opens a browser tab and may share the callback port.
		for (const n of names) {
			await this.disconnectServer(n)
			try {
				await this.connectServer(n, servers[n]!, { interactiveAuth: true })
				results[n] = { status: 'connected' }
			} catch (err: any) {
				results[n] = { status: (this.state.get('servers') as any)?.[n]?.status || 'error', error: err?.message || String(err) }
			}
		}
		return results
	}

	/**
	 * Forget the stored OAuth login (tokens and registered client) for a server
	 * and disconnect it. The next connect needs a fresh login.
	 *
	 * @param name - Server name from the config
	 */
	async logout(name: string): Promise<void> {
		const config = (await this.loadServerConfigs())[name]
		if (!config?.url) throw new Error(`No http MCP server named "${name}"`)
		await this.disconnectServer(name)
		const key = mcpOAuthKey(config.url)
		await mcpOAuthStore(this.container as NodeContainer).update(draft => {
			if (draft.servers) delete draft.servers[key]
		})
	}

	/**
	 * Which configured http servers have a stored OAuth login. Reads the store
	 * only; it does not check that the tokens are still accepted.
	 */
	async authStatus(): Promise<Record<string, { url: string; oauth: boolean; loggedIn: boolean; tokensSavedAt?: string; hasRefreshToken: boolean }>> {
		const servers = await this.loadServerConfigs()
		const stored = (await mcpOAuthStore(this.container as NodeContainer).read()).servers || {}
		const result: Record<string, any> = {}
		for (const [n, config] of Object.entries(servers)) {
			if (!config.url) continue
			const entry = stored[mcpOAuthKey(config.url)]
			result[n] = {
				url: config.url,
				oauth: !!this._oauthProviderFor(n, config, false),
				loggedIn: !!entry?.tokens?.access_token,
				tokensSavedAt: entry?.tokensSavedAt,
				hasRefreshToken: !!entry?.tokens?.refresh_token,
			}
		}
		return result
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
