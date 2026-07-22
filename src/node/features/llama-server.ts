import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from '../../schemas/base.js'
import { Feature } from '../feature.js'
import { spawn, execSync } from 'node:child_process'
import { existsSync, mkdirSync, openSync, readFileSync, writeFileSync, rmSync, readdirSync, statSync, chmodSync, createWriteStream } from 'node:fs'
import { rename, rm } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { join, dirname } from 'node:path'
import { homedir } from 'node:os'
import { lucaHome } from '../../setup/paths.js'

declare module 'luca/feature' {
	interface AvailableFeatures {
		llamaServer: typeof LlamaServer
	}
}

// ── Schemas ─────────────────────────────────────────────────────────

export const LlamaServerOptionsSchema = FeatureOptionsSchema.extend({
	releaseTag: z.string().optional().describe('llama.cpp GitHub release tag to install (defaults to the pinned known-good build)'),
	chatModel: z.string().optional().describe('Local chat model name (defaults to the pinned default chat model)'),
	chatPort: z.number().default(8143).describe('Port the chat inference server listens on'),
	embeddingPort: z.number().default(8144).describe('Port the embedding server listens on'),
	contextSize: z.number().default(8192).describe('Context size (-c) passed to the chat server'),
	readyTimeoutMs: z.number().default(180_000).describe('Max time to wait for a spawned server to answer /health (model load can be slow)'),
})

export const LlamaServerStateSchema = FeatureStateSchema.extend({
	chatServerRunning: z.boolean().default(false).describe('Whether the chat server answered its last health probe'),
	embeddingServerRunning: z.boolean().default(false).describe('Whether the embedding server answered its last health probe'),
})

export const LlamaServerEventsSchema = FeatureEventsSchema.extend({
	serverStarted: z.tuple([z.object({
		port: z.number().describe('Port the server is listening on'),
		modelPath: z.string().describe('Absolute path of the GGUF the server loaded'),
		embedding: z.boolean().describe('Whether this is an embedding server'),
	}).describe('Server start info')]).describe('When a llama-server process becomes healthy'),
	serverStopped: z.tuple([z.object({
		port: z.number().describe('Port the stopped server was listening on'),
	}).describe('Server stop info')]).describe('When a llama-server process is stopped via stopServer()'),
	downloadProgress: z.tuple([z.object({
		received: z.number().describe('Bytes received so far'),
		total: z.number().describe('Total bytes when known, else 0'),
		target: z.string().describe('What is being downloaded (binary or model name)'),
	}).describe('Download progress')]).describe('Progress events while downloading the binary or model weights'),
}).describe('llama-server lifecycle events')

export type LlamaServerOptions = z.infer<typeof LlamaServerOptionsSchema>
export type LlamaServerState = z.infer<typeof LlamaServerStateSchema>

// ── Pinned versions and sources ─────────────────────────────────────

/** Known-good llama.cpp release tag. Override per-instance with the releaseTag option or the LUCA_LLAMA_RELEASE env var. */
export const PINNED_LLAMA_RELEASE = 'b10076'

/** Default local chat model — Gemma 4 E2B instruction-tuned, Q4_K_M (~3.1GB). */
export const DEFAULT_CHAT_MODEL = 'gemma-4-E2B-it-Q4_K_M'

/** Where the .gguf weights for each supported local chat model can be downloaded. */
export const CHAT_MODEL_SOURCES: Record<string, { url: string; filename: string; approxSize: string }> = {
	'gemma-4-E2B-it-Q4_K_M': {
		url: 'https://huggingface.co/unsloth/gemma-4-E2B-it-GGUF/resolve/main/gemma-4-E2B-it-Q4_K_M.gguf',
		filename: 'hf_unsloth_gemma-4-E2B-it-Q4_K_M.gguf',
		approxSize: '~3.1GB',
	},
	'gemma-4-E4B-it-Q4_K_M': {
		url: 'https://huggingface.co/unsloth/gemma-4-E4B-it-GGUF/resolve/main/gemma-4-E4B-it-Q4_K_M.gguf',
		filename: 'hf_unsloth_gemma-4-E4B-it-Q4_K_M.gguf',
		approxSize: '~4.8GB',
	},
}

