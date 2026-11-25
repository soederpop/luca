/**
 * The project's AI environment, as the workbench shows it: the model
 * providers assistants can use and which one is the default, the API keys
 * they need, the local models, the coding agents on this machine, and the
 * model servers found on the network.
 *
 * Luca already knows all of it (`modelProviders`, `luca setup`, the agent
 * features). This reads it into one view and does the few writes: add a
 * found server to a config file, and put an API key in the project's `.env`.
 * A key's value is written, never read back or sent.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { homedir } from 'node:os'
import { providersDestinations, mergeProviderConfig } from '../commands/setup.js'
import { resolveModelPath, DEFAULT_LOCAL_MODEL } from '../node/features/semantic-search.js'
import { installedBinaryPath, chatModelPath, DEFAULT_CHAT_MODEL, CHAT_MODEL_SOURCES } from '../node/features/llama-server.js'
import { hasDescribeEmbeddings } from '../describe-search.js'

export type AiProvider = {
	id: string
	label: string
	/** `openai-chat-completions`, `openai-responses`, `openai-codex`… */
	apiMode: string
	model: string
	baseURL: string
	/** `ready`, `needs key`, `no server`, `login`, `unknown`. */
	status: string
	/** One line: `needs OPENAI_API_KEY`, `answers with 3 models`. */
	statusText: string
	/** `machine`, `project` or `built in`. */
	source: string
	isDefault: boolean
}

export type AiKey = { env: string; label: string; set: boolean; where: string | null; providers: string[] }

export type AiCheck = { id: string; label: string; ok: boolean; detail: string; fix: string | null }

export type AiAgent = { id: string; label: string; available: boolean; version: string; path: string; detail: string }

export type AiServer = {
	baseURL: string
	host: string
	port: number
	/** `LM Studio on chief`. */
	title: string
	source: string
	models: string[]
	latencyMs: number
	/** The provider that already serves it, if one does. */
	profileId: string | null
	/** The tailnet name of the machine, when it has one. */
	hostname?: string
}

export type AiConfigFile = { kind: 'machine' | 'project'; path: string; display: string; exists: boolean; providers: string[] }

export type AiView = {
	defaultProvider: string | null
	defaultText: string
	providers: AiProvider[]
	keys: AiKey[]
	local: AiCheck[]
	agents: AiAgent[]
	servers: AiServer[]
	/** When the last scan finished, in ms. Null before the first. */
	scannedAt: number | null
	configFiles: AiConfigFile[]
	/** Set when `.env` holds a key and git does not ignore it. */
	envWarning: string | null
}

const AGENTS: Array<{ id: string; label: string; feature: string; path: string }> = [
	{ id: 'claude', label: 'Claude Code', feature: 'claudeCode', path: 'claudePath' },
	{ id: 'codex', label: 'OpenAI Codex', feature: 'openaiCodex', path: 'codexPath' },
	{ id: 'hermes', label: 'Hermes Agent', feature: 'hermesAgent', path: 'hermesPath' },
]

const KEY_LABELS: Record<string, string> = { OPENAI_API_KEY: 'OpenAI', ANTHROPIC_API_KEY: 'Anthropic' }
const ENV_NAME = /^[A-Z][A-Z0-9_]{2,63}$/
const AGENT_CHECK_MS = 8000

function tilde(path: string): string {
	const home = homedir()
	return path.startsWith(home) ? '~' + path.slice(home.length) : path
}

function normalizeURL(url: string): string {
	return String(url || '').replace(/\/+$/, '').replace('://localhost:', '://127.0.0.1:').replace('://0.0.0.0:', '://127.0.0.1:')
}

/** `host:port` of a URL, lower case, and again without the domain (`chief.tail1.ts.net` → `chief`). */
function urlKeys(url: string): string[] {
	try {
		const u = new URL(normalizeURL(url))
		const port = u.port || (u.protocol === 'https:' ? '443' : '80')
		const host = u.hostname.toLowerCase()
		return [...new Set([`${host}:${port}`, `${host.split('.')[0]}:${port}`])]
	} catch {
		return []
	}
}

