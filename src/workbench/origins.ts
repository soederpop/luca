/**
 * Where each helper of a project comes from: its own folders, a folder
 * borrowed in `luca.cli.ts`, a plugin, the user's `~/.luca`, or Luca itself.
 *
 * It reads files only. It scans the same folders the CLI loads, in the
 * same order, and names helpers the way the helpers feature does, so the
 * first folder that has a name is the one that won (a registry keeps the
 * first helper of a name).
 */
import { parseCliFile } from './cli-file.js'

export type OriginKind = 'own' | 'borrowed' | 'plugin' | 'home' | 'builtin'

export type HelperOrigin = {
	kind: OriginKind
	/** A short tag for a card: `own`, `borrowed · a`, `plugin · example`, `built in`. */
	tag: string
	/** One line: `borrowed from ~/x/a/commands`. */
	label: string
	/** The helper's source file (a folder for an assistant). */
	file?: string
	/** The folder of its type it was found in (`/x/a/commands`). */
	dir?: string
	/** The project or plugin folder that holds `dir`. */
	root?: string
	/** The plugin's name, for kind `plugin`. */
	plugin?: string
}

export const HELPER_TYPES = ['features', 'clients', 'servers', 'commands', 'endpoints', 'selectors'] as const
const CLASS_BASED = ['features', 'clients', 'servers']
/** Types the CLI also discovers in `~/.luca/<type>`. */
const HOME_TYPES = ['features', 'clients', 'servers', 'commands', 'selectors']

/** `my-thing_x` -> `myThingX`, as the helpers feature names a file. */
export function fileNameToRegistryName(fileName: string): string {
	return fileName.replace(/[-_](.)/g, (_, c: string) => c.toUpperCase()).replace(/^(.)/, (_, c: string) => c.toLowerCase())
}

/** `/Users/me/x` -> `~/x`. */
export function tildePath(path: string, home: string): string {
	return home && (path === home || path.startsWith(home + '/')) ? '~' + path.slice(home.length) : path
}

/** A path inside a project as `<project folder>/<rest>`, else with `~`. */
export function displayPath(path: string, home: string, root?: string): string {
	const r = (root || '').replace(/\/+$/, '')
	if (r && path.startsWith(r + '/')) return `${r.split('/').pop()}/${path.slice(r.length + 1)}`
	return tildePath(path, home)
}

/**
 * The helpers one folder of a type holds, by registry name, with the file
 * each comes from. Static: files are read, never loaded.
 */
