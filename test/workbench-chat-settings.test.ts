import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { mergeSettings, parseSettings, modelChoices, transcriptMarkdown, exportFilename, modelText } from '../src/workbench/chat'

// A chat's own provider, model and effort, its reasoning stream, and the
// history actions (retry, clear, rename, delete, export) on a real host.

const LUCA_ROOT = '/Users/jonathansoeder/@luca'
const CLI = join(LUCA_ROOT, 'src/cli/cli.ts')
const base = realpathSync(process.env.WORKBENCH_TEST_TMP || tmpdir())
const tempDirs: string[] = []
const cacheHome = mkdtempSync(join(base, 'luca-workbench-cs-cache-'))
tempDirs.push(cacheHome)

/**
 * Two stand-in providers on one transport, no LLM. The reply names the model
 * it was sent to; "think" streams reasoning first; "fail" throws once.
 */
const STUB_CLI = `export async function main(container: any) {
  const providers = container.feature('modelProviders')
  providers.registerLocal('stub', 'http://127.0.0.1:9/v1', 'stub-model')
  providers.registerLocal('stub2', 'http://127.0.0.1:8/v1', 'other-model')
  let failed = false
  providers.registerTransport('openai-chat-completions', {
    apiMode: 'openai-chat-completions',
    async *stream(request: any) {
      const msgs = request.messages || []
      const user = [...msgs].reverse().find((m: any) => m.role === 'user')?.content
      const text = typeof user === 'string' ? user : JSON.stringify(user)
      if (/fail/.test(text) && !failed) { failed = true; throw new Error('stub failure') }
      if (/think/.test(text)) yield { type: 'reasoning', text: 'Let me think. ' }
      const reply = 'You said ' + text + ' to ' + request.model + ' at ' + (request.reasoningEffort || 'default') + '.'
      yield { type: 'chunk', text: reply }
      yield { type: 'response', response: { content: reply, toolCalls: [] } }
    },
  })
}
`

