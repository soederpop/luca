import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from '../../schemas/base.js'
import { Feature } from '../feature.js'

// ─── Schemas ────────────────────────────────────────────────────────────────

export const InkStateSchema = FeatureStateSchema.extend({
  /** Whether an ink app is currently rendered / mounted */
  mounted: z.boolean().describe('Whether an ink app is currently rendered / mounted'),
})
type InkState = z.infer<typeof InkStateSchema>

export const InkOptionsSchema = FeatureOptionsSchema.extend({
  /** Maximum frames per second for render updates (default 30) */
  maxFps: z.number().optional().describe('Maximum frames per second for render updates'),
  /** Patch console methods so console.log doesnt break the TUI (default true) */
  patchConsole: z.boolean().optional().describe('Patch console methods to avoid mixing with Ink output'),
  /** Enable incremental rendering to reduce flicker (default false) */
  incrementalRendering: z.boolean().optional().describe('Enable incremental rendering mode'),
  /** Enable React concurrent mode (default false) */
  concurrent: z.boolean().optional().describe('Enable React concurrent rendering mode'),
})
type InkOptions = z.infer<typeof InkOptionsSchema>

export const InkEventsSchema = FeatureEventsSchema.extend({
  mounted: z.tuple([]).describe('Emitted when a React element is mounted to the terminal via render()'),
  unmounted: z.tuple([]).describe('Emitted when the mounted Ink app exits or is unmounted'),
})

/**
 * Ink Feature — React-powered Terminal UI via Ink
 *
 * Exposes the Ink library (React for CLIs) through the container so any
 * feature, script, or application can build rich terminal user interfaces
 * using React components rendered directly in the terminal.
 *
 * This feature is intentionally a thin pass-through. It re-exports all of
 * Ink's components, hooks, and the render function, plus a few convenience
 * methods for mounting / unmounting apps. The actual UI composition is left
 * entirely to the consumer — the feature just makes Ink available.
 *
 * **What you get:**
 * - `ink.render(element)` — mount a React element to the terminal
 * - `ink.components` — { Box, Text, Static, Transform, Newline, Spacer }
 * - `ink.hooks` — { useInput, useApp, useStdin, useStdout, useStderr, useFocus, useFocusManager }
 * - `ink.React` — the React module itself (createElement, useState, etc.)
 * - `ink.unmount()` — tear down the currently mounted app
 * - `ink.waitUntilExit()` — await the mounted app's exit
 *
 * **Quick start:**
 * ```tsx
 * const ink = container.feature('ink', { enable: true })
 * const { Box, Text } = ink.components
 * const { React } = ink
 *
 * ink.render(
 *   React.createElement(Box, { flexDirection: 'column' },
 *     React.createElement(Text, { color: 'green' }, 'hello from ink'),
 *     React.createElement(Text, { dimColor: true }, 'powered by luca'),
 *   )
 * )
 *
 * await ink.waitUntilExit()
 * ```
 *
 * Or if you're in a .tsx file:
 * ```tsx
 * import React from 'react'
 * const ink = container.feature('ink', { enable: true })
 * const { Box, Text } = ink.components
 *
 * ink.render(
 *   <Box flexDirection="column">
 *     <Text color="green">hello from ink</Text>
 *     <Text dimColor>powered by luca</Text>
 *   </Box>
 * )
 * ```
 *
 * @extends Feature
 */
export class Ink extends Feature<InkState, InkOptions> {
  static { Feature.register(this, 'ink') }
  static override shortcut = 'features.ink' as const
  static override stateSchema = InkStateSchema
  static override optionsSchema = InkOptionsSchema
  static override eventsSchema = InkEventsSchema

  private _instance: any | null = null
  private _inkModule: typeof import('ink') | null = null
  private _reactModule: typeof import('react') | null = null
  private _blocks = new Map<string, Function>()

  override get initialState(): InkState {
    return {
      enabled: true,
      mounted: false,
    } as InkState
  }

  // ─── Lazy module loading ──────────────────────────────────────────────

  /**
   * The raw ink module. Lazy-loaded on first access.
   */
  private async _getInk() {
    if (!this._inkModule) {
      this._inkModule = await import('ink')
    }
    return this._inkModule
  }

  /**
   * The raw react module. Lazy-loaded on first access.
   */
  private async _getReact() {
    if (!this._reactModule) {
      this._reactModule = await import('react')
    }
    return this._reactModule
  }

  // ─── Public API ───────────────────────────────────────────────────────

  /**
   * The React module (createElement, useState, useEffect, etc.)
   *
   * Exposed so consumers don't need a separate react import.
   * Lazy-loaded — first access triggers the import.
   */
  get React() {
    // return a promise the first time, but for ergonomics we also
    // expose a sync getter that throws if react hasn't loaded yet.
    if (this._reactModule) return this._reactModule
    throw new Error(
      'React not loaded yet. Either await ink.loadModules() first, or use ink.render() which loads automatically.'
    )
  }

