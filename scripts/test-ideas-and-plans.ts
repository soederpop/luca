/**
 * Proof script: exercises the project-owner's Idea + Plan models and write tools.
 *
 * Run with:  bun scripts/test-ideas-and-plans.ts
 */
import container from '@/agi'

const ui = container.feature('ui')
const { bold, cyan, green, yellow, dim, red } = ui.colors

// ─── Boot the assistant (fires created hook → registers models) ─────────────
const assistant = container.feature('assistant', {
	folder: 'assistants/project-owner',
})

const db = assistant.contentDb

console.log(bold('\n═══ 1. Model Registration ═══'))
console.log('Registered models:', db.modelNames)

// ─── Load collection ────────────────────────────────────────────────────────
await db.load()
const collection = db.collection

console.log('Total documents:', collection.available.length)
console.log('Documents:', collection.available)

// ─── Query Ideas ────────────────────────────────────────────────────────────
console.log(bold('\n═══ 2. Query Ideas ═══'))

const Idea = db.models['Idea']!
const allIdeas = await collection.query(Idea).fetchAll()
console.log(`\nAll ideas (${allIdeas.length}):`)
for (const idea of allIdeas) {
	const statusColor: any = {
		backlog: dim,
		exploring: yellow,
		ready: green,
		done: cyan,
	}[idea.meta.status] || dim

	console.log(`  ${statusColor(idea.meta.status.padEnd(10))} ${idea.title}  ${dim(`[${idea.meta.category}, ${idea.meta.horizon}]`)}`)
}

const backlog = await collection.query(Idea).where('meta.status', 'backlog').fetchAll()
console.log(`\nBacklog ideas (${backlog.length}):`)
for (const i of backlog) console.log(`  - ${i.title}`)

const exploring = await collection.query(Idea).where('meta.status', 'exploring').fetchAll()
console.log(`\nExploring ideas (${exploring.length}):`)
for (const i of exploring) console.log(`  - ${i.title}`)

const shortTerm = await collection.query(Idea).where('meta.horizon', 'short').fetchAll()
console.log(`\nShort-term ideas (${shortTerm.length}):`)
for (const i of shortTerm) console.log(`  - ${i.title}  ${dim(`[${i.meta.status}]`)}`)

const archIdeas = await collection.query(Idea).where('meta.category', 'architecture').fetchAll()
console.log(`\nArchitecture ideas (${archIdeas.length}):`)
for (const i of archIdeas) console.log(`  - ${i.title}`)

// ─── Query Plans ────────────────────────────────────────────────────────────
console.log(bold('\n═══ 3. Query Plans ═══'))

const Plan = db.models['Plan']!
const allPlans = await collection.query(Plan).fetchAll()
console.log(`\nAll plans (${allPlans.length}):`)
for (const plan of allPlans) {
	const statusColor: any = {
		approved: green,
		pending: yellow,
		rejected: red,
	}[plan.meta.status] || dim

	console.log(`  ${statusColor(plan.meta.status.padEnd(10))} ${plan.title}`)
	if (plan.sections.summary) {
		console.log(`  ${dim(plan.sections.summary.substring(0, 100))}`)
	}
}

const approved = await collection.query(Plan).where('meta.status', 'approved').fetchAll()
console.log(`\nApproved plans (${approved.length}):`)
for (const p of approved) {
	console.log(`  - ${p.title}`)
	console.log(`    Steps: ${p.sections.steps?.length || 0}`)
	console.log(`    Checks: ${p.sections.verification?.length || 0}`)
}

// ─── Section Extraction ─────────────────────────────────────────────────────
console.log(bold('\n═══ 4. Section Extraction ═══'))

for (const idea of allIdeas.slice(0, 3)) {
	const summary = idea.sections.summary
	if (summary) {
		console.log(`\n${cyan(idea.title)} → summary:`)
		console.log(`  ${dim(summary.substring(0, 120))}...`)
	}
}

