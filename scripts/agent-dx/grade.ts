import container from '../../src/node'
import { runProcess } from './process'
import type { Task } from './suite'

export interface Check { id: string; passed: boolean; error?: string }

/** Evaluator-controlled fixtures are created after the agent exits, in a fresh cwd. */
export async function grade(task: Task, solution: string, cwd: string): Promise<Check[]> {
  const fs = container.fs
  fs.ensureFolder(cwd)
  const checks: Check[] = []
  const check = async (id: string, fn: () => Promise<void>) => {
    try { await fn(); checks.push({ id, passed: true }) }
    catch (error) { checks.push({ id, passed: false, error: String(error instanceof Error ? error.message : error) }) }
  }
  const equal = (actual: unknown, expected: unknown) => {
    if (container.utils.hashObject(actual) !== container.utils.hashObject(expected)) throw new Error(`Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`)
  }
  const call = async (input: unknown) => {
    const output = container.paths.resolve(cwd, `result-${container.utils.uuid()}.json`)
    const result = await runProcess([process.execPath, container.paths.resolve(import.meta.dir, 'invoke.ts'), solution, JSON.stringify(input), output], cwd, 15_000)
    if (result.timedOut || result.exitCode !== 0 || result.error) {
      throw new Error(result.timedOut ? 'Invocation timed out' : `${result.error || ''} ${result.stderr} ${fs.exists(output) ? fs.readFile(output) : ''}`.trim())
    }
    return fs.readJson(output).value
  }
  if (task.id === 'path-semantics') {
    for (const [id, base, target, expected] of [
      ['absolute', '/tmp/dx/base', '/tmp/dx/base/nested/file.txt', 'nested/file.txt'],
      ['relative', 'folder', 'folder/a b.txt', 'a b.txt'],
      ['parent', '/tmp/dx/base/nested', '/tmp/dx/base/peer', '../peer'],
    ]) await check(id!, async () => equal(await call({ base, target }), expected))
  }
  if (task.id === 'binary-copy') {
    for (const [id, bytes] of [['arbitrary-bytes', Buffer.from(Array.from({ length: 512 }, (_, i) => i % 256))], ['empty-file', Buffer.alloc(0)]] as const) {
      await check(id, async () => {
        fs.writeFile(container.paths.resolve(cwd, 'input.bin'), bytes)
        const destination = `nested/${id}/out.bin`
        equal(await call({ source: 'input.bin', destination }), bytes.length)
        const copied = fs.readFile(container.paths.resolve(cwd, destination), null) as Buffer
        if (!copied.equals(bytes)) throw new Error('Destination bytes differ from source')
      })
    }
  }
  if (task.id === 'process-result') {
    await check('child-environment', async () => {
      const result = await call({ command: process.execPath, args: ['-e', 'console.log(process.env.LUCA_DX_CHILD ?? "missing")'], environment: { LUCA_DX_CHILD: 'child value' } })
      equal(result, { ok: true, exitCode: 0, stdout: 'child value\n', stderr: '' })
    })
    await check('literal-argv', async () => {
      const arg = 'a b "quoted" $HOME $(echo wrong)'
      const result = await call({ command: process.execPath, args: ['-e', 'console.log(process.argv[1])', arg] })
      equal(result, { ok: true, exitCode: 0, stdout: arg + '\n', stderr: '' })
    })
    await check('nonzero-diagnostics', async () => {
      const result = await call({ command: process.execPath, args: ['-e', 'console.log("partial"); console.error("bad input"); process.exit(7)'] })
      equal(result, { ok: false, exitCode: 7, stdout: 'partial\n', stderr: 'bad input\n' })
    })
  }
  if (task.id === 'durable-counter') {
    await check('missing-is-zero', async () => equal(await call({ name: 'empty', action: 'read' }), 0))
    await check('cross-process', async () => {
      await call({ name: 'serial', action: 'add', amount: 7 })
      await call({ name: 'serial', action: 'add', amount: -2 })
      equal(await call({ name: 'serial', action: 'read' }), 5)
    })
    await check('concurrent-updates', async () => {
      const results = await Promise.allSettled(Array.from({ length: 8 }, () => call({ name: 'parallel', action: 'add', amount: 3 })))
      for (const result of results) if (result.status === 'rejected') throw result.reason
      equal(await call({ name: 'parallel', action: 'read' }), 24)
    })
  }
  if (task.id === 'module-boundary') {
    fs.writeFile(container.paths.resolve(cwd, 'transform.ts'), 'export const transform = (value: string) => container.utils.stringUtils.camelCase(value)')
    fs.writeFile(container.paths.resolve(cwd, 'broken.ts'), 'export const transform = () => { throw new Error("fixture-transform-failed") }')
    await check('typescript-and-context', async () => equal(await call({ file: 'transform.ts', value: 'hello-world' }), { ok: true, value: 'helloWorld' }))
    for (const [id, file, diagnostic] of [['missing-file', 'absent.ts', 'absent.ts'], ['transform-failure', 'broken.ts', 'fixture-transform-failed']]) {
      await check(id!, async () => {
        const result = await call({ file, value: 'x' })
        if (result?.ok !== false || typeof result.error !== 'string' || !result.error.includes(diagnostic)) throw new Error(`Missing diagnostic ${diagnostic}: ${JSON.stringify(result)}`)
      })
    }
  }
  if (task.id === 'registry-discovery') {
    for (const [registry, name] of [['features', 'fs'], ['clients', 'rest'], ['servers', 'express']] as const) {
      await check(`${registry}-qualified-and-bare`, async () => {
        const expected = { available: true, description: container[registry].introspect(name)?.description }
        equal(await call({ registry, name }), expected)
        equal(await call({ registry, name: `${registry}.${name}` }), expected)
        equal(await call({ registry, name: 'dxMissingHelper' }), { available: false, description: null })
      })
    }
  }
  return checks
}
