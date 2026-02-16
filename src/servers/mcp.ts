import type { NodeContainer } from '../node/container.js'
import { z } from 'zod'
import { MCPServerStateSchema, MCPServerOptionsSchema, MCPServerEventsSchema } from '../schemas/base.js'
import { servers, Server, type ServersInterface, type ServerState } from '../server.js'
import { Server as MCPProtocolServer } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'

declare module '../server' {
  interface AvailableServers {
    mcp: typeof MCPServer
  }
}

export type MCPServerOptions = z.infer<typeof MCPServerOptionsSchema>
export type MCPServerState = z.infer<typeof MCPServerStateSchema>

/** Context object passed to all MCP tool, resource, and prompt handlers. */
export type MCPContext = {
  container: NodeContainer
}

/** A registered MCP tool with its schema, handler, and pre-computed JSON Schema. */
export interface RegisteredTool {
  name: string
  description?: string
  schema?: z.ZodObject<any>
  jsonSchema?: Record<string, any>
  handler: (args: any, ctx: MCPContext) => any
}

/** A registered MCP resource with its URI, metadata, and handler. */
export interface RegisteredResource {
  uri: string
  name?: string
  description?: string
  mimeType?: string
  handler: (uri: string, ctx: MCPContext) => Promise<string> | string
}

/** A registered MCP prompt with its argument schemas and handler. */
export interface RegisteredPrompt {
  name: string
  description?: string
  args?: Record<string, z.ZodType>
  handler: (args: Record<string, string | undefined>, ctx: MCPContext) => Promise<PromptMessage[]> | PromptMessage[]
}

export type PromptMessage = {
  role: 'user' | 'assistant'
  content: string
}

type ToolRegistrationOptions = {
  schema?: z.ZodObject<any>
  description?: string
  handler: (args: any, ctx: MCPContext) => any
}

type ResourceRegistrationOptions = {
  name?: string
  description?: string
  mimeType?: string
  handler: (uri: string, ctx: MCPContext) => Promise<string> | string
}

type PromptRegistrationOptions = {
  description?: string
  args?: Record<string, z.ZodType>
  handler: (args: Record<string, string | undefined>, ctx: MCPContext) => Promise<PromptMessage[]> | PromptMessage[]
}

/**
 * MCP (Model Context Protocol) server for exposing tools, resources, and prompts
 * to AI clients like Claude Code. Uses the low-level MCP SDK Server class directly
 * with Zod 4 native JSON Schema conversion.
 *
 * Register tools, resources, and prompts programmatically, then start the server
 * over stdio (for CLI integration) or HTTP (for remote access).
 *
 * @example
 * ```ts
 * const mcp = container.server('mcp', { serverName: 'my-server', serverVersion: '1.0.0' })
 *
 * mcp.tool('search_files', {
 *   schema: z.object({ pattern: z.string() }),
 *   description: 'Search for files',
 *   handler: async (args, ctx) => {
 *     return ctx.container.feature('fs').walk('.', { include: [args.pattern] }).files.join('\n')
 *   }
 * })
 *
 * await mcp.start()
 * ```
 */
export class MCPServer extends Server<MCPServerState, MCPServerOptions> {
  static override shortcut = 'servers.mcp' as const
  static override stateSchema = MCPServerStateSchema
  static override optionsSchema = MCPServerOptionsSchema
  static override eventsSchema = MCPServerEventsSchema

  static override attach(container: NodeContainer & ServersInterface) {
    return container
  }

  _mcpServer?: MCPProtocolServer
  _tools: Map<string, RegisteredTool> = new Map()
  _resources: Map<string, RegisteredResource> = new Map()
  _prompts: Map<string, RegisteredPrompt> = new Map()

  override get initialState(): MCPServerState {
    return {
      port: this.options.port,
      listening: false,
      configured: false,
      stopped: false,
      transport: undefined,
      toolCount: 0,
      resourceCount: 0,
      promptCount: 0,
    }
  }

  /** The underlying MCP protocol server instance. Created during configure(). */
  get mcpServer(): MCPProtocolServer {
    if (!this._mcpServer) {
      this.configure()
    }
    return this._mcpServer!
  }

  /** The handler context passed to all tool, resource, and prompt handlers. */
  get handlerContext(): MCPContext {
    return { container: this.container }
  }

