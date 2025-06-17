import container from '@/agi/container.server'
import { ui, fs } from '@/node'

export const systemPrompt = fs.readFile(
	container.paths.resolve('identities', 'bootstrapper', 'system-prompt.md')
)

export const memories = fs.readJson(
	container.paths.resolve('identities', 'bootstrapper', 'memories.json')
)

export default container
