import { Server as McpServerBase } from "@modelcontextprotocol/sdk/server/index.js";
import {
  CallToolRequestSchema,
  type CallToolResult,
  type CallToolRequest,
  CompleteRequestSchema,
  type CompleteResult,
  type CompleteRequest,
  type CreateMessageRequest,
  CreateMessageResultSchema,
  GetPromptRequestSchema,
  type GetPromptRequest,
  ListPromptsRequestSchema,
  type ListPromptsResult,
  type ListPromptsRequest,
  ListResourcesRequestSchema,
  type ListResourcesResult,
  type ListResourcesRequest,
  ListResourceTemplatesRequestSchema,
  type ListResourceTemplatesRequest,
  ListToolsRequestSchema,
  type ListToolsRequest,
  type LoggingLevel,
  ReadResourceRequestSchema,
  type ReadResourceResult,
  type ReadResourceRequest,
  type Resource,
  SetLevelRequestSchema,
  type SetLevelRequest,
  SubscribeRequestSchema,
  type SubscribeRequest,
  type Tool,
  ToolSchema,
  UnsubscribeRequestSchema,
  type UnsubscribeRequest,
} from "@modelcontextprotocol/sdk/types.js";

import type { ZodRawShape } from "zod";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { ServerStateSchema, ServerOptionsSchema } from '../schemas/base.js'

import type { NodeContainer } from '../node/container.js'
import { servers, type StartOptions, Server, type ServersInterface } from '../server/server.js';

declare module '../server/index' {
  interface AvailableServers {
    mcp: typeof McpServer
  }
}

export const McpServerOptionsSchema = ServerOptionsSchema.extend({
	serverName: z.string().optional().describe('Display name for the MCP server'),
	version: z.string().optional().describe('Semantic version string for the MCP server'),
	instructions: z.string().optional().describe('Instructions text provided to MCP clients'),
})
export type McpServerOptions = z.infer<typeof McpServerOptionsSchema>

export const McpServerStateSchema = ServerStateSchema.extend({
	started: z.boolean().default(false).describe('Whether the MCP server has been started'),
})
export type McpServerState = z.infer<typeof McpServerStateSchema>

export class McpServer<T extends McpServerState = McpServerState, K extends McpServerOptions = McpServerOptions> extends Server<T,K> {
    static override shortcut = 'servers.mcp' as const
    static override stateSchema = McpServerStateSchema
    static override optionsSchema = McpServerOptionsSchema

		static override attach(container: NodeContainer & ServersInterface) {
			servers.register('mcp', McpServer)	
			return container
		}

		// Store registered tools
		private _tools = new Map<string, {
			schema: z.ZodObject<any>,
			description: string,
			handler: (args: any) => Promise<CallToolResult>
		}>()

		// Store registered prompts
		private _prompts = new Map<string, {
			description: string,
			schema?: z.ZodObject<any>,
			handler: (args?: any) => Promise<any>
		}>()

		// Store registered resources
		private _resources = new Map<string, {
			name?: string,
			description?: string,
			mimeType?: string,
			handler: () => Promise<Resource>
		}>()

		// Store resource templates
		private _resourceTemplates = new Map<string, {
			name: string,
			description?: string,
			handler: (uri: string, params: Record<string, string>) => Promise<Resource>
		}>()

		override async start(options?: StartOptions) {
			if(this.state.get('started')) {
				return this
			}	

			this.state.set('started', true)

			const transport = new StdioServerTransport();
			await this.server.connect(transport);

			return this
		}

		get z() : typeof z {
			return z
		}

		// this needs to log as a json rcp style message
		log(message: any) {
			this.server.notification({
				method: "notifications/message",
				params: {
					level: "info",
					content: typeof message === "string" ? message : JSON.stringify(message, null, 2)
				}
			})
		}

		_server?: McpServerBase

