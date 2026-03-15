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

	// 1. Collect top-level markdown files (SKILL.md, CLAUDE.md, etc.)
	const allFiles = await fs.readdir(sourceDir)
	const mdFiles = allFiles.filter((f: string) => f.endsWith('.md'))
	const entries: Record<string, string> = {}

	for (const file of mdFiles) {
		const content = (await fs.readFileAsync(`${sourceDir}/${file}`)).toString()
		const name = file.replace(/\.md$/, '')
		entries[name] = content
		console.log(`   ${name}: ${content.length} chars`)
	}

	// 2. Collect template files (docs/bootstrap/templates/*)
	const templates: Record<string, string> = {}
	const templatesDir = `${sourceDir}/templates`
	if (fs.exists(templatesDir)) {
		const templateFiles = await fs.readdir(templatesDir)
		for (const file of templateFiles) {
			const content = (await fs.readFileAsync(`${templatesDir}/${file}`)).toString()
			const name = file.replace(/\.[^.]+$/, '') // strip any extension
			templates[name] = content
			console.log(`   template/${name}: ${content.length} chars`)
		}
	}

	const escapeForTemplate = (s: string) => s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')

	const fileEntries = Object.entries(entries).map(([name, content]) =>
		`  ${JSON.stringify(name)}: \`${escapeForTemplate(content)}\``
	).join(',\n')

	const templateEntries = Object.entries(templates).map(([name, content]) =>
		`  ${JSON.stringify(name)}: \`${escapeForTemplate(content)}\``
	).join(',\n')

	const output = `// Auto-generated bootstrap content
// Generated at: ${new Date().toISOString()}
// Source: docs/bootstrap/*.md, docs/bootstrap/templates/*
//
// Do not edit manually. Run: luca build-bootstrap

export const bootstrapFiles: Record<string, string> = {
${fileEntries}
}

export const bootstrapTemplates: Record<string, string> = {
${templateEntries}
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
