import { describe, expect, it } from 'bun:test'

import { VoiceMode } from '../src/agi/features/voice-mode'

describe('voice-mode feature', () => {
	it('builds elevenlabs options from config and applies overrides', () => {
		const options = VoiceMode.optionsFromConfig(
			{
				provider: 'elevenlabs',
				voiceId: 'voice-123',
				modelId: 'eleven_v3',
				voiceSettings: { stability: 0.4 },
				conversationModePrefix: 'calm narrator',
				maxChunkLength: 180,
			},
			{
				minChunkLength: 20,
			} as any,
		)

		expect(options).toEqual({
			provider: 'elevenlabs',
			voiceId: 'voice-123',
			modelId: 'eleven_v3',
			voiceSettings: { stability: 0.4 },
			conversationModePrefix: 'calm narrator',
			maxChunkLength: 180,
			minChunkLength: 20,
		})
	})

	it('builds voicebox options with defaults from config', () => {
		const options = VoiceMode.optionsFromConfig({
			provider: 'voicebox',
			voicebox: {
				profileId: 'profile-1',
			},
			maxChunkLength: 220,
		})

		expect(options).toEqual({
			provider: 'voicebox',
			voicebox: {
				profileId: 'profile-1',
				engine: 'qwen',
				modelSize: '1.7B',
				language: 'en',
				instruct: undefined,
			},
			maxChunkLength: 220,
		})
	})

	it('reads voice config from voice.yml through container features', () => {
		const assistant = {
			paths: {
				join: (...parts: string[]) => parts.join('/'),
			},
		}

		const container = {
			feature: (name: string) => {
				if (name === 'fs') {
					return {
						exists: (path: string) => {
							expect(path).toBe('voice.yml')
							return true
						},
						readFile: (path: string) => {
							expect(path).toBe('voice.yml')
							return 'provider: elevenlabs\nvoiceId: test-voice\n'
						},
					}
				}

				if (name === 'yaml') {
					return {
						parse: (input: string) => {
							expect(input).toContain('voiceId: test-voice')
							return {
								provider: 'elevenlabs',
								voiceId: 'test-voice',
							}
						},
					}
				}

				throw new Error(`Unexpected feature lookup: ${name}`)
			},
		}

		expect(VoiceMode.readVoiceConfig(container, assistant as any)).toEqual({
			provider: 'elevenlabs',
			voiceId: 'test-voice',
		})
	})

	it('throws when voice.yml is missing', () => {
		const assistant = {
			paths: {
				join: (...parts: string[]) => parts.join('/'),
			},
		}

		const container = {
			feature: (name: string) => {
				if (name === 'fs') {
					return {
						exists: () => false,
					}
				}

				if (name === 'yaml') {
					return {
						parse: () => {
							throw new Error('should not parse missing config')
						},
					}
				}

				throw new Error(`Unexpected feature lookup: ${name}`)
			},
		}

		expect(() => VoiceMode.readVoiceConfig(container, assistant as any)).toThrow(
			'[voice-mode] voice.yml not found at voice.yml',
		)
	})

	it('reports missing elevenlabs requirements without making remote calls', async () => {
		const voiceMode = new VoiceMode({ provider: 'elevenlabs' } as any, {
			container: {
				emit: () => {},
			},
		} as any)

		const result = await voiceMode.checkCapabilities()

		expect(result.available).toBe(false)
		expect(result.missing).toContain('voiceId not configured')
		expect(voiceMode.state.get('ttsAvailable')).toBe(false)
	})

	it('reports voicebox as available when the local client connects', async () => {
		const voiceMode = new VoiceMode(
			{
				provider: 'voicebox',
				voicebox: { profileId: 'profile-1' },
			} as any,
			{
				container: {
					emit: () => {},
					client: (name: string) => {
						expect(name).toBe('voicebox')
						return {
							connect: async () => {},
						}
					},
				},
			} as any,
		)

		const result = await voiceMode.checkCapabilities()

		expect(result).toEqual({ available: true, missing: [] })
		expect(voiceMode.state.get('ttsAvailable')).toBe(true)
	})

	it('applies conversationModePrefix exactly once for the builtin elevenlabs provider', async () => {
		let received: string | null = null
		const voiceMode = new VoiceMode(
			{
				provider: 'elevenlabs',
				voiceId: 'voice-123',
				conversationModePrefix: 'calm narrator',
			} as any,
			{
				container: {
					emit: () => {},
					client: (name: string) => {
						expect(name).toBe('elevenlabs')
						return {
							state: { get: () => true },
							synthesize: async (text: string) => {
								received = text
								return Buffer.from('audio')
							},
						}
					},
					fs: { writeFileAsync: async () => {} },
				},
			} as any,
		)

		const result = await (voiceMode as any)._synthesize('hello there')

		expect(result).not.toBeNull()
		expect(received).toBe('[calm narrator] hello there')
	})

	it('rejects unknown builtin provider names instead of silently defaulting', async () => {
		const voiceMode = new VoiceMode({ provider: 'elevenlab' } as any, {
			container: { emit: () => {} },
		} as any)

		const caps = await voiceMode.checkCapabilities()
		expect(caps.available).toBe(false)
		expect(caps.missing).toContain("unknown provider 'elevenlab'")

		const result = await (voiceMode as any)._synthesize('hello')
		expect(result).toBeNull()
	})

	it('lazily connects an injected tts provider and retries after failure', async () => {
		let connectCalls = 0
		let failNext = true
		const synthesized: string[] = []

		const voiceMode = new VoiceMode({ provider: 'elevenlabs' } as any, {
			container: {
				emit: () => {},
				fs: { writeFileAsync: async () => {} },
			},
		} as any)

		voiceMode.useTtsProvider({
			name: 'custom',
			connect: async () => {
				connectCalls++
				if (failNext) {
					failNext = false
					throw new Error('not reachable')
				}
			},
			synthesize: async (text: string) => {
				synthesized.push(text)
				return Buffer.from('audio')
			},
		})

		expect(connectCalls).toBe(0)
		expect(voiceMode.state.get('provider')).toBe('custom')

		const first = await (voiceMode as any)._synthesize('one')
		expect(first).toBeNull()
		expect(connectCalls).toBe(1)
		expect(synthesized).toEqual([])

		const second = await (voiceMode as any)._synthesize('two')
		expect(second).not.toBeNull()
		expect(connectCalls).toBe(2)
		expect(synthesized).toEqual(['two'])

		await (voiceMode as any)._synthesize('three')
		expect(connectCalls).toBe(2)
		expect(synthesized).toEqual(['two', 'three'])
	})
})
