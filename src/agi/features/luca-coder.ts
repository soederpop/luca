import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from '../../schemas/base.js'
import { Feature } from '@soederpop/luca/feature'
import type { AGIContainer } from '../container.server.js'
import type { Assistant } from './assistant.js'
import type { ToolCallCtx } from '../lib/interceptor-chain.js'

declare module '@soederpop/luca/feature' {
	interface AvailableFeatures {
		lucaCoder: typeof LucaCoder
	}
}

/** Permission level for a tool. 'allow' runs immediately, 'ask' blocks for user approval, 'deny' rejects. */
export type PermissionLevel = 'allow' | 'ask' | 'deny'

/** A pending approval awaiting user decision. */
export interface PendingApproval {
	id: string
	toolName: string
	args: Record<string, any>
	timestamp: number
	resolve: (decision: 'approve' | 'deny') => void
}

/** Tool bundle spec — either a feature name string, or an object with filtering. */
export type ToolBundleSpec = string | {
	feature: string
	only?: string[]
	except?: string[]
}

export const LucaCoderEventsSchema = FeatureEventsSchema.extend({
	started: z.tuple([]).describe('Emitted when the luca coder has been initialized'),
	permissionRequest: z.tuple([z.object({
		id: z.string().describe('Unique approval ID'),
		toolName: z.string().describe('The tool requesting permission'),
		args: z.record(z.string(), z.any()).describe('The arguments the tool was called with'),
	})]).describe('Emitted when a tool call requires user approval'),
	permissionGranted: z.tuple([z.string().describe('Approval ID')]).describe('Emitted when a pending tool call is approved'),
	permissionDenied: z.tuple([z.string().describe('Approval ID')]).describe('Emitted when a pending tool call is denied'),
	toolBlocked: z.tuple([z.string().describe('Tool name'), z.string().describe('Reason')]).describe('Emitted when a tool call is blocked by deny policy'),
	// Forwarded from inner assistant
	chunk: z.tuple([z.string().describe('A chunk of streamed text')]).describe('Forwarded: streamed token chunk from the inner assistant'),
	response: z.tuple([z.string().describe('The final response text')]).describe('Forwarded: complete response from the inner assistant'),
	toolCall: z.tuple([z.string().describe('Tool name'), z.any().describe('Tool arguments')]).describe('Forwarded: a tool was called'),
	toolResult: z.tuple([z.string().describe('Tool name'), z.any().describe('Result value')]).describe('Forwarded: a tool returned a result'),
	toolError: z.tuple([z.string().describe('Tool name'), z.any().describe('Error')]).describe('Forwarded: a tool call failed'),
})

export const LucaCoderStateSchema = FeatureStateSchema.extend({
	started: z.boolean().describe('Whether the assistant has been initialized'),
	permissions: z.record(z.string(), z.enum(['allow', 'ask', 'deny'])).describe('Permission level per tool name'),
	defaultPermission: z.enum(['allow', 'ask', 'deny']).describe('Permission level for tools not explicitly configured'),
	pendingApprovals: z.array(z.object({
		id: z.string(),
		toolName: z.string(),
		args: z.record(z.string(), z.any()),
		timestamp: z.number(),
	})).describe('Tool calls currently awaiting user approval'),
	approvalHistory: z.array(z.object({
		id: z.string(),
		toolName: z.string(),
		decision: z.enum(['approve', 'deny']),
		timestamp: z.number(),
	})).describe('Recent approval decisions'),
	loadedSkills: z.array(z.string()).describe('Names of skills auto-loaded into context'),
})

