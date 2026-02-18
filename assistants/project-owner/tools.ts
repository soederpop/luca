const fs = require('fs')
const path = require('path')
const { z } = require('zod')
const { validateDocument } = require('contentbase')

/**
 * Slugify a title into a kebab-case filename.
 */
function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/**
 * Walk up from the assistant folder to locate the Luca repository root.
 * Looks for package.json with name "@soederpop/luca".
 */
function findLucaRoot() {
  let dir = me.resolvedFolder

  while (dir !== path.dirname(dir)) {
    const pkgPath = path.join(dir, 'package.json')

    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
        if (pkg.name === '@soederpop/luca') {
          return dir
        }
      } catch {}
    }

    dir = path.dirname(dir)
  }

  return null
}

/**
 * Create a new Plan document in the plans/ collection.
 * Writes a structured markdown file with YAML frontmatter and standard sections.
 */
async function createPlan({ title, status, summary, steps, testPlan, references }) {
  const docsDir = me.docsFolder
  const plansDir = path.join(docsDir, 'plans')

  if (!fs.existsSync(plansDir)) {
    fs.mkdirSync(plansDir, { recursive: true })
  }

  const slug = slugify(title)
  const filePath = path.join(plansDir, `${slug}.md`)

  if (fs.existsSync(filePath)) {
    return { error: `Plan already exists: plans/${slug}.md` }
  }

  const lines = []
  lines.push('---')
  lines.push(`status: ${status}`)
  lines.push('---')
  lines.push('')
  lines.push(`# ${title}`)
  lines.push('')
  lines.push('## Summary')
  lines.push('')
  lines.push(summary)
  lines.push('')
  lines.push('## Steps')
  lines.push('')
  for (const step of steps) {
    lines.push(`- [ ] ${step}`)
  }
  lines.push('')
  lines.push('## Test plan')
  lines.push('')
  for (const check of testPlan) {
    lines.push(`- [ ] ${check}`)
  }

  if (references && references.length > 0) {
    lines.push('')
    lines.push('## References')
    lines.push('')
    for (const ref of references) {
      lines.push(`- ${ref}`)
    }
  }

  lines.push('')

  fs.writeFileSync(filePath, lines.join('\n'), 'utf8')

  return {
    created: `plans/${slug}.md`,
    path: filePath,
  }
}

/**
 * Create a new Idea document in the ideas/ collection.
 * Writes a structured markdown file with YAML frontmatter.
 */
async function createIdea({ title, status, category, horizon, body }) {
  const docsDir = me.docsFolder
  const ideasDir = path.join(docsDir, 'ideas')

  if (!fs.existsSync(ideasDir)) {
    fs.mkdirSync(ideasDir, { recursive: true })
  }

  const slug = slugify(title)
  const filePath = path.join(ideasDir, `${slug}.md`)

  if (fs.existsSync(filePath)) {
    return { error: `Idea already exists: ideas/${slug}.md` }
  }

  const lines = []
  lines.push('---')
  lines.push(`status: ${status}`)
  lines.push(`category: ${category}`)
  lines.push(`horizon: ${horizon}`)
  lines.push('---')
  lines.push('')
  lines.push(`# ${title}`)
  lines.push('')
  lines.push(body)
  lines.push('')

  fs.writeFileSync(filePath, lines.join('\n'), 'utf8')

  return {
    created: `ideas/${slug}.md`,
    path: filePath,
  }
}

/**
 * List all plans and ideas with their metadata and status.
 * Returns a structured overview of both collections.
 */
async function listPlansAndIdeas() {
  const db = me.contentDb
  await db.load()
  const collection = db.collection

  const results = { plans: [], ideas: [] }

  for (const id of collection.available) {
    const doc = await collection.document(id)
    const meta = doc.meta || {}
    const title = doc.title || id

    if (id.startsWith('plans/')) {
      results.plans.push({ id, title, status: meta.status || 'unknown' })
    } else if (id.startsWith('ideas/')) {
      results.ideas.push({
        id,
        title,
        status: meta.status || 'unknown',
        category: meta.category || 'uncategorized',
        horizon: meta.horizon || 'unknown',
      })
    }
  }

  return results
}

