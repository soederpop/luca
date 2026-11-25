/**
 * The contentbase tile: define models and query documents.
 *
 * A model the tile defines is one file, `docs/models/<name>.md`, in the
 * workspace-model format the markdownModels feature loads. Its frontmatter
 * holds the spec the tile edits (`luca-model:`); the `## Name` heading, the
 * description and the `ts` block under it are written from that spec. The
 * tile edits only such files, and only while the body is still the one the
 * spec gives: a hand edit makes the model read only here.
 *
 * Every other model (models.ts, hand-written workspace files) is shown read
 * only, with its source file, so the app can open it in the file tile.
 *
 * The template of a model is `docs/models/<name>.template.md`, the first
 * place contentbase looks (`collection.readTemplate`).
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync, renameSync } from 'node:fs'
import { parseWhereClause } from 'contentbase'
import { DocsIndex, digestOf, fieldKind, modelFields, valueKind, valueText, type FieldKind } from './docs.js'

export const FIELD_TYPES = ['string', 'number', 'boolean', 'date', 'enum', 'list'] as const
export type FieldType = typeof FIELD_TYPES[number]
export const EXTRACT_KINDS = ['text', 'list', 'code'] as const
export type ExtractKind = typeof EXTRACT_KINDS[number]

export type FieldSpec = {
	name: string
	type: FieldType
	required: boolean
	/** The default as text; empty for none. A list default is comma separated. */
	default: string
	description: string
	/** For an enum: its values. */
	options: string[]
}

export type SectionSpec = {
	/** The key on `doc.sections`. */
	key: string
	heading: string
	alternatives: string[]
	extract: ExtractKind
}

export type ModelSpec = {
	name: string
	prefix: string
	description: string
	fields: FieldSpec[]
	sections: SectionSpec[]
}

export type SourceKind = 'models-file' | 'tile' | 'workspace' | 'builtin'

export type SectionView = {
	key: string
	heading: string
	alternatives: string[]
	/** A ready-made extractor, or `custom` for the model's own function. */
	extract: ExtractKind | 'custom'
}

export type ModelEditorView = {
	name: string
	prefix: string
	description: string
	slot: number
	count: number
	source: SourceKind
	/** One line: where the model comes from. */
	sourceText: string
	/** The file that defines it, relative to the project; empty for Base. */
	file: string
	fileDisplay: string
	/** sha1 of the file, for saves. Empty when not editable. */
	digest: string
	editable: boolean
	/** Why it is read only here; null when editable. */
	readOnlyNote: string | null
	/** The spec to edit; for a read-only model, the nearest spec its definition gives. */
	spec: ModelSpec
	fields: ReturnType<typeof modelFields>
	sections: SectionView[]
	relationships: string[]
	template: { file: string; fileDisplay: string; exists: boolean }
}

const SPEC_KEY = 'luca-model'
const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/
const MODEL_NAME = /^[A-Z][A-Za-z0-9]*$/
const PREFIX = /^[a-z0-9][a-z0-9._/-]*$/

/** `SalesLead` → `sales-lead`. Pure. */
export function kebab(name: string): string {
	return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase()
}

/** `SalesLead` → `sales-leads`: a starting prefix for a new model. Pure. */
export function suggestPrefix(name: string): string {
	const k = kebab(name)
	if (!k) return ''
	if (/(s|x|ch|sh)$/.test(k)) return `${k}es`
	if (/[^aeiou]y$/.test(k)) return `${k.slice(0, -1)}ies`
	return `${k}s`
}

function q(text: string): string {
	return `'${String(text).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`
}

/** A field's default as the JS literal it is in the schema, or null for none. Pure. */
export function defaultLiteral(field: FieldSpec): string | null {
	const text = (field.default ?? '').trim()
	if (!text) return null
	switch (field.type) {
		case 'number': return String(Number(text))
		case 'boolean': return text === 'true' ? 'true' : 'false'
		case 'list': return `[${text.split(',').map((s) => s.trim()).filter(Boolean).map(q).join(', ')}]`
		default: return q(text)
	}
}

