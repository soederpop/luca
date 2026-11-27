/**
 * The assistant editor: one assistant's folder (CORE.md, tools.ts, hooks.ts
 * and every other file in it) for the app's assistant tile, and the brief
 * and tools a chat gets when it is opened *about* an assistant.
 *
 * - `view(name)` is the tile: the files (the definition files first, present
 *   or not), the hooks the runtime fires and which of them `hooks.ts`
 *   exports, the container features that have tools and which the `use`
 *   array already names, and whether the folder may be written.
 * - A project or home assistant is editable. One a plugin provides (`extra`)
 *   is read only here: `copyIn` puts a copy under the project's `assistants/`,
 *   and that copy wins the name.
 * - A save of a `.ts` file is parse-checked in the vm first (a file that does
 *   not load is refused and the one on disk stays), the old file goes to
 *   `.history/`, and every live instance of the assistant reloads.
 * - `addHook` and `useFeature` are pure edits of the text the editor holds:
 *   the tile puts the answer in its buffer and the human saves.
 *
 * Shapes are pure and tested (`test/workbench-assistant-editor.test.ts`).
 */
import { existsSync, readFileSync, readdirSync, statSync, mkdirSync, writeFileSync, cpSync, rmSync, realpathSync } from 'node:fs'
import { join, relative, basename, extname, dirname } from 'node:path'
import { z } from 'zod'
import { digestOf, sizeText } from './docs.js'
import { projectPath, fileView, saveFile } from './files.js'
import type { ToolBundle } from './extensions.js'

/** The files every assistant may have, in the order the tile lists them. */
export const DEFINITION_FILES = ['CORE.md', 'ABOUT.md', 'tools.ts', 'hooks.ts', 'voice.yml'] as const

/** Folders the file list never walks into. `.history` holds the editor's own backups. */
const SKIPPED = new Set(['.history', 'node_modules', '.git', '.DS_Store', '.luca-desktop-build'])

/** The most of one file that goes into a chat's brief. */
export const BRIEF_FILE_LIMIT = 24_000

export type FileEntry = {
	path: string
	/** `definition` for the five known files, `skill` under `skills/`, `guide` under `guides/`, else `other`. */
	kind: 'definition' | 'skill' | 'guide' | 'other'
	language: string
	present: boolean
	size: number
	sizeText: string
}

export type HookInfo = {
	name: string
	/** `lifecycle` hooks run at a point of the assistant's life; `event` hooks mirror a conversation event. */
	kind: 'lifecycle' | 'event'
	/** The parameters after `assistant`, as TypeScript. Empty for none. */
	params: string
	description: string
	/** What a return value does, when it does anything. */
	returns?: string
	present: boolean
	/** The line `hooks.ts` defines it on, 1-based. */
	line?: number
}

/**
 * Every hook `assistant.ts` fires (`triggerHook('<name>', ...)`). An export
 * of that name in `hooks.ts` is called as `(assistant, ...params)`. The
 * test checks this list against the source, so a new hook shows up here.
 */
export const HOOKS: ReadonlyArray<Omit<HookInfo, 'present' | 'line'>> = [
	{ name: 'created', kind: 'lifecycle', params: '', description: 'Right after the prompt, tools and hooks are loaded, before start().' },
	{ name: 'beforeStart', kind: 'lifecycle', params: '', description: 'start() began: the tools are resolved, the conversation does not exist yet.' },
	{ name: 'formatSystemPrompt', kind: 'lifecycle', params: 'prompt: string', description: 'The system prompt before the conversation is created.', returns: 'Return a string to replace the prompt.' },
	{ name: 'started', kind: 'lifecycle', params: '', description: 'The conversation exists. The usual place for assistant.use(...) and addSystemPromptExtension(...).' },
	{ name: 'afterStart', kind: 'lifecycle', params: '', description: 'start() is done.' },
	{ name: 'beforeInitialAsk', kind: 'lifecycle', params: 'question: string | any[], options?: any', description: 'The first ask() of this instance, before beforeAsk.' },
	{ name: 'beforeAsk', kind: 'lifecycle', params: 'question: string | any[], options?: any', description: 'Every ask().', returns: 'Return a string to replace the question.' },
	{ name: 'beforeToolCall', kind: 'lifecycle', params: 'ctx: { name: string, args: Record<string, any>, result?: string, skip?: boolean }', description: 'A tool is about to run. Set ctx.skip = true and ctx.result to answer it yourself; change ctx.args to change the call.' },
	{ name: 'afterToolCall', kind: 'lifecycle', params: 'ctx: { name: string, args: Record<string, any>, result?: string, error?: any }', description: 'A tool returned or failed. Change ctx.result to change what the model sees.' },
	{ name: 'answered', kind: 'lifecycle', params: 'result: string', description: 'ask() has its final answer, saved to history.' },
	{ name: 'stopped', kind: 'lifecycle', params: '', description: 'stop(): close servers, child processes and timers here.' },
	{ name: 'turnStart', kind: 'event', params: 'info: { turn: number, isFollowUp: boolean }', description: 'A completion turn begins. isFollowUp is true after tool calls.' },
	{ name: 'turnEnd', kind: 'event', params: 'info: { turn: number, hasToolCalls: boolean }', description: 'A completion turn ends.' },
	{ name: 'chunk', kind: 'event', params: 'text: string', description: 'A chunk of streamed answer text.' },
	{ name: 'reasoning', kind: 'event', params: 'text: string', description: 'A chunk of streamed thinking, when the provider gives it.' },
	{ name: 'preview', kind: 'event', params: 'text: string', description: 'The answer so far, whole.' },
	{ name: 'response', kind: 'event', params: 'text: string', description: 'The complete answer of a turn.' },
	{ name: 'rawEvent', kind: 'event', params: 'event: any', description: 'A raw streaming event of the model API.' },
	{ name: 'mcpEvent', kind: 'event', params: 'event: any', description: 'An MCP streaming event (Responses API MCP tools).' },
	{ name: 'toolCall', kind: 'event', params: 'name: string, args: any', description: 'A tool was called.' },
	{ name: 'toolResult', kind: 'event', params: 'name: string, result: any', description: 'A tool returned.' },
	{ name: 'toolError', kind: 'event', params: 'name: string, error: any', description: 'A tool threw.' },
	{ name: 'steerQueued', kind: 'event', params: 'content: any', description: 'steer() accepted a message for the turn in flight.' },
	{ name: 'steered', kind: 'event', params: 'content: any', description: 'A steer went into the history as a user message.' },
	{ name: 'visionDescription', kind: 'event', params: 'info: { index: number, description: string, model: string, batch?: boolean, count?: number }', description: 'The vision model described an image.' },
]

