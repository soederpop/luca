import { describe, expect, it, afterEach } from 'bun:test'
import { embedViaDaemon, ensureDaemon, disposeEmbeddingClients } from '../src/embeddings/client'

// A fake llama-server that speaks /health and the OpenAI-compatible
// /v1/embeddings endpoint — no binary, no model weights.
function startFakeServer(dims = 4): { server: any; port: number } {
	const server = Bun.serve({
		port: 0,
		fetch(req) {
			const url = new URL(req.url)
			if (url.pathname === '/health') return new Response('{"status":"ok"}', { status: 200 })
			if (url.pathname === '/v1/embeddings') {
				return req.json().then((body: any) => {
					const inputs: string[] = Array.isArray(body.input) ? body.input : [body.input]
					// Return entries deliberately out of order to exercise index-based reassembly
					const data = inputs
						.map((_, i) => ({ index: i, embedding: new Array(dims).fill(i + 1), object: 'embedding' }))
						.reverse()
					return Response.json({ object: 'list', data, model: body.model })
				}) as any
			}
			return new Response('not found', { status: 404 })
		},
	})
	return { server, port: server.port }
}

let servers: any[] = []
afterEach(() => {
	disposeEmbeddingClients()
	for (const s of servers) { try { s.stop(true) } catch {} }
	servers = []
})

describe('embedding client', () => {
	it('uses an already-running server without spawning, and embeds via it', async () => {
		const { server, port } = startFakeServer(4)
		servers.push(server)

		// ensureDaemon finds the live fake via /health (no spawn attempted, so the
		// nonexistent binary/model paths never matter), then embedViaDaemon posts
		// to /v1/embeddings and reassembles vectors by index.
		const baseURL = await ensureDaemon({ model: 'fake', modelPath: '/nonexistent/model.gguf', port })
		expect(baseURL).toBe(`http://127.0.0.1:${port}/v1`)

		const vecs = await embedViaDaemon('fake', '/nonexistent/model.gguf', ['a', 'b', 'c'], { port })
		expect(vecs).toHaveLength(3)
		expect(vecs[0]).toEqual([1, 1, 1, 1])
		expect(vecs[2]).toEqual([3, 3, 3, 3])
	})

	it('handles concurrent batches against one server', async () => {
		const { server, port } = startFakeServer(2)
		servers.push(server)

		const [r1, r2] = await Promise.all([
			embedViaDaemon('fake', '/x', ['one'], { port }),
			embedViaDaemon('fake', '/x', ['two', 'three'], { port }),
		])
		expect(r1).toHaveLength(1)
		expect(r2).toHaveLength(2)
	})

	it('fails with setup guidance when nothing is running and nothing is installed', async () => {
		// Point the install discovery at an empty temp dir so a developer's real
		// ~/.luca does not satisfy the binary check.
		const { mkdtempSync } = require('node:fs')
		const { tmpdir } = require('node:os')
		const { join } = require('node:path')
		const savedHome = process.env.LUCA_HOME
		process.env.LUCA_HOME = mkdtempSync(join(tmpdir(), 'luca-embed-'))
		try {
			// Port 1 is never listening; the binary is not installed in the temp home.
			await expect(embedViaDaemon('fake', '/x', ['one'], { port: 1 })).rejects.toThrow(/luca setup/)
		} finally {
			if (savedHome === undefined) delete process.env.LUCA_HOME
			else process.env.LUCA_HOME = savedHome
		}
	})
})
