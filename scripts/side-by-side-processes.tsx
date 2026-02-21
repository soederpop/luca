/**
 * Side-by-side process output streaming with Ink + UI
 *
 * Spawns two processes and renders their stdout/stderr side by side
 * in the terminal using Ink's React-based TUI and the UI feature
 * for automatic color assignment.
 *
 * Usage:
 *   bun run scripts/side-by-side-processes.tsx
 *   bun run scripts/side-by-side-processes.tsx -- "ping localhost" "curl -s http://example.com"
 */
import React from 'react'
import container from '@/node'

const ink = container.feature('ink', { enable: true })
const proc = container.feature('proc')
const ui = container.feature('ui')

await ink.loadModules()

const { Box, Text, Newline } = ink.components
const { useState, useEffect, useRef } = React
const { useInput, useApp } = ink.hooks

// ─── Configuration ──────────────────────────────────────────────────────────

const MAX_LINES = 30 // max lines to keep per pane

// Default commands if none provided via argv
const args = process.argv.slice(2)
const dashDash = args.indexOf('--')
const cmdArgs = dashDash >= 0 ? args.slice(dashDash + 1) : []

const leftCmd = cmdArgs[0] || 'ping -c 10 localhost'
const rightCmd = cmdArgs[1] || 'ls -la && sleep 1 && echo "---" && df -h && sleep 1 && echo "done"'

// ─── Process Panel Component ────────────────────────────────────────────────

interface PanelProps {
  title: string
  command: string
  color: string
  onDone: () => void
}

function ProcessPanel({ title, command, color, onDone }: PanelProps) {
  const [lines, setLines] = useState<string[]>([])
  const [status, setStatus] = useState<'running' | 'done' | 'error'>('running')
  const [exitCode, setExitCode] = useState<number | null>(null)
  const doneRef = useRef(false)

  useEffect(() => {
    const parts = command.split(' ')
    const cmd = parts[0]
    const cmdArgs = parts.slice(1)

    const pushLine = (raw: string, isError = false) => {
      const newLines = raw.split('\n').filter((l) => l.length > 0)
      setLines((prev) => {
        const next = [...prev, ...newLines.map((l) => (isError ? `[err] ${l}` : l))]
        return next.slice(-MAX_LINES)
      })
    }

    // Use shell mode so piped/chained commands work
    proc
      .spawnAndCapture('sh', ['-c', command], {
        onOutput: (data) => pushLine(data),
        onError: (data) => pushLine(data, true),
        onExit: (code) => {
          setExitCode(code)
          setStatus(code === 0 ? 'done' : 'error')
          if (!doneRef.current) {
            doneRef.current = true
            onDone()
          }
        },
      })
      .catch(() => {
        setStatus('error')
        if (!doneRef.current) {
          doneRef.current = true
          onDone()
        }
      })
  }, [])

  const statusColor = status === 'running' ? 'yellow' : status === 'done' ? 'green' : 'red'
  const statusLabel =
    status === 'running'
      ? ' running '
      : status === 'done'
        ? ` exit ${exitCode} `
        : ` error ${exitCode} `

  return (
    <Box flexDirection="column" flexGrow={1} flexBasis="50%" paddingRight={1}>
      {/* Header */}
      <Box>
        <Text bold color={color}>
          {title}
        </Text>
        <Text> </Text>
        <Text backgroundColor={statusColor} color="black">
          {statusLabel}
        </Text>
      </Box>

      {/* Command */}
      <Text dimColor>$ {command}</Text>

      {/* Separator */}
      <Text dimColor>{'─'.repeat(40)}</Text>

      {/* Output lines */}
      <Box flexDirection="column" flexGrow={1}>
        {lines.map((line, i) => (
          <Text key={i} wrap="truncate">
            {line.startsWith('[err]') ? (
              <Text color="red">{line}</Text>
            ) : (
              <Text>{line}</Text>
            )}
          </Text>
        ))}
      </Box>
    </Box>
  )
}

// ─── App Component ──────────────────────────────────────────────────────────

function App() {
  const { exit } = useApp()
  const [doneCount, setDoneCount] = useState(0)
  const leftColor = ui.assignColor('left-process')
  const rightColor = ui.assignColor('right-process')

  // Extract the hex color from the chalk function (for Ink's color prop)
  // We'll just use named colors since ui.assignColor returns chalk functions
  const leftHex = ui.colorPalette[0]
  const rightHex = ui.colorPalette[1]

  useInput((input, key) => {
    if (input === 'q' || (key.ctrl && input === 'c')) {
      exit()
    }
  })

  useEffect(() => {
    if (doneCount >= 2) {
      // Both processes finished — auto-exit after a short delay
      const timer = setTimeout(() => exit(), 1500)
      return () => clearTimeout(timer)
    }
  }, [doneCount])

  const handleDone = () => setDoneCount((c) => c + 1)

  return (
    <Box flexDirection="column" padding={1}>
      {/* Title bar */}
      <Box justifyContent="center">
        <Text bold inverse> Side-by-Side Process Viewer </Text>
      </Box>
      <Text> </Text>

      {/* Two panels side by side */}
      <Box flexDirection="row" flexGrow={1}>
        <ProcessPanel
          title="LEFT"
          command={leftCmd}
          color={leftHex}
          onDone={handleDone}
        />
        <Box flexShrink={0}>
          <Text dimColor>│</Text>
        </Box>
        <ProcessPanel
          title="RIGHT"
          command={rightCmd}
          color={rightHex}
          onDone={handleDone}
        />
      </Box>

      <Text> </Text>
      <Text dimColor>
        Press q to quit{doneCount >= 2 ? ' (auto-exiting...)' : ''}
      </Text>
    </Box>
  )
}

// ─── Mount ──────────────────────────────────────────────────────────────────

await ink.render(<App />)
await ink.waitUntilExit()
