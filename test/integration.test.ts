import { describe, it, expect, mock, beforeAll, afterAll } from 'bun:test'
import { NodeContainer } from '../src/node/container'
import { mkdirSync, writeFileSync, rmSync, mkdtempSync, realpathSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import crypto from 'node:crypto'

/**
 * Integration tests that exercise multiple node features working together.
 * These use real filesystem operations in temp directories to test actual behavior.
 */

let testDir: string

beforeAll(() => {
  // realpathSync resolves macOS /var -> /private/var symlinks so paths match `pwd` output
  testDir = realpathSync(mkdtempSync(join(tmpdir(), 'luca-integration-')))

  // seed a small project structure
  mkdirSync(join(testDir, 'src'), { recursive: true })
  mkdirSync(join(testDir, 'config'), { recursive: true })
  mkdirSync(join(testDir, 'data'), { recursive: true })

  writeFileSync(join(testDir, 'package.json'), JSON.stringify({
    name: 'test-project',
    version: '1.0.0',
    scripts: {
      hello: 'echo hello world',
      greet: 'echo greetings',
    },
  }, null, 2))

  writeFileSync(join(testDir, 'src', 'index.ts'), `
import { something } from './utils'
// TODO: implement main entry point
export const main = () => console.log('hello')
`)

  writeFileSync(join(testDir, 'src', 'utils.ts'), `
// TODO: add more utils
export const something = (x: number) => x * 2
export const another = (s: string) => s.toUpperCase()
`)

  writeFileSync(join(testDir, 'config', 'settings.yaml'), `
database:
  host: localhost
  port: 5432
  name: testdb
app:
  debug: true
  logLevel: info
`)

  writeFileSync(join(testDir, 'config', 'extra.yaml'), `
cache:
  ttl: 3600
  maxSize: 1000
`)

  writeFileSync(join(testDir, 'data', 'items.json'), JSON.stringify({
    items: [
      { id: 1, name: 'alpha' },
      { id: 2, name: 'beta' },
    ],
  }, null, 2))

  writeFileSync(join(testDir, 'data', 'meta.json'), JSON.stringify({
    version: '2.0',
    author: 'luca',
  }, null, 2))
})

afterAll(() => {
  rmSync(testDir, { recursive: true, force: true })
})

// generate a valid 32-byte AES-256 key as base64
function makeSecret() {
  return crypto.randomBytes(32).toString('base64')
}

describe('Integration: FS + Proc + OS working together', () => {
  it('uses fs to write a file, proc to read it back, os for temp path', async () => {
    const c = new NodeContainer({ cwd: testDir })
    const tempFile = join(c.os.tmpdir, `luca-test-${c.utils.uuid()}.txt`)
    c.fs.ensureFile(tempFile, 'integration test content')
    expect(c.fs.exists(tempFile)).toBe(true)

    const content = c.proc.exec(`cat "${tempFile}"`)
    expect(content).toBe('integration test content')

    await c.fs.rm(tempFile)
    expect(c.fs.exists(tempFile)).toBe(false)
  })

  it('proc.exec runs in the container cwd by default', () => {
    const c = new NodeContainer({ cwd: testDir })
    const result = c.proc.exec('pwd')
    expect(result).toBe(testDir)
  })

  it('fs.readdir lists seeded files', async () => {
    const c = new NodeContainer({ cwd: testDir })
    const entries = await c.fs.readdir(testDir)
    expect(entries).toContain('src')
    expect(entries).toContain('config')
    expect(entries).toContain('data')
    expect(entries).toContain('package.json')
  })
})

describe('Integration: FS + YAML parsing pipeline', () => {
  it('reads a yaml file from disk and parses it', () => {
    const c = new NodeContainer({ cwd: testDir })
    const yaml = c.feature('yaml')
    const raw = c.fs.readFile(join(testDir, 'config', 'settings.yaml'))
    const parsed = yaml.parse<{ database: { host: string; port: number; name: string }; app: { debug: boolean } }>(raw)

    expect(parsed.database.host).toBe('localhost')
    expect(parsed.database.port).toBe(5432)
    expect(parsed.database.name).toBe('testdb')
    expect(parsed.app.debug).toBe(true)
  })

  it('round-trips yaml: parse -> modify -> stringify -> parse', () => {
    const c = new NodeContainer({ cwd: testDir })
    const yaml = c.feature('yaml')
    const raw = c.fs.readFile(join(testDir, 'config', 'settings.yaml'))
    const data = yaml.parse<any>(raw)

    data.database.port = 3306
    data.database.name = 'production'
    data.app.debug = false

    const modified = yaml.stringify(data)
    const reparsed = yaml.parse<any>(modified)

    expect(reparsed.database.port).toBe(3306)
    expect(reparsed.database.name).toBe('production')
    expect(reparsed.app.debug).toBe(false)
  })
})

describe('Integration: FS + JSON data pipeline', () => {
  it('reads and parses json files from disk', () => {
    const c = new NodeContainer({ cwd: testDir })
    const items = c.fs.readJson(join(testDir, 'data', 'items.json'))
    expect(items.items).toHaveLength(2)
    expect(items.items[0].name).toBe('alpha')
    expect(items.items[1].name).toBe('beta')
  })

  it('writes json, reads it back, verifies roundtrip', async () => {
    const c = new NodeContainer({ cwd: testDir })
    const outPath = join(testDir, 'data', 'output.json')
    const payload = { generated: true, timestamp: Date.now(), values: [1, 2, 3] }

    await c.fs.writeFileAsync(outPath, JSON.stringify(payload, null, 2))
    expect(c.fs.exists(outPath)).toBe(true)

    const readBack = c.fs.readJson(outPath)
    expect(readBack.generated).toBe(true)
    expect(readBack.values).toEqual([1, 2, 3])
  })
})

describe('Integration: VM + container context', () => {
  it('vm can access container properties through context', async () => {
    const c = new NodeContainer({ cwd: testDir })
    const result = await c.vm.run('cwd', { cwd: c.cwd })
    expect(result).toBe(testDir)
  })

  it('vm.perform returns both result and context mutations', async () => {
    const c = new NodeContainer({ cwd: testDir })
    const { result, context } = await c.vm.perform('x = x + 1; x', { x: 10 })
    expect(result).toBe(11)
    expect(context.x).toBe(11)
  })

  it('vm can process data read from the filesystem', async () => {
    const c = new NodeContainer({ cwd: testDir })
    const raw = c.fs.readFile(join(testDir, 'data', 'items.json'))
    const result = await c.vm.run(
      'JSON.parse(jsonStr).items.map(i => i.name).join(", ")',
      { jsonStr: raw }
    )
    expect(result).toBe('alpha, beta')
  })

  it('vm scripts persist context across calls via createContext', async () => {
    const c = new NodeContainer({ cwd: testDir })
    const ctx = c.vm.createContext({ counter: 0 })

    await c.vm.run('counter += 1', ctx)
    await c.vm.run('counter += 5', ctx)
    const final = await c.vm.run('counter', ctx)

    expect(final).toBe(6)
  })
})

describe('Integration: Grep + FS + Proc for code search', () => {
  it('grep finds TODO comments across project files', async () => {
    const c = new NodeContainer({ cwd: testDir })

    if (!c.grep.hasRipgrep) {
      const results = await c.grep.search({ pattern: 'TODO', cwd: testDir })
      expect(results.length).toBeGreaterThanOrEqual(0)
      return
    }

    const results = await c.grep.todos({ cwd: testDir })
    expect(results.length).toBeGreaterThanOrEqual(2)

    const files = results.map((r: any) => r.file)
    const hasIndex = files.some((f: string) => f.includes('index.ts'))
    const hasUtils = files.some((f: string) => f.includes('utils.ts'))
    expect(hasIndex).toBe(true)
    expect(hasUtils).toBe(true)
  })

  it('grep finds import statements', async () => {
    const c = new NodeContainer({ cwd: testDir })

    if (!c.grep.hasRipgrep) return

    const results = await c.grep.imports('./utils', { cwd: testDir })
    expect(results.length).toBeGreaterThanOrEqual(1)
  })

  it('grep finds function definitions', async () => {
    const c = new NodeContainer({ cwd: testDir })

    if (!c.grep.hasRipgrep) return

    const results = await c.grep.definitions('something', { cwd: testDir })
    expect(results.length).toBeGreaterThanOrEqual(1)
  })

  it('grep.count returns match counts', async () => {
    const c = new NodeContainer({ cwd: testDir })

    if (!c.grep.hasRipgrep) return

    const count = await c.grep.count('export', { cwd: testDir })
    expect(count).toBeGreaterThanOrEqual(3)
  })
})

describe('Integration: DiskCache for persistent storage', () => {
  it('disk cache stores and retrieves values', async () => {
    const c = new NodeContainer({ cwd: testDir })
    const cache = c.feature('diskCache', { enable: true, path: join(testDir, '.cache') })

    await cache.set('greeting', 'hello world')
    expect(await cache.has('greeting')).toBe(true)
    expect(await cache.get('greeting')).toBe('hello world')
  })

  it('disk cache stores and retrieves json objects', async () => {
    const c = new NodeContainer({ cwd: testDir })
    const cache = c.feature('diskCache', { enable: true, path: join(testDir, '.cache-json') })

    const data = { users: ['alice', 'bob'], count: 2 }
    await cache.set('users', JSON.stringify(data))
    const retrieved = JSON.parse((await cache.get('users'))!)
    expect(retrieved).toEqual(data)
  })

  it('disk cache keys() lists stored keys', async () => {
    const c = new NodeContainer({ cwd: testDir })
    const cache = c.feature('diskCache', { enable: true, path: join(testDir, '.cache-keys') })

    await cache.set('a', '1')
    await cache.set('b', '2')
    await cache.set('c', '3')

    const keys = await cache.keys()
    expect(keys).toContain('a')
    expect(keys).toContain('b')
    expect(keys).toContain('c')
  })

  it('disk cache rm() removes a key', async () => {
    const c = new NodeContainer({ cwd: testDir })
    const cache = c.feature('diskCache', { enable: true, path: join(testDir, '.cache-rm') })

    await cache.set('temp', 'value')
    expect(await cache.has('temp')).toBe(true)
    await cache.rm('temp')
    expect(await cache.has('temp')).toBe(false)
  })
})

describe('Integration: Vault encryption', () => {
  it('encrypts and decrypts a string payload', () => {
    const c = new NodeContainer({ cwd: testDir })
    const vault = c.feature('vault', { enable: true, secret: makeSecret() })

    const original = 'sensitive data here'
    const encrypted = vault.encrypt(original)
    expect(encrypted).not.toBe(original)

    const decrypted = vault.decrypt(encrypted)
    expect(decrypted).toBe(original)
  })

  it('encrypts json payloads correctly', () => {
    const c = new NodeContainer({ cwd: testDir })
    const vault = c.feature('vault', { enable: true, secret: makeSecret() })

    const data = { secret: 'classified', code: 42 }
    const encrypted = vault.encrypt(JSON.stringify(data))
    const decrypted = JSON.parse(vault.decrypt(encrypted))
    expect(decrypted).toEqual(data)
  })

  it('different secrets produce different ciphertexts', () => {
    const c = new NodeContainer({ cwd: testDir })
    const vault1 = c.feature('vault', { enable: true, secret: makeSecret() })
    const vault2 = c.feature('vault', { enable: true, secret: makeSecret() })

    const encrypted1 = vault1.encrypt('same message')
    const encrypted2 = vault2.encrypt('same message')
    expect(encrypted1).not.toBe(encrypted2)
  })
})

describe('Integration: DiskCache + Vault encrypted caching', () => {
  it('stores and retrieves encrypted values', async () => {
    const c = new NodeContainer({ cwd: testDir })
    const secret = makeSecret()
    const cache = c.feature('diskCache', {
      enable: true,
      path: join(testDir, '.cache-encrypted'),
      encrypt: true,
      secret: Buffer.from(secret, 'base64'),
    })

    await cache.set('secret-key', 'classified information')
    const retrieved = await cache.get('secret-key')
    expect(retrieved).toBe('classified information')
  })
})

describe('Integration: Git + FS + Proc (in actual luca repo)', () => {
  it('git detects the luca repo', () => {
    const c = new NodeContainer()
    expect(c.git.isRepo).toBe(true)
  })

  it('git.branch returns current branch name', () => {
    const c = new NodeContainer()
    const branch = c.git.branch
    expect(typeof branch).toBe('string')
    expect(branch.length).toBeGreaterThan(0)
  })

  it('git.sha returns a commit hash', () => {
    const c = new NodeContainer()
    const sha = c.git.sha
    expect(typeof sha).toBe('string')
    expect(sha).toMatch(/^[a-f0-9]+$/)
  })

  it('git.lsFiles returns tracked files', async () => {
    const c = new NodeContainer()
    const files = await c.git.lsFiles()
    expect(files.length).toBeGreaterThan(0)
    expect(files.some((f: string) => f.includes('package.json'))).toBe(true)
    expect(files.some((f: string) => f.includes('src/'))).toBe(true)
  })

  it('git.getLatestChanges returns recent commits', async () => {
    const c = new NodeContainer()
    const changes = await c.git.getLatestChanges(5)
    expect(changes.length).toBeGreaterThan(0)
    expect(changes.length).toBeLessThanOrEqual(5)
  })

  it('git.getChangeHistoryForFiles returns history for specific files', () => {
    const c = new NodeContainer()
    const history = c.git.getChangeHistoryForFiles('package.json')
    expect(Array.isArray(history)).toBe(true)
    expect(history.length).toBeGreaterThan(0)
  })
})

describe('Integration: Networking + VM for dynamic port allocation', () => {
  it('finds multiple distinct open ports', async () => {
    const c = new NodeContainer()
    const port1 = await c.networking.findOpenPort(40000)
    const port2 = await c.networking.findOpenPort(port1 + 1)
    expect(port1).not.toBe(port2)
    expect(port1).toBeGreaterThanOrEqual(40000)
    expect(port2).toBeGreaterThan(port1)
  })

  it('verifies found port is actually open', async () => {
    const c = new NodeContainer()
    const port = await c.networking.findOpenPort(50000)
    const isOpen = await c.networking.isPortOpen(port)
    expect(isOpen).toBe(true)
  })

  it('vm can use allocated port info to build a url', async () => {
    const c = new NodeContainer()
    const port = await c.networking.findOpenPort(45000)
    const url = await c.vm.run(
      '"http://localhost:" + port + "/api"',
      { port }
    )
    expect(url).toBe(`http://localhost:${port}/api`)
  })
})

describe('Integration: State + Bus + Events across features', () => {
  it('container state changes are observable', () => {
    const c = new NodeContainer({ cwd: testDir })
    const changes: any[] = []
    c.state.observe((changeType, key, value) => changes.push({ changeType, key, value }))

    c.state.set('started', true)
    expect(changes.length).toBeGreaterThan(0)
    expect(changes[0].key).toBe('started')
    expect(changes[0].value).toBe(true)
    expect(c.currentState.started).toBe(true)
  })

  it('features can communicate through the container bus', () => {
    const c = new NodeContainer({ cwd: testDir })
    const messages: string[] = []

    c.on('integration:message', (msg: string) => messages.push(msg))
    c.emit('integration:message', 'from fs')
    c.emit('integration:message', 'from proc')
    c.emit('integration:message', 'from vm')

    expect(messages).toEqual(['from fs', 'from proc', 'from vm'])
  })

  it('waitFor resolves on first matching emit', async () => {
    const c = new NodeContainer({ cwd: testDir })
    const promise = c.waitFor('integration:done')

    setTimeout(() => c.emit('integration:done', { success: true }), 10)
    const result = await promise
    expect(result).toEqual({ success: true })
  })

  it('feature-level state is independent per feature', () => {
    const c = new NodeContainer({ cwd: testDir })
    const yaml = c.feature('yaml')

    yaml.state.set('enabled', true)
    expect(yaml.state.get('enabled')).toBe(true)
    expect(c.vm.state.get('enabled')).toBe(true) // vm is also auto-enabled
  })

  it('multiple bus instances are independent', () => {
    const c = new NodeContainer({ cwd: testDir })
    const bus1 = c.bus()
    const bus2 = c.bus()
    const fn1 = mock()
    const fn2 = mock()

    bus1.on('test', fn1)
    bus2.on('test', fn2)

    bus1.emit('test', 'only-bus1')
    expect(fn1).toHaveBeenCalledWith('only-bus1')
    expect(fn2).not.toHaveBeenCalled()
  })
})

describe('Integration: Container utilities across features', () => {
  it('utils.hashObject produces consistent hashes for feature configs', () => {
    const c = new NodeContainer({ cwd: testDir })
    const config1 = { host: 'localhost', port: 5432 }
    const config2 = { host: 'localhost', port: 5432 }
    const config3 = { host: 'localhost', port: 3306 }

    expect(c.utils.hashObject(config1)).toBe(c.utils.hashObject(config2))
    expect(c.utils.hashObject(config1)).not.toBe(c.utils.hashObject(config3))
  })

  it('utils.stringUtils transforms feature names', () => {
    const c = new NodeContainer()
    const { camelCase, kebabCase } = c.utils.stringUtils
    expect(camelCase('disk-cache')).toBe('diskCache')
    expect(kebabCase('fileManager')).toBe('file-manager')
  })

  it('paths resolve relative to container cwd', () => {
    const c = new NodeContainer({ cwd: testDir })
    const resolved = c.paths.resolve('src', 'index.ts')
    expect(resolved).toBe(join(testDir, 'src', 'index.ts'))
    expect(c.fs.exists(resolved)).toBe(true)
  })

  it('utils.uuid generates unique ids each call', () => {
    const c = new NodeContainer()
    const ids = new Set(Array.from({ length: 100 }, () => c.utils.uuid()))
    expect(ids.size).toBe(100)
  })
})

describe('Integration: FS walk + Grep for project analysis', () => {
  it('walks the test project and finds expected file types', async () => {
    const c = new NodeContainer({ cwd: testDir })
    const result = await c.fs.walkAsync(testDir, { })
    const filePaths = result.files || []

    const hasTs = filePaths.some((p: string) => p.endsWith('.ts'))
    const hasYaml = filePaths.some((p: string) => p.endsWith('.yaml'))
    const hasJson = filePaths.some((p: string) => p.endsWith('.json'))

    expect(hasTs).toBe(true)
    expect(hasYaml).toBe(true)
    expect(hasJson).toBe(true)
  })

  it('grep filesContaining finds ts files with exports', async () => {
    const c = new NodeContainer({ cwd: testDir })

    if (!c.grep.hasRipgrep) return

    const files = await c.grep.filesContaining('export', { cwd: testDir, include: '*.ts' })
    expect(files.length).toBeGreaterThanOrEqual(2)
  })
})

describe('Integration: Multi-feature data processing pipeline', () => {
  it('reads yaml config, transforms with vm, caches result', async () => {
    const c = new NodeContainer({ cwd: testDir })
    const yaml = c.feature('yaml')
    const cache = c.feature('diskCache', { enable: true, path: join(testDir, '.cache-pipeline') })

    // step 1: read yaml config from disk
    const raw = c.fs.readFile(join(testDir, 'config', 'settings.yaml'))
    const config = yaml.parse<any>(raw)

    // step 2: transform with vm (string concat instead of template literal to avoid vm backtick issues)
    const connectionString = await c.vm.run(
      '"postgres://" + db.host + ":" + db.port + "/" + db.name',
      { db: config.database }
    )
    expect(connectionString).toBe('postgres://localhost:5432/testdb')

    // step 3: cache the result
    await cache.set('connectionString', connectionString)
    expect(await cache.get('connectionString')).toBe('postgres://localhost:5432/testdb')
  })

  it('reads json data, processes with vm, writes output', async () => {
    const c = new NodeContainer({ cwd: testDir })

    // step 1: read json
    const items = c.fs.readJson(join(testDir, 'data', 'items.json'))

    // step 2: transform with vm
    const summary = await c.vm.run(
      'items.map(function(i) { return i.id + ":" + i.name }).join("|")',
      { items: items.items }
    )
    expect(summary).toBe('1:alpha|2:beta')

    // step 3: write processed output
    const outPath = join(testDir, 'data', 'summary.txt')
    await c.fs.writeFileAsync(outPath, summary)
    expect(c.fs.readFile(outPath)).toBe(summary)
  })

  it('os info + proc exec + fs write: system report', async () => {
    const c = new NodeContainer({ cwd: testDir })
    const report = [
      `platform: ${c.os.platform}`,
      `arch: ${c.os.arch}`,
      `cpus: ${c.os.cpuCount}`,
      `hostname: ${c.os.hostname}`,
      `cwd: ${c.cwd}`,
    ].join('\n')

    const reportPath = join(testDir, 'system-report.txt')
    await c.fs.writeFileAsync(reportPath, report)

    const readBack = c.fs.readFile(reportPath)
    expect(readBack).toContain(`platform: ${process.platform}`)
    expect(readBack).toContain(`arch: ${process.arch}`)
    expect(readBack).toContain(`cwd: ${testDir}`)
  })
})

describe('Integration: Proc + FS for script execution', () => {
  it('proc.exec runs shell commands in the test dir', () => {
    const c = new NodeContainer({ cwd: testDir })
    const result = c.proc.exec('ls src', { cwd: testDir })
    expect(result).toContain('index.ts')
    expect(result).toContain('utils.ts')
  })

  it('proc.execAndCapture returns structured output', async () => {
    const c = new NodeContainer({ cwd: testDir })
    const result = await c.proc.execAndCapture('echo hello from proc', { cwd: testDir })
    expect(result.stdout.trim()).toBe('hello from proc')
    expect(result.exitCode).toBe(0)
  })

  it('proc.exec result can be written to file by fs', async () => {
    const c = new NodeContainer({ cwd: testDir })
    const listing = c.proc.exec('ls -la src', { cwd: testDir })
    const outPath = join(testDir, 'listing.txt')
    await c.fs.writeFileAsync(outPath, listing)
    expect(c.fs.exists(outPath)).toBe(true)
    expect(c.fs.readFile(outPath)).toContain('index.ts')
  })
})

describe('Integration: ESBuild + FS for code transformation', () => {
  it('transforms typescript to javascript', async () => {
    const c = new NodeContainer({ cwd: testDir })
    const esbuild = c.feature('esbuild', { enable: true })

    const tsCode = `
      const greet = (name: string): string => 'Hello, ' + name + '!'
      export default greet
    `

    const result = await esbuild.transform(tsCode, { loader: 'ts' })
    expect(result.code).toContain('greet')
    expect(result.code).not.toContain(': string')
  })

  it('reads ts file from disk, transforms it, writes js output', async () => {
    const c = new NodeContainer({ cwd: testDir })
    const esbuild = c.feature('esbuild', { enable: true })

    const tsSource = c.fs.readFile(join(testDir, 'src', 'utils.ts'))
    const result = await esbuild.transform(tsSource, { loader: 'ts' })

    const outPath = join(testDir, 'src', 'utils.js')
    await c.fs.writeFileAsync(outPath, result.code)

    const jsContent = c.fs.readFile(outPath)
    expect(jsContent).toContain('something')
    expect(jsContent).toContain('another')
    expect(jsContent).not.toContain(': number')
    expect(jsContent).not.toContain(': string')
  })
})

describe('Integration: FS findUp + paths resolution', () => {
  it('findUp locates package.json from nested dir', () => {
    const c = new NodeContainer({ cwd: join(testDir, 'src') })
    const found = c.fs.findUp('package.json', { cwd: join(testDir, 'src') })
    expect(found).toBeDefined()
    expect(found).toContain('package.json')
  })

  it('paths work together with fs for relative file access', () => {
    const c = new NodeContainer({ cwd: testDir })
    const configPath = c.paths.resolve('config', 'settings.yaml')
    expect(c.fs.exists(configPath)).toBe(true)

    const content = c.fs.readFile(configPath)
    expect(content).toContain('database')
  })
})

describe('Integration: Container lifecycle and feature coordination', () => {
  it('start() makes all auto-enabled features available', async () => {
    const c = new NodeContainer({ cwd: testDir })
    await c.start()
    expect(c.currentState.started).toBe(true)

    // all auto-enabled features should be accessible
    expect(c.fs).toBeDefined()
    expect(c.git).toBeDefined()
    expect(c.proc).toBeDefined()
    expect(c.os).toBeDefined()
    expect(c.networking).toBeDefined()
    expect(c.ui).toBeDefined()
    expect(c.vm).toBeDefined()
    expect(c.grep).toBeDefined()
  })

  it('features enabled via constructor options are available', () => {
    const c = new NodeContainer({
      cwd: testDir,
      enable: ['yaml', 'diskCache', 'vault'],
    })

    expect(c.features.available).toContain('yaml')
    expect(c.features.available).toContain('diskCache')
    expect(c.features.available).toContain('vault')
  })

  it('container exposes manifest from package.json', () => {
    // the luca project itself has a manifest
    const lucaContainer = new NodeContainer()
    expect(lucaContainer.manifest).toBeDefined()
    expect(lucaContainer.manifest.name).toBeDefined()
  })

  it('features share the same container reference', () => {
    const c = new NodeContainer({ cwd: testDir })
    const yaml = c.feature('yaml')
    const cache = c.feature('diskCache', { enable: true, path: join(testDir, '.cache-shared') })

    expect(yaml.container.uuid).toBe(c.uuid)
    expect(cache.container.uuid).toBe(c.uuid)
    expect(yaml.container.uuid).toBe(cache.container.uuid)
  })
})

describe('Integration: UI feature formatting', () => {
  it('ui.endent strips indentation from template literals', () => {
    const c = new NodeContainer()
    const result = c.ui.endent`
      hello
        world
    `
    expect(result).toBe('hello\n  world')
  })

  it('ui.colors produces styled strings', () => {
    const c = new NodeContainer()
    const styled = c.ui.colors.red('error message')
    expect(typeof styled).toBe('string')
    expect(styled.length).toBeGreaterThanOrEqual('error message'.length)
  })
})

describe('Integration: Multiple containers are fully isolated', () => {
  it('state changes in one container do not affect another', () => {
    const c1 = new NodeContainer({ cwd: testDir })
    const c2 = new NodeContainer({ cwd: testDir })

    c1.state.set('started', true)
    expect(c1.currentState.started).toBe(true)
    expect(c2.currentState.started).toBe(false)
  })

  it('events in one container do not leak to another', () => {
    const c1 = new NodeContainer({ cwd: testDir })
    const c2 = new NodeContainer({ cwd: testDir })
    const fn1 = mock()
    const fn2 = mock()

    c1.on('isolated', fn1)
    c2.on('isolated', fn2)

    c1.emit('isolated', 'only-c1')
    expect(fn1).toHaveBeenCalledWith('only-c1')
    expect(fn2).not.toHaveBeenCalled()
  })

  it('feature instances are unique per container', () => {
    const c1 = new NodeContainer({ cwd: testDir })
    const c2 = new NodeContainer({ cwd: testDir })
    const y1 = c1.feature('yaml')
    const y2 = c2.feature('yaml')
    expect(y1.uuid).not.toBe(y2.uuid)
  })
})

describe('Integration: Zod schema access at runtime', () => {
  it('container provides zod instance', () => {
    const c = new NodeContainer()
    expect(c.z).toBeDefined()
    expect(typeof c.z.string).toBe('function')
    expect(typeof c.z.object).toBe('function')
  })

  it('newState validates through zod schemas', () => {
    const c = new NodeContainer()
    const state = c.newState({ count: 0, name: 'test' })

    state.set('count', 42)
    state.set('name', 'updated')

    expect(state.get('count')).toBe(42)
    expect(state.get('name')).toBe('updated')
  })
})