export function helpersInFolder(container: any, type: string, dir: string): Map<string, string> {
	const fs = container.feature('fs')
	const out = new Map<string, string>()
	if (!dir || !fs.isDirectory(dir)) return out
	const read = (file: string): string => { try { return String(fs.readFile(file)) } catch { return '' } }

	if (type === 'commands' || type === 'selectors') {
		// Top level only, as the CLI discovers them.
		let names: string[] = []
		try { names = fs.readdirSync(dir) } catch {}
		for (const name of names.sort()) {
			if (!name.endsWith('.ts') || name === 'index.ts') continue
			const file = container.paths.resolve(dir, name)
			if (!fs.isFile(file)) continue
			const id = name.replace(/\.ts$/, '')
			if (!out.has(id)) out.set(id, file)
		}
		return out
	}

	let files: string[] = []
	try { files = fs.walk(dir, { include: ['*.ts'], directories: false, exclude: ['node_modules'] }).files } catch {}
	for (const file of files.sort()) {
		const fileName = container.paths.parse(file).name as string
		if (fileName.includes('.test.') || fileName.includes('.spec.') || fileName.includes('.generated')) continue
		const text = read(file)
		let id: string | undefined
		if (type === 'endpoints') {
			const m = text.match(/export\s+const\s+path\s*=\s*['"`]([^'"`]+)['"`]/)
			id = m ? (m[1]!.replace(/^\//, '').replace(/\//g, '_') || fileName) : fileName
		} else if (CLASS_BASED.includes(type)) {
			const m = text.match(new RegExp(`shortcut\\s*=\\s*['"\`]${type}\\.([^'"\`]+)['"\`]`))
			id = m ? m[1]! : fileNameToRegistryName(fileName)
		}
		if (id && !out.has(id)) out.set(id, file)
	}
	return out
}

/** The plugin folders the CLI loaded, from `LUCA_PLUGINS` as this process saw it. */
export function loadedPluginDirs(container: any): Array<{ name: string; dir: string }> {
	const names = String(process.env.LUCA_PLUGINS || '').split(',').map((s) => s.trim()).filter(Boolean)
	const out: Array<{ name: string; dir: string }> = []
	for (const name of names) {
		let dir: string | null = null
		try { dir = container.feature('helpers').resolvePluginDir(name) } catch {}
		if (dir) out.push({ name: pluginNameOf(name), dir })
	}
	return out
}

/** `example-plugin`, or a path's last folder name. */
export function pluginNameOf(entry: string): string {
	const parts = entry.split('/').filter(Boolean)
	return parts[parts.length - 1] || entry
}

type Source = { kind: OriginKind; type: string; dir: string; root: string; plugin?: string }

/** The folders the CLI scans, in the order it scans them. */
export function sources(container: any): Source[] {
	const cwd = String(container.cwd)
	const home = String(container.feature('os').homedir)
	const fs = container.feature('fs')
	const out: Source[] = []

	for (const p of loadedPluginDirs(container)) {
		for (const type of HELPER_TYPES) out.push({ kind: 'plugin', type, dir: container.paths.resolve(p.dir, type), root: p.dir, plugin: p.name })
	}

	const cliPath = container.paths.resolve(cwd, 'luca.cli.ts')
	if (fs.exists(cliPath)) {
		const parsed = parseCliFile(String(fs.readFile(cliPath)))
		for (const call of parsed.calls) {
			if (call.kind === 'discover') {
				const dir = container.paths.resolve(cwd, call.directory)
				out.push({ kind: 'borrowed', type: call.type, dir, root: container.paths.dirname(dir) })
			} else {
				let dir: string | null = null
				try { dir = container.feature('helpers').resolvePluginDir(call.name) } catch {}
				if (dir && dir !== cwd) {
					for (const type of HELPER_TYPES) out.push({ kind: 'plugin', type, dir: container.paths.resolve(dir, type), root: dir, plugin: pluginNameOf(call.name) })
				}
			}
		}
	}

	for (const type of HELPER_TYPES) out.push({ kind: 'own', type, dir: container.paths.resolve(cwd, type), root: cwd })
	for (const type of HOME_TYPES) out.push({ kind: 'home', type, dir: container.paths.resolve(home, '.luca', type), root: container.paths.resolve(home, '.luca') })
	return out
}

export function originOf(kind: OriginKind, home: string, extra: { file?: string; dir?: string; root?: string; plugin?: string } = {}): HelperOrigin {
	const folder = extra.root ? pluginNameOf(extra.root) : ''
	switch (kind) {
		case 'own': return { kind, tag: 'own', label: 'this project', ...extra }
		case 'borrowed': return { kind, tag: `borrowed · ${folder}`, label: `borrowed from ${tildePath(extra.dir || '', home)}`, ...extra }
		case 'plugin': return { kind, tag: `plugin · ${extra.plugin}`, label: `plugin ${extra.plugin} (${tildePath(extra.root || '', home)})`, ...extra }
		case 'home': return { kind, tag: '~/.luca', label: `from ${tildePath(extra.dir || '', home)}`, ...extra }
		default: return { kind: 'builtin', tag: 'built in', label: 'built into Luca' }
	}
}

/**
 * Every helper's origin, keyed `registry.id`. A helper the helpers feature
 * did not register is built in. Built once per host: a change to the
 * project restarts the host.
 */
export class OriginIndex {
	private map = new Map<string, HelperOrigin>()
	private registered = new Set<string>()
	private home: string

	constructor(private container: any) {
		this.home = String(container.feature('os').homedir)
		try { this.registered = new Set<string>(container.feature('helpers').state.get('registered') || []) } catch {}
		for (const source of sources(container)) {
			for (const [id, file] of helpersInFolder(container, source.type, source.dir)) {
				const key = `${source.type}.${id}`
				if (this.map.has(key)) continue
				this.map.set(key, originOf(source.kind, this.home, { file, dir: source.dir, root: source.root, ...(source.plugin ? { plugin: source.plugin } : {}) }))
			}
		}
	}

	of(registry: string, id: string): HelperOrigin {
		const key = `${registry}.${id}`
		const found = this.map.get(key)
		if (found && this.registered.has(key)) return found
		// Registered but in no folder we scan (a plugin's attach() registered it, say).
		if (this.registered.has(key)) return { kind: 'own', tag: 'project', label: 'registered by the project' }
		return originOf('builtin', this.home)
	}
}
