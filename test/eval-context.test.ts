import { describe, it, expect } from 'bun:test'
import { resolve } from 'path'

/**
 * `luca eval` context regression tests.
 *
 * Round-3 follow-up: `z` was importable in every VM-loaded module and a global
 * in runnable markdown blocks, but eval — the prototyping surface where agents
 * write schemas first — had neither `z` nor `require`. These pin the contract.
 */

const cli = resolve(import.meta.dir, '../src/cli/cli.ts')

async function evalSnippet(code: string): Promise<{ stdout: string; exitCode: number }> {
  const proc = Bun.spawn({ cmd: ['bun', 'run', cli, 'eval', code], stdout: 'pipe', stderr: 'pipe' })
  const exitCode = await proc.exited
  return { stdout: await new Response(proc.stdout).text(), exitCode }
}

describe('luca eval context', () => {
  it('has z in scope for schema prototyping', async () => {
    const { stdout, exitCode } = await evalSnippet(
      `z.object({ port: z.number().default(3000) }).parse({}).port`
    )
    expect(exitCode).toBe(0)
    expect(stdout).toContain('3000')
  }, 30_000)

  it('resolves virtual modules through require()', async () => {
    const { stdout, exitCode } = await evalSnippet(
      `const { z: zed } = require('zod'); const luca = require('luca'); typeof zed.object + ':' + typeof luca.Feature`
    )
    expect(exitCode).toBe(0)
    expect(stdout).toContain('function:function')
  }, 30_000)

  it('supports the schema-bearing store one-liner that motivated this', async () => {
    const name = `eval-ctx-${Date.now()}`
    const { stdout, exitCode } = await evalSnippet(
      `const s = container.store('${name}', { scope: 'tmp', schema: z.object({ ok: z.boolean().default(false) }) }); await s.update(d => { d.ok = true }); const out = (await s.read()).ok; await s.delete(); out`
    )
    expect(exitCode).toBe(0)
    expect(stdout).toContain('true')
  }, 30_000)
})
