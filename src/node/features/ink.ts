import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema } from '../../schemas/base.js'
import { features, Feature } from '../feature.js'

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
  static override shortcut = 'features.ink' as const
  static override stateSchema = InkStateSchema
  static override optionsSchema = InkOptionsSchema

  private _instance: any | null = null
  private _inkModule: typeof import('ink') | null = null
  private _reactModule: typeof import('react') | null = null

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
   */
  rerender(node: any) {
    if (!this._instance) {
      throw new Error('No mounted ink app. Call render() first.')
    }
    this._instance.rerender(node)
  }

  /**
   * Unmount the currently mounted Ink app.
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
   */
  async waitUntilExit(): Promise<void> {
    if (!this._instance) {
      throw new Error('No mounted ink app. Call render() first.')
    }
    return this._instance.waitUntilExit()
  }

  /**
   * Clear the terminal output of the mounted app.
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
}

export default features.register('ink', Ink)

declare module '../../feature' {
  interface AvailableFeatures {
    ink: typeof Ink
  }
}
