import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { AGIContainer } from '../src/agi/container.server'

/**
 * Disabling exists so a workspace can hide an assistant it can't actually run —
 * typically one contributed by a plugin whose feature dependencies aren't
 * installed here (the googleWorkspace/gws case). Hidden from every listing
 * surface, still runnable by name.
 */
describe('AssistantsManager disabling', () => {
	let container: AGIContainer
	let manager: any
	let tmpDir: string
	let originalCwd: string

	function writeAssistant(name: string) {
		container.fs.mkdirSync(`${tmpDir}/assistants/${name}`, { recursive: true })
		container.fs.writeFileSync(`${tmpDir}/assistants/${name}/CORE.md`, `You are ${name}.`)
	}

	function writeOptions(lines: string[]) {
		container.fs.writeFileSync(`${tmpDir}/assistants/options.yml`, lines.join('\n'))
	}

	beforeEach(() => {
		container = new AGIContainer()
		const rand = container.utils.uuid().slice(0, 8)
		tmpDir = container.paths.resolve(container.os.tmpdir, `luca-am-disabled-${rand}`)
		container.fs.mkdirSync(`${tmpDir}/assistants`, { recursive: true })
		originalCwd = process.cwd()
		process.chdir(tmpDir)
		// Rebuild container so paths.resolve() picks up the new cwd
		container = new AGIContainer()
		// Point homedir at the sandbox too — discover() scans ~/.luca/assistants,
		// so a developer's real global assistants would leak into the listings
		// (bun's os.homedir() ignores $HOME, so shadow the feature getter)
		Object.defineProperty(container.os, 'homedir', { value: tmpDir, configurable: true })
		manager = container.feature('assistantsManager')
	})

	afterEach(() => {
		process.chdir(originalCwd)
		try { container.fs.rmSync(tmpDir, { recursive: true, force: true }) } catch {}
	})

	it('options.yml `disabled: true` hides an assistant from available and list()', async () => {
		writeAssistant('googleWorkspace')
		writeAssistant('chiefOfStaff')
		writeOptions(['googleWorkspace:', '  disabled: true'])

		await manager.discover()

		expect(manager.available).toEqual(['chiefOfStaff'])
		expect(manager.availableAssistants).toEqual(['chiefOfStaff'])
		expect(manager.list().map((e: any) => e.name)).toEqual(['chiefOfStaff'])
		expect(manager.isDisabled('googleWorkspace')).toBe(true)
		expect(manager.disabledAssistants).toEqual(['googleWorkspace'])
	})

	it('a disabled assistant is still in entries and still resolvable by name', async () => {
		writeAssistant('googleWorkspace')
		writeOptions(['googleWorkspace:', '  disabled: true'])

		await manager.discover()

		// `luca chat googleWorkspace` resolves through get() — it must still work
		expect(Object.keys(manager.entries)).toContain('googleWorkspace')
		expect(manager.get('googleWorkspace')).toBeTruthy()
		expect(manager.create('googleWorkspace')).toBeTruthy()
	})

	it('supports the top-level `disabled:` list form', async () => {
		writeAssistant('googleWorkspace')
		writeAssistant('telnyxOps')
		writeAssistant('chiefOfStaff')
		writeOptions(['disabled:', '  - googleWorkspace', '  - telnyxOps'])

		await manager.discover()

		expect(manager.available).toEqual(['chiefOfStaff'])
		expect(manager.disabledAssistants.sort()).toEqual(['googleWorkspace', 'telnyxOps'])
	})

	it('accepts the assistants/ prefixed name', async () => {
		writeAssistant('googleWorkspace')
		writeOptions(['googleWorkspace:', '  disabled: true'])

		await manager.discover()
		expect(manager.isDisabled('assistants/googleWorkspace')).toBe(true)
	})

	it('disableAssistant()/enableAssistant() round-trips and emits assistantDisabled', async () => {
		writeAssistant('googleWorkspace')
		await manager.discover()

		const events: Array<[string, boolean]> = []
		manager.on('assistantDisabled', (name: string, isDisabled: boolean) => {
			events.push([name, isDisabled])
		})

		expect(manager.available).toEqual(['googleWorkspace'])

		manager.disableAssistant('googleWorkspace')
		expect(manager.available).toEqual([])
		expect(manager.isDisabled('googleWorkspace')).toBe(true)

		// Idempotent — no duplicate event, no duplicate state entry
		manager.disableAssistant('googleWorkspace')
		expect(manager.state.get('disabled')).toEqual(['googleWorkspace'])

		manager.enableAssistant('googleWorkspace')
		expect(manager.available).toEqual(['googleWorkspace'])
		expect(manager.isDisabled('googleWorkspace')).toBe(false)

		expect(events).toEqual([['googleWorkspace', true], ['googleWorkspace', false]])
	})

	it('enableAssistant() does not override an options.yml disable', async () => {
		writeAssistant('googleWorkspace')
		writeOptions(['googleWorkspace:', '  disabled: true'])

		await manager.discover()
		manager.enableAssistant('googleWorkspace')

		// options.yml is the workspace owner's declaration — it wins
		expect(manager.isDisabled('googleWorkspace')).toBe(true)
	})

	it('hides factory-registered assistants too', async () => {
		await manager.discover()
		manager.register('ghostBot', (opts: Record<string, any>) =>
			container.feature('assistant', { name: 'ghost-instance', ...opts }),
		)

		expect(manager.available).toEqual(['ghostBot'])
		manager.disableAssistant('ghostBot')

		expect(manager.available).toEqual([])
		expect(manager.list()).toEqual([])
	})

	it('does not leak `disabled` into the options handed to the assistant', async () => {
		writeOptions(['googleWorkspace:', '  disabled: true', '  model: qwen3-coder'])
		await manager.discover()

		let received: Record<string, any> = {}
		manager.register('googleWorkspace', (opts: Record<string, any>) => {
			received = opts
			return container.feature('assistant', { name: 'gws-instance', ...opts })
		})

		manager.create('googleWorkspace')

		expect(received.model).toBe('qwen3-coder')
		expect('disabled' in received).toBe(false)
		expect(manager.overridesFor('googleWorkspace')).toEqual({ model: 'qwen3-coder' })
	})

	it('`disabled` is reserved — no unusedOverrides and no stripped-key warning', async () => {
		writeAssistant('googleWorkspace')
		writeOptions(['disabled:', '  - googleWorkspace'])

		let unused: string[] = []
		manager.on('unusedOverrides', (names: string[]) => { unused = names })

		const warnings: string[] = []
		const originalWarn = console.warn
		console.warn = (...args: any[]) => { warnings.push(args.join(' ')) }
		try {
			await manager.discover()
		} finally {
			console.warn = originalWarn
		}

		expect(unused).toEqual([])
		expect(warnings.filter((w) => w.includes('disabled'))).toEqual([])
	})

	it('per-assistant `disabled: true` does not make it look like an unused override', async () => {
		writeAssistant('googleWorkspace')
		writeOptions(['googleWorkspace:', '  disabled: true'])

		let unused: string[] = []
		manager.on('unusedOverrides', (names: string[]) => { unused = names })

		await manager.discover()
		expect(unused).toEqual([])
	})
})