/**
 * Validate that HANDOFF.md includes all required sections for the self-improvement loop.
 */
async function validateHandoff({ filePath = 'HANDOFF.md' }) {
  const lucaRoot = findLucaRoot()

  if (!lucaRoot) {
    return { error: 'Could not locate the Luca repository root.' }
  }

  const db = me.contentDb
  const handoffModel = db.models?.Handoff

  if (!handoffModel) {
    return { error: 'Handoff model is not defined. Ensure assistant hooks register the Handoff model.' }
  }

  const resolvedPath = path.isAbsolute(filePath) ? filePath : path.join(lucaRoot, filePath)

  if (!fs.existsSync(resolvedPath)) {
    return { error: `Handoff file not found: ${resolvedPath}` }
  }

  const parsed = await db.parseMarkdownAtPath(resolvedPath)
  const result = validateDocument(parsed, handoffModel)
  const sectionIssues = result.errors
    .filter((issue) => issue.path?.[0] === 'sections')
    .map((issue) => ({
      key: String(issue.path?.[1] || ''),
      message: issue.message,
    }))

  return {
    file: resolvedPath,
    valid: result.valid,
    errorCount: result.errors.length,
    sectionIssues,
    errors: result.errors.map((issue) => ({
      path: issue.path,
      message: issue.message,
      code: issue.code,
    })),
  }
}

module.exports = {
  createPlan,
  createIdea,
  listPlansAndIdeas,
  validateHandoff,
  schemas: {
    createPlan: z
      .object({
        title: z.string().describe('Title for the plan (becomes the H1 heading and filename)'),
        status: z
          .enum(['pending', 'approved', 'rejected'])
          .default('pending')
          .describe('Initial status of the plan'),
        summary: z.string().describe('A paragraph summarizing what this plan accomplishes and why'),
        steps: z
          .array(z.string())
          .min(1)
          .describe('Ordered list of implementation steps (each becomes a checklist item)'),
        testPlan: z
          .array(z.string())
          .min(1)
          .describe('Verification checks to confirm the plan was executed correctly'),
        references: z
          .array(z.string())
          .optional()
          .describe('Optional list of reference links, file paths, or related documents'),
      })
      .describe(
        'Create a new Plan document. Plans are structured, actionable documents that describe work to be done. ' +
          'They have a summary, implementation steps, and a test plan for verification.'
      ),
    createIdea: z
      .object({
        title: z.string().describe('Title for the idea (becomes the H1 heading and filename)'),
        status: z
          .enum(['backlog', 'exploring', 'ready', 'done'])
          .default('backlog')
          .describe('Current status: backlog (not started), exploring (being researched), ready (can be planned), done (implemented)'),
        category: z
          .string()
          .describe('Topic area: architecture, infrastructure, research, assistants, demos, etc.'),
        horizon: z
          .enum(['short', 'long'])
          .describe('Whether this is a short-term or long-term idea'),
        body: z
          .string()
          .describe('The full markdown body of the idea. Can include multiple sections with ## headings.'),
      })
      .describe(
        'Create a new Idea document. Ideas capture things we want to explore or build but do not yet have plans for. ' +
          'They have a status, category, and horizon to help prioritize.'
      ),
    listPlansAndIdeas: z
      .object({})
      .describe(
        'List all plans and ideas with their metadata. Returns a structured overview showing status, category, and horizon for each document.'
      ),
    validateHandoff: z
      .object({
        filePath: z
          .string()
          .optional()
          .describe('Optional path to the handoff markdown file. Defaults to HANDOFF.md at repository root.'),
      })
      .describe(
        'Validate that a HANDOFF markdown document includes all required sections for the self-improvement loop review gate.'
      ),
  },
}
