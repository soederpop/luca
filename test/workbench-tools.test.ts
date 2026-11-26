import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, symlinkSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadErrorText, shapeTool, shapeData, shapeStep, shapeResult, toneOf, tableMarkdown, ActionRuns } from '../src/workbench/tools'

const LUCA_ROOT = join(import.meta.dir, '..')
const CLI = join(LUCA_ROOT, 'src/cli/cli.ts')
const base = realpathSync(process.env.WORKBENCH_TEST_TMP || tmpdir())
const tempDirs: string[] = []
const own = { kind: 'own' as const, tag: 'project', label: 'this project' }

describe('shapeTool', () => {
	it('shapes a page tool and a view tool', () => {
		const page = shapeTool({ title: 'Board', page: '/board?x=1' }, 'board', own, 'workbench/board.ts') as any
		expect(page.view).toMatchObject({ id: 'board', kind: 'page', page: '/board?x=1', address: 'page/board?x=1', renderer: null, keys: [] })
		const url = shapeTool({ title: 'Docs', page: 'https://example.com/a' }, 'docs', own, 'f') as any
		expect(url.view.address).toBe('page/https://example.com/a')
		const view = shapeTool({ id: 'todo', title: 'Todo', renderer: 'stacks', data: () => [], actions: { add: { key: 'a', label: 'add one', run() {} } } }, 'x', own, 'f') as any
		expect(view.view).toMatchObject({ id: 'todo', kind: 'view', renderer: 'stacks', address: 'tool/todo', keys: [{ action: 'add', key: 'a', label: 'add one' }] })
	})

	it('says what is wrong with a bad shape', () => {
		const err = (spec: any) => (shapeTool(spec, 'f', own, 'f') as any).error as string
		expect(err(null)).toContain('not a tool object')
		expect(err({ page: '/x' })).toContain('title is required')
		expect(err({ title: 'x' })).toContain('page')
		expect(err({ title: 'x', page: '/a', data: () => 1 })).toContain('not both')
		expect(err({ title: 'x', data: 3 })).toContain('data must be a function')
		expect(err({ title: 'x', data: () => 1, renderer: 'chart' })).toContain('renderer "chart"')
		expect(err({ id: 'bad id', title: 'x', page: '/a' })).toContain('must be letters')
		expect(err({ id: 'actions', title: 'x', page: '/a' })).toContain('kept for the host')
		expect(err({ title: 'x', data: () => 1, actions: { go: { key: 'g g', run() {} } } })).toContain('one key')
		expect(err({ title: 'x', data: () => 1, actions: { go: { key: 'g' } } })).toContain('needs run')
	})
})

describe('loadErrorText', () => {
	it('reads a bun build syntax error as one line', () => {
		const msg = 'vm.loadModule: failed to load /x/a.ts.\n\nbun build said:\n4 |   this\n      ^\nerror: Expected "}" but found "this"\n    at /x/a.ts:4:3\n\nUnbundled fallback said:\nParse error'
		expect(loadErrorText(new Error(msg))).toBe('line 4:3: Expected "}" but found "this"')
		expect(loadErrorText(new Error('top level boom\n  at x'))).toBe('top level boom')
	})
})