  /**
   * Register an MCP tool. The tool's Zod schema is converted to JSON Schema
   * for the protocol listing, and used for runtime argument validation.
   *
   * Tool handlers can return a string (auto-wrapped as text content) or a
   * full CallToolResult object for advanced responses (images, errors, etc).
   *
   * @param name - Unique tool name
   * @param options - Tool schema, description, and handler
   */
  tool(name: string, options: ToolRegistrationOptions): this {
    let jsonSchema: Record<string, any> | undefined

    if (options.schema) {
      const full = (options.schema as any).toJSONSchema() as Record<string, any>
      jsonSchema = {
        type: full.type || 'object',
        properties: full.properties || {},
        ...(full.required ? { required: full.required } : {}),
      }
    }

    const registered: RegisteredTool = {
      name,
      description: options.description,
      schema: options.schema,
      jsonSchema,
      handler: options.handler,
    }

    this._tools.set(name, registered)
    this.state.set('toolCount', this._tools.size)
    this.emit('toolRegistered', name)

    return this
  }

  /**
   * Register an MCP resource. Resources expose data (files, configs, etc)
   * that AI clients can read by URI.
   *
   * Accepts either a handler function directly or an options object with
   * additional metadata (name, description, mimeType).
   *
   * @param uri - Unique resource URI (e.g. "project://readme")
   * @param handlerOrOptions - Handler function or options object with handler
   */
  resource(
    uri: string,
    handlerOrOptions: ResourceRegistrationOptions['handler'] | ResourceRegistrationOptions
  ): this {
    let registered: RegisteredResource

    if (typeof handlerOrOptions === 'function') {
      registered = { uri, handler: handlerOrOptions }
    } else {
      registered = {
        uri,
        name: handlerOrOptions.name,
        description: handlerOrOptions.description,
        mimeType: handlerOrOptions.mimeType,
        handler: handlerOrOptions.handler,
      }
    }

    this._resources.set(uri, registered)
    this.state.set('resourceCount', this._resources.size)
    this.emit('resourceRegistered', uri)

    return this
  }

  /**
   * Register an MCP prompt. Prompts are reusable message templates that
   * AI clients can invoke with optional string arguments.
   *
   * @param name - Unique prompt name
   * @param options - Prompt handler, optional args schema, and description
   */
  prompt(name: string, options: PromptRegistrationOptions): this {
    const registered: RegisteredPrompt = {
      name,
      description: options.description,
      args: options.args,
      handler: options.handler,
    }

    this._prompts.set(name, registered)
    this.state.set('promptCount', this._prompts.size)
    this.emit('promptRegistered', name)

    return this
  }

  /**
   * Configure the MCP protocol server and register all protocol handlers.
   * Called automatically before start() if not already configured.
   */
  override async configure() {
    if (this.isConfigured) return this

    const serverName = this.options.serverName || this.container.manifest?.name || 'luca-mcp'
    const serverVersion = this.options.serverVersion || this.container.manifest?.version || '1.0.0'

    this._mcpServer = new MCPProtocolServer(
      { name: serverName, version: serverVersion },
      {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
        },
      }
    )

    this._registerToolHandlers()
    this._registerResourceHandlers()
    this._registerPromptHandlers()

    this._mcpServer.onerror = (error) => {
      console.error('[MCP Server Error]', error)
    }

