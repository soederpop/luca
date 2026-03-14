import { z } from 'zod'
import type { ContainerContext } from '@soederpop/luca'
import { CommandOptionsSchema } from '@soederpop/luca/schemas'

export const argsSchema = CommandOptionsSchema.extend({})

async function buildBootstrap(options: z.infer<typeof argsSchema>, context: ContainerContext) {
	const container = context.container as any
	const fs = container.feature('fs')

	const sourceDir = 'docs/bootstrap'
	const outputPath = 'src/bootstrap/generated.ts'

	if (!fs.exists(sourceDir)) {
		console.log(`Source directory ${sourceDir} not found`)
		return
	}

	const allFiles = await fs.readdir(sourceDir)
	const files = allFiles.filter((f: string) => f.endsWith('.md'))
	const entries: Record<string, string> = {}

	for (const file of files) {
		const content = (await fs.readFileAsync(`${sourceDir}/${file}`)).toString()
		const name = file.replace(/\.md$/, '')
		entries[name] = content
		console.log(`   ${name}: ${content.length} chars`)
	}

	const escapeForTemplate = (s: string) => s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')

	const fileEntries = Object.entries(entries).map(([name, content]) =>
		`  ${JSON.stringify(name)}: \`${escapeForTemplate(content)}\``
	).join(',\n')

	const output = `// Auto-generated bootstrap content
// Generated at: ${new Date().toISOString()}
// Source: docs/bootstrap/*.md
//
// Do not edit manually. Run: luca build-bootstrap

export const bootstrapFiles: Record<string, string> = {
${fileEntries}
}
`

	fs.ensureFolder('src/bootstrap')
	await fs.writeFileAsync(outputPath, output)
	console.log(`\nGenerated ${outputPath}`)
}

export default {
	description: 'Bundle docs/bootstrap/*.md into src/bootstrap/generated.ts for the compiled binary',
	argsSchema,
	handler: buildBootstrap,
}