describe('renderer shapes', () => {
	it('stacks: ids, tones, addresses and the raw cards', () => {
		const out = shapeData('stacks', { stacks: [
			{ title: 'To do', tone: 'warn', cards: [{ id: 't1', title: 'Write', tone: 'bad', address: '/helper/features/fs', due: 'mon' }, 'plain'] },
			{ title: 'To do', cards: [] },
		] }) as any
		expect(out.renderer).toBe('stacks')
		expect(out.stacks[0]).toMatchObject({ id: 'to-do', title: 'To do', tone: 'warn', count: 2 })
		expect(out.stacks[0].cards[0]).toMatchObject({ id: 't1', title: 'Write', tone: 'bad', address: 'helper/features/fs', subtitle: null })
		expect(out.stacks[0].cards[1]).toMatchObject({ id: '2', title: 'plain' })
		expect(out.stacks[1].id).toBe('to-do-')
		expect(out.rawCards.get('to-do\u0000t1').due).toBe('mon')
	})

	it('stacks: a bad shape is an error, not a throw', () => {
		expect((shapeData('stacks', { nope: 1 }) as any).error).toContain('stacks')
		expect((shapeData('stacks', [{ title: 'a' }]) as any).error).toContain('no cards array')
	})

	it('tree, markdown and table', () => {
		const tree = shapeData('tree', { a: 1, b: [1, 2] }) as any
		expect(tree.renderer).toBe('tree')
		expect(tree.tree.open).toBe(true)
		expect(tree.tree.children.map((c: any) => c.key)).toEqual(['a', 'b'])
		expect((shapeData('markdown', '# Hi') as any).markdown).toBe('# Hi')
		expect((shapeData('markdown', { markdown: 'x' }) as any).markdown).toBe('x')
		expect((shapeData('markdown', 3) as any).error).toContain('string')
		const table = shapeData('table', [{ a: 1, b: 'x|y' }, { a: 2 }]) as any
		expect(table.renderer).toBe('markdown')
		expect(table.markdown).toBe('| a | b |\n| --- | --- |\n| 1 | x\\|y |\n| 2 |  |')
		expect(tableMarkdown({ columns: ['n'], rows: [] })).toContain('_No rows._')
		expect(tableMarkdown(5)).toBeNull()
	})

	it('infers a renderer when none is named', () => {
		expect((shapeData(null, [{ title: 'a', cards: [] }]) as any).renderer).toBe('stacks')
		expect((shapeData(null, 'text') as any).renderer).toBe('markdown')
		expect((shapeData(null, { x: 1 }) as any).renderer).toBe('tree')
	})

	it('tones', () => {
		expect(toneOf('good')).toBe('good')
		expect(toneOf(3)).toBe('slot:3')
		expect(toneOf('slot:2')).toBe('slot:2')
		expect(toneOf('hotpink')).toBeNull()
	})
})

describe('action steps', () => {
	it('shapes steps and results', () => {
		expect(shapeStep({ kind: 'choose', title: 'Which', items: ['a', { title: 'B', detail: 'd', value: 7 }] })).toEqual({
			shown: { kind: 'choose', title: 'Which', items: [{ title: 'a', detail: '' }, { title: 'B', detail: 'd' }] }, values: ['a', 7],
		})
		expect(shapeStep({ ask: 'Name?' }).shown).toEqual({ kind: 'ask', title: 'Name?', initial: '' })
		expect(shapeStep({ confirm: 'Sure?' }).shown).toEqual({ kind: 'confirm', question: 'Sure?', yes: 'Yes' })
		expect(() => shapeStep({ kind: 'form' })).toThrow('choose, ask or confirm')
		expect(() => shapeStep({ kind: 'choose', items: [] })).toThrow('non-empty')
		expect(shapeResult('done')).toEqual({ flash: 'done', reload: true, open: null })
		expect(shapeResult({ reload: false, open: '/doc/x' })).toEqual({ flash: null, reload: false, open: 'doc/x' })
	})

	it('runs choose, ask, confirm, then done', async () => {
		const runs = new ActionRuns()
		const seen: any[] = []
		const r1 = await runs.start('t.a', async function* () {
			seen.push(yield { kind: 'choose', title: 'col', items: [{ title: 'Doing', value: 'doing' }, 'Done'] })
			seen.push(yield { kind: 'ask', title: 'name' })
			seen.push(yield { kind: 'confirm', question: 'ok?' })
			return { flash: 'added' }
		})
		expect(r1.body).toMatchObject({ ok: true, done: false, step: { kind: 'choose' } })
		const r2 = await runs.answer(r1.body.token, { value: 0 })
		expect(r2.body.step.kind).toBe('ask')
		const r3 = await runs.answer(r2.body.token, { value: 'milk' })
		expect(r3.body.step.kind).toBe('confirm')
		const r4 = await runs.answer(r3.body.token, { value: true })
		expect(r4.body).toEqual({ ok: true, done: true, result: { flash: 'added', reload: true, open: null } })
		expect(seen).toEqual(['doing', 'milk', true])
		expect(runs.size).toBe(0)
	})

	it('cancel returns the generator, so its finally runs', async () => {
		const runs = new ActionRuns()
		let cleaned = false
		const r1 = await runs.start('t.c', async function* () {
			try { yield { ask: 'x' }; throw new Error('should not get here') } finally { cleaned = true }
		})
		const r2 = await runs.cancel(r1.body.token)
		expect(r2.body).toMatchObject({ ok: true, done: true, cancelled: true })
		expect(cleaned).toBe(true)
		expect((await runs.answer(r1.body.token, { value: 'x' })).status).toBe(404)
		// A null answer (Esc in the palette) cancels too.
		const r3 = await runs.start('t.c', async function* () { yield { confirm: 'x' } })
		expect((await runs.answer(r3.body.token, { value: null })).body.cancelled).toBe(true)
	})

	it('a plain async function, a throw and a bad step', async () => {
		const runs = new ActionRuns()
		expect((await runs.start('t.p', async () => ({ flash: 'hi', reload: false }))).body).toEqual({ ok: true, done: true, result: { flash: 'hi', reload: false, open: null } })
		expect((await runs.start('t.t', async () => { throw new Error('nope') })).body).toEqual({ ok: false, error: 't.t threw: nope' })
		expect((await runs.start('t.b', async function* () { yield { kind: 'dance' } })).body.error).toContain('dance')
		const r = await runs.start('t.i', async function* () { yield { choose: ['a'] } })
		expect((await runs.answer(r.body.token, { value: 4 })).status).toBe(400)
	})
})