export const LucaCoderOptionsSchema = FeatureOptionsSchema.extend({
	/** Tool bundles to stack — feature names or objects with filtering. */
	tools: z.array(z.union([
		z.string(),
		z.object({
			feature: z.string(),
			only: z.array(z.string()).optional(),
			except: z.array(z.string()).optional(),
		}),
	])).default([]).describe('Tool bundles to register on the inner assistant'),

	/** Per-tool permission overrides. */
	permissions: z.record(z.string(), z.enum(['allow', 'ask', 'deny'])).default({}).describe('Permission level per tool name'),

	/** Default permission for tools not in the permissions map. */
	defaultPermission: z.enum(['allow', 'ask', 'deny']).default('ask').describe('Default permission level for unconfigured tools'),

	/** System prompt for the inner assistant. */
	systemPrompt: z.string().optional().describe('System prompt for the inner assistant'),

	/** Model to use. */
	model: z.string().optional().describe('OpenAI model override'),

	/** Whether to use a local API server. */
	local: z.boolean().default(false).describe('Use a local API server for the inner assistant'),

	/** History mode for the inner assistant. */
	historyMode: z.enum(['lifecycle', 'daily', 'persistent', 'session']).optional().describe('Conversation history persistence mode'),

	/** Assistant folder — if provided, loads CORE.md/tools.ts/hooks.ts from disk. */
	folder: z.string().optional().describe('Assistant folder for disk-based definitions'),

	/** Skills to auto-load into the system prompt context. If not specified, auto-detects luca-framework. */
	skills: z.array(z.string()).optional().describe('Skill names to auto-load into the system prompt'),

	/** Whether to auto-detect and load the luca-framework skill. Defaults to true. */
	autoLoadLucaSkill: z.boolean().default(true).describe('Auto-load luca-framework skill if found in .claude/skills path'),
})

export type LucaCoderState = z.infer<typeof LucaCoderStateSchema>
export type LucaCoderOptions = z.infer<typeof LucaCoderOptionsSchema>

/**
 * A coding assistant that owns a lower-level Assistant instance and
 * gates all tool calls through a permission system.
 *
 * Comes with built-in Bash tool (via proc.execAndCapture) and auto-loads
 * the luca-framework skill when found in .claude/skills paths.
 *
 * Tools are stacked from feature bundles (fileTools, etc.)
 * and each tool can be set to 'allow' (runs immediately), 'ask' (blocks
 * until user approves/denies), or 'deny' (always rejected).
 *
 * @example
 * ```typescript
 * const coder = container.feature('lucaCoder', {
 *   tools: ['fileTools'],
 *   permissions: {
 *     readFile: 'allow',
 *     searchFiles: 'allow',
 *     writeFile: 'ask',
 *     bash: 'ask',
 *   },
 *   defaultPermission: 'ask',
 *   systemPrompt: 'You are a coding assistant.',
 * })
 *
 * coder.on('permissionRequest', ({ id, toolName, args }) => {
 *   console.log(`Tool "${toolName}" wants to run with`, args)
 *   coder.approve(id)  // or coder.deny(id)
 * })
 *
 * await coder.ask('Refactor the auth module to use async/await')
 * ```
 *
 * @extends Feature
 */
export class LucaCoder extends Feature<LucaCoderState, LucaCoderOptions> {
	static override shortcut = 'features.lucaCoder' as const
	static override stateSchema = LucaCoderStateSchema
	static override optionsSchema = LucaCoderOptionsSchema
	static override eventsSchema = LucaCoderEventsSchema

	static { Feature.register(this, 'lucaCoder') }

	/** The inner assistant instance. Created during start(). */
	private _assistant: Assistant | null = null

	/** Map of pending approval promises keyed by ID. */
	private _pendingResolvers = new Map<string, (decision: 'approve' | 'deny') => void>()

	override get initialState(): LucaCoderState {
		return {
			...super.initialState,
			started: false,
			permissions: this.options.permissions || {},
			defaultPermission: this.options.defaultPermission || 'ask',
			pendingApprovals: [],
			approvalHistory: [],
			loadedSkills: [],
		}
	}

	override get container(): AGIContainer {
		return super.container as AGIContainer
	}

	/** The inner assistant. Throws if not started. */
	get assistant(): Assistant {
		if (!this._assistant) throw new Error('LucaCoder not started. Call start() first.')
		return this._assistant
	}

	/** Current permission map from state. */
	get permissions(): Record<string, PermissionLevel> {
		return this.state.get('permissions') as Record<string, PermissionLevel>
	}

	/** Current pending approvals. */
	get pendingApprovals(): PendingApproval[] {
		const stored = this.state.get('pendingApprovals') as Array<{ id: string; toolName: string; args: Record<string, any>; timestamp: number }>
		return stored.map(p => ({
			...p,
			resolve: this._pendingResolvers.get(p.id) || (() => {}),
		}))
	}