  /**
   * Pre-load ink + react modules so the sync getters work.
   * Called automatically by render(), but you can call it early.
   *
   * @returns This Ink feature instance for method chaining
   *
   * @example
   * ```typescript
   * const ink = container.feature('ink', { enable: true })
   * await ink.loadModules()
   * // Now sync getters like ink.React, ink.components, ink.hooks work
   * const { Box, Text } = ink.components
   * ```
   */
  async loadModules() {
    await Promise.all([this._getInk(), this._getReact()])
    return this
  }

  /**
   * All Ink components as a single object for destructuring.
   *
   * ```ts
   * const { Box, Text, Static, Spacer } = ink.components
   * ```
   */
  get components() {
    const ink = this._inkModule
    if (!ink) {
      throw new Error(
        'Ink not loaded yet. Call await ink.loadModules() or ink.render() first.'
      )
    }

    return {
      Box: ink.Box,
      Text: ink.Text,
      Static: ink.Static,
      Transform: ink.Transform,
      Newline: ink.Newline,
      Spacer: ink.Spacer,
    }
  }

  /**
   * All Ink hooks as a single object for destructuring.
   *
   * ```ts
   * const { useInput, useApp, useFocus } = ink.hooks
   * ```
   */
  get hooks() {
    const ink = this._inkModule
    if (!ink) {
      throw new Error(
        'Ink not loaded yet. Call await ink.loadModules() or ink.render() first.'
      )
    }

    return {
      useInput: ink.useInput,
      useApp: ink.useApp,
      useStdin: ink.useStdin,
      useStdout: ink.useStdout,
      useStderr: ink.useStderr,
      useFocus: ink.useFocus,
      useFocusManager: ink.useFocusManager,
      useCursor: ink.useCursor,
    }
  }

  /**
   * The Ink measureElement utility.
   */
  get measureElement() {
    const ink = this._inkModule
    if (!ink) {
      throw new Error('Ink not loaded yet.')
    }
    return ink.measureElement
  }

  /**
   * Mount a React element to the terminal.
   *
   * Wraps `ink.render()` — automatically loads modules if needed,
   * tracks the instance for unmount / waitUntilExit, and updates state.
   *
   * @param node - A React element (JSX or React.createElement)
   * @param options - Ink render options (stdout, stdin, debug, etc.)
   * @returns The Ink instance with rerender, unmount, waitUntilExit, clear
   */
  async render(node: any, options: Record<string, any> = {}) {
    const ink = await this._getInk()
    await this._getReact()

    // merge feature-level defaults with per-render overrides
    const mergedOptions = {
      patchConsole: this.options.patchConsole ?? true,
      maxFps: this.options.maxFps,
      incrementalRendering: this.options.incrementalRendering,
      concurrent: this.options.concurrent,
      ...options,
    }

    // clean out undefined values so ink uses its own defaults
    for (const key of Object.keys(mergedOptions)) {
      if ((mergedOptions as any)[key] === undefined) {
        delete (mergedOptions as any)[key]
      }
    }

    this._instance = ink.render(node, mergedOptions)
    this.setState({ mounted: true })
    this.emit('mounted')

    // when the app exits, update state
    this._instance.waitUntilExit().then(() => {
      this.setState({ mounted: false })
      this._instance = null
      this.emit('unmounted')
    }).catch(() => {
      // noop — app might be force-unmounted
    })

    return this._instance
  }

  /**
   * Re-render the currently mounted app with a new root element.
   *
   * @returns void
   *
   * @example
   * ```typescript
   * const ink = container.feature('ink', { enable: true })
   * const { React } = await ink.loadModules()
   * const { Text } = ink.components
   *
   * await ink.render(React.createElement(Text, null, 'Hello'))
   * ink.rerender(React.createElement(Text, null, 'Updated!'))
   * ```
   */
  rerender(node: any) {
    if (!this._instance) {
      throw new Error('No mounted ink app. Call render() first.')
    }
    this._instance.rerender(node)
  }

  /**
   * Unmount the currently mounted Ink app.
   *
   * Tears down the React tree rendered in the terminal and resets state.
   * Safe to call when no app is mounted (no-op).
   *
   * @returns void
   *
   * @example
   * ```typescript
   * const ink = container.feature('ink', { enable: true })
   * await ink.render(myElement)
   * // ... later
   * ink.unmount()
   * console.log(ink.isMounted) // false
   * ```
   */
  unmount() {
    if (this._instance) {
      this._instance.unmount()
      this.setState({ mounted: false })
      this._instance = null
    }
  }