/** One field as zod code. Pure. */
export function fieldCode(field: FieldSpec): string {
	let code: string
	switch (field.type) {
		case 'number': code = 'z.number()'; break
		case 'boolean': code = 'z.boolean()'; break
		case 'enum': code = `z.enum([${field.options.map(q).join(', ')}])`; break
		case 'list': code = 'z.array(z.string())'; break
		// Frontmatter dates are often read as strings; keep them as written.
		case 'date': code = 'z.union([z.string(), z.date()])'; break
		default: code = 'z.string()'
	}
	const def = defaultLiteral(field)
	if (def !== null) code += `.default(${def})`
	else if (!field.required) code += '.optional()'
	if (field.description.trim()) code += `.describe(${q(field.description.trim())})`
	return code
}

/** The section as contentbase code. Pure. */
export function sectionCode(section: SectionSpec): string {
	const schema = section.extract === 'text' ? 'z.string().optional()' : 'z.array(z.string()).default([])'
	const alts = section.alternatives.map((a) => a.trim()).filter(Boolean)
	const parts = [`extract: extract.${section.extract}`, `schema: ${schema}`]
	if (alts.length) parts.push(`alternatives: [${alts.map(q).join(', ')}]`)
	return `section(${q(section.heading.trim())}, { ${parts.join(', ')} })`
}

/** The body under the frontmatter: heading, description, the config block. Pure. */
export function modelBody(spec: ModelSpec): string {
	const lines: string[] = [`## ${spec.name}`, '']
	const description = spec.description.trim()
	if (description) lines.push(description, '')
	lines.push('```ts', '({', `  prefix: ${q(spec.prefix)},`)
	if (spec.fields.length) {
		lines.push('  meta: z.object({')
		for (const f of spec.fields) lines.push(`    ${f.name}: ${fieldCode(f)},`)
		lines.push('  }),')
	} else {
		lines.push('  meta: z.object({}),')
	}
	if (spec.sections.length) {
		lines.push('  sections: {')
		for (const s of spec.sections) lines.push(`    ${s.key}: ${sectionCode(s)},`)
		lines.push('  },')
	}
	lines.push('})', '```', '')
	return lines.join('\n')
}

/** The whole file: the spec as frontmatter, then the body. */
export function modelFile(spec: ModelSpec, yaml: { stringify(v: any): string }): string {
	const clean = normalizeSpec(spec)
	const front = yaml.stringify({ [SPEC_KEY]: clean }).trimEnd()
	return `---\n# Written by Luca Desktop's contentbase tile. Edit the model there, or\n# delete this block to own the file by hand.\n${front}\n---\n\n${modelBody(clean)}`
}

/** Split a file into its frontmatter text and body. Pure. */
export function splitFrontmatter(text: string): { front: string | null; body: string } {
	const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text)
	if (!m) return { front: null, body: text }
	return { front: m[1]!, body: text.slice(m[0].length).replace(/^\r?\n/, '') }
}

/** Trim and fill a spec the app sent. Pure. */
export function normalizeSpec(raw: any): ModelSpec {
	const str = (v: any) => (typeof v === 'string' ? v : v == null ? '' : String(v))
	const list = (v: any) => (Array.isArray(v) ? v.map(str).map((s) => s.trim()).filter(Boolean) : [])
	return {
		name: str(raw?.name).trim(),
		prefix: str(raw?.prefix).trim().replace(/^\/+|\/+$/g, ''),
		description: str(raw?.description).trim(),
		fields: (Array.isArray(raw?.fields) ? raw.fields : []).map((f: any) => ({
			name: str(f?.name).trim(),
			type: (FIELD_TYPES as readonly string[]).includes(f?.type) ? f.type : 'string',
			required: !!f?.required,
			default: str(f?.default).trim(),
			description: str(f?.description).trim(),
			options: f?.type === 'enum' ? list(f?.options) : [],
		})),
		sections: (Array.isArray(raw?.sections) ? raw.sections : []).map((s: any) => ({
			key: str(s?.key).trim(),
			heading: str(s?.heading).trim(),
			alternatives: list(s?.alternatives),
			extract: (EXTRACT_KINDS as readonly string[]).includes(s?.extract) ? s.extract : 'text',
		})),
	}
}