// --- A real host on a scratch project with a plugin ---

const TODO_TOOL = `const file = (ctx) => ctx.container.paths.resolve('todos.json')
const read = (ctx) => ctx.container.fs.readJson(file(ctx))
const write = (ctx, todos) => ctx.container.fs.writeJson(file(ctx), todos)
export default {
  id: 'todo',
  title: 'Todo board',
  hint: 'a tiny board',
  renderer: 'stacks',
  data(ctx) {
    const todos = read(ctx)
    const cols = ['todo', 'done']
    return { stacks: cols.map((c, i) => ({ id: c, title: c, tone: i === 0 ? 'warn' : 'good',
      cards: todos.filter((t) => t.col === c).map((t) => ({ id: t.id, title: t.title, note: 'raw' })) })) }
  },
  actions: {
    add: {
      key: 'a', label: 'add a todo',
      async *run(ctx) {
        const col = yield { kind: 'choose', title: 'Column', items: [{ title: 'To do', value: 'todo' }, { title: 'Done', value: 'done' }] }
        const title = yield { kind: 'ask', title: 'Title' }
        const ok = yield { kind: 'confirm', question: 'Add ' + title + '?', yes: 'Add' }
        if (!ok) return { flash: 'not added', reload: false }
        const todos = read(ctx)
        todos.push({ id: 't' + (todos.length + 1), title, col })
        write(ctx, todos)
        return { flash: 'added ' + title }
      },
    },
    finish: {
      key: 'x', label: 'mark done',
      async run(ctx, target) {
        const todos = read(ctx)
        const t = todos.find((t) => t.id === target.id)
        t.col = 'done'
        write(ctx, todos)
        return 'done: ' + t.title + ' (' + target.note + ')'
      },
    },
  },
}
`

function makeProject(plugin: string) {
	const dir = mkdtempSync(join(base, 'luca-workbench-tools-'))
	tempDirs.push(dir)
	writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'wb-tools', version: '0.0.0' }))
	writeFileSync(join(dir, 'todos.json'), JSON.stringify([{ id: 't1', title: 'milk', col: 'todo' }]))
	writeFileSync(join(dir, '.env'), `LUCA_PLUGINS=${plugin}\n`)
	mkdirSync(join(dir, 'workbench'))
	writeFileSync(join(dir, 'workbench', 'todo.ts'), TODO_TOOL)
	writeFileSync(join(dir, 'workbench', 'site.ts'), `export default { title: 'Site', page: '/site/index.html', glyph: 'globe' }\n`)
	writeFileSync(join(dir, 'workbench', 'facts.ts'), `export default [
  { id: 'facts', title: 'Facts', renderer: 'tree', data: (ctx) => ({ cwd: ctx.container.cwd.length > 0, params: ctx.params }) },
  { id: 'notes', title: 'Notes', renderer: 'markdown', data: () => '# Notes\\n\\nSome *prose*.' },
  { id: 'rows', title: 'Rows', renderer: 'table', data: () => [{ a: 1 }] },
  { id: 'oops', title: 'Oops', data: () => { throw new Error('data broke') } },
]\n`)
	writeFileSync(join(dir, 'workbench', 'broken.ts'), `export default {\n  this is not code\n`)
	writeFileSync(join(dir, 'workbench', 'shape.ts'), `export default { title: 'No data' }\n`)
	writeFileSync(join(dir, 'workbench', 'throws.ts'), `throw new Error('top level boom')\n`)
	return dir
}

