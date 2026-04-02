import { z } from 'zod'
import { commands } from '../command.js'
import { CommandOptionsSchema } from '../schemas/base.js'
import type { ContainerContext } from '../container.js'
import type { MCPServer } from '../servers/mcp.js'
import { mcpReadme } from '../scaffolds/generated.js'

declare module '../command.js' {
	interface AvailableCommands {
		'sandbox-mcp': ReturnType<typeof commands.registerHandler>
	}
}

export const argsSchema = CommandOptionsSchema.extend({
	transport: z.enum(['stdio', 'http']).default('stdio').describe('Transport type (stdio or http)'),
	port: z.number().default(3002).describe('Port for HTTP transport'),
	mcpCompat: z.enum(['standard', 'codex']).optional()
		.describe('HTTP compatibility profile. Defaults to standard. Can also be set via MCP_HTTP_COMPAT.'),
	stdioCompat: z.enum(['standard', 'codex', 'auto']).optional()
		.describe('Stdio framing compatibility profile. Defaults to standard. Can also be set via MCP_STDIO_COMPAT.'),
})

/**
 * Run a luca CLI command as a subprocess and return its output.
 * Always spawns fresh so callers see the latest project code.
 */
async function lucaCLI(proc: any, command: string, args: string[] = []): Promise<{ stdout: string; stderr: string; exitCode: number }> {
	const result = await proc.spawnAndCapture('luca', [command, ...args])
	return { stdout: result.stdout.trim(), stderr: result.stderr.trim(), exitCode: result.exitCode ?? 0 }
}

