import { describe, expect, it } from 'bun:test'
import { z } from 'zod'
import { applySchemaAwareArgv, classifyCommandSources, resolveScriptCandidate } from '../src/cli/runner'
import { CommandOptionsSchema } from '../src/schemas/base'

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

describe('applySchemaAwareArgv', () => {
  const withArgv = (args: string[], fn: () => void) => {
    const original = process.argv
    process.argv = [original[0]!, original[1]!, ...args]
    try {
      fn()
    } finally {
      process.argv = original
    }
  }

  it('keeps boolean flags from consuming a following positional', () => {
    const CommandClass = {
      argsSchema: CommandOptionsSchema.extend({
        json: z.boolean().default(false),
      }),
    }
    const argv: Record<string, any> = { _: ['exec', 'hashInput'], json: 'foo' }
    const container = { argv }

    withArgv(['exec', 'hashInput', '--json', 'foo'], () => {
      applySchemaAwareArgv(container, CommandClass)
    })

    expect(argv.json).toBe(true)
    expect(argv._).toEqual(['exec', 'hashInput', 'foo'])
  })

  it('keeps positionals and string flags as strings', () => {
    const CommandClass = {
      argsSchema: CommandOptionsSchema.extend({
        port: z.string(),
      }),
    }
    const argv: Record<string, any> = { _: ['config', 'set', 'server.port', 8080], port: 3000 }
    const container = { argv }

    withArgv(['config', 'set', 'server.port', '8080', '--port', '3000'], () => {
      applySchemaAwareArgv(container, CommandClass)
    })

    expect(argv._).toEqual(['config', 'set', 'server.port', '8080'])
    expect(argv.port).toBe('3000')
  })

  it('aliases kebab-case flags onto camelCase schema fields', () => {
    const CommandClass = {
      argsSchema: CommandOptionsSchema.extend({
        dryRun: z.boolean().default(false),
      }),
    }
    const argv: Record<string, any> = { _: ['deploy'] }
    const container = { argv }

    withArgv(['deploy', '--dry-run', 'prod'], () => {
      applySchemaAwareArgv(container, CommandClass)
    })

    expect(argv.dryRun).toBe(true)
    expect(argv._).toEqual(['deploy', 'prod'])
  })
})
