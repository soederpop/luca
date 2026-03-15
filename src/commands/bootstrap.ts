import { z } from 'zod'
import { commands } from '../command.js'
import { CommandOptionsSchema } from '../schemas/base.js'
import type { ContainerContext } from '../container.js'
import { bootstrapFiles, bootstrapTemplates } from '../bootstrap/generated.js'
import { apiDocs } from './save-api-docs.js'
import { generateScaffold } from '../scaffolds/template.js'

declare module '../command.js' {
	interface AvailableCommands {
		bootstrap: ReturnType<typeof commands.registerHandler>
	}
}

export const argsSchema = CommandOptionsSchema.extend({
	output: z.string().default('.').describe('Output folder path (defaults to cwd)'),
})

async function bootstrap(options: z.infer<typeof argsSchema>, context: ContainerContext) {
	const { container } = context
	const args = container.argv._ as string[]
	const outputDir = container.paths.resolve(args[1] || options.output)
	const fs = container.feature('fs')
	const ui = container.feature('ui')
	const proc = container.feature('proc')

	await fs.ensureFolder(outputDir)
	const mkPath = (...segments: string[]) => container.paths.resolve(outputDir, ...segments)

	ui.print.cyan('\n  luca bootstrap\n')

	// ── Check for AI coding tools ──────────────────────────────────
	await checkToolAvailability(ui, proc)

	// ── 1. .env (only if missing) ──────────────────────────────────
	const envPath = mkPath('.env')
	if (!fs.exists(envPath)) {
		await writeFile(fs, ui, envPath, '', '.env')
	} else {
		ui.print.dim('  .env already exists, skipping')
	}

	// ── 2. CLAUDE.md ───────────────────────────────────────────────
	await writeFile(fs, ui, mkPath('CLAUDE.md'), bootstrapFiles['CLAUDE'] || '', 'CLAUDE.md')

	// ── 3. .claude/skills/luca-framework/ ──────────────────────────
	const skillDir = mkPath('.claude', 'skills', 'luca-framework')
	await fs.ensureFolder(skillDir)
	await writeFile(fs, ui, container.paths.resolve(skillDir, 'SKILL.md'), bootstrapFiles['SKILL'] || '', '.claude/skills/luca-framework/SKILL.md')

	ui.print.cyan('  Generating API docs...')
	const apiDocsPath = container.paths.resolve(skillDir, 'references', 'api-docs')
	await apiDocs({ _: [], outputPath: apiDocsPath }, context)

	// ── 4. docs/ folder ────────────────────────────────────────────
	await fs.ensureFolder(mkPath('docs'))
	await writeFile(fs, ui, mkPath('docs', 'models.ts'), bootstrapTemplates['docs-models'] || '', 'docs/models.ts')
	await writeFile(fs, ui, mkPath('docs', 'README.md'), bootstrapTemplates['docs-readme'] || '', 'docs/README.md')

	// ── 5. commands/about.ts ────────────────────────────────────────
	await fs.ensureFolder(mkPath('commands'))
	await writeFile(fs, ui, mkPath('commands', 'about.ts'), bootstrapTemplates['about-command'] || '', 'commands/about.ts')

	// ── 6. features/example.ts (scaffold-based) ────────────────────
	await fs.ensureFolder(mkPath('features'))
	const featureCode = generateScaffold('feature', 'example', 'An example feature demonstrating the luca feature pattern')
		|| bootstrapTemplates['example-feature'] || ''
	await writeFile(fs, ui, mkPath('features', 'example.ts'), featureCode, 'features/example.ts')

	// ── 7. endpoints/health.ts ─────────────────────────────────────
	await fs.ensureFolder(mkPath('endpoints'))
	await writeFile(fs, ui, mkPath('endpoints', 'health.ts'), bootstrapTemplates['health-endpoint'] || '', 'endpoints/health.ts')

	// ── 8. luca.cli.ts ─────────────────────────────────────────────
	await writeFile(fs, ui, mkPath('luca.cli.ts'), bootstrapTemplates['luca-cli'] || '', 'luca.cli.ts')

	// ── Summary ────────────────────────────────────────────────────
	ui.print('')
	ui.print.green('  ✓ Bootstrap complete!\n')
	ui.print('  Your project is ready. Here\'s what to try:\n')
	ui.print('    luca                  — see available commands')
	ui.print('    luca about            — project info + discovered helpers')
	ui.print('    luca serve            — start the API server (try /api/health)')
	ui.print('    luca scaffold         — generate new commands, features, endpoints')
	ui.print('    luca describe fs      — learn about any built-in feature')
	ui.print('')
}

// ── Helpers ──────────────────────────────────────────────────────────

async function writeFile(fs: any, ui: any, path: string, content: string, label: string) {
	ui.print.cyan(`  Writing ${label}...`)
	await fs.writeFileAsync(path, content)
}

async function checkToolAvailability(ui: any, proc: any) {
	const tools: { name: string; found: boolean; envKey?: string; envFound?: boolean }[] = []

	for (const name of ['claude', 'codex']) {
		let found = false
		try {
			const result = await proc.exec(`which ${name}`, { silent: true })
			found = result.exitCode === 0 && result.stdout.trim().length > 0
		} catch {
			found = false
		}
		tools.push({ name, found })
	}

	const openaiKey = !!process.env.OPENAI_API_KEY
	const hasAnyCodingTool = tools.some(t => t.found)

	if (!hasAnyCodingTool) {
		ui.print.yellow('  ┌─────────────────────────────────────────────────────────────┐')
		ui.print.yellow('  │  No AI coding assistant detected (claude, codex)            │')
		ui.print.yellow('  │                                                             │')
		ui.print.yellow('  │  Luca works best with an AI coding assistant.               │')
		ui.print.yellow('  │                                                             │')
		ui.print.yellow('  │  Claude Code:  https://docs.anthropic.com/en/docs/claude-code│')
		ui.print.yellow('  │  Codex CLI:    https://github.com/openai/codex              │')
		ui.print.yellow('  └─────────────────────────────────────────────────────────────┘')
		ui.print('')
	} else {
		for (const t of tools) {
			if (t.found) ui.print.green(`  ✓ ${t.name} detected`)
		}
	}

	if (!openaiKey) {
		ui.print.dim('  ℹ OPENAI_API_KEY not set (only needed for codex/OpenAI features)')
	} else {
		ui.print.green('  ✓ OPENAI_API_KEY set')
	}

	ui.print('')
}

commands.registerHandler('bootstrap', {
	description: 'Scaffold a new luca project with commands, features, endpoints, docs, and AI assistant configuration',
	argsSchema,
	handler: bootstrap,
})
