import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from '../../schemas/base.js'
import { Feature } from '../feature.js'
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, openSync, readFileSync, writeFileSync, rmSync, readdirSync, chmodSync, createWriteStream } from 'node:fs'
import { rename, rm } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { join, dirname } from 'node:path'
import { homedir } from 'node:os'
import { createHash } from 'node:crypto'
import { lucaHome } from '../../setup/paths.js'

declare module 'luca/feature' {
	interface AvailableFeatures {
		needle: typeof Needle
	}
}

// ── Schemas ─────────────────────────────────────────────────────────

export const NeedleOptionsSchema = FeatureOptionsSchema.extend({
	revision: z.string().default('main').describe('Hugging Face revision of Cactus-Compute/needle3 to install (pin a commit hash for reproducible installs)'),
	basePort: z.number().default(8150).describe('First port of the range needle servers are spawned on (one server per tool set)'),
	portRange: z.number().default(30).describe('How many ports starting at basePort a tool set may hash into'),
	depth: z.number().optional().describe('Ladder depth (2..full) — fewer layers trade accuracy for speed on constrained devices'),
	threads: z.number().optional().describe('Worker threads for the inference engine (default: the device\'s fast cores, at most 4)'),
	maxTokens: z.number().default(512).describe('Response token limit passed to the server (--max)'),
	readyTimeoutMs: z.number().default(30_000).describe('Max time to wait for a spawned server to answer HTTP (the model is tiny — loads in seconds)'),
})

export const NeedleStateSchema = FeatureStateSchema.extend({
	runningPorts: z.array(z.number()).default([]).describe('Ports this feature instance has confirmed a healthy needle server on'),
})

export const NeedleEventsSchema = FeatureEventsSchema.extend({
	serverStarted: z.tuple([z.object({
		port: z.number().describe('Port the server is listening on'),
		toolsHash: z.string().describe('Hash of the tool set this server was started with'),
	}).describe('Server start info')]).describe('When a needle server process becomes healthy'),
	serverStopped: z.tuple([z.object({
		port: z.number().describe('Port the stopped server was listening on'),
	}).describe('Server stop info')]).describe('When a needle server process is stopped'),
	downloadProgress: z.tuple([z.object({
		received: z.number().describe('Bytes received so far'),
		total: z.number().describe('Total bytes when known, else 0'),
		target: z.string().describe('What is being downloaded (binary or weights)'),
	}).describe('Download progress')]).describe('Progress events while downloading the engine binary or model weights'),
}).describe('needle lifecycle events')

export type NeedleOptions = z.infer<typeof NeedleOptionsSchema>
export type NeedleState = z.infer<typeof NeedleStateSchema>

// ── Pinned sources ──────────────────────────────────────────────────

/** The Hugging Face repo that ships the needle engine binaries and weights. */
export const NEEDLE_HF_REPO = 'Cactus-Compute/needle3'

/** The weights file at the root of the Hugging Face repo (~35MB). */
export const NEEDLE_WEIGHTS_FILE = 'needle3.cact'

/**
 * The Hugging Face platform folder for this process's platform/arch, or null
 * when no prebuilt engine exists for it.
 */
export function needlePlatformFolder(): string | null {
	const key = `${process.platform}-${process.arch}`
	const folders: Record<string, string> = {
		'darwin-arm64': 'macos-arm64',
		'linux-x64': 'linux-x86_64',
		'linux-arm64': 'linux-arm64',
		'win32-x64': 'windows-x86_64',
		'win32-arm64': 'windows-arm64',
	}
	return process.env.LUCA_NEEDLE_PLATFORM || folders[key] || null
}

/** The engine binary's filename inside a platform folder. */
export function needleBinaryName(): string {
	return process.platform === 'win32' ? 'needle.exe' : 'needle'
}

/** Weights live in the shared model cache next to the GGUF models. */
export function needleWeightsPath(): string {
	const cacheBase = process.env.XDG_CACHE_HOME || join(homedir(), '.cache')
	return join(cacheBase, 'luca', 'models', NEEDLE_WEIGHTS_FILE)
}

// ── Tool schema ─────────────────────────────────────────────────────

/**
 * A tool offered to needle: standard tool-calling shape. `parameters` is a
 * JSON Schema object, or a zod object schema (converted via z.toJSONSchema).
 */
