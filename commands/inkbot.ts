import { z } from 'zod'
import { commands, CommandOptionsSchema } from '@soederpop/luca'
import type { ContainerContext } from '@soederpop/luca'
import { AGIContainer } from '../src/agi/container.server.js'
import { tmpdir } from 'os'
import type { ChildProcess } from 'child_process'

export const argsSchema = CommandOptionsSchema.extend({
  model: z.string().optional().describe('OpenAI model to use'),
})

// ─── Canvas Protocol ───────────────────────────────────────────────────
// Scene subprocesses communicate with the parent via a JSON line protocol
// on stdout. Lines prefixed with the CANVAS_MARKER are parsed as commands;
// everything else is display text.

const CANVAS_MARKER = '\x00__CANVAS__\x00'

/** The runtime code prepended to every scene script. Provides the `canvas` global. */
function canvasRuntime(interactive: boolean) {
  // This string is injected verbatim at the top of the scene file.
  // It must be self-contained — no imports, no references to outer scope.
  return `
// ── Canvas Runtime ──────────────────────────────────────────────
const __CANVAS_MARKER = '\\x00__CANVAS__\\x00'
function __canvasSend(msg: any) {
  process.stdout.write(__CANVAS_MARKER + JSON.stringify(msg) + '\\n')
}

const __inputQueue: string[] = []
const __inputWaiters: Array<(line: string) => void> = []

${interactive ? `
// In interactive mode, read stdin line-by-line for user input
let __stdinBuf = ''
process.stdin.setEncoding('utf-8')
process.stdin.on('data', (chunk: string) => {
  __stdinBuf += chunk
  let nl: number
  while ((nl = __stdinBuf.indexOf('\\n')) !== -1) {
    const line = __stdinBuf.slice(0, nl).trim()
    __stdinBuf = __stdinBuf.slice(nl + 1)
    if (__inputWaiters.length > 0) {
      __inputWaiters.shift()!(line)
    } else {
      __inputQueue.push(line)
    }
  }
})
process.stdin.resume()
` : ''}

const canvas = {
  /** Write a key-value pair into the assistant's mental state. */
  setMental(key: string, value: any) {
    __canvasSend({ type: 'mental', key, value })
  },

  /** Signal that the scene is done and return structured data to the assistant.
   *  After calling respond(), the scene should exit. */
  respond(data: any) {
    __canvasSend({ type: 'respond', data })
  },

  /** Display text in the canvas (same as console.log, but explicit). */
  display(text: string) {
    console.log(text)
  },

  /** Request text input from the user. The canvas pane auto-focuses.
   *  Returns a promise that resolves with the user's input string. */
  prompt(text: string): Promise<string> {
    __canvasSend({ type: 'prompt', text })
    return new Promise((resolve) => {
      if (__inputQueue.length > 0) {
        resolve(__inputQueue.shift()!)
      } else {
        __inputWaiters.push(resolve)
      }
    })
  },

  /** Wait for the next line of input from the user (no prompt displayed). */
  waitForInput(): Promise<string> {
    return new Promise((resolve) => {
      if (__inputQueue.length > 0) {
        resolve(__inputQueue.shift()!)
      } else {
        __inputWaiters.push(resolve)
      }
    })
  },

  /** Emit a named event that the assistant will see in the scene response. */
  event(name: string, data?: any) {
    __canvasSend({ type: 'event', name, data })
  },
}
// ── End Canvas Runtime ──────────────────────────────────────────
`
}

interface SceneState {
  code: string
  output: string
  error: string
  status: 'idle' | 'running' | 'complete' | 'failed' | 'interactive'
  exitCode: number | null
  interactive: boolean
}

interface CanvasCommand {
  type: 'mental' | 'respond' | 'prompt' | 'event'
  [key: string]: any
}

function seedMentalState(ms: any) {
  ms.set('activeSceneId', null)
  ms.set('scenes', {} as Record<string, SceneState>)
  ms.set('focus', 'chat' as 'chat' | 'canvas')
  ms.set('canvasPrompt', null as string | null)
  // The assistant's own scratch space
  ms.set('thoughts', [] as Array<{ at: string; text: string }>)
  ms.set('observations', {} as Record<string, string>)
  ms.set('plan', '')
  ms.set('mood', 'ready')
}

