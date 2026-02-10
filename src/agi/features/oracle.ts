import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'
import type { Container } from '@/container'
import { type AvailableFeatures, features, Feature } from '@/feature'
import type { OpenAIClient } from '../openai-client'
import type { Conversation } from './conversation'
import type { VM } from '@/node/features/vm'
import type { UI } from '@/node/features/ui'
import type vm from 'vm'
import type readline from 'readline'

declare module '@/feature' {
	interface AvailableFeatures {
		oracle: typeof Oracle
	}
}

export const OracleOptionsSchema = FeatureOptionsSchema.extend({
	/** The model to use for natural language interpretation */
	model: z.string().optional().describe('The model to use for natural language interpretation'),
	/** Custom prompt prefix to display */
	prompt: z.string().optional().describe('Custom prompt prefix to display'),
	/** Path for REPL history persistence */
	historyPath: z.string().optional().describe('Path for REPL history persistence'),
})

export const OracleStateSchema = FeatureStateSchema.extend({
	started: z.boolean().describe('Whether the Oracle session is active'),
	linesEvaluated: z.number().describe('Total lines evaluated'),
	codeExecutions: z.number().describe('Lines that ran as code'),
	aiQueries: z.number().describe('Lines that went to the AI'),
})

export type OracleOptions = z.infer<typeof OracleOptionsSchema>
export type OracleState = z.infer<typeof OracleStateSchema>

/**
 * The Oracle - an AI-augmented REPL where you can type JavaScript or natural
 * language interchangeably. The AI copilot knows everything about the container
 * via introspection metadata.
 *
 * Type code and it executes. Type English and the AI interprets it, generates
 * code if needed, and executes it — all in the same session with shared context.
 *
 * @example
 * ```typescript
 * const oracle = container.feature('oracle')
 * await oracle.start()
 * ```
 */
export class Oracle extends Feature<OracleState, OracleOptions> {
	static override stateSchema = OracleStateSchema
	static override optionsSchema = OracleOptionsSchema
	static override shortcut = 'features.oracle' as const

	static attach(container: Container<AvailableFeatures, any>) {
		features.register('oracle', Oracle)
		return container
	}

	private _conversation!: Conversation
	private _vm!: VM
	private _ui!: UI
	private _vmContext!: vm.Context
	private _rl!: readline.Interface

	override get initialState(): OracleState {
		return {
			...super.initialState,
			started: false,
			linesEvaluated: 0,
			codeExecutions: 0,
			aiQueries: 0,
		}
	}

	/** Whether the Oracle REPL session is currently active. */
	get isStarted() {
		return !!this.state.get('started')
	}

	/**
	 * Build the system prompt that teaches the AI about the entire container.
	 * Uses introspection so the AI knows every feature, method, event, and state shape.
	 */
	private buildSystemPrompt(): string {
		const containerChat = this.container.feature('containerChat') as any
		const featureDocs = containerChat.buildFeatureDocumentation()

		return this._ui.endent(`
			# The Oracle

			You are The Oracle, an AI copilot embedded in an interactive JavaScript REPL.
			The user can type JavaScript code or natural language. When they type natural language,
			you help them by answering questions or generating executable JavaScript snippets.

			## Your Environment

			You are running inside a Luca container — a dependency injection runtime with observable
			state, event buses, and registries of Features, Clients, and Servers.

			The following objects are already available in the REPL scope:
			- \`container\` - the global container singleton
			- Every enabled feature is available by its shortcut name (e.g. \`fs\`, \`git\`, \`ui\`, \`vm\`, etc.)

			## Available Features

			${this.container.features.available.map(f => `- ${f}`).join('\n')}

			## Feature Documentation

			${featureDocs}

			## How to Respond

			- If the user asks a question about the container, answer using your knowledge of the introspection data above.
			- If the user asks you to DO something, generate a JavaScript snippet they can run.
			- When generating code:
			  - Use pure JavaScript (no TypeScript, no imports, no exports)
			  - Use \`container.feature('name')\` or the shortcut variables already in scope
			  - Wrap async operations in an immediately invoked async function: \`(async () => { ... })()\`
			  - The code will be executed in a VM context with the container and all features available
			- If you generate a code snippet, wrap it in a \`\`\`javascript fenced code block.
			- Keep explanations concise. The user is a developer who knows JavaScript.
			- When asked "what can you do?" — describe your capabilities using the actual feature list.
		`)
	}

