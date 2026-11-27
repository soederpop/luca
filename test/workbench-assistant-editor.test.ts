import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, realpathSync, existsSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { HOOKS, hookList, definedHooks, addHook, hookStub, useEntries, useFeature, useExpression, ownTools, fileList, fenced, firstParagraph, languageOf, AssistantEditor } from '../src/workbench/assistant-editor'
import { mergeBundles } from '../src/workbench/chat'
import { digestOf } from '../src/workbench/docs'

const LUCA_ROOT = join(import.meta.dir, '..')
const CLI = join(LUCA_ROOT, 'src/cli/cli.ts')
const base = realpathSync(process.env.WORKBENCH_TEST_TMP || tmpdir())
const tempDirs: string[] = []
const cacheHome = mkdtempSync(join(base, 'luca-ae-cache-'))
tempDirs.push(cacheHome)

const TOOLS = `import { z } from 'zod'

export const schemas = {
	add: z.object({ a: z.number(), b: z.number() }).describe('Add two numbers'),
	'shout': z.object({ text: z.string() }).describe('Upper case'),
}

export const use = [
	// the file tools
	container.feature('fileTools').toTools({ only: ['readFile', 'listDirectory'] }),
	container.describer,
]

export async function add({ a, b }: { a: number; b: number }) { return { sum: a + b } }
export async function shout({ text }: { text: string }) { return text.toUpperCase() }
`

const HOOKS_TS = `import type { Assistant } from 'luca/agi'

export async function started(_assistant: Assistant) {
}

export const beforeToolCall = async (_assistant: Assistant, ctx: any) => { ctx.skip = false }
`

const STUB_CLI = `export async function main(container: any) {
  const providers = container.feature('modelProviders')
  providers.registerLocal('stub', 'http://127.0.0.1:9/v1', 'stub-model')
}
`

function makeProject(): { dir: string; plugin: string } {
	const dir = mkdtempSync(join(base, 'luca-ae-'))
	tempDirs.push(dir)
	writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: 'ae-project', version: '0.0.0' }))
	mkdirSync(join(dir, 'assistants', 'helper', 'skills', 'one'), { recursive: true })
	writeFileSync(join(dir, 'assistants', 'helper', 'CORE.md'), '---\nprovider: stub\nmodel: stub-model\ndescription: Adds numbers\n---\n\nYou help.\n')
	writeFileSync(join(dir, 'assistants', 'helper', 'tools.ts'), TOOLS)
	writeFileSync(join(dir, 'assistants', 'helper', 'hooks.ts'), HOOKS_TS)
	writeFileSync(join(dir, 'assistants', 'helper', 'skills', 'one', 'SKILL.md'), '# One\n')
	mkdirSync(join(dir, 'assistants', 'helper', 'node_modules', 'x'), { recursive: true })
	writeFileSync(join(dir, 'assistants', 'helper', 'node_modules', 'x', 'index.js'), '')
	// A plugin's assistant: read only in the editor.
	const plugin = mkdtempSync(join(base, 'luca-ae-plugin-'))
	tempDirs.push(plugin)
	mkdirSync(join(plugin, 'assistants', 'shared'), { recursive: true })
	writeFileSync(join(plugin, 'assistants', 'shared', 'CORE.md'), '---\nprovider: stub\nmodel: stub-model\n---\n\nShared.\n')
	writeFileSync(join(plugin, 'luca.plugin.ts'), `export async function attach(container: any) { await container.feature('assistantsManager').addDiscoveryFolder(${JSON.stringify(join(plugin, 'assistants'))}) }\n`)
	writeFileSync(join(dir, 'luca.cli.ts'), STUB_CLI + `\nexport async function setup(container: any) {}\n`)
	return { dir, plugin }
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
		cwd, stdin: 'pipe', stdout: 'pipe', stderr: 'ignore',
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

