import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { AGIContainer } from '../src/agi/container.server'

describe('Assistant', () => {
	let container: AGIContainer

	beforeEach(() => {
		container = new AGIContainer()
	})

	describe('luca assistant', () => {
		it('loads a non-empty system prompt from CORE.md', () => {
			const assistant = container.feature('assistant', { folder: 'assistants/luca' })
			expect(assistant.systemPrompt.length).toBeGreaterThan(0)
			expect(assistant.systemPrompt).toContain('You are Luca')
		})

		it('loads tools from tools.ts and its `use` providers after start', async () => {
			const assistant = container.feature('assistant', {
				folder: 'assistants/luca',
				model: 'qwen/qwen3-8b',
			})
			await assistant.start()
			const tools = assistant.availableTools
			// declared directly in tools.ts
			expect(tools).toContain('searchDocs')
			expect(tools).toContain('README')
			// contributed by `export const use = [vm, skillsLibrary]`
			expect(tools).toContain('evalCode')
			expect(tools).toContain('loadSkill')
		})

		it('retains resolved use metadata after startup', async () => {
			const assistant = container.feature('assistant', {
				folder: 'assistants/luca',
				model: 'qwen/qwen3-8b',
				cached: false,
			})
			await assistant.start()

			const providers = assistant.configuredUse.map((entry: any) =>
				typeof entry?.toTools === 'function' ? entry.toTools().provider : entry.provider,
			)
			expect(providers.map((provider: any) => provider.name)).toEqual(['vm', 'skillsLibrary'])
			expect(providers[0]).toMatchObject({ totalToolCount: 1 })
			expect(providers[1]).toMatchObject({ totalToolCount: 3 })
		})

		it('tools have descriptions and parameter schemas', async () => {
			const assistant = container.feature('assistant', {
				folder: 'assistants/luca',
				model: 'qwen/qwen3-8b',
			})
			await assistant.start()
			const { searchDocs, evalCode } = assistant.tools
			expect(searchDocs.description.length).toBeGreaterThan(0)
			expect(searchDocs.parameters.type).toBe('object')
			expect(searchDocs.parameters.properties).toHaveProperty('query')
			expect(evalCode.parameters.type).toBe('object')
		})

		it('tools are wired into the conversation after start', async () => {
			const assistant = container.feature('assistant', {
				folder: 'assistants/luca',
				model: 'qwen/qwen3-8b',
			})
			await assistant.start()
			const convTools = assistant.conversation.tools
			expect(Object.keys(convTools)).toContain('searchDocs')
			expect(Object.keys(convTools)).toContain('evalCode')
		})

		it('tools from `use` reach a conversation that already existed before start', async () => {
			const assistant = container.feature('assistant', {
				folder: 'assistants/luca',
				model: 'qwen/qwen3-8b',
			})

			// Touching .conversation before start() builds it from the tool set as it
			// stands right then — before `export const use = [...]` has contributed
			// anything. Callers do this legitimately (e.g. to rebuild the conversation
			// with session-specific options), and the tools added during start() must
			// still reach it, or the model is offered an empty toolbox.
			const conversation = assistant.conversation
			expect(Object.keys(conversation.options.tools || {})).not.toContain('evalCode')

			await assistant.start()

			expect(assistant.conversation).toBe(conversation)
			expect(Object.keys(conversation.tools)).toContain('searchDocs')
			expect(Object.keys(conversation.tools)).toContain('evalCode')
		})
	})

	// assistants/luca ships no hooks.ts, so folder-based hook loading gets its own
	// throwaway assistant folder here. (Hook *dispatch* is covered in assistant-hooks.test.ts.)
	describe('folder hooks.ts', () => {
		let tmpDir: string

		beforeEach(() => {
			const rand = container.utils.uuid().slice(0, 8)
			tmpDir = container.paths.resolve(container.os.tmpdir, `luca-assistant-hooks-${rand}`)
			container.fs.mkdirSync(tmpDir, { recursive: true })
			container.fs.writeFileSync(`${tmpDir}/CORE.md`, 'You are a hook fixture.')
			container.fs.writeFileSync(
				`${tmpDir}/hooks.ts`,
				'export async function started() { return "ok" }\n',
			)
		})

		afterEach(() => {
			try { container.fs.rmSync(tmpDir, { recursive: true, force: true }) } catch {}
		})

		it('loads hooks from hooks.ts via the VM', () => {
			const assistant = container.feature('assistant', { folder: tmpDir, cached: false })
			const hooks = assistant.state.get('hooks') as Record<string, Function>
			expect(hooks).toBeDefined()
			expect(typeof hooks.started).toBe('function')
		})

		it('hooks fire when the assistant starts', async () => {
			const assistant = container.feature('assistant', {
				folder: tmpDir,
				model: 'qwen/qwen3-8b',
				cached: false,
			})

			// triggerHook emits 'hookFired' with the hook name each time a hook runs
			const fired: string[] = []
			assistant.on('hookFired', (eventName: string) => { fired.push(eventName) })

			await assistant.start()
			expect(fired).toContain('started')
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
