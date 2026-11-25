/**
 * Reading and editing a project's `luca.cli.ts` for borrowed helpers. Pure
 * text in, text out, so it is tested without a disk.
 *
 * The CLI loads `luca.cli.ts` before it discovers the project's own
 * folders, and calls its exported `main(container)` (`loadCliModule` in
 * `src/cli/runner.ts`). A borrow is a `container.helpers.discover(type,
 * { directory })` call that `main` makes.
 *
 * The app owns one marked block:
 *
 *   // luca-desktop:borrowed:begin ...
 *   [export async function main(container: any) { ... }]   only when the file had no main
 *   async function lucaDesktopBorrowed(container: any) {
 *     await container.helpers.discover("commands", { directory: "/x/a/commands" })
 *   }
 *   // luca-desktop:borrowed:end
 *
 * When the file has its own `main`, the app adds one marked line as the
 * first statement of it instead: `await lucaDesktopBorrowed(container) //
 * luca-desktop:borrowed`. Nothing outside the block and that line changes.
 */

export const BLOCK_BEGIN = '// luca-desktop:borrowed:begin · Luca Desktop adds and removes the lines in this block. Edit outside it.'
export const BLOCK_END = '// luca-desktop:borrowed:end'
export const CALL_MARK = '// luca-desktop:borrowed'
export const BORROW_FN = 'lucaDesktopBorrowed'

const CALL_LINE_RE = /^.*\/\/ luca-desktop:borrowed[ \t]*$/m

export type BorrowEntry = { id: string; type: string; directory: string; line: string }

export type CliCall =
	| { kind: 'discover'; type: string; directory: string; managed: boolean }
	| { kind: 'usePlugin'; name: string; managed: boolean }

/** The block's position as line indexes (begin and end lines included), or null. */
function blockRange(lines: string[]): { begin: number; end: number } | null {
	const begin = lines.findIndex((l) => /^[ \t]*\/\/ luca-desktop:borrowed:begin\b/.test(l))
	if (begin < 0) return null
	const end = lines.findIndex((l, i) => i > begin && /^[ \t]*\/\/ luca-desktop:borrowed:end\b/.test(l))
	return end < 0 ? null : { begin, end }
}

const DISCOVER_LINE_RE = /^\s*await container\.helpers\.discover\((".*?"|'.*?'), \{ directory: (".*?") \}\)\s*;?\s*$/

/** The discover calls in the app's block. */
export function borrowEntries(text: string): BorrowEntry[] {
	const lines = text.split('\n')
	const range = blockRange(lines)
	if (!range) return []
	const out: BorrowEntry[] = []
	for (let i = range.begin + 1; i < range.end; i++) {
		const m = lines[i]!.match(DISCOVER_LINE_RE)
		if (!m) continue
		try {
			const type = m[1]!.startsWith('"') ? JSON.parse(m[1]!) : m[1]!.slice(1, -1)
			const directory = JSON.parse(m[2]!)
			out.push({ id: `${type}:${directory}`, type, directory, line: lines[i]! })
		} catch {}
	}
	return out
}

/**
 * Every literal `discover(type, { directory })` and `usePlugin(name)` in
 * the file, the app's and the user's, so origins can name them.
 */
