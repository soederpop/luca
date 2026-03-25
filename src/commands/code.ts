import { z } from 'zod'
import * as readline from 'readline'
import { commands } from '../command.js'
import { CommandOptionsSchema } from '../schemas/base.js'
import type { ContainerContext } from '../container.js'
import type { AGIContainer, AGIFeatures } from '../agi/container.server.js'

declare module '../command.js' {
	interface AvailableCommands {
		code: ReturnType<typeof commands.registerHandler>
	}
}

export const argsSchema = CommandOptionsSchema.extend({
	model: z.string().optional().describe('Override the LLM model'),
	local: z.boolean().default(false).describe('Use a local API server'),
	prompt: z.string().optional().describe('Path to a markdown file or inline text for the system prompt'),
	allowAll: z.boolean().default(false).describe('Start with all permissions set to allow (fully autonomous)'),
	denyWrites: z.boolean().default(false).describe('Deny all write/delete/move operations'),
	skills: z.string().optional().describe('Comma-separated list of additional skill names to load'),
})

export const positionals = ['prompt']

export default async function code(options: z.infer<typeof argsSchema>, context: ContainerContext<AGIFeatures>) {
	const container = context.container as AGIContainer
	const ui = container.feature('ui')
	const colors = ui.colors
	const fs = container.feature('fs')

	// ── Resolve system prompt ──────────────────────────────────────────────
	let systemPrompt = [
		'You are an autonomous coding assistant with access to file system and shell tools.',
		'You can read, write, search, and edit files, and run shell commands via the bash tool.',
		'Always search and read code before making changes. Use editFile for surgical modifications.',
		'Use the bash tool for running builds, tests, git commands, and any shell operations.',
		'Explain what you plan to do before doing it.',
	].join('\n')

	if (options.prompt) {
		const resolved = container.paths.resolve(options.prompt)
		if (fs.exists(resolved)) {
			systemPrompt = fs.readFile(resolved)
		} else if (!options.prompt.endsWith('.md')) {
			systemPrompt = options.prompt
		} else {
			console.error(colors.red(`File not found: ${resolved}`))
			process.exit(1)
		}
	}

	// ── Permission profile ─────────────────────────────────────────────────
	const readTools = ['readFile', 'searchFiles', 'findFiles', 'listDirectory', 'fileInfo']
	const writeTools = ['writeFile', 'editFile', 'createDirectory', 'moveFile', 'copyFile', 'bash']
	const dangerTools = ['deleteFile']

	const permissions: Record<string, 'allow' | 'ask' | 'deny'> = {}

	if (options.allowAll) {
		for (const t of [...readTools, ...writeTools, ...dangerTools]) permissions[t] = 'allow'
	} else if (options.denyWrites) {
		for (const t of readTools) permissions[t] = 'allow'
		for (const t of writeTools) permissions[t] = 'deny'
		for (const t of dangerTools) permissions[t] = 'deny'
	} else {
		// Default: reads are free, writes need approval, danger is denied
		for (const t of readTools) permissions[t] = 'allow'
		for (const t of writeTools) permissions[t] = 'ask'
		for (const t of dangerTools) permissions[t] = 'deny'
	}

	// ── Parse extra skills ────────────────────────────────────────────────
	const extraSkills = options.skills ? options.skills.split(',').map((s: string) => s.trim()).filter(Boolean) : undefined

	// ── Create the luca coder ──────────────────────────────────────────────
	const coder = container.feature('lucaCoder', {
		tools: ['fileTools'],
		permissions,
		defaultPermission: 'ask',
		systemPrompt,
		model: options.model,
		local: options.local,
		skills: extraSkills,
	})

	// ── UI setup ───────────────────────────────────────────────────────────
	const ink = container.feature('ink', { enable: true })
	await ink.loadModules()
	const React = ink.React
	const { Text } = ink.components
	const inkModule = await import('ink')

	let responseBuffer = ''
	let inkInstance: any = null

	function mdElement(content: string) {
		const rendered = content ? String(ui.markdown(content)).trimEnd() : ''
		return React.createElement(Text, null, rendered)
	}

	// Wire events on coder before starting (it forwards from inner assistant)
	coder.on('chunk', (text: string) => {
		responseBuffer += text
		if (!inkInstance) {
			process.stdout.write('\n')
			inkInstance = inkModule.render(mdElement(responseBuffer), { patchConsole: false })
		} else {
			inkInstance.rerender(mdElement(responseBuffer))
		}
	})

	coder.on('toolCall', (toolName: string, args: any) => {
		if (inkInstance) { inkInstance.unmount(); inkInstance = null }
		const argsStr = JSON.stringify(args).slice(0, 120)
		process.stdout.write(colors.dim(`\n  ⟳ ${toolName}`) + colors.dim(`(${argsStr})\n`))
	})

	coder.on('toolResult', (toolName: string, result: any) => {
		const preview = typeof result === 'string' ? result.slice(0, 100) : JSON.stringify(result).slice(0, 100)
		process.stdout.write(colors.green(`  ✓ ${toolName}`) + colors.dim(` → ${preview}${preview.length >= 100 ? '…' : ''}\n`))
	})

	coder.on('toolError', (toolName: string, error: any) => {
		const msg = error?.message || String(error)
		process.stdout.write(colors.red(`  ✗ ${toolName}: ${msg}\n`))
	})

	coder.on('response', () => {
		if (inkInstance) { inkInstance.unmount(); inkInstance = null }
		responseBuffer = ''
		process.stdout.write('\n')
	})

	// Start the coder (creates inner assistant, registers bash tool, stacks fileTools, loads skills)
	await coder.start()

	// ── Permission request handler ─────────────────────────────────────────
	coder.on('permissionRequest', ({ id, toolName, args }: { id: string; toolName: string; args: Record<string, any> }) => {
		if (inkInstance) { inkInstance.unmount(); inkInstance = null }

		const argsPreview = Object.entries(args)
			.map(([k, v]) => {
				const val = typeof v === 'string'
					? (v.length > 60 ? v.slice(0, 57) + '...' : v)
					: JSON.stringify(v)
				return `    ${colors.dim(k)}: ${val}`
			})
			.join('\n')

		process.stdout.write('\n')
		process.stdout.write(colors.yellow(`  ⚡ Permission required: ${colors.bold(toolName)}\n`))
		if (argsPreview) process.stdout.write(argsPreview + '\n')
		process.stdout.write(colors.dim(`\n  [y] approve  [n] deny  [a] allow all future ${toolName} calls\n`))

		promptApproval(id, toolName)
	})

	coder.on('toolBlocked', (toolName: string, reason: string) => {
		process.stdout.write(colors.red(`  ✗ ${toolName} blocked (${reason})\n`))
	})

	// ── Readline ───────────────────────────────────────────────────────────
	let rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	})
	let rlClosed = false
	rl.on('close', () => { rlClosed = true })

	function ensureRl() {
		if (rlClosed) {
			rl = readline.createInterface({ input: process.stdin, output: process.stdout })
			rlClosed = false
			rl.on('close', () => { rlClosed = true })
		}
	}

	function prompt(): Promise<string> {
		return new Promise((resolve) => {
			ensureRl()
			rl.question(colors.cyan('\n  code > '), (answer: string) => resolve(answer.trim()))
		})
	}

	function promptApproval(id: string, toolName: string) {
		ensureRl()
		rl.question(colors.yellow('  > '), (answer: string) => {
			const a = answer.trim().toLowerCase()
			if (a === 'y' || a === 'yes') {
				coder.approve(id)
			} else if (a === 'a' || a === 'always') {
				coder.permitTool(toolName)
				coder.approve(id)
				process.stdout.write(colors.green(`  ✓ ${toolName} will be auto-approved from now on\n`))
			} else {
				coder.deny(id)
			}
		})
	}

	// ── Banner ─────────────────────────────────────────────────────────────
	console.log()
	console.log(ui.banner('CODE', { font: 'Small', colors: ['cyan', 'blue'] }))

	const toolCount = Object.keys(coder.tools).length
	const allowCount = Object.values(permissions).filter(v => v === 'allow').length
	const askCount = Object.values(permissions).filter(v => v === 'ask').length
	const denyCount = Object.values(permissions).filter(v => v === 'deny').length
	const loadedSkills = coder.state.get('loadedSkills') as string[]

	console.log(colors.dim(`  ${toolCount} tools loaded`))
	console.log(
		colors.green(`  ${allowCount} allow`) + colors.dim(' · ') +
		colors.yellow(`${askCount} ask`) + colors.dim(' · ') +
		colors.red(`${denyCount} deny`)
	)
	if (loadedSkills.length) {
		console.log(colors.dim(`  Skills: ${loadedSkills.join(', ')}`))
	}
	console.log()
	console.log(colors.dim('  Commands: .exit  .perms  .allow <tool>  .deny <tool>  .gate <tool>  .allow-all  /console'))
	console.log()

	// ── Main loop ──────────────────────────────────────────────────────────
	while (true) {
		const input = await prompt()
		if (!input) continue

		// Meta commands
		if (input === '.exit') break

		if (input === '.perms') {
			const perms = coder.permissions
			const def = coder.state.get('defaultPermission')
			console.log()
			console.log(colors.dim(`  Default: ${def}`))
			for (const [name, level] of Object.entries(perms).sort()) {
				const color = level === 'allow' ? colors.green : level === 'deny' ? colors.red : colors.yellow
				console.log(`  ${color(level.padEnd(5))} ${name}`)
			}
			console.log()
			continue
		}

		if (input.startsWith('.allow-all')) {
			for (const t of Object.keys(coder.tools)) {
				coder.permitTool(t)
			}
			console.log(colors.green('  All tools set to allow'))
			continue
		}

		if (input.startsWith('.allow ')) {
			const tool = input.slice(7).trim()
			coder.permitTool(tool)
			console.log(colors.green(`  ${tool} → allow`))
			continue
		}

		if (input.startsWith('.deny ')) {
			const tool = input.slice(6).trim()
			coder.blockTool(tool)
			console.log(colors.red(`  ${tool} → deny`))
			continue
		}

		if (input.startsWith('.gate ')) {
			const tool = input.slice(6).trim()
			coder.gateTool(tool)
			console.log(colors.yellow(`  ${tool} → ask`))
			continue
		}

		if (input === '/console') {
			// Pause readline so the REPL can own stdin
			rl.close()

			const featureContext: Record<string, any> = {}
			for (const fname of container.features.available) {
				try { featureContext[fname] = container.feature(fname) } catch {}
			}

			const replPrompt = ui.colors.magenta('console') + ui.colors.dim(' > ')
			const repl = container.feature('repl', { prompt: replPrompt })

			console.log()
			console.log(colors.dim('  Dropping into console. The coder is available as `coder`.'))
			console.log(colors.dim('  Type .exit to return to code.'))
			console.log()

			await repl.start({
				context: {
					...featureContext,
					coder,
					console,
					setTimeout, setInterval, clearTimeout, clearInterval,
					fetch,
				},
			})

			// Wait for the REPL to close
			await new Promise<void>((resolve) => {
				repl._rl!.on('close', resolve)
			})

			// Resume readline
			console.log()
			console.log(colors.dim('  Back in code mode.'))
			rl = readline.createInterface({ input: process.stdin, output: process.stdout })
			rlClosed = false
			rl.on('close', () => { rlClosed = true })
			continue
		}

		// Ask the coder
		await coder.ask(input)
	}

	rl.close()
	console.log()
}

commands.registerHandler('code', {
	description: 'Autonomous coding assistant with file tools, bash, and permission gating',
	argsSchema,
	handler: code,
})
