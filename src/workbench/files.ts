/**
 * Plain files in the project folder, for the app's file tile: read one
 * (exact text and its digest), save one only when the file on disk is still
 * the one the app loaded, and list the folder's files for a picker. Every
 * path stays inside the project folder.
 */
import { readFileSync, writeFileSync, existsSync, statSync, readdirSync, realpathSync, mkdirSync } from 'node:fs'
import { join, resolve, relative, dirname, basename, sep, isAbsolute } from 'node:path'
import { digestOf, sizeText } from './docs.js'

/** The largest file the tile opens. */
export const MAX_FILE_BYTES = 2 * 1024 * 1024
/** How many paths `GET /files` lists at most. */
export const MAX_LISTED = 5000
/** Folders the list never walks into. */
export const SKIPPED_DIRS = new Set(['.git', 'node_modules', '.build', '.cache', '.next', 'dist', '.turbo', '.DS_Store'])

/** The shape of a doc view, so the app reads a file and a doc the same way. */
export type FileView = {
	id: string
	model: string
	slot: number
	title: string
	path: string
	pathDisplay: string
	file: string
	digest: string
	size: number
	sizeText: string
	fields: []
	/** True when there is no such file yet: a save makes it. */
	missing: boolean
}

/**
 * The absolute path of `rel` in `root`, or an error. Refuses an absolute
 * path, `..` out of the folder, and a link that leads out of it. Pure apart
 * from reading links.
 */
export function projectPath(root: string, rel: string): { path: string; rel: string } | { error: string } {
	const text = String(rel || '').trim()
	if (!text) return { error: 'path is required' }
	if (isAbsolute(text)) return { error: 'path is relative to the project folder' }
	const base = realpathSync(root)
	const full = resolve(base, text)
	const inside = (p: string) => p === base || p.startsWith(base + sep)
	if (!inside(full)) return { error: `${text} is outside the project folder` }
	// A link inside the folder may point out of it: follow what exists.
	let probe = full
	while (!existsSync(probe) && probe !== base) probe = dirname(probe)
	if (!inside(realpathSync(probe))) return { error: `${text} leads outside the project folder` }
	return { path: full, rel: relative(base, full) }
}

/** One file as the tile draws it. A missing file is an empty view (`missing`). */
export function fileView(root: string, rel: string): { status: number; body: any } {
	const at = projectPath(root, rel)
	if ('error' in at) return { status: 400, body: { error: at.error } }
	if (existsSync(at.path) && statSync(at.path).isDirectory()) return { status: 400, body: { error: `${at.rel} is a folder` } }
	const missing = !existsSync(at.path)
	const bytes = missing ? Buffer.alloc(0) : readFileSync(at.path)
	if (bytes.length > MAX_FILE_BYTES) return { status: 413, body: { error: `${at.rel} is ${sizeText(bytes.length)}; the file tile opens files up to ${sizeText(MAX_FILE_BYTES)}` } }
	if (bytes.subarray(0, 8000).includes(0)) return { status: 415, body: { error: `${at.rel} is a binary file` } }
	const view: FileView = {
		id: at.rel,
		model: '',
		slot: 0,
		title: basename(at.rel),
		path: at.path,
		pathDisplay: at.rel,
		file: bytes.toString('utf8'),
		digest: digestOf(bytes),
		size: bytes.length,
		sizeText: sizeText(bytes.length),
		fields: [],
		missing,
	}
	return { status: 200, body: view }
}

/**
 * Write `text` as the whole file, byte for byte, when the file on disk is
 * still the one with `digest` (a missing file has the digest of no bytes).
 * 409 with the file as it is now otherwise.
 */
export function saveFile(root: string, body: any): { status: number; body: any } {
	if (typeof body?.path !== 'string' || !body.path) return { status: 400, body: { error: 'path is required' } }
	if (typeof body?.text !== 'string') return { status: 400, body: { error: 'text is required' } }
	if (typeof body?.digest !== 'string' || !body.digest) return { status: 400, body: { error: 'digest is required (from GET /file)' } }
	const at = projectPath(root, body.path)
	if ('error' in at) return { status: 400, body: { error: at.error } }
	if (existsSync(at.path) && statSync(at.path).isDirectory()) return { status: 400, body: { error: `${at.rel} is a folder` } }
	const current = existsSync(at.path) ? readFileSync(at.path) : Buffer.alloc(0)
	if (digestOf(current) !== body.digest) {
		return { status: 409, body: { error: 'The file changed on disk since you opened it.', view: fileView(root, at.rel).body } }
	}
	if (existsSync(at.path) && digestOf(Buffer.from(body.text, 'utf8')) === body.digest) {
		return { status: 200, body: { ok: true, unchanged: true, view: fileView(root, at.rel).body } }
	}
	mkdirSync(dirname(at.path), { recursive: true })
	writeFileSync(at.path, body.text, 'utf8')
	return { status: 200, body: { ok: true, unchanged: false, view: fileView(root, at.rel).body, text: `Saved ${at.rel}` } }
}

/** The project's files, relative, sorted, skipping build and package folders. */
export function listFiles(root: string, limit = MAX_LISTED): { files: string[]; truncated: boolean } {
	const base = realpathSync(root)
	const files: string[] = []
	let truncated = false
	const walk = (dir: string) => {
		if (truncated) return
		let entries: import('node:fs').Dirent[]
		try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return }
		entries.sort((a, b) => a.name.localeCompare(b.name))
		for (const entry of entries) {
			if (SKIPPED_DIRS.has(entry.name)) continue
			const full = join(dir, entry.name)
			if (entry.isDirectory()) walk(full)
			else if (entry.isFile()) {
				if (files.length >= limit) { truncated = true; return }
				files.push(relative(base, full))
			}
		}
	}
	walk(base)
	return { files, truncated }
}
