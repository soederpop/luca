import { describe, it, expect } from 'bun:test'
import container from '../../src/node'
import { tasks } from './suite'
import { grade } from './grade'
import { compare, configSchema, run, type Report } from './harness'
import { runProcess } from './process'

const temp = () => container.paths.resolve('attempts', `dx-test-${container.utils.uuid()}`)

describe('agent DX acceptance graders', () => {
  it('accepts equivalent JSON objects regardless of property order', async () => {
    const folder = temp()
    container.fs.ensureFolder(folder)
    try {
      const solution = container.paths.resolve(folder, 'solution.ts')
      container.fs.writeFile(solution, 'export default async (c, i) => { const r = await c.proc.spawnAndCapture(i.command, i.args, { environment: i.environment }); return { stderr:r.stderr, stdout:r.stdout, exitCode:r.exitCode, ok:r.exitCode === 0 } }')
      const checks = await grade(tasks.find(t => t.id === 'process-result')!, solution, container.paths.resolve(folder, 'grading'))
      expect(checks.every(c => c.passed)).toBe(true)
    } finally { container.fs.remove(folder) }
  }, 15_000)
  it('rejects plausible broken implementations, including process-local state', async () => {
    const folder = temp()
    container.fs.ensureFolder(folder)
    const broken: Record<string, string> = {
      'path-semantics': 'export default (c, i) => c.paths.relative(i.target)',
      'binary-copy': 'export default (c, i) => { const s = c.fs.readFile(i.source); c.fs.ensureFolder(c.paths.dirname(c.paths.resolve(i.destination))); c.fs.writeFile(i.destination, s); return s.length }',
      'process-result': 'export default async (c, i) => { const r = await c.proc.spawnAndCapture(i.command, i.args); return { ok:true, exitCode:0, stdout:r.stdout, stderr:r.stderr } }',
      'durable-counter': 'let count = 0; export default (c, i) => { if(i.action === "add") count += i.amount; return count }',
      'module-boundary': 'export default () => ({ ok: false, error: "something failed" })',
      'registry-discovery': 'export default () => ({ available: true, description: "guessed helper description" })',
    }
    try {
      for (const task of tasks) {
        const solution = container.paths.resolve(folder, task.id + '.ts')
        container.fs.writeFile(solution, broken[task.id]!)
        const result = await grade(task, solution, container.paths.resolve(folder, task.id))
        expect(result.some(c => !c.passed)).toBe(true)
      }
    } finally { container.fs.remove(folder) }
  }, 60_000)

  it('rejects a zero-exit runner that never creates a solution', async () => {
    const output = temp()
    try {
      const report = await run(configSchema.parse({ label: 'fake', model: 'fake', runner: [process.execPath, '-e', ''], trials: 1, tasks: ['path-semantics'] }), 'agent', output)
      expect(report.attempts[0]!.status).toBe('failed')
      expect(report.attempts[0]!.error).toContain('No solution')
    } finally { container.fs.remove(output) }
  }, 15_000)
})

describe('bounded process execution', () => {
  it('retains nonzero exits and distinguishes missing executables', async () => {
    const result = await runProcess([process.execPath, '-e', 'console.error("failure"); process.exit(9)'], container.cwd, 5000)
    expect(result.exitCode).toBe(9)
    expect(result.stderr).toContain('failure')
    const missing = await runProcess(['/nonexistent/agent-dx-command'], container.cwd, 5000)
    expect(missing.error).toBeTruthy()
  })

  it('kills descendants that keep stdout open on timeout', async () => {
    const result = await runProcess([process.execPath, '-e', 'const child = Bun.spawn([process.execPath, "-e", "setInterval(() => {}, 1000)"], {stdout:"inherit", stderr:"inherit"}); console.log(child.pid); setInterval(() => {}, 1000)'], container.cwd, 500)
    expect(result.timedOut).toBe(true)
    expect(result.durationMs).toBeLessThan(4000)
    const pid = Number(result.stdout.trim())
    expect(pid).toBeGreaterThan(0)
    // Allow the OS to reap the killed descendant.
    for (let n = 0; n < 20 && container.proc.kill(pid, 0); n++) await Bun.sleep(25)
    expect(container.proc.kill(pid, 0)).toBe(false)
  }, 5000)
})

describe('comparison gates', () => {
  const report = (passed: boolean): Report => ({
    schemaVersion: 1, suiteHash: 'v1', mode: 'agent', revision: 'abc', dirty: false, diffHash: 'x', bunVersion: Bun.version, contextHash: 'docs', createdAt: '',
    config: configSchema.parse({ label: 'test', model: 'fixed', runner: ['agent'], trials: 1, tasks: ['path-semantics'] }),
    attempts: [{ task: 'path-semantics', dimension: 'contract-understanding', trial: 1, status: passed ? 'passed' : 'failed', durationMs: 50, checks: [] }],
  })
  it('fails on per-task regressions but permits framework and docs changes', () => {
    const candidate = { ...report(false), revision: 'def', contextHash: 'new-docs' }
    expect(compare(report(true), candidate).regressed).toBe(true)
    expect(compare(report(false), report(true)).regressed).toBe(false)
  })
  it('rejects reference/agent mixing, suite drift, budget changes, and incomplete runs', () => {
    const base = report(true)
    for (const candidate of [
      { ...base, mode: 'reference' as const }, { ...base, suiteHash: 'v2' },
      { ...base, config: { ...base.config, timeoutMs: 1 } }, { ...base, attempts: [] },
    ]) expect(() => compare(base, candidate)).toThrow()
  })
  it('rejects zero trials and unknown tasks', () => {
    expect(() => configSchema.parse({ label: 'x', model: 'x', runner: ['x'], trials: 0 })).toThrow()
    expect(() => configSchema.parse({ label: 'x', model: 'x', runner: ['x'], tasks: ['typo'] })).toThrow()
  })
})
