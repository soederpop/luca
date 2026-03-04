import { createAGIContainer } from './helpers'
import type { AGIContainer } from '../../src/agi/container.server'
import { mkdtempSync, rmSync, realpathSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

describe('Conversation History Integration', () => {
  let container: AGIContainer
  let tempDir: string

  beforeAll(() => {
    tempDir = realpathSync(mkdtempSync(join(tmpdir(), 'luca-history-test-')))
    container = createAGIContainer({ cwd: tempDir })
  })

  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('saves a conversation and loads it back', async () => {
    const history = container.feature('conversationHistory', {
      cachePath: join(tempDir, '.conversations'),
    })

    const record = await history.create({
      title: 'Test Chat',
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are helpful.' },
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there!' },
      ],
      tags: ['test', 'integration'],
      thread: 'test-thread-1',
    })

    expect(record.id).toBeDefined()
    expect(record.title).toBe('Test Chat')

    const loaded = await history.load(record.id)
    expect(loaded).not.toBeNull()
    expect(loaded!.title).toBe('Test Chat')
    expect(loaded!.messages).toHaveLength(3)
    expect(loaded!.messages[2].content).toBe('Hi there!')
    expect(loaded!.tags).toContain('test')
    expect(loaded!.tags).toContain('integration')
  })

  it('lists conversations with filtering', async () => {
    const history = container.feature('conversationHistory', {
      cachePath: join(tempDir, '.conversations-list'),
    })

    await history.create({
      title: 'Chat A',
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'A' }],
      tags: ['alpha'],
      thread: 'thread-a',
    })

    await history.create({
      title: 'Chat B',
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'B' }],
      tags: ['beta'],
      thread: 'thread-b',
    })

    await history.create({
      title: 'Chat C',
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'C' }],
      tags: ['alpha', 'gamma'],
      thread: 'thread-a',
    })

    const all = await history.list()
    expect(all.length).toBeGreaterThanOrEqual(3)

    const alphaOnly = await history.list({ tag: 'alpha' })
    expect(alphaOnly.length).toBeGreaterThanOrEqual(2)

    const threadA = await history.list({ thread: 'thread-a' })
    expect(threadA.length).toBeGreaterThanOrEqual(2)
  })

  it('appends messages to existing conversation', async () => {
    const history = container.feature('conversationHistory', {
      cachePath: join(tempDir, '.conversations-append'),
    })

    const record = await history.create({
      title: 'Append Test',
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'First message' }],
      tags: [],
    })

    const updated = await history.append(record.id, [
      { role: 'assistant', content: 'Response to first' },
      { role: 'user', content: 'Second message' },
    ])

    expect(updated!.messages).toHaveLength(3)
    expect(updated!.messages[1].content).toBe('Response to first')
    expect(updated!.messages[2].content).toBe('Second message')
  })

  it('searches conversations by query', async () => {
    const history = container.feature('conversationHistory', {
      cachePath: join(tempDir, '.conversations-search'),
    })

    await history.create({
      title: 'Debugging Python errors',
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'help' }],
      tags: ['python', 'debug'],
    })

    await history.create({
      title: 'TypeScript generics tutorial',
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'teach' }],
      tags: ['typescript'],
    })

    const pythonResults = await history.search({ query: 'Python' })
    expect(pythonResults.length).toBeGreaterThanOrEqual(1)
    expect(pythonResults[0].title).toContain('Python')
  })

  it('tags and untags conversations', async () => {
    const history = container.feature('conversationHistory', {
      cachePath: join(tempDir, '.conversations-tags'),
    })

    const record = await history.create({
      title: 'Tag Test',
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'test' }],
      tags: ['initial'],
    })

    await history.tag(record.id, 'important', 'reviewed')
    let loaded = await history.load(record.id)
    expect(loaded!.tags).toContain('initial')
    expect(loaded!.tags).toContain('important')
    expect(loaded!.tags).toContain('reviewed')

    await history.untag(record.id, 'initial')
    loaded = await history.load(record.id)
    expect(loaded!.tags).not.toContain('initial')
    expect(loaded!.tags).toContain('important')
  })

  it('deletes a conversation', async () => {
    const history = container.feature('conversationHistory', {
      cachePath: join(tempDir, '.conversations-delete'),
    })

    const record = await history.create({
      title: 'To Delete',
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: 'bye' }],
      tags: [],
    })

    const deleted = await history.delete(record.id)
    expect(deleted).toBe(true)

    const loaded = await history.load(record.id)
    expect(loaded).toBeNull()
  })

  it('thread operations: findByThread and deleteThread', async () => {
    const history = container.feature('conversationHistory', {
      cachePath: join(tempDir, '.conversations-threads'),
    })

    await history.create({
      title: 'Thread Chat 1',
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'one' }],
      tags: [],
      thread: 'my-thread-123',
    })

    await history.create({
      title: 'Thread Chat 2',
      model: 'gpt-4o',
      messages: [{ role: 'user', content: 'two' }],
      tags: [],
      thread: 'my-thread-123',
    })

    const found = await history.findByThread('my-thread-123')
    expect(found).not.toBeNull()

    await history.deleteThread('my-thread-123')
    const afterDelete = await history.findByThread('my-thread-123')
    expect(afterDelete).toBeNull()
  })
})
