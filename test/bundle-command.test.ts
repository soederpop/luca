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
})
