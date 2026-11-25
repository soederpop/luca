import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, realpathSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { coerceValue, fieldCode, kebab, modelBody, normalizeSpec, queryCode, sectionCode, specProblems, suggestPrefix, whereOf } from '../src/workbench/models'

// The contentbase tile: models written as docs/models/<name>.md, and queries.
const CLI = join(import.meta.dir, '..', 'src/cli/cli.ts')
const base = realpathSync(process.env.WORKBENCH_TEST_TMP || tmpdir())
const tempDirs: string[] = []

const MODELS = `import { defineModel } from 'contentbase'
import { z } from 'zod'
export const Note = defineModel('Note', { prefix: 'notes', meta: z.object({ status: z.enum(['draft', 'done']).default('draft'), priority: z.number().optional() }) })
`

function makeProject(): string {
	const dir = mkdtempSync(join(base, 'luca-workbench-models-'))
	tempDirs.push(dir)
	writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'wb-models', version: '0.0.0' }))
	mkdirSync(join(dir, 'docs', 'notes'), { recursive: true })
	mkdirSync(join(dir, 'docs', 'customers'), { recursive: true })
	mkdirSync(join(dir, 'docs', 'models'), { recursive: true })
	writeFileSync(join(dir, 'docs', 'models.ts'), MODELS)
	writeFileSync(join(dir, 'docs', 'notes', 'a.md'), '---\nstatus: done\npriority: 3\n---\n\n# Alpha\n')
	writeFileSync(join(dir, 'docs', 'notes', 'b.md'), '---\nstatus: draft\npriority: 1\n---\n\n# Bravo\n')
	writeFileSync(join(dir, 'docs', 'notes', 'c.md'), '---\nstatus: done\npriority: 2\n---\n\n# Charlie\n')
	writeFileSync(join(dir, 'docs', 'customers', 'acme.md'), '---\ntier: paid\nseats: 12\n---\n\n# Acme\n\n## Notes\n\nGood people.\n\n## Contacts\n\n- Ann\n- Bo\n')
	writeFileSync(join(dir, 'docs', 'models', 'hand.md'), "## Vendor\n\n```ts\n({ prefix: 'vendors' })\n```\n")
	return dir
}

const SPEC = {
	name: 'Customer',
	prefix: 'customers',
	description: 'A company we sell to.',
	fields: [
		{ name: 'tier', type: 'enum', options: ['free', 'paid'], default: 'free', required: false, description: 'Billing tier' },
		{ name: 'seats', type: 'number', required: false, default: '', description: '' },
		{ name: 'tags', type: 'list', required: false, default: '', description: '' },
	],
	sections: [
		{ key: 'notes', heading: 'Notes', extract: 'text', alternatives: [] },
		{ key: 'contacts', heading: 'Contacts', extract: 'list', alternatives: ['People'] },
	],
}

