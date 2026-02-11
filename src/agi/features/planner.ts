import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'
import type { Container } from '@/container'
import { type AvailableFeatures } from '@/feature'
import { features, Feature } from '@/feature'
import { Collection, defineModel, section } from 'contentbase'
import { toString } from 'contentbase'
import type { Conversation } from './conversation'
import yaml from 'js-yaml'

declare module '@/feature' {
	interface AvailableFeatures {
		planner: typeof Planner
	}
}

// ─── Content Models ───

const TaskMetaSchema = z.object({
	id: z.string(),
	title: z.string(),
	status: z.enum(['pending', 'assigned', 'in_progress', 'completed', 'failed', 'blocked']).default('pending'),
	phase: z.number(),
	depends_on: z.array(z.string()).default([]),
	complexity: z.enum(['small', 'medium', 'large']).default('medium'),
	max_attempts: z.number().default(2),
	attempts: z.number().default(0),
	assigned_session: z.string().nullable().default(null),
	result_summary: z.string().nullable().default(null),
	cost_usd: z.number().default(0),
})

const ManifestMetaSchema = z.object({
	goal: z.string(),
	status: z.enum(['planning', 'ready', 'executing', 'reviewing', 'completed', 'failed']).default('planning'),
	architect_model: z.string().default('o3'),
	planner_model: z.string().default('o3'),
	coding_model: z.string().default('sonnet'),
	created_at: z.string().optional(),
	revision: z.number().default(0),
	max_revisions: z.number().default(2),
	max_concurrent: z.number().default(3),
	permission_mode: z.string().default('bypassPermissions'),
	project_path: z.string(),
	total_phases: z.number().default(1),
})

export type TaskMeta = z.infer<typeof TaskMetaSchema>
export type ManifestMeta = z.infer<typeof ManifestMetaSchema>

export const TaskModel = defineModel('Task', {
	prefix: 'tasks',
	meta: TaskMetaSchema,
	sections: {
		description: section('Description', {
			extract: (q) => q.selectAll('*').map((n) => toString(n)).join('\n'),
		}),
		agentInstructions: section('Agent Instructions', {
			extract: (q) => q.selectAll('*').map((n) => toString(n)).join('\n'),
		}),
		acceptanceCriteria: section('Acceptance Criteria', {
			extract: (q) => q.selectAll('listItem').map((n) => toString(n)),
		}),
	},
})

export const ManifestModel = defineModel('Manifest', {
	match: (doc: any) => doc.id === 'manifest',
	meta: ManifestMetaSchema,
	sections: {
		architecturalContext: section('Architectural Context', {
			extract: (q) => q.selectAll('*').map((n) => toString(n)).join('\n'),
		}),
		globalAgentInstructions: section('Global Agent Instructions', {
			extract: (q) => q.selectAll('*').map((n) => toString(n)).join('\n'),
		}),
		executionOrder: section('Execution Order', {
			extract: (q) => q.selectAll('*').map((n) => toString(n)),
		}),
		reviewCriteria: section('Review Criteria', {
			extract: (q) => q.selectAll('listItem').map((n) => toString(n)),
		}),
	},
})

// ─── Feature Schemas ───

export const PlannerStateSchema = FeatureStateSchema.extend({
	status: z.enum(['idle', 'planning', 'ready', 'revising']).default('idle'),
	buildPath: z.string().optional().describe('Path to the current build folder'),
	revisionCount: z.number().default(0),
})

export const PlannerOptionsSchema = FeatureOptionsSchema.extend({
	model: z.string().optional().describe('LLM model for the planner conversation'),
	projectPath: z.string().optional().describe('Root path of the project being built'),
	buildsRoot: z.string().optional().describe('Root folder for build outputs (defaults to .crew/builds)'),
})

export type PlannerState = z.infer<typeof PlannerStateSchema>
export type PlannerOptions = z.infer<typeof PlannerOptionsSchema>

// ─── System Prompt ───

