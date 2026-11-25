/**
 * The plugins of this project: which it loads (`LUCA_PLUGINS` in its
 * `.env`), which are installed (folders and links in the plugins folder),
 * and what each adds. Turning one on or off edits only the `LUCA_PLUGINS`
 * line; linking a folder makes one link in the plugins folder.
 *
 * The plugins folder is `~/.luca/plugins`, where the CLI looks for a bare
 * name. `LUCA_WORKBENCH_PLUGINS_DIR` moves it for tests and check runs; the
 * `.env` line then names a plugin by its full path, which the CLI also reads.
 */
import { applyPlan, emptyView, envPlugins, finish, plannedFile, setEnvPlugins, type Plan, type Write } from './changes.js'
import { HELPER_TYPES, displayPath, helpersInFolder, pluginNameOf, tildePath } from './origins.js'
import { borrowedFolders } from './borrow.js'

const ENTRY_FILES = ['luca.plugin.ts', 'plugin.ts']

export function pluginsDir(container: any): { dir: string; isDefault: boolean } {
	const fromEnv = String(process.env.LUCA_WORKBENCH_PLUGINS_DIR || '').trim()
	if (fromEnv) return { dir: container.paths.resolve(fromEnv), isDefault: false }
	return { dir: container.paths.resolve(String(container.feature('os').homedir), '.luca', 'plugins'), isDefault: true }
}

function realOr(container: any, path: string): string {
	try { return container.feature('fs').realpath(path) } catch { return path }
}

function readText(container: any, path: string): string | null {
	const fs = container.feature('fs')
	try { return fs.isFile(path) ? String(fs.readFile(path)) : null } catch { return null }
}

/** What a plugin folder adds, by type, from its helper folders. */
function addsOf(container: any, dir: string) {
	const adds: Array<{ type: string; names: string[] }> = []
	for (const type of HELPER_TYPES) {
		const names = [...helpersInFolder(container, type, container.paths.resolve(dir, type)).keys()]
		if (names.length) adds.push({ type, names })
	}
	const fs = container.feature('fs')
	const entry = ENTRY_FILES.find((f) => fs.isFile(container.paths.resolve(dir, f))) ?? null
	const parts = adds.map((a) => `${a.names.length} ${a.names.length === 1 ? a.type.replace(/s$/, '') : a.type}`)
	if (entry) parts.push(`${entry} attach()`)
	return { adds, entry, addsText: parts.length ? parts.join(' · ') : 'no helper folders' }
}

/** The `.env` entry that names an installed plugin. */
function entryFor(name: string, linkPath: string, isDefault: boolean): string {
	return isDefault ? name : linkPath
}

/** Does an `.env` entry mean this plugin? By name, or by a path to it. */
function entryMatches(container: any, entry: string, name: string, linkPath: string): boolean {
	if (entry === name) return true
	if (!entry.includes('/') && !entry.startsWith('.') && !entry.startsWith('~')) return false
	const home = String(container.feature('os').homedir)
	const path = entry.startsWith('~/') ? container.paths.resolve(home, entry.slice(2)) : container.paths.resolve(String(container.cwd), entry)
	return path === linkPath || realOr(container, path) === realOr(container, linkPath)
}

export function pluginsView(container: any) {
	const fs = container.feature('fs')
	const cwd = String(container.cwd)
	const home = String(container.feature('os').homedir)
	const { dir, isDefault } = pluginsDir(container)
	const envPath = container.paths.resolve(cwd, '.env')
	const envText = readText(container, envPath)
	const entries = envPlugins(envText) ?? []
	const lineText = (envText ?? '').match(/^LUCA_PLUGINS=.*$/m)?.[0] ?? null
	const loaded = String(process.env.LUCA_PLUGINS || '').split(',').map((s) => s.trim()).filter(Boolean)

	let names: string[] = []
	try { names = fs.isDirectory(dir) ? fs.readdirSync(dir).filter((n: string) => !n.startsWith('.')).sort() : [] } catch {}
	const matched = new Set<string>()
	const plugins = names.flatMap((name) => {
		const linkPath = container.paths.resolve(dir, name)
		if (!fs.isDirectory(linkPath)) return []
		const link = fs.isSymlink(linkPath)
		const target = realOr(container, linkPath)
		const on = entries.some((e) => { const m = entryMatches(container, e, name, linkPath); if (m) matched.add(e); return m })
		const { adds, entry, addsText } = addsOf(container, linkPath)
		return [{
			name,
			path: linkPath,
			display: tildePath(linkPath, home),
			link,
			target: tildePath(target, home),
			isThisProject: target === realOr(container, cwd),
			entry,
			on,
			loaded: loaded.some((e) => entryMatches(container, e, name, linkPath)),
			entryValue: entryFor(name, linkPath, isDefault),
			adds,
			addsText,
		}]
	})
	const missing = entries.filter((e) => !matched.has(e)).map((e) => {
		let resolved: string | null = null
		try { resolved = container.feature('helpers').resolvePluginDir(e) } catch {}
		return { entry: e, resolved: resolved ? tildePath(resolved, home) : null, note: resolved ? 'a folder outside the plugins folder' : 'not found: the CLI warns and skips it' }
	})
	const cliPath = container.paths.resolve(cwd, 'luca.cli.ts')
	return {
		envFile: displayPath(envPath, home, cwd),
		envExists: envText !== null,
		line: lineText,
		pluginsDir: tildePath(dir, home),
		pluginsDirIsDefault: isDefault,
		loaded,
		plugins,
		missing,
		cliFile: displayPath(cliPath, home, cwd),
		cliExists: fs.isFile(cliPath),
		borrowed: borrowedFolders(container),
	}
}

