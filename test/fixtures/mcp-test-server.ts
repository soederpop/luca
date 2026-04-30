/**
 * Minimal MCP server for testing the McpBridge feature.
 * Uses the low-level Server class with the SDK's own request schemas
 * (which are Zod v3) to avoid Zod v3/v4 conflicts.
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
	ListToolsRequestSchema,
	CallToolRequestSchema,
	ListResourcesRequestSchema,
	ReadResourceRequestSchema,
	ListPromptsRequestSchema,
	GetPromptRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'

const server = new Server(
	{ name: 'test-server', version: '1.0.0' },
	{
		capabilities: {
			tools: {},
			resources: {},
			prompts: {},
		},
	},
)

const TOOLS = [
	{
		name: 'echo',
		description: 'Echo a message back',
		inputSchema: {
			type: 'object' as const,
			properties: { message: { type: 'string', description: 'The message to echo' } },
			required: ['message'],
		},
	},
	{
		name: 'add',
		description: 'Add two numbers',
		inputSchema: {
			type: 'object' as const,
			properties: {
				a: { type: 'number', description: 'First number' },
				b: { type: 'number', description: 'Second number' },
			},
			required: ['a', 'b'],
		},
	},
	{
		name: 'greet',
		description: 'Greet someone',
		inputSchema: {
			type: 'object' as const,
			properties: { name: { type: 'string', description: 'Name to greet' } },
		},
	},
]

server.setRequestHandler(ListToolsRequestSchema, async () => ({
	tools: TOOLS,
}))

server.setRequestHandler(CallToolRequestSchema, async (request) => {
	const { name, arguments: args } = request.params

	switch (name) {
		case 'echo':
			return { content: [{ type: 'text' as const, text: `echo: ${(args as any).message}` }] }
		case 'add':
			return { content: [{ type: 'text' as const, text: String((args as any).a + (args as any).b) }] }
		case 'greet':
			return { content: [{ type: 'text' as const, text: `Hello, ${(args as any)?.name || 'world'}!` }] }
		default:
			return { content: [{ type: 'text' as const, text: `Unknown tool: ${name}` }], isError: true }
	}
})

server.setRequestHandler(ListResourcesRequestSchema, async () => ({
	resources: [
		{ uri: 'test://readme', name: 'README', description: 'A test readme resource' },
	],
}))

server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
	const { uri } = request.params
	if (uri === 'test://readme') {
		return { contents: [{ uri, text: 'This is a test README.' }] }
	}
	return { contents: [{ uri, text: `Unknown resource: ${uri}` }] }
})

server.setRequestHandler(ListPromptsRequestSchema, async () => ({
	prompts: [
		{
			name: 'test-prompt',
			description: 'A test prompt',
			arguments: [{ name: 'topic', description: 'The topic', required: true }],
		},
	],
}))

server.setRequestHandler(GetPromptRequestSchema, async (request) => {
	const { name, arguments: args } = request.params
	if (name === 'test-prompt') {
		return {
			description: 'A test prompt',
			messages: [{ role: 'user' as const, content: { type: 'text' as const, text: `Tell me about ${(args as any)?.topic || 'testing'}` } }],
		}
	}
	return { description: 'Unknown prompt', messages: [] }
})

const transport = new StdioServerTransport()
await server.connect(transport)
