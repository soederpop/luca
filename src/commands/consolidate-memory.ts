import { z } from 'zod'
import { commands } from '../command.js'
import { CommandOptionsSchema } from '../schemas/base.js'
import type { ContainerContext } from '../container.js'
import type { Memory, MemoryConsolidateAction, MemoryConsolidateReport, MemoryRecord } from '../agi/features/agent-memory.js'
import { reviewPlan, type ReviewPrompts } from './lib/memory-review.js'

declare module '../command.js' {
	interface AvailableCommands {
		'consolidate-memory': ReturnType<typeof commands.registerHandler>
	}
}

export const positionals = ['namespace']

export const argsSchema = CommandOptionsSchema.extend({
	namespace: z.string().optional().describe('The namespace to work on, usually the assistant name. Defaults to every namespace in the database'),
	interactive: z.boolean().default(false).describe('Review each proposed change yourself, then optionally every other active memory'),
	apply: z.boolean().default(false).describe('Apply the plan without review. Without this or --interactive, nothing is changed'),
	provider: z.string().optional().describe('Model provider preset for the judge, e.g. deepseek-v4-local'),
	model: z.string().optional().describe('Model for the judge. Usually unnecessary when --provider is set'),
	embeddingProvider: z.enum(['local', 'openai']).default('local').describe('Must match how these memories were embedded. Mixed vector sizes break search'),
	db: z.string().optional().describe('Path to the memory database. Defaults to the one for the current folder'),
	savePlan: z.string().optional().describe('Write the plan to this file, to review or apply later'),
	plan: z.string().optional().describe('Use a saved plan instead of asking the judge again'),
	json: z.boolean().default(false).describe('Print machine-readable JSON'),
})

export const examples = [
	{ command: 'luca consolidate-memory chiefOfStaff --provider deepseek-v4-local', description: 'See what the judge would change. Nothing is written' },
	{ command: 'luca consolidate-memory chiefOfStaff --interactive', description: 'Decide on each change yourself' },
	{ command: 'luca consolidate-memory --save-plan plan.json', description: 'Save a plan for every namespace in this folder' },
	{ command: 'luca consolidate-memory --plan plan.json --apply', description: 'Apply exactly what the saved plan says' },
]

interface SavedPlan {
	dbPath: string
	createdAt: string
	plans: Record<string, MemoryConsolidateReport>
}

const ACTION_LABELS: Record<MemoryConsolidateAction['type'], string> = {
	merge: 'Merge',
	supersede: 'Supersede (the first memory replaces the others)',
	generalize: 'Generalize (add a new rule, keep these)',
	expire: 'Expire',
	keep: 'Keep',
}

function terminalPrompts(ui: any): ReviewPrompts {
	const printRow = (row: MemoryRecord) => {
		ui.print(`  ${ui.colors.cyan(`[${row.id}]`)} ${ui.colors.dim(`${row.category}, ${row.created_at.slice(0, 10)}, ${row.layer}`)}`)
		ui.print(`  ${row.document}\n`)
	}
	const choose = async (message: string, choices: { name: string; value: string }[]) =>
		(await ui.wizard([{ type: 'list', name: 'choice', message, choices }])).choice as string
	const input = async (message: string, initial?: string) =>
		(await ui.wizard([{ type: 'input', name: 'text', message, default: initial }])).text as string

	return {
		async change(action, rows) {
			ui.print(`\n${ui.colors.bold(ACTION_LABELS[action.type])}`)
			rows.forEach(printRow)
			if (action.text) ui.print(`  ${ui.colors.green('Proposed wording:')} ${action.text}\n`)
			if (action.reason) ui.print(`  ${ui.colors.yellow('Reason:')} ${action.reason}\n`)

			const editable = action.type === 'merge' || action.type === 'generalize'
			const choice = await choose('What should happen?', [
				{ name: 'Apply', value: 'apply' },
				...(editable ? [{ name: 'Apply with my wording', value: 'edit' }] : []),
				{ name: 'Reject, leave these as they are', value: 'reject' },
				{ name: 'Stop here', value: 'stop' },
			])
			if (choice === 'edit') return { decision: 'apply', text: await input('Wording', action.text ?? rows[0]?.document) }
			return { decision: choice as 'apply' | 'reject' | 'stop' }
		},
		async reviewMemories(count) {
			const answer = await ui.wizard([{ type: 'confirm', name: 'yes', message: `Go through the other ${count} active memories too?`, default: false }])
			return Boolean(answer.yes)
		},
		async memory(row) {
			ui.print('')
			printRow(row)
			const choice = await choose('What should happen?', [
				{ name: 'Keep', value: 'keep' },
				{ name: 'Rewrite', value: 'rewrite' },
				{ name: 'Expire, its time has passed', value: 'expire' },
				{ name: 'Forget, it is wrong', value: 'forget' },
				{ name: 'Stop here', value: 'stop' },
			])
			if (choice === 'rewrite') return { decision: 'rewrite', text: await input('New wording', row.document) }
			if (choice === 'expire' || choice === 'forget') return { decision: choice, reason: await input('Reason (optional)') }
			return { decision: choice as 'keep' | 'stop' }
		},
	}
}