/** What is wrong with a spec, one line each; empty when it can be saved. Pure. */
export function specProblems(spec: ModelSpec, taken: string[] = []): string[] {
	const problems: string[] = []
	if (!spec.name) problems.push('The model needs a name.')
	else if (!MODEL_NAME.test(spec.name)) problems.push(`"${spec.name}" is not a model name: start with a capital letter, letters and digits only.`)
	else if (spec.name === 'Base' || taken.includes(spec.name)) problems.push(`A model named ${spec.name} already exists.`)
	if (!spec.prefix) problems.push('The model needs a folder (prefix).')
	else if (!PREFIX.test(spec.prefix) || spec.prefix.split('/').includes('..')) problems.push(`"${spec.prefix}" is not a folder under docs/: lower case, digits, - _ . /`)
	else if (spec.prefix === 'models' || spec.prefix.startsWith('models/')) problems.push('docs/models/ holds model files, not documents.')
	const names = new Set<string>()
	for (const f of spec.fields) {
		const label = f.name || '(no name)'
		if (!f.name) problems.push('A field has no name.')
		else if (!IDENT.test(f.name)) problems.push(`Field "${f.name}": letters, digits and _ only, not starting with a digit.`)
		else if (names.has(f.name)) problems.push(`Field "${f.name}" is there twice.`)
		names.add(f.name)
		if (f.type === 'enum' && !f.options.length) problems.push(`Field ${label}: an enum needs at least one value.`)
		if (f.default) {
			if (f.type === 'number' && !Number.isFinite(Number(f.default))) problems.push(`Field ${label}: the default "${f.default}" is not a number.`)
			if (f.type === 'boolean' && f.default !== 'true' && f.default !== 'false') problems.push(`Field ${label}: the default must be true or false.`)
			if (f.type === 'enum' && !f.options.includes(f.default)) problems.push(`Field ${label}: the default "${f.default}" is not one of its values.`)
		}
	}
	const keys = new Set<string>()
	for (const s of spec.sections) {
		if (!s.key) problems.push('A section has no key.')
		else if (!IDENT.test(s.key)) problems.push(`Section "${s.key}": letters, digits and _ only, not starting with a digit.`)
		else if (keys.has(s.key)) problems.push(`Section "${s.key}" is there twice.`)
		keys.add(s.key)
		if (!s.heading) problems.push(`Section ${s.key || '(no key)'} has no heading.`)
	}
	return problems
}

/** The editor's field type for a definition's schema type text. Pure. */
function specType(kind: FieldKind, typeText: string): FieldType {
	switch (kind) {
		case 'number': case 'boolean': case 'enum': case 'date': return kind
		case 'array': return 'list'
		case 'value': return /string/.test(typeText) && /date/.test(typeText) ? 'date' : 'string'
		default: return 'string'
	}
}

export class ModelsEditor {
	constructor(private container: any, private index: DocsIndex) {}

	get markdownModels(): any {
		return this.container.feature('markdownModels')
	}

	get yaml(): any {
		return this.container.feature('yaml')
	}

	get modelsDir(): string {
		return this.container.paths.resolve(this.index.rootPath, 'models')
	}

	fileFor(name: string): string {
		return this.container.paths.resolve(this.modelsDir, `${kebab(name)}.md`)
	}

	templateFor(name: string): string {
		// The first place contentbase looks that the tile can name for any model.
		for (const candidate of this.index.db.collection.templatePathsFor?.(name) ?? []) {
			if (existsSync(candidate)) return candidate
		}
		return this.container.paths.resolve(this.modelsDir, `${kebab(name)}.template.md`)
	}

	relative(abs: string): string {
		const cwd = String(this.container.cwd).replace(/\/+$/, '') + '/'
		return abs.startsWith(cwd) ? abs.slice(cwd.length) : abs
	}

	/** The spec a file the tile wrote holds, and whether its body is still the generated one. */
	readTileFile(path: string): { spec: ModelSpec; untouched: boolean; digest: string } | null {
		if (!existsSync(path)) return null
		const bytes = readFileSync(path)
		const { front, body } = splitFrontmatter(bytes.toString('utf8'))
		if (!front) return null
		let data: any
		try { data = this.yaml.parse(front) } catch { return null }
		if (!data || typeof data !== 'object' || !data[SPEC_KEY]) return null
		const spec = normalizeSpec(data[SPEC_KEY])
		return { spec, untouched: body.trim() === modelBody(spec).trim(), digest: digestOf(bytes) }
	}

