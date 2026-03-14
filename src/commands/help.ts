import { z } from 'zod'
import { commands } from '../command.js'
import { CommandOptionsSchema } from '../schemas/base.js'
import type { ContainerContext } from '../container.js'

declare module '../command.js' {
	interface AvailableCommands {
		help: ReturnType<typeof commands.registerHandler>
	}
}

export const argsSchema = CommandOptionsSchema.extend({})

/** Hidden option prefixes — legacy aliases that shouldn't clutter help output. */
const HIDDEN_PREFIXES = ['only-']
const HIDDEN_KEYS = new Set(['_', 'name', '_cacheKey'])

/**
 * Extract CLI option info from a Zod schema.
 * Walks through Zod v4 wrapper types (default, optional) to find descriptions, types, and defaults.
 */
function extractOptions(schema: any): Array<{ flag: string; description: string; type: string; defaultValue?: any }> {
	if (!schema?.shape) return []

	const options: Array<{ flag: string; description: string; type: string; defaultValue?: any }> = []

	for (const [key, field] of Object.entries(schema.shape)) {
		if (HIDDEN_KEYS.has(key)) continue
		if (HIDDEN_PREFIXES.some((p) => key.startsWith(p))) continue

		const f = field as any
		// In Zod v4, description lives on the schema object itself
		const description = f.description || ''
		let type = 'string'
		let defaultValue: any = undefined

		// Walk through wrapper types to find leaf type and default
		let current = f
		while (current) {
			const defType = current._def?.type || current.type
			if (defType === 'default') {
				defaultValue = current._def?.defaultValue
				if (typeof defaultValue === 'function') defaultValue = defaultValue()
			}
			if (defType === 'boolean') { type = 'boolean'; break }
			if (defType === 'string') { type = 'string'; break }
			if (defType === 'number') { type = 'number'; break }
			if (defType === 'enum') { type = current.options?.join(' | ') || 'enum'; break }
			// Unwrap
			current = current._def?.innerType
		}

		options.push({ flag: key, description, type, defaultValue })
	}

	return options
}

/**
 * Format CLI-oriented help text for a single command.
 * Exported so other commands (like describe) can reuse it.
 */
export function formatCommandHelp(name: string, Cmd: any, colors: any): string {
	const desc = Cmd.commandDescription || ''
	const schema = Cmd.argsSchema
	const lines: string[] = []

	lines.push('')
	lines.push(`  ${colors.cyan.bold(`luca ${name}`)}  ${desc ? `${colors.dim('—')} ${desc}` : ''}`)
	lines.push('')

	const options = extractOptions(schema)

	if (options.length === 0) {
		lines.push(`  ${colors.white('Usage:')} ${colors.cyan(`luca ${name}`)}`)
	} else {
		const booleans = options.filter((o) => o.type === 'boolean')
		const valued = options.filter((o) => o.type !== 'boolean')

		lines.push(`  ${colors.white('Usage:')} ${colors.cyan(`luca ${name}`)} ${colors.dim('[options]')}`)
		lines.push('')

		if (valued.length > 0) {
			lines.push(`  ${colors.white('Options:')}`)
			lines.push('')
			const maxLen = Math.max(...valued.map((o) => `--${o.flag} <${o.type}>`.length))
			for (const opt of valued) {
				const flag = `--${opt.flag} <${opt.type}>`
				let line = `    ${colors.green(flag.padEnd(maxLen + 2))} ${opt.description}`
				if (opt.defaultValue !== undefined && opt.defaultValue !== false) {
					line += ` ${colors.dim(`(default: ${opt.defaultValue})`)}`
				}
				lines.push(line)
			}
			lines.push('')
		}

		if (booleans.length > 0) {
			lines.push(`  ${colors.white('Flags:')}`)
			lines.push('')
			const maxLen = Math.max(...booleans.map((o) => `--${o.flag}`.length))
			for (const opt of booleans) {
				const flag = `--${opt.flag}`
				let line = `    ${colors.green(flag.padEnd(maxLen + 2))} ${opt.description}`
				if (opt.defaultValue === true) {
					line += ` ${colors.dim('(default: true)')}`
				}
				lines.push(line)
			}
			lines.push('')
		}
	}

	return lines.join('\n')
}