export async function inkbot(options: z.infer<typeof argsSchema>, context: ContainerContext) {
  const container = new AGIContainer()

  // ─── Load Ink ────────────────────────────────────────────────────────
  const ink = container.feature('ink', { enable: true, patchConsole: true })
  await ink.loadModules()
  const React = ink.React
  const h = React.createElement
  const { Box, Text } = ink.components
  const { useInput, useApp, useStdout } = ink.hooks
  const { useState, useEffect, useRef } = React

  // ─── Assistant ───────────────────────────────────────────────────────
  const mgr = container.feature('assistantsManager')
  await mgr.discover()
  const assistant = mgr.create('inkbot', { model: options.model })

  seedMentalState(assistant.mentalState)

  // ─── Scene Runner ───────────────────────────────────────────────────

  const proc = container.feature('proc')
  const fs = container.feature('fs')
  const sceneTmpDir = `${tmpdir()}/inkbot-scenes`
  fs.ensureFolder(sceneTmpDir)

  // Track the active interactive scene's child process so we can pipe stdin
  let activeChild: ChildProcess | null = null
  // Track whether the assistant is mid-turn so we don't double-fire
  let busy = false
  assistant.on('turnStart', () => { busy = true })
  assistant.on('response', () => { busy = false })

  function getScenes(): Record<string, SceneState> {
    return { ...(assistant.mentalState.get('scenes') || {}) }
  }

  function setScene(id: string, patch: Partial<SceneState>) {
    const scenes = getScenes()
    scenes[id] = {
      ...(scenes[id] || { code: '', output: '', error: '', status: 'idle', exitCode: null, interactive: false }),
      ...patch,
    }
    assistant.mentalState.set('scenes', scenes)
  }

  function getOrCreateScene(id: string, code: string, interactive: boolean) {
    setScene(id, {
      code,
      output: '',
      error: '',
      status: 'idle',
      exitCode: null,
      interactive,
    })
    if (!assistant.mentalState.get('activeSceneId')) {
      assistant.mentalState.set('activeSceneId', id)
    }
  }

  /** Parse a chunk of stdout, separating canvas protocol commands from display text. */
  function parseOutput(raw: string): { display: string; commands: CanvasCommand[] } {
    const lines = raw.split('\n')
    const displayLines: string[] = []
    const commands: CanvasCommand[] = []

    for (const line of lines) {
      const markerIdx = line.indexOf(CANVAS_MARKER)
      if (markerIdx !== -1) {
        // Extract the JSON after the marker
        const jsonStr = line.slice(markerIdx + CANVAS_MARKER.length).trim()
        if (jsonStr) {
          try {
            commands.push(JSON.parse(jsonStr))
          } catch {
            displayLines.push(line) // Malformed — treat as display
          }
        }
      } else {
        displayLines.push(line)
      }
    }

    return { display: displayLines.join('\n'), commands }
  }

  /** Handle a canvas protocol command from a scene. */
  function handleCanvasCommand(cmd: CanvasCommand, sceneId: string, events: Array<{ name: string; data?: any }>) {
    switch (cmd.type) {
      case 'mental':
        assistant.mentalState.set(cmd.key, cmd.value)
        break
      case 'prompt':
        assistant.mentalState.set('canvasPrompt', cmd.text)
        assistant.mentalState.set('focus', 'canvas')
        break
      case 'event':
        events.push({ name: cmd.name, data: cmd.data })
        break
      // 'respond' is handled by the caller since it resolves the interactive promise
    }
  }

  /**
   * Run a scene. For non-interactive scenes, resolves when the process exits.
   * For interactive scenes, resolves when the scene calls canvas.respond().
   */
  function runScene(id: string): Promise<{ output: string; error: string; exitCode: number; response?: any; events?: Array<{ name: string; data?: any }> }> {
    const scenes = getScenes()
    const scene = scenes[id]
    if (!scene) return Promise.reject(new Error(`Scene "${id}" not found`))

    const interactive = scene.interactive
    setScene(id, { status: interactive ? 'interactive' : 'running', output: '', error: '' })

    const file = `${sceneTmpDir}/${id.replace(/[^a-zA-Z0-9-]/g, '_')}_${Date.now()}.ts`
    const fullCode = canvasRuntime(interactive) + '\n' + scene.code
    fs.writeFile(file, fullCode)

    return new Promise((resolve, reject) => {
      const events: Array<{ name: string; data?: any }> = []
      let output = ''
      let error = ''
      let responded = false
      let responseData: any = undefined

      const child = proc.spawn('luca', ['run', file], { cwd: container.cwd })

      if (interactive) {
        activeChild = child
        assistant.mentalState.set('focus', 'canvas')
      }

      child.stdout?.on('data', (buf: Buffer) => {
        const raw = buf.toString()
        const parsed = parseOutput(raw)

        if (parsed.display.trim()) {
          output += parsed.display
          setScene(id, { output })
        }

        for (const cmd of parsed.commands) {
          if (cmd.type === 'respond') {
            responded = true
            responseData = cmd.data
            // Scene signaled completion — kill it if still running
            child.kill()
          } else {
            handleCanvasCommand(cmd, id, events)
          }
        }
      })

      child.stderr?.on('data', (buf: Buffer) => {
        error += buf.toString()
        setScene(id, { error })
      })

      child.on('close', (code: number | null) => {
        const exitCode = code ?? (responded ? 0 : 1)
        const status = responded || exitCode === 0 ? 'complete' : 'failed'
        setScene(id, { status, exitCode })

        if (interactive) {
          activeChild = null
          assistant.mentalState.set('focus', 'chat')
          assistant.mentalState.set('canvasPrompt', null)
        }

        try { fs.unlink(file) } catch {}

        // Resolve first so the draw tool gets its result back
        resolve({
          output,
          error,
          exitCode,
          ...(responded ? { response: responseData } : {}),
          ...(events.length ? { events } : {}),
        })

        // Auto-feed errors back to the assistant if it's idle and NOT interactive.
        // Interactive draws already return the error as the tool result.
        if (status === 'failed' && !interactive && !busy) {
          const errMsg = `[Scene "${id}" failed]\n${error.trim()}`
          assistant.conversation?.pushMessage({ role: 'developer', content: errMsg })
          assistant.ask(errMsg).catch(() => {})
        }
      })

      child.on('error', (err: Error) => {
        setScene(id, { status: 'failed', error: err.message, exitCode: 1 })
        if (interactive) {
          activeChild = null
          assistant.mentalState.set('focus', 'chat')
          assistant.mentalState.set('canvasPrompt', null)
        }
        try { fs.unlink(file) } catch {}
        resolve({ output: '', error: err.message, exitCode: 1 })

        if (!interactive && !busy) {
          const errMsg = `[Scene "${id}" failed]\n${err.message}`
          assistant.conversation?.pushMessage({ role: 'developer', content: errMsg })
          assistant.ask(errMsg).catch(() => {})
        }
      })
    })
  }

  /** Send a line of text to the active interactive scene's stdin. */
  function sendToScene(text: string) {
    if (activeChild?.stdin?.writable) {
      activeChild.stdin.write(text + '\n')
    }
  }

  // ─── Canvas Tools ────────────────────────────────────────────────────

  assistant.addTool(
    'draw',
    async (args: { code: string; sceneId?: string; interactive?: boolean }) => {
      const id = args.sceneId || 'default'
      const interactive = !!args.interactive
      getOrCreateScene(id, args.code, interactive)
      assistant.mentalState.set('activeSceneId', id)

      if (interactive) {
        // Block until the scene calls canvas.respond() or exits
        const result = await runScene(id)
        if (result.response !== undefined) {
          return { status: 'completed', sceneId: id, response: result.response, events: result.events || [] }
        }
        if (result.exitCode !== 0) {
          return { status: 'failed', sceneId: id, error: result.error, events: result.events || [] }
        }
        return { status: 'completed', sceneId: id, output: result.output, events: result.events || [] }
      }

      // Non-interactive: fire and forget.
      // Success messages are pushed here; error auto-fix is handled by the scene runner's close handler.
      runScene(id).then(result => {
        if (result.exitCode === 0) {
          assistant.conversation?.pushMessage({ role: 'developer', content: `[Scene "${id}" completed]\n${result.output.trim() || '(no output)'}` })
        }
      })
      return { status: 'running', sceneId: id }
    },
    z.object({
      code: z.string().describe('TypeScript code to execute. Use console.log() for visible output. For interactive scenes, use the canvas.prompt() and canvas.respond() APIs.'),
      sceneId: z.string().optional().describe('Scene id (defaults to "default").'),
      interactive: z.boolean().optional().describe('When true, the scene can receive user input via canvas.prompt() and canvas.waitForInput(). The tool call blocks until the scene calls canvas.respond(data), and that data is returned to you.'),
    }).describe('Draw or redraw the canvas. Non-interactive scenes run and stream output. Interactive scenes block until the scene code calls canvas.respond(data), returning the structured response to you.'),
  )

  assistant.addTool(
    'create_scene',
    async (args: { id: string; code: string; interactive?: boolean }) => {
      getOrCreateScene(args.id, args.code, !!args.interactive)
      return { created: args.id, allScenes: Object.keys(getScenes()) }
    },
    z.object({
      id: z.string().describe('Unique scene identifier'),
      code: z.string().describe('TypeScript code for this scene'),
      interactive: z.boolean().optional().describe('Whether this scene uses interactive canvas APIs'),
    }).describe('Create a named scene without running it yet.'),
  )

  assistant.addTool(
    'run_scene',
    async (args: { id: string }) => runScene(args.id),
    z.object({
      id: z.string().describe('Scene id to run'),
    }).describe('Run a specific scene by its id. Returns when the scene completes (or responds if interactive).'),
  )

  assistant.addTool(
    'run_all',
    async () => {
      const ids = Object.keys(getScenes())
      const results: any[] = []
      for (const id of ids) results.push({ id, ...(await runScene(id)) })
      return results
    },
    z.object({}).describe('Run every scene in order and return all results.'),
  )

  assistant.addTool(
    'get_canvas',
    async () => {
      const activeId = assistant.mentalState.get('activeSceneId') as string | null
      const scenes = getScenes()
      if (!activeId || !scenes[activeId]) return { status: 'empty', allScenes: [] }
      const s = scenes[activeId]
      return { sceneId: activeId, ...s, allScenes: Object.keys(scenes) }
    },
    z.object({}).describe('Inspect the current canvas: active scene output, error, code, status.'),
  )

  assistant.addTool(
    'activate_scene',
    async (args: { id: string }) => {
      const scenes = getScenes()
      if (!scenes[args.id]) return { error: `Scene "${args.id}" not found` }
      assistant.mentalState.set('activeSceneId', args.id)
      return { activeSceneId: args.id }
    },
    z.object({
      id: z.string().describe('Scene id to make active in the canvas'),
    }).describe('Switch the canvas to display a different scene.'),
  )

  // ─── Mental State Tools ──────────────────────────────────────────────

  assistant.addTool(
    'think',
    async (args: { text: string }) => {
      const thoughts = [...(assistant.mentalState.get('thoughts') || [])]
      thoughts.push({ at: new Date().toISOString(), text: args.text })
      if (thoughts.length > 50) thoughts.splice(0, thoughts.length - 50)
      assistant.mentalState.set('thoughts', thoughts)
      return { recorded: true, totalThoughts: thoughts.length }
    },
    z.object({
      text: z.string().describe('Your thought, observation, or internal note.'),
    }).describe('Record a thought in your mental state. Use this to reason through problems, note what worked or failed, track your approach.'),
  )

  assistant.addTool(
    'observe',
    async (args: { key: string; value: string }) => {
      const observations = { ...(assistant.mentalState.get('observations') || {}) }
      observations[args.key] = args.value
      assistant.mentalState.set('observations', observations)
      return { recorded: true, key: args.key }
    },
    z.object({
      key: z.string().describe('A short label for what you observed.'),
      value: z.string().describe('Your observation.'),
    }).describe('Record a named observation. Observations persist and can be updated.'),
  )

  assistant.addTool(
    'set_plan',
    async (args: { plan: string }) => {
      assistant.mentalState.set('plan', args.plan)
      return { updated: true }
    },
    z.object({
      plan: z.string().describe('Your current plan of action.'),
    }).describe('Set or update your current plan.'),
  )

  assistant.addTool(
    'set_mood',
    async (args: { mood: string }) => {
      assistant.mentalState.set('mood', args.mood)
      return { updated: true }
    },
    z.object({
      mood: z.string().describe('A word or short phrase describing your current state.'),
    }).describe('Update your mood/status displayed in the UI header.'),
  )

  assistant.addTool(
    'reflect',
    async () => {
      return {
        mood: assistant.mentalState.get('mood'),
        plan: assistant.mentalState.get('plan'),
        thoughts: assistant.mentalState.get('thoughts'),
        observations: assistant.mentalState.get('observations'),
        scenes: Object.keys(getScenes()),
        activeScene: assistant.mentalState.get('activeSceneId'),
      }
    },
    z.object({}).describe('Review your full mental state — mood, plan, thoughts, observations, and scene inventory.'),
  )

  // ─── Coder Subagent ───────────────────────────────────────────────────
  // Inkbot can ask the codingAssistant questions about the Luca framework.
  // The coder has shell tools, file tools, luca describe, and the full
  // skills library — it's the oracle for "how do I do X with the container?"

  let coderAssistant: any = null

  const CODER_PREFIX = `You are answering a question from Inkbot, a canvas-rendering assistant that runs TypeScript code inside a Node VM sandbox via \`luca run\`.

IMPORTANT CONTEXT about Inkbot's execution environment:
- Code runs inside a VM sandbox with \`container\` available as a global
- All enabled features are available as top-level globals (fs, proc, ui, grep, etc.)
- Standard globals are available: fetch, URL, Buffer, process, setTimeout, console, etc.
- No imports are needed or possible — everything comes from the container
- Top-level await works
- Output goes to the canvas via console.log()

When answering, return a SINGLE code snippet that would work inside this VM context. No imports, no module setup — just the working code using container globals. Be specific and runnable.

Inkbot's question: `

  assistant.addTool(
    'ask_coder',
    async (args: { question: string }) => {
      if (!coderAssistant) {
        coderAssistant = mgr.create('codingAssistant', { model: options.model || 'gpt-5.4' })
        await coderAssistant.start()
      }
      const answer = await coderAssistant.ask(CODER_PREFIX + args.question)
      return { answer }
    },
    z.object({
      question: z.string().describe('Your question about the Luca framework, container APIs, or how to accomplish something in scene code.'),
    }).describe('Ask the coding assistant a question about the Luca framework. Use this when you need to know how a container feature works, what APIs are available, or how to write code that runs in the VM sandbox. The coder has access to the full codebase, luca describe, and shell tools.'),
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
    const [mood, setMood] = useState('ready')
    const [focus, setFocus] = useState<'chat' | 'canvas'>('chat')
    const [canvasPrompt, setCanvasPrompt] = useState<string | null>(null)
    const [canvasInput, setCanvasInput] = useState('')
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

    // --- mentalState → UI state ---
    useEffect(() => {
      const unsub = assistant.mentalState.observe((_changeType: any, key: any) => {
        if (key === 'scenes' || key === 'activeSceneId') {
          const activeId = assistant.mentalState.get('activeSceneId') as string | null
          const scenes = assistant.mentalState.get('scenes') as Record<string, SceneState> || {}
          if (!activeId || !scenes[activeId]) {
            setCanvas({ output: '', error: '', status: 'empty' })
            return
          }
          const s = scenes[activeId]
          setCanvas({ output: s.output, error: s.error, status: s.status })
        }
        if (key === 'mood') {
          setMood((assistant.mentalState.get('mood') || 'ready') as string)
        }
        if (key === 'focus') {
          setFocus((assistant.mentalState.get('focus') || 'chat') as 'chat' | 'canvas')
        }
        if (key === 'canvasPrompt') {
          setCanvasPrompt(assistant.mentalState.get('canvasPrompt') as string | null)
        }
      })
      return unsub
    }, [])

    // --- keyboard ---
    useInput((ch, key) => {
      if (key.escape) { exit(); return }

      // Tab toggles focus
      if (key.tab) {
        const next = focus === 'chat' ? 'canvas' : 'chat'
        setFocus(next)
        assistant.mentalState.set('focus', next)
        return
      }

      if (focus === 'canvas') {
        // Canvas-focused input
        if (key.return) {
          const text = canvasInput.trim()
          setCanvasInput('')
          setCanvasPrompt(null)
          assistant.mentalState.set('canvasPrompt', null)
          sendToScene(text)
          return
        }
        if (key.backspace || key.delete) {
          setCanvasInput(prev => prev.slice(0, -1))
          return
        }
        if (ch && !key.ctrl && !key.meta) {
          setCanvasInput(prev => prev + ch)
        }
        return
      }

      // Chat-focused input
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
    const scenes = assistant.mentalState.get('scenes') as Record<string, SceneState> || {}
    const sceneIds = Object.keys(scenes)
    const activeId = (assistant.mentalState.get('activeSceneId') || '') as string
    const chatFocused = focus === 'chat'
    const canvasFocused = focus === 'canvas'

    const chatChildren: any[] = []
    visible.forEach((m, i) => {
      const color = m.role === 'user' ? 'green' : m.role === 'system' ? 'red' : 'white'
      const prefix = m.role === 'user' ? '> ' : '  '
      chatChildren.push(h(Text, { key: `msg-${i}`, wrap: 'wrap', color }, `${prefix}${m.content}`))
    })
    if (streaming) chatChildren.push(h(Text, { key: 'chat-stream', wrap: 'wrap', dimColor: true }, `  ${streaming}`))
    if (thinking && !streaming) chatChildren.push(h(Text, { key: 'chat-think', color: 'yellow' }, '  thinking...'))
    if (activity) chatChildren.push(h(Text, { key: 'chat-act', color: 'blue' }, `  [${activity}]`))

    // Canvas body
    const canvasChildren: any[] = []
    if (canvas.output) {
      canvasChildren.push(h(Text, { key: 'cvs-out', wrap: 'wrap' }, canvas.output))
    } else if (canvas.status === 'empty') {
      canvasChildren.push(h(Text, { key: 'cvs-empty', dimColor: true }, '  ask inkbot to draw something'))
    }
    if (canvas.error) {
      canvasChildren.push(h(Text, { key: 'cvs-err', color: 'red', wrap: 'wrap' }, canvas.error))
    }

    const panelHeight = rows - 2

    return h(Box, { flexDirection: 'row', width: '100%', height: rows },
      // ── Chat Pane ──
      h(Box, {
        key: 'chat',
        flexDirection: 'column',
        width: '50%',
        height: rows,
        borderStyle: 'round',
        borderColor: chatFocused ? 'cyan' : 'gray',
        paddingX: 1,
      },
        h(Text, { bold: true, color: chatFocused ? 'cyan' : 'gray' },
          ' inkbot ',
          h(Text, { dimColor: true }, `[${mood}]`),
          !chatFocused ? h(Text, { dimColor: true }, '  (tab to focus)') : null,
        ),
        h(Box, { flexDirection: 'column', flexGrow: 1, overflow: 'hidden' }, ...chatChildren),
        h(Box, { borderStyle: 'single', borderColor: chatFocused ? 'gray' : 'blackBright', paddingX: 1 },
          h(Text, { color: chatFocused ? 'green' : 'blackBright' }, '> '),
          h(Text, { dimColor: !chatFocused }, input),
          chatFocused ? h(Text, { dimColor: true }, '\u2588') : null,
        ),
      ),
      // ── Canvas Pane ──
      h(Box, {
        key: 'canvas',
        flexDirection: 'column',
        width: '50%',
        height: rows,
        borderStyle: 'round',
        borderColor: canvasFocused ? 'magenta' : 'gray',
        paddingX: 1,
      },
        h(Text, { bold: true, color: canvasFocused ? 'magenta' : 'gray' },
          ' canvas ',
          canvas.status === 'interactive' ? h(Text, { color: 'yellow' }, '[interactive]') : null,
          !canvasFocused && canvas.status === 'interactive' ? h(Text, { dimColor: true }, '  (tab to focus)') : null,
        ),
        h(Box, { flexDirection: 'column', height: panelHeight - (canvasPrompt ? 6 : 4), overflow: 'hidden' },
          ...canvasChildren,
        ),
        // Canvas prompt input (visible when scene calls canvas.prompt())
        canvasPrompt || canvasFocused
          ? h(Box, { flexDirection: 'column' },
              canvasPrompt ? h(Text, { color: 'yellow' }, `  ${canvasPrompt}`) : null,
              h(Box, { borderStyle: 'single', borderColor: canvasFocused ? 'magenta' : 'blackBright', paddingX: 1 },
                h(Text, { color: canvasFocused ? 'magenta' : 'blackBright' }, '> '),
                h(Text, { dimColor: !canvasFocused }, canvasInput),
                canvasFocused ? h(Text, { dimColor: true }, '\u2588') : null,
              ),
            )
          : null,
        h(Box, null,
          h(Text, { dimColor: true }, ` ${canvas.status}`),
          sceneIds.length > 1
            ? h(Text, { dimColor: true }, `  scenes: ${sceneIds.join(', ')}  active: ${activeId}`)
            : null,
        ),
      ),
    )
  }

  await ink.render(h(App))
  await ink.waitUntilExit()
}

export default {
  description: 'Launch the Inkbot split-pane assistant with a live canvas.',
  argsSchema,
  handler: inkbot,
}
