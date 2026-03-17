import { z } from 'zod'
import type { EndpointContext } from '../../endpoint.js'

export const path = '/api/experts'
export const description = 'List all available experts with their descriptions'
export const tags = ['experts']

export async function get(_parameters: any, ctx: EndpointContext) {
  const container = ctx.container as any
  const fs = container.feature('fs')
  const fileManager = container.feature('fileManager')

  if (!fileManager.isStarted) {
    await fileManager.start()
  }

  const promptFiles = fileManager.match('experts/*/SYSTEM-PROMPT.md')
  const experts: any[] = []

  for (const relativePath of promptFiles) {
    const name = relativePath.split('/')[1]
    const prompt = await fs.readFileAsync(container.paths.resolve(relativePath))
    const lines = prompt.split('\n').filter((l: string) => l.trim())
    const title = lines[0]?.replace(/^#+\s*/, '') || name
    const description = lines[1] || ''

    experts.push({
      name,
      title,
      description,
      url: `/api/experts/${name}`,
      askUrl: `/api/experts/${name}/ask`,
    })
  }

  return { experts }
}
