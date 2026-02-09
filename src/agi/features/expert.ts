import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'
import type { Container } from '@/container';
import { type AvailableFeatures } from '@/feature'
import { features, Feature } from '@/feature'
import type { Identity } from './identity'
import type { Conversation, ConversationTool } from './conversation'

declare module '@/feature' {
	interface AvailableFeatures {
		expert: typeof Expert
	}
}

export type Skills = Record<string, (...args: any[]) => Promise<any>>
export type SkillSchemas = Record<string, z.ZodType>
export type Hooks = Record<string, (expert: Expert, ...args: any[]) => void | Promise<void>>

export const ExpertStateSchema = FeatureStateSchema.extend({
	name: z.string().describe('Name identifier for this expert'),
	folder: z.string().describe('Path to the expert identity folder'),
	started: z.boolean().describe('Whether the expert has been initialized'),
	messages: z.array(z.any()).describe('Chat message history for this expert'),
})

export const ExpertOptionsSchema = FeatureOptionsSchema.extend({
	/** Name of this expert, used as an identifier */
	name: z.string().optional().describe('Name of this expert, used as an identifier'),
	/** Path to the expert's identity folder (e.g. experts/core) */
	folder: z.string().optional().describe('Path to the expert identity folder (e.g. experts/core)'),
})

export type ExpertState = z.infer<typeof ExpertStateSchema>
export type ExpertOptions = z.infer<typeof ExpertOptionsSchema>

/**
 * An Expert is a chat agent backed by an Identity loaded from a folder on disk.
 * Experts are coordinated by the container to perform specialized tasks.
 *
 * Each expert's folder contains a SYSTEM-PROMPT.md, memories.json, and optional skills.ts and hooks.ts files.
 *
 * @extends Feature
 */
export class Expert extends Feature<ExpertState, ExpertOptions> {
	static override stateSchema = ExpertStateSchema
	static override optionsSchema = ExpertOptionsSchema
	static override shortcut = 'features.expert' as const

	skills: Skills = {}
	skillSchemas: SkillSchemas = {}
	hooks: Hooks = {}

	static attach(container: Container<AvailableFeatures, any>) {
		features.register('expert', Expert)
		return container
	}

	override get initialState(): ExpertState {
		return {
			...super.initialState,
			name: '',
			folder: ''
		}
	}

	get identity() : Identity {
		return this.container.feature('identity', {
			name: this.options.name,
			basePath: (this.container as any).paths.resolve('experts', this.options.folder)
		})
	}

	buildTools(): Record<string, ConversationTool> {
		const tools: Record<string, ConversationTool> = {}
		const toJsonSchema = (this.container as any).utils.zodToJsonSchema

		for (const [name, handler] of Object.entries(this.skills)) {
			const schema = this.skillSchemas[name]
			if (!schema) continue

			const jsonSchema = toJsonSchema(schema)

			tools[name] = {
				handler,
				description: jsonSchema.description || name,
				parameters: {
					type: jsonSchema.type || 'object',
					properties: jsonSchema.properties || {},
					...(jsonSchema.required ? { required: jsonSchema.required } : {}),
				}
			}
		}

		return tools
	}

	createConversation() : Conversation {
		const systemPrompt = this.identity.generatePrompt()
		const tools = this.buildTools()

		return this.container.feature('conversation', {
			model: 'gpt-5',
			tools,
			history: [
				{
					role: 'system',
					content: systemPrompt
				}
			]
		})
	}

	get isStarted() {
		return !!this.state.get('started')
	}

	conversation?: Conversation

	async start() {
		await this.identity.load()
		await this.loadSkills()
		await this.loadHooks()
		this.bindHooks()

		this.conversation = this.createConversation()
		this.state.set('started', true)
	
		return this
	}

	/**
	 * Loads the skills.ts file from the expert's folder if it exists.
	 * Skills are transformed from TypeScript/ESM to CJS and executed in the VM
	 * with the container in scope, exposing exported async functions as this.skills.
	 *
	 * @returns {Promise<void>}
	 */
	async loadSkills() {
		const c = this.container as any
		const basePath = c.paths.resolve('experts', this.options.folder)
		const skillsPath = c.paths.resolve(basePath, 'skills.ts')

		if (!c.fs.exists(skillsPath)) return

		const source = await c.fs.readFileAsync(skillsPath)
		const transformed = await c.feature('esbuild').transform(source.toString(), { format: 'cjs' })

		const mod = { exports: {} as Record<string, any> }
		await c.feature('vm').run(transformed.code, { container: c, module: mod, exports: mod.exports })

		const { schemas = {}, ...skills } = mod.exports
		this.skills = skills
		this.skillSchemas = schemas
	}

	/**
	 * Loads the hooks.ts file from the expert's folder if it exists.
	 * Hooks are transformed from TypeScript/ESM to CJS and executed in the VM
	 * with the container in scope. Hook functions should match event names emitted by the expert.
	 *
	 * @returns {Promise<void>}
	 */
	async loadHooks() {
		const c = this.container as any
		const basePath = c.paths.resolve('experts', this.options.folder)
		const hooksPath = c.paths.resolve(basePath, 'hooks.ts')

		if (!c.fs.exists(hooksPath)) return

		const source = await c.fs.readFileAsync(hooksPath)
		const transformed = await c.feature('esbuild').transform(source.toString(), { format: 'cjs' })

		const mod = { exports: {} as Record<string, any> }
		await c.feature('vm').run(transformed.code, { container: c, module: mod, exports: mod.exports })

		this.hooks = mod.exports
	}

	/**
	 * Binds hooks to their corresponding events. Each hook function name should match
	 * an event name emitted by the expert. The hook will be called with (expert, ...eventArgs).
	 *
	 * @returns {void}
	 */
	bindHooks() {
		for (const [eventName, hook] of Object.entries(this.hooks)) {
			if (typeof hook === 'function') {
				this.on(eventName as any, (...args: any[]) => {
					hook(this, ...args)
				})
			}
		}
	}

	async ask(question: string) {
		if(!this.isStarted) {
			await this.start()
		}

		if(!this.conversation) {
			return 'Expert is not started'	
		}

		this.conversation.on('preview', (chunk: string) => {
			this.emit('preview', chunk)
		})

		return this.conversation.ask(question)
	}
	
}

export default features.register('expert', Expert)
