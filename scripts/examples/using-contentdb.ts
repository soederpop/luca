import container from '@/agi'
import { ContentDb } from '@/node/features/content-db'
import { defineModel, section } from 'contentbase'
import { toString } from 'mdast-util-to-string'
import { z } from 'zod'

container.features.register('contentDb', ContentDb as any)

async function main() {
	const contentDb = container.feature('contentDb', {
		rootPath: container.paths.resolve('docs')
	})

	// Models are now defined in the collection's models.ts file.
	// You can also register them directly on the collection:
	const Idea = defineModel('Idea', {
		meta: z.object({
			stage: z.string(),
			term: z.enum(['short', 'medium', 'long']).default('long'),
		}),
		sections: {
			motivation: section('Motivation', {
				extract: (query: any) => query.selectAll('*').map((n: any) => toString(n))
			})
		}
	})

	contentDb.collection.register(Idea)

	await contentDb.load()

	console.log(contentDb.modelNames)
}

main()
