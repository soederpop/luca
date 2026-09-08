import { beforeEach, afterEach, describe, expect, it, mock } from 'bun:test'
import { NodeContainer } from '../src/node/container'
import type { ProcessManager } from '../src/node/features/process-manager'
let c: NodeContainer
let manager: ProcessManager
let root: string
beforeEach(() => {
  const host = new NodeContainer()
  root = host.paths.join(host.os.tmpdir, `luca-process-manager-${host.utils.uuid()}`)
  host.fs.ensureFolder(root); c = new NodeContainer({ cwd: root })
  manager = c.feature('processManager', { autoCleanup: false })
})
afterEach(async () => { await manager.stop(); c.fs.rmSync(root, { recursive: true, force: true }) })
const spawn = (code: string, options = {}) => manager.spawn(process.execPath, ['-e', code], options)

describe('ProcessManager with real child processes', () => {
  it('starts with no processes and reports unknown lookups', async () => {
    expect(manager.list()).toEqual([])
    expect(manager.get('missing')).toBeUndefined(); expect(manager.getByTag('missing')).toBeUndefined()
    expect(await manager.listProcesses()).toEqual({ processes: [], message: 'No tracked processes.' })
    expect(await manager.getProcessOutput({})).toHaveProperty('error')
    expect(await manager.killProcess({ tag: 'missing' })).toHaveProperty('error')
    expect(manager.remove('missing')).toBe(false)
  })
  it('captures stdout, stderr and trailing partial lines on successful exit', async () => {
    const exited = mock(() => {}); const allStopped = mock(() => {})
    manager.on('exited', exited); manager.on('allStopped', allStopped)
    const child = spawn('process.stdout.write("hello\\npartial"); process.stderr.write("warning")', { tag: 'output' })
    expect(manager.get(child.id)).toBe(child); expect(manager.getByTag('output')).toBe(child)
    expect(await child.await()).toBe(0)
    expect(await child.await()).toBe(0)
    expect(child.isDone).toBe(true); expect(child.isRunning).toBe(false); expect(child.status).toBe('exited')
    expect(child.stdout.toString()).toBe('hello\npartial'); expect(child.stderr.toString()).toBe('warning')
    expect(child.peek()).toEqual({ head: ['hello', 'partial'], tail: [], totalLines: 2, droppedLines: 0 })
    expect(child.peek('stderr').head).toEqual(['warning'])
    expect(exited).toHaveBeenCalledWith(child.id, 0); expect(allStopped).toHaveBeenCalledTimes(1)
    expect((manager.state.get('processes') as any)[child.id]).toMatchObject({ status: 'exited', exitCode: 0 })
  })
  it('tracks crashes and error output with the original exit code', async () => {
    const crashed = mock(() => {}); manager.on('crashed', crashed)
    const child = spawn('console.error("bad input"); process.exit(7)')
    expect(await child.await()).toBe(7)
    expect(child.status).toBe('crashed'); expect(child.exitCode).toBe(7)
    expect(child.stderr.toString()).toBe('bad input')
    expect(crashed).toHaveBeenCalledWith(child.id, 7, expect.any(Object))
  })
  it('keeps the first 20 and last 50 output lines under heavy output', async () => {
    const child = spawn('for(let i=0;i<101;i++) console.log("line-"+i)')
    await child.await()
    expect(child.peek()).toEqual({ head: Array.from({ length: 20 }, (_, i) => `line-${i}`), tail: Array.from({ length: 50 }, (_, i) => `line-${i + 51}`), totalLines: 101, droppedLines: 31 })
    expect(child.stdout.toString()).toContain('(31 lines omitted)')
    expect(child.stdout.toString()).not.toContain('line-50\n')
  })
  it('joins partial chunks and flushes them only once', async () => {
    const child = spawn('process.stdout.write("par"); setTimeout(()=>process.stdout.write("tial\\nlast"), 10)')
    await child.await()
    expect(child.stdout.toString()).toBe('partial\nlast')
    child.stdout.flush(); expect(child.stdout.totalLines).toBe(2)
  })
  it('honors process cwd and per-process environment overrides', async () => {
    c.fs.ensureFolder('nested')
    const child = spawn('console.log(process.cwd()); console.log(process.env.LUCA_TEST_CHILD_VALUE)', { cwd: c.paths.resolve('nested'), env: { LUCA_TEST_CHILD_VALUE: 'child-only' } })
    await child.await()
    expect(child.peek().head).toEqual([c.fs.realpath('nested'), 'child-only'])
    expect(process.env.LUCA_TEST_CHILD_VALUE).toBeUndefined()
  })
  it('writes to a child stdin and receives its response', async () => {
    const child = spawn('process.stdin.once("data", data => { console.log(data.toString().trim().toUpperCase()); process.exit(0) })', { stdin: 'pipe' })
    child.write('hello\n')
    expect(await child.await()).toBe(0)
    expect(child.stdout.toString()).toBe('HELLO')
  })
  it('kills a running process once and prevents removal until it has stopped', async () => {
    const child = spawn('console.log("ready"); setInterval(()=>{},1000)', { tag: 'worker' })
    const ready = new Promise<void>(resolve => child.once('stdout', () => resolve()))
    const killed = mock(() => {}); child.on('killed', killed)
    await ready
    expect(() => manager.remove(child.id)).toThrow('Cannot remove running process')
    expect(await manager.killProcess({ tag: 'worker' })).toMatchObject({ id: child.id, status: 'killed', signal: 'SIGTERM' })
    child.kill(); expect(killed).toHaveBeenCalledTimes(1)
    expect(await child.await()).toBe(-1)
    expect(await manager.killProcess({ id: child.id })).toHaveProperty('message', 'Process already finished.')
    expect(manager.remove(child.id)).toBe(true); expect(manager.get(child.id)).toBeUndefined()
  })
  it('lists durations, recent output and selected stderr by tag', async () => {
    const child = spawn('console.log("one"); console.log("two"); console.error("problem")', { tag: 'listed' })
    await child.await()
    const list = await manager.listProcesses()
    expect(list.processes[0]).toMatchObject({ id: child.id, tag: 'listed', status: 'exited', outputLines: 2, errorLines: 1, recentOutput: ['one', 'two'] })
    expect(list.processes[0]!.uptimeMs).toBeGreaterThanOrEqual(0)
    expect(await manager.getProcessOutput({ tag: 'listed', stream: 'stderr' })).toMatchObject({ id: child.id, stream: 'stderr', head: ['problem'] })
  })
  it('runs shell syntax and returns command failure as data', async () => {
    expect(await manager.runCommand({ command: 'printf hello' })).toEqual({ stdout: 'hello', stderr: '', exitCode: 0, success: true })
    expect(await manager.runCommand({ command: 'printf failure >&2; exit 4' })).toEqual({ stdout: '', stderr: 'failure', exitCode: 4, success: false })
  })
  it('exposes spawnProcess as an immediately tracked job', async () => {
    const started = await manager.spawnProcess({ command: process.execPath, args: '--version', tag: 'version' })
    expect(started).toMatchObject({ tag: 'version', status: 'running' })
    const child = manager.get(started.id)!
    expect(await child.await()).toBe(0)
    expect(child.stdout.toString()).toMatch(/^\d+\.\d+/)
    expect(manager.state.get('totalSpawned')).toBe(1)
  })
  it('removes automatic cleanup listeners when stopped', async () => {
    const before = ['exit', 'SIGINT', 'SIGTERM'].map(event => process.listenerCount(event))
    const automatic = c.feature('processManager', { autoCleanup: true })
    try {
      const child = automatic.spawn(process.execPath, ['--version'])
      expect(['exit', 'SIGINT', 'SIGTERM'].map(event => process.listenerCount(event))).toEqual(before.map(n => n + 1))
      await child.await()
    } finally { await automatic.stop() }
    expect(['exit', 'SIGINT', 'SIGTERM'].map(event => process.listenerCount(event))).toEqual(before)
  })
})
