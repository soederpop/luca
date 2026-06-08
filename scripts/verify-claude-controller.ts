#!/usr/bin/env bun
import { AGIContainer } from '../src/agi/container.server'

type RunResult = {
  exitCode: number
  stdout: string
  stderr: string
}

type Args = {
  sessions: number
  timeoutMs: number
  pollMs: number
  keep: boolean
  autoApprove: boolean
  preflightOnly: boolean
  claudeArgs: string[]
}

const PASS_PREFIX = 'LUCA_CLAUDE_CONTROLLER_OK'

function parseArgs(): Args {
  const args = process.argv.slice(2)
  const parsed: Args = {
    sessions: Number(process.env.CLAUDE_VERIFY_SESSIONS ?? 1),
    timeoutMs: Number(process.env.CLAUDE_VERIFY_TIMEOUT_MS ?? 180_000),
    pollMs: Number(process.env.CLAUDE_VERIFY_POLL_MS ?? 2_000),
    keep: process.env.CLAUDE_VERIFY_KEEP === '1',
    autoApprove: process.env.CLAUDE_VERIFY_AUTO_APPROVE === '1',
    preflightOnly: false,
    claudeArgs: process.env.CLAUDE_VERIFY_ARGS ? JSON.parse(process.env.CLAUDE_VERIFY_ARGS) : [],
  }

  for (const arg of args) {
    if (arg === '--help' || arg === '-h') {
      printHelp()
      process.exit(0)
    }
    if (arg === '--keep') parsed.keep = true
    else if (arg === '--auto-approve') parsed.autoApprove = true
    else if (arg === '--preflight-only') parsed.preflightOnly = true
    else if (arg.startsWith('--sessions=')) parsed.sessions = Number(arg.slice('--sessions='.length))
    else if (arg.startsWith('--timeout-ms=')) parsed.timeoutMs = Number(arg.slice('--timeout-ms='.length))
    else if (arg.startsWith('--poll-ms=')) parsed.pollMs = Number(arg.slice('--poll-ms='.length))
    else if (arg.startsWith('--claude-arg=')) parsed.claudeArgs.push(arg.slice('--claude-arg='.length))
    else throw new Error(`Unknown argument: ${arg}`)
  }

  if (!Number.isFinite(parsed.sessions) || parsed.sessions < 1) throw new Error('--sessions must be >= 1')
  if (!Number.isFinite(parsed.timeoutMs) || parsed.timeoutMs < 10_000) throw new Error('--timeout-ms must be >= 10000')
  if (!Number.isFinite(parsed.pollMs) || parsed.pollMs < 250) throw new Error('--poll-ms must be >= 250')

  parsed.sessions = Math.floor(parsed.sessions)
  return parsed
}

function printHelp() {
  console.log(`verify-claude-controller.ts

Runs a real tmux + interactive Claude Code smoke test for Luca's ClaudeController and ClaudeSessionController.
It does not use claude -p.

Usage:
  bun scripts/verify-claude-controller.ts

Useful options:
  --sessions=2                         Start N Claude workers; default 1
  --auto-approve                       Auto-select a visible yes/proceed choice if Claude shows one
  --keep                               Keep tmux sessions and temp dirs after the run
  --timeout-ms=180000                  Overall per-worker response timeout
  --poll-ms=2000                       Poll interval
  --preflight-only                     Only check claude/tmux availability
  --claude-arg=--permission-mode       Add one raw arg passed to claude; repeatable
  --claude-arg=acceptEdits

Equivalent env vars:
  CLAUDE_VERIFY_SESSIONS=2
  CLAUDE_VERIFY_AUTO_APPROVE=1
  CLAUDE_VERIFY_KEEP=1
  CLAUDE_VERIFY_ARGS='["--permission-mode","acceptEdits"]'

Examples:
  bun scripts/verify-claude-controller.ts --auto-approve
  bun scripts/verify-claude-controller.ts --sessions=2 --auto-approve --claude-arg=--permission-mode --claude-arg=acceptEdits
`)
}

async function run(command: string[], options: { cwd?: string } = {}): Promise<RunResult> {
  const proc = Bun.spawn(command, { cwd: options.cwd, stdout: 'pipe', stderr: 'pipe' })
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  return { exitCode, stdout, stderr }
}

async function requireCommand(name: string, versionArgs: string[] = ['--version']): Promise<void> {
  const found = await run(['bash', '-lc', `command -v ${name}`])
  if (found.exitCode !== 0) throw new Error(`${name} was not found in PATH`)
  const version = await run([name, ...versionArgs])
  const summary = (version.stdout || version.stderr).trim().split('\n')[0] ?? ''
  console.log(`ok: ${name} -> ${found.stdout.trim()}${summary ? ` (${summary})` : ''}`)
}

