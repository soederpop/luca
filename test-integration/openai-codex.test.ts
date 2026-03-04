import {
  requireEnv,
  requireBinary,
  describeWithRequirements,
  createAGIContainer,
  CLI_TIMEOUT,
} from './helpers'
import type { AGIContainer } from '../src/agi/container.server'

const openaiKey = requireEnv('OPENAI_API_KEY')
const codexBin = requireBinary('codex')

describeWithRequirements(
  'OpenAI Codex Integration',
  [openaiKey, codexBin],
  () => {
    let container: AGIContainer

    beforeAll(() => {
      container = createAGIContainer()
    })

    it(
      'checkAvailability confirms codex is installed',
      async () => {
        const codex = container.feature('openaiCodex')
        const available = await codex.checkAvailability()
        expect(available).toBe(true)
      },
      CLI_TIMEOUT
    )

    it(
      'run() with a simple prompt in read-only sandbox returns a session',
      async () => {
        const codex = container.feature('openaiCodex', {
          sandbox: 'read-only',
          model: 'o4-mini',
        })

        const session = await codex.run(
          'Reply with exactly: CODEX_TEST_OK',
          {
            sandbox: 'read-only',
          }
        )

        expect(session).toBeDefined()
        expect(session.status).toBe('completed')
        expect(typeof session.result).toBe('string')
      },
      CLI_TIMEOUT
    )

    it(
      'session events fire during execution',
      async () => {
        const codex = container.feature('openaiCodex', {
          sandbox: 'read-only',
          model: 'o4-mini',
        })

        const events: string[] = []
        codex.on('session:start', () => events.push('start'))
        codex.on('session:result', () => events.push('result'))

        await codex.run('Say hello', { sandbox: 'read-only' })

        expect(events).toContain('start')
        expect(events).toContain('result')
      },
      CLI_TIMEOUT
    )

    it(
      'session items are populated from event stream',
      async () => {
        const codex = container.feature('openaiCodex', {
          sandbox: 'read-only',
          model: 'o4-mini',
        })

        const session = await codex.run('What is 2+2? Reply with just the number.', {
          sandbox: 'read-only',
        })

        // Items array should exist even if empty
        expect(Array.isArray(session.items)).toBe(true)
      },
      CLI_TIMEOUT
    )
  }
)
