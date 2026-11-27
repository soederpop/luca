/**
 * The source file of a helper, for the inspector's source view
 * (`GET /helper/<registry>/<id>/source`, `POST …/source/save`).
 *
 * The origin index knows the file; this module reads and saves it with the
 * file tile's rules (size, binary, digest). A helper the user owns (this
 * project's, a borrowed folder, `~/.luca`) is editable; a plugin's file is
 * read only here, and a built-in helper has no file on this machine.
 */
import { existsSync, statSync } from 'node:fs'
import { basename, dirname } from 'node:path'
import { fileView, saveFile, type FileView } from './files.js'
import { tildePath, type HelperOrigin } from './origins.js'

export type HelperSourceView = FileView & {
	/** True when a save here is allowed. */
	editable: boolean
	/** Why not, when `editable` is false. */
	readOnly: string | null
	origin: HelperOrigin
}

/** Whether the inspector may save this file, and why not. Pure. */
export function sourceAccess(origin: HelperOrigin): { editable: boolean; readOnly: string | null } {
	switch (origin.kind) {
		case 'builtin':
			return { editable: false, readOnly: 'Built into Luca: the source is not a file on this machine.' }
		case 'plugin':
			return { editable: false, readOnly: `A plugin's file${origin.plugin ? ` (${origin.plugin})` : ''}: edit it in the plugin's own project.` }
		default:
			return { editable: true, readOnly: null }
	}
}

/** The file as the tile draws it, with the access flags. 404 when the origin names no file. */
export function helperSourceView(origin: HelperOrigin, home: string): { status: number; body: any } {
	if (!origin.file) {
		return { status: 404, body: { error: origin.kind === 'builtin' ? 'Built into Luca: no source file on this machine' : 'No source file is known for this helper', origin } }
	}
	if (existsSync(origin.file) && statSync(origin.file).isDirectory()) return { status: 400, body: { error: `${tildePath(origin.file, home)} is a folder`, origin } }
	const answer = fileView(dirname(origin.file), basename(origin.file))
	if (answer.status !== 200) return answer
	const view: HelperSourceView = { ...answer.body, pathDisplay: tildePath(origin.file, home), ...sourceAccess(origin), origin }
	return { status: 200, body: view }
}

/** Save the whole file, as `POST /file/save` does. 403 when the origin is read only. */
export function saveHelperSource(origin: HelperOrigin, home: string, body: any): { status: number; body: any } {
	const access = sourceAccess(origin)
	if (!origin.file) return { status: 404, body: { error: 'No source file is known for this helper' } }
	if (!access.editable) return { status: 403, body: { error: access.readOnly, readOnly: true } }
	const answer = saveFile(dirname(origin.file), { ...body, path: basename(origin.file) })
	if (answer.body?.view) answer.body.view = helperSourceView(origin, home).body
	if (answer.status === 200 && answer.body?.text) answer.body.text = `Saved ${tildePath(origin.file, home)}`
	return answer
}
