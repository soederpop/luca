import { z } from 'zod'
import { commands, CommandOptionsSchema } from '@soederpop/luca'
import type { ContainerContext } from '@soederpop/luca'

declare module '@soederpop/luca' {
  interface AvailableCommands {
    tryAllChallenges: ReturnType<typeof commands.registerHandler>
  }
}

export const argsSchema = CommandOptionsSchema.extend({
  'batch-size': z.number().default(4).describe('Number of challenges to run in parallel per batch'),
  'time-limit': z.number().optional().describe('Override time limit in minutes for all challenges'),
  'dry-run': z.boolean().default(false).describe('List the batch schedule without running anything'),
})

// ─── Types ──────────────────────────────────────────────────────────────────

type ChallengeStatus = 'queued' | 'bootstrapping' | 'running' | 'done' | 'failed' | 'timeout'

interface ChallengeState {
  id: string
  slug: string
  title: string
  status: ChallengeStatus
  startTime: number
  durationMs: number
  timeLimitMinutes: number
  lastActivity: string
  activityLines: string[]
  lessonsWritten: boolean
  attemptFolder: string
  error: string | undefined
  batchIndex: number
}

// ─── Constants ──────────────────────────────────────────────────────────────

const SPINNER = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
const MAX_ACTIVITY_LINES = 50
const STRIP_ANSI = /\x1b\[[0-9;]*m/g

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${String(sec).padStart(2, '0')}`
}

function pushActivity(cs: ChallengeState, line: string) {
  const clean = line.replace(STRIP_ANSI, '').trim()
  if (!clean) return
  cs.activityLines.push(clean)
  if (cs.activityLines.length > MAX_ACTIVITY_LINES) {
    cs.activityLines = cs.activityLines.slice(-MAX_ACTIVITY_LINES)
  }
  cs.lastActivity = clean.slice(0, 80)
  if (/lessons\.md/i.test(clean)) {
    cs.lessonsWritten = true
  }
}

// ─── Orchestration ──────────────────────────────────────────────────────────

async function bootstrapFolder(container: any, folder: string) {
  const result = await container.proc.spawnAndCapture('luca', ['bootstrap'], {
    cwd: container.paths.resolve(folder),
    onOutput: () => {},
    onError: () => {},
  })
  if (result.exitCode !== 0) {
    throw new Error(`bootstrap failed (exit ${result.exitCode}): ${result.stderr}`)
  }
}

// Track active child processes for cleanup on abort
const activeChildProcesses = new Set<any>()

async function runChallenge(
  cs: ChallengeState,
  container: any,
  sessionFolder: string,
  abortSignal: { aborted: boolean },
): Promise<void> {
  if (abortSignal.aborted) return

  const fs = container.feature('fs')
  const attemptFolder = `${sessionFolder}/${cs.slug}`
  cs.attemptFolder = attemptFolder
  fs.ensureFolder(attemptFolder)

  // Bootstrap
  cs.status = 'bootstrapping'
  cs.startTime = Date.now()
  cs.lastActivity = 'bootstrapping...'
  await bootstrapFolder(container, attemptFolder)

  if (abortSignal.aborted) return

  // Run claude via luca prompt
  cs.status = 'running'
  cs.lastActivity = 'claude starting...'

  const promptArgs = [
    'prompt', 'claude', `docs/${cs.id}`,
    '--exclude-sections', 'Internal Notes',
    '--out-file', `${sessionFolder}/logs/${cs.slug}-session.md`,
    '--in-folder', attemptFolder,
    '--dont-touch-file',
  ]

  const timeLimitMs = cs.timeLimitMinutes * 60 * 1000

  const promptProcess = container.proc.spawnAndCapture('luca', promptArgs, {
    onStart: (childProcess: any) => {
      activeChildProcesses.add(childProcess)
    },
    onOutput: (str: string) => {
      for (const line of str.split('\n')) {
        pushActivity(cs, line)
      }
    },
    onError: (str: string) => {
      for (const line of str.split('\n')) {
        pushActivity(cs, line)
      }
    },
  })

  const timeout = new Promise<'timeout'>((resolve) => {
    setTimeout(() => resolve('timeout'), timeLimitMs + 30_000)
  })

  const result = await Promise.race([
    promptProcess.then(() => 'done' as const),
    timeout,
  ]).catch((err: any) => {
    cs.error = err?.message || String(err)
    return 'failed' as const
  })

  cs.durationMs = Date.now() - cs.startTime

  if (result === 'timeout') {
    cs.status = 'timeout'
    cs.error = `Exceeded ${cs.timeLimitMinutes}min + 30s safety margin`
    pushActivity(cs, `[TIMEOUT: ${cs.timeLimitMinutes} min limit reached]`)
  } else if (result === 'failed') {
    cs.status = 'failed'
    pushActivity(cs, `[FAILED: ${cs.error}]`)
  } else {
    // Check if LESSONS.md was actually written
    if (fs.existsSync(container.paths.resolve(attemptFolder, 'LESSONS.md'))) {
      cs.lessonsWritten = true
    }
    cs.status = 'done'
  }
}

async function runBatch(
  batch: ChallengeState[],
  container: any,
  sessionFolder: string,
  abortSignal: { aborted: boolean },
): Promise<void> {
  const results = await Promise.allSettled(
    batch.map((cs) => runChallenge(cs, container, sessionFolder, abortSignal))
  )

  for (let i = 0; i < results.length; i++) {
    const r = results[i]
    if (r.status === 'rejected' && batch[i].status === 'running') {
      batch[i].status = 'failed'
      batch[i].error = String(r.reason)
      batch[i].durationMs = Date.now() - batch[i].startTime
    }
  }
}

async function runSynthesis(
  challenges: ChallengeState[],
  container: any,
  sessionFolder: string,
): Promise<void> {
  const fs = container.feature('fs')
  const paths = container.paths

  // Gather all LESSONS.md content
  const lessonParts: string[] = []
  const summaryParts: string[] = []

  for (const cs of challenges) {
    const lessonsPath = paths.resolve(cs.attemptFolder, 'LESSONS.md')
    const statusLabel = cs.status === 'done' ? 'completed' : cs.status
    const duration = formatElapsed(cs.durationMs)

    summaryParts.push(`- **${cs.title}** (${cs.slug}): ${statusLabel} in ${duration}${cs.lessonsWritten ? '' : ' — no LESSONS.md'}`)

    if (cs.lessonsWritten && fs.existsSync(lessonsPath)) {
      const content = fs.readFile(lessonsPath) as string
      lessonParts.push(`## ${cs.title} (${cs.slug})\n\n${content}`)
    }
  }

  const done = challenges.filter(c => c.status === 'done').length
  const failed = challenges.filter(c => c.status === 'failed' || c.status === 'timeout').length

  const synthesisPrompt = `You are reviewing the results of a batch challenge evaluation session for the Luca framework.

${done} challenges completed successfully. ${failed} challenges failed or timed out.

## Challenge Results

${summaryParts.join('\n')}

## Individual LESSONS.md Files

${lessonParts.length > 0 ? lessonParts.join('\n\n---\n\n') : '(No LESSONS.md files were produced)'}

## Your Task

Write a RETRO.md file in the current directory that contains:

1. **What Went Well** — patterns and capabilities that worked reliably across challenges
2. **What Didn't Go Well** — common struggles, failures, and pain points
3. **Actionable Improvements** — specific, concrete steps to improve the CLAUDE.md, SKILL.md, framework docs, or luca internals that would help future challenge runs succeed faster and more reliably
4. **Challenge-by-Challenge Notes** — brief per-challenge observations worth preserving

Be specific and actionable. Reference concrete file paths, APIs, and patterns. This retro should directly inform what we work on next.`

  // Write synthesis prompt to a temp file and run it through luca prompt
  const synthPromptPath = paths.resolve(sessionFolder, '_synthesis-prompt.md')
  fs.ensureFile(synthPromptPath, `---\nrepeatable: true\n---\n\n${synthesisPrompt}`, true)

  fs.ensureFolder(paths.resolve(sessionFolder, 'logs'))

  await container.proc.spawnAndCapture('luca', [
    'prompt', 'claude', synthPromptPath,
    '--in-folder', sessionFolder,
    '--out-file', `${sessionFolder}/logs/synthesis-session.md`,
    '--dont-touch-file',
    '--preserve-frontmatter',
  ], {
    onOutput: (str: string) => { process.stdout.write(str) },
    onError: (str: string) => { process.stderr.write(str) },
  })
}

