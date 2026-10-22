import { z } from 'zod'
import { commands } from '../command.js'
import { CommandOptionsSchema } from '../schemas/base.js'
import type { ContainerContext } from '../container.js'

declare module '../command.js' {
	interface AvailableCommands {
		'mcp-auth': ReturnType<typeof commands.registerHandler>
	}
}

export const argsSchema = CommandOptionsSchema.extend({
	action: z.enum(['status', 'login', 'logout']).default('status').describe('What to do: status, login, or logout'),
	server: z.string().optional().describe('Server name from the config. login without it logs in to every OAuth server.'),
	config: z.string().default('.mcp.json').describe('MCP config file with an mcpServers map, relative to the current directory'),
	json: z.boolean().default(false).describe('Print raw JSON'),
})

export const positionals = ['action', 'server']

export const subcommands = {
	status: {
		args: '',
		description: 'Show which http servers in the config have a stored OAuth login',
		examples: ['luca mcp-auth status'],
	},
	login: {
		args: '[server]',
		description: 'Open a browser to log in, then test the connection. Stored logins are reused without a browser.',
		examples: ['luca mcp-auth login fellow', { command: 'luca mcp-auth login', description: 'Log in to every OAuth server in .mcp.json' }],
	},
	logout: {
		args: '<server>',
		description: 'Forget the stored tokens and client registration for a server',
		examples: ['luca mcp-auth logout fellow'],
	},
}

export const examples = [
	'luca mcp-auth',
	'luca mcp-auth login treg',
	{ command: 'luca mcp-auth login --config mcp.json', description: 'Use a different config file' },
]

export default async function mcpAuth(options: z.infer<typeof argsSchema>, context: ContainerContext) {
	const container = context.container as any
	const ui = container.feature('ui')
	const bridge = container.feature('mcpBridge', { configFile: options.config, materializeTools: false })
	const out = (value: unknown) => console.log(JSON.stringify(value, null, 2))

	if (options.action === 'logout') {
		if (!options.server) {
			console.error('logout needs a server name: luca mcp-auth logout <server>')
			process.exit(1)
		}
		await bridge.logout(options.server)
		options.json ? out({ server: options.server, loggedOut: true }) : ui.print.green(`Logged out of ${options.server}`)
		return
	}

	if (options.action === 'login') {
		if (!options.json) ui.print.dim('A browser window opens for each server that needs a login...')
		const results = await bridge.login(options.server)
		await bridge.disconnectAll()
		if (options.json) return out(results)
		for (const [name, r] of Object.entries(results) as Array<[string, { status: string; error?: string }]>) {
			const tools = bridge.state.get('servers')?.[name]?.toolCount
			if (r.status === 'connected') ui.print.green(`✓ ${name} connected (${tools ?? 0} tools)`)
			else ui.print.red(`✗ ${name}: ${r.error || r.status}`)
		}
		if (!Object.keys(results).length) ui.print.yellow('No OAuth servers in the config.')
		if (Object.values(results).some((r: any) => r.status !== 'connected')) process.exit(1)
		return
	}

	const status = await bridge.authStatus()
	if (options.json) return out(status)
	const rows = Object.entries(status) as Array<[string, any]>
	if (!rows.length) {
		ui.print.yellow(`No http servers in ${options.config}.`)
		return
	}
	for (const [name, s] of rows) {
		if (!s.oauth) ui.print.dim(`  ${name}  uses its own Authorization header`)
		else if (s.loggedIn) ui.print.green(`✓ ${name}  logged in ${s.tokensSavedAt ? `(token saved ${s.tokensSavedAt})` : ''}${s.hasRefreshToken ? '' : ', no refresh token'}`)
		else ui.print.yellow(`○ ${name}  not logged in. Run: luca mcp-auth login ${name}`)
	}
}

commands.registerHandler('mcp-auth', {
	description: 'Log in to OAuth-protected MCP servers used by mcpBridge, check logins, or log out',
	argsSchema,
	positionals,
	subcommands,
	examples,
	handler: mcpAuth,
})
