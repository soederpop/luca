import { afterEach, beforeEach, describe, expect, it } from 'bun:test'
import { NodeContainer } from '../src/node/container'

let container: NodeContainer
let root: string
beforeEach(() => {
  const host = new NodeContainer()
  root = host.paths.join(host.os.tmpdir, `luca-packages-${host.utils.uuid()}`)
  host.fs.ensureFolder(root)
  container = new NodeContainer({ cwd: root })
})
afterEach(() => container.fs.rmSync(root, { recursive: true, force: true }))

function manifest(folder: string, data: Record<string, unknown>) {
  container.fs.ensureFolder(folder)
  container.fs.writeFile(`${folder}/package.json`, JSON.stringify(data))
}

describe('PackageFinder', () => {
  it('starts with an empty index', () => {
    const finder = container.feature('packageFinder')
    expect(finder.isStarted).toBe(false)
    expect(finder.manifests).toEqual([])
    expect(finder.counts).toEqual({})
    expect(finder.findByName('absent')).toBeUndefined()
  })

  it('deduplicates paths while retaining separate installations', () => {
    const finder = container.feature('packageFinder')
    const data = { name: 'shared', version: '1.0.0' }
    finder.addPackage(data, '/a/package.json')
    finder.addPackage(data, '/a/package.json')
    finder.addPackage({ ...data, version: '2.0.0' }, '/b/package.json')
    expect(finder.counts).toEqual({ shared: 2 })
    expect(finder.duplicates).toEqual(['shared'])
    expect(finder.findByName('shared')?.version).toBe('1.0.0')
    expect(data).toEqual({ name: 'shared', version: '1.0.0' })
  })

  it('queries manifests and distinct scopes', () => {
    const finder = container.feature('packageFinder')
    for (const name of ['@one/a', '@one/b', '@two/a', 'plain']) {
      finder.addPackage({ name, version: name === 'plain' ? '2' : '1' }, `/${name}/package.json`)
    }
    expect(finder.scopes.sort()).toEqual(['@one', '@two'])
    expect(finder.packageNames).toHaveLength(4)
    expect(finder.find(m => m.version === '2')?.name).toBe('plain')
    expect(finder.filter(m => m.version === '1')).toHaveLength(3)
    expect(finder.exclude(m => m.version === '1').map(m => m.name)).toEqual(['plain'])
    expect(finder.duplicates).toEqual([])
  })

  it('scans scoped packages, ignores hidden metadata, and finds runtime and dev dependents', async () => {
    manifest('node_modules/runtime', { name: 'runtime', version: '1', dependencies: { shared: '^1' } })
    manifest('node_modules/@scope/dev', { name: '@scope/dev', version: '1', devDependencies: { shared: '^1' } })
    manifest('node_modules/peer', { name: 'peer', version: '1', peerDependencies: { shared: '^1' } })
    container.fs.ensureFolder('node_modules/.bin')
    const finder = container.feature('packageFinder')
    expect(await finder.scan()).toBe(finder)
    expect(finder.isStarted).toBe(true)
    expect(finder.packageNames.sort()).toEqual(['@scope/dev', 'peer', 'runtime'])
    expect(finder.findDependentsOf('shared').map(m => m.name).sort()).toEqual(['@scope/dev', 'runtime'])
    expect(finder.findDependentsOf('unknown')).toEqual([])
    expect(finder.manifests.every(m => container.fs.exists(m.__path))).toBe(true)
    await finder.scan()
    expect(finder.manifests).toHaveLength(3)
  })

  it('start is idempotent and explicit scan discovers later additions', async () => {
    manifest('node_modules/first', { name: 'first', version: '1' })
    const finder = container.feature('packageFinder')
    await finder.start()
    manifest('node_modules/second', { name: 'second', version: '1' })
    expect(await finder.start()).toBe(finder)
    expect(finder.packageNames).toEqual(['first'])
    await finder.scan()
    expect(finder.packageNames.sort()).toEqual(['first', 'second'])
  })

  it('rejects malformed manifests without reporting a completed start', async () => {
    manifest('node_modules/broken', {})
    container.fs.writeFile('node_modules/broken/package.json', '{ broken')
    const finder = container.feature('packageFinder')
    await expect(finder.start()).rejects.toThrow()
    expect(finder.isStarted).toBe(false)
  })

  it('finds local package folders while excluding installed dependencies', async () => {
    manifest('packages/app', { name: 'app' })
    manifest('packages/lib', { name: 'lib' })
    manifest('node_modules/installed', { name: 'installed' })
    const folders = await container.feature('packageFinder').findLocalPackageFolders()
    expect(folders.map(p => container.paths.resolve(p)).sort()).toEqual([
      container.paths.resolve('packages/app'), container.paths.resolve('packages/lib'),
    ])
  })
})
