import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'
import type { Container } from '@/container'
import { type AvailableFeatures } from '@/feature'
import { features, Feature } from '@/feature'
import type { Planner } from './planner'
import type { ClaudeCode, ClaudeSession } from './claude-code'
import type { Conversation } from './conversation'
import yaml from 'js-yaml'

declare module '@/feature' {
	interface AvailableFeatures {
		crew: typeof Crew
	}
}

// ─── Schemas ───

export const CrewStateSchema = FeatureStateSchema.extend({
	status: z.enum(['idle', 'architecting', 'planning', 'executing', 'reviewing', 'completed', 'failed']).default('idle'),
	goal: z.string().optional(),
	buildPath: z.string().optional(),
	currentPhase: z.number().default(0),
	totalPhases: z.number().default(0),
	costUsd: z.number().default(0),
	revisionCount: z.number().default(0),
	tasksCompleted: z.number().default(0),
	totalTasks: z.number().default(0),
})

export const CrewOptionsSchema = FeatureOptionsSchema.extend({
	goal: z.string().optional().describe('The high-level goal for the team'),
	projectPath: z.string().optional().describe('Working directory for coding agents'),
	buildsRoot: z.string().optional().describe('Root folder for build outputs'),
	architectModel: z.string().optional().describe('Model for the architect (default: o3)'),
	plannerModel: z.string().optional().describe('Model for the PM/planner (default: o3)'),
	codingModel: z.string().optional().describe('Model for Claude Code sessions (default: sonnet)'),
	maxRevisions: z.number().optional().describe('Max review→revise loops (default: 2)'),
	maxConcurrentAgents: z.number().optional().describe('Max parallel coding agents (default: 3)'),
	permissionMode: z.enum(['default', 'acceptEdits', 'bypassPermissions']).optional().describe('Permission mode for coding agents'),
	dryRun: z.boolean().optional().describe('Stop after producing the build folder without executing'),
	architectSystemPrompt: z.string().optional().describe('Custom system prompt for the architect'),
})

export type CrewState = z.infer<typeof CrewStateSchema>
export type CrewOptions = z.infer<typeof CrewOptionsSchema>

export interface CrewResult {
	status: string
	buildPath: string
	costUsd: number
	phasesCompleted: number
	tasksCompleted: number
	totalTasks: number
	reviewPasses: number
}

// ─── Default Architect Prompt ───

const DEFAULT_ARCHITECT_PROMPT = `You are a senior software architect. You think about the bigger picture: how components fit together, what patterns to use, how to structure files, and how to build things in a way that's reusable and maintainable.

Given a project goal, produce a detailed architectural plan that covers:

1. **Overview**: What we're building and why
2. **Architecture**: The high-level design — layers, patterns, data flow
3. **Component Breakdown**: Each major component/module, what it does, and how it connects to others
4. **File Structure**: Proposed directory layout and key files
5. **Technology Choices**: Libraries, frameworks, and why
6. **Patterns & Conventions**: Coding conventions, error handling approach, naming patterns
7. **Risks & Considerations**: Edge cases, potential issues, things to watch out for

Be specific and opinionated. The coding agents will follow your plan literally.
Don't hedge — make decisions. If there are trade-offs, pick the better option and explain briefly why.`

// ─── Crew Feature ───

export class Crew extends Feature<CrewState, CrewOptions> {
	static override stateSchema = CrewStateSchema
	static override optionsSchema = CrewOptionsSchema
	static override shortcut = 'features.crew' as const

	private _architectConversation?: Conversation

	static attach(container: Container<AvailableFeatures, any>) {
		features.register('crew', Crew)
		return container
	}

	override get initialState(): CrewState {
		return {
			...super.initialState,
			status: 'idle',
			currentPhase: 0,
			totalPhases: 0,
			costUsd: 0,
			revisionCount: 0,
			tasksCompleted: 0,
			totalTasks: 0,
		}
	}

