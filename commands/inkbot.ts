import { z } from 'zod'
import { commands, CommandOptionsSchema } from '@soederpop/luca'
import type { ContainerContext } from '@soederpop/luca'
import { AGIContainer } from '../src/agi/container.server.js'

export const argsSchema = CommandOptionsSchema.extend({
  model: z.string().optional().describe('OpenAI model to use'),
})

// ─── Scene Types ──────────────────────────────────────────────────────

interface SceneState {
  code: string
  component: ((...args: any[]) => any) | null
  error: string
  status: 'idle' | 'rendered' | 'interactive' | 'complete' | 'failed'
  interactive: boolean
}

type Layout = 'split' | 'canvas' | 'chat'
const LAYOUT_CYCLE: Layout[] = ['split', 'canvas', 'chat']

function seedMentalState(ms: any) {
  ms.set('activeSceneId', null)
  ms.set('scenes', {} as Record<string, SceneState>)
  ms.set('focus', 'chat' as 'chat' | 'canvas')
  ms.set('layout', 'split' as Layout)
  ms.set('thoughts', [] as Array<{ at: string; text: string }>)
  ms.set('observations', {} as Record<string, string>)
  ms.set('plan', '')
  ms.set('mood', 'ready')
}

// ─── Safe Eval ────────────────────────────────────────────────────────

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor

const EVAL_TIMEOUT = 15_000

