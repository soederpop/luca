import { z } from 'zod'
import { commands } from '../command.js'
import { CommandOptionsSchema } from '../schemas/base.js'
import type { ContainerContext } from '../container.js'
// @ts-ignore — bun resolves JSON imports at bundle time
import pkg from '../../package.json'
import { BUILD_SHA } from '../cli/build-info.js'

declare module '../command.js' {
	interface AvailableCommands {
		'self-update': ReturnType<typeof commands.registerHandler>
	}
}

// Same script the README and website tell people to pipe into bash.
const INSTALL_SCRIPT_URL = 'https://luca-js.soederpop.com/install.sh'
const LATEST_RELEASE_URL = 'https://api.github.com/repos/soederpop/luca/releases/latest'

export const argsSchema = CommandOptionsSchema.extend({
	check: z.boolean().default(false).describe('Only report whether a newer release exists; install nothing'),
	force: z.boolean().default(false).describe('Reinstall even when already on the latest release, or when the binary lives inside a git checkout'),
})

export const examples = [
	'luca self-update',
	{ command: 'luca self-update --check', description: 'See if a newer release exists' },
	{ command: 'luca self-update --force', description: 'Reinstall the latest release even if versions match' },
	{ command: 'luca self-update', description: 'Inside a project with .claude/skills/luca-framework, also refreshes that skill' },
]

async function latestVersion(): Promise<string | undefined> {
	try {
		const res = await fetch(LATEST_RELEASE_URL, { headers: { accept: 'application/vnd.github+json' } })
		if (!res.ok) return undefined
		const body = await res.json() as { tag_name?: string }
		return body.tag_name?.replace(/^v/, '')
	} catch {
		return undefined
	}
}

// True when version a is strictly newer than b. Plain x.y.z only; release tags never carry prereleases.
function isNewer(a: string, b: string): boolean {
	const pa = a.split('.').map(Number)
	const pb = b.split('.').map(Number)
	for (let i = 0; i < 3; i++) {
		if ((pa[i] ?? 0) !== (pb[i] ?? 0)) return (pa[i] ?? 0) > (pb[i] ?? 0)
	}
	return false
}

export default async function selfUpdate(options: z.infer<typeof argsSchema>, context: ContainerContext) {
	const container = context.container as any
	const ui = container.feature('ui')
	const fs = container.feature('fs')
	const proc = container.feature('proc')
	const current = pkg.version as string

	const latest = await latestVersion()
	const updateAvailable = !!latest && isNewer(latest, current)
	if (latest) ui.print.dim(`Installed: v${current}   Latest: v${latest}`)
	else ui.print.yellow('Could not reach GitHub to check the latest version.')

	if (options.check) {
		if (updateAvailable) ui.print.cyan('An update is available. Run: luca self-update')
		else if (latest) ui.print.green('luca is up to date.')
		return
	}

	if (process.platform === 'win32') {
		ui.print.red('self-update uses install.sh, which does not support Windows.')
		ui.print('Download luca-windows-x64.exe from https://github.com/soederpop/luca/releases/latest')
		process.exit(1)
	}

	// From source (lucadev), execPath is bun itself; replacing it would be a disaster.
	if (BUILD_SHA === 'dev') {
		ui.print.red('This luca runs from source, not a compiled binary. Nothing to update; pull the repo instead.')
		process.exit(1)
	}

	if (latest && !updateAvailable && !options.force) {
		ui.print.green('luca is up to date. Use --force to reinstall anyway.')
		return
	}

	// Install over the real file the user is running, wherever that is. Resolving
	// the symlink matters: install.sh would otherwise replace the link itself.
	const binary = fs.realpath(process.execPath)
	const installDir = container.paths.dirname(binary)

	// A binary under <repo>/dist is a local dev build. Overwriting it with a
	// release silently throws away whatever was compiled there.
	if (fs.exists(container.paths.resolve(installDir, '..', '.git')) && !options.force) {
		ui.print.red(`${binary} sits inside a git checkout, so it looks like a local build.`)
		ui.print('Rebuild it from the repo, or pass --force to replace it with the release.')
		process.exit(1)
	}

	ui.print.cyan(`Updating ${binary} via ${INSTALL_SCRIPT_URL}`)

	const result = await proc.spawnAndCapture('bash', ['-c', `curl -fsSL ${INSTALL_SCRIPT_URL} | bash`], {
		stdio: 'inherit',
		environment: { LUCA_INSTALL_DIR: installDir },
	})

	if (result.exitCode !== 0) {
		ui.print.red(`Update failed (exit ${result.exitCode}). Your existing binary is unchanged.`)
		process.exit(result.exitCode || 1)
	}

	// The skill's files are compiled into the binary, so this process only has
	// the old ones. Ask the freshly installed binary to write its own. Only
	// projects that already have the skill get it: running self-update from
	// any folder must not drop a .claude/ into it.
	const skillDir = container.paths.resolve('.claude', 'skills', 'luca-framework')
	if (!fs.exists(skillDir)) return

	ui.print.cyan('Refreshing .claude/skills/luca-framework with the new release')
	const skill = await proc.spawnAndCapture(binary, ['bootstrap', '--update-skill'], { stdio: 'inherit' })
	if (skill.exitCode !== 0) {
		ui.print.yellow(`The binary updated, but refreshing the skill failed. Run: luca bootstrap --update-skill`)
	}
}

commands.registerHandler('self-update', {
	description: 'Reinstall the luca binary from the latest GitHub release, the same way install.sh does, then refresh the project\'s luca-framework skill',
	argsSchema,
	examples,
	handler: selfUpdate,
})
