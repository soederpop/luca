import { encodingForModel, getEncoding } from 'js-tiktoken'
import type { Tiktoken } from 'js-tiktoken'

/**
 * Known model context window sizes. Prefix-matched for dated variants
 * (e.g. "gpt-4o-2024-08-06" matches "gpt-4o").
 */
const MODEL_CONTEXT_WINDOWS: Record<string, number> = {
	'gpt-4.1': 1_000_000,
	'gpt-4.1-mini': 1_000_000,
	'gpt-4.1-nano': 1_000_000,
	'gpt-4o': 128_000,
	'gpt-4o-mini': 128_000,
	'gpt-4-turbo': 128_000,
	'gpt-4': 8_192,
	'gpt-3.5-turbo': 16_385,
	'o1': 200_000,
	'o1-mini': 128_000,
	'o1-pro': 200_000,
	'o3': 200_000,
	'o3-mini': 200_000,
	'o4-mini': 200_000,
	'gpt-5': 1_000_000,
}

const DEFAULT_CONTEXT_WINDOW = 128_000

const encoderCache = new Map<string, Tiktoken>()

/** Look up the context window size for a model name (exact then prefix match). */
export function getContextWindow(model: string): number {
	if (MODEL_CONTEXT_WINDOWS[model]) return MODEL_CONTEXT_WINDOWS[model]

	// Prefix match — longest prefix wins (e.g. "gpt-4o-mini" before "gpt-4o")
	let best = ''
	for (const key of Object.keys(MODEL_CONTEXT_WINDOWS)) {
		if (model.startsWith(key) && key.length > best.length) {
			best = key
		}
	}

	return best ? MODEL_CONTEXT_WINDOWS[best] ?? DEFAULT_CONTEXT_WINDOW : DEFAULT_CONTEXT_WINDOW
}

/** Get a cached tiktoken encoder for a model (falls back to o200k_base). */
export function getEncoder(model: string): Tiktoken {
	if (encoderCache.has(model)) return encoderCache.get(model)!

	let enc: Tiktoken
	try {
		enc = encodingForModel(model as any)
	} catch {
		enc = getEncoding('o200k_base')
	}

	encoderCache.set(model, enc)
	return enc
}

/** Count tokens in a plain string. */
export function countTokens(text: string, model: string): number {
	return getEncoder(model).encode(text).length
}

/**
 * Estimate the total input token count for a messages array.
 * Follows the OpenAI token counting recipe with per-message overhead.
 */
export function countMessageTokens(messages: any[], model: string): number {
	const enc = getEncoder(model)
	const TOKENS_PER_MESSAGE = 3 // <|start|>role\ncontent<|end|>
	const REPLY_PRIMING = 3

	let total = 0

	for (const msg of messages) {
		total += TOKENS_PER_MESSAGE

		// Role
		if (msg.role) {
			total += enc.encode(msg.role).length
		}

		// Content
		if (typeof msg.content === 'string') {
			total += enc.encode(msg.content).length
		} else if (Array.isArray(msg.content)) {
			for (const part of msg.content) {
				if (part.type === 'text' && part.text) {
					total += enc.encode(part.text).length
				} else if (part.type === 'image_url') {
					// Rough image token estimates
					const detail = part.image_url?.detail || 'auto'
					total += detail === 'low' ? 85 : 170
				} else if (part.type === 'input_audio' || part.type === 'input_file') {
					total += 50 // rough placeholder for non-text parts
				}
			}
		}

		// Tool calls on assistant messages
		if (msg.tool_calls && Array.isArray(msg.tool_calls)) {
			for (const tc of msg.tool_calls) {
				total += 3 // tool call overhead
				if (tc.function?.name) {
					total += enc.encode(tc.function.name).length
				}
				if (tc.function?.arguments) {
					total += enc.encode(tc.function.arguments).length
				}
			}
		}

		// Name field (used on some message types)
		if (msg.name) {
			total += enc.encode(msg.name).length + 1
		}
	}

	total += REPLY_PRIMING
	return total
}