export interface NeedleTool {
	name: string
	description: string
	parameters: object
}

/** One function call needle decided to dispatch. */
export interface NeedleFunctionCall {
	name: string
	arguments: Record<string, unknown>
}

/** The JSON object needle's server returns for every /complete turn. */
export interface NeedleResult {
	type: string
	success: boolean
	error: string | null
	error_code: string | null
	reason: string | null
	function_calls: NeedleFunctionCall[]
	suppressed_calls: NeedleFunctionCall[]
	reasoning: string
	/** Calibrated confidence 0..1. Gate on this — needle always picks *some* tool, even for off-topic queries. */
	confidence: number
	prefill_tps?: number
	decode_tps?: number
	peak_ram_mb?: number
	validation?: { ungrounded: string[]; negation: boolean }
}

/** A handle to a running needle server bound to one tool set. */
export interface NeedleAgent {
	/** Port the server is listening on. */
	port: number
	/** Base URL of the server. */
	baseURL: string
	/** Hash identifying the tool set this server was started with. */
	toolsHash: string
	/**
	 * Run one turn. The server is stateful across calls (multi-turn context);
	 * pass `fresh: true` to reset the conversation first for a stateless query.
	 */
	complete(input: string, opts?: { fresh?: boolean }): Promise<NeedleResult>
	/** Clear the server's conversation state. */
	reset(): Promise<void>
	/** Stop the server process. */
	stop(): boolean
}

/** Normalize tools: convert zod object schemas in `parameters` to JSON Schema. */
export function normalizeTools(tools: NeedleTool[]): NeedleTool[] {
	return tools.map((tool) => {
		const params: any = tool.parameters
		// A zod schema (v4) carries a _zod marker; plain JSON Schema does not
		const parameters = params && typeof params === 'object' && '_zod' in params
			? z.toJSONSchema(params as z.ZodType)
			: params
		return { name: tool.name, description: tool.description, parameters }
	})
}

/** Deterministic hash of a tool set + system prompt (picks the server port). */
export function hashToolSet(tools: NeedleTool[], system?: string): string {
	return createHash('sha256')
		.update(JSON.stringify({ tools, system: system ?? null }))
		.digest('hex')
		.slice(0, 16)
}

/**
 * One HTTP round trip to check a needle server is up. The server answers 404
 * on unknown routes, so any HTTP response at all means it is alive.
 */
export async function probeNeedle(port: number, timeoutMs = 2000): Promise<boolean> {
	try {
		await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(timeoutMs) })
		return true
	} catch {
		return false
	}
}

interface ServerSidecar {
	toolsHash: string
	pid: number
}

/**
 * Downloads and supervises local `needle` servers — Cactus Compute's tiny
 * (35MB weights, <1MB engine, ~75MB resident) foundation model for tool
 * calling, structured extraction, and routing. Apache-2.0, fully offline.
 *
 * Unlike a chat model, needle maps (query, tool list) → one JSON function
 * call with a calibrated confidence. A server is bound to its tool set at
 * startup, so this feature runs one detached server per tool set, on a port
 * derived from the tool set's hash, shared by every luca process. Servers
 * hold ~75MB and load in seconds; there is no idle watchdog — call
 * `stopAll()` or `agent.stop()` when done.
 *
 * The engine binary and weights auto-download from Hugging Face on first
 * use (~36MB total).
 *
 * **Gotcha:** needle always dispatches *some* call, even for off-topic
 * queries ("tell me a joke" happily picks get_weather at 0.98 confidence).
 * Include an explicit no-op/fallback tool in the set, or gate on
 * `result.confidence`, when queries may fall outside the tool set.
 *
 * @example
 * ```typescript
 * const needle = container.feature('needle')
 * const agent = await needle.agent([
 *   { name: 'get_weather', description: 'Get the current weather for a city.',
 *     parameters: z.object({ city: z.string().describe('The city name') }) },
 * ])
 * const result = await agent.complete("what's it like in Lagos right now?")
 * // result.function_calls => [{ name: 'get_weather', arguments: { city: 'Lagos' } }]
 * ```
 */
