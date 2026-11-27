/**
 * Guides for the workbench: scripted conversations with no model behind them.
 *
 * A guide is a YAML file: a graph of nodes. Each node says something (streamed
 * into the chat word by word, so it reads like a reply), draws a card on a
 * canvas beside the chat, and either goes on to the next node or asks a
 * question. The human answers by typing in the chat or by pressing a button on
 * the card. Typed answers are matched against the choices by number, label or
 * keywords; nothing is sent to a model, ever.
 *
 * To the app a guide is an assistant named `guide:<id>`: `POST /chat/open`,
 * `/chat/send` and the `chat-*` frames work as for any chat, so the chat tile
 * needs nothing new. The canvas is `guide-<id>`; its buttons `emit('guide',
 * …)` and the host turns that into a turn, the same as a typed answer.
 *
 * Guides are read from disk on every open and every send, so an edit to the
 * file shows on the next message: `<project>/guides/*.yml`, `~/.luca/guides`,
 * and `~/.luca/assistants/<name>/guides` (where Luca Desktop installs
 * lucaArchitect's), first folder with an id wins. `LUCA_WORKBENCH_GUIDES` adds
 * folders, checked first.
 */
import { z } from 'zod'

type Broadcast = (frame: Record<string, unknown>) => void

const choiceSchema = z.object({
	label: z.string().min(1).describe('What the button says, and what the chat shows as the answer'),
	match: z.array(z.string()).optional().describe('Words or /regexes/ that pick this choice when typed. The label and its number always do.'),
	next: z.string().min(1).describe('The node to go to'),
	set: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional().describe('Variables to set, for {{name}} in later text'),
})

const askSchema = z.object({
	prompt: z.string().optional().describe('Asked after `say`, in the chat and on the card'),
	choices: z.array(choiceSchema).default([]),
	free: z.object({
		set: z.string().min(1).describe('The variable the typed text goes to'),
		next: z.string().min(1),
	}).optional().describe('Take any typed text that matches no choice'),
	otherwise: z.string().optional().describe('Said when the text matches nothing. The choices are listed after it.'),
})

const actionSchema = z.object({
	label: z.string().min(1),
	open: z.string().min(1).describe('A tile address, `luca://{{project}}/console` or a bare tool path like `console`, `chat/new?assistant=lucaArchitect`'),
})

const nodeSchema = z.object({
	say: z.string().default('').describe('Markdown, streamed into the chat'),
	card: z.object({
		title: z.string().optional(),
		body: z.string().optional().describe('Markdown-ish: paragraphs, bullets, **bold**, `code`, fenced code'),
		kicker: z.string().optional().describe('A small label over the title'),
	}).optional().describe('What the canvas shows. Without it the card is made from `say`.'),
	canvas: z.string().optional().describe('JavaScript to run in the canvas page after the card is drawn (custom visuals)'),
	actions: z.array(actionSchema).default([]).describe('Buttons on the card that open tiles'),
	ask: askSchema.optional(),
	next: z.string().optional().describe('Go on to this node in the same turn'),
	end: z.boolean().default(false),
})

export const guideSchema = z.object({
	id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,40}$/, 'a guide id is lowercase letters, digits and dashes'),
	title: z.string().min(1),
	description: z.string().default(''),
	start: z.string().min(1),
	canvas: z.boolean().default(true).describe('Draw cards on a canvas beside the chat'),
	nodes: z.record(z.string(), nodeSchema),
})

export type Guide = z.infer<typeof guideSchema>
export type GuideNode = z.infer<typeof nodeSchema>
export type GuideChoice = z.infer<typeof choiceSchema>

export const GUIDE_PREFIX = 'guide:'

/** `guide:onboarding` → `onboarding`; anything else → null. Pure. */
export function guideIdOf(assistant: string): string | null {
	if (typeof assistant !== 'string' || !assistant.startsWith(GUIDE_PREFIX)) return null
	const id = assistant.slice(GUIDE_PREFIX.length)
	return /^[a-z0-9][a-z0-9-]{0,40}$/.test(id) ? id : null
}

/**
 * Check a parsed guide: every `next` names a node, the start node exists,
 * a node either asks, goes on, or ends. Throws with every problem listed. Pure.
 */
export function validateGuide(raw: unknown): Guide {
	const guide = guideSchema.parse(raw)
	const problems: string[] = []
	const has = (id: string) => Object.prototype.hasOwnProperty.call(guide.nodes, id)
	if (!has(guide.start)) problems.push(`start names no node: ${guide.start}`)
	for (const [id, node] of Object.entries(guide.nodes)) {
		if (node.next && !has(node.next)) problems.push(`${id}.next names no node: ${node.next}`)
		for (const [i, c] of (node.ask?.choices ?? []).entries()) if (!has(c.next)) problems.push(`${id}.ask.choices[${i}].next names no node: ${c.next}`)
		if (node.ask?.free && !has(node.ask.free.next)) problems.push(`${id}.ask.free.next names no node: ${node.ask.free.next}`)
		if (node.ask && node.next) problems.push(`${id} both asks and has next: pick one`)
		if (!node.ask && !node.next && !node.end) problems.push(`${id} neither asks, goes on (next) nor ends (end: true)`)
		if (node.ask && !node.ask.choices.length && !node.ask.free) problems.push(`${id}.ask has no choices and no free input`)
	}
	if (problems.length) throw new Error(`guide ${guide.id}: ${problems.join('; ')}`)
	return guide
}

