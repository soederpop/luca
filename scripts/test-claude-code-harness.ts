/**
 * The purpose of this script is to test the claude code feature.
 *
 * The claude code feature is a wrapper around claude code CLI and provides
 * state and information about the session as it runs.
 *
 * Usage:
 *   bun scripts/claude-code-harness.ts "Your prompt here"
 *   bun scripts/claude-code-harness.ts  (uses default prompt)
 */

import container from '@/agi/container.server'
import type { ClaudeInitEvent, ClaudeAssistantMessage } from '@/agi/features/claude-code'

const ui = container.ui
const { colors } = ui

// ── Styling helpers ────────────────────────────────────────────────
const dim = colors.dim
const bold = colors.bold
const label = colors.cyan.bold
const success = colors.green.bold
const error = colors.red.bold
const warn = colors.yellow
const accent = colors.magenta
const info = colors.blue

function separator(char = '─', width = 60) {
	return dim(char.repeat(width))
}

function timestamp() {
	return dim(`[${new Date().toLocaleTimeString()}]`)
}

function formatDuration(ms: number): string {
	if (ms < 1000) return `${ms}ms`
	if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
	const mins = Math.floor(ms / 60_000)
	const secs = ((ms % 60_000) / 1000).toFixed(0)
	return `${mins}m ${secs}s`
}

function formatCost(usd: number): string {
	if (usd < 0.01) return `$${(usd * 100).toFixed(2)}c`
	return `$${usd.toFixed(4)}`
}

function spinner() {
	const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
	let i = 0
	return () => accent(frames[i++ % frames.length])
}

// ── Main ───────────────────────────────────────────────────────────
async function main() {
	const prompt = process.argv.slice(2).join(' ') || 'Explain the purpose of this project in 2-3 sentences.'

	// Banner
	console.log()
	console.log(ui.banner('Claude', { font: 'Small', colors: ['cyan', 'blue', 'magenta'] }))
	console.log(separator('═'))
	console.log(label('  Claude Code Harness'))
	console.log(dim('  Testing the ClaudeCode feature with live streaming output'))
	console.log(separator('═'))
	console.log()

	// Get feature and check CLI availability
	const cc = container.feature('claudeCode')
	const available = await cc.checkAvailability()

	if (!available) {
		console.log(error('  ✗ Claude CLI not found. Is it installed and on PATH?'))
		process.exit(1)
	}
	console.log(success('  ✓ ') + dim(`Claude CLI detected — ${cc.state.current.claudeVersion}`))
	console.log()

	// Show prompt
	console.log(separator())
	console.log(label('  Prompt: ') + colors.white(prompt))
	console.log(separator())
	console.log()

	// Track timing
	const startTime = Date.now()
	let tokenCount = 0
	let currentText = ''
	const spin = spinner()

	// ── Wire up events ─────────────────────────────────────────────

	// Session initialized — the CLI has started and told us the model/session info
	cc.on('session:init', ({ sessionId, init }: { sessionId: string; init: ClaudeInitEvent }) => {
		console.log(timestamp() + info('  ● ') + dim('Session started'))
		console.log(dim('    ├─ Model:      ') + colors.white(init.model))
		console.log(dim('    ├─ Session:    ') + dim(init.session_id))
		console.log(dim('    ├─ Tools:      ') + dim(`${init.tools.length} available`))
		console.log(dim('    └─ Permission: ') + dim(init.permissionMode))
		console.log()
		process.stdout.write(label('  Response: '))
	})

	// Token-by-token streaming deltas
	cc.on('session:delta', ({ text }: { text: string }) => {
		tokenCount++
		currentText += text
		process.stdout.write(text)
	})

	// Complete assistant message (fires after all deltas for one turn)
	cc.on('session:message', ({ sessionId, message }: { sessionId: string; message: ClaudeAssistantMessage }) => {
		// Each tool use gets emitted here too
		for (const block of message.message.content) {
			if (block.type === 'tool_use') {
				console.log()
				console.log(timestamp() + warn(`  ⚡ Tool call: ${bold(block.name)}`))
			}
		}
	})

	// Session result — everything is done
	cc.on('session:result', ({ sessionId, result, isError, costUsd, turns, durationMs }: {
		sessionId: string
		result: string
		isError: boolean
		costUsd: number
		turns: number
		durationMs: number
	}) => {
		console.log()
		console.log()
		console.log(separator())

		if (isError) {
			console.log(error('  ✗ Session failed'))
			console.log(error(`    ${result}`))
		} else {
			console.log(success('  ✓ Session complete'))
		}

		console.log()
		console.log(dim('    ┌─────────────────────────────────┐'))
		console.log(dim('    │ ') + label('Session Summary') + dim('                  │'))
		console.log(dim('    ├─────────────────────────────────┤'))
		console.log(dim('    │ ') + dim('Duration:  ') + colors.white(ui.padRight(formatDuration(durationMs), 20)) + dim(' │'))
		console.log(dim('    │ ') + dim('Turns:     ') + colors.white(ui.padRight(String(turns), 20)) + dim(' │'))
		console.log(dim('    │ ') + dim('Cost:      ') + colors.white(ui.padRight(formatCost(costUsd), 20)) + dim(' │'))
		console.log(dim('    │ ') + dim('Tokens:    ') + colors.white(ui.padRight(`~${tokenCount} chunks streamed`, 20)) + dim(' │'))
		console.log(dim('    └─────────────────────────────────┘'))
		console.log()
	})

	// Errors
	cc.on('session:error', ({ sessionId, error: err }: { sessionId: string; error: any }) => {
		console.log()
		console.log(error(`  ✗ Error: ${err}`))
	})

	// Parse errors (malformed JSON from the CLI)
	cc.on('session:parse-error', ({ line }: { line: string }) => {
		console.log(warn(`  ⚠ Parse error on line: ${dim(line.slice(0, 80))}`))
	})

	// ── State change observer ──────────────────────────────────────
	cc.state.observe((changeType, key, value) => {
		if (key === 'activeSessions') {
			const active = value as string[] | undefined
			if (active && active.length > 0) {
				// session is running — could do a periodic spinner here
			}
		}
	})

	// ── Run it ─────────────────────────────────────────────────────
	const session = await cc.run(prompt, {
		streaming: true
	})

	// ── Final state dump ───────────────────────────────────────────
	console.log(separator())
	console.log(label('  Final Session State'))
	console.log(separator())
	console.log(dim('    ID:           ') + colors.white(session.id))
	console.log(dim('    Claude ID:    ') + colors.white(session.sessionId || 'n/a'))
	console.log(dim('    Status:       ') + (session.status === 'completed' ? success(session.status) : error(session.status)))
	console.log(dim('    Messages:     ') + colors.white(String(session.messages.length)))
	console.log(dim('    Total cost:   ') + colors.white(formatCost(session.costUsd)))
	console.log(dim('    Wall time:    ') + colors.white(formatDuration(Date.now() - startTime)))
	console.log()
	console.log(separator('═'))
	console.log(dim('  Done.'))
	console.log()
}

main().catch((err) => {
	console.error(colors.red.bold('\n  Fatal error:'), err)
	process.exit(1)
})
