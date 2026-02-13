import { z } from 'zod'
import type { EndpointContext } from '../../../endpoint.js'

export const path = '/api/experts/:expert'
export const description = 'Get detailed info about an expert including system prompt and available skills'
export const tags = ['experts']

export const getSchema = z.object({
  expert: z.string().describe('The expert name (folder name)'),
})

export async function get(parameters: z.infer<typeof getSchema>, ctx: EndpointContext) {
  const container = ctx.container as any
  const { expert: expertName } = parameters

  const expertsDir = container.paths.resolve('experts')
  const folder = container.paths.resolve(expertsDir, expertName)
  const fs = container.feature('fs')

  if (!fs.exists(folder)) {
    ctx.response.status(404)
    return { error: `Expert "${expertName}" not found` }
  }

  const promptPath = container.paths.resolve(folder, 'SYSTEM-PROMPT.md')
  const prompt = fs.exists(promptPath)
    ? (await fs.readFileAsync(promptPath)).toString()
    : ''

  // load skills metadata by spinning up a temporary expert
  let skills: Record<string, any> = {}

  try {
    const expertInstance = container.feature('expert', { name: expertName, folder: expertName })
    await expertInstance.loadSkills()

    for (const [name, schema] of Object.entries(expertInstance.skillSchemas as Record<string, any>)) {
      const jsonSchema = schema.toJSONSchema()
      skills[name] = {
        name,
        description: jsonSchema.description || name,
        parameters: jsonSchema.properties || {},
        required: jsonSchema.required || [],
      }
    }
  } catch {
    // skills loading failed, return empty
  }

  return {
    name: expertName,
    prompt,
    skills,
    askUrl: `/api/experts/${expertName}/ask`,
  }
}
