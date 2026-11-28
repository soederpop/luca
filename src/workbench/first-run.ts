/**
 * The host tasks behind the `first-time-user` guide: find out whether this
 * Mac already has a way to reach a model, and make the best one Luca's
 * default.
 *
 * In order of preference: Claude Code (signed in), Codex (signed in), an
 * OpenAI or Anthropic key, a model server already running (LM Studio,
 * Ollama, on this Mac or the tailnet), and last the local llama-server model.
 *
 * The guide never types into a shell itself. Installs and sign-ins run in a
 * terminal tile that the app starts from its own short list of commands.
 */
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { homedir } from 'node:os'
import type { AiEnvironment } from './ai.js'
import type { GuideTask } from './guide.js'
import { providersDestinations } from '../commands/setup.js'

const CHECK_MS = 8000
/** Built-in profiles whose model is a stand-in, not one the server has. */
const PLACEHOLDER_PROFILES = new Set(['lmstudio', 'ollama'])

/** Where the installers put the CLIs. A host started before the install may not have these on PATH. */
export function binaryDirs(home: string): string[] {
	return [
		`${home}/.local/bin`,
		`${home}/.claude/local`,
		'/opt/homebrew/bin',
		'/usr/local/bin',
		`${home}/.bun/bin`,
		`${home}/.npm-global/bin`,
	]
}

/** The first `name` on PATH, else in `binaryDirs`. Null when it is nowhere. */
export function findBinary(name: string, path: string, home: string, exists: (p: string) => boolean = existsSync): string | null {
	const dirs = [...String(path || '').split(':').filter(Boolean), ...binaryDirs(home)]
	for (const dir of dirs) {
		const full = `${dir.replace(/\/+$/, '')}/${name}`
		if (exists(full)) return full
	}
	return null
}

/** Put `dir` on this host's PATH, so features that spawn by name find a CLI installed after the host started. */
function addToPath(dir: string) {
	const parts = String(process.env.PATH || '').split(':')
	if (!parts.includes(dir)) process.env.PATH = [dir, ...parts.filter(Boolean)].join(':')
}

/** The provider id to make the default, from what the check found. Null when nothing works. Pure. */
export function pickDefault(found: {
	claudeLoggedIn?: boolean
	codexLoggedIn?: boolean
	openaiKey?: boolean
	anthropicKey?: boolean
	serverProvider?: string
	localReady?: boolean
}): string | null {
	if (found.claudeLoggedIn) return 'claude-code'
	if (found.codexLoggedIn) return 'codex'
	if (found.openaiKey) return 'openai'
	if (found.anthropicKey) return 'anthropic'
	if (found.serverProvider) return found.serverProvider
	if (found.localReady) return 'local'
	return null
}

const mark = (ok: boolean) => (ok ? '✓' : '·')

export class FirstRun {
	constructor(private container: any, private ai: AiEnvironment) {}

	private get mp(): any { return this.container.feature('modelProviders') }

	private async run(bin: string, args: string[]): Promise<{ exitCode: number; stdout: string }> {
		const proc = this.container.feature('proc')
		const timeout = new Promise<{ exitCode: number; stdout: string }>((resolve) => setTimeout(() => resolve({ exitCode: -1, stdout: '' }), CHECK_MS))
		const done = proc.spawnAndCapture(bin, args).then((r: any) => ({ exitCode: Number(r?.exitCode ?? -1), stdout: String(r?.stdout ?? '') })).catch(() => ({ exitCode: -1, stdout: '' }))
		return Promise.race([done, timeout])
	}

	private async claude() {
		const bin = findBinary('claude', String(process.env.PATH), homedir())
		if (!bin) return { installed: false, loggedIn: false, detail: 'not installed' }
		addToPath(dirname(bin))
		const status = await this.run(bin, ['auth', 'status', '--json'])
		let loggedIn = false
		let method = ''
		try { const j = JSON.parse(status.stdout); loggedIn = !!j.loggedIn; method = String(j.authMethod || '') } catch {}
		return { installed: true, loggedIn, detail: loggedIn ? `signed in${method ? ` (${method})` : ''}` : 'installed, not signed in' }
	}

	private async codex() {
		const bin = findBinary('codex', String(process.env.PATH), homedir())
		if (!bin) return { installed: false, loggedIn: false, detail: 'not installed' }
		addToPath(dirname(bin))
		const status = await this.run(bin, ['login', 'status'])
		const loggedIn = status.exitCode === 0
		const line = status.stdout.trim().split('\n')[0] || ''
		return { installed: true, loggedIn, detail: loggedIn ? (line || 'signed in') : 'installed, not signed in' }
	}

