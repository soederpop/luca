#!/usr/bin/env bun
// @ts-ignore — bun resolves JSON imports at bundle time
import pkg from '../../package.json'
import { BUILD_SHA, BUILD_BRANCH, BUILD_DATE } from './build-info'

// Fast-path flags that don't need the container
const args = process.argv.slice(2)
if (args.includes('--version') || args.includes('-v')) {
	console.log(`luca v${pkg.version} (${BUILD_BRANCH}@${BUILD_SHA}) built ${BUILD_DATE}`)
	console.log(`  npm: https://www.npmjs.com/package/@soederpop/luca`)
	console.log(`  git: https://github.com/soederpop/luca`)
	process.exit(0)
}

import container from '@soederpop/luca/agi'
import '@/commands/index.js'
import { homedir } from 'os'
import { join } from 'path'

async function main() {
	const profile = process.env.LUCA_PROFILE === '1'
	const t = (label?: string) => {
		if (!profile) return () => { }
		const start = performance.now()
		return (suffix?: string) => {
			const ms = (performance.now() - start).toFixed(1)
			console.error(`[profile] ${label}${suffix ? ` ${suffix}` : ''}: ${ms}ms`)
		}
	}

	const tTotal = t('total boot')

	// LUCA_COMMAND_DISCOVERY: "disable" skips all, "no-local" skips project, "no-home" skips user
	const discovery = process.env.LUCA_COMMAND_DISCOVERY || ''

	// Snapshot built-in commands BEFORE loadCliModule — luca.cli.ts may call
	// helpers.discoverAll() which registers project commands early
	const builtinCommands = new Set(container.commands.available as string[])

	// Load global CLI module (~/.luca/luca.cli.ts) before project-level —
	// lets users set up global helpers, discovery roots, etc.
	let done = t('loadGlobalCliModule')
	await loadCliModule(join(homedir(), '.luca', 'luca.cli.ts'))
	done()

	// Load project-level CLI module (luca.cli.ts) for container customization
	done = t('loadCliModule')
	await loadCliModule(container.paths.resolve('luca.cli.ts'))
	done()

	// Discover project-local commands (commands/ or src/commands/)
	done = t('discoverProjectCommands')
	if (discovery !== 'disable' && discovery !== 'no-local') {
		await discoverProjectCommands()
	}
	done()
	const afterProject = new Set(container.commands.available as string[])
	const projectCommands = new Set([...afterProject].filter((n) => !builtinCommands.has(n)))

	// Discover user-level helpers (~/.luca/{features,clients,servers,commands,selectors}/)
	done = t('discoverUserHelpers')
	if (discovery !== 'disable' && discovery !== 'no-home') {
		await discoverUserHelpers()
	}
	done()
	const afterUser = new Set(container.commands.available as string[])
	const userCommands = new Set([...afterUser].filter((n) => !builtinCommands.has(n) && !projectCommands.has(n)))

		// Store command sources for help display
		; (container as any)._commandSources = { builtinCommands, projectCommands, userCommands }

	// Load generated introspection data if present
	done = t('loadProjectIntrospection')
	await loadProjectIntrospection()
	done()

	const commandName = container.argv._[0] as string

	done = t('dispatch')
	if (container.argv.help && !commandName) {
		// --help with no command is the same as `luca` with no args
		// Clear the help flag so the help command's handler runs (not the --help intercept)
		delete container.argv.help
		container.argv._.splice(0, 0, 'help')
		const cmd = container.command('help' as any)
		await cmd.dispatch()
	} else if (commandName && container.commands.has(commandName)) {
		const cmd = container.command(commandName as any)
		await cmd.dispatch()
	} else if (commandName) {
		// not a known command — treat as implicit `run`
		// 
		if (resolveScript(commandName, container)) {
			container.argv._.splice(0, 0, 'run')
			const cmd = container.command('run' as any)
			await cmd.dispatch()
		} else {
			const phrase = container.argv._.join(' ')

			// easter egg
			if (phrase === 'get loopy') {
				await getLoopy(container)
			// @ts-ignore TODO come up with a typesafe way to do this
			} else if (container.state.get('missingCommandHandler')) {
				// @ts-ignore TODO come up with a typesafe way to do this
				const missingCommandHandler = container.state.get('missingCommandHandler') as any

				if (typeof missingCommandHandler === 'function') {
					await missingCommandHandler({
						words: container.argv._,
						phrase,
					}).catch((err: any) => {
						console.error(`Missing command handler error: ${err.message}`, err)
					})
				}
			} else {
				container.argv._.splice(0, 0, 'help')
				const cmd = container.command('help' as any)
				await cmd.dispatch()
			}
		}

	} else {
		container.argv._.splice(0, 0, 'help')
		const cmd = container.command('help' as any)
		await cmd.dispatch()
	}
	done()
	tTotal()
}

function resolveScript(ref: string, container: any) {
	const candidates = [
		ref,
		`${ref}.ts`,
		`${ref}.js`,
		`${ref}.md`,
	]

	for (const candidate of candidates) {
		const resolved = container.paths.resolve(candidate)
		if (container.fs.exists(resolved)) return resolved
	}

	return null
}

