import { z } from 'zod'
import type { EndpointContext } from '../../../../endpoint.js'

export const path = '/api/experts/:expert/ask'
export const description = 'Start a new conversation with an expert and ask a question'
export const tags = ['experts']

export const postSchema = z.object({
  expert: z.string().describe('The expert name (folder name)'),
  question: z.string().describe('The question to ask the expert'),
  stream: z.boolean().optional().default(false).describe('Whether to stream the response via SSE'),
})

export async function post(parameters: z.infer<typeof postSchema>, ctx: EndpointContext) {
  const container = ctx.container as any
  const { expert: expertName, question, stream } = parameters

  const expertsDir = container.paths.resolve('experts')
  const folder = container.paths.resolve(expertsDir, expertName)
  const fs = container.feature('fs')

  if (!fs.exists(folder)) {
    ctx.response.status(404)
    return { error: `Expert "${expertName}" not found` }
  }

  const expert = container.feature('expert', { name: expertName, folder: expertName })

  if (!expert.isStarted) {
    await expert.start()
  }

  if (stream) {
    ctx.response.setHeader('Content-Type', 'text/event-stream')
    ctx.response.setHeader('Cache-Control', 'no-cache')
    ctx.response.setHeader('Connection', 'keep-alive')

    expert.on('preview', (chunk: string) => {
      ctx.response.write(`data: ${JSON.stringify({ chunk })}\n\n`)
    })

    const answer = await expert.ask(question)
    ctx.response.write(`data: ${JSON.stringify({ done: true, answer })}\n\n`)
    ctx.response.end()
    return
  }

  const answer = await expert.ask(question)

  return {
    expert: expertName,
    question,
    answer,
  }
}
