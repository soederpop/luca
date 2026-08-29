import { z } from 'zod'
import { commands } from '../command'
import { CommandOptionsSchema } from '../schemas/base'
import type { ContainerContext } from '../container'
import { runChatTui } from './lib/chat-tui'

declare module '../command.js' {
	interface AvailableCommands {
		chat: ReturnType<typeof commands.registerHandler>
	}
}

export const argsSchema = CommandOptionsSchema.extend({
	model: z.string().optional().describe('Override the LLM model for the assistant'),
	provider: z.string().optional().describe("Model provider preset id (e.g. 'openai', 'local', 'codex', 'claude-code')"),
	resume: z.string().optional().describe('Thread ID or conversation ID to resume'),
	list: z.boolean().optional().describe('List recent conversations and exit'),
	historyMode: z.enum(['lifecycle', 'daily', 'persistent', 'session']).optional().describe('Override history persistence mode'),
	offRecord: z.boolean().optional().describe('Alias for --history-mode lifecycle (ephemeral, no persistence)'),
	clear: z.boolean().optional().describe('Clear the conversation history for the resolved history mode and exit'),
	prependPrompt: z.string().optional().describe('Text or path to a markdown file to prepend to the system prompt'),
	appendPrompt: z.string().optional().describe('Text or path to a markdown file to append to the system prompt'),
	use: z.union([z.string(), z.array(z.string())]).optional().describe('Feature(s) to inject into the assistant via .use(). Supports options: --use "contentDb:rootPath=/tmp;lazy=true"'),
	forbidTool: z.union([z.string(), z.array(z.string())]).optional().describe('Tool name patterns to exclude (supports * glob). Can be specified multiple times.'),
	allowTool: z.union([z.string(), z.array(z.string())]).optional().describe('Tool name patterns to allow (strict allowlist, supports * glob). Can be specified multiple times.'),
})

