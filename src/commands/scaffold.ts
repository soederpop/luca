import { z } from 'zod'
import { commands } from '../command.js'
import { printCommandHelp } from './help.js'
import { CommandOptionsSchema } from '../schemas/base.js'
import type { ContainerContext } from '../container.js'
import { scaffolds, assistantFiles } from '../scaffolds/generated.js'
import { generateScaffold, toCamelCase, toKebabCase } from '../scaffolds/template.js'

declare module '../command.js' {
	interface AvailableCommands {
		scaffold: ReturnType<typeof commands.registerHandler>
	}
}

const validTypes = [...Object.keys(scaffolds), 'assistant']

export const argsSchema = CommandOptionsSchema.extend({
	description: z.string().optional().describe('Brief description of the helper'),
	output: z.string().optional().describe('Output file path (overrides default location)'),
	print: z.boolean().default(false).describe('Print the generated code to stdout instead of writing a file'),
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
	selector: {
		what: 'A cached data query — returns structured results from the container',
		where: 'selectors/<name>.ts',
		run: 'luca select <name> or container.select(\'<name>\')',
	},
	assistant: {
		what: 'An AI assistant with a system prompt, tools, and lifecycle hooks',
		where: 'assistants/<name>/',
		run: 'luca chat <name>',
	},
}

/** Representative example invocations per scaffold type, shown in help output. */
const TYPE_EXAMPLES: Record<string, string[]> = {
	feature: ['luca scaffold feature diskCache --description "File-backed cache"'],
	client: ['luca scaffold client github --description "GitHub API client"'],
	server: ['luca scaffold server grpc --description "gRPC server"'],
	command: ['luca scaffold command deploy --description "Deploy to production"'],
	endpoint: ['luca scaffold endpoint users --description "User management API"'],
	selector: ['luca scaffold selector package-info --description "Returns parsed package.json data"'],
	assistant: ['luca scaffold assistant chief-of-staff'],
}

export const subcommands = Object.fromEntries(
	Object.entries(TYPE_INFO).map(([type, info]) => [
		type,
		{
			args: '<name>',
			description: `${info.what} → ${info.where}`,
			examples: [
				...(TYPE_EXAMPLES[type] || []).map((command) => ({ command, description: `Writes ${info.where} — use via ${info.run}` })),
				{ command: `luca scaffold ${type} --tutorial`, description: 'Full guide with patterns and conventions' },
			],
		},
	]),
)

export const examples = [
	{ command: 'luca scaffold command deploy --description "Deploy to production"', description: 'Generate a command (writes to commands/deploy.ts)' },
	{ command: 'luca scaffold endpoint users --print', description: 'Print to stdout instead of writing' },
	{ command: 'luca scaffold feature --tutorial', description: 'Read the full tutorial for a type' },
]

export default async function scaffoldCommand(options: z.infer<typeof argsSchema>, context: ContainerContext) {
	const container = context.container as any
	const args = container.argv._ as string[]
	const ui = container.feature('ui')

	// args: ["scaffold", type?, name?]
	const type = args[1]
	const name = args[2]

	// ── No type or invalid type: show full help ──────────────────
	if (!type || !validTypes.includes(type)) {
		printCommandHelp(container, 'scaffold')
		ui.print('  Workflow: scaffold → edit the file → luca about (verify discovery) → luca describe <name>\n')
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
		printCommandHelp(container, 'scaffold', type)
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
		ui.print.dim(`    voice.yml — optional voice/TTS config (uncomment to enable)`)
		ui.print(`\n  Start chatting:  luca chat ${name}\n`)
		return
	}

	const code = generateScaffold(type, name, options.description)

	if (!code) {
		ui.print.yellow(`No scaffold template available for type: ${type}`)
		return
	}

	// --print: just output to stdout
	if (options.print) {
		console.log(code)
		return
	}

	// Default: write to file
	const kebabName = toKebabCase(name)
	const defaultPaths: Record<string, string> = {
		feature: `features/${kebabName}.ts`,
		client: `clients/${kebabName}.ts`,
		server: `servers/${kebabName}.ts`,
		command: `commands/${kebabName}.ts`,
		endpoint: `endpoints/${kebabName}.ts`,
		selector: `selectors/${kebabName}.ts`,
	}
	const outputPath = options.output || defaultPaths[type] || `${type}s/${kebabName}.ts`
	const fs = container.feature('fs')
	const resolvedPath = container.paths.resolve(outputPath)

	// Check if file already exists
	if (await fs.existsAsync(resolvedPath)) {
		ui.print.yellow(`  ✗ File already exists: ${outputPath}`)
		ui.print.dim(`  Use --output <path> to write to a different location, or --print to view the code\n`)
		return
	}

	const dir = container.paths.resolve(outputPath, '..')
	await fs.ensureFolder(dir)
	await fs.writeFileAsync(resolvedPath, code)
	ui.print.green(`  ✓ Wrote ${type} scaffold to ${outputPath}`)
	ui.print.dim(`  Next: edit the file, then run \`luca about\` to verify discovery\n`)
}

commands.registerHandler('scaffold', {
	description: 'Generate boilerplate for a new luca feature, client, server, command, endpoint, or assistant',
	argsSchema,
	subcommands,
	examples,
	handler: scaffoldCommand,
})