	get projectPath(): string {
		return this.options.projectPath || process.cwd()
	}

	get maxConcurrentAgents(): number {
		return this.options.maxConcurrentAgents || 3
	}

	get maxRevisions(): number {
		return this.options.maxRevisions || 2
	}

	get codingModel(): string {
		return this.options.codingModel || 'sonnet'
	}

	get permissionMode(): 'default' | 'acceptEdits' | 'bypassPermissions' {
		return this.options.permissionMode || 'bypassPermissions'
	}

	// ─── Main Entry Point ───

	async start(goal?: string): Promise<CrewResult> {
		const finalGoal = goal || this.options.goal
		if (!finalGoal) throw new Error('No goal provided. Pass a goal to start() or set it in options.')

		this.setState({ goal: finalGoal, status: 'architecting' })
		this.emit('statusChange' as any, 'architecting')

		try {
			// Step 1: Architect
			const architectPlan = await this.runArchitect(finalGoal)
			this.emit('architectComplete' as any, architectPlan)

			// Step 2: Planner
			this.setState({ status: 'planning' })
			this.emit('statusChange' as any, 'planning')
			const buildPath = await this.runPlanner(architectPlan, finalGoal)
			this.setState({ buildPath })
			this.emit('planComplete' as any, buildPath)

			// Dry run stops here
			if (this.options.dryRun) {
				this.setState({ status: 'completed' })
				this.emit('statusChange' as any, 'completed')
				return this.getResult()
			}

			// Step 3: Execute
			this.setState({ status: 'executing' })
			this.emit('statusChange' as any, 'executing')
			await this.executeBuild(buildPath)

			// Step 4: Review loop
			let approved = false
			let revisions = 0

			while (!approved && revisions < this.maxRevisions) {
				this.setState({ status: 'reviewing' })
				this.emit('statusChange' as any, 'reviewing')

				const review = await this.runReview(buildPath)

				if (review.approved) {
					approved = true
					this.emit('reviewApproved' as any, review.summary)
				} else {
					revisions++
					this.setState({ revisionCount: revisions })
					this.emit('revisionRequested' as any, review.feedback)

					// Revise and re-execute
					const planner = this.getPlanner()
					await planner.revise(review.feedback)
					this.setState({ status: 'executing' })
					this.emit('statusChange' as any, 'executing')
					await this.executeBuild(buildPath)
				}
			}

			this.setState({ status: 'completed' })
			this.emit('statusChange' as any, 'completed')
			return this.getResult()
		} catch (err: any) {
			this.setState({ status: 'failed' })
			this.emit('error' as any, err)
			throw err
		}
	}

	// ─── Architect ───

	async runArchitect(goal: string): Promise<string> {
		const systemPrompt = this.options.architectSystemPrompt || DEFAULT_ARCHITECT_PROMPT

		const conversation = this.container.feature('conversation', {
			cached: false,
			model: this.options.architectModel || 'o3',
			history: [
				{ role: 'system', content: systemPrompt },
			],
		}) as unknown as Conversation

		this._architectConversation = conversation

		const prompt = `## Project Goal\n\n${goal}\n\n## Project Path\n\n${this.projectPath}\n\nProduce your architectural plan.`

		const plan = await conversation.ask(prompt)
		return plan
	}

	// ─── Planner ───

	async runPlanner(architectPlan: string, goal: string): Promise<string> {
		const planner = this.getPlanner()

		const buildPath = await planner.plan(architectPlan, {
			projectPath: this.projectPath,
			goal,
		})

		// Load the build to count tasks and phases
		const collection = await planner.loadBuild(buildPath)
		const tasks = await planner.getTasks()
		const manifest = await planner.getManifest()

		const totalPhases = manifest?.meta?.total_phases || 1
		this.setState({
			totalPhases,
			totalTasks: tasks.length,
		})

		return buildPath
	}

	// ─── Execution Engine ───