/** GitHub release asset name per platform-arch, for the pinned tag. */
function releaseAssetName(tag: string): string {
	const key = `${process.platform}-${process.arch}`
	const assets: Record<string, string> = {
		'darwin-arm64': `llama-${tag}-bin-macos-arm64.tar.gz`,
		'darwin-x64': `llama-${tag}-bin-macos-x64.tar.gz`,
		'linux-x64': `llama-${tag}-bin-ubuntu-x64.tar.gz`,
		'linux-arm64': `llama-${tag}-bin-ubuntu-arm64.tar.gz`,
		'win32-x64': `llama-${tag}-bin-win-cpu-x64.zip`,
	}
	const asset = process.env.LUCA_LLAMA_ASSET || assets[key]
	if (!asset) {
		throw new Error(
			`No prebuilt llama-server asset is known for ${key}. ` +
			`Set LUCA_LLAMA_ASSET to a release asset name from https://github.com/ggml-org/llama.cpp/releases/tag/${tag}, ` +
			`or build llama.cpp from source and place llama-server at ${join(lucaHome(), 'llama-cpp', tag)}.`
		)
	}
	return asset
}

/** Model weights live in the same cache dir the embedding weights use. */
export function chatModelPath(modelName: string): string {
	const source = CHAT_MODEL_SOURCES[modelName]
	const filename = source?.filename ?? `${modelName}.gguf`
	const cacheBase = process.env.XDG_CACHE_HOME || join(homedir(), '.cache')
	return join(cacheBase, 'luca', 'models', filename)
}

/** Default port of the local chat inference server. */
export const DEFAULT_CHAT_PORT = 8143
/** Default port of the local embedding server. */
export const DEFAULT_EMBEDDING_PORT = 8144

/** The llama.cpp release tag in effect: env override, else the pinned build. */
export function resolvedReleaseTag(tag?: string): string {
	return tag || process.env.LUCA_LLAMA_RELEASE || PINNED_LLAMA_RELEASE
}

/** Absolute path to the installed llama-server binary for a release tag, or null. */
export function installedBinaryPath(tag?: string): string | null {
	return findBinary(join(lucaHome(), 'llama-cpp', resolvedReleaseTag(tag)))
}

export interface EnsureServerProcessOptions {
	/** Absolute path of the GGUF to serve. */
	modelPath: string
	/** Port to serve on. */
	port: number
	/** Run as an embedding server (--embedding) instead of a chat server. */
	embedding?: boolean
	/** Context size for chat servers (-c). */
	contextSize?: number
	/** Max time to wait for /health to answer ok (model load can be slow). */
	readyTimeoutMs?: number
	/** llama.cpp release tag override. */
	releaseTag?: string
	/** Called once when this call actually spawned (rather than reused) a server. */
	onStarted?: (info: { port: number; modelPath: string; embedding: boolean }) => void
}

/**
 * Ensure a llama-server process is healthy on a port, spawning a detached one
 * if needed. Reuses a server another luca process already started (first
 * healthy listener wins). Returns the OpenAI-compatible base URL.
 */
