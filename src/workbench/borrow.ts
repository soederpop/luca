/**
 * Getting a helper from another project into this one (the project this
 * host serves): a hard copy of its file, or a borrow of its folder through
 * `luca.cli.ts`. Each is a plan first (`ChangeView`), applied on a confirm.
 *
 * Only this project's files are ever written. The source is read.
 */
import { addBorrow, removeBorrow, borrowEntries } from './cli-file.js'
import { applyPlan, emptyView, finish, plannedFile, type Plan, type PlannedImport, type Write } from './changes.js'
import { displayPath, helpersInFolder, tildePath, type OriginIndex } from './origins.js'

/** Types `discover(type, { directory })` registers. Endpoints and assistants are not among them. */
export const BORROWABLE = ['features', 'clients', 'servers', 'commands', 'selectors']

const IMPORT_RE = /(?:import|export)\s[^'"`;]*?from\s*['"]([^'"]+)['"]|import\s*['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|require\(\s*['"]([^'"]+)['"]\s*\)/g
/** Packages every Luca project has through the CLI's virtual modules or the runtime. */
const PROVIDED = /^(luca|@soederpop\/luca|zod|bun|bun:.*|node:.*|fs|path|os|child_process|crypto|url|util|events|stream|http|https|net|tty|readline|zlib|assert|buffer|process|timers|worker_threads)(\/.*)?$/

function inside(path: string, root: string): boolean {
	const r = root.replace(/\/+$/, '')
	return path === r || path.startsWith(r + '/')
}

function realOr(container: any, path: string): string {
	try { return container.feature('fs').realpath(path) } catch { return path }
}

function read(container: any, path: string): string | null {
	const fs = container.feature('fs')
	try { return fs.isFile(path) ? String(fs.readFile(path)) : null } catch { return null }
}

/** The relative and bare specifiers a source file imports. */
export function importSpecifiers(text: string): string[] {
	const out: string[] = []
	for (const m of text.matchAll(IMPORT_RE)) {
		const spec = m[1] || m[2] || m[3] || m[4]
		if (spec && !out.includes(spec)) out.push(spec)
	}
	return out
}

/** The file a relative specifier means, trying the extensions Bun tries. */
function resolveImport(container: any, fromFile: string, spec: string): string | null {
	const fs = container.feature('fs')
	const base = container.paths.resolve(container.paths.dirname(fromFile), spec)
	const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.mjs`, `${base}.json`, `${base}/index.ts`, `${base}/index.js`]
	// TypeScript ESM style: `./x.js` names `./x.ts`.
	if (/\.js$/.test(base)) candidates.splice(1, 0, base.replace(/\.js$/, '.ts'))
	return candidates.find((c) => fs.isFile(c)) ?? null
}

function hasPackage(container: any, cwd: string, name: string): boolean {
	const fs = container.feature('fs')
	const pkgName = name.startsWith('@') ? name.split('/').slice(0, 2).join('/') : name.split('/')[0]!
	if (fs.exists(container.paths.resolve(cwd, 'node_modules', pkgName))) return true
	try {
		const pkg = fs.readJson(container.paths.resolve(cwd, 'package.json'))
		return !!(pkg?.dependencies?.[pkgName] || pkg?.devDependencies?.[pkgName] || pkg?.peerDependencies?.[pkgName])
	} catch { return false }
}

/** Where a copied file goes: the same place under the type folder, else `<registry>/<name>`. */
function destinationOf(container: any, registry: string, file: string, root: string, cwd: string): string {
	const rel = container.paths.relative(root, file) as string
	if (rel.startsWith(`${registry}/`)) return container.paths.resolve(cwd, rel)
	return container.paths.resolve(cwd, registry, container.paths.basename(file))
}

export type CopyRequest = { registry: string; id: string; file: string; root: string; overwrite?: boolean; withImports?: boolean }

/** A hard copy of one helper's source into this project's own folder for its type. */
export function planCopy(container: any, origins: OriginIndex, req: CopyRequest): Plan {
	const fs = container.feature('fs')
	const cwd = String(container.cwd)
	const home = String(container.feature('os').homedir)
	const overwrite = !!req.overwrite
	const withImports = !!req.withImports
	const view = emptyView('copy', `Copy ${req.registry}.${req.id} into ${container.paths.basename(cwd)}`)
	const writes: Write[] = []
	const plan: Plan = { view, writes, allowedRoots: [cwd] }

	const file = String(req.file || '')
	const root = String(req.root || '')
	if (!file.startsWith('/') || !root.startsWith('/')) { view.blocked = 'The source file and its project folder must be absolute paths'; return finishPlan(plan, overwrite) }
	if (!fs.exists(file)) { view.blocked = `The source is gone: ${tildePath(file, home)}`; return finishPlan(plan, overwrite) }
	if (!inside(file, root)) { view.blocked = 'The source file is not inside its project folder'; return finishPlan(plan, overwrite) }
	if (realOr(container, root) === realOr(container, cwd)) { view.blocked = 'The helper is in this project already'; return finishPlan(plan, overwrite) }
	view.summary = `From ${tildePath(root, home)}. Only this project's files change.`

	// An assistant is a folder: copy all of it.
	const isFolder = fs.isDirectory(file)
	const sources: string[] = isFolder ? fs.walk(file, { directories: false, exclude: ['node_modules', '.git'] }).files.sort() : [file]
	const destRoot = isFolder ? container.paths.resolve(cwd, req.registry, container.paths.basename(file)) : null
	const destOf = (src: string) => destRoot ? container.paths.resolve(destRoot, container.paths.relative(file, src)) : destinationOf(container, req.registry, src, root, cwd)

	for (const src of sources) {
		const dest = destOf(src)
		const after = read(container, src) ?? ''
		const before = read(container, dest)
		const planned = plannedFile(dest, home, before, after, undefined, cwd)
		if (before === null) writes.push({ path: dest, content: after })
		else if (before === after) planned.note = 'there already, the same'
		else {
			planned.action = 'overwrite'
			view.clashes.push(`${planned.display} exists in this project and is different`)
			if (overwrite) writes.push({ path: dest, content: after })
		}
		view.files.push(planned)
	}

	// The name: a registry keeps the first helper of a name.
	const reg = container[req.registry]
	let has = false
	try { has = !!reg?.has?.(req.id) } catch {}
	if (has) {
		const origin = origins.of(req.registry, req.id)
		const ownFile = origin.file && view.files.some((f) => f.path === origin.file)
		if (origin.kind === 'builtin') {
			view.blocked = `${req.registry}.${req.id} is built into Luca. A project helper of the same name never loads, so a copy would do nothing.`
		} else if (!ownFile) {
			view.clashes.push(`${req.registry}.${req.id} already comes from ${origin.label}. ${origin.kind === 'own' || origin.kind === 'home' ? 'The copy would replace nothing and might not load.' : 'That one loads first, so the copy would not load.'}`)
		}
	}

	// Relative imports, followed through the files they bring.
	if (!isFolder) {
		const packages = new Set<string>()
		const seen = new Set<string>([file])
		const queue: Array<{ src: string; dest: string }> = [{ src: file, dest: destOf(file) }]
		while (queue.length) {
			const { src, dest } = queue.shift()!
			for (const spec of importSpecifiers(read(container, src) ?? '')) {
				if (!spec.startsWith('.')) {
					if (!PROVIDED.test(spec)) packages.add(spec)
					continue
				}
				const found = resolveImport(container, src, spec)
				if (!found) { view.notes.push(`${container.paths.basename(src)} imports ${spec}, which is missing in the source`); continue }
				if (seen.has(found)) continue
				seen.add(found)
				const target = container.paths.resolve(container.paths.dirname(dest), container.paths.relative(container.paths.dirname(src), found))
				const item: PlannedImport = { spec, from: displayPath(src, home, root), path: target, display: displayPath(target, home, cwd), action: 'create' }
				if (!inside(found, root)) { item.action = 'outside'; item.note = 'outside the source project: not copied' }
				else if (!inside(target, cwd)) { item.action = 'outside'; item.note = 'would land outside this project: not copied' }
				else {
					const before = read(container, target)
					const after = read(container, found) ?? ''
					if (before === after) { item.action = 'same'; item.note = 'there already, the same' }
					else if (before !== null) {
						item.action = 'clash'
						item.note = 'exists here and is different'
						if (withImports) {
							view.clashes.push(`${item.display} exists in this project and is different`)
							if (overwrite) writes.push({ path: target, content: after })
						}
					} else if (withImports) writes.push({ path: target, content: after })
					if (withImports && item.action !== 'same') view.files.push(Object.assign(plannedFile(target, home, before, after, undefined, cwd), before !== null ? { action: 'overwrite' as const } : {}))
					queue.push({ src: found, dest: target })
				}
				view.imports.push(item)
			}
		}
		const wanted = view.imports.filter((i) => i.action === 'create' || i.action === 'clash').length
		if (wanted && !withImports) view.notes.push(`${wanted} relative import${wanted === 1 ? '' : 's'} not copied. Include ${wanted === 1 ? 'it' : 'them'} to copy too.`)
		const missing = [...packages].filter((p) => !hasPackage(container, cwd, p))
		if (missing.length) view.notes.push(`Imports packages this project may not have: ${missing.join(', ')}`)
	}
	if (req.registry === 'endpoints') view.notes.push('An endpoint is served by `luca serve` from this project\'s endpoints/ folder.')
	return finishPlan(plan, overwrite)
}

export type BorrowRequest = { registry: string; dir: string; overwrite?: boolean }

/** Add a `discover(type, { directory })` for a source folder to this project's `luca.cli.ts`. */
export function planBorrow(container: any, origins: OriginIndex, req: BorrowRequest): Plan {
	const fs = container.feature('fs')
	const cwd = String(container.cwd)
	const home = String(container.feature('os').homedir)
	const overwrite = !!req.overwrite
	const dir = String(req.dir || '')
	const view = emptyView('borrow', `Borrow ${req.registry} from ${container.paths.basename(container.paths.dirname(dir))}`)
	const writes: Write[] = []
	const plan: Plan = { view, writes, allowedRoots: [cwd] }

	if (!BORROWABLE.includes(req.registry)) {
		view.blocked = `Luca does not load ${req.registry} through discover(). Hard copy it instead.`
		return finishPlan(plan, overwrite)
	}
	if (!dir.startsWith('/') || !fs.isDirectory(dir)) { view.blocked = `Not a folder: ${tildePath(dir, home)}`; return finishPlan(plan, overwrite) }
	if (inside(realOr(container, dir), realOr(container, cwd))) { view.blocked = 'That folder is inside this project already'; return finishPlan(plan, overwrite) }

	const names = [...helpersInFolder(container, req.registry, dir).keys()]
	view.helpers = names.map((n) => `${req.registry}.${n}`)
	view.summary = `The helpers stay in ${tildePath(dir, home)} and are read from there each time this project starts.`
	view.notes.push(`discover() reads a whole folder: this brings every ${req.registry.replace(/s$/, '')} in it (${names.length}).`)

	const reg = container[req.registry]
	for (const name of names) {
		let has = false
		try { has = !!reg?.has?.(name) } catch {}
		if (!has) continue
		const origin = origins.of(req.registry, name)
		if (origin.kind === 'builtin') view.notes.push(`${req.registry}.${name} is built in: the borrowed one will not load.`)
		else if (origin.kind === 'plugin') view.clashes.push(`${req.registry}.${name} already comes from ${origin.label}. The plugin loads first, so the borrowed one will not load.`)
		else if (origin.kind === 'borrowed') view.clashes.push(`${req.registry}.${name} is borrowed already from ${tildePath(origin.dir || '', home)}. That one loads first.`)
		else view.clashes.push(`${req.registry}.${name} already comes from ${origin.label}. luca.cli.ts runs first, so the borrowed one would replace it.`)
	}

	const cliPath = container.paths.resolve(cwd, 'luca.cli.ts')
	const before = read(container, cliPath)
	const edit = addBorrow(before, req.registry, dir)
	if ('error' in edit) { view.blocked = edit.error; return finishPlan(plan, overwrite) }
	view.files.push(plannedFile(cliPath, home, before, edit.text, before === null ? 'a new file' : edit.mainMode === 'user' ? 'one call line goes in your main()' : undefined, cwd))
	writes.push({ path: cliPath, content: edit.text })
	return finishPlan(plan, overwrite)
}

/** Take one borrowed folder out of the app's block in `luca.cli.ts`. */
export function planUnborrow(container: any, req: { id: string }): Plan {
	const cwd = String(container.cwd)
	const home = String(container.feature('os').homedir)
	const cliPath = container.paths.resolve(cwd, 'luca.cli.ts')
	const view = emptyView('unborrow', `Stop borrowing ${String(req.id || '').replace(':', ' from ')}`)
	const writes: Write[] = []
	const plan: Plan = { view, writes, allowedRoots: [cwd] }
	const before = read(container, cliPath)
	if (before === null) { view.blocked = 'This project has no luca.cli.ts'; return finishPlan(plan, false) }
	const edit = removeBorrow(before, String(req.id || ''))
	if ('error' in edit) { view.blocked = edit.error; return finishPlan(plan, false) }
	view.summary = 'Only the lines Luca Desktop added change.'
	view.files.push(plannedFile(cliPath, home, before, edit.text, edit.text === null ? 'only the borrowed block was in it' : undefined, cwd))
	writes.push({ path: cliPath, content: edit.text })
	return finishPlan(plan, false)
}

/** The folders this project borrows through the app's block. */
export function borrowedFolders(container: any) {
	const cwd = String(container.cwd)
	const home = String(container.feature('os').homedir)
	const fs = container.feature('fs')
	const text = read(container, container.paths.resolve(cwd, 'luca.cli.ts')) ?? ''
	return borrowEntries(text).map((e) => ({
		id: e.id,
		type: e.type,
		directory: e.directory,
		display: tildePath(e.directory, home),
		exists: fs.isDirectory(e.directory),
		helpers: [...helpersInFolder(container, e.type, e.directory).keys()],
	}))
}

function finishPlan(plan: Plan, overwrite: boolean): Plan {
	finish(plan.view, plan.writes, overwrite)
	return plan
}

export { applyPlan }