export class Needle extends Feature<NeedleState, NeedleOptions> {
	static override description = 'Download and supervise local needle servers — a tiny on-device foundation model for tool calling and structured extraction.'
	static override stateSchema = NeedleStateSchema
	static override optionsSchema = NeedleOptionsSchema
	static override eventsSchema = NeedleEventsSchema
	static override shortcut = 'features.needle' as const
	static override stability = 'experimental' as const
	static override category = 'ai-assistants' as const
	static { Feature.register(this, 'needle') }

	/** Directory the engine binary installs into. */
	get installDir(): string {
		return join(lucaHome(), 'needle', this.options.revision)
	}

	/** Absolute path to the needle engine binary (whether or not installed yet). */
	get binaryPath(): string {
		return join(this.installDir, needleBinaryName())
	}

	/** Whether the engine binary is installed. */
	get binaryInstalled(): boolean {
		return existsSync(this.binaryPath)
	}

	/** Absolute path where the needle3.cact weights live (whether or not downloaded yet). */
	get weightsPath(): string {
		return needleWeightsPath()
	}

	/** Whether the model weights are downloaded. */
	get weightsInstalled(): boolean {
		return existsSync(this.weightsPath)
	}

	/** Whether needle is fully installed (engine binary + weights). */
	get ready(): boolean {
		return this.binaryInstalled && this.weightsInstalled
	}

	/**
	 * Download the platform engine binary from Hugging Face (~1MB). Skips when
	 * already installed. Emits downloadProgress events.
	 *
	 * @returns The absolute path to the installed binary
	 */
	async downloadBinary(): Promise<string> {
		if (this.binaryInstalled) return this.binaryPath
		const folder = needlePlatformFolder()
		if (!folder) {
			throw new Error(
				`No prebuilt needle engine is known for ${process.platform}-${process.arch}. ` +
				`Set LUCA_NEEDLE_PLATFORM to a platform folder from https://huggingface.co/${NEEDLE_HF_REPO}/tree/main.`
			)
		}
		const url = `https://huggingface.co/${NEEDLE_HF_REPO}/resolve/${this.options.revision}/${folder}/${needleBinaryName()}`
		await this.downloadFile(url, this.binaryPath, 'needle engine')
		if (process.platform !== 'win32') chmodSync(this.binaryPath, 0o755)
		return this.binaryPath
	}

	/**
	 * Download the needle3.cact weights (~35MB) into the shared model cache.
	 * Skips when already present. Emits downloadProgress events.
	 *
	 * @returns The absolute path to the weights file
	 */
	async downloadWeights(): Promise<string> {
		if (this.weightsInstalled) return this.weightsPath
		const url = `https://huggingface.co/${NEEDLE_HF_REPO}/resolve/${this.options.revision}/${NEEDLE_WEIGHTS_FILE}`
		await this.downloadFile(url, this.weightsPath, 'needle3 weights')
		return this.weightsPath
	}

	/**
	 * Ensure both the engine binary and weights are installed, downloading
	 * whatever is missing (~36MB total, one time).
	 */
	async install(): Promise<{ binaryPath: string; weightsPath: string }> {
		return {
			binaryPath: await this.downloadBinary(),
			weightsPath: await this.downloadWeights(),
		}
	}

	/**
	 * Get an agent for a tool set: ensures a detached needle server bound to
	 * these tools is healthy (spawning and auto-installing if needed) and
	 * returns a handle to it. Servers are shared across luca processes — a
	 * second call with the same tools reuses the running server.
	 *
	 * @param tools - The functions needle may call. `parameters` accepts a zod
	 *   object schema or a plain JSON Schema object.
	 * @param opts.system - Session facts like date, locale, or device
	 *
	 * @example
	 * ```typescript
	 * const agent = await container.feature('needle').agent([
	 *   { name: 'set_timer', description: 'Set a countdown timer.',
	 *     parameters: z.object({ minutes: z.number().describe('Timer length in minutes') }) },
	 * ])
	 * const { function_calls, confidence } = await agent.complete('set a timer for 12 minutes')
	 * ```
	 */
	async agent(tools: NeedleTool[], opts: { system?: string } = {}): Promise<NeedleAgent> {
		if (!tools.length) throw new Error('needle.agent() needs at least one tool')
		const normalized = normalizeTools(tools)
		const toolsHash = hashToolSet(normalized, opts.system)
		const port = await this.ensureServer(normalized, toolsHash, opts.system)
		const baseURL = `http://127.0.0.1:${port}`
		const complete = async (input: string, callOpts: { fresh?: boolean } = {}): Promise<NeedleResult> => {
			if (callOpts.fresh) await this.resetServer(port)
			const res = await fetch(`${baseURL}/complete`, {
				method: 'POST',
				body: JSON.stringify({ input }),
				signal: AbortSignal.timeout(60_000),
			})
			if (!res.ok) throw new Error(`needle server on port ${port} answered HTTP ${res.status}`)
			return await res.json() as NeedleResult
		}
		return {
			port,
			baseURL,
			toolsHash,
			complete,
			reset: () => this.resetServer(port),
			stop: () => this.stopServer(port),
		}
	}