export default async function chat(options: z.infer<typeof argsSchema>, context: ContainerContext) {
	const container = context.container as any
	const ui = container.feature('ui')

	const manager = container.feature('assistantsManager')
	await manager.discover()

	const entries = manager.list()

	if (entries.length === 0) {
		console.error(ui.colors.red('No assistants found.'))
		console.error(ui.colors.dim(`  Create a directory with a CORE.md file anywhere in the project.`))
		process.exit(1)
	}

	const requestedName = container.argv._[1] as string | undefined
	let name: string | undefined

	if (requestedName) {
		const entry = manager.get(requestedName)
		if (!entry) {
			const available = entries.map((e: any) => e.name).join(', ')
			console.error(ui.colors.red(`Assistant "${requestedName}" not found.`))
			console.error(ui.colors.dim(`  Available: ${available}`))
			process.exit(1)
		}
		name = requestedName
	} else if (entries.length === 1) {
		name = entries[0].name
	}
	// With no name and multiple assistants, chat opens the lobby — messages are
	// routed with @mentions, so `name` stays undefined here.

	// Resolve history mode: --off-record overrides everything to lifecycle
	// CLI defaults to 'daily' for interactive persistence
	const historyMode = options.offRecord
		? 'lifecycle'
		: (options.historyMode || 'daily')

	const createOptions: Record<string, any> = { historyMode, injectTimestamps: true }
	if (options.model) createOptions.model = options.model
	if (options.provider) createOptions.provider = options.provider
	if (options.forbidTool) createOptions.forbidTools = Array.isArray(options.forbidTool) ? options.forbidTool : [options.forbidTool]
	if (options.allowTool) createOptions.allowTools = Array.isArray(options.allowTool) ? options.allowTool : [options.allowTool]

	// Resolve --prepend-prompt / --append-prompt: if it's an existing file, read it; if it ends in .md but doesn't exist, error
	const fs = container.feature('fs')
	for (const flag of ['prependPrompt', 'appendPrompt'] as const) {
		const raw = options[flag]
		if (!raw) continue
		const resolved = container.paths.resolve(raw)
		if (fs.exists(resolved)) {
			createOptions[flag] = fs.readFile(resolved)
		} else if (raw.endsWith('.md')) {
			console.error(ui.colors.red(`File not found: ${resolved}`))
			process.exit(1)
		} else {
			createOptions[flag] = raw
		}
	}

	// --clear / --list operate on one assistant's history, so they need a name
	if ((options.clear || options.list) && !name) {
		console.error(ui.colors.red('Specify an assistant, e.g. luca chat researcher --list'))
		process.exit(1)
	}

	// --clear: wipe history for the current mode and exit
	if (options.clear) {
		const assistant = manager.create(name!, createOptions)
		const deleted = await assistant.clearHistory()
		if (deleted > 0) {
			console.log(ui.colors.green(`  Cleared ${deleted} conversation(s) for ${ui.colors.cyan(name!)} (${historyMode} mode).`))
		} else {
			console.log(ui.colors.dim(`  No history to clear for ${ui.colors.cyan(name!)} (${historyMode} mode).`))
		}
		return
	}

	// --list: show recent conversations and exit
	if (options.list) {
		const assistant = manager.create(name!, createOptions)
		const history = await assistant.listHistory({ limit: 20 })
		if (history.length === 0) {
			console.log(ui.colors.dim('  No saved conversations.'))
		} else {
			console.log()
			console.log(ui.colors.dim('  Recent conversations:'))
			console.log()
			for (const meta of history) {
				const date = new Date(meta.updatedAt).toLocaleString()
				const msgs = ui.colors.dim(`(${meta.messageCount} messages)`)
				console.log(`  ${ui.colors.cyan(meta.thread)} ${msgs}`)
				console.log(`    ${ui.colors.dim(date)} - ${meta.title}`)
			}
			console.log()
			console.log(ui.colors.dim(`  Resume with: luca chat ${name} --resume <thread-id>`))
		}
		return
	}

	// --use: applied to every assistant the session creates (lobby included)
	const useItems = options.use ? (Array.isArray(options.use) ? options.use : [options.use]) : []
	function setupAssistant(assistant: any) {
		for (const item of useItems) {
			const [namepart, optStr] = item.split(':')
			if (!namepart) continue
			const featureOpts: Record<string, any> = { enable: true }
			if (optStr) {
				for (const pair of optStr.split(';')) {
					const [k, v] = pair.split('=')
					if (k) featureOpts[k.trim()] = v?.trim() === 'true' ? true : v?.trim() === 'false' ? false : v?.trim()
				}
			}
			const feature = container.feature(namepart.trim(), featureOpts)
			assistant.use(feature)
		}
	}

	const result = await runChatTui({
		container,
		manager,
		historyMode,
		createOptions,
		initialAssistant: name,
		entries,
		resumeThreadId: options.resume,
		setupAssistant,
	})

	// Show resume instructions for non-lifecycle modes
	if (result.threads.length > 0) {
		console.log()
		console.log(ui.colors.dim(`  Session saved. To resume:`))
		for (const thread of result.threads) {
			console.log(ui.colors.dim(`    luca chat ${thread.name} --resume ${thread.threadId}`))
		}
		console.log()
	}

	// Started assistants leave keepalive handles (provider sockets, timers)
	// behind, so a plain return leaves the process hanging after the UI is gone
	process.exit(0)
}

export const positionals = [
	{ name: 'assistant', description: 'Name of the assistant to chat with (discovered from assistants/). Omit to open the lobby and route messages with @mentions.', required: false },
]

export const examples = [
	'luca chat researcher',
	{ command: 'luca chat', description: 'Open the lobby — @mention any discovered assistant to talk to it' },
	{ command: 'luca chat --list', description: 'List recent conversations' },
	{ command: 'luca chat researcher --resume <threadId>', description: 'Resume a previous conversation' },
	{ command: 'luca chat researcher --use "contentDb:rootPath=./docs"', description: 'Inject a feature into the assistant' },
	{ command: 'luca chat researcher --provider claude-code', description: 'Route the assistant through a specific model provider' },
]

commands.registerHandler('chat', {
	description: 'Interactive chat TUI for local assistants — @mention routing, /provider switching, tool call display, persisted input history',
	argsSchema,
	positionals,
	examples,
	handler: chat,
})