	/**
	 * Detect whether a line of input looks like JavaScript code or natural language.
	 */
	private looksLikeCode(input: string): boolean {
		const trimmed = input.trim()

		// Empty or single-word that could be a variable reference
		if (!trimmed) return false

		// Explicit JS patterns
		const codePatterns = [
			/^(var|let|const|function|class|import|export|return|throw|if|else|for|while|do|switch|try|catch|finally|new|delete|typeof|void|yield|async|await)\s/,
			/^(container|global|process|console|Math|JSON|Object|Array|String|Number|Boolean|Date|RegExp|Error|Promise|Map|Set|Symbol|Proxy|Reflect)\b/,
			/[=(){}\[\];]/, // assignment, calls, blocks, arrays, semicolons
			/^\w+\.\w+/,   // property access like container.features
			/^\/\//,        // comments
			/^`/,           // template literals
			/^\d+$/,        // just a number
			/^['"].*['"]$/, // string literal
			/^!!/,          // double bang
			/^\+\+|^--/,   // increment/decrement
			/=>/,           // arrow function
		]

		for (const pattern of codePatterns) {
			if (pattern.test(trimmed)) return true
		}

		// If it starts with a known feature shortcut, treat as code
		const availableFeatures = this.container.features.available
		const firstWord = trimmed.split(/[\s.(]/)[0]
		if (availableFeatures.includes(firstWord!)) return true

		return false
	}

	/**
	 * Extract JavaScript code blocks from an AI response.
	 */
	private extractCodeBlocks(text: string): string[] {
		const blocks: string[] = []
		const regex = /```(?:javascript|js)?\s*\n([\s\S]*?)```/g
		let match

		while ((match = regex.exec(text)) !== null) {
			blocks.push(match[1]!.trim())
		}

		return blocks
	}

	/**
	 * Execute code in the shared VM context and print the result.
	 */
	private async executeCode(code: string): Promise<any> {
		try {
			const result = await this._vm.run(code, this._vmContext)

			if (result !== undefined) {
				// Pretty-print objects, leave strings/numbers as-is
				if (typeof result === 'object' && result !== null) {
					console.log(Bun.inspect(result, { colors: true, depth: 4 }))
				} else {
					console.log(result)
				}
			}

			this.state.set('codeExecutions', (this.state.get('codeExecutions') || 0) + 1)
			return result
		} catch (err: any) {
			console.log(this._ui.colors.red(`Error: ${err.message}`))
			return err
		}
	}

	/**
	 * Send natural language to the AI, render the response, and execute
	 * any code blocks it returns.
	 */
	private async askAI(input: string): Promise<void> {
		this.state.set('aiQueries', (this.state.get('aiQueries') || 0) + 1)

		const spinnerFrames = ['   ...thinking', '   ..thinking.', '   .thinking..', '   thinking...']
		let frame = 0
		const spinner = setInterval(() => {
			process.stdout.write(`\r${this._ui.colors.dim(spinnerFrames[frame++ % spinnerFrames.length]!)}`)
		}, 200)

		let fullResponse = ''

		this._conversation.on('preview', (preview: string) => {
			clearInterval(spinner)
			process.stdout.write('\r\x1b[K') // clear spinner line
		})

		try {
			fullResponse = await this._conversation.ask(input)
		} finally {
			clearInterval(spinner)
			process.stdout.write('\r\x1b[K')
		}

		// Render the full response as markdown
		console.log()
		console.log(this._ui.markdown(fullResponse))

		// Extract and execute any code blocks
		const codeBlocks = this.extractCodeBlocks(fullResponse)

		if (codeBlocks.length > 0) {
			for (const block of codeBlocks) {
				console.log(this._ui.colors.dim('  executing generated code...'))
				await this.executeCode(block)
			}
		}
	}

	/**
	 * Handle a single line of input — detect code vs natural language and act.
	 */
	async handleInput(input: string): Promise<void> {
		const trimmed = input.trim()
		if (!trimmed) return

		this.state.set('linesEvaluated', (this.state.get('linesEvaluated') || 0) + 1)

		// Special commands
		if (trimmed === '.exit' || trimmed === 'exit') {
			this.stop()
			return
		}

		if (trimmed === '.stats') {
			console.log({
				linesEvaluated: this.state.get('linesEvaluated'),
				codeExecutions: this.state.get('codeExecutions'),
				aiQueries: this.state.get('aiQueries'),
			})
			return
		}

		if (this.looksLikeCode(trimmed)) {
			await this.executeCode(trimmed)
		} else {
			await this.askAI(trimmed)
		}
	}

	/**
	 * Start the Oracle REPL session.
	 */
	async start(options: { model?: string, historyPath?: string } = {}): Promise<this> {
		if (this.isStarted) return this

		this._ui = this.container.feature('ui') as any
		this._vm = this.container.feature('vm') as any

		// Set up shared VM context with container and all features
		const featureContext: Record<string, any> = {}
		for (const name of this.container.features.available) {
			try {
				featureContext[name] = this.container.feature(name as any)
			} catch {
				// skip features that fail to instantiate
			}
		}

		this._vmContext = this._vm.createContext({
			...featureContext,
			console,
			setTimeout,
			setInterval,
			clearTimeout,
			clearInterval,
			fetch,
			Bun,
		})

		// Set up the conversation with full container knowledge
		const model = options.model || this.options.model || 'gpt-4o'
		this._conversation = this.container.feature('conversation', {
			cached: false,
			model,
			history: [{ role: 'system', content: this.buildSystemPrompt() }],
		}) as any

		// Set up readline interface
		const readlineModule = await import('readline')
		this._rl = readlineModule.createInterface({
			input: process.stdin,
			output: process.stdout,
			terminal: true,
			// Try to set up history
			history: [] as string[],
		})

		const prompt = this.options.prompt || this._ui.colors.cyan('oracle') + this._ui.colors.dim(' > ')

		// Display banner
		console.log()
		console.log(this._ui.banner('Oracle', { font: 'Small', colors: ['cyan', 'blue', 'magenta'] as any }))
		console.log()
		console.log(this._ui.colors.dim('  Type JavaScript to execute it. Type English to talk to the AI.'))
		console.log(this._ui.colors.dim('  The AI knows everything about your container via introspection.'))
		console.log(this._ui.colors.dim('  Special commands: .exit, .stats'))
		console.log()

		this.state.set('started', true)
		this.emit('started')

		// REPL loop
		const askQuestion = (): void => {
			this._rl.question(prompt, async (input) => {
				await this.handleInput(input)
				if (this.isStarted) {
					askQuestion()
				}
			})
		}

		askQuestion()
		return this
	}

	/**
	 * Stop the Oracle session.
	 */
	stop(): void {
		this.state.set('started', false)

		if (this._rl) {
			this._rl.close()
		}

		console.log()
		console.log(this._ui.colors.dim('  Oracle session ended.'))

		const stats = {
			linesEvaluated: this.state.get('linesEvaluated'),
			codeExecutions: this.state.get('codeExecutions'),
			aiQueries: this.state.get('aiQueries'),
		}
		console.log(this._ui.colors.dim(`  ${stats.linesEvaluated} inputs | ${stats.codeExecutions} code | ${stats.aiQueries} AI queries`))
		console.log()

		this.emit('stopped', stats)
	}
}

export default features.register('oracle', Oracle)
