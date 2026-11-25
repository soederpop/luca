import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, realpathSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fieldKind, valueKind, docTitle, docPreview, digestOf } from '../src/workbench/docs'
import { messagesView, argsText, resultFailed, resultText, shortTime } from '../src/workbench/chat'

const LUCA_ROOT = '/Users/jonathansoeder/@luca'
const CLI = join(LUCA_ROOT, 'src/cli/cli.ts')
const base = realpathSync(process.env.WORKBENCH_TEST_TMP || tmpdir())
const tempDirs: string[] = []

// Conversation history goes to $XDG_CACHE_HOME/luca/disk-cache-<cwd hash>:
// keep every test conversation in a folder this test deletes.
const cacheHome = mkdtempSync(join(base, 'luca-workbench-cache-'))
tempDirs.push(cacheHome)

const MODELS = `import { defineModel } from 'contentbase'
import { z } from 'zod'

export const Note = defineModel('Note', {
  prefix: 'notes',
  description: 'Short notes',
  meta: z.object({
    title: z.string().describe('What it is about'),
    status: z.enum(['draft', 'done']).default('draft'),
    tags: z.array(z.string()).optional(),
    priority: z.number().optional(),
  }),
})

export const Person = defineModel('Person', {
  prefix: 'people',
  description: 'People',
  meta: z.object({ name: z.string(), active: z.boolean().default(true) }),
})
`

/**
 * A stand-in model: no LLM. It calls the add tool when the message says
 * "add", else streams an echo word by word. STUB_DELAY slows it down.
 */
const STUB_CLI = `export async function main(container: any) {
  const providers = container.feature('modelProviders')
  providers.registerLocal('stub', 'http://127.0.0.1:9/v1', 'stub-model')
  providers.registerTransport('openai-chat-completions', {
    apiMode: 'openai-chat-completions',
    async *stream(request: any) {
      const msgs = request.messages || []
      const last = msgs[msgs.length - 1]
      const user = [...msgs].reverse().find((m: any) => m.role === 'user')?.content
      const text = typeof user === 'string' ? user : JSON.stringify(user)
      if (last?.role === 'user' && /add/i.test(text)) {
        yield { type: 'response', response: { content: '', toolCalls: [{ id: 'call_1', name: 'add', arguments: { a: 2, b: 3 }, rawArguments: '{"a":2,"b":3}' }] } }
        return
      }
      const reply = last?.role === 'tool' ? 'The sum is ' + JSON.parse(last.content).sum + '.' : 'You said ' + text + ' and this streams.'
      let all = ''
      for (const word of reply.split(/(?<= )/)) {
        await new Promise((r) => setTimeout(r, Number(process.env.STUB_DELAY || 5)))
        all += word
        yield { type: 'chunk', text: word }
      }
      yield { type: 'response', response: { content: all, toolCalls: [] } }
    },
  })
}
`

const CRLF_NOTE = '---\ntitle: Windows line endings\nstatus: draft\n---\r\n\r\n# Windows line endings\r\n\r\nThis file uses CRLF.\r\n'

function makeProject(): string {
	const dir = mkdtempSync(join(base, 'luca-workbench-dc-'))
	tempDirs.push(dir)
	writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'wb-dc-project', version: '0.0.0' }))
	mkdirSync(join(dir, 'docs', 'notes'), { recursive: true })
	mkdirSync(join(dir, 'docs', 'people'), { recursive: true })
	writeFileSync(join(dir, 'docs', 'models.ts'), MODELS)
	writeFileSync(join(dir, 'docs', 'notes', 'first.md'), '---\ntitle: The first note\nstatus: draft\ntags: [a, b]\npriority: 2\nowner: jon\n---\n\n# The first note\n\nBody line one.\n\n- a point\n')
	writeFileSync(join(dir, 'docs', 'notes', 'crlf.md'), CRLF_NOTE)
	writeFileSync(join(dir, 'docs', 'people', 'ada.md'), '---\nname: Ada Lovelace\nactive: true\n---\n\nWrites programs.\n')
	writeFileSync(join(dir, 'docs', 'README.md'), '# Loose doc\n\nNo model.\n')
	mkdirSync(join(dir, 'assistants', 'helper'), { recursive: true })
	writeFileSync(join(dir, 'assistants', 'helper', 'CORE.md'), '---\nprovider: stub\nmodel: stub-model\ndescription: Adds numbers\n---\n\nYou help.\n')
	writeFileSync(join(dir, 'assistants', 'helper', 'tools.ts'), `import { z } from 'zod'
export const schemas = { add: z.object({ a: z.number(), b: z.number() }).describe('Add two numbers') }
export async function add({ a, b }: { a: number; b: number }) { return { sum: a + b } }
`)
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

