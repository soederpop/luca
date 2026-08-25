import { describe, expect, it } from 'bun:test'
import { executePromptFile, resolveAgentOptions } from '../src/commands/prompt'

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

describe('prompt code-block context', () => {
  it('injects the parsed prompt document as $doc', async () => {
    const doc = {
      meta: { worksOn: { model: 'Idea' } },
      content: '',
      ast: {
        children: [{
          type: 'code',
          lang: 'ts',
          value: 'console.log($doc.meta.worksOn.model)',
        }],
      },
    }
    let receivedDoc: any
    const container = {
      context: {},
      docs: {
        isLoaded: true,
        parseMarkdownAtPath: async () => doc,
      },
      feature(name: string) {
        if (name === 'transpiler') {
          return { transformSync: (source: string) => ({ code: source }) }
        }
        if (name === 'vm') {
          return {
            createContext: (context: any) => context,
            run: async (_code: string, context: any) => {
              receivedDoc = context.$doc
              context.console.log(context.$doc.meta.worksOn.model)
            },
          }
        }
        throw new Error(`Unexpected feature: ${name}`)
      },
    }

    const output = await executePromptFile('/tmp/example.md', container, {}, 'all')

    expect(receivedDoc).toBe(doc)
    expect(output).toBe('Idea')
  })
})
