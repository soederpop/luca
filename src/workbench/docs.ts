/**
 * The project's contentbase collection (`container.docs`) as the docs,
 * models and doc tiles draw it. The host does the display work: titles,
 * previews, field kinds, a color slot per model. Saves write the text the
 * app sends byte for byte, and only when the file on disk is still the one
 * the app loaded (`digest`).
 */
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync, statSync } from 'node:fs'
import { introspectMetaSchema } from 'contentbase'
import { displayPath } from './origins.js'

export type FieldKind = 'string' | 'number' | 'boolean' | 'enum' | 'array' | 'date' | 'object' | 'value'

export type ModelFieldView = {
	name: string
	kind: FieldKind
	/** As the schema says it: `enum(draft, done)`, `string[]`. */
	typeText: string
	required: boolean
	/** The default as text, or null. */
	default: string | null
	description: string | null
	/** For an enum: its values. */
	options: string[]
}

export type ModelView = {
	name: string
	prefix: string
	description: string
	count: number
	/** A color slot, the same in every view. -1 for `Base` (documents no model matches). */
	slot: number
	fields: ModelFieldView[]
	sections: string[]
	relationships: string[]
}

export type DocCard = {
	id: string
	title: string
	subtitle: string
	preview: string
	/** `status` when the doc has one, else empty. */
	badge: string
	address: string
}

export type DocStack = { id: string; title: string; slot: number; count: number; cards: DocCard[] }

export type DocFieldView = {
	name: string
	/** The model's kind for the field, else the value's own kind. */
	kind: FieldKind
	typeText: string
	/** The value as text; null when it is not set. */
	value: string | null
	/** For a list: each item as text. */
	items: string[]
	/** True when the model does not name this field. */
	extra: boolean
	required: boolean
	description: string | null
}

export type DocView = {
	id: string
	model: string
	slot: number
	title: string
	path: string
	pathDisplay: string
	/** The file as it is on disk. */
	file: string
	digest: string
	size: number
	sizeText: string
	fields: DocFieldView[]
}

const PREVIEW_LINES = 4
const PREVIEW_CHARS = 320

export function digestOf(text: string | Buffer): string {
	return createHash('sha1').update(text).digest('hex')
}

