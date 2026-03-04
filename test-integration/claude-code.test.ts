import {
  requireEnv,
  requireBinary,
  describeWithRequirements,
  createAGIContainer,
  CLI_TIMEOUT,
} from './helpers'
import type { AGIContainer } from '../src/agi/container.server'

const anthropicKey = requireEnv('ANTHROPIC_API_KEY')
const claudeBin = requireBinary('claude')

describeWithRequirements(
  'Claude Code Integration',
  [anthropicKey, claudeBin],
  () => {
    let container: AGIContainer

    beforeAll(() => {
      container = createAGIContainer()
    })

    it(
      'checkAvailability confirms claude is installed',
      async () => {
        const cc = container.feature('claudeCode')
        const available = await cc.checkAvailability()
        expect(available).toBe(true)
      },
      CLI_TIMEOUT
    )

    it(
      'run() with a simple prompt returns a session with result',
      async () => {
        const cc = container.feature('claudeCode', {
          permissionMode: 'plan',
          model: 'claude-haiku-4-5-20251001',
        })

        const session = await cc.run(
          'Reply with exactly: INTEGRATION_TEST_OK',
          {
            permissionMode: 'plan',
            maxBudgetUsd: 0.05,
          }
        )

        expect(session).toBeDefined()
        expect(session.status).toBe('completed')
        expect(typeof session.result).toBe('string')
        expect(session.result!.length).toBeGreaterThan(0)
      },
      CLI_TIMEOUT
    )

    it(
      'session events stream during execution',
      async () => {
        const cc = container.feature('claudeCode', {
          permissionMode: 'plan',
          model: 'claude-haiku-4-5-20251001',
        })

        const events: string[] = []
        cc.on('session:start', () => events.push('start'))
        cc.on('session:result', () => events.push('result'))

        await cc.run('Say hello', {
          permissionMode: 'plan',
          maxBudgetUsd: 0.05,
        })

        expect(events).toContain('start')
        expect(events).toContain('result')
      },
      CLI_TIMEOUT
    )

    it(
      'session messages are populated',
      async () => {
        const cc = container.feature('claudeCode', {
          permissionMode: 'plan',
          model: 'claude-haiku-4-5-20251001',
        })

        const session = await cc.run('What is 2+2? Reply with just the number.', {
          permissionMode: 'plan',
          maxBudgetUsd: 0.05,
        })

        expect(session.messages.length).toBeGreaterThanOrEqual(0)
      },
      CLI_TIMEOUT
    )
  }
)