	/** Whether the assistant is started and ready. */
	get isStarted(): boolean {
		return this.state.get('started') as boolean
	}

	/** The tools registered on the inner assistant. */
	get tools(): Record<string, any> {
		return this._assistant?.tools || {}
	}

	/** The conversation on the inner assistant (if started). */
	get conversation() {
		return this._assistant?.conversation
	}

	/** Messages from the inner assistant's conversation. */
	get messages() {
		return this._assistant?.messages || []
	}

	// -------------------------------------------------------------------------
	// Permission management
	// -------------------------------------------------------------------------

	/** Get the effective permission level for a tool. */
	getPermission(toolName: string): PermissionLevel {
		const perms = this.permissions
		if (perms[toolName]) return perms[toolName]
		return this.state.get('defaultPermission') as PermissionLevel
	}

	/** Set permission level for one or more tools. */
	setPermission(toolName: string | string[], level: PermissionLevel): this {
		const names = Array.isArray(toolName) ? toolName : [toolName]
		const perms = { ...this.permissions }
		for (const name of names) {
			perms[name] = level
		}
		this.state.set('permissions', perms)
		return this
	}

	/** Set the default permission level for unconfigured tools. */
	setDefaultPermission(level: PermissionLevel): this {
		this.state.set('defaultPermission', level)
		return this
	}

	/** Allow a tool (or tools) to run without approval. */
	permitTool(...toolNames: string[]): this {
		return this.setPermission(toolNames, 'allow')
	}

	/** Require approval before a tool (or tools) can run. */
	gateTool(...toolNames: string[]): this {
		return this.setPermission(toolNames, 'ask')
	}

	/** Block a tool (or tools) from ever running. */
	blockTool(...toolNames: string[]): this {
		return this.setPermission(toolNames, 'deny')
	}

	// -------------------------------------------------------------------------
	// Approval flow
	// -------------------------------------------------------------------------

	/** Approve a pending tool call by ID. The tool will execute. */
	approve(id: string): this {
		const resolver = this._pendingResolvers.get(id)
		if (resolver) {
			resolver('approve')
			this._removePending(id)
			this._recordDecision(id, 'approve')
			this.emit('permissionGranted', id)
		}
		return this
	}

	/** Deny a pending tool call by ID. The tool call will be skipped. */
	deny(id: string): this {
		const resolver = this._pendingResolvers.get(id)
		if (resolver) {
			resolver('deny')
			this._removePending(id)
			this._recordDecision(id, 'deny')
			this.emit('permissionDenied', id)
		}
		return this
	}

	/** Approve all pending tool calls. */
	approveAll(): this {
		for (const { id } of this.pendingApprovals) {
			this.approve(id)
		}
		return this
	}

	/** Deny all pending tool calls. */
	denyAll(): this {
		for (const { id } of this.pendingApprovals) {
			this.deny(id)
		}
		return this
	}

	// -------------------------------------------------------------------------
	// Bash tool
	// -------------------------------------------------------------------------

	/**
	 * Execute a shell command string and return its output.
	 * Uses proc.execAndCapture under the hood — runs `sh -c <command>`.
	 */
	async bash({ command, cwd, timeout }: { command: string; cwd?: string; timeout?: number }): Promise<{
		exitCode: number
		stdout: string
		stderr: string
		success: boolean
	}> {
		const proc = this.container.feature('proc')
		const options: Record<string, any> = {
			cwd: cwd ?? this.container.cwd,
		}
		if (timeout) options.timeout = timeout

		const result = await proc.execAndCapture(command, options)

		return {
			exitCode: result.exitCode,
			stdout: result.stdout,
			stderr: result.stderr,
			success: result.exitCode === 0,
		}
	}

	// -------------------------------------------------------------------------
	// Project instructions
	// -------------------------------------------------------------------------

