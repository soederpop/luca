/**
 * One normalized chunk of synthesized speech.
 *
 * Speech transports are responsible for decoding provider-specific containers
 * (WAV, MP3, etc.) before yielding chunks. Sinks therefore only ever handle
 * mono, signed little-endian PCM16.
 */
export interface SpeechAudioChunk {
	pcm: Uint8Array
	sampleRate: number
	channels: 1
	encoding: 'pcm16le'
}

export interface SpeechSynthesisOptions {
	signal: AbortSignal
}

export type SpeechSynthesisResult =
	| SpeechAudioChunk
	| readonly SpeechAudioChunk[]
	| AsyncIterable<SpeechAudioChunk>

/** Provider-neutral, cancellable text-to-speech transport. */
export interface SpeechSynthesisTransport {
	readonly name: string
	synthesize(text: string, options: SpeechSynthesisOptions): Promise<SpeechSynthesisResult>
}

/** Destination for normalized audio produced by a speech turn. */
export interface AudioSink {
	write(chunk: SpeechAudioChunk, options: { signal: AbortSignal }): void | Promise<void>
	finish?(): void | Promise<void>
	interrupt?(): void | Promise<void>
}

export interface SpeechTurnOptions {
	transport: SpeechSynthesisTransport
	sink: AudioSink
	minChunkLength?: number
	maxChunkLength?: number
	signal?: AbortSignal
}

/**
 * Headless, turn-scoped speech synthesis.
 *
 * Streaming text is segmented into speakable clauses, synthesized in order,
 * and written to a pluggable sink. `interrupt()` aborts in-flight provider work
 * and guarantees that late provider output is never forwarded to the sink.
 */
export class SpeechTurn {
	private readonly transport: SpeechSynthesisTransport
	private readonly sink: AudioSink
	private readonly minChunkLength: number
	private readonly maxChunkLength: number
	private readonly abortController = new AbortController()
	private buffer = ''
	private queue: string[] = []
	private drainPromise: Promise<void> | null = null
	private finishing = false
	private interrupted = false
	private sinkFinished = false
	private failure: unknown = null

	constructor(options: SpeechTurnOptions) {
		this.transport = options.transport
		this.sink = options.sink
		this.minChunkLength = Math.max(1, options.minChunkLength ?? 32)
		this.maxChunkLength = Math.max(this.minChunkLength, options.maxChunkLength ?? 220)

		if (options.signal) {
			if (options.signal.aborted) {
				this.interrupt()
			} else {
				options.signal.addEventListener('abort', () => this.interrupt(), { once: true })
			}
		}
	}

	get signal(): AbortSignal {
		return this.abortController.signal
	}

	get isInterrupted(): boolean {
		return this.interrupted
	}

	/**
	 * Consume the next streamed text delta.
	 *
	 * @param textDelta - Assistant text exactly as it arrived from the model.
	 */
	consume(textDelta: string): void {
		if (!textDelta || this.interrupted || this.finishing) return
		this.buffer += cleanSpeechText(textDelta)
		this.splitBuffer(false)
		this.startDrain()
	}

	/**
	 * Flush the final partial clause and wait for synthesis and sink completion.
	 */
	async finish(): Promise<void> {
		if (this.interrupted || this.sinkFinished) return
		this.finishing = true
		this.splitBuffer(true)
		this.startDrain()
		await this.drainPromise
		if (this.failure) throw this.failure
		if (this.interrupted || this.sinkFinished) return
		this.sinkFinished = true
		await this.sink.finish?.()
	}

	/**
	 * Abort synthesis, discard queued text, and flush the sink.
	 */
	interrupt(): void {
		if (this.interrupted) return
		this.interrupted = true
		this.buffer = ''
		this.queue = []
		this.abortController.abort()
		void this.sink.interrupt?.()
	}