export default async function mcpSandbox(options: z.infer<typeof argsSchema>, context: ContainerContext) {
	const container = context.container as any
	const proc = container.feature('proc')
	const envCompat = process.env.MCP_HTTP_COMPAT?.toLowerCase()
	const resolvedCompat = options.mcpCompat || (envCompat === 'codex' ? 'codex' : 'standard')
	const envStdioCompat = process.env.MCP_STDIO_COMPAT?.toLowerCase()
	const resolvedStdioCompat = options.stdioCompat
		|| (envStdioCompat === 'codex' || envStdioCompat === 'auto' ? envStdioCompat : 'standard')

	const mcpServer = container.server('mcp', {
		transport: options.transport,
		port: options.port,
		serverName: 'luca-sandbox',
		serverVersion: container.manifest?.version || '1.0.0',
		mcpCompat: options.mcpCompat,
		stdioCompat: options.stdioCompat,
	}) as MCPServer

	// --- Tool: read_me ---
	mcpServer.tool('read_me', {
		description: [
			'Returns the Luca framework development guide. Call this BEFORE writing any code in a luca project.',
			'Contains the import conventions, capability map, and workflow for discovering and using container features.',
			'You should call this tool at the start of every session.',
		].join('\n'),
		schema: z.object({}),
		handler: () => mcpReadme,
	})

	// --- Tool: find_capability ---
	mcpServer.tool('find_capability', {
		description: [
			'Search for container capabilities by intent. Returns the full catalog of available features, clients,',
			'and servers with their descriptions so you can find what you need before writing code.',
			'Call this when you need to do something and aren\'t sure which helper provides it.',
			'Prefer this over installing npm packages — the container likely already has what you need.',
		].join('\n'),
		schema: z.object({}),
		handler: async () => {
			const { stdout, stderr } = await lucaCLI(proc, 'eval', [
				'[container.features.describeAll(), container.clients.describeAll(), container.servers.describeAll()].join("\\n\\n---\\n\\n")',
			])
			return stdout || stderr
		},
	})

	// --- Tool: scaffold ---
	mcpServer.tool('scaffold', {
		description: [
			'Generate correct boilerplate for a new luca helper (feature, client, server, command, or endpoint).',
			'Returns the complete file content with your name and description filled in.',
			'Write this to a file, then fill in your implementation.',
			'The scaffold follows all luca conventions including schemas, jsdoc, module augmentation, and registration.',
		].join('\n'),
		schema: z.object({
			type: z.enum(['feature', 'client', 'server', 'command', 'endpoint'])
				.describe('What kind of helper to scaffold'),
			name: z.string()
				.describe('Name for the helper (e.g. "diskCache", "myApi", "healthCheck")'),
			description: z.string().optional()
				.describe('Brief description of what this helper does'),
		}),
		handler: async (args) => {
			const cliArgs = [args.type, args.name]
			if (args.description) cliArgs.push('--description', args.description)
			const { stdout, stderr } = await lucaCLI(proc, 'scaffold', cliArgs)
			return stdout || stderr
		},
	})

	// --- Tool: eval ---
	mcpServer.tool('eval', {
		description: [
			'Evaluate JavaScript/TypeScript code in a Luca container sandbox.',
			'Use this to prototype and test container API calls before writing them into files.',
			'Each call runs in a fresh luca process — always reflects the latest project code.',
			'',
			'The sandbox has a live `container` object and all enabled features as top-level variables',
			'(e.g. `fs`, `git`, `ui`, `vm`, `proc`, `networking`, etc).',
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
			'  container.introspectAsText()       — full container introspection',
			'  fs.readFile(path)               — read a file',
			'  fs.readdir(dir)                 — list directory contents',
			'  proc.exec(cmd)                  — run a shell command',
		].join('\n'),
		schema: z.object({
			code: z.string().describe('JavaScript code to evaluate in the Luca container sandbox'),
		}),
		handler: async (args) => {
			const { stdout, stderr, exitCode } = await lucaCLI(proc, 'eval', [args.code])
			const text = stdout || stderr || 'undefined'
			return {
				content: [{ type: 'text' as const, text }],
				isError: exitCode !== 0,
			}
		},
	})

	// --- Tool: inspect_container ---
	mcpServer.tool('inspect_container', {
		description: [
			'Inspect the Luca container — registries, state, methods, events, environment.',
			'',
			'Returns a markdown overview of the container. Optionally filter to a specific section.',
			'',
			'Sections: "methods", "getters", "events", "state", "options", "envVars"',
			'Leave section empty for the full overview.',
		].join('\n'),
		schema: z.object({
			section: z.enum(['methods', 'getters', 'events', 'state', 'options', 'envVars']).optional()
				.describe('Optional section to filter to. Omit for full overview.'),
		}),
		handler: async (args) => {
			const code = args.section
				? `container.introspectAsText("${args.section}")`
				: 'container.introspectAsText()'
			const { stdout, stderr } = await lucaCLI(proc, 'eval', [code])
			return stdout || stderr
		},
	})

	// --- Tool: list_registry ---
	mcpServer.tool('list_registry', {
		description: [
			'List available items in a container registry.',
			'',
			'Returns names and brief descriptions for all registered helpers in the chosen registry.',
			'Use describe_helper to get full documentation for a specific item.',
		].join('\n'),
		schema: z.object({
			registry: z.enum(['features', 'clients', 'servers', 'commands', 'endpoints'])
				.describe('Which registry to list'),
		}),
		handler: async (args) => {
			const { stdout, stderr } = await lucaCLI(proc, 'eval', [
				`container.${args.registry}.available.map(n => { try { const C = container.${args.registry}.lookup(n); return "- **" + n + "**" + (C.description ? ": " + C.description : "") } catch { return "- **" + n + "**" } }).join("\\n")`,
			])
			return stdout || stderr
		},
	})

	// --- Tool: describe_helper ---
	mcpServer.tool('describe_helper', {
		description: [
			'Get full documentation for a specific helper (feature, client, server, command, endpoint).',
			'This is the API documentation for any luca helper. There is no other documentation available —',
			'call this before writing code that uses a feature, client, or server.',
			'',
			'Returns markdown with options, state schema, methods, getters, events, env vars, and descriptions.',
			'Use list_registry or find_capability first to see what is available.',
		].join('\n'),
		schema: z.object({
			name: z.string().describe('Name of the helper (e.g. "fs", "rest", "express", "serve")'),
			section: z.enum(['methods', 'getters', 'events', 'state', 'options', 'envVars']).optional()
				.describe('Optional section to filter to. Omit for full documentation.'),
		}),
		handler: async (args) => {
			const describeArgs = [args.name]
			if (args.section) describeArgs.push(args.section)
			const { stdout, stderr } = await lucaCLI(proc, 'describe', describeArgs)
			return stdout || stderr
		},
	})

	// --- Tool: inspect_helper_instance ---
	mcpServer.tool('inspect_helper_instance', {
		description: [
			'Inspect a live helper instance (enabled feature, active client/server).',
			'Use this to inspect a live, running instance — see its current state,',
			'check method signatures, and understand runtime behavior.',
			'',
			'Runs in a fresh process so you always see the latest code.',
			'Optionally filter to a specific section.',
		].join('\n'),
		schema: z.object({
			type: z.enum(['feature', 'client', 'server'])
				.describe('What kind of helper to inspect'),
			name: z.string().describe('Name of the helper (e.g. "fs", "rest", "express")'),
			section: z.enum(['methods', 'getters', 'events', 'state', 'options', 'envVars']).optional()
				.describe('Optional section to filter to. Omit for full introspection.'),
		}),
		handler: async (args) => {
			const accessor = args.type === 'feature'
				? `container.feature('${args.name}')`
				: args.type === 'client'
					? `container.client('${args.name}')`
					: `container.server('${args.name}')`
			const code = args.section
				? `${accessor}.introspectAsText("${args.section}")`
				: `${accessor}.introspectAsText()`
			const { stdout, stderr } = await lucaCLI(proc, 'eval', [code])
			return stdout || stderr
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
				'You have access to a live Luca container through the `eval` tool. Each call runs in a fresh process,',
				'so you always see the latest project code. Use the `eval` tool to prototype and explore.',
				'',
				'## Discovering what is available',
				'',
				'The container has registries for each helper type. Each registry has:',
				'- `.available` — array of registered names',
				'- `.describe(name)` — returns markdown docs for one helper',
				'- `.describeAll()` — returns a condensed overview of all helpers (name + description)',
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
				'container.introspectAsText()              // Full container introspection',
				'container.introspectAsText("methods")     // Just the methods section',
				'container.introspectAsText("state")       // Just the state section',
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
			].join('\n'),
		}],
	})

	// --- Prompt: introspect ---
	mcpServer.prompt('introspect', {
		description: 'Get full introspection of the Luca container — all registries, state, methods, events, and environment info.',
		handler: async () => {
			const { stdout } = await lucaCLI(proc, 'eval', ['container.introspectAsText()'])
			return [{
				role: 'user' as const,
				content: `Here is the full container introspection:\n\n${stdout}`,
			}]
		},
	})

	// --- Resource: container-info ---
	mcpServer.resource('luca://container/info', {
		name: 'Container Info',
		description: 'Full introspection of the running Luca container',
		mimeType: 'text/markdown',
		handler: async () => {
			const { stdout } = await lucaCLI(proc, 'eval', ['container.introspectAsText()'])
			return stdout
		},
	})

	// --- Resource: feature list ---
	mcpServer.resource('luca://features', {
		name: 'Available Features',
		description: 'List of all registered features with descriptions',
		mimeType: 'text/markdown',
		handler: async () => {
			const { stdout } = await lucaCLI(proc, 'eval', [
				'"# Available Features\\n" + container.features.available.map(n => { try { const C = container.features.lookup(n); return "- **" + n + "**: " + (C.description || "") } catch { return "- **" + n + "**" } }).join("\\n")',
			])
			return stdout
		},
	})

	// Start the server
	await mcpServer.start({
		transport: options.transport,
		port: options.port,
		mcpCompat: options.mcpCompat,
		stdioCompat: options.stdioCompat,
	})

	if (options.transport === 'http') {
		console.log(`\nLuca Sandbox MCP listening on http://localhost:${options.port}/mcp`)
		console.log(`Compatibility: ${resolvedCompat}`)
	} else {
		console.error(`Luca Sandbox MCP started (stdio transport)`)
		console.error(`Stdio Compatibility: ${resolvedStdioCompat}`)
		console.error(`Tools: read_me, find_capability, scaffold, eval, inspect_container, list_registry, describe_helper, inspect_helper_instance`)
		console.error(`Prompts: discover, introspect | Resources: luca://container/info, luca://features`)
	}
}

commands.registerHandler('sandbox-mcp', {
	description: 'Start an MCP server with a Luca container sandbox for AI agents to explore and test code',
	argsSchema,
	handler: mcpSandbox,
})
