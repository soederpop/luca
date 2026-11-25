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
					argsText: argsText(call.function?.arguments ?? call.arguments),
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

type Turn = { turnId: string; text: string; tools: ChatToolView[]; startedAt: number; user: string }

type Session = {
	assistant: string
	conversationId: string
	thread: string
	instance: any
	turn: Turn | null
	starting: Promise<void>
	/** The chat this one is tech support for, when it was opened as that. */
	target: ChatTarget | null
	/** Host tools that are not the canvas: the support tools of a tech support chat. */
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
}

export class ChatSessions {
	private sessions = new Map<string, Session>()
	private infos = new Map<string, any>()
	private discovered: Promise<any> | null = null
	/** Tools the host gives every chat assistant (the canvas tools). */
	extraTools?: () => { schemas: Record<string, any>; handlers: Record<string, (...args: any[]) => any> }
	/** The same tools as MCP servers, for an assistant that runs on a coding agent (Claude Code, Codex). */
	agentMcpServers?: () => Record<string, any>
	/** The URL of a session's own MCP route, `/mcp/chat/<token>` on the host. */
	chatMcpUrl?: (token: string) => string
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
	private async session(name: string, conversationId: string, target?: ChatTarget | null): Promise<Session> {
		const key = this.key(name, conversationId)
		let s = this.sessions.get(key)
		if (!s) {
			const manager = await this.manager()
			const thread = manager.threadPrefixFor(name) + conversationId
			const store = await this.stored(thread)
			if (target && (target.assistant !== store.target?.assistant || target.conversationId !== store.target?.conversationId)) {
				await this.store(thread, { ...store, target })
			}
			const linked = target ?? store.target ?? null
			const instance = manager.create(name, { cached: false, historyMode: 'session' })
			if (this.extraTools) {
				try { instance.use(this.extraTools()) } catch (err: any) { console.error(`[workbench] could not give ${name} the host's tools: ${err?.message}`) }
			}
			const support = linked ? this.extensionsIndex.supportTools(linked, this.supportHost()) : null
			const agent = this.isAgent(instance)
			const token = String(this.container.utils.uuid()).replace(/-/g, '')
			this.giveAgentServers(instance, agent ? token : null)
			if (support && !agent) instance.use(support)
			if (linked) instance.addSystemPromptExtension('workbenchTechSupport', ChatExtensions.brief(linked))
			instance.resumeThread(thread)
			const session: Session = {
				assistant: name, conversationId, thread, instance, turn: null, starting: Promise.resolve(),
				target: linked, support, extensions: [], mounted: [], agent, token, served: { schemas: {}, handlers: {} },
			}
			session.starting = instance.start().then(() => this.mount(session))
			this.wire(session)
			this.sessions.set(key, session)
			s = session
		}
		await s.starting
		return s
	}

	/**
	 * A coding agent runs its own loop and never sees tools added in this
	 * process. When the assistant runs on one (configured, or the machine
	 * default), hand it the host's tools as MCP servers instead.
	 */
	private giveAgentServers(instance: any, token: string | null) {
		if (!token) return
		try {
			const current = instance.effectiveOptions?.providerOptions ?? {}
			const own = this.chatMcpUrl ? { 'luca-chat': { type: 'http', url: this.chatMcpUrl(token), headers: { Authorization: `Bearer ${token}` } } } : {}
			instance.options.providerOptions = { ...current, mcpServers: { ...(current.mcpServers ?? {}), ...(this.agentMcpServers?.() ?? {}), ...own } }
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
	private async stored(thread: string): Promise<{ extensions: ChatExtension[]; target?: ChatTarget }> {
		try {
			const cache = this.history.diskCache
			if (!(await cache.has(this.storeKey(thread)))) return { extensions: [] }
			const value = await cache.get(this.storeKey(thread), true)
			let extensions: ChatExtension[] = []
			try { extensions = parseExtensions(value?.extensions) } catch {}
			const target = value?.target?.assistant && value?.target?.conversationId ? { assistant: String(value.target.assistant), conversationId: String(value.target.conversationId) } : undefined
			return { extensions, ...(target ? { target } : {}) }
		} catch {
			return { extensions: [] }
		}
	}

	private async store(thread: string, value: { extensions: ChatExtension[]; target?: ChatTarget }) {
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
		a.on('toolCall', (name: string, args: any) => {
			if (!s.turn) return
			const tool: ChatToolView = { id: String(this.container.utils.uuid()).slice(0, 8), name, argsText: argsText(args), status: 'running', resultText: null, ms: null }
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
		const { id, name, argsText, status, resultText, ms } = t
		return { id, name, argsText, status, resultText, ms }
	}

	/**
	 * Open (or reopen) a conversation. `conversationId` empty or `new` starts
	 * a fresh one. `target` opens it as the tech support chat of another.
	 */
	async open(name: string, conversationId?: string, target?: ChatTarget | null): Promise<{ status: number; body: any }> {
		const manager = await this.manager()
		if (!manager.list().some((e: any) => e.name === name)) return { status: 404, body: { error: `no assistant ${name}` } }
		const id = conversationId && conversationId !== 'new' ? conversationId : this.freshId()
		if (!/^[\w.-]+$/.test(id)) return { status: 400, body: { error: 'a conversation id is letters, digits, dot, dash and underscore' } }
		let s: Session
		try { s = await this.session(name, id, target) } catch (err: any) {
			return { status: 200, body: { ok: false, error: `could not start ${name}: ${err?.message ?? err}` } }
		}
		return { status: 200, body: this.view(s) }
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
		let routing: any = null
		try { routing = s.instance.routing } catch {}
		return {
			ok: true,
			assistant: s.assistant,
			conversationId: s.conversationId,
			thread: s.thread,
			title,
			modelText: [routing?.provider, routing?.model].filter(Boolean).join(' · ') || 'default model',
			tools: Object.keys(s.instance.tools || {}).filter((name) => !s.mounted.includes(name)),
			extensions: s.extensions.map(summary),
			target: s.target,
			messages,
			busy: !!s.turn,
			live: s.turn ? { turnId: s.turn.turnId, user: s.turn.user, text: s.turn.text, tools: s.turn.tools.map((t) => this.publicTool(t)) } : null,
		}
	}

	/** Start a reply. It streams as frames; the answer only says it started. */
	async send(name: string, conversationId: string, text: string): Promise<{ status: number; body: any }> {
		if (!text.trim()) return { status: 400, body: { error: 'text is required' } }
		const opened = await this.open(name, conversationId)
		if (opened.status !== 200 || opened.body.ok === false) return opened
		const s = this.sessions.get(this.key(name, conversationId))!
		if (s.turn) return { status: 409, body: { error: 'A reply is still coming. Stop it first.' } }
		const turnId = String(this.container.utils.uuid()).slice(0, 8)
		s.turn = { turnId, text: '', tools: [], startedAt: Date.now(), user: text }
		this.frame(s, 'chat-start', { text })
		const turn = s.turn
		void (async () => {
			try {
				// The list may have changed on disk since the last turn (another host, a hand edit).
				await this.mount(s)
				const answer = await s.instance.ask(text)
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
		return { status: 200, body: { ok: true, turnId, conversationId, assistant: name } }
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
