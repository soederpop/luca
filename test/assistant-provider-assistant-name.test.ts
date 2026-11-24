import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { AGIContainer } from '../src/agi/container.server'

/**
 * A CLI provider (claude-code) reaches the assistant's tools by spawning
 * `luca mcp --assistant <providerOptions.assistant>`. That value must be the
 * folder name, because the folder name is what `luca mcp` resolves. The
 * container fills `options.name` with the registry id ("assistant") for every
 * manager-created assistant, so defaulting to `this.name` started a server no
 * assistant matched, and the session ran with none of its declared tools.
 */
describe('Assistant passes its folder name as providerOptions.assistant', () => {
	let container: AGIContainer
	let manager: any
	let tmpDir: string
	let originalCwd: string

	beforeEach(async () => {
		container = new AGIContainer()
		const rand = container.utils.uuid().slice(0, 8)
		tmpDir = container.paths.resolve(container.os.tmpdir, `luca-provider-name-${rand}`)
		container.fs.mkdirSync(`${tmpDir}/assistants/salesChief`, { recursive: true })
		container.fs.writeFileSync(`${tmpDir}/assistants/salesChief/CORE.md`, 'You are salesChief.')
		originalCwd = process.cwd()
		process.chdir(tmpDir)
		// Rebuild so paths.resolve() picks up the new cwd, and keep the
		// developer's real ~/.luca/assistants out of discovery.
		container = new AGIContainer()
		Object.defineProperty(container.os, 'homedir', { value: tmpDir, configurable: true })
		manager = container.feature('assistantsManager')
		await manager.discover()
	})

	afterEach(() => {
		process.chdir(originalCwd)
		try { container.fs.rmSync(tmpDir, { recursive: true, force: true }) } catch {}
	})

	it('defaults to the folder name when created with a provider', () => {
		const assistant = manager.create('salesChief', { provider: 'claude-code' })
		expect(assistant.conversation.options.providerOptions.assistant).toBe('salesChief')
	})

	it('defaults to the folder name when the provider is switched at runtime', () => {
		const assistant = manager.create('salesChief')
		assistant.setProvider('claude-code')
		expect(assistant.options.providerOptions.assistant).toBe('salesChief')
		expect(assistant.conversation.options.providerOptions.assistant).toBe('salesChief')
	})

	it('keeps an explicit providerOptions.assistant', () => {
		const assistant = manager.create('salesChief', {
			provider: 'claude-code',
			providerOptions: { assistant: 'someoneElse' },
		})
		expect(assistant.conversation.options.providerOptions.assistant).toBe('someoneElse')
	})

	it('a fork inherits the folder name', async () => {
		const assistant = manager.create('salesChief', { provider: 'claude-code' })
		const fork = await assistant.fork({ history: 'none' })
		expect(fork.conversation.options.providerOptions.assistant).toBe('salesChief')
	})
})
