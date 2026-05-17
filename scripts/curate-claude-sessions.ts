type ToolCount = Record<string, number>

type RepoConfig = {
  name: string
  repoPath: string
}

type SessionRecord = {
  sessionId: string
  sessionPath: string
  repo: string
  repoPath: string
  branch?: string
  firstInstruction?: string
  taskType: string
  qualityTier: 'gold' | 'silver' | 'bronze'
  userTurns: number
  assistantTurns: number
  toolUses: number
  toolUsage: ToolCount
  changedFiles: string[]
  commandsRun: string[]
  testsRun: string[]
  relevantHelpers: string[]
  policyTrace: string[]
  notes: string[]
  snippets: string[]
  reviewScore: number
}

type RepoSummary = {
  repo: string
  repoPath: string
  generatedAt: string
  sessionRoot: string
  counts: {
    mainSessions: number
    subagentSessions: number
    gold: number
    silver: number
    bronze: number
  }
  sourceInventory: Record<string, number>
  topTools: ToolCount
  topChangedFiles: Array<{ path: string, count: number }>
}

type ReviewQueueEntry = {
  rank: number
  session_id: string
  source_repo: string
  candidate_path: string
  repo_path: string
  branch?: string
  first_instruction?: string
  task_type: string
  quality_tier: 'gold' | 'silver' | 'bronze'
  canonicality_guess: 'canonical' | 'acceptable' | 'off-policy'
  bucket_guess: 'canonical-policy' | 'strong-implementation' | 'planning' | 'rejects'
  suggested_disposition: 'keep' | 'rewrite' | 'reject'
  review_score: number
  summary: string
  changed_files: string[]
  commands_run: string[]
  tests_run: string[]
  relevant_helpers: string[]
  policy_signals: string[]
  verification_signals: string[]
  positive_signals: string[]
  negative_signals: string[]
  snippets: string[]
  notes: string[]
}

const DEFAULT_REPOS: RepoConfig[] = [
  { name: 'luca', repoPath: '/Users/jonathansoeder/@soederpop/projects/luca' },
  { name: 'agentic-loop', repoPath: '/Users/jonathansoeder/@agentic-loop' },
]

const OUTPUT_DIR = process.argv[2] || `${process.cwd()}/datasets/lora`

function inferHome(repoPath: string) {
  const home = process.env.HOME || ''
  if (home && !home.includes('/.hermes/profiles/')) return home
  const userHomeMatch = repoPath.match(/^\/Users\/[^/]+/)
  if (userHomeMatch) return userHomeMatch[0]
  return home
}

function encodeClaudeProjectPath(cwd: string) {
  return cwd.replace(/[^A-Za-z0-9]/g, '-')
}

function uniq<T>(items: T[]) {
  return Array.from(new Set(items))
}

function inc(map: Record<string, number>, key: string, amount = 1) {
  map[key] = (map[key] || 0) + amount
}

function relToRepo(repoPath: string, maybeAbsolute: string) {
  return maybeAbsolute.startsWith(repoPath)
    ? maybeAbsolute.slice(repoPath.length + 1)
    : maybeAbsolute
}

