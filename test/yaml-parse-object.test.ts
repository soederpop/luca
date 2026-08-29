import { describe, it, expect } from 'bun:test'
import { NodeContainer } from '../src/node/container'

const container = new NodeContainer()
const yml = container.feature('yaml')

describe('yaml.parseObject', () => {
  it('parses a mapping like parse()', () => {
    const config = yml.parseObject<{ host: string; port: number }>('host: localhost\nport: 5432\n')
    expect(config.host).toBe('localhost')
    expect(config.port).toBe(5432)
  })

  it('accepts sequences (arrays are objects)', () => {
    expect(yml.parseObject('- a\n- b\n')).toEqual(['a', 'b'])
  })

  it('throws descriptively on empty input', () => {
    expect(() => yml.parseObject('')).toThrow(/empty or contains only comments/)
  })

  it('throws descriptively on comments-only input', () => {
    expect(() => yml.parseObject('# just a comment\n')).toThrow(/empty or contains only comments/)
  })

  it('throws descriptively on a scalar document', () => {
    expect(() => yml.parseObject('just a string')).toThrow(/string scalar/)
    expect(() => yml.parseObject('42')).toThrow(/number scalar/)
  })

  it('parse() keeps its permissive behavior', () => {
    expect(yml.parse('')).toBeUndefined()
    expect(yml.parse('just a string')).toBe('just a string' as any)
  })
})
