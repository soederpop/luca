import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { AGIContainer } from '../src/agi/container.server'

/**
 * modelProviders reads ~/.luca/model-providers.yml (via LUCA_HOME) and the
 * providers: section of assistants/options.yml when the feature is created.
 * Each test gets a fresh LUCA_HOME and cwd so nothing on the developer's
 * machine leaks in.
 */
describe('ModelProviders YAML config files', () => {
  let tmp: string
  let home: string
  let cwd: string
  let prevHome: string | undefined

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), 'mp-config-'))
    home = join(tmp, 'luca-home')
    cwd = join(tmp, 'project')
    mkdirSync(home, { recursive: true })
    mkdirSync(join(cwd, 'assistants'), { recursive: true })
    prevHome = process.env.LUCA_HOME
    process.env.LUCA_HOME = home
  })

  afterEach(() => {
    if (prevHome === undefined) delete process.env.LUCA_HOME
    else process.env.LUCA_HOME = prevHome
    rmSync(tmp, { recursive: true, force: true })
  })

  const providers = () => new AGIContainer({ cwd }).feature('modelProviders')

  it('is a no-op when neither file exists', () => {
    const mp = providers()
    expect(mp.loadedConfigSources).toEqual([])
    expect(mp.configuredProviderIds).toEqual([])
  })

  it('loads ~/.luca/model-providers.yml with hosts and shorthand entries', async () => {
    writeFileSync(join(home, 'model-providers.yml'), [
      'hosts:',
      '  chief: http://chief:1234/v1',
      'qwen36: chief',
      'writer: chief/gemma4',
      'direct: http://10.0.0.5:8000/v1',
      'kokoro:',
      '  kind: tts',
      '  baseURL: http://chief:8002',
      '  defaultModel: kokoro',
      '  apiKeyEnv: KOKORO_KEY',
    ].join('\n'))

    const mp = providers()
    expect(mp.loadedConfigSources).toEqual([join(home, 'model-providers.yml')])
    expect(mp.configuredProviderIds).toEqual(['qwen36', 'writer', 'direct', 'kokoro'])
    expect(mp.hasProfile('hosts')).toBe(false)

    const qwen = await mp.resolve({ provider: 'qwen36' })
    expect(qwen.baseURL).toBe('http://chief:1234/v1')
    expect(qwen.model).toBe('qwen36')
    expect(qwen.apiMode).toBe('openai-chat-completions')
    expect(qwen.auth).toBe('none')

    expect(mp.get('writer')?.defaultModel).toBe('gemma4')
    expect(mp.get('direct')).toMatchObject({ baseURL: 'http://10.0.0.5:8000/v1', defaultModel: 'direct' })
    expect(mp.get('kokoro')).toMatchObject({ apiMode: 'openai-audio', auth: 'apiKey', kind: 'tts', label: 'kokoro' })
  })

  it('accepts a providers: wrapper in the machine file', () => {
    writeFileSync(join(home, 'model-providers.yml'), 'providers:\n  box: http://box:8000/v1\n')
    expect(providers().configuredProviderIds).toEqual(['box'])
  })

  it('reads only the providers: section of assistants/options.yml', () => {
    writeFileSync(join(cwd, 'assistants', 'options.yml'), [
      'defaults:',
      '  temperature: 0.4',
      'chiefOfStaff:',
      '  model: gpt-5.4-mini',
      'providers:',
      '  box: http://box:8000/v1',
    ].join('\n'))

    const mp = providers()
    expect(mp.configuredProviderIds).toEqual(['box'])
    expect(mp.hasProfile('chiefOfStaff')).toBe(false)
    expect(mp.hasProfile('defaults')).toBe(false)
  })

  it('project entries win over machine entries and can use machine hosts', () => {
    writeFileSync(join(home, 'model-providers.yml'), [
      'hosts:',
      '  chief: http://chief:1234/v1',
      'box:',
      '  host: chief',
      '  model: machine-model',
      '  apiKeyEnv: BOX_KEY',
    ].join('\n'))
    writeFileSync(join(cwd, 'assistants', 'options.yml'), 'providers:\n  box: chief/project-model\n')

    const mp = providers()
    expect(mp.loadedConfigSources).toHaveLength(2)
    const box = mp.get('box')!
    expect(box.defaultModel).toBe('project-model')
    expect(box.baseURL).toBe('http://chief:1234/v1')
    // Merge, not replace: the machine file's key setting survives the project patch.
    expect(box.apiKeyEnv).toBe('BOX_KEY')
    expect(box.auth).toBe('apiKey')
  })

  it('patches a built-in profile without redeclaring it', () => {
    writeFileSync(join(home, 'model-providers.yml'), 'ollama:\n  model: llama3.3\n')
    const ollama = providers().get('ollama')!
    expect(ollama.defaultModel).toBe('llama3.3')
    expect(ollama.baseURL).toBe('http://localhost:11434/v1')
  })

  it('skips enabled: false entries', () => {
    writeFileSync(join(home, 'model-providers.yml'), 'off:\n  enabled: false\n  baseURL: http://x/v1\non: http://y/v1\n')
    const mp = providers()
    expect(mp.configuredProviderIds).toEqual(['on'])
    expect(mp.hasProfile('off')).toBe(false)
  })

  it('survives a malformed file', () => {
    writeFileSync(join(home, 'model-providers.yml'), 'hosts: [\n  broken')
    writeFileSync(join(cwd, 'assistants', 'options.yml'), 'providers:\n  ok: http://ok/v1\n')
    const mp = providers()
    expect(mp.configuredProviderIds).toEqual(['ok'])
    expect(mp.hasProfile('openai')).toBe(true)
  })

  it('loadConfigFiles() re-reads edits in a running process', () => {
    const mp = providers()
    expect(mp.configuredProviderIds).toEqual([])
    writeFileSync(join(home, 'model-providers.yml'), 'late: http://late/v1\n')
    expect(mp.loadConfigFiles()).toEqual(['late'])
    expect(mp.hasProfile('late')).toBe(true)
  })

  it('assistantsManager does not treat providers: as an unknown assistant', async () => {
    writeFileSync(join(cwd, 'assistants', 'options.yml'), 'providers:\n  box: http://box:8000/v1\n')
    const container = new AGIContainer({ cwd })
    const manager = container.feature('assistantsManager')
    const unused: string[][] = []
    manager.on('unusedOverrides', (names: string[]) => unused.push(names))
    await manager.discover()
    expect(unused.flat()).not.toContain('providers')
  })
})