	private splitBuffer(flush: boolean): void {
		const boundary = /[.!?…]\s+|\n+/g
		let consumed = 0
		let match: RegExpExecArray | null

		while ((match = boundary.exec(this.buffer)) !== null) {
			const end = match.index + match[0].length
			const candidate = this.buffer.slice(consumed, end).trim()
			if (!candidate) {
				consumed = end
				continue
			}

			if (!flush && spokenLength(candidate) < this.minChunkLength) {
				continue
			}

			this.enqueue(candidate)
			consumed = end
		}

		if (consumed > 0) this.buffer = this.buffer.slice(consumed).trimStart()

		while (spokenLength(this.buffer) > this.maxChunkLength) {
			const splitAt = wordBoundary(this.buffer, this.maxChunkLength)
			this.enqueue(this.buffer.slice(0, splitAt).trim())
			this.buffer = this.buffer.slice(splitAt).trimStart()
		}

		if (flush) {
			const tail = this.buffer.trim()
			if (tail) this.enqueue(tail)
			this.buffer = ''
		}
	}

	private enqueue(text: string): void {
		let remaining = text.trim()
		while (spokenLength(remaining) > this.maxChunkLength) {
			const splitAt = wordBoundary(remaining, this.maxChunkLength)
			this.queue.push(remaining.slice(0, splitAt).trim())
			remaining = remaining.slice(splitAt).trimStart()
		}
		if (remaining) this.queue.push(remaining)
	}

	private startDrain(): void {
		if (this.drainPromise || this.interrupted || this.queue.length === 0) return
		this.drainPromise = this.drain()
			.catch((error) => {
				this.failure = error
				this.queue = []
			})
			.finally(() => {
				this.drainPromise = null
				if (!this.interrupted && !this.failure && this.queue.length > 0) this.startDrain()
			})
	}

	private async drain(): Promise<void> {
		while (!this.interrupted) {
			const text = this.queue.shift()
			if (!text) return

			const result = await this.transport.synthesize(text, {
				signal: this.abortController.signal,
			})
			if (this.interrupted) return

			for await (const chunk of speechChunks(result)) {
				if (this.interrupted) return
				validateSpeechChunk(chunk)
				await this.sink.write(chunk, { signal: this.abortController.signal })
			}
		}
	}
}

/** Remove visual formatting while preserving word boundaries for speech. */
export function cleanSpeechText(text: string): string {
	return text
		.replace(/```[\s\S]*?```/g, '')
		.replace(/`([^`]*)`/g, '$1')
		.replace(/!\[[^\]]*\]\([^)]*\)/g, '')
		.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
		.replace(/^\s{0,3}#{1,6}\s+/gm, '')
		.replace(/^\s*>\s?/gm, '')
		.replace(/^\s*[-*+]\s+/gm, '')
		.replace(/^\s*\d+\.\s+/gm, '')
		.replace(/[*_~]/g, '')
}

function spokenLength(text: string): number {
	return text.replace(/\[[^\]]*\]/g, '').length
}

function wordBoundary(text: string, maxLength: number): number {
	const candidate = text.slice(0, maxLength + 1)
	const lastSpace = candidate.lastIndexOf(' ')
	return lastSpace >= Math.floor(maxLength * 0.5) ? lastSpace : maxLength
}

async function* speechChunks(result: SpeechSynthesisResult): AsyncIterable<SpeechAudioChunk> {
	if (isAsyncIterable(result)) {
		for await (const chunk of result) yield chunk
		return
	}
	if (Array.isArray(result)) {
		for (const chunk of result) yield chunk
		return
	}
	yield result as SpeechAudioChunk
}

function isAsyncIterable(value: unknown): value is AsyncIterable<SpeechAudioChunk> {
	return !!value && typeof (value as AsyncIterable<SpeechAudioChunk>)[Symbol.asyncIterator] === 'function'
}

function validateSpeechChunk(chunk: SpeechAudioChunk): void {
	if (chunk.encoding !== 'pcm16le' || chunk.channels !== 1) {
		throw new Error('Speech transports must yield mono PCM16LE audio')
	}
	if (!Number.isFinite(chunk.sampleRate) || chunk.sampleRate <= 0) {
		throw new Error(`Invalid speech sample rate: ${chunk.sampleRate}`)
	}
}