	/**
	 * Read project instruction files (CLAUDE.md, AGENTS.md, LUCA.md) from the
	 * project root if they exist, and return their combined content.
	 */
	private _loadProjectInstructions(): string {
		const { fs, paths } = this.container
		const cwd = this.container.cwd
		const candidates = ['CLAUDE.md', 'AGENTS.md', 'LUCA.md']
		const sections: string[] = []
		const seen = new Set<string>()

		for (const filename of candidates) {
			const filePath = paths.resolve(cwd, filename)
			if (!fs.exists(filePath)) continue

			// Resolve symlinks so we don't read the same file twice
			const realPath = fs.realpath(filePath)
			if (seen.has(realPath)) continue
			seen.add(realPath)

			const content = fs.readFile(filePath)
			sections.push(`# ${filename}\n\n${content}`)
		}

		return sections.join('\n\n---\n\n')
	}

	// -------------------------------------------------------------------------
	// Skill loading
	// -------------------------------------------------------------------------

	/**
	 * Detect and load skills into the system prompt context.
	 * Auto-loads luca-framework if found and autoLoadLucaSkill is true.
	 */
	private async _loadSkillsIntoContext(): Promise<string> {
		const { fs, paths, os } = this.container
		const skillContent: string[] = []
		const loadedSkills: string[] = []

		// Check for luca-framework skill in known locations
		if (this.options.autoLoadLucaSkill !== false) {
			const skillLocations = [
				paths.resolve(this.container.cwd, '.claude', 'skills', 'luca-framework', 'SKILL.md'),
				paths.resolve(os.homedir, '.claude', 'skills', 'luca-framework', 'SKILL.md'),
			]

			for (const skillPath of skillLocations) {
				if (fs.exists(skillPath)) {
					const content = fs.readFile(skillPath)
					skillContent.push(`# Skill: luca-framework\n\n${content}`)
					loadedSkills.push('luca-framework')
					break // Only load once
				}
			}
		}

		// Load explicitly requested skills via skillsLibrary
		if (this.options.skills?.length) {
			const lib = this.container.feature('skillsLibrary')
			if (!lib.isStarted) await lib.start()

			for (const skillName of this.options.skills) {
				if (loadedSkills.includes(skillName)) continue
				const skill = lib.find(skillName)
				if (skill) {
					const content = fs.readFile(skill.skillFilePath)
					skillContent.push(`# Skill: ${skillName}\n\n${content}`)
					loadedSkills.push(skillName)
				}
			}
		}

		this.state.set('loadedSkills', loadedSkills)
		return skillContent.join('\n\n---\n\n')
	}

	// -------------------------------------------------------------------------
	// Lifecycle
	// -------------------------------------------------------------------------

	/**
	 * Initialize the inner assistant, register the bash tool, stack tool bundles,
	 * auto-load skills, and wire up the permission interceptor.
	 */
	async start(): Promise<this> {
		if (this.isStarted) return this

		// Load project instructions and skill content for system prompt
		const projectInstructions = this._loadProjectInstructions()
		const skillContext = await this._loadSkillsIntoContext()

		// Build the system prompt: base prompt + project instructions + skills
		const parts: string[] = []
		if (this.options.systemPrompt) parts.push(this.options.systemPrompt)
		if (projectInstructions) parts.push(projectInstructions)
		if (skillContext) parts.push(skillContext)
		const systemPrompt = parts.join('\n\n---\n\n')

		// Create the inner assistant
		const assistantOpts: Record<string, any> = {}
		if (systemPrompt) assistantOpts.systemPrompt = systemPrompt
		if (this.options.model) assistantOpts.model = this.options.model
		if (this.options.local) assistantOpts.local = this.options.local
		if (this.options.historyMode) assistantOpts.historyMode = this.options.historyMode
		if (this.options.folder) assistantOpts.folder = this.options.folder

		this._assistant = this.container.feature('assistant', assistantOpts)

		// Register the built-in bash tool
		const bashSchema = z.object({
			command: z.string().describe('The shell command to execute. Supports pipes, redirects, chaining with && or ;'),
			cwd: z.string().optional().describe('Working directory for the command. Defaults to project root.'),
			timeout: z.number().optional().describe('Timeout in milliseconds. Defaults to no timeout.'),
		}).describe('Execute a shell command and return stdout, stderr, and exit code. Use this for running builds, tests, git commands, installing packages, or any shell operation.')

		this._assistant.addTool(
			'bash',
			(args: { command: string; cwd?: string; timeout?: number }) => this.bash(args),
			bashSchema,
		)

		// Stack tool bundles
		for (const spec of this.options.tools) {
			this._stackToolBundle(spec)
		}

		// Wire the permission interceptor
		this._assistant.intercept('beforeToolCall', async (ctx: ToolCallCtx, next: () => Promise<void>) => {
			const policy = this.getPermission(ctx.name)

			if (policy === 'deny') {
				ctx.skip = true
				ctx.result = JSON.stringify({ blocked: true, tool: ctx.name, reason: 'Permission denied by policy.' })
				this.emit('toolBlocked', ctx.name, 'deny policy')
				return
			}

			if (policy === 'allow') {
				await next()
				return
			}

			// 'ask' — block until user decides
			const decision = await this._requestApproval(ctx.name, ctx.args)

			if (decision === 'approve') {
				await next()
			} else {
				ctx.skip = true
				ctx.result = JSON.stringify({ blocked: true, tool: ctx.name, reason: 'User denied this action.' })
			}
		})

		// Forward events from inner assistant
		this._assistant.on('chunk', (text: string) => this.emit('chunk', text))
		this._assistant.on('response', (text: string) => this.emit('response', text))
		this._assistant.on('toolCall', (name: string, args: any) => this.emit('toolCall', name, args))
		this._assistant.on('toolResult', (name: string, result: any) => this.emit('toolResult', name, result))
		this._assistant.on('toolError', (name: string, error: any) => this.emit('toolError', name, error))

		// Start the inner assistant
		await this._assistant.start()

		this.state.set('started', true)
		this.emit('started')

		return this
	}

