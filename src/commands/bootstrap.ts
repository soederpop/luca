import { z } from 'zod'
import { commands } from '../command.js'
import { CommandOptionsSchema } from '../schemas/base.js'
import type { ContainerContext } from '../container.js'
import { bootstrapFiles } from '../bootstrap/generated.js'
import { apiDocs } from './save-api-docs.js'

declare module '../command.js' {
	interface AvailableCommands {
		bootstrap: ReturnType<typeof commands.registerHandler>
	}
}

export const argsSchema = CommandOptionsSchema.extend({
	output: z.string().default('luca-bootstrap').describe('Output folder path'),
})

async function bootstrap(options: z.infer<typeof argsSchema>, context: ContainerContext) {
	const { container } = context
	const args = container.argv._ as string[]
	const outputDir = container.paths.resolve(args[1] || options.output)
	const fs = container.feature('fs')
	const ui = container.feature('ui')

	await fs.ensureFolder(outputDir)
	const mkPath = (...segments: string[]) => container.paths.resolve(outputDir, ...segments)

	// 1. Write SKILL.md from bundled content
	ui.print.cyan('Writing SKILL.md...')
	await fs.writeFileAsync(mkPath('SKILL.md'), bootstrapFiles['SKILL'] || '')

	// 2. Write .claude/CLAUDE.md from bundled content
	ui.print.cyan('Writing .claude/CLAUDE.md...')
	await fs.ensureFolder(mkPath('.claude'))
	await fs.writeFileAsync(mkPath('.claude', 'CLAUDE.md'), bootstrapFiles['CLAUDE'] || '')

	// 3. Generate api-docs
	ui.print.cyan('Generating API docs...')
	const apiDocsPath = mkPath('references', 'api-docs')
	await apiDocs({ _: [], outputPath: apiDocsPath }, context)

	ui.print.green(`\nBootstrap folder created at ${outputDir}`)
	ui.print.info('Contents:')
	ui.print.info('  SKILL.md                         — core framework mental model')
	ui.print.info('  .claude/CLAUDE.md                 — claude code project instructions')
	ui.print.info('  references/api-docs/              — full API reference')
}

commands.registerHandler('bootstrap', {
	description: 'Generate a self-contained folder with SKILL.md, .claude/ config, and API docs for bootstrapping an LLM agent',
	argsSchema,
	handler: bootstrap,
})
