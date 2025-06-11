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

import type { NodeContainer } from '../node/container.js'
import { servers, type StartOptions, Server, type ServersInterface, type ServerState, type ServerOptions } from '../server/server.js';

declare module '../server/index' {
  interface AvailableServers {
    mcp: typeof McpServer 
  }
}

export interface McpServerOptions extends ServerOptions {
	serverName?: string;
	version?: string;	
	instructions?: string;
}

export interface McpServerState extends ServerState {
	started: boolean;
}

export class McpServer<T extends McpServerState = McpServerState, K extends McpServerOptions = McpServerOptions> extends Server<T,K> {
    static override shortcut = 'servers.mcp' as const

		static override attach(container: NodeContainer & ServersInterface) {
			servers.register('mcp', McpServer)	
			return container
		}

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

		async handleListResources(request: ListResourcesRequest) : Promise<ListResourcesResult> {
			return {
				resources: [],
				nextCursor: undefined
			}
		}

		async handleListResourceTemplates(request: ListResourceTemplatesRequest) {
			return {
				resourceTemplates: []
			}
		}

		async handleReadResource(request: ReadResourceRequest) : Promise<ReadResourceResult> {
			return {
				contents: []
			}
		}

		async handleSubscribe(request: SubscribeRequest) {
			return {}
		}

		async handleUnsubscribe(request: UnsubscribeRequest) {
			return {}
		}

		async handleListPrompts(request: ListPromptsRequest) : Promise<ListPromptsResult> {
			return {
				prompts: []
			}
		}

		async handleGetPrompt(request: GetPromptRequest) {
			return {
				messages: []
			}
		}

		async handleListTools(request: ListToolsRequest) {
			return {
				tools: []
			}
		}

		async handleCallTool(request: CallToolRequest) : Promise<CallToolResult> {
			return {
				content: []
			}
		}

		async handleComplete(request: CompleteRequest) : Promise<CompleteResult> {
			return {
				completion: {
					values: [],
				}
			}
		}

		async handleSetLevel(request: SetLevelRequest) {
			return {}
		}

		// Helper methods for tool and resource registration
		tool<T extends ZodRawShape>(
			name: string,
			inputSchema: z.ZodObject<T>,
			description: string,
			handler: (args: z.infer<z.ZodObject<T>>) => Promise<CallToolResult>
		) {
			// TODO: Store tool registration for handleListTools and handleCallTool
		}

		resource(
			name: string,
			uri: string,
			handler: () => Promise<Resource>
		) {
			// TODO: Store resource registration for handleListResources and handleReadResource  
		}

		prompt(
			name: string,
			description: string,
			handler: (args?: any) => Promise<any>
		) {
			// TODO: Store prompt registration for handleListPrompts and handleGetPrompt
		}
}

export default McpServer

/*
// Add an addition tool
server.tool("add",
  { a: z.number(), b: z.number() },
  async ({ a, b }) => ({
    content: [{ type: "text", text: String(a + b) }]
  })
);

// Add a dynamic greeting resource
server.resource(
  "greeting",
  new ResourceTemplate("greeting://{name}", { list: undefined }),
  async (uri, { name }) => ({
    contents: [{
      uri: uri.href,
      text: `Hello, ${name}!`
    }]
  })
);

// Start receiving messages on stdin and sending messages on stdout
const transport = new StdioServerTransport();
await server.connect(transport);
*/