async function makeTempDir(): Promise<string> {
  const result = await run(['mktemp', '-d', '/tmp/luca-claude-controller-XXXXXX'])
  if (result.exitCode !== 0) throw new Error(`mktemp failed: ${result.stderr || result.stdout}`)
  return result.stdout.trim()
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function snapshotSummary(snapshot: any): string {
  const tail = String(snapshot.pane ?? '').split('\n').slice(-16).join('\n').trim()
  return JSON.stringify({
    id: snapshot.id,
    tmuxSession: snapshot.tmuxSession,
    cwd: snapshot.cwd,
    currentCommand: snapshot.currentCommand,
    awaitingInput: snapshot.awaitingInput,
    choices: snapshot.choices?.map((c: any) => ({ key: c.key, index: c.index, label: c.label, selected: c.selected })) ?? [],
    sessionId: snapshot.sessionId,
    sessionFile: snapshot.sessionFile,
    historyMessages: snapshot.history?.length ?? 0,
    paneTail: tail,
  }, null, 2)
}

function historyText(snapshot: any): string {
  return JSON.stringify(snapshot.history ?? [])
}

function findSafeApprovalChoice(snapshot: any): any | undefined {
  const choices = snapshot.choices ?? []
  return choices.find((choice: any) => {
    const label = String(choice.label ?? '').toLowerCase()
    if (/don't ask|do not ask|always/i.test(label)) return false
    return /^(yes|y)\b/.test(label) || /proceed|continue|allow|accept|approve/.test(label)
  })
}

async function clearInitialPrompt(worker: any, snapshot: any, autoApprove: boolean): Promise<any> {
  let current = snapshot
  for (let i = 0; i < 5; i++) {
    if (!current.choices?.length) return current

    const choice = findSafeApprovalChoice(current)
    if (!autoApprove || !choice) {
      throw new Error([
        `Claude is showing a selectable prompt in ${current.tmuxSession}.`,
        `Choices: ${current.choices.map((c: any) => `${c.key ?? c.index ?? '?'}=${c.label}`).join(', ')}`,
        `Attach and answer manually: tmux attach -t ${current.tmuxSession}`,
        `Or rerun with --auto-approve to select the first safe yes/proceed choice.`,
        `Snapshot:\n${snapshotSummary(current)}`,
      ].join('\n'))
    }

    console.log(`auto-approve: ${current.id} selecting ${choice.key ?? choice.index ?? choice.label}: ${choice.label}`)
    current = await worker.chooseOption(choice)
    await sleep(1_500)
    current = await worker.refresh()
  }

  return current
}

async function waitForSentinel(worker: any, sentinel: string, timeoutMs: number, pollMs: number): Promise<any> {
  const started = Date.now()
  let last = await worker.refresh()

  while (Date.now() - started < timeoutMs) {
    const pane = String(last.pane ?? '')
    const history = historyText(last)
    if (pane.includes(sentinel) || history.includes(sentinel)) return last

    await sleep(pollMs)
    last = await worker.refresh()
  }

  throw new Error(`Timed out waiting for ${sentinel}. Last snapshot:\n${snapshotSummary(last)}`)
}

async function main() {
  const args = parseArgs()

  console.log('preflight')
  await requireCommand('claude', ['--version'])
  await requireCommand('tmux', ['-V'])

  if (args.preflightOnly) return

  const container = new AGIContainer()
  const controller = container.feature('claudeController', {
    sessionPrefix: `luca-verify-${Date.now()}`,
    width: 220,
    height: 60,
    settleMs: 500,
  })

  const tempDirs: string[] = []
  const workers: any[] = []

  try {
    for (let i = 0; i < args.sessions; i++) {
      const cwd = await makeTempDir()
      tempDirs.push(cwd)
      await Bun.write(`${cwd}/README.md`, `Temporary ClaudeController verification cwd ${i + 1}.\nDo not keep this directory.\n`)
    }

    console.log(`starting ${args.sessions} interactive Claude session(s) through tmux`)
    await controller.startMany(tempDirs.map((cwd, i) => ({
      id: `verify-${i + 1}`,
      cwd,
      args: args.claudeArgs,
      reuse: false,
    })))

    for (let i = 0; i < args.sessions; i++) {
      const id = `verify-${i + 1}`
      const worker = controller.session(id)
      if (!worker) throw new Error(`Controller did not retain worker ${id}`)
      workers.push(worker)

      let snapshot = await worker.waitUntilReady({ timeoutMs: args.timeoutMs, pollIntervalMs: args.pollMs })
      console.log(`ready-ish: ${id}`)
      console.log(snapshotSummary(snapshot))

      snapshot = await clearInitialPrompt(worker, snapshot, args.autoApprove)

      const sentinel = `${PASS_PREFIX}_${i + 1}_${Date.now()}`
      const prompt = `Reply with exactly this token and nothing else: ${sentinel}. Do not inspect, create, edit, or delete files.`
      console.log(`asking ${id}: ${sentinel}`)
      await worker.ask(prompt, { wait: false })

      snapshot = await waitForSentinel(worker, sentinel, args.timeoutMs, args.pollMs)
      console.log(`ok: ${id} produced sentinel`)
      console.log(snapshotSummary(snapshot))
    }

    const controllerSnapshots = await controller.refreshAll()
    if (controllerSnapshots.length !== args.sessions) {
      throw new Error(`Expected ${args.sessions} tracked snapshots, got ${controllerSnapshots.length}`)
    }

    const tmuxNames = new Set(controllerSnapshots.map((s: any) => s.tmuxSession))
    if (tmuxNames.size !== args.sessions) {
      throw new Error(`Expected ${args.sessions} unique tmux sessions, got ${tmuxNames.size}`)
    }

    console.log('PASS: ClaudeController spawned/tracked sessions, ClaudeSessionController sent input, snapshots refreshed, and Claude answered through tmux.')
  } finally {
    if (args.keep) {
      console.log('keeping resources because --keep/CLAUDE_VERIFY_KEEP=1 was set')
      for (const worker of workers) console.log(`tmux attach -t ${worker.tmuxSession}`)
      for (const dir of tempDirs) console.log(`temp cwd: ${dir}`)
    } else {
      await controller.stopAll().catch(error => console.error(`cleanup warning: stopAll failed: ${error.message}`))
      for (const dir of tempDirs) {
        await run(['rm', '-rf', dir]).catch(error => console.error(`cleanup warning: rm failed for ${dir}: ${error.message}`))
      }
    }
  }
}

main().catch(error => {
  console.error('FAIL: ClaudeController verification failed')
  console.error(error instanceof Error ? error.stack : error)
  process.exit(1)
})
