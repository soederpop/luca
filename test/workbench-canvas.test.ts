import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { canvasCsp, canvasSlug, CANVAS_READ_ROUTES } from '../src/workbench/canvas'

const LUCA_ROOT = join(import.meta.dir, '..')
const CLI = join(LUCA_ROOT, 'src/cli/cli.ts')
const base = realpathSync(process.env.WORKBENCH_TEST_TMP || tmpdir())
const tempDirs: string[] = []
const cacheHome = mkdtempSync(join(base, 'luca-canvas-cache-'))
tempDirs.push(cacheHome)

const STUB_CLI = `export async function main(container: any) {
  const providers = container.feature('modelProviders')
  providers.registerLocal('stub', 'http://127.0.0.1:9/v1', 'stub-model')
}
`

function makeProject(): string {
	const dir = mkdtempSync(join(base, 'luca-canvas-'))
	tempDirs.push(dir)
	writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'wb-canvas-project', version: '0.0.0' }))
	mkdirSync(join(dir, 'assistants', 'helper'), { recursive: true })
	writeFileSync(join(dir, 'assistants', 'helper', 'CORE.md'), '---\nprovider: stub\nmodel: stub-model\n---\n\nYou help.\n')
	writeFileSync(join(dir, 'luca.cli.ts'), STUB_CLI)
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
	const proc = Bun.spawn(['bun', 'run', CLI, 'workbench'], { cwd, stdin: 'pipe', stdout: 'pipe', stderr: 'ignore', env: { ...process.env, XDG_CACHE_HOME: cacheHome } })
	const info = JSON.parse(await readFirstLine(proc))
	return { proc, port: info.port, token: info.token, base: `http://127.0.0.1:${info.port}` }
}

const api = (wb: Running) => {
	const headers = { Authorization: `Bearer ${wb.token}`, 'content-type': 'application/json' }
	return {
		get: (path: string) => fetch(wb.base + path, { headers }),
		post: (path: string, body: any = {}) => fetch(wb.base + path, { method: 'POST', headers, body: JSON.stringify(body) }),
	}
}

/** A stand-in for the canvas page: it answers evals with what it was sent. */
async function fakePage(wb: Running, id: string, key: string, fresh = true) {
	const got: any[] = []
	const ws = new WebSocket(`ws://127.0.0.1:${wb.port}/canvas/${id}/link?key=${key}`)
	await new Promise<void>((resolve, reject) => { ws.onopen = () => resolve(); ws.onerror = () => reject(new Error('link refused')) })
	ws.onmessage = (e) => {
		const msg = JSON.parse(String(e.data))
		got.push(msg)
		if (msg.type === 'eval') {
			const failing = msg.code.includes('boom')
			ws.send(JSON.stringify(failing
				? { type: 'result', requestId: msg.requestId, ok: false, error: 'boom', logs: [] }
				: { type: 'result', requestId: msg.requestId, ok: true, value: msg.code, kind: 'string', logs: ['log: hi'] }))
		}
		if (msg.type === 'snapshot') ws.send(JSON.stringify({ type: 'snapshot', requestId: msg.requestId, dataUrl: 'data:image/png;base64,AAAA', width: 2, height: 2 }))
	}
	ws.send(JSON.stringify({ type: 'hello', width: 640, height: 480, fresh }))
	return { ws, got }
}

