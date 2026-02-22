import container from '@soederpop/luca/agi'
import type { ClaudeAssistantMessage } from '@soederpop/luca/agi/features/claude-code'

const claude = container.feature('claudeCode')

const prompt = `
Through the lens of what you already know about the project and my vision for it, please generate
a proper explanation of the codebase.  Describe the purpose of each folder, what should go in it, and a
brief description of each module and what it exports.

This explainer should be decent enough to serve as a preliminary investigation, so that you don't need to
read the codebase in detail to understand every time I ask you to do something.

Store the results of this explanation in a file called 'codebase-explainer.md' in the 'docs' folder.
`

// --- Progress tracking ---

const startTime = Date.now()
let toolsUsed: string[] = []
let totalInputTokens = 0
let totalOutputTokens = 0

function elapsed(): string {
	const s = Math.floor((Date.now() - startTime) / 1000)
	const m = Math.floor(s / 60)
	const sec = s % 60
	return m > 0 ? `${m}m${sec.toString().padStart(2, '0')}s` : `${sec}s`
}

function status(icon: string, msg: string) {
	console.log(`  ${icon} ${msg}  \x1b[2m${elapsed()}\x1b[0m`)
}

claude.on('session:init', ({ init }) => {
	console.log()
	console.log(`\x1b[1m  Explain Codebase\x1b[0m`)
	console.log(`\x1b[2m  model: ${init.model}  mode: ${init.permissionMode}\x1b[0m`)
	console.log()
})

claude.on('session:message', ({ message }) => {
	const msg = message as ClaudeAssistantMessage
	const content = msg.message?.content || []

	for (const block of content) {
		if (block.type === 'tool_use') {
			toolsUsed.push(block.name)
			const input = typeof block.input === 'object' && block.input !== null
				? (block.input as Record<string, unknown>)
				: {}
			const detail = input.command || input.file_path || input.pattern || input.query || ''
			const short = String(detail).length > 60 ? String(detail).slice(0, 57) + '...' : String(detail)
			status('\x1b[33m>\x1b[0m', `\x1b[33m${block.name}\x1b[0m${short ? ` \x1b[2m${short}\x1b[0m` : ''}`)
		}

		if (block.type === 'text' && block.text.length > 0) {
			const firstLine = block.text.split('\n').find(l => l.trim().length > 0) || ''
			const preview = firstLine.length > 80 ? firstLine.slice(0, 77) + '...' : firstLine
			if (preview) {
				status('\x1b[36m~\x1b[0m', `\x1b[2m${preview}\x1b[0m`)
			}
		}
	}

	if (msg.message?.usage) {
		totalInputTokens += msg.message.usage.input_tokens || 0
		totalOutputTokens += msg.message.usage.output_tokens || 0
	}
})

claude.on('session:result', ({ result, isError, costUsd, turns, durationMs }) => {
	console.log()
	if (isError) {
		console.log(`\x1b[31m  Error: ${result}\x1b[0m`)
	} else {
		console.log(`\x1b[32m  Done.\x1b[0m`)
	}
	console.log()
	console.log(`\x1b[2m  turns: ${turns}  tools: ${toolsUsed.length}  tokens: ${(totalInputTokens + totalOutputTokens).toLocaleString()}  cost: $${costUsd.toFixed(4)}  time: ${(durationMs / 1000).toFixed(1)}s\x1b[0m`)
	console.log()
})

// --- Run ---

await claude.run(prompt, {
	permissionMode: 'acceptEdits',
})
