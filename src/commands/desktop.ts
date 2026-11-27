import { z } from 'zod'
import { commands } from '../command.js'
import { CommandOptionsSchema } from '../schemas/base.js'
import type { ContainerContext } from '../container.js'
import { desktopKitFiles, DESKTOP_KIT_ROUTE } from '../web/desktop/index.js'

declare module '../command.js' {
	interface AvailableCommands {
		desktop: ReturnType<typeof commands.registerHandler>
	}
}

// .github/workflows/desktop.yaml publishes each build as a release tagged
// desktop-v<version>-<build>, never marked latest, so self-update ignores it.
const RELEASES_URL = 'https://api.github.com/repos/soederpop/luca/releases?per_page=50'
const TAG_PREFIX = 'desktop-v'
const ASSET_NAME = 'Luca-Desktop.zip'
const APP_NAME = 'Luca Desktop.app'

export const positionals = ['action']

export const argsSchema = CommandOptionsSchema.extend({
	action: z.enum(['install', 'check', 'sdk']).default('install').describe('install: download the newest build into /Applications. check: only compare versions. sdk: write the page kit (kit.css, kit.js, kit.mjs, tokens.json) into a folder, for a page served by something other than Luca'),
	force: z.boolean().default(false).describe('Install even when the installed build is the newest'),
	open: z.boolean().default(false).describe('Open the app after it is installed'),
	dir: z.string().default('/Applications').describe('The folder to install the app into'),
	out: z.string().default('public/_luca/desktop').describe('sdk: the folder to write the kit files into'),
	print: z.string().optional().describe('sdk: print one file to stdout instead (kit.css, kit.js, kit.mjs or tokens.json)'),
})

export const examples = [
	'luca desktop install',
	{ command: 'luca desktop check', description: 'See if a newer Luca Desktop build exists' },
	{ command: 'luca desktop install --open', description: 'Install or update, then open it' },
	{ command: 'luca desktop install --dir ~/Applications', description: 'Install for this user only' },
	{ command: 'luca desktop sdk', description: 'Write kit.css, kit.js, kit.mjs and tokens.json into public/_luca/desktop' },
	{ command: 'luca desktop sdk --print kit.css', description: 'Print the stylesheet (pipe it anywhere)' },
]

type Release = {
	tag_name: string
	draft: boolean
	html_url: string
	assets: { name: string; browser_download_url: string }[]
}

// desktop-v3.27.0-1234 -> { version: '3.27.0', build: 1234 }
function parseTag(tag: string): { version: string; build: number } | undefined {
	const m = tag.slice(TAG_PREFIX.length).match(/^(\d+\.\d+\.\d+)-(\d+)$/)
	return m ? { version: m[1]!, build: Number(m[2]) } : undefined
}

