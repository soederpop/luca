import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, realpathSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parse as parseYaml } from 'yaml'
import { validateGuide, matchChoice, command, fill, guideIdOf, guideFolders, askText, pieces, guideCanvasSetup } from '../src/workbench/guide'

const LUCA_ROOT = join(import.meta.dir, '..')
const CLI = join(LUCA_ROOT, 'src/cli/cli.ts')
const base = realpathSync(process.env.WORKBENCH_TEST_TMP || tmpdir())
const tempDirs: string[] = []
const cacheHome = mkdtempSync(join(base, 'luca-guide-cache-'))
tempDirs.push(cacheHome)

const TOUR = `id: tour
title: A Tiny Tour
description: Two questions.
start: hello
nodes:
  hello:
    say: Hi there. This is {{project}}.
    ask:
      prompt: Who are you?
      choices:
        - label: A developer
          match: [dev, code]
          next: dev
          set: { track: dev }
        - label: Someone new
          match: [new, learn]
          next: fresh
          set: { track: new }
  dev:
    say: Welcome, {{track}}.
    next: more
  more:
    say: One more thing.
    actions:
      - label: Console
        open: console
    ask:
      prompt: Name?
      free: { set: name, next: bye }
  fresh:
    say: Welcome, newcomer.
    canvas: "window.drawn = true"
    end: true
  bye:
    say: Bye, {{name}}.
    end: true
`

const STUB_CLI = `export async function main(container: any) {
  const providers = container.feature('modelProviders')
  providers.registerLocal('stub', 'http://127.0.0.1:9/v1', 'stub-model')
}
`

function makeProject(): string {
	const dir = mkdtempSync(join(base, 'luca-guide-'))
	tempDirs.push(dir)
	writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'wb-guide-project', version: '0.0.0' }))
	mkdirSync(join(dir, 'assistants', 'helper'), { recursive: true })
	writeFileSync(join(dir, 'assistants', 'helper', 'CORE.md'), '---\nprovider: stub\nmodel: stub-model\n---\n\nYou help.\n')
	mkdirSync(join(dir, 'guides'), { recursive: true })
	writeFileSync(join(dir, 'guides', 'tour.yml'), TOUR)
	writeFileSync(join(dir, 'guides', 'broken.yml'), 'id: broken\ntitle: Broken\nstart: nowhere\nnodes: {}\n')
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
	const env = { ...process.env, XDG_CACHE_HOME: cacheHome, LUCA_GUIDE_DELAY_MS: '0', LUCA_WORKBENCH_GUIDES: '' }
	delete (env as any).LUCA_PLUGINS
	const proc = Bun.spawn(['bun', 'run', CLI, 'workbench'], { cwd, stdin: 'pipe', stdout: 'pipe', stderr: 'inherit', env })
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

/** A stand-in for the canvas page: evals succeed, and it can press a button. */
async function fakePage(wb: Running, id: string, key: string) {
	const got: any[] = []
	const ws = new WebSocket(`ws://127.0.0.1:${wb.port}/canvas/${id}/link?key=${key}`)
	await new Promise<void>((resolve, reject) => { ws.onopen = () => resolve(); ws.onerror = () => reject(new Error('link refused')) })
	ws.onmessage = (e) => {
		const msg = JSON.parse(String(e.data))
		got.push(msg)
		if (msg.type === 'eval') ws.send(JSON.stringify({ type: 'result', requestId: msg.requestId, ok: true, value: true, kind: 'boolean', logs: [] }))
	}
	ws.send(JSON.stringify({ type: 'hello', width: 640, height: 480, fresh: true }))
	return { ws, got, press: (data: any) => ws.send(JSON.stringify({ type: 'event', name: 'guide', data })) }
}

async function frames(wb: Running) {
	const list: any[] = []
	const ws = new WebSocket(`ws://127.0.0.1:${wb.port}/ws?token=${wb.token}`)
	await new Promise<void>((resolve) => { ws.onmessage = (e) => { const f = JSON.parse(String(e.data)); if (f.type === 'hello') resolve(); else list.push(f) } })
	return { ws, list }
}