	/** A definition's nearest spec, for showing a model that is not editable here. */
	specOf(def: any): ModelSpec {
		const fields = modelFields(def).map((f) => ({
			name: f.name,
			type: specType(f.kind, f.typeText),
			required: f.required,
			default: f.default ?? '',
			description: f.description ?? '',
			options: f.options,
		}))
		return {
			name: def.name,
			prefix: String(def.prefix || ''),
			description: String(def.description || ''),
			fields,
			sections: this.sectionsOf(def).map((s) => ({ ...s, extract: s.extract === 'custom' ? 'text' : s.extract })),
		}
	}

	sectionsOf(def: any): SectionView[] {
		return Object.entries(def.sections ?? {}).map(([key, s]: [string, any]) => ({
			key,
			heading: String(s?.heading ?? key),
			alternatives: Array.isArray(s?.alternatives) ? s.alternatives.map(String) : [],
			extract: this.markdownModels.extractorKind?.(s?.extract, this.index.db) ?? 'custom',
		}))
	}

	view(def: any, slot: number, count: number): ModelEditorView {
		const sources: Record<string, string> = this.markdownModels.state.get('sources') || {}
		const base = def.name === 'Base'
		let source: SourceKind = base ? 'builtin' : 'models-file'
		let file = ''
		let digest = ''
		let editable = false
		let readOnlyNote: string | null = null
		let spec = this.specOf(def)
		const own = sources[def.name]
		if (base) {
			readOnlyNote = 'Base matches any document no other model does. It has no file.'
		} else if (own) {
			file = own
			const tile = own.endsWith('.md') ? this.readTileFile(own) : null
			if (tile && tile.spec.name === def.name) {
				source = 'tile'
				if (tile.untouched) {
					editable = true
					digest = tile.digest
					spec = tile.spec
				} else {
					readOnlyNote = 'The file was edited by hand after the tile wrote it. Open the file to change it.'
				}
			} else {
				source = 'workspace'
				readOnlyNote = 'Written by hand. Open the file to change it.'
			}
		} else {
			for (const ext of ['ts', 'js', 'mjs']) {
				const candidate = this.container.paths.resolve(this.index.rootPath, `models.${ext}`)
				if (existsSync(candidate)) { file = candidate; break }
			}
			readOnlyNote = 'Defined in the project\'s models file. Open the file to change it.'
		}
		const template = this.templateFor(def.name)
		const sourceText = source === 'builtin' ? 'Built in'
			: source === 'models-file' ? `models file · ${this.index.display(file)}`
			: source === 'tile' ? `this tile · ${this.index.display(file)}`
			: `workspace file · ${this.index.display(file)}`
		return {
			name: def.name,
			prefix: base ? '' : String(def.prefix || ''),
			description: base ? 'Any markdown document no other model matches' : String(def.description || ''),
			slot,
			count,
			source,
			sourceText,
			file: file ? this.relative(file) : '',
			fileDisplay: file ? this.index.display(file) : '',
			digest,
			editable,
			readOnlyNote,
			spec,
			fields: base ? [] : modelFields(def),
			sections: this.sectionsOf(def),
			relationships: Object.keys(def.relationships ?? {}),
			template: { file: this.relative(template), fileDisplay: this.index.display(template), exists: existsSync(template) },
		}
	}

	/** Every model, as the tile lists it, plus the workspace files' load errors. */
	async overview() {
		const rootDisplay = this.index.display(this.index.rootPath)
		const empty = { rootDisplay, modelsDirDisplay: this.index.display(this.modelsDir), fieldTypes: FIELD_TYPES, extractKinds: EXTRACT_KINDS, models: [] as ModelEditorView[], loadErrors: [] as any[] }
		if (!this.index.exists) return { ...empty, notice: `This project has no docs collection (no ${rootDisplay} folder).`, error: null }
		const error = await this.index.refresh()
		const counts = new Map<string, number>()
		for (const id of this.index.db.collection.items.keys()) {
			const m = this.index.modelOf(id)
			counts.set(m, (counts.get(m) || 0) + 1)
		}
		const models = this.index.definitions().map(({ def, slot }) => this.view(def, slot, counts.get(def.name) || 0))
		const loadErrors = (this.markdownModels.state.get('errors') || []).map((e: any) => ({ ...e, fileDisplay: this.index.display(e.file), file: this.relative(e.file) }))
		return {
			...empty,
			notice: null,
			error: error ? `The models file did not load: ${error}` : null,
			models,
			loadErrors,
		}
	}

