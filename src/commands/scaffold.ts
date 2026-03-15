import { z } from 'zod'
import { commands } from '../command.js'
import { CommandOptionsSchema } from '../schemas/base.js'
import type { ContainerContext } from '../container.js'
import { scaffolds, assistantFiles } from '../scaffolds/generated.js'
import { generateScaffold, toCamelCase } from '../scaffolds/template.js'

declare module '../command.js' {
	interface AvailableCommands {
		scaffold: ReturnType<typeof commands.registerHandler>
	}
}

const validTypes = [...Object.keys(scaffolds), 'assistant']

export const argsSchema = CommandOptionsSchema.extend({
	description: z.string().optional().describe('Brief description of the helper'),
	output: z.string().optional().describe('Output file path (defaults to stdout)'),
	tutorial: z.boolean().default(false).describe('Show the full tutorial instead of generating code'),
})

const TYPE_INFO: Record<string, { what: string; where: string; run: string }> = {
	feature: {
		what: 'A container-managed capability (caching, encryption, custom I/O)',
		where: 'features/<name>.ts',
		run: 'container.feature(\'<name>\') in any command, endpoint, or script',
	},
	client: {
		what: 'A connection to an external service (REST API, WebSocket, GraphQL)',
		where: 'clients/<name>.ts',
		run: 'container.client(\'<name>\') in any command, endpoint, or script',
	},
	server: {
		what: 'A listener accepting incoming connections (HTTP, WebSocket, custom protocol)',
		where: 'servers/<name>.ts',
		run: 'container.server(\'<name>\') then .start()',
	},
	command: {
		what: 'A CLI task that extends `luca` (build scripts, generators, automation)',
		where: 'commands/<name>.ts',
		run: 'luca <name>',
	},
	endpoint: {
		what: 'A REST API route auto-discovered by `luca serve`',
		where: 'endpoints/<name>.ts',
		run: 'luca serve → GET/POST /api/<name>',
	},
	assistant: {
		what: 'An AI assistant with a system prompt, tools, and lifecycle hooks',
		where: 'assistants/<name>/',
		run: 'luca chat <name>',
	},
}

