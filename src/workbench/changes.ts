/**
 * The shape every write the workbench makes goes through: a plan the app
 * shows first (files with their diffs, clashes, notes), then the same plan
 * applied when the user confirms. The plan's `digest` covers what would be
 * written, so an apply after the files changed is refused.
 */
import { createHash } from 'node:crypto'
import { displayPath } from './origins.js'

export type DiffLine = { kind: 'add' | 'del' | 'same' | 'gap'; text: string }

export type PlannedFile = {
	path: string
	/** `~/x/b/features/counter.ts`. */
	display: string
	action: 'create' | 'overwrite' | 'edit' | 'delete' | 'link' | 'same'
	/** For a link: what it points at. */
	target?: string
	lines: DiffLine[]
	added: number
	removed: number
	note?: string
}

export type PlannedImport = {
	/** As written in the source: `./util`. */
	spec: string
	/** The file that imports it. */
	from: string
	path: string
	display: string
	/** `create`: copied on a yes; `same`: already there; `clash`: there and different; `outside`: not copied. */
	action: 'create' | 'same' | 'clash' | 'outside'
	note?: string
}

export type ChangeView = {
	op: string
	title: string
	summary: string
	/** True when apply would write. */
	ok: boolean
	/** Why it cannot be applied, even with overwrite. */
	blocked: string | null
	/** Clashes: a write over something that exists. `overwrite: true` accepts them. */
	clashes: string[]
	/** True when clashes block until `overwrite: true`. */
	needsOverwrite: boolean
	notes: string[]
	files: PlannedFile[]
	imports: PlannedImport[]
	/** What a borrow brings: every helper of that type in the folder. */
	helpers: string[]
	digest: string
}

/** What apply does: write content (null deletes), or make a link. */
export type Write =
	| { path: string; content: string | null }
	| { path: string; link: string }

export type Plan = { view: ChangeView; writes: Write[]; allowedRoots: string[] }

const MAX_DIFF_LINES = 400
const CONTEXT = 3

/** A line diff (LCS), trimmed to changed lines with a little context. */
export function diffLines(before: string | null, after: string | null): { lines: DiffLine[]; added: number; removed: number } {
	const a = before === null ? [] : splitLines(before)
	const b = after === null ? [] : splitLines(after)
	const n = a.length, m = b.length
	// LCS table, sized for config files and helper sources.
	const dp: Uint32Array[] = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1))
	for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) {
		dp[i]![j] = a[i] === b[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!)
	}
	const all: DiffLine[] = []
	let i = 0, j = 0
	while (i < n && j < m) {
		if (a[i] === b[j]) { all.push({ kind: 'same', text: a[i]! }); i++; j++ }
		else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) { all.push({ kind: 'del', text: a[i]! }); i++ }
		else { all.push({ kind: 'add', text: b[j]! }); j++ }
	}
	while (i < n) all.push({ kind: 'del', text: a[i++]! })
	while (j < m) all.push({ kind: 'add', text: b[j++]! })
	const added = all.filter((l) => l.kind === 'add').length
	const removed = all.filter((l) => l.kind === 'del').length

	// Keep changed lines and CONTEXT lines around them; a run of kept-out lines becomes one gap.
	const keep = all.map((l) => l.kind !== 'same')
	const near = keep.map((_, k) => {
		for (let d = -CONTEXT; d <= CONTEXT; d++) if (keep[k + d]) return true
		return false
	})
	const lines: DiffLine[] = []
	let skipped = 0
	all.forEach((l, k) => {
		if (near[k]) {
			if (skipped) { lines.push({ kind: 'gap', text: `${skipped} unchanged line${skipped === 1 ? '' : 's'}` }); skipped = 0 }
			lines.push(l)
		} else skipped++
	})
	if (skipped) lines.push({ kind: 'gap', text: `${skipped} unchanged line${skipped === 1 ? '' : 's'}` })
	if (lines.length > MAX_DIFF_LINES) {
		const more = lines.length - MAX_DIFF_LINES
		lines.length = MAX_DIFF_LINES
		lines.push({ kind: 'gap', text: `${more} more lines` })
	}
	return { lines, added, removed }
}

