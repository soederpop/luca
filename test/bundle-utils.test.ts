import { describe, expect, it } from 'bun:test'
import {
  commandNameFromFile,
  safeIdent,
  normalizeTargets,
  shouldIncludeBundleFile,
  shouldIncludeAssistantFile,
  isBinaryAssistantFile,
  generateConsumerManifest,
  generateConsumerEntry,
  generateAssistantsModule,
  generateNamespaceShim,
  generateCommandShim,
  generateRuntimePackageJson,
  generateEmbeddedRuntimeModule,
  buildRuntimeBlobIndex,
  normalizeRuntimeDependencySpec,
  RUNTIME_EXPORT_MAP,
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
    expect(text).not.toContain('luca/commands/')
    expect(text).not.toContain('generated-consumer-assistants')
  })

  it('generates consumer entry with builtins and assistants module', () => {
    const text = generateConsumerEntry({
      binaryName: 'loopy',
      manifestPath: './generated-consumer-manifest.ts',
      builtins: ['chat', 'assistant'],
      assistantsPath: './generated-consumer-assistants.ts',
    })

    expect(text).toContain("import \"luca/commands/chat\"")
    expect(text).toContain("import \"luca/commands/assistant\"")
    expect(text).toContain("import \"./generated-consumer-assistants.ts\"")
    // container import must come first so features register before anything runs
    expect(text.indexOf("import container from 'luca/agi'")).toBeLessThan(text.indexOf('luca/commands/chat'))
  })

  it('classifies binary assistant files by extension', () => {
    expect(isBinaryAssistantFile('generated/phrase.mp3')).toBe(true)
    expect(isBinaryAssistantFile('avatar.PNG')).toBe(true)
    expect(isBinaryAssistantFile('CORE.md')).toBe(false)
    expect(isBinaryAssistantFile('tools.ts')).toBe(false)
    expect(isBinaryAssistantFile('Makefile')).toBe(false)
  })

  it('excludes junk from assistant folders', () => {
    expect(shouldIncludeAssistantFile('CORE.md')).toBe(true)
    expect(shouldIncludeAssistantFile('tools.ts')).toBe(true)
    expect(shouldIncludeAssistantFile('logger.ts')).toBe(true)
    expect(shouldIncludeAssistantFile('generated/manifest.json')).toBe(true)
    expect(shouldIncludeAssistantFile('node_modules/zod/index.js')).toBe(false)
    expect(shouldIncludeAssistantFile('.git/HEAD')).toBe(false)
    expect(shouldIncludeAssistantFile('logs/session.log')).toBe(false)
    expect(shouldIncludeAssistantFile('.DS_Store')).toBe(false)
    expect(shouldIncludeAssistantFile('debug.log')).toBe(false)
    expect(shouldIncludeAssistantFile('.bundle-hash')).toBe(false)
  })

  it('generates namespace shims that re-export from the runtime barrel', () => {
    const shim = generateNamespaceShim('lucaMain', ['Feature', 'commands', 'default', 'not-an-ident'])

    expect(shim).toContain("import { lucaMain as __ns } from './runtime-barrel.js'")
    expect(shim).toContain('const { Feature, commands } = __ns')
    expect(shim).toContain('export { Feature, commands }')
    expect(shim).toContain('export default __ns.default')
    expect(shim).not.toContain('not-an-ident')
  })

  it('omits the default export from shims when the namespace has none', () => {
    const shim = generateNamespaceShim('lucaSchemas', ['CommandOptionsSchema'])
    expect(shim).not.toContain('export default')
  })

  it('generates command shims that register via lazy loaders', () => {
    const shim = generateCommandShim('chat')
    expect(shim).toContain("import { commandLoaders } from '../runtime-barrel.js'")
    expect(shim).toContain('await commandLoaders["chat"]()')
  })

  it('maps every runtime specifier to a shim artifact', () => {
    expect(RUNTIME_EXPORT_MAP['.']).toBe('./index.js')
    expect(RUNTIME_EXPORT_MAP['./agi']).toBe('./agi.js')
    expect(RUNTIME_EXPORT_MAP['./cli/runner']).toBe('./cli-runner.js')
    expect(RUNTIME_EXPORT_MAP['./commands/*']).toBe('./commands/*.js')
    const pkg = JSON.parse(generateRuntimePackageJson('9.9.9'))
    expect(pkg.name).toBe('luca')
    expect(pkg.version).toBe('9.9.9')
    expect(pkg.exports).toEqual(RUNTIME_EXPORT_MAP)
  })

  it('normalizes runtime specs into dependency values', () => {
    expect(normalizeRuntimeDependencySpec('luca')).toBe('latest')
    expect(normalizeRuntimeDependencySpec('luca@3.3.0')).toBe('3.3.0')
    expect(normalizeRuntimeDependencySpec('3.3.0')).toBe('3.3.0')
    expect(normalizeRuntimeDependencySpec('file:/repos/luca')).toBe('file:/repos/luca')
  })

  it('builds a contiguous blob index from file sizes', () => {
    const index = buildRuntimeBlobIndex([
      { path: 'runtime-barrel.js', size: 100 },
      { path: 'index.js', size: 10 },
      { path: '__vendor/@number0/iroh/index.js', size: 5 },
    ])
    expect(index).toEqual([
      { path: 'runtime-barrel.js', offset: 0, length: 100 },
      { path: 'index.js', offset: 100, length: 10 },
      { path: '__vendor/@number0/iroh/index.js', offset: 110, length: 5 },
    ])
  })

  it('generates the embedded runtime module with a blob import, or a stub without one', () => {
    const populated = generateEmbeddedRuntimeModule([{ path: 'runtime-barrel.js', offset: 0, length: 42 }])
    expect(populated).toContain("import _blob from './artifacts.blob' with { type: 'file' }")
    expect(populated).toContain('{ path: "runtime-barrel.js", offset: 0, length: 42 }')

    const stub = generateEmbeddedRuntimeModule([])
    expect(stub).not.toContain('artifacts.blob')
    expect(stub).toContain('export const runtimeBlob: string | null = null')
  })

  it('generates the assistants module with extraction and discovery registration', () => {
    const text = generateAssistantsModule({
      binaryName: 'loopy',
      bundleHash: 'abc123',
      assistants: [
        {
          name: 'researcher',
          files: [
            { path: 'CORE.md', encoding: 'utf8', content: '# Researcher' },
            { path: 'generated/hi.mp3', encoding: 'base64', content: 'AAEC' },
          ],
        },
      ],
    })

    expect(text).toContain("import container from 'luca/agi'")
    expect(text).toContain('const BUNDLE_HASH = "abc123"')
    expect(text).toContain('"researcher": [')
    expect(text).toContain('{ path: "CORE.md", encoding: "utf8", content: "# Researcher" }')
    expect(text).toContain('{ path: "generated/hi.mp3", encoding: "base64", content: "AAEC" }')
    expect(text).toContain("'.luca', 'bundles', \"loopy\", 'assistants'")
    expect(text).toContain('await manager.addDiscoveryFolder(root)')
    expect(text).toContain("Buffer.from(file.content, 'base64')")
  })
})
