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
}

export class ChatSessions {
	private sessions = new Map<string, Session>()
	private infos = new Map<string, any>()
	private discovered: Promise<any> | null = null
	/** Tools the host gives every chat assistant (the canvas tools). */
	extraTools?: () => { schemas: Record<string, any>; handlers: Record<string, (...args: any[]) => any> }

	constructor(private container: any, private broadcast: Broadcast) {}

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

	/** The live session for a conversation, started (history loaded) on first use. */
	private async session(name: string, conversationId: string): Promise<Session> {
		const key = this.key(name, conversationId)
		let s = this.sessions.get(key)
		if (!s) {
			const manager = await this.manager()
			const thread = manager.threadPrefixFor(name) + conversationId
			const instance = manager.create(name, { cached: false, historyMode: 'session' })
			if (this.extraTools) {
				try { instance.use(this.extraTools()) } catch (err: any) { console.error(`[workbench] could not give ${name} the host's tools: ${err?.message}`) }
			}
			instance.resumeThread(thread)
			const session: Session = { assistant: name, conversationId, thread, instance, turn: null, starting: Promise.resolve() }
			session.starting = instance.start().then(() => {})
			this.wire(session)
			this.sessions.set(key, session)
			s = session
		}
		await s.starting
		return s
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

	/** Open (or reopen) a conversation. `conversationId` empty or `new` starts a fresh one. */
	async open(name: string, conversationId?: string): Promise<{ status: number; body: any }> {
		const manager = await this.manager()
		if (!manager.list().some((e: any) => e.name === name)) return { status: 404, body: { error: `no assistant ${name}` } }
		const id = conversationId && conversationId !== 'new' ? conversationId : this.freshId()
		if (!/^[\w.-]+$/.test(id)) return { status: 400, body: { error: 'a conversation id is letters, digits, dot, dash and underscore' } }
		let s: Session
		try { s = await this.session(name, id) } catch (err: any) {
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
			tools: Object.keys(s.instance.tools || {}),
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
