import { createAGIContainer } from './helpers'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, realpathSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

describe('Skills Library Integration', () => {
  let container: any
  let tempDir: string
  let skillsDir: string

  beforeAll(async () => {
    tempDir = realpathSync(mkdtempSync(join(tmpdir(), 'luca-skills-test-')))
    skillsDir = join(tempDir, '.claude', 'skills')

    // Create a test skill
    const testSkillDir = join(skillsDir, 'code-review')
    mkdirSync(testSkillDir, { recursive: true })
    writeFileSync(
      join(testSkillDir, 'SKILL.md'),
      `---
name: code-review
description: Reviews code for common issues and suggests improvements
version: 1.0.0
tags:
  - code
  - review
---

## Instructions

Review the provided code for:
1. Common bugs and anti-patterns
2. Performance issues
3. Security vulnerabilities
`
    )

    // Create another test skill
    const debugSkillDir = join(skillsDir, 'debug-helper')
    mkdirSync(debugSkillDir, { recursive: true })
    writeFileSync(
      join(debugSkillDir, 'SKILL.md'),
      `---
name: debug-helper
description: Helps debug runtime errors and exceptions
version: 1.0.0
tags:
  - debug
  - errors
---

## Instructions

Help the user debug their issue by asking clarifying questions.
`
    )

    container = createAGIContainer({ cwd: tempDir })
  })

  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  it('loads skills from project directory', async () => {
    const skills = container.feature('skillsLibrary', {
      projectSkillsPath: join(tempDir, '.claude', 'skills'),
    })
    await skills.load()

    const list = skills.list()
    expect(list.length).toBeGreaterThanOrEqual(2)
  })

  it('finds a skill by name', async () => {
    const skills = container.feature('skillsLibrary', {
      projectSkillsPath: join(tempDir, '.claude', 'skills'),
    })
    await skills.load()

    const entry = skills.find('code-review')
    expect(entry).toBeDefined()
    expect(entry!.name).toBe('code-review')
    expect(entry!.description).toContain('Reviews code')
  })

  it('searches skills by keyword', async () => {
    const skills = container.feature('skillsLibrary', {
      projectSkillsPath: join(tempDir, '.claude', 'skills'),
    })
    await skills.load()

    const results = skills.search('debug')
    expect(results.length).toBeGreaterThanOrEqual(1)
    expect(results[0].name).toBe('debug-helper')
  })

  it('creates a new skill', async () => {
    const skills = container.feature('skillsLibrary', {
      projectSkillsPath: join(tempDir, '.claude', 'skills'),
    })
    await skills.load()

    const entry = await skills.create(
      {
        name: 'test-new-skill',
        description: 'A skill created during testing',
        body: '## Instructions\n\nDo test things.',
        meta: { tags: ['test'], version: '0.1.0' },
      },
      'project'
    )

    expect(entry).toBeDefined()
    expect(entry.name).toBe('test-new-skill')

    // Verify it's findable
    const found = skills.find('test-new-skill')
    expect(found).toBeDefined()
  })

  it('removes a skill', async () => {
    const skills = container.feature('skillsLibrary', {
      projectSkillsPath: join(tempDir, '.claude', 'skills'),
    })
    await skills.load()

    // Create one to remove
    await skills.create(
      {
        name: 'to-remove',
        description: 'Will be removed',
        body: '## Instructions\n\nRemove me.',
        meta: {},
      },
      'project'
    )

    const removed = await skills.remove('to-remove')
    expect(removed).toBe(true)

    const found = skills.find('to-remove')
    expect(found).toBeUndefined()
  })

  it('generates system prompt block', async () => {
    const skills = container.feature('skillsLibrary', {
      projectSkillsPath: join(tempDir, '.claude', 'skills'),
    })
    await skills.load()

    const block = skills.toSystemPromptBlock()
    expect(typeof block).toBe('string')
    expect(block).toContain('code-review')
    expect(block).toContain('debug-helper')
  })
})