function makePlugin(pluginsDir: string) {
	const src = mkdtempSync(join(base, 'luca-workbench-toolplugin-'))
	tempDirs.push(src)
	writeFileSync(join(src, 'luca.plugin.ts'), `export function attach(container) { return container }\n`)
	mkdirSync(join(src, 'workbench'))
	writeFileSync(join(src, 'workbench', 'pluggy.ts'), `export default { id: 'pluggy', title: 'From the plugin', data: () => 'plugin prose' }\n`)
	writeFileSync(join(src, 'workbench', 'todo.ts'), `export default { id: 'todo', title: 'Shadowed', page: '/x' }\n`)
	mkdirSync(pluginsDir, { recursive: true })
	symlinkSync(src, join(pluginsDir, 'toolplug'))
	return join(pluginsDir, 'toolplug')
}

type Proc = ReturnType<typeof Bun.spawn>
let proc: Proc
let wbBase = ''
let token = ''

async function readFirstLine(p: Proc, timeoutMs = 60000): Promise<string> {
	const reader = (p.stdout as ReadableStream<Uint8Array>).getReader()
	const dec = new TextDecoder()
	let buf = ''
	const deadline = Date.now() + timeoutMs
	while (Date.now() < deadline) {
		const r = await Promise.race([reader.read(), new Promise<null>((res) => setTimeout(() => res(null), Math.max(1, deadline - Date.now())))])
		if (r === null || r.done) break
		buf += dec.decode(r.value)
		const i = buf.indexOf('\n')
		if (i >= 0) { reader.releaseLock(); return buf.slice(0, i) }
	}
	throw new Error('no first line on stdout; got: ' + JSON.stringify(buf))
}

const get = (path: string) => fetch(wbBase + path, { headers: { Authorization: `Bearer ${token}` } })
const post = (path: string, body: any = {}) => fetch(wbBase + path, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(body) })

let proj = ''

beforeAll(async () => {
	const plugins = mkdtempSync(join(base, 'luca-workbench-toolplugins-'))
	tempDirs.push(plugins)
	const pluginPath = makePlugin(join(plugins, 'dir'))
	proj = makeProject(pluginPath)
	const env: Record<string, string> = { ...(process.env as any), LUCA_WORKBENCH_PLUGINS_DIR: join(plugins, 'dir') }
	delete env.LUCA_PLUGINS
	proc = Bun.spawn(['bun', 'run', CLI, 'workbench'], { cwd: proj, stdin: 'pipe', stdout: 'pipe', stderr: 'ignore', env })
	const info = JSON.parse(await readFirstLine(proc))
	wbBase = `http://127.0.0.1:${info.port}`
	token = info.token
}, 120000)

afterAll(() => {
	try { proc?.kill() } catch {}
	for (const d of tempDirs) { try { rmSync(d, { recursive: true, force: true }) } catch {} }
})