const PLANNER_SYSTEM_PROMPT = `You are a senior project manager / technical planner for a programming team.

Your job: take an architect's plan and produce a folder of markdown task documents that coding agents will execute.

## Output Format

You must output a JSON object with two keys:
- "manifest": a string containing the full manifest.md file content (with YAML frontmatter)
- "tasks": an array of objects, each with "filename" (string like "01-project-setup.md") and "content" (string with full markdown + frontmatter)

## Manifest Format

The manifest.md must have YAML frontmatter with these fields:
\`\`\`yaml
---
goal: "<the project goal>"
status: ready
architect_model: o3
planner_model: o3
coding_model: sonnet
created_at: "<ISO timestamp>"
revision: 0
max_revisions: 2
max_concurrent: 3
permission_mode: bypassPermissions
project_path: "<project path>"
total_phases: <number>
---
\`\`\`

Followed by markdown sections:
- # Build Plan: <title>
- ## Architectural Context (paste/summarize the architect's design decisions)
- ## Global Agent Instructions (rules every coding agent must follow)
- ## Execution Order (one line per phase: "Phase N: task-id-1, task-id-2")
- ## Review Criteria (bullet list of what the architect will check)

## Task Document Format

Each task file must have YAML frontmatter:
\`\`\`yaml
---
id: <zero-padded-number-and-slug, e.g. "01-project-setup">
title: <human readable title>
status: pending
phase: <number>
depends_on:
  - <task-id that must complete first>
complexity: small | medium | large
max_attempts: 2
attempts: 0
assigned_session: null
result_summary: null
cost_usd: 0
---
\`\`\`

Followed by markdown sections:
- # <Task Title>
- ## Description (detailed description of what to build, multiple paragraphs OK)
- ## Files (with subsections ### Create, ### Modify, ### Reference — each a bullet list of file paths)
- ## Agent Instructions (additional context for the coding agent beyond global instructions)
- ## Acceptance Criteria (checkbox list: - [ ] criteria item)

## Planning Rules

1. Order tasks by dependencies. Phase 1 tasks have no dependencies. Phase 2 tasks depend only on Phase 1, etc.
2. Tasks in the same phase CAN run in parallel — make sure they don't modify the same files.
3. Keep tasks focused: each should be completable by one coding agent in one session.
4. The "id" field MUST match the filename without extension.
5. Be specific in descriptions — the coding agent is smart but has no context beyond what you give it.
6. Reference files are files the agent should READ for context but not modify.
7. Acceptance criteria should be as concrete and verifiable as possible.
8. Every task's Agent Instructions section should give enough context that the agent could work independently.

Respond ONLY with the JSON object. No other text.`

// ─── Planner Feature ───

export class Planner extends Feature<PlannerState, PlannerOptions> {
	static override stateSchema = PlannerStateSchema
	static override optionsSchema = PlannerOptionsSchema
	static override shortcut = 'features.planner' as const

	private _collection?: Collection
	private _conversation?: Conversation

	static attach(container: Container<AvailableFeatures, any>) {
		features.register('planner', Planner)
		return container
	}

	override get initialState(): PlannerState {
		return {
			...super.initialState,
			status: 'idle',
			revisionCount: 0,
		}
	}

	get buildsRoot(): string {
		return this.options.buildsRoot || (this.container as any).paths.resolve('.crew', 'builds')
	}

	get model(): string {
		return this.options.model || 'o3'
	}