export default async function desktop(options: z.infer<typeof argsSchema>, context: ContainerContext) {
	const container = context.container as any
	const ui = container.feature('ui')
	const fs = container.feature('fs')
	const proc = container.feature('proc')
	const downloader = container.feature('downloader')

	if (options.action === 'sdk') return writeSdk(options, container)

	if (process.platform !== 'darwin') {
		ui.print.red('Luca Desktop is a macOS app.')
		process.exit(1)
	}

	let releases: Release[]
	try {
		releases = await downloader.downloadJson(RELEASES_URL, { headers: { accept: 'application/vnd.github+json' } })
	} catch (error: any) {
		ui.print.red(`Could not list releases on GitHub: ${error?.message || error}`)
		process.exit(1)
	}

	const newest = releases
		.filter((r) => !r.draft && r.tag_name.startsWith(TAG_PREFIX) && parseTag(r.tag_name))
		.map((r) => ({ release: r, ...parseTag(r.tag_name)! }))
		.sort((a, b) => b.build - a.build)[0]
	if (!newest) {
		ui.print.red('No Luca Desktop release is published yet.')
		process.exit(1)
	}

	const target = container.paths.resolve(options.dir.replace(/^~(?=\/|$)/, container.os.homedir), APP_NAME)
	const plist = container.paths.resolve(target, 'Contents', 'Info.plist')
	let installed: number | undefined
	if (fs.exists(plist)) {
		const read = await proc.spawnAndCapture('/usr/libexec/PlistBuddy', ['-c', 'Print :CFBundleVersion', plist])
		const n = Number(read.stdout?.trim())
		if (read.exitCode === 0 && Number.isFinite(n)) installed = n
	}

	ui.print.dim(`Installed: ${installed == null ? 'none' : `build ${installed}`}   Newest: v${newest.version} build ${newest.build}`)
	const upToDate = installed != null && installed >= newest.build

	if (options.action === 'check') {
		if (upToDate) ui.print.green('Luca Desktop is up to date.')
		else ui.print.cyan('A newer build exists. Run: luca desktop install')
		return
	}

	if (upToDate && !options.force) {
		ui.print.green('Luca Desktop is up to date. Use --force to reinstall anyway.')
		return
	}

	const asset = newest.release.assets.find((a) => a.name === ASSET_NAME)
	if (!asset) {
		ui.print.red(`${newest.release.tag_name} has no ${ASSET_NAME}. See ${newest.release.html_url}`)
		process.exit(1)
	}

	const work = container.paths.resolve(container.os.tmpdir, `luca-desktop-${newest.build}-${Date.now()}`)
	await fs.ensureFolder(work)
	const zip = container.paths.resolve(work, ASSET_NAME)
	try {
		ui.print.cyan(`Downloading ${newest.release.tag_name}`)
		await downloader.downloadFile(asset.browser_download_url, zip)

		// ditto keeps the code signature and the stapled ticket intact; unzip can break them.
		const unpacked = container.paths.resolve(work, 'app')
		const x = await proc.spawnAndCapture('ditto', ['-x', '-k', zip, unpacked])
		if (x.exitCode !== 0 || !fs.exists(container.paths.resolve(unpacked, APP_NAME))) {
			ui.print.red(`Could not unpack ${ASSET_NAME}: ${x.stderr || 'the app is missing from it'}`)
			process.exit(1)
		}

		const running = await proc.spawnAndCapture('pgrep', ['-x', 'LucaDesktop'])
		if (running.exitCode === 0) ui.print.yellow('Luca Desktop is running. Quit and reopen it to use the new build.')

		await fs.ensureFolder(options.dir.replace(/^~(?=\/|$)/, container.os.homedir))
		if (fs.exists(target)) await proc.spawnAndCapture('rm', ['-rf', target])
		const copy = await proc.spawnAndCapture('ditto', [container.paths.resolve(unpacked, APP_NAME), target])
		if (copy.exitCode !== 0) {
			ui.print.red(`Could not write ${target}: ${copy.stderr}`)
			process.exit(1)
		}
	} finally {
		await proc.spawnAndCapture('rm', ['-rf', work])
	}

	ui.print.green(`Installed ${target} (v${newest.version} build ${newest.build})`)
	if (options.open) await proc.spawnAndCapture('open', [target])
}

commands.registerHandler('desktop', {
	description: 'Install or check Luca Desktop from GitHub releases, or write its page kit (kit.css, kit.js) for web pages that open as tiles',
	argsSchema,
	positionals,
	examples,
	handler: desktop,
})

/**
 * `luca desktop sdk`: the page kit as files. A page served by `luca serve`
 * or any Luca express server never needs this: they answer
 * `/_luca/desktop/kit.css` themselves. This is for every other server.
 */
async function writeSdk(options: z.infer<typeof argsSchema>, container: any) {
	const ui = container.feature('ui')
	const fs = container.feature('fs')
	const files = desktopKitFiles()
	if (options.print) {
		const file = files.find((f) => f.name === options.print)
		if (!file) {
			ui.print.red(`No kit file named ${options.print}. One of: ${files.map((f) => f.name).join(', ')}`)
			process.exit(1)
		}
		process.stdout.write(file.body)
		return
	}
	const out = container.paths.resolve(options.out.replace(/^~(?=\/|$)/, container.os.homedir))
	await fs.ensureFolder(out)
	for (const file of files) fs.writeFile(container.paths.resolve(out, file.name), file.body)
	ui.print.green(`Wrote ${files.map((f) => f.name).join(', ')} to ${out}`)
	ui.print.dim(`Load them as <link rel="stylesheet" href="${DESKTOP_KIT_ROUTE}/kit.css"> and <script src="${DESKTOP_KIT_ROUTE}/kit.js"></script>, or from wherever that folder is served.`)
}
