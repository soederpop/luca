import container from '@/agi'
import type { ClaudeAssistantMessage, ClaudeInitEvent, ClaudeResultEvent } from '@/agi/features/claude-code'

const ui = container.feature('ui')
const { colors } = ui

const label = {
	info: colors.cyan.bold(' INFO '),
	event: colors.magenta.bold(' EVENT '),
	delta: colors.green(' ▸ '),
	tool: colors.yellow.bold(' TOOL '),
	result: colors.blue.bold(' RESULT '),
	error: colors.red.bold(' ERROR '),
	cost: colors.dim(' $ '),
}

export async function followTutorial(tutorialPath?: string) {
	const resolvedPath = tutorialPath || 'docs/tutorials/websocket-communication.md'
	const tutorialContent = await container.fs.readFile(resolvedPath)
	const tutorialName = resolvedPath.split('/').pop()?.replace('.md', '') || 'tutorial'

	ui.print(colors.bold.cyan(`\n━━━ Following Tutorial: ${tutorialName} ━━━\n`))

	const claudeCode = container.feature('claudeCode')

	const guidelines = [
		`You are following a tutorial from the luca codebase.`,
		`Put all files you create in a new subfolder of the playground/ folder.`,
		`Use relative imports from the playground folder when referencing luca modules (e.g. import container from '../src/node').`,
		`Do not modify any existing source files outside of playground/.`,
		`If the tutorial references multiple files, create all of them in the subfolder you created in playground/.`,
		`After creating the files, verify they work by running them if possible.`,
	].join('\n')

	const prompt = [
		guidelines,
		'',
		'Here is the tutorial to follow:',
		'',
		tutorialContent.toString(),
	].join('\n')

	// --- Wire up event listeners for visual output ---

	claudeCode.on('session:init', ({ sessionId, init }: { sessionId: string, init: ClaudeInitEvent }) => {
		ui.print(`${label.info} Session started`)
		ui.print(colors.dim(`  model: ${init.model}`))
		ui.print(colors.dim(`  cwd: ${init.cwd}`))
		ui.print(colors.dim(`  tools: ${init.tools.length} available`))
		ui.print(colors.dim(`  session: ${init.session_id}`))
		ui.print('')
	})

	claudeCode.on('session:message', ({ sessionId, message }: { sessionId: string, message: ClaudeAssistantMessage }) => {
		for (const block of message.message.content) {
			if (block.type === 'text' && block.text.trim()) {
				ui.print(`\n${label.event} Assistant message:`)
				ui.print(colors.white(block.text))
			}
			if (block.type === 'tool_use') {
				ui.print(`${label.tool} ${colors.yellow(block.name)}`)
				const inputStr = JSON.stringify(block.input, null, 2)
				// Show truncated input for readability
				const lines = inputStr.split('\n')
				if (lines.length > 10) {
					ui.print(colors.dim(lines.slice(0, 10).join('\n')))
					ui.print(colors.dim(`  ... (${lines.length - 10} more lines)`))
				} else {
					ui.print(colors.dim(inputStr))
				}
			}
		}
	})

	claudeCode.on('session:result', ({ sessionId, result, isError, costUsd, turns, durationMs }: {
		sessionId: string
		result: string
		isError: boolean
		costUsd: number
		turns: number
		durationMs: number
	}) => {
		ui.print('')
		if (isError) {
			ui.print(`${label.error} Session failed`)
			ui.print(colors.red(result))
		} else {
			ui.print(`${label.result} Session complete`)
		}
		ui.print(`${label.cost} Cost: $${costUsd.toFixed(4)} | Turns: ${turns} | Duration: ${(durationMs / 1000).toFixed(1)}s`)
		ui.print('')
	})

	claudeCode.on('session:error', ({ sessionId, error }: { sessionId: string, error: any }) => {
		ui.print(`${label.error} ${colors.red(String(error))}`)
	})

	// --- Run the session ---

	ui.print(`${label.info} Sending tutorial to Claude Code...`)
	ui.print(colors.dim(`  guidelines: files go in playground/`))
	ui.print('')

	const session = await claudeCode.run(prompt, {
		cwd: process.cwd(),
		permissionMode: 'acceptEdits',
	})

	// --- Summary ---

	ui.print(colors.bold.cyan(`\n━━━ Tutorial Complete ━━━\n`))
	ui.print(colors.dim(`  Status: ${session.status}`))
	ui.print(colors.dim(`  Messages: ${session.messages.length}`))
	if (session.result) {
		ui.print(colors.dim(`  Result: ${session.result.slice(0, 200)}${session.result.length > 200 ? '...' : ''}`))
	}

	return session
}

// Run if executed directly
const tutorialArg = process.argv[2]
followTutorial(tutorialArg)
