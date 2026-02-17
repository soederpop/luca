import { section, toString } from 'contentbase'
import { z } from 'zod'
import type { Assistant } from '@/agi/features/assistant'

declare global {
	var me: Assistant;
}

export function created() {
	me.contentDb.defineModel(({ defineModel }) => {
		return defineModel('Plan', {
			prefix: 'plans',
			meta: z.object({
				status: z.enum(['approved', 'pending', 'rejected']),
			}),
			sections: {
				summary: section('Summary', {
					extract: (query) => query.selectAll('paragraph').map((n: any) => toString(n)).join('\n'),
					schema: z.string(),
				}),
				steps: section('Steps', {
					extract: (query) => query.selectAll('listItem').map((n: any) => toString(n)),
					schema: z.array(z.string()),
				}),
				references: section('References', {
					extract: (query) => query.selectAll('listItem').map((n: any) => toString(n)),
					schema: z.array(z.string()),
					alternatives: ['Reference Sources', 'Resources'],
				}),
				verification: section('Test plan', {
					extract: (query) => query.selectAll('listItem').map((n: any) => toString(n)),
					schema: z.array(z.string()),
					alternatives: ['Validation'],
				}),
			}
		})
	})
}