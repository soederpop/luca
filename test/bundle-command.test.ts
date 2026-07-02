import { describe, expect, it } from 'bun:test'
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import '../src/commands/bundle'
import { commands } from '../src/command'
import container from '../src/agi'

describe('bundle command', () => {
  it('registers as a built-in command', () => {
    expect(commands.has('bundle')).toBe(true)
    const Bundle = commands.lookup('bundle') as any
    expect(Bundle.commandDescription).toContain('Compile a Luca project')
  })

  it('dry-run writes isolated generated bundle files', async () => {
    const root = mkdtempSync(join(tmpdir(), 'luca-bundle-test-'))
    mkdirSync(join(root, 'commands'))
    writeFileSync(
      join(root, 'commands', 'hello.ts'),
      `export default async function hello() { console.log('hi') }\n`,
    )

    const outDir = join(root, 'out')
    const cmd = container.command('bundle' as any)
    await cmd.dispatch(
      {
        name: 'hello-bin',
        source: root,
        outDir,
        targets: 'darwin-arm64',
        builtins: '',
        runtime: 'luca',
        dryRun: true,
      },
      'headless',
    )

    const buildDir = join(outDir, '.luca-bundle-build', 'hello-bin')
    expect(existsSync(join(buildDir, 'entry.ts'))).toBe(true)
    expect(existsSync(join(buildDir, 'generated-consumer-manifest.ts'))).toBe(true)
    expect(existsSync(join(buildDir, 'package.json'))).toBe(true)

    const entry = readFileSync(join(buildDir, 'entry.ts'), 'utf8')
    expect(entry).not.toContain('@/commands/index')
    expect(entry).toContain("binaryName: \"hello-bin\"")

    const manifest = readFileSync(join(buildDir, 'generated-consumer-manifest.ts'), 'utf8')
    expect(manifest).toContain('registerBundledCommand("hello"')

    const pkg = JSON.parse(readFileSync(join(buildDir, 'package.json'), 'utf8'))
    expect(pkg.dependencies.luca).toBe('luca')
  })

  it('embeds assistants and wires chat into the entry', async () => {
    const root = mkdtempSync(join(tmpdir(), 'luca-bundle-assistants-test-'))
    const assistantDir = join(root, 'assistants', 'researcher')
    mkdirSync(join(assistantDir, 'generated'), { recursive: true })
    writeFileSync(join(assistantDir, 'CORE.md'), '# You are a researcher\n')
    writeFileSync(join(assistantDir, 'tools.ts'), `import { logger } from './logger'\nexport const schemas = {}\n`)
    writeFileSync(join(assistantDir, 'logger.ts'), `export const logger = console\n`)
    const mp3Bytes = Buffer.from([0xff, 0xfb, 0x90, 0x00, 0x01, 0x02])
    writeFileSync(join(assistantDir, 'generated', 'hello.mp3'), mp3Bytes)
    // junk that must not be embedded
    mkdirSync(join(assistantDir, 'node_modules', 'zod'), { recursive: true })
    writeFileSync(join(assistantDir, 'node_modules', 'zod', 'index.js'), 'module.exports = {}\n')
    // a sibling dir without CORE.md is not an assistant
    mkdirSync(join(root, 'assistants', 'not-an-assistant'))
    writeFileSync(join(root, 'assistants', 'not-an-assistant', 'notes.md'), 'nope\n')

    const outDir = join(root, 'out')
    const cmd = container.command('bundle' as any)
    await cmd.dispatch(
      {
        name: 'agent-bin',
        source: root,
        outDir,
        targets: 'darwin-arm64',
        builtins: '',
        runtime: 'luca',
        dryRun: true,
      },
      'headless',
    )

    const buildDir = join(outDir, '.luca-bundle-build', 'agent-bin')
    const assistantsModulePath = join(buildDir, 'generated-consumer-assistants.ts')
    expect(existsSync(assistantsModulePath)).toBe(true)

    const assistantsModule = readFileSync(assistantsModulePath, 'utf8')
    expect(assistantsModule).toContain('"researcher": [')
    expect(assistantsModule).toContain('path: "CORE.md"')
    expect(assistantsModule).toContain('path: "logger.ts"')
    expect(assistantsModule).toContain(`content: ${JSON.stringify(mp3Bytes.toString('base64'))}`)
    expect(assistantsModule).not.toContain('not-an-assistant')
    expect(assistantsModule).not.toContain('node_modules')

    const entry = readFileSync(join(buildDir, 'entry.ts'), 'utf8')
    expect(entry).toContain('import "luca/commands/chat"')
    expect(entry).toContain('import "luca/commands/assistant"')
    expect(entry).toContain('import "./generated-consumer-assistants.ts"')
  })
})
