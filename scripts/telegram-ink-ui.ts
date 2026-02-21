import { spawn, type ChildProcessByStdio } from 'node:child_process'
import type { Readable } from 'node:stream'
import path from 'node:path'
import { existsSync } from 'node:fs'
import container from '@/node'
import { resolveAnimation } from './animations'

type ProcessStatus = 'idle' | 'running' | 'exited' | 'error'

const MAX_OUTPUT_LINES = 220
const DEFAULT_ANIMATION = process.env.LUCA_BOT_ANIMATION || 'neonPulse'

function splitLines(input: string): string[] {
  return input.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
}

function pushChunk(target: string[], chunk: string, label?: string) {
  const lines = splitLines(chunk).filter((line) => line.length > 0)
  for (const line of lines) {
    target.push(label ? `[${label}] ${line}` : line)
  }
  if (target.length > MAX_OUTPUT_LINES) {
    target.splice(0, target.length - MAX_OUTPUT_LINES)
  }
}

function resolveTelegramScriptPath(): string | null {
  const fromEnv = process.env.LUCA_TELEGRAM_SCRIPT?.trim()
  const candidates = [
    fromEnv,
    'scripts/examples/telegram.ts',
    'scripts/examples/telegram-bot.ts',
    'scripts/telegram.ts',
    'scripts/telegram-bot.ts',
  ].filter(Boolean) as string[]

  for (const candidate of candidates) {
    const resolved = path.isAbsolute(candidate) ? candidate : path.resolve(process.cwd(), candidate)
    if (existsSync(resolved)) return resolved
  }

  return null
}

function createBotCommand(): { command: string; args: string[]; source: string } {
  const explicitCommand = process.env.LUCA_TELEGRAM_COMMAND?.trim()
  if (explicitCommand) {
    return {
      command: '/bin/sh',
      args: ['-lc', explicitCommand],
      source: explicitCommand,
    }
  }

  const scriptPath = resolveTelegramScriptPath()
  if (!scriptPath) {
    const helpLines = [
      'No telegram script found.',
      'Set LUCA_TELEGRAM_SCRIPT to your script path, e.g.:',
      '  LUCA_TELEGRAM_SCRIPT=scripts/my-telegram.ts',
      'Or set LUCA_TELEGRAM_COMMAND for a custom run command.',
    ]
    const helpCommand = `${helpLines.map((line) => `echo "${line.replace(/"/g, '\\"')}"`).join('; ')}; sleep 9999`

    return {
      command: '/bin/sh',
      args: ['-lc', helpCommand],
      source: 'waiting-for-config',
    }
  }

  return {
    command: 'bun',
    args: ['run', scriptPath],
    source: scriptPath,
  }
}

