import { describe, expect, it } from 'bun:test'
import { mergeProviderConfig, providersDestinations } from '../src/commands/setup'
import type { ModelProviderConfigSuggestion } from '../src/agi/features/model-providers'
import { AGIContainer } from '../src/agi/container.server'

/**
 * `mergeProviderConfig` is what `luca setup --providers` uses to fold a
 * discovered suggestion into a file the user may already have curated. The
 * suggestion's ids/host names avoid collisions, so merging must never drop an
 * unrelated key.
 */
const suggestion: ModelProviderConfigSuggestion = {
  hosts: { spark: 'http://spark-f941:8888/v1' },
  providers: { 'spark-8888': 'spark/deepseek-v4', 'box-9000': { host: 'spark', model: 'org/model' } },
}

const machine = { kind: 'machine', path: '/tmp/model-providers.yml' } as const
const project = { kind: 'project', path: '/tmp/assistants/options.yml' } as const

describe('mergeProviderConfig', () => {
  it('creates a machine file from nothing', () => {
    expect(mergeProviderConfig(undefined, suggestion, machine)).toEqual({
      hosts: { spark: 'http://spark-f941:8888/v1' },
      'spark-8888': 'spark/deepseek-v4',
      'box-9000': { host: 'spark', model: 'org/model' },
    })
  })

  it('merges into an existing machine file without touching unrelated keys', () => {
    const doc = {
      hosts: { local: 'http://127.0.0.1:1234/v1' },
      superqwen: 'local/superqwen3.8-27b-abliterated-mlx',
    }
    expect(mergeProviderConfig(doc, suggestion, machine)).toEqual({
      hosts: { local: 'http://127.0.0.1:1234/v1', spark: 'http://spark-f941:8888/v1' },
      superqwen: 'local/superqwen3.8-27b-abliterated-mlx',
      'spark-8888': 'spark/deepseek-v4',
      'box-9000': { host: 'spark', model: 'org/model' },
    })
  })

  it('writes under providers: for a machine file already using that wrapper', () => {
    const doc = { providers: { existing: 'http://existing:1234/v1' } }
    expect(mergeProviderConfig(doc, suggestion, machine)).toEqual({
      providers: {
        existing: 'http://existing:1234/v1',
        hosts: { spark: 'http://spark-f941:8888/v1' },
        'spark-8888': 'spark/deepseek-v4',
        'box-9000': { host: 'spark', model: 'org/model' },
      },
    })
  })

  it('merges into a project options.yml, preserving sibling keys', () => {
    const doc = { defaults: { temperature: 0.4 }, providers: { chief: 'chief/qwen' } }
    expect(mergeProviderConfig(doc, suggestion, project)).toEqual({
      defaults: { temperature: 0.4 },
      providers: {
        chief: 'chief/qwen',
        hosts: { spark: 'http://spark-f941:8888/v1' },
        'spark-8888': 'spark/deepseek-v4',
        'box-9000': { host: 'spark', model: 'org/model' },
      },
    })
  })

  it('creates the providers: section for a project file that has none', () => {
    expect(mergeProviderConfig({ defaults: { temperature: 0.4 } }, suggestion, project)).toEqual({
      defaults: { temperature: 0.4 },
      providers: {
        hosts: { spark: 'http://spark-f941:8888/v1' },
        'spark-8888': 'spark/deepseek-v4',
        'box-9000': { host: 'spark', model: 'org/model' },
      },
    })
  })
})

describe('providersDestinations', () => {
  it('points at the machine file and the project options file', () => {
    const c = new AGIContainer()
    const [machineDest, projectDest] = providersDestinations(c as any)
    expect(machineDest.kind).toBe('machine')
    expect(machineDest.path.endsWith('model-providers.yml')).toBe(true)
    expect(projectDest.kind).toBe('project')
    expect(projectDest.path.endsWith('assistants/options.yml')).toBe(true)
  })
})