/** `{{name}}` → vars.name; unknown names stay as typed. Pure. */
export function fill(text: string, vars: Record<string, unknown>): string {
	return String(text ?? '').replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (whole, name) => (name in vars && vars[name] != null ? String(vars[name]) : whole))
}

const STOP_WORDS = new Set(['i', 'im', 'a', 'an', 'the', 'to', 'and', 'or', 'of', 'in', 'on', 'it', 'is', 'am', 'me', 'my', 'not', 'yet', 'want', 'with', 'for', 'that', 'this', 'how', 'do', 'be', 'so', 'yes', 'no', 'ok', 'please'])

function words(text: string): string[] {
	return text.toLowerCase().replace(/[’']/g, '').split(/[^a-z0-9]+/).filter((w) => w && !STOP_WORDS.has(w))
}

/**
 * Which choice a typed answer picks: its number (`1`, `2.`), its label, a
 * `match` word or /regex/, else the choice whose label shares the most words
 * with the text. Null when nothing fits or two fit equally. Pure.
 */
export function matchChoice(text: string, choices: GuideChoice[]): number | null {
	const t = String(text ?? '').trim()
	if (!t || !choices.length) return null
	const n = /^#?(\d{1,2})[.)]?$/.exec(t)
	if (n) { const i = Number(n[1]) - 1; return i >= 0 && i < choices.length ? i : null }
	const lower = t.toLowerCase()
	for (const [i, c] of choices.entries()) if (c.label.toLowerCase() === lower) return i
	for (const [i, c] of choices.entries()) {
		for (const m of c.match ?? []) {
			const re = /^\/(.+)\/([a-z]*)$/.exec(m)
			if (re) { try { if (new RegExp(re[1]!, re[2]!.includes('i') ? re[2]! : re[2]! + 'i').test(t)) return i } catch {} ; continue }
			if (new RegExp(`(^|[^a-z0-9])${m.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`).test(lower)) return i
		}
	}
	const typed = new Set(words(t))
	if (!typed.size) return null
	let best = -1, score = 0, tie = false
	for (const [i, c] of choices.entries()) {
		const s = words(c.label).filter((w) => typed.has(w)).length
		if (s > score) { best = i; score = s; tie = false } else if (s === score && s > 0) tie = true
	}
	return score > 0 && !tie ? best : null
}

/** Typed words that steer the guide itself, whatever the node. Pure. */
export function command(text: string): 'restart' | 'back' | 'help' | null {
	const raw = String(text ?? '').trim().toLowerCase()
	if (raw === '?') return 'help'
	const t = raw.replace(/[.!?]+$/, '')
	if (/^(restart|start over|start again|reset|from the top)$/.test(t)) return 'restart'
	if (/^(back|go back|previous|undo)$/.test(t)) return 'back'
	if (/^(help|options|choices|what can i say|menu)$/.test(t)) return 'help'
	return null
}

/** The question line of an ask, with its choices numbered. Pure. */
export function askText(ask: NonNullable<GuideNode['ask']>, vars: Record<string, unknown>): string {
	const lines: string[] = []
	if (ask.prompt) lines.push(fill(ask.prompt, vars))
	ask.choices.forEach((c, i) => lines.push(`${i + 1}. ${fill(c.label, vars)}`))
	if (ask.free && !ask.choices.length && !ask.prompt) lines.push('_(type your answer)_')
	return lines.join('\n')
}

/** `say` cut into pieces to stream: words with their spaces, paragraphs kept. Pure. */
export function pieces(text: string): string[] {
	return text.split(/(?<=\s)/).filter(Boolean)
}

export type GuideMessage = { role: 'user' | 'assistant'; text: string }

type State = {
	guide: string
	node: string
	vars: Record<string, unknown>
	/** Nodes that asked, in order: what `back` returns to. */
	trail: string[]
	messages: GuideMessage[]
	title?: string
	ended: boolean
}

type Live = { turnId: string; user: string; text: string; startedAt: number; aborted: boolean }

type Session = { conversationId: string; state: State; live: Live | null; canvasId: string | null }

/** Where guide files are, in the order they are searched. Pure given its inputs. */
export function guideFolders(cwd: string, home: string, env: string | undefined, resolve: (...p: string[]) => string, list: (dir: string) => string[]): string[] {
	const out: string[] = []
	for (const extra of String(env || '').split(':').map((s) => s.trim()).filter(Boolean)) out.push(extra)
	out.push(resolve(cwd, 'guides'))
	out.push(resolve(home, '.luca', 'guides'))
	for (const name of list(resolve(home, '.luca', 'assistants'))) out.push(resolve(home, '.luca', 'assistants', name, 'guides'))
	for (const name of list(resolve(cwd, 'assistants'))) out.push(resolve(cwd, 'assistants', name, 'guides'))
	return out
}

/**
 * The card renderer the canvas page gets once per page load: `window.guide.show(card)`
 * draws a card in the app's colors, with the choices and actions as buttons.
 * Buttons answer with `emit('guide', …)`; actions open tiles through the
 * app's web bridge (`alHost`), which only opens the page's own project.
 */
export function guideCanvasSetup(): string {
	return `
if (!window.guide) {
  const h = window.__AL_HOST__ || {}
  const css = document.createElement('style')
  css.id = 'guide-css'
  css.textContent = \`
    :root { --g-ground: #f6f6f7; --g-surface: #fff; --g-border: #e2e2e6; --g-text: #1a1a1f; --g-body: #3a3a44; --g-muted: #7a7a86; --g-accent: #3a7bd5; --g-accent-on: #fff; --g-soft: #e6effa; --g-code: #f0f0f3; }
    html, body { background: var(--g-ground) !important; color: var(--g-text) !important; }
    #canvas { display: none; }
    #guide { position: absolute; inset: 0; overflow: auto; padding: 28px; box-sizing: border-box; font: 15px/1.5 -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif; -webkit-font-smoothing: antialiased; }
    .g-card { max-width: 640px; margin: 0 auto; background: var(--g-surface); border: 1px solid var(--g-border); border-radius: 14px; padding: 26px 30px 22px; box-shadow: 0 1px 2px rgba(0,0,0,.04); animation: g-in .22s ease-out; }
    @keyframes g-in { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none } }
    .g-kicker { font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--g-accent); font-weight: 600; margin-bottom: 8px; }
    .g-title { font-size: 22px; font-weight: 650; line-height: 1.25; margin: 0 0 14px; letter-spacing: -.01em; }
    .g-body p { margin: 0 0 12px; color: var(--g-body); }
    .g-body ul { margin: 0 0 12px; padding-left: 20px; color: var(--g-body); }
    .g-body li { margin: 4px 0; }
    .g-body strong { color: var(--g-text); font-weight: 620; }
    .g-body code, .g-body pre { font: 13px ui-monospace, Menlo, monospace; }
    .g-body code { background: var(--g-code); padding: 1px 5px; border-radius: 4px; }
    .g-body pre { background: var(--g-code); padding: 12px 14px; border-radius: 8px; overflow: auto; margin: 0 0 12px; }
    .g-body pre code { background: none; padding: 0; }
    .g-prompt { margin: 18px 0 10px; font-weight: 600; }
    .g-choices { display: flex; flex-direction: column; gap: 8px; }
    .g-choice { display: flex; align-items: center; gap: 12px; text-align: left; font: inherit; color: var(--g-text); background: var(--g-surface); border: 1px solid var(--g-border); border-radius: 10px; padding: 11px 14px; cursor: pointer; transition: border-color .12s, background .12s; }
    .g-choice:hover { border-color: var(--g-accent); background: var(--g-soft); }
    .g-choice:active { transform: translateY(1px); }
    .g-num { flex: none; width: 24px; height: 24px; border-radius: 7px; display: grid; place-items: center; font-size: 12px; font-weight: 700; background: var(--g-soft); color: var(--g-accent); }
    .g-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
    .g-action { font: inherit; font-size: 14px; font-weight: 600; color: var(--g-accent-on); background: var(--g-accent); border: 0; border-radius: 9px; padding: 9px 14px; cursor: pointer; }
    .g-action:hover { filter: brightness(1.08); }
    .g-foot { margin-top: 18px; display: flex; justify-content: space-between; align-items: center; color: var(--g-muted); font-size: 12px; }
    .g-foot button { font: inherit; font-size: 12px; color: var(--g-muted); background: none; border: 0; cursor: pointer; padding: 2px 4px; text-decoration: underline; }
    .g-foot button:hover { color: var(--g-text); }
    .g-steps { display: flex; gap: 5px; }
    .g-step { width: 18px; height: 4px; border-radius: 2px; background: var(--g-border); }
    .g-step.on { background: var(--g-accent); }
    .g-busy { opacity: .55; pointer-events: none; }
  \`
  document.head.appendChild(css)

  const theme = (vars) => {
    if (!vars) return
    const r = document.documentElement.style
    const map = { '--g-ground': '--al-ground', '--g-surface': '--al-surface', '--g-border': '--al-border', '--g-text': '--al-text', '--g-body': '--al-text-body', '--g-muted': '--al-text-muted', '--g-accent': '--al-accent', '--g-accent-on': '--al-accent-on', '--g-soft': '--al-accent-soft', '--g-code': '--al-inset' }
    for (const k in map) if (vars[map[k]]) r.setProperty(k, vars[map[k]])
  }
  theme(h.vars)
  window.addEventListener('al:host', (e) => theme(e.detail && e.detail.vars))

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
  const inline = (s) => esc(s).replace(/\\\`([^\\\`]+)\\\`/g, '<code>$1</code>').replace(/\\*\\*([^*]+)\\*\\*/g, '<strong>$1</strong>').replace(/\\*([^*]+)\\*/g, '<em>$1</em>')
  // A small markdown: paragraphs, "- " bullets, fenced code. Enough for a card.
  const md = (text) => {
    const out = []
    const lines = String(text || '').replace(/\\r/g, '').split('\\n')
    let i = 0
    while (i < lines.length) {
      const line = lines[i]
      if (/^\\s*\\\`\\\`\\\`/.test(line)) {
        const buf = []
        i++
        while (i < lines.length && !/^\\s*\\\`\\\`\\\`/.test(lines[i])) buf.push(lines[i++])
        i++
        out.push('<pre><code>' + esc(buf.join('\\n')) + '</code></pre>')
        continue
      }
      if (/^\\s*[-*] /.test(line)) {
        const items = []
        while (i < lines.length && /^\\s*[-*] /.test(lines[i])) items.push('<li>' + inline(lines[i++].replace(/^\\s*[-*] /, '')) + '</li>')
        out.push('<ul>' + items.join('') + '</ul>')
        continue
      }
      if (!line.trim()) { i++; continue }
      const buf = []
      while (i < lines.length && lines[i].trim() && !/^\\s*[-*] /.test(lines[i]) && !/^\\s*\\\`\\\`\\\`/.test(lines[i])) buf.push(lines[i++])
      out.push('<p>' + inline(buf.join(' ')) + '</p>')
    }
    return out.join('')
  }

  const open = (uri) => {
    const bridge = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.alHost
    if (bridge) bridge.postMessage({ kind: 'open', uri })
    else emit('guide', { open: uri })
  }

  let root = document.getElementById('guide')
  if (!root) { root = document.createElement('div'); root.id = 'guide'; stage.appendChild(root) }

  window.guide = {
    show(card) {
      card = card || {}
      const el = document.createElement('div')
      el.className = 'g-card'
      let html = ''
      if (card.kicker) html += '<div class="g-kicker">' + esc(card.kicker) + '</div>'
      if (card.title) html += '<h1 class="g-title">' + inline(card.title) + '</h1>'
      html += '<div class="g-body">' + md(card.body) + '</div>'
      if (card.prompt) html += '<div class="g-prompt">' + inline(card.prompt) + '</div>'
      el.innerHTML = html
      const choices = card.choices || []
      if (choices.length) {
        const list = document.createElement('div')
        list.className = 'g-choices'
        choices.forEach((label, i) => {
          const b = document.createElement('button')
          b.className = 'g-choice'
          b.innerHTML = '<span class="g-num">' + (i + 1) + '</span><span>' + inline(label) + '</span>'
          b.onclick = () => { root.classList.add('g-busy'); emit('guide', { choice: i, label }) }
          list.appendChild(b)
        })
        el.appendChild(list)
      }
      const actions = card.actions || []
      if (actions.length) {
        const row = document.createElement('div')
        row.className = 'g-actions'
        for (const a of actions) {
          const b = document.createElement('button')
          b.className = 'g-action'
          b.textContent = a.label
          b.onclick = () => open(a.open)
          row.appendChild(b)
        }
        el.appendChild(row)
      }
      const foot = document.createElement('div')
      foot.className = 'g-foot'
      const steps = (card.steps || []).map((on) => '<span class="g-step' + (on ? ' on' : '') + '"></span>').join('')
      foot.innerHTML = '<div class="g-steps">' + steps + '</div><div><button data-g="back">back</button> · <button data-g="restart">start over</button></div>'
      foot.querySelector('[data-g=back]').onclick = () => emit('guide', { command: 'back' })
      foot.querySelector('[data-g=restart]').onclick = () => emit('guide', { command: 'restart' })
      el.appendChild(foot)
      root.classList.remove('g-busy')
      root.replaceChildren(el)
      root.scrollTop = 0
    },
  }
}
return true
`
}

export class Guides {
	private sessions = new Map<string, Session>()
	private delayMs: number
	/** Draws on canvases; set by the host. */
	canvases?: {
		create(input: { id?: string; title?: string; open?: boolean }): { status: number; body: any }
		get(id: string): { open: boolean } | undefined
		eval(id: string, code: string, opts?: { timeoutMs?: number; keep?: boolean }): Promise<any>
		onPageEvent(fn: (id: string, name: string, data: unknown) => void): void
		onPageReady(fn: (id: string) => void): void
	}

	constructor(private container: any, private broadcast: Broadcast) {
		const env = Number(process.env.LUCA_GUIDE_DELAY_MS)
		this.delayMs = Number.isFinite(env) ? Math.max(0, env) : 14
	}

	/** Hook into the canvases: button presses become turns, a reloaded page gets its card again. */
	attach(canvases: NonNullable<Guides['canvases']>) {
		this.canvases = canvases
		canvases.onPageEvent((id, name, data) => { if (name === 'guide') void this.fromCanvas(id, data) })
		canvases.onPageReady((id) => { void this.redraw(id) })
	}

	// --- Files ---

	private folders(): string[] {
		const fs = this.container.feature('fs')
		const list = (dir: string): string[] => { try { return fs.exists(dir) ? fs.readdirSync(dir).filter((n: string) => !n.startsWith('.')) : [] } catch { return [] } }
		return guideFolders(String(this.container.cwd), String(this.container.feature('os').homedir), process.env.LUCA_WORKBENCH_GUIDES, (...p) => this.container.paths.resolve(...p), list)
	}

	/** Every guide on disk, by id, first folder wins. Files that do not parse are listed under `errors`. */
	scan(): { guides: Map<string, Guide & { file: string }>; errors: Array<{ file: string; error: string }> } {
		const fs = this.container.feature('fs')
		const yaml = this.container.feature('yaml')
		const guides = new Map<string, Guide & { file: string }>()
		const errors: Array<{ file: string; error: string }> = []
		for (const dir of this.folders()) {
			let names: string[] = []
			try { if (fs.exists(dir)) names = fs.readdirSync(dir) } catch { continue }
			for (const name of names.sort()) {
				if (!/\.ya?ml$/.test(name)) continue
				const file = this.container.paths.resolve(dir, name)
				try {
					const guide = validateGuide(yaml.parse(fs.readFile(file, 'utf8')))
					if (!guides.has(guide.id)) guides.set(guide.id, { ...guide, file })
				} catch (err: any) {
					const issues = err?.issues ? err.issues.map((i: any) => `${i.path.join('.')}: ${i.message}`).join('; ') : String(err?.message ?? err)
					errors.push({ file, error: issues })
				}
			}
		}
		return { guides, errors }
	}

	private find(id: string): (Guide & { file: string }) | undefined {
		return this.scan().guides.get(id)
	}

	/** True for an assistant name this class answers for. */
	owns(assistant: string): boolean {
		return guideIdOf(assistant) !== null
	}

	/** Entries for `GET /assistants`, so the picker and the assistants tile list the guides. */
	entries(firstSlot: number) {
		const { guides } = this.scan()
		return [...guides.values()].map((g, i) => ({
			id: GUIDE_PREFIX + g.id,
			name: GUIDE_PREFIX + g.id,
			description: g.description || g.title,
			model: null,
			provider: null,
			modelText: 'scripted · no model',
			toolCount: 0,
			tools: [],
			source: 'guide',
			folder: this.container.paths.dirname(g.file),
			folderDisplay: this.tilde(this.container.paths.dirname(g.file)),
			conversationCount: 0,
			lastText: '',
			slot: firstSlot + i,
			error: null,
		}))
	}

	private tilde(path: string): string {
		const home = String(this.container.feature('os').homedir)
		return path.startsWith(home + '/') ? '~' + path.slice(home.length) : path
	}

	// --- Storage ---

	private get cache(): any {
		return this.container.feature('conversationHistory').diskCache
	}

	private storeKey(conversationId: string) {
		return `workbench-guide:${conversationId}`
	}

	private async load(conversationId: string): Promise<State | null> {
		try {
			if (!(await this.cache.has(this.storeKey(conversationId)))) return null
			const v = await this.cache.get(this.storeKey(conversationId), true)
			if (!v || typeof v.guide !== 'string' || typeof v.node !== 'string') return null
			return {
				guide: v.guide,
				node: v.node,
				vars: v.vars && typeof v.vars === 'object' ? v.vars : {},
				trail: Array.isArray(v.trail) ? v.trail.map(String) : [],
				messages: Array.isArray(v.messages) ? v.messages.filter((m: any) => m && (m.role === 'user' || m.role === 'assistant')).map((m: any) => ({ role: m.role, text: String(m.text ?? '') })) : [],
				title: typeof v.title === 'string' && v.title ? v.title : undefined,
				ended: !!v.ended,
			}
		} catch {
			return null
		}
	}

	private async save(s: Session) {
		try { await this.cache.set(this.storeKey(s.conversationId), s.state) } catch (err: any) {
			console.error(`[workbench] could not save guide ${s.conversationId}: ${err?.message}`)
		}
	}

	// --- Sessions ---

	private freshId(): string {
		const d = new Date()
		const pad = (n: number) => String(n).padStart(2, '0')
		return `tour-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${String(this.container.utils.uuid()).slice(0, 6)}`
	}

	private frame(s: Session, assistant: string, type: string, extra: Record<string, unknown>) {
		this.broadcast({ type, assistant, conversationId: s.conversationId, turnId: s.live?.turnId ?? null, at: Date.now(), ...extra })
	}

	private vars(s: Session, guide: Guide): Record<string, unknown> {
		let project = this.container.paths.basename(String(this.container.cwd))
		try { project = String(this.container.feature('fs').readJson(this.container.paths.resolve(String(this.container.cwd), 'package.json'))?.name || project) } catch {}
		return { ...s.state.vars, project, cwd: String(this.container.cwd), guide: guide.title }
	}

	private view(s: Session, guide: Guide) {
		const first = s.state.messages.find((m) => m.role === 'user')
		return {
			ok: true,
			assistant: GUIDE_PREFIX + guide.id,
			conversationId: s.conversationId,
			thread: `guide:${guide.id}:${s.conversationId}`,
			title: s.state.title || guide.title || first?.text.split('\n')[0]?.slice(0, 80) || 'Guide',
			modelText: 'scripted · no model',
			settings: {},
			routing: { provider: '', model: '', reasoningEffort: '' },
			tools: [],
			extensions: [],
			target: null,
			messages: s.state.messages.map((m, i) => ({ id: `g${i}`, role: m.role, text: m.text, tools: [] })),
			busy: !!s.live,
			live: s.live ? { turnId: s.live.turnId, user: s.live.user, text: s.live.text, reasoning: '', tools: [] } : null,
			guide: { id: guide.id, node: s.state.node, ended: s.state.ended, file: (guide as any).file },
		}
	}

	/**
	 * Open a guide conversation. A new one plays the start node at once, so
	 * the chat opens with the first words already coming.
	 */
	async open(assistant: string, conversationId?: string): Promise<{ status: number; body: any }> {
		const id = guideIdOf(assistant)
		if (!id) return { status: 404, body: { error: `no guide ${assistant}` } }
		const guide = this.find(id)
		if (!guide) {
			const { errors } = this.scan()
			const why = errors.length ? ` Files that did not load: ${errors.map((e) => `${this.tilde(e.file)} (${e.error})`).join('; ')}` : ''
			return { status: 200, body: { ok: false, error: `No guide "${id}" in ${this.folders().map((f) => this.tilde(f)).join(', ')}.${why}` } }
		}
		const cid = conversationId && conversationId !== 'new' ? conversationId : this.freshId()
		if (!/^[\w.-]+$/.test(cid)) return { status: 400, body: { error: 'a conversation id is letters, digits, dot, dash and underscore' } }
		let s = this.sessions.get(cid)
		let fresh = false
		if (!s) {
			const saved = await this.load(cid)
			const state: State = saved && saved.guide === id ? saved : { guide: id, node: guide.start, vars: {}, trail: [], messages: [], ended: false }
			if (!guide.nodes[state.node]) { state.node = guide.start; state.ended = false }
			s = { conversationId: cid, state, live: null, canvasId: null }
			this.sessions.set(cid, s)
			fresh = !saved || saved.guide !== id
		}
		if (fresh) this.play(s, guide, '', guide.start, { pushTrail: true })
		else if (!s.live) void this.ensureCanvas(s, guide).then(() => this.drawCard(s!, guide, guide.nodes[s!.state.node]!))
		return { status: 200, body: this.view(s, guide) }
	}

	private sessionOf(conversationId: string): Session | undefined {
		return this.sessions.get(conversationId)
	}

	/** A typed answer. Matched here; no model. */
	async send(assistant: string, conversationId: string, text: string): Promise<{ status: number; body: any }> {
		if (!text.trim()) return { status: 400, body: { error: 'text is required' } }
		const opened = await this.open(assistant, conversationId)
		if (opened.status !== 200 || opened.body.ok === false) return opened
		const s = this.sessionOf(conversationId)!
		const guide = this.find(guideIdOf(assistant)!)!
		if (s.live) return { status: 409, body: { error: 'The guide is still talking. Stop it first.' } }
		return this.answer(s, guide, text.trim())
	}

	/** A button on the card: the same as typing its label. */
	private async fromCanvas(canvasId: string, data: any) {
		const s = [...this.sessions.values()].find((x) => x.canvasId === canvasId)
		if (!s || s.live) return
		const guide = this.find(s.state.guide)
		if (!guide) return
		if (data && typeof data.command === 'string') { this.answer(s, guide, data.command); return }
		if (data && typeof data.open === 'string') return // Only the app opens tiles; a browser page cannot.
		const node = guide.nodes[s.state.node]
		const i = Number(data?.choice)
		const choice = node?.ask?.choices[i]
		if (choice) this.answer(s, guide, fill(choice.label, this.vars(s, guide)))
	}

	private answer(s: Session, guide: Guide, text: string): { status: number; body: any } {
		const assistant = GUIDE_PREFIX + guide.id
		const node = guide.nodes[s.state.node]!
		const vars = this.vars(s, guide)
		const cmd = command(text)
		if (cmd === 'restart') {
			s.state = { guide: guide.id, node: guide.start, vars: {}, trail: [], messages: s.state.messages, ended: false, title: s.state.title }
			return this.play(s, guide, text, guide.start, { pushTrail: true })
		}
		if (cmd === 'back') {
			const previous = s.state.trail.length > 1 ? s.state.trail[s.state.trail.length - 2]! : guide.start
			s.state.trail = s.state.trail.slice(0, -1)
			s.state.ended = false
			return this.play(s, guide, text, previous, { pushTrail: true })
		}
		if (cmd === 'help' || s.state.ended || !node.ask) {
			const lines = node.ask ? [`You can pick one of these, or type **back** or **start over**.`, '', askText(node.ask, vars)] : [`This is the end of the guide. Type **start over** to go through it again, or **back** for the last question.`]
			return this.say(s, guide, text, lines.join('\n'), node)
		}
		const i = matchChoice(text, node.ask.choices)
		if (i !== null) {
			const choice = node.ask.choices[i]!
			if (choice.set) s.state.vars = { ...s.state.vars, ...choice.set }
			return this.play(s, guide, text, choice.next, { pushTrail: true })
		}
		if (node.ask.free) {
			s.state.vars = { ...s.state.vars, [node.ask.free.set]: text }
			return this.play(s, guide, text, node.ask.free.next, { pushTrail: true })
		}
		const sorry = node.ask.otherwise ? fill(node.ask.otherwise, vars) : `I'm a guided tour, not a model, so I only follow the choices. Here they are again:`
		return this.say(s, guide, text, `${sorry}\n\n${askText(node.ask, vars)}`, node)
	}

	/** One reply that changes no node: a help line, a miss. The card stays. */
	private say(s: Session, guide: Guide, user: string, text: string, node: GuideNode): { status: number; body: any } {
		return this.turn(s, guide, user, async (emit) => {
			await emit(text)
			await this.ensureCanvas(s, guide)
			await this.drawCard(s, guide, node)
		})
	}

	/**
	 * Go to a node and play from it: say, card, canvas code; then on through
	 * `next` nodes in the same turn until one asks or ends.
	 */
	private play(s: Session, guide: Guide, user: string, start: string, opts: { pushTrail: boolean }): { status: number; body: any } {
		return this.turn(s, guide, user, async (emit) => {
			let id: string | undefined = start
			let hops = 0
			let first = true
			await this.ensureCanvas(s, guide)
			while (id && hops++ < 20) {
				const node: GuideNode | undefined = guide.nodes[id]
				if (!node) { await emit(`\n\n_(the guide names a node that does not exist: ${id})_`); break }
				s.state.node = id
				s.state.ended = !!node.end
				const vars = this.vars(s, guide)
				let text = fill(node.say, vars)
				if (node.ask) text += (text ? '\n\n' : '') + askText(node.ask, vars)
				if (node.end && node.actions.length) text += (text ? '\n\n' : '') + node.actions.map((a) => `→ ${fill(a.label, vars)}`).join('\n')
				if (!first && text) await emit('\n\n')
				first = false
				await emit(text)
				await this.drawCard(s, guide, node)
				if (node.ask) { if (opts.pushTrail) s.state.trail = [...s.state.trail.filter((t) => t !== id), id].slice(-50); break }
				if (node.end) break
				id = node.next
			}
		})
	}

	/** Stream a reply: `chat-start`, the words as `chat-delta`, `chat-done`. Saved after. */
	private turn(s: Session, guide: Guide, user: string, body: (emit: (text: string) => Promise<void>) => Promise<void>): { status: number; body: any } {
		const assistant = GUIDE_PREFIX + guide.id
		const turnId = String(this.container.utils.uuid()).slice(0, 8)
		const live: Live = { turnId, user, text: '', startedAt: Date.now(), aborted: false }
		s.live = live
		this.frame(s, assistant, 'chat-start', { text: user })
		const emit = async (text: string) => {
			for (const piece of pieces(text)) {
				if (live.aborted) throw Object.assign(new Error('aborted'), { name: 'GuideAbort' })
				live.text += piece
				this.frame(s, assistant, 'chat-delta', { text: piece })
				if (this.delayMs) await new Promise((r) => setTimeout(r, this.delayMs))
			}
		}
		void (async () => {
			try {
				await body(emit)
				this.finish(s, guide, live, false)
			} catch (err: any) {
				if (err?.name === 'GuideAbort') this.finish(s, guide, live, true)
				else {
					this.frame(s, assistant, 'chat-error', { error: String(err?.message ?? err), ms: Date.now() - live.startedAt })
					if (s.live === live) s.live = null
				}
			}
		})()
		return { status: 200, body: { ok: true, turnId, conversationId: s.conversationId, assistant } }
	}

	private finish(s: Session, guide: Guide, live: Live, aborted: boolean) {
		if (live.user) s.state.messages.push({ role: 'user', text: live.user })
		if (live.text) s.state.messages.push({ role: 'assistant', text: live.text })
		if (s.state.messages.length > 400) s.state.messages.splice(0, s.state.messages.length - 400)
		this.frame(s, GUIDE_PREFIX + guide.id, 'chat-done', { text: live.text, aborted, ms: Date.now() - live.startedAt })
		if (s.live === live) s.live = null
		void this.save(s)
	}

	// --- The canvas ---

	private async ensureCanvas(s: Session, guide: Guide) {
		if (!guide.canvas || !this.canvases) return
		if (s.canvasId) return
		const id = `guide-${guide.id}`.slice(0, 48)
		const made = this.canvases.create({ id, title: guide.title })
		if (made.status !== 200) return
		s.canvasId = id
	}

	/**
	 * Draw the node's card, then run the node's own canvas code. Nothing is
	 * kept in the canvas log: `redraw` paints again after a reload. A page that
	 * is not open is skipped, so the chat never waits on the canvas; the card
	 * comes when the page links.
	 */
	private async drawCard(s: Session, guide: Guide, node: GuideNode) {
		if (!s.canvasId || !this.canvases) return
		if (!this.canvases.get(s.canvasId)?.open) return
		const vars = this.vars(s, guide)
		const order = Object.keys(guide.nodes)
		const at = order.indexOf(s.state.node)
		const asks = order.filter((k) => guide.nodes[k]!.ask || guide.nodes[k]!.end)
		const steps = asks.map((k) => order.indexOf(k) <= at)
		const card = {
			kicker: node.card?.kicker ? fill(node.card.kicker, vars) : guide.title,
			title: node.card?.title ? fill(node.card.title, vars) : undefined,
			body: fill(node.card?.body ?? (node.card?.title ? '' : node.say), vars),
			prompt: node.ask?.prompt ? fill(node.ask.prompt, vars) : undefined,
			choices: (node.ask?.choices ?? []).map((c) => fill(c.label, vars)),
			actions: node.actions.map((a) => ({ label: fill(a.label, vars), open: fill(a.open, vars) })),
			steps,
		}
		const setup = await this.canvases.eval(s.canvasId, guideCanvasSetup(), { keep: false, timeoutMs: 15_000 })
		if (!setup?.ok) { console.error(`[workbench] guide ${guide.id}: could not set the canvas up: ${setup?.error}`); return }
		const shown = await this.canvases.eval(s.canvasId, `window.guide.show(${JSON.stringify(card)}); return true`, { keep: false, timeoutMs: 15_000 })
		if (!shown?.ok) console.error(`[workbench] guide ${guide.id}: could not draw the card: ${shown?.error}`)
		if (node.canvas) {
			const answer = await this.canvases.eval(s.canvasId, fill(node.canvas, vars), { keep: false, timeoutMs: 15_000 })
			if (!answer?.ok) console.error(`[workbench] guide ${guide.id}/${s.state.node}: canvas code failed: ${answer?.error}`)
		}
	}

	/** The page loaded again (a reload, a restart): the current card goes back on. */
	private async redraw(canvasId: string) {
		const s = [...this.sessions.values()].find((x) => x.canvasId === canvasId)
		if (!s || s.live) return
		const guide = this.find(s.state.guide)
		const node = guide?.nodes[s.state.node]
		if (guide && node) await this.drawCard(s, guide, node)
	}

	// --- The other chat routes ---

	stop(conversationId: string): boolean {
		const s = this.sessionOf(conversationId)
		if (!s?.live) return false
		s.live.aborted = true
		return true
	}

	/** `retry`: the current node again. */
	async retry(assistant: string, conversationId: string): Promise<{ status: number; body: any }> {
		const opened = await this.open(assistant, conversationId)
		if (opened.status !== 200 || opened.body.ok === false) return opened
		const s = this.sessionOf(conversationId)!
		if (s.live) return { status: 409, body: { error: 'The guide is still talking. Stop it first.' } }
		const guide = this.find(guideIdOf(assistant)!)!
		return this.play(s, guide, '', s.state.node, { pushTrail: false })
	}

	/** `clear`: forget the transcript and start from the top. */
	async clear(assistant: string, conversationId: string): Promise<{ status: number; body: any }> {
		const opened = await this.open(assistant, conversationId)
		if (opened.status !== 200 || opened.body.ok === false) return opened
		const s = this.sessionOf(conversationId)!
		if (s.live) return { status: 409, body: { error: 'The guide is still talking. Stop it first.' } }
		const guide = this.find(guideIdOf(assistant)!)!
		s.state = { guide: guide.id, node: guide.start, vars: {}, trail: [], messages: [], ended: false, title: s.state.title }
		this.frame(s, assistant, 'chat-history', { messages: [] })
		this.play(s, guide, '', guide.start, { pushTrail: true })
		return { status: 200, body: this.view(s, guide) }
	}

	async rename(assistant: string, conversationId: string, title: string): Promise<{ status: number; body: any }> {
		const clean = String(title ?? '').trim().slice(0, 120)
		if (!clean) return { status: 400, body: { ok: false, error: 'title is required' } }
		const opened = await this.open(assistant, conversationId)
		if (opened.status !== 200 || opened.body.ok === false) return opened
		const s = this.sessionOf(conversationId)!
		const guide = this.find(guideIdOf(assistant)!)!
		s.state.title = clean
		await this.save(s)
		this.frame(s, assistant, 'chat-settings', { settings: {}, routing: { provider: '', model: '', reasoningEffort: '' }, modelText: 'scripted · no model', title: clean })
		return { status: 200, body: this.view(s, guide) }
	}

	async remove(assistant: string, conversationId: string): Promise<{ status: number; body: any }> {
		const s = this.sessionOf(conversationId)
		if (s?.live) s.live.aborted = true
		this.sessions.delete(conversationId)
		try { await this.cache.rm(this.storeKey(conversationId)) } catch {}
		this.broadcast({ type: 'chat-deleted', assistant, conversationId, turnId: null, at: Date.now() })
		return { status: 200, body: { ok: true, deleted: true } }
	}

	async exportView(assistant: string, conversationId: string): Promise<{ status: number; body: any }> {
		const opened = await this.open(assistant, conversationId)
		if (opened.status !== 200 || opened.body.ok === false) return opened
		const v = opened.body
		const out = [`# ${v.title}`, '', `A guided tour, **${assistant}**.`, '']
		for (const m of v.messages) out.push(m.role === 'user' ? '## You' : `## ${v.title}`, '', m.text, '')
		return { status: 200, body: { title: v.title, filename: `${String(v.title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'guide'}-${conversationId}.md`, markdown: out.join('\n') } }
	}

	/** Settings, models, extensions: a guide has none. One answer for all. */
	noModel(): { status: number; body: any } {
		return { status: 200, body: { ok: false, error: 'A guide is scripted: it has no model, tools or settings to change.' } }
	}

	closeAll() {
		for (const s of this.sessions.values()) if (s.live) s.live.aborted = true
		this.sessions.clear()
	}
}
