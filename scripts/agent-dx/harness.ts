import container, { z } from '../../src/node'
import { bootstrapExamples, bootstrapTutorials, bootstrapReferences } from '../../src/bootstrap/generated'
import { tasks, promptFor, suiteVersion } from './suite'
import { grade } from './grade'
import { runProcess } from './process'

export const configSchema = z.object({
  label: z.string().min(1),
  model: z.string().min(1),
  runner: z.array(z.string()).min(1),
  trials: z.number().int().min(1).max(100).default(3),
  timeoutMs: z.number().int().min(1).default(180_000),
  contextDir: z.string().optional(),
  tasks: z.array(z.enum(tasks.map(t => t.id))).min(1).refine(ids => new Set(ids).size === ids.length, 'Task IDs must be unique').optional(),
}).strict()
export type Config = z.infer<typeof configSchema>
export interface Attempt {
  task: string; dimension: string; trial: number
  status: 'passed' | 'failed' | 'timeout' | 'runner-error' | 'harness-error'
  durationMs: number; checks: { id: string; passed: boolean; error?: string }[]
  error?: string
}
export interface Report {
  schemaVersion: 1; suiteHash: string; mode: 'reference' | 'agent'
  config: Config; revision: string; dirty: boolean; diffHash: string; bunVersion: string
  contextHash: string; createdAt: string; attempts: Attempt[]
}

export function summarize(report: Report) {
  return [...new Set(report.attempts.map(a => a.task))].map(task => {
    const attempts = report.attempts.filter(a => a.task === task)
    const passed = attempts.filter(a => a.status === 'passed')
    const durations = passed.map(a => a.durationMs).sort((a, b) => a - b)
    return {
      task, dimension: attempts[0]!.dimension, trials: attempts.length, passed: passed.length,
      passRate: passed.length / attempts.length,
      medianSuccessMs: report.mode === 'agent' && durations.length ? (durations[Math.floor((durations.length - 1) / 2)]! + durations[Math.floor(durations.length / 2)]!) / 2 : null,
    }
  })
}

/** Reject incomparable runs; never let a task's gain hide another task's regression. */
export function compare(baseline: Report, candidate: Report) {
  if (baseline.schemaVersion !== 1 || candidate.schemaVersion !== 1 || baseline.suiteHash !== candidate.suiteHash || baseline.mode !== candidate.mode || baseline.config.model !== candidate.config.model || baseline.config.timeoutMs !== candidate.config.timeoutMs || JSON.stringify(baseline.config.runner) !== JSON.stringify(candidate.config.runner) || baseline.bunVersion !== candidate.bunVersion) {
    throw new Error('Incompatible runs: suite, mode, model, runner, Bun version, and time budget must match')
  }
  for (const report of [baseline, candidate]) {
    const expected = report.config.tasks || tasks.map(t => t.id)
    if (report.attempts.length !== expected.length * report.config.trials) throw new Error('Cannot compare incomplete runs')
    for (const task of expected) {
      for (let trial = 1; trial <= report.config.trials; trial++) {
        if (report.attempts.filter(a => a.task === task && a.trial === trial).length !== 1) throw new Error('Missing or duplicate task/trial')
      }
    }
  }
  const before = summarize(baseline)
  const after = summarize(candidate)
  if (!before.length || before.length !== after.length) throw new Error('Task sets must match and be nonempty')
  const deltas = before.map(a => {
    const b = after.find(b => b.task === a.task)
    if (!b || a.trials !== b.trials) throw new Error('Task sets and trial counts must match')
    return { task: a.task, before: a.passRate, after: b.passRate, delta: b.passRate - a.passRate, medianSuccessMsBefore: a.medianSuccessMs, medianSuccessMsAfter: b.medianSuccessMs }
  })
  return { regressed: deltas.some(d => d.delta < 0), deltas }
}