function normalizeChangedPath(path: string) {
  return path
    .replace(/[:].*$/, '')
    .replace(/[`,)\]\s]+$/g, '')
    .trim()
}

function classifyTask(firstInstruction = '', changedFiles: string[]) {
  const text = firstInstruction.toLowerCase()
  const changed = changedFiles.join(' ').toLowerCase()

  if (/what would it take|could i in theory|look at all of the methods|can we make equivalents|take a look|architect/.test(text)) return 'architecture'
  if (/readme|docs|marketing website|tutorial|document|philosophy/.test(text) || /\.md$/.test(changed)) return 'docs'
  if (/failing|bug|fix|error|broken|regression|should pass|green/.test(text)) return 'bugfix'
  if (/refactor|rename all references|generated.*version control|migration/.test(text)) return 'refactor'
  if (/test/.test(text) && changedFiles.some(file => file.startsWith('test/'))) return 'test-fix'
  if (/workflow/.test(text)) return 'workflow'
  if (/option|helper|implement|add|need|track|support|default|expose|bind|reload/.test(text)) return 'feature-add'

  return 'investigation'
}

function detectCommands(command: string) {
  const hits: string[] = []
  if (/\bluca describe\b/.test(command)) hits.push('luca describe')
  if (/\bluca eval\b/.test(command)) hits.push('luca eval')
  if (/\bbun test\b|\bbun run test\b/.test(command)) hits.push('bun test')
  if (/\bgit commit\b/.test(command)) hits.push('git commit')
  if (/\bluca scaffold\b/.test(command)) hits.push('luca scaffold')
  if (/\bluca workflow\b/.test(command)) hits.push('luca workflow')
  return hits
}

function inferRelevantHelpers(commandHits: string[], changedFiles: string[], firstInstruction = '') {
  const helpers: string[] = []
  const text = `${firstInstruction} ${changedFiles.join(' ')}`.toLowerCase()

  if (commandHits.includes('luca describe')) helpers.push('describe')
  if (commandHits.includes('luca eval')) helpers.push('eval')
  if (/assistant/.test(text)) helpers.push('assistant')
  if (/conversation/.test(text)) helpers.push('conversation')
  if (/contentdb|content-db/.test(text)) helpers.push('contentDb')
  if (/claude/.test(text)) helpers.push('claudeCode')
  if (/python/.test(text)) helpers.push('python')
  if (/mcp/.test(text)) helpers.push('mcpBridge')
  if (/file-tools|filetools/.test(text)) helpers.push('fileTools')
  if (/secure-shell|ssh/.test(text)) helpers.push('secureShell')
  if (/repl|websocket/.test(text)) helpers.push('repl')
  if (/openai/.test(text)) helpers.push('openai')
  if (/workflow/.test(text)) helpers.push('workflow')
  if (/express|endpoint/.test(text)) helpers.push('express')
  return uniq(helpers)
}

function buildPolicyTrace(commandHits: string[], hasEdits: boolean, hasTests: boolean, firstInstruction = '') {
  const trace: string[] = []
  const text = firstInstruction.toLowerCase()
  if (commandHits.includes('luca describe')) trace.push('discover helper surface with luca describe')
  if (commandHits.includes('luca eval')) trace.push('test assumptions with luca eval')
  if (commandHits.includes('luca scaffold')) trace.push('lean on luca scaffold before manual boilerplate')
  if (/container\.feature|container\.client|container\.server/.test(text)) trace.push('compose with Luca container primitives')
  if (hasEdits) trace.push('apply small reviewable edits')
  if (hasTests) trace.push('verify with bun tests')
  if (trace.length === 0) trace.push('inspect before changing code')
  return trace
}

function qualityTier(options: { commandHits: string[], hasEdits: boolean, hasTests: boolean, firstInstruction?: string, relevantHelpers: string[] }) {
  const { commandHits, hasEdits, hasTests, firstInstruction = '', relevantHelpers } = options
  const hasIntrospection = commandHits.includes('luca describe') || commandHits.includes('luca eval')
  const architecture = classifyTask(firstInstruction, []) === 'architecture'
  const richHelperUse = relevantHelpers.length >= 2

  if ((hasEdits && hasTests && (hasIntrospection || richHelperUse)) || (architecture && hasIntrospection)) return 'gold'
  if (hasEdits || hasIntrospection || richHelperUse) return 'silver'
  return 'bronze'
}

function scoreSession(session: Omit<SessionRecord, 'reviewScore'>) {
  let score = 0
  const commandHits = session.commandsRun
  const taskType = session.taskType
  const changedCount = session.changedFiles.length

  if (session.qualityTier === 'gold') score += 40
  if (session.qualityTier === 'silver') score += 20
  if (commandHits.includes('luca describe')) score += 12
  if (commandHits.includes('luca eval')) score += 14
  if (commandHits.includes('luca scaffold')) score += 6
  if (session.testsRun.length > 0 || commandHits.includes('bun test')) score += 12
  if (session.relevantHelpers.includes('describe')) score += 4
  if (session.relevantHelpers.includes('eval')) score += 4
  if (session.relevantHelpers.some(name => ['assistant', 'workflow', 'conversation', 'mcpBridge', 'express'].includes(name))) score += 6
  if (taskType === 'feature-add') score += 8
  if (taskType === 'bugfix') score += 7
  if (taskType === 'architecture') score += 5
  if (taskType === 'docs') score -= 8
  if (changedCount === 0) score -= 10
  if (changedCount >= 1 && changedCount <= 5) score += 6
  if (changedCount > 12) score -= 8
  if (session.notes.some(note => note.includes('manual verification'))) score -= 3
  return score
}

function guessCanonicality(session: SessionRecord): 'canonical' | 'acceptable' | 'off-policy' {
  const hasIntrospection = session.commandsRun.includes('luca describe') || session.commandsRun.includes('luca eval')
  const hasContainerish = session.relevantHelpers.length >= 2 || /container\.(feature|client|server)/i.test(session.firstInstruction || '')
  const tested = session.testsRun.length > 0 || session.commandsRun.includes('bun test')
  if ((hasIntrospection && hasContainerish) || (hasIntrospection && tested)) return 'canonical'
  if (session.qualityTier !== 'bronze') return 'acceptable'
  return 'off-policy'
}

function guessBucket(session: SessionRecord): 'canonical-policy' | 'strong-implementation' | 'planning' | 'rejects' {
  if (session.qualityTier === 'bronze' && session.changedFiles.length === 0) return 'rejects'
  if (session.taskType === 'architecture' || session.taskType === 'investigation') return 'planning'
  if (guessCanonicality(session) === 'canonical') return 'canonical-policy'
  return 'strong-implementation'
}

function suggestedDisposition(session: SessionRecord): 'keep' | 'rewrite' | 'reject' {
  const bucket = guessBucket(session)
  if (bucket === 'rejects') return 'reject'
  if (bucket === 'canonical-policy' || bucket === 'planning') return 'rewrite'
  return 'keep'
}

function summarizeSession(session: SessionRecord) {
  const parts = [
    `${session.taskType} session from ${session.repo}`,
    session.firstInstruction ? `task starts: ${session.firstInstruction.slice(0, 140)}` : undefined,
    session.changedFiles.length ? `changed ${session.changedFiles.length} file(s)` : 'no changed files detected',
    session.commandsRun.length ? `commands: ${session.commandsRun.join(', ')}` : 'no key commands detected',
    session.relevantHelpers.length ? `helpers: ${session.relevantHelpers.join(', ')}` : undefined,
  ].filter(Boolean)
  return parts.join(' | ')
}

async function listFiles(root: string, pattern: string) {
  const files: string[] = []
  const glob = new Bun.Glob(pattern)
  for await (const file of glob.scan({ cwd: root, absolute: true, onlyFiles: true })) files.push(file)
  return files.sort()
}

async function fileExists(path: string) {
  return (await Bun.file(path).exists())
}

function extractTextBlocks(content: any): string[] {
  if (typeof content === 'string') return [content]
  if (!Array.isArray(content)) return []
  const texts: string[] = []
  for (const part of content) {
    if (typeof part?.text === 'string') texts.push(part.text)
    if (typeof part?.content === 'string') texts.push(part.content)
  }
  return texts
}

async function parseSession(sessionPath: string, repo: RepoConfig): Promise<SessionRecord | null> {
  const text = await Bun.file(sessionPath).text()
  const lines = text.split('\n').filter(Boolean)

  let userTurns = 0
  let assistantTurns = 0
  let toolUses = 0
  let branch: string | undefined
  let firstInstruction: string | undefined
  const toolUsage: ToolCount = {}
  const changedFiles: string[] = []
  const commandHits: string[] = []
  const testsRun: string[] = []
  const notes: string[] = []
  const snippets: string[] = []

  for (const line of lines) {
    let event: any
    try {
      event = JSON.parse(line)
    } catch {
      continue
    }

    if (event?.gitBranch && !branch) branch = event.gitBranch

    if (event?.type === 'user') {
      const blocks = extractTextBlocks(event?.message?.content)
      if (blocks.length) {
        userTurns += 1
        const textBlock = blocks.join(' ').trim()
        if (!firstInstruction && textBlock) firstInstruction = textBlock
        if (snippets.length < 2 && textBlock) snippets.push(`user: ${textBlock.slice(0, 220)}`)
      }
    }

    if (event?.type === 'assistant') {
      assistantTurns += 1
      const blocks = extractTextBlocks(event?.message?.content)
      for (const block of blocks) {
        if (snippets.length >= 8) break
        if (/luca describe|luca eval|bun test|container\.(feature|client|server)|commands\/|features\/|endpoints\//i.test(block)) {
          snippets.push(`assistant: ${block.replace(/\s+/g, ' ').slice(0, 220)}`)
        }
      }
      if (Array.isArray(event?.message?.content)) {
        for (const part of event.message.content) {
          if (part?.type === 'tool_use') {
            toolUses += 1
            const name = part.name || 'unknown'
            inc(toolUsage, name)
            const command = part?.input?.command
            if (typeof command === 'string') {
              const hits = detectCommands(command)
              commandHits.push(...hits)
              if (hits.includes('bun test')) testsRun.push(command)
              if (snippets.length < 8 && /luca describe|luca eval|bun test|luca scaffold|luca workflow/i.test(command)) {
                snippets.push(`tool: ${command.replace(/\s+/g, ' ').slice(0, 220)}`)
              }
            }
          }
        }
      }
    }

    const filePath = event?.toolUseResult?.filePath
    if (typeof filePath === 'string' && filePath.startsWith(repo.repoPath)) changedFiles.push(relToRepo(repo.repoPath, filePath))

    const blocks = extractTextBlocks(event?.message?.content)
    for (const block of blocks) {
      const escapedRepo = repo.repoPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const regex = new RegExp(`${escapedRepo}/[^\\s\`"']+`, 'g')
      const matches = block.match(regex) || []
      for (const match of matches) changedFiles.push(relToRepo(repo.repoPath, match))
    }
  }

  const dedupedChangedFiles = uniq(
    changedFiles
      .map(normalizeChangedPath)
      .filter(Boolean)
      .filter(path => !path.includes('node_modules/'))
      .filter(path => !path.startsWith('dist/'))
      .filter(path => !path.startsWith('.git/'))
  ).sort()

  const dedupedCommandHits = uniq(commandHits)
  const relevantHelpers = inferRelevantHelpers(dedupedCommandHits, dedupedChangedFiles, firstInstruction)
  const hasEdits = dedupedChangedFiles.length > 0
  const hasTests = testsRun.length > 0 || dedupedCommandHits.includes('bun test')
  const taskType = classifyTask(firstInstruction, dedupedChangedFiles)
  const policyTrace = buildPolicyTrace(dedupedCommandHits, hasEdits, hasTests, firstInstruction)

  if (hasEdits && !hasTests) notes.push('candidate may need manual verification because no explicit bun test run was detected')
  if (dedupedCommandHits.includes('luca describe') || dedupedCommandHits.includes('luca eval')) notes.push('shows Luca-native runtime introspection')
  if (taskType === 'architecture' || taskType === 'investigation') notes.push('good candidate for planning/policy bucket if reasoning is clean')

  const partial: Omit<SessionRecord, 'reviewScore'> = {
    sessionId: sessionPath.split('/').pop()!.replace('.jsonl', ''),
    sessionPath,
    repo: repo.name,
    repoPath: repo.repoPath,
    branch,
    firstInstruction,
    taskType,
    qualityTier: qualityTier({ commandHits: dedupedCommandHits, hasEdits, hasTests, firstInstruction, relevantHelpers }),
    userTurns,
    assistantTurns,
    toolUses,
    toolUsage,
    changedFiles: dedupedChangedFiles,
    commandsRun: dedupedCommandHits,
    testsRun: uniq(testsRun),
    relevantHelpers,
    policyTrace,
    notes,
    snippets: uniq(snippets).slice(0, 8),
  }

  return {
    ...partial,
    reviewScore: scoreSession({ ...partial, qualityTier: partial.qualityTier })
  }
}

