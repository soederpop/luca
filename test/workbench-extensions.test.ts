import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { scalarOptions, parseExtensions, summary } from '../src/workbench/extensions'

const LUCA_ROOT = '/Users/jonathansoeder/@luca'
const CLI = join(LUCA_ROOT, 'src/cli/cli.ts')
const base = realpathSync(process.env.WORKBENCH_TEST_TMP || tmpdir())
const tempDirs: string[] = []
const cacheHome = mkdtempSync(join(base, 'luca-ext-cache-'))
tempDirs.push(cacheHome)

const STUB_CLI = `export async function main(container: any) {
  const providers = container.feature('modelProviders')
  providers.registerLocal('stub', 'http://127.0.0.1:9/v1', 'stub-model')
}
`

function makeProject(): string {
	const dir = mkdtempSync(join(base, 'luca-ext-'))
	tempDirs.push(dir)
	writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'wb-ext-project', version: '0.0.0' }))
	for (const name of ['helper', 'support']) {
		mkdirSync(join(dir, 'assistants', name), { recursive: true })
		writeFileSync(join(dir, 'assistants', name, 'CORE.md'), '---\nprovider: stub\nmodel: stub-model\n---\n\nYou help.\n')
	}
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
		get: (path: string) => fetch(wb.base + path, { headers }).then((r) => r.json() as Promise<any>),
		post: (path: string, body: any = {}) => fetch(wb.base + path, { method: 'POST', headers, body: JSON.stringify(body) }).then((r) => r.json() as Promise<any>),
	}
}

describe('extension helpers', () => {
	it('keeps only options that are one plain value', () => {
		const options = scalarOptions({
			properties: {
				name: { type: 'string' },
				cwd: { type: 'string', description: 'Where to work' },
				mode: { type: 'string', enum: ['a', 'b'], default: 'a' },
				limit: { type: 'integer', minimum: 1, maximum: Number.MAX_SAFE_INTEGER },
				nested: { type: 'object' },
				stub: { type: 'string', description: 'A fake client (tests)' },
			},
		})
		expect(options.map((o) => o.name)).toEqual(['cwd', 'mode', 'limit'])
		expect(options[1]).toMatchObject({ enum: ['a', 'b'], default: 'a' })
		expect(options[2]!.maximum).toBeUndefined()
	})

	it('drops a second entry for the same feature', () => {
		expect(parseExtensions([{ feature: 'fileTools' }, { feature: 'fileTools', only: ['readFile'] }])).toEqual([{ feature: 'fileTools' }])
		expect(() => parseExtensions([{ only: ['x'] }])).toThrow()
		expect(summary({ feature: 'x', source: 'return {}', description: 'd' })).toEqual({ feature: 'x', invented: true, description: 'd' })
	})
})

describe('workbench chat extensions', () => {
	let wb: Running
	let project: string
	let chatId = ''

	beforeAll(async () => {
		project = makeProject()
		wb = await start(project)
		const opened = await api(wb).post('/chat/open', { assistant: 'helper', conversationId: 'new' })
		chatId = opened.conversationId
	}, 90_000)

	afterAll(() => {
		try { wb?.proc.kill() } catch {}
		for (const d of tempDirs) { try { rmSync(d, { recursive: true, force: true }) } catch {} }
	})

	it('lists features that have tools', async () => {
		const view = await api(wb).get(`/chat/extensions?assistant=helper&conversationId=${chatId}`)
		const fileTools = view.features.find((f: any) => f.name === 'fileTools')
		expect(fileTools).toBeTruthy()
		expect(fileTools.tools.map((t: any) => t.name)).toContain('readFile')
		expect(view.extensions).toEqual([])
		expect(await api(wb).get('/chat/extensions?assistant=helper')).toHaveProperty('error')
	})

	it('saves a list, tells the socket and shows it on open', async () => {
		const frames: any[] = []
		const ws = new WebSocket(`ws://127.0.0.1:${wb.port}/ws?token=${wb.token}`)
		await new Promise<void>((resolve) => { ws.onmessage = (e) => { const f = JSON.parse(String(e.data)); if (f.type === 'hello') resolve(); else frames.push(f) } })
		const answer = await api(wb).post('/chat/extensions', { assistant: 'helper', conversationId: chatId, extensions: [{ feature: 'fileTools', only: ['readFile'], folder: project }] })
		expect(answer.ok).toBe(true)
		await Bun.sleep(100)
		const frame = frames.find((f) => f.type === 'chat-extensions')
		expect(frame).toMatchObject({ assistant: 'helper', conversationId: chatId, extensions: [{ feature: 'fileTools', only: ['readFile'], folder: project }] })
		ws.close()

		const view = await api(wb).post('/chat/open', { assistant: 'helper', conversationId: chatId })
		expect(view.extensions).toEqual([{ feature: 'fileTools', only: ['readFile'], folder: project }])
		// The added tool is not counted as the assistant's own.
		expect(view.tools).not.toContain('readFile')
	})

	it('refuses a feature that does not exist', async () => {
		const answer = await api(wb).post('/chat/extensions', { assistant: 'helper', conversationId: chatId, extensions: [{ feature: 'noSuchThing' }] })
		expect(answer.ok).toBe(false)
		expect(answer.error).toContain('noSuchThing')
	})

	it('opens a tech support chat linked to the chat', async () => {
		const support = await api(wb).post('/chat/open', { assistant: 'support', conversationId: 'new', target: { assistant: 'helper', conversationId: chatId } })
		expect(support.target).toEqual({ assistant: 'helper', conversationId: chatId })
		for (const tool of ['chatExtensionCatalog', 'chatExtensionsList', 'extendChat', 'inventChatTools', 'removeChatExtension']) expect(support.tools).toContain(tool)
	})

	it('refuses the chat MCP route without a session token', async () => {
		const res = await fetch(`${wb.base}/mcp/chat/nope`, { method: 'POST', headers: { Authorization: 'Bearer nope' } })
		expect(res.status).toBe(401)
	})

	it('keeps the list after a restart', async () => {
		wb.proc.kill()
		await wb.proc.exited
		wb = await start(project)
		const view = await api(wb).get(`/chat/extensions?assistant=helper&conversationId=${chatId}`)
		expect(view.extensions).toEqual([{ feature: 'fileTools', only: ['readFile'], folder: project }])
	}, 90_000)
})
