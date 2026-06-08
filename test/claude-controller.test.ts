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

  it('compiles named personas into interactive Claude CLI args', () => {
    const c = new AGIContainer()
    const controller = c.feature('claudeController')

    controller.definePersona('reviewer', {
      systemPrompt: 'You are a strict Luca reviewer.',
      appendSystemPrompt: 'Prefer container features and bun.',
      mcpConfig: ['./.claude/shared-mcp.json'],
      mcpServers: {
        luca: { type: 'stdio', command: 'bun', args: ['run', './mcp/luca.ts'] },
      },
      skillsFolders: ['/skills/luca'],
      addDirs: ['/repo/shared'],
      tools: ['Read', 'Grep'],
      allowedTools: ['Bash(git *)'],
      permissionMode: 'acceptEdits',
      settingsFile: './.claude/settings.reviewer.json',
      strictMcpConfig: true,
    })

    const worker = controller.create({ id: 'reviewer', cwd: '/repo/app', persona: 'reviewer' })

    expect(controller.listPersonas().map(p => p.name)).toEqual(['reviewer'])
    expect(controller.getPersona('reviewer')?.description).toBeUndefined()
    expect(worker.args).toEqual([
      '--system-prompt', 'You are a strict Luca reviewer.',
      '--append-system-prompt', 'Prefer container features and bun.',
      '--mcp-config', './.claude/shared-mcp.json', JSON.stringify({
        mcpServers: {
          luca: { type: 'stdio', command: 'bun', args: ['run', './mcp/luca.ts'] },
        },
      }),
      '--strict-mcp-config',
      '--add-dir', '/repo/shared', '/skills/luca',
      '--tools', 'Read', 'Grep',
      '--allowed-tools', 'Bash(git *)',
      '--permission-mode', 'acceptEdits',
      '--settings', './.claude/settings.reviewer.json',
    ])
  })

  it('lets spawn options override persona prompts and append raw args', () => {
    const c = new AGIContainer()
    const controller = c.feature('claudeController')
    controller.definePersona('docs', {
      systemPrompt: 'Persona system prompt',
      skillsFolders: ['/skills/docs'],
      permissionMode: 'plan',
    })

    const worker = controller.create({
      id: 'docs',
      persona: 'docs',
      systemPrompt: 'Spawn system prompt',
      addDirs: ['/repo'],
      args: ['--model', 'opus'],
    })

    expect(worker.args).toEqual([
      '--system-prompt', 'Spawn system prompt',
      '--add-dir', '/repo', '/skills/docs',
      '--permission-mode', 'plan',
      '--model', 'opus',
    ])
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