async function countMatchingFiles(root: string, pattern: string) {
  try {
    return (await listFiles(root, pattern)).length
  } catch {
    return 0
  }
}

async function buildRepoSummary(repo: RepoConfig, sessions: SessionRecord[], mainSessions: string[], subagentSessions: string[], sessionRoot: string): Promise<RepoSummary> {
  const sourceInventory: Record<string, number> = {
    'README.md': (await fileExists(`${repo.repoPath}/README.md`)) ? 1 : 0,
    'CLAUDE.md': (await fileExists(`${repo.repoPath}/CLAUDE.md`)) ? 1 : 0,
    'AGENTS.md': (await fileExists(`${repo.repoPath}/AGENTS.md`)) ? 1 : 0,
    'docs/apis': await countMatchingFiles(`${repo.repoPath}/docs/apis`, '**/*.md'),
    'docs/examples': await countMatchingFiles(`${repo.repoPath}/docs/examples`, '**/*.md'),
    'docs/tutorials': await countMatchingFiles(`${repo.repoPath}/docs/tutorials`, '**/*.md'),
    'test': await countMatchingFiles(`${repo.repoPath}/test`, '**/*.ts'),
    'test-integration': await countMatchingFiles(`${repo.repoPath}/test-integration`, '**/*.ts'),
    'src/commands': await countMatchingFiles(`${repo.repoPath}/src/commands`, '**/*.ts'),
  }

  const topTools: ToolCount = {}
  const changedFileCounts: Record<string, number> = {}
  for (const session of sessions) {
    for (const [tool, count] of Object.entries(session.toolUsage)) inc(topTools, tool, count)
    for (const file of session.changedFiles) inc(changedFileCounts, file)
  }

  return {
    repo: repo.name,
    repoPath: repo.repoPath,
    generatedAt: new Date().toISOString(),
    sessionRoot,
    counts: {
      mainSessions: mainSessions.length,
      subagentSessions: subagentSessions.length,
      gold: sessions.filter(session => session.qualityTier === 'gold').length,
      silver: sessions.filter(session => session.qualityTier === 'silver').length,
      bronze: sessions.filter(session => session.qualityTier === 'bronze').length,
    },
    sourceInventory,
    topTools: Object.fromEntries(Object.entries(topTools).sort((a, b) => b[1] - a[1]).slice(0, 15)),
    topChangedFiles: Object.entries(changedFileCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([path, count]) => ({ path, count })),
  }
}