async function until(pred: () => boolean, ms = 5000) {
	const deadline = Date.now() + ms
	while (!pred() && Date.now() < deadline) await Bun.sleep(20)
	expect(pred()).toBe(true)
}

describe('guide helpers', () => {
	const tour = validateGuide(parseYaml(TOUR))

	it('names guides as assistants', () => {
		expect(guideIdOf('guide:onboarding')).toBe('onboarding')
		expect(guideIdOf('lucaArchitect')).toBeNull()
		expect(guideIdOf('guide:')).toBeNull()
		expect(guideIdOf('guide:Bad Name')).toBeNull()
	})

	it('validates the graph', () => {
		expect(tour.start).toBe('hello')
		expect(() => validateGuide({ id: 'x', title: 'X', start: 'nowhere', nodes: {} })).toThrow(/start names no node/)
		expect(() => validateGuide({ id: 'x', title: 'X', start: 'a', nodes: { a: { say: 'hi' } } })).toThrow(/neither asks/)
		expect(() => validateGuide({ id: 'x', title: 'X', start: 'a', nodes: { a: { say: 'hi', ask: { choices: [{ label: 'go', next: 'b' }] } } } })).toThrow(/names no node: b/)
		expect(() => validateGuide({ id: 'x', title: 'X', start: 'a', nodes: { a: { say: 'hi', next: 'a', ask: { choices: [{ label: 'go', next: 'a' }] } } } })).toThrow(/both asks and has next/)
	})

	it('matches typed answers by number, label, keyword, regex, and words', () => {
		const choices = tour.nodes.hello!.ask!.choices
		expect(matchChoice('1', choices)).toBe(0)
		expect(matchChoice('2.', choices)).toBe(1)
		expect(matchChoice('3', choices)).toBeNull()
		expect(matchChoice('a developer', choices)).toBe(0)
		expect(matchChoice("I'm a dev, I write code", choices)).toBe(0)
		expect(matchChoice('I want to learn', choices)).toBe(1)
		expect(matchChoice('someone who is NEW here', choices)).toBe(1)
		expect(matchChoice('developer please', choices)).toBe(0)
		expect(matchChoice('banana', choices)).toBeNull()
		expect(matchChoice('', choices)).toBeNull()
		expect(matchChoice('x', [{ label: 'A', match: ['/^x$/'], next: 'a' }, { label: 'B', next: 'b' }])).toBe(0)
		// A word both labels share decides nothing.
		expect(matchChoice('thing', [{ label: 'red thing', next: 'a' }, { label: 'blue thing', next: 'b' }])).toBeNull()
	})

	it('knows the steering words', () => {
		expect(command('start over')).toBe('restart')
		expect(command('Back!')).toBe('back')
		expect(command('?')).toBe('help')
		expect(command('a developer')).toBeNull()
	})

	it('fills variables and leaves unknown ones', () => {
		expect(fill('Hi {{ name }}, {{nope}}', { name: 'Jo' })).toBe('Hi Jo, {{nope}}')
		expect(askText(tour.nodes.hello!.ask!, {})).toBe('Who are you?\n1. A developer\n2. Someone new')
		expect(askText(tour.nodes.more!.ask!, {})).toBe('Name?')
		expect(pieces('one two\n\nthree').join('')).toBe('one two\n\nthree')
	})

	it('searches the project, ~/.luca and every assistant folder', () => {
		const list = (dir: string) => (dir.endsWith('/.luca/assistants') ? ['lucaArchitect'] : dir.endsWith('/p/assistants') ? ['own'] : [])
		const folders = guideFolders('/p', '/home', 'x:y', (...p) => p.join('/'), list)
		expect(folders).toEqual(['x', 'y', '/p/guides', '/home/.luca/guides', '/home/.luca/assistants/lucaArchitect/guides', '/p/assistants/own/guides'])
	})

	it('ships an onboarding guide that validates', () => {
		const file = join(LUCA_ROOT, 'apps/desktop/assistants/lucaArchitect/guides/onboarding.yml')
		const guide = validateGuide(parseYaml(readFileSync(file, 'utf8')))
		expect(guide.id).toBe('onboarding')
		expect(guide.nodes.welcome!.ask!.choices.length).toBe(2)
		expect(guide.nodes.handoff!.actions.some((a) => a.open.includes('lucaArchitect'))).toBe(true)
		// Every node is reachable from the start.
		const seen = new Set<string>()
		const walk = (id: string) => {
			if (seen.has(id)) return
			seen.add(id)
			const n = guide.nodes[id]!
			if (n.next) walk(n.next)
			for (const c of n.ask?.choices ?? []) walk(c.next)
			if (n.ask?.free) walk(n.ask.free.next)
		}
		walk(guide.start)
		expect([...seen].sort()).toEqual(Object.keys(guide.nodes).sort())
	})

	it('builds a card renderer that is plain JavaScript', () => {
		expect(() => new Function(guideCanvasSetup())).not.toThrow()
	})
})