export async function ensureServerProcess(opts: EnsureServerProcessOptions): Promise<string> {
	const baseURL = `http://127.0.0.1:${opts.port}/v1`
	if (await probeHealth(opts.port) === 'ok') return baseURL

	const binary = installedBinaryPath(opts.releaseTag)
	if (!binary) throw new Error('The llama-server binary is not installed. Run `luca setup` to download it.')
	if (!existsSync(opts.modelPath)) {
		throw new Error(`Model weights not found at ${opts.modelPath} — run \`luca setup\` to download them.`)
	}

	mkdirSync(lucaHome(), { recursive: true })
	const logPath = join(lucaHome(), `llama-server-${opts.port}.log`)
	const logFd = openSync(logPath, 'a')
	const args = [
		'-m', opts.modelPath,
		'--host', '127.0.0.1',
		'--port', String(opts.port),
		...(opts.embedding ? ['--embedding'] : ['--jinja', '-c', String(opts.contextSize ?? 8192)]),
	]
	const child = spawn(binary, args, {
		cwd: dirname(binary),
		detached: true,
		stdio: ['ignore', logFd, logFd],
	})
	child.unref()
	writeFileSync(join(lucaHome(), `llama-server-${opts.port}.pid`), String(child.pid ?? ''))

	const deadline = Date.now() + (opts.readyTimeoutMs ?? 180_000)
	while (Date.now() < deadline) {
		await sleep(400)
		const health = await probeHealth(opts.port)
		if (health === 'ok') {
			opts.onStarted?.({ port: opts.port, modelPath: opts.modelPath, embedding: !!opts.embedding })
			return baseURL
		}
		// A different process may have won a spawn race — that's fine, keep polling
		if (child.exitCode !== null && health === 'down') {
			throw new Error(`llama-server exited before becoming healthy (code ${child.exitCode}). Check the log at ${logPath}`)
		}
	}
	throw new Error(`llama-server on port ${opts.port} did not become healthy in time. Check the log at ${logPath}`)
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** One /health round trip. llama-server answers 200 when the model is loaded, 503 while loading. */
export async function probeHealth(port: number, timeoutMs = 2000): Promise<'ok' | 'loading' | 'down'> {
	try {
		const res = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(timeoutMs) })
		if (res.ok) return 'ok'
		return 'loading'
	} catch {
		return 'down'
	}
}

/**
 * Downloads, supervises, and health-checks local `llama-server` processes —
 * luca's local inference substrate. The llama.cpp server binary installs once
 * per machine into `~/.luca/llama-cpp/<tag>/` and serves GGUF models over an
 * OpenAI-compatible HTTP API on localhost. Chat and embedding models run as
 * separate server processes on separate ports, spawned on demand and shared by
 * every luca process on the machine.
 *
 * This is what backs the `local` model provider: a blank assistant with no
 * provider configured and no OPENAI_API_KEY resolves to `local`, which calls
 * `ensureChatServer()` here before the first request.
 *
 * @example
 * ```typescript
 * const llama = container.feature('llamaServer')
 * if (!llama.binaryInstalled) await llama.downloadBinary()
 * if (!llama.chatModelInstalled) await llama.downloadChatModel()
 * const baseURL = await llama.ensureChatServer() // http://127.0.0.1:8143/v1
 * ```
 */
export class LlamaServer extends Feature<LlamaServerState, LlamaServerOptions> {
	static override description = 'Download and supervise local llama-server processes serving GGUF models over an OpenAI-compatible API.'
	static override stateSchema = LlamaServerStateSchema
	static override optionsSchema = LlamaServerOptionsSchema
	static override eventsSchema = LlamaServerEventsSchema
	static override shortcut = 'features.llamaServer' as const
	static override stability = 'experimental' as const
	static override category = 'ai-assistants' as const
	static { Feature.register(this, 'llamaServer') }

	/** The llama.cpp release tag this instance installs and runs. */
	get releaseTag(): string {
		return resolvedReleaseTag(this.options.releaseTag)
	}

	/** The configured local chat model name. */
	get chatModel(): string {
		return this.options.chatModel || DEFAULT_CHAT_MODEL
	}

	/** Directory the release archive is extracted into (binary + its shared libraries). */
	get installDir(): string {
		return join(lucaHome(), 'llama-cpp', this.releaseTag)
	}

	/** Absolute path to the llama-server binary, or null when not installed. */
	get binaryPath(): string | null {
		return findBinary(this.installDir)
	}

	/** Whether the llama-server binary is installed for the pinned release. */
	get binaryInstalled(): boolean {
		return this.binaryPath !== null
	}

	/** Absolute path where the configured chat model's weights live (whether or not downloaded yet). */
	get chatModelPath(): string {
		return chatModelPath(this.chatModel)
	}

	/** Whether the configured chat model's weights are downloaded. */
	get chatModelInstalled(): boolean {
		return existsSync(this.chatModelPath)
	}

	/** Whether local chat inference is fully installed (binary + chat model weights). */
	get chatReady(): boolean {
		return this.binaryInstalled && this.chatModelInstalled
	}

	/** The OpenAI-compatible base URL of the chat server. */
	get chatBaseURL(): string {
		return `http://127.0.0.1:${this.options.chatPort}/v1`
	}

