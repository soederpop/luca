import { describe, it, expect } from 'bun:test'
import { AGIContainer } from '../src/agi/container.server'
import { reviewPlan, type ReviewPrompts } from '../src/commands/lib/memory-review'
import { consolidateMemory } from '../src/commands/consolidate-memory'

// Real sqlite, stubbed embedder, scripted answers: the review writes to the
// database for real, and only the terminal and the network are removed.
const CLOSE = [1, 0, 0]
const FAR = [0, 0, 1]

let counter = 0
function setup(namespace = 'test') {
	const c = new AGIContainer()
	const dbPath = c.paths.resolve(c.feature('os').tmpdir, `consolidate-memory-test-${process.pid}-${Date.now()}-${counter++}.db`)
	const mem = c.feature('memory', { namespace, dbPath, embeddingProvider: 'local' }) as any
	mem.searcher.embed = async (texts: string[]) => texts.map(t => t.startsWith('far') ? FAR : CLOSE)
	return { c, mem, dbPath }
}

const keepJudge = async (prompt: string) => {
	const rows = prompt.split('\n').filter(l => l.startsWith('{')).map(l => JSON.parse(l))
	return JSON.stringify({ actions: [{ type: 'keep', ids: rows.map(r => r.id) }] })
}

function prompts(over: Partial<ReviewPrompts> = {}): ReviewPrompts {
	return {
		change: async () => ({ decision: 'apply' }),
		reviewMemories: async () => false,
		memory: async () => ({ decision: 'keep' }),
		...over,
	}
}

function planFor(actions: any[]) {
	return { epoch: 1, categories: ['facts'], rowsReviewed: 0, clusters: 0, merged: 0, superseded: 0, generalized: 0, dormant: 0, expired: 0, actions, warnings: [], dryRun: true } as any
}

describe('reviewPlan', () => {
	it('applies an approved change with the wording you gave it', async () => {
		const { mem } = setup()
		const a = await mem.create('facts', 'one')
		const b = await mem.create('facts', 'two')
		const plan = planFor([{ type: 'merge', category: 'facts', ids: [a.id, b.id], text: 'judge wording' }])

		const summary = await reviewPlan(mem, plan, prompts({ change: async () => ({ decision: 'apply', text: 'my wording' }) }))

		expect(summary.applied).toBe(1)
		expect(summary.completed).toBe(true)
		expect((await mem.get('facts', a.id)).document).toBe('my wording')
		expect((await mem.get('facts', b.id)).status).toBe('consolidated')
	})

	it('a rejected change is left alone, and the judge does not propose it again', async () => {
		const { mem } = setup()
		const a = await mem.create('facts', 'one')
		const b = await mem.create('facts', 'two')
		const plan = planFor([{ type: 'expire', category: 'facts', ids: [a.id, b.id] }])

		const summary = await reviewPlan(mem, plan, prompts({ change: async () => ({ decision: 'reject' }) }))
		expect(summary.rejected).toBe(1)
		expect((await mem.get('facts', a.id)).status).toBe('active')

		const calls: string[] = []
		await mem.consolidate({ judge: async (p: string) => { calls.push(p); return keepJudge(p) }, dryRun: true })
		expect(calls.length).toBe(0)
	})

	it('stopping keeps decisions so far and leaves the rest unreviewed, without advancing the epoch', async () => {
		const { mem } = setup()
		const a = await mem.create('facts', 'one')
		const b = await mem.create('facts', 'far two')
		const c = await mem.create('facts', 'far three')
		const plan = planFor([
			{ type: 'expire', category: 'facts', ids: [a.id] },
			{ type: 'expire', category: 'facts', ids: [b.id] },
			{ type: 'keep', category: 'facts', ids: [c.id] },
		])
		let asked = 0
		const summary = await reviewPlan(mem, plan, prompts({
			change: async () => ({ decision: asked++ === 0 ? 'apply' : 'stop' }),
		}))

		expect(summary.completed).toBe(false)
		expect((await mem.get('facts', a.id)).status).toBe('expired')
		expect((await mem.get('facts', b.id)).status).toBe('active')
		expect((await mem.get('facts', c.id)).reviewed_epoch).toBe(0)
		expect(mem.getEpoch()).toBe(1)
	})

	it('lets you rewrite, expire, forget, or keep the memories the judge left alone', async () => {
		const { mem } = setup()
		const rewrite = await mem.create('facts', 'rewrite me')
		const expire = await mem.create('facts', 'expire me')
		const forget = await mem.create('facts', 'forget me')
		const keep = await mem.create('facts', 'keep me')
		const answers: Record<number, any> = {
			[rewrite.id]: { decision: 'rewrite', text: 'rewritten' },
			[expire.id]: { decision: 'expire', reason: 'the meeting passed' },
			[forget.id]: { decision: 'forget', reason: 'never true' },
			[keep.id]: { decision: 'keep' },
		}

		const summary = await reviewPlan(mem, planFor([]), prompts({
			reviewMemories: async () => true,
			memory: async (row) => answers[row.id],
		}))

		expect(summary).toMatchObject({ rewritten: 1, expired: 1, forgotten: 1, completed: true })
		const old = await mem.get('facts', rewrite.id)
		expect(old.status).toBe('superseded')
		expect((await mem.get('facts', old.superseded_by)).document).toBe('rewritten')
		expect((await mem.get('facts', expire.id)).metadata.expired_reason).toBe('the meeting passed')
		const forgotten = await mem.get('facts', forget.id)
		expect(forgotten.status).toBe('retracted')
		expect(forgotten.metadata.retracted_reason).toBe('never true')
		expect((await mem.get('facts', keep.id)).reviewed_epoch).toBe(1)
		expect(mem.getEpoch()).toBe(2)
	})

	it('does not ask again about rows it already asked about', async () => {
		const { mem } = setup()
		const a = await mem.create('facts', 'one')
		const b = await mem.create('facts', 'two')
		const shown: number[] = []
		await reviewPlan(mem, planFor([{ type: 'expire', category: 'facts', ids: [a.id] }]), prompts({
			change: async () => ({ decision: 'reject' }),
			reviewMemories: async () => true,
			memory: async (row) => { shown.push(row.id); return { decision: 'keep' } },
		}))
		expect(shown).toEqual([b.id])
	})

	it('reports a stale action instead of applying it', async () => {
		const { mem } = setup()
		const a = await mem.create('facts', 'one')
		await mem.retract('facts', a.id)
		const summary = await reviewPlan(mem, planFor([{ type: 'expire', category: 'facts', ids: [a.id] }]), prompts())
		expect(summary.applied).toBe(0)
		expect(summary.stale[0]).toContain('retracted')
		expect((await mem.get('facts', a.id)).status).toBe('retracted')
	})
})