export function parseCliFile(text: string): { calls: CliCall[] } {
	const lines = text.split('\n')
	const range = blockRange(lines)
	const calls: CliCall[] = []
	const discoverRe = /discover\(\s*(['"`])(\w+)\1\s*,\s*\{\s*directory\s*:\s*(['"`])([^'"`$]+)\3/g
	const pluginRe = /usePlugin\(\s*(['"`])([^'"`$]+)\1/g
	lines.forEach((line, i) => {
		if (/^\s*\/\//.test(line)) return
		const managed = !!range && i > range.begin && i < range.end
		for (const m of line.matchAll(discoverRe)) calls.push({ kind: 'discover', type: m[2]!, directory: m[4]!, managed })
		for (const m of line.matchAll(pluginRe)) calls.push({ kind: 'usePlugin', name: m[2]!, managed })
	})
	return { calls }
}

export function discoverLine(type: string, directory: string): string {
	return `\tawait container.helpers.discover(${JSON.stringify(type)}, { directory: ${JSON.stringify(directory)} })`
}

/** Where the user's own `main` body opens, and its parameter name. */
export type UserMain = { bodyOpen: number; param: string } | { unsupported: string } | null

/** Index just after the `)` that closes the `(` at `open`. */
function closeParen(text: string, open: number): number {
	let depth = 0
	for (let i = open; i < text.length; i++) {
		const c = text[i]
		if (c === '(') depth++
		else if (c === ')') { depth--; if (depth === 0) return i + 1 }
	}
	return -1
}

/**
 * Find the user's exported `main` (outside the app's block). `export
 * [async] function main(container…) {` and `export const main = [async]
 * (container…) => {` are read. Other forms are `unsupported`.
 */
export function findUserMain(text: string): UserMain {
	const fn = /export\s+(?:async\s+)?function\s+main\s*(?:<[^>]*>)?\s*\(/.exec(text)
	const arrow = /export\s+(?:const|let|var)\s+main\s*(?::[^=]+)?=\s*(?:async\s*)?\(/.exec(text)
	const m = fn || arrow
	if (!m) {
		if (/export\s*\{[^}]*\bmain\b[^}]*\}/.test(text) || /export\s+(?:const|let|var)\s+main\b/.test(text)) {
			return { unsupported: 'luca.cli.ts exports main in a form the app cannot edit' }
		}
		return null
	}
	const open = m.index + m[0].length - 1
	const close = closeParen(text, open)
	if (close < 0) return { unsupported: 'could not read main(): unbalanced parentheses' }
	const param = text.slice(open + 1, close - 1).trim().match(/^([A-Za-z_$][\w$]*)/)?.[1]
	if (!param) return { unsupported: 'main() takes no container parameter; add one, or call lucaDesktopBorrowed(container) yourself' }
	let rest = text.slice(close)
	let offset = close
	if (arrow && !fn) {
		const a = rest.indexOf('=>')
		if (a < 0) return { unsupported: 'could not read main()' }
		offset += a + 2
		rest = text.slice(offset)
		if (!/^\s*\{/.test(rest)) return { unsupported: 'main is an arrow function without a { } body' }
	}
	// Skip a return type annotation (`: Promise<void>`) up to the body's `{`.
	const brace = rest.indexOf('{')
	if (brace < 0) return { unsupported: 'could not find the body of main()' }
	return { bodyOpen: offset + brace, param }
}

export type CliEdit = { text: string; mainMode: 'block' | 'user' } | { error: string }

/** The file with the block removed (and our call line), for reading the user's part. */
function withoutBlock(text: string): string {
	const lines = text.split('\n')
	const range = blockRange(lines)
	const kept = range ? [...lines.slice(0, range.begin), ...lines.slice(range.end + 1)] : lines
	return kept.filter((l) => !CALL_LINE_RE.test(l)).join('\n')
}

function blockText(entries: Array<{ type: string; directory: string }>, withMain: boolean): string[] {
	const out = [BLOCK_BEGIN]
	if (withMain) out.push('export async function main(container: any) {', `\tawait ${BORROW_FN}(container)`, '}', '')
	out.push(`async function ${BORROW_FN}(container: any) {`)
	for (const e of entries) out.push(discoverLine(e.type, e.directory))
	out.push('}', BLOCK_END)
	return out
}

/**
 * `text` (null: no file yet) with one more borrowed folder. The user's own
 * lines stay as they are: the block is replaced in place or added at the
 * end, and a file with its own `main` gets one marked call line in it.
 */
export function addBorrow(text: string | null, type: string, directory: string): CliEdit {
	const source = text ?? ''
	const entries = borrowEntries(source)
	if (entries.some((e) => e.type === type && e.directory === directory)) return { error: `${type} from ${directory} is borrowed already` }
	const next = [...entries, { type, directory }]

	const userMain = findUserMain(withoutBlock(source))
	if (userMain && 'unsupported' in userMain) return { error: userMain.unsupported }
	const lines = source.split('\n')
	const range = blockRange(lines)
	const hasCall = CALL_LINE_RE.test(source)

	// Does our block carry main? Only when the user's part has none.
	const blockMain = !userMain
	const block = blockText(next, blockMain)
	let out: string[]
	if (range) {
		out = [...lines.slice(0, range.begin), ...block, ...lines.slice(range.end + 1)]
	} else if (!text || !source.trim()) {
		out = [...block, '']
	} else {
		const body = source.endsWith('\n') ? lines.slice(0, -1) : lines
		out = [...body, '', ...block, '']
	}
	let result = out.join('\n')

	if (userMain && !hasCall) {
		const found = findUserMain(result)
		if (!found || 'unsupported' in found) return { error: 'could not find main() again after the edit' }
		// One new line right after `{`, indented like the next line.
		const after = result.slice(found.bodyOpen + 1)
		const indent = after.match(/^[^\n]*\n([ \t]+)\S/)?.[1] ?? '\t'
		result = result.slice(0, found.bodyOpen + 1) + `\n${indent}await ${BORROW_FN}(${found.param}) ${CALL_MARK}` + after
	}
	return { text: result, mainMode: blockMain ? 'block' : 'user' }
}

/**
 * `text` without one borrowed folder. When none are left the block and the
 * call line go, and the result is null if nothing else was in the file
 * (the app made it), so the file can be deleted.
 */
export function removeBorrow(text: string, id: string): { text: string | null } | { error: string } {
	const entries = borrowEntries(text)
	if (!entries.some((e) => e.id === id)) return { error: `no borrowed folder ${id} in luca.cli.ts` }
	const next = entries.filter((e) => e.id !== id)
	const lines = text.split('\n')
	const range = blockRange(lines)!
	if (next.length) {
		const hadMain = lines.slice(range.begin, range.end).some((l) => /^export\s+async\s+function\s+main\b/.test(l))
		const block = blockText(next, hadMain)
		return { text: [...lines.slice(0, range.begin), ...block, ...lines.slice(range.end + 1)].join('\n') }
	}
	// Drop the block, a blank line the add put before it, and our call line.
	let start = range.begin
	if (start > 0 && lines[start - 1]!.trim() === '') start--
	const kept = [...lines.slice(0, start), ...lines.slice(range.end + 1)].filter((l) => !CALL_LINE_RE.test(l))
	let result = kept.join('\n')
	if (!result.trim()) return { text: null }
	if (text.endsWith('\n') && !result.endsWith('\n')) result += '\n'
	return { text: result }
}
