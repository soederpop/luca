import container from '@/agi'
// @ts-ignore - module not yet implemented
import createCollection, { Idea } from '@/ideas'

async function main() {
	const collection = await createCollection(container.paths.resolve('docs'))
 	const ideas =	await collection.query(Idea).fetchAll()
	
	console.log(ideas.map((i: any) => i.sections.motivation))
}

main()