	async executeBuild(buildPath: string): Promise<void> {
		const planner = this.getPlanner()

		// Make sure the build is loaded
		if (!planner.state.get('buildPath') || planner.state.get('buildPath') !== buildPath) {
			await planner.loadBuild(buildPath)
		}

		const manifest = await planner.getManifest()
		if (!manifest) throw new Error('No manifest found in build folder')

		// Parse execution order
		const executionOrder = planner.parseExecutionOrder(manifest.sections.executionOrder || [])

		await planner.updateManifestStatus('executing')

		const cc = this.container.feature('claudeCode') as unknown as ClaudeCode

		for (let phaseIndex = 0; phaseIndex < executionOrder.length; phaseIndex++) {
			const phaseTaskIds = executionOrder[phaseIndex]
			this.setState({ currentPhase: phaseIndex + 1 })
			this.emit('phaseStart' as any, phaseIndex + 1, phaseTaskIds)

			// Get the actual task documents for this phase
			const phaseTasks = await planner.getTasks({ phase: phaseIndex + 1 })
			const pendingTasks = phaseTasks.filter((t: any) => t.meta.status === 'pending')

			if (pendingTasks.length === 0) {
				this.emit('phaseSkipped' as any, phaseIndex + 1)
				continue
			}

			// Launch tasks in parallel batches
			const batches = this.batchTasks(pendingTasks, this.maxConcurrentAgents)

			for (const batch of batches) {
				const sessionPromises = batch.map(async (task: any) => {
					const taskId = task.meta.id

					await planner.updateTaskStatus(taskId, 'assigned')
					this.emit('taskStart' as any, taskId)

					const systemPrompt = this.buildCodingAgentPrompt(task, manifest)
					const taskPrompt = this.buildTaskPrompt(task)

					const sessionId = cc.start(taskPrompt, {
						model: this.codingModel,
						cwd: this.projectPath,
						systemPrompt,
						permissionMode: this.permissionMode,
					})

					await planner.updateTaskStatus(taskId, 'in_progress', { assigned_session: sessionId })

					const session = await cc.waitForSession(sessionId)

					const costUsd = session.costUsd || 0
					const totalCost = (this.state.get('costUsd') || 0) + costUsd

					if (session.status === 'completed') {
						const completed = (this.state.get('tasksCompleted') || 0) + 1
						this.setState({ tasksCompleted: completed, costUsd: totalCost })

						await planner.updateTaskStatus(taskId, 'completed', {
							result_summary: session.result?.slice(0, 500) || 'Completed',
							cost_usd: costUsd,
							attempts: (task.meta.attempts || 0) + 1,
						})

						this.emit('taskComplete' as any, taskId, session.result)
					} else {
						const attempts = (task.meta.attempts || 0) + 1
						const status = attempts < task.meta.max_attempts ? 'pending' : 'failed'

						this.setState({ costUsd: totalCost })

						await planner.updateTaskStatus(taskId, status, {
							result_summary: session.error || 'Failed',
							cost_usd: costUsd,
							attempts,
						})

						this.emit('taskFailed' as any, taskId, session.error)
					}

					return session
				})

				await Promise.all(sessionPromises)
			}

			this.emit('phaseComplete' as any, phaseIndex + 1)
		}
	}

	// ─── Review ───

