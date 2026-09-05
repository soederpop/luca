import { describe, it, expect } from 'bun:test'
import { NodeContainer } from '../src/node/container'

function makePrettier(options: Record<string, any> = {}) {
  const container = new NodeContainer()
  return container.feature('prettier', options)
}

describe('prettier.format', () => {
  it('formats typescript by default', async () => {
    const p = makePrettier()
    const out = await p.format('const   x={a:1};function f(  ){return x}')
    expect(out).toBe('const x = { a: 1 };\nfunction f() {\n  return x;\n}\n')
  })

  it('infers the parser from a filepath', async () => {
    const p = makePrettier()
    expect(await p.format('a:   1', { filepath: 'config.yml' })).toBe('a: 1\n')
    expect(await p.format('#    Title', { filepath: 'README.md' })).toBe('# Title\n')
  })

  it('throws on unparseable source', async () => {
    const p = makePrettier()
    await expect(p.format('const = = {')).rejects.toThrow()
  })
})

describe('prettier.formatMarkdown', () => {
  it('formats yaml frontmatter and the markdown body in one pass', async () => {
    const p = makePrettier()
    const out = await p.formatMarkdown('---\ntitle:    Hello\ntags:   [a,b]\n---\n#  Heading\n\nSome    text')
    expect(out).toBe('---\ntitle: Hello\ntags: [a, b]\n---\n\n# Heading\n\nSome text\n')
  })
})

describe('prettier options', () => {
  it('feature options set defaults that per-call options override', async () => {
    const p = makePrettier({ semi: false, singleQuote: true })
    expect(await p.format('const s = "hi";')).toBe("const s = 'hi'\n")
    expect(await p.format('const s = "hi"', { semi: true })).toBe("const s = 'hi';\n")
  })
})

describe('prettier.check', () => {
  it('reports whether source is already formatted', async () => {
    const p = makePrettier()
    expect(await p.check('const x = 1;\n')).toBe(true)
    expect(await p.check('const   x=1')).toBe(false)
  })
})
