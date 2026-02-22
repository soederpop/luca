/**
 * Assistant + MCP Servers — Ink Terminal UI
 *
 * A terminal UI that auto-manages two MCP servers and provides a streaming
 * chat interface to the Luca Expert assistant.
 *
 * MCP servers are auto-spawned if not already running:
 *   - sandbox-mcp :3002 — container introspection and code evaluation
 *   - content-mcp :3003 — contentbase document management (./docs)
 *
 * Usage:
 *   bun run scripts/examples/using-assistant-with-mcp.ts
 */
import container from '@soederpop/luca/agi'

// ─── Types ───────────────────────────────────────────────────────────────────

type ServerInfo = {
  tag: string
  label: string
  port: number
  status: 'checking' | 'spawning' | 'running' | 'external' | 'error' | 'exited'
  spawned: boolean
  publicUrl?: string
}

type ChatMessage = {
  role: 'user' | 'assistant'
  text: string
  rendered?: string // pre-rendered ANSI markdown (assistant only)
}

type ToolEntry = {
  name: string
  args: string
  done: boolean
}

// ─── MCP Server Definitions ─────────────────────────────────────────────────

const MCP_SERVERS = [
  { tag: 'sandbox-mcp', label: 'Sandbox', command: 'sandbox-mcp', port: 3002 },
  { tag: 'content-mcp', label: 'Content', command: 'content-mcp', port: 3003 },
]

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const networking = container.feature('networking')
  const ui = container.feature('ui')
  const pm = container.feature('processManager', { enable: true })
  const ink = container.feature('ink', { enable: true, patchConsole: true })

  // ── Phase 1: Check & Spawn MCP Servers ──────────────────────────────────

  const serverMap: Record<string, ServerInfo> = {}

  for (const def of MCP_SERVERS) {
    serverMap[def.tag] = {
      tag: def.tag,
      label: def.label,
      port: def.port,
      status: 'checking',
      spawned: false,
    }
  }

  for (const def of MCP_SERVERS) {
    const entry = serverMap[def.tag]!
    const portOpen = await networking.isPortOpen(def.port)

    if (!portOpen) {
      // Port occupied — server already running
      entry.status = 'external'
      entry.spawned = false
    } else {
      // Port available — spawn it
      entry.status = 'spawning'
      entry.spawned = true

      const handler = pm.spawn('luca', [def.command, '--transport', 'http', '--port', String(def.port)], {
        tag: def.tag,
        cwd: process.cwd(),
      })

      handler.on('stdout', (data: string) => {
        if (data.includes('listening') || data.includes('MCP')) {
          entry.status = 'running'
        }
      })

      handler.on('stderr', (data: string) => {
        if (data.includes('listening') || data.includes('MCP')) {
          entry.status = 'running'
        }
      })

      handler.on('crash', () => {
        entry.status = 'error'
      })

      handler.on('exit', () => {
        entry.status = 'exited'
      })
    }
  }

  // Wait for spawned servers to become ready
  const spawned = MCP_SERVERS.filter((d) => serverMap[d.tag]!.spawned)

  if (spawned.length > 0) {
    const timeout = 8000
    const start = Date.now()

    for (const def of spawned) {
      const entry = serverMap[def.tag]!
      while (Date.now() - start < timeout) {
        const stillOpen = await networking.isPortOpen(def.port)
        if (!stillOpen) {
          entry.status = 'running'
          break
        }
        await new Promise((r) => setTimeout(r, 300))
      }

      if (entry.status === 'spawning') {
        entry.status = 'error'
      }
    }
  }

  // ── Phase 1b: Expose MCP Servers via ngrok ─────────────────────────────

  const publicUrls: Record<string, string> = {}
  const exposers: Array<{ close(): Promise<void> }> = []

  for (const def of MCP_SERVERS) {
    const entry = serverMap[def.tag]!
    if (entry.status === 'running' || entry.status === 'external') {
      const exposer = container.feature('portExposer', { port: def.port, enable: true })
      const url = await exposer.expose()
      publicUrls[def.tag] = `${url}/mcp`
      entry.publicUrl = url
      exposers.push(exposer)
    }
  }

  // ── Phase 2: Setup Assistant ────────────────────────────────────────────

  const assistant = container.feature('assistant', {
    folder: 'assistants/luca-expert',
    model: 'gpt-4.1',
    appendPrompt: [
      'You have access to two MCP tool servers:',
      '1. **luca-sandbox** — evaluate JavaScript in a live Luca container, inspect registries, describe features/clients/servers.',
      '2. **luca-content** — query, search, and read structured markdown documents from the project docs/ folder.',
      'Use these tools proactively to answer questions with real data rather than guessing.',
    ].join('\n'),
  })

  await assistant.start()

  assistant.conversation!.options.mcpServers = Object.fromEntries(
    MCP_SERVERS
      .filter((s) => publicUrls[s.tag])
      .map((s) => [
        s.tag,
        { url: publicUrls[s.tag], requireApproval: 'never' },
      ]),
  )

  // ── Phase 3: Load Ink & Render ──────────────────────────────────────────

  await ink.loadModules()

  const React = ink.React
  const h = React.createElement
  const { useState, useEffect, useRef, useCallback, memo } = React
  const { Box, Text } = ink.components
  const { useInput, useApp, useStdout, useStdin } = ink.hooks

  const PREVIEW_THROTTLE_MS = 150

  // ── ASCII Art ───────────────────────────────────────────────────────────

  const BANNER = `
    __    __  ________  ___  ___
   |  |  |  ||   ____||   \\/   |
   |  |  |  ||  |     |        |
   |  |__|  ||  |____ |  |\\/|  |
   |_______/ |_______||__|  |__|
   assistant + mcp servers
  `.trimEnd()

  // ── Components ──────────────────────────────────────────────────────────

  function BannerSection() {
    const lines = BANNER.split('\n')
    const colors = ['#61dafb', '#38bdf8', '#818cf8', '#a78bfa', '#c084fc', '#e879f9']

    return h(
      Box,
      { flexDirection: 'column', paddingX: 2, marginBottom: 0 },
      ...lines.map((line, i) =>
        h(Text, { key: `b-${i}`, color: colors[i % colors.length] }, line),
      ),
    )
  }
  const MemoBannerSection = memo(BannerSection)

  function ServerTile({ info }: { info: ServerInfo }) {
    const dotColor =
      info.status === 'running' || info.status === 'external'
        ? '#22c55e'
        : info.status === 'spawning' || info.status === 'checking'
          ? '#eab308'
          : '#ef4444'

    const statusText =
      info.status === 'running'
        ? 'LIVE'
        : info.status === 'external'
          ? 'LIVE (ext)'
          : info.status === 'spawning'
            ? 'STARTING'
            : info.status === 'checking'
              ? 'CHECKING'
              : info.status === 'error'
                ? 'ERROR'
                : 'STOPPED'

    return h(
      Box,
      {
        borderStyle: 'round',
        borderColor: dotColor,
        paddingX: 1,
        flexGrow: 1,
      },
      h(Text, { color: dotColor, bold: true }, '\u25CF '),
      h(Text, { bold: true }, `${info.label} `),
      h(Text, { dimColor: true }, `:${info.port} `),
      h(Text, { color: dotColor }, statusText),
      info.spawned
        ? h(Text, { dimColor: true }, ' (auto)')
        : null,
      info.publicUrl
        ? h(Text, { dimColor: true }, ` ${info.publicUrl.replace('https://', '')}`)
        : null,
    )
  }
  const MemoServerTile = memo(ServerTile)

  function ServerStatusBar({ servers }: { servers: Record<string, ServerInfo> }) {
    return h(
      Box,
      { flexDirection: 'row', gap: 1, paddingX: 1, marginBottom: 0 },
      ...Object.values(servers).map((s) =>
        h(MemoServerTile, { key: s.tag, info: s }),
      ),
    )
  }
  const MemoServerStatusBar = memo(ServerStatusBar)

  function ChatArea({
    messages,
    preview,
    streaming,
    tools,
    maxLines,
  }: {
    messages: ChatMessage[]
    preview: string
    streaming: boolean
    tools: ToolEntry[]
    maxLines: number
  }) {
    const allLines: Array<{ key: string; text: string; color?: string; dim?: boolean }> = []

    // Render finalized messages (use pre-rendered markdown from cache)
    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i]!
      if (msg.role === 'user') {
        allLines.push({ key: `u-${i}`, text: `  > ${msg.text}`, color: '#818cf8' })
        allLines.push({ key: `u-${i}-sp`, text: '' })
      } else {
        const mdLines = (msg.rendered || msg.text).split('\n')
        for (let j = 0; j < mdLines.length; j++) {
          allLines.push({ key: `a-${i}-${j}`, text: `  ${mdLines[j]}` })
        }
        allLines.push({ key: `a-${i}-sp`, text: '' })
      }
    }

    // Render active tool calls
    for (let i = 0; i < tools.length; i++) {
      const t = tools[i]!
      const icon = t.done ? '\u2713' : '\u21BB'
      allLines.push({
        key: `t-${i}`,
        text: `    ${icon} ${t.name}(${t.args})`,
        dim: true,
      })
    }

    // Render streaming preview (raw text, no markdown parsing — too expensive per frame)
    if (streaming && preview) {
      const rawLines = preview.split('\n')
      for (let j = 0; j < rawLines.length; j++) {
        allLines.push({ key: `p-${j}`, text: `  ${rawLines[j]}` })
      }
    }

    // Show only tail that fits
    const visible = allLines.slice(-maxLines)

    return h(
      Box,
      {
        flexDirection: 'column',
        borderStyle: 'single',
        borderColor: '#3b82f6',
        paddingX: 1,
        flexGrow: 1,
        minHeight: Math.max(8, maxLines),
      },
      visible.length === 0
        ? h(Text, { dimColor: true }, '  Ask a question to get started...')
        : visible.map((line) =>
            h(
              Text,
              {
                key: line.key,
                wrap: 'truncate',
                ...(line.color ? { color: line.color } : {}),
                ...(line.dim ? { dimColor: true } : {}),
              },
              line.text,
            ),
          ),
    )
  }
  const MemoChatArea = memo(ChatArea)

  function InputLine({
    onSubmit,
    enabled,
  }: {
    onSubmit: (v: string) => void
    enabled: boolean
  }) {
    const [value, setValue] = useState('')

    useInput(
      (input, key) => {
        if (!enabled) return

        if (key.return) {
          if (value.trim()) {
            onSubmit(value.trim())
            setValue('')
          }
          return
        }

        if (key.backspace || key.delete) {
          setValue((prev) => prev.slice(0, -1))
          return
        }

        // Ignore control sequences
        if (key.ctrl || key.meta || key.escape) return

        // Accumulate printable characters
        if (input) {
          setValue((prev) => prev + input)
        }
      },
      { isActive: true },
    )

    const cursor = enabled ? '\u2588' : ''
    const prompt = enabled ? 'assistant > ' : 'thinking..  '

    return h(
      Box,
      { paddingX: 2, marginTop: 0 },
      h(Text, { color: enabled ? '#818cf8' : '#6b7280' }, prompt),
      h(Text, null, value),
      h(Text, { color: '#61dafb' }, cursor),
    )
  }

  function HelpBar() {
    return h(
      Box,
      { paddingX: 2, marginTop: 0 },
      h(Text, { dimColor: true }, 'enter: send  |  ctrl+c: quit'),
    )
  }
  const MemoHelpBar = memo(HelpBar)

  // ── App ─────────────────────────────────────────────────────────────────

  function App() {
    const { exit } = useApp()
    const { stdout } = useStdout()
    const { isRawModeSupported } = useStdin()

    const [servers, setServers] = useState<Record<string, ServerInfo>>({ ...serverMap })
    const [messages, setMessages] = useState<ChatMessage[]>([])
    const [preview, setPreview] = useState('')
    const [streaming, setStreaming] = useState(false)
    const [tools, setTools] = useState<ToolEntry[]>([])
    const [inputEnabled, setInputEnabled] = useState(true)

    const assistantRef = useRef(assistant)
    const previewBufferRef = useRef('')
    const previewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    // Periodically sync server statuses from the mutable serverMap
    useEffect(() => {
      const interval = setInterval(() => {
        setServers({ ...serverMap })
      }, 2000)
      return () => clearInterval(interval)
    }, [])

    // Wire assistant events
    useEffect(() => {
      const a = assistantRef.current

      // Throttled preview: buffer text in a ref, flush to state on a timer
      const flushPreview = () => {
        setPreview(previewBufferRef.current)
        previewTimerRef.current = null
      }

      const onPreview = (text: string) => {
        previewBufferRef.current = text
        if (!previewTimerRef.current) {
          previewTimerRef.current = setTimeout(flushPreview, PREVIEW_THROTTLE_MS)
        }
      }

      const onResponse = (text: string) => {
        // Clear any pending throttle and flush final
        if (previewTimerRef.current) {
          clearTimeout(previewTimerRef.current)
          previewTimerRef.current = null
        }
        previewBufferRef.current = ''

        const rendered = String(ui.markdown(text))
        setMessages((prev) => [...prev, { role: 'assistant', text, rendered }])
        setPreview('')
        setTools([])
        setStreaming(false)
        setInputEnabled(true)
      }

      const onToolCall = (name: string, args: any) => {
        const argsStr = JSON.stringify(args).slice(0, 80)
        setTools((prev) => [...prev, { name, args: argsStr, done: false }])
      }

      const onMcpEvent = (event: any) => {
        if (
          event.type === 'response.mcp_call.completed' ||
          (event.type === 'response.output_item.done' && event.item?.type?.startsWith?.('mcp_'))
        ) {
          setTools((prev) => {
            const next = [...prev]
            const last = next.findLast((t) => !t.done)
            if (last) last.done = true
            return next
          })
        }
      }

      a.on('preview', onPreview)
      a.on('response', onResponse)
      a.on('toolCall', onToolCall)
      a.on('mcpEvent', onMcpEvent)

      return () => {
        if (previewTimerRef.current) clearTimeout(previewTimerRef.current)
        a.off('preview', onPreview)
        a.off('response', onResponse)
        a.off('toolCall', onToolCall)
        a.off('mcpEvent', onMcpEvent)
      }
    }, [])

    // Quit handler (only when not typing or input is empty)
    useInput(
      (input, key) => {
        if (key.ctrl && input === 'c') {
          for (const e of exposers) e.close().catch(() => {})
          pm.killAll()
          exit()
        }
      },
      { isActive: !!isRawModeSupported },
    )

    const handleSubmit = useCallback((question: string) => {
      setMessages((prev) => [...prev, { role: 'user', text: question }])
      setStreaming(true)
      setInputEnabled(false)
      setTools([])
      setPreview('')

      assistantRef.current.ask(question).catch((err: any) => {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', text: `**Error:** ${err.message || String(err)}` },
        ])
        setStreaming(false)
        setInputEnabled(true)
      })
    }, [])

    const rows = stdout.rows || 30
    const bannerHeight = BANNER.split('\n').length + 1
    const statusHeight = 3
    const inputHeight = 2
    const helpHeight = 1
    const chatMaxLines = Math.max(6, rows - bannerHeight - statusHeight - inputHeight - helpHeight - 4)

    return h(
      Box,
      { flexDirection: 'column', width: stdout.columns || 80 },
      h(MemoBannerSection),
      h(MemoServerStatusBar, { servers }),
      h(MemoChatArea, {
        messages,
        preview,
        streaming,
        tools,
        maxLines: chatMaxLines,
      }),
      h(InputLine, {
        onSubmit: handleSubmit,
        enabled: inputEnabled,
      }),
      h(MemoHelpBar),
    )
  }

  // ── Mount ───────────────────────────────────────────────────────────────

  await ink.render(h(App))
  await ink.waitUntilExit()

  for (const e of exposers) await e.close().catch(() => {})
  pm.killAll()
}

await main()
