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

	me.contentDb.defineModel(({ defineModel }) => {
		return defineModel('Idea', {
			prefix: 'ideas',
			meta: z.object({
				status: z.enum(['backlog', 'exploring', 'ready', 'done']),
				category: z.string().describe('Topic area: architecture, infrastructure, research, assistants, demos, etc.'),
				horizon: z.enum(['short', 'long']).describe('Short-term or long-term horizon'),
			}),
			sections: {
				summary: section('Overview', {
					extract: (query) => query.selectAll('paragraph').map((n: any) => toString(n)).join('\n'),
					schema: z.string(),
					alternatives: ['Summary', 'What', 'Why'],
				}),
				implications: section('Implications', {
					extract: (query) => query.selectAll('paragraph').map((n: any) => toString(n)).join('\n'),
					schema: z.string(),
					alternatives: ['Implications for Our Work', 'What This Validates in Luca', 'What We Should Build'],
				}),
			}
		})
	})
}