	/**
	 * Extract typed data from unstructured text: sugar over a single-tool
	 * agent whose parameters are your schema. Returns the extracted arguments
	 * (validated when the schema is zod) plus needle's confidence.
	 *
	 * @param text - The unstructured input (an email, an invoice, a form blob)
	 * @param schema - A zod object schema or JSON Schema describing the fields to pull out
	 *
	 * @example
	 * ```typescript
	 * const { data, confidence } = await container.feature('needle').extract(
	 *   'Invoice #4821 from Acme Corp, total $1,204.50 due March 3',
	 *   z.object({
	 *     invoiceNumber: z.string().describe('The invoice number'),
	 *     vendor: z.string().describe('Who issued the invoice'),
	 *     total: z.number().describe('Total amount due'),
	 *   }),
	 * )
	 * ```
	 */
	async extract<T = Record<string, unknown>>(
		text: string,
		schema: object,
		opts: { system?: string } = {},
	): Promise<{ data: T; confidence: number; result: NeedleResult }> {
		const agent = await this.agent([
			{ name: 'extract', description: 'Extract the structured fields from the input text.', parameters: schema },
		], opts)
		const result = await agent.complete(text, { fresh: true })
		const call = result.function_calls.find((c) => c.name === 'extract') ?? result.function_calls[0]
		if (!call) throw new Error(`needle returned no extraction: ${result.error ?? result.reasoning}`)
		let data = call.arguments as T
		if (schema && typeof schema === 'object' && '_zod' in schema) {
			data = (schema as unknown as z.ZodType).parse(call.arguments) as T
		}
		return { data, confidence: result.confidence, result }
	}

	/** Stop the needle server on a port via its pid file. */
	stopServer(port: number): boolean {
		const pidFile = this.pidFilePath(port)
		if (!existsSync(pidFile)) return false
		try {
			const pid = Number(readFileSync(pidFile, 'utf8').trim())
			if (pid > 0) process.kill(pid, 'SIGTERM')
		} catch { /* already gone */ }
		rmSync(pidFile, { force: true })
		rmSync(this.sidecarPath(port), { force: true })
		this.state.set('runningPorts', (this.state.get('runningPorts') ?? []).filter((p: number) => p !== port))
		this.emit('serverStopped', { port })
		return true
	}

	/** Stop every needle server this machine has pid files for. */
	stopAll(): number {
		let stopped = 0
		const home = lucaHome()
		if (!existsSync(home)) return 0
		for (const entry of readdirSync(home)) {
			const match = entry.match(/^needle-server-(\d+)\.pid$/)
			if (match?.[1] && this.stopServer(Number(match[1]))) stopped++
		}
		return stopped
	}

	/**
	 * Install/runtime status snapshot — what's downloaded and which servers
	 * are answering right now.
	 */
	async status(): Promise<{
		binaryInstalled: boolean
		binaryPath: string
		weightsInstalled: boolean
		weightsPath: string
		servers: Array<{ port: number; toolsHash: string; healthy: boolean }>
	}> {
		const servers: Array<{ port: number; toolsHash: string; healthy: boolean }> = []
		const home = lucaHome()
		if (existsSync(home)) {
			for (const entry of readdirSync(home)) {
				const match = entry.match(/^needle-server-(\d+)\.json$/)
				if (!match) continue
				const port = Number(match[1])
				const sidecar = this.readSidecar(port)
				servers.push({ port, toolsHash: sidecar?.toolsHash ?? 'unknown', healthy: await probeNeedle(port) })
			}
		}
		return {
			binaryInstalled: this.binaryInstalled,
			binaryPath: this.binaryPath,
			weightsInstalled: this.weightsInstalled,
			weightsPath: this.weightsPath,
			servers,
		}
	}

