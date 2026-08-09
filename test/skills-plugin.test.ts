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

    // Registration is the plugin's job. Skill folders are not a file-access setting
    // and must not silently widen the session's allowed directories.
    expect(args).not.toContain('--add-dir')
    expect(args).not.toContain(alphaSkills)
  })

  it('passes the generated plugin to interactive controller sessions', () => {
    const controller = c.feature('claudeController')
    controller.definePersona('skilled', { skillsFolders: [alphaSkills] })

    const worker = controller.create({ id: 'skilled', cwd: root, persona: 'skilled' })
    const at = worker.args.indexOf('--plugin-dir')

    expect(at).toBeGreaterThan(-1)
    expect(worker.args[at + 1]).toContain('.luca/skills-plugins')
    generated.push(worker.args[at + 1]!)

    expect(worker.args).not.toContain('--add-dir')
    expect(worker.args).not.toContain(alphaSkills)
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

describe('assistant skills preload', () => {
  const c = new AGIContainer()

  it('exposes skills on effectiveOptions from create() options', () => {
    const assistant = c.feature('assistant', { name: 'skills-probe', skills: ['luca-framework'] })
    expect(assistant.effectiveOptions.skills).toEqual(['luca-framework'])
  })

  it('reads skills from CORE.md frontmatter, with create() options winning', () => {
    const fromFrontmatter = c.feature('assistant', { name: 'fm-probe' })
    fromFrontmatter.state.set('meta', { skills: ['from-frontmatter'] })
    expect(fromFrontmatter.effectiveOptions.skills).toEqual(['from-frontmatter'])

    const overridden = c.feature('assistant', { name: 'override-probe', skills: ['from-caller'] })
    overridden.state.set('meta', { skills: ['from-frontmatter'] })
    expect(overridden.effectiveOptions.skills).toEqual(['from-caller'])
  })

  it('does not let an unset option clobber a frontmatter value', () => {
    // Zod keeps explicitly-undefined optional keys, so spreading a partial options
    // bag used to wipe the frontmatter default it was supposed to defer to.
    const assistant = c.feature('assistant', { name: 'undef-probe', skills: undefined, model: undefined })
    assistant.state.set('meta', { skills: ['from-frontmatter'], model: 'fm-model' })

    expect(assistant.effectiveOptions.skills).toEqual(['from-frontmatter'])
    expect(assistant.effectiveOptions.model).toBe('fm-model')
  })
})

describe('skillsLibrary assistant wiring', () => {
  const c = new AGIContainer()
  const fs = c.feature('fs')
  const { paths, os } = c
  const root = paths.resolve(os.tmpdir, `luca-skills-wiring-${c.utils.uuid()}`)
  // start() unions in whatever ~/.luca/skills.json tracks, so point at an empty config
  // to keep these assertions about the fixtures rather than the developer's machine.
  const configPath = paths.resolve(root, 'skills.json')

  // Over the ten-skill threshold the prompt switches from a full table to the
  // search-first framing.
  const bigRoot = paths.resolve(root, 'big')

  function writeSkillAt(location: string, name: string) {
    fs.mkdirp(paths.resolve(location, name))
    fs.writeFile(paths.resolve(location, name, 'SKILL.md'), `---\nname: ${name}\ndescription: the ${name} skill\n---\n\nbody\n`)
  }

  beforeAll(() => {
    for (const name of ['alpha', 'beta', 'gamma']) writeSkillAt(root, name)
    writeSkillAt(bigRoot, 'alpha')
    for (let i = 0; i < 12; i++) writeSkillAt(bigRoot, `filler-${i}`)
    process.env.LUCA_SKILLS_NO_WARN = '1'
  })

  afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true })
    delete process.env.LUCA_SKILLS_NO_WARN
  })

  it('scans before describing skills, so the prompt is not built from an empty library', async () => {
    const lib = c.feature('skillsLibrary', { _cacheKey: 'wiring-a', locations: [root], configPath })
    const assistant = c.feature('assistant', { name: 'wired' })

    expect(lib.isStarted).toBe(false)
    assistant.use(lib)
    // Deferred into pendingPlugins; start() is what awaits it.
    await assistant.start()

    const ext = assistant.systemPromptExtensions?.skillsLibrary ?? ''
    expect(lib.isStarted).toBe(true)
    expect(ext).toContain('- **alpha**: the alpha skill')
    expect(ext).toContain('- **gamma**: the gamma skill')
    // The old design ordered the model to load skills named in the question;
    // preload is now injected state, so no protocol language should remain.
    expect(ext).not.toContain('Required Skills')
  })

  it('reports only-patterns that match nothing', async () => {
    const lib = c.feature('skillsLibrary', { _cacheKey: 'wiring-b', locations: [root], configPath, only: ['alpha', 'nope-*'] })
    await lib.start()

    expect(lib.warnAboutUnmatchedFilters()).toEqual(['nope-*'])
    expect(Object.keys(lib.filteredSkills)).toEqual(['alpha'])
  })

  it('injects preloaded skills as already-loaded system prompt extensions', async () => {
    const lib = c.feature('skillsLibrary', { _cacheKey: 'wiring-c', locations: [bigRoot], configPath })
    await lib.start()

    const assistant = c.feature('assistant', { name: 'preloader', skills: ['alpha', 'does-not-exist'] })
    assistant.use(lib)
    await assistant.start()

    const preloaded = assistant.systemPromptExtensions['skill:alpha'] ?? ''
    expect(preloaded).toContain('## Loaded Skill: alpha')
    expect(preloaded).toContain('already loaded')
    expect(preloaded).toContain('body') // the SKILL.md content itself

    // Unknown names are dropped with a warning, never injected.
    expect(assistant.systemPromptExtensions['skill:does-not-exist']).toBeUndefined()

    // Preload is state, not behavior — no interceptor rewrites the opening question.
    expect(assistant.interceptors.beforeAsk.hasInterceptors).toBe(false)

    // Extensions are the durable channel: the preload must reach the conversation's
    // system message so forks, resume, and compaction all carry it.
    expect(assistant.effectiveSystemPrompt).toContain('## Loaded Skill: alpha')
  })
})
