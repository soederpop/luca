import { describe, it, expect } from 'bun:test'
import { NodeContainer } from '../src/node/container'

describe('ui.print color parity', () => {
  const ui = new NodeContainer().feature('ui') as any

  it('mirrors every standard chalk foreground color', () => {
    for (const name of ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white', 'gray', 'grey']) {
      expect(typeof ui.print[name]).toBe('function')
    }
  })

  it('mirrors modifiers and background colors', () => {
    for (const name of ['bold', 'dim', 'italic', 'underline', 'inverse', 'strikethrough', 'bgMagenta', 'bgWhite', 'redBright', 'magentaBright']) {
      expect(typeof ui.print[name]).toBe('function')
    }
  })

  it('keeps the semantic helpers', () => {
    for (const name of ['error', 'info', 'success', 'warn', 'warning']) {
      expect(typeof ui.print[name]).toBe('function')
    }
  })

  it('print methods write rather than format (return undefined)', () => {
    const logs: string[] = []
    const original = console.log
    console.log = (...args: any[]) => { logs.push(args.join(' ')) }
    try {
      const result = ui.print.magenta('hello')
      expect(result).toBeUndefined()
      expect(logs.length).toBe(1)
      expect(logs[0]).toContain('hello')
    } finally {
      console.log = original
    }
  })
})
