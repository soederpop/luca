import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'
import type { Container } from '@/container';
import { type AvailableFeatures } from '@/feature'
import { features, Feature } from '@/feature'
import type { Identity } from './identity'
import type { OpenAIClient } from '../openai-client';
import type OpenAI from 'openai';

declare module '@/feature' {
	interface AvailableFeatures {
		expert: typeof Expert
	}
}

export type Skills = Record<string, (...args: any[]) => Promise<any>>

export const ExpertStateSchema = FeatureStateSchema.extend({
	name: z.string(),
	folder: z.string(),
	started: z.boolean(),
	messages: z.array(z.any()),
})

export const ExpertOptionsSchema = FeatureOptionsSchema.extend({
	/** Name of this expert, used as an identifier */
	name: z.string().optional(),
	/** Path to the expert's identity folder (e.g. experts/core) */
	folder: z.string().optional(),
})

export type ExpertState = z.infer<typeof ExpertStateSchema>
export type ExpertOptions = z.infer<typeof ExpertOptionsSchema>

/**
 * An Expert is a chat agent backed by an Identity loaded from a folder on disk.
 * Experts are coordinated by the container to perform specialized tasks.
 *
 * Each expert's folder contains a SYSTEM-PROMPT.md, memories.json, and optional skills.
 *
 * @extends Feature
 */
export class Expert extends Feature<ExpertState, ExpertOptions> {
	static override stateSchema = ExpertStateSchema
	static override optionsSchema = ExpertOptionsSchema
	static override shortcut = 'features.expert' as const

	openai!: OpenAIClient
	skills: Skills = {}

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

	get isStarted() {
		return !!this.state.get('started')
	}

	async start() {
		this.openai = (this.container as any).client('openai') as OpenAIClient
		await this.identity.load()
		await this.loadSkills()
		this.state.set('started', true)
		this.state.set('messages', [{
			role: 'system',
			content: this.identity.generatePrompt()
		}])
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

		const mod = { exports: {} as Skills }
		await c.feature('vm').run(transformed.code, { container: c, module: mod, exports: mod.exports })

		this.skills = mod.exports
	}

	async ask(question: string) {
		if(!this.isStarted) {
			await this.start()
		}

		this.state.set('messages', [
			...this.state.get('messages')!,
			{
				role: 'user',
				content: question
			}
		])

		const response = await this.openai.createChatCompletion(this.state.get('messages')!, {
			model: "o3-mini"
		})
		
		return response.choices[0]!.message.content || ''
	}
	
}

export default features.register('expert', Expert)
