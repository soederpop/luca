import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { AGIContainer } from '../src/agi/container.server'

/**
 * preloadDocs and setup let a project configure a shared assistant (one that
 * lives outside the project, e.g. ~/.luca/assistants) with its own docs and
 * setup code. Option paths resolve against the project cwd; CORE.md
 * frontmatter paths resolve against the assistant folder.
 */
describe('Assistant preloadDocs + setup', () => {
	let container: AGIContainer
	let projectDir: string
	let sharedDir: string
	let originalCwd: string

	beforeEach(() => {
		const tmp = new AGIContainer()
		const rand = tmp.utils.uuid().slice(0, 8)
		projectDir = tmp.paths.resolve(tmp.os.tmpdir, `luca-preload-project-${rand}`)
		sharedDir = tmp.paths.resolve(tmp.os.tmpdir, `luca-preload-shared-${rand}`)
		tmp.fs.mkdirSync(`${projectDir}/assistants`, { recursive: true })
		tmp.fs.mkdirSync(`${projectDir}/docs`, { recursive: true })
		tmp.fs.mkdirSync(sharedDir, { recursive: true })

		tmp.fs.writeFileSync(`${sharedDir}/CORE.md`, '---\npreloadDocs: own.md\nsetup: own-setup.ts\n---\nYou are shared.')
		tmp.fs.writeFileSync(`${sharedDir}/own.md`, 'SHARED DOC')
		tmp.fs.writeFileSync(`${sharedDir}/own-setup.ts`, 'export default async function (a) { a.state.set("calls", [...(a.state.get("calls") || []), "own"]) }')

		tmp.fs.writeFileSync(`${projectDir}/docs/a.md`, 'PROJECT DOC A')
		tmp.fs.writeFileSync(`${projectDir}/docs/b.txt`, 'PROJECT DOC B')
		tmp.fs.writeFileSync(`${projectDir}/setup.ts`, 'export async function setup(a) { await new Promise(r => setTimeout(r, 5)); a.state.set("calls", [...(a.state.get("calls") || []), "project"]) }')

		originalCwd = process.cwd()
		process.chdir(projectDir)
		container = new AGIContainer()
	})

	afterEach(() => {
		process.chdir(originalCwd)
		try { container.fs.rmSync(projectDir, { recursive: true, force: true }) } catch {}
		try { container.fs.rmSync(sharedDir, { recursive: true, force: true }) } catch {}
	})

	it('appends frontmatter docs, then option docs resolved against cwd', () => {
		const assistant = container.feature('assistant', {
			folder: sharedDir,
			preloadDocs: ['docs/a.md', 'docs/b.txt'],
		}) as any

		expect(assistant.systemPrompt).toBe('You are shared.\n\nSHARED DOC\n\nPROJECT DOC A\n\nPROJECT DOC B')
	})

	it('accepts a single string and skips missing files', () => {
		const assistant = container.feature('assistant', {
			systemPrompt: 'Base.',
			preloadDocs: 'docs/missing.md',
		}) as any
		expect(assistant.systemPrompt).toBe('Base.')

		const single = container.feature('assistant', { systemPrompt: 'Base.', preloadDocs: 'docs/a.md' }) as any
		expect(single.systemPrompt).toBe('Base.\n\nPROJECT DOC A')
	})

	it('reload() re-reads preloaded docs', () => {
		const assistant = container.feature('assistant', { systemPrompt: 'Base.', preloadDocs: ['docs/a.md'] }) as any
		container.fs.writeFileSync(`${projectDir}/docs/a.md`, 'EDITED')
		assistant.reload()
		expect(assistant.systemPrompt).toBe('Base.\n\nEDITED')
	})

	it('runs setup modules once, frontmatter first, default or setup export', async () => {
		const assistant = container.feature('assistant', {
			folder: sharedDir,
			setup: 'setup.ts',
			model: 'gpt-5',
		}) as any

		await assistant.start()
		expect(assistant.state.get('calls')).toEqual(['own', 'project'])

		await assistant.stop()
		await assistant.start()
		expect(assistant.state.get('calls')).toEqual(['own', 'project'])
	})

	it('fails start() when a setup module exports no function', async () => {
		container.fs.writeFileSync(`${projectDir}/bad.ts`, 'export const nope = 1')
		const assistant = container.feature('assistant', { systemPrompt: 'x', setup: ['bad.ts'], model: 'gpt-5' }) as any
		await expect(assistant.start()).rejects.toThrow(/default function or a function named "setup"/)
	})

	it('reads preloadDocs and setup from assistants/options.yml', async () => {
		container.fs.mkdirSync(`${projectDir}/assistants/helper`, { recursive: true })
		container.fs.writeFileSync(`${projectDir}/assistants/helper/CORE.md`, 'Helper.')
		container.fs.writeFileSync(
			`${projectDir}/assistants/options.yml`,
			['helper:', '  preloadDocs:', '    - docs/a.md', '  setup: setup.ts'].join('\n'),
		)

		const manager = container.feature('assistantsManager') as any
		await manager.discover()
		const assistant = manager.create('helper', { model: 'gpt-5' })

		expect(assistant.systemPrompt).toBe('Helper.\n\nPROJECT DOC A')
		await assistant.start()
		expect(assistant.state.get('calls')).toEqual(['project'])
	})
})
