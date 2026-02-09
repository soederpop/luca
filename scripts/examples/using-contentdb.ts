import container from '@/agi'
import { ContentDb } from '@/node/features/content-db'

container.features.register('contentDb', ContentDb)

async function main() {
	const contentDb = container.feature('contentDb', {
		rootPath: container.paths.resolve('docs')
	})

	const { z } = container

	const Idea =contentDb.defineModel(({ defineModel, section, toString }: any) => {
		return defineModel('Idea', {
			meta: z.object({
				stage: z.string(),
				term: z.enum(['short', 'medium', 'long']).default('long'),
			}),
			sections: {
				motivation: section('Motivation', {
					extract: (query: any) => query.selectAll('*').map(n => toString(n))
				})
			}
		})		
	})

	await contentDb.load()

	console.log(contentDb.modelNames)
}

main()