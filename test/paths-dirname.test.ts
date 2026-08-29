import { describe, it, expect } from 'bun:test'
import { NodeContainer } from '../src/node/container'

const container = new NodeContainer()

describe('paths.dirname (node semantics)', () => {
  it("returns '.' for a bare filename, not ''", () => {
    // parse(path).dir returned '' (falsy) here, silently breaking
    // branches like `if (paths.dirname(f))`
    expect(container.paths.dirname('foo.txt')).toBe('.')
  })

  it('matches node dirname for common shapes', () => {
    expect(container.paths.dirname('/a/b/c.txt')).toBe('/a/b')
    expect(container.paths.dirname('a/b/c.txt')).toBe('a/b')
    expect(container.paths.dirname('/a/b/')).toBe('/a')
    expect(container.paths.dirname('/')).toBe('/')
    expect(container.paths.dirname('.')).toBe('.')
  })
})
