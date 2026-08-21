import { describe, expect, it, afterEach } from 'bun:test'
import { AGIContainer } from '../src/agi/container.server'
import { Assistant } from '../src/agi/features/assistant'
import type { ContentPart } from '../src/agi/features/conversation'

const RED_PIXEL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

function imagePart(url = RED_PIXEL): ContentPart {
	return { type: 'image_url', image_url: { url } }
}

/** Stub out container.client('openai') so no real API is hit. */
function stubVisionClient(c: AGIContainer, describe: (messages: any[], options: any) => string) {
	const calls: { messages: any[]; options: any; clientOptions: any }[] = []
	const originalClient = c.client.bind(c)
	;(c as any).client = (id: string, clientOptions: any = {}) => {
		if (id !== 'openai') return originalClient(id as any, clientOptions)
		return {
			async createChatCompletion(messages: any[], options: any) {
				calls.push({ messages, options, clientOptions })
				return { choices: [{ message: { content: describe(messages, options) } }] }
			},
		}
	}
	return calls
}

const savedEnv = {
	model: process.env.LUCA_VISION_SUPPORT_MODEL,
	url: process.env.LUCA_VISION_SUPPORT_URL,
	apiKey: process.env.LUCA_VISION_SUPPORT_API_KEY,
}

afterEach(() => {
	if (savedEnv.model === undefined) delete process.env.LUCA_VISION_SUPPORT_MODEL
	else process.env.LUCA_VISION_SUPPORT_MODEL = savedEnv.model
	if (savedEnv.url === undefined) delete process.env.LUCA_VISION_SUPPORT_URL
	else process.env.LUCA_VISION_SUPPORT_URL = savedEnv.url
	if (savedEnv.apiKey === undefined) delete process.env.LUCA_VISION_SUPPORT_API_KEY
	else process.env.LUCA_VISION_SUPPORT_API_KEY = savedEnv.apiKey
})