		get server() : McpServerBase {
			if (this._server) {
				return this._server
			}	

			const server = this._server = new McpServerBase(
				{
					name: this.options.serverName || "luca2-mcp-server",
					version: this.options.version || "1.0.0",
				},
				{
					capabilities: {
						prompts: {},
						resources: { subscribe: true },
						tools: {},
						logging: {},
						completions: {},
					},
				}
			);

			// Set up all request handlers
			server.setRequestHandler(ListResourcesRequestSchema, async (request) => {
				return this.handleListResources(request)
			})

			server.setRequestHandler(ListResourceTemplatesRequestSchema, async (request) => {
				return this.handleListResourceTemplates(request)
			})

			server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
				return this.handleReadResource(request)
			})

			server.setRequestHandler(SubscribeRequestSchema, async (request) => {
				return this.handleSubscribe(request)
			})

			server.setRequestHandler(UnsubscribeRequestSchema, async (request) => {
				return this.handleUnsubscribe(request)
			})

			server.setRequestHandler(ListPromptsRequestSchema, async (request) => {
				return this.handleListPrompts(request)
			})

			server.setRequestHandler(GetPromptRequestSchema, async (request) => {
				return this.handleGetPrompt(request)
			})

			server.setRequestHandler(ListToolsRequestSchema, async (request) => {
				return this.handleListTools(request)
			})

			server.setRequestHandler(CallToolRequestSchema, async (request) => {
				return this.handleCallTool(request)
			})

			server.setRequestHandler(CompleteRequestSchema, async (request) => {
				return this.handleComplete(request)
			})

			server.setRequestHandler(SetLevelRequestSchema, async (request) => {
				return this.handleSetLevel(request)
			})

			return server
		}

		private _completions = new Map<string, {
			handler: (argName: string, argValue: string) => Promise<string[]>,
			ref: string
		}>()

		async completion(ref: string, handler: (argName: string, argValue: string) => Promise<string[]>) {
			this._completions.set(ref, {
				handler,
				ref
			})
		}

		async handleListResources(request: ListResourcesRequest) : Promise<ListResourcesResult> {
			// Get all registered static resources
			const staticResources = await Promise.all(
				Array.from(this._resources.entries()).map(async ([uri, resource]) => {
					const result = await resource.handler()
					return {
						...result,
						uri: result.uri || uri,
						name: result.name || resource.name || uri,
						description: result.description || resource.description,
						mimeType: result.mimeType || resource.mimeType
					}
				})
			)

			// Simple pagination support
			const cursor = request.params?.cursor
			let startIndex = 0
			const pageSize = 50 // Configurable page size

			if (cursor) {
				try {
					startIndex = parseInt(atob(cursor), 10)
				} catch {
					// Invalid cursor, start from beginning
					startIndex = 0
				}
			}

			const endIndex = Math.min(startIndex + pageSize, staticResources.length)
			const paginatedResources = staticResources.slice(startIndex, endIndex)

			let nextCursor: string | undefined
			if (endIndex < staticResources.length) {
				nextCursor = btoa(endIndex.toString())
			}

			return {
				resources: paginatedResources,
				nextCursor
			}
		}

		async handleListResourceTemplates(request: ListResourceTemplatesRequest) {
			const templates = Array.from(this._resourceTemplates.entries()).map(([uriTemplate, template]) => ({
				uriTemplate,
				name: template.name,
				description: template.description
			}))

			return {
				resourceTemplates: templates
			}
		}

		async handleReadResource(request: ReadResourceRequest) : Promise<ReadResourceResult> {
			const uri = request.params.uri

			// Check static resources first
			if (this._resources.has(uri)) {
				const resource = this._resources.get(uri)!
				const result = await resource.handler()
				return {
					contents: [result as any]
				}
			}

			// Check resource templates
			for (const [uriTemplate, template] of this._resourceTemplates.entries()) {
				const params = this.matchUriTemplate(uriTemplate, uri)
				if (params) {
					const result = await template.handler(uri, params)
					return {
						contents: [result as any]
					}
				}
			}

			throw new Error(`Unknown resource: ${uri}`)
		}

		async handleSubscribe(request: SubscribeRequest) {
			return {}
		}

		async handleUnsubscribe(request: UnsubscribeRequest) {
			return {}
		}

		async handleListPrompts(request: ListPromptsRequest) : Promise<ListPromptsResult> {
			const prompts = Array.from(this._prompts.entries()).map(([name, prompt]) => ({
				name,
				description: prompt.description,
				arguments: prompt.schema ? this.zodToArgumentsArray(prompt.schema) : undefined
			}))

			return {
				prompts
			}
		}

		async handleGetPrompt(request: GetPromptRequest) {
			const promptName = request.params.name
			const prompt = this._prompts.get(promptName)
			
			if (!prompt) {
				throw new Error(`Unknown prompt: ${promptName}`)
			}

			// Validate arguments against the schema if one exists
			let validatedArgs = request.params.arguments
			if (prompt.schema) {
				validatedArgs = prompt.schema.parse(request.params.arguments || {})
			}

			// Call the handler with validated arguments
			const result = await prompt.handler(validatedArgs)
			
			return {
				messages: result.messages || []
			}
		}

		async handleListTools(request: ListToolsRequest) {
			const tools: Tool[] = Array.from(this._tools.entries()).map(([name, tool]) => ({
				name,
				description: tool.description,
				inputSchema: tool.schema.toJSONSchema() as any
			}))

			return {
				tools
			}
		}

		async handleCallTool(request: CallToolRequest) : Promise<CallToolResult> {
			const toolName = request.params.name
			const tool = this._tools.get(toolName)
			
			if (!tool) {
				throw new Error(`Unknown tool: ${toolName}`)
			}

			// Validate arguments against the schema
			const validatedArgs = tool.schema.parse(request.params.arguments || {})
			
			// Call the handler with validated arguments
			return await tool.handler(validatedArgs)
		}

		async handleComplete(request: CompleteRequest) : Promise<CompleteResult> {
			const { ref, argument } = request.params	
		

			if (ref.type === "ref/resource") {
				const argName = argument.name
				const argValue = argument.value
				const uri = ref.uri

				// if the uri is a template, we need to get the resource names
				// that match the template, the arg name is the parameter name
				// and the arg value is what they've typed so far 

				if (this._completions.has(uri)) {
					const completion = this._completions.get(uri)!
					return {
						completion: {
							values: await completion.handler(argName, argValue),
						}
					}
				} else if (!uri.match(/\{/)){
					const resourceNames = Array.from(this._resources.keys())
					const filtered = resourceNames.filter(name => !argValue || argValue === '' || String(name).toLowerCase().startsWith(argValue.toLowerCase()))
					return {
						completion: {
							values: filtered,
							total: filtered.length,
							hasMore: false
						}
					}
				} else {
					return {
						completion: {
							values: [],
						}
					}
				}
			}

			if (ref.type === "ref/prompt") {
				const promptName = ref.name
				if (!promptName) return { completion: { values: [] } };
				const promptNames = Array.from(this._prompts.keys())

				return {
					completion: {
						values: promptNames,
						total: promptNames.length,
						hasMore: false
					}
				}
			}

			return {
				completion: {
					values: [],
				}
			}
		}

		async handleSetLevel(request: SetLevelRequest) {
			return {}
		}


		// Helper method to convert Zod schema to MCP arguments array
		private zodToArgumentsArray(schema: z.ZodObject<any>): any[] {
			const shape = schema.shape
			const argumentsArray: any[] = []

			for (const [key, value] of Object.entries(shape)) {
				const zodType = value as z.ZodTypeAny
				const isRequired = !(zodType instanceof z.ZodOptional)
				
				let argType = "string" // default
				if (zodType instanceof z.ZodString) {
					argType = "string"
				} else if (zodType instanceof z.ZodNumber) {
					argType = "number"
				} else if (zodType instanceof z.ZodBoolean) {
					argType = "boolean"
				} else if (zodType instanceof z.ZodArray) {
					argType = "array"
				} else if (zodType instanceof z.ZodObject) {
					argType = "object"
				}

				argumentsArray.push({
					name: key,
					description: `Parameter ${key}`,
					required: isRequired
				})
			}

			return argumentsArray
		}

		// Helper method to match URI templates (simple implementation)
		private matchUriTemplate(template: string, uri: string): Record<string, string> | null {
			// Convert template to regex (simple implementation)
			// Replace {param} with capture groups
			const regexPattern = template.replace(/\{([^}]+)\}/g, '([^/]+)')
			const regex = new RegExp(`^${regexPattern}$`)
			
			const match = uri.match(regex)
			if (!match) return null
			
					// Extract parameter names from template
		const paramNames: string[] = []
		let paramMatch: RegExpExecArray | null
		const paramRegex = /\{([^}]+)\}/g
		while ((paramMatch = paramRegex.exec(template)) !== null) {
			if (paramMatch[1]) {
				paramNames.push(paramMatch[1])
			}
		}
			
			// Build params object
			const params: Record<string, string> = {}
			for (let i = 0; i < paramNames.length; i++) {
				if (match[i + 1] !== undefined) {
					// @ts-ignore	
					params[paramNames[i]] = match[i + 1]
				}
			}
			
			return params
		}

		// Helper methods for tool and resource registration
		tool<T extends ZodRawShape>(
			name: string,
			inputSchema: z.ZodObject<T>,
			description: string,
			handler: (args: z.infer<z.ZodObject<T>>) => Promise<CallToolResult>
		) {
			this._tools.set(name, {
				schema: inputSchema,
				description,
				handler
			})
			return this
		}

		resource(
			uri: string,
			handler: () => Promise<Resource>
		): this
		resource(
			uri: string,
			name: string,
			handler: () => Promise<Resource>
		): this  
		resource(
			uri: string,
			nameOrHandler: string | (() => Promise<Resource>),
			handler?: () => Promise<Resource>
		) {
			let actualHandler: () => Promise<Resource>
			let name: string | undefined

			if (typeof nameOrHandler === 'string') {
				name = nameOrHandler
				actualHandler = handler!
			} else {
				actualHandler = nameOrHandler
			}

			this._resources.set(uri, {
				name,
				handler: actualHandler
			})
			
			return this
		}

		resourceTemplate(
			uriTemplate: string,
			name: string,
			handler: (uri: string, params: Record<string, string>) => Promise<Resource>
		): this
		resourceTemplate(
			uriTemplate: string,
			name: string,
			description: string,
			handler: (uri: string, params: Record<string, string>) => Promise<Resource>
		): this
		resourceTemplate(
			uriTemplate: string,
			name: string,
			descriptionOrHandler: string | ((uri: string, params: Record<string, string>) => Promise<Resource>),
			handler?: (uri: string, params: Record<string, string>) => Promise<Resource>
		) {
			let actualHandler: (uri: string, params: Record<string, string>) => Promise<Resource>
			let description: string | undefined

			if (typeof descriptionOrHandler === 'string') {
				description = descriptionOrHandler
				actualHandler = handler!
			} else {
				actualHandler = descriptionOrHandler
			}

			this._resourceTemplates.set(uriTemplate, {
				name,
				description,
				handler: actualHandler
			})

			return this
		}

		prompt<T extends ZodRawShape>(
			name: string,
			description: string,
			handler: (args?: any) => Promise<any>
		): this
		prompt<T extends ZodRawShape>(
			name: string,
			description: string,
			schema: z.ZodObject<T>,
			handler: (args: z.infer<z.ZodObject<T>>) => Promise<any>
		): this
		prompt<T extends ZodRawShape>(
			name: string,
			description: string,
			schemaOrHandler: z.ZodObject<T> | ((args?: any) => Promise<any>),
			handler?: (args: z.infer<z.ZodObject<T>>) => Promise<any>
		) {
			// Handle overloaded parameters
			let schema: z.ZodObject<T> | undefined
			let actualHandler: (args?: any) => Promise<any>

			if (typeof schemaOrHandler === 'function') {
				// No schema provided, schemaOrHandler is the handler
				schema = undefined
				actualHandler = schemaOrHandler
			} else {
				// Schema provided, handler is the fourth parameter
				schema = schemaOrHandler
				actualHandler = handler!
			}

			this._prompts.set(name, {
				description,
				schema,
				handler: actualHandler
			})
			return this
		}
}

export default McpServer

/*
// Example usage:

// Add a static resource
server.resource("hello://world", async () => ({
	uri: "hello://world",
	name: "Hello World",
	mimeType: "text/plain", 
	text: "Hello, World!"
}))

// Add a resource template
server.resourceTemplate(
	"greeting://{name}",
	"Dynamic Greeting", 
	async (uri, { name }) => ({
		uri,
		name: `Greeting for ${name}`,
		mimeType: "text/plain",
		text: `Hello, ${name}!`
	})
)

// Add a tool
server.tool("add",
  server.z.object({ a: server.z.number(), b: server.z.number() }),
  "Adds two numbers",
  async ({ a, b }) => ({
    content: [{ type: "text", text: String(a + b) }]
  })
);

// Start the server
const transport = new StdioServerTransport();
await server.connect(transport);
*/