import { describe, expect, it } from 'bun:test'
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
})