	/** The file a spec gives, and what is wrong with it, without writing. */
	preview(body: any) {
		const spec = normalizeSpec(body?.spec)
		const original = typeof body?.original === 'string' ? body.original : ''
		const taken = this.index.db.collection.modelDefinitions.map((d: any) => d.name).filter((n: string) => n !== original && n !== 'Base')
		const problems = specProblems(spec, taken)
		const file = spec.name ? this.fileFor(spec.name) : ''
		return {
			spec,
			problems,
			file: file ? this.relative(file) : '',
			fileDisplay: file ? this.index.display(file) : '',
			text: spec.name ? modelFile(spec, this.yaml) : '',
			suggestedPrefix: suggestPrefix(spec.name),
		}
	}

	/**
	 * Write a spec as `docs/models/<name>.md`. `original` is the model's name
	 * when it was opened (empty for a new one) and `digest` that file's sha1:
	 * a file that changed since is a 409. A rename moves the file and the
	 * model's template.
	 */
	async save(body: any): Promise<{ status: number; body: any }> {
		if (!this.index.exists) return { status: 404, body: { error: 'This project has no docs collection' } }
		await this.index.refresh()
		const original = typeof body?.original === 'string' ? body.original.trim() : ''
		const preview = this.preview(body)
		if (preview.problems.length) return { status: 400, body: { error: preview.problems[0], problems: preview.problems } }
		const spec = preview.spec
		const target = this.fileFor(spec.name)

		let oldFile: string | null = null
		if (original) {
			const sources: Record<string, string> = this.markdownModels.state.get('sources') || {}
			oldFile = sources[original] ?? null
			const tile = oldFile ? this.readTileFile(oldFile) : null
			if (!oldFile || !tile || !tile.untouched) return { status: 409, body: { error: `${original} is not a model this tile can edit.` } }
			if (typeof body?.digest === 'string' && body.digest && tile.digest !== body.digest) {
				return { status: 409, body: { error: 'The model file changed on disk since you opened it.', view: await this.modelView(original) } }
			}
		}
		if (target !== oldFile && existsSync(target)) {
			return { status: 409, body: { error: `${this.index.display(target)} already exists.` } }
		}

		const text = modelFile(spec, this.yaml)
		mkdirSync(this.modelsDir, { recursive: true })
		writeFileSync(target, text, 'utf8')
		let movedTemplate = false
		if (oldFile && oldFile !== target) {
			unlinkSync(oldFile)
			const oldTemplate = this.templateFor(original)
			const newTemplate = this.container.paths.resolve(this.modelsDir, `${kebab(spec.name)}.template.md`)
			if (existsSync(oldTemplate) && !existsSync(newTemplate)) { renameSync(oldTemplate, newTemplate); movedTemplate = true }
		}
		const view = await this.modelView(spec.name)
		const loadError = (this.markdownModels.state.get('errors') || []).find((e: any) => e.model === spec.name || e.file === target)
		const renamed = original && original !== spec.name
		return {
			status: 200,
			body: {
				ok: true,
				view,
				loadError: loadError ? loadError.message : null,
				text: `Saved ${this.index.display(target)}${renamed ? ` (was ${original}${movedTemplate ? ', template moved' : ''}; the old name stays empty until the host restarts)` : ''}`,
			},
		}
	}

	/** Delete a model the tile wrote. Its documents and template stay. */
	async remove(body: any): Promise<{ status: number; body: any }> {
		const name = typeof body?.name === 'string' ? body.name : ''
		await this.index.refresh()
		const sources: Record<string, string> = this.markdownModels.state.get('sources') || {}
		const file = sources[name]
		const tile = file ? this.readTileFile(file) : null
		if (!file || !tile) return { status: 409, body: { error: `${name || 'That model'} is not a model this tile wrote.` } }
		unlinkSync(file)
		await this.index.refresh()
		return { status: 200, body: { ok: true, text: `Deleted ${this.index.display(file)}. Its documents stay.` } }
	}

