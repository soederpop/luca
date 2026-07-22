import { ensureServerProcess, DEFAULT_EMBEDDING_PORT } from '../node/features/llama-server.js'

/**
 * Client for the resident local embedding server. Local embeddings are served
 * by a `llama-server --embedding` process (see the llamaServer feature) that
 * loads the model once and is shared by every luca process on the machine via
 * a fixed localhost port. This module ensures that server is healthy and
 * speaks its OpenAI-compatible /v1/embeddings endpoint.
 *
 * Historically this was a bun worker daemon wrapping the node-llama-cpp native
 * addon (the compiled luca binary can't load native addons from external
 * node_modules). llama-server removed that constraint: it's a self-contained
 * binary downloaded by `luca setup`, so no external bun, no native addon, no
 * unix-socket protocol.
 */

export interface EnsureDaemonOptions {
	model: string
	modelPath: string
	/** Port the embedding server listens on (default 8144). */
	port?: number
	/** Max time to wait for the model to load and /health to answer (default 180s). */
	readyTimeoutMs?: number
}

/** Ensure the embedding server is healthy, spawning it if needed. Returns its OpenAI-compatible base URL. */
export async function ensureDaemon(opts: EnsureDaemonOptions): Promise<string> {
	return ensureServerProcess({
		modelPath: opts.modelPath,
		port: opts.port ?? DEFAULT_EMBEDDING_PORT,
		embedding: true,
		readyTimeoutMs: opts.readyTimeoutMs,
	})
}

/** Embed texts via the resident embedding server, spawning it if necessary. */
export async function embedViaDaemon(model: string, modelPath: string, texts: string[], opts?: Partial<EnsureDaemonOptions>): Promise<number[][]> {
	const baseURL = await ensureDaemon({ model, modelPath, ...opts })
	const response = await fetch(`${baseURL}/embeddings`, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify({ input: texts, model }),
	})
	if (!response.ok) {
		const body = await response.text().catch(() => '')
		throw new Error(`Embedding request failed: HTTP ${response.status} ${body.slice(0, 300)}`)
	}
	const json = await response.json() as { data?: Array<{ index?: number; embedding: number[] }> }
	const data = json.data ?? []
	// The API returns one entry per input with an index — order defensively.
	const ordered: number[][] = new Array(texts.length)
	data.forEach((entry, i) => { ordered[entry.index ?? i] = entry.embedding })
	if (ordered.some(v => !Array.isArray(v))) {
		throw new Error(`Embedding response returned ${data.length} vectors for ${texts.length} inputs`)
	}
	return ordered
}

/** Back-compat no-op: the HTTP client keeps no persistent connections to dispose. */
export function disposeEmbeddingClients() {}