const HOOK_IMPORT = "import type { Assistant } from 'luca/agi'"

/** The hook exports of a `hooks.ts` and the line each is on. Pure. */
export function definedHooks(source: string): Map<string, number> {
	const out = new Map<string, number>()
	const lines = source.split('\n')
	lines.forEach((line, i) => {
		const m = /^export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/.exec(line)
			|| /^export\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/.exec(line)
		if (m && !out.has(m[1]!)) out.set(m[1]!, i + 1)
	})
	return out
}

/** The hooks, marked with what `hooks.ts` defines. Pure. */
export function hookList(hooksSource: string | null): HookInfo[] {
	const defined = hooksSource == null ? new Map<string, number>() : definedHooks(hooksSource)
	return HOOKS.map((h) => ({ ...h, present: defined.has(h.name), ...(defined.has(h.name) ? { line: defined.get(h.name) } : {}) }))
}

/** The stub for one hook. Pure. */
export function hookStub(hook: Omit<HookInfo, 'present' | 'line'>): string {
	const params = hook.params ? `_assistant: Assistant, ${hook.params}` : '_assistant: Assistant'
	const notes = [hook.description, hook.returns].filter(Boolean).map((t) => `\t// ${t}`)
	return [`export async function ${hook.name}(${params}) {`, ...notes, '}', ''].join('\n')
}

/**
 * `hooks.ts` with a stub for `name` appended (and the Assistant type import
 * when missing). A hook already there is left alone. Pure. Answers the new
 * text and the line the hook starts on.
 */
export function addHook(source: string, name: string): { text: string; line: number } | { error: string } {
	const hook = HOOKS.find((h) => h.name === name)
	if (!hook) return { error: `No hook named ${name}. Hooks: ${HOOKS.map((h) => h.name).join(', ')}` }
	const defined = definedHooks(source)
	if (defined.has(name)) return { text: source, line: defined.get(name)! }
	let text = source
	if (!/^import\s+type\s+\{[^}]*\bAssistant\b[^}]*\}\s+from\s+['"]luca\/agi['"]/m.test(text) && !/^import\s+\{[^}]*\bAssistant\b/m.test(text)) {
		text = text.trim() ? `${HOOK_IMPORT}\n${text.startsWith('\n') ? '' : '\n'}${text}` : `${HOOK_IMPORT}\n`
	}
	if (!text.endsWith('\n')) text += '\n'
	if (text.trim()) text += '\n'
	const line = text.split('\n').length
	return { text: text + hookStub(hook), line }
}

/** One entry of the `use` array in `tools.ts`. */
export type UseEntry = {
	/** The feature name, or null for an entry that is not `container.feature('x')` (such as `container.describer`). */
	feature: string | null
	only?: string[]
	text: string
	line: number
}