async function start(cwd: string, env: Record<string, string> = {}): Promise<Running> {
	const proc = Bun.spawn(['bun', 'run', CLI, 'workbench'], {
		cwd,
		stdin: 'pipe',
		stdout: 'pipe',
		stderr: 'ignore',
		// HOME too: assistants in ~/.luca/assistants (Luca Desktop installs one) would join every project.
		env: { ...process.env, XDG_CACHE_HOME: cacheHome, HOME: join(cacheHome, 'home'), ...env },
	})
	const info = JSON.parse(await readFirstLine(proc))
	return { proc, port: info.port, token: info.token, base: `http://127.0.0.1:${info.port}` }
}

const client = (wb: Running) => {
	const headers = { Authorization: `Bearer ${wb.token}`, 'content-type': 'application/json' }
	return {
		get: async (path: string) => fetch(wb.base + path, { headers }),
		post: async (path: string, body: any = {}) => fetch(wb.base + path, { method: 'POST', headers, body: JSON.stringify(body) }),
	}
}

/** Every chat frame on the socket, kept in order. */
async function frames(wb: Running) {
	const got: any[] = []
	const ws = new WebSocket(`ws://127.0.0.1:${wb.port}/ws?token=${wb.token}`)
	await new Promise<void>((resolve, reject) => {
		ws.onmessage = (e) => {
			const f = JSON.parse(String(e.data))
			if (f.type === 'hello') resolve()
			if (String(f.type).startsWith('chat-')) got.push(f)
		}
		ws.onerror = () => reject(new Error('socket failed'))
	})
	return { got, close: () => ws.close() }
}

async function until(test: () => boolean, ms = 20000) {
	const deadline = Date.now() + ms
	while (Date.now() < deadline && !test()) await Bun.sleep(25)
	return test()
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
	try { wb?.proc.kill() } catch {}
	for (const d of tempDirs) { try { rmSync(d, { recursive: true, force: true }) } catch {} }
})

describe('pure parts', () => {
	it('reads schema type text as a kind, with enum values', () => {
		expect(fieldKind('enum(`draft`, `done`)')).toEqual({ kind: 'enum', options: ['draft', 'done'], text: 'enum(draft, done)' })
		expect(fieldKind('string[]').kind).toBe('array')
		expect(fieldKind('string').kind).toBe('string')
		expect(fieldKind('number').kind).toBe('number')
		expect(fieldKind('boolean').kind).toBe('boolean')
		expect(fieldKind('pipe')).toEqual({ kind: 'value', options: [], text: 'value' })
	})
	it('a value kind from the value itself', () => {
		expect(valueKind(['a'])).toBe('array')
		expect(valueKind('2026-11-25')).toBe('date')
		expect(valueKind('jon')).toBe('string')
		expect(valueKind(3)).toBe('number')
		expect(valueKind(false)).toBe('boolean')
		expect(valueKind({ a: 1 })).toBe('object')
	})
	it('titles and previews', () => {
		expect(docTitle('notes/x', { title: 'T' }, '# H')).toBe('T')
		expect(docTitle('people/ada', { name: 'Ada' }, '')).toBe('Ada')
		expect(docTitle('notes/x', {}, 'intro\n# Heading\n')).toBe('Heading')
		expect(docTitle('notes/x', {}, 'no heading')).toBe('x')
		expect(docPreview('# T\n\nline one\r\n\n## Sub\nline two')).toBe('line one\nline two')
	})
	it('shapes saved messages into turns with tool calls and results', () => {
		const view = messagesView([
			{ role: 'system', content: 'sys' },
			{ role: 'user', content: 'add 2 and 3' },
			{ role: 'assistant', content: '', tool_calls: [{ id: 'c1', type: 'function', function: { name: 'add', arguments: '{"a":2,"b":3}' } }] },
			{ role: 'tool', tool_call_id: 'c1', content: '{"sum":5}' },
			{ role: 'assistant', content: 'It is 5.' },
			{ role: 'user', content: [{ type: 'text', text: 'and ' }, { type: 'text', text: 'fail?' }] },
			{ role: 'assistant', content: '', tool_calls: [{ id: 'c2', function: { name: 'add', arguments: '{}' } }] },
			{ role: 'tool', tool_call_id: 'c2', content: '{"error":"no numbers"}' },
			{ role: 'assistant', content: 'That failed.' },
		])
		expect(view.map((m) => m.role)).toEqual(['user', 'assistant', 'user', 'assistant'])
		expect(view[1]!.text).toBe('It is 5.')
		expect(view[1]!.tools).toEqual([{ id: 'c1', name: 'add', argsText: '{\n  "a": 2,\n  "b": 3\n}', status: 'done', resultText: '{\n  "sum": 5\n}', ms: null }])
		expect(view[2]!.text).toBe('and fail?')
		expect(view[3]!.tools[0]!.status).toBe('failed')
		expect(view[3]!.tools[0]!.argsText).toBe('{}')
	})
	it('tool text helpers', () => {
		expect(argsText({ a: 1 })).toBe('{\n  "a": 1\n}')
		expect(argsText('not json')).toBe('not json')
		expect(resultFailed('{"error":"x"}')).toBe(true)
		expect(resultFailed('{"sum":1}')).toBe(false)
		expect(resultFailed({ error: 'x' })).toBe(true)
		expect(resultText('plain')).toBe('plain')
		expect(shortTime('2026-11-25T10:05:00Z', new Date('2026-12-01T00:00:00Z'))).toMatch(/^Nov 25 \d\d:05$/)
		expect(shortTime(undefined)).toBe('')
	})
})

