import { describe, it, expect } from 'bun:test'
import { AGIContainer } from '../src/agi/container.server'
import type { ConversationHistory } from '../src/agi/features/conversation-history'

function createHistory() {
	const container = new AGIContainer()
	const cachePath = container.paths.resolve(container.feature('os').tmpdir, `luca-history-export-${container.utils.uuid()}`)
	return container.feature('conversationHistory', { cachePath, namespace: 'export-test' }) as ConversationHistory
}

const messages = [{ role: 'user', content: 'hello' }] as any

describe('ConversationHistory.exportAll', () => {
	it('combines every conversation with its full messages', async () => {
		const history = createHistory()
		await history.create({ messages, thread: 'researcher:abc:2026-01-01' })
		await history.create({ messages, thread: 'coder:abc:2026-01-01' })

		const exported = await history.exportAll()

		expect(exported.count).toBe(2)
		expect(exported.conversations.map(c => c.messages)).toEqual([messages, messages])
		expect(exported.missing).toEqual([])
		expect(JSON.parse(JSON.stringify(exported))).toEqual(exported)
	})

	it('narrows to one assistant with threadPrefix', async () => {
		const history = createHistory()
		await history.create({ messages, thread: 'researcher:abc:2026-01-01' })
		await history.create({ messages, thread: 'researcher2:abc:2026-01-01' })

		const exported = await history.exportAll({ threadPrefix: 'researcher:' })

		expect(exported.conversations.map(c => c.thread)).toEqual(['researcher:abc:2026-01-01'])
	})

	it('reports conversations whose record cannot be loaded', async () => {
		const history = createHistory()
		const record = await history.create({ messages, thread: 'researcher:abc:2026-01-01' })
		history.load = async () => null

		const exported = await history.exportAll()

		expect(exported.count).toBe(0)
		expect(exported.missing).toEqual([record.id])
	})

	it('returns an empty export when nothing is stored', async () => {
		const exported = await createHistory().exportAll()

		expect(exported.count).toBe(0)
		expect(exported.conversations).toEqual([])
	})
})
