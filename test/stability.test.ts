import { NodeContainer } from '../src/node/container'
import { introspect } from '../src/introspection/index'

describe('Helper stability metadata', () => {
  it('every registered node helper declares a stability index', () => {
    const c = new NodeContainer()
    const missing: string[] = []

    for (const registryName of ['features', 'clients', 'servers'] as const) {
      const registry = (c as any)[registryName]
      for (const id of registry.available as string[]) {
        const Ctor = registry.lookup(id)
        if (!['core', 'stable', 'experimental'].includes(Ctor.stability)) {
          missing.push(`${registryName}.${id}`)
        }
      }
    }

    expect(missing).toEqual([])
  })

  it('golden-path helpers are marked core', () => {
    const c = new NodeContainer()
    for (const id of ['fs', 'proc', 'ui', 'vm', 'git', 'grep']) {
      expect((c.features.lookup(id) as any).stability).toBe('core')
    }
  })

  it('stability flows into introspection data', () => {
    const c = new NodeContainer()
    void c.features.available
    const data = introspect('features.fs')
    expect(data?.stability).toBe('core')
  })

  it('stability renders in introspectAsText output', () => {
    const c = new NodeContainer()
    const FS = c.features.lookup('fs') as any
    const text = FS.introspectAsText()
    expect(text).toContain('Stability: `core`')
  })
})