export async function run(config: Config, mode: Report['mode'], output: string) {
  const fs = container.fs
  const root = container.paths.resolve(import.meta.dir, '../..')
  output = container.paths.resolve(output)
  if (fs.exists(output)) throw new Error(`Output already exists: ${output}; use a fresh directory`)
  const selected = tasks.filter(task => !config.tasks || config.tasks.includes(task.id))
  const context: Record<string, string> = {
    'AGENTS.md': fs.readFile(config.contextDir ? container.paths.resolve(config.contextDir, 'AGENTS.md') : container.paths.resolve(root, 'docs/bootstrap/CLAUDE.md')) as string,
    'SKILL.md': fs.readFile(config.contextDir ? container.paths.resolve(config.contextDir, 'SKILL.md') : container.paths.resolve(root, 'docs/bootstrap/SKILL.md')) as string,
  }
  for (const [folder, files] of Object.entries({ examples: bootstrapExamples, tutorials: bootstrapTutorials, '': bootstrapReferences })) {
    for (const [name, content] of Object.entries(files)) context[`references/${folder ? folder + '/' : ''}${name}`] = content
  }
  const git = await runProcess(['git', 'rev-parse', 'HEAD'], root, 5000)
  const status = await runProcess(['git', 'status', '--porcelain'], root, 5000)
  const diff = await runProcess(['git', 'diff', 'HEAD'], root, 5000)
  if ([git, status, diff].some(r => r.exitCode !== 0 || r.error || r.timedOut)) throw new Error('Unable to record checkout provenance')
  const report: Report = {
    schemaVersion: 1,
    suiteHash: container.utils.hashObject({ suiteVersion, files: ['suite.ts', 'grade.ts', 'invoke.ts', 'process.ts', 'harness.ts'].map(name => fs.readFile(container.paths.resolve(import.meta.dir, name))) }),
    mode, config, revision: git.stdout.trim(), dirty: !!status.stdout.trim(), diffHash: container.utils.hashObject(diff.stdout), bunVersion: Bun.version,
    contextHash: container.utils.hashObject(context), createdAt: new Date().toISOString(), attempts: [],
  }
  fs.ensureFolder(output)
  fs.writeJson(container.paths.resolve(output, 'context.json'), context)
  fs.writeFile(container.paths.resolve(output, 'checkout.diff'), diff.stdout)
  const save = () => {
    fs.writeJson(container.paths.resolve(output, 'report.json'), report)
    fs.writeJson(container.paths.resolve(output, 'summary.json'), summarize(report))
  }
  save()
  let interrupted = false
  const abort = () => { interrupted = true; process.exitCode = 130 }
  process.once('SIGINT', abort)
  process.once('SIGTERM', abort)
  try {
  // Round-robin task order: one task does not consume all its repetitions first.
  for (let trial = 1; trial <= config.trials; trial++) {
    for (const task of selected) {
      if (interrupted) throw new Error(`Evaluation interrupted; partial report retained in ${output}`)
      const folder = container.paths.resolve(output, `${task.id}-${trial}`)
      const workspace = container.paths.resolve(folder, 'workspace')
      fs.ensureFolder(workspace)
      const attempt: Attempt = { task: task.id, dimension: task.dimension, trial, status: 'harness-error', durationMs: 0, checks: [] }
      try {
        for (const [name, content] of Object.entries(context)) {
          fs.ensureFile(container.paths.resolve(workspace, name), content, true)
          if (name === 'SKILL.md' || name.startsWith('references/')) {
            fs.ensureFile(container.paths.resolve(workspace, '.claude/skills/luca-framework', name), content, true)
          }
        }
        fs.writeFile(container.paths.resolve(workspace, 'CLAUDE.md'), context['AGENTS.md']!)
        fs.writeFile(container.paths.resolve(workspace, 'luca.ts'), `await import(${JSON.stringify(container.paths.resolve(root, 'src/cli/cli.ts'))})\n`)
        const prompt = promptFor(task)
        fs.writeFile(container.paths.resolve(workspace, 'PROMPT.md'), prompt)
        const solution = container.paths.resolve(workspace, 'solution.ts')
        if (mode === 'reference') fs.writeFile(solution, task.reference)
        else {
          const argv = config.runner.map(arg => arg.replaceAll('{prompt}', prompt).replaceAll('{workspace}', workspace))
          const result = await runProcess(argv, workspace, config.timeoutMs)
          fs.writeJson(container.paths.resolve(folder, 'runner.json'), result)
          attempt.durationMs = result.durationMs
          if (result.timedOut) attempt.status = 'timeout'
          else if (result.exitCode !== 0 || result.error) { attempt.status = 'runner-error'; attempt.error = result.error || result.stderr }
          else attempt.status = 'failed'
        }
        if (mode === 'reference' || attempt.status === 'failed') {
          if (!fs.exists(solution)) { attempt.status = 'failed'; attempt.error = 'No solution.ts produced' }
          else {
            // Snapshot only the deliverable. Agent-created fixture/state files cannot influence grading.
            const submitted = container.paths.resolve(folder, 'submission.ts')
            fs.copy(solution, submitted)
            attempt.checks = await grade(task, submitted, container.paths.resolve(folder, 'grading'))
            attempt.status = attempt.checks.length > 0 && attempt.checks.every(c => c.passed) ? 'passed' : 'failed'
          }
        }
      } catch (error) { attempt.status = 'harness-error'; attempt.error = String(error) }
      report.attempts.push(attempt)
      save()
      console.log(`${task.id} #${trial}: ${attempt.status} (${attempt.checks.filter(c => c.passed).length}/${attempt.checks.length})`)
    }
  }
  if (interrupted) throw new Error(`Evaluation interrupted; report retained in ${output}`)
  return report
  } finally {
    process.removeListener('SIGINT', abort)
    process.removeListener('SIGTERM', abort)
  }
}
