import { describe, expect, it, afterEach } from 'bun:test'
import net from 'node:net'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { daemonSocketPath, findBun, embedViaDaemon, disposeEmbeddingClients } from '../src/embeddings/client'

// A fake daemon that speaks the newline-JSON protocol without needing node-llama-cpp.
function startFakeDaemon(sock: string, dims = 4): Promise<net.Server> {
	return new Promise((resolve) => {
		const server = net.createServer((conn) => {
			let buffer = ''
			conn.on('data', (chunk) => {
				buffer += chunk.toString()
				let nl: number
				while ((nl = buffer.indexOf('\n')) >= 0) {
					const line = buffer.slice(0, nl).trim()
					buffer = buffer.slice(nl + 1)
					if (!line) continue
					const req = JSON.parse(line)
					if (req.type === 'ping') {
						conn.write(JSON.stringify({ id: req.id, ready: true, model: 'fake', dims }) + '\n')
					} else if (req.type === 'embed') {
						const embeddings = req.texts.map((_: string, i: number) => new Array(dims).fill(i + 1))
						conn.write(JSON.stringify({ id: req.id, embeddings }) + '\n')
					}
				}
			})
			conn.on('error', () => {})
		})
		server.listen(sock, () => resolve(server))
	})
}

let servers: net.Server[] = []
afterEach(() => {
	disposeEmbeddingClients()
	for (const s of servers) { try { s.close() } catch {} }
	servers = []
})

describe('embedding client', () => {
	it('daemonSocketPath sanitizes the model name and lives under home', () => {
		const p = daemonSocketPath('embedding-gemma-300M-Q8_0', '/tmp/home')
		expect(p).toBe('/tmp/home/embeddings-embedding_gemma_300M_Q8_0.sock')
	})

	it('findBun returns a string path or null', () => {
		const bun = findBun()
		expect(bun === null || typeof bun === 'string').toBe(true)
	})

	it('uses an already-running daemon without spawning, and embeds via it', async () => {
		const home = mkdtempSync(join(tmpdir(), 'luca-embed-'))
		const sock = daemonSocketPath('fake', home)
		servers.push(await startFakeDaemon(sock, 4))

		// ensureDaemon should find the live fake via ping (no bun spawn needed),
		// then embedViaDaemon connects and gets canned vectors back.
		const vecs = await embedViaDaemon('fake', '/nonexistent/model.gguf', ['a', 'b', 'c'], { home })
		expect(vecs).toHaveLength(3)
		expect(vecs[0]).toEqual([1, 1, 1, 1])
		expect(vecs[2]).toEqual([3, 3, 3, 3])
	})

	it('matches responses by id across a batch on one connection', async () => {
		const home = mkdtempSync(join(tmpdir(), 'luca-embed-'))
		const sock = daemonSocketPath('fake', home)
		servers.push(await startFakeDaemon(sock, 2))

		const [r1, r2] = await Promise.all([
			embedViaDaemon('fake', '/x', ['one'], { home }),
			embedViaDaemon('fake', '/x', ['two', 'three'], { home }),
		])
		expect(r1).toHaveLength(1)
		expect(r2).toHaveLength(2)
	})
})
