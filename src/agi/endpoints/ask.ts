import { z } from 'zod'
import type { EndpointContext } from '../../endpoint.js'

export const path = '/ask'
export const description = 'Ask the AGI container a question'
export const tags = ['agi']

export const postSchema = z.object({
  question: z.string().describe('The question to ask'),
  context: z.string().optional().describe('Additional context for the question'),
  stream: z.boolean().optional().default(false).describe('Whether to stream the response'),
})

export async function post(
  parameters: z.infer<typeof postSchema>,
  ctx: EndpointContext
) {
  const { container } = ctx
  const { question, context: userContext, stream } = parameters

  const history: any[] = []
  if (userContext) {
    history.push({ role: 'system', content: userContext })
  }

  const conversation = container.feature('conversation' as any, {
    history,
  }) as any

  if (stream) {
    ctx.response.setHeader('Content-Type', 'text/event-stream')
    ctx.response.setHeader('Cache-Control', 'no-cache')
    ctx.response.setHeader('Connection', 'keep-alive')

    conversation.on('chunk', (chunk: string) => {
      ctx.response.write(`data: ${JSON.stringify({ chunk })}\n\n`)
    })

    const answer = await conversation.ask(question)
    ctx.response.write(`data: ${JSON.stringify({ done: true, answer })}\n\n`)
    ctx.response.end()
    return
  }

  const answer = await conversation.ask(question)
  return { answer }
}

export const getSchema = z.object({
  question: z.string().describe('The question to ask'),
})

export async function get(
  parameters: z.infer<typeof getSchema>,
  ctx: EndpointContext
) {
  const conversation = ctx.container.feature('conversation' as any) as any
  const answer = await conversation.ask(parameters.question)
  return { answer }
}
