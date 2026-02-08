import { describe, it, expect } from 'vitest'
import { NodeContainer } from '../src/node/container'

describe('Features', () => {
  describe('feature registry', () => {
    it('has core features registered', () => {
      const c = new NodeContainer()
      const available = c.features.available
      expect(available).toContain('fs')
      expect(available).toContain('git')
      expect(available).toContain('proc')
      expect(available).toContain('os')
      expect(available).toContain('networking')
      expect(available).toContain('ui')
      expect(available).toContain('vm')
      expect(available).toContain('yaml')
    })

    it('features.has() works', () => {
      const c = new NodeContainer()
      expect(c.features.has('fs')).toBe(true)
      expect(c.features.has('os')).toBe(true)
      expect(c.features.has('totally_fake')).toBe(false)
    })

    it('features.lookup() returns a constructor', () => {
      const c = new NodeContainer()
      const FSClass = c.features.lookup('fs')
      expect(typeof FSClass).toBe('function')
    })
  })

  describe('core features are auto-enabled', () => {
    it('has fs, git, proc, os, networking, ui, vm enabled', () => {
      const c = new NodeContainer()
      expect(c.enabledFeatureIds).toContain('features.fs')
      expect(c.enabledFeatureIds).toContain('features.git')
      expect(c.enabledFeatureIds).toContain('features.proc')
      expect(c.enabledFeatureIds).toContain('features.os')
      expect(c.enabledFeatureIds).toContain('features.networking')
      expect(c.enabledFeatureIds).toContain('features.ui')
      expect(c.enabledFeatureIds).toContain('features.vm')
    })
  })

  describe('feature caching', () => {
    it('same args return same instance', () => {
      const c = new NodeContainer()
      const a = c.feature('yaml')
      const b = c.feature('yaml')
      expect(a.uuid).toBe(b.uuid)
    })

    it('different containers return different instances', () => {
      const c1 = new NodeContainer()
      const c2 = new NodeContainer()
      const a = c1.feature('yaml')
      const b = c2.feature('yaml')
      expect(a.uuid).not.toBe(b.uuid)
    })
  })

  describe('feature instances', () => {
    it('feature has a uuid', () => {
      const c = new NodeContainer()
      const yaml = c.feature('yaml')
      expect(yaml.uuid).toBeDefined()
      expect(typeof yaml.uuid).toBe('string')
    })

    it('feature has state', () => {
      const c = new NodeContainer()
      const yaml = c.feature('yaml')
      expect(yaml.state).toBeDefined()
      expect(typeof yaml.state.get).toBe('function')
    })

    it('feature has access to container', () => {
      const c = new NodeContainer()
      const yaml = c.feature('yaml')
      expect(yaml.container.uuid).toBe(c.uuid)
    })

    it('feature has event bus', () => {
      const c = new NodeContainer()
      const yaml = c.feature('yaml')
      expect(typeof yaml.on).toBe('function')
      expect(typeof yaml.emit).toBe('function')
    })
  })

  describe('OS feature', () => {
    it('provides platform info', () => {
      const c = new NodeContainer()
      expect(c.os.platform).toBe(process.platform)
    })

    it('provides arch', () => {
      const c = new NodeContainer()
      expect(c.os.arch).toBe(process.arch)
    })

    it('provides homedir', () => {
      const c = new NodeContainer()
      expect(typeof c.os.homedir).toBe('string')
      expect(c.os.homedir.length).toBeGreaterThan(0)
    })

    it('provides cpuCount', () => {
      const c = new NodeContainer()
      expect(c.os.cpuCount).toBeGreaterThan(0)
    })

    it('provides hostname', () => {
      const c = new NodeContainer()
      expect(typeof c.os.hostname).toBe('string')
    })
  })

  describe('FS feature', () => {
    it('can check if a path exists', () => {
      const c = new NodeContainer()
      expect(c.fs.exists(process.cwd())).toBe(true)
      expect(c.fs.exists('/surely/this/does/not/exist_abc123')).toBe(false)
    })
  })

  describe('VM feature', () => {
    it('can run simple expressions', async () => {
      const c = new NodeContainer()
      const result = await c.vm.run('1 + 2 + 3')
      expect(result).toBe(6)
    })

    it('can run code with context variables', async () => {
      const c = new NodeContainer()
      const result = await c.vm.run('x * y', { x: 6, y: 7 })
      expect(result).toBe(42)
    })
  })

  describe('Networking feature', () => {
    it('can find an open port', async () => {
      const c = new NodeContainer()
      const port = await c.networking.findOpenPort(30000)
      expect(port).toBeGreaterThanOrEqual(30000)
    })
  })

  describe('YAML feature', () => {
    it('can stringify and parse', () => {
      const c = new NodeContainer()
      const yaml = c.feature('yaml')
      const data = { name: 'luca', version: 1 }
      const str = yaml.stringify(data)
      expect(typeof str).toBe('string')
      const parsed = yaml.parse(str)
      expect(parsed).toEqual(data)
    })
  })
})
