import { z } from 'zod'
import { commands } from '../command.js'
import { CommandOptionsSchema } from '../schemas/base.js'
import type { ContainerContext } from '../container.js'
import type { MCPServer } from '../servers/mcp.js'

declare module '../command.js' {
	interface AvailableCommands {
		'mcp-sandbox': ReturnType<typeof commands.registerHandler>
	}
}

export const argsSchema = CommandOptionsSchema.extend({
	transport: z.enum(['stdio', 'http']).default('stdio').describe('Transport type (stdio or http)'),
	port: z.number().default(3002).describe('Port for HTTP transport'),
})

export default async function mcpSandbox(options: z.infer<typeof argsSchema>, context: ContainerContext) {
	const container = context.container as any

	const mcpServer = container.server('mcp', {
		transport: options.transport,
		port: options.port,
		serverName: 'luca-sandbox',
		serverVersion: container.manifest?.version || '1.0.0',
	}) as MCPServer

	// Persistent VM context shared across eval calls so variables survive between invocations
	const vmFeature = container.feature('vm')
	const sandboxContext = vmFeature.createContext({
		container,
		console: {
			log: (...args: any[]) => args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' '),
			error: (...args: any[]) => args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' '),
			warn: (...args: any[]) => args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' '),
		},
		setTimeout,
		setInterval,
		clearTimeout,
		clearInterval,
		fetch,
		Bun,
	})

	// Pre-populate sandbox with all enabled features
	for (const name of container.features.available) {
		try {
			vmFeature.runSync(`var ${name} = container.feature('${name}')`, sandboxContext)
		} catch {}
	}

	// --- Tool: eval ---
	mcpServer.tool('eval', {
		description: [
			'Evaluate JavaScript/TypeScript code in a Luca container sandbox.',
			'',
			'The sandbox has a live `container` object and all enabled features as top-level variables',
			'(e.g. `fs`, `git`, `ui`, `vm`, `proc`, `networking`, etc).',
			'',
			'Variables you define persist across calls, so you can build up state incrementally.',
			'',
			'The result of the last expression is returned. For async code, use `await`.',
			'',
			'Quick reference:',
			'  container.features.available    — list available feature names',
			'  container.clients.available     — list available client names',
			'  container.servers.available     — list available server names',
			'  container.commands.available    — list available command names',
			'  container.features.describe(n)  — get docs for a feature by name',
			'  container.clients.describe(n)   — get docs for a client by name',
			'  container.inspectAsText()       — full container introspection',
			'  fs.readFile(path)               — read a file',
			'  fs.readdir(dir)                 — list directory contents',
			'  proc.exec(cmd)                  — run a shell command',
		].join('\n'),
		schema: z.object({
			code: z.string().describe('JavaScript code to evaluate in the Luca container sandbox'),
		}),
		handler: async (args) => {
			try {
				// Wrap code containing top-level await in an async IIFE so the VM can handle it.
				// Try to return the last expression's value by prepending `return` to the last statement.
				let code = args.code
				if (/\bawait\b/.test(code) && !/^\s*\(?\s*async\b/.test(code)) {
					const lines = code.split('\n')
					const lastLine = lines[lines.length - 1]
					// If the last line doesn't start with a keyword that can't be returned, add return
					if (!/^\s*(var|let|const|if|for|while|switch|try|throw|class|function)\b/.test(lastLine)) {
						lines[lines.length - 1] = `return ${lastLine}`
					}
					code = `(async () => { ${lines.join('\n')} })()`
				}
				const result = await vmFeature.run(code, sandboxContext)

				let text: string
				if (result === undefined) {
					text = 'undefined'
				} else if (result === null) {
					text = 'null'
				} else if (typeof result === 'string') {
					text = result
				} else if (typeof result === 'object') {
					try {
						text = JSON.stringify(result, null, 2)
					} catch {
						text = String(result)
					}
				} else {
					text = String(result)
				}

				return { content: [{ type: 'text' as const, text }] }
			} catch (error: any) {
				return {
					content: [{ type: 'text' as const, text: `Error: ${error.message}\n\n${error.stack || ''}` }],
					isError: true,
				}
			}
		},
	})

	// --- Prompt: discover ---
	mcpServer.prompt('discover', {
		description: 'Learn how to explore the Luca container and discover available features, clients, servers, and commands.',
		handler: () => [{
			role: 'user' as const,
			content: [
				'# Luca Container Sandbox',
				'',
				'You have access to a live Luca container through the `eval` tool. The sandbox is a persistent JavaScript environment with a `container` global and all enabled features available as top-level variables.',
				'',
				'## Discovering what is available',
				'',
				'The container has registries for each helper type. Each registry has:',
				'- `.available` — array of registered names',
				'- `.describe(name)` — returns markdown docs for one helper',
				'- `.describeAll()` — returns markdown docs for all helpers',
				'',
				'### Registries',
				'```',
				'container.features.available   // Features (fs, git, ui, vm, proc, ...)',
				'container.clients.available    // Clients (rest, websocket, graphql, ...)',
				'container.servers.available    // Servers (express, mcp, socket, ...)',
				'container.commands.available   // Commands (run, console, serve, ...)',
				'```',
				'',
				'### Getting documentation',
				'```',
				'container.features.describe("fs")      // Docs for the fs feature',
				'container.features.describe("vm")      // Docs for the vm feature',
				'container.clients.describe("rest")     // Docs for the rest client',
				'container.inspectAsText()              // Full container introspection',
				'container.inspectAsText("methods")     // Just the methods section',
				'container.inspectAsText("state")       // Just the state section',
				'```',
				'',
				'### Using features directly',
				'All enabled features are available as top-level variables:',
				'```',
				'fs.readFile("package.json")            // Read a file',
				'fs.readdir("src")                         // List directory',
				'git.log({ max: 5 })                    // Recent git commits',
				'proc.exec("ls -la")                    // Run a shell command',
				'```',
				'',
				'### Persistent state',
				'Variables you define in one eval call persist to the next:',
				'```',
				'// Call 1',
				'const data = fs.readFile("package.json")',
				'// Call 2',
				'JSON.parse(data).name  // still has `data` from previous call',
				'```',
				'',
				'## Recommended first steps',
				'1. `container.features.available` — see what features exist',
				'2. Pick an interesting feature and `container.features.describe("name")` it',
				'3. Try using the feature directly',
			].join('\n'),
		}],
	})

	// --- Prompt: introspect ---
	mcpServer.prompt('introspect', {
		description: 'Get full introspection of the Luca container — all registries, state, methods, events, and environment info.',
		handler: async () => {
			const text = container.inspectAsText()
			return [{
				role: 'user' as const,
				content: `Here is the full container introspection:\n\n${text}`,
			}]
		},
	})

	// --- Resource: container-info ---
	mcpServer.resource('luca://container/info', {
		name: 'Container Info',
		description: 'Full introspection of the running Luca container',
		mimeType: 'text/markdown',
		handler: () => container.inspectAsText(),
	})

	// --- Resource: feature list ---
	mcpServer.resource('luca://features', {
		name: 'Available Features',
		description: 'List of all registered features with descriptions',
		mimeType: 'text/markdown',
		handler: () => {
			const lines = ['# Available Features\n']
			for (const name of container.features.available) {
				try {
					const Ctor = container.features.lookup(name) as any
					const desc = Ctor.description || ''
					lines.push(`- **${name}**: ${desc}`)
				} catch {
					lines.push(`- **${name}**`)
				}
			}
			return lines.join('\n')
		},
	})

	// Start the server
	await mcpServer.start({
		transport: options.transport,
		port: options.port,
	})

	if (options.transport === 'http') {
		console.log(`\nLuca Sandbox MCP listening on http://localhost:${options.port}/mcp`)
	} else {
		console.error(`Luca Sandbox MCP started (stdio transport)`)
		console.error(`Tools: eval | Prompts: discover, introspect | Resources: luca://container/info, luca://features`)
	}
}

commands.registerHandler('mcp-sandbox', {
	description: 'Start an MCP server with a Luca container sandbox for AI agents to explore and test code',
	argsSchema,
	handler: mcpSandbox,
})