	/**
	 * `ai-check`: what this Mac has. Sets `aiReady`, one flag per way in,
	 * `defaultProvider` (what works today, or '') and `found` (a markdown list).
	 */
	check: GuideTask = async () => {
		const [claude, codex, view] = await Promise.all([this.claude(), this.codex(), this.ai.discover()])
		const key = (env: string) => view.keys.find((k) => k.env === env)?.set === true && process.env[env] !== 'set-your-own'
		const openaiKey = key('OPENAI_API_KEY')
		const anthropicKey = key('ANTHROPIC_API_KEY')
		// A running server: this Mac first, then the tailnet. LM Studio and Ollama by name.
		const servers = [...view.servers].sort((a, b) => Number(b.source === 'localhost') - Number(a.source === 'localhost'))
		const server = servers.find((s) => s.models.length > 0)
		const lmstudio = servers.find((s) => s.source === 'localhost' && s.port === 1234)
		const localReady = view.local.find((c) => c.id === 'binary')?.ok === true && view.local.find((c) => c.id === 'chat')?.ok === true
		const lmstudioApp = existsSync('/Applications/LM Studio.app') || existsSync(`${homedir()}/Applications/LM Studio.app`)
		const defaultProvider = view.defaultProvider ?? ''

		const lines = [
			`${mark(claude.loggedIn)} **Claude Code**: ${claude.detail}`,
			`${mark(codex.loggedIn)} **Codex**: ${codex.detail}`,
			`${mark(openaiKey || anthropicKey)} **API keys**: ${[openaiKey && 'OPENAI_API_KEY', anthropicKey && 'ANTHROPIC_API_KEY'].filter(Boolean).join(', ') || 'none set'}`,
			`${mark(!!server)} **Model server**: ${server ? `${server.title}, ${server.models.length} model${server.models.length === 1 ? '' : 's'}` : lmstudioApp ? 'LM Studio is installed but its server is not running' : 'none running'}`,
			`${mark(localReady)} **Local model**: ${localReady ? 'installed' : 'not installed'}`,
		]
		return {
			claudeInstalled: claude.installed,
			claudeLoggedIn: claude.loggedIn,
			codexInstalled: codex.installed,
			codexLoggedIn: codex.loggedIn,
			openaiKey,
			anthropicKey,
			serverRunning: !!server,
			serverTitle: server?.title ?? '',
			serverURL: server?.baseURL ?? '',
			serverModel: server?.models[0] ?? '',
			serverProvider: server?.profileId ?? '',
			lmstudioRunning: !!lmstudio,
			lmstudioApp,
			localReady,
			defaultProvider,
			aiReady: claude.loggedIn || codex.loggedIn || openaiKey || anthropicKey || !!server || localReady,
			found: lines.map((l) => `- ${l}`).join('\n'),
		}
	}

	/**
	 * `ai-use-best`: make the best way in Luca's default, in
	 * `~/.luca/model-providers.yml`. Runs `ai-check` first. A found server
	 * that no provider serves yet is added as one. Sets `chosen` and
	 * `chosenText`; `chosen` is '' when nothing works.
	 */
	useBest: GuideTask = async (vars) => {
		const found = await this.check(vars)
		let serverProvider = String(found.serverProvider || '')
		let chosen = pickDefault({ ...(found as any), serverProvider: found.serverRunning ? serverProvider || 'server' : '' })
		// The built-in lmstudio and ollama profiles name a placeholder model.
		// When the server is the pick, write a provider with a model it really has.
		if (chosen && (chosen === 'server' || PLACEHOLDER_PROFILES.has(chosen))) {
			const added = await this.ai.addServer(found.serverURL, 'machine', found.serverModel || undefined)
			if (added.status !== 200) throw new Error(String(added.body?.error ?? 'could not add the server'))
			serverProvider = String(added.body?.added?.[0] ?? serverProvider)
			chosen = serverProvider || null
		}
		if (!chosen) return { ...found, chosen: '', chosenText: '' }
		const file = this.writeDefault(chosen)
		const label: Record<string, string> = {
			'claude-code': 'Claude Code, with your Claude sign-in',
			codex: 'Codex, with your ChatGPT sign-in',
			openai: 'OpenAI, with OPENAI_API_KEY',
			anthropic: 'Anthropic, with ANTHROPIC_API_KEY',
			local: 'the local model on this Mac',
		}
		return { ...found, serverProvider, chosen, chosenText: `${label[chosen] ?? `${found.serverTitle} (${chosen})`}. Saved as \`default: ${chosen}\` in \`${file}\`.`, defaultProvider: chosen }
	}

	/** Write `default: <id>` to the machine file and load it. Returns the file, with `~`. */
	private writeDefault(id: string): string {
		const yaml = this.container.feature('yaml')
		const dest = providersDestinations(this.container).find((d) => d.kind === 'machine')!
		let doc: any = {}
		if (existsSync(dest.path)) {
			try { doc = yaml.parse(readFileSync(dest.path, 'utf8')) ?? {} } catch { throw new Error(`${dest.path} does not parse as YAML. Fix it first.`) }
		}
		if (!doc || typeof doc !== 'object' || Array.isArray(doc)) doc = {}
		// The machine file is the providers map itself, unless it nests one under `providers:`.
		if (doc.providers && typeof doc.providers === 'object') doc.providers.default = id
		else doc.default = id
		mkdirSync(dirname(dest.path), { recursive: true })
		writeFileSync(dest.path, yaml.stringify(doc))
		try { this.mp.loadConfigFiles() } catch {}
		const home = homedir()
		return dest.path.startsWith(home) ? '~' + dest.path.slice(home.length) : dest.path
	}

	/** The tasks, by the names a guide's `task:` uses. */
	tasks(): Record<string, GuideTask> {
		return { 'ai-check': this.check, 'ai-use-best': this.useBest }
	}
}