describe('hooks', () => {
	it('the catalog is every hook assistant.ts fires', () => {
		const source = readFileSync(join(LUCA_ROOT, 'src/agi/features/assistant.ts'), 'utf8')
		const fired = new Set([...source.matchAll(/triggerHook\('([A-Za-z]+)'/g)].map((m) => m[1]!))
		const listed = new Set(HOOKS.map((h) => h.name))
		expect([...fired].filter((n) => !listed.has(n))).toEqual([])
		expect([...listed].filter((n) => !fired.has(n))).toEqual([])
	})
	it('reads the exports of hooks.ts, functions and consts alike', () => {
		const defined = definedHooks(HOOKS_TS)
		expect(defined.get('started')).toBe(3)
		expect(defined.get('beforeToolCall')).toBe(6)
		const list = hookList(HOOKS_TS)
		expect(list.find((h) => h.name === 'started')?.present).toBe(true)
		expect(list.find((h) => h.name === 'stopped')?.present).toBe(false)
		expect(hookList(null).every((h) => !h.present)).toBe(true)
	})
	it('adds a stub with the import, and leaves a hook that is there', () => {
		const added = addHook('', 'stopped')
		expect('text' in added && added.text).toBe("import type { Assistant } from 'luca/agi'\n\nexport async function stopped(_assistant: Assistant) {\n\t// stop(): close servers, child processes and timers here.\n}\n")
		expect('line' in added && added.line).toBe(3)
		const again = addHook(HOOKS_TS, 'started')
		expect('text' in again && again.text).toBe(HOOKS_TS)
		expect('line' in again && again.line).toBe(3)
		const more = addHook(HOOKS_TS, 'beforeAsk')
		expect('text' in more && more.text.split("import type { Assistant }").length).toBe(2)
		expect('text' in more && more.text.endsWith(hookStub(HOOKS.find((h) => h.name === 'beforeAsk')!))).toBe(true)
		expect('error' in addHook('', 'nope')).toBe(true)
	})
})

describe('tools.ts', () => {
	it('reads the use array and the schemas', () => {
		const entries = useEntries(TOOLS)
		expect(entries.map((e) => e.feature)).toEqual(['fileTools', null])
		expect(entries[0]!.only).toEqual(['readFile', 'listDirectory'])
		expect(entries[0]!.line).toBe(10)
		expect(entries[1]!.text).toBe('container.describer')
		expect(ownTools(TOOLS)).toEqual(['add', 'shout'])
		expect(useEntries('export const schemas = {}')).toEqual([])
	})
	it('writes a use expression', () => {
		expect(useExpression({ feature: 'fs' })).toBe("container.feature('fs').toTools()")
		expect(useExpression({ feature: 'rest', only: ['get'], options: { baseURL: 'http://x' } })).toBe("container.feature('rest', {baseURL: 'http://x'}).toTools({ only: ['get'] })")
	})
	it('adds, replaces and removes a feature in the use array', () => {
		const added = useFeature(TOOLS, { feature: 'grep' })
		expect(added.text).toContain("\tcontainer.describer,\n\tcontainer.feature('grep').toTools(),\n]")
		expect(added.text.split('\n')[added.line - 1]).toContain("container.feature('grep')")
		const replaced = useFeature(TOOLS, { feature: 'fileTools', only: ['readFile'] })
		expect(replaced.text).toContain("\t// the file tools\n\tcontainer.feature('fileTools').toTools({ only: ['readFile'] }),\n\tcontainer.describer,")
		expect(replaced.text).not.toContain('listDirectory')
		const removed = useFeature(TOOLS, { feature: 'fileTools', remove: true })
		expect(removed.text).not.toContain('fileTools')
		expect(removed.text).toContain('export const use = [\n\t// the file tools\n\tcontainer.describer,\n]')
		const fresh = useFeature('', { feature: 'fs' })
		expect(fresh.text).toBe("import { z } from 'zod'\n\nexport const schemas = {}\n\nexport const use = [\n\tcontainer.feature('fs').toTools(),\n]\n")
		const noUse = useFeature("export const schemas = {}\n", { feature: 'fs' })
		expect(noUse.text.endsWith("export const use = [\n\tcontainer.feature('fs').toTools(),\n]\n")).toBe(true)
	})
})

describe('files and text', () => {
	it('lists the definition files first, present or not, then the rest', () => {
		const { dir } = makeProject()
		const files = fileList(join(dir, 'assistants', 'helper'))
		expect(files.slice(0, 5).map((f) => [f.path, f.present])).toEqual([['CORE.md', true], ['ABOUT.md', false], ['tools.ts', true], ['hooks.ts', true], ['voice.yml', false]])
		expect(files.find((f) => f.path === 'skills/one/SKILL.md')?.kind).toBe('skill')
		expect(files.some((f) => f.path.startsWith('node_modules'))).toBe(false)
		expect(files.find((f) => f.path === 'tools.ts')?.language).toBe('typescript')
		expect(languageOf('x.py')).toBe('python')
		expect(languageOf('x')).toBe('text')
	})
	it('fences a file for the brief, cut at the limit', () => {
		expect(fenced('CORE.md', '# Hi\n')).toBe('**CORE.md**\n\n```markdown\n# Hi\n```')
		const cut = fenced('tools.ts', 'a'.repeat(30), 10)
		expect(cut).toContain('aaaaaaaaaa\n```\n(tools.ts goes on past this point; this is the first 10 characters.)')
		expect(fenced('x.md', 'has ```\n')).toStartWith('**x.md**\n\n````markdown')
		expect(firstParagraph('---\na: 1\n---\n# T\n\nFirst para.\n\nSecond.')).toBe('First para.')
	})
	it('merges tool bundles', () => {
		expect(mergeBundles(null, null)).toBeNull()
		const a = { schemas: { x: 1 }, handlers: { x: () => 1 }, provider: { name: 'a' } }
		expect(mergeBundles(a, null)).toBe(a)
		const both = mergeBundles(a, { schemas: { y: 2 }, handlers: { y: () => 2 } })!
		expect(Object.keys(both.schemas)).toEqual(['x', 'y'])
	})
	it('names why a folder is read only', () => {
		const tilde = (p: string) => p
		expect(AssistantEditor.readOnlyReason({ source: 'project' }, tilde)).toBeNull()
		expect(AssistantEditor.readOnlyReason({ source: 'home' }, tilde)).toBeNull()
		expect(AssistantEditor.readOnlyReason({ source: 'extra', folder: '/p/a' }, tilde)).toContain('plugin (/p/a)')
		expect(AssistantEditor.readOnlyReason({ source: 'registered' }, tilde)).toContain('registered at runtime')
	})
})

describe('routes', () => {
	let proj: string
	let plugin: string
	let wb: Running
	let api: ReturnType<typeof client>

	beforeAll(async () => {
		const made = makeProject()
		proj = made.dir
		plugin = made.plugin
		wb = await start(proj, { LUCA_PLUGINS: plugin })
		api = client(wb)
	}, 120000)

	afterAll(async () => {
		try { wb?.proc.kill() } catch {}
		for (const d of tempDirs) { try { rmSync(d, { recursive: true, force: true }) } catch {} }
	})

	it('GET /assistant/<name> draws the folder: files, hooks, use entries, providers', async () => {
		const r = await api.get('/assistant/helper')
		expect(r.status).toBe(200)
		const v = await r.json()
		expect(v.editable).toBe(true)
		expect(v.source).toBe('project')
		expect(v.files.slice(0, 5).map((f: any) => f.path)).toEqual(['CORE.md', 'ABOUT.md', 'tools.ts', 'hooks.ts', 'voice.yml'])
		expect(v.hooks.find((h: any) => h.name === 'started').present).toBe(true)
		expect(v.hooks.find((h: any) => h.name === 'started').line).toBe(3)
		expect(v.use[0].feature).toBe('fileTools')
		expect(v.ownTools).toEqual(['add', 'shout'])
		// The facts come from an instance that never starts, so `use` entries are not resolved into tools here.
		expect(v.tools).toContain('add')
		const fileTools = v.providers.find((p: any) => p.name === 'fileTools')
		expect(fileTools.used).toBe(true)
		expect(fileTools.only).toEqual(['readFile', 'listDirectory'])
		expect(v.providers.some((p: any) => !p.used)).toBe(true)
		expect(v.modelText).toBe('stub · stub-model')
		expect((await api.get('/assistant/nobody')).status).toBe(404)
	}, 60000)

	it('a plugin assistant reads but does not write; copy makes it the project\'s own', async () => {
		const v = await (await api.get('/assistant/shared')).json()
		expect(v.source).toBe('extra')
		expect(v.editable).toBe(false)
		expect(v.readOnly).toContain('plugin')
		const file = await (await api.get('/assistant/shared/file?path=CORE.md')).json()
		expect(file.file).toContain('Shared.')
		expect(file.pathDisplay).toBe('shared/CORE.md')
		const refused = await api.post('/assistant/shared/file/save', { path: 'CORE.md', text: 'x', digest: file.digest })
		expect(refused.status).toBe(403)
		const copied = await api.post('/assistant/shared/copy')
		expect(copied.status).toBe(200)
		expect(existsSync(join(proj, 'assistants', 'shared', 'CORE.md'))).toBe(true)
		const after = await (await api.get('/assistant/shared')).json()
		expect(after.source).toBe('project')
		expect(after.editable).toBe(true)
		expect(after.shadows.length).toBe(1)
		expect((await api.post('/assistant/shared/copy')).status).toBe(400)
	}, 60000)

	it('saves a file over the one it loaded, keeps a backup, and refuses a .ts that does not load', async () => {
		const core = await (await api.get('/assistant/helper/file?path=CORE.md')).json()
		const saved = await api.post('/assistant/helper/file/save', { path: 'CORE.md', text: core.file + '\nBe brief.\n', digest: core.digest })
		expect(saved.status).toBe(200)
		const body = await saved.json()
		expect(body.text).toBe('Saved helper/CORE.md')
		expect(body.backedUp).toStartWith('.history/')
		expect(readFileSync(join(proj, 'assistants', 'helper', 'CORE.md'), 'utf8')).toContain('Be brief.')
		expect(readdirSync(join(proj, 'assistants', 'helper', '.history')).some((n) => n.endsWith('-CORE.md'))).toBe(true)
		const stale = await api.post('/assistant/helper/file/save', { path: 'CORE.md', text: 'x', digest: core.digest })
		expect(stale.status).toBe(409)
		const tools = await (await api.get('/assistant/helper/file?path=tools.ts')).json()
		const broken = await api.post('/assistant/helper/file/save', { path: 'tools.ts', text: 'export const schemas = {\n', digest: tools.digest })
		expect(broken.status).toBe(422)
		expect((await broken.json()).error).toContain('does not load')
		expect(readFileSync(join(proj, 'assistants', 'helper', 'tools.ts'), 'utf8')).toBe(TOOLS)
		expect(existsSync(join(proj, 'assistants', 'helper', '.staged-tools.ts'))).toBe(false)
		// A new provider lands and the view shows it used after the reload.
		const before = await (await api.get('/assistant/helper')).json()
		const other: string = before.providers.find((p: any) => !p.used).name
		const withOther = useFeature(TOOLS, { feature: other }).text
		const ok = await api.post('/assistant/helper/file/save', { path: 'tools.ts', text: withOther, digest: tools.digest })
		expect(ok.status).toBe(200)
		const view = await (await api.get('/assistant/helper')).json()
		expect(view.providers.find((p: any) => p.name === other).used).toBe(true)
		expect(view.use.map((u: any) => u.feature)).toContain(other)
		// A new file is made from the digest of nothing.
		const made = await api.post('/assistant/helper/file/save', { path: 'notes/plan.md', text: '# Plan\n', digest: digestOf('') })
		expect(made.status).toBe(200)
		expect(existsSync(join(proj, 'assistants', 'helper', 'notes', 'plan.md'))).toBe(true)
		expect((await api.post('/assistant/helper/file/save', { path: '../x.md', text: '', digest: digestOf('') })).status).toBe(400)
		// Rollback restores the newest backup.
		const back = await api.post('/assistant/helper/rollback', { path: 'tools.ts' })
		expect(back.status).toBe(200)
		expect(readFileSync(join(proj, 'assistants', 'helper', 'tools.ts'), 'utf8')).toBe(TOOLS)
	}, 60000)

	it('POST /assistant/<name>/edit answers the new text for a hook stub or a use entry', async () => {
		const hook = await (await api.post('/assistant/helper/edit', { op: 'hook', hook: 'stopped', text: HOOKS_TS })).json()
		expect(hook.ok).toBe(true)
		expect(hook.text).toContain('export async function stopped(_assistant: Assistant)')
		const use = await (await api.post('/assistant/helper/edit', { op: 'use', feature: 'grep', text: TOOLS })).json()
		expect(use.text).toContain("container.feature('grep').toTools()")
		expect((await api.post('/assistant/helper/edit', { op: 'use', feature: 'not a name', text: '' })).status).toBe(400)
		expect((await api.post('/assistant/helper/edit', { op: 'hook', hook: 'nope', text: '' })).status).toBe(400)
	})

	it('a chat opened about an assistant gets the brief and the editor tools', async () => {
		const opened = await (await api.post('/chat/open', { assistant: 'helper', conversationId: 'new', about: { assistant: 'shared' } })).json()
		expect(opened.ok).toBe(true)
		expect(opened.about).toEqual({ assistant: 'shared' })
		expect(opened.tools).toContain('writeAssistantFile')
		expect(opened.tools).toContain('testAssistant')
		// The link is kept with the conversation.
		const again = await (await api.post('/chat/open', { assistant: 'helper', conversationId: opened.conversationId })).json()
		expect(again.about).toEqual({ assistant: 'shared' })
		expect((await api.post('/chat/open', { assistant: 'helper', conversationId: 'new', about: { assistant: 'nobody' } })).status).toBe(404)
	}, 60000)

	it('a chat opened about a helper keeps the link and gets the inspector brief', async () => {
		const opened = await (await api.post('/chat/open', { assistant: 'helper', conversationId: 'new', about: { helper: { registry: 'features', id: 'fs' } } })).json()
		expect(opened.ok).toBe(true)
		expect(opened.about).toEqual({ helper: { registry: 'features', id: 'fs' } })
		// No editor tools for a helper: the brief is the whole of it.
		expect(opened.tools).not.toContain('writeAssistantFile')
		const again = await (await api.post('/chat/open', { assistant: 'helper', conversationId: opened.conversationId })).json()
		expect(again.about).toEqual({ helper: { registry: 'features', id: 'fs' } })
		expect((await api.post('/chat/open', { assistant: 'helper', conversationId: 'new', about: { helper: { registry: 'features', id: 'nope-xyz' } } })).status).toBe(404)
	}, 60000)
})
