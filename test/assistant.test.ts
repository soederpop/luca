import { describe, it, expect, beforeEach } from 'bun:test'
import { AGIContainer } from '../src/agi/container.server'

describe('Assistant', () => {
	let container: AGIContainer

	beforeEach(() => {
		container = new AGIContainer()
	})

	describe('codingAssistant', () => {
		it('loads a non-empty system prompt from CORE.md', () => {
			const assistant = container.feature('assistant', { folder: 'assistants/codingAssistant' })
			expect(assistant.systemPrompt.length).toBeGreaterThan(0)
			expect(assistant.systemPrompt).toContain('coding assistant')
		})

		it('loads tools from codingTools feature after start', async () => {
			const assistant = container.feature('assistant', {
				folder: 'assistants/codingAssistant',
				model: 'qwen/qwen3-8b',
			})
			await assistant.start()
			const tools = assistant.availableTools
			expect(tools).toContain('rg')
			expect(tools).toContain('ls')
			expect(tools).toContain('cat')
			expect(tools.length).toBeGreaterThan(0)
		})

		it('retains resolved use metadata after startup', async () => {
			const assistant = container.feature('assistant', {
				folder: 'assistants/codingAssistant',
				model: 'qwen/qwen3-8b',
				cached: false,
			})
			await assistant.start()

			const providers = assistant.configuredUse.map((entry: any) =>
				typeof entry?.toTools === 'function' ? entry.toTools().provider : entry.provider,
			)
			expect(providers.map((provider: any) => provider.name)).toEqual([
				'codingTools', 'fileTools', 'processManager', 'skillsLibrary',
			])
			expect(providers[1]).toMatchObject({
				only: ['editFile', 'writeFile', 'deleteFile'],
				totalToolCount: 11,
			})
		})

		it('tools have descriptions and parameter schemas', async () => {
			const assistant = container.feature('assistant', {
				folder: 'assistants/codingAssistant',
				model: 'qwen/qwen3-8b',
			})
			await assistant.start()
			const { rg, ls, cat } = assistant.tools
			expect(rg.description.length).toBeGreaterThan(0)
			expect(rg.parameters.type).toBe('object')
			expect(rg.parameters.properties).toHaveProperty('args')
			expect(ls.parameters.properties).toHaveProperty('args')
			expect(cat.parameters.properties).toHaveProperty('args')
		})

		it('loads hooks from hooks.ts via the VM', () => {
			const assistant = container.feature('assistant', { folder: 'assistants/codingAssistant' })
			const hooks = assistant.state.get('hooks') as Record<string, Function>
			expect(hooks).toBeDefined()
			expect(typeof hooks.started).toBe('function')
		})

		it('hooks fire when the assistant starts', async () => {
			const assistant = container.feature('assistant', {
				folder: 'assistants/codingAssistant',
				model: 'qwen/qwen3-8b',
			})

			// triggerHook emits 'hookFired' with the hook name each time a hook runs
			const fired: string[] = []
			assistant.on('hookFired', (eventName: string) => { fired.push(eventName) })

			await assistant.start()
			expect(fired).toContain('started')
		})

		it('tools are wired into the conversation after start', async () => {
			const assistant = container.feature('assistant', {
				folder: 'assistants/codingAssistant',
				model: 'qwen/qwen3-8b',
			})
			await assistant.start()
			const convTools = assistant.conversation.tools
			expect(Object.keys(convTools)).toContain('rg')
			expect(Object.keys(convTools)).toContain('ls')
		})

		it('tools from `use` reach a conversation that already existed before start', async () => {
			const assistant = container.feature('assistant', {
				folder: 'assistants/codingAssistant',
				model: 'qwen/qwen3-8b',
			})

			// Touching .conversation before start() builds it from the tool set as it
			// stands right then — before `export const use = [...]` has contributed
			// anything. Callers do this legitimately (e.g. to rebuild the conversation
			// with session-specific options), and the tools added during start() must
			// still reach it, or the model is offered an empty toolbox.
			const conversation = assistant.conversation
			expect(Object.keys(conversation.options.tools || {})).not.toContain('rg')

			await assistant.start()

			expect(assistant.conversation).toBe(conversation)
			expect(Object.keys(conversation.tools)).toContain('rg')
			expect(Object.keys(conversation.tools)).toContain('ls')
		})
	})

	describe('tool filters', () => {
		it('shares filter decisions with the effective tool getter without dropping excluded tools', () => {
			const assistant = container.feature('assistant', {
				name: 'filter-test',
				cached: false,
				forbidTools: ['delete*'],
				tools: {
					readFile: () => 'read',
					deleteFile: () => 'deleted',
				},
			})

			expect(Object.keys(assistant.allTools).sort()).toEqual(['deleteFile', 'readFile'])
			expect(Object.keys(assistant.tools)).toEqual(['readFile'])
			expect(assistant.toolFilterDecision('deleteFile')).toEqual({
				included: false,
				excludedBy: 'forbidTools: delete*',
			})

			assistant.addTool('runtimeTool', () => 'runtime')
			expect(Object.keys(assistant.allTools).sort()).toEqual(['deleteFile', 'readFile', 'runtimeTool'])
			expect(assistant.toolSources.runtimeTool).toBe('runtime')
		})
	})

	describe('provider override vs frontmatter model', () => {
		function makeAssistant(options: Record<string, any>, meta: Record<string, any>) {
			const assistant = container.feature('assistant', { name: 'override-test', cached: false, ...options })
			assistant.state.set('meta', meta)
			return assistant
		}

		beforeEach(() => {
			container.feature('modelProviders').registerLocal('test-local', 'http://localhost:9999/v1', 'local-default-model')
		})

		it('drops the frontmatter model when the caller overrides the provider', () => {
			const assistant = makeAssistant({ provider: 'test-local' }, { model: 'gpt-5.2' })
			expect(assistant.conversation.model).toBe('local-default-model')
		})

		it('keeps the frontmatter model when no provider override is given', () => {
			const assistant = makeAssistant({}, { model: 'gpt-5.2', provider: 'test-local' })
			expect(assistant.conversation.model).toBe('gpt-5.2')
		})

		it('an explicit caller model wins even with a provider override', () => {
			const assistant = makeAssistant({ provider: 'test-local', model: 'caller-model' }, { model: 'gpt-5.2' })
			expect(assistant.conversation.model).toBe('caller-model')
		})
	})
})