	private generateBuildId(goal: string): string {
		const date = new Date().toISOString().slice(0, 10)
		const slug = goal
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-|-$/g, '')
			.slice(0, 40)
		return `${date}-${slug}`
	}

	async plan(architectOutput: string, options?: { projectPath?: string; goal?: string }): Promise<string> {
		this.setState({ status: 'planning' })
		this.emit('planning' as any)

		const projectPath = options?.projectPath || this.options.projectPath || process.cwd()
		const goal = options?.goal || 'Build the project'

		const buildId = this.generateBuildId(goal)
		const buildPath = `${this.buildsRoot}/${buildId}`

		this.setState({ buildPath })

		const conversation = this.createConversation(projectPath)
		this._conversation = conversation

		const prompt = `## Architect's Plan\n\n${architectOutput}\n\n## Project Details\n\nGoal: ${goal}\nProject path: ${projectPath}\n\nProduce the build manifest and task documents.`

		const response = await conversation.ask(prompt)

		await this.writeBuildDocuments(buildPath, response, { goal, projectPath })

		this.setState({ status: 'ready' })
		this.emit('planned' as any, buildPath)

		return buildPath
	}

	async revise(feedback: string): Promise<string> {
		const buildPath = this.state.get('buildPath')
		if (!buildPath) throw new Error('No active build to revise')
		if (!this._conversation) throw new Error('No active conversation to revise with')

		this.setState({ status: 'revising' })
		this.emit('revising' as any)

		const prompt = `## Revision Request\n\n${feedback}\n\nUpdate the manifest and any tasks that need changes. Use the same JSON format as before. Only include tasks that have changed — I'll keep unchanged tasks as-is.`

		const response = await this._conversation.ask(prompt)

		await this.writeBuildDocuments(buildPath, response, { merge: true })

		const revision = (this.state.get('revisionCount') || 0) + 1
		this.setState({ status: 'ready', revisionCount: revision })
		this.emit('revised' as any, buildPath, revision)

		return buildPath
	}

	async loadBuild(buildPath: string): Promise<Collection> {
		const collection = new Collection({ rootPath: buildPath })
		collection.register(TaskModel)
		collection.register(ManifestModel)
		await collection.load()
		this._collection = collection
		this.setState({ buildPath })
		return collection
	}

	async getTasks(options?: { status?: string; phase?: number }): Promise<any[]> {
		if (!this._collection) throw new Error('No build loaded. Call loadBuild() first.')

		let query = this._collection.query(TaskModel)

		if (options?.status) {
			query = query.where('meta.status', options.status)
		}
		if (options?.phase !== undefined) {
			query = query.where('meta.phase', options.phase)
		}

		return query.fetchAll()
	}

	async getManifest(): Promise<any> {
		if (!this._collection) throw new Error('No build loaded. Call loadBuild() first.')
		return this._collection.query(ManifestModel).first()
	}

	async updateTaskStatus(taskId: string, status: string, extras?: Record<string, any>): Promise<void> {
		if (!this._collection) throw new Error('No build loaded. Call loadBuild() first.')

		const doc = this._collection.document(`tasks/${taskId}`)
		const currentMeta = { ...doc.meta }

		const newMeta = { ...currentMeta, status, ...extras }
		const content = doc.content

		const rawContent = `---\n${yaml.dump(newMeta)}---\n\n${content}`
		await this._collection.saveItem(`tasks/${taskId}`, { content: rawContent, extension: '.md' })
	}

	async updateManifestStatus(status: string, extras?: Record<string, any>): Promise<void> {
		if (!this._collection) throw new Error('No build loaded. Call loadBuild() first.')

		const doc = this._collection.document('manifest')
		const currentMeta = { ...doc.meta }

		const newMeta = { ...currentMeta, status, ...extras }
		const content = doc.content

		const rawContent = `---\n${yaml.dump(newMeta)}---\n\n${content}`
		await this._collection.saveItem('manifest', { content: rawContent, extension: '.md' })
	}

	parseExecutionOrder(executionOrderLines: string[]): string[][] {
		const phases: string[][] = []
		for (const line of executionOrderLines) {
			const match = line.match(/^Phase\s+\d+:\s*(.+)$/i)
			if (match) {
				const taskIds = match[1].split(',').map((s) => s.trim()).filter(Boolean)
				phases.push(taskIds)
			}
		}
		return phases
	}

	private createConversation(projectPath: string): Conversation {
		const systemPrompt = PLANNER_SYSTEM_PROMPT

		return this.container.feature('conversation', {
			cached: false,
			model: this.model,
			history: [
				{ role: 'system', content: systemPrompt },
			],
		}) as unknown as Conversation
	}

	private async writeBuildDocuments(
		buildPath: string,
		llmResponse: string,
		options?: { goal?: string; projectPath?: string; merge?: boolean }
	): Promise<void> {
		let parsed: { manifest: string; tasks: Array<{ filename: string; content: string }> }

		try {
			const jsonMatch = llmResponse.match(/\{[\s\S]*\}/)
			if (!jsonMatch) throw new Error('No JSON found in LLM response')
			parsed = JSON.parse(jsonMatch[0])
		} catch (err: any) {
			throw new Error(`Failed to parse planner output: ${err.message}`)
		}

		const collection = new Collection({ rootPath: buildPath })
		collection.register(TaskModel)
		collection.register(ManifestModel)

		if (parsed.manifest) {
			await collection.saveItem('manifest', { content: parsed.manifest, extension: '.md' })
		}

		for (const task of parsed.tasks || []) {
			const taskId = task.filename.replace(/\.md$/, '')
			await collection.saveItem(`tasks/${taskId}`, { content: task.content, extension: '.md' })
		}

		await collection.load()
		this._collection = collection
	}
}

export default features.register('planner', Planner)
