import {
  requireEnv,
  describeWithRequirements,
  createAGIContainer,
  API_TIMEOUT,
} from './helpers'
import type { AGIContainer } from '../src/agi/container.server'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, realpathSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

const openaiKey = requireEnv('OPENAI_API_KEY')

describeWithRequirements('Assistant Integration', [openaiKey], () => {
  let container: AGIContainer
  let assistantDir: string
  let tempDir: string

  beforeAll(() => {
    tempDir = realpathSync(mkdtempSync(join(tmpdir(), 'luca-assistant-test-')))
    assistantDir = join(tempDir, 'assistants', 'test-helper')
    mkdirSync(assistantDir, { recursive: true })

    writeFileSync(
      join(assistantDir, 'CORE.md'),
      'You are a test assistant. Always reply with short, direct answers. If asked for your name, say "TestBot".'
    )

    container = createAGIContainer({ cwd: tempDir })
  })

  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  it(
    'creates assistant and ask() returns a response',
    async () => {
      const assistant = container.feature('assistant', {
        folder: assistantDir,
        model: 'gpt-4o-mini',
        historyMode: 'lifecycle',
      })

      await assistant.start()
      expect(assistant.isStarted).toBe(true)

      const reply = await assistant.ask('What is your name?')
      expect(typeof reply).toBe('string')
      expect(reply.length).toBeGreaterThan(0)
      expect(reply).toContain('TestBot')
    },
    API_TIMEOUT
  )

  it(
    'system prompt is loaded from CORE.md',
    async () => {
      const assistant = container.feature('assistant', {
        folder: assistantDir,
        model: 'gpt-4o-mini',
        historyMode: 'lifecycle',
      })

      await assistant.start()
      expect(assistant.systemPrompt).toContain('test assistant')
      expect(assistant.systemPrompt).toContain('TestBot')
    },
    API_TIMEOUT
  )

  it(
    'events fire during conversation',
    async () => {
      const events: string[] = []
      const assistant = container.feature('assistant', {
        folder: assistantDir,
        model: 'gpt-4o-mini',
        historyMode: 'lifecycle',
      })

      assistant.on('started', () => events.push('started'))
      assistant.on('turnStart', () => events.push('turnStart'))
      assistant.on('turnEnd', () => events.push('turnEnd'))
      assistant.on('response', () => events.push('response'))

      await assistant.start()
      expect(events).toContain('started')

      await assistant.ask('Hello')
      expect(events).toContain('turnStart')
      expect(events).toContain('turnEnd')
      expect(events).toContain('response')
    },
    API_TIMEOUT
  )

  it(
    'conversation state accumulates messages',
    async () => {
      const assistant = container.feature('assistant', {
        folder: assistantDir,
        model: 'gpt-4o-mini',
        historyMode: 'lifecycle',
      })

      await assistant.start()
      await assistant.ask('Remember: the secret code is 42.')
      await assistant.ask('What is the secret code?')

      const messages = assistant.messages
      expect(messages.length).toBeGreaterThanOrEqual(5) // system + 2 user + 2 assistant
    },
    API_TIMEOUT
  )

  it(
    'addTool and removeTool work at runtime',
    async () => {
      const assistant = container.feature('assistant', {
        folder: assistantDir,
        model: 'gpt-4o-mini',
        historyMode: 'lifecycle',
      })

      await assistant.start()

      const toolFn = async (args: { x: number }) => String(args.x * 2)
      assistant.addTool(toolFn, container.z.object({ x: container.z.number() }).describe('Doubles a number'))

      expect(assistant.tools).toHaveProperty('toolFn')

      assistant.removeTool('toolFn')
      expect(assistant.tools).not.toHaveProperty('toolFn')
    },
    API_TIMEOUT
  )
})