export type PluginRequest = { op: 'on' | 'off' | 'link'; name?: string; entry?: string; folder?: string }

/** Turn a plugin on or off (the `LUCA_PLUGINS` line), or link a folder as a plugin. */
export function planPlugin(container: any, req: PluginRequest): Plan {
	const cwd = String(container.cwd)
	const home = String(container.feature('os').homedir)
	const fs = container.feature('fs')
	const { dir, isDefault } = pluginsDir(container)
	const writes: Write[] = []

	if (req.op === 'link') {
		const folder = String(req.folder || '').startsWith('~/') ? container.paths.resolve(home, String(req.folder).slice(2)) : container.paths.resolve(cwd, String(req.folder || ''))
		const name = slugName(req.name || pluginNameOf(folder))
		const linkPath = container.paths.resolve(dir, name)
		const view = emptyView('link', `Link ${container.paths.basename(folder)} as plugin ${name}`)
		const plan: Plan = { view, writes, allowedRoots: [dir] }
		view.summary = `Makes one link in ${tildePath(dir, home)}. Nothing in the folder changes.`
		if (!req.folder || !fs.isDirectory(folder)) view.blocked = `Not a folder: ${tildePath(folder, home)}`
		else if (!ENTRY_FILES.some((f) => fs.isFile(container.paths.resolve(folder, f)))) view.blocked = `${tildePath(folder, home)} has no luca.plugin.ts, so it is not a plugin`
		else if (!name) view.blocked = 'The plugin needs a name'
		else if (fs.linkExists(linkPath)) {
			view.blocked = realOr(container, linkPath) === realOr(container, folder)
				? `Linked already as ${name}`
				: `A plugin named ${name} exists already (${tildePath(realOr(container, linkPath), home)}). Link it under another name.`
		} else {
			writes.push({ path: linkPath, link: folder })
			const { addsText } = addsOf(container, folder)
			view.notes.push(`It adds: ${addsText}`)
			view.files.push({ path: linkPath, display: tildePath(linkPath, home), action: 'link', target: tildePath(folder, home), lines: [], added: 0, removed: 0 })
		}
		finish(view, writes, false)
		return plan
	}

	const name = String(req.name || req.entry || '')
	const envPath = container.paths.resolve(cwd, '.env')
	const before = readText(container, envPath)
	const entries = envPlugins(before) ?? []
	const linkPath = container.paths.resolve(dir, name)
	const view = emptyView(req.op, `Turn ${name} ${req.op} for ${container.paths.basename(cwd)}`)
	const plan: Plan = { view, writes, allowedRoots: [cwd] }
	view.summary = 'Only the LUCA_PLUGINS line of .env changes.'
	let next = entries
	if (req.op === 'on') {
		if (!name || !fs.isDirectory(linkPath)) view.blocked = `No plugin ${name} in ${tildePath(dir, home)}`
		else if (entries.some((e) => entryMatches(container, e, name, linkPath))) view.blocked = `${name} is on already`
		else next = [...entries, entryFor(name, linkPath, isDefault)]
	} else if (req.op === 'off') {
		next = entries.filter((e) => e !== req.entry && !entryMatches(container, e, name, linkPath))
		if (next.length === entries.length) view.blocked = `${name} is not on`
	} else {
		view.blocked = `unknown op: ${req.op}`
	}
	if (!view.blocked) {
		const after = setEnvPlugins(before, next)
		view.files.push(plannedFile(envPath, home, before, after, before === null ? 'a new file' : undefined, cwd))
		writes.push({ path: envPath, content: after })
		view.notes.push('The host restarts so the project loads the change.')
	}
	finish(view, writes, false)
	return plan
}

/** `@agentic-loop` -> `agentic-loop`. */
export function slugName(name: string): string {
	return name.replace(/^@+/, '').toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')
}

export { applyPlan }
