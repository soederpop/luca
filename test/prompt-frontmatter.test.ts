import { describe, expect, it } from 'bun:test'
import { resolveAgentOptions } from '../src/commands/prompt'

describe('prompt frontmatter agent options', () => {
  it('promotes a top-level skills array', () => {
    expect(resolveAgentOptions({ skills: ['luca-framework', 'contentbase'] })).toEqual({
      skills: ['luca-framework', 'contentbase'],
    })
  })

  it('promotes skillsFolders alongside other agentOptions', () => {
    expect(resolveAgentOptions({
      skillsFolders: ['./prompt-skills'],
      agentOptions: { permissionMode: 'plan' },
    })).toEqual({
      permissionMode: 'plan',
      skillsFolders: ['./prompt-skills'],
    })
  })

  it('lets an explicit agentOptions entry win', () => {
    expect(resolveAgentOptions({
      skills: ['ignored'],
      agentOptions: { skills: ['wins'] },
    })).toEqual({ skills: ['wins'] })
  })

  it('ignores non-array skills and empty frontmatter', () => {
    expect(resolveAgentOptions({ skills: 'luca-framework' })).toEqual({})
    expect(resolveAgentOptions({})).toEqual({})
  })
})
