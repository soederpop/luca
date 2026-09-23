
import { z } from 'zod'
const server = container.server('mcp', { transport: 'stdio', serverName: 'test' })
server.tool('greet', { schema: z.object({ name: z.string() }), description: 'greet', handler: async ({ name }) => 'Hello, ' + name + '!' })
server.resource('project://readme', () => 'This is the readme content.')
server.prompt('summarize', { args: { text: z.string() }, handler: async ({text}) => [{ role: 'user', content: { type: 'text', text: 'Summarize: '+text } }] })
await server.start()
