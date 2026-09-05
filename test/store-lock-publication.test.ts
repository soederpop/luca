import { describe, it, expect, spyOn } from 'bun:test'
import container from '../src/node'

describe('store lock publication', () => {
  for (const transient of ['', '{"pid":', 'null', 'missing']) {
    it(`does not steal a live lock after transient metadata ${JSON.stringify(transient)}`, async () => {
      const store = container.store(`publication-${container.utils.uuid()}`, { scope: 'tmp', lockTimeout: 50 })
      const lock = `${store.path}.lock`
      container.fs.ensureFolder(container.paths.dirname(lock))
      container.fs.writeJson(lock, { pid: process.pid, at: Date.now() })
      const original = container.fs.readFile.bind(container.fs)
      let intercepted = false
      const read = spyOn(container.fs, 'readFile').mockImplementation((path, encoding) => {
        if (path === lock && !intercepted) {
          intercepted = true
          if (transient === 'missing') throw Object.assign(new Error('Lock changed during read'), { code: 'ENOENT' })
          return transient
        }
        return original(path, encoding)
      })
      try {
        await expect(store.update(draft => { draft.count = 1 })).rejects.toThrow('waiting for lock')
        expect(intercepted).toBe(true)
        expect(store.exists).toBe(false)
        expect(container.fs.exists(lock)).toBe(true)
      } finally {
        read.mockRestore()
        await store.delete()
      }
    })
  }
})
