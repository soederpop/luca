import { describe, expect, it } from 'bun:test'
import { NodeContainer } from '../src/node/container'

// With the legacy 32-bit hash-only cache, these two normalized requests both
// produced 13mx0ec. The second lookup returned YAML where GoogleDocs was requested.
describe('helper cache hash collisions', () => {
  it('keeps helper identities separate even when their option hashes collide', () => {
    const c = new NodeContainer()
    Object.defineProperty(c, 'uuid', { value: 'collision-regression' })
    const yaml = c.feature('yaml', { name: 'probe-15866' })
    const docs = c.feature('googleDocs', { name: 'probe-29223' })
    expect(docs).not.toBe(yaml)
    expect(typeof docs.getAsMarkdown).toBe('function')
    expect(typeof yaml.parse).toBe('function')
    expect(c.feature('googleDocs', { name: 'probe-29223' })).toBe(docs)
    expect(c.feature('yaml', { name: 'probe-15866' })).toBe(yaml)
  })
})
