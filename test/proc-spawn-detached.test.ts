import { describe, it, expect, afterAll } from 'bun:test'
import { NodeContainer } from '../src/node/container'
import { tmpdir } from 'os'
import { join, resolve } from 'path'
import { writeFileSync, unlinkSync } from 'fs'

/**
 * Regression tests for proc.spawn({ detached: true }).
 *
 * Previously no `detached` option was wired through to the underlying spawn
 * call, so a spawned child could never be put in its own process group and
 * always died with the parent — agents had to fall back to
 * proc.exec('nohup ... & echo $!') workarounds.
 */

const isAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

const reap = (pid: number | undefined) => {
  if (!pid) return
  try { process.kill(pid, 'SIGKILL') } catch {}
}

describe('proc.spawn detached option', () => {
  const container = new NodeContainer()
  const proc = container.feature('proc')
  const pidsToReap: number[] = []

  afterAll(() => {
    for (const pid of pidsToReap) reap(pid)
  })

  it('passes detached through and defaults stdio to ignore', async () => {
    const child = proc.spawn('sleep', ['30'], { detached: true })
    expect(child.pid).toBeGreaterThan(0)
    pidsToReap.push(child.pid!)

    // No pipes should be attached when detached (they would bind the child to the parent)
    expect(child.stdout).toBeNull()
    expect(child.stderr).toBeNull()
    expect(child.stdin).toBeNull()

    child.unref()

    // Child stays alive after the handle is unref'd
    await new Promise((r) => setTimeout(r, 100))
    expect(isAlive(child.pid!)).toBe(true)

    // Detached means its own process group: pgid === pid, not the parent's group
    const pgid = proc.exec(`ps -o pgid= -p ${child.pid}`).trim()
    expect(Number(pgid)).toBe(child.pid!)

    reap(child.pid)
  })

  it('a detached child outlives a parent process that exits', async () => {
    const containerPath = resolve(import.meta.dir, '../src/node/container.ts')
    const scriptPath = join(tmpdir(), `luca-detached-parent-${process.pid}-${Date.now()}.ts`)

    writeFileSync(scriptPath, `
      import { NodeContainer } from ${JSON.stringify(containerPath)}
      const container = new NodeContainer()
      const proc = container.feature('proc')
      const child = proc.spawn('sleep', ['30'], { detached: true })
      child.unref()
      console.log(child.pid)
      process.exit(0)
    `)

    try {
      const parent = Bun.spawnSync([process.execPath, 'run', scriptPath], {
        stdout: 'pipe',
        stderr: 'pipe',
      })
      const stdout = parent.stdout.toString().trim()
      const stderr = parent.stderr.toString()
      expect(parent.exitCode, `parent script failed: ${stderr}`).toBe(0)

      const childPid = Number(stdout.split('\n').pop())
      expect(childPid).toBeGreaterThan(0)
      pidsToReap.push(childPid)

      // The parent has fully exited — the detached child must still be running
      await new Promise((r) => setTimeout(r, 200))
      expect(isAlive(childPid)).toBe(true)

      reap(childPid)
      // Give the OS a moment to reap, then confirm cleanup worked
      await new Promise((r) => setTimeout(r, 100))
      expect(isAlive(childPid)).toBe(false)
    } finally {
      try { unlinkSync(scriptPath) } catch {}
    }
  })

  it('non-detached spawn still pipes stdio by default', async () => {
    const child = proc.spawn('echo', ['hello'])
    expect(child.stdout).not.toBeNull()
    const out = await new Promise<string>((resolveOut) => {
      let buf = ''
      child.stdout!.on('data', (d: Buffer) => { buf += d.toString() })
      child.on('close', () => resolveOut(buf))
    })
    expect(out.trim()).toBe('hello')
  })
})