async function printPlan(ui: any, memory: Memory, namespace: string, plan: MemoryConsolidateReport) {
	ui.print(ui.colors.bold(`\n${namespace}`))
	ui.print(`  ${plan.rowsReviewed} active memories, ${plan.clusters} sent to the judge`)
	ui.print(`  merge ${plan.merged}, supersede ${plan.superseded}, generalize ${plan.generalized}, expire ${plan.expired}`)
	for (const action of plan.actions.filter(a => a.type !== 'keep')) {
		ui.print(`\n  ${ui.colors.bold(ACTION_LABELS[action.type])}${action.reason ? `: ${action.reason}` : ''}`)
		for (const id of action.ids) {
			const row = await memory.get(action.category, id)
			if (row) ui.print(`    [${id}] ${row.document.slice(0, 140)}`)
		}
		if (action.text) ui.print(`    ${ui.colors.green('=>')} ${action.text.slice(0, 200)}`)
	}
	for (const warning of plan.warnings) ui.print(`  ${ui.colors.yellow('warning:')} ${warning}`)
}

export async function consolidateMemory(options: z.infer<typeof argsSchema>, context: ContainerContext) {
	const container = context.container as any
	const ui = container.feature('ui')
	const fs = container.feature('fs')
	const fail = (message: string) => {
		ui.print.red(message)
		process.exitCode = 1
	}

	if (options.apply && options.interactive) return fail('Choose either --apply or --interactive.')
	if (options.interactive && !process.stdin.isTTY) return fail('--interactive needs a terminal. Use --save-plan to review the plan instead.')

	const open = (namespace?: string): Memory => container.feature('memory', {
		...(namespace ? { namespace } : {}),
		...(options.db ? { dbPath: options.db } : {}),
		...(options.provider ? { provider: options.provider } : {}),
		...(options.model ? { model: options.model } : {}),
		embeddingProvider: options.embeddingProvider,
	})

	const dbPath = open().dbPath
	let saved: SavedPlan | undefined
	if (options.plan) {
		saved = JSON.parse(fs.readFile(options.plan)) as SavedPlan
		if (saved.dbPath !== dbPath) return fail(`That plan is for ${saved.dbPath}, but this folder uses ${dbPath}.`)
	}

	const namespaces = options.namespace
		? [options.namespace]
		: saved ? Object.keys(saved.plans) : await open().namespaces()

	if (!namespaces.length) {
		if (!options.json) ui.print(`No memories in ${dbPath}.`)
		return
	}

	const output: SavedPlan = { dbPath, createdAt: new Date().toISOString(), plans: {} }
	const results: Record<string, any> = {}

	for (const namespace of namespaces) {
		const memory = open(namespace)

		// Applying can embed rewritten text. Search throws on a vector size
		// mismatch, so check before writing anything that would mix sizes in.
		if (options.apply || options.interactive) await memory.search(null, 'embedding size check', 1, { trackUsage: false })

		let plan = saved?.plans[namespace]
		if (saved && !plan) {
			fail(`The saved plan has nothing for ${namespace}.`)
			continue
		}
		if (!plan) {
			if (!options.json) ui.print.dim(`Asking the judge about ${namespace}. This can take a few minutes.`)
			plan = await memory.consolidate({ dryRun: true })
		}
		output.plans[namespace] = plan

		if (options.interactive) {
			if (plan.warnings.length) for (const warning of plan.warnings) ui.print(`${ui.colors.yellow('warning:')} ${warning}`)
			results[namespace] = await reviewPlan(memory, plan, terminalPrompts(ui))
		} else if (options.apply) {
			const stale: string[] = []
			for (const action of plan.actions) {
				const result = await memory.applyConsolidationAction(action)
				if (!result.applied) stale.push(`${action.type} [${action.ids.join(', ')}]: ${result.reason}`)
			}
			const settled = await memory.settleConsolidation()
			results[namespace] = { ...settled, applied: plan.actions.length - stale.length, stale }
		} else {
			results[namespace] = plan
			if (!options.json) await printPlan(ui, memory, namespace, plan)
		}

		if (!options.json && (options.interactive || options.apply)) {
			const { stale, ...counts } = results[namespace]
			ui.print(`\n${ui.colors.bold(namespace)}: ${JSON.stringify(counts)}`)
			for (const note of stale) ui.print(`  ${ui.colors.yellow('skipped:')} ${note}`)
		}
	}

	if (options.savePlan) {
		fs.writeFile(options.savePlan, JSON.stringify(output, null, 2))
		if (!options.json) ui.print(`\nPlan saved to ${options.savePlan}. Apply it with --plan ${options.savePlan} --apply or --interactive.`)
	} else if (!options.json && !options.apply && !options.interactive) {
		ui.print.dim('\nNothing was changed. Use --interactive to decide on each change, or --apply to accept them all.')
	}

	if (options.json) console.log(JSON.stringify(results, null, 2))
}

commands.registerHandler('consolidate-memory', {
	description: 'Review and clean up assistant memory: merge duplicates, resolve contradictions, expire facts whose time has passed',
	argsSchema,
	positionals,
	examples,
	handler: consolidateMemory,
})
