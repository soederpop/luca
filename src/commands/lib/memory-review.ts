import type { Memory, MemoryConsolidateAction, MemoryConsolidateReport, MemoryRecord } from '../../agi/features/agent-memory.js'

export interface ChangeDecision {
	decision: 'apply' | 'reject' | 'stop'
	/** Replaces the judge's wording on a merge or generalize. */
	text?: string
}

export interface MemoryDecision {
	decision: 'keep' | 'rewrite' | 'expire' | 'forget' | 'stop'
	/** The new wording, for rewrite. */
	text?: string
	/** Kept in the audit trail, for expire and forget. */
	reason?: string
}

/** The questions a review asks. Separate from the terminal so the flow can be tested without a TTY. */
export interface ReviewPrompts {
	change(action: MemoryConsolidateAction, rows: MemoryRecord[]): Promise<ChangeDecision>
	reviewMemories(count: number): Promise<boolean>
	memory(row: MemoryRecord): Promise<MemoryDecision>
}

export interface ReviewSummary {
	applied: number
	rejected: number
	rewritten: number
	expired: number
	forgotten: number
	/** Actions refused because a row changed after the plan was made. */
	stale: string[]
	/** False if the operator stopped early. The epoch only advances on a finished review. */
	completed: boolean
}

/**
 * Walk one person through a dry-run plan, then optionally through every other
 * active memory. Each decision is written as it is made, so stopping early
 * keeps the decisions so far.
 *
 * A rejected change counts as reviewed. Otherwise the judge would propose the
 * same change again on the next pass.
 */
export async function reviewPlan(memory: Memory, plan: MemoryConsolidateReport, prompts: ReviewPrompts): Promise<ReviewSummary> {
	const summary: ReviewSummary = { applied: 0, rejected: 0, rewritten: 0, expired: 0, forgotten: 0, stale: [], completed: false }
	const seen = new Set<number>()

	const apply = async (action: MemoryConsolidateAction) => {
		const result = await memory.applyConsolidationAction(action)
		if (!result.applied) summary.stale.push(`${action.type} [${action.ids.join(', ')}]: ${result.reason}`)
		return result.applied
	}

	for (const action of plan.actions.filter(a => a.type !== 'keep')) {
		const rows = (await Promise.all(action.ids.map(id => memory.get(action.category, id)))).filter(Boolean) as MemoryRecord[]
		const answer = await prompts.change(action, rows)
		if (answer.decision === 'stop') return summary

		for (const id of action.ids) seen.add(id)
		if (answer.decision === 'reject') {
			await apply({ type: 'keep', category: action.category, ids: action.ids })
			summary.rejected++
		} else if (await apply({ ...action, text: answer.text ?? action.text })) {
			summary.applied++
		}
	}

	// The judge's keeps go in only after the changes, so stopping above leaves them unreviewed.
	for (const action of plan.actions.filter(a => a.type === 'keep')) await apply(action)

	const { memories } = await memory.exportToJson()
	const remaining = memories.filter(m => m.status === 'active' && !seen.has(m.id))

	if (remaining.length && await prompts.reviewMemories(remaining.length)) {
		for (const row of remaining) {
			const answer = await prompts.memory(row)
			if (answer.decision === 'stop') return summary

			if (answer.decision === 'rewrite' && answer.text) {
				await memory.revise(row.category, row.id, answer.text)
				summary.rewritten++
			} else if (answer.decision === 'expire') {
				if (await apply({ type: 'expire', category: row.category, ids: [row.id], reason: answer.reason || 'expired by operator' })) summary.expired++
			} else if (answer.decision === 'forget') {
				await memory.forget({ category: row.category, id: row.id, reason: answer.reason || 'forgotten by operator' })
				summary.forgotten++
			} else {
				await apply({ type: 'keep', category: row.category, ids: [row.id] })
			}
		}
	}

	summary.completed = true
	await memory.settleConsolidation()
	return summary
}