    this.state.set('configured', true)
    return this
  }

  /**
   * Start the MCP server with the specified transport.
   *
   * @param options - Transport configuration. Defaults to stdio.
   * @param options.transport - 'stdio' for CLI integration, 'http' for remote access
   * @param options.port - Port for HTTP transport (default 3001)
   */
  override async start(options?: { transport?: 'stdio' | 'http', port?: number, host?: string }) {
    if (this.isListening) return this
    if (!this.isConfigured) await this.configure()

    const transport = options?.transport || this.options.transport || 'stdio'

    if (transport === 'stdio') {
      const stdioTransport = new StdioServerTransport()
      await this.mcpServer.connect(stdioTransport)
      this.state.set('transport', 'stdio')
    } else if (transport === 'http') {
      const port = options?.port || this.options.port || 3001
      await this._startHTTPTransport(port)
      this.state.set('transport', 'http')
      this.state.set('port', port)
    }

    this.state.set('listening', true)
    return this
  }

  /**
   * Stop the MCP server and close all connections.
   */
  override async stop() {
    if (this.isStopped) return this

    if (this._mcpServer) {
      await this._mcpServer.close()
    }

    this.state.set('listening', false)
    this.state.set('stopped', true)
    return this
  }

  /** Register tools/list and tools/call protocol handlers on the MCP server. */
  private _registerToolHandlers() {
    this.mcpServer.setRequestHandler(ListToolsRequestSchema, async () => {
      const tools = Array.from(this._tools.values()).map((t) => ({
        name: t.name,
        description: t.description || '',
        inputSchema: t.jsonSchema || { type: 'object' as const, properties: {} },
      }))

      return { tools }
    })

    this.mcpServer.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args = {} } = request.params

      const tool = this._tools.get(name)
      if (!tool) {
        return {
          content: [{ type: 'text' as const, text: `Unknown tool: ${name}` }],
          isError: true,
        }
      }

      try {
        // Validate arguments with Zod schema if provided
        const validatedArgs = tool.schema ? tool.schema.parse(args) : args

        this.emit('toolCalled', name, validatedArgs)

        const result = await tool.handler(validatedArgs, this.handlerContext)

        // Auto-wrap string results into text content
        if (typeof result === 'string') {
          return {
            content: [{ type: 'text' as const, text: result }],
          }
        }

        // Assume it's already a CallToolResult
        return result as CallToolResult
      } catch (error: any) {
        return {
          content: [{ type: 'text' as const, text: `Error calling tool ${name}: ${error.message}` }],
          isError: true,
        }
      }
    })
  }

  /** Register resources/list and resources/read protocol handlers on the MCP server. */
  private _registerResourceHandlers() {
    this.mcpServer.setRequestHandler(ListResourcesRequestSchema, async () => {
      const resources = Array.from(this._resources.values()).map((r) => ({
        uri: r.uri,
        name: r.name || r.uri,
        description: r.description,
        mimeType: r.mimeType,
      }))

      return { resources }
    })

    this.mcpServer.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params

      const resource = this._resources.get(uri)
      if (!resource) {
        throw new Error(`Unknown resource: ${uri}`)
      }

      const text = await resource.handler(uri, this.handlerContext)

      return {
        contents: [{
          uri,
          mimeType: resource.mimeType || 'text/plain',
          text,
        }],
      }
    })
  }

  /** Register prompts/list and prompts/get protocol handlers on the MCP server. */
  private _registerPromptHandlers() {
    this.mcpServer.setRequestHandler(ListPromptsRequestSchema, async () => {
      const prompts = Array.from(this._prompts.values()).map((p) => ({
        name: p.name,
        description: p.description,
        arguments: p.args
          ? Object.entries(p.args).map(([argName, schema]) => ({
              name: argName,
              description: (schema as any)._zod?.def?.description || '',
              required: !(schema as any).isOptional?.(),
            }))
          : undefined,
      }))

      return { prompts }
    })

    this.mcpServer.setRequestHandler(GetPromptRequestSchema, async (request) => {
      const { name, arguments: args = {} } = request.params

      const prompt = this._prompts.get(name)
      if (!prompt) {
        throw new Error(`Unknown prompt: ${name}`)
      }

      const messages = await prompt.handler(args as Record<string, string | undefined>, this.handlerContext)

      return {
        messages: messages.map((m) => ({
          role: m.role,
          content: { type: 'text' as const, text: m.content },
        })),
      }
    })
  }

  /** Start an HTTP transport using StreamableHTTPServerTransport. */
  private async _startHTTPTransport(port: number) {
    const { createServer } = await import('node:http')
    const { StreamableHTTPServerTransport } = await import(
      '@modelcontextprotocol/sdk/server/streamableHttp.js'
    )
    const { randomUUID } = await import('node:crypto')

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
    })

    const httpServer = createServer(async (req, res) => {
      // Only handle the /mcp path
      const url = new URL(req.url || '/', `http://localhost:${port}`)

      if (url.pathname === '/mcp') {
        // Parse body for POST requests
        if (req.method === 'POST') {
          const chunks: Buffer[] = []
          for await (const chunk of req) {
            chunks.push(chunk as Buffer)
          }
          const body = JSON.parse(Buffer.concat(chunks).toString())
          await transport.handleRequest(req, res, body)
        } else {
          await transport.handleRequest(req, res)
        }
      } else {
        res.writeHead(404)
        res.end('Not found')
      }
    })

    await this.mcpServer.connect(transport)

    await new Promise<void>((resolve) => {
      httpServer.listen(port, () => resolve())
    })
  }
}

servers.register('mcp', MCPServer)

export default MCPServer