	/** The OpenAI-compatible base URL of the embedding server. */
	get embeddingBaseURL(): string {
		return `http://127.0.0.1:${this.options.embeddingPort}/v1`
	}

	/**
	 * Download and extract the pinned llama.cpp release into ~/.luca/llama-cpp/<tag>/.
	 * Skips when the binary is already installed. Emits downloadProgress events.
	 *
	 * @returns The absolute path to the installed llama-server binary
	 *
	 * @example
	 * ```typescript
	 * const path = await container.feature('llamaServer').downloadBinary()
	 * ```
	 */
	async downloadBinary(): Promise<string> {
		const existing = this.binaryPath
		if (existing) return existing

		const tag = this.releaseTag
		const asset = releaseAssetName(tag)
		const url = `https://github.com/ggml-org/llama.cpp/releases/download/${tag}/${asset}`
		mkdirSync(this.installDir, { recursive: true })

		const archivePath = join(this.installDir, asset)
		await this.downloadFile(url, archivePath, `llama-server ${tag}`)

		try {
			if (asset.endsWith('.zip')) {
				execSync(`unzip -o -q ${JSON.stringify(archivePath)} -d ${JSON.stringify(this.installDir)}`)
			} else {
				execSync(`tar -xzf ${JSON.stringify(archivePath)} -C ${JSON.stringify(this.installDir)}`)
			}
		} finally {
			rmSync(archivePath, { force: true })
		}

		const binary = this.binaryPath
		if (!binary) {
			throw new Error(`Extracted ${asset} but found no llama-server binary under ${this.installDir}`)
		}
		if (process.platform !== 'win32') chmodSync(binary, 0o755)
		return binary
	}

	/**
	 * Download the configured chat model's GGUF weights into the shared model
	 * cache. Streams to a temp file and renames atomically; skips when already
	 * present. Emits downloadProgress events (these files are large — the
	 * default model is ~3.1GB).
	 *
	 * @param modelName - Chat model to fetch (default: the configured chatModel)
	 * @returns The absolute path to the weights file
	 *
	 * @example
	 * ```typescript
	 * const llama = container.feature('llamaServer')
	 * llama.on('downloadProgress', ({ received, total }) => console.log(received, '/', total))
	 * await llama.downloadChatModel()
	 * ```
	 */
	async downloadChatModel(modelName: string = this.chatModel): Promise<string> {
		const source = CHAT_MODEL_SOURCES[modelName]
		if (!source) {
			throw new Error(
				`No download source for chat model "${modelName}". ` +
				`Supported models: ${Object.keys(CHAT_MODEL_SOURCES).join(', ')}`
			)
		}
		const dest = chatModelPath(modelName)
		if (existsSync(dest)) return dest
		await this.downloadFile(source.url, dest, modelName)
		return dest
	}

	/**
	 * Ensure a llama-server is healthy on the chat port, spawning one if needed.
	 * Reuses a server another luca process already started. Throws with setup
	 * guidance when the binary or model weights are missing.
	 *
	 * @returns The OpenAI-compatible base URL of the chat server
	 */
	async ensureChatServer(): Promise<string> {
		await this.ensureServer({
			modelPath: this.requireChatInstalled(),
			port: this.options.chatPort,
			embedding: false,
		})
		this.state.set('chatServerRunning', true)
		return this.chatBaseURL
	}

	/**
	 * Ensure a llama-server with --embedding is healthy on the embedding port,
	 * spawning one if needed.
	 *
	 * @param modelPath - Absolute path to the embedding GGUF to serve
	 * @returns The OpenAI-compatible base URL of the embedding server
	 */
	async ensureEmbeddingServer(modelPath: string): Promise<string> {
		if (!existsSync(modelPath)) {
			throw new Error(`Embedding model weights not found at ${modelPath} — run \`luca setup\` to download them.`)
		}
		await this.ensureServer({ modelPath, port: this.options.embeddingPort, embedding: true })
		this.state.set('embeddingServerRunning', true)
		return this.embeddingBaseURL
	}

