import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from '../../schemas/base.js'
import { Feature } from '../feature.js'
import type { TmuxSession } from '../../node/features/tmux'

export interface ClaudeControllerChoice {
  index?: number
  key?: string
  label: string
  selected?: boolean
  raw: string
}

export interface ClaudeControllerSnapshot {
  id: string
  tmuxSession: string
  cwd: string
  sessionId?: string
  sessionFile?: string
  pane: string
  currentCommand: string
  awaitingInput: boolean
  choices: ClaudeControllerChoice[]
  history: any[]
  updatedAt: string
}

export interface ClaudeControllerAskOptions {
  timeoutMs?: number
  pollIntervalMs?: number
  wait?: boolean
}

export interface ClaudeControllerStartOptions {
  id?: string
  name?: string
  cwd?: string
  command?: string
  args?: string[]
  width?: number
  height?: number
  reuse?: boolean
}

export const ClaudeControllerStateSchema = FeatureStateSchema.extend({
  controllers: z.record(z.string(), z.any()).describe('Map of controller IDs to latest snapshots'),
  activeController: z.string().optional().describe('Most recently used controller ID'),
})

export const ClaudeControllerOptionsSchema = FeatureOptionsSchema.extend({
  cwd: z.string().optional().describe('Default working directory for interactive Claude sessions'),
  claudePath: z.string().optional().describe('Path to claude executable; defaults to claudeCode.claudePath or claude'),
  sessionPrefix: z.string().optional().default('luca-claude').describe('Tmux session name prefix'),
  width: z.number().optional().default(220).describe('Default tmux pane width'),
  height: z.number().optional().default(60).describe('Default tmux pane height'),
  settleMs: z.number().optional().default(250).describe('Delay after sending input before refreshing state'),
})

export const ClaudeControllerEventsSchema = FeatureEventsSchema.extend({
  'controller:start': z.tuple([z.object({ id: z.string(), tmuxSession: z.string() })]).describe('Fired when an interactive Claude controller starts'),
  'controller:update': z.tuple([z.object({ id: z.string(), snapshot: z.any() })]).describe('Fired after a snapshot refresh'),
  'controller:input': z.tuple([z.object({ id: z.string(), text: z.string() })]).describe('Fired after text is sent to Claude'),
  'controller:choice': z.tuple([z.object({ id: z.string(), choice: z.any() })]).describe('Fired after a prompt choice is selected'),
  'controller:stop': z.tuple([z.object({ id: z.string() })]).describe('Fired when a controller is stopped'),
})

export type ClaudeControllerState = z.infer<typeof ClaudeControllerStateSchema>
export type ClaudeControllerOptions = z.infer<typeof ClaudeControllerOptionsSchema>

const DEFAULT_AWAITING_PATTERNS = [
  />\s*$/,
  /❯\s*$/,
  /\?\s*$/,
  /Do you want to proceed\?/i,
  /Would you like to/i,
  /\b(Y\/n|y\/N)\b/,
  /\b(Yes|No)\b.*\besc\b/i,
  /Choose an option/i,
]

const CLAUDE_COMMAND_NAMES = new Set(['claude', 'node', 'bun'])

function shQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

function compactId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'default'
}

function lastMeaningfulLines(screen: string): string[] {
  return screen
    .split('\n')
    .map(line => line.trimEnd())
    .filter(line => line.trim().length > 0)
}

/**
 * Parse Claude's visible terminal prompt into selectable choices.
 * Handles numbered menus, selected rows, radio-like bullets, and simple y/n prompts.
 */
export function parseClaudeChoices(screen: string): ClaudeControllerChoice[] {
  const lines = lastMeaningfulLines(screen)
  const choices: ClaudeControllerChoice[] = []
  const seen = new Set<string>()

  for (const rawLine of lines.slice(-30)) {
    const line = rawLine.trim()
    const selected = /^[>❯➜→]/.test(line) || /^[●◉]/.test(line)
    const normalized = line.replace(/^[>❯➜→]\s*/, '').replace(/^[○●◉◌]\s*/, '')

    let match = normalized.match(/^(\d+)[.)]\s+(.+)$/)
    if (match) {
      const index = Number(match[1])
      const label = match[2]!.trim()
      const key = String(index)
      if (!seen.has(key)) {
        choices.push({ index, key, label, selected, raw: rawLine })
        seen.add(key)
      }
      continue
    }

    match = normalized.match(/^\[?([a-zA-Z])\]?\)?[.)]?\s+(.+)$/)
    if (match && /^(y|n|a|d|q|c)$/i.test(match[1]!)) {
      const key = match[1]!
      const label = match[2]!.trim()
      if (label.length > 1 && !seen.has(key.toLowerCase())) {
        choices.push({ key, label, selected, raw: rawLine })
        seen.add(key.toLowerCase())
      }
      continue
    }
  }

  const tail = lines.slice(-6).join('\n')
  if (choices.length === 0 && /\b(y\/n|yes\/no|y\/N|Y\/n)\b/i.test(tail)) {
    choices.push({ key: 'y', label: 'yes', raw: 'y' })
    choices.push({ key: 'n', label: 'no', raw: 'n' })
  }

  return choices
}

