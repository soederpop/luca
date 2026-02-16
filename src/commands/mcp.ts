import { z } from 'zod'
import { commands } from '../command.js'
import { CommandOptionsSchema } from '../schemas/base.js'
import type { ContainerContext } from '../container.js'
import type { MCPServer } from '../servers/mcp.js'

declare module '../command.js' {
	interface AvailableCommands {
		mcp: ReturnType<typeof commands.registerHandler>
	}
}

export const argsSchema = CommandOptionsSchema.extend({
	transport: z.enum(['stdio', 'http']).default('stdio').describe('Transport type (stdio or http)'),
	port: z.number().default(3001).describe('Port for HTTP transport'),
	name: z.string().optional().describe('Server name reported to MCP clients'),
	version: z.string().optional().describe('Server version reported to MCP clients'),
})

export default async function mcp(options: z.infer<typeof argsSchema>, context: ContainerContext) {
	const container = context.container as any

	const mcpServer = container.server('mcp', {
		transport: options.transport,
		port: options.port,
		serverName: options.name || container.manifest?.name || 'luca-mcp',
		serverVersion: options.version || container.manifest?.version || '1.0.0',
	}) as MCPServer

	await mcpServer.start({
		transport: options.transport,
		port: options.port,
	})

	if (options.transport === 'http') {
		const name = options.name || container.manifest?.name || 'MCP Server'
		console.log(`\n${name} listening on http://localhost:${options.port}/mcp`)
		console.log(`Transport: HTTP (Streamable)`)
	} else {
		// stdio mode — don't print to stdout as it's used for the protocol
		console.error(`MCP server started (stdio transport)`)
	}
}

commands.registerHandler('mcp', {
	description: 'Start an MCP (Model Context Protocol) server',
	argsSchema,
	handler: mcp,
})