// ─── Ink Dashboard ──────────────────────────────────────────────────────────

async function renderDashboard(
  challenges: ChallengeState[],
  container: any,
  sessionFolder: string,
  batchSize: number,
): Promise<boolean> {
  const ink = container.feature('ink', { enable: true })
  await ink.loadModules()

  const React = ink.React
  const h = React.createElement
  const { Box, Text } = ink.components
  const { useApp, useInput, useStdout } = ink.hooks
  const { useState, useEffect } = React

  const numBatches = Math.ceil(challenges.length / batchSize)
  let currentBatchIndex = 0
  let allBatchesDone = false
  let userAborted = false
  const abortSignal = { aborted: false }

  // Run batches in sequence outside React
  const orchestrate = async () => {
    for (let b = 0; b < numBatches; b++) {
      if (abortSignal.aborted) break
      currentBatchIndex = b
      const start = b * batchSize
      const batch = challenges.slice(start, start + batchSize)
      await runBatch(batch, container, sessionFolder, abortSignal)
    }
    allBatchesDone = true
  }

  const orchestrationPromise = orchestrate().catch(() => { allBatchesDone = true })

  function App() {
    const { exit } = useApp()
    const { stdout } = useStdout()
    const [tick, setTick] = useState(0)
    const [focusIdx, setFocusIdx] = useState(0)

    const cols = stdout?.columns || 120
    const rows = stdout?.rows || 40

    useEffect(() => {
      const timer = setInterval(() => setTick((t: number) => t + 1), 250)
      return () => clearInterval(timer)
    }, [])

    useEffect(() => {
      if (allBatchesDone) {
        setTimeout(() => exit(), 600)
      }
    }, [tick])

    useInput((input: string, key: any) => {
      if (input === 'q' || (key.ctrl && input === 'c')) {
        userAborted = true
        abortSignal.aborted = true
        // Kill all active child processes
        for (const cp of activeChildProcesses) {
          try { cp.kill?.('SIGTERM') } catch {}
        }
        activeChildProcesses.clear()
        exit()
      }
      if (key.upArrow) setFocusIdx((i: number) => Math.max(0, i - 1))
      if (key.downArrow) setFocusIdx((i: number) => Math.min(challenges.length - 1, i + 1))
    })

    const done = challenges.filter(c => c.status === 'done').length
    const failed = challenges.filter(c => c.status === 'failed' || c.status === 'timeout').length
    const running = challenges.filter(c => c.status === 'running' || c.status === 'bootstrapping').length
    const queued = challenges.filter(c => c.status === 'queued').length

    // Progress bar
    const progress = challenges.length > 0 ? (done + failed) / challenges.length : 0
    const barWidth = 20
    const filled = Math.round(progress * barWidth)
    const bar = '\u2588'.repeat(filled) + '\u2591'.repeat(barWidth - filled)

    // Spinner frame
    const spinFrame = SPINNER[tick % SPINNER.length]

    // Detail panel lines
    const focused = challenges[focusIdx]
    const detailHeight = Math.min(8, Math.max(rows - challenges.length - 8, 4))
    const detailLines = focused ? focused.activityLines.slice(-detailHeight) : []

    return h(Box, { flexDirection: 'column', width: cols },
      // ── Header ──
      h(Box, { paddingX: 1, marginBottom: 1, justifyContent: 'space-between' },
        h(Text, { bold: true, color: '#61dafb' }, 'LUCA CHALLENGES'),
        h(Text, null,
          h(Text, { dimColor: true }, `Batch ${currentBatchIndex + 1}/${numBatches}  `),
          h(Text, { color: 'cyan' }, bar),
          h(Text, { dimColor: true }, `  ${done + failed}/${challenges.length}`),
        ),
      ),
      // ── Stats row ──
      h(Box, { paddingX: 1, marginBottom: 1, gap: 2 },
        h(Text, { color: 'green' }, `${done} done`),
        h(Text, { color: 'red' }, `${failed} failed`),
        running > 0
          ? h(Text, { color: 'cyan' }, `${running} running`)
          : null,
        queued > 0
          ? h(Text, { dimColor: true }, `${queued} queued`)
          : null,
      ),
      // ── Challenge rows ──
      ...challenges.map((cs, i) => {
        const isFocused = i === focusIdx
        const elapsed = cs.status === 'queued'
          ? '--:--'
          : cs.status === 'done' || cs.status === 'failed' || cs.status === 'timeout'
            ? formatElapsed(cs.durationMs)
            : formatElapsed(Date.now() - cs.startTime)

        let icon = ' · '
        let iconColor = 'gray'
        if (cs.status === 'bootstrapping') { icon = ' ⚙ '; iconColor = 'yellow' }
        else if (cs.status === 'running') { icon = ` ${spinFrame} `; iconColor = 'cyan' }
        else if (cs.status === 'done') { icon = ' ✓ '; iconColor = 'green' }
        else if (cs.status === 'failed') { icon = ' ✗ '; iconColor = 'red' }
        else if (cs.status === 'timeout') { icon = ' ⏱ '; iconColor = 'yellow' }

        const slugDisplay = cs.slug.slice(0, 36).padEnd(36)
        const elapsedDisplay = elapsed.padStart(6)
        const activityWidth = Math.max(0, cols - 52)
        const activity = cs.lastActivity ? cs.lastActivity.slice(0, activityWidth) : ''
        const lessonsTag = cs.lessonsWritten ? ' [L]' : ''

        return h(Box, { key: cs.id, paddingX: 1 },
          h(Text, { color: isFocused ? 'white' : undefined, bold: isFocused, inverse: isFocused },
            h(Text, { color: iconColor }, icon),
            h(Text, null, slugDisplay),
            h(Text, { dimColor: !isFocused }, `  ${elapsedDisplay}  `),
            h(Text, { dimColor: true }, activity),
            cs.lessonsWritten
              ? h(Text, { color: 'green', bold: true }, lessonsTag)
              : null,
          ),
        )
      }),
      // ── Detail panel ──
      h(Box, {
        flexDirection: 'column',
        borderStyle: 'round',
        borderColor: focused?.status === 'running' ? 'cyan'
          : focused?.status === 'done' ? 'green'
          : focused?.status === 'failed' || focused?.status === 'timeout' ? 'red'
          : 'gray',
        paddingX: 1,
        marginTop: 1,
        marginX: 1,
        height: detailHeight + 2,
      },
        h(Box, { justifyContent: 'space-between' },
          h(Text, { bold: true }, focused ? focused.title : ''),
          focused && focused.status !== 'queued'
            ? h(Text, { dimColor: true },
                focused.status === 'running' || focused.status === 'bootstrapping'
                  ? formatElapsed(Date.now() - focused.startTime)
                  : formatElapsed(focused.durationMs),
              )
            : null,
        ),
        h(Text, { wrap: 'truncate', dimColor: true },
          detailLines.length > 0 ? detailLines.join('\n') : '(waiting...)',
        ),
      ),
      // ── Footer ──
      h(Box, { paddingX: 1, marginTop: 1, gap: 3 },
        h(Text, { dimColor: true }, '↑↓ navigate'),
        h(Text, { dimColor: true }, 'q quit'),
      ),
    )
  }

  await ink.render(h(App))
  await ink.waitUntilExit()

  if (userAborted) return false

  await orchestrationPromise
  return true
}

