import { createAGIContainer } from './helpers'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, realpathSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

describe('Assistants Manager Integration', () => {
  let container: any
  let tempDir: string

  beforeAll(() => {
    tempDir = realpathSync(mkdtempSync(join(tmpdir(), 'luca-manager-test-')))
    const assistantsDir = join(tempDir, 'assistants')

    // Create assistant-a with CORE.md and tools.ts
    const assistantADir = join(assistantsDir, 'assistant-a')
    mkdirSync(assistantADir, { recursive: true })
    writeFileSync(
      join(assistantADir, 'CORE.md'),
      'You are Assistant A. You help with task A.'
    )
    writeFileSync(
      join(assistantADir, 'tools.ts'),
      `export async function greet(args: { name: string }) { return 'Hello ' + args.name }`
    )

    // Create assistant-b with only CORE.md
    const assistantBDir = join(assistantsDir, 'assistant-b')
    mkdirSync(assistantBDir, { recursive: true })
    writeFileSync(
      join(assistantBDir, 'CORE.md'),
      'You are Assistant B. You specialize in task B.'
    )

    // Create assistant-c with CORE.md and hooks.ts
    const assistantCDir = join(assistantsDir, 'assistant-c')
    mkdirSync(assistantCDir, { recursive: true })
    writeFileSync(
      join(assistantCDir, 'CORE.md'),
      'You are Assistant C with hooks.'
    )
    writeFileSync(
      join(assistantCDir, 'hooks.ts'),
      `export function onStarted() { console.log('started') }`
    )

    container = createAGIContainer({ cwd: tempDir })
  })

  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('discovers assistants from directory', () => {
    const manager = container.feature('assistantsManager', {
      folder: 'assistants',
    })
    manager.discover()

    const list = manager.list()
    expect(list.length).toBe(3)
  })

  it('returns correct entry metadata', () => {
    const manager = container.feature('assistantsManager', {
      folder: 'assistants',
    })
    manager.discover()

    const entryA = manager.get('assistant-a')
    expect(entryA).toBeDefined()
    expect(entryA!.name).toBe('assistant-a')
    expect(entryA!.hasCorePrompt).toBe(true)
    expect(entryA!.hasTools).toBe(true)
    expect(entryA!.hasHooks).toBe(false)

    const entryB = manager.get('assistant-b')
    expect(entryB).toBeDefined()
    expect(entryB!.hasCorePrompt).toBe(true)
    expect(entryB!.hasTools).toBe(false)

    const entryC = manager.get('assistant-c')
    expect(entryC).toBeDefined()
    expect(entryC!.hasHooks).toBe(true)
  })

  it('creates an assistant instance', () => {
    const manager = container.feature('assistantsManager', {
      folder: 'assistants',
    })
    manager.discover()

    const assistant = manager.create('assistant-a', {
      model: 'gpt-4o-mini',
      historyMode: 'lifecycle',
    })

    expect(assistant).toBeDefined()
    expect(assistant.systemPrompt).toContain('Assistant A')
  })

  it('generates a summary listing', () => {
    const manager = container.feature('assistantsManager', {
      folder: 'assistants',
    })
    manager.discover()

    const summary = manager.toSummary()
    expect(typeof summary).toBe('string')
    expect(summary).toContain('assistant-a')
    expect(summary).toContain('assistant-b')
    expect(summary).toContain('assistant-c')
  })

  it('get returns undefined for non-existent assistant', () => {
    const manager = container.feature('assistantsManager', {
      folder: 'assistants',
    })
    manager.discover()

    const entry = manager.get('non-existent')
    expect(entry).toBeUndefined()
  })
})
