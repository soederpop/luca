import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from '../../schemas/base.js'
import { Feature } from '../feature.js'
import { ClaudeSessionController } from './claude-session-controller'
import {
  type ClaudeControllerPersona,
  type ClaudeControllerSnapshot,
  type ClaudeControllerStartOptions,
  compactClaudeControllerId,
} from './claude-controller-shared'

export type {
  ClaudeControllerAskOptions,
  ClaudeControllerChoice,
  ClaudeControllerPersona,
  ClaudeControllerSnapshot,
  ClaudeControllerStartOptions,
} from './claude-controller-shared'

export { detectClaudeAwaitingInput, parseClaudeChoices } from './claude-controller-shared'

export const ClaudeControllerStateSchema = FeatureStateSchema.extend({
  controllers: z.record(z.string(), z.any()).describe('Map of controller IDs to latest snapshots'),
  activeController: z.string().optional().describe('Most recently spawned controller ID'),
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
  'controller:start': z.tuple([z.object({ id: z.string(), tmuxSession: z.string() })]).describe('Fired when an interactive Claude session starts'),
  'controller:update': z.tuple([z.object({ id: z.string(), snapshot: z.any() })]).describe('Fired after a session snapshot refresh'),
  'controller:stop': z.tuple([z.object({ id: z.string() })]).describe('Fired when a spawned Claude session is stopped'),
})

export type ClaudeControllerState = z.infer<typeof ClaudeControllerStateSchema>
export type ClaudeControllerOptions = z.infer<typeof ClaudeControllerOptionsSchema>

declare module 'luca/feature' {
  interface AvailableFeatures {
    claudeController: typeof ClaudeController
  }
}

/**
 * Multi-session spawner for interactive Claude Code workers.
 *
 * ClaudeController is intentionally only the registry/orchestrator for spawning
 * one or more `ClaudeSessionController` workers. Each worker owns the actual
 * tmux session, cwd, args, screen parsing, JSONL session lookup, and input APIs.
 * This keeps the feature singleton focused on lifecycle and tracking while the
 * per-session controller handles interactive behavior without `claude -p`.
 *
 * @example
 * ```ts
 * const controller = container.feature('claudeController')
 * const [docs, tests] = await controller.startMany([
 *   { id: 'docs', cwd: repo, args: ['--add-dir', repo] },
 *   { id: 'tests', cwd: repo, args: ['--permission-mode', 'acceptEdits'] },
 * ])
 * const docsWorker = controller.session('docs')
 * await docsWorker?.ask('Inspect the docs')
 * ```
 */
export class ClaudeController extends Feature<ClaudeControllerState, ClaudeControllerOptions> {
  static override stateSchema = ClaudeControllerStateSchema
  static override optionsSchema = ClaudeControllerOptionsSchema
  static override eventsSchema = ClaudeControllerEventsSchema
  static override shortcut = 'features.claudeController' as const
  static { Feature.register(this, 'claudeController') }

  private sessions = new Map<string, ClaudeSessionController>()
  private personas = new Map<string, ClaudeControllerPersona>()

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

  private controllerId(id?: string): string {
    return compactClaudeControllerId(id ?? this.activeController ?? 'main')
  }

  definePersona(name: string, persona: ClaudeControllerPersona): this {
    this.personas.set(name, persona)
    return this
  }

  getPersona(name: string): ClaudeControllerPersona | undefined {
    const persona = this.personas.get(name)
    return persona ? { ...persona } : undefined
  }

  listPersonas(): Array<{ name: string; persona: ClaudeControllerPersona }> {
    return Array.from(this.personas.entries()).map(([name, persona]) => ({ name, persona: { ...persona } }))
  }

  private resolvePersona(persona?: string | ClaudeControllerPersona): ClaudeControllerPersona {
    if (!persona) return {}
    if (typeof persona !== 'string') return persona
    const resolved = this.personas.get(persona)
    if (!resolved) throw new Error(`Unknown Claude controller persona: ${persona}`)
    return resolved
  }

  private compileArgs(persona: ClaudeControllerPersona, options: ClaudeControllerStartOptions): string[] {
    const args: string[] = []
    const systemPrompt = options.systemPrompt ?? persona.systemPrompt
    const appendSystemPrompt = options.appendSystemPrompt ?? persona.appendSystemPrompt
    const mcpConfig = [...(persona.mcpConfig ?? []), ...(options.mcpConfig ?? [])]
    const mcpServers = { ...(persona.mcpServers ?? {}), ...(options.mcpServers ?? {}) }
    const strictMcpConfig = options.strictMcpConfig ?? persona.strictMcpConfig
    const addDirs = [
      ...(persona.addDirs ?? []),
      ...(options.addDirs ?? []),
      ...(persona.skillsFolders ?? []),
      ...(options.skillsFolders ?? []),
    ]
    const tools = options.tools ?? persona.tools
    const allowedTools = options.allowedTools ?? persona.allowedTools
    const permissionMode = options.permissionMode ?? persona.permissionMode
    const settingsFile = options.settingsFile ?? persona.settingsFile

    if (systemPrompt) args.push('--system-prompt', systemPrompt)
    if (appendSystemPrompt) args.push('--append-system-prompt', appendSystemPrompt)
    const mcpConfigArgs = [...mcpConfig]
    if (Object.keys(mcpServers).length > 0) mcpConfigArgs.push(JSON.stringify({ mcpServers }))
    if (mcpConfigArgs.length) args.push('--mcp-config', ...mcpConfigArgs)
    if (strictMcpConfig) args.push('--strict-mcp-config')
    if (addDirs.length) args.push('--add-dir', ...addDirs)
    if (tools?.length) args.push('--tools', ...tools)
    if (allowedTools?.length) args.push('--allowed-tools', ...allowedTools)
    if (permissionMode) args.push('--permission-mode', permissionMode)
    if (settingsFile) args.push('--settings', settingsFile)
    if (options.args?.length) args.push(...options.args)

    return args
  }

