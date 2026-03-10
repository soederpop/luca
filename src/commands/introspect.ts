import { z } from 'zod'
import { commands } from '../command.js'
import { CommandOptionsSchema } from '../schemas/base.js'
import type { ContainerContext } from '../container.js'
import '../introspection/scan.js'

declare module '../command.js' {
	interface AvailableCommands {
		introspect: ReturnType<typeof commands.registerHandler>
	}
}

export const argsSchema = CommandOptionsSchema.extend({
	src: z.array(z.string()).optional().describe('Source directories to scan (default: auto-discover features/, clients/, servers/)'),
	output: z.string().optional().describe('Output file path (default: features/introspection.generated.ts)'),
	'dry-run': z.boolean().default(false).describe('Preview without writing'),
	'include-private': z.boolean().default(false).describe('Include private methods in output'),
})

async function introspect(options: z.infer<typeof argsSchema>, context: ContainerContext) {
	const container = context.container as any
	const { fs, paths } = container

	// Detect if we're inside the luca library itself
	const cwd = paths.cwd
	const isLucaLibrary = fs.exists(paths.resolve('src/introspection/scan.ts'))

	if (isLucaLibrary) {
		// Inside luca itself — delegate to the multi-target update-introspection behavior
		const { NodeContainer } = await import('../node/container.js')
		const lucaContainer = new NodeContainer()

		const targets = [
			{
				name: 'node',
				src: ['src/node/features', 'src/servers', 'src/container.ts', 'src/node/container.ts'],
				outputPath: 'src/introspection/generated.node.ts',
			},
			{
				name: 'web',
				src: ['src/web/features', 'src/container.ts', 'src/web/container.ts'],
				outputPath: 'src/introspection/generated.web.ts',
			},
			{
				name: 'agi',
				src: ['src/node/features', 'src/servers', 'src/agi/features', 'src/container.ts', 'src/node/container.ts', 'src/agi/container.server.ts'],
				outputPath: 'src/introspection/generated.agi.ts',
			},
		]

		for (const target of targets) {
			console.log(`\nGenerating ${target.name} introspection data...`)
			console.log(`  Sources: ${target.src.join(', ')}`)
			console.log(`  Output: ${target.outputPath}`)

			const scanner = lucaContainer.feature('introspectionScanner', {
				src: target.src,
				outputPath: options['dry-run'] ? undefined : target.outputPath,
				includePrivate: options['include-private'],
			})

			scanner.on('scanCompleted', (data: any) => {
				console.log(`  Found ${data.results} helpers in ${data.files} files (${data.duration}ms)`)
			})

			await scanner.scan()
			const script = await scanner.generateRegistryScript()

			if (options['dry-run']) {
				console.log(`\n--- ${target.outputPath} (dry run) ---`)
				console.log(script.slice(0, 500) + (script.length > 500 ? '\n...' : ''))
			} else {
				console.log(`  Wrote ${target.outputPath}`)
			}
		}

		console.log('\nAll introspection data generated.')
		return
	}

	// Project-local mode: auto-discover source directories
	const defaultSrc = ['features', 'clients', 'servers']
		.filter(dir => fs.exists(paths.resolve(dir)))

	// Also scan container.ts if it exists at project root
	const containerFile = paths.resolve('container.ts')
	if (fs.exists(containerFile)) defaultSrc.push('container.ts')

	const src = options.src || defaultSrc

	if (src.length === 0) {
		console.log('No source directories found to scan. Use --src to specify directories.')
		return
	}

	const outputPath = options.output || 'features/introspection.generated.ts'
	const importSource = '@soederpop/luca/introspection'

	console.log(`Scanning: ${src.join(', ')}`)
	console.log(`Output: ${outputPath}`)

	const scanner = container.feature('introspectionScanner', {
		src,
		outputPath: options['dry-run'] ? undefined : outputPath,
		includePrivate: options['include-private'],
		importSource,
	})

	scanner.on('scanCompleted', (data: any) => {
		console.log(`Found ${data.results} helpers in ${data.files} files (${data.duration}ms)`)
	})

	await scanner.scan()
	const script = await scanner.generateRegistryScript()

	if (options['dry-run']) {
		console.log(`\n--- ${outputPath} (dry run) ---`)
		console.log(script)
	} else {
		console.log(`Wrote ${outputPath}`)
	}
}

commands.registerHandler('introspect', {
	description: 'Generate introspection metadata from source. Works in any luca project.',
	argsSchema,
	handler: introspect,
})
