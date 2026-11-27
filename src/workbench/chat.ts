/**
 * Assistants and chat for the workbench: the project's assistants from
 * `assistantsManager`, past conversations from `conversationHistory`, and
 * live chat sessions that stream over the host socket.
 *
 * A conversation id is the part of a history thread after the assistant's
 * prefix (`<assistant>:<cwdHash>:<conversationId>`), so conversations
 * `luca chat` saved (`…:2026-11-25`) open here too. Sessions save after each
 * reply, as `luca chat` does.
 *
 * Frames: `chat-start` (`text` = the user's message), `chat-delta` (`text` =
 * the next piece of the reply), `chat-tool` (`tool` = the call as it starts
 * and as it ends), `chat-done` (`text` = the whole reply, `aborted`, `ms`),
 * `chat-error` (`error`). Each carries `assistant`, `conversationId` and `turnId`.
 */

import { ChatExtensions, parseExtensions, summary, PROMPT_KEY, type ChatExtension, type ChatTarget, type ToolBundle } from './extensions.js'

const MAX_TOOL_TEXT = 4000
const MAX_ARGS_TEXT = 2000

export type ChatToolView = {
	id: string
	name: string
	argsText: string
	status: 'running' | 'done' | 'failed'
	resultText: string | null
	ms: number | null
	/** Why the assistant made this call, in its own words (evalCode's `purpose`). Shown even when tool output is hidden. */
	purpose?: string | null
	/** What the assistant said it expects back (evalCode's `expectation`). */
	expectation?: string | null
}