/** The `export const use = [` block: its text bounds, or null. Pure. */
function useBlock(source: string): { start: number; end: number } | null {
	const m = /^export\s+const\s+use(?:\s*:\s*[^=]+)?\s*=\s*\[/m.exec(source)
	if (!m) return null
	const start = m.index + m[0].length
	let depth = 1
	let i = start
	let quote: string | null = null
	for (; i < source.length; i++) {
		const c = source[i]!
		if (quote) {
			if (c === '\\') i++
			else if (c === quote) quote = null
			continue
		}
		if (c === "'" || c === '"' || c === '`') quote = c
		else if (c === '[' || c === '(' || c === '{') depth++
		else if (c === ']' || c === ')' || c === '}') { depth--; if (depth === 0) break }
	}
	if (depth !== 0) return null
	return { start, end: i }
}

/** Split the inside of an array literal on top-level commas. Pure. */
function splitTopLevel(text: string): Array<{ text: string; offset: number }> {
	const out: Array<{ text: string; offset: number }> = []
	let depth = 0
	let quote: string | null = null
	let from = 0
	for (let i = 0; i < text.length; i++) {
		const c = text[i]!
		if (quote) {
			if (c === '\\') i++
			else if (c === quote) quote = null
			continue
		}
		if (c === "'" || c === '"' || c === '`') quote = c
		else if (c === '[' || c === '(' || c === '{') depth++
		else if (c === ']' || c === ')' || c === '}') depth--
		else if (c === ',' && depth === 0) { out.push({ text: text.slice(from, i), offset: from }); from = i + 1 }
	}
	out.push({ text: text.slice(from), offset: from })
	return out.map((e) => {
		// Comments above an entry stay with it, but the entry's own text starts at its code.
		const stripped = e.text.replace(/^(\s*\/\/[^\n]*\n|\s*\/\*[\s\S]*?\*\/\s*|\s+)+/, '')
		return { text: stripped.trim(), offset: e.offset + (e.text.length - stripped.length) }
	}).filter((e) => e.text)
}

/** The entries of the `use` array, with the feature each names. Pure. */
export function useEntries(source: string): UseEntry[] {
	const block = useBlock(source)
	if (!block) return []
	const inside = source.slice(block.start, block.end)
	return splitTopLevel(inside).map((e) => {
		const feature = /^container\.feature\(\s*['"]([^'"]+)['"]/.exec(e.text)?.[1] ?? null
		const only = /only\s*:\s*\[([^\]]*)\]/.exec(e.text)?.[1]
		const list = only == null ? undefined : only.split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean)
		const line = source.slice(0, block.start + e.offset).split('\n').length
		return { feature, ...(list ? { only: list } : {}), text: e.text.replace(/\s+/g, ' '), line }
	})
}