/** Heuristic for detecting that interactive Claude is stopped at a prompt. */
export function detectClaudeAwaitingInput(screen: string, currentCommand?: string): boolean {
  const lines = lastMeaningfulLines(screen)
  const tail = lines.slice(-8).join('\n')
  const last = lines[lines.length - 1] ?? ''
  if (parseClaudeChoices(screen).length > 0) return true
  if (DEFAULT_AWAITING_PATTERNS.some(pattern => pattern.test(last) || pattern.test(tail))) return true
  if (currentCommand && !CLAUDE_COMMAND_NAMES.has(currentCommand)) return false
  return false
}

declare module 'luca/feature' {
  interface AvailableFeatures {
    claudeController: typeof ClaudeController
  }
}

/**
 * Controls an interactive `claude` process from both ends: tmux drives the
 * terminal while Claude session JSONL files provide durable conversation state.
 *
 * This intentionally does not use `claude -p`. It launches plain `claude` in a
 * detached tmux session, captures the screen to detect prompts/choices, sends
 * input with tmux, and reloads the matching Claude Code session history after
 * every interaction.
 *
 * @example
 * ```ts
 * const cc = container.feature('claudeController')
 * await cc.start({ id: 'main', cwd: container.paths.cwd })
 * await cc.ask('Inspect this repo and summarize the test strategy')
 * const state = await cc.refresh()
 * if (state.choices[0]) await cc.chooseOption(0)
 * ```
 */
export class ClaudeController extends Feature<ClaudeControllerState, ClaudeControllerOptions> {
  static override stateSchema = ClaudeControllerStateSchema
  static override optionsSchema = ClaudeControllerOptionsSchema
  static override eventsSchema = ClaudeControllerEventsSchema
  static override shortcut = 'features.claudeController' as const
  static { Feature.register(this, 'claudeController') }

  private handles = new Map<string, TmuxSession>()

  override get initialState(): ClaudeControllerState {
    return {
      ...super.initialState,
      controllers: {},
      activeController: undefined,
    }
  }

  get activeController(): string | undefined {
    return this.state.get('activeController')
  }

  private resolveCwd(cwd?: string): string {
    return cwd ?? this.options.cwd ?? (this.container as any).cwd ?? process.cwd()
  }

  private resolveClaudeCommand(options: ClaudeControllerStartOptions = {}): string {
    const base = options.command ?? this.options.claudePath ?? this.container.feature('claudeCode').claudePath ?? 'claude'
    const args = options.args ?? []
    return [base, ...args].map(shQuote).join(' ')
  }

  private controllerId(id?: string): string {
    return compactId(id ?? this.activeController ?? 'main')
  }

  private tmuxName(id: string, explicit?: string): string {
    return explicit ?? `${this.options.sessionPrefix ?? 'luca-claude'}-${compactId(id)}`
  }

  private async handle(id?: string): Promise<TmuxSession> {
    const key = this.controllerId(id)
    const existing = this.handles.get(key)
    if (existing) return existing
    const snapshot = (this.state.current.controllers as Record<string, ClaudeControllerSnapshot>)[key]
    if (!snapshot) throw new Error(`Claude controller ${key} has not been started`)
    const tmux = this.container.feature('tmux')
    const session = await tmux.session(snapshot.tmuxSession)
    this.handles.set(key, session)
    return session
  }

  /** Start or attach to an interactive Claude running in tmux. */
  async start(options: ClaudeControllerStartOptions = {}): Promise<ClaudeControllerSnapshot> {
    const id = this.controllerId(options.id)
    const cwd = this.resolveCwd(options.cwd)
    const tmuxSession = this.tmuxName(id, options.name)
    const tmux = this.container.feature('tmux')

    if (options.reuse === false && await tmux.hasSession(tmuxSession)) {
      await tmux.killSession(tmuxSession)
    }

    const session = await tmux.session(tmuxSession, {
      command: this.resolveClaudeCommand(options),
      cwd,
      width: options.width ?? this.options.width,
      height: options.height ?? this.options.height,
    })

    this.handles.set(id, session)
    this.setState({
      activeController: id,
      controllers: {
        ...this.state.current.controllers,
        [id]: { id, tmuxSession, cwd, pane: '', currentCommand: '', awaitingInput: false, choices: [], history: [], updatedAt: new Date().toISOString() },
      },
    })
    this.emit('controller:start', { id, tmuxSession })
    return this.refresh(id)
  }

