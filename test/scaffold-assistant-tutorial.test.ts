import { describe, it, expect } from 'bun:test'
import { scaffolds, assistantFiles } from '../src/scaffolds/generated'

/**
 * Regression test: `luca scaffold assistant --tutorial` used to print
 * "No tutorial available for type: assistant" because docs/scaffolds/assistant.md
 * did not exist and build-scaffolds did not include the assistant type.
 */
describe('scaffold assistant tutorial', () => {
  it('bundles a tutorial for the assistant type', () => {
    expect(scaffolds.assistant).toBeDefined()
    expect(scaffolds.assistant!.tutorial).toContain('# Building an Assistant')
    expect(scaffolds.assistant!.tutorial).toContain('CORE.md')
    expect(scaffolds.assistant!.tutorial).toContain('tools.ts')
    expect(scaffolds.assistant!.tutorial).toContain('hooks.ts')
  })

  it('still bundles the multi-file assistant scaffold', () => {
    expect(Object.keys(assistantFiles)).toEqual(
      expect.arrayContaining(['CORE.md', 'tools.ts', 'hooks.ts', 'voice.yml'])
    )
  })
})
