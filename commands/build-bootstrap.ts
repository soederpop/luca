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
		const content = await fs.readFileAsync(`${sourceDir}/${file}`)
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
			const content = await fs.readFileAsync(`${templatesDir}/${file}`)
			const name = file.replace(/\.[^.]+$/, '') // strip any extension
			templates[name] = content
			console.log(`   template/${name}: ${content.length} chars`)
		}
	}

	// 3. Collect docs/examples/*.md
	const examples: Record<string, string> = {}
	const examplesDir = 'docs/examples'
	if (fs.exists(examplesDir)) {
		const exampleFiles = (await fs.readdir(examplesDir)).filter((f: string) => f.endsWith('.md'))
		for (const file of exampleFiles) {
			const content = await fs.readFileAsync(`${examplesDir}/${file}`)
			examples[file] = content
			console.log(`   example/${file}: ${content.length} chars`)
		}
	}

	// 4. Collect docs/tutorials/*.md
	const tutorials: Record<string, string> = {}
	const tutorialsDir = 'docs/tutorials'
	if (fs.exists(tutorialsDir)) {
		const tutorialFiles = (await fs.readdir(tutorialsDir)).filter((f: string) => f.endsWith('.md'))
		for (const file of tutorialFiles) {
			const content = await fs.readFileAsync(`${tutorialsDir}/${file}`)
			tutorials[file] = content
			console.log(`   tutorial/${file}: ${content.length} chars`)
		}
	}

	const escapeForTemplate = (s: string) => s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')

	const fileEntries = Object.entries(entries).map(([name, content]) =>
		`  ${JSON.stringify(name)}: \`${escapeForTemplate(content)}\``
	).join(',\n')

	const templateEntries = Object.entries(templates).map(([name, content]) =>
		`  ${JSON.stringify(name)}: \`${escapeForTemplate(content)}\``
	).join(',\n')

	const exampleEntries = Object.entries(examples).map(([name, content]) =>
		`  ${JSON.stringify(name)}: \`${escapeForTemplate(content)}\``
	).join(',\n')

	const tutorialEntries = Object.entries(tutorials).map(([name, content]) =>
		`  ${JSON.stringify(name)}: \`${escapeForTemplate(content)}\``
	).join(',\n')

	const output = `// Auto-generated bootstrap content
// Source: docs/bootstrap/*.md, docs/bootstrap/templates/*, docs/examples/*.md, docs/tutorials/*.md
//
// Do not edit manually. Run: luca build-bootstrap

export const bootstrapFiles: Record<string, string> = {
${fileEntries}
}

export const bootstrapTemplates: Record<string, string> = {
${templateEntries}
}

export const bootstrapExamples: Record<string, string> = {
${exampleEntries}
}

export const bootstrapTutorials: Record<string, string> = {
${tutorialEntries}
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