describe('docs routes', () => {
	it('GET /docs groups documents by model, in models.ts order, Base last as Other', async () => {
		const r = await api.get('/docs')
		expect(r.status).toBe(200)
		const v = await r.json()
		expect(v.notice).toBeNull()
		expect(v.error).toBeNull()
		expect(v.count).toBe(4)
		expect(v.stacks.map((s: any) => [s.id, s.title, s.slot, s.count])).toEqual([['Note', 'Note', 0, 2], ['Person', 'Person', 1, 1], ['Base', 'Other', -1, 1]])
		const first = v.stacks[0].cards.find((c: any) => c.id === 'notes/first')
		expect(first).toEqual({ id: 'notes/first', title: 'The first note', subtitle: 'notes/first', preview: 'Body line one.\n- a point', badge: 'draft', address: 'doc/notes/first' })
	})

	it('GET /docs/models lists each model, its prefix and fields with kinds', async () => {
		const v = await (await api.get('/docs/models')).json()
		expect(v.models.map((m: any) => [m.name, m.prefix, m.count, m.slot])).toEqual([['Note', 'notes', 2, 0], ['Person', 'people', 1, 1], ['Base', '', 1, -1]])
		const note = v.models[0]
		expect(note.description).toBe('Short notes')
		expect(note.fields.map((f: any) => [f.name, f.kind, f.required])).toEqual([['title', 'string', true], ['status', 'enum', false], ['tags', 'array', false], ['priority', 'number', false]])
		expect(note.fields[1].options).toEqual(['draft', 'done'])
		expect(note.fields[1].default).toBe('draft')
		expect(note.fields[0].description).toBe('What it is about')
	})

	it('GET /docs/item sends the exact file, its digest, and the frontmatter as fields', async () => {
		const v = await (await api.get('/docs/item?id=notes/crlf')).json()
		expect(v.file).toBe(CRLF_NOTE)
		expect(v.digest).toBe(digestOf(CRLF_NOTE))
		expect(v.model).toBe('Note')
		expect(v.slot).toBe(0)
		expect(v.title).toBe('Windows line endings')
		const first = await (await api.get('/docs/item?id=notes/first')).json()
		const byName = Object.fromEntries(first.fields.map((f: any) => [f.name, f]))
		expect(byName.tags.items).toEqual(['a', 'b'])
		expect(byName.priority.value).toBe('2')
		expect(byName.owner.extra).toBe(true)
		expect(byName.owner.kind).toBe('string')
		expect((await api.get('/docs/item?id=notes/nope')).status).toBe(404)
		expect((await api.get('/docs/item?id=../package')).status).toBe(404)
	})

	it('POST /docs/save writes the text byte for byte, and refuses a stale digest', async () => {
		const before = await (await api.get('/docs/item?id=notes/crlf')).json()
		const edited = before.file.replace('This file uses CRLF.', 'This file uses CRLF. Edited.')
		const r = await api.post('/docs/save', { id: 'notes/crlf', text: edited, digest: before.digest })
		expect(r.status).toBe(200)
		const saved = await r.json()
		expect(saved.ok).toBe(true)
		expect(saved.unchanged).toBe(false)
		const disk = readFileSync(join(proj, 'docs', 'notes', 'crlf.md'))
		expect(disk.equals(Buffer.from(CRLF_NOTE.replace('CRLF.\r\n', 'CRLF. Edited.\r\n'), 'utf8'))).toBe(true)
		expect(saved.view.digest).toBe(digestOf(disk))

		// The old digest is stale now: 409 with the file as it is.
		const stale = await api.post('/docs/save', { id: 'notes/crlf', text: before.file, digest: before.digest })
		expect(stale.status).toBe(409)
		expect((await stale.json()).view.file).toBe(edited)
		expect(readFileSync(join(proj, 'docs', 'notes', 'crlf.md'), 'utf8')).toBe(edited)

		const same = await (await api.post('/docs/save', { id: 'notes/crlf', text: edited, digest: saved.view.digest })).json()
		expect(same.unchanged).toBe(true)
		expect((await api.post('/docs/save', { id: 'notes/crlf', text: 'x' })).status).toBe(400)
		expect((await api.post('/docs/save', { id: 'notes/none', text: 'x', digest: 'd' })).status).toBe(404)
		// The index sees the save.
		const docs = await (await api.get('/docs')).json()
		expect(docs.stacks[0].cards.find((c: any) => c.id === 'notes/crlf').preview).toBe('This file uses CRLF. Edited.')
	})

	it('a project with no docs folder gets a notice, not an error', async () => {
		const bare = mkdtempSync(join(base, 'luca-workbench-dc-bare-'))
		tempDirs.push(bare)
		writeFileSync(join(bare, 'package.json'), '{"name":"bare"}')
		const other = await start(bare)
		try {
			const c = client(other)
			const docs = await (await c.get('/docs')).json()
			expect(docs.notice).toContain('no docs collection')
			expect(docs.stacks).toEqual([])
			const models = await (await c.get('/docs/models')).json()
			expect(models.notice).toContain('no docs collection')
			const assistants = await (await c.get('/assistants')).json()
			expect(assistants.notice).toContain('no assistants')
		} finally {
			other.proc.kill()
		}
	}, 60000)
})

