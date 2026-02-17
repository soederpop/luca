import container from '@/agi'

const assistant = container.feature('assistant', {
	folder: 'assistants/project-owner',
})

// The created hook should have fired synchronously, registering the Plan model
const db = assistant.contentDb

console.log('--- Model Registration ---')
console.log('Registered models:', db.modelNames)

// Load the collection so we can query documents
await db.load()

const available = db.collection.available
console.log('\n--- Available Documents ---')
console.log(available)

// Try to get plan instances
const plans = db.collection.available
	.filter((id: string) => id.startsWith('plans/'))
	.map((id: string) => {
		const Plan = db.models['Plan']
		if (!Plan) {
			console.log('Plan model not found in registry!')
			return null
		}
		return db.collection.getModel(id, Plan)
	})
	.filter(Boolean)

console.log('\n--- Plans Found ---')
console.log(`Found ${plans.length} plan(s)`)

for (const plan of plans) {
	console.log('\n=========================')
	console.log('Title:', plan.title)
	console.log('ID:', plan.id)
	console.log('Meta:', plan.meta)
	console.log('Summary:', plan.sections.summary)
	console.log('Steps:', plan.sections.steps)
	console.log('References:', plan.sections.references)
}
