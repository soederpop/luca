import { z } from 'zod'

declare const container: any

export const use = [
	container.feature('vm'),
	container.feature('skillsLibrary'),
]


export const schemas = {
	searchDocs: z.object({
		query: z.string().describe('Natural-language or keyword query, e.g. "how do I retry with backoff?" or "watch files for changes"'),
		limit: z.number().optional().describe('Maximum results (default 8)'),
	}).describe('Semantic search over every luca helper, example, and tutorial — the same engine as `luca describe --query`, run in-process. Each result carries a `describe` ref: follow up with evalCode `(await container.describer.describeHelper(ref)).text` for the full docs. Use this FIRST when you don\'t know which helper solves a problem.'),

	README: z.object({}).describe("Call this function immediately to learn about the global `container` object that you have available to you when you eval code.  It will describe all of the Luca framework helper components available to you to use to build whatever solution you can think of."),
}

export async function searchDocs(options: z.infer<typeof schemas.searchDocs>) {
	return await container.describer.query(options.query, { limit: options.limit })
}

export async function README(options: z.infer<typeof schemas.README>) {
	const docs = container.introspectAsText()
	return docs
}
