import { z } from 'zod'
import type { EndpointContext } from '../../../endpoint.js'

export const path = '/api/conversations/:id'
export const description = 'Get or delete a specific conversation'
export const tags = ['conversations']

export const getSchema = z.object({
  id: z.string().describe('Conversation ID'),
})

export async function get(parameters: z.infer<typeof getSchema>, ctx: EndpointContext) {
  const container = ctx.container as any
  const history = container.feature('conversationHistory')

  const record = await history.load(parameters.id)

  if (!record) {
    ctx.response.status(404)
    return { error: 'Conversation not found' }
  }

  return { conversation: record }
}

export const deleteSchema = z.object({
  id: z.string().describe('Conversation ID'),
})

export async function del(parameters: z.infer<typeof deleteSchema>, ctx: EndpointContext) {
  const container = ctx.container as any
  const history = container.feature('conversationHistory')

  const deleted = await history.delete(parameters.id)

  if (!deleted) {
    ctx.response.status(404)
    return { error: 'Conversation not found' }
  }

  return { deleted: true }
}

// endpoint system uses 'delete' as the key
export { del as delete }
