import { z } from 'zod'
import { commands } from '../command.js'
import { CommandOptionsSchema } from '../schemas/base.js'
import type { ContainerContext } from '../container.js'
import type { ExpressServer } from '../servers/express.js'

declare module '../command.js' {
	interface AvailableCommands {
		serve: ReturnType<typeof commands.registerHandler>
	}
}

export const argsSchema = CommandOptionsSchema.extend({
	port: z.number().default(3000).describe('Port to listen on'),
	endpointsDir: z.string().optional().describe('Directory to load endpoints from'),
	staticDir: z.string().optional().describe('Directory to serve static files from'),
})

export default async function serve(options: z.infer<typeof argsSchema>, context: ContainerContext) {
	const container = context.container as any
	const port = options.port
	const endpointsDir = options.endpointsDir || container.paths.resolve('src/agi/endpoints')
	const staticDir = options.staticDir || container.paths.resolve('public')

	const expressServer = container.server('express', {
		port,
		cors: true,
		static: staticDir,
	}) as ExpressServer

	await expressServer.useEndpoints(endpointsDir)
	expressServer.serveOpenAPISpec({
		title: 'Luca AGI API',
		version: '1.0.0',
		description: 'AGI container endpoints',
	})
	await expressServer.start({ port })

	console.log(`\nLuca API server listening on http://localhost:${port}`)
	console.log(`OpenAPI spec at http://localhost:${port}/openapi.json`)
	console.log(`\nMounted endpoints:`)
	for (const ep of expressServer._mountedEndpoints) {
		console.log(`  ${ep.methods.map((m: string) => m.toUpperCase()).join(', ').padEnd(20)} ${ep.path}`)
	}
	console.log()
}

commands.registerHandler('serve', {
	description: 'Start the API server with file-based endpoints',
	argsSchema,
	handler: serve,
})
