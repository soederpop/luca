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

/** Wraps a raw JSON Schema object so it satisfies MCPServer.tool()'s schema interface. */
function bridgeSchema(params: Record<string, any>) {
	return { toJSONSchema: () => params, parse: (a: any) => a } as any
}

export const argsSchema = CommandOptionsSchema.extend({
	transport: z.enum(['stdio', 'http']).default('stdio').describe('Transport type (stdio or http)'),
	port: z.number().default(3001).describe('Port for HTTP transport'),
	name: z.string().optional().describe('Server name reported to MCP clients'),
	version: z.string().optional().describe('Server version reported to MCP clients'),
	mcpCompat: z.enum(['standard', 'codex']).optional()
		.describe('HTTP compatibility profile. Defaults to standard. Can also be set via MCP_HTTP_COMPAT.'),
	stdioCompat: z.enum(['standard', 'codex', 'auto']).optional()
		.describe('Stdio framing compatibility profile. Defaults to standard. Can also be set via MCP_STDIO_COMPAT.'),
	assistant: z.string().optional().describe('Name of a local assistant whose tools to expose as MCP tools'),
})

export default async function mcp(options: z.infer<typeof argsSchema>, context: ContainerContext) {
	const container = context.container as any
	const envCompat = process.env.MCP_HTTP_COMPAT?.toLowerCase()
	const resolvedCompat = options.mcpCompat || (envCompat === 'codex' ? 'codex' : 'standard')
	const envStdioCompat = process.env.MCP_STDIO_COMPAT?.toLowerCase()
	const resolvedStdioCompat = options.stdioCompat
		|| (envStdioCompat === 'codex' || envStdioCompat === 'auto' ? envStdioCompat : 'standard')

	const mcpServer = container.server('mcp', {
		transport: options.transport,
		port: options.port,
		serverName: options.name || options.assistant || container.manifest?.name || 'luca-mcp',
		serverVersion: options.version || container.manifest?.version || '1.0.0',
		mcpCompat: options.mcpCompat,
		stdioCompat: options.stdioCompat,
	}) as MCPServer

	if (options.assistant) {
		const manager = container.feature('assistantsManager')
		await manager.discover()

		const allEntries = manager.list()
		if (!allEntries.some((e: any) => e.name === options.assistant)) {
			const available = allEntries.map((e: any) => e.name).join(', ')
			console.error(`Assistant "${options.assistant}" not found. Available: ${available || '(none)'}`)
			process.exit(1)
		}

		const asst = manager.create(options.assistant, { historyMode: 'lifecycle' })
		await asst.start()

		const tools: Record<string, any> = asst.tools
		const existingReadme = tools['README']

		// README tool: system prompt concatenated with any existing README tool output
		mcpServer.tool('README', {
			schema: z.object({}),
			description: `System prompt and capabilities of the ${options.assistant} assistant`,
			handler: async () => {
				let content: string = asst.effectiveSystemPrompt
				if (existingReadme) {
					const raw = await existingReadme.handler({})
					if (raw != null) {
						// Unwrap CallToolResult shape if the handler returned one
						const extra = (raw && typeof raw === 'object' && Array.isArray(raw.content))
							? raw.content.map((c: any) => c.text || '').join('\n')
							: typeof raw === 'string' ? raw : JSON.stringify(raw, null, 2)
						content += '\n\n---\n\n' + extra
					}
				}
				return content
			},
		})

		for (const [toolName, tool] of Object.entries(tools)) {
			if (toolName === 'README') continue
			mcpServer.tool(toolName, {
				schema: bridgeSchema((tool as any).parameters),
				description: (tool as any).description,
				handler: async (args: any) => {
					const result = await (tool as any).handler(args)
					return typeof result === 'string' ? result : JSON.stringify(result, null, 2)
				},
			})
		}
	}

	await mcpServer.start({
		transport: options.transport,
		port: options.port,
		mcpCompat: options.mcpCompat,
		stdioCompat: options.stdioCompat,
	})

	if (options.transport === 'http') {
		const displayName = options.name || options.assistant || container.manifest?.name || 'MCP Server'
		console.log(`\n${displayName} listening on http://localhost:${options.port}/mcp`)
		console.log(`Transport: HTTP (Streamable)`)
		console.log(`Compatibility: ${resolvedCompat}`)
	} else {
		// stdio mode — don't print to stdout as it's used for the protocol
		console.error(`MCP server started (stdio transport)`)
		if (options.assistant) console.error(`Assistant: ${options.assistant}`)
		console.error(`Stdio Compatibility: ${resolvedStdioCompat}`)
	}
}

commands.registerHandler('mcp', {
	description: 'Start an MCP (Model Context Protocol) server',
	argsSchema,
	handler: mcp,
})