async function loadCliModule(modulePath: string) {
	if (!container.fs.exists(modulePath)) return

	// Use the helpers feature to load the module — it handles the native import
	// vs VM decision using the same useNativeImport check as discovery
	const helpers = container.feature('helpers') as any
	const exports = await helpers.loadModuleExports(modulePath)

	if (typeof exports?.main === 'function') {
		await exports.main(container)
	}

	if (typeof exports?.onStart === 'function') {
		container.once('started', () => exports.onStart(container))
	}
}

async function discoverProjectCommands() {
	// Always route through the helpers feature — it handles native import vs VM
	// internally, and deduplicates concurrent/repeated discovery via promise caching.
	// If luca.cli.ts already called helpers.discoverAll(), this resolves instantly.
	const helpers = container.feature('helpers') as any
	await helpers.discover('commands')
}

async function loadProjectIntrospection() {
	const candidates = [
		'features/introspection.generated.ts',
		'src/introspection.generated.ts',
		'introspection.generated.ts',
	]

	for (const candidate of candidates) {
		const filePath = container.paths.resolve(candidate)
		if (container.fs.exists(filePath)) {
			try {
				await import(filePath)
			} catch {
				// Generated file may be stale or malformed — skip silently
			}
			return
		}
	}
}

const DISCOVERABLE_TYPES = ['features', 'clients', 'servers', 'commands', 'selectors'] as const

async function discoverUserHelpers() {
	const lucaHome = join(homedir(), '.luca')
	const helpers = container.feature('helpers') as any

	for (const type of DISCOVERABLE_TYPES) {
		const dir = join(lucaHome, type)
		if (container.fs.exists(dir)) {
			await helpers.discover(type, { directory: dir })
		}
	}
}

async function getLoopy(container: any) {
	const fs = container.feature('fs')
	const ui = container.feature('ui')
	const os = container.feature('os')
	const proc = container.feature('proc')

	const repoUrl = 'https://github.com/soederpop/agentic-loop.git'
	const appDir = container.paths.resolve(os.homedir, '.luca', 'apps', 'agentic-loop')

	console.log(ui.colors.cyan('Getting loopy...'))

	// Clone (or pull) the agentic-loop repo into ~/.luca/apps/agentic-loop
	fs.ensureFolder(container.paths.resolve(os.homedir, '.luca', 'apps'))

	if (fs.existsSync(container.paths.resolve(appDir, '.git'))) {
		console.log(ui.colors.cyan('  Updating agentic-loop repo...'))
		await proc.exec('git pull', { cwd: appDir })
	} else {
		// Clean out any stale non-git copy
		if (fs.existsSync(appDir)) {
			await proc.exec(`rm -rf ${appDir}`)
		}
		console.log(ui.colors.cyan('  Cloning agentic-loop repo...'))
		await proc.exec(`git clone ${repoUrl} ${appDir}`)
	}

	// Install dependencies
	console.log(ui.colors.cyan('  Installing dependencies...'))
	await proc.exec('bun install', { cwd: appDir })

	// Copy assistants into the local project
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

	// Copy scripts into the local project
	console.log(ui.colors.cyan('  Setting up scripts...'))
	const scriptsSrc = container.paths.resolve(appDir, 'scripts')
	const scriptsDest = container.paths.resolve('scripts')
	if (fs.existsSync(scriptsSrc)) {
		fs.copy(scriptsSrc, scriptsDest)
	}

	// Copy apps (native swift app) into the local project
	console.log(ui.colors.cyan('  Setting up apps...'))
	const appsSrc = container.paths.resolve(appDir, 'apps')
	const appsDest = container.paths.resolve('apps')
	if (fs.existsSync(appsSrc) && !fs.existsSync(appsDest)) {
		fs.copy(appsSrc, appsDest)
	}

	// Copy config.example.yml as config.yml
	const configSrc = container.paths.resolve(appDir, 'config.example.yml')
	const configDest = container.paths.resolve('config.yml')
	if (fs.existsSync(configSrc) && !fs.existsSync(configDest)) {
		console.log(ui.colors.cyan('  Setting up config.yml...'))
		fs.copy(configSrc, configDest)
	}

	// Set up the docs folder structure
	console.log(ui.colors.cyan('  Setting up docs...'))
	const docsDir = container.paths.resolve('docs')
	fs.ensureFolder(docsDir)

	for (const sub of ['goals', 'ideas', 'projects', 'plans', 'plays', 'prompts', 'tasks', 'reports']) {
		fs.ensureFolder(container.paths.resolve(docsDir, sub))
	}

	// Copy docs/models.ts
	const modelsSrc = container.paths.resolve(appDir, 'docs', 'models.ts')
	if (fs.existsSync(modelsSrc)) {
		fs.copy(modelsSrc, container.paths.resolve(docsDir, 'models.ts'))
	}

	// Copy docs/templates
	const templatesSrc = container.paths.resolve(appDir, 'docs', 'templates')
	const templatesDest = container.paths.resolve(docsDir, 'templates')
	if (fs.existsSync(templatesSrc)) {
		fs.copy(templatesSrc, templatesDest)
	}

	// Copy starter docs (VISION.md, memories/)
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

	// Replace the project's luca.cli.ts with the agentic-loop version
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

main()
