import { describe, expect, it } from 'bun:test'
import { AGIContainer } from '../src/agi/container.server'
import { ClaudeController, detectClaudeAwaitingInput, parseClaudeChoices } from '../src/agi/features/claude-controller'
import { ClaudeSessionController } from '../src/agi/features/claude-session-controller'

describe('ClaudeController', () => {
  it('is registered in the AGI container', () => {
    const c = new AGIContainer()
    expect(c.features.has('claudeController')).toBe(true)
    expect(c.feature('claudeController')).toBeInstanceOf(ClaudeController)
  })

  it('creates session workers and does not own interactive input APIs', () => {
    const c = new AGIContainer()
    const controller = c.feature('claudeController')
    const worker = controller.create({ id: 'docs worker', cwd: '/tmp/repo', args: ['--permission-mode', 'acceptEdits'] })

    expect(worker).toBeInstanceOf(ClaudeSessionController)
    expect(worker.id).toBe('docs-worker')
    expect(worker.cwd).toBe('/tmp/repo')
    expect(worker.args).toEqual(['--permission-mode', 'acceptEdits'])
    expect(controller.session('docs worker')).toBe(worker)
    expect(controller.listSessions()).toEqual([worker])
    expect((controller as any).ask).toBeUndefined()
    expect((controller as any).respond).toBeUndefined()
    expect((controller as any).chooseOption).toBeUndefined()
  })

  it('parses numbered Claude prompt choices', () => {
    const choices = parseClaudeChoices(`
Do you want to proceed?
  1. Yes
❯ 2. Yes, and don't ask again for this session
  3. No
`)

    expect(choices.map(c => c.label)).toEqual([
      'Yes',
      "Yes, and don't ask again for this session",
      'No',
    ])
    expect(choices[1]?.selected).toBe(true)
    expect(choices[1]?.key).toBe('2')
  })

  it('parses y/n prompts when no explicit menu is visible', () => {
    const choices = parseClaudeChoices('Apply this edit? (Y/n)')
    expect(choices).toEqual([
      { key: 'y', label: 'yes', raw: 'y' },
      { key: 'n', label: 'no', raw: 'n' },
    ])
  })

  it('detects Claude waiting on a choice or prompt line', () => {
    expect(detectClaudeAwaitingInput('Do you want to proceed?\n  1. Yes\n  2. No', 'claude')).toBe(true)
    expect(detectClaudeAwaitingInput('Working…\n> ', 'claude')).toBe(true)
    expect(detectClaudeAwaitingInput('Running tests...', 'bun')).toBe(false)
  })
})