function toReviewEntry(session: SessionRecord, rank: number): ReviewQueueEntry {
  const canonicality = guessCanonicality(session)
  const bucket = guessBucket(session)
  const verificationSignals = []
  if (session.testsRun.length > 0 || session.commandsRun.includes('bun test')) verificationSignals.push('explicit bun test detected')
  else verificationSignals.push('no explicit bun test detected')

  const positiveSignals = uniq([
    ...session.policyTrace,
    ...(session.commandsRun.includes('luca describe') ? ['uses luca describe'] : []),
    ...(session.commandsRun.includes('luca eval') ? ['uses luca eval'] : []),
    ...(session.changedFiles.some(path => /^(commands|features|endpoints|clients|servers)\//.test(path)) ? ['edits Luca convention folders'] : []),
  ])

  const negativeSignals = uniq([
    ...(session.changedFiles.length === 0 ? ['no changed files detected'] : []),
    ...(!session.commandsRun.includes('bun test') && session.testsRun.length === 0 ? ['no explicit test verification'] : []),
    ...(session.changedFiles.length > 12 ? ['large changed-file fan-out'] : []),
  ])

  return {
    rank,
    session_id: session.sessionId,
    source_repo: session.repo,
    candidate_path: session.sessionPath,
    repo_path: session.repoPath,
    branch: session.branch,
    first_instruction: session.firstInstruction,
    task_type: session.taskType,
    quality_tier: session.qualityTier,
    canonicality_guess: canonicality,
    bucket_guess: bucket,
    suggested_disposition: suggestedDisposition(session),
    review_score: session.reviewScore,
    summary: summarizeSession(session),
    changed_files: session.changedFiles,
    commands_run: session.commandsRun,
    tests_run: session.testsRun,
    relevant_helpers: session.relevantHelpers,
    policy_signals: session.policyTrace,
    verification_signals: verificationSignals,
    positive_signals: positiveSignals,
    negative_signals: negativeSignals,
    snippets: session.snippets,
    notes: session.notes,
  }
}

async function main() {
  await Bun.$`mkdir -p ${OUTPUT_DIR}`

  const allSessions: SessionRecord[] = []
  const summaries: RepoSummary[] = []

  for (const repo of DEFAULT_REPOS) {
    const home = inferHome(repo.repoPath)
    const sessionRoot = `${home}/.claude/projects/${encodeClaudeProjectPath(repo.repoPath)}`
    const allJsonl = await listFiles(sessionRoot, '**/*.jsonl')
    const mainSessions = allJsonl.filter(path => !path.includes('/subagents/'))
    const subagentSessions = allJsonl.filter(path => path.includes('/subagents/'))
    const sessions = (await Promise.all(mainSessions.map(path => parseSession(path, repo))))
      .filter((session): session is SessionRecord => Boolean(session))
      .sort((a, b) => b.reviewScore - a.reviewScore)

    allSessions.push(...sessions)
    summaries.push(await buildRepoSummary(repo, sessions, mainSessions, subagentSessions, sessionRoot))

    await Bun.write(`${OUTPUT_DIR}/${repo.name}-session-curation-summary.json`, `${JSON.stringify(summaries[summaries.length - 1], null, 2)}\n`)
    await Bun.write(`${OUTPUT_DIR}/${repo.name}-session-candidates.jsonl`, sessions.map(session => JSON.stringify(session)).join('\n') + '\n')
  }

  const ranked = allSessions
    .sort((a, b) => b.reviewScore - a.reviewScore)
    .map((session, index) => toReviewEntry(session, index + 1))

  const firstBatch = [
    ...ranked.filter(item => item.source_repo === 'luca' && item.bucket_guess !== 'rejects').slice(0, 10),
    ...ranked.filter(item => item.source_repo === 'agentic-loop' && item.bucket_guess !== 'rejects').slice(0, 15),
    ...ranked.filter(item => item.bucket_guess === 'rejects').slice(0, 5),
  ]
    .map((item, index) => ({ ...item, rank: index + 1 }))

  const manifest = {
    generatedAt: new Date().toISOString(),
    repos: summaries.map(summary => ({
      repo: summary.repo,
      repoPath: summary.repoPath,
      counts: summary.counts,
      sessionRoot: summary.sessionRoot,
    })),
    totalCandidates: ranked.length,
    recommendedFirstBatch: {
      total: firstBatch.length,
      lucaCanonicalAndStrong: firstBatch.filter(item => item.source_repo === 'luca' && item.bucket_guess !== 'rejects').length,
      agenticLoopCanonicalAndStrong: firstBatch.filter(item => item.source_repo === 'agentic-loop' && item.bucket_guess !== 'rejects').length,
      rejects: firstBatch.filter(item => item.bucket_guess === 'rejects').length,
    },
    recommendations: [
      'Have the Luca author label the first batch using datasets/lora/review-schema.json.',
      'Prefer rewrite over raw keep for canonical-policy and planning examples.',
      'Treat docs and API references as retrieval sources, not direct LoRA rows.',
    ],
  }

  await Bun.write(`${OUTPUT_DIR}/review-queue.jsonl`, ranked.map(item => JSON.stringify(item)).join('\n') + '\n')
  await Bun.write(`${OUTPUT_DIR}/review-batch-1.jsonl`, firstBatch.map(item => JSON.stringify(item)).join('\n') + '\n')
  await Bun.write(`${OUTPUT_DIR}/review-manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`)

  console.log(JSON.stringify({
    outputDir: OUTPUT_DIR,
    totalCandidates: ranked.length,
    firstBatch: firstBatch.length,
    repos: manifest.repos,
  }, null, 2))
}

main().catch(error => {
  console.error(error?.stack || error?.message || String(error))
  process.exit(1)
})
