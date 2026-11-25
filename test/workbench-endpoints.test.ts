import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildRequest, coerce, fieldOf, fieldsOf, groupRoutes, sizeText, type RouteView } from '../src/workbench/endpoints'

const LUCA_ROOT = '/Users/jonathansoeder/@luca'
const CLI = join(LUCA_ROOT, 'src/cli/cli.ts')
const base = process.env.WORKBENCH_TEST_TMP || tmpdir()
const tempDirs: string[] = []

function makeProject(withEndpoints = true): string {
	const dir = mkdtempSync(join(base, 'luca-workbench-ep-'))
	tempDirs.push(dir)
	writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'wb-ep-project', version: '0.0.0' }))
	if (!withEndpoints) return dir
	mkdirSync(join(dir, 'endpoints', 'users'), { recursive: true })
	writeFileSync(
		join(dir, 'endpoints', 'users.ts'),
		`import { z } from 'zod'
export const path = '/users'
export const description = 'List or add users'
export const tags = ['users']
export const getSchema = z.object({
  q: z.string().optional().describe('Part of a name'),
  limit: z.coerce.number().default(10).describe('How many'),
})
const all = [{ id: 1, name: 'Ada' }, { id: 2, name: 'Grace' }, { id: 3, name: 'Alan' }]
export async function get(params: any) {
  const list = all.filter((u) => !params.q || u.name.toLowerCase().includes(String(params.q).toLowerCase()))
  return { count: list.length, users: list.slice(0, params.limit) }
}
export const postSchema = z.object({
  name: z.string().describe('Full name'),
  role: z.enum(['admin', 'member']).default('member'),
  age: z.number().optional(),
})
export async function post(params: any, ctx: any) {
  ctx.response.status(201)
  return { created: { name: params.name, role: params.role, age: params.age ?? null } }
}
`,
	)
	writeFileSync(
		join(dir, 'endpoints', 'users', 'one.ts'),
		`export const path = '/users/:id'
export const tags = ['users']
export async function get(params: any, ctx: any) {
  if (params.id === 'nobody') { ctx.response.status(404); return { error: 'no such user' } }
  return { id: params.id }
}
`,
	)
	writeFileSync(join(dir, 'endpoints', 'health.ts'), `export const path = '/health'\nexport async function get() { return 'fine' }\n`)
	writeFileSync(join(dir, 'endpoints', 'broken.ts'), `export const path = '/broken'\nthis is not code\n`)
	return dir
}

type Proc = ReturnType<typeof Bun.spawn>
interface Running { proc: Proc; port: number; token: string; base: string }

