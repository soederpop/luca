#!/usr/bin/env bun
// @ts-ignore — bun resolves JSON imports at bundle time
import pkg from '../../package.json'
import { BUILD_SHA, BUILD_BRANCH, BUILD_DATE } from './build-info'

// Fast-path flags that don't need the container
const args = process.argv.slice(2)
if (args.includes('--version') || args.includes('-v')) {
	console.log(`luca v${pkg.version} (${BUILD_BRANCH}@${BUILD_SHA}) built ${BUILD_DATE}`)
	console.log(`  npm: https://www.npmjs.com/package/luca`)
	console.log(`  git: https://github.com/soederpop/luca`)
	process.exit(0)
}

// Internal entrypoint: the llama-server idle watchdog re-invokes luca with
// LUCA_INTERNAL set instead of exposing a CLI command. See ensureWatchdog()
// in src/node/features/llama-server.ts, which spawns this.
if (process.env.LUCA_INTERNAL === 'llama-watchdog') {
	const { runWatchdog } = await import('../node/features/llama-server.js')
	const outcome = await runWatchdog({
		port: Number(process.env.LUCA_WATCHDOG_PORT),
		idleMs: Number(process.env.LUCA_WATCHDOG_IDLE_MS || 900_000),
		pollMs: Number(process.env.LUCA_WATCHDOG_POLL_MS || 30_000),
		log: (message) => console.log(`[llama-watchdog] ${new Date().toISOString()} ${message}`),
	})
	console.log(`[llama-watchdog] exiting: ${outcome}`)
	process.exit(0)
}

import container from 'luca/agi'
import '@/commands/index.js'
import { runCli } from './runner.js'

await runCli(container, {
	binaryName: 'luca',
	onBeforeDispatch: (c: any) => {
		// Easter egg — install a missing-command handler if userland hasn't.
		const existing = c.state.get('missingCommandHandler') as any
		if (typeof existing === 'function') return
		c.state.set('missingCommandHandler', async ({ phrase }: { phrase: string }) => {
			if (phrase === 'get loopy') {
				await getLoopy(c)
				return
			}
			c.argv._.splice(0, 0, 'help')
			await c.command('help' as any).dispatch()
		})
	},
})