describe('pure parts', () => {
	it('writes fields and sections as zod and contentbase code', () => {
		const spec = normalizeSpec(SPEC)
		expect(fieldCode(spec.fields[0]!)).toBe("z.enum(['free', 'paid']).default('free').describe('Billing tier')")
		expect(fieldCode(spec.fields[1]!)).toBe('z.number().optional()')
		expect(fieldCode({ ...spec.fields[2]!, default: 'a, b' })).toBe("z.array(z.string()).default(['a', 'b'])")
		expect(fieldCode({ ...spec.fields[1]!, required: true })).toBe('z.number()')
		expect(sectionCode(spec.sections[1]!)).toBe("section('Contacts', { extract: extract.list, schema: z.array(z.string()).default([]), alternatives: ['People'] })")
		expect(modelBody(spec)).toContain("## Customer\n\nA company we sell to.\n\n```ts\n({\n  prefix: 'customers',")
	})

	it('names the problems in a spec', () => {
		expect(specProblems(normalizeSpec(SPEC))).toEqual([])
		expect(specProblems(normalizeSpec({ ...SPEC, name: 'customer' }))[0]).toContain('not a model name')
		expect(specProblems(normalizeSpec(SPEC), ['Customer'])[0]).toContain('already exists')
		expect(specProblems(normalizeSpec({ ...SPEC, prefix: 'models' }))[0]).toContain('model files')
		const bad = normalizeSpec({ ...SPEC, fields: [{ name: 'tier', type: 'enum', options: ['a'], default: 'b' }, { name: 'tier', type: 'string' }] })
		expect(specProblems(bad)).toEqual(['Field tier: the default "b" is not one of its values.', 'Field "tier" is there twice.'])
	})

	it('builds the where clause, typed by field kind', () => {
		expect(coerceValue('3', 'number', 'gt')).toBe(3)
		expect(coerceValue('a, b', 'string', 'in')).toEqual(['a', 'b'])
		expect(whereOf([{ path: 'meta.priority', op: 'gte', value: '1' }, { path: 'meta.priority', op: 'lt', value: '3' }], { 'meta.priority': 'number' }))
			.toEqual({ 'meta.priority': { $gte: 1, $lt: 3 } })
		expect(queryCode('Note', { 'meta.status': { $eq: 'done' } }, [{ path: 'meta.priority', direction: 'desc' }]))
			.toBe('await container.docs.query(container.docs.models.Note).where("meta.status", "eq", "done").sort("meta.priority", "desc").fetchAll()')
		expect(kebab('SalesLead')).toBe('sales-lead')
		expect(suggestPrefix('Company')).toBe('companies')
	})
})

type Proc = ReturnType<typeof Bun.spawn>
let proc: Proc
let proj: string
let api: { get(p: string): Promise<Response>; post(p: string, b?: any): Promise<Response> }

async function firstLine(p: Proc): Promise<string> {
	const reader = (p.stdout as ReadableStream<Uint8Array>).getReader()
	const dec = new TextDecoder()
	let buf = ''
	while (true) {
		const r = await reader.read()
		if (r.done) throw new Error('host ended: ' + buf)
		buf += dec.decode(r.value)
		const i = buf.indexOf('\n')
		if (i >= 0) { reader.releaseLock(); return buf.slice(0, i) }
	}
}

beforeAll(async () => {
	proj = makeProject()
	proc = Bun.spawn(['bun', 'run', CLI, 'workbench'], { cwd: proj, stdin: 'pipe', stdout: 'pipe', stderr: 'ignore', env: { ...process.env, XDG_CACHE_HOME: join(proj, '.cache') } })
	const info = JSON.parse(await firstLine(proc))
	const headers = { Authorization: `Bearer ${info.token}`, 'content-type': 'application/json' }
	const root = `http://127.0.0.1:${info.port}`
	api = {
		get: (p) => fetch(root + p, { headers }),
		post: (p, b = {}) => fetch(root + p, { method: 'POST', headers, body: JSON.stringify(b) }),
	}
}, 120000)

afterAll(() => {
	try { proc?.kill() } catch {}
	for (const d of tempDirs) { try { rmSync(d, { recursive: true, force: true }) } catch {} }
})

