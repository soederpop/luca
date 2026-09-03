import { describe, it, expect } from 'bun:test'
import { AGIContainer } from '../src/agi/container.server'
import type { Conversation, ContentPart } from '../src/agi/features/conversation'
import os from 'os'
import { join } from 'path'
import { mkdtempSync, writeFileSync } from 'fs'

// 1x1 red pixel PNG
const RED_PIXEL_B64 =
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

const tmpDir = mkdtempSync(join(os.tmpdir(), 'luca-tool-images-'))
const pngPath = join(tmpDir, 'shot.png')
writeFileSync(pngPath, Buffer.from(RED_PIXEL_B64, 'base64'))

function makeContainerAndConversation(opts: Record<string, any> = {}) {
	const container = new AGIContainer()
	const providers = container.feature('modelProviders')
	const conv = container.feature('conversation', { model: 'gpt-5', api: 'chat', ...opts }) as Conversation
	return { container, providers, conv }
}

/** Transport that asks for one `screenshot` tool call, then answers with final text. */
function installToolCallingTransport(providers: any) {
	const requests: any[] = []
	providers.registerTransport('openai-chat-completions', {
		apiMode: 'openai-chat-completions',
		async *stream(request: any) {
			requests.push(request)
			if (requests.length === 1) {
				yield {
					type: 'response',
					response: { content: '', toolCalls: [{ id: 'call_1', name: 'screenshot', arguments: {}, rawArguments: '{}' }] },
				} as const
				return
			}
			yield { type: 'response', response: { content: 'described', toolCalls: [] } } as const
		},
	})
	return requests
}

describe('tool results carrying images', () => {
	it('injects tool images as a user message the model sees on the next turn', async () => {
		const { providers, conv } = makeContainerAndConversation()
		const requests = installToolCallingTransport(providers)

		conv.addTool('screenshot', {
			description: 'Take a screenshot',
			parameters: { type: 'object', properties: {} },
			handler: async () => ({ path: pngPath, images: [pngPath] }),
		})

		const events: any[] = []
		conv.on('toolImages', (tool: string, count: number) => events.push([tool, count]))

		const answer = await conv.ask('What is on my screen?')
		expect(answer).toBe('described')
		expect(events).toEqual([['screenshot', 1]])

		// The tool-role message notes the attachment instead of embedding base64
		const toolMessage = conv.messages.find(m => m.role === 'tool') as any
		expect(toolMessage.content).toContain('1 image(s) attached')
		expect(toolMessage.content).toContain(pngPath)
		expect(toolMessage.content).not.toContain(RED_PIXEL_B64)

		// An injected user message carries the image as a data URL content part
		const injected = conv.messages.find(
			m => m.role === 'user' && Array.isArray(m.content)
		) as any
		expect(injected).toBeDefined()
		const parts = injected.content as ContentPart[]
		expect(parts[0]).toMatchObject({ type: 'text' })
		expect((parts[0] as any).text).toContain('screenshot')
		expect(parts[1]).toMatchObject({ type: 'image_url' })
		expect((parts[1] as any).image_url.url).toBe(`data:image/png;base64,${RED_PIXEL_B64}`)

		// And the second model request actually included it
		const secondRequestMessages = requests[1].messages
		const wireInjected = secondRequestMessages.find((m: any) => m.role === 'user' && Array.isArray(m.content))
		expect(wireInjected).toBeDefined()
	})

	it('routes injected images through imageDelegate when set', async () => {
		const { providers, conv } = makeContainerAndConversation()
		installToolCallingTransport(providers)

		conv.addTool('screenshot', {
			description: 'Take a screenshot',
			parameters: { type: 'object', properties: {} },
			handler: async () => ({ images: [pngPath] }),
		})

		conv.imageDelegate = async (parts: ContentPart[]) =>
			parts.map(p => (p.type === 'image_url' ? { type: 'text', text: '(a red pixel)' } : p))

		await conv.ask('Look')

		const injected = conv.messages.find(m => m.role === 'user' && Array.isArray(m.content)) as any
		const parts = injected.content as ContentPart[]
		expect(parts.every(p => p.type === 'text')).toBe(true)
		expect(parts.some(p => (p as any).text === '(a red pixel)')).toBe(true)
	})

	it('notes unreadable image paths instead of failing the tool call', async () => {
		const { providers, conv } = makeContainerAndConversation()
		installToolCallingTransport(providers)

		conv.addTool('screenshot', {
			description: 'Take a screenshot',
			parameters: { type: 'object', properties: {} },
			handler: async () => ({ images: ['/nope/missing.png'] }),
		})

		const answer = await conv.ask('Look')
		expect(answer).toBe('described')

		const toolMessage = conv.messages.find(m => m.role === 'tool') as any
		expect(toolMessage.content).toContain('imageErrors')
		// No image survived, so nothing gets injected
		expect(conv.messages.some(m => m.role === 'user' && Array.isArray(m.content))).toBe(false)
	})

	it('serializeToolResult leaves plain results untouched', () => {
		const { conv } = makeContainerAndConversation()
		expect(conv.serializeToolResult('t', 'plain')).toBe('plain')
		expect(conv.serializeToolResult('t', { ok: true })).toBe('{"ok":true}')
		expect(conv.serializeToolResult('t', [1, 2])).toBe('[1,2]')
		// data: and http(s) URLs pass through without filesystem access
		const dataUrl = `data:image/png;base64,${RED_PIXEL_B64}`
		const serialized = conv.serializeToolResult('t', { images: [dataUrl, 'https://example.com/x.png'] })
		expect(serialized).toContain('2 image(s) attached')
	})
})
