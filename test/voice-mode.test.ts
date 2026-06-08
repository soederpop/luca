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
})
