import { z } from 'zod'
import { commands, CommandOptionsSchema } from '@soederpop/luca'
import type { ContainerContext } from '@soederpop/luca'
import { AGIContainer } from '../src/agi/container.server.js'
import { tmpdir } from 'os'

export const argsSchema = CommandOptionsSchema.extend({
  model: z.string().optional().describe('OpenAI model to use'),
})

export async function inkbot(options: z.infer<typeof argsSchema>, context: ContainerContext) {
  const container = new AGIContainer()

  // ─── Load Ink ────────────────────────────────────────────────────────
  const ink = container.feature('ink', { enable: true, patchConsole: true })
  await ink.loadModules()
  const React = ink.React
  const h = React.createElement
  const { Box, Text } = ink.components
  const { useInput, useApp, useStdout } = ink.hooks
  const { useState, useEffect } = React

  // ─── Scene Runner ────────────────────────────────────────────────────
  // Scenes are code strings run as bun subprocesses.
  // The stage entity tracks which scenes exist and which is active.
  // Scene entities track individual code, output, error, status.

  const stage = container.entity('inkbot:stage')
  stage.setState({ activeSceneId: null, sceneIds: [] as string[], tick: 0 })

  const sceneMap: Record<string, ReturnType<typeof container.entity>> = {}

  function bumpStage() {
    stage.setState({ tick: ((stage.state.get('tick') as number) || 0) + 1 })
  }

  function getOrCreateScene(id: string, code: string) {
    if (sceneMap[id]) {
      sceneMap[id].setState({ code })
      return sceneMap[id]
    }
    const scene = container.entity(`inkbot:scene:${id}`)
    scene.setState({ code, output: '', error: '', status: 'idle', exitCode: null })
    sceneMap[id] = scene
    const ids = [...((stage.state.get('sceneIds') || []) as string[])]
    if (!ids.includes(id)) ids.push(id)
    stage.setState({ sceneIds: ids })
    if (!stage.state.get('activeSceneId')) stage.setState({ activeSceneId: id })
    return scene
  }

  const proc = container.feature('proc')
  const fs = container.feature('fs')
  const sceneTmpDir = `${tmpdir()}/inkbot-scenes`
  fs.ensureFolder(sceneTmpDir)

  async function runScene(id: string): Promise<{ output: string; error: string; exitCode: number }> {
    const scene = sceneMap[id]
    if (!scene) throw new Error(`Scene "${id}" not found`)

    const code = scene.state.get('code') as string
    scene.setState({ status: 'running', output: '', error: '' })
    bumpStage()

    // Write to tmpdir, shell out to `luca run` — gets full container context + process isolation
    const file = `${sceneTmpDir}/${id.replace(/[^a-zA-Z0-9-]/g, '_')}_${Date.now()}.ts`
    fs.writeFile(file, code)

    try {
      const result = await proc.spawnAndCapture('luca', ['run', file], {
        cwd: container.cwd,
        onOutput(data: string) {
          scene.setState({ output: ((scene.state.get('output') || '') as string) + data })
          bumpStage()
        },
        onError(data: string) {
          scene.setState({ error: ((scene.state.get('error') || '') as string) + data })
          bumpStage()
        },
      })

      const status = result.exitCode === 0 ? 'complete' : 'failed'
      scene.setState({ status, exitCode: result.exitCode })
      bumpStage()
      try { fs.unlink(file) } catch {}

      return {
        output: (scene.state.get('output') || '') as string,
        error: (scene.state.get('error') || '') as string,
        exitCode: result.exitCode ?? 1,
      }
    } catch (err: any) {
      scene.setState({ status: 'failed', error: err.message, exitCode: 1 })
      bumpStage()
      try { fs.unlink(file) } catch {}
      return { output: '', error: err.message, exitCode: 1 }
    }
  }

  // ─── Assistant ───────────────────────────────────────────────────────
  const mgr = container.feature('assistantsManager')
  await mgr.discover()
  const assistant = mgr.create('inkbot', { model: options.model })

  // Scene completion → inject result into conversation so the assistant sees it
  stage.on('sceneComplete' as any, (id: string, output: string) => {
    const msg = output.trim()
      ? `[Scene "${id}" completed]\n${output.trim()}`
      : `[Scene "${id}" completed with no output]`
    assistant.conversation?.pushMessage({ role: 'developer', content: msg })
  })

  stage.on('sceneFailed' as any, (id: string, error: string) => {
    const msg = `[Scene "${id}" failed]\n${error.trim()}`
    assistant.conversation?.pushMessage({ role: 'developer', content: msg })
    // Auto-ask the assistant to fix it
    assistant.ask(msg).catch(() => {})
  })

  // Canvas tools — registered directly so they close over stage/sceneMap
  assistant.addTool(
    'draw',
    async (args: { code: string; sceneId?: string }) => {
      const id = args.sceneId || 'default'
      getOrCreateScene(id, args.code)
      stage.setState({ activeSceneId: id })
      bumpStage()
      // Fire and forget — result feeds back via stage events
      runScene(id).then(result => {
        if (result.exitCode === 0) {
          stage.emit('sceneComplete' as any, id, result.output)
        } else {
          stage.emit('sceneFailed' as any, id, result.error)
        }
      })
      return { status: 'running', sceneId: id }
    },
    z.object({
      code: z.string().describe('TypeScript code to execute. Use console.log() for visible output.'),
      sceneId: z.string().optional().describe('Scene id (defaults to "default").'),
    }).describe('Draw or redraw the canvas. Returns immediately — output streams to the canvas. If the scene fails, you will be notified automatically.'),
  )

  assistant.addTool(
    'create_scene',
    async (args: { id: string; code: string }) => {
      getOrCreateScene(args.id, args.code)
      return { created: args.id, allScenes: stage.state.get('sceneIds') }
    },
    z.object({
      id: z.string().describe('Unique scene identifier'),
      code: z.string().describe('TypeScript code for this scene'),
    }).describe('Create a named scene without running it yet.'),
  )

  assistant.addTool(
    'run_scene',
    async (args: { id: string }) => runScene(args.id),
    z.object({
      id: z.string().describe('Scene id to run'),
    }).describe('Run a specific scene by its id.'),
  )

  assistant.addTool(
    'run_all',
    async () => {
      const ids = (stage.state.get('sceneIds') || []) as string[]
      const results: any[] = []
      for (const id of ids) results.push({ id, ...(await runScene(id)) })
      return results
    },
    z.object({}).describe('Run every scene in order and return all results.'),
  )

  assistant.addTool(
    'get_canvas',
    async () => {
      const activeId = stage.state.get('activeSceneId') as string | null
      if (!activeId || !sceneMap[activeId]) return { status: 'empty', allScenes: [] }
      const s = sceneMap[activeId]
      return {
        sceneId: activeId,
        status: s.state.get('status'),
        output: s.state.get('output'),
        error: s.state.get('error'),
        code: s.state.get('code'),
        allScenes: stage.state.get('sceneIds'),
      }
    },
    z.object({}).describe('Inspect the current canvas: active scene output, error, code, status.'),
  )

  assistant.addTool(
    'activate_scene',
    async (args: { id: string }) => {
      if (!sceneMap[args.id]) return { error: `Scene "${args.id}" not found` }
      stage.setState({ activeSceneId: args.id })
      bumpStage()
      return { activeSceneId: args.id }
    },
    z.object({
      id: z.string().describe('Scene id to make active in the canvas'),
    }).describe('Switch the canvas to display a different scene.'),
  )

  // ─── Ink App ─────────────────────────────────────────────────────────

  type Msg = { role: 'user' | 'assistant' | 'system'; content: string }

  function App() {
    const [messages, setMessages] = useState<Msg[]>([])
    const [input, setInput] = useState('')
    const [streaming, setStreaming] = useState('')
    const [thinking, setThinking] = useState(false)
    const [activity, setActivity] = useState('')
    const [canvas, setCanvas] = useState({ output: '', error: '', status: 'empty' })
    const { exit } = useApp()
    const { stdout } = useStdout()
    const rows = stdout?.rows ?? 24

    // --- assistant events ---
    useEffect(() => {
      const onPreview = (text: string) => setStreaming(text)
      const onResponse = (text: string) => {
        setStreaming('')
        setThinking(false)
        setActivity('')
        setMessages(prev => [...prev, { role: 'assistant', content: text }])
      }
      const onToolCall = (name: string) => setActivity(`${name}`)
      const onToolResult = () => setActivity('')

      assistant.on('preview', onPreview)
      assistant.on('response', onResponse)
      assistant.on('toolCall', onToolCall)
      assistant.on('toolResult', onToolResult)
      return () => {
        assistant.off('preview', onPreview)
        assistant.off('response', onResponse)
        assistant.off('toolCall', onToolCall)
        assistant.off('toolResult', onToolResult)
      }
    }, [])

    // --- stage entity ticks → canvas state ---
    useEffect(() => {
      const unsub = stage.state.observe((_changeType: any, key: any) => {
        if (key !== 'tick') return
        const activeId = stage.state.get('activeSceneId') as string | null
        if (!activeId || !sceneMap[activeId]) {
          setCanvas({ output: '', error: '', status: 'empty' })
          return
        }
        const s = sceneMap[activeId]
        setCanvas({
          output: (s.state.get('output') || '') as string,
          error: (s.state.get('error') || '') as string,
          status: (s.state.get('status') || 'idle') as string,
        })
      })
      return unsub
    }, [])

    // --- keyboard ---
    useInput((ch, key) => {
      if (key.escape) { exit(); return }

      if (key.return) {
        if (thinking) return
        const msg = input.trim()
        if (!msg) return
        setInput('')
        setMessages(prev => [...prev, { role: 'user', content: msg }])
        setThinking(true)
        assistant.ask(msg).catch((err: any) => {
          setMessages(prev => [...prev, { role: 'system', content: `error: ${err.message}` }])
          setThinking(false)
        })
        return
      }

      if (key.backspace || key.delete) {
        setInput(prev => prev.slice(0, -1))
        return
      }

      if (ch && !key.ctrl && !key.meta) {
        setInput(prev => prev + ch)
      }
    })

    // --- render ---
    const visible = messages.slice(-30)
    const sceneIds = (stage.state.get('sceneIds') || []) as string[]
    const activeId = (stage.state.get('activeSceneId') || '') as string

    const chatChildren: any[] = []

    visible.forEach((m, i) => {
      const color = m.role === 'user' ? 'green' : m.role === 'system' ? 'red' : 'white'
      const prefix = m.role === 'user' ? '> ' : '  '
      chatChildren.push(h(Text, { key: `msg-${i}`, wrap: 'wrap', color }, `${prefix}${m.content}`))
    })

    if (streaming) chatChildren.push(h(Text, { key: 'chat-stream', wrap: 'wrap', dimColor: true }, `  ${streaming}`))
    if (thinking && !streaming) chatChildren.push(h(Text, { key: 'chat-think', color: 'yellow' }, '  thinking...'))
    if (activity) chatChildren.push(h(Text, { key: 'chat-act', color: 'blue' }, `  [${activity}]`))

    const canvasBody = canvas.output
      ? h(Text, { key: 'cvs-out', wrap: 'wrap' }, canvas.output)
      : canvas.status === 'empty'
        ? h(Text, { key: 'cvs-empty', dimColor: true }, '  ask inkbot to draw something')
        : null

    // border + header + status = 4 rows overhead per panel
    const panelHeight = rows - 2

    return h(Box, { flexDirection: 'row', width: '100%', height: rows },
      // ── Chat ──
      h(Box, { key: 'chat', flexDirection: 'column', width: '50%', height: rows, borderStyle: 'round', borderColor: 'cyan', paddingX: 1 },
        h(Text, { bold: true, color: 'cyan' }, ' inkbot '),
        h(Box, { flexDirection: 'column', flexGrow: 1, overflow: 'hidden' }, ...chatChildren),
        h(Box, { borderStyle: 'single', borderColor: 'gray', paddingX: 1 },
          h(Text, { color: 'green' }, '> '),
          h(Text, null, input),
          h(Text, { dimColor: true }, '\u2588'),
        ),
      ),
      // ── Canvas ──
      h(Box, { key: 'canvas', flexDirection: 'column', width: '50%', height: rows, borderStyle: 'round', borderColor: 'magenta', paddingX: 1 },
        h(Text, { bold: true, color: 'magenta' }, ' canvas '),
        h(Box, { flexDirection: 'column', height: panelHeight - 4, overflow: 'hidden' },
          canvasBody,
          canvas.error ? h(Text, { key: 'cvs-err', color: 'red', wrap: 'wrap' }, canvas.error) : null,
        ),
        h(Box, null,
          h(Text, { dimColor: true }, ` ${canvas.status}`),
          sceneIds.length > 1 ? h(Text, { dimColor: true }, `  scenes: ${sceneIds.join(', ')}  active: ${activeId}`) : null,
        ),
      ),
    )
  }

  // Mount and hold
  await ink.render(h(App))
  await ink.waitUntilExit()
}

export default {
  description: 'Launch the Inkbot split-pane assistant with a live canvas.',
  argsSchema,
  handler: inkbot,
}