describe('host', () => {
	it('lists models with where they come from', async () => {
		const view: any = await (await api.get('/contentbase')).json()
		const by = Object.fromEntries(view.models.map((m: any) => [m.name, m]))
		expect(by.Note.source).toBe('models-file')
		expect(by.Note.editable).toBe(false)
		expect(by.Vendor.source).toBe('workspace')
		expect(by.Vendor.file).toBe('docs/models/hand.md')
		expect(by.Base.source).toBe('builtin')
		expect(view.fieldTypes).toContain('enum')
	})

	it('saves a new model as docs/models/<name>.md, reads it back, and matches its documents', async () => {
		const preview: any = await (await api.post('/contentbase/preview', { spec: SPEC })).json()
		expect(preview.problems).toEqual([])
		expect(preview.file).toBe('docs/models/customer.md')

		const saved: any = await (await api.post('/contentbase/save', { spec: SPEC })).json()
		expect(saved.ok).toBe(true)
		expect(saved.loadError).toBeNull()
		expect(saved.view.editable).toBe(true)
		expect(saved.view.source).toBe('tile')
		expect(saved.view.count).toBe(1)
		expect(saved.view.spec).toEqual(normalizeSpec(SPEC))
		expect(saved.view.sections.map((s: any) => s.extract)).toEqual(['text', 'list'])
		expect(saved.view.template.file).toBe('docs/models/customer.template.md')
		expect(readFileSync(join(proj, 'docs/models/customer.md'), 'utf8')).toContain('luca-model:')

		// A second save of a new model by the same name is refused.
		expect((await api.post('/contentbase/save', { spec: SPEC })).status).toBe(400)
	})

	it('queries with typed rows, sections included', async () => {
		const r: any = await (await api.post('/contentbase/query', { model: 'Customer', columns: ['meta.tier', 'meta.seats', 'sections.contacts'] })).json()
		expect(r.ok).toBe(true)
		expect(r.rows[0].title).toBe('Acme')
		expect(r.rows[0].cells.map((c: any) => c.kind)).toEqual(['enum', 'number', 'array'])
		expect(r.rows[0].cells[2].items).toEqual(['Ann', 'Bo'])

		const n: any = await (await api.post('/contentbase/query', {
			model: 'Note',
			filters: [{ path: 'meta.status', op: 'eq', value: 'done' }],
			sort: [{ path: 'meta.priority', direction: 'desc' }],
			columns: ['meta.priority'],
		})).json()
		expect(n.rows.map((x: any) => x.title)).toEqual(['Alpha', 'Charlie'])
		expect(n.total).toBe(2)
		expect(n.whereText).toBe('{"meta.status":{"$eq":"done"}}')

		const raw: any = await (await api.post('/contentbase/query', { model: 'Note', where: '{"meta.priority": {"$lt": 2}}' })).json()
		expect(raw.rows.map((x: any) => x.id)).toEqual(['notes/b'])
		const bad: any = await (await api.post('/contentbase/query', { model: 'Note', where: '{"meta.x": {"$nope": 1}}' })).json()
		expect(bad.ok).toBe(false)
	})

	it('edits, renames with the template, and refuses a stale digest', async () => {
		const view: any = await (await api.get('/contentbase/model?name=Customer')).json()
		writeFileSync(join(proj, 'docs/models/customer.template.md'), '---\ntier: free\n---\n\n# New customer\n')
		const spec = { ...view.spec, name: 'Account', prefix: 'customers' }
		const stale: any = await api.post('/contentbase/save', { spec, original: 'Customer', digest: 'nope' })
		expect(stale.status).toBe(409)
		const saved: any = await (await api.post('/contentbase/save', { spec, original: 'Customer', digest: view.digest })).json()
		expect(saved.ok).toBe(true)
		expect(existsSync(join(proj, 'docs/models/customer.md'))).toBe(false)
		expect(existsSync(join(proj, 'docs/models/account.template.md'))).toBe(true)
		const list: any = await (await api.get('/contentbase')).json()
		expect(list.models.map((m: any) => m.name)).toContain('Account')
		expect(list.models.map((m: any) => m.name)).not.toContain('Customer')
	})

	it('makes a hand-edited tile file read only, and deletes only tile files', async () => {
		const file = join(proj, 'docs/models/account.md')
		writeFileSync(file, readFileSync(file, 'utf8').replace("prefix: 'customers',", "prefix: 'customers', // mine"))
		const view: any = await (await api.get('/contentbase/model?name=Account')).json()
		expect(view.editable).toBe(false)
		expect(view.readOnlyNote).toContain('by hand')
		expect((await api.post('/contentbase/delete', { name: 'Vendor' })).status).toBe(409)
		const gone: any = await (await api.post('/contentbase/delete', { name: 'Account' })).json()
		expect(gone.ok).toBe(true)
		expect(existsSync(file)).toBe(false)
	})
})
