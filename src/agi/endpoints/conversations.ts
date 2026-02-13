import { z } from 'zod'
import type { EndpointContext } from '../../endpoint.js'

export const path = '/api/conversations'
export const description = 'List and search saved conversations'
export const tags = ['conversations']

export const getSchema = z.object({
  tag: z.string().optional().describe('Filter by tag'),
  thread: z.string().optional().describe('Filter by thread'),
  model: z.string().optional().describe('Filter by model'),
  query: z.string().optional().describe('Text search across titles, tags, metadata'),
  expert: z.string().optional().describe('Filter by expert name (stored in metadata)'),
  limit: z.coerce.number().optional().describe('Max results'),
  offset: z.coerce.number().optional().describe('Skip N results'),
})

export async function get(parameters: z.infer<typeof getSchema>, ctx: EndpointContext) {
  const container = ctx.container as any
  const history = container.feature('conversationHistory')

  const { expert, ...searchOpts } = parameters

  let results = await history.list(searchOpts)

  if (expert) {
    results = results.filter((m: any) => m.metadata?.expert === expert)
  }

  return { conversations: results }
}
