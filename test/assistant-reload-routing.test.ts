import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { AGIContainer } from '../src/agi/container.server'

/**
 * reload() must propagate CORE.md frontmatter routing edits (model/provider)
 * to the live conversation — a model change in the desktop app previously
 * required a full process restart to take effect.
 */
describe('Assistant reload routing', () => {
	let container: AGIContainer
	let root: string
	let folder: string

	const writeCore = (frontmatter: string) => {
		writeFileSync(join(folder, 'CORE.md'), `---\n${frontmatter}\n---\nYou are a test assistant.\n`)
	}

	beforeEach(() => {
		container = new AGIContainer()
		root = mkdtempSync(join(tmpdir(), 'luca-reload-'))
		folder = join(root, 'assistants', 'bot')
		mkdirSync(folder, { recursive: true })
	})

	afterEach(() => {
		rmSync(root, { recursive: true, force: true })
	})

	it('applies a frontmatter model edit to the live conversation', () => {
		writeCore('model: old-model')
		const assistant = container.feature('assistant', { folder, cached: false })
		expect(assistant.conversation.routing.model).toBe('old-model')

		writeCore('model: new-model')
		assistant.reload()

		expect(assistant.routing.model).toBe('new-model')
		// The edit came from frontmatter, not a caller — a second edit must not
		// be masked by the first one having been recorded as a caller option.
		expect((assistant.options as any).model).toBeUndefined()

		writeCore('model: third-model')
		assistant.reload()
		expect(assistant.routing.model).toBe('third-model')
	})

	it('leaves routing alone when an explicit constructor model is pinned', () => {
		writeCore('model: old-model')
		const assistant = container.feature('assistant', { folder, cached: false, model: 'pinned-model' })
		expect(assistant.conversation.routing.model).toBe('pinned-model')

		writeCore('model: new-model')
		assistant.reload()

		expect(assistant.routing.model).toBe('pinned-model')
	})

	it('does nothing when frontmatter routing is unchanged', () => {
		writeCore('model: same-model\ntemperature: 0.2')
		const assistant = container.feature('assistant', { folder, cached: false })
		expect(assistant.conversation.routing.model).toBe('same-model')

		const events: any[] = []
		assistant.conversation.on('routingChanged', (change: any) => events.push(change))

		writeCore('model: same-model\ntemperature: 0.7')
		assistant.reload()

		expect(assistant.routing.model).toBe('same-model')
		expect(events.length).toBe(0)
	})
})
