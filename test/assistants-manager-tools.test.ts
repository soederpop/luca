import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { AGIContainer } from '../src/agi/container.server'

/**
 * The manager's tool bundle exists so an assistant can build and maintain OTHER
 * assistants (mount with `export const use = [container.feature('assistantsManager')]`).
 * The write path is guarded: broken TypeScript is rejected before it lands, and
 * every overwrite is backed up to .history/ — that folder is the rollback
 * mechanism, deliberately instead of git.
 */
describe('AssistantsManager definition tools', () => {
	let container: AGIContainer
	let manager: any
	let tmpDir: string
	let originalCwd: string

	function writeAssistant(name: string) {
		container.fs.mkdirSync(`${tmpDir}/assistants/${name}`, { recursive: true })
		container.fs.writeFileSync(`${tmpDir}/assistants/${name}/CORE.md`, `You are ${name}.`)
	}

	beforeEach(() => {
		container = new AGIContainer()
		const rand = container.utils.uuid().slice(0, 8)
		tmpDir = container.paths.resolve(container.os.tmpdir, `luca-am-tools-${rand}`)
		container.fs.mkdirSync(`${tmpDir}/assistants`, { recursive: true })
		originalCwd = process.cwd()
		process.chdir(tmpDir)
		// Rebuild container so paths.resolve() picks up the new cwd
		container = new AGIContainer()
		manager = container.feature('assistantsManager')
	})

	afterEach(() => {
		process.chdir(originalCwd)
		try { container.fs.rmSync(tmpDir, { recursive: true, force: true }) } catch {}
	})

	it('toTools() exposes the full bundle with bound handlers', () => {
		const bundle = manager.toTools()
		const expected = [
			'listAssistants',
			'createAssistant',
			'readDefinitionFile',
			'writeDefinitionFile',
			'rollbackDefinitionFile',
			'listDefinitionHistory',
			'testAssistant',
			'reloadAssistant',
		]
		for (const name of expected) {
			expect(Object.keys(bundle.schemas)).toContain(name)
			expect(typeof bundle.handlers[name]).toBe('function')
		}
	})

	it('createAssistant creates the folder and makes the assistant discoverable', async () => {
		const result = await manager.createAssistant({ name: 'haikuWriter', corePrompt: 'You write haiku.' })
		expect(result.created).toBe('haikuWriter')
		expect(container.fs.exists(`${tmpDir}/assistants/haikuWriter/CORE.md`)).toBe(true)
		expect(container.fs.exists(`${tmpDir}/assistants/haikuWriter/tools.ts`)).toBe(true)
		expect(manager.available).toContain('haikuWriter')
	})

	it('createAssistant refuses to overwrite an existing assistant', async () => {
		writeAssistant('existing')
		await manager.discover()
		expect(manager.createAssistant({ name: 'existing', corePrompt: 'nope' })).rejects.toThrow(/already exists/)
	})

	it('readDefinitionFile returns contents and rejects non-definition files', async () => {
		writeAssistant('reader')
		await manager.discover()
		expect(manager.readDefinitionFile({ name: 'reader', file: 'CORE.md' })).toBe('You are reader.')
		expect(() => manager.readDefinitionFile({ name: 'reader', file: '../../etc/passwd' })).toThrow(/not a definition file/)
		expect(() => manager.readDefinitionFile({ name: 'reader', file: 'secrets.env' })).toThrow(/not a definition file/)
	})

	it('writeDefinitionFile rejects broken TypeScript and leaves the original untouched', async () => {
		writeAssistant('fragile')
		const toolsPath = `${tmpDir}/assistants/fragile/tools.ts`
		container.fs.writeFileSync(toolsPath, 'export const schemas = {}\n')
		await manager.discover()

		expect(
			manager.writeDefinitionFile({ name: 'fragile', file: 'tools.ts', content: 'export const schemas = {' })
		).rejects.toThrow(/failed to load/)

		expect(container.fs.readFileSync(toolsPath, 'utf8')).toBe('export const schemas = {}\n')
		// The staged parse-check file must not linger
		expect(container.fs.exists(`${tmpDir}/assistants/fragile/.staged-tools.ts`)).toBe(false)
	})

	it('write → history → rollback round-trips the previous content', async () => {
		writeAssistant('mutable')
		await manager.discover()

		const v2 = '# v2 prompt'
		const write = await manager.writeDefinitionFile({ name: 'mutable', file: 'CORE.md', content: v2 })
		expect(write.backedUp).toMatch(/^\.history\//)
		expect(manager.readDefinitionFile({ name: 'mutable', file: 'CORE.md' })).toBe(v2)

		const history = manager.listDefinitionHistory({ name: 'mutable', file: 'CORE.md' })
		expect(history.length).toBe(1)

		const rollback = await manager.rollbackDefinitionFile({ name: 'mutable', file: 'CORE.md' })
		expect(rollback.restoredFrom).toBe(history[0])
		expect(manager.readDefinitionFile({ name: 'mutable', file: 'CORE.md' })).toBe('You are mutable.')
	})

	it('rollbackDefinitionFile with no history explains itself', async () => {
		writeAssistant('pristine')
		await manager.discover()
		expect(manager.rollbackDefinitionFile({ name: 'pristine', file: 'CORE.md' })).rejects.toThrow(/No history/)
	})

	it('.history/ never shows up as a discovered assistant', async () => {
		writeAssistant('parent')
		await manager.discover()
		await manager.writeDefinitionFile({ name: 'parent', file: 'CORE.md', content: 'v2' })
		await manager.discover()
		expect(manager.available).not.toContain('.history')
	})
})
