import { describe, expect, it } from 'bun:test'
import {
  commandNameFromFile,
  safeIdent,
  normalizeTargets,
  shouldIncludeBundleFile,
  generateConsumerManifest,
  generateConsumerEntry,
} from '../src/cli/bundle-utils'

describe('bundle utils', () => {
  it('derives command names from top-level command files', () => {
    expect(commandNameFromFile('/tmp/app/commands/workflow.ts')).toBe('workflow')
    expect(commandNameFromFile('/tmp/app/commands/comms-service.ts')).toBe('comms-service')
  })

  it('returns null for command index files', () => {
    expect(commandNameFromFile('/tmp/app/commands/index.ts')).toBe(null)
  })

  it('creates safe import identifiers', () => {
    expect(safeIdent('comms-service')).toBe('comms_service')
    expect(safeIdent('assistants/designer')).toBe('assistants_designer')
  })

  it('normalizes comma-separated targets', () => {
    expect(normalizeTargets('darwin-arm64, linux-x64,,')).toEqual(['darwin-arm64', 'linux-x64'])
  })

  it('excludes generated and test files from bundles', () => {
    expect(shouldIncludeBundleFile('features/a.ts')).toBe(true)
    expect(shouldIncludeBundleFile('features/a.test.ts')).toBe(false)
    expect(shouldIncludeBundleFile('features/a.spec.ts')).toBe(false)
    expect(shouldIncludeBundleFile('features/introspection.generated.ts')).toBe(false)
  })

  it('generates command imports and registrations', () => {
    const text = generateConsumerManifest({
      helperFiles: ['/app/features/workflow-service.ts'],
      commandFiles: [{ file: '/app/commands/workflow.ts', name: 'workflow' }],
    })

    expect(text).toContain("import \"/app/features/workflow-service.ts\"")
    expect(text).toContain("import * as _cmd_workflow from \"/app/commands/workflow.ts\"")
    expect(text).toContain("registerBundledCommand(\"workflow\", _cmd_workflow)")
    expect(text).toContain("typeof commandModule.run === 'function'")
    expect(text).toContain("typeof commandModule.handler === 'function'")
    expect(text).toContain("typeof mod.default === 'function'")
  })

  it('generates consumer entry without luca command index import', () => {
    const text = generateConsumerEntry({ binaryName: 'loopy', manifestPath: './generated-consumer-manifest.ts' })

    expect(text).toContain("import container from 'luca/agi'")
    expect(text).toContain("import \"./generated-consumer-manifest.ts\"")
    expect(text).toContain("import { runCli } from 'luca/cli/runner'")
    expect(text).toContain("binaryName: \"loopy\"")
    expect(text).not.toContain('@/commands/index')
  })
})
