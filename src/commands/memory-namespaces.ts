import { z } from 'zod'
import { commands } from '../command.js'
import { CommandOptionsSchema } from '../schemas/base.js'
import type { ContainerContext } from '../container.js'

declare module '../command.js' {
	interface AvailableCommands {
		'memory-namespaces': ReturnType<typeof commands.registerHandler>
	}
}

export const argsSchema = CommandOptionsSchema.extend({
	action: z.enum(['status', 'rename', 'copy', 'leave']).default('status').describe('What to do: status, rename, copy, or leave'),
	to: z.array(z.string()).default([]).describe('Assistant namespaces that receive the memories (one for rename, one or more for copy)'),
	from: z.string().default('assistant').describe('Namespace to migrate from. The default is the old shared one'),
	apply: z.boolean().default(false).describe('Write the changes. Without it the command is a dry run and changes nothing'),
	dbPath: z.string().optional().describe("Memory database file. Defaults to this folder's own database"),
	json: z.boolean().default(false).describe('Print raw JSON'),
})

export const positionals = ['action', '...to']

export const subcommands = {
	status: {
		args: '',
		description: 'Show row counts per namespace and whether old shared memories still need a decision',
		examples: ['luca memory-namespaces'],
	},
	rename: {
		args: '<assistant>',
		description: 'Move every memory under the old namespace to one assistant. For a database only one assistant used',
		examples: ['luca memory-namespaces rename researcher', 'luca memory-namespaces rename researcher --apply'],
	},
	copy: {
		args: '<assistant...>',
		description: 'Give each named assistant its own copy of the old memories. The originals stay. For a shared database',
		examples: ['luca memory-namespaces copy researcher writer --apply'],
	},
	leave: {
		args: '',
		description: 'Change no rows. Record that the old memories stay where they are, which stops the warning',
		examples: ['luca memory-namespaces leave --apply'],
	},
}

export const examples = [
	{ command: 'luca memory-namespaces', description: "Row counts per namespace in this folder's memory database" },
	{ command: 'luca memory-namespaces rename researcher', description: 'Dry run: show what a rename would move' },
	{ command: 'luca memory-namespaces copy researcher writer --apply', description: 'Copy the old shared memories to two assistants' },
]

