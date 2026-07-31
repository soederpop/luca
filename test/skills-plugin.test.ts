import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { AGIContainer } from '../src/agi/container.server'

/**
 * Skills only become invocable in Claude Code when a plugin registers them —
 * `--add-dir` merely grants read access. These cover the generated-plugin path.
 */
describe('skills plugin generation', () => {
  const c = new AGIContainer()
  const fs = c.feature('fs')
  const { paths, os } = c

  // Two projects, each with a same-named skill holding different content.
  const root = paths.resolve(os.tmpdir, `luca-skills-plugin-test-${c.utils.uuid()}`)
  const alphaSkills = paths.resolve(root, 'alpha', 'skills')
  const betaSkills = paths.resolve(root, 'beta', 'skills')
  const generated: string[] = []

  function writeSkill(location: string, name: string, body: string) {
    const dir = paths.resolve(location, name)
    fs.mkdirp(dir)
    fs.writeFile(paths.resolve(dir, 'SKILL.md'), `---\nname: ${name}\ndescription: ${body}\n---\n\n${body}\n`)
    return dir
  }

  beforeAll(() => {
    writeSkill(alphaSkills, 'shared-name', 'alpha flavored')
    writeSkill(alphaSkills, 'alpha-only', 'alpha exclusive')
    writeSkill(betaSkills, 'shared-name', 'beta flavored')
    fs.mkdirp(paths.resolve(alphaSkills, 'not-a-skill'))
  })

  afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true })
    for (const dir of generated) fs.rmSync(dir, { recursive: true, force: true })
  })

  function build(spec: Parameters<ReturnType<typeof c.feature<'skillsLibrary'>>['ensurePluginWithSkills']>[0]) {
    const dir = c.feature('skillsLibrary').ensurePluginWithSkills(spec)
    if (dir) generated.push(dir)
    return dir
  }

  it('creates a loadable plugin from skill folders', () => {
    const dir = build({ folders: [alphaSkills] })!

    expect(dir).toContain('.luca/skills-plugins')

    const manifest = fs.readJson(paths.resolve(dir, '.claude-plugin', 'plugin.json'))
    expect(manifest.name).toBe('luca-skills')
    expect(manifest.version).toBe('1.0.0')

    // Subfolders without a SKILL.md are not skills and must not be linked.
    expect(fs.readdirSync(paths.resolve(dir, 'skills')).sort()).toEqual(['alpha-only', 'shared-name'])
  })

  it('symlinks skill folders so edits to the source are picked up', () => {
    const dir = build({ folders: [alphaSkills] })!
    const link = paths.resolve(dir, 'skills', 'alpha-only')

    expect(fs.isSymlink(link)).toBe(true)
    expect(fs.realpath(link)).toBe(fs.realpath(paths.resolve(alphaSkills, 'alpha-only')))

    fs.writeFile(paths.resolve(alphaSkills, 'alpha-only', 'SKILL.md'), '---\nname: alpha-only\n---\n\nedited\n')
    expect(fs.readFile(paths.resolve(link, 'SKILL.md')).toString()).toContain('edited')
  })

  it('hashes on absolute paths, so same-named skills from different projects do not collide', () => {
    const alpha = build({ folders: [alphaSkills] })!
    const beta = build({ folders: [betaSkills] })!

    expect(alpha).not.toBe(beta)
    expect(fs.readFile(paths.resolve(alpha, 'skills', 'shared-name', 'SKILL.md')).toString()).toContain('alpha flavored')
    expect(fs.readFile(paths.resolve(beta, 'skills', 'shared-name', 'SKILL.md')).toString()).toContain('beta flavored')
  })

  it('is stable for the same skill set and honours a custom plugin name', () => {
    expect(build({ folders: [alphaSkills] })).toBe(build({ folders: [alphaSkills] })!)
    expect(build({ folders: [alphaSkills], pluginName: 'north' })).not.toBe(build({ folders: [alphaSkills] })!)

    const named = build({ folders: [alphaSkills], pluginName: 'north' })!
    expect(fs.readJson(paths.resolve(named, '.claude-plugin', 'plugin.json')).name).toBe('north')
  })

  it('returns undefined when nothing resolves', () => {
    expect(build({})).toBeUndefined()
    expect(build({ folders: [paths.resolve(root, 'does-not-exist')] })).toBeUndefined()
  })

  it('resolves skills by name once the library has scanned their location', async () => {
    const lib = c.feature('skillsLibrary', { locations: [alphaSkills] })
    await lib.start()

    const entries = lib.resolveSkillFolders({ skills: ['alpha-only'] })
    expect(entries).toEqual([{ name: 'alpha-only', path: paths.resolve(alphaSkills, 'alpha-only') }])

    expect(() => lib.resolveSkillFolders({ skills: ['nope'] })).toThrow(/Skill "nope" not found/)
  })

  it('installs skills into an arbitrary folder without disturbing what is there', () => {
    const lib = c.feature('skillsLibrary')
    const target = paths.resolve(root, 'installed', 'skills')

    fs.mkdirp(paths.resolve(target, 'alpha-only'))
    fs.writeFile(paths.resolve(target, 'alpha-only', 'SKILL.md'), 'hand authored')

    const results = lib.installToFolder({ folders: [alphaSkills] }, target)

    expect(results.map(r => [r.name, r.installed])).toEqual([
      ['alpha-only', false],
      ['shared-name', true],
    ])
    // The pre-existing folder is left as-is, the new one is a link to its source.
    expect(fs.isSymlink(paths.resolve(target, 'alpha-only'))).toBe(false)
    expect(fs.readFile(paths.resolve(target, 'alpha-only', 'SKILL.md')).toString()).toBe('hand authored')
    expect(fs.realpath(paths.resolve(target, 'shared-name'))).toBe(fs.realpath(paths.resolve(alphaSkills, 'shared-name')))

    // Re-running is a no-op.
    expect(lib.installToFolder({ folders: [alphaSkills] }, target).every(r => !r.installed)).toBe(true)
  })

  it('passes the generated plugin to the claude CLI as --plugin-dir', async () => {
    const cc = c.feature('claudeCode')
    const args: string[] = await (cc as any).buildArgs('hello', {
      skillsFolders: [alphaSkills],
      pluginDirs: ['/some/other/plugin'],
    })

    const at = args.indexOf('--plugin-dir')
    expect(at).toBeGreaterThan(-1)
    expect(args[at + 1]).toBe('/some/other/plugin')
    expect(args[at + 2]).toContain('.luca/skills-plugins')
    generated.push(args[at + 2]!)
  })

  it('passes the generated plugin to interactive controller sessions', () => {
    const controller = c.feature('claudeController')
    controller.definePersona('skilled', { skillsFolders: [alphaSkills] })

    const worker = controller.create({ id: 'skilled', cwd: root, persona: 'skilled' })
    const at = worker.args.indexOf('--plugin-dir')

    expect(at).toBeGreaterThan(-1)
    expect(worker.args[at + 1]).toContain('.luca/skills-plugins')
    generated.push(worker.args[at + 1]!)
  })
})