/** The tool names `export const schemas = { ... }` declares. Pure. */
export function ownTools(source: string): string[] {
	const m = /^export\s+const\s+schemas(?:\s*:\s*[^=]+)?\s*=\s*\{/m.exec(source)
	if (!m) return []
	const start = m.index + m[0].length
	let depth = 1
	let i = start
	let quote: string | null = null
	for (; i < source.length; i++) {
		const c = source[i]!
		if (quote) { if (c === '\\') i++; else if (c === quote) quote = null; continue }
		if (c === "'" || c === '"' || c === '`') quote = c
		else if (c === '{' || c === '(' || c === '[') depth++
		else if (c === '}' || c === ')' || c === ']') { depth--; if (depth === 0) break }
	}
	const inside = source.slice(start, i)
	const names: string[] = []
	for (const entry of splitTopLevel(inside)) {
		const key = /^([A-Za-z_$][\w$]*)\s*:/.exec(entry.text)?.[1] || /^['"]([^'"]+)['"]\s*:/.exec(entry.text)?.[1]
		if (key) names.push(key)
	}
	return names
}

const tsQuote = (s: string) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`

/** `container.feature('x', {...}).toTools({ only: [...] })` for one entry. Pure. */
export function useExpression(entry: { feature: string; only?: string[]; options?: Record<string, unknown> }): string {
	const options = entry.options && Object.keys(entry.options).length ? `, ${JSON.stringify(entry.options).replace(/"([A-Za-z_$][\w$]*)":/g, '$1: ').replace(/"/g, "'")}` : ''
	const only = entry.only?.length ? `{ only: [${entry.only.map(tsQuote).join(', ')}] }` : ''
	return `container.feature(${tsQuote(entry.feature)}${options}).toTools(${only})`
}

/** `tools.ts` with no tools yet. */
export const EMPTY_TOOLS = "import { z } from 'zod'\n\nexport const schemas = {}\n"

/**
 * `tools.ts` with `feature` in its `use` array: the entry replaces one that
 * names the same feature, else goes last; a file with no `use` gets one.
 * `remove` takes the feature's entry out instead. Pure.
 */
export function useFeature(source: string, entry: { feature: string; only?: string[]; options?: Record<string, unknown>; remove?: boolean }): { text: string; line: number } {
	const base = source.trim() ? source : EMPTY_TOOLS
	const block = useBlock(base)
	const expression = useExpression(entry)
	if (!block) {
		if (entry.remove) return { text: base, line: 1 }
		let text = base
		if (!text.endsWith('\n')) text += '\n'
		text += `\nexport const use = [\n\t${expression},\n]\n`
		return { text, line: text.split('\n').length - 2 }
	}
	const inside = base.slice(block.start, block.end)
	const entries = splitTopLevel(inside)
	const existing = entries.find((e) => new RegExp(`^container\\.feature\\(\\s*['"]${entry.feature.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`).test(e.text))
	if (existing) {
		// Replace the entry's code (comments above it stay), or cut it with its comma.
		const from = block.start + existing.offset
		const to = from + rawLength(inside, existing.offset)
		if (entry.remove) {
			let cutFrom = from
			let cutTo = to
			// Take the trailing comma and the line's newline with it.
			if (base[cutTo] === ',') cutTo++
			while (cutTo < base.length && (base[cutTo] === ' ' || base[cutTo] === '\t')) cutTo++
			if (base[cutTo] === '\n') cutTo++
			while (cutFrom > 0 && (base[cutFrom - 1] === ' ' || base[cutFrom - 1] === '\t')) cutFrom--
			const text = base.slice(0, cutFrom) + base.slice(cutTo)
			return { text, line: base.slice(0, cutFrom).split('\n').length }
		}
		const text = base.slice(0, from) + expression + base.slice(to)
		return { text, line: base.slice(0, from).split('\n').length }
	}
	if (entry.remove) return { text: base, line: base.slice(0, block.start).split('\n').length }
	// Add before the closing bracket, on its own line, with the indent the block uses.
	const indent = /\n([ \t]+)\S/.exec(inside)?.[1] ?? '\t'
	const trimmedInside = inside.replace(/\s+$/, '')
	const needsComma = trimmedInside.trim() !== '' && !trimmedInside.endsWith(',')
	const text = base.slice(0, block.start) + trimmedInside + (needsComma ? ',' : '') + `\n${indent}${expression},\n` + base.slice(block.end)
	return { text, line: (base.slice(0, block.start) + trimmedInside).split('\n').length + 1 }
}

/** The length of an entry's code from `offset` in the array's text, without its trailing comment or whitespace. */
function rawLength(inside: string, offset: number): number {
	let depth = 0
	let quote: string | null = null
	let i = offset
	for (; i < inside.length; i++) {
		const c = inside[i]!
		if (quote) { if (c === '\\') i++; else if (c === quote) quote = null; continue }
		if (c === "'" || c === '"' || c === '`') quote = c
		else if (c === '[' || c === '(' || c === '{') depth++
		else if (c === ']' || c === ')' || c === '}') depth--
		else if (c === ',' && depth === 0) break
	}
	return inside.slice(offset, i).replace(/\s+$/, '').length
}

/** The editor's language for a file. */
export function languageOf(path: string): string {
	switch (extname(path).toLowerCase()) {
		case '.yml': case '.yaml': return 'yaml'
		case '.ts': case '.tsx': case '.mts': return 'typescript'
		case '.js': case '.jsx': case '.mjs': case '.cjs': return 'javascript'
		case '.json': return 'json'
		case '.md': case '.markdown': return 'markdown'
		case '.css': return 'css'
		case '.html': case '.htm': return 'html'
		case '.py': return 'python'
		default: return 'text'
	}
}

/** The files of an assistant folder: the definition files first (present or not), then the rest, sorted. Pure apart from reading the folder. */
export function fileList(folder: string, limit = 2000): FileEntry[] {
	const out: FileEntry[] = []
	const entry = (rel: string, kind: FileEntry['kind']): FileEntry => {
		const full = join(folder, rel)
		const present = existsSync(full) && statSync(full).isFile()
		const size = present ? statSync(full).size : 0
		return { path: rel, kind, language: languageOf(rel), present, size, sizeText: present ? sizeText(size) : '' }
	}
	for (const name of DEFINITION_FILES) out.push(entry(name, 'definition'))
	const known = new Set<string>(DEFINITION_FILES)
	const walk = (dir: string) => {
		let names: string[]
		try { names = readdirSync(dir) } catch { return }
		names.sort((a, b) => a.localeCompare(b))
		for (const name of names) {
			if (SKIPPED.has(name) || name.startsWith('.staged-')) continue
			const full = join(dir, name)
			let stat
			try { stat = statSync(full) } catch { continue }
			if (stat.isDirectory()) { walk(full); continue }
			if (!stat.isFile()) continue
			const rel = relative(folder, full)
			if (known.has(rel)) continue
			if (out.length >= limit) return
			const kind: FileEntry['kind'] = rel.startsWith('skills/') ? 'skill' : rel.startsWith('guides/') ? 'guide' : 'other'
			out.push(entry(rel, kind))
		}
	}
	if (existsSync(folder)) walk(folder)
	return out
}

/** The first paragraph of a file's text, for a one-line summary. Pure. */
export function firstParagraph(text: string): string {
	return text.replace(/^---[\s\S]*?\n---\s*/, '').replace(/^#.*$/gm, '').trim().split(/\n\s*\n/)[0]?.trim() ?? ''
}

/** Code fenced for a brief, cut at `limit` with a note. Pure. */
export function fenced(path: string, text: string, limit = BRIEF_FILE_LIMIT): string {
	const lang = languageOf(path) === 'text' ? '' : languageOf(path)
	let body = text
	let note = ''
	if (body.length > limit) {
		body = body.slice(0, limit)
		note = `\n(${path} goes on past this point; this is the first ${limit} characters.)`
	}
	const fence = body.includes('```') ? '````' : '```'
	return `**${path}**\n\n${fence}${lang}\n${body.replace(/\n$/, '')}\n${fence}${note}`
}

export type ProviderInfo = {
	name: string
	description: string
	tools: Array<{ name: string; description: string }>
	/** The `use` entry that names it, when `tools.ts` has one. */
	used: boolean
	only?: string[]
}

export type AssistantEditorView = {
	name: string
	folder: string
	folderDisplay: string
	source: 'project' | 'home' | 'extra' | 'registered'
	editable: boolean
	/** Why writes are refused, when they are. */
	readOnly: string | null
	description: string
	modelText: string
	/** Every tool the assistant has when it starts, as the host last saw it. */
	tools: string[]
	/** The tool names `tools.ts` declares itself. */
	ownTools: string[]
	use: UseEntry[]
	files: FileEntry[]
	hooks: HookInfo[]
	providers: ProviderInfo[]
	/** Backups in `.history/`, newest first. */
	history: string[]
	/** Same-named folders this one hides. */
	shadows: string[]
	error: string | null
}

/** What the editor needs from the chat sessions. */
export type AssistantEditorHost = {
	manager(): Promise<any>
	/** A fact-reading instance of the assistant (never asked anything), or null when it cannot be made. */
	infoInstance(name: string): any | null
	/** The assistant's files changed: live instances load them again. */
	reloadAssistant(name: string): void
	/** Container features with tools, for the providers list. */
	providers(): Array<{ name: string; description: string; tools: Array<{ name: string; description: string }> }>
}

export class AssistantEditor {
	constructor(private container: any, private host: AssistantEditorHost, private broadcast: (frame: any) => void = () => {}) {}

	private tilde(path: string): string {
		const home = String(this.container.feature('os').homedir)
		return path.startsWith(home + '/') ? '~' + path.slice(home.length) : path
	}

	private async entry(name: string): Promise<any | null> {
		const manager = await this.host.manager()
		await manager.discover()
		return manager.get(name) ?? null
	}

	/** Why a folder may not be written here, or null when it may. */
	static readOnlyReason(entry: { source: string; folder?: string }, tilde: (p: string) => string): string | null {
		if (entry.source === 'registered') return 'This assistant is registered at runtime by code, not a folder. There is nothing to edit.'
		if (entry.source === 'extra') return `This assistant comes from a plugin (${tilde(entry.folder || '')}). Every project that loads the plugin would change with it, so it is read only here. Copy it into this project to edit your own version.`
		return null
	}

	async view(name: string): Promise<{ status: number; body: any }> {
		const entry = await this.entry(name)
		if (!entry) return { status: 404, body: { error: `no assistant ${name}` } }
		const folder: string = entry.folder || ''
		const readOnly = AssistantEditor.readOnlyReason(entry, (p) => this.tilde(p))
		const files = folder ? fileList(folder) : []
		const read = (rel: string): string | null => {
			const full = join(folder, rel)
			try { return existsSync(full) ? readFileSync(full, 'utf8') : null } catch { return null }
		}
		const toolsSource = folder ? read('tools.ts') : null
		const hooksSource = folder ? read('hooks.ts') : null
		const use = toolsSource ? useEntries(toolsSource) : []
		const usedBy = new Map(use.filter((u) => u.feature).map((u) => [u.feature!, u]))
		let tools: string[] = []
		let modelText = 'default model'
		let error: string | null = null
		const instance = this.host.infoInstance(name)
		if (instance) {
			try {
				tools = Object.keys(instance.tools || {})
				const r = instance.routing
				modelText = [r?.provider, r?.model].filter(Boolean).join(' · ') || modelText
			} catch (err: any) { error = String(err?.message ?? err) }
		} else {
			error = 'Could not load the assistant. Its tools.ts or hooks.ts may not parse; see the host log.'
		}
		const providers: ProviderInfo[] = this.host.providers().map((p) => {
			const u = usedBy.get(p.name)
			return { ...p, used: !!u, ...(u?.only ? { only: u.only } : {}) }
		})
		const about = typeof entry.about === 'string' ? firstParagraph(entry.about) : ''
		const history = folder && existsSync(join(folder, '.history')) ? readdirSync(join(folder, '.history')).sort().reverse() : []
		const view: AssistantEditorView = {
			name,
			folder,
			folderDisplay: folder ? this.tilde(folder) : '',
			source: entry.source,
			editable: !readOnly,
			readOnly,
			description: String(entry.meta?.description || about || ''),
			modelText,
			tools,
			ownTools: toolsSource ? ownTools(toolsSource) : [],
			use,
			files,
			hooks: hookList(hooksSource),
			providers,
			history,
			shadows: (entry.shadows || []).map((p: string) => this.tilde(p)),
			error,
		}
		return { status: 200, body: view }
	}

	/** One file of the folder, in a doc's shape (`GET /file`). A plugin's file reads fine; only writes are refused. */
	async file(name: string, rel: string): Promise<{ status: number; body: any }> {
		const entry = await this.entry(name)
		if (!entry) return { status: 404, body: { error: `no assistant ${name}` } }
		if (!entry.folder) return { status: 400, body: { error: AssistantEditor.readOnlyReason(entry, (p) => this.tilde(p)) } }
		const answer = fileView(entry.folder, rel)
		if (answer.status === 200) answer.body.pathDisplay = `${name}/${answer.body.pathDisplay}`
		return answer
	}

	/**
	 * Save one file (`POST /file/save` with the digest). A `.ts` file is loaded
	 * in the vm first and refused when it does not load; the old file is kept
	 * in `.history/`; live instances reload.
	 */
	async save(name: string, body: any): Promise<{ status: number; body: any }> {
		const entry = await this.entry(name)
		if (!entry) return { status: 404, body: { error: `no assistant ${name}` } }
		const readOnly = AssistantEditor.readOnlyReason(entry, (p) => this.tilde(p))
		if (readOnly) return { status: 403, body: { error: readOnly, readOnly: true } }
		if (typeof body?.path !== 'string' || !body.path) return { status: 400, body: { error: 'path is required' } }
		if (typeof body?.text !== 'string') return { status: 400, body: { error: 'text is required' } }
		const at = projectPath(entry.folder, body.path)
		if ('error' in at) return { status: 400, body: { error: at.error.replace('project folder', 'assistant folder') } }
		if (at.rel.startsWith('.history/')) return { status: 400, body: { error: '.history/ holds the backups; restore one instead of editing it' } }
		const current = existsSync(at.path) ? readFileSync(at.path) : Buffer.alloc(0)
		if (typeof body?.digest === 'string' && digestOf(current) !== body.digest) {
			return { status: 409, body: { error: 'The file changed on disk since you opened it.', view: fileView(entry.folder, at.rel).body } }
		}
		if (/\.(ts|tsx|mts|js|mjs|cjs)$/.test(at.rel)) {
			const check = this.parseCheck(name, entry.folder, at.rel, body.text)
			if (check) return { status: 422, body: { error: check, parse: true } }
		}
		let backedUp: string | null = null
		if (existsSync(at.path) && digestOf(current) !== digestOf(Buffer.from(body.text, 'utf8'))) {
			const stamp = new Date().toISOString().replace(/[:.]/g, '-')
			backedUp = `.history/${stamp}-${at.rel.replace(/\//g, '__')}`
			mkdirSync(join(entry.folder, '.history'), { recursive: true })
			writeFileSync(join(entry.folder, backedUp), current)
		}
		const answer = saveFile(entry.folder, { path: at.rel, text: body.text, digest: body.digest ?? digestOf(current) })
		if (answer.status !== 200) return answer
		if (answer.body.view) answer.body.view.pathDisplay = `${name}/${answer.body.view.pathDisplay}`
		if (!answer.body.unchanged) {
			answer.body.text = `Saved ${name}/${at.rel}`
			answer.body.backedUp = backedUp
			await this.changed(name)
		}
		return answer
	}

	/**
	 * Load a `.ts` file in the vm from a staged copy beside it (discovery looks
	 * for exact names, so `.staged-*` is invisible). The live info instance is
	 * the `assistant` global, so top-level code that reads it works; without
	 * one, a stand-in with the folder. Null when it loads, else the error.
	 */
	parseCheck(name: string, folder: string, rel: string, text: string): string | null {
		const staged = join(folder, dirname(rel), `.staged-${basename(rel)}`)
		mkdirSync(dirname(staged), { recursive: true })
		writeFileSync(staged, text)
		try {
			const assistant = this.host.infoInstance(name) ?? AssistantEditor.standIn(this.container, name, folder)
			this.container.feature('vm').loadModule(staged, { container: this.container, console, assistant })
			return null
		} catch (err: any) {
			return `${rel} does not load, so it was not saved: ${err?.message || err}`
		} finally {
			try { rmSync(staged, { force: true }) } catch {}
		}
	}

	/** Enough of an assistant for a `tools.ts` or `hooks.ts` to load when no instance can be made. */
	static standIn(container: any, name: string, folder: string) {
		const state = new Map<string, unknown>()
		return {
			name,
			resolvedFolder: folder,
			folder,
			meta: {},
			config: {},
			tools: {},
			state: { get: (k: string) => state.get(k), set: (k: string, v: unknown) => { state.set(k, v) } },
			setting: () => undefined,
			use: () => undefined,
			addTool: () => undefined,
			addSystemPromptExtension: () => undefined,
			removeSystemPromptExtension: () => undefined,
			on: () => undefined,
			off: () => undefined,
			emit: () => undefined,
			intercept: () => undefined,
			container,
		}
	}

	/** The files changed: discover again, reload every live instance, tell the tiles. */
	private async changed(name: string) {
		try {
			const manager = await this.host.manager()
			await manager.discover()
			try { manager.getInstance(name)?.reload() } catch (err: any) { console.error(`[workbench] could not reload ${name}: ${err?.message}`) }
		} catch {}
		this.host.reloadAssistant(name)
		this.broadcast({ type: 'assistant-changed', name, at: Date.now() })
	}

	/**
	 * A pure edit of the text the editor holds (`POST /assistant/<name>/edit`):
	 * `hook` appends a hook stub to a `hooks.ts` text, `use` adds (or removes)
	 * a feature's entry to a `tools.ts` text. Answers the new text and a line.
	 */
	edit(body: any): { status: number; body: any } {
		const text = typeof body?.text === 'string' ? body.text : ''
		if (body?.op === 'hook') {
			const answer = addHook(text, String(body?.hook || ''))
			return 'error' in answer ? { status: 400, body: answer } : { status: 200, body: { ok: true, ...answer } }
		}
		if (body?.op === 'use') {
			const feature = String(body?.feature || '').trim()
			if (!/^[A-Za-z_$][\w$]*$/.test(feature)) return { status: 400, body: { error: 'feature is a container feature name' } }
			const only = Array.isArray(body?.only) ? body.only.map(String).filter(Boolean) : undefined
			const options = body?.options && typeof body.options === 'object' ? body.options : undefined
			return { status: 200, body: { ok: true, ...useFeature(text, { feature, only, options, remove: !!body?.remove }) } }
		}
		return { status: 400, body: { error: 'op is hook or use' } }
	}

	/** Copy a plugin's (or the home folder's) assistant into this project's `assistants/`, where the copy wins the name. */
	async copyIn(name: string): Promise<{ status: number; body: any }> {
		const entry = await this.entry(name)
		if (!entry) return { status: 404, body: { error: `no assistant ${name}` } }
		if (entry.source === 'project') return { status: 400, body: { error: `${name} is this project's own assistant already` } }
		if (!entry.folder) return { status: 400, body: { error: AssistantEditor.readOnlyReason(entry, (p) => this.tilde(p)) } }
		const target = join(String(this.container.cwd), 'assistants', name)
		if (existsSync(target)) return { status: 409, body: { error: `${this.tilde(target)} exists already` } }
		mkdirSync(dirname(target), { recursive: true })
		// The backups and the desktop's install stamp stay behind: the copy is the human's own from here.
		cpSync(realpathSync(entry.folder), target, { recursive: true, filter: (src) => !['node_modules', '.git', '.luca-desktop-build', '.history'].includes(basename(src)) })
		await this.changed(name)
		return { status: 200, body: { ok: true, folder: target, folderDisplay: this.tilde(target), text: `Copied ${name} to ${this.tilde(target)}` } }
	}

	/** Restore the newest `.history/` backup of a file. */
	async rollback(name: string, rel: string): Promise<{ status: number; body: any }> {
		const entry = await this.entry(name)
		if (!entry) return { status: 404, body: { error: `no assistant ${name}` } }
		const readOnly = AssistantEditor.readOnlyReason(entry, (p) => this.tilde(p))
		if (readOnly) return { status: 403, body: { error: readOnly } }
		const at = projectPath(entry.folder, rel)
		if ('error' in at) return { status: 400, body: { error: at.error } }
		const suffix = `-${at.rel.replace(/\//g, '__')}`
		const dir = join(entry.folder, '.history')
		const backups = existsSync(dir) ? readdirSync(dir).filter((n) => n.endsWith(suffix)).sort().reverse() : []
		if (!backups.length) return { status: 404, body: { error: `No backup of ${at.rel} yet` } }
		mkdirSync(dirname(at.path), { recursive: true })
		writeFileSync(at.path, readFileSync(join(dir, backups[0]!)))
		await this.changed(name)
		return { status: 200, body: { ok: true, restoredFrom: backups[0], view: fileView(entry.folder, at.rel).body, text: `Restored ${at.rel} from ${backups[0]}` } }
	}

	// --- A chat about an assistant ---

	/**
	 * The brief a chat gets when it is opened about `name`: the folder, the
	 * files (read in full, up to a limit each), the hooks, the tool providers
	 * and how to work. `self` is true when the chat's own assistant is the one
	 * being edited.
	 */
	async brief(name: string, self: boolean): Promise<string> {
		const answer = await this.view(name)
		if (answer.status !== 200) return `## Building The Assistant \`${name}\`\n\nThere is no assistant named ${name} in this project. Say so.`
		const v: AssistantEditorView = answer.body
		const read = (rel: string): string | null => {
			try { return v.folder && existsSync(join(v.folder, rel)) ? readFileSync(join(v.folder, rel), 'utf8') : null } catch { return null }
		}
		const lines: string[] = []
		lines.push(`## Building The Assistant \`${name}\``)
		lines.push(`You are open beside the assistant editor for \`${name}\` in Luca Desktop. The human sees its files there and can edit them too. Your job here is to build and improve this assistant: its prompt (CORE.md), its tools (tools.ts), its hooks (hooks.ts), and any other file in its folder.`)
		if (self) lines.push(`**This assistant is you.** A saved change to your files reloads you: a new tool or hook is there from your next turn, a prompt change too. You can read your own state with evalCode (\`assistant\` is you there).`)
		lines.push('')
		lines.push(`- Folder: \`${v.folderDisplay || '(none)'}\` (${v.source === 'project' ? "this project's own" : v.source === 'home' ? 'the home folder, shared by every project' : v.source === 'extra' ? 'a plugin' : 'registered by code'})`)
		lines.push(`- Model: ${v.modelText}`)
		lines.push(`- Tools it has when it starts: ${v.tools.length ? v.tools.join(', ') : 'none'}`)
		if (v.ownTools.length) lines.push(`- Tools tools.ts declares itself: ${v.ownTools.join(', ')}`)
		if (v.use.length) lines.push(`- \`use\` entries in tools.ts: ${v.use.map((u) => u.text).join('; ')}`)
		if (v.error) lines.push(`- **It does not load right now:** ${v.error}`)
		if (v.readOnly) lines.push(`- **Read only:** ${v.readOnly} Your writeAssistantFile calls will be refused. Tell the human what the change would be, or that the editor's copy key puts an editable copy in this project.`)
		lines.push('')
		lines.push('### Its files (you have read these)')
		const shown: string[] = []
		for (const f of v.files) {
			if (!f.present) continue
			if (f.kind !== 'definition' && !(f.kind === 'other' && f.size < 6000 && f.language !== 'text')) continue
			const text = read(f.path)
			if (text == null) continue
			shown.push(f.path)
			lines.push('', fenced(f.path, text))
		}
		const rest = v.files.filter((f) => f.present && !shown.includes(f.path)).map((f) => `${f.path} (${f.sizeText})`)
		if (rest.length) lines.push('', `Other files, not shown: ${rest.join(', ')}. readAssistantFile reads one.`)
		const missing = v.files.filter((f) => f.kind === 'definition' && !f.present).map((f) => f.path)
		if (missing.length) lines.push('', `Not there yet: ${missing.join(', ')}. writeAssistantFile makes one.`)
		lines.push('')
		lines.push('### Hooks `hooks.ts` can export')
		lines.push('Each is an exported function `(assistant, ...params)`, awaited. A tick marks the ones this hooks.ts defines.')
		for (const h of v.hooks) lines.push(`- ${h.present ? '[x]' : '[ ]'} \`${h.name}(${h.params ? 'assistant, ' + h.params : 'assistant'})\`: ${h.description}${h.returns ? ' ' + h.returns : ''}`)
		lines.push('')
		lines.push('### Tool providers')
		lines.push("Container features with tools. `export const use = [ container.feature('name').toTools({ only: [...] }) ]` in tools.ts gives the assistant a feature's tools (leave `only` out for all of them). A tick marks the features this tools.ts uses. Tools of its own go in `export const schemas = { name: z.object({...}).describe('...') }` with a matching exported function.")
		for (const p of v.providers) lines.push(`- ${p.used ? '[x]' : '[ ]'} \`${p.name}\`${p.description ? ': ' + p.description : ''} (${p.tools.map((t) => t.name).join(', ')})`)
		lines.push('')
		lines.push('### How to work here')
		lines.push("1. Use the assistant tools you have for this chat: `listAssistantFiles`, `readAssistantFile`, `writeAssistantFile`, `rollbackAssistantFile`, `testAssistant`, `reloadAssistant`. They go through the editor: a `.ts` file is parse-checked before it lands (a file that does not load is refused and the one on disk stays), the old file is kept in `.history/`, every live instance reloads, and the editor beside you shows the new text. Do not edit these files with your general file tools.")
		lines.push('2. Whole files only: read a file, change it, write it back complete. Keep what you did not mean to change.')
		lines.push('3. Try code before you write it: `evalCode` runs TypeScript in this process with `container` in scope. `luca scaffold assistant --tutorial` (through runLucaCommand) is the authoritative guide to the three files; `luca describe <feature>` documents a feature before you call it. Never `z.any()` in a tool schema; `.describe()` every schema and field.')
		lines.push('4. Prove it: `testAssistant` starts a detached instance of the assistant, sends it one message and reports the reply and the tool calls it made. Use it after a change that should change behaviour.')
		lines.push('5. Say what changed in one line after each write. The human sees the file; do not paste it back.')
		return lines.join('\n')
	}

	/** The tools a chat about `name` gets. The write tools go through `save`, so the same checks and reloads apply. */
	tools(name: string): ToolBundle {
		const schemas = {
			listAssistantFiles: z.object({}).describe(`List the files in the ${name} assistant's folder with their sizes, the definition files first. Call it before you read or write.`),
			readAssistantFile: z.object({
				path: z.string().min(1).describe('The file, relative to the assistant folder, e.g. "CORE.md", "tools.ts", "skills/x/SKILL.md"'),
			}).describe(`Read one file of the ${name} assistant's folder, whole. Read before you write.`),
			writeAssistantFile: z.object({
				path: z.string().min(1).describe('The file, relative to the assistant folder. A new path makes the file (and its folders).'),
				content: z.string().describe('The complete new contents of the file.'),
			}).describe(`Write one file of the ${name} assistant's folder, whole. A .ts file is parse-checked first and refused when it does not load; the old file is backed up to .history/ and live instances reload. Refused for a read-only (plugin) assistant.`),
			rollbackAssistantFile: z.object({
				path: z.string().min(1).describe('The file to restore, relative to the assistant folder.'),
			}).describe('Restore the newest .history/ backup of a file, undoing the last write to it.'),
			testAssistant: z.object({
				message: z.string().min(1).describe('The message to send.'),
			}).describe(`Start a detached instance of the ${name} assistant with its files as they are now, send it one message, and report the reply, the tool calls it made and the tools it had. Makes a real model call. Use it to prove a change.`),
			reloadAssistant: z.object({}).describe(`Reload the ${name} assistant's prompt, tools and hooks from disk into every live instance. writeAssistantFile does this already; use it after changes made elsewhere.`),
		}
		const handlers = {
			listAssistantFiles: async () => {
				const view = await this.view(name)
				if (view.status !== 200) throw new Error(view.body.error)
				const v: AssistantEditorView = view.body
				return { folder: v.folderDisplay, editable: v.editable, readOnly: v.readOnly, files: v.files.filter((f) => f.present).map((f) => ({ path: f.path, size: f.sizeText })), missing: v.files.filter((f) => !f.present).map((f) => f.path), history: v.history.slice(0, 20) }
			},
			readAssistantFile: async ({ path }: { path: string }) => {
				const answer = await this.file(name, path)
				if (answer.status !== 200) throw new Error(answer.body.error)
				if (answer.body.missing) throw new Error(`${path} does not exist. writeAssistantFile makes it.`)
				return answer.body.file
			},
			writeAssistantFile: async ({ path, content }: { path: string; content: string }) => {
				const answer = await this.save(name, { path, text: content })
				if (answer.status !== 200) throw new Error(answer.body.error)
				return { ok: true, wrote: `${name}/${path}`, unchanged: !!answer.body.unchanged, backedUp: answer.body.backedUp ?? null, reloaded: !answer.body.unchanged }
			},
			rollbackAssistantFile: async ({ path }: { path: string }) => {
				const answer = await this.rollback(name, path)
				if (answer.status !== 200) throw new Error(answer.body.error)
				return { ok: true, restoredFrom: answer.body.restoredFrom }
			},
			testAssistant: async ({ message }: { message: string }) => {
				const manager = await this.host.manager()
				return manager.testAssistant({ name, message })
			},
			reloadAssistant: async () => {
				await this.changed(name)
				return { ok: true, reloaded: name }
			},
		}
		return { schemas, handlers, provider: { name: 'workbench.assistantEditor' } }
	}
}
