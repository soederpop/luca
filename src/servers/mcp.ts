import { McpServer as McpServerBase, ResourceTemplate, type PromptCallback, type ReadResourceCallback, type ReadResourceTemplateCallback, type ToolCallback } from "@modelcontextprotocol/sdk/server/mcp.js";
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

		get ResourceTemplate() {
			return ResourceTemplate
		}

		_server?: McpServerBase

		get server() : McpServerBase {
			if (this._server) {
				return this._server
			}	
			// Create an MCP server
			const server = this._server = new McpServerBase({
				name: this.options.serverName || "MCP Server",
				version: this.options.version || "1.0.0"
			}, {
				instructions: this.options.instructions || "This is a demo MCP server"
			});

			return server
		}

		// Overloads to match the underlying MCP server's resource method
		resource(name: string, uri: string, readCallback: ReadResourceCallback): this;
		resource(name: string, template: ResourceTemplate, readCallback: ReadResourceTemplateCallback): this;
		resource(name: string, uriOrTemplate: string | ResourceTemplate, callback: ReadResourceCallback | ReadResourceTemplateCallback): this {
			this.server.resource(name, uriOrTemplate as any, callback as any)
			return this
		}

		// Overloads to match the underlying MCP server's tool method
		tool(name: string, description: string, callback: ToolCallback): this;
		tool(name: string, paramsSchema: ZodRawShape, callback: ToolCallback): this;
		tool(name: string, descriptionOrSchema: string | ZodRawShape, callback: ToolCallback): this {
			this.server.tool(name, descriptionOrSchema as any, callback as any)
			return this
		}

		prompt(name: string, description: string, callback: PromptCallback): this;
		prompt(name: string, paramsSchema: ZodRawShape, callback: PromptCallback): this;
		prompt(name: string, descriptionOrSchema: string | ZodRawShape, callback: PromptCallback): this {
			this.server.prompt(name, descriptionOrSchema as any, callback as any)
			return this
		}

		override async configure() {
			return this
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