import { z } from 'zod'
import type { EndpointContext } from '../../../../endpoint.js'

export const path = '/api/experts/:expert/ask'
export const description = 'Ask an expert a question, optionally resuming a saved conversation'
export const tags = ['experts']

export const postSchema = z.object({
  expert: z.string().describe('The expert name (folder name)'),
  question: z.string().describe('The question to ask the expert'),
  conversationId: z.string().optional().describe('Resume an existing conversation by ID'),
  stream: z.boolean().optional().default(false).describe('Whether to stream the response via SSE'),
})

export async function post(parameters: z.infer<typeof postSchema>, ctx: EndpointContext) {
  const container = ctx.container as any
  const { expert: expertName, question, conversationId, stream } = parameters

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

  // if resuming, load the saved messages into the conversation
  if (conversationId) {
    const history = container.feature('conversationHistory')
    const saved = await history.load(conversationId)

    if (saved && expert.conversation) {
      expert.conversation.state.set('id', saved.id)
      expert.conversation.state.set('messages', saved.messages)
    }
  }

  const convoId = conversationId || expert.conversation?.state.get('id') || container.utils.uuid()

  // set the id so save() uses it
  if (expert.conversation) {
    expert.conversation.state.set('id', convoId)
  }

  if (stream) {
    ctx.response.setHeader('Content-Type', 'text/event-stream')
    ctx.response.setHeader('Cache-Control', 'no-cache')
    ctx.response.setHeader('Connection', 'keep-alive')

    // send conversation ID immediately so the client knows it
    ctx.response.write(`data: ${JSON.stringify({ conversationId: convoId })}\n\n`)

    expert.on('preview', (chunk: string) => {
      ctx.response.write(`data: ${JSON.stringify({ chunk })}\n\n`)
    })

    const answer = await expert.ask(question)

    // auto-save after response
    if (expert.conversation) {
      await expert.conversation.save({
        title: question.slice(0, 100),
        tags: [expertName],
        metadata: { expert: expertName },
      })
    }

    ctx.response.write(`data: ${JSON.stringify({ done: true, answer, conversationId: convoId })}\n\n`)
    ctx.response.end()
    return
  }

  const answer = await expert.ask(question)

  // auto-save after response
  if (expert.conversation) {
    await expert.conversation.save({
      title: question.slice(0, 100),
      tags: [expertName],
      metadata: { expert: expertName },
    })
  }

  return {
    expert: expertName,
    question,
    answer,
    conversationId: convoId,
  }
}
