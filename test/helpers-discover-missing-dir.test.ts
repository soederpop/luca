import { describe, it, expect } from 'bun:test'
import { NodeContainer } from '../src/node/container'
import os from 'os'
import { join } from 'path'
import { mkdirSync, writeFileSync } from 'fs'

describe('helpers.discover with explicit directory', () => {
  it('resolves to [] when the directory does not exist instead of throwing ENOENT', async () => {
    const container = new NodeContainer()
    const helpers = container.feature('helpers')
    const names = await helpers.discover('commands', {
      directory: join(os.tmpdir(), `luca-nonexistent-${Date.now()}`),
    })
    expect(names).toEqual([])
  })

  it('does not fall back to the conventional folder when the explicit directory is missing', async () => {
    // Project root with a real commands/ folder — but we ask for a different, missing dir
    const root = join(os.tmpdir(), `luca-discover-test-${Date.now()}`)
    mkdirSync(join(root, 'commands'), { recursive: true })
    writeFileSync(
      join(root, 'commands', 'hello.ts'),
      `export const description = 'says hello'\nexport default async function hello() { return 'hi' }\n`
    )

    const container = new NodeContainer({ cwd: root })
    const helpers = container.feature('helpers')

    const missing = await helpers.discover('commands', { directory: join(root, 'plugins', 'nope', 'commands') })
    expect(missing).toEqual([])

    // The conventional folder still discovers independently afterwards
    const conventional = await helpers.discover('commands')
    expect(conventional).toContain('hello')
  })
})
