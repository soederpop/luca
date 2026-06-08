import { describe, expect, it } from 'bun:test'
import { ClaudeSessionController } from '../src/agi/features/claude-session-controller'

function fakeContainer() {
  const calls: any[] = []
  const session = {
    name: 'luca-claude-main',
    capture: async () => 'Choose an option:\n1. Yes\n2. No\n> ',
    currentCommand: async () => 'claude',
    send: async (input: string) => calls.push(['send', input]),
    sendKeys: async (input: string) => calls.push(['sendKeys', input]),
    kill: async () => calls.push(['kill']),
  }
  const tmux = {
    hasSession: async (name: string) => {
      calls.push(['hasSession', name])
      return false
    },
    session: async (name: string, options?: any) => {
      calls.push(['session', name, options])
      return session
    },
    killSession: async (name: string) => calls.push(['killSession', name]),
  }
  const claudeCode = {
    claudePath: 'claude',
    listSessionsForCwd: async (cwd: string) => {
      calls.push(['listSessionsForCwd', cwd])
      return [{ sessionId: 's1', filePath: '/tmp/s1.jsonl', messageCount: 1 }]
    },
    getConversationHistory: async (sessionId: string, cwd: string) => {
      calls.push(['getConversationHistory', sessionId, cwd])
      return [{ role: 'user', content: 'hello' }]
    },
  }

  return {
    calls,
    feature(name: string) {
      if (name === 'tmux') return tmux
      if (name === 'claudeCode') return claudeCode
      throw new Error(`unexpected feature ${name}`)
    },
  }
}

describe('ClaudeSessionController', () => {
  it('is scoped to one cwd, tmux session, and Claude arg set', async () => {
    const container = fakeContainer()
    const controller = new ClaudeSessionController({
      container,
      id: 'docs worker',
      cwd: '/repo/docs',
      args: ['--add-dir', '/repo', '--permission-mode', 'acceptEdits'],
      width: 200,
      height: 50,
    })

    const snapshot = await controller.start()
    const startCall = container.calls.find(call => call[0] === 'session')

    expect(controller.id).toBe('docs-worker')
    expect(controller.cwd).toBe('/repo/docs')
    expect(controller.tmuxSession).toBe('luca-claude-docs-worker')
    expect(startCall[1]).toBe('luca-claude-docs-worker')
    expect(startCall[2]).toEqual({
      command: "'claude' '--add-dir' '/repo' '--permission-mode' 'acceptEdits'",
      cwd: '/repo/docs',
      width: 200,
      height: 50,
    })
    expect(snapshot.id).toBe('docs-worker')
    expect(snapshot.cwd).toBe('/repo/docs')
    expect(snapshot.awaitingInput).toBe(true)
    expect(snapshot.choices.map(c => c.label)).toEqual(['Yes', 'No'])
    expect(snapshot.sessionId).toBe('s1')
  })

  it('keeps ask/respond APIs id-free because the instance already owns the session', async () => {
    const container = fakeContainer()
    const controller = new ClaudeSessionController({
      container,
      id: 'main',
      cwd: '/repo',
      settleMs: 0,
    })

    await controller.start()
    await controller.ask('what next?', { wait: false })
    await controller.chooseOption('yes')

    expect(container.calls).toContainEqual(['send', 'what next?'])
    expect(container.calls).toContainEqual(['send', '1'])
  })
})
