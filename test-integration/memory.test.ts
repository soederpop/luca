import {
  requireEnv,
  describeWithRequirements,
  createAGIContainer,
  API_TIMEOUT,
} from './helpers'
import type { AGIContainer } from '../src/agi/container.server'
import type { Memory } from '../src/agi/features/agent-memory'

const openaiKey = requireEnv('OPENAI_API_KEY')

describeWithRequirements('Memory Integration', [openaiKey], () => {
  let container: AGIContainer
  let mem: Memory

  beforeAll(async () => {
    container = createAGIContainer()
    mem = container.feature('memory', { namespace: 'test-integration' }) as unknown as Memory
    await mem.initDb()
    await mem.wipeAll()
  })

  afterAll(async () => {
    await mem.wipeAll()
  })

  describe('Feature registration', () => {
    it('registers in the container', () => {
      expect(container.features.available).toContain('memory')
    })

    it('has correct shortcut', () => {
      const { Memory: MemClass } = require('../src/agi/features/agent-memory')
      expect(MemClass.shortcut).toBe('features.memory')
    })

    it('initializes database', () => {
      expect(mem.state.get('dbReady')).toBe(true)
    })
  })

  describe('CRUD operations', () => {
    it('creates and retrieves a memory', async () => {
      const m = await mem.create('facts', 'Jonathan is a software engineer based in Austin')
      expect(m.id).toBeGreaterThan(0)
      expect(m.category).toBe('facts')
      expect(m.document).toBe('Jonathan is a software engineer based in Austin')

      const fetched = await mem.get('facts', m.id)
      expect(fetched).not.toBeNull()
      expect(fetched!.document).toBe(m.document)
    }, API_TIMEOUT)

    it('updates a memory', async () => {
      const m = await mem.create('facts', 'Prefers dark mode')
      const updated = await mem.update('facts', m.id, {
        text: 'Prefers dark mode, especially Dracula theme',
        metadata: { updated: 'true' },
      })
      expect(updated!.document).toBe('Prefers dark mode, especially Dracula theme')
      expect(updated!.metadata.updated).toBe('true')
    }, API_TIMEOUT)

    it('deletes a memory', async () => {
      const m = await mem.create('scratch', 'temporary memory')
      expect(await mem.delete('scratch', m.id)).toBe(true)
      expect(await mem.get('scratch', m.id)).toBeNull()
    }, API_TIMEOUT)

    it('lists categories', async () => {
      const cats = await mem.categories()
      expect(cats).toContain('facts')
    })

    it('counts memories', async () => {
      const total = await mem.count()
      expect(total).toBeGreaterThan(0)
      const factCount = await mem.count('facts')
      expect(factCount).toBeGreaterThan(0)
    })

    it('gets all memories with filtering', async () => {
      await mem.create('prefs', 'Likes iterative delivery', { source: 'onboarding' })
      await mem.create('prefs', 'Prefers concise responses')

      const onboarding = await mem.getAll('prefs', { filterMetadata: { source: 'onboarding' } })
      expect(onboarding.length).toBeGreaterThan(0)
      expect(onboarding.every(m => m.metadata.source === 'onboarding')).toBe(true)
    }, API_TIMEOUT)
  })

  describe('Semantic search', () => {
    it('finds relevant memories by query', async () => {
      const results = await mem.search('facts', 'Where does the user live?', 3)
      expect(results.length).toBeGreaterThan(0)
      expect(results[0].distance).toBeLessThan(1)
    }, API_TIMEOUT)
  })

  describe('Deduplication', () => {
    it('blocks near-duplicate memories', async () => {
      const before = await mem.count('facts')
      const dup = await mem.createUnique('facts', 'Jonathan is a software engineer living in Austin, TX')
      const after = await mem.count('facts')
      expect(dup).toBeNull()
      expect(after).toBe(before)
    }, API_TIMEOUT)
  })

  describe('Epochs and events', () => {
    it('tracks epoch state', () => {
      expect(mem.getEpoch()).toBe(1)
    })

    it('creates events and increments epoch', async () => {
      await mem.createEvent('User started a new project')
      await mem.incrementEpoch()
      expect(mem.getEpoch()).toBe(2)

      await mem.createEvent('User requested a test script')

      const e1 = await mem.getEvents({ epoch: 1 })
      const e2 = await mem.getEvents({ epoch: 2 })
      expect(e1.length).toBeGreaterThan(0)
      expect(e2.length).toBeGreaterThan(0)
    }, API_TIMEOUT)
  })

  describe('Export and import', () => {
    it('roundtrips through export/import', async () => {
      const exported = await mem.exportToJson()
      expect(exported.memories.length).toBeGreaterThan(0)

      await mem.wipeAll()
      expect(await mem.count()).toBe(0)

      const imported = await mem.importFromJson(exported)
      expect(imported).toBe(exported.memories.length)
      expect(await mem.count()).toBe(exported.memories.length)
    }, API_TIMEOUT * 3)
  })

  describe('Tool interface (toTools)', () => {
    it('exposes tools via standard toTools() pattern', () => {
      const { schemas, handlers } = mem.toTools()
      expect(Object.keys(schemas)).toContain('remember')
      expect(Object.keys(schemas)).toContain('recall')
      expect(Object.keys(schemas)).toContain('forgetCategory')
      expect(Object.keys(schemas)).toContain('listCategories')
      expect(typeof handlers.remember).toBe('function')
      expect(typeof handlers.recall).toBe('function')
      expect(typeof handlers.forgetCategory).toBe('function')
      expect(typeof handlers.listCategories).toBe('function')
    })

    it('toTools only/except filtering works', () => {
      const { schemas: onlySchemas } = mem.toTools({ only: ['remember', 'recall'] })
      expect(Object.keys(onlySchemas)).toEqual(['remember', 'recall'])

      const { schemas: exceptSchemas } = mem.toTools({ except: ['forgetCategory'] })
      expect(Object.keys(exceptSchemas)).not.toContain('forgetCategory')
      expect(Object.keys(exceptSchemas)).toContain('remember')
    })

    it('remember tool stores and deduplicates', async () => {
      const { handlers } = mem.toTools()
      const result = await handlers.remember({ category: 'facts', text: 'Has a golden retriever named Max' })
      expect(result.stored).toBe(true)

      const dup = await handlers.remember({ category: 'facts', text: 'Has a golden retriever named Max' })
      expect(dup.stored).toBe(false)
    }, API_TIMEOUT)

    it('recall tool searches memories', async () => {
      const { handlers } = mem.toTools()
      const results = await handlers.recall({ category: 'facts', query: 'pets and animals', n_results: 2 })
      expect(results.length).toBeGreaterThan(0)
      expect(results[0]).toHaveProperty('document')
      expect(results[0]).toHaveProperty('distance')
    }, API_TIMEOUT)

    it('listCategories tool returns counts', async () => {
      const { handlers } = mem.toTools()
      const result = await handlers.listCategories()
      expect(result.categories).toBeDefined()
      expect(typeof result.categories.facts).toBe('number')
    })
  })

  describe('Wipe operations', () => {
    it('wipeCategory removes only that category', async () => {
      const before = await mem.count()
      const deleted = await mem.wipeCategory('scratch')
      const after = await mem.count()
      expect(after).toBeLessThanOrEqual(before)
    })

    it('wipeAll removes everything and resets epoch', async () => {
      await mem.wipeAll()
      expect(await mem.count()).toBe(0)
      expect(mem.getEpoch()).toBe(1)
    })
  })
})