describe('GET /tools on a real host', () => {
	it('lists the project and plugin tools, and the broken ones as errors', async () => {
		const view = await (await get('/tools')).json() as any
		const ids = view.tools.map((t: any) => t.id)
		expect(ids).toEqual(['facts', 'notes', 'rows', 'oops', 'site', 'todo', 'pluggy'])
		const todo = view.tools.find((t: any) => t.id === 'todo')
		expect(todo).toMatchObject({ kind: 'view', renderer: 'stacks', address: 'tool/todo', fileDisplay: 'workbench/todo.ts', origin: { kind: 'own', tag: 'project' } })
		expect(todo.keys.map((k: any) => k.key)).toEqual(['a', 'x'])
		expect(view.tools.find((t: any) => t.id === 'site')).toMatchObject({ kind: 'page', address: 'page/site/index.html', glyph: 'globe' })
		const pluggy = view.tools.find((t: any) => t.id === 'pluggy')
		expect(pluggy.origin).toMatchObject({ kind: 'plugin', tag: 'plugin · toolplug', plugin: 'toolplug' })
		expect(pluggy.fileDisplay).toBe('toolplug/workbench/pluggy.ts')
		const errs = Object.fromEntries(view.errors.map((e: any) => [e.fileDisplay.split('/').pop(), e.error]))
		expect(Object.keys(errs).sort()).toEqual(['broken.ts', 'shape.ts', 'throws.ts', 'todo.ts'])
		expect(errs['throws.ts']).toContain('top level boom')
		expect(errs['broken.ts']).toMatch(/^line \d+:\d+: /)
		expect(errs['shape.ts']).toContain('page')
		expect(errs['todo.ts']).toContain('taken by workbench/todo.ts')
		expect(view.notice).toBeNull()
	})

	it('serves each renderer shape', async () => {
		const tree = await (await get('/tools/facts?who=me')).json() as any
		expect(tree).toMatchObject({ ok: true, renderer: 'tree' })
		expect(tree.tree.children.find((c: any) => c.key === 'params').children[0]).toMatchObject({ key: 'who', text: '"me"' })
		const notes = await (await get('/tools/notes')).json() as any
		expect(notes).toMatchObject({ ok: true, renderer: 'markdown', markdown: '# Notes\n\nSome *prose*.' })
		expect((await (await get('/tools/rows')).json() as any).markdown).toContain('| a |')
		const board = await (await get('/tools/todo')).json() as any
		expect(board).toMatchObject({ ok: true, renderer: 'stacks', title: 'Todo board' })
		expect(board.stacks.map((s: any) => [s.id, s.tone, s.count])).toEqual([['todo', 'warn', 1], ['done', 'good', 0]])
		expect((await (await get('/tools/pluggy')).json() as any).markdown).toBe('plugin prose')
		expect((await (await get('/tools/site')).json() as any)).toMatchObject({ ok: true, kind: 'page', renderer: null })
	})

	it('errors are readable answers, never a crash', async () => {
		const oops = await (await get('/tools/oops')).json() as any
		expect(oops).toMatchObject({ ok: false, error: 'data() threw: data broke' })
		expect((await get('/tools/nothere')).status).toBe(404)
		// A file that did not load answers by its name, with the reason.
		const broken = await (await get('/tools/broken')).json() as any
		expect(broken).toMatchObject({ ok: false, declarationError: true })
		expect(broken.error).toMatch(/^workbench\/broken\.ts: line \d+:\d+: /)
		// The host is still fine.
		expect((await get('/tools')).status).toBe(200)
	})

	it('runs an action: choose, ask, confirm, then the data changes', async () => {
		let r = await (await post('/tools/todo/actions/add', { target: null })).json() as any
		expect(r.step).toEqual({ kind: 'choose', title: 'Column', items: [{ title: 'To do', detail: '' }, { title: 'Done', detail: '' }] })
		r = await (await post(`/tools/actions/${r.token}/answer`, { value: 0 })).json() as any
		expect(r.step.kind).toBe('ask')
		r = await (await post(`/tools/actions/${r.token}/answer`, { value: 'bread' })).json() as any
		expect(r.step).toEqual({ kind: 'confirm', question: 'Add bread?', yes: 'Add' })
		r = await (await post(`/tools/actions/${r.token}/answer`, { value: true })).json() as any
		expect(r).toEqual({ ok: true, done: true, result: { flash: 'added bread', reload: true, open: null } })
		const board = await (await get('/tools/todo')).json() as any
		expect(board.stacks[0].cards.map((c: any) => c.title)).toEqual(['milk', 'bread'])
	})

	it('cancels an action, and passes the author card as the target', async () => {
		const r = await (await post('/tools/todo/actions/add')).json() as any
		const c = await (await post(`/tools/actions/${r.token}/cancel`)).json() as any
		expect(c).toMatchObject({ ok: true, cancelled: true })
		expect((await post(`/tools/actions/${r.token}/answer`, { value: 0 })).status).toBe(404)
		await get('/tools/todo')
		const done = await (await post('/tools/todo/actions/finish', { target: { stack: 'todo', card: 't1' } })).json() as any
		expect(done).toEqual({ ok: true, done: true, result: { flash: 'done: milk (raw)', reload: true, open: null } })
		expect(JSON.parse(readFileSync(join(proj, 'todos.json'), 'utf8'))[0].col).toBe('done')
	})

	it('picks up an edited declaration without a restart', async () => {
		writeFileSync(join(proj, 'workbench', 'notes.ts'), `export default { id: 'fresh', title: 'Fresh', data: () => 'new' }\n`)
		const view = await (await get('/tools')).json() as any
		expect(view.tools.map((t: any) => t.id)).toContain('fresh')
	})
})