export default async function scaffoldCommand(options: z.infer<typeof argsSchema>, context: ContainerContext) {
	const container = context.container as any
	const args = container.argv._ as string[]
	const ui = container.feature('ui')

	// args: ["scaffold", type?, name?]
	const type = args[1]
	const name = args[2]

	// ── No type or invalid type: show full help ──────────────────
	if (!type || !validTypes.includes(type)) {
		ui.print.cyan('\n  luca scaffold — generate boilerplate for luca helpers\n')
		ui.print('  Usage:  luca scaffold <type> <name> [options]\n')
		ui.print('  Options:')
		ui.print('    --description "..."   Brief description (shows in help text and docs)')
		ui.print('    --output <path>       Write to file instead of stdout')
		ui.print('    --tutorial            Show the full guide for a type instead of generating code\n')

		ui.print('  Types:\n')
		for (const [t, info] of Object.entries(TYPE_INFO)) {
			ui.print.green(`    ${t}`)
			ui.print(`      ${info.what}`)
			ui.print.dim(`      File: ${info.where}  →  Run: ${info.run}`)
			ui.print('')
		}

		ui.print('  Examples:\n')
		ui.print('    # Generate a command and write it to the right place')
		ui.print('    luca scaffold command deploy --description "Deploy to production" --output commands/deploy.ts\n')
		ui.print('    # Generate a feature (prints to stdout — pipe or copy)')
		ui.print('    luca scaffold feature diskCache --description "File-backed key-value cache"\n')
		ui.print('    # Generate an endpoint and save it')
		ui.print('    luca scaffold endpoint users --description "User management API" --output endpoints/users.ts\n')
		ui.print('    # Read the full tutorial for a type')
		ui.print('    luca scaffold feature --tutorial')
		ui.print('    luca scaffold endpoint --tutorial\n')

		ui.print('  Workflow:\n')
		ui.print('    1. luca scaffold <type> <name> --output <path>   Generate the file')
		ui.print('    2. Edit the generated file — add your logic')
		ui.print('    3. luca about                                    Verify it was discovered')
		ui.print('    4. luca describe <name>                          See the generated docs\n')

		if (type && !validTypes.includes(type)) {
			ui.print.yellow(`  "${type}" is not a valid type. Available: ${validTypes.join(', ')}\n`)
		}
		return
	}

	// ── Tutorial mode ────────────────────────────────────────────
	if (options.tutorial) {
		const scaffold = scaffolds[type]
		if (scaffold?.tutorial) {
			console.log(ui.markdown(scaffold.tutorial))
		} else {
			ui.print.yellow(`No tutorial available for type: ${type}`)
		}
		return
	}

	// ── Missing name ─────────────────────────────────────────────
	if (!name) {
		const info = TYPE_INFO[type]
		ui.print.cyan(`\n  luca scaffold ${type} <name> [options]\n`)
		ui.print(`  ${info?.what || ''}\n`)
		ui.print('  Examples:')
		if (type === 'feature') {
			ui.print(`    luca scaffold feature diskCache --description "File-backed cache"`)
			ui.print(`    luca scaffold feature diskCache --output features/diskCache.ts`)
		} else if (type === 'client') {
			ui.print(`    luca scaffold client github --description "GitHub API client"`)
			ui.print(`    luca scaffold client github --output clients/github.ts`)
		} else if (type === 'server') {
			ui.print(`    luca scaffold server grpc --description "gRPC server"`)
			ui.print(`    luca scaffold server grpc --output servers/grpc.ts`)
		} else if (type === 'command') {
			ui.print(`    luca scaffold command deploy --description "Deploy to production"`)
			ui.print(`    luca scaffold command deploy --output commands/deploy.ts`)
		} else if (type === 'endpoint') {
			ui.print(`    luca scaffold endpoint users --description "User management API"`)
			ui.print(`    luca scaffold endpoint users --output endpoints/users.ts`)
		} else if (type === 'assistant') {
			ui.print(`    luca scaffold assistant chief-of-staff`)
			ui.print(`    luca scaffold assistant chief-of-staff --output assistants/chief-of-staff`)
		}
		ui.print(`\n    luca scaffold ${type} --tutorial    Full guide with patterns and conventions\n`)
		return
	}

	// ── Assistant: multi-file scaffold ───────────────────────────
	if (type === 'assistant') {
		if (!assistantFiles || Object.keys(assistantFiles).length === 0) {
			ui.print.yellow('No assistant scaffold files bundled. Rebuild with: luca build-scaffolds')
			return
		}

		const outputDir = options.output || `assistants/${toCamelCase(name)}`
		const fs = container.feature('fs')
		const resolvedDir = container.paths.resolve(outputDir)

		await fs.ensureFolder(resolvedDir)

		for (const [fileName, content] of Object.entries(assistantFiles)) {
			const filePath = container.paths.resolve(resolvedDir, fileName)
			await fs.writeFileAsync(filePath, content)
		}

		ui.print.green(`\n  ✓ Scaffolded assistant "${name}" in ${outputDir}/`)
		ui.print.dim(`    CORE.md   — system prompt (edit this to define your assistant's personality)`)
		ui.print.dim(`    tools.ts  — tool functions the assistant can call`)
		ui.print.dim(`    hooks.ts  — lifecycle event handlers`)
		ui.print(`\n  Start chatting:  luca chat ${name}\n`)
		return
	}

	const code = generateScaffold(type, name, options.description)

	if (!code) {
		ui.print.yellow(`No scaffold template available for type: ${type}`)
		return
	}

	// Write to file or stdout
	if (options.output) {
		const fs = container.feature('fs')
		const dir = container.paths.resolve(options.output, '..')
		await fs.ensureFolder(dir)
		await fs.writeFileAsync(options.output, code)
		ui.print.green(`  ✓ Wrote ${type} scaffold to ${options.output}`)
		ui.print.dim(`  Next: edit the file, then run \`luca about\` to verify discovery\n`)
	} else {
		console.log(code)
	}
}

commands.registerHandler('scaffold', {
	description: 'Generate boilerplate for a new luca feature, client, server, command, endpoint, or assistant',
	argsSchema,
	handler: scaffoldCommand,
})