function makeProject(): string {
	const dir = mkdtempSync(join(base, 'luca-workbench-cs-'))
	tempDirs.push(dir)
	writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'wb-cs-project', version: '0.0.0' }))
	mkdirSync(join(dir, 'assistants', 'helper'), { recursive: true })
	writeFileSync(join(dir, 'assistants', 'helper', 'CORE.md'), '---\nprovider: stub\nmodel: stub-model\ndescription: Echoes\n---\n\nYou help.\n')
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
	const proc = Bun.spawn(['bun', 'run', CLI, 'workbench'], {
		cwd, stdin: 'pipe', stdout: 'pipe', stderr: 'ignore',
		env: { ...process.env, XDG_CACHE_HOME: cacheHome, HOME: join(cacheHome, 'home') },
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

/** Send and wait for the turn's end. Answers the done or error frame. */
async function turn(sock: { got: any[] }, id: string, text: string) {
	const before = sock.got.length
	const sent = await (await api.post('/chat/send', { assistant: 'helper', conversationId: id, text })).json()
	expect(sent.ok).toBe(true)
	expect(await until(() => sock.got.slice(before).some((f) => f.turnId === sent.turnId && (f.type === 'chat-done' || f.type === 'chat-error')))).toBe(true)
	return sock.got.slice(before).find((f) => f.turnId === sent.turnId && (f.type === 'chat-done' || f.type === 'chat-error'))
}

describe('pure parts', () => {
	it('merges a settings patch: empty clears, a new provider drops the old model', () => {
		expect(mergeSettings({}, { provider: 'stub2', model: 'm' })).toEqual({ provider: 'stub2', model: 'm' })
		expect(mergeSettings({ provider: 'stub2', model: 'm' }, { provider: 'stub' })).toEqual({ provider: 'stub' })
		expect(mergeSettings({ provider: 'stub2', model: 'm' }, { provider: 'stub2' })).toEqual({ provider: 'stub2', model: 'm' })
		expect(mergeSettings({ provider: 'x', model: 'm' }, { provider: '', model: '' })).toEqual({})
		expect(mergeSettings({ reasoningEffort: 'low' }, { reasoningEffort: '' })).toEqual({})
		expect(mergeSettings({}, { reasoningEffort: 'high' })).toEqual({ reasoningEffort: 'high' })
		expect(() => mergeSettings({}, { reasoningEffort: 'max' })).toThrow('reasoningEffort is one of')
		expect(parseSettings({ provider: 'a', reasoningEffort: 'bogus', junk: 1 })).toEqual({ provider: 'a' })
		expect(parseSettings(undefined)).toEqual({})
		expect(modelText('claude-code', 'claude-code')).toBe('claude-code')
		expect(modelText('stub', '')).toBe('stub')
	})

	it('lists models that can answer, the default provider first', () => {
		const ai = {
			providers: [
				{ id: 'local', label: 'Local', model: 'qwen', status: 'no server', statusText: 'needs setup' },
				{ id: 'lab', label: 'Lab box', model: 'llama', status: 'ready', statusText: 'answers', isDefault: false },
				{ id: 'openai', label: 'OpenAI', model: 'gpt-5.4-mini', status: 'ready', statusText: 'key set', isDefault: true },
				{ id: 'claude-code', label: 'Claude Code', model: '', status: 'no server' },
				{ id: 'codex', label: 'Codex', model: 'codex', status: 'login' },
			],
			servers: [{ profileId: 'lab', models: ['llama', 'mistral'] }],
			agents: [{ id: 'claude', available: true }, { id: 'codex', available: false }],
		}
		const rows = modelChoices(ai, { provider: 'lab' })
		expect(rows.map((r) => `${r.provider}/${r.model}`)).toEqual([
			'openai/', 'openai/gpt-5.4',
			'lab/', 'lab/mistral',
			'claude-code/', 'claude-code/opus', 'claude-code/sonnet', 'claude-code/haiku',
		])
		expect(rows[0]!.title).toBe('OpenAI · gpt-5.4-mini')
		expect(rows.find((r) => r.provider === 'claude-code')!.detail).toBe('coding agent')
		// The provider in use stays even when it cannot answer now.
		expect(modelChoices(ai, { provider: 'local' }).some((r) => r.provider === 'local')).toBe(true)
	})

	it('writes a transcript as markdown', () => {
		const md = transcriptMarkdown('Sums', 'helper', [
			{ id: 'm0', role: 'user', text: 'add 2 and 3', tools: [] },
			{ id: 'm1', role: 'assistant', text: 'The sum is 5.', tools: [{ id: 't', name: 'add', argsText: '{\n  "a": 2\n}', status: 'done', resultText: '5', ms: 3 }] },
		], new Date('2026-11-25T10:00:00Z'))
		expect(md).toContain('# Sums')
		expect(md).toContain('## You\n\nadd 2 and 3')
		expect(md).toContain('<summary>add · done</summary>')
		expect(md).toContain('## helper')
		expect(md.endsWith('The sum is 5.\n')).toBe(true)
		expect(exportFilename('What is 2 + 3?', 'desk-1')).toBe('what-is-2-3-desk-1.md')
		expect(exportFilename('???', 'x')).toBe('chat-x.md')
	})
})

describe('a chat of its own', () => {
	it('switches model, provider and effort for one conversation, and keeps them', async () => {
		const sock = await frames(wb)
		const open = await (await api.post('/chat/open', { assistant: 'helper' })).json()
		const id = open.conversationId
		expect(open.settings).toEqual({})
		expect(open.routing).toMatchObject({ provider: 'stub', model: 'stub-model', reasoningEffort: '' })

		expect((await turn(sock, id, 'one')).text).toBe('You said one to stub-model at default.')

		const models = await (await api.get(`/chat/models?assistant=helper&conversationId=${id}`)).json()
		expect(models.own.text).toBe('stub · stub-model')
		expect(models.efforts).toEqual(['minimal', 'low', 'medium', 'high', 'xhigh'])
		expect(Array.isArray(models.choices)).toBe(true)

		const bad = await api.post('/chat/settings', { assistant: 'helper', conversationId: id, provider: 'nobody' })
		expect(bad.status).toBe(400)
		expect((await bad.json()).error).toContain('no model provider nobody')
		expect((await api.post('/chat/settings', { assistant: 'helper', conversationId: id, reasoningEffort: 'max' })).status).toBe(400)

		const switched = await (await api.post('/chat/settings', { assistant: 'helper', conversationId: id, provider: 'stub2', reasoningEffort: 'high' })).json()
		expect(switched.settings).toEqual({ provider: 'stub2', reasoningEffort: 'high' })
		expect(switched.routing).toMatchObject({ provider: 'stub2', model: 'other-model', reasoningEffort: 'high' })
		expect(switched.messages).toHaveLength(2)
		expect(await until(() => sock.got.some((f) => f.type === 'chat-settings' && f.conversationId === id))).toBe(true)
		expect(sock.got.find((f) => f.type === 'chat-settings').modelText).toBe('stub2 · other-model')

		expect((await turn(sock, id, 'two')).text).toBe('You said two to other-model at high.')

		const model = await (await api.post('/chat/settings', { assistant: 'helper', conversationId: id, model: 'big-model', reasoningEffort: '' })).json()
		expect(model.routing).toMatchObject({ provider: 'stub2', model: 'big-model', reasoningEffort: '' })

		// A new host opens it with the same settings.
		const fresh = await start(proj)
		try {
			const again = await (await client(fresh).post('/chat/open', { assistant: 'helper', conversationId: id })).json()
			expect(again.settings).toEqual({ provider: 'stub2', model: 'big-model' })
			expect(again.routing).toMatchObject({ provider: 'stub2', model: 'big-model' })
			expect(again.messages).toHaveLength(4)
		} finally {
			fresh.proc.kill()
		}

		// Back to the assistant's own.
		const own = await (await api.post('/chat/settings', { assistant: 'helper', conversationId: id, provider: '', model: '' })).json()
		expect(own.settings).toEqual({})
		expect(own.routing).toMatchObject({ provider: 'stub', model: 'stub-model' })
		sock.close()
	}, 90000)

	it('streams reasoning as its own frames, never in the reply', async () => {
		const sock = await frames(wb)
		const { conversationId: id } = await (await api.post('/chat/open', { assistant: 'helper' })).json()
		const done = await turn(sock, id, 'think about it')
		const reasoning = sock.got.filter((f) => f.type === 'chat-reasoning' && f.conversationId === id)
		expect(reasoning.map((f) => f.text).join('')).toBe('Let me think. ')
		expect(done.text).not.toContain('Let me think')
		sock.close()
	}, 60000)

	it('retries the last turn, clears, renames, exports and deletes', async () => {
		const sock = await frames(wb)
		const { conversationId: id } = await (await api.post('/chat/open', { assistant: 'helper' })).json()
		await turn(sock, id, 'first')
		await turn(sock, id, 'second')

		// Retry a good turn: the last exchange goes, the message is sent again.
		const before = sock.got.length
		const retried = await (await api.post('/chat/retry', { assistant: 'helper', conversationId: id })).json()
		expect(retried.ok).toBe(true)
		expect(await until(() => sock.got.slice(before).some((f) => f.type === 'chat-done' && f.turnId === retried.turnId))).toBe(true)
		const after = sock.got.slice(before)
		expect(after[0].type).toBe('chat-history')
		expect(after[0].messages.map((m: any) => m.text)).toEqual(['first', 'You said first to stub-model at default.'])
		expect(after.find((f) => f.type === 'chat-start').text).toBe('second')
		const reopened = await (await api.post('/chat/open', { assistant: 'helper', conversationId: id })).json()
		expect(reopened.messages).toHaveLength(4)

		// Retry a failed turn: its input is still there, so the start carries no text.
		const failed = await turn(sock, id, 'please fail')
		expect(failed.type).toBe('chat-error')
		const mark = sock.got.length
		const again = await (await api.post('/chat/retry', { assistant: 'helper', conversationId: id })).json()
		expect(await until(() => sock.got.slice(mark).some((f) => f.type === 'chat-done' && f.turnId === again.turnId))).toBe(true)
		expect(sock.got.slice(mark).find((f) => f.type === 'chat-start').text).toBe('')
		expect(sock.got.slice(mark).find((f) => f.type === 'chat-done').text).toBe('You said please fail to stub-model at default.')

		// Rename: the view and the history list show it.
		const renamed = await (await api.post('/chat/rename', { assistant: 'helper', conversationId: id, title: 'Echo tests' })).json()
		expect(renamed.title).toBe('Echo tests')
		const list = await (await api.get('/assistants/helper/conversations')).json()
		expect(list.conversations.find((c: any) => c.conversationId === id).title).toBe('Echo tests')

		// Export as markdown.
		const exported = await (await api.get(`/chat/export?assistant=helper&conversationId=${id}`)).json()
		expect(exported.title).toBe('Echo tests')
		expect(exported.filename).toBe(`echo-tests-${id}.md`)
		expect(exported.markdown).toContain('## You\n\nfirst')

		// Clear: the transcript goes, the conversation stays.
		const cleared = await (await api.post('/chat/clear', { assistant: 'helper', conversationId: id })).json()
		expect(cleared.messages).toEqual([])
		expect(sock.got.some((f) => f.type === 'chat-history' && f.conversationId === id && f.messages.length === 0)).toBe(true)

		// Delete: gone from history.
		const deleted = await (await api.post('/chat/delete', { assistant: 'helper', conversationId: id })).json()
		expect(deleted.ok).toBe(true)
		const after2 = await (await api.get('/assistants/helper/conversations')).json()
		expect(after2.conversations.some((c: any) => c.conversationId === id)).toBe(false)
		sock.close()
	}, 90000)

	it('a new chat with nothing saved cannot be renamed, and the routes check their input', async () => {
		const { conversationId: id } = await (await api.post('/chat/open', { assistant: 'helper' })).json()
		const r = await (await api.post('/chat/rename', { assistant: 'helper', conversationId: id, title: 'x' })).json()
		expect(r.ok).toBe(false)
		expect((await api.post('/chat/rename', { assistant: 'helper', conversationId: id, title: '  ' })).status).toBe(400)
		expect((await api.post('/chat/retry', { assistant: 'helper', conversationId: id })).status).toBe(400)
		expect((await api.post('/chat/settings', { assistant: 'helper', conversationId: 'new' })).status).toBe(400)
		expect((await api.get('/chat/models?assistant=helper')).status).toBe(400)
		expect((await api.post('/chat/clear', { assistant: 'nobody', conversationId: 'x1' })).status).toBe(404)
	}, 60000)
})
