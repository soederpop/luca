import { Collection, defineModel, z, section, toString } from 'contentbase'

export const Idea = defineModel('Idea', {
	meta: z.object({
		stage: z.string(),
		term: z.enum(['short', 'medium', 'long']).default('long'),
	}),
	sections: {
		motivation: section('Motivation', {
			extract: (query) => query.selectAll('*').map(n => toString(n))
		})
	}
})

export default async function create(rootPath: string): Collection<Idea> {
	const collection = new Collection({ rootPath })
	await collection.load()
	return collection
}