async function evalWithTimeout<T>(fn: () => Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Scene evaluation timed out after ${ms}ms`)), ms)
  })
  try {
    return await Promise.race([fn(), timeout])
  } finally {
    clearTimeout(timer!)
  }
}

// ─── Main Handler ─────────────────────────────────────────────────────

export async function inkbot(options: z.infer<typeof argsSchema>, context: ContainerContext) {
  const container = new AGIContainer()

  // ─── Load Ink ──────────────────────────────────────────────────────
  const ink = container.feature('ink', { enable: true, patchConsole: true })
  await ink.loadModules()
  const React = ink.React
  const h = React.createElement
  const { Box, Text, Spacer, Newline } = ink.components
  const { useInput, useApp, useStdout } = ink.hooks
  const { useState, useEffect, useRef, useCallback, useMemo } = React

  // ─── Assistant ─────────────────────────────────────────────────────
  const mgr = container.feature('assistantsManager')
  await mgr.discover()
  const assistant = mgr.create('inkbot', { model: options.model })

  seedMentalState(assistant.mentalState)

  // ─── Container features for scene scope ────────────────────────────
  const fs = container.feature('fs')
  const proc = container.feature('proc')
  const ui = container.feature('ui')
  const yaml = container.feature('yaml')
  const grep = container.feature('grep')
  const git = container.feature('git')

  // ─── Scene Focus Context ───────────────────────────────────────────
  // Scenes use useSceneInput() which is only active when canvas is focused.
  const SceneFocusContext = React.createContext(false)

  function makeUseSceneInput(onError: (err: Error) => void) {
    return function useSceneInput(handler: (ch: string, key: any) => void) {
      const focused = React.useContext(SceneFocusContext)
      useInput(
        (ch: string, key: any) => {
          // Reserve Tab, Escape, and Ctrl+L (layout toggle) for the host app
          if (key.tab || key.escape) return
          if (key.ctrl && ch === 'l') return
          try {
            handler(ch, key)
          } catch (err: any) {
            onError(err)
          }
        },
        { isActive: focused },
      )
    }
  }

  // ─── Error Boundary ────────────────────────────────────────────────

  class SceneErrorBoundary extends React.Component<
    { children: any; onError?: (err: Error) => void; fallback?: any },
    { error: Error | null }
  > {
    constructor(props: any) {
      super(props)
      this.state = { error: null }
    }
    static getDerivedStateFromError(error: Error) {
      return { error }
    }
    componentDidCatch(error: Error) {
      this.props.onError?.(error)
    }
    render() {
      if (this.state.error) {
        return h(
          Box,
          { flexDirection: 'column', paddingX: 1 },
          h(Text, { color: 'red', bold: true }, 'Render Error'),
          h(Text, { color: 'red', wrap: 'wrap' }, this.state.error.message),
          h(
            Text,
            { dimColor: true, wrap: 'wrap' },
            this.state.error.stack?.split('\n').slice(1, 4).join('\n') || '',
          ),
        )
      }
      return this.props.children
    }
  }

  // ─── Scene State Management ────────────────────────────────────────

  let busy = false
  assistant.on('turnStart', () => { busy = true })
  assistant.on('response', () => { busy = false })

  function getScenes(): Record<string, SceneState> {
    return { ...(assistant.mentalState.get('scenes') || {}) }
  }

  function setScene(id: string, patch: Partial<SceneState>) {
    const scenes = getScenes()
    scenes[id] = {
      ...(scenes[id] || { code: '', component: null, error: '', status: 'idle', interactive: false }),
      ...patch,
    }
    assistant.mentalState.set('scenes', scenes)
  }

  // ─── Pending Responders ────────────────────────────────────────────
  // For interactive scenes: draw() blocks until the component calls respond().
  const pendingResponders = new Map<string, (result: any) => void>()

  function createRespondForScene(sceneId: string) {
    return (data: any) => {
      const resolver = pendingResponders.get(sceneId)
      if (resolver) {
        pendingResponders.delete(sceneId)
        setScene(sceneId, { status: 'complete' })
        assistant.mentalState.set('focus', 'chat')
        resolver({ status: 'completed', sceneId, response: data })
      }
    }
  }

  // ─── Scene Error Reporter ──────────────────────────────────────────
  // When a scene errors and the assistant is idle, feed the error back
  // so it can self-correct.
  function reportSceneError(sceneId: string, error: string) {
    setScene(sceneId, { error, status: 'failed' })
    if (!busy) {
      const errMsg = `[Scene "${sceneId}" render error]\n${error}\n\nFix the component code and redraw.`
      assistant.conversation?.pushMessage({ role: 'developer', content: errMsg })
      assistant.ask(errMsg).catch(() => {})
    }
  }

  // ─── Scene Evaluator ──────────────────────────────────────────────
  // Evaluates scene code in an async function scope with all APIs injected.
  // The code must `return` a React component function.

  async function evaluateScene(
    code: string,
    sceneId: string,
    interactive: boolean,
  ): Promise<{ component: ((...args: any[]) => any) | null; error: string | null }> {
    const respondFn = createRespondForScene(sceneId)
    const sceneErrorHandler = (err: Error) => reportSceneError(sceneId, err.message)
    const useSceneInput = makeUseSceneInput(sceneErrorHandler)

    const paramNames = [
      // React core
      'h', 'React', 'Box', 'Text', 'Spacer', 'Newline',
      // React hooks
      'useState', 'useEffect', 'useRef', 'useCallback', 'useMemo',
      // Scene input (focus-aware, error-safe)
      'useSceneInput',
      // Canvas API
      'setMental', 'getMental', 'respond',
      // Container
      'container', 'fs', 'proc', 'ui', 'yaml', 'grep', 'git',
      // Utilities
      'fetch', 'URL', 'Buffer', 'JSON', 'Date', 'Math', 'console',
    ]

    const paramValues = [
      h, React, Box, Text, Spacer, Newline,
      useState, useEffect, useRef, useCallback, useMemo,
      useSceneInput,
      (k: string, v: any) => assistant.mentalState.set(k, v),
      (k: string) => assistant.mentalState.get(k),
      respondFn,
      container, fs, proc, ui, yaml, grep, git,
      fetch, URL, Buffer, JSON, Date, Math, console,
    ]

    try {
      const factory = new AsyncFunction(...paramNames, code)
      const result = await evalWithTimeout(() => factory(...paramValues), EVAL_TIMEOUT)

      if (typeof result !== 'function') {
        return {
          component: null,
          error: `Scene code must return a React component function, got ${typeof result}. End your code with: return function Scene() { return h(Box, {}, h(Text, {}, "hello")) }`,
        }
      }

      return { component: result, error: null }
    } catch (err: any) {
      return { component: null, error: err.message }
    }
  }

  // ─── Canvas Tools ─────────────────────────────────────────────────

  assistant.addTool(
    'draw',
    async (args: { code: string; sceneId?: string; interactive?: boolean }) => {
      const id = args.sceneId || 'default'
      const interactive = !!args.interactive

      const { component, error } = await evaluateScene(args.code, id, interactive)

      if (error) {
        setScene(id, { code: args.code, component: null, error, status: 'failed', interactive })
        assistant.mentalState.set('activeSceneId', id)
        return { status: 'failed', sceneId: id, error }
      }

      setScene(id, { code: args.code, component, error: '', status: interactive ? 'interactive' : 'rendered', interactive })
      assistant.mentalState.set('activeSceneId', id)

      if (interactive) {
        // Block until the component calls respond()
        return new Promise<any>((resolve) => {
          pendingResponders.set(id, resolve)
        })
      }

      return { status: 'rendered', sceneId: id }
    },
    z.object({
      code: z
        .string()
        .describe(
          'Async function body that returns a React component function. Use h() for elements. Has access to: h, React, Box, Text, Spacer, Newline, useState, useEffect, useRef, useCallback, useMemo, useSceneInput, setMental, getMental, respond, container, fs, proc, ui, yaml, grep, git, fetch.',
        ),
      sceneId: z.string().optional().describe('Scene id (defaults to "default").'),
      interactive: z
        .boolean()
        .optional()
        .describe('When true, the tool call blocks until the component calls respond(data). The component should use useSceneInput() for keyboard input.'),
    }).describe(
      'Render a React Ink component in the canvas pane. The code runs as an async function body and must return a React component function. Interactive scenes block until respond(data) is called.',
    ),
  )

  assistant.addTool(
    'create_scene',
    async (args: { id: string; code: string; interactive?: boolean }) => {
      const { component, error } = await evaluateScene(args.code, args.id, !!args.interactive)
      if (error) {
        setScene(args.id, { code: args.code, component: null, error, status: 'failed', interactive: !!args.interactive })
        return { created: args.id, error }
      }
      setScene(args.id, { code: args.code, component, error: '', status: 'idle', interactive: !!args.interactive })
      if (!assistant.mentalState.get('activeSceneId')) {
        assistant.mentalState.set('activeSceneId', args.id)
      }
      return { created: args.id, allScenes: Object.keys(getScenes()) }
    },
    z.object({
      id: z.string().describe('Unique scene identifier'),
      code: z.string().describe('Async function body returning a React component function'),
      interactive: z.boolean().optional().describe('Whether this scene uses interactive APIs'),
    }).describe('Create a named scene without activating it. Validates the code immediately.'),
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
      id: z.string().describe('Scene id to display in the canvas'),
    }).describe('Switch the canvas to display a different scene.'),
  )

  assistant.addTool(
    'get_canvas',
    async () => {
      const activeId = assistant.mentalState.get('activeSceneId') as string | null
      const scenes = getScenes()
      const currentLayout = assistant.mentalState.get('layout') || 'split'
      if (!activeId || !scenes[activeId]) return { status: 'empty', layout: currentLayout, allScenes: [] }
      const s = scenes[activeId]
      return { sceneId: activeId, status: s.status, error: s.error, interactive: s.interactive, layout: currentLayout, allScenes: Object.keys(scenes) }
    },
    z.object({}).describe('Inspect the current canvas state: active scene, status, errors, scene list.'),
  )

  // ─── Mental State Tools ───────────────────────────────────────────

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
    }).describe('Record a thought in your mental state.'),
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
    }).describe('Record a named observation.'),
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
    'set_layout',
    async (args: { layout: string }) => {
      const valid: Layout[] = ['split', 'canvas', 'chat']
      const l = args.layout as Layout
      if (!valid.includes(l)) return { error: `Invalid layout "${args.layout}". Must be: ${valid.join(', ')}` }
      assistant.mentalState.set('layout', l)
      return { updated: true, layout: l }
    },
    z.object({
      layout: z.enum(['split', 'canvas', 'chat']).describe(
        'split = 50/50 side by side. canvas = full-width canvas with minimized chat strip. chat = full-width chat with minimized canvas strip.',
      ),
    }).describe('Change the UI layout. Use "canvas" when you need more screen real estate for your component. Use "chat" for conversation-heavy work. Use "split" for balanced interaction. The user can also cycle layouts with Ctrl+L.'),
  )

  assistant.addTool(
    'reflect',
    async () => {
      return {
        mood: assistant.mentalState.get('mood'),
        plan: assistant.mentalState.get('plan'),
        layout: assistant.mentalState.get('layout'),
        thoughts: assistant.mentalState.get('thoughts'),
        observations: assistant.mentalState.get('observations'),
        scenes: Object.keys(getScenes()),
        activeScene: assistant.mentalState.get('activeSceneId'),
      }
    },
    z.object({}).describe('Review your full mental state.'),
  )

  // ─── Coder Subagent ───────────────────────────────────────────────

  let coderAssistant: any = null

  const CODER_PREFIX = `You are answering a question from Inkbot, a canvas-rendering assistant that renders React Ink components directly in a split-pane terminal UI.

IMPORTANT CONTEXT about Inkbot's execution environment:
- Scene code is an async function body that must RETURN a React component function
- Uses h() (React.createElement) instead of JSX — no JSX compilation available
- Available in scope: h, React, Box, Text, Spacer, Newline, useState, useEffect, useRef, useCallback, useMemo
- useSceneInput(handler) for keyboard input (focus-aware, error-safe — NOT raw useInput)
- setMental(key, value) and getMental(key) for assistant mental state
- respond(data) to complete interactive scenes
- container, fs, proc, ui, yaml, grep, git — all Luca container features
- fetch, URL, Buffer, JSON, Date, Math, console — standard globals
- Top-level await works (the wrapper is async)
- No imports possible — everything via scope injection

When answering, return a SINGLE code snippet that works as a scene code body. Must end with \`return function SceneName() { ... }\`.

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
      question: z.string().describe('Your question about the Luca framework, container APIs, or how to write scene components.'),
    }).describe('Ask the coding assistant a question about the Luca framework or how to build scene components.'),
  )

  // ─── Ink App ──────────────────────────────────────────────────────

  type Msg = { role: 'user' | 'assistant' | 'system'; content: string }

  function App() {
    const [messages, setMessages] = useState<Msg[]>([])
    const [input, setInput] = useState('')
    const [streaming, setStreaming] = useState('')
    const [thinking, setThinking] = useState(false)
    const [activity, setActivity] = useState('')
    const [canvasError, setCanvasError] = useState('')
    const [canvasStatus, setCanvasStatus] = useState('empty')
    const [mood, setMood] = useState('ready')
    const [focus, setFocus] = useState<'chat' | 'canvas'>('chat')
    const [layout, setLayout] = useState<Layout>('split')
    const [activeComponent, setActiveComponent] = useState<((...args: any[]) => any) | null>(null)
    const [errorBoundaryKey, setErrorBoundaryKey] = useState(0)
    const { exit } = useApp()
    const { stdout } = useStdout()
    const rows = stdout?.rows ?? 24
    const cols = stdout?.columns ?? 80

    // --- assistant events ---
    useEffect(() => {
      const onPreview = (text: string) => setStreaming(text)
      const onToolCall = (name: string) => setActivity(`${name}`)
      const onToolResult = () => setActivity('')

      assistant.on('preview', onPreview)
      assistant.on('toolCall', onToolCall)
      assistant.on('toolResult', onToolResult)
      return () => {
        assistant.off('preview', onPreview)
        assistant.off('toolCall', onToolCall)
        assistant.off('toolResult', onToolResult)
      }
    }, [])

    // --- mentalState → UI state ---
    useEffect(() => {
      const unsub = assistant.mentalState.observe((_changeType: any, key: any) => {
        if (key === 'scenes' || key === 'activeSceneId') {
          const activeId = assistant.mentalState.get('activeSceneId') as string | null
          const scenes = (assistant.mentalState.get('scenes') as Record<string, SceneState>) || {}
          if (!activeId || !scenes[activeId]) {
            setActiveComponent(null)
            setCanvasError('')
            setCanvasStatus('empty')
            return
          }
          const s = scenes[activeId]
          setActiveComponent(() => s.component)
          setCanvasError(s.error)
          setCanvasStatus(s.status)
          // Reset error boundary when component changes
          setErrorBoundaryKey((k) => k + 1)
        }
        if (key === 'mood') {
          setMood((assistant.mentalState.get('mood') || 'ready') as string)
        }
        if (key === 'focus') {
          setFocus((assistant.mentalState.get('focus') || 'chat') as 'chat' | 'canvas')
        }
        if (key === 'layout') {
          setLayout((assistant.mentalState.get('layout') || 'split') as Layout)
        }
      })
      return unsub
    }, [])

    // --- keyboard (host-level) ---
    useInput((ch, key) => {
      if (key.escape) {
        exit()
        return
      }

      // Ctrl+L cycles layout: split → canvas → chat → split
      if (key.ctrl && ch === 'l') {
        const idx = LAYOUT_CYCLE.indexOf(layout)
        const next = LAYOUT_CYCLE[(idx + 1) % LAYOUT_CYCLE.length]
        setLayout(next)
        assistant.mentalState.set('layout', next)
        return
      }

      // Tab toggles focus
      if (key.tab) {
        const next = focus === 'chat' ? 'canvas' : 'chat'
        setFocus(next)
        assistant.mentalState.set('focus', next)
        return
      }

      // When canvas is focused, only the scene component handles input
      // (via useSceneInput which filters Tab/Escape)
      if (focus === 'canvas') return

      // Chat-focused input
      if (key.return) {
        if (thinking) return
        const msg = input.trim()
        if (!msg) return
        setInput('')
        setMessages((prev) => [...prev, { role: 'user', content: msg }])
        setThinking(true)
        assistant
          .ask(msg)
          .then((text: string) => {
            setStreaming('')
            setThinking(false)
            setActivity('')
            setMessages((prev) => [...prev, { role: 'assistant', content: text }])
          })
          .catch((err: any) => {
            setStreaming('')
            setThinking(false)
            setActivity('')
            setMessages((prev) => [...prev, { role: 'system', content: `error: ${err.message}` }])
          })
        return
      }

      if (key.backspace || key.delete) {
        setInput((prev) => prev.slice(0, -1))
        return
      }

      if (ch && !key.ctrl && !key.meta) {
        setInput((prev) => prev + ch)
      }
    })

    // --- render building blocks ---
    const scenes = (assistant.mentalState.get('scenes') as Record<string, SceneState>) || {}
    const sceneIds = Object.keys(scenes)
    const activeId = (assistant.mentalState.get('activeSceneId') || '') as string
    const chatFocused = focus === 'chat'
    const canvasFocused = focus === 'canvas'
    const layoutHint = `Ctrl+L: layout`

    // Estimate available chat lines: total rows minus header, input bar, borders, padding
    const chatOverhead = 6 // header + input + borders
    const availLines = Math.max(4, rows - chatOverhead)
    // In split layout chat is half-width; estimate wrap width accordingly
    const chatCols = layout === 'split' ? Math.floor(cols / 2) - 4 : cols - 4

    // Walk messages newest-first, estimating wrapped line count, until we fill the viewport
    const visible: Msg[] = []
    let usedLines = 0
    // Cap individual message display height so one huge response doesn't eat the whole pane
    const maxMsgLines = Math.max(6, Math.floor(availLines * 0.6))
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i]
      const textLen = m.content.length + 2 // prefix chars
      const estimatedLines = Math.min(Math.max(1, Math.ceil(textLen / Math.max(1, chatCols))), maxMsgLines)
      if (usedLines + estimatedLines > availLines && visible.length > 0) break
      usedLines += estimatedLines
      visible.unshift(m)
    }

    // Chat message list — truncate long messages to fit
    const chatChildren: any[] = []
    visible.forEach((m, i) => {
      const color = m.role === 'user' ? 'green' : m.role === 'system' ? 'red' : 'white'
      const prefix = m.role === 'user' ? '> ' : '  '
      // Truncate display text if it would exceed maxMsgLines worth of characters
      const maxChars = maxMsgLines * Math.max(1, chatCols)
      const display = m.content.length > maxChars ? m.content.slice(0, maxChars - 1) + '…' : m.content
      chatChildren.push(h(Text, { key: `msg-${i}`, wrap: 'wrap', color }, `${prefix}${display}`))
    })
    if (streaming) chatChildren.push(h(Text, { key: 'chat-stream', wrap: 'wrap', dimColor: true }, `  ${streaming}`))
    if (thinking && !streaming) chatChildren.push(h(Text, { key: 'chat-think', color: 'yellow' }, '  thinking...'))
    if (activity) chatChildren.push(h(Text, { key: 'chat-act', color: 'blue' }, `  [${activity}]`))

    // Canvas rendered content
    let canvasContent: any
    if (activeComponent) {
      canvasContent = h(
        SceneFocusContext.Provider,
        { value: canvasFocused },
        h(
          SceneErrorBoundary,
          {
            key: errorBoundaryKey,
            onError: (err: Error) => reportSceneError(activeId, err.message),
          },
          h(activeComponent),
        ),
      )
    } else if (canvasError) {
      canvasContent = h(
        Box,
        { flexDirection: 'column', paddingX: 1 },
        h(Text, { color: 'red', bold: true }, 'Error'),
        h(Text, { color: 'red', wrap: 'wrap' }, canvasError),
      )
    } else {
      canvasContent = h(Text, { dimColor: true, key: 'cvs-empty' }, '  ask inkbot to draw something')
    }

    // Reusable input bar
    const inputBar = (active: boolean, borderColor?: string) =>
      h(
        Box,
        {
          borderStyle: 'single' as const,
          borderColor: borderColor || (active ? 'gray' : 'blackBright'),
          paddingX: 1,
        },
        h(Text, { color: active ? 'green' : 'blackBright' }, '> '),
        h(Text, { dimColor: !active }, input),
        active ? h(Text, { dimColor: true }, '\u2588') : null,
      )

    // Canvas status bar
    const canvasStatusBar = h(
      Box,
      null,
      h(Text, { dimColor: true }, ` ${canvasStatus}`),
      sceneIds.length > 1
        ? h(Text, { dimColor: true }, `  scenes: ${sceneIds.join(', ')}  active: ${activeId}`)
        : null,
    )

    // ─── Layout: split (50/50 side by side) ─────────────────────────
    if (layout === 'split') {
      return h(
        Box,
        { flexDirection: 'row', width: '100%', height: rows },
        // Chat Pane
        h(
          Box,
          {
            key: 'chat',
            flexDirection: 'column',
            width: '50%',
            height: rows,
            borderStyle: 'round',
            borderColor: chatFocused ? 'cyan' : 'gray',
            paddingX: 1,
          },
          h(
            Text,
            { bold: true, color: chatFocused ? 'cyan' : 'gray' },
            ' inkbot ',
            h(Text, { dimColor: true }, `[${mood}]`),
            !chatFocused ? h(Text, { dimColor: true }, '  (tab)') : null,
          ),
          h(Box, { flexDirection: 'column', flexGrow: 1, overflow: 'hidden' }, ...chatChildren),
          inputBar(chatFocused),
        ),
        // Canvas Pane
        h(
          Box,
          {
            key: 'canvas',
            flexDirection: 'column',
            width: '50%',
            height: rows,
            borderStyle: 'round',
            borderColor: canvasFocused ? 'magenta' : 'gray',
            paddingX: 1,
          },
          h(
            Text,
            { bold: true, color: canvasFocused ? 'magenta' : 'gray' },
            ' canvas ',
            canvasStatus === 'interactive' ? h(Text, { color: 'yellow' }, '[interactive]') : null,
            !canvasFocused && canvasStatus === 'interactive'
              ? h(Text, { dimColor: true }, '  (tab)')
              : null,
          ),
          h(Box, { flexDirection: 'column', flexGrow: 1, overflow: 'hidden' }, canvasContent),
          canvasStatusBar,
        ),
      )
    }

    // ─── Layout: canvas (full-width canvas, chat minimized) ─────────
    if (layout === 'canvas') {
      // Last message for the minimized chat strip
      const lastMsg = visible.length > 0 ? visible[visible.length - 1] : null
      const lastMsgColor = lastMsg ? (lastMsg.role === 'user' ? 'green' : lastMsg.role === 'system' ? 'red' : 'white') : 'gray'
      const statusText = thinking
        ? (streaming ? streaming.slice(0, 60) + (streaming.length > 60 ? '...' : '') : 'thinking...')
        : activity
          ? `[${activity}]`
          : lastMsg
            ? `${lastMsg.role === 'user' ? '> ' : '  '}${lastMsg.content}`
            : ''

      return h(
        Box,
        { flexDirection: 'column', width: '100%', height: rows },
        // Canvas — full width, takes most of the space
        h(
          Box,
          {
            key: 'canvas',
            flexDirection: 'column',
            width: '100%',
            flexGrow: 1,
            borderStyle: 'round',
            borderColor: canvasFocused ? 'magenta' : 'gray',
            paddingX: 1,
          },
          h(
            Box,
            null,
            h(
              Text,
              { bold: true, color: canvasFocused ? 'magenta' : 'gray' },
              ' canvas ',
              canvasStatus === 'interactive' ? h(Text, { color: 'yellow' }, '[interactive] ') : null,
            ),
            h(Spacer),
            h(Text, { dimColor: true }, layoutHint),
          ),
          h(Box, { flexDirection: 'column', flexGrow: 1, overflow: 'hidden' }, canvasContent),
          canvasStatusBar,
        ),
        // Chat strip — minimized at the bottom
        h(
          Box,
          {
            key: 'chat',
            flexDirection: 'column',
            width: '100%',
            borderStyle: 'round',
            borderColor: chatFocused ? 'cyan' : 'gray',
            paddingX: 1,
          },
          h(
            Box,
            null,
            h(
              Text,
              { bold: true, color: chatFocused ? 'cyan' : 'gray' },
              ' inkbot ',
              h(Text, { dimColor: true }, `[${mood}] `),
            ),
            h(Text, {
              wrap: 'truncate-end',
              dimColor: !thinking,
              color: thinking ? 'yellow' : lastMsgColor,
            }, statusText),
          ),
          inputBar(chatFocused),
        ),
      )
    }

    // ─── Layout: chat (full-width chat, canvas minimized) ───────────
    return h(
      Box,
      { flexDirection: 'column', width: '100%', height: rows },
      // Chat — full width, takes most of the space
      h(
        Box,
        {
          key: 'chat',
          flexDirection: 'column',
          width: '100%',
          flexGrow: 1,
          borderStyle: 'round',
          borderColor: chatFocused ? 'cyan' : 'gray',
          paddingX: 1,
        },
        h(
          Box,
          null,
          h(
            Text,
            { bold: true, color: chatFocused ? 'cyan' : 'gray' },
            ' inkbot ',
            h(Text, { dimColor: true }, `[${mood}]`),
          ),
          h(Spacer),
          h(Text, { dimColor: true }, layoutHint),
        ),
        h(Box, { flexDirection: 'column', flexGrow: 1, overflow: 'hidden' }, ...chatChildren),
        inputBar(chatFocused),
      ),
      // Canvas strip — minimized at the bottom
      h(
        Box,
        {
          key: 'canvas',
          flexDirection: 'row',
          width: '100%',
          borderStyle: 'round',
          borderColor: canvasFocused ? 'magenta' : 'gray',
          paddingX: 1,
        },
        h(
          Text,
          { bold: true, color: canvasFocused ? 'magenta' : 'gray' },
          ' canvas ',
        ),
        h(Text, { dimColor: true }, `${canvasStatus}`),
        sceneIds.length > 0
          ? h(Text, { dimColor: true }, `  [${activeId || 'none'}]`)
          : null,
        canvasStatus === 'interactive'
          ? h(Text, { color: 'yellow' }, '  (tab to interact)')
          : null,
        h(Spacer),
        h(Text, { dimColor: true }, layoutHint),
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
