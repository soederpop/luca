import { z } from 'zod'
import type { ContainerContext } from 'luca'
import { CommandOptionsSchema } from 'luca/schemas'

export const argsSchema = CommandOptionsSchema.extend({})

/**
 * Bundle the tsc-emitted declaration tree (dist/**\/*.d.ts) plus zod's published
 * declarations into src/setup/generated-types.ts so the compiled binary can
 * write IDE types into consumer projects (`luca setup --types`) with zero npm.
 *
 * Run after `bun run build:types`.
 */
async function buildTypesBundle(options: z.infer<typeof argsSchema>, context: ContainerContext) {
	const container = context.container as any
	const fs = container.feature('fs')

	const outputPath = 'src/setup/generated-types.ts'
	const bundle: Record<string, string> = {}

	// 1. luca's own declaration tree (skip .d.ts.map — no sources to map to in consumer projects)
	if (!fs.exists('dist/node.d.ts')) {
		console.log('dist/node.d.ts not found — run `bun run build:types` first')
		process.exit(1)
	}
	const { files } = await fs.walkAsync('dist', { relative: true, include: ['**/*.d.ts'] })
	for (const file of files.sort()) {
		bundle[file] = await fs.readFileAsync(`dist/${file}`)
	}
	console.log(`   luca: ${files.length} declaration files`)

	// 2. Vendored dependency declarations under deps/ — the packages consumer
	//    project code imports directly (zod, contentbase) plus @types/node for
	//    the process/console/Buffer ambient globals (wired via tsconfig typeRoots).
	const vendored = [
		{ name: 'zod', exclude: ['src/**', 'node_modules/**'] },
		{ name: 'contentbase', exclude: ['node_modules/**', 'docs/**'] },
		{ name: '@types/node', exclude: ['node_modules/**'] },
	]
	for (const dep of vendored) {
		const root = `node_modules/${dep.name}`
		const { files: depFiles } = await fs.walkAsync(root, {
			relative: true,
			include: ['**/*.d.ts'],
			exclude: dep.exclude,
		})
		for (const file of depFiles.sort()) {
			bundle[`deps/${dep.name}/${file}`] = await fs.readFileAsync(`${root}/${file}`)
		}
		// package.json is needed for typeRoots/entry resolution
		bundle[`deps/${dep.name}/package.json`] = await fs.readFileAsync(`${root}/package.json`)
		console.log(`   ${dep.name}: ${depFiles.length} declaration files`)
	}

	const escapeForTemplate = (s: string) => s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')
	const entries = Object.entries(bundle).map(([name, content]) =>
		`  ${JSON.stringify(name)}: \`${escapeForTemplate(content)}\``
	).join(',\n')

	const totalBytes = Object.values(bundle).reduce((n, c) => n + c.length, 0)
	const pkg = await fs.readJsonAsync('package.json')

	const output = `// Auto-generated types bundle for \`luca setup --types\`
// Source: dist/**/*.d.ts (tsc -p tsconfig.build.json) + node_modules/zod/**/*.d.ts
//
// Do not edit manually. Run: bun run build:types && luca build-types-bundle

export const typesBundleVersion = ${JSON.stringify(pkg.version)}

export const typesBundle: Record<string, string> = {
${entries}
}
`

	fs.ensureFolder('src/setup')
	await fs.writeFileAsync(outputPath, output)
	console.log(`\nGenerated ${outputPath} (${Object.keys(bundle).length} files, ${(totalBytes / 1024 / 1024).toFixed(1)}MB)`)
}

export default {
	description: 'Bundle dist/**/*.d.ts + zod declarations into src/setup/generated-types.ts for the compiled binary',
	argsSchema,
	handler: buildTypesBundle,
}
