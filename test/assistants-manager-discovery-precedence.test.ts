import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { AGIContainer } from '../src/agi/container.server'

/**
 * Same assistant name in the project, the home folder and a plugin folder:
 * the project definition must be the one that gets used.
 */
describe('AssistantsManager discovery precedence', () => {
	let root: string

	// bun caches os.homedir(), so point the container's os feature at the fake home
	const makeContainer = (cwd: string) => {
		const container = new AGIContainer({ cwd })
		Object.defineProperty(container.os, 'homedir', { get: () => join(root, 'home') })
		return container
	}

	const writeAssistant = (folder: string, body: string) => {
		mkdirSync(folder, { recursive: true })
		writeFileSync(join(folder, 'CORE.md'), body)
	}

	beforeAll(() => {
		root = mkdtempSync(join(tmpdir(), 'luca-assistants-'))
		writeAssistant(join(root, 'home', '.luca', 'assistants', 'luca'), 'home version')
		writeAssistant(join(root, 'home', '.luca', 'assistants', 'homeOnly'), 'home only')
		writeAssistant(join(root, 'project', 'assistants', 'luca'), 'project version')
		writeAssistant(join(root, 'plugin', 'luca'), 'plugin version')
		writeAssistant(join(root, 'plugin', 'pluginOnly'), 'plugin only')
	})

	afterAll(() => {
		rmSync(root, { recursive: true, force: true })
	})

	it('lets the project folder win over home and plugin folders', async () => {
		const container = makeContainer(join(root, 'project'))
		const manager: any = container.feature('assistantsManager')
		await manager.addDiscoveryFolder(join(root, 'plugin'))

		const entry = manager.get('luca')
		expect(entry.folder).toBe(join(root, 'project', 'assistants', 'luca'))
		expect(entry.source).toBe('project')
		expect(entry.shadows).toEqual([
			join(root, 'home', '.luca', 'assistants', 'luca'),
			join(root, 'plugin', 'luca'),
		])
	})

	it('still picks up names that only exist in home or plugin folders', async () => {
		const container = makeContainer(join(root, 'project'))
		const manager: any = container.feature('assistantsManager')
		await manager.addDiscoveryFolder(join(root, 'plugin'))

		expect(manager.get('homeOnly').source).toBe('home')
		expect(manager.get('pluginOnly').source).toBe('extra')
	})

	it('lets the home folder win over a plugin folder', async () => {
		const container = makeContainer(join(root, 'empty-project'))
		const manager: any = container.feature('assistantsManager')
		await manager.addDiscoveryFolder(join(root, 'plugin'))

		expect(manager.get('luca').source).toBe('home')
	})
})