// ─── Main Handler ───────────────────────────────────────────────────────────

export async function tryAllChallenges(options: z.infer<typeof argsSchema>, context: ContainerContext) {
  const container = context.container as any
  const fs = container.feature('fs')
  const paths = container.paths
  const batchSize = options['batch-size']

  await container.docs.load()
  const allChallenges = await container.docs.queries.challenges.fetchAll()

  if (allChallenges.length === 0) {
    container.ui.print('No challenges found in docs/challenges/')
    return
  }

  // Build challenge states
  const numBatches = Math.ceil(allChallenges.length / batchSize)
  const challengeStates: ChallengeState[] = allChallenges.map((c: any, i: number) => ({
    id: c.id,
    slug: c.id.split('/').pop()!,
    title: c.title || c.id.split('/').pop()!,
    status: 'queued' as ChallengeStatus,
    startTime: 0,
    durationMs: 0,
    timeLimitMinutes: options['time-limit'] ?? c.meta?.maxTime ?? 5,
    lastActivity: '',
    activityLines: [],
    lessonsWritten: false,
    attemptFolder: '',
    error: undefined,
    batchIndex: Math.floor(i / batchSize),
  }))

  // Dry run — just print the schedule
  if (options['dry-run']) {
    container.ui.print(`\n${allChallenges.length} challenges in ${numBatches} batches of ${batchSize}:\n`)
    for (let b = 0; b < numBatches; b++) {
      const batch = challengeStates.filter(c => c.batchIndex === b)
      container.ui.print(`  Batch ${b + 1}:`)
      for (const cs of batch) {
        container.ui.print(`    - ${cs.slug} (${cs.timeLimitMinutes}min)`)
      }
    }
    return
  }

  // Create session folder
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const sessionFolder = paths.resolve(`attempts/session-${timestamp}`)
  fs.ensureFolder(sessionFolder)
  fs.ensureFolder(`${sessionFolder}/logs`)

  container.ui.print(`Session: ${sessionFolder}`)
  container.ui.print(`${allChallenges.length} challenges, ${numBatches} batches of ${batchSize}\n`)

  // Run dashboard
  const completed = await renderDashboard(challengeStates, container, sessionFolder, batchSize)

  if (!completed) {
    container.ui.print('\nAborted by user.')
    process.exit(1)
  }

  // Print summary
  const done = challengeStates.filter(c => c.status === 'done').length
  const failed = challengeStates.filter(c => c.status === 'failed' || c.status === 'timeout').length
  const withLessons = challengeStates.filter(c => c.lessonsWritten).length

  container.ui.print(`\n${'─'.repeat(60)}`)
  container.ui.print(`Results: ${done} done, ${failed} failed, ${withLessons} with LESSONS.md`)
  container.ui.print(`Session folder: ${sessionFolder}`)

  // Write a session manifest
  const manifest = challengeStates.map(cs => ({
    slug: cs.slug,
    status: cs.status,
    durationMs: cs.durationMs,
    lessonsWritten: cs.lessonsWritten,
    error: cs.error,
  }))
  fs.ensureFile(
    paths.resolve(sessionFolder, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
    true,
  )

  // Synthesis
  if (withLessons > 0) {
    container.ui.print(`\nRunning synthesis across ${withLessons} LESSONS.md files...\n`)
    await runSynthesis(challengeStates, container, sessionFolder)
    container.ui.print(`\nRetro written to ${sessionFolder}/RETRO.md`)
  } else {
    container.ui.print('\nNo LESSONS.md files produced — skipping synthesis.')
  }
}

export default {
  description: 'Run all challenges in parallel batches with a live dashboard, then synthesize lessons into a retro.',
  argsSchema,
  handler: tryAllChallenges,
}