async function readFirstLine(proc: Proc, timeoutMs = 60000): Promise<string> {
	const reader = (proc.stdout as ReadableStream<Uint8Array>).getReader()
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

async function start(cwd: string): Promise<Running> {
	const proc = Bun.spawn(['bun', 'run', CLI, 'workbench'], { cwd, stdin: 'pipe', stdout: 'pipe', stderr: 'ignore' })
	const info = JSON.parse(await readFirstLine(proc))
	return { proc, port: info.port, token: info.token, base: `http://127.0.0.1:${info.port}` }
}

function alive(pid: number): boolean {
	try { process.kill(pid, 0); return true } catch { return false }
}

async function until(test: () => boolean | Promise<boolean>, ms = 30000) {
	const deadline = Date.now() + ms
	while (Date.now() < deadline && !(await test())) await Bun.sleep(100)
	return await test()
}

/** The pid listening on a port, from lsof. */
function pidOnPort(port: number): number | null {
	const out = Bun.spawnSync(['lsof', '-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t']).stdout.toString().trim()
	return out ? Number(out.split('\n')[0]) : null
}

const client = (wb: Running) => {
	const headers = { Authorization: `Bearer ${wb.token}`, 'content-type': 'application/json' }
	return {
		get: async (path: string) => fetch(wb.base + path, { headers }),
		post: async (path: string, body: any = {}) => fetch(wb.base + path, { method: 'POST', headers, body: JSON.stringify(body) }),
	}
}

let proj: string
let wb: Running
let api: ReturnType<typeof client>

beforeAll(async () => {
	proj = makeProject()
	wb = await start(proj)
	api = client(wb)
}, 120000)

afterAll(async () => {
	try { await api.post('/serve/stop') } catch {}
	try { wb?.proc.kill() } catch {}
	for (const d of tempDirs) { try { rmSync(d, { recursive: true, force: true }) } catch {} }
})

describe('pure parts', () => {
	const route: Pick<RouteView, 'method' | 'path' | 'fields' | 'body'> = {
		method: 'GET',
		path: '/users/:id/posts/:slug?',
		body: false,
		fields: [
			fieldOf('id', 'path', { type: 'string' }, true),
			fieldOf('slug', 'path', { type: 'string' }, false),
			fieldOf('tags', 'query', { type: 'array' }, false),
			fieldOf('limit', 'query', { type: 'number' }, false),
		],
	}
	it('fills path params, drops an empty optional one, repeats array query params', () => {
		expect(buildRequest(route, { id: 'a b', tags: 'x, y', limit: '5' })).toEqual({ url: '/users/a%20b/posts?tags=x&tags=y&limit=5', body: null, missing: [] })
		expect(buildRequest(route, { id: '1', slug: 'hi' }).url).toBe('/users/1/posts/hi')
		expect(buildRequest(route, {}).missing).toEqual(['id'])
	})
	it('a body from typed fields, or the raw text as is', () => {
		const post = { method: 'POST', path: '/x', body: true, fields: [fieldOf('n', 'body', { type: 'number' }, true), fieldOf('ok', 'body', { type: 'boolean' }, false), fieldOf('meta', 'body', { type: 'object' }, false)] }
		expect(buildRequest(post, { n: '3', ok: 'yes', meta: '{"a":1}' })).toEqual({ url: '/x', body: '{"n":3,"ok":true,"meta":{"a":1}}', missing: [] })
		expect(buildRequest(post, {}).missing).toEqual(['n'])
		expect(buildRequest(post, {}, '{"n":9}')).toEqual({ url: '/x', body: '{"n":9}', missing: [] })
	})
	it('coerce leaves text it cannot read, so the server says why', () => {
		expect(coerce({ type: 'number' }, 'abc')).toBe('abc')
		expect(coerce({ type: 'integer' }, ' 7 ')).toBe(7)
		expect(coerce({ type: 'array' }, '[1,2]')).toEqual([1, 2])
		expect(coerce({ type: 'string' }, '')).toBeUndefined()
	})
	it('fields: enum options, defaults as text, a default is never required, nullable reads as its type', () => {
		expect(fieldOf('r', 'body', { type: 'string', enum: ['a', 'b'], default: 'a' }, true)).toEqual({ name: 'r', in: 'body', type: 'enum', required: false, description: '', default: 'a', options: ['a', 'b'] })
		expect(fieldOf('n', 'query', { anyOf: [{ type: 'number' }, { type: 'null' }], default: 3 }, false).type).toBe('number')
		expect(fieldOf('n', 'query', { type: 'number', default: 3 }, false).default).toBe('3')
		const op = { parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], requestBody: { content: { 'multipart/form-data': { schema: { properties: { file: { type: 'string', format: 'binary' }, note: { type: 'string' } }, required: ['note'] } } } } }
		expect(fieldsOf(op).map((f) => `${f.in}:${f.name}:${f.required}`)).toEqual(['path:id:true', 'body:note:true'])
	})
	it('groups by tag, then by first path segment; methods in order', () => {
		const r = (method: string, path: string, tags: string[] = []) => ({ method, path, tags }) as RouteView
		const groups = groupRoutes([r('POST', '/users', ['users']), r('GET', '/health'), r('GET', '/users', ['users']), r('GET', '/a/b')])
		expect(groups.map((g) => g.tag)).toEqual(['users', '/a', '/health'])
		expect(groups[0]!.routes.map((x) => x.method)).toEqual(['GET', 'POST'])
	})
	it('sizeText', () => {
		expect(sizeText(12)).toBe('12 B')
		expect(sizeText(2048)).toBe('2.0 KB')
	})
})