function splitLines(text: string): string[] {
	if (text === '') return []
	const lines = text.split('\n')
	if (lines[lines.length - 1] === '') lines.pop()
	return lines
}

export function plannedFile(path: string, home: string, before: string | null, after: string | null, note?: string, root?: string): PlannedFile {
	const { lines, added, removed } = diffLines(before, after)
	const action: PlannedFile['action'] = after === null ? 'delete' : before === null ? 'create' : before === after ? 'same' : 'edit'
	return { path, display: displayPath(path, home, root), action, lines, added, removed, ...(note ? { note } : {}) }
}

export function digestOf(writes: Write[], extra: unknown = null): string {
	const h = createHash('sha256')
	for (const w of writes) h.update(JSON.stringify(w)).update('\0')
	h.update(JSON.stringify(extra))
	return h.digest('hex').slice(0, 16)
}

export function emptyView(op: string, title: string): ChangeView {
	return { op, title, summary: '', ok: false, blocked: null, clashes: [], needsOverwrite: false, notes: [], files: [], imports: [], helpers: [], digest: '' }
}

/** Fill `ok`, `needsOverwrite` and `digest` once a plan's parts are known. */
export function finish(view: ChangeView, writes: Write[], overwrite: boolean): ChangeView {
	view.needsOverwrite = view.clashes.length > 0 && !overwrite
	view.ok = !view.blocked && !view.needsOverwrite && writes.length > 0
	if (!view.blocked && writes.length === 0 && view.clashes.length === 0) view.blocked = 'Nothing to write: it is there already'
	view.digest = digestOf(writes, { overwrite })
	return view
}

/**
 * Write a plan. Every path must sit inside one of the plan's allowed roots
 * (the receiving project, or the plugins folder for a link), so nothing
 * else on disk, and never the source project, can change.
 */
export function applyPlan(container: any, plan: Plan): string[] {
	const fs = container.feature('fs')
	const inside = (path: string) => plan.allowedRoots.some((root) => path === root || path.startsWith(root.replace(/\/+$/, '') + '/'))
	for (const w of plan.writes) {
		if (!w.path.startsWith('/') || w.path.split('/').includes('..') || !inside(w.path)) throw new Error(`refusing to write outside the receiving project: ${w.path}`)
	}
	const done: string[] = []
	for (const w of plan.writes) {
		if ('link' in w) {
			fs.symlink(w.link, w.path)
		} else if (w.content === null) {
			if (fs.exists(w.path)) fs.rmSync(w.path)
		} else {
			fs.ensureFolder(container.paths.dirname(w.path))
			fs.writeFile(w.path, w.content)
		}
		done.push(w.path)
	}
	return done
}

// --- .env ---

const PLUGINS_LINE = /^LUCA_PLUGINS=(.*)$/m

/** The entries of the `LUCA_PLUGINS=` line, or null when there is no such line. */
export function envPlugins(text: string | null): string[] | null {
	const m = (text ?? '').match(PLUGINS_LINE)
	if (!m) return null
	return unquote(m[1]!).split(',').map((s) => s.trim()).filter(Boolean)
}

function unquote(value: string): string {
	const v = value.trim()
	return (v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")) ? v.slice(1, -1) : v.replace(/\s+#.*$/, '')
}

/**
 * `.env` text with the `LUCA_PLUGINS` line set to `entries`. Only that line
 * changes: it is replaced in place, added at the end, or (no entries left)
 * removed. Null text means no file yet.
 */
export function setEnvPlugins(text: string | null, entries: string[]): string {
	const source = text ?? ''
	const line = `LUCA_PLUGINS=${entries.join(',')}`
	if (PLUGINS_LINE.test(source)) {
		if (entries.length) return source.replace(PLUGINS_LINE, line)
		return source.replace(/^LUCA_PLUGINS=.*(?:\n|$)/m, '')
	}
	if (!entries.length) return source
	return source + (source && !source.endsWith('\n') ? '\n' : '') + line + '\n'
}