/** Tool arguments as an object, or null when they are not one (a bare string, nothing). Pure. */
function argsObject(args: unknown): Record<string, unknown> | null {
	let value = args
	if (typeof args === 'string') {
		try { value = JSON.parse(args) } catch { return null }
	}
	return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

/**
 * The parts of a tool call the chat shows apart from the raw arguments. A
 * call that declares its intent (`purpose`, `expectation`: evalCode asks for
 * both) gets those lifted out so the UI can keep the purpose in view, and
 * for evalCode the arguments are the code itself rather than JSON with the
 * snippet escaped inside it. Pure.
 */
export function toolView(name: string, args: unknown): { argsText: string; purpose: string | null; expectation: string | null } {
	const obj = argsObject(args)
	const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
	const purpose = str(obj?.purpose)
	const expectation = str(obj?.expectation)
	if (name === 'evalCode' && typeof obj?.code === 'string') {
		return { argsText: clip(obj.code, MAX_ARGS_TEXT), purpose, expectation }
	}
	if (obj && (purpose || expectation)) {
		const { purpose: _p, expectation: _e, ...rest } = obj
		return { argsText: argsText(rest), purpose, expectation }
	}
	return { argsText: argsText(args), purpose, expectation }
}

export type ChatMessageView = {
	id: string
	role: 'user' | 'assistant'
	text: string
	tools: ChatToolView[]
	aborted?: boolean
}

export type ConversationView = {
	conversationId: string
	thread: string
	assistant: string
	title: string
	messageCount: number
	updatedAt: string
	updatedText: string
}

type Broadcast = (frame: Record<string, unknown>) => void

function clip(text: string, max: number): string {
	return text.length > max ? text.slice(0, max) + `… [${text.length - max} more chars]` : text
}

/** Tool arguments as pretty JSON. Pure. */
export function argsText(args: unknown): string {
	let value = args
	if (typeof args === 'string') {
		try { value = JSON.parse(args) } catch { return clip(args, MAX_ARGS_TEXT) }
	}
	if (value === undefined || value === null) return ''
	if (typeof value === 'object' && Object.keys(value as object).length === 0) return '{}'
	try { return clip(JSON.stringify(value, null, 2), MAX_ARGS_TEXT) } catch { return String(value) }
}

/** A tool's result as text: JSON pretty printed. Pure. */
export function resultText(result: unknown): string {
	if (result === undefined || result === null) return ''
	if (typeof result === 'string') {
		try { return clip(JSON.stringify(JSON.parse(result), null, 2), MAX_TOOL_TEXT) } catch { return clip(result, MAX_TOOL_TEXT) }
	}
	try { return clip(JSON.stringify(result, null, 2), MAX_TOOL_TEXT) } catch { return String(result) }
}

/** True when a tool's result says it failed (`{"error": …}`). Pure. */
export function resultFailed(result: unknown): boolean {
	if (typeof result !== 'string') return !!(result && typeof result === 'object' && 'error' in (result as any))
	try { const v = JSON.parse(result); return !!(v && typeof v === 'object' && !Array.isArray(v) && 'error' in v) } catch { return false }
}

function contentText(content: unknown): string {
	if (typeof content === 'string') return content
	if (Array.isArray(content)) return content.map((p: any) => (p?.type === 'text' ? p.text : p?.type === 'image_url' ? '[image]' : '')).join('')
	return ''
}

/**
 * Saved messages as the chat draws them: user messages, and one assistant
 * message per turn with its tool calls and their results (an assistant
 * message, its tool results, then the next assistant message are one turn).
 * System messages are left out. Pure.
 */
export function messagesView(messages: any[]): ChatMessageView[] {
	const out: ChatMessageView[] = []
	const byCallId = new Map<string, ChatToolView>()
	let n = 0
	const current = (): ChatMessageView => {
		const last = out[out.length - 1]
		if (last && last.role === 'assistant') return last
		const fresh: ChatMessageView = { id: `m${n++}`, role: 'assistant', text: '', tools: [] }
		out.push(fresh)
		return fresh
	}
	for (const m of messages || []) {
		if (!m || m.role === 'system' || m.role === 'developer') continue
		if (m.role === 'user') {
			out.push({ id: `m${n++}`, role: 'user', text: contentText(m.content), tools: [] })
			continue
		}
		if (m.role === 'assistant') {
			const turn = current()
			const text = contentText(m.content)
			if (text) turn.text = turn.text ? `${turn.text}\n\n${text}` : text
			for (const call of m.tool_calls || []) {
				const tool: ChatToolView = {
					id: String(call.id || `t${n++}`),
					name: String(call.function?.name || call.name || 'tool'),
					...toolView(String(call.function?.name || call.name || 'tool'), call.function?.arguments ?? call.arguments),
					status: 'done',
					resultText: null,
					ms: null,
				}
				turn.tools.push(tool)
				byCallId.set(tool.id, tool)
			}
			continue
		}
		if (m.role === 'tool') {
			const tool = byCallId.get(String(m.tool_call_id || ''))
			if (tool) {
				tool.resultText = resultText(m.content)
				if (resultFailed(m.content)) tool.status = 'failed'
			}
		}
	}
	return out.filter((m) => m.role === 'user' || m.text || m.tools.length)
}

export function shortTime(iso: string | undefined, now = new Date()): string {
	if (!iso) return ''
	const d = new Date(iso)
	if (Number.isNaN(d.getTime())) return ''
	const hm = d.toTimeString().slice(0, 5)
	if (d.toDateString() === now.toDateString()) return `today ${hm}`
	const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
	const sameYear = d.getFullYear() === now.getFullYear()
	return `${months[d.getMonth()]} ${d.getDate()}${sameYear ? '' : ` ${d.getFullYear()}`} ${hm}`
}

export const EFFORTS = ['minimal', 'low', 'medium', 'high', 'xhigh'] as const

/** One conversation's own routing. Empty fields fall back to the assistant's. */
export type ChatSettings = { provider?: string; model?: string; reasoningEffort?: (typeof EFFORTS)[number] }

/**
 * A settings patch as the app sends it, merged over `current`. An empty
 * string clears a field; a missing one keeps it. A provider change with no
 * model clears the model, since it was tied to the old provider. Throws on
 * an effort that is not one of EFFORTS. Pure.
 */
export function mergeSettings(current: ChatSettings, patch: any): ChatSettings {
	const next: ChatSettings = { ...current }
	const text = (v: unknown) => (typeof v === 'string' ? v.trim() : undefined)
	const provider = text(patch?.provider)
	const model = text(patch?.model)
	const effort = text(patch?.reasoningEffort)
	if (provider !== undefined) {
		if (provider !== (current.provider ?? '') && model === undefined) delete next.model
		if (provider) next.provider = provider
		else delete next.provider
	}
	if (model !== undefined) {
		if (model) next.model = model
		else delete next.model
	}
	if (effort !== undefined) {
		if (!effort) delete next.reasoningEffort
		else if ((EFFORTS as readonly string[]).includes(effort)) next.reasoningEffort = effort as ChatSettings['reasoningEffort']
		else throw new Error(`reasoningEffort is one of ${EFFORTS.join(', ')}, or empty for the model default`)
	}
	return next
}

/** Settings read back from the store; anything odd is dropped. Pure. */
export function parseSettings(value: any): ChatSettings {
	try { return mergeSettings({}, value ?? {}) } catch { return mergeSettings({}, { ...value, reasoningEffort: '' }) }
}

/** `provider · model`, each once. Pure. */
export function modelText(provider?: string | null, model?: string | null): string {
	return [...new Set([provider, model].filter(Boolean))].join(' · ')
}

/** A conversation as a markdown file: title, who, then each message with its tool calls. Pure. */
export function transcriptMarkdown(title: string, assistant: string, messages: ChatMessageView[], at = new Date()): string {
	const out = [`# ${title}`, '', `A chat with **${assistant}**, exported ${at.toISOString().slice(0, 16).replace('T', ' ')}.`, '']
	for (const m of messages) {
		out.push(m.role === 'user' ? '## You' : `## ${assistant}`, '')
		for (const t of m.tools) {
			out.push(`<details><summary>${t.name} · ${t.status}${t.purpose ? ` · ${t.purpose}` : ''}</summary>`, '')
			if (t.purpose) out.push(`**Purpose:** ${t.purpose}`, '')
			if (t.expectation) out.push(`**Expected:** ${t.expectation}`, '')
			if (t.argsText && t.argsText !== '{}') out.push(t.name === 'evalCode' ? '```ts' : '```json', t.argsText, '```', '')
			if (t.resultText) out.push('```', t.resultText, '```', '')
			out.push('</details>', '')
		}
		if (m.text) out.push(m.text, '')
		if (m.aborted) out.push('_(stopped)_', '')
	}
	return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n'
}

/** A safe file name for an export. Pure. */
export function exportFilename(title: string, conversationId: string): string {
	const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
	return `${slug || 'chat'}-${conversationId}.md`
}

export type ModelChoice = { provider: string; model: string; title: string; detail: string; ready: boolean }

/** Models a provider is known to take, for providers that list none themselves. */
const KNOWN_MODELS: Record<string, string[]> = {
	openai: ['gpt-5.4-mini', 'gpt-5.4'],
	'openai-responses': ['gpt-5.4-mini', 'gpt-5.4'],
	'claude-code': ['opus', 'sonnet', 'haiku'],
}

/** Which coding agent check stands for a provider id. */
const AGENT_FOR: Record<string, string> = { 'claude-code': 'claude', codex: 'codex', 'openai-codex': 'codex' }

/**
 * The model picker's rows, from the AI view: per provider its default
 * model, then each model a found server or `KNOWN_MODELS` names. Providers
 * that cannot answer are left out, except the one in use. Ready ones
 * first. Pure.
 */
export function modelChoices(ai: { providers: any[]; servers: any[]; agents: any[] }, current: { provider?: string | null }): ModelChoice[] {
	const rows: Array<ModelChoice & { rank: number }> = []
	for (const p of ai.providers || []) {
		const id = String(p.id)
		const agent = AGENT_FOR[id] ? (ai.agents || []).find((a: any) => a.id === AGENT_FOR[id]) : undefined
		const ready = agent ? !!agent.available : p.status === 'ready' || p.status === 'login'
		if (!ready && id !== current.provider && !agent) continue
		if (agent && !agent.available && id !== current.provider) continue
		const status = agent ? (agent.available ? 'coding agent' : 'not installed') : String(p.statusText || p.status || '')
		const label = String(p.label || id)
		const rank = p.isDefault ? 0 : ready ? 1 : 2
		rows.push({ provider: id, model: '', title: `${label} · ${p.model ? p.model : 'its default model'}`, detail: status, ready, rank })
		const served = (ai.servers || []).filter((s: any) => s.profileId === id).flatMap((s: any) => s.models || [])
		for (const model of [...new Set([...(KNOWN_MODELS[id] ?? []), ...served])]) {
			if (model === p.model) continue
			rows.push({ provider: id, model: String(model), title: `${label} · ${model}`, detail: status, ready, rank })
		}
	}
	return rows.sort((a, b) => a.rank - b.rank).map(({ rank, ...row }) => row)
}

type Stored = { extensions: ChatExtension[]; target?: ChatTarget; about?: ChatAbout; settings?: ChatSettings }

/**
 * What a chat is about. An assistant: it gets the editor's brief and tools
 * for that one. A helper: it gets the inspector's brief (docs, source).
 */
export type ChatAbout = { assistant?: string; helper?: { registry: string; id: string } }

/** `about` as sent or stored, or undefined when it names nothing. Pure. */
export function parseAbout(raw: any): ChatAbout | undefined {
	const assistant = typeof raw?.assistant === 'string' && raw.assistant ? raw.assistant : undefined
	const h = raw?.helper
	const helper = typeof h?.registry === 'string' && typeof h?.id === 'string' && h.registry && h.id ? { registry: h.registry, id: h.id } : undefined
	if (!assistant && !helper) return undefined
	return { ...(assistant ? { assistant } : {}), ...(helper ? { helper } : {}) }
}

/** Two `about`s name the same things. Pure. */
export function sameAbout(a: ChatAbout | undefined, b: ChatAbout | undefined): boolean {
	return (a?.assistant ?? null) === (b?.assistant ?? null)
		&& (a?.helper?.registry ?? null) === (b?.helper?.registry ?? null)
		&& (a?.helper?.id ?? null) === (b?.helper?.id ?? null)
}

type Turn = { turnId: string; text: string; reasoning: string; tools: ChatToolView[]; startedAt: number; user: string }

/** Two host tool bundles as one, or null when there is nothing. The later one's names win. */
export function mergeBundles(...bundles: Array<ToolBundle | null>): ToolBundle | null {
	const present = bundles.filter((b): b is ToolBundle => !!b)
	if (!present.length) return null
	if (present.length === 1) return present[0]!
	return {
		schemas: Object.assign({}, ...present.map((b) => b.schemas)),
		handlers: Object.assign({}, ...present.map((b) => b.handlers)),
		provider: { name: 'workbench.host' },
	}
}

type Session = {
	assistant: string
	conversationId: string
	thread: string
	instance: any
	turn: Turn | null
	starting: Promise<void>
	/** The chat this one is tech support for, when it was opened as that. */
	target: ChatTarget | null
	/** The assistant this chat builds, when it was opened about one. */
	about: ChatAbout | null
	/** Host tools that are not the canvas: the support tools of a tech support chat, the editor tools of a chat about an assistant. */
	support: ToolBundle | null
	/** The extensions the last mount put on. */
	extensions: ChatExtension[]
	/** Tool names the last mount added, so the next one can take them off. */
	mounted: string[]
	/** On a coding agent: the tools it reaches over `/mcp/chat/<token>`. */
	agent: boolean
	token: string
	served: ToolBundle
	mcp?: { signature: string; handle: Promise<(req: any, res: any, body?: any) => Promise<void>> }
	/** This conversation's own provider, model and effort, over the assistant's. */
	settings: ChatSettings
	/** A name given with rename; null shows the first message. */
	title: string | null
}

export class ChatSessions {
	private sessions = new Map<string, Session>()
	private infos = new Map<string, any>()
	private discovered: Promise<any> | null = null
	/** Tools the host gives every chat assistant (the canvas tools). */
	extraTools?: (conversationId: string) => { schemas: Record<string, any>; handlers: Record<string, (...args: any[]) => any> }
	/** The same tools as MCP servers, for an assistant that runs on a coding agent (Claude Code, Codex). */
	agentMcpServers?: (conversationId: string) => Record<string, any>
	/** The URL of a session's own MCP route, `/mcp/chat/<token>` on the host. */
	chatMcpUrl?: (token: string) => string
	/** Entries added to the assistants view that are not the manager's (the guides). */
	extraAssistants?: (firstSlot: number) => any[]
	/** The assistant editor: a chat about an assistant gets its brief and tools. */
	editor?: { brief(name: string, self: boolean): Promise<string>; tools(name: string): ToolBundle }
	/** The inspector: a chat about a helper gets its brief (docs, source, how to work). */
	helperBrief?: (registry: string, id: string) => Promise<string>
	readonly extensionsIndex: ChatExtensions

	constructor(private container: any, private broadcast: Broadcast) {
		this.extensionsIndex = new ChatExtensions(container)
	}

	async manager(): Promise<any> {
		const manager = this.container.feature('assistantsManager')
		this.discovered ??= manager.discover()
		await this.discovered
		return manager
	}

	get history(): any {
		return this.container.feature('conversationHistory')
	}

	/** Where history is kept: the diskCache folder for this project (`XDG_CACHE_HOME` moves it). */
	get historyDir(): string {
		const os = this.container.feature('os')
		const path = this.container.paths.resolve(os.cacheDir, `disk-cache-${this.container.utils.hashObject(this.container.cwd)}`)
		const home = String(os.homedir)
		return path.startsWith(home + '/') ? '~' + path.slice(home.length) : path
	}

	private key(assistant: string, conversationId: string) {
		return `${assistant}|${conversationId}`
	}

	/** An instance only for reading facts (tools, routing). Never asked anything. */
	private info(manager: any, name: string): any {
		let a = this.infos.get(name)
		if (!a) {
			a = manager.create(name, { cached: false, historyMode: 'lifecycle' })
			this.infos.set(name, a)
		}
		return a
	}

	/** The fact-reading instance for the editor, or null when the assistant does not load. The manager must have discovered already. */
	infoInstance(name: string): any | null {
		const manager = this.container.feature('assistantsManager')
		if (!manager.list().some((e: any) => e.name === name)) return null
		try { return this.info(manager, name) } catch { return null }
	}

	/** The assistant's files changed: every live instance loads them again, and the facts are read anew. */
	reloadAssistant(name: string) {
		this.infos.delete(name)
		for (const s of this.sessions.values()) {
			if (s.assistant !== name) continue
			try { s.instance.reload() } catch (err: any) { console.error(`[workbench] could not reload ${name} in ${s.conversationId}: ${err?.message}`) }
		}
	}

	async conversations(name: string, limit = 50): Promise<ConversationView[]> {
		const manager = await this.manager()
		const prefix: string = manager.threadPrefixFor(name)
		const metas: any[] = await this.history.findByThreadPrefix(prefix)
		return metas
			.map((m) => ({
				conversationId: String(m.thread).slice(prefix.length),
				thread: String(m.thread),
				assistant: name,
				title: String(m.title || 'Untitled'),
				messageCount: Number(m.messageCount || 0),
				updatedAt: String(m.updatedAt || ''),
				updatedText: shortTime(m.updatedAt),
			}))
			.filter((c) => c.conversationId)
			.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
			.slice(0, limit)
	}

	async assistantsView() {
		const manager = await this.manager()
		const entries: any[] = manager.list()
		const assistants = []
		const recent: ConversationView[] = []
		for (const [slot, entry] of entries.entries()) {
			let tools: string[] = []
			let model: string | null = entry.meta?.model ?? null
			let provider: string | null = entry.meta?.provider ?? null
			let error: string | null = null
			try {
				const a = this.info(manager, entry.name)
				tools = Object.keys(a.tools || {})
				try {
					const r = a.routing
					model = r?.model ?? model
					provider = r?.provider ?? provider
				} catch {}
			} catch (err: any) {
				error = String(err?.message ?? err)
			}
			const conversations = await this.conversations(entry.name, 1000).catch(() => [] as ConversationView[])
			recent.push(...conversations.slice(0, 10))
			const about = typeof entry.about === 'string' ? entry.about.replace(/^#.*$/gm, '').trim().split(/\n\s*\n/)[0]?.trim() : ''
			assistants.push({
				id: entry.name,
				name: entry.name,
				description: String(entry.meta?.description || about || ''),
				model,
				provider,
				modelText: [provider, model].filter(Boolean).join(' · ') || 'default model',
				toolCount: tools.length,
				tools,
				source: entry.source,
				folder: entry.folder || '',
				folderDisplay: entry.folder ? this.tilde(entry.folder) : '',
				conversationCount: conversations.length,
				lastText: conversations[0]?.updatedText ?? '',
				slot,
				error,
			})
		}
		recent.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))
		try { assistants.push(...(this.extraAssistants?.(assistants.length) ?? [])) } catch (err: any) { console.error(`[workbench] could not list the guides: ${err?.message}`) }
		return {
			notice: assistants.length ? null : 'This project has no assistants. An assistant is a folder with a CORE.md under assistants/.',
			historyDir: this.historyDir,
			assistants,
			recent: recent.slice(0, 30),
		}
	}

	private tilde(path: string): string {
		const home = String(this.container.feature('os').homedir)
		return path.startsWith(home + '/') ? '~' + path.slice(home.length) : path
	}

	/**
	 * The live session for a conversation, started (history loaded) on first
	 * use. `target` makes it the tech support chat of another conversation;
	 * the link is saved, so a reopen after a restart keeps it.
	 */
	private async session(name: string, conversationId: string, target?: ChatTarget | null, about?: ChatAbout | null): Promise<Session> {
		const key = this.key(name, conversationId)
		let s = this.sessions.get(key)
		if (!s) {
			const manager = await this.manager()
			const thread = manager.threadPrefixFor(name) + conversationId
			let store = await this.stored(thread)
			if (target && (target.assistant !== store.target?.assistant || target.conversationId !== store.target?.conversationId)) {
				store = { ...store, target }
				await this.store(thread, store)
			}
			if (about && !sameAbout(about, store.about)) {
				store = { ...store, about }
				await this.store(thread, store)
			}
			const linked = target ?? store.target ?? null
			const aboutNow = about ?? store.about ?? null
			const building = this.editor && aboutNow?.assistant ? { assistant: aboutNow.assistant } : null
			const inspecting = this.helperBrief && aboutNow?.helper ? aboutNow.helper : null
			const settings = store.settings ?? {}
			const instance = manager.create(name, {
				cached: false,
				historyMode: 'session',
				...(settings.provider ? { provider: settings.provider } : {}),
				...(settings.model ? { model: settings.model } : {}),
			})
			if (this.extraTools) {
				try { instance.use(this.extraTools(conversationId)) } catch (err: any) { console.error(`[workbench] could not give ${name} the host's tools: ${err?.message}`) }
			}
			const support = mergeBundles(
				linked ? this.extensionsIndex.supportTools(linked, this.supportHost()) : null,
				building ? this.editor!.tools(building.assistant) : null,
			)
			const agent = this.isAgent(instance)
			const token = String(this.container.utils.uuid()).replace(/-/g, '')
			this.giveAgentServers(instance, agent ? token : null, conversationId)
			if (support && !agent) instance.use(support)
			if (linked) instance.addSystemPromptExtension('workbenchTechSupport', ChatExtensions.brief(linked))
			if (building) {
				try { instance.addSystemPromptExtension('workbenchAssistantEditor', await this.editor!.brief(building.assistant, building.assistant === name)) }
				catch (err: any) { console.error(`[workbench] could not brief ${name} about ${building.assistant}: ${err?.message}`) }
			}
			if (inspecting) {
				try { instance.addSystemPromptExtension('workbenchHelper', await this.helperBrief!(inspecting.registry, inspecting.id)) }
				catch (err: any) { console.error(`[workbench] could not brief ${name} about ${inspecting.registry}.${inspecting.id}: ${err?.message}`) }
			}
			instance.resumeThread(thread)
			const session: Session = {
				assistant: name, conversationId, thread, instance, turn: null, starting: Promise.resolve(),
				target: linked, about: building || inspecting ? { ...(building ?? {}), ...(inspecting ? { helper: inspecting } : {}) } : null,
				support, extensions: [], mounted: [], agent, token, served: { schemas: {}, handlers: {} },
				settings, title: null,
			}
			session.starting = instance.start().then(async () => {
				this.applyEffort(session)
				session.title = await this.savedTitle(thread)
				await this.mount(session)
				if (building || inspecting) await this.ensureSkill(session, 'luca-framework')
			})
			this.wire(session)
			this.sessions.set(key, session)
			s = session
		}
		await s.starting
		return s
	}

	/**
	 * A chat about an assistant works with the framework: make sure the
	 * `luca-framework` skill is in the prompt. An assistant that preloads it
	 * (lucaArchitect) has it already; one with a skills library loads it here;
	 * one with neither goes without.
	 */
	private async ensureSkill(s: Session, skill: string) {
		const a = s.instance
		try {
			if (a.systemPromptExtensions?.[`skill:${skill}`]) return
			const load = a.tools?.loadSkill?.handler
			if (typeof load !== 'function') return
			const content = await load({ skillName: skill })
			if (typeof content !== 'string' || !content.trim() || /^(error|no skill|unknown skill)/i.test(content.trim())) return
			a.addSystemPromptExtension(`skill:${skill}`, [`## Skill: ${skill}`, 'This skill is already loaded. Treat it as active context; do not call `loadSkill` for it.', '', content].join('\n'))
		} catch (err: any) {
			console.error(`[workbench] could not load the ${skill} skill for ${s.assistant}: ${err?.message}`)
		}
	}

	/**
	 * A coding agent runs its own loop and never sees tools added in this
	 * process. When the assistant runs on one (configured, or the machine
	 * default), hand it the host's tools as MCP servers instead.
	 */
	private giveAgentServers(instance: any, token: string | null, conversationId: string) {
		if (!token) return
		try {
			const current = instance.effectiveOptions?.providerOptions ?? {}
			const own = this.chatMcpUrl ? { 'luca-chat': { type: 'http', url: this.chatMcpUrl(token), headers: { Authorization: `Bearer ${token}` } } } : {}
			instance.options.providerOptions = { ...current, mcpServers: { ...(current.mcpServers ?? {}), ...(this.agentMcpServers?.(conversationId) ?? {}), ...own } }
		} catch (err: any) {
			console.error(`[workbench] could not give ${instance?.name} the host's MCP servers: ${err?.message}`)
		}
	}

	/** True when the assistant runs on a coding agent (configured, or the machine default). */
	private isAgent(instance: any): boolean {
		try {
			const mp = this.container.feature('modelProviders')
			const configured = instance.effectiveOptions?.provider
			const id = typeof configured === 'string' ? configured : configured ? undefined : mp.resolveDefaultId()
			return !!mp.isAgentProvider(id)
		} catch {
			return false
		}
	}

	// --- Extensions ---

	private storeKey(thread: string) {
		return `workbench-chat:${thread}`
	}

	/** What the host keeps for one conversation: its extensions and the chat it supports. */
	private async stored(thread: string): Promise<Stored> {
		try {
			const cache = this.history.diskCache
			if (!(await cache.has(this.storeKey(thread)))) return { extensions: [] }
			const value = await cache.get(this.storeKey(thread), true)
			let extensions: ChatExtension[] = []
			try { extensions = parseExtensions(value?.extensions) } catch {}
			const target = value?.target?.assistant && value?.target?.conversationId ? { assistant: String(value.target.assistant), conversationId: String(value.target.conversationId) } : undefined
			const about = parseAbout(value?.about)
			const settings = parseSettings(value?.settings)
			return { extensions, ...(target ? { target } : {}), ...(about ? { about } : {}), ...(Object.keys(settings).length ? { settings } : {}) }
		} catch {
			return { extensions: [] }
		}
	}

	private async store(thread: string, value: Stored) {
		await this.history.diskCache.set(this.storeKey(thread), value)
	}

	private async threadOf(target: ChatTarget): Promise<string> {
		return (await this.manager()).threadPrefixFor(target.assistant) + target.conversationId
	}

	/** A conversation's extensions, open or not. */
	async extensions(target: ChatTarget): Promise<ChatExtension[]> {
		return (await this.stored(await this.threadOf(target))).extensions
	}

	/**
	 * Replace a conversation's extensions. Each entry must build, so a bad
	 * one is refused here, not at the next turn. The open session picks the
	 * list up at once and the app hears a `chat-extensions` frame.
	 */
	async setExtensions(target: ChatTarget, value: unknown): Promise<ChatExtension[]> {
		const list = parseExtensions(value)
		for (const entry of list) await this.extensionsIndex.bundle(entry)
		const thread = await this.threadOf(target)
		const stored = await this.stored(thread)
		await this.store(thread, { ...stored, extensions: list })
		const s = this.sessions.get(this.key(target.assistant, target.conversationId))
		if (s && !s.turn) await this.mount(s, list)
		this.broadcast({ type: 'chat-extensions', assistant: target.assistant, conversationId: target.conversationId, extensions: list.map(summary), at: Date.now() })
		return list
	}

	/** The tools a conversation's assistant has on its own: not the ones the extensions added. */
	async toolNames(target: ChatTarget): Promise<string[]> {
		const s = this.sessions.get(this.key(target.assistant, target.conversationId))
		if (s) return Object.keys(s.instance.tools || {}).filter((name) => !s.mounted.includes(name))
		const manager = await this.manager()
		try { return Object.keys(this.info(manager, target.assistant).tools || {}) } catch { return [] }
	}

	/** The picker's list: features with tools, and what the conversation has. */
	async extensionsView(target: ChatTarget) {
		const has = await this.toolNames(target)
		return { features: this.extensionsIndex.available(has), extensions: await this.extensions(target) }
	}

	private supportHost() {
		return {
			extensions: (t: ChatTarget) => this.extensions(t),
			setExtensions: (t: ChatTarget, list: ChatExtension[]) => this.setExtensions(t, list),
			toolNames: (t: ChatTarget) => this.toolNames(t),
		}
	}

	/**
	 * Put the conversation's extensions on its assistant: the last mount's
	 * tools come off first. A coding agent gets them (and the support tools)
	 * over its MCP route instead, rebuilt when the tool names change.
	 */
	private async mount(s: Session, list?: ChatExtension[]) {
		const a = s.instance
		try {
			const entries = list ?? (await this.stored(s.thread)).extensions
			s.extensions = entries
			for (const name of s.mounted) a.removeTool(name)
			s.mounted = []
			const has = new Set(Object.keys(a.tools || {}))
			const built = await this.extensionsIndex.build(entries, has)
			if (built.lines.length) a.addSystemPromptExtension(PROMPT_KEY, ChatExtensions.prompt(built.lines))
			else a.removeSystemPromptExtension(PROMPT_KEY)
			if (s.agent) {
				s.served = {
					schemas: { ...(s.support?.schemas ?? {}), ...built.tools.schemas },
					handlers: { ...(s.support?.handlers ?? {}), ...built.tools.handlers },
				}
				return
			}
			const names = Object.keys(built.tools.schemas)
			if (!names.length) return
			a.use({ ...built.tools, provider: { name: 'workbench.chatExtensions' } })
			for (const setup of built.setups) { try { setup(a) } catch {} }
			s.mounted = names
		} catch (err: any) {
			console.error(`[workbench] could not mount ${s.assistant}'s extensions: ${err?.message ?? err}`)
		}
	}

	/** The session a `/mcp/chat/<token>` request belongs to. */
	sessionForToken(token: string): Session | undefined {
		if (!token) return undefined
		for (const s of this.sessions.values()) if (s.agent && s.token === token) return s
		return undefined
	}

	/**
	 * A session's tools as an MCP server over streamable HTTP. The server is
	 * built again when the tool names change; each agent turn lists them anew.
	 * Calls are announced on the assistant, so the chat draws them as cards.
	 */
	mcpHandler(s: Session, lucaVersion: string): Promise<(req: any, res: any, body?: any) => Promise<void>> {
		const signature = Object.keys(s.served.schemas).sort().join(',')
		if (s.mcp?.signature === signature) return s.mcp.handle
		const handle = (async () => {
			const mcp = this.container.server('mcp', { serverName: 'luca-chat', serverVersion: lucaVersion })
			for (const [name, schema] of Object.entries(s.served.schemas)) {
				mcp.tool(name, {
					description: (schema as any).description || name,
					schema: schema as any,
					handler: async (args: any) => {
						s.instance.emit('toolCall', name, args)
						try {
							const result = await s.served.handlers[name]!(args)
							s.instance.emit('toolResult', name, result)
							return typeof result === 'string' ? result : JSON.stringify(result)
						} catch (err) {
							s.instance.emit('toolError', name, err)
							throw err
						}
					},
				})
			}
			return mcp.requestHandler()
		})()
		s.mcp = { signature, handle }
		return handle
	}

	private frame(s: Session, type: string, extra: Record<string, unknown>) {
		this.broadcast({ type, assistant: s.assistant, conversationId: s.conversationId, turnId: s.turn?.turnId ?? null, at: Date.now(), ...extra })
	}

	private wire(s: Session) {
		const a = s.instance
		a.on('chunk', (text: string) => {
			if (!s.turn || !text) return
			s.turn.text += text
			this.frame(s, 'chat-delta', { text })
		})
		a.on('reasoning', (text: string) => {
			if (!s.turn || !text) return
			s.turn.reasoning += text
			this.frame(s, 'chat-reasoning', { text })
		})
		a.on('toolCall', (name: string, args: any) => {
			if (!s.turn) return
			const tool: ChatToolView = { id: String(this.container.utils.uuid()).slice(0, 8), name, ...toolView(name, args), status: 'running', resultText: null, ms: null }
			;(tool as any).startedAt = Date.now()
			s.turn.tools.push(tool)
			this.frame(s, 'chat-tool', { tool: this.publicTool(tool) })
		})
		const settle = (name: string, status: 'done' | 'failed', result: unknown) => {
			if (!s.turn) return
			const tool = [...s.turn.tools].reverse().find((t) => t.name === name && t.status === 'running')
			if (!tool) return
			tool.status = status === 'done' && resultFailed(result) ? 'failed' : status
			tool.resultText = resultText(result)
			tool.ms = Date.now() - ((tool as any).startedAt || Date.now())
			this.frame(s, 'chat-tool', { tool: this.publicTool(tool) })
		}
		a.on('toolResult', (name: string, result: any) => settle(name, 'done', result))
		a.on('toolError', (name: string, error: any) => settle(name, 'failed', { error: error?.message || String(error) }))
	}

	private publicTool(t: ChatToolView): ChatToolView {
		const { id, name, argsText, status, resultText, ms, purpose = null, expectation = null } = t
		return { id, name, argsText, status, resultText, ms, purpose, expectation }
	}

	/**
	 * Open (or reopen) a conversation. `conversationId` empty or `new` starts
	 * a fresh one. `target` opens it as the tech support chat of another.
	 */
	async open(name: string, conversationId?: string, target?: ChatTarget | null, about?: ChatAbout | null): Promise<{ status: number; body: any }> {
		const manager = await this.manager()
		if (!manager.list().some((e: any) => e.name === name)) return { status: 404, body: { error: `no assistant ${name}` } }
		if (about?.assistant && !manager.list().some((e: any) => e.name === about.assistant)) return { status: 404, body: { error: `no assistant ${about.assistant} to talk about` } }
		if (about?.helper && !this.hasHelper(about.helper.registry, about.helper.id)) return { status: 404, body: { error: `no helper ${about.helper.registry}.${about.helper.id} to talk about` } }
		const id = conversationId && conversationId !== 'new' ? conversationId : this.freshId()
		if (!/^[\w.-]+$/.test(id)) return { status: 400, body: { error: 'a conversation id is letters, digits, dot, dash and underscore' } }
		let s: Session
		try { s = await this.session(name, id, target, about) } catch (err: any) {
			return { status: 200, body: { ok: false, error: `could not start ${name}: ${err?.message ?? err}` } }
		}
		return { status: 200, body: this.view(s) }
	}

	/** The registry knows the id. */
	private hasHelper(registry: string, id: string): boolean {
		try { return !!this.container[registry]?.has?.(id) } catch { return false }
	}

	private freshId(): string {
		const d = new Date()
		const pad = (n: number) => String(n).padStart(2, '0')
		return `desk-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${String(this.container.utils.uuid()).slice(0, 6)}`
	}

	private view(s: Session) {
		const messages = messagesView(s.instance.messages || [])
		let title = 'New conversation'
		const firstUser = messages.find((m) => m.role === 'user')
		if (firstUser) title = firstUser.text.split('\n')[0]!.slice(0, 80)
		if (s.title) title = s.title
		const routing = this.routingOf(s)
		return {
			ok: true,
			assistant: s.assistant,
			conversationId: s.conversationId,
			thread: s.thread,
			title,
			modelText: modelText(routing.provider, routing.model) || 'default model',
			settings: s.settings,
			routing,
			tools: Object.keys(s.instance.tools || {}).filter((name) => !s.mounted.includes(name)),
			extensions: s.extensions.map(summary),
			target: s.target,
			about: s.about,
			messages,
			busy: !!s.turn,
			live: s.turn ? { turnId: s.turn.turnId, user: s.turn.user, text: s.turn.text, reasoning: s.turn.reasoning, tools: s.turn.tools.map((t) => this.publicTool(t)) } : null,
		}
	}

	/** Start a reply. It streams as frames; the answer only says it started. */
	async send(name: string, conversationId: string, text: string): Promise<{ status: number; body: any }> {
		if (!text.trim()) return { status: 400, body: { error: 'text is required' } }
		const opened = await this.open(name, conversationId)
		if (opened.status !== 200 || opened.body.ok === false) return opened
		const s = this.sessions.get(this.key(name, conversationId))!
		if (s.turn) return { status: 409, body: { error: 'A reply is still coming. Stop it first.' } }
		return this.runTurn(s, text, () => s.instance.ask(text))
	}

	/**
	 * Start a turn: `chat-start` (`text` = the user's message, empty when it
	 * is already in the history), then frames, then `chat-done` or `chat-error`.
	 */
	private runTurn(s: Session, user: string, ask: () => Promise<unknown>): { status: number; body: any } {
		const turnId = String(this.container.utils.uuid()).slice(0, 8)
		s.turn = { turnId, text: '', reasoning: '', tools: [], startedAt: Date.now(), user }
		this.frame(s, 'chat-start', { text: user })
		const turn = s.turn
		void (async () => {
			try {
				// The list may have changed on disk since the last turn (another host, a hand edit).
				await this.mount(s)
				const answer = await ask()
				this.frame(s, 'chat-done', { text: typeof answer === 'string' ? answer : turn.text, aborted: false, ms: Date.now() - turn.startedAt })
			} catch (err: any) {
				if (err?.name === 'ConversationAbortError') {
					this.frame(s, 'chat-done', { text: String(err?.partial ?? turn.text), aborted: true, ms: Date.now() - turn.startedAt })
				} else {
					this.frame(s, 'chat-error', { error: String(err?.message ?? err), ms: Date.now() - turn.startedAt })
				}
			} finally {
				if (s.turn === turn) s.turn = null
			}
		})()
		return { status: 200, body: { ok: true, turnId, conversationId: s.conversationId, assistant: s.assistant } }
	}

	// --- Settings, retry, clear, rename, delete, export ---

	/** Where the next turn goes: provider, model, effort. Read live from the conversation. */
	private routingOf(s: Session): { provider: string; model: string; reasoningEffort: string } {
		let r: any = null
		try { r = s.instance.routing } catch {}
		return { provider: String(r?.provider ?? ''), model: String(r?.model ?? ''), reasoningEffort: String(r?.reasoningEffort ?? '') }
	}

	private applyEffort(s: Session) {
		try { s.instance.conversation.setReasoningEffort(s.settings.reasoningEffort ?? null) } catch (err: any) {
			console.error(`[workbench] could not set ${s.assistant}'s effort: ${err?.message ?? err}`)
		}
	}

	/** A title the user gave (rename). The history's own default is not one. */
	private async savedTitle(thread: string): Promise<string | null> {
		try {
			const record = await this.history.findByThread(thread)
			const title = String(record?.metadata?.workbenchTitle ?? '')
			return title || null
		} catch {
			return null
		}
	}

	/** The open session, for a route that needs one and no turn running. */
	private async idle(name: string, conversationId: string): Promise<{ s?: Session; error?: { status: number; body: any } }> {
		const opened = await this.open(name, conversationId)
		if (opened.status !== 200 || opened.body.ok === false) return { error: opened }
		const s = this.sessions.get(this.key(name, opened.body.conversationId))!
		if (s.turn) return { error: { status: 409, body: { error: 'A reply is still coming. Stop it first.' } } }
		return { s }
	}

	private settingsFrame(s: Session) {
		const routing = this.routingOf(s)
		this.frame(s, 'chat-settings', { settings: s.settings, routing, modelText: modelText(routing.provider, routing.model) || 'default model', title: s.title })
	}

	/**
	 * Change this conversation's provider, model or effort. A new provider or
	 * model builds the assistant again on the same history (the tools a coding
	 * agent gets depend on it); an effort change applies at once. Saved with
	 * the conversation, so a reopen keeps it.
	 */
	async setSettings(name: string, conversationId: string, patch: any): Promise<{ status: number; body: any }> {
		const { s, error } = await this.idle(name, conversationId)
		if (!s) return error!
		let next: ChatSettings
		try { next = mergeSettings(s.settings, patch) } catch (err: any) { return { status: 400, body: { ok: false, error: err.message } } }
		if (next.provider) {
			const mp = this.container.feature('modelProviders')
			if (!mp.get(next.provider)) return { status: 400, body: { ok: false, error: `no model provider ${next.provider}. Known: ${Object.keys(mp.profiles ?? {}).join(', ')}` } }
		}
		const stored = await this.stored(s.thread)
		await this.store(s.thread, { ...stored, settings: next })
		let current = s
		if ((next.provider ?? '') !== (s.settings.provider ?? '') || (next.model ?? '') !== (s.settings.model ?? '')) {
			this.sessions.delete(this.key(s.assistant, s.conversationId))
			try { s.instance.removeAllListeners?.() } catch {}
			try { current = await this.session(s.assistant, s.conversationId) } catch (err: any) {
				await this.store(s.thread, stored)
				this.sessions.delete(this.key(s.assistant, s.conversationId))
				return { status: 200, body: { ok: false, error: `could not switch: ${err?.message ?? err}` } }
			}
		} else {
			s.settings = next
			this.applyEffort(s)
		}
		this.settingsFrame(current)
		return { status: 200, body: this.view(current) }
	}

	/** The model picker: this chat's choice, the assistant's own, and every model that can answer. */
	async modelsView(name: string, conversationId: string, ai: { providers: any[]; servers: any[]; agents: any[] }) {
		const opened = await this.open(name, conversationId)
		if (opened.status !== 200 || opened.body.ok === false) return opened
		const s = this.sessions.get(this.key(name, opened.body.conversationId))!
		const manager = await this.manager()
		let own = { provider: '', model: '' }
		try { const r = this.info(manager, name).routing; own = { provider: String(r?.provider ?? ''), model: String(r?.model ?? '') } } catch {}
		const routing = this.routingOf(s)
		return {
			status: 200,
			body: {
				settings: s.settings,
				routing,
				own: { ...own, text: modelText(own.provider, own.model) || 'default model' },
				efforts: [...EFFORTS],
				choices: modelChoices(ai, { provider: routing.provider }),
			},
		}
	}

	/**
	 * Run the last turn again. A failed turn reruns its input (it is still in
	 * the history); otherwise the last user message and the reply after it are
	 * taken out and the message is sent again. `chat-history` comes first, so
	 * the app drops what was taken out.
	 */
	async retry(name: string, conversationId: string): Promise<{ status: number; body: any }> {
		const { s, error } = await this.idle(name, conversationId)
		if (!s) return error!
		const failed = s.instance.failedTurn
		if (failed?.retryable) {
			this.frame(s, 'chat-history', { messages: messagesView(s.instance.messages || []) })
			return this.runTurn(s, '', () => s.instance.retryFailedTurn({ expectId: failed.id }))
		}
		const messages: any[] = s.instance.messages || []
		const at = messages.map((m) => m?.role).lastIndexOf('user')
		if (at < 0) return { status: 400, body: { ok: false, error: 'Nothing to retry yet' } }
		const text = messages[at].content
		const kept = messages.slice(0, at)
		// clearMessages drops the provider's continuation handles; the kept part goes back after.
		s.instance.clearMessages()
		s.instance.conversation._setMessages(kept)
		this.frame(s, 'chat-history', { messages: messagesView(kept) })
		const shown = typeof text === 'string' ? text : messagesView([{ role: 'user', content: text }])[0]?.text ?? ''
		return this.runTurn(s, shown, () => s.instance.ask(text))
	}

	/** Wipe the transcript; the conversation keeps its id, tools and settings. */
	async clear(name: string, conversationId: string): Promise<{ status: number; body: any }> {
		const { s, error } = await this.idle(name, conversationId)
		if (!s) return error!
		s.instance.clearMessages()
		try { if (await this.history.findByThread(s.thread)) await s.instance.save({ thread: s.thread }) } catch {}
		this.frame(s, 'chat-history', { messages: [] })
		return { status: 200, body: this.view(s) }
	}

	/** Name the conversation. Kept in its history record, so the list shows it too. */
	async rename(name: string, conversationId: string, title: string): Promise<{ status: number; body: any }> {
		const clean = String(title ?? '').trim().slice(0, 120)
		if (!clean) return { status: 400, body: { ok: false, error: 'title is required' } }
		const { s, error } = await this.idle(name, conversationId)
		if (!s) return error!
		const record = await this.history.findByThread(s.thread)
		if (!record) return { status: 200, body: { ok: false, error: 'Send a message first: a new chat has nothing saved to name.' } }
		await this.history.updateMeta(record.id, { title: clean, metadata: { ...(record.metadata ?? {}), workbenchTitle: clean } })
		s.title = clean
		this.settingsFrame(s)
		return { status: 200, body: this.view(s) }
	}

	/** Delete the conversation's history and what the host kept for it. */
	async remove(name: string, conversationId: string): Promise<{ status: number; body: any }> {
		const { s, error } = await this.idle(name, conversationId)
		if (!s) return error!
		const deleted = await this.history.deleteThread(s.thread)
		try { await this.history.diskCache.rm(this.storeKey(s.thread)) } catch {}
		this.sessions.delete(this.key(s.assistant, s.conversationId))
		this.frame(s, 'chat-deleted', {})
		return { status: 200, body: { ok: true, deleted } }
	}

	/** The conversation as markdown, for the app to copy or save. */
	async exportView(name: string, conversationId: string): Promise<{ status: number; body: any }> {
		const opened = await this.open(name, conversationId)
		if (opened.status !== 200 || opened.body.ok === false) return opened
		const v = opened.body
		return {
			status: 200,
			body: { title: v.title, filename: exportFilename(v.title, v.conversationId), markdown: transcriptMarkdown(v.title, name, v.messages) },
		}
	}

	stop(name: string, conversationId: string): boolean {
		const s = this.sessions.get(this.key(name, conversationId))
		if (!s?.turn) return false
		try { s.instance.abort() } catch {}
		return true
	}

	closeAll() {
		for (const s of this.sessions.values()) {
			try { if (s.turn) s.instance.abort() } catch {}
		}
		this.sessions.clear()
	}
}
