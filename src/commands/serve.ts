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
	setup: z.string().optional().describe('Path to a TS module whose default export receives the server instance'),
	cors: z.boolean().default(true).describe('Enable CORS'),
	force: z.boolean().default(false).describe('Kill any process currently using the target port'),
	anyPort: z.boolean().default(false).describe('Find an available port starting above 3000'),
	open: z.boolean().default(true).describe('Open the server URL in Google Chrome'),
})

export default async function serve(options: z.infer<typeof argsSchema>, context: ContainerContext) {
	const container = context.container as any
	const { fs, paths, manifest, networking, proc } = container

	let port = options.port
	const staticDir = options.staticDir ? paths.resolve(options.staticDir) : paths.resolve('public')

	if (options.anyPort) {
		port = await networking.findOpenPort(3001)
	}

	const isPortAvailable = await networking.isPortOpen(port)
	if (!isPortAvailable) {
		if (!options.force) {
			console.error(`Port ${port} is already in use.`)
			console.error(`Use --force to kill the process on this port, or --any-port to find another port.`)
			process.exit(1)
		}

		const pids = proc.findPidsByPort(port)
		if (!pids.length) {
			console.error(`Port ${port} is in use, but no PID could be discovered for termination.`)
			process.exit(1)
		}

		for (const pid of pids) {
			proc.kill(pid)
		}

		let portFreed = false
		for (let i = 0; i < 10; i++) {
			if (await networking.isPortOpen(port)) {
				portFreed = true
				break
			}
			await new Promise((resolve) => setTimeout(resolve, 100))
		}

		if (!portFreed) {
			console.error(`Failed to free port ${port} after terminating process(es): ${pids.join(', ')}`)
			process.exit(1)
		}
	}

	// Discover the endpoints directory from the project root.
	// Checks explicit flag, then common conventions, then skips if absent.
	const endpointsDir = resolveEndpointsDir(options, fs, paths)

	// Resolve static directory: explicit flag > public/ > cwd (if index.html exists)
	let resolvedStaticDir: string | undefined
	if (fs.exists(staticDir)) {
		resolvedStaticDir = staticDir
	} else if (fs.exists(paths.resolve('index.html'))) {
		resolvedStaticDir = paths.resolve('.')
	}

	// If there's nothing to serve at all, bail out.
	if (!endpointsDir && !resolvedStaticDir) {
		console.error(`Can't figure out what to serve in this folder.`)
		console.error(`Expected one of: endpoints/, src/endpoints/, public/, or an index.html in the current directory.`)
		process.exit(1)
	}

	const expressServer = container.server('express', {
		port,
		cors: options.cors,
		static: resolvedStaticDir,
		historyFallback: resolvedStaticDir && !options.staticDir,
	}) as ExpressServer

	if (endpointsDir) {
		await expressServer.useEndpoints(endpointsDir)

		expressServer.serveOpenAPISpec({
			title: manifest.name || 'API',
			version: manifest.version || '0.0.0',
			description: manifest.description || '',
		})
	}

	if (options.setup) {
		const setupPath = paths.resolve(options.setup)
		if (!fs.exists(setupPath)) {
			console.error(`Setup module not found: ${setupPath}`)
			process.exit(1)
		}
		const vmFeature = container.feature('vm')
		const mod = vmFeature.loadModule(setupPath, { server: expressServer })
		const setupFn = mod.default || mod
		if (typeof setupFn === 'function') {
			await setupFn(expressServer)
		}
	}

	try {
		await expressServer.start({ port })
	} catch (error: any) {
		if (error?.code === 'EADDRINUSE') {
			console.error(`Port ${port} is already in use.`)
			console.error(`Use --force to kill the process on this port, or --any-port to find another port.`)
			process.exit(1)
		}
		throw error
	}

	const name = manifest.name || 'Server'
	console.log(`\n${name} listening on http://localhost:${port}`)

	if (endpointsDir) {
		console.log(`OpenAPI spec at http://localhost:${port}/openapi.json`)
	}

	if (options.open) {
		try {
			const opener = container.feature('opener')
			await opener.open(`http://localhost:${port}`)
		} catch (error) {
			console.warn(`Could not open browser automatically: ${(error as Error).message}`)
		}
	}

	if (resolvedStaticDir) {
		console.log(`\nStatic files from ${resolvedStaticDir}`)
	}

	if (endpointsDir) {
		if (expressServer._mountedEndpoints.length) {
			console.log(`\nEndpoints:`)
			for (const ep of expressServer._mountedEndpoints) {
				console.log(`  ${ep.methods.map((m: string) => m.toUpperCase()).join(', ').padEnd(20)} ${ep.path}`)
			}
		} else {
			console.log(`\nNo endpoints found in ${endpointsDir}`)
		}
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
