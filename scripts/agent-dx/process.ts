import container from '../../src/node'

/** Bound the whole process group, including children retaining stdout pipes. POSIX only. */
export async function runProcess(argv: string[], cwd: string, timeoutMs: number) {
  if (!argv.length || !argv.every(v => typeof v === 'string') || timeoutMs <= 0 || !Number.isFinite(timeoutMs)) {
    throw new Error('Expected a nonempty argv array and a positive finite timeout')
  }
  if (process.platform === 'win32') throw new Error('Agent DX process cleanup requires POSIX process groups')
  let pid: number | undefined
  let timedOut = false
  const start = Date.now()
  const kill = () => { if (pid) container.proc.kill(-pid, 'SIGKILL') }
  const abort = () => { kill() }
  process.once('SIGINT', abort)
  process.once('SIGTERM', abort)
  const timer = setTimeout(() => { timedOut = true; kill() }, timeoutMs)
  try {
    const result = await container.proc.spawnAndCapture(argv[0]!, argv.slice(1), {
      cwd, detached: true,
      onStart: child => { pid = child.pid; if (timedOut) kill() },
    })
    return {
      exitCode: result.exitCode, stdout: result.stdout, stderr: result.stderr,
      error: result.error ? String(result.error.message || result.error) : null,
      timedOut, durationMs: Date.now() - start,
    }
  } finally {
    clearTimeout(timer)
    kill()
    process.removeListener('SIGINT', abort)
    process.removeListener('SIGTERM', abort)
  }
}
