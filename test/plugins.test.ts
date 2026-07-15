import { describe, it, expect } from 'bun:test'
import { NodeContainer } from '../src/node/container'
import { loadEnvPlugins } from '../src/cli/runner'
import os from 'os'
import { join } from 'path'
import { mkdirSync, writeFileSync } from 'fs'

function makePluginDir(name: string): string {
  const dir = join(os.tmpdir(), `luca-plugin-test-${name}-${Date.now()}`)
  mkdirSync(join(dir, 'commands'), { recursive: true })
  writeFileSync(
    join(dir, 'commands', `${name}-hello.ts`),
    `export const description = 'says hello from the plugin'\nexport default async function hello() { return 'hi from ${name}' }\n`
  )
  writeFileSync(
    join(dir, 'luca.plugin.ts'),
    `export async function attach(container: any, context: any) {\n  container.state.set('pluginAttached', context.pluginDir)\n}\n`
  )
  return dir
}

describe('helpers.usePlugin', () => {
  it('discovers helper folders from a plugin directory and calls the entry module', async () => {
    const dir = makePluginDir('alpha')
    const container = new NodeContainer()
    const helpers = container.feature('helpers')

    const results = await (helpers as any).usePlugin(dir)

    expect(results.commands).toContain('alpha-hello')
    expect(container.commands.available).toContain('alpha-hello')
    expect(container.state.get('pluginAttached')).toBe(dir)
  })

  it('coalesces repeated loads of the same plugin directory', async () => {
    const dir = makePluginDir('beta')
    const container = new NodeContainer()
    const helpers = container.feature('helpers') as any

    const [first, second] = await Promise.all([helpers.usePlugin(dir), helpers.usePlugin(dir)])
    expect(first).toBe(second)
  })

  it('throws a helpful error for an unknown plugin name', async () => {
    const container = new NodeContainer()
    const helpers = container.feature('helpers') as any
    await expect(helpers.usePlugin(`definitely-not-a-plugin-${Date.now()}`)).rejects.toThrow(/\.luca\/plugins/)
  })
})

describe('container.use with a plugin directory path', () => {
  it('loads the plugin asynchronously and start() awaits it', async () => {
    const dir = makePluginDir('gamma')
    const container = new NodeContainer()

    container.use(dir as any)
    await container.start()

    expect(container.commands.available).toContain('gamma-hello')
  })

  it('still throws for strings that are neither features nor plugins', () => {
    const container = new NodeContainer()
    expect(() => container.use(`no-such-thing-${Date.now()}` as any)).toThrow(/is not available/)
  })
})

describe('LUCA_PLUGINS env var', () => {
  it('loads each comma-separated plugin and warns (not throws) on failures', async () => {
    const dir = makePluginDir('delta')
    const container = new NodeContainer()

    const prev = process.env.LUCA_PLUGINS
    process.env.LUCA_PLUGINS = `${dir}, definitely-missing-${Date.now()}`
    try {
      await loadEnvPlugins(container)
    } finally {
      if (prev === undefined) delete process.env.LUCA_PLUGINS
      else process.env.LUCA_PLUGINS = prev
    }

    expect(container.commands.available).toContain('delta-hello')
  })
})