/** The schema's type text read as a kind the app colors by, with an enum's values. Pure. */
export function fieldKind(typeText: string): { kind: FieldKind; options: string[]; text: string } {
	const t = String(typeText || '').trim()
	const en = /^enum\((.*)\)$/.exec(t)
	if (en) {
		const options = en[1]!.split(',').map((s) => s.trim().replace(/^[`'"]|[`'"]$/g, '')).filter(Boolean)
		return { kind: 'enum', options, text: `enum(${options.join(', ')})` }
	}
	if (t.endsWith('[]') || t.startsWith('array')) return { kind: 'array', options: [], text: t }
	if (t === 'string') return { kind: 'string', options: [], text: t }
	if (t === 'number' || t === 'int' || t === 'bigint') return { kind: 'number', options: [], text: t }
	if (t === 'boolean') return { kind: 'boolean', options: [], text: t }
	if (t === 'date') return { kind: 'date', options: [], text: t }
	if (t === 'object' || t.startsWith('record') || t.startsWith('{')) return { kind: 'object', options: [], text: t }
	// zod pipes (preprocess, coerce) and unions say nothing useful about the value.
	if (t === 'pipe' || t === 'union' || t === 'any' || t === 'unknown' || !t) return { kind: 'value', options: [], text: 'value' }
	return { kind: 'value', options: [], text: t }
}

/** A frontmatter value's own kind. Pure. */
export function valueKind(value: unknown): FieldKind {
	if (Array.isArray(value)) return 'array'
	if (value instanceof Date) return 'date'
	switch (typeof value) {
		case 'string': return /^\d{4}-\d{2}-\d{2}/.test(value) ? 'date' : 'string'
		case 'number': return 'number'
		case 'boolean': return 'boolean'
		case 'object': return value === null ? 'value' : 'object'
		default: return 'value'
	}
}

export function valueText(value: unknown): string | null {
	if (value === undefined || value === null) return null
	if (value instanceof Date) return Number.isNaN(value.getTime()) ? 'Invalid Date' : value.toISOString().replace(/T00:00:00\.000Z$/, '')
	if (typeof value === 'string') return value
	if (typeof value === 'number' || typeof value === 'boolean') return String(value)
	try { return JSON.stringify(value) } catch { return String(value) }
}

/** A doc's title: its `title` or `name`, else the first `# ` heading, else the file name. Pure. */
export function docTitle(id: string, meta: Record<string, unknown>, content: string): string {
	for (const key of ['title', 'name']) {
		const v = meta?.[key]
		if (typeof v === 'string' && v.trim()) return v.trim()
	}
	const heading = /^#\s+(.+)$/m.exec(content || '')
	if (heading) return heading[1]!.trim()
	return id.split('/').pop() || id
}

/** The first lines of the body, without headings. Pure. */
export function docPreview(content: string): string {
	const lines = String(content || '').split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
	const text = lines.slice(0, PREVIEW_LINES).join('\n')
	return text.length > PREVIEW_CHARS ? text.slice(0, PREVIEW_CHARS - 1) + '…' : text
}

export function sizeText(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
	return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function modelFields(def: any): ModelFieldView[] {
	let infos: any[] = []
	try { infos = introspectMetaSchema(def?.meta) || [] } catch {}
	return infos.map((f) => {
		const k = fieldKind(f.type)
		return {
			name: String(f.name),
			kind: k.kind,
			typeText: k.text,
			required: !!f.required,
			default: f.defaultValue === undefined ? null : valueText(f.defaultValue),
			description: f.description ? String(f.description) : null,
			options: k.options,
		}
	})
}

/**
 * The collection, loaded fresh from disk. `notice` when the project has no
 * docs folder; `error` when its models file does not load.
 */
export class DocsIndex {
	constructor(private container: any) {}

	get db(): any {
		return this.container.docs ?? this.container.feature('contentDb')
	}

	get rootPath(): string {
		return String(this.db.collectionPath)
	}

	get home(): string {
		return String(this.container.feature('os').homedir)
	}

	/** `notes-project/docs/x.md`: under the project by its folder name, else from `~`. */
	display(path: string): string {
		return displayPath(path, this.home, String(this.container.cwd))
	}

	get exists(): boolean {
		try { return existsSync(this.rootPath) && statSync(this.rootPath).isDirectory() } catch { return false }
	}

	/** Load or reload. Returns the models file's error, if any. */
	async refresh(): Promise<string | null> {
		const db = this.db
		if (db.isLoaded) await db.reload()
		else await db.load({ ignoreModelErrors: true })
		return db.modelLoadError ?? null
	}

	/** Models in the order the models file defines them, `Base` last, each with its color slot. */
	definitions(): Array<{ def: any; slot: number }> {
		const defs: any[] = this.db.collection.modelDefinitions
		const own = defs.filter((d) => d.name !== 'Base')
		const base = defs.find((d) => d.name === 'Base')
		return [...own.map((def, slot) => ({ def, slot })), ...(base ? [{ def: base, slot: -1 }] : [])]
	}

	slotOf(modelName: string | undefined): number {
		const found = this.definitions().find((d) => d.def.name === modelName)
		return found ? found.slot : -1
	}

	modelOf(id: string): string {
		try { return this.db.collection.findModelDefinition(id)?.name || 'Base' } catch { return 'Base' }
	}

	/** The absolute file of a doc id, only inside the collection. */
	fileOf(id: string): string | undefined {
		const item = this.db.collection.items.get(id)
		const path = item?.path ? String(item.path) : undefined
		if (!path) return undefined
		const abs = path.startsWith('/') ? path : this.container.paths.resolve(this.rootPath, path)
		const root = this.rootPath.replace(/\/+$/, '') + '/'
		return abs.startsWith(root) && !abs.split('/').includes('..') ? abs : undefined
	}
}

export async function docsView(index: DocsIndex) {
	const rootDisplay = index.display(index.rootPath)
	if (!index.exists) {
		return { rootPath: index.rootPath, rootDisplay, notice: `This project has no docs collection (no ${rootDisplay} folder).`, error: null, count: 0, stacks: [] as DocStack[] }
	}
	const error = await index.refresh()
	const items: Map<string, any> = index.db.collection.items
	const byModel = new Map<string, DocCard[]>()
	for (const id of [...items.keys()].sort()) {
		const item = items.get(id)
		const meta = (item?.meta || {}) as Record<string, unknown>
		const model = index.modelOf(id)
		const card: DocCard = {
			id,
			title: docTitle(id, meta, item?.content || ''),
			subtitle: id,
			preview: docPreview(item?.content || ''),
			badge: typeof meta.status === 'string' ? meta.status : '',
			address: `doc/${id}`,
		}
		if (!byModel.has(model)) byModel.set(model, [])
		byModel.get(model)!.push(card)
	}
	const stacks: DocStack[] = []
	for (const { def, slot } of index.definitions()) {
		const cards = byModel.get(def.name) || []
		if (def.name === 'Base' && cards.length === 0) continue
		stacks.push({ id: def.name, title: def.name === 'Base' ? 'Other' : def.name, slot, count: cards.length, cards })
	}
	const count = stacks.reduce((n, s) => n + s.count, 0)
	return {
		rootPath: index.rootPath,
		rootDisplay,
		notice: count === 0 ? `${rootDisplay} has no documents yet.` : null,
		error: error ? `The models file did not load: ${error}` : null,
		count,
		stacks,
	}
}

export async function modelsView(index: DocsIndex) {
	const rootDisplay = index.display(index.rootPath)
	if (!index.exists) {
		return { rootDisplay, notice: `This project has no docs collection (no ${rootDisplay} folder).`, error: null, models: [] as ModelView[] }
	}
	const error = await index.refresh()
	const items: Map<string, any> = index.db.collection.items
	const counts = new Map<string, number>()
	for (const id of items.keys()) {
		const m = index.modelOf(id)
		counts.set(m, (counts.get(m) || 0) + 1)
	}
	const models: ModelView[] = index.definitions().map(({ def, slot }) => ({
		name: def.name,
		prefix: def.name === 'Base' ? '' : String(def.prefix || ''),
		description: def.name === 'Base' ? 'Any markdown document no other model matches' : String(def.description || ''),
		count: counts.get(def.name) || 0,
		slot,
		fields: def.name === 'Base' ? [] : modelFields(def),
		sections: Object.keys(def.sections ?? {}),
		relationships: Object.keys(def.relationships ?? {}),
	}))
	return {
		rootDisplay,
		notice: models.length <= 1 ? `${rootDisplay} defines no models (no models.ts), so every document is Base.` : null,
		error: error ? `The models file did not load: ${error}` : null,
		models,
	}
}

/** One doc: the exact file, its digest, and its frontmatter as fields in the model's order. */
export async function docView(index: DocsIndex, id: string, refresh = true): Promise<DocView | undefined> {
	if (!index.exists) return undefined
	if (refresh) await index.refresh()
	const path = index.fileOf(id)
	if (!path || !existsSync(path)) return undefined
	const bytes = readFileSync(path)
	const file = bytes.toString('utf8')
	const item = index.db.collection.items.get(id)
	const meta = (item?.meta || {}) as Record<string, unknown>
	const model = index.modelOf(id)
	const def = index.db.collection.modelDefinitions.find((d: any) => d.name === model)
	const named = model === 'Base' ? [] : modelFields(def)
	const fields: DocFieldView[] = named.map((f) => ({
		name: f.name,
		kind: f.kind,
		typeText: f.typeText,
		value: valueText(meta[f.name]),
		items: Array.isArray(meta[f.name]) ? (meta[f.name] as unknown[]).map((v) => valueText(v) ?? '') : [],
		extra: false,
		required: f.required,
		description: f.description,
	}))
	for (const [name, value] of Object.entries(meta)) {
		if (named.some((f) => f.name === name)) continue
		fields.push({
			name,
			kind: valueKind(value),
			typeText: valueKind(value),
			value: valueText(value),
			items: Array.isArray(value) ? value.map((v) => valueText(v) ?? '') : [],
			extra: true,
			required: false,
			description: null,
		})
	}
	return {
		id,
		model,
		slot: index.slotOf(model),
		title: docTitle(id, meta, item?.content || ''),
		path,
		pathDisplay: index.display(path),
		file,
		digest: digestOf(bytes),
		size: bytes.length,
		sizeText: sizeText(bytes.length),
		fields,
	}
}

/**
 * Write `text` as the doc's whole file, byte for byte, when the file is
 * still the one with `digest`. 409 with the file as it is now otherwise.
 */
export async function saveDoc(index: DocsIndex, body: any): Promise<{ status: number; body: any }> {
	const id = typeof body?.id === 'string' ? body.id : ''
	if (!id) return { status: 400, body: { error: 'id is required' } }
	if (typeof body?.text !== 'string') return { status: 400, body: { error: 'text is required' } }
	if (typeof body?.digest !== 'string' || !body.digest) return { status: 400, body: { error: 'digest is required (from GET /docs/item)' } }
	if (!index.exists) return { status: 404, body: { error: 'This project has no docs collection' } }
	await index.refresh()
	const path = index.fileOf(id)
	if (!path || !existsSync(path)) return { status: 404, body: { error: `no doc ${id}` } }
	const current = readFileSync(path)
	if (digestOf(current) !== body.digest) {
		return { status: 409, body: { error: 'The file changed on disk since you opened it.', view: await docView(index, id, false) } }
	}
	if (digestOf(Buffer.from(body.text, 'utf8')) === body.digest) {
		return { status: 200, body: { ok: true, unchanged: true, view: await docView(index, id, false) } }
	}
	writeFileSync(path, body.text, 'utf8')
	const view = await docView(index, id, true)
	return { status: 200, body: { ok: true, unchanged: false, view, text: `Saved ${index.display(path)}` } }
}