	/**
	 * Stop the server on a port by pid file. No-op when no pid file exists.
	 *
	 * @param port - Port of the server to stop (default: the chat port)
	 */
	stopServer(port: number = this.options.chatPort): boolean {
		const pidFile = this.pidFilePath(port)
		if (!existsSync(pidFile)) return false
		try {
			const pid = Number(readFileSync(pidFile, 'utf8').trim())
			if (pid > 0) process.kill(pid, 'SIGTERM')
		} catch { /* already gone */ }
		rmSync(pidFile, { force: true })
		if (port === this.options.chatPort) this.state.set('chatServerRunning', false)
		if (port === this.options.embeddingPort) this.state.set('embeddingServerRunning', false)
		this.emit('serverStopped', { port })
		return true
	}

	/**
	 * Install/runtime status snapshot — what's downloaded and what's answering
	 * health probes right now.
	 */
	async status(): Promise<{
		releaseTag: string
		binaryInstalled: boolean
		binaryPath: string | null
		chatModel: string
		chatModelInstalled: boolean
		chatModelPath: string
		chatServer: 'ok' | 'loading' | 'down'
		embeddingServer: 'ok' | 'loading' | 'down'
	}> {
		return {
			releaseTag: this.releaseTag,
			binaryInstalled: this.binaryInstalled,
			binaryPath: this.binaryPath,
			chatModel: this.chatModel,
			chatModelInstalled: this.chatModelInstalled,
			chatModelPath: this.chatModelPath,
			chatServer: await probeHealth(this.options.chatPort),
			embeddingServer: await probeHealth(this.options.embeddingPort),
		}
	}

	// ── Internals ─────────────────────────────────────────────────────

	private requireChatInstalled(): string {
		if (!this.binaryInstalled) {
			throw new Error('The llama-server binary is not installed. Run `luca setup` to download it.')
		}
		if (!this.chatModelInstalled) {
			throw new Error(
				`The local chat model (${this.chatModel}) is not downloaded. Run \`luca setup\` to download it ` +
				`(${CHAT_MODEL_SOURCES[this.chatModel]?.approxSize ?? 'large file'}).`
			)
		}
		return this.chatModelPath
	}

	private pidFilePath(port: number): string {
		return join(lucaHome(), `llama-server-${port}.pid`)
	}

	private async ensureServer(opts: { modelPath: string; port: number; embedding: boolean }): Promise<void> {
		await ensureServerProcess({
			...opts,
			contextSize: this.options.contextSize,
			readyTimeoutMs: this.options.readyTimeoutMs,
			releaseTag: this.options.releaseTag,
			onStarted: (info) => this.emit('serverStarted', info),
		})
	}

	/** Stream a URL to disk with progress events and an atomic rename. */
	private async downloadFile(url: string, dest: string, target: string): Promise<void> {
		mkdirSync(dirname(dest), { recursive: true })
		const response = await fetch(url, { redirect: 'follow' })
		if (!response.ok || !response.body) {
			throw new Error(`Failed to download ${target} from ${url}: HTTP ${response.status}`)
		}
		const total = Number(response.headers.get('content-length') ?? 0)
		let received = 0
		const tmpPath = `${dest}.download-${process.pid}`
		try {
			const progress = new TransformStream<Uint8Array, Uint8Array>({
				transform: (chunk, controller) => {
					received += chunk.byteLength
					this.emit('downloadProgress', { received, total, target })
					controller.enqueue(chunk)
				},
			})
			await pipeline(
				Readable.fromWeb(response.body.pipeThrough(progress) as any),
				createWriteStream(tmpPath),
			)
			await rename(tmpPath, dest)
		} catch (err) {
			await rm(tmpPath, { force: true }).catch(() => {})
			throw err
		}
	}
}

/** Recursively locate the llama-server binary inside an extracted release dir. */
function findBinary(root: string): string | null {
	if (!existsSync(root)) return null
	const name = process.platform === 'win32' ? 'llama-server.exe' : 'llama-server'
	const queue = [root]
	while (queue.length) {
		const dir = queue.shift()!
		let entries: string[]
		try { entries = readdirSync(dir) } catch { continue }
		for (const entry of entries) {
			const full = join(dir, entry)
			let stats
			try { stats = statSync(full) } catch { continue }
			if (stats.isDirectory()) queue.push(full)
			else if (entry === name) return full
		}
	}
	return null
}

export default LlamaServer