describe('fs.ensureSymlink', () => {
  const c = new AGIContainer()
  const fs = c.feature('fs')
  const { paths, os } = c
  const root = paths.resolve(os.tmpdir, `luca-symlink-test-${c.utils.uuid()}`)

  beforeAll(() => {
    fs.mkdirp(paths.resolve(root, 'target-a'))
    fs.mkdirp(paths.resolve(root, 'target-b'))
  })

  afterAll(() => fs.rmSync(root, { recursive: true, force: true }))

  it('creates, is idempotent, and repoints stale links', () => {
    const link = paths.resolve(root, 'link')

    expect(fs.ensureSymlink(paths.resolve(root, 'target-a'), link)).toBe(true)
    expect(fs.isSymlink(link)).toBe(true)
    expect(fs.realpath(link)).toBe(fs.realpath(paths.resolve(root, 'target-a')))

    expect(fs.ensureSymlink(paths.resolve(root, 'target-a'), link)).toBe(true)
    expect(fs.ensureSymlink(paths.resolve(root, 'target-b'), link)).toBe(true)
    expect(fs.realpath(link)).toBe(fs.realpath(paths.resolve(root, 'target-b')))
  })

  it('refuses to replace real files', () => {
    const real = paths.resolve(root, 'real.txt')
    fs.writeFile(real, 'do not clobber me')

    expect(fs.ensureSymlink(paths.resolve(root, 'target-a'), real)).toBe(false)
    expect(fs.readFile(real).toString()).toBe('do not clobber me')
  })
})
