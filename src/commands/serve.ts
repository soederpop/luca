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
	cors: z.boolean().default(true).describe('Enable CORS'),
})

export default async function serve(options: z.infer<typeof argsSchema>, context: ContainerContext) {
	const container = context.container as any
	const { fs, paths, manifest } = container

	const port = options.port
	const staticDir = options.staticDir ? paths.resolve(options.staticDir) : paths.resolve('public')

	// Discover the endpoints directory from the project root.
	// Checks explicit flag, then common conventions, then gives up.
	const endpointsDir = resolveEndpointsDir(options, fs, paths)

	if (!endpointsDir) {
		console.error(`No endpoints directory found. Looked for: endpoints/, src/endpoints/`)
		console.error(`Create one of these directories, or pass --endpointsDir <path>`)
		process.exit(1)
	}

	const expressServer = container.server('express', {
		port,
		cors: options.cors,
		static: fs.exists(staticDir) ? staticDir : undefined,
	}) as ExpressServer

	await expressServer.useEndpoints(endpointsDir)

	expressServer.serveOpenAPISpec({
		title: manifest.name || 'API',
		version: manifest.version || '0.0.0',
		description: manifest.description || '',
	})

	await expressServer.start({ port })

	const name = manifest.name || 'Server'
	console.log(`\n${name} listening on http://localhost:${port}`)
	console.log(`OpenAPI spec at http://localhost:${port}/openapi.json`)

	if (expressServer._mountedEndpoints.length) {
		console.log(`\nEndpoints:`)
		for (const ep of expressServer._mountedEndpoints) {
			console.log(`  ${ep.methods.map((m: string) => m.toUpperCase()).join(', ').padEnd(20)} ${ep.path}`)
		}
	} else {
		console.log(`\nNo endpoints found in ${endpointsDir}`)
	}

	console.log()
}

function resolveEndpointsDir(options: any, fs: any, paths: any): string | null {
	if (options.endpointsDir) {
		const dir = paths.resolve(options.endpointsDir)
		return fs.exists(dir) ? dir : null
	}

	for (const candidate of ['endpoints', 'src/endpoints']) {
		const dir = paths.resolve(candidate)
		if (fs.exists(dir)) return dir
	}

	return null
}

commands.registerHandler('serve', {
	description: 'Start the API server with file-based endpoints',
	argsSchema,
	handler: serve,
})
