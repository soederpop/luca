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
	lint: z.boolean().default(false).describe('Warn about undocumented getters, methods, options, and class descriptions'),
})

function lintResults(results: any[]) {
	type LintWarning = { helper: string; category: string; member: string; message: string }
	const warnings: LintWarning[] = []

	for (const result of results) {
		const helper = result.className || result.id

		// Class-level description
		if (!result.description || result.description === `${result.className} helper`) {
			warnings.push({ helper, category: 'class', member: '', message: 'Missing class description (add a JSDoc block above the class)' })
		}

		// Methods
		for (const [name, method] of Object.entries(result.methods || {}) as [string, any][]) {
			if (!method.description) {
				warnings.push({ helper, category: 'method', member: name, message: 'Missing JSDoc description' })
			}
			// Check for undocumented parameters (generic fallback description)
			for (const [paramName, param] of Object.entries(method.parameters || {}) as [string, any][]) {
				if (param.description === `Parameter ${paramName}`) {
					warnings.push({ helper, category: 'method', member: `${name}(@param ${paramName})`, message: 'Missing @param description' })
				}
			}
			if (method.returns === 'void' || method.returns === 'any') {
				// not necessarily a problem, skip
			}
		}

		// Getters
		for (const [name, getter] of Object.entries(result.getters || {}) as [string, any][]) {
			if (!getter.description) {
				warnings.push({ helper, category: 'getter', member: name, message: 'Missing JSDoc description' })
			}
		}

		// Options (populated at runtime from Zod, but build-time scan may have empty options)
		// We check if options exist and have empty descriptions
		for (const [name, opt] of Object.entries(result.options || {}) as [string, any][]) {
			if (!opt.description) {
				warnings.push({ helper, category: 'option', member: name, message: 'Missing description (add .describe() to the Zod schema field)' })
			}
		}
	}

	return warnings
}

function printLintReport(warnings: ReturnType<typeof lintResults>, label?: string) {
	if (warnings.length === 0) {
		console.log(label ? `  ${label}: No lint warnings.` : 'No lint warnings.')
		return 0
	}

	// Group by helper
	const byHelper = new Map<string, typeof warnings>()
	for (const w of warnings) {
		if (!byHelper.has(w.helper)) byHelper.set(w.helper, [])
		byHelper.get(w.helper)!.push(w)
	}

	console.log(label ? `\n  ${label}: ${warnings.length} lint warning(s)` : `\n${warnings.length} lint warning(s)`)
	for (const [helper, ws] of byHelper) {
		console.log(`\n  ${helper}:`)
		for (const w of ws) {
			const target = w.member ? `${w.category} ${w.member}` : w.category
			console.log(`    - [${target}] ${w.message}`)
		}
	}

	return warnings.length
}

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

		let totalWarnings = 0

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

			if (options.lint) {
				const scanResults = scanner.state.get('scanResults') || []
				const warnings = lintResults(scanResults)
				totalWarnings += printLintReport(warnings, target.name)
			}
		}

		console.log('\nAll introspection data generated.')
		if (options.lint && totalWarnings > 0) {
			console.log(`\nTotal: ${totalWarnings} lint warning(s) across all targets.`)
		}
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

	if (options.lint) {
		const scanResults = scanner.state.get('scanResults') || []
		const warnings = lintResults(scanResults)
		printLintReport(warnings)
	}
}

commands.registerHandler('introspect', {
	description: 'Generate introspection metadata from source. Works in any luca project.',
	argsSchema,
	handler: introspect,
})
