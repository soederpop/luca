import {
  requireEnv,
  describeWithRequirements,
  createAGIContainer,
  API_TIMEOUT,
} from './helpers'
import type { AGIContainer } from '../src/agi/container.server'

const openaiKey = requireEnv('OPENAI_API_KEY')

describeWithRequirements('Conversation Integration', [openaiKey], () => {
  let container: AGIContainer

  beforeAll(() => {
    container = createAGIContainer()
  })

  it(
    'ask() returns a response with content',
    async () => {
      const conv = container.feature('conversation', {
        model: 'gpt-4o-mini',
        history: [{ role: 'system', content: 'Reply with one short sentence.' }],
      })

      const reply = await conv.ask('What is 2 + 2?')
      expect(typeof reply).toBe('string')
      expect(reply.length).toBeGreaterThan(0)
      expect(reply.toLowerCase()).toContain('4')
    },
    API_TIMEOUT
  )

  it(
    'tool calling: defines a tool, verifies it gets called and result incorporated',
    async () => {
      const toolCalls: Array<{ name: string; args: any }> = []
      const conv = container.feature('conversation', {
        model: 'gpt-4o-mini',
        history: [
          {
            role: 'system',
            content:
              'You have a calculator tool. Always use it when asked to compute something. Reply with just the result.',
          },
        ],
        tools: {
          calculator: {
            handler: async (args: { expression: string }) => {
              return String(eval(args.expression))
            },
            description: 'Evaluates a math expression and returns the result',
            parameters: {
              type: 'object',
              properties: {
                expression: {
                  type: 'string',
                  description: 'A math expression like "2 + 2"',
                },
              },
              required: ['expression'],
            },
          },
        },
      })

      conv.on('toolCall', (name: string, args: any) =>
        toolCalls.push({ name, args })
      )

      const reply = await conv.ask('What is 15 * 7?')
      expect(reply).toContain('105')
      expect(toolCalls.length).toBeGreaterThanOrEqual(1)
      expect(toolCalls[0].name).toBe('calculator')
    },
    API_TIMEOUT
  )

  it(
    'streaming: chunk events fire during response',
    async () => {
      const chunks: string[] = []
      const conv = container.feature('conversation', {
        model: 'gpt-4o-mini',
        history: [{ role: 'system', content: 'Reply with exactly: Hello world' }],
      })

      conv.on('chunk', (text: string) => chunks.push(text))

      const reply = await conv.ask('Say hello')
      expect(reply.length).toBeGreaterThan(0)
      expect(chunks.length).toBeGreaterThan(0)
    },
    API_TIMEOUT
  )

  it(
    'messages accumulate across turns',
    async () => {
      const conv = container.feature('conversation', {
        model: 'gpt-4o-mini',
        history: [
          {
            role: 'system',
            content: 'Remember everything. Reply in one short sentence.',
          },
        ],
      })

      await conv.ask('My favorite color is blue.')
      expect(conv.messages.length).toBeGreaterThanOrEqual(3) // system + user + assistant

      await conv.ask('What is my favorite color?')
      expect(conv.messages.length).toBeGreaterThanOrEqual(5)
    },
    API_TIMEOUT
  )

  it(
    'turnStart and turnEnd events fire',
    async () => {
      const events: string[] = []
      const conv = container.feature('conversation', {
        model: 'gpt-4o-mini',
        history: [{ role: 'system', content: 'Reply briefly.' }],
      })

      conv.on('turnStart', () => events.push('turnStart'))
      conv.on('turnEnd', () => events.push('turnEnd'))

      await conv.ask('Hi')
      expect(events).toContain('turnStart')
      expect(events).toContain('turnEnd')
    },
    API_TIMEOUT
  )
})