describe('workbench guides', () => {
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

	let conversationId = ''

	it('lists guides as assistants with no model', async () => {
		const view = await (await api(wb).get('/assistants')).json()
		const guide = view.assistants.find((a: any) => a.name === 'guide:tour')
		expect(guide).toBeTruthy()
		expect(guide.modelText).toBe('scripted · no model')
		expect(guide.description).toBe('Two questions.')
		expect(view.assistants.find((a: any) => a.name === 'guide:broken')).toBeUndefined()
		expect(view.assistants.some((a: any) => a.name === 'helper')).toBe(true)
	})

	it('opens a guide and plays the start node with no model, as chat frames', async () => {
		const { ws, list } = await frames(wb)
		const opened = await (await api(wb).post('/chat/open', { assistant: 'guide:tour', conversationId: 'new' })).json()
		expect(opened.ok).toBe(true)
		expect(opened.assistant).toBe('guide:tour')
		expect(opened.modelText).toBe('scripted · no model')
		conversationId = opened.conversationId
		expect(conversationId).toMatch(/^tour-/)
		await until(() => list.some((f) => f.type === 'chat-done' && f.conversationId === conversationId))
		const done = list.find((f) => f.type === 'chat-done' && f.conversationId === conversationId)
		expect(done.text).toContain('Hi there. This is wb-guide-project.')
		expect(done.text).toContain('1. A developer')
		expect(list.find((f) => f.type === 'chat-start' && f.conversationId === conversationId).text).toBe('')
		expect(list.filter((f) => f.type === 'chat-delta' && f.conversationId === conversationId).length).toBeGreaterThan(3)
		// It asked the desktop for its canvas.
		expect(list.some((f) => f.type === 'canvas-open' && f.id === 'guide-tour')).toBe(true)
		ws.close()
	})

	it('answers a typed choice and follows next nodes in one turn', async () => {
		const { ws, list } = await frames(wb)
		const sent = await (await api(wb).post('/chat/send', { assistant: 'guide:tour', conversationId, text: "I'm a dev" })).json()
		expect(sent.ok).toBe(true)
		await until(() => list.some((f) => f.type === 'chat-done'))
		const done = list.find((f) => f.type === 'chat-done')
		expect(done.text).toContain('Welcome, dev.')
		expect(done.text).toContain('One more thing.')
		expect(done.text).toContain('Name?')
		const reopened = await (await api(wb).post('/chat/open', { assistant: 'guide:tour', conversationId })).json()
		expect(reopened.messages.map((m: any) => m.role)).toEqual(['assistant', 'user', 'assistant'])
		expect(reopened.messages[1].text).toBe("I'm a dev")
		expect(reopened.guide.node).toBe('more')
		ws.close()
	})

	it('draws the card on the canvas, and a button press is an answer', async () => {
		const view = await (await api(wb).get('/canvases/guide-tour')).json()
		const key = new URL(view.url).searchParams.get('key')!
		const page = await fakePage(wb, 'guide-tour', key)
		// A fresh page gets the current card again.
		await until(() => page.got.some((m) => m.type === 'eval' && m.code.includes('window.guide.show') && m.code.includes('One more thing')))
		const shown = page.got.filter((m) => m.type === 'eval' && m.code.includes('window.guide.show')).pop()
		expect(shown.code).toMatch(/actions: \[\{ label: "Console", open: "console" \}\]/)
		expect(view.evals).toBe(0) // nothing kept in the canvas log

		const { ws, list } = await frames(wb)
		page.press({ command: 'back' })
		await until(() => list.some((f) => f.type === 'chat-done'))
		expect(list.find((f) => f.type === 'chat-start').text).toBe('back')
		expect(list.find((f) => f.type === 'chat-done').text).toContain('Who are you?')
		list.length = 0
		page.press({ choice: 1, label: 'Someone new' })
		await until(() => list.some((f) => f.type === 'chat-done'))
		expect(list.find((f) => f.type === 'chat-start').text).toBe('Someone new')
		expect(list.find((f) => f.type === 'chat-done').text).toContain('Welcome, newcomer.')
		// The node's own canvas code ran in the page.
		expect(page.got.some((m) => m.type === 'eval' && m.code.includes('window.drawn = true'))).toBe(true)
		ws.close()
		page.ws.close()
	})

	it('explains itself on a miss and at the end, and starts over', async () => {
		const { ws, list } = await frames(wb)
		await api(wb).post('/chat/send', { assistant: 'guide:tour', conversationId, text: 'hello?' })
		await until(() => list.some((f) => f.type === 'chat-done'))
		expect(list.find((f) => f.type === 'chat-done').text).toContain('end of the guide')
		list.length = 0
		await api(wb).post('/chat/send', { assistant: 'guide:tour', conversationId, text: 'start over' })
		await until(() => list.some((f) => f.type === 'chat-done'))
		expect(list.find((f) => f.type === 'chat-done').text).toContain('Who are you?')
		list.length = 0
		await api(wb).post('/chat/send', { assistant: 'guide:tour', conversationId, text: 'purple' })
		await until(() => list.some((f) => f.type === 'chat-done'))
		expect(list.find((f) => f.type === 'chat-done').text).toContain('not a model')
		list.length = 0
		// Free input lands in a variable.
		await api(wb).post('/chat/send', { assistant: 'guide:tour', conversationId, text: '1' })
		await until(() => list.some((f) => f.type === 'chat-done'))
		list.length = 0
		await api(wb).post('/chat/send', { assistant: 'guide:tour', conversationId, text: 'Ada' })
		await until(() => list.some((f) => f.type === 'chat-done'))
		expect(list.find((f) => f.type === 'chat-done').text).toContain('Bye, Ada.')
		ws.close()
	})

	it('reads the file again on the next message', async () => {
		writeFileSync(join(project, 'guides', 'tour.yml'), TOUR.replace('Bye, {{name}}.', 'Farewell, {{name}}.'))
		const { ws, list } = await frames(wb)
		await api(wb).post('/chat/retry', { assistant: 'guide:tour', conversationId })
		await until(() => list.some((f) => f.type === 'chat-done'))
		expect(list.find((f) => f.type === 'chat-done').text).toContain('Farewell, Ada.')
		ws.close()
	})

	it('has no model to change, exports, and deletes', async () => {
		const settings = await (await api(wb).post('/chat/settings', { assistant: 'guide:tour', conversationId, provider: 'stub' })).json()
		expect(settings.ok).toBe(false)
		expect((await (await api(wb).get(`/chat/extensions?assistant=guide:tour&conversationId=${conversationId}`)).json()).features).toEqual([])
		const exported = await (await api(wb).get(`/chat/export?assistant=guide:tour&conversationId=${conversationId}`)).json()
		expect(exported.markdown).toContain('## You')
		expect(exported.markdown).toContain('Farewell, Ada.')
		expect((await (await api(wb).get('/assistants/guide:tour/conversations')).json()).conversations).toEqual([])
		const missing = await (await api(wb).post('/chat/open', { assistant: 'guide:nope', conversationId: 'new' })).json()
		expect(missing.ok).toBe(false)
		expect(missing.error).toContain('No guide "nope"')
		expect(missing.error).toContain('broken.yml')
		const removed = await (await api(wb).post('/chat/delete', { assistant: 'guide:tour', conversationId })).json()
		expect(removed.ok).toBe(true)
		const fresh = await (await api(wb).post('/chat/open', { assistant: 'guide:tour', conversationId })).json()
		expect(fresh.messages.length).toBe(0)
		expect(fresh.busy).toBe(true)
	})
})
