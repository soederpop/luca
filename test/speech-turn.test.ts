import { describe, expect, it } from 'bun:test'

import {
	SpeechTurn,
	type AudioSink,
	type SpeechAudioChunk,
	type SpeechSynthesisTransport,
} from '../src/agi/features/speech-turn'

const chunk = (value: number): SpeechAudioChunk => ({
	pcm: new Uint8Array([value, 0]),
	sampleRate: 24_000,
	channels: 1,
	encoding: 'pcm16le',
})

describe('SpeechTurn', () => {
	it('segments streamed text and completes the sink in order', async () => {
		const synthesized: string[] = []
		const written: number[] = []
		let finished = 0
		const transport: SpeechSynthesisTransport = {
			name: 'test',
			synthesize: async (text) => {
				synthesized.push(text)
				return chunk(synthesized.length)
			},
		}
		const sink: AudioSink = {
			write: (audio) => written.push(audio.pcm[0]!),
			finish: () => { finished++ },
		}

		const turn = new SpeechTurn({
			transport,
			sink,
			minChunkLength: 8,
			maxChunkLength: 80,
		})
		turn.consume('Hello there. This is ')
		turn.consume('a second sentence.')
		await turn.finish()

		expect(synthesized).toEqual(['Hello there.', 'This is a second sentence.'])
		expect(written).toEqual([1, 2])
		expect(finished).toBe(1)
	})

	it('aborts provider work and never forwards late audio after interruption', async () => {
		let release!: () => void
		const waiting = new Promise<void>((resolve) => { release = resolve })
		const writes: SpeechAudioChunk[] = []
		let interrupted = 0
		let observedAbort = false

		const turn = new SpeechTurn({
			minChunkLength: 1,
			transport: {
				name: 'slow',
				synthesize: async (_text, { signal }) => {
					signal.addEventListener('abort', () => { observedAbort = true }, { once: true })
					await waiting
					return chunk(7)
				},
			},
			sink: {
				write: (audio) => { writes.push(audio) },
				interrupt: () => { interrupted++ },
			},
		})

		turn.consume('Speak now. ')
		await Promise.resolve()
		turn.interrupt()
		release()
		await turn.finish()

		expect(observedAbort).toBe(true)
		expect(writes).toHaveLength(0)
		expect(interrupted).toBe(1)
		expect(turn.isInterrupted).toBe(true)
	})

	it('accepts streaming provider output', async () => {
		const writes: number[] = []
		const turn = new SpeechTurn({
			minChunkLength: 1,
			transport: {
				name: 'streaming',
				synthesize: async () => (async function* () {
					yield chunk(1)
					yield chunk(2)
				})(),
			},
			sink: {
				write: (audio) => { writes.push(audio.pcm[0]!) },
			},
		})

		turn.consume('Streaming.')
		await turn.finish()
		expect(writes).toEqual([1, 2])
	})
})