describe('memory plan API', () => {
	it('settleConsolidation records passed dates and advances the epoch', async () => {
		const { mem } = setup()
		const row = await mem.create('facts', 'one', {}, { validUntil: '2020-01-01' })
		expect(await mem.settleConsolidation()).toEqual({ epoch: 2, dormant: 0, expired: 1 })
		expect((await mem.get('facts', row.id)).status).toBe('expired')
	})

	it('namespaces lists every namespace in the file', async () => {
		const { c, mem, dbPath } = setup('alpha')
		await mem.create('facts', 'one')
		const beta = c.feature('memory', { namespace: 'beta', dbPath, embeddingProvider: 'local' }) as any
		await beta.create('facts', 'two')
		expect(await mem.namespaces()).toEqual(['alpha', 'beta'])
	})
})

describe('consolidate-memory command', () => {
	async function run(c: any, dbPath: string, extra: Record<string, any>) {
		const logs: string[] = []
		const original = console.log
		console.log = (line: any) => { logs.push(String(line)) }
		try {
			await consolidateMemory({ _: [], embeddingProvider: 'local', interactive: false, apply: false, json: true, db: dbPath, ...extra } as any, { container: c } as any)
		} finally {
			console.log = original
		}
		return logs
	}

	it('applies exactly what a saved plan says, and refuses a plan from another database', async () => {
		const { c, mem, dbPath } = setup('chief')
		const row = await mem.create('facts', 'one')
		const planPath = dbPath + '.plan.json'
		c.feature('fs').writeFile(planPath, JSON.stringify({
			dbPath, createdAt: 'now',
			plans: { chief: planFor([{ type: 'expire', category: 'facts', ids: [row.id], reason: 'passed' }]) },
		}))

		const logs = await run(c, dbPath, { plan: planPath, apply: true })
		expect(JSON.parse(logs[0]!).chief.applied).toBe(1)
		expect((await mem.get('facts', row.id)).status).toBe('expired')
		expect(mem.getEpoch()).toBe(2)

		process.exitCode = 0
		await run(c, dbPath + '.other', { plan: planPath, apply: true })
		expect(process.exitCode).toBe(1)
		process.exitCode = 0
	})

	it('changes nothing unless told to', async () => {
		const { c, mem, dbPath } = setup('chief')
		const row = await mem.create('facts', 'one')
		const planPath = dbPath + '.plan.json'
		c.feature('fs').writeFile(planPath, JSON.stringify({
			dbPath, createdAt: 'now',
			plans: { chief: planFor([{ type: 'expire', category: 'facts', ids: [row.id] }]) },
		}))
		await run(c, dbPath, { plan: planPath })
		expect((await mem.get('facts', row.id)).status).toBe('active')
		expect(mem.getEpoch()).toBe(1)
	})

	it('refuses --apply together with --interactive', async () => {
		const { c, mem, dbPath } = setup('chief')
		await mem.create('facts', 'one')
		process.exitCode = 0
		await run(c, dbPath, { apply: true, interactive: true })
		expect(process.exitCode).toBe(1)
		process.exitCode = 0
	})
})