	// ── Internals ─────────────────────────────────────────────────────

	private pidFilePath(port: number): string {
		return join(lucaHome(), `needle-server-${port}.pid`)
	}

	private sidecarPath(port: number): string {
		return join(lucaHome(), `needle-server-${port}.json`)
	}

	private readSidecar(port: number): ServerSidecar | null {
		try {
			return JSON.parse(readFileSync(this.sidecarPath(port), 'utf8'))
		} catch {
			return null
		}
	}

	private async resetServer(port: number): Promise<void> {
		const res = await fetch(`http://127.0.0.1:${port}/reset`, {
			method: 'POST',
			signal: AbortSignal.timeout(5000),
		})
		if (!res.ok) throw new Error(`needle server on port ${port} failed to reset: HTTP ${res.status}`)
	}

	/**
	 * Ensure a server bound to this tool set is healthy, spawning one if
	 * needed. The port is derived from the tool-set hash; when a *different*
	 * tool set already holds that port, linear-probe upward within the range.
	 */
	private async ensureServer(tools: NeedleTool[], toolsHash: string, system?: string): Promise<number> {
		const { basePort, portRange } = this.options
		const start = basePort + (parseInt(toolsHash.slice(0, 8), 16) % portRange)

		for (let i = 0; i < portRange; i++) {
			const port = basePort + ((start - basePort + i) % portRange)
			const sidecar = this.readSidecar(port)
			const healthy = await probeNeedle(port)
			if (healthy && sidecar?.toolsHash === toolsHash) return port // reuse
			if (healthy) continue // someone else's tool set — probe the next slot
			// Not answering: the slot is free (stale files get overwritten)
			return await this.spawnServer(port, tools, toolsHash, system)
		}
		throw new Error(
			`All ${portRange} needle ports (${basePort}..${basePort + portRange - 1}) are held by other tool sets. ` +
			`Stop unused servers with container.feature('needle').stopAll() or raise the portRange option.`
		)
	}

	private async spawnServer(port: number, tools: NeedleTool[], toolsHash: string, system?: string): Promise<number> {
		await this.install()
		mkdirSync(this.runDir, { recursive: true })

		const toolsPath = join(this.runDir, `tools-${toolsHash}.json`)
		writeFileSync(toolsPath, JSON.stringify(tools, null, 2))
		const args = [
			'--model', this.weightsPath,
			'--tools', toolsPath,
			'--serve', '--port', String(port),
			'--max', String(this.options.maxTokens),
			// Reuse the tool set's embedding index across restarts
			'--tool-index', join(this.runDir, `tool-index-${toolsHash}.bin`),
		]
		if (system) {
			const systemPath = join(this.runDir, `system-${toolsHash}.txt`)
			writeFileSync(systemPath, system)
			args.push('--system', systemPath)
		}
		if (this.options.depth != null) args.push('--depth', String(this.options.depth))
		if (this.options.threads != null) args.push('--threads', String(this.options.threads))

		const logPath = join(lucaHome(), `needle-server-${port}.log`)
		const logFd = openSync(logPath, 'a')
		const child = spawn(this.binaryPath, args, {
			cwd: this.installDir,
			detached: true,
			stdio: ['ignore', logFd, logFd],
		})
		child.unref()
		writeFileSync(this.pidFilePath(port), String(child.pid ?? ''))
		writeFileSync(this.sidecarPath(port), JSON.stringify({ toolsHash, pid: child.pid ?? 0 } satisfies ServerSidecar))

		const deadline = Date.now() + this.options.readyTimeoutMs
		while (Date.now() < deadline) {
			await new Promise((r) => setTimeout(r, 200))
			if (await probeNeedle(port)) {
				this.state.set('runningPorts', [...new Set([...(this.state.get('runningPorts') ?? []), port])])
				this.emit('serverStarted', { port, toolsHash })
				return port
			}
			if (child.exitCode !== null) {
				throw new Error(`needle exited before becoming healthy (code ${child.exitCode}). Check the log at ${logPath}`)
			}
		}
		throw new Error(`needle on port ${port} did not become healthy in time. Check the log at ${logPath}`)
	}

	/** Where tool sets, tool-index caches, and system files for spawned servers live. */
	private get runDir(): string {
		return join(lucaHome(), 'needle', 'run')
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

export default Needle