describe('GET /endpoints', () => {
	it('lists the routes without a server, grouped, with fields; a broken file is named', async () => {
		const res = await api.get('/endpoints')
		expect(res.status).toBe(200)
		const j: any = await res.json()
		expect(j.dirDisplay).toBe('endpoints/')
		expect(j.notice).toBeNull()
		expect(j.server.status).toBe('stopped')
		expect(j.count).toBe(4)
		expect(j.groups.map((g: any) => g.tag)).toEqual(['users', '/health'])
		const users = j.groups[0].routes
		expect(users.map((r: any) => r.id)).toEqual(['GET /users', 'POST /users', 'GET /users/:id'])
		const list = users[0]
		expect(list.summary).toBe('List or add users')
		expect(list.address).toBe('request/GET/users')
		expect(list.file).toBe('endpoints/users.ts')
		expect(list.body).toBe(false)
		expect(list.fields).toEqual([
			{ name: 'q', in: 'query', type: 'string', required: false, description: 'Part of a name', default: null },
			{ name: 'limit', in: 'query', type: 'number', required: false, description: 'How many', default: '10' },
		])
		const add = users[1]
		expect(add.body).toBe(true)
		expect(add.fields.map((f: any) => `${f.in}:${f.name}:${f.type}:${f.required}`)).toEqual(['body:name:string:true', 'body:role:enum:false', 'body:age:number:false'])
		expect(users[2].fields).toEqual([{ name: 'id', in: 'path', type: 'string', required: true, description: '', default: null }])
		expect(j.errors.map((e: any) => e.file)).toEqual(['endpoints/broken.ts'])
	})
	it('one route by method and path', async () => {
		const j: any = await (await api.get('/endpoints/route?method=get&path=' + encodeURIComponent('/users/:id'))).json()
		expect(j.route.id).toBe('GET /users/:id')
		expect(j.server.status).toBe('stopped')
		expect((await api.get('/endpoints/route?method=GET&path=/nope')).status).toBe(404)
	})
	it('a project with no endpoints folder gets the notice', async () => {
		const other = await start(makeProject(false))
		try {
			const j: any = await (await client(other).get('/endpoints')).json()
			expect(j.dir).toBeNull()
			expect(j.count).toBe(0)
			expect(j.groups).toEqual([])
			expect(j.notice).toBe('This project has no endpoints/ folder.')
		} finally {
			other.proc.kill()
		}
	}, 120000)
	it('401 without the token', async () => {
		expect((await fetch(wb.base + '/endpoints')).status).toBe(401)
		expect((await fetch(wb.base + '/serve/start', { method: 'POST' })).status).toBe(401)
		expect((await fetch(wb.base + '/endpoints/request', { method: 'POST', body: '{}' })).status).toBe(401)
	})
})

