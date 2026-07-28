import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { AGIContainer } from '../src/agi/container.server'

describe('AssistantsManager workspace config (options.yml + hooks.ts)', () => {
	let container: AGIContainer
	let manager: any
	let tmpDir: string
	let originalCwd: string

	beforeEach(() => {
		container = new AGIContainer()
		const rand = container.utils.uuid().slice(0, 8)
		tmpDir = container.paths.resolve(container.os.tmpdir, `luca-am-ws-${rand}`)
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

	it('discover() loads assistants/options.yml into overrides', async () => {
		container.fs.writeFileSync(
			`${tmpDir}/assistants/options.yml`,
			[
				'defaults:',
				'  temperature: 0.3',
				'chiefOfStaff:',
				'  provider: deepseek-v4',
				'  model: qwen3-coder',
			].join('\n'),
		)

		let loadedPath = ''
		manager.on('workspaceOptionsLoaded', (p: string) => { loadedPath = p })

		await manager.discover()

		expect(loadedPath.endsWith('/assistants/options.yml')).toBe(true)
		expect(manager.overridesFor('chiefOfStaff')).toEqual({
			temperature: 0.3,
			provider: 'deepseek-v4',
			model: 'qwen3-coder',
		})
	})

	it('applies options.yml overrides to plugin-registered assistants', async () => {
		container.fs.writeFileSync(
			`${tmpDir}/assistants/options.yml`,
			'chiefOfStaff:\n  provider: deepseek-v4\n',
		)

		await manager.discover()

		let received: Record<string, any> = {}
		manager.register('chiefOfStaff', (opts: Record<string, any>) => {
			received = opts
			return container.feature('assistant', { name: 'chief-instance', ...opts })
		})

		manager.create('chiefOfStaff')
		expect(received.provider).toBe('deepseek-v4')
	})

	it('emits unusedOverrides for keys with no matching assistant', async () => {
		container.fs.writeFileSync(
			`${tmpDir}/assistants/options.yml`,
			'ghostBot:\n  model: nope\n',
		)

		let unused: string[] = []
		manager.on('unusedOverrides', (names: string[]) => { unused = names })

		await manager.discover()
		expect(unused).toEqual(['ghostBot'])
	})

	it('workspace hooks.ts beforeAssistantCreated can rewrite options and onAssistantCreated fires', async () => {
		container.fs.writeFileSync(
			`${tmpDir}/assistants/hooks.ts`,
			[
				'export function beforeAssistantCreated(name, options) {',
				'  return { ...options, injected: name + "-mutated" }',
				'}',
				'export function onAssistantCreated(assistant, name, manager) {',
				'  manager.__testSeenAssistant = name',
				'}',
			].join('\n'),
		)

		let hooksPath = ''
		manager.on('workspaceHooksLoaded', (p: string) => { hooksPath = p })

		await manager.discover()
		expect(hooksPath.endsWith('/assistants/hooks.ts')).toBe(true)

		let received: Record<string, any> = {}
		manager.register('bot', (opts: Record<string, any>) => {
			received = opts
			return container.feature('assistant', { name: 'bot-instance', ...opts })
		})

		manager.create('bot', { model: 'cli-model' })

		expect(received.injected).toBe('bot-mutated')
		expect(received.model).toBe('cli-model')
		expect(manager.__testSeenAssistant).toBe('bot')
	})

	it('beforeAssistantCreated returning void leaves options untouched', async () => {
		container.fs.writeFileSync(
			`${tmpDir}/assistants/hooks.ts`,
			'export function beforeAssistantCreated() { /* observe only */ }\n',
		)

		await manager.discover()

		let received: Record<string, any> = {}
		manager.register('bot', (opts: Record<string, any>) => {
			received = opts
			return container.feature('assistant', { name: 'bot-instance', ...opts })
		})

		manager.create('bot', { model: 'x' })
		expect(received.model).toBe('x')
	})

	it('a throwing hook is logged and does not break create()', async () => {
		container.fs.writeFileSync(
			`${tmpDir}/assistants/hooks.ts`,
			'export function beforeAssistantCreated() { throw new Error("boom") }\n',
		)

		await manager.discover()

		manager.register('bot', (opts: Record<string, any>) =>
			container.feature('assistant', { name: 'bot-instance', ...opts }),
		)

		expect(() => manager.create('bot')).not.toThrow()
	})

	it('no options.yml + no hooks.ts is a silent no-op', async () => {
		await manager.discover()
		expect(manager.state.get('workspaceOptionsPath')).toBe(null)
		expect(manager.state.get('workspaceHooksPath')).toBe(null)
		expect(manager.overridesFor('anything')).toEqual({})
	})
})