  /**
   * Returns a promise that resolves when the mounted app exits.
   *
   * Useful for keeping a script alive while the terminal UI is active.
   *
   * @returns Promise that resolves when the Ink app exits
   * @throws {Error} When no app is currently mounted
   *
   * @example
   * ```typescript
   * const ink = container.feature('ink', { enable: true })
   * await ink.render(myElement)
   * await ink.waitUntilExit()
   * console.log('App exited')
   * ```
   */
  async waitUntilExit(): Promise<void> {
    if (!this._instance) {
      throw new Error('No mounted ink app. Call render() first.')
    }
    return this._instance.waitUntilExit()
  }

  /**
   * Clear the terminal output of the mounted app.
   *
   * Erases all Ink-rendered content from the terminal. Safe to call
   * when no app is mounted (no-op).
   *
   * @returns void
   *
   * @example
   * ```typescript
   * const ink = container.feature('ink', { enable: true })
   * await ink.render(myElement)
   * // ... later, wipe the screen
   * ink.clear()
   * ```
   */
  clear() {
    if (this._instance) {
      this._instance.clear()
    }
  }

  /**
   * Whether an ink app is currently mounted.
   */
  get isMounted(): boolean {
    return this.state.get('mounted') ?? false
  }

  /**
   * The raw ink render instance if you need low-level access.
   */
  get instance() {
    return this._instance
  }

  // ─── Block Registry ─────────────────────────────────────────────────

  /**
   * Register a named React function component as a renderable block.
   *
   * @param name - Unique block name
   * @param component - A React function component
   * @returns This Ink feature instance for method chaining
   *
   * @example
   * ```typescript
   * ink.registerBlock('Greeting', ({ name }) =>
   *   React.createElement(Text, { color: 'green' }, `Hello ${name}!`)
   * )
   * ```
   */
  registerBlock(name: string, component: Function) {
    this._blocks.set(name, component)
    return this
  }

  /**
   * Render a registered block by name with optional props.
   *
   * Looks up the component, creates a React element, renders it via ink,
   * then immediately unmounts so the static output stays on screen while
   * freeing the React tree.
   *
   * @param name - The registered block name
   * @param data - Props to pass to the component
   *
   * @example
   * ```typescript
   * await ink.renderBlock('Greeting', { name: 'Jon' })
   * ```
   */
  async renderBlock(name: string, data?: Record<string, any>) {
    const component = this._blocks.get(name)
    if (!component) {
      throw new Error(`No block registered with name "${name}". Available: ${[...this._blocks.keys()].join(', ') || '(none)'}`)
    }

    await this.loadModules()
    const React = this.React
    const element = React.createElement(component as any, data || {})
    const instance = await this.render(element, { patchConsole: false })
    instance.unmount()
  }

  /**
   * Render a registered block that needs to stay mounted for async work.
   *
   * The component receives a `done` prop — a callback it must invoke when
   * it has finished rendering its final output. The React tree stays alive
   * until `done()` is called or the timeout expires.
   *
   * @param name - The registered block name
   * @param data - Props to pass to the component (a `done` prop is added automatically)
   * @param options - `timeout` in ms before force-unmounting (default 30 000)
   *
   * @example
   * ```tsx
   * // In a ## Blocks section:
   * function AsyncChart({ url, done }) {
   *   const [rows, setRows] = React.useState(null)
   *   React.useEffect(() => {
   *     fetch(url).then(r => r.json()).then(data => {
   *       setRows(data)
   *       done()
   *     })
   *   }, [])
   *   if (!rows) return <Text dimColor>Loading...</Text>
   *   return <Box><Text>{JSON.stringify(rows)}</Text></Box>
   * }
   *
   * // In a code block:
   * await renderAsync('AsyncChart', { url: 'https://api.example.com/data' })
   * ```
   */
  async renderBlockAsync(name: string, data?: Record<string, any>, options?: { timeout?: number }) {
    const component = this._blocks.get(name)
    if (!component) {
      throw new Error(`No block registered with name "${name}". Available: ${[...this._blocks.keys()].join(', ') || '(none)'}`)
    }

    const timeout = options?.timeout ?? 30_000

    await this.loadModules()
    const React = this.React

    const { promise, resolve } = Promise.withResolvers<void>()

    const done = () => resolve()
    const element = React.createElement(component as any, { ...data, done })
    const instance = await this.render(element, { patchConsole: false })

    const timer = setTimeout(() => resolve(), timeout)

    await promise
    clearTimeout(timer)
    instance.unmount()
  }

  /**
   * List all registered block names.
   */
  get blocks(): string[] {
    return [...this._blocks.keys()]
  }
}

export default Ink
declare module '../../feature' {
  interface AvailableFeatures {
    ink: typeof Ink
  }
}
