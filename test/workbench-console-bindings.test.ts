import { describe, it, expect } from 'bun:test'
import { NodeContainer } from '../src/node/container'
import { ConsoleSessions } from '../src/workbench/console'

// A chat's `/console` opens session `chat-<id>` with `assistant` bound to the
// chat's live instance. The binding is asked on every entry, so a rebuilt
// instance replaces the old one, and a name the user reassigned stays theirs.
describe('console bindings', () => {
	it('binds outside names, follows changes, and yields to the user', async () => {
		const container = new NodeContainer({ cwd: process.cwd() })
		let current: any = { name: 'first' }
		const consoles = new ConsoleSessions(container, (session) => (session === 'chat-1' ? { assistant: current } : undefined))

		const a = await consoles.run('assistant.name', 'chat-1')
		expect(a.ok && a.text).toBe('first')

		current = { name: 'second' }
		const b = await consoles.run('assistant.name', 'chat-1')
		expect(b.ok && b.text).toBe('second')

		await consoles.run('assistant = { name: "mine" }', 'chat-1')
		current = { name: 'third' }
		const c = await consoles.run('assistant.name', 'chat-1')
		expect(c.ok && c.text).toBe('mine')

		// Asked as a string: a bare `assistant` would become feature('assistant')
		// whenever the AGI registry is loaded, which is not the binding leaking.
		const d = await consoles.run("Object.hasOwn(globalThis, 'assistant')", 'default')
		expect(d.ok && d.text).toBe('false')
	})
})
