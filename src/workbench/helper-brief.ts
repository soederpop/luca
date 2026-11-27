/**
 * The brief a chat gets when it is opened about a helper (`POST /chat/open`
 * with `about: {helper: {registry, id}}`): what the inspector tile shows,
 * the describe docs and the source file, and how to work beside the tile.
 */
import { existsSync, readFileSync } from 'node:fs'
import { helperView, type HelperView } from './views.js'
import { fenced } from './assistant-editor.js'
import { sourceAccess } from './helper-source.js'
import { tildePath } from './origins.js'
import type { OriginIndex } from './origins.js'

/** The most of the source file that goes into the brief. */
export const HELPER_BRIEF_SOURCE_LIMIT = 24_000
/** The most of the describe docs that goes into the brief. */
export const HELPER_BRIEF_DOCS_LIMIT = 16_000

const KIND_NOUN: Record<string, string> = { features: 'feature', clients: 'client', servers: 'server', selectors: 'selector' }

/** The brief's text from a helper view and its source. Pure. */
export function helperBriefText(v: HelperView, source: string | null, home: string): string {
	const origin = v.origin
	const noun = KIND_NOUN[v.registry] ?? 'helper'
	const lines: string[] = []
	lines.push(`## The Helper \`${v.title}\``)
	lines.push(`You are open beside the inspector tile for \`${v.title}\` in Luca Desktop. The human sees its docs, methods, live state and events there, and can switch that tile to its source and edit it. Your job here is to help them understand and use this ${noun}, and to improve it when it is theirs.`)
	lines.push('')
	lines.push(`- Kind: ${noun} (the \`${v.registry}\` registry; \`container.${noun === 'helper' ? 'feature' : noun}('${v.id}')\` gets it)`)
	if (origin) {
		const access = sourceAccess(origin)
		lines.push(`- Origin: ${origin.label}${origin.file ? ` (file \`${tildePath(origin.file, home)}\`)` : ''}`)
		if (!access.editable) lines.push(`- **Read only:** ${access.readOnly} Suggest changes; do not try to write the file.`)
		else lines.push(`- Editable: the file is the human's. A change you write there loads on the next host restart (\`R\` in the tile).`)
	}
	if (v.summary) lines.push(`- Summary: ${v.summary}`)
	lines.push(`- Live now: ${v.live ? 'an instance exists; its state shows in the tile' : (v.liveNote || 'no instance yet')}`)
	if (v.methods.length) lines.push(`- Methods: ${v.methods.map((m) => m.name).join(', ')}`)
	if (v.getters.length) lines.push(`- Getters: ${v.getters.map((g) => g.name).join(', ')}`)
	if (v.events.length) lines.push(`- Events: ${v.events.join(', ')}`)
	if (v.examples.length) lines.push(`- Examples the tile can run in a console: ${v.examples.map((e) => e.title).join(', ')}`)
	lines.push('')
	lines.push('### Its docs (`luca describe`, you have read these)')
	const docs = v.markdown.length > HELPER_BRIEF_DOCS_LIMIT ? v.markdown.slice(0, HELPER_BRIEF_DOCS_LIMIT) + `\n\n(The docs go on past this point; this is the first ${HELPER_BRIEF_DOCS_LIMIT} characters.)` : v.markdown
	lines.push('', docs.trim() || '(no docs)')
	if (source != null && origin?.file) {
		lines.push('')
		lines.push('### Its source (you have read this)')
		lines.push('', fenced(origin.file, source, HELPER_BRIEF_SOURCE_LIMIT))
	}
	lines.push('')
	lines.push('### How to work')
	lines.push(`- Try it before you explain it: evalCode with \`container.${noun === 'helper' ? 'feature' : noun}('${v.id}')\` in scope runs the real thing in this project.`)
	lines.push('- The human can run any example from the tile in a console beside it, and call a method from the tile with `m`. Point them there when it is quicker than words.')
	lines.push('- Answer about this helper first. Reach for `luca describe` and the framework skill when the question goes wider.')
	return lines.join('\n')
}

/** Read the helper and its file, then write the brief. An unknown helper gets a one-line brief that says so. */
export async function helperBrief(container: any, origins: OriginIndex, registry: string, id: string, safe: (v: any) => any): Promise<string> {
	const view = await helperView(container, registry, id, safe, origins)
	if (!view) return `## The Helper \`${registry}.${id}\`\n\nThere is no helper \`${registry}.${id}\` in this project. Say so.`
	const home = String(container.feature('os').homedir)
	let source: string | null = null
	const file = view.origin?.file
	if (file && existsSync(file)) {
		try { source = readFileSync(file, 'utf8') } catch { source = null }
	}
	return helperBriefText(view, source, home)
}