	async modelView(name: string): Promise<ModelEditorView | undefined> {
		await this.index.refresh()
		const found = this.index.definitions().find((d) => d.def.name === name)
		if (!found) return undefined
		let count = 0
		for (const id of this.index.db.collection.items.keys()) if (this.index.modelOf(id) === name) count++
		return this.view(found.def, found.slot, count)
	}
}

// --- Queries ---------------------------------------------------------------

export const QUERY_OPS = ['eq', 'neq', 'in', 'notIn', 'gt', 'gte', 'lt', 'lte', 'contains', 'startsWith', 'endsWith', 'regex', 'exists'] as const
export type QueryOp = typeof QUERY_OPS[number]

export type QueryFilter = { path: string; op: QueryOp; value: string }
export type QuerySort = { path: string; direction: 'asc' | 'desc' }

export type QueryColumn = { key: string; title: string; kind: FieldKind }
export type QueryCell = { text: string | null; kind: FieldKind; items: string[] }
export type QueryRow = { id: string; title: string; address: string; cells: QueryCell[] }

/** A typed value from what was typed, by the field's kind. Pure. */
export function coerceValue(text: string, kind: FieldKind | undefined, op: QueryOp): unknown {
	const t = String(text ?? '').trim()
	if (op === 'exists') return t !== 'false'
	if (op === 'in' || op === 'notIn') return t.split(',').map((s) => s.trim()).filter(Boolean).map((s) => coerceValue(s, kind === 'array' ? 'string' : kind, 'eq'))
	if (op === 'regex' || op === 'contains' || op === 'startsWith' || op === 'endsWith') return t
	if (kind === 'number' && t !== '' && Number.isFinite(Number(t))) return Number(t)
	if (kind === 'boolean' && (t === 'true' || t === 'false')) return t === 'true'
	return t
}

/** Filters and sorts as the DSL's where and sort objects. Pure. */
export function whereOf(filters: QueryFilter[], kinds: Record<string, FieldKind>): Record<string, any> {
	const where: Record<string, any> = {}
	for (const f of filters) {
		if (!f.path || !(QUERY_OPS as readonly string[]).includes(f.op)) continue
		const value = coerceValue(f.value, kinds[f.path], f.op)
		const slot = where[f.path] && typeof where[f.path] === 'object' && !Array.isArray(where[f.path]) ? where[f.path] : {}
		slot[`$${f.op}`] = value
		where[f.path] = slot
	}
	return where
}

/**
 * Run a query on one model. The body is `{model, filters, sort, limit,
 * offset, columns}`, or `{model, where}` with the DSL's JSON as text.
 * Answers the rows as typed cells, the total before limit, and the DSL it
 * ran (`whereText`, `sortText`), so the query can be copied into code.
 */
