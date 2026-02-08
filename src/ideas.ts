import { defineModel, z, section, toString } from 'contentbase'

export const IdeaModel = defineModel('Idea', {
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