describe('Assistant visionSupport', () => {
	it('is disabled by default', () => {
		const c = new AGIContainer()
		const assistant = c.feature('assistant', { systemPrompt: 'test' })
		expect(assistant.visionSupport).toBeUndefined()
	})

	it('resolves defaults from env vars when enabled with true', () => {
		process.env.LUCA_VISION_SUPPORT_MODEL = 'qwen3-vl'
		process.env.LUCA_VISION_SUPPORT_URL = 'http://localhost:1234/v1'
		process.env.LUCA_VISION_SUPPORT_API_KEY = 'test-key'

		const c = new AGIContainer()
		const assistant = c.feature('assistant', { systemPrompt: 'test', visionSupport: true } as any)

		expect(assistant.visionSupport).toMatchObject({
			model: 'qwen3-vl',
			url: 'http://localhost:1234/v1',
			apiKey: 'test-key',
			prompt: Assistant.defaultVisionPrompt,
		})
	})

	it('explicit options win over env vars, and model falls back to gpt-5.2', () => {
		delete process.env.LUCA_VISION_SUPPORT_MODEL
		process.env.LUCA_VISION_SUPPORT_URL = 'http://env-url/v1'

		const c = new AGIContainer()
		const assistant = c.feature('assistant', {
			systemPrompt: 'test',
			visionSupport: { url: 'http://explicit/v1', prompt: 'Describe it.' },
		} as any)

		expect(assistant.visionSupport).toMatchObject({
			model: 'gpt-5.2',
			url: 'http://explicit/v1',
			prompt: 'Describe it.',
		})
	})

	it('describeImages replaces image parts with vision-model descriptions in place', async () => {
		const c = new AGIContainer()
		const calls = stubVisionClient(c, () => 'A single red pixel.')

		const assistant = c.feature('assistant', {
			systemPrompt: 'test',
			visionSupport: { model: 'fake-vl', url: 'http://fake/v1', apiKey: 'k' },
		} as any)

		const events: any[] = []
		assistant.on('visionDescription', (e: any) => events.push(e))

		const parts: ContentPart[] = [
			{ type: 'text', text: 'What is this?' },
			imagePart(),
			imagePart(),
		]
		const result = await assistant.describeImages(parts)

		expect(result).toHaveLength(3)
		expect(result[0]).toEqual({ type: 'text', text: 'What is this?' })
		expect(result[1]!.type).toBe('text')
		expect((result[1] as any).text).toContain('Image 1 of 2')
		expect((result[1] as any).text).toContain('A single red pixel.')
		expect((result[2] as any).text).toContain('Image 2 of 2')

		// One vision call per image, carrying the prompt + the image part
		expect(calls).toHaveLength(2)
		expect(calls[0]!.options.model).toBe('fake-vl')
		expect(calls[0]!.clientOptions).toMatchObject({ defaultModel: 'fake-vl', baseURL: 'http://fake/v1', apiKey: 'k' })
		const content = calls[0]!.messages[0].content
		expect(content[0]).toEqual({ type: 'text', text: Assistant.defaultVisionPrompt })
		expect(content[1].type).toBe('image_url')

		expect(events).toHaveLength(2)
		expect(events[0]).toMatchObject({ index: 0, description: 'A single red pixel.', model: 'fake-vl' })
	})

	it('a failed vision call degrades to an explanatory text part instead of throwing', async () => {
		const c = new AGIContainer()
		;(c as any).client = () => ({
			async createChatCompletion() {
				throw new Error('connection refused')
			},
		})

		const assistant = c.feature('assistant', {
			systemPrompt: 'test',
			visionSupport: { model: 'fake-vl' },
		} as any)

		const result = await assistant.describeImages([imagePart()])
		expect(result[0]!.type).toBe('text')
		expect((result[0] as any).text).toContain('could not be analyzed')
		expect((result[0] as any).text).toContain('connection refused')
	})

	it('ask() sends descriptions (not images) to the assistant model when visionSupport is on', async () => {
		const c = new AGIContainer()
		stubVisionClient(c, () => 'A red square on a white background.')

		const providers = c.feature('modelProviders')
		const requests: any[] = []
		providers.registerProfile({ id: 'vision-fake', apiMode: 'vision-fake', auth: 'none', defaultModel: 'text-only-model' })
		providers.registerTransport('vision-fake', {
			apiMode: 'vision-fake',
			async *stream(request) {
				requests.push(request)
				yield { type: 'response', response: { content: 'It appears to be a red square.', toolCalls: [] } } as const
			},
		})

		const assistant = c.feature('assistant', {
			systemPrompt: 'You are concise.',
			provider: 'vision-fake',
			visionSupport: { model: 'fake-vl' },
		} as any)

		const answer = await assistant.ask([
			{ type: 'text', text: 'What do you see?' },
			imagePart(),
		])

		expect(answer).toBe('It appears to be a red square.')
		const userMessage = requests[0].messages.find((m: any) => m.role === 'user')
		const serialized = JSON.stringify(userMessage.content)
		expect(serialized).toContain('A red square on a white background.')
		expect(serialized).not.toContain('image_url')
	})

	it('ask() leaves content untouched when visionSupport is off', async () => {
		const c = new AGIContainer()
		const providers = c.feature('modelProviders')
		const requests: any[] = []
		providers.registerProfile({ id: 'novision-fake', apiMode: 'novision-fake', auth: 'none', defaultModel: 'm' })
		providers.registerTransport('novision-fake', {
			apiMode: 'novision-fake',
			async *stream(request) {
				requests.push(request)
				yield { type: 'response', response: { content: 'ok', toolCalls: [] } } as const
			},
		})

		const assistant = c.feature('assistant', {
			systemPrompt: 'You are concise.',
			provider: 'novision-fake',
		} as any)

		await assistant.ask([{ type: 'text', text: 'hi' }, imagePart()])
		expect(JSON.stringify(requests[0].messages)).toContain('image_url')
	})
})

describe('Assistant visionSupport batch mode', () => {
	it('defaults to per-image mode with a concurrency cap of 4', () => {
		const c = new AGIContainer()
		const assistant = c.feature('assistant', { systemPrompt: 'test', visionSupport: true } as any)
		expect(assistant.visionSupport).toMatchObject({ batch: false, concurrency: 4 })
	})

	it('reads concurrency from LUCA_VISION_SUPPORT_CONCURRENCY and ignores garbage values', () => {
		const c = new AGIContainer()
		process.env.LUCA_VISION_SUPPORT_CONCURRENCY = '2'
		expect(c.feature('assistant', { systemPrompt: 'a', visionSupport: true } as any).visionSupport)
			.toMatchObject({ concurrency: 2 })

		process.env.LUCA_VISION_SUPPORT_CONCURRENCY = 'not-a-number'
		expect(c.feature('assistant', { systemPrompt: 'b', visionSupport: true } as any).visionSupport)
			.toMatchObject({ concurrency: 4 })

		delete process.env.LUCA_VISION_SUPPORT_CONCURRENCY
	})

	it('sends every image in ONE call and collapses them into one text part', async () => {
		const c = new AGIContainer()
		const calls = stubVisionClient(c, () => 'Ball moves left to right across three frames.')
		const assistant = c.feature('assistant', {
			systemPrompt: 'test',
			visionSupport: { model: 'fake-vl', batch: true },
		} as any)

		const result = await assistant.describeImages([
			{ type: 'text', text: 'What happens?' },
			imagePart(), imagePart(), imagePart(),
		])

		// One call carrying the prompt plus all three images
		expect(calls.length).toBe(1)
		const content = calls[0].messages[0].content
		expect(content.filter((p: any) => p.type === 'image_url').length).toBe(3)
		expect(content[0].text).toContain('ONE ordered sequence')

		// Three image parts collapse to a single description, so the array shrinks
		expect(result.length).toBe(2)
		expect((result[0] as any).text).toBe('What happens?')
		expect((result[1] as any).text).toContain('3 images')
		expect((result[1] as any).text).toContain('one sequence')
		expect((result[1] as any).text).toContain('Ball moves left to right')
		expect(result.some(p => p.type === 'image_url')).toBe(false)
	})

	it('places the collapsed description where the first image was', async () => {
		const c = new AGIContainer()
		stubVisionClient(c, () => 'sequence summary')
		const assistant = c.feature('assistant', {
			systemPrompt: 'test',
			visionSupport: { model: 'fake-vl', batch: true },
		} as any)

		const result = await assistant.describeImages([
			imagePart(),
			{ type: 'text', text: 'middle' },
			imagePart(),
			{ type: 'text', text: 'tail' },
		])

		expect(result.map(p => (p as any).text)).toEqual([
			expect.stringContaining('sequence summary'),
			'middle',
			'tail',
		])
	})

	it('uses the single-image prompt when batch mode gets only one image', async () => {
		const c = new AGIContainer()
		const calls = stubVisionClient(c, () => 'a red pixel')
		const assistant = c.feature('assistant', {
			systemPrompt: 'test',
			visionSupport: { model: 'fake-vl', batch: true },
		} as any)

		const result = await assistant.describeImages([imagePart()])

		expect(calls.length).toBe(1)
		expect(calls[0].messages[0].content[0].text).not.toContain('ONE ordered sequence')
		expect((result[0] as any).text).toContain('Image 1 of 1')
	})

	it('accepts batch as a per-call override on a non-batch assistant', async () => {
		const c = new AGIContainer()
		const calls = stubVisionClient(c, () => 'compared')
		const assistant = c.feature('assistant', {
			systemPrompt: 'test',
			visionSupport: { model: 'fake-vl' },
		} as any)

		await assistant.describeImages([imagePart(), imagePart()], { batch: true })
		expect(calls.length).toBe(1)

		// The assistant's own config is untouched
		expect(assistant.visionSupport).toMatchObject({ batch: false })
		await assistant.describeImages([imagePart(), imagePart()])
		expect(calls.length).toBe(3)
	})

	it('honors a custom batchPrompt', async () => {
		const c = new AGIContainer()
		const calls = stubVisionClient(c, () => 'ok')
		const assistant = c.feature('assistant', {
			systemPrompt: 'test',
			visionSupport: { model: 'fake-vl', batch: true, batchPrompt: 'These are video frames. Report motion only.' },
		} as any)

		await assistant.describeImages([imagePart(), imagePart()])
		expect(calls[0].messages[0].content[0].text).toBe('These are video frames. Report motion only.')
	})

	it('fires visionDescription once with batch metadata', async () => {
		const c = new AGIContainer()
		stubVisionClient(c, () => 'the sequence')
		const assistant = c.feature('assistant', {
			systemPrompt: 'test',
			visionSupport: { model: 'fake-vl', batch: true },
		} as any)

		const events: any[] = []
		assistant.on('visionDescription', (payload: any) => events.push(payload))
		await assistant.describeImages([imagePart(), imagePart(), imagePart()])

		expect(events.length).toBe(1)
		expect(events[0]).toMatchObject({ index: 0, batch: true, count: 3, model: 'fake-vl', description: 'the sequence' })
	})

	it('degrades to explanatory text when the batch call fails', async () => {
		const c = new AGIContainer()
		stubVisionClient(c, () => { throw new Error('vl endpoint down') })
		const assistant = c.feature('assistant', {
			systemPrompt: 'test',
			visionSupport: { model: 'fake-vl', batch: true },
		} as any)

		const result = await assistant.describeImages([imagePart(), imagePart()])
		expect(result.length).toBe(1)
		expect((result[0] as any).text).toContain('could not be analyzed')
		expect((result[0] as any).text).toContain('vl endpoint down')
	})

	it('caps in-flight calls to concurrency in per-image mode', async () => {
		const c = new AGIContainer()
		let inFlight = 0
		let peak = 0
		const originalClient = c.client.bind(c)
		;(c as any).client = (id: string, opts: any = {}) => {
			if (id !== 'openai') return originalClient(id as any, opts)
			return {
				async createChatCompletion() {
					inFlight++
					peak = Math.max(peak, inFlight)
					await new Promise(resolve => setTimeout(resolve, 5))
					inFlight--
					return { choices: [{ message: { content: 'described' } }] }
				},
			}
		}

		const assistant = c.feature('assistant', {
			systemPrompt: 'test',
			visionSupport: { model: 'fake-vl', concurrency: 2 },
		} as any)

		const result = await assistant.describeImages(Array.from({ length: 7 }, () => imagePart()))

		expect(peak).toBe(2)
		expect(result.length).toBe(7)
		expect((result[6] as any).text).toContain('Image 7 of 7')
	})

	it('keeps descriptions in image order across concurrency windows', async () => {
		const c = new AGIContainer()
		let seen = 0
		const originalClient = c.client.bind(c)
		;(c as any).client = (id: string, opts: any = {}) => {
			if (id !== 'openai') return originalClient(id as any, opts)
			return {
				async createChatCompletion() {
					const n = seen++
					// Later images resolve sooner — order must still hold
					await new Promise(resolve => setTimeout(resolve, 10 - n))
					return { choices: [{ message: { content: `desc-${n}` } }] }
				},
			}
		}

		const assistant = c.feature('assistant', {
			systemPrompt: 'test',
			visionSupport: { model: 'fake-vl', concurrency: 5 },
		} as any)

		const result = await assistant.describeImages(Array.from({ length: 5 }, () => imagePart()))
		result.forEach((part, index) => {
			expect((part as any).text).toContain(`Image ${index + 1} of 5`)
			expect((part as any).text).toContain(`desc-${index}`)
		})
	})
})