describe('serve and requests', () => {
	it('a request with the server stopped says so', async () => {
		const j: any = await (await api.post('/endpoints/request', { method: 'GET', path: '/users', values: {} })).json()
		expect(j).toEqual({ ok: false, notRunning: true, error: 'The server is not running' })
	})

	it('starts serve, sends a GET with query and a POST with body, stops it', async () => {
		const ws = new WebSocket(`ws://127.0.0.1:${wb.port}/ws?token=${wb.token}`)
		const got: any[] = []
		ws.onmessage = (e) => got.push(JSON.parse(String(e.data)))
		await until(() => got.length > 0, 10000)

		const started: any = await (await api.post('/serve/start')).json()
		expect(started.status).toBe('starting')
		expect(started.port).toBeGreaterThan(0)
		expect(started.text).toBe(`starting on :${started.port}`)
		expect(await until(async () => ((await (await api.get('/serve')).json()) as any).status === 'running', 60000)).toBe(true)
		expect(got.some((f) => f.type === 'serve' && f.serve.status === 'running' && f.serve.text === `running on :${started.port}`)).toBe(true)
		// A second start while running is the same server.
		expect(((await (await api.post('/serve/start')).json()) as any).runId).toBe(started.runId)

		const g: any = await (await api.post('/endpoints/request', { method: 'GET', path: '/users', values: { q: 'a', limit: '2' } })).json()
		expect(g.ok).toBe(true)
		expect(g.url).toBe('/users?q=a&limit=2')
		expect(g.status).toBe(200)
		expect(g.statusClass).toBe('2xx')
		expect(g.bodyKind).toBe('json')
		expect(JSON.parse(g.text)).toEqual({ count: 3, users: [{ id: 1, name: 'Ada' }, { id: 2, name: 'Grace' }] })
		expect(g.tree.open).toBe(true)
		expect(g.tree.children.map((c: any) => c.key)).toEqual(['count', 'users'])
		expect(g.headers.some((h: any) => h.name === 'content-type')).toBe(true)
		expect(g.sent).toBeNull()
		expect(typeof g.ms).toBe('number')

		const p: any = await (await api.post('/endpoints/request', { method: 'POST', path: '/users', values: { name: 'Linus', age: '30' } })).json()
		expect(p.status).toBe(201)
		expect(JSON.parse(p.text)).toEqual({ created: { name: 'Linus', role: 'member', age: 30 } })
		expect(JSON.parse(p.sent)).toEqual({ name: 'Linus', age: 30 })

		const missing: any = await (await api.post('/endpoints/request', { method: 'POST', path: '/users', values: {} })).json()
		expect(missing).toMatchObject({ ok: false, missing: ['name'] })

		const notFound: any = await (await api.post('/endpoints/request', { method: 'GET', path: '/users/:id', values: { id: 'nobody' } })).json()
		expect(notFound.status).toBe(404)
		expect(notFound.statusClass).toBe('4xx')

		const bad: any = await (await api.post('/endpoints/request', { method: 'POST', path: '/users', values: {}, body: '{"name": 5}' })).json()
		expect(bad.status).toBe(400)

		const text: any = await (await api.post('/endpoints/request', { method: 'GET', path: '/health', values: {} })).json()
		expect(text.status).toBe(200)
		expect(text.bodyKind).toBe('json')
		expect(text.text).toBe('"fine"')

		const pid = pidOnPort(started.port)
		expect(pid).not.toBeNull()
		const stopped: any = await (await api.post('/serve/stop')).json()
		expect(stopped.runId).toBe(started.runId)
		expect(await until(async () => ((await (await api.get('/serve')).json()) as any).status === 'stopped', 10000)).toBe(true)
		expect(await until(() => !alive(pid!), 5000)).toBe(true)
		const log: any = await (await api.get(`/runs/${started.runId}`)).json()
		expect(log.display).toBe(`luca serve --port ${started.port} --no-open`)
		expect(log.chunks.map((c: any) => c.text).join('')).toContain(`listening on http://localhost:${started.port}`)
		ws.close()
	}, 120000)

	it('404 for a route that is not there', async () => {
		expect((await api.post('/endpoints/request', { method: 'GET', path: '/nope' })).status).toBe(404)
	})

	it('a serve that exits on its own is failed, with the reason', async () => {
		const dir = makeProject()
		// luca.cli.ts runs before every command; this one breaks only serve.
		writeFileSync(join(dir, 'luca.cli.ts'), `export async function main() { if (process.argv.includes('serve')) { console.error('serve broke on purpose'); process.exit(4) } }\n`)
		const other = await start(dir)
		try {
			const api2 = client(other)
			await api2.post('/serve/start')
			expect(await until(async () => ((await (await api2.get('/serve')).json()) as any).status === 'failed', 60000)).toBe(true)
			const j: any = await (await api2.get('/serve')).json()
			expect(j.error).toContain('serve broke on purpose')
			expect(j.text).toBe('failed: serve broke on purpose')
			const r: any = await (await api2.post('/endpoints/request', { method: 'GET', path: '/health' })).json()
			expect(r.notRunning).toBe(true)
		} finally {
			other.proc.kill()
		}
	}, 120000)

	it('the serve child dies with the host', async () => {
		const dir = makeProject()
		const other = await start(dir)
		const api2 = client(other)
		const s: any = await (await api2.post('/serve/start')).json()
		expect(await until(async () => ((await (await api2.get('/serve')).json()) as any).status === 'running', 60000)).toBe(true)
		const pid = pidOnPort(s.port)
		expect(pid).not.toBeNull()
		;(other.proc.stdin as any).end()
		await Promise.race([other.proc.exited, Bun.sleep(10000)])
		expect(await until(() => !alive(pid!), 5000)).toBe(true)
	}, 120000)
})