/** Strip ANSI escape codes for visible width calculation. */
function stripAnsi(s: string): string {
	return s.replace(/\x1B\[[0-9;]*m/g, '')
}

/** Merge two multi-line blocks side by side with a gap. */
function sideBySide(left: string[], right: string[], gap = 3): string[] {
	const maxLeftWidth = Math.max(...left.map((l) => stripAnsi(l).length))
	const maxLines = Math.max(left.length, right.length)
	const result: string[] = []

	for (let i = 0; i < maxLines; i++) {
		const l = left[i] || ''
		const r = right[i] || ''
		const visLen = stripAnsi(l).length
		const pad = Math.max(0, maxLeftWidth - visLen) + gap
		result.push(l + ' '.repeat(pad) + r)
	}

	return result
}

const LEGO_ROBOT = [
	' ┌─○○─┐ ',
	' │ ●● │ ',
	' ├○──○┤ ',
	' └─╨╨─┘ ',
]

const BANNER_COLORS: string[] = ['cyan', 'blue', 'magenta']

export default async function help(_options: z.infer<typeof argsSchema>, context: ContainerContext) {
	const container = context.container as any
	const ui = container.feature('ui') as any
	const c = ui.colors

	const args = container.argv._ as string[]
	const target = args[1] as string

	if (!target) {
		// Robot (left) + banner (right), same height — direct 1:1 alignment
		const banner = ui.banner('luca', { font: 'Small Slant', colors: BANNER_COLORS })
		const bannerLines = banner.split('\n').filter((l: string) => l.trim())
		const coloredRobot = ui.applyGradient(LEGO_ROBOT.join('\n'), BANNER_COLORS)
		const robotLines = coloredRobot.split('\n') as string[]
		const robotWidth = Math.max(...LEGO_ROBOT.map((l: string) => l.length))

		const headerLines: string[] = []
		const maxLines = Math.max(robotLines.length, bannerLines.length)
		for (let i = 0; i < maxLines; i++) {
			const rLine = robotLines[i] || ''
			const rPad = robotWidth - stripAnsi(rLine).length
			const bLine = bannerLines[i] || ''
			headerLines.push(rLine + ' '.repeat(rPad + 2) + bLine)
		}

		console.log('\n')
		console.log(headerLines.join('\n'))
		console.log(c.dim('  Lightweight Universal Conversational Architecture'))
		console.log()
		console.log(c.white('  Usage: ') + c.cyan('luca') + c.dim(' <command|file> [options]'))
		console.log()
		const allNames = (container.commands.available as string[]).filter((n: string) => n !== 'help')
		const maxNameLen = Math.max(...allNames.map((n: string) => n.length)) + 2

		const sources = (container as any)._commandSources as
			| { builtinCommands: Set<string>; projectCommands: Set<string>; userCommands: Set<string> }
			| undefined

		const printCommands = (names: string[]) => {
			for (const name of names) {
				const Cmd = container.commands.lookup(name) as any
				const desc = Cmd.commandDescription || ''
				console.log(`    ${c.cyan(name.padEnd(maxNameLen))} ${c.dim(desc)}`)
			}
		}

		// Built-in commands
		const builtinNames = sources
			? allNames.filter((n) => sources.builtinCommands.has(n))
			: allNames
		console.log(c.white('  Commands:'))
		console.log()
		printCommands(builtinNames)

		// Project-local commands
		if (sources && sources.projectCommands.size > 0) {
			console.log()
			console.log(c.white('  Project Commands') + c.dim(' (./commands/*)'))
			console.log()
			printCommands(allNames.filter((n) => sources.projectCommands.has(n)))
		}

		// User-level commands
		if (sources && sources.userCommands.size > 0) {
			console.log()
			console.log(c.white('  User Commands') + c.dim(' (~/.luca/commands/*)'))
			console.log()
			printCommands(allNames.filter((n) => sources.userCommands.has(n)))
		}

		console.log()
		console.log(c.dim('  Run ') + c.cyan('luca <file>') + c.dim(' to execute a script or markdown (.ts, .js, .md)'))
		console.log(c.dim('  Run ') + c.cyan('luca help <command>') + c.dim(' for detailed usage of a command'))
		console.log()
		return
	}

	if (!container.commands.has(target)) {
		console.error(`  Unknown command: ${c.red(target)}`)
		console.error()
		console.error(`  Run ${c.cyan('luca help')} to see available commands.`)
		return
	}

	const Cmd = container.commands.lookup(target) as any
	console.log(formatCommandHelp(target, Cmd, c))
}

commands.registerHandler('help', {
	description: 'Show help for luca commands',
	argsSchema,
	handler: help,
})