export async function runQuery(index: DocsIndex, editor: ModelsEditor, body: any): Promise<{ status: number; body: any }> {
	const started = Date.now()
	if (!index.exists) return { status: 404, body: { ok: false, error: 'This project has no docs collection' } }
	await index.refresh()
	const name = typeof body?.model === 'string' ? body.model : ''
	const found = index.definitions().find((d) => d.def.name === name)
	if (!found) return { status: 200, body: { ok: false, error: `No model ${name || '(none)'}. Pick one of: ${index.definitions().map((d) => d.def.name).join(', ')}` } }
	const def = found.def

	const fields = name === 'Base' ? [] : modelFields(def)
	const kinds: Record<string, FieldKind> = { id: 'string', title: 'string', createdAt: 'date', updatedAt: 'date' }
	for (const f of fields) kinds[`meta.${f.name}`] = f.kind

	let where: Record<string, any>
	let sort: QuerySort[]
	try {
		where = typeof body?.where === 'string' && body.where.trim() ? JSON.parse(body.where) : whereOf(Array.isArray(body?.filters) ? body.filters : [], kinds)
		sort = typeof body?.sortText === 'string' && body.sortText.trim()
			? Object.entries(JSON.parse(body.sortText)).map(([path, direction]) => ({ path, direction: direction === 'desc' ? 'desc' : 'asc' }))
			: (Array.isArray(body?.sort) ? body.sort : []).filter((s: any) => s?.path).map((s: any) => ({ path: String(s.path), direction: s.direction === 'desc' ? 'desc' : 'asc' }))
	} catch (error: any) {
		return { status: 200, body: { ok: false, error: `That is not JSON: ${error?.message ?? error}` } }
	}

	let query = index.db.collection.query(def)
	try {
		for (const c of parseWhereClause(where)) query = query.where(c.path, c.operator, c.value)
	} catch (error: any) {
		return { status: 200, body: { ok: false, error: error?.message ?? String(error) } }
	}
	for (const s of sort) query = query.sort(s.path, s.direction)

	let all: any[]
	try { all = await query.fetchAll() } catch (error: any) {
		return { status: 200, body: { ok: false, error: error?.message ?? String(error) } }
	}
	const limit = Math.max(1, Math.min(Number(body?.limit) || 200, 1000))
	const offset = Math.max(0, Number(body?.offset) || 0)
	const page = all.slice(offset, offset + limit)

	const sectionKeys = Object.keys(def.sections ?? {})
	const asked: string[] = Array.isArray(body?.columns) && body.columns.length ? body.columns.map(String) : fields.map((f) => `meta.${f.name}`)
	const columns: QueryColumn[] = asked.map((key) => ({
		key,
		title: key.replace(/^meta\./, '').replace(/^sections\./, '§ '),
		kind: kinds[key] ?? 'value',
	}))

	const get = (inst: any, key: string): unknown => {
		if (key === 'id') return inst.id
		if (key === 'title') return inst.title
		if (key.startsWith('meta.')) return getPath(inst.meta, key.slice(5))
		if (key.startsWith('sections.')) {
			const k = key.slice(9)
			if (!sectionKeys.includes(k)) return undefined
			try { return inst.sections[k] } catch (error: any) { return `(error: ${error?.message ?? error})` }
		}
		try { return getPath(inst.toJSON(), key) } catch { return undefined }
	}

	const rows: QueryRow[] = page.map((inst: any) => ({
		id: String(inst.id),
		title: String(inst.title || inst.id),
		address: `doc/${inst.id}`,
		cells: columns.map((c) => {
			const v = get(inst, c.key)
			const kind = c.kind === 'value' ? valueKind(v) : c.kind
			return { text: valueText(v), kind, items: Array.isArray(v) ? v.map((x) => valueText(x) ?? '') : [] }
		}),
	}))

	// Every path the app can offer for a filter, sort or column.
	const paths = [
		{ key: 'id', kind: 'string' as FieldKind, options: [] as string[] },
		{ key: 'title', kind: 'string' as FieldKind, options: [] as string[] },
		...fields.map((f) => ({ key: `meta.${f.name}`, kind: f.kind, options: f.options })),
		...sectionKeys.map((k) => ({ key: `sections.${k}`, kind: 'value' as FieldKind, options: [] as string[] })),
	]

	return {
		status: 200,
		body: {
			ok: true,
			model: name,
			slot: found.slot,
			total: all.length,
			offset,
			limit,
			count: rows.length,
			columns,
			rows,
			paths,
			ops: QUERY_OPS,
			whereText: JSON.stringify(where),
			sortText: JSON.stringify(Object.fromEntries(sort.map((s) => [s.path, s.direction]))),
			code: queryCode(name, where, sort),
			ms: Date.now() - started,
		},
	}
}

/** The same query as container code. Pure. */
export function queryCode(model: string, where: Record<string, any>, sort: QuerySort[]): string {
	const parts = [`container.docs.query(container.docs.models.${model})`]
	for (const [path, value] of Object.entries(where)) {
		if (value && typeof value === 'object' && !Array.isArray(value)) {
			for (const [op, v] of Object.entries(value)) parts.push(`.where(${JSON.stringify(path)}, ${JSON.stringify(op.replace(/^\$/, ''))}, ${JSON.stringify(v)})`)
		} else parts.push(`.where(${JSON.stringify(path)}, ${JSON.stringify(value)})`)
	}
	for (const s of sort) parts.push(`.sort(${JSON.stringify(s.path)}, ${JSON.stringify(s.direction)})`)
	return `await ${parts.join('')}.fetchAll()`
}

function getPath(obj: any, path: string): unknown {
	let cur = obj
	for (const part of path.split('.')) {
		if (cur == null) return undefined
		cur = cur[part]
	}
	return cur
}

export { fieldKind }
