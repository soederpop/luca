import { describe, expect, it } from 'bun:test'
import { z } from 'zod'
import { formatCommandHelp } from '../src/commands/help'

const colors = new Proxy({}, {
  get(_target, prop) {
    if (prop === 'cyan') {
      const fn: any = (s: string) => s
      fn.bold = (s: string) => s
      return fn
    }
    return (s: string) => s
  },
})

describe('help formatting', () => {
  it('uses supplied binary name for command help', () => {
    const Cmd = { commandDescription: 'Demo command', argsSchema: { shape: {} } }
    const text = formatCommandHelp('demo', Cmd, colors, { binaryName: 'loopy' })
    expect(text).toContain('loopy demo')
    expect(text).not.toContain('luca demo')
  })

  it('defaults binary name to luca', () => {
    const Cmd = { commandDescription: 'Demo command', argsSchema: { shape: {} } }
    const text = formatCommandHelp('demo', Cmd, colors)
    expect(text).toContain('luca demo')
  })

  it('renders positionals in the usage line and an Arguments section', () => {
    const Cmd = {
      commandDescription: 'Demo command',
      argsSchema: z.object({
        target: z.string().describe('The target to operate on'),
        verbose: z.boolean().default(false).describe('Enable verbose output'),
      }),
      positionals: ['target'],
    }
    const text = formatCommandHelp('demo', Cmd, colors)
    expect(text).toContain('luca demo <target>')
    expect(text).toContain('Arguments:')
    expect(text).toContain('The target to operate on')
    // positional field must not be duplicated as an option
    expect(text).not.toContain('--target')
  })

  it('marks optional positionals with square brackets', () => {
    const Cmd = {
      commandDescription: 'Demo command',
      argsSchema: z.object({ target: z.string().optional().describe('Optional target') }),
      positionals: ['target'],
    }
    const text = formatCommandHelp('demo', Cmd, colors)
    expect(text).toContain('luca demo [target]')
  })

  it('supports object-form positionals with inline descriptions', () => {
    const Cmd = {
      commandDescription: 'Demo command',
      argsSchema: z.object({}),
      positionals: [{ name: 'expression', description: 'Code to evaluate' }],
    }
    const text = formatCommandHelp('demo', Cmd, colors)
    expect(text).toContain('luca demo <expression>')
    expect(text).toContain('Code to evaluate')
  })

  it('renders a Subcommands section and a per-subcommand help hint', () => {
    const Cmd = {
      commandDescription: 'Demo command',
      argsSchema: z.object({}),
      subcommands: {
        create: { args: '<name>', description: 'Make a new thing' },
        list: { description: 'Show all things' },
      },
    }
    const text = formatCommandHelp('demo', Cmd, colors)
    expect(text).toContain('luca demo <subcommand>')
    expect(text).toContain('Subcommands:')
    expect(text).toContain('create <name>')
    expect(text).toContain('Make a new thing')
    expect(text).toContain('luca demo <subcommand> --help')
  })

  it('renders focused help for a single subcommand', () => {
    const Cmd = {
      commandDescription: 'Demo command',
      argsSchema: z.object({}),
      subcommands: {
        create: { args: '<name>', description: 'Make a new thing', examples: ['luca demo create widget'] },
        list: { description: 'Show all things' },
      },
    }
    const text = formatCommandHelp('demo', Cmd, colors, { subcommand: 'create' })
    expect(text).toContain('luca demo create <name>')
    expect(text).toContain('Make a new thing')
    expect(text).toContain('luca demo create widget')
    expect(text).not.toContain('Subcommands:')
    expect(text).not.toContain('Show all things')
  })

  it('renders Examples with optional descriptions as comments', () => {
    const Cmd = {
      commandDescription: 'Demo command',
      argsSchema: z.object({}),
      examples: [
        'luca demo run',
        { command: 'luca demo run --json', description: 'Machine-readable output' },
      ],
    }
    const text = formatCommandHelp('demo', Cmd, colors)
    expect(text).toContain('Examples:')
    expect(text).toContain('luca demo run')
    expect(text).toContain('# Machine-readable output')
    expect(text).toContain('luca demo run --json')
  })
})