async function getLoopy(container: any) {
	const fs = container.feature('fs')
	const ui = container.feature('ui')
	const os = container.feature('os')
	const proc = container.feature('proc')

	const repoUrl = 'https://github.com/soederpop/agentic-loop.git'
	const appDir = container.paths.resolve(os.homedir, '.luca', 'apps', 'agentic-loop')

	console.log(ui.colors.cyan('Getting loopy...'))

	fs.ensureFolder(container.paths.resolve(os.homedir, '.luca', 'apps'))

	if (fs.existsSync(container.paths.resolve(appDir, '.git'))) {
		console.log(ui.colors.cyan('  Updating agentic-loop repo...'))
		await proc.exec('git pull', { cwd: appDir })
	} else {
		if (fs.existsSync(appDir)) {
			await proc.exec(`rm -rf ${appDir}`)
		}
		console.log(ui.colors.cyan('  Cloning agentic-loop repo...'))
		await proc.exec(`git clone ${repoUrl} ${appDir}`)
	}

	console.log(ui.colors.cyan('  Installing dependencies...'))
	await proc.exec('bun install', { cwd: appDir })

	console.log(ui.colors.cyan('  Setting up assistants...'))
	const assistantsDir = container.paths.resolve('assistants')
	fs.ensureFolder(assistantsDir)
	for (const assistant of ['lucaCoder', 'chiefOfStaff', 'rocket', 'researcher']) {
		const src = container.paths.resolve(appDir, 'assistants', assistant)
		const dest = container.paths.resolve(assistantsDir, assistant)
		if (fs.existsSync(src) && !fs.existsSync(dest)) {
			fs.copy(src, dest)
		}
	}

	console.log(ui.colors.cyan('  Setting up scripts...'))
	const scriptsSrc = container.paths.resolve(appDir, 'scripts')
	const scriptsDest = container.paths.resolve('scripts')
	if (fs.existsSync(scriptsSrc)) {
		fs.copy(scriptsSrc, scriptsDest)
	}

	console.log(ui.colors.cyan('  Setting up apps...'))
	const appsSrc = container.paths.resolve(appDir, 'apps')
	const appsDest = container.paths.resolve('apps')
	if (fs.existsSync(appsSrc) && !fs.existsSync(appsDest)) {
		fs.copy(appsSrc, appsDest)
	}

	const configSrc = container.paths.resolve(appDir, 'config.example.yml')
	const configDest = container.paths.resolve('config.yml')
	if (fs.existsSync(configSrc) && !fs.existsSync(configDest)) {
		console.log(ui.colors.cyan('  Setting up config.yml...'))
		fs.copy(configSrc, configDest)
	}

	console.log(ui.colors.cyan('  Setting up docs...'))
	const docsDir = container.paths.resolve('docs')
	fs.ensureFolder(docsDir)

	for (const sub of ['goals', 'ideas', 'projects', 'plans', 'plays', 'prompts', 'tasks', 'reports']) {
		fs.ensureFolder(container.paths.resolve(docsDir, sub))
	}

	const modelsSrc = container.paths.resolve(appDir, 'docs', 'models.ts')
	if (fs.existsSync(modelsSrc)) {
		fs.copy(modelsSrc, container.paths.resolve(docsDir, 'models.ts'))
	}

	const templatesSrc = container.paths.resolve(appDir, 'docs', 'templates')
	const templatesDest = container.paths.resolve(docsDir, 'templates')
	if (fs.existsSync(templatesSrc)) {
		fs.copy(templatesSrc, templatesDest)
	}

	const visionSrc = container.paths.resolve(appDir, 'docs', 'templates', 'starter-docs', 'VISION.md')
	const visionDest = container.paths.resolve(docsDir, 'VISION.md')
	if (fs.existsSync(visionSrc) && !fs.existsSync(visionDest)) {
		fs.copy(visionSrc, visionDest)
	}

	const memoriesSrc = container.paths.resolve(appDir, 'docs', 'templates', 'starter-docs', 'memories')
	const memoriesDest = container.paths.resolve(docsDir, 'memories')
	if (fs.existsSync(memoriesSrc) && !fs.existsSync(memoriesDest)) {
		fs.copy(memoriesSrc, memoriesDest)
	}

	const loopyCli = [
		'/**',
		' * luca.cli.ts — Agentic Loop project customization',
		' *',
		' * Automatically loaded by the luca CLI before any command runs.',
		' * Discovers local helpers and loads agentic-loop shared resources.',
		' */',
		'',
		'export async function main(container: any) {',
		'  // Discover project-level helpers (commands/, features/, endpoints/)',
		'  await container.helpers.discoverAll()',
		'',
		'  await loadAgenticLoop(container)',
		'',
		'  // Handle unknown commands gracefully instead of silently failing',
		'  container.onMissingCommand(async ({ phrase }: { phrase: string }) => {',
		"    container.command('help').dispatch()",
		'  })',
		'}',
		'',
		'async function loadAgenticLoop(container) {',
		'  try {',
		"    const agenticLoopRoot = container.paths.resolve(container.os.homedir, '.luca', 'apps', 'agentic-loop')",
		'',
		'    // use the agentic loop commands, etc',
		"    await container.feature('helpers', { rootDir: agenticLoopRoot }).discoverAll()",
		'',
		"    if (container.features.has('workflowLibrary')) {",
		"      const workflowLibrary = container.feature('workflowLibrary')",
		"      workflowLibrary.addWorkflowsDir(container.paths.resolve(agenticLoopRoot, 'workflows'))",
		'    }',
		'',
		'  } catch(error) {',
		'    console.error("Error loading the agentic loop helpers", error.message)',
		'  }',
		'}',
		'',
	].join('\n')

	fs.writeFile(container.paths.resolve('luca.cli.ts'), loopyCli)

	console.log(ui.colors.green('Loopy installed! You now have agentic-loop commands, features, workflows, and assistants.'))
	console.log('')
	console.log(ui.colors.cyan('  Next step: run scripts/install.sh to finish setup'))
}