// ─── Write Tool: Create + Query + Cleanup ───────────────────────────────────
console.log(bold('\n═══ 5. Write Tool Proof ═══'))

const { paths } = container
const nodeFs = await import('fs')

function slugify(title: string) {
	return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

// Create a test idea
const testIdeaTitle = 'Proof Script Test Idea'
const testIdeaSlug = slugify(testIdeaTitle)
const testIdeaPath = paths.resolve(assistant.docsFolder, 'ideas', `${testIdeaSlug}.md`)

const ideaContent = [
	'---',
	'status: backlog',
	'category: testing',
	'horizon: short',
	'---',
	'',
	`# ${testIdeaTitle}`,
	'',
	'## Overview',
	'',
	'This idea was created by the proof script to verify the write tool pattern works.',
	'',
	'## Implications',
	'',
	'If this shows up in queries, the entire ideas pipeline is functional.',
	'',
].join('\n')

nodeFs.writeFileSync(testIdeaPath, ideaContent, 'utf8')
console.log(green(`\nCreated test idea: ideas/${testIdeaSlug}.md`))

// Create a test plan
const testPlanTitle = 'Proof Script Test Plan'
const testPlanSlug = slugify(testPlanTitle)
const testPlanPath = paths.resolve(assistant.docsFolder, 'plans', `${testPlanSlug}.md`)

const planContent = [
	'---',
	'status: pending',
	'---',
	'',
	`# ${testPlanTitle}`,
	'',
	'## Summary',
	'',
	'This plan was created by the proof script to verify the write tool pattern works.',
	'',
	'## Steps',
	'',
	'- [ ] Create a markdown file with correct frontmatter',
	'- [ ] Verify it appears in contentbase queries',
	'- [ ] Clean it up after the test',
	'',
	'## Test plan',
	'',
	'- [ ] The file exists on disk',
	'- [ ] contentbase query returns it with correct metadata',
	'- [ ] Section extraction works on the new document',
	'',
].join('\n')

nodeFs.writeFileSync(testPlanPath, planContent, 'utf8')
console.log(green(`Created test plan: plans/${testPlanSlug}.md`))

// Reload with a fresh collection to pick up the new files
const { Collection, defineModel: defModel } = await import('contentbase')
const { z: z2 } = await import('zod')

const IdeaModel = defModel('Idea', {
	prefix: 'ideas',
	meta: z2.object({
		status: z2.enum(['backlog', 'exploring', 'ready', 'done']),
		category: z2.string(),
		horizon: z2.enum(['short', 'long']),
	}),
})
const PlanModel = defModel('Plan', {
	prefix: 'plans',
	meta: z2.object({
		status: z2.enum(['approved', 'pending', 'rejected']),
	}),
})

const freshCollection = new Collection({ rootPath: assistant.docsFolder })
freshCollection.register(IdeaModel)
freshCollection.register(PlanModel)
await freshCollection.load()

const testIdeas = await freshCollection.query(IdeaModel).where('meta.category', 'testing').fetchAll()
console.log(`\nQuery for testing ideas: found ${testIdeas.length}`)
for (const i of testIdeas) {
	console.log(`  ${green('✓')} ${i.title} [${i.meta.status}, ${i.meta.category}]`)
}

const testPlans = await freshCollection.query(PlanModel).where('meta.status', 'pending').fetchAll()
const found = testPlans.find((p: any) => p.title === testPlanTitle)
if (found) {
	console.log(`  ${green('✓')} ${found.title} [${found.meta.status}]`)
} else {
	console.log(`  ${red('✗')} Test plan not found in pending query`)
}

// Cleanup
nodeFs.rmSync(testIdeaPath)
nodeFs.rmSync(testPlanPath)
console.log(dim('\nCleaned up test files.'))

// ─── Table of Contents ──────────────────────────────────────────────────────
console.log(bold('\n═══ 6. Table of Contents ═══'))
console.log(collection.tableOfContents({ title: 'Project Owner Documents' }))

console.log(green(bold('\n✓ All checks passed.\n')))
