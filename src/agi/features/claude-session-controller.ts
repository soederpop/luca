import type { TmuxSession } from '../../node/features/tmux'
import {
  type ClaudeControllerAskOptions,
  type ClaudeControllerChoice,
  type ClaudeControllerSnapshot,
  type ClaudeControllerStartOptions,
  detectClaudeAwaitingInput,
  parseClaudeChoices,
} from './claude-controller'

export interface ClaudeSessionControllerOptions extends ClaudeControllerStartOptions {
  container: any
  settleMs?: number
  claudePath?: string
  sessionPrefix?: string
}

function shQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`
}

function compactId(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'default'
}

/**
 * Single interactive Claude Code session controller.
 *
 * Unlike ClaudeController, this class intentionally has no registry of workers:
 * one instance owns one cwd, one tmux session, one Claude command/arg set, and
 * one latest snapshot. ClaudeController can later become the multi-session
 * orchestrator that creates and tracks these per-worker controllers.
 */
export class ClaudeSessionController {
  readonly id: string
  readonly cwd: string
  readonly tmuxSession: string
  readonly args: string[]
  readonly command?: string
  readonly width?: number
  readonly height?: number
  readonly reuse?: boolean
  readonly settleMs: number

  private container: any
  private claudePath?: string
  private handle?: TmuxSession
  private latest?: ClaudeControllerSnapshot

  constructor(options: ClaudeSessionControllerOptions) {
    this.container = options.container
    this.id = compactId(options.id ?? 'main')
    this.cwd = options.cwd ?? this.container.cwd ?? process.cwd()
    this.args = options.args ?? []
    this.command = options.command
    this.width = options.width
    this.height = options.height
    this.reuse = options.reuse
    this.settleMs = options.settleMs ?? 250
    this.claudePath = options.claudePath
    this.tmuxSession = options.name ?? `${options.sessionPrefix ?? 'luca-claude'}-${this.id}`
  }

  get snapshot(): ClaudeControllerSnapshot | undefined {
    return this.latest
  }

  get session(): TmuxSession | undefined {
    return this.handle
  }

  private resolveClaudeCommand(): string {
    const base = this.command ?? this.claudePath ?? this.container.feature('claudeCode').claudePath ?? 'claude'
    return [base, ...this.args].map(shQuote).join(' ')
  }

  private async tmux(): Promise<any> {
    return this.container.feature('tmux')
  }

  private async sessionHandle(): Promise<TmuxSession> {
    if (this.handle) return this.handle
    const tmux = await this.tmux()
    this.handle = await tmux.session(this.tmuxSession)
    return this.handle!
  }

  /** Start or attach to this session's interactive Claude process. */
  async start(): Promise<ClaudeControllerSnapshot> {
    const tmux = await this.tmux()
    if (this.reuse === false && await tmux.hasSession(this.tmuxSession)) {
      await tmux.killSession(this.tmuxSession)
    }

    this.handle = await tmux.session(this.tmuxSession, {
      command: this.resolveClaudeCommand(),
      cwd: this.cwd,
      width: this.width,
      height: this.height,
    })

    this.latest = {
      id: this.id,
      tmuxSession: this.tmuxSession,
      cwd: this.cwd,
      pane: '',
      currentCommand: '',
      awaitingInput: false,
      choices: [],
      history: [],
      updatedAt: new Date().toISOString(),
    }

    return this.refresh()
  }

  /** Capture tmux and reload the latest matching Claude JSONL history. */
  async refresh(): Promise<ClaudeControllerSnapshot> {
    const session = await this.sessionHandle()
    const [pane, currentCommand] = await Promise.all([
      session.capture({ lines: -300 }),
      session.currentCommand().catch(() => ''),
    ])

    const sessionInfo = await this.resolveSessionInfo(this.latest?.sessionId)
    const history = sessionInfo?.sessionId
      ? await this.container.feature('claudeCode').getConversationHistory(sessionInfo.sessionId, this.cwd)
      : []

    this.latest = {
      id: this.id,
      tmuxSession: session.name ?? this.tmuxSession,
      cwd: this.cwd,
      sessionId: sessionInfo?.sessionId ?? this.latest?.sessionId,
      sessionFile: sessionInfo?.filePath ?? this.latest?.sessionFile,
      pane,
      currentCommand,
      awaitingInput: detectClaudeAwaitingInput(pane, currentCommand),
      choices: parseClaudeChoices(pane),
      history,
      updatedAt: new Date().toISOString(),
    }

    return this.latest
  }

  private async resolveSessionInfo(preferredSessionId?: string): Promise<{ sessionId: string; filePath: string; messageCount: number } | undefined> {
    const sessions = await this.container.feature('claudeCode').listSessionsForCwd(this.cwd)
    if (sessions.length === 0) return undefined
    if (preferredSessionId) {
      const exact = sessions.find((s: any) => s.sessionId === preferredSessionId)
      if (exact) return exact
    }
    return sessions.slice().sort((a: any, b: any) => b.messageCount - a.messageCount)[0]
  }

  /** Send a user message to Claude. By default waits until Claude appears ready again. */
  async ask(question: string, options: ClaudeControllerAskOptions = {}): Promise<ClaudeControllerSnapshot> {
    const session = await this.sessionHandle()
    await session.send(question)
    await new Promise(r => setTimeout(r, this.settleMs))
    if (options.wait === false) return this.refresh()
    return this.waitUntilReady(options)
  }

  /** Send raw text or a key to the interactive process. */
  async respond(input: string, options: { enter?: boolean } = {}): Promise<ClaudeControllerSnapshot> {
    const session = await this.sessionHandle()
    if (options.enter === false) await session.sendKeys(input)
    else await session.send(input)
    await new Promise(r => setTimeout(r, this.settleMs))
    return this.refresh()
  }

  /** Select a currently visible choice by array offset, displayed number/key, or label. */
  async chooseOption(choice: number | string | ClaudeControllerChoice): Promise<ClaudeControllerSnapshot> {
    const snapshot = await this.refresh()
    const selected = this.resolveChoice(choice, snapshot.choices)
    if (!selected) throw new Error(`Choice not found: ${String(choice)}`)
    const input = selected.key ?? (selected.index != null ? String(selected.index) : selected.label)
    return this.respond(input)
  }

  private resolveChoice(choice: number | string | ClaudeControllerChoice, choices: ClaudeControllerChoice[]): ClaudeControllerChoice | undefined {
    if (typeof choice === 'object') return choice
    if (typeof choice === 'number') return choices.find(c => c.index === choice) ?? choices[choice]
    const lowered = choice.toLowerCase()
    return choices.find(c => c.key?.toLowerCase() === lowered || c.label.toLowerCase() === lowered || c.label.toLowerCase().includes(lowered))
  }

  async isAwaitingInput(): Promise<boolean> {
    return (await this.refresh()).awaitingInput
  }

  async getOptions(): Promise<ClaudeControllerChoice[]> {
    return (await this.refresh()).choices
  }

  /** Poll until Claude appears ready for input or a permission choice. */
  async waitUntilReady(options: { timeoutMs?: number; pollIntervalMs?: number } = {}): Promise<ClaudeControllerSnapshot> {
    const timeoutMs = options.timeoutMs ?? 120_000
    const pollIntervalMs = options.pollIntervalMs ?? 1000
    const started = Date.now()
    let last = await this.refresh()
    while (!last.awaitingInput) {
      if (Date.now() - started > timeoutMs) return last
      await new Promise(r => setTimeout(r, pollIntervalMs))
      last = await this.refresh()
    }
    return last
  }

  async stop(): Promise<void> {
    const session = await this.sessionHandle()
    await session.kill()
    this.handle = undefined
    this.latest = undefined
  }
}

export default ClaudeSessionController