  /** Capture tmux and reload the latest matching Claude JSONL history. */
  async refresh(id?: string): Promise<ClaudeControllerSnapshot> {
    const key = this.controllerId(id)
    const session = await this.handle(key)
    const previous = (this.state.current.controllers as Record<string, ClaudeControllerSnapshot>)[key]
    const [pane, currentCommand] = await Promise.all([
      session.capture({ lines: -300 }),
      session.currentCommand().catch(() => ''),
    ])

    const cwd = previous?.cwd ?? this.resolveCwd()
    const sessionInfo = await this.resolveSessionInfo(cwd, previous?.sessionId)
    const history = sessionInfo?.sessionId
      ? await this.container.feature('claudeCode').getConversationHistory(sessionInfo.sessionId, cwd)
      : []

    const snapshot: ClaudeControllerSnapshot = {
      id: key,
      tmuxSession: session.name,
      cwd,
      sessionId: sessionInfo?.sessionId ?? previous?.sessionId,
      sessionFile: sessionInfo?.filePath ?? previous?.sessionFile,
      pane,
      currentCommand,
      awaitingInput: detectClaudeAwaitingInput(pane, currentCommand),
      choices: parseClaudeChoices(pane),
      history,
      updatedAt: new Date().toISOString(),
    }

    const controllers = { ...this.state.current.controllers, [key]: snapshot }
    this.setState({ controllers, activeController: key })
    this.emit('controller:update', { id: key, snapshot })
    return snapshot
  }

  private async resolveSessionInfo(cwd: string, preferredSessionId?: string): Promise<{ sessionId: string; filePath: string; messageCount: number } | undefined> {
    const sessions = await this.container.feature('claudeCode').listSessionsForCwd(cwd)
    if (sessions.length === 0) return undefined
    if (preferredSessionId) {
      const exact = sessions.find((s: any) => s.sessionId === preferredSessionId)
      if (exact) return exact
    }
    return sessions.slice().sort((a: any, b: any) => b.messageCount - a.messageCount)[0]
  }

  /** Send a user message to Claude. By default waits until Claude appears ready again. */
  async ask(question: string, options: ClaudeControllerAskOptions = {}): Promise<ClaudeControllerSnapshot> {
    const key = this.controllerId()
    const session = await this.handle(key)
    await session.send(question)
    this.emit('controller:input', { id: key, text: question })
    await new Promise(r => setTimeout(r, this.options.settleMs ?? 250))
    if (options.wait === false) return this.refresh(key)
    return this.waitUntilReady(key, options)
  }

  /** Send raw text or a key to the interactive process. */
  async respond(input: string, options: { enter?: boolean; id?: string } = {}): Promise<ClaudeControllerSnapshot> {
    const key = this.controllerId(options.id)
    const session = await this.handle(key)
    if (options.enter === false) await session.sendKeys(input)
    else await session.send(input)
    this.emit('controller:input', { id: key, text: input })
    await new Promise(r => setTimeout(r, this.options.settleMs ?? 250))
    return this.refresh(key)
  }

  /** Select a currently visible choice by array offset, displayed number/key, or label. */
  async chooseOption(choice: number | string | ClaudeControllerChoice, id?: string): Promise<ClaudeControllerSnapshot> {
    const key = this.controllerId(id)
    const snapshot = await this.refresh(key)
    const selected = this.resolveChoice(choice, snapshot.choices)
    if (!selected) throw new Error(`Choice not found: ${String(choice)}`)
    const input = selected.key ?? (selected.index != null ? String(selected.index) : selected.label)
    const result = await this.respond(input, { id: key })
    this.emit('controller:choice', { id: key, choice: selected })
    return result
  }

  private resolveChoice(choice: number | string | ClaudeControllerChoice, choices: ClaudeControllerChoice[]): ClaudeControllerChoice | undefined {
    if (typeof choice === 'object') return choice
    if (typeof choice === 'number') {
      return choices.find(c => c.index === choice) ?? choices[choice]
    }
    const lowered = choice.toLowerCase()
    return choices.find(c => c.key?.toLowerCase() === lowered || c.label.toLowerCase() === lowered || c.label.toLowerCase().includes(lowered))
  }

  /** Return whether Claude currently appears to be waiting for input. */
  async isAwaitingInput(id?: string): Promise<boolean> {
    return (await this.refresh(id)).awaitingInput
  }

  /** Return currently visible choices/options from Claude's prompt. */
  async getOptions(id?: string): Promise<ClaudeControllerChoice[]> {
    return (await this.refresh(id)).choices
  }

  /** Poll until Claude appears ready for input or a permission choice. */
  async waitUntilReady(id?: string, options: { timeoutMs?: number; pollIntervalMs?: number } = {}): Promise<ClaudeControllerSnapshot> {
    const key = this.controllerId(id)
    const timeoutMs = options.timeoutMs ?? 120_000
    const pollIntervalMs = options.pollIntervalMs ?? 1000
    const started = Date.now()
    let last = await this.refresh(key)
    while (!last.awaitingInput) {
      if (Date.now() - started > timeoutMs) return last
      await new Promise(r => setTimeout(r, pollIntervalMs))
      last = await this.refresh(key)
    }
    return last
  }

  /** Stop a tmux-backed Claude controller. */
  async stop(id?: string): Promise<void> {
    const key = this.controllerId(id)
    const session = await this.handle(key)
    await session.kill()
    this.handles.delete(key)
    const controllers = { ...this.state.current.controllers }
    delete controllers[key]
    this.setState({ controllers, activeController: this.state.current.activeController === key ? undefined : this.state.current.activeController })
    this.emit('controller:stop', { id: key })
  }
}

export default ClaudeController