function serverKeys(s: { baseURL: string; port: number; hostname?: string }): string[] {
	const keys = urlKeys(s.baseURL)
	if (s.hostname) { const h = s.hostname.toLowerCase(); keys.push(`${h}:${s.port}`, `${h.split('.')[0]}:${s.port}`) }
	return [...new Set(keys)]
}

/** The names set in a `.env` text. Values are not kept. Pure. */
export function envNames(text: string | null): string[] {
	if (!text) return []
	const out: string[] = []
	for (const line of text.split('\n')) {
		const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line)
		if (m && m[2]!.trim().replace(/^(['"])\1$/, '') !== '') out.push(m[1]!)
	}
	return out
}

/** A `.env` text with `name` set to `value`: its line replaced, or a new line at the end. Pure. */
export function setEnvValue(text: string | null, name: string, value: string): string {
	const line = `${name}=${/[\s#"'$`\\]/.test(value) ? JSON.stringify(value) : value}`
	const lines = (text ?? '').split('\n')
	const at = lines.findIndex((l) => new RegExp(`^\\s*(?:export\\s+)?${name}\\s*=`).test(l))
	if (at >= 0) {
		lines[at] = line
		return lines.join('\n')
	}
	const body = (text ?? '').replace(/\n+$/, '')
	return (body ? body + '\n' : '') + line + '\n'
}

export class AiEnvironment {
	private agentCache: AiAgent[] | undefined
	private agentPending: Promise<AiAgent[]> | undefined

	constructor(private container: any) {}

	private get mp(): any { return this.container.feature('modelProviders') }
	private get envPath(): string { return this.container.paths.resolve('.env') }

	private readText(path: string): string | null {
		try { return existsSync(path) ? readFileSync(path, 'utf8') : null } catch { return null }
	}

	private configFiles(): AiConfigFile[] {
		const yaml = this.container.feature('yaml')
		return providersDestinations(this.container).map((dest) => {
			const text = this.readText(dest.path)
			let providers: string[] = []
			if (text) {
				try {
					const doc = yaml.parse(text)
					const section = doc && typeof doc === 'object' ? (doc.providers && typeof doc.providers === 'object' ? doc.providers : dest.kind === 'machine' ? doc : {}) : {}
					providers = Object.keys(section).filter((k) => k !== 'hosts' && k !== 'providers')
				} catch {}
			}
			return { kind: dest.kind, path: dest.path, display: tilde(dest.path), exists: text !== null, providers }
		})
	}

	private keys(summary: any[]): AiKey[] {
		const names = new Set<string>(['OPENAI_API_KEY', 'ANTHROPIC_API_KEY'])
		for (const p of summary) if (p.apiKeyEnv) names.add(String(p.apiKeyEnv))
		const inFile = new Set(envNames(this.readText(this.envPath)))
		return [...names].map((env) => {
			const set = !!process.env[env]
			return {
				env,
				label: KEY_LABELS[env] ?? env,
				set,
				where: inFile.has(env) ? 'this project\'s .env' : set ? 'the environment' : null,
				providers: summary.filter((p) => p.apiKeyEnv === env).map((p) => String(p.id)),
			}
		})
	}

	private local(): AiCheck[] {
		const binary = installedBinaryPath() !== null
		const embed = existsSync(resolveModelPath(DEFAULT_LOCAL_MODEL))
		const chat = existsSync(chatModelPath(DEFAULT_CHAT_MODEL))
		const size = (CHAT_MODEL_SOURCES as any)[DEFAULT_CHAT_MODEL]?.approxSize
		let index = false
		try { index = hasDescribeEmbeddings() } catch {}
		return [
			{ id: 'binary', label: 'llama-server', ok: binary, detail: binary ? 'installed: runs local models' : 'not installed', fix: binary ? null : 'luca setup --skip-models' },
			{ id: 'embeddings', label: 'Embedding model', ok: embed, detail: embed ? `${DEFAULT_LOCAL_MODEL}: semantic search works offline` : `${DEFAULT_LOCAL_MODEL} is not downloaded`, fix: embed ? null : 'luca setup --local-embeddings' },
			{ id: 'chat', label: 'Local chat model', ok: chat, detail: chat ? `${DEFAULT_CHAT_MODEL}: the "local" provider works` : `${DEFAULT_CHAT_MODEL} is not downloaded${size ? ` (${size})` : ''}`, fix: chat ? null : 'luca setup --chat-model' },
			{ id: 'describe', label: 'Docs search index', ok: index, detail: index ? 'built: luca describe can search by meaning' : 'not built', fix: index ? null : 'luca setup --yes' },
		]
	}

	/** Ask each coding agent's CLI for its version. Once per host; `refresh` asks again. */
	private checkAgents(refresh = false): Promise<AiAgent[]> {
		if (this.agentCache && !refresh) return Promise.resolve(this.agentCache)
		if (this.agentPending && !refresh) return this.agentPending
		const one = async (a: (typeof AGENTS)[number]): Promise<AiAgent> => {
			const row: AiAgent = { id: a.id, label: a.label, available: false, version: '', path: '', detail: 'not found on this machine' }
			try {
				const feature = this.container.feature(a.feature)
				row.path = String(feature[a.path] ?? '')
				const ok = await Promise.race([
					feature.checkAvailability(),
					new Promise<boolean>((resolve) => setTimeout(() => resolve(false), AGENT_CHECK_MS)),
				])
				row.available = !!ok
				if (ok) {
					const state = feature.state?.current ?? {}
					const key = Object.keys(state).find((k) => /version$/i.test(k) && typeof state[k] === 'string')
					row.version = key ? String(state[key]).split('\n')[0]!.trim() : ''
					row.detail = `luca prompt ${a.id} <file> works`
				}
			} catch (err: any) {
				row.detail = String(err?.message ?? err).split('\n')[0]!.slice(0, 160)
			}
			return row
		}
		const pending = Promise.all(AGENTS.map(one)).then((rows) => { this.agentCache = rows; this.agentPending = undefined; return rows })
		this.agentPending = pending
		return pending
	}

	private servers(): AiServer[] {
		let found: any[] = []
		try { found = this.mp.discoveredServers ?? [] } catch {}
		let profiles: any[] = []
		try { profiles = this.mp.summary() } catch {}
		return found.map((s) => {
			const keys = serverKeys(s)
			const match = s.profileId ?? profiles.find((p) => p.baseURL && urlKeys(String(p.baseURL)).some((k) => keys.includes(k)))?.id ?? null
			const where = s.source === 'localhost' ? 'this Mac' : String(s.hostname || s.host)
			return {
				baseURL: String(s.baseURL), host: String(s.host), port: Number(s.port),
				title: `${s.hint || 'Model server'} on ${where}`,
				source: String(s.source), models: [...(s.models ?? [])].map(String), latencyMs: Math.round(Number(s.latencyMs) || 0),
				profileId: match ? String(match) : null,
				...(s.hostname ? { hostname: String(s.hostname) } : {}),
			}
		})
	}

	async view(opts: { refreshAgents?: boolean } = {}): Promise<AiView> {
		const mp = this.mp
		let summary: any[] = []
		try { summary = mp.summary() } catch {}
		let defaultId: string | undefined
		try { defaultId = mp.resolveDefaultId() } catch {}
		const files = this.configFiles()
		const servers = this.servers()
		// A provider may name a tailnet machine by its hostname while the scan reports its IP.
		const live = new Map<string, AiServer>()
		for (const s of servers) for (const key of serverKeys(s)) live.set(key, s)
		const sourceOf = (id: string) => files.find((f) => f.providers.includes(id))?.kind ?? 'built in'

		const providers: AiProvider[] = summary.map((p) => {
			let status = 'unknown'
			let statusText = ''
			const server = p.baseURL ? urlKeys(String(p.baseURL)).map((k) => live.get(k)).find(Boolean) : undefined
			if (p.auth === 'apiKey') {
				if (p.hasApiKey) { status = 'ready'; statusText = p.apiKeyEnv ? `${p.apiKeyEnv} is set` : 'has a key' }
				else { status = 'needs key'; statusText = p.apiKeyEnv ? `needs ${p.apiKeyEnv}` : 'needs an API key' }
			} else if (p.auth === 'codex') {
				status = 'login'; statusText = 'uses your codex login'
			} else if (server) {
				status = 'ready'; statusText = `answers with ${server.models.length} model${server.models.length === 1 ? '' : 's'}`
			} else if (p.id === 'local') {
				const ok = installedBinaryPath() !== null && existsSync(chatModelPath(DEFAULT_CHAT_MODEL))
				status = ok ? 'ready' : 'no server'; statusText = ok ? 'local model installed' : 'needs luca setup --chat-model'
			} else if (!p.baseURL) {
				status = 'no server'; statusText = 'no base URL'
			} else {
				status = mp.hasDiscovered ? 'no server' : 'unknown'
				statusText = mp.hasDiscovered ? 'did not answer the last scan' : 'scan to see if it answers'
			}
			if (!p.transportAvailable) { status = 'no server'; statusText = `no transport for ${p.apiMode}` }
			return {
				id: String(p.id), label: String(p.label ?? p.id), apiMode: String(p.apiMode), model: String(p.defaultModel ?? ''), baseURL: String(p.baseURL ?? ''),
				status, statusText, source: sourceOf(String(p.id)), isDefault: p.id === defaultId,
			}
		})
		// The default first, then what the user set up, then what works, then the rest.
		const rank = (p: AiProvider) => (p.isDefault ? 0 : p.source !== 'built in' ? 1 : p.status === 'ready' ? 2 : p.status === 'login' ? 3 : 4)
		providers.sort((a, b) => rank(a) - rank(b) || a.id.localeCompare(b.id))

		const keys = this.keys(summary)
		let envWarning: string | null = null
		if (envNames(this.readText(this.envPath)).some((n) => keys.some((k) => k.env === n))) {
			try {
				const ignored = this.container.feature('proc').exec('git check-ignore -q .env && echo yes || echo no')
				if (String(ignored).trim() === 'no') envWarning = '.env holds a key and git does not ignore it. Add .env to .gitignore before you commit.'
			} catch {}
		}
		const pinned = process.env.LUCA_DEFAULT_PROVIDER
		return {
			defaultProvider: defaultId ?? null,
			defaultText: defaultId
				? `${defaultId}${pinned === defaultId ? ' (set by LUCA_DEFAULT_PROVIDER)' : ''}: what an assistant uses when it names no provider`
				: 'No provider works yet. Set an OpenAI key, install the local model, or add a server.',
			providers,
			keys,
			local: this.local(),
			agents: await this.checkAgents(!!opts.refreshAgents),
			servers,
			scannedAt: mp.discoveredAt ?? null,
			configFiles: files,
			envWarning,
		}
	}

	/**
	 * What `luca prompt` can send a file to: the project's assistants, then
	 * the coding agents, each with whether it can run now.
	 */
	async promptTargets(assistants: Array<{ id: string; description?: string; modelText?: string }>): Promise<{ defaultTarget: string; targets: Array<{ id: string; label: string; kind: string; detail: string; available: boolean }> }> {
		const agents = await this.checkAgents()
		let coding = 'claude'
		try { coding = String(this.container.manifest?.luca?.codingAssistant || 'claude') } catch {}
		const targets = [
			...assistants.map((a) => ({ id: a.id, label: a.id, kind: 'assistant', detail: [a.modelText, a.description].filter(Boolean).join(' · ').slice(0, 160), available: true })),
			...agents.map((a) => ({ id: a.id, label: a.label, kind: 'agent', detail: a.available ? (a.version || 'installed') : 'not found on this machine', available: a.available })),
		]
		return { defaultTarget: targets.some((t) => t.id === coding) ? coding : (targets.find((t) => t.available)?.id ?? 'claude'), targets }
	}

	/** Scan this Mac and the tailnet for model servers. */
	async discover(): Promise<AiView> {
		try { await this.mp.discover({ refresh: true }) } catch {}
		return this.view()
	}

	/** Add a found server to a config file as a provider, then load it. */
	async addServer(baseURL: unknown, target: unknown, model: unknown): Promise<{ status: number; body: any }> {
		const mp = this.mp
		const server = (mp.discoveredServers ?? []).find((s: any) => normalizeURL(s.baseURL) === normalizeURL(String(baseURL ?? '')))
		if (!server) return { status: 404, body: { error: 'That server is not in the last scan. Scan again.' } }
		const dest = providersDestinations(this.container).find((d) => d.kind === target)
		if (!dest) return { status: 400, body: { error: 'target must be machine or project' } }
		const yaml = this.container.feature('yaml')
		const text = this.readText(dest.path)
		let doc: any = {}
		if (text) {
			try { doc = yaml.parse(text) ?? {} } catch { return { status: 409, body: { error: `${tilde(dest.path)} does not parse as YAML. Fix it first.` } } }
		}
		const section = doc && typeof doc === 'object' ? (doc.providers && typeof doc.providers === 'object' ? doc.providers : dest.kind === 'machine' ? doc : {}) : {}
		const hosts: Record<string, string> = section.hosts && typeof section.hosts === 'object' ? { ...section.hosts } : {}
		const chosen = typeof model === 'string' && model.trim() ? model.trim() : undefined
		if (chosen && !server.models.includes(chosen)) return { status: 400, body: { error: `${chosen} is not a model of that server` } }
		const suggestion = mp.suggestConfig([server], {
			hosts,
			existingProviderIds: [...Object.keys(section).filter((k) => k !== 'hosts'), ...mp.summary().map((p: any) => String(p.id))],
			...(chosen ? { models: { [server.baseURL]: chosen } } : {}),
		})
		const next = mergeProviderConfig(doc, suggestion, dest)
		mkdirSync(dirname(dest.path), { recursive: true })
		writeFileSync(dest.path, yaml.stringify(next))
		try { mp.loadConfigFiles() } catch {}
		const ids = Object.keys(suggestion.providers)
		return { status: 200, body: { ok: true, added: ids, file: tilde(dest.path), view: await this.view() } }
	}

	/**
	 * Put an API key in the project's `.env` and in this host's environment,
	 * so it works at once. Only names a provider reads are taken.
	 */
	async setKey(env: unknown, value: unknown): Promise<{ status: number; body: any }> {
		const name = String(env ?? '')
		const known = this.keys(this.mp.summary()).map((k) => k.env)
		if (!ENV_NAME.test(name) || !known.includes(name)) return { status: 400, body: { error: `${name || 'that'} is not a key a provider reads` } }
		const secret = typeof value === 'string' ? value.trim() : ''
		if (!secret || /[\r\n]/.test(secret)) return { status: 400, body: { error: 'The key must be one line' } }
		try {
			writeFileSync(this.envPath, setEnvValue(this.readText(this.envPath), name, secret), { mode: 0o600 })
		} catch (err: any) {
			return { status: 500, body: { error: `could not write .env: ${String(err?.message ?? err)}` } }
		}
		process.env[name] = secret
		return { status: 200, body: { ok: true, env: name, file: tilde(join(String(this.container.cwd), '.env')), view: await this.view() } }
	}
}