	/**
	 * Ask the coder a question. Auto-starts if needed.
	 * Tool calls will be gated by the permission system.
	 */
	async ask(question: string, options?: Record<string, any>): Promise<string> {
		if (!this.isStarted) await this.start()
		return this.assistant.ask(question, options)
	}

	/**
	 * Add a tool bundle after initialization. Useful for dynamically
	 * extending the assistant's capabilities.
	 */
	use(spec: ToolBundleSpec): this {
		this._stackToolBundle(spec)
		return this
	}

	// -------------------------------------------------------------------------
	// Internal
	// -------------------------------------------------------------------------

	/** Resolve a tool bundle spec and register its tools on the inner assistant. */
	private _stackToolBundle(spec: ToolBundleSpec): void {
		if (!this._assistant) throw new Error('Cannot stack tools before start()')

		const featureName = typeof spec === 'string' ? spec : spec.feature
		const filterOpts = typeof spec === 'string' ? undefined : {
			only: spec.only,
			except: spec.except,
		}

		const feature = this.container.feature(featureName as any)
		const tools = (feature as any).toTools(filterOpts)
		this._assistant.use(tools)
	}

	/** Create a pending approval, emit the event, and return a promise that resolves with the decision. */
	private _requestApproval(toolName: string, args: Record<string, any>): Promise<'approve' | 'deny'> {
		const id = this.container.utils.uuid()

		return new Promise<'approve' | 'deny'>((resolve) => {
			this._pendingResolvers.set(id, resolve)

			const pending = [...(this.state.get('pendingApprovals') as any[])]
			pending.push({ id, toolName, args, timestamp: Date.now() })
			this.state.set('pendingApprovals', pending)

			this.emit('permissionRequest', { id, toolName, args })
		})
	}

	/** Remove a pending approval from state. */
	private _removePending(id: string): void {
		this._pendingResolvers.delete(id)
		const pending = (this.state.get('pendingApprovals') as any[]).filter((p: any) => p.id !== id)
		this.state.set('pendingApprovals', pending)
	}

	/** Record a decision in the approval history. */
	private _recordDecision(id: string, decision: 'approve' | 'deny'): void {
		const pending = (this.state.get('pendingApprovals') as any[]).find((p: any) => p.id === id)
		const history = [...(this.state.get('approvalHistory') as any[])]
		history.push({
			id,
			toolName: pending?.toolName || 'unknown',
			decision,
			timestamp: Date.now(),
		})
		// Keep last 100 entries
		if (history.length > 100) history.splice(0, history.length - 100)
		this.state.set('approvalHistory', history)
	}
}

export default LucaCoder
