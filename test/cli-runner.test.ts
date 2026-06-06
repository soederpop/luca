import { describe, expect, it } from 'bun:test'
import { classifyCommandSources, resolveScriptCandidate } from '../src/cli/runner'

describe('cli runner', () => {
  it('classifies built-in, project, and user commands from snapshots', () => {
    const builtin = new Set(['help', 'describe'])
    const afterProject = new Set(['help', 'describe', 'workflow'])
    const afterUser = new Set(['help', 'describe', 'workflow', 'global-tool'])

    const result = classifyCommandSources(builtin, afterProject, afterUser)

    expect([...result.builtinCommands].sort()).toEqual(['describe', 'help'])
    expect([...result.projectCommands]).toEqual(['workflow'])
    expect([...result.userCommands]).toEqual(['global-tool'])
  })

  it('resolves script candidates in cwd order', () => {
    const checked: string[] = []
    const container = {
      paths: { resolve: (p: string) => `/cwd/${p}` },
      fs: {
        exists: (p: string) => {
          checked.push(p)
          return p === '/cwd/task.ts'
        },
      },
    }

    expect(resolveScriptCandidate('task', container as any)).toBe('/cwd/task.ts')
    expect(checked).toEqual(['/cwd/task', '/cwd/task.ts'])
  })
})
