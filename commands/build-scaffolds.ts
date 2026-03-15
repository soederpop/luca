import { z } from 'zod'
import type { ContainerContext } from '@soederpop/luca'
import { CommandOptionsSchema } from '@soederpop/luca/schemas'

export const argsSchema = CommandOptionsSchema.extend({})

interface ScaffoldSection {
	heading: string
	code: string
}

interface ScaffoldData {
	sections: ScaffoldSection[]
	full: string
	tutorial: string
}

/**
 * Parse a markdown file to extract code blocks grouped by their nearest heading.
 * Also extracts the "Complete Example" code block as the `full` template.
 */
function parseScaffoldMarkdown(content: string): ScaffoldData {
	const sections: ScaffoldSection[] = []
	let full = ''

	let currentHeading = ''
	const lines = content.split('\n')
	let inCodeBlock = false
	let codeBlockLang = ''
	let codeBlockLines: string[] = []

	for (const line of lines) {
		// Track headings
		const headingMatch = line.match(/^##\s+(.+)/)
		if (headingMatch && !inCodeBlock) {
			currentHeading = headingMatch[1].trim()
			continue
		}

		// Track code fences
		const fenceMatch = line.match(/^```(\w*)/)
		if (fenceMatch && !inCodeBlock) {
			inCodeBlock = true
			codeBlockLang = fenceMatch[1] || ''
			codeBlockLines = []
			continue
		}

		if (line.startsWith('```') && inCodeBlock) {
			inCodeBlock = false
			const code = codeBlockLines.join('\n')

			// Only collect ts/js code blocks
			if (codeBlockLang === 'ts' || codeBlockLang === 'typescript' || codeBlockLang === 'js') {
				sections.push({ heading: currentHeading, code })

				if (currentHeading === 'Complete Example') {
					full = code
				}
			}
			continue
		}

		if (inCodeBlock) {
			codeBlockLines.push(line)
		}
	}

	return { sections, full, tutorial: content }
}

async function buildScaffolds(options: z.infer<typeof argsSchema>, context: ContainerContext) {
	const container = context.container as any
	const fs = container.feature('fs')

	const scaffoldDir = 'docs/scaffolds'
	const readmePath = 'docs/mcp/readme.md'
	const outputPath = 'src/scaffolds/generated.ts'

	const types = ['feature', 'client', 'server', 'command', 'endpoint']
	const scaffolds: Record<string, ScaffoldData> = {}

	for (const type of types) {
		const filePath = `${scaffoldDir}/${type}.md`
		if (!fs.exists(filePath)) {
			console.log(`   ⏭  ${filePath} (not found, skipping)`)
			continue
		}

		const content = fs.readFile(filePath)
		scaffolds[type] = parseScaffoldMarkdown(content)
		console.log(`   📄 ${type}: ${scaffolds[type].sections.length} sections, full template: ${scaffolds[type].full ? 'yes' : 'no'}`)
	}

	// Bundle the assistant example as a multi-file scaffold
	const assistantDir = 'docs/examples/assistant'
	const assistantFiles: Record<string, string> = {}
	const assistantFileNames = ['CORE.md', 'tools.ts', 'hooks.ts']
	for (const fileName of assistantFileNames) {
		const filePath = `${assistantDir}/${fileName}`
		if (fs.exists(filePath)) {
			assistantFiles[fileName] = fs.readFile(filePath)
		}
	}
	if (Object.keys(assistantFiles).length > 0) {
		console.log(`   📄 assistant: ${Object.keys(assistantFiles).length} files (${Object.keys(assistantFiles).join(', ')})`)
	}

	// Read the MCP readme
	let mcpReadme = ''
	if (fs.exists(readmePath)) {
		mcpReadme = fs.readFile(readmePath)
		console.log(`   📄 MCP readme: ${mcpReadme.length} chars`)
	} else {
		console.log(`   ⚠️  ${readmePath} not found`)
	}

	// Generate the output file
	const escapeForTemplate = (s: string) => s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${')

	const scaffoldEntries = Object.entries(scaffolds).map(([type, data]) => {
		const sectionsStr = data.sections.map(s =>
			`      { heading: ${JSON.stringify(s.heading)}, code: \`${escapeForTemplate(s.code)}\` }`
		).join(',\n')

		return `  ${type}: {
    sections: [
${sectionsStr}
    ],
    full: \`${escapeForTemplate(data.full)}\`,
    tutorial: \`${escapeForTemplate(data.tutorial)}\`,
  }`
	}).join(',\n')

	const assistantFilesEntries = Object.entries(assistantFiles).map(([name, content]) =>
		`    ${JSON.stringify(name)}: \`${escapeForTemplate(content)}\``
	).join(',\n')

	const output = `// Auto-generated scaffold and MCP readme content
// Generated at: ${new Date().toISOString()}
// Source: docs/scaffolds/*.md, docs/examples/assistant/, and docs/mcp/readme.md
//
// Do not edit manually. Run: luca build-scaffolds

export interface ScaffoldSection {
  heading: string
  code: string
}

export interface ScaffoldData {
  sections: ScaffoldSection[]
  full: string
  tutorial: string
}

export const scaffolds: Record<string, ScaffoldData> = {
${scaffoldEntries}
}

export const assistantFiles: Record<string, string> = {
${assistantFilesEntries}
}

export const mcpReadme = \`${escapeForTemplate(mcpReadme)}\`
`

	fs.ensureFolder('src/scaffolds')
	await fs.writeFileAsync(outputPath, output)
	console.log(`\n✨ Generated ${outputPath}`)
}

export default {
	description: 'Generate scaffold templates and MCP readme from docs/scaffolds/*.md',
	argsSchema,
	handler: buildScaffolds,
}