describe('canvas helpers', () => {
	it('locks scripts to the host and unpkg', () => {
		const csp = canvasCsp()
		expect(csp).toContain(`default-src 'none'`)
		expect(csp).toMatch(/script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval' https:\/\/unpkg\.com(;|$)/)
		expect(csp).toContain('connect-src')
		expect(csp).toContain('http://127.0.0.1:*')
		expect(csp).toContain('https://*.ts.net')
		expect(csp.split('; ').find((d) => d.startsWith('script-src'))).not.toContain('unsafe-inline')
	})

	it('makes ids from titles', () => {
		expect(canvasSlug('My Sales Chart!')).toBe('my-sales-chart')
		expect(canvasSlug('')).toBe('')
	})

	it('opens no route that writes', () => {
		for (const path of ['/eval', '/console', '/file', '/files', '/docs/save', '/chat/send', '/helper/features/fs/call']) {
			expect(CANVAS_READ_ROUTES.some((r) => r.test(path))).toBe(false)
		}
		expect(CANVAS_READ_ROUTES.some((r) => r.test('/registries'))).toBe(true)
	})
})

describe('workbench canvases', () => {
	let wb: Running
	let project: string

	beforeAll(async () => {
		project = makeProject()
		wb = await start(project)
	}, 90_000)

	afterAll(() => {
		try { wb?.proc.kill() } catch {}
		for (const d of tempDirs) { try { rmSync(d, { recursive: true, force: true }) } catch {} }
	})

	let id = ''
	let key = ''

	it('creates a canvas and asks the desktop to open it', async () => {
		const frames: any[] = []
		const ws = new WebSocket(`ws://127.0.0.1:${wb.port}/ws?token=${wb.token}`)
		await new Promise<void>((resolve) => { ws.onmessage = (e) => { const f = JSON.parse(String(e.data)); if (f.type === 'hello') resolve(); else frames.push(f) } })
		const answer = await (await api(wb).post('/canvases', { title: 'Sales Chart' })).json()
		expect(answer.ok).toBe(true)
		expect(answer.created).toBe(true)
		id = answer.canvas.id
		expect(id).toBe('sales-chart')
		key = new URL(answer.canvas.url).searchParams.get('key')!
		expect(key).toMatch(/^[a-f0-9]{32}$/)
		await Bun.sleep(100)
		expect(frames.some((f) => f.type === 'canvas-open' && f.id === id)).toBe(true)
		ws.close()

		const again = await (await api(wb).post('/canvases', { title: 'Sales Chart' })).json()
		expect(again.canvas.id).toBe('sales-chart-2')
	})

	it('serves the page with its key and a CSP, and refuses it without', async () => {
		const page = await fetch(`${wb.base}/canvas/${id}/?key=${key}`)
		expect(page.status).toBe(200)
		expect(page.headers.get('content-security-policy')).toContain("script-src 'self'")
		const html = await page.text()
		expect(html).toContain(`/canvas/${id}/boot.js?key=${key}`)
		expect((await fetch(`${wb.base}/canvas/${id}/`)).status).toBe(401)
		expect((await fetch(`${wb.base}/canvas/${id}/?key=${'0'.repeat(32)}`)).status).toBe(401)
		// The host's token does not open a page either: a page never needs it.
		expect((await fetch(`${wb.base}/canvas/${id}/?token=${wb.token}`)).status).toBe(401)
		const boot = await fetch(`${wb.base}/canvas/${id}/boot.js?key=${key}`)
		expect(boot.headers.get('content-type')).toContain('javascript')
		const runtime = await fetch(`${wb.base}/canvas/runtime/luca.mjs?key=${key}`, { redirect: 'manual' })
		expect([200, 302]).toContain(runtime.status)
	})

	it('lets a canvas key read, and nothing more', async () => {
		const h = { 'x-canvas-key': key }
		expect((await fetch(`${wb.base}/registries`, { headers: h })).status).toBe(200)
		expect((await fetch(`${wb.base}/project`, { headers: h })).status).toBe(200)
		expect((await fetch(`${wb.base}/eval`, { method: 'POST', headers: h, body: '{"code":"1"}' })).status).toBe(401)
		expect((await fetch(`${wb.base}/files`, { headers: h })).status).toBe(401)
		expect((await fetch(`${wb.base}/canvases`, { headers: h })).status).toBe(401)
		const ws = new WebSocket(`ws://127.0.0.1:${wb.port}/ws?key=${key}`)
		const closed = await new Promise<boolean>((resolve) => { ws.onopen = () => resolve(false); ws.onerror = () => resolve(true); ws.onclose = () => resolve(true) })
		expect(closed).toBe(true)
	})

	it('runs code in the page and saves what worked', async () => {
		const page = await fakePage(wb, id, key)
		const ok = await (await api(wb).post(`/canvases/${id}/eval`, { code: 'const n: number = 1; return n' })).json()
		expect(ok.ok).toBe(true)
		// TypeScript reaches the page as JavaScript.
		expect(String(ok.value)).not.toContain(': number')
		expect(ok.logs).toEqual(['log: hi'])
		const bad = await (await api(wb).post(`/canvases/${id}/eval`, { code: 'boom()' })).json()
		expect(bad.ok).toBe(false)
		expect(bad.error).toBe('boom')
		const quiet = await (await api(wb).post(`/canvases/${id}/eval`, { code: '"question"', keep: false })).json()
		expect(quiet.ok).toBe(true)
		const view = await (await api(wb).get(`/canvases/${id}`)).json()
		expect(view.open).toBe(true)
		expect(view.width).toBe(640)
		expect(view.evals).toBe(1)
		page.ws.close()
	})

	it('replays saved code when the page loads again, not when it only reconnects', async () => {
		const reloaded = await fakePage(wb, id, key, true)
		await Bun.sleep(200)
		expect(reloaded.got.filter((m) => m.type === 'eval').length).toBe(1)
		reloaded.ws.close()
		const reconnected = await fakePage(wb, id, key, false)
		await Bun.sleep(200)
		expect(reconnected.got.filter((m) => m.type === 'eval').length).toBe(0)
		reconnected.ws.close()
	})

	it('takes a snapshot from the desktop, else from the page', async () => {
		const page = await fakePage(wb, id, key, false)
		// A desktop that answers.
		const desk = new WebSocket(`ws://127.0.0.1:${wb.port}/ws?token=${wb.token}`)
		desk.onmessage = async (e) => {
			const f = JSON.parse(String(e.data))
			if (f.type === 'canvas-snapshot') await api(wb).post(`/canvases/${f.id}/snapshot`, { requestId: f.requestId, png: 'BBBB', width: 10, height: 10 })
		}
		await new Promise((r) => { desk.onopen = r })
		const shot = await (await api(wb).post(`/canvases/${id}/shot`)).json()
		expect(shot.ok).toBe(true)
		expect(shot.source).toBe('desktop')
		expect(shot.dataUrl).toBe('data:image/png;base64,BBBB')
		desk.close()
		const fallback = await (await api(wb).post(`/canvases/${id}/shot`)).json()
		expect(fallback.source).toBe('page')
		page.ws.close()
	}, 20_000)

	it('keeps page events for the assistant', async () => {
		const page = await fakePage(wb, id, key, false)
		page.ws.send(JSON.stringify({ type: 'event', name: 'clicked', data: { x: 1 } }))
		await Bun.sleep(100)
		const ev = await (await api(wb).get(`/canvases/${id}/events`)).json()
		expect(ev.events.at(-1).name).toBe('clicked')
		expect(ev.events.at(-1).data).toEqual({ x: 1 })
		page.ws.close()
	})

	it('gives chat assistants the canvas tools', async () => {
		const open = await (await api(wb).post('/chat/open', { assistant: 'helper' })).json()
		expect(open.ok).toBe(true)
		for (const t of ['createCanvas', 'canvasEval', 'canvasSnapshot', 'canvasEvents', 'listCanvases', 'resetCanvas']) expect(open.tools).toContain(t)
	})

	it('keeps canvases across a host restart', async () => {
		wb.proc.kill()
		await wb.proc.exited
		wb = await start(project)
		const list = await (await api(wb).get('/canvases')).json()
		const saved = list.canvases.find((c: any) => c.id === id)
		expect(saved.evals).toBe(1)
		expect(new URL(saved.url).searchParams.get('key')).toBe(key)
	}, 90_000)
})
