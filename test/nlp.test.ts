import { describe, expect, it } from 'bun:test'
import { NodeContainer } from '../src/node/container'

const createNlp = () => new NodeContainer().feature('nlp')

describe('NLP', () => {
  it('extracts a command with a prepositional subject', () => {
    const text = 'draw a diagram of the auth flow'
    expect(createNlp().parse(text)).toMatchObject({ intent: 'draw', target: 'diagram', subject: 'auth flow', raw: text })
  })

  it('extracts a simple verb and target without a subject', () => {
    expect(createNlp().parse('open the door')).toMatchObject({ intent: 'open', target: 'door', subject: null })
  })

  it('normalizes conjugated verbs', () => {
    expect(createNlp().parse('opened the door').intent).toBe('open')
  })

  it('handles empty input without invented intent or entities', () => {
    const nlp = createNlp()
    expect(nlp.parse('')).toEqual({ intent: null, target: null, subject: null, modifiers: [], raw: '' })
    expect(nlp.analyze('')).toEqual({ tokens: [], entities: [], raw: '' })
  })

  it('extracts adjective and adverb modifiers', () => {
    const result = createNlp().parse('quickly open the red door')
    expect(result.modifiers).toContain('quickly')
    expect(result.modifiers).toContain('red')
    expect(new Set(result.modifiers).size).toBe(result.modifiers.length)
  })

  it('tags words and punctuation while preserving original text', () => {
    const text = 'The cat sleeps.'
    const result = createNlp().analyze(text)
    expect(result.raw).toBe(text)
    expect(result.tokens).toEqual([
      { value: 'The', pos: 'DET' }, { value: 'cat', pos: 'NOUN' },
      { value: 'sleeps', pos: 'VERB' }, { value: '.', pos: 'PUNCT' },
    ])
  })

  it('extracts recognized numeric entities', () => {
    const result = createNlp().analyze('It costs $20.')
    expect(result.entities).toContainEqual({ value: '$20', type: 'MONEY' })
  })

  it('tracks separate direct parse and analyze calls per container', () => {
    const nlp = createNlp()
    nlp.parse('open the door')
    nlp.parse('close the door')
    nlp.analyze('hello')
    expect(nlp.state.get('parseCalls')).toBe(2)
    expect(nlp.state.get('analyzeCalls')).toBe(1)
    const other = createNlp()
    other.parse('open the door')
    expect(other.state.get('parseCalls')).toBe(1)
    expect(nlp.state.get('parseCalls')).toBe(2)
  })

  it('understand combines the same parsing and analysis results', () => {
    const text = 'draw a diagram of the auth flow'
    const nlp = createNlp()
    expect(nlp.understand(text)).toEqual({ ...createNlp().parse(text), ...createNlp().analyze(text) })
  })
})