describe('assistants and chat', () => {
	it('GET /assistants lists each assistant with its model, tools and conversations', async () => {
		const v = await (await api.get('/assistants')).json()
		expect(v.notice).toBeNull()
		expect(v.historyDir).toContain('luca-workbench-cache-')
		expect(v.assistants).toHaveLength(1)
		const a = v.assistants[0]
		expect(a.name).toBe('helper')
		expect(a.description).toBe('Adds numbers')
		expect(a.provider).toBe('stub')
		expect(a.model).toBe('stub-model')
		expect(a.modelText).toBe('stub · stub-model')
		expect(a.toolCount).toBe(1)
		expect(a.tools).toEqual(['add'])
		expect(a.conversationCount).toBe(0)
		expect((await api.get('/assistants/nobody/conversations')).status).toBe(404)
	})

	it('open, send: the reply streams as frames, tool calls show as they start and end', async () => {
		const open = await (await api.post('/chat/open', { assistant: 'helper' })).json()
		expect(open.ok).toBe(true)
		expect(open.conversationId).toMatch(/^desk-\d{8}-/)
		expect(open.messages).toEqual([])
		expect(open.tools).toEqual(['add', 'createCanvas', 'canvasEval', 'canvasSnapshot', 'canvasEvents', 'listCanvases', 'resetCanvas'])
		const id = open.conversationId

		const sock = await frames(wb)
		const sent = await (await api.post('/chat/send', { assistant: 'helper', conversationId: id, text: 'please add 2 and 3' })).json()
		expect(sent.ok).toBe(true)
		expect(await until(() => sock.got.some((f) => f.type === 'chat-done'))).toBe(true)
		sock.close()
		const mine = sock.got.filter((f) => f.conversationId === id)
		const types = mine.map((f) => f.type)
		expect(types[0]).toBe('chat-start')
		expect(mine[0].text).toBe('please add 2 and 3')
		expect(types.filter((t) => t === 'chat-tool')).toHaveLength(2)
		const tools = mine.filter((f) => f.type === 'chat-tool').map((f) => f.tool)
		expect(tools[0]).toMatchObject({ name: 'add', status: 'running', argsText: '{\n  "a": 2,\n  "b": 3\n}' })
		expect(tools[1]).toMatchObject({ name: 'add', status: 'done', resultText: '{\n  "sum": 5\n}' })
		expect(tools[1].id).toBe(tools[0].id)
		const deltas = mine.filter((f) => f.type === 'chat-delta')
		expect(deltas.length).toBeGreaterThan(2)
		expect(deltas.map((f) => f.text).join('')).toBe('The sum is 5.')
		const done = mine.find((f) => f.type === 'chat-done')
		expect(done).toMatchObject({ text: 'The sum is 5.', aborted: false, turnId: sent.turnId })
		expect(mine.every((f) => f.assistant === 'helper' && f.turnId === sent.turnId)).toBe(true)

		// Reopening shows the saved turn.
		const again = await (await api.post('/chat/open', { assistant: 'helper', conversationId: id })).json()
		expect(again.messages.map((m: any) => m.role)).toEqual(['user', 'assistant'])
		expect(again.messages[1].text).toBe('The sum is 5.')
		expect(again.messages[1].tools[0]).toMatchObject({ name: 'add', status: 'done' })
		expect(again.busy).toBe(false)
	}, 60000)

	it('a send while a reply streams is refused; stop ends the reply as aborted', async () => {
		const slow = await start(proj, { STUB_DELAY: '150' })
		try {
			const c = client(slow)
			const { conversationId } = await (await c.post('/chat/open', { assistant: 'helper', conversationId: 'new' })).json()
			const sock = await frames(slow)
			expect((await c.post('/chat/send', { assistant: 'helper', conversationId, text: 'tell me a long story' })).status).toBe(200)
			expect(await until(() => sock.got.some((f) => f.type === 'chat-delta'))).toBe(true)
			const busy = await c.post('/chat/send', { assistant: 'helper', conversationId, text: 'again' })
			expect(busy.status).toBe(409)
			const live = await (await c.post('/chat/open', { assistant: 'helper', conversationId })).json()
			expect(live.busy).toBe(true)
			expect(live.live.user).toBe('tell me a long story')
			expect((await (await c.post('/chat/stop', { assistant: 'helper', conversationId })).json()).stopped).toBe(true)
			expect(await until(() => sock.got.some((f) => f.type === 'chat-done'))).toBe(true)
			sock.close()
			expect(sock.got.find((f) => f.type === 'chat-done').aborted).toBe(true)
			expect((await (await c.post('/chat/stop', { assistant: 'helper', conversationId })).json()).stopped).toBe(false)
		} finally {
			slow.proc.kill()
		}
	}, 60000)

	it('a conversation is in history and opens again in a new host', async () => {
		const list = await (await api.get('/assistants/helper/conversations')).json()
		expect(list.conversations.length).toBeGreaterThanOrEqual(1)
		const conv = list.conversations.find((c: any) => c.messageCount >= 3)
		expect(conv).toBeDefined()
		expect(conv.thread.endsWith(':' + conv.conversationId)).toBe(true)
		expect(conv.updatedText).not.toBe('')

		const fresh = await start(proj)
		try {
			const c = client(fresh)
			const assistants = await (await c.get('/assistants')).json()
			expect(assistants.assistants[0].conversationCount).toBeGreaterThanOrEqual(1)
			expect(assistants.recent.some((r: any) => r.conversationId === conv.conversationId)).toBe(true)
			const opened = await (await c.post('/chat/open', { assistant: 'helper', conversationId: conv.conversationId })).json()
			expect(opened.messages.map((m: any) => m.role)).toEqual(['user', 'assistant'])
			expect(opened.messages[0].text).toBe('please add 2 and 3')
			expect(opened.messages[1].tools[0].resultText).toBe('{\n  "sum": 5\n}')
		} finally {
			fresh.proc.kill()
		}
		// History stayed in the test's cache folder.
		expect(readdirSync(join(cacheHome, 'luca')).some((n) => n.startsWith('disk-cache-'))).toBe(true)
	}, 60000)

	it('chat routes check their input', async () => {
		expect((await api.post('/chat/open', {})).status).toBe(400)
		expect((await api.post('/chat/open', { assistant: 'nobody' })).status).toBe(404)
		expect((await api.post('/chat/open', { assistant: 'helper', conversationId: 'bad id!' })).status).toBe(400)
		expect((await api.post('/chat/send', { assistant: 'helper', conversationId: 'new', text: 'x' })).status).toBe(400)
		expect((await api.post('/chat/send', { assistant: 'helper', conversationId: 'x1', text: '  ' })).status).toBe(400)
	})
})
