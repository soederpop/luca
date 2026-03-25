import { z } from 'zod'
import { commands } from '../command.js'
import { CommandOptionsSchema } from '../schemas/base.js'
import type { ContainerContext } from '../container.js'
import { bootstrapFiles, bootstrapTemplates, bootstrapExamples, bootstrapTutorials } from '../bootstrap/generated.js'
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
	const fs = container.feature('fs')
	const ui = container.feature('ui')
	const proc = container.feature('proc')

	// Require an explicit target — don't silently bootstrap into cwd
	let target = args[1] || (options.output !== '.' ? options.output : '')

	if (!target) {
		const answer = await ui.askQuestion('Project name (folder to create):')
		target = answer?.question?.trim()
		if (!target) {
			ui.print.red('\n  No project name given, aborting.\n')
			return
		}
	}

	const outputDir = container.paths.resolve(target)
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

	// ── 3b. examples and tutorials ─────────────────────────────────
	const examplesDir = container.paths.resolve(skillDir, 'references', 'examples')
	await fs.ensureFolder(examplesDir)
	for (const [filename, content] of Object.entries(bootstrapExamples)) {
		await fs.writeFileAsync(container.paths.resolve(examplesDir, filename), content)
	}
	ui.print.cyan(`  Writing ${Object.keys(bootstrapExamples).length} example docs...`)

	const tutorialsDir = container.paths.resolve(skillDir, 'references', 'tutorials')
	await fs.ensureFolder(tutorialsDir)
	for (const [filename, content] of Object.entries(bootstrapTutorials)) {
		await fs.writeFileAsync(container.paths.resolve(tutorialsDir, filename), content)
	}
	ui.print.cyan(`  Writing ${Object.keys(bootstrapTutorials).length} tutorial docs...`)

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

	// ── 9. RUNME.md ────────────────────────────────────────────────
	await writeFile(fs, ui, mkPath('RUNME.md'), bootstrapTemplates['runme'] || '', 'RUNME.md')

	// ── 10. .claude/settings.json (permissions for AI coding tools) ──
	const settingsPath = mkPath('.claude', 'settings.json')
	const claudeSettings = {
		permissions: {
			allow: [
				'Bash(luca *)',
				'Bash(bun run *)',
				'Bash(bun test *)',
			],
		},
	}

	if (!fs.exists(settingsPath)) {
		await fs.ensureFolder(mkPath('.claude'))
		await writeFile(fs, ui, settingsPath, JSON.stringify(claudeSettings, null, 2) + '\n', '.claude/settings.json')
	} else {
		// Merge luca permissions into existing settings
		try {
			const existing = JSON.parse(fs.readFile(settingsPath) as string)
			const perms = existing.permissions || {}
			const allow = new Set(perms.allow || [])
			for (const rule of claudeSettings.permissions.allow) {
				allow.add(rule)
			}
			existing.permissions = { ...perms, allow: [...allow] }
			await writeFile(fs, ui, settingsPath, JSON.stringify(existing, null, 2) + '\n', '.claude/settings.json (merged)')
		} catch {
			ui.print.yellow('  ⚠ Could not parse existing .claude/settings.json, skipping merge')
		}
	}

	// ── Summary ────────────────────────────────────────────────────
	ui.print('')
	ui.print.green('  ✓ Bootstrap complete!\n')
	ui.print('  Your project is ready. Here\'s what to try:\n')
	ui.print('    luca                  — see available commands')
	ui.print('    luca about            — project info + discovered helpers')
	ui.print('    luca serve            — start the API server (try /api/health)')
	ui.print('    luca describe fs      — learn about any built-in feature')
	ui.print('    luca RUNME            — run the interactive markdown demo')
	ui.print('')
	ui.print('  Need to build something? Use scaffold:\n')
	ui.print('    luca scaffold command deploy    — add a CLI command')
	ui.print('    luca scaffold feature cache     — add a container feature')
	ui.print('    luca scaffold endpoint users    — add a REST route')
	ui.print('    luca scaffold client github     — add an API client')
	ui.print('    luca scaffold server mqtt       — add a server')
	ui.print('')
	ui.print.dim('    Run luca scaffold <type> --tutorial for a full guide on any type')
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