	async runReview(buildPath: string): Promise<{ approved: boolean; summary: string; feedback: string }> {
		const planner = this.getPlanner()
		const manifest = await planner.getManifest()
		const allTasks = await planner.getTasks()

		if (!this._architectConversation) {
			throw new Error('No architect conversation to review with. Run the architect first.')
		}

		const taskSummaries = allTasks.map((task: any) => {
			return `### ${task.meta.title} (${task.meta.id})\n- Status: ${task.meta.status}\n- Result: ${task.meta.result_summary || 'N/A'}`
		}).join('\n\n')

		const reviewCriteria = (manifest.sections.reviewCriteria || []).map((c: string) => `- ${c}`).join('\n')

		const reviewPrompt = `## Review Request

The coding agents have finished executing. Please review the results against your architectural plan.

## Task Results

${taskSummaries}

## Review Criteria

${reviewCriteria}

## Instructions

Evaluate whether the work meets the architectural plan and review criteria. Respond with a JSON object:

If approved:
\`\`\`json
{ "approved": true, "summary": "Brief summary of what was accomplished" }
\`\`\`

If revisions are needed:
\`\`\`json
{ "approved": false, "summary": "What's wrong", "feedback": "Detailed revision instructions for the planner" }
\`\`\`

Respond ONLY with the JSON object.`

		const response = await this._architectConversation.ask(reviewPrompt)

		try {
			const jsonMatch = response.match(/\{[\s\S]*\}/)
			if (!jsonMatch) throw new Error('No JSON in review response')
			const review = JSON.parse(jsonMatch[0])

			// Write review document
			const reviewNum = (this.state.get('revisionCount') || 0) + 1
			const reviewContent = `---\nreview_number: ${reviewNum}\napproved: ${review.approved}\ndate: ${new Date().toISOString()}\n---\n\n# Review ${reviewNum}\n\n## Summary\n\n${review.summary}\n\n${review.feedback ? `## Revision Feedback\n\n${review.feedback}` : ''}`

			const collection = await planner.loadBuild(buildPath)
			await collection.saveItem(`reviews/review-${reviewNum}`, { content: reviewContent, extension: '.md' })

			return {
				approved: !!review.approved,
				summary: review.summary || '',
				feedback: review.feedback || '',
			}
		} catch (err: any) {
			throw new Error(`Failed to parse review response: ${err.message}`)
		}
	}

	// ─── Helpers ───

	private getPlanner(): Planner {
		return this.container.feature('planner', {
			cached: false,
			model: this.options.plannerModel || 'o3',
			projectPath: this.projectPath,
			buildsRoot: this.options.buildsRoot,
		}) as unknown as Planner
	}

	private buildCodingAgentPrompt(task: any, manifest: any): string {
		const parts: string[] = []

		const architecturalContext = manifest.sections?.architecturalContext
		if (architecturalContext) {
			parts.push(`## Architectural Context\n\n${architecturalContext}`)
		}

		const globalInstructions = manifest.sections?.globalAgentInstructions
		if (globalInstructions) {
			parts.push(`## Global Instructions\n\n${globalInstructions}`)
		}

		const agentInstructions = task.sections?.agentInstructions
		if (agentInstructions) {
			parts.push(`## Task-Specific Instructions\n\n${agentInstructions}`)
		}

		return parts.join('\n\n')
	}

	private buildTaskPrompt(task: any): string {
		const parts: string[] = []

		parts.push(`# ${task.meta.title}`)
		parts.push(`\n## Description\n\n${task.sections?.description || task.document?.content || ''}`)

		const criteria = task.sections?.acceptanceCriteria
		if (criteria?.length) {
			parts.push(`\n## Acceptance Criteria\n\n${criteria.map((c: string) => `- ${c}`).join('\n')}`)
		}

		return parts.join('\n')
	}

	private batchTasks(tasks: any[], batchSize: number): any[][] {
		const batches: any[][] = []
		for (let i = 0; i < tasks.length; i += batchSize) {
			batches.push(tasks.slice(i, i + batchSize))
		}
		return batches
	}

	private getResult(): CrewResult {
		return {
			status: this.state.get('status') || 'idle',
			buildPath: this.state.get('buildPath') || '',
			costUsd: this.state.get('costUsd') || 0,
			phasesCompleted: this.state.get('currentPhase') || 0,
			tasksCompleted: this.state.get('tasksCompleted') || 0,
			totalTasks: this.state.get('totalTasks') || 0,
			reviewPasses: this.state.get('revisionCount') || 0,
		}
	}
}

export default features.register('crew', Crew)