  private sessionOptions(options: ClaudeControllerStartOptions = {}): ClaudeControllerStartOptions & { container: any; settleMs: number; claudePath?: string; sessionPrefix?: string } {
    const persona = this.resolvePersona(options.persona)
    return {
      ...persona,
      ...options,
      args: this.compileArgs(persona, options),
      id: this.controllerId(options.id),
      cwd: this.resolveCwd(options.cwd),
      width: options.width ?? this.options.width,
      height: options.height ?? this.options.height,
      container: this.container,
      settleMs: this.options.settleMs ?? 250,
      claudePath: this.options.claudePath,
      sessionPrefix: this.options.sessionPrefix ?? 'luca-claude',
    }
  }

  private remember(snapshot: ClaudeControllerSnapshot): ClaudeControllerSnapshot {
    const controllers = { ...this.state.current.controllers, [snapshot.id]: snapshot }
    this.setState({ controllers, activeController: snapshot.id })
    this.emit('controller:update', { id: snapshot.id, snapshot })
    return snapshot
  }

  /** Create a ClaudeSessionController worker without starting its tmux process. */
  create(options: ClaudeControllerStartOptions = {}): ClaudeSessionController {
    const worker = new ClaudeSessionController(this.sessionOptions(options))
    this.sessions.set(worker.id, worker)
    return worker
  }

  /** Start one interactive Claude session and track its worker. */
  async start(options: ClaudeControllerStartOptions = {}): Promise<ClaudeControllerSnapshot> {
    const worker = this.create(options)
    const snapshot = await worker.start()
    this.emit('controller:start', { id: worker.id, tmuxSession: worker.tmuxSession })
    return this.remember(snapshot)
  }

  /** Start multiple interactive Claude sessions concurrently. */
  async startMany(options: ClaudeControllerStartOptions[]): Promise<ClaudeControllerSnapshot[]> {
    return Promise.all(options.map(option => this.start(option)))
  }

  /** Alias for start(), emphasizing this feature's spawner role. */
  async spawn(options: ClaudeControllerStartOptions = {}): Promise<ClaudeControllerSnapshot> {
    return this.start(options)
  }

  /** Alias for startMany(), emphasizing this feature's spawner role. */
  async spawnMany(options: ClaudeControllerStartOptions[]): Promise<ClaudeControllerSnapshot[]> {
    return this.startMany(options)
  }

  /** Return a spawned worker by id. The worker owns ask/respond/choices/etc. */
  session(id?: string): ClaudeSessionController | undefined {
    return this.sessions.get(this.controllerId(id))
  }

  /** List spawned worker objects. */
  listSessions(): ClaudeSessionController[] {
    return [...this.sessions.values()]
  }

  /** Return latest tracked snapshots without touching tmux. */
  snapshots(): ClaudeControllerSnapshot[] {
    return Object.values(this.state.current.controllers as Record<string, ClaudeControllerSnapshot>)
  }

  /** Refresh one spawned worker's tracked snapshot. */
  async refresh(id?: string): Promise<ClaudeControllerSnapshot> {
    const key = this.controllerId(id)
    const worker = this.sessions.get(key)
    if (!worker) throw new Error(`Claude session ${key} has not been spawned`)
    return this.remember(await worker.refresh())
  }

  /** Refresh all spawned workers concurrently. */
  async refreshAll(): Promise<ClaudeControllerSnapshot[]> {
    return Promise.all([...this.sessions.values()].map(async worker => this.remember(await worker.refresh())))
  }

  /** Stop and forget one spawned Claude session. */
  async stop(id?: string): Promise<void> {
    const key = this.controllerId(id)
    const worker = this.sessions.get(key)
    if (!worker) throw new Error(`Claude session ${key} has not been spawned`)
    await worker.stop()
    this.sessions.delete(key)
    const controllers = { ...this.state.current.controllers }
    delete controllers[key]
    this.setState({ controllers, activeController: this.state.current.activeController === key ? undefined : this.state.current.activeController })
    this.emit('controller:stop', { id: key })
  }

  /** Stop and forget every spawned Claude session. */
  async stopAll(): Promise<void> {
    await Promise.all([...this.sessions.keys()].map(id => this.stop(id)))
  }
}

export default ClaudeController