async function main() {
  const ink = container.feature('ink', { enable: true, patchConsole: true })
  await ink.loadModules()

  const React = ink.React
  const h = React.createElement
  const { useEffect, useMemo, useRef, useState } = React

  const { Box, Text } = ink.components
  const { useApp, useInput, useStdout } = ink.hooks

  const animation = resolveAnimation(DEFAULT_ANIMATION)
  const botProcess = createBotCommand()

  function useAnimationFrame(frames: string[], fps: number): string {
    const [index, setIndex] = useState(0)

    useEffect(() => {
      const safeFps = Math.max(1, fps)
      const interval = setInterval(() => {
        setIndex((prev: number) => (prev + 1) % frames.length)
      }, Math.floor(1000 / safeFps))
      return () => clearInterval(interval)
    }, [fps, frames.length])

    return frames[index] || ''
  }

  function frameLines(frame: string, maxWidth: number): string[] {
    return splitLines(frame).map((line) => (line.length > maxWidth ? line.slice(0, maxWidth - 1) + '.' : line))
  }

  function App() {
    const { stdout } = useStdout()
    const { exit } = useApp()

    const [status, setStatus] = useState<ProcessStatus>('idle')
    const [exitCode, setExitCode] = useState<number | null>(null)
    const [startedAt, setStartedAt] = useState<number | null>(null)
    const [outputLines, setOutputLines] = useState<string[]>([])

    const processRef = useRef<ChildProcessByStdio<null, Readable, Readable> | null>(null)
    const bufferRef = useRef({ stdout: '', stderr: '' })

    const cols = stdout.columns || 120
    const leftWidth = Math.max(38, Math.floor(cols * 0.42))
    const rightWidth = Math.max(42, cols - leftWidth - 5)

    const currentFrame = useAnimationFrame(animation.frames, animation.fps)

    const uptime = useMemo(() => {
      if (!startedAt || status === 'idle') return '00:00'
      const secs = Math.floor((Date.now() - startedAt) / 1000)
      const mm = Math.floor(secs / 60)
      const ss = secs % 60
      return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
    }, [startedAt, status, outputLines.length])

    useEffect(() => {
      const run = () => {
        setStatus('running')
        setStartedAt(Date.now())

        const child = spawn(botProcess.command, botProcess.args, {
          cwd: process.cwd(),
          env: process.env,
          stdio: ['ignore', 'pipe', 'pipe'],
        })

        processRef.current = child

        const flushOutput = (kind: 'stdout' | 'stderr', chunk: Buffer) => {
          const key = kind
          const prior = bufferRef.current[key]
          const merged = prior + chunk.toString('utf8')
          const lines = merged.split(/\r?\n/)
          bufferRef.current[key] = lines.pop() || ''

          if (lines.length) {
            setOutputLines((prev) => {
              const next = [...prev]
              for (const line of lines) {
                if (!line) continue
                next.push(kind === 'stderr' ? `[err] ${line}` : line)
              }
              return next.slice(-MAX_OUTPUT_LINES)
            })
          }
        }

        child.stdout.on('data', (buf) => flushOutput('stdout', buf))
        child.stderr.on('data', (buf) => flushOutput('stderr', buf))

        child.on('error', (err) => {
          setStatus('error')
          setOutputLines((prev) => [...prev.slice(-MAX_OUTPUT_LINES + 1), `[launcher-error] ${err.message}`])
        })

        child.on('close', (code) => {
          const lastOut = bufferRef.current.stdout
          const lastErr = bufferRef.current.stderr

          setOutputLines((prev) => {
            const next = [...prev]
            if (lastOut) pushChunk(next, lastOut)
            if (lastErr) pushChunk(next, lastErr, 'err')
            next.push(`[system] telegram process exited${typeof code === 'number' ? ` with code ${code}` : ''}`)
            return next.slice(-MAX_OUTPUT_LINES)
          })

          setExitCode(typeof code === 'number' ? code : null)
          setStatus(code === 0 ? 'exited' : 'error')
          processRef.current = null
          bufferRef.current = { stdout: '', stderr: '' }
        })

        setOutputLines((prev) => [...prev.slice(-MAX_OUTPUT_LINES + 1), `[system] spawned: ${botProcess.command} ${botProcess.args.join(' ')}`])
      }

      run()

      return () => {
        const proc = processRef.current
        if (proc && !proc.killed) {
          try {
            proc.kill('SIGTERM')
          } catch {
            // no-op: process already gone
          }
        }
      }
    }, [])

    useInput((input: string, key: any) => {
      if (input === 'q' || (key.ctrl && input === 'c')) {
        const proc = processRef.current
        if (proc && !proc.killed) {
          try {
            proc.kill('SIGTERM')
          } catch {
            // no-op
          }
        }
        exit()
      }
    })

    const statusColor = status === 'running' ? 'green' : status === 'exited' ? 'cyan' : status === 'error' ? 'red' : 'yellow'
    const statusLabel = status === 'running' ? 'LIVE' : status === 'exited' ? `EXIT ${exitCode ?? 0}` : status === 'error' ? `ERR ${exitCode ?? '?'}` : 'BOOT'

    const visibleOutputLines = outputLines.slice(-Math.max(14, (stdout.rows || 32) - 10))
    const artLines = frameLines(currentFrame, leftWidth - 4)

    return h(
      Box,
      { flexDirection: 'column', width: cols, paddingX: 1 },
      h(
        Box,
        { justifyContent: 'space-between', marginBottom: 1 },
        h(Text, { bold: true, color: '#61dafb' }, 'LUCA TELEGRAM // ART CONSOLE'),
        h(Text, { color: statusColor }, `[${statusLabel}] uptime ${uptime}`),
      ),
      h(
        Box,
        { flexDirection: 'row' },
        h(
          Box,
          {
            width: leftWidth,
            flexDirection: 'column',
            borderStyle: 'round',
            borderColor: '#e879f9',
            paddingX: 1,
            minHeight: Math.max(16, (stdout.rows || 30) - 6),
          },
          h(Text, { color: '#f472b6', bold: true }, `${animation.name}  (${animation.id})`),
          h(Text, { dimColor: true }, 'bot avatar loop // modular animation script'),
          h(Text, { dimColor: true }, '-'.repeat(Math.max(10, leftWidth - 4))),
          ...artLines.map((line, idx) => h(Text, { key: `frame-${idx}`, color: '#fbcfe8' }, line)),
        ),
        h(Box, { width: 1 }, h(Text, { dimColor: true }, '|')),
        h(
          Box,
          {
            width: rightWidth,
            flexDirection: 'column',
            borderStyle: 'round',
            borderColor: '#22d3ee',
            paddingX: 1,
            minHeight: Math.max(16, (stdout.rows || 30) - 6),
          },
          h(Text, { color: '#67e8f9', bold: true }, 'Telegram Bot Stream'),
          h(Text, { dimColor: true, wrap: 'truncate' }, `source: ${botProcess.source}`),
          h(Text, { dimColor: true }, '-'.repeat(Math.max(10, rightWidth - 4))),
          ...visibleOutputLines.map((line, idx) =>
            h(
              Text,
              {
                key: `line-${idx}`,
                wrap: 'truncate-middle',
                color: line.startsWith('[err]') || line.startsWith('[launcher-error]') ? '#f87171' : undefined,
              },
              line,
            ),
          ),
        ),
      ),
      h(Text, null, ''),
      h(Text, { dimColor: true }, 'q: quit  ctrl+c: quit  env: LUCA_TELEGRAM_SCRIPT | LUCA_TELEGRAM_COMMAND | LUCA_BOT_ANIMATION'),
    )
  }

  await ink.render(h(App))
  await ink.waitUntilExit()
}

await main()