export default async function memoryNamespaces(options: z.infer<typeof argsSchema>, context: ContainerContext) {
	const container = context.container as any
	const ui = container.feature('ui')
	const out = (value: unknown) => console.log(JSON.stringify(value, null, 2))
	const fail = (message: string) => {
		if (options.json) out({ error: message })
		else ui.print.red(message)
		process.exit(1)
	}

	// Opened on the source namespace: opening a memory set adds an epochs row
	// for its namespace, and this one already has it in a database to migrate.
	const memory = container.feature('memory', {
		namespace: options.from,
		...(options.dbPath ? { dbPath: container.paths.resolve(options.dbPath) } : {}),
	})
	const dbPath: string = memory.dbPath

	// Opening a missing database would create it. A folder with no memory has nothing to migrate.
	if (!container.fs.exists(dbPath)) {
		if (options.json) out({ dbPath, exists: false, namespaces: [] })
		else ui.print.dim(`No memory database for this folder (${dbPath}). Nothing to do.`)
		return
	}

	// Folder names of the assistants in this cwd: the namespaces they use after the upgrade.
	let assistants: string[] = []
	try {
		const manager = container.feature('assistantsManager')
		await manager.discover()
		assistants = [...manager.available]
	} catch {}

	const table = (rows: Array<{ namespace: string; memories: number; active: number; epoch: number | null }>) => {
		if (!rows.length) return ui.print.dim('  (no rows)')
		const width = Math.max(9, ...rows.map(r => r.namespace.length))
		ui.print.dim(`  ${'namespace'.padEnd(width)}  memories  active  epoch`)
		for (const r of rows) {
			console.log(`  ${r.namespace.padEnd(width)}  ${String(r.memories).padStart(8)}  ${String(r.active).padStart(6)}  ${String(r.epoch ?? '-').padStart(5)}`)
		}
	}

	if (options.action === 'status') {
		const namespaces = await memory.namespaceSummary()
		const legacy = namespaces.find((n: any) => n.namespace === options.from)
		const perAssistant = [] as any[]
		for (const name of assistants) {
			if (name === options.from) continue
			perAssistant.push(await memory.legacyNamespaceStatus({ namespace: name, legacyNamespace: options.from }))
		}
		const needsMigration = perAssistant.some(s => s.needsMigration)

		if (options.json) return out({ dbPath, exists: true, namespaces, assistants: perAssistant, needsMigration })

		ui.print(ui.colors.bold(dbPath))
		table(namespaces)
		if (!legacy?.memories) {
			ui.print.green(`\nNo memories under "${options.from}". Nothing to migrate.`)
			return
		}
		console.log()
		for (const s of perAssistant) {
			if (s.left) ui.print.dim(`  ${s.namespace}: old memories left under "${options.from}" on purpose`)
			else if (s.pending) ui.print.yellow(`  ${s.namespace}: cannot see ${s.pending} of the ${s.legacyRows} memories under "${options.from}"`)
			else ui.print.green(`  ${s.namespace}: has a copy of every memory under "${options.from}"`)
		}
		if (needsMigration) {
			ui.print(`\nRows do not record which assistant wrote them, so you choose:`)
			ui.print(`  luca memory-namespaces rename <assistant>     only one assistant used this database`)
			ui.print(`  luca memory-namespaces copy <assistant...>    several did; each gets a copy`)
			ui.print(`  luca memory-namespaces leave                  keep them under "${options.from}"`)
			ui.print.dim(`Each is a dry run until you add --apply.`)
		}
		return
	}

	let report: any
	try {
		report = await memory.migrateNamespace({
			mode: options.action,
			from: options.from,
			to: options.to,
			dryRun: !options.apply,
		})
	} catch (err: any) {
		return fail(err?.message || String(err))
	}

	if (options.json) return out(report)

	ui.print(ui.colors.bold(dbPath))
	ui.print.dim(report.dryRun ? 'Before (dry run, nothing is written):' : 'Before:')
	table(report.before)
	console.log()

	const verb = report.dryRun ? 'would' : 'did'
	if (report.mode === 'leave') {
		ui.print(`${verb === 'would' ? 'Would record' : 'Recorded'} that the ${report.sourceRows} memories under "${report.from}" stay there. No rows change.`)
	} else if (!report.targets.some((t: any) => t.rows > 0)) {
		ui.print.green(`Nothing to ${report.mode}: no rows under "${report.from}" are waiting.`)
	} else {
		for (const t of report.targets) {
			const what = report.mode === 'rename' ? 'move' : 'copy'
			ui.print(`${verb === 'would' ? `Would ${what}` : (what === 'move' ? 'Moved' : 'Copied')} ${t.rows} rows from "${report.from}" to "${t.namespace}" (${t.alreadyThere} already there, epoch ${t.epoch}).`)
		}
		if (report.mode === 'copy') ui.print.dim(`The ${report.sourceRows} rows under "${report.from}" stay.`)
	}

	const unknown = report.targets.map((t: any) => t.namespace).filter((n: string) => assistants.length && !assistants.includes(n))
	if (unknown.length) ui.print.yellow(`No assistant folder here is named: ${unknown.join(', ')}. Assistants here: ${assistants.join(', ')}`)

	if (report.dryRun) {
		ui.print.dim('\nDry run. Add --apply to write.')
		return
	}
	console.log()
	ui.print.dim('After:')
	table(report.after)
}

commands.registerHandler('memory-namespaces', {
	description: 'Move, copy, or keep memories stored under the old shared "assistant" namespace, now that each assistant has its own',
	argsSchema,
	positionals,
	subcommands,
	examples,
	handler: memoryNamespaces,
})
