import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from '../../schemas/base.js'
import { Feature } from '../feature.js'
import type { Helper } from '../../helper.js'
import { CdpConnection } from '../lib/cdp/connection.js'
import {
  CDP_HOSTS, DEFAULT_DEBUG_PORTS, chromeExecutableCandidates, findRealProfileBrowser,
  probeVersion, profileDirs, resolveBrowserWsUrl,
} from '../lib/cdp/discovery.js'
import { NodeType, buildEnhancedTree, getAllTrees, type DomNode } from '../lib/cdp/dom-tree.js'
import { DomTreeSerializer, countHiddenElementsInIframes, llmRepresentation } from '../lib/cdp/dom-serializer.js'
import { MODIFIER_BITS, SPECIAL_KEYS, charModifiersAndVk, getKeyInfo, keyCodeForChar, normalizeKeys } from '../lib/cdp/keys.js'
import {
  CLEAR_JS, FORCE_VALUE_JS, FRAMEWORK_EVENTS_JS, OCCLUSION_JS, SELECT_CLICK_FALLBACK_JS, SELECT_JS, SET_VALUE_JS,
  allChildrenText, findFileInputNear, isFileInput, requiresDirectValue,
} from '../lib/cdp/page-scripts.js'

declare module 'luca/feature' {
  interface AvailableFeatures {
    browserUse: typeof BrowserUse
  }
}

export const BrowserUseStateSchema = FeatureStateSchema.extend({
  session: z.string().default('default').describe('Session name. Each session drives its own tab'),
  headed: z.boolean().default(false).describe('Launch mode: whether Chrome runs with a visible window'),
  currentUrl: z.string().optional().describe('The current page URL'),
  wsUrl: z.string().nullable().default(null).describe('Browser websocket URL of the connected Chrome'),
  targetId: z.string().nullable().default(null).describe('CDP target id of the tab this session drives'),
  connected: z.boolean().default(false).describe('Whether a CDP connection is open'),
})
export type BrowserUseState = z.infer<typeof BrowserUseStateSchema>

export const BrowserUseOptionsSchema = FeatureOptionsSchema.extend({
  session: z.string().optional().describe('Session name. Each session gets its own tab, so sessions sharing one browser do not clobber each other'),
  browser: z.enum(['launch', 'profile', 'cdp']).optional().describe('Where the browser comes from. launch (default): find or start a dedicated debug Chrome with its own profile. profile: attach to your everyday Chrome after you turn on chrome://inspect/#remote-debugging (Chrome 144+; Chrome asks you to Allow each connection). cdp: connect to cdpUrl. Setting cdpUrl implies cdp; setting profile or connect implies profile'),
  headed: z.boolean().optional().describe('Launch mode: show the Chrome window. Default false (headless)'),
  profile: z.string().optional().describe('Attach to your everyday Chrome (same as browser: "profile"). Chrome decides which profile is debuggable, so the name is informational'),
  connect: z.boolean().optional().describe('Auto-discover a running Chrome with remote debugging (same as browser: "profile")'),
  cdpUrl: z.string().optional().describe('Connect to an existing browser via CDP URL (http:// debug address or ws:// browser URL)'),
  launch: z.boolean().optional().describe('Find or launch a dedicated debug Chrome (same as browser: "launch", the default)'),
  chromePath: z.string().optional().describe('Chrome or Chromium executable for launch mode. Default: found per platform (macOS, Linux, Windows)'),
  userDataDir: z.string().optional().describe('Chrome profile folder for launch mode (default ~/.chrome-debug). Chrome 136+ refuses remote debugging on the default profile, so this must be a separate folder'),
  debugPorts: z.array(z.number()).optional().describe('Ports a debug Chrome may already listen on, for launch mode. The first is used when launching (default [9222, 9223, 9229])'),
  launchTimeoutMs: z.number().optional().describe('How long launch mode waits for a fresh Chrome to bind its debug port (default 60000)'),
})
export type BrowserUseOptions = z.infer<typeof BrowserUseOptionsSchema>

export const BrowserUseEventsSchema = FeatureEventsSchema.extend({
  navigated: z.tuple([z.string().describe('URL navigated to')]).describe('Emitted after navigating to a URL'),
  clicked: z.tuple([z.string().describe('Target description')]).describe('Emitted after clicking an element'),
  typed: z.tuple([z.string().describe('Text typed')]).describe('Emitted after typing text'),
  screenshot: z.tuple([z.string().describe('Base64 or file path')]).describe('Emitted after taking a screenshot'),
  disconnected: z.tuple([]).describe('Emitted when the CDP connection drops'),
  closed: z.tuple([]).describe('Emitted when the session tab is closed'),
})

/** Every command returns this shape. Failures carry data.error. */
export interface BrowserUseResult {
  success: boolean
  data: Record<string, any>
}

const ok = (data: Record<string, any>): BrowserUseResult => ({ success: true, data })
const fail = (error: string, extra: Record<string, any> = {}): BrowserUseResult => ({ success: false, data: { error, ...extra } })
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Tabs opened by any browserUse instance in this process, for close({ all: true }). */
const openedTabs = new Set<string>()

/**
 * Browser automation over the Chrome DevTools Protocol, in-process.
 *
 * A TypeScript port of the browser-use CLI (0.12/0.13). It speaks CDP to
 * Chrome directly: no Python, and no daemon left running after you exit.
 * The page state (numbered interactive elements) matches browser-use's
 * output byte for byte, so `click <index>` means the same thing.
 *
 * Where the browser comes from (the `browser` option):
 * - `launch` (default): a dedicated debug Chrome with its own profile at
 *   ~/.chrome-debug, started on first use. Sign into sites there once.
 * - `profile`: your everyday Chrome, after you turn on
 *   chrome://inspect/#remote-debugging (Chrome 144+). Chrome asks you to
 *   Allow the connection; it is held for the life of the process.
 * - `cdp`: any Chrome at `cdpUrl`.
 *
 * @example
 * ```typescript
 * const browser = container.feature('browserUse')
 * await browser.open('https://example.com')
 * const state = await browser.getState()
 * console.log(state.data._raw_text)
 * await browser.click('12')
 * await browser.close()
 * ```
 *
 * @extends Feature
 */
export class BrowserUse extends Feature<BrowserUseState, BrowserUseOptions> {
  static override shortcut = 'features.browserUse' as const
  static override stability = 'experimental' as const
  static override category = 'media-browser' as const
  static override stateSchema = BrowserUseStateSchema
  static override optionsSchema = BrowserUseOptionsSchema
  static override eventsSchema = BrowserUseEventsSchema

  static override tools = {
    browserOpen: {
      description: 'Navigate the browser to a URL. Call this first to open a page before any interaction.',
      schema: z.object({
        url: z.string().describe('The URL to navigate to'),
      }).describe('Navigate the browser to a URL. Call this first to open a page before any interaction.'),
    },
    browserGetState: {
      description: 'Get the current page URL, title, and all interactive elements with their index numbers. Always call this after navigating or when you need to discover clickable elements — the indices returned are required for click, input, select, and other element interactions.',
      schema: z.object({}).describe('Get the current page URL, title, and all interactive elements with their index numbers. Always call this after navigating or when you need to discover clickable elements — the indices returned are required for click, input, select, and other element interactions.'),
    },
    browserClick: {
      description: 'Click an element by its index (from browserGetState) or by x,y pixel coordinates.',
      schema: z.object({
        target: z.string().describe('Element index number from browserGetState, or "x y" pixel coordinates separated by a space'),
      }).describe('Click an element by its index (from browserGetState) or by x,y pixel coordinates. You must call browserGetState first to obtain element indices.'),
    },
    browserType: {
      description: 'Type text at the current cursor/focus position. Use browserInput instead if you need to target a specific element.',
      schema: z.object({
        text: z.string().describe('Text to type'),
      }).describe('Type text at the current cursor/focus position. Use browserInput instead if you need to target a specific element by index.'),
    },
    browserInput: {
      description: 'Click a specific element by index and type text into it. Combines click + type in one step.',
      schema: z.object({
        index: z.string().describe('Element index number from browserGetState'),
        text: z.string().describe('Text to type into the element'),
      }).describe('Click a specific element by index and type text into it. Combines click + type in one step. Use this for filling form fields — get element indices from browserGetState first.'),
    },
    browserScreenshot: {
      description: 'Take a screenshot of the current page. Returns base64 PNG if no path given.',
      schema: z.object({
        path: z.string().optional().describe('File path to save the screenshot to. If omitted, returns base64-encoded PNG.'),
        full: z.boolean().optional().describe('If true, capture the full scrollable page instead of just the viewport'),
      }).describe('Take a screenshot of the current browser viewport. Use for visual verification, debugging, or capturing page state. Returns base64 PNG data unless a file path is provided.'),
    },
    browserEval: {
      description: 'Execute JavaScript code in the browser page context and return the result.',
      schema: z.object({
        js: z.string().describe('JavaScript code to execute in the page context. Has access to document, window, etc.'),
      }).describe('Execute arbitrary JavaScript in the browser page context. Use for DOM manipulation, extracting data via selectors, or running page-level logic. The return value is sent back as the result.'),
    },
    browserExtract: {
      description: 'Get the readable text of the current page, to answer a question about it.',
      schema: z.object({
        query: z.string().describe('What you want to find on the page, e.g. "all product names and prices in the table". Returned with the text so you can answer it'),
      }).describe('Get the readable text of the current page (up to 50,000 characters) together with your query, so you can pull out specific information without writing selectors. Use when browserGetState shows the page structure but you need its full text.'),
    },
    browserScroll: {
      description: 'Scroll the page up or down. Use when elements are not visible in the current viewport.',
      schema: z.object({
        direction: z.enum(['up', 'down']).default('down').describe('Scroll direction'),
        amount: z.number().optional().describe('Scroll amount in pixels. Omit for a default scroll step.'),
      }).describe('Scroll the page up or down. Use when target elements are outside the current viewport — after scrolling, call browserGetState to see newly visible elements.'),
    },
    browserKeys: {
      description: 'Send keyboard keys or key combinations to the page.',
      schema: z.object({
        keys: z.string().describe('Key or combination to send, e.g. "Enter", "Tab", "Control+a", "Escape", "ArrowDown"'),
      }).describe('Send keyboard keys or key combinations to the browser. Use for pressing Enter to submit, Tab to move focus, Escape to close dialogs, or keyboard shortcuts like Control+a.'),
    },
    browserBack: {
      description: 'Go back to the previous page in browser history.',
      schema: z.object({}).describe('Navigate back to the previous page in browser history, like clicking the back button.'),
    },
    browserSelect: {
      description: 'Select an option from a dropdown/select element by index.',
      schema: z.object({
        index: z.string().describe('Element index of the dropdown/select from browserGetState'),
        value: z.string().describe('The option text or value to select'),
      }).describe('Select an option from a <select> dropdown element. Get the dropdown element index from browserGetState first, then specify the option value to choose.'),
    },
    browserHover: {
      description: 'Hover over an element by index. Use for revealing tooltips, dropdown menus, or hover-triggered content.',
      schema: z.object({
        index: z.string().describe('Element index number from browserGetState'),
      }).describe('Hover the mouse over an element by index. Use to reveal tooltips, trigger hover menus, or expose hidden UI. Get element indices from browserGetState first.'),
    },
    browserDblclick: {
      description: 'Double-click an element by index.',
      schema: z.object({
        index: z.string().describe('Element index number from browserGetState'),
      }).describe('Double-click an element by index. Use for actions that require double-click, such as editing text in-place or selecting words.'),
    },
    browserRightclick: {
      description: 'Right-click (context menu) an element by index.',
      schema: z.object({
        index: z.string().describe('Element index number from browserGetState'),
      }).describe('Right-click an element by index to open a context menu. Get element indices from browserGetState first.'),
    },
    browserUpload: {
      description: 'Upload a file to a file input element.',
      schema: z.object({
        index: z.string().describe('Element index of the file input from browserGetState'),
        path: z.string().describe('Local file path to upload'),
      }).describe('Upload a local file to a file input (<input type="file">) element. Get the file input element index from browserGetState first.'),
    },
    browserGetTitle: {
      description: 'Get the current page title.',
      schema: z.object({}).describe('Get the current page title. Useful for verifying you are on the expected page.'),
    },
    browserGetHtml: {
      description: 'Get the full HTML source of the current page.',
      schema: z.object({}).describe('Get the full HTML source of the current page. Use sparingly — prefer browserGetState or browserGetText for targeted extraction.'),
    },
    browserGetText: {
      description: 'Get the text content of a specific element by index.',
      schema: z.object({
        index: z.string().describe('Element index number from browserGetState'),
      }).describe('Get the visible text content of a specific element by its index. Get element indices from browserGetState first.'),
    },
    browserGetValue: {
      description: 'Get the current value of an input or textarea element.',
      schema: z.object({
        index: z.string().describe('Element index number from browserGetState'),
      }).describe('Get the current value of an input, textarea, or select element by index. Use to verify what has been typed or selected.'),
    },
    browserGetAttributes: {
      description: 'Get all HTML attributes of an element by index.',
      schema: z.object({
        index: z.string().describe('Element index number from browserGetState'),
      }).describe('Get all HTML attributes (id, class, href, src, etc.) of an element by index. Useful for inspecting element properties.'),
    },
    browserWaitForSelector: {
      description: 'Wait for a CSS selector to appear on the page before continuing.',
      schema: z.object({
        selector: z.string().describe('CSS selector to wait for, e.g. "#results", ".loaded", "[data-ready]"'),
      }).describe('Wait for an element matching a CSS selector to appear in the DOM. Use after actions that trigger async page updates (form submissions, AJAX loads, navigation).'),
    },
    browserWaitForText: {
      description: 'Wait for specific text to appear on the page before continuing.',
      schema: z.object({
        text: z.string().describe('Text string to wait for on the page'),
      }).describe('Wait for specific text content to appear anywhere on the page. Use after actions that trigger async content changes, such as form submissions or loading states.'),
    },
    browserSwitchTab: {
      description: 'Switch to a different browser tab by its index.',
      schema: z.object({
        tab: z.string().describe('Tab index to switch to (0-based)'),
      }).describe('Switch focus to a different browser tab by its index. Use when links open in new tabs or when working across multiple pages.'),
    },
    browserCloseTab: {
      description: 'Close a browser tab.',
      schema: z.object({
        tab: z.string().optional().describe('Tab index to close. Omit to close the current tab.'),
      }).describe('Close a browser tab by index, or close the current tab if no index is given.'),
    },
    browserClose: {
      description: 'Close this browser session\'s tab.',
      schema: z.object({
        all: z.boolean().optional().describe('If true, close every tab opened by browser sessions in this process'),
      }).describe('Close the browser session\'s tab. Call this when you are done with browser automation to free resources. Chrome itself keeps running.'),
    },
    browserSessions: {
      description: 'List the open browser tabs.',
      schema: z.object({}).describe('List the open browser tabs with their index, URL and title, and which one this session drives.'),
    },
    browserSetHeaded: {
      description: 'Toggle browser visibility. Use headed mode to show the browser window, or headless mode to hide it.',
      schema: z.object({
        headed: z.boolean().describe('true to show the browser window (headed), false to hide it (headless)'),
      }).describe('Toggle the browser between headed (visible window) and headless mode. When the user asks to see the browser or hide it, use this tool.'),
    },
  }

  static { Feature.register(this, 'browserUse') }

  /**
   * When an assistant uses browserUse, inject system prompt guidance
   * about the browser interaction loop.
   */
  override setupToolsConsumer(consumer: Helper) {
    if (typeof (consumer as any).addSystemPromptExtension === 'function') {
      (consumer as any).addSystemPromptExtension('browserUse', [
        '## Browser Automation',
        '',
        '**The core loop:** `browserOpen` → `browserGetState` → interact → `browserGetState` again.',
        '',
        '`browserGetState` is your eyes. It returns all interactive elements with index numbers. You MUST call it:',
        '- After every `browserOpen` or navigation',
        '- After any action that changes the page (click, submit, scroll)',
        '- Before any interaction — to get fresh element indices',
        '',
        'Element indices change whenever the page updates. Never reuse indices from a previous `browserGetState` call after the page has changed.',
        '',
        '**Interacting with elements:** Use `browserInput` (click + type) for form fields. Use `browserClick` for buttons and links. Use `browserSelect` for dropdowns. All require an element index from `browserGetState`.',
        '',
        '**When things load asynchronously:** Use `browserWaitForSelector` or `browserWaitForText` after actions that trigger page updates (form submissions, AJAX). Then call `browserGetState` to see the updated page.',
        '',
        '**Debugging:** If an interaction doesn\'t work, take a `browserScreenshot` to see the actual page state. Check `browserGetState` to see what elements are available.',
        '',
        '**Cleanup:** Call `browserClose` when you\'re done to free resources.',
      ].join('\n'))
    }
  }

  override async afterInitialize() {
    if (this.options.session) this.state.set('session', this.options.session)
    if (this.options.headed) this.state.set('headed', true)
  }

  private conn: CdpConnection | null = null
  private sessionId: string | null = null
  /** In-flight ensurePage, shared so parallel tool calls attach once. */
  private ensuring: Promise<string> | null = null
  /** In-flight Chrome launch, shared so parallel calls launch Chrome once. */
  private launching: Promise<string> | null = null
  /** The Chrome this instance launched, so setHeaded can restart it. */
  private launched: { pid: number; headed: boolean } | null = null
  private lifecycle: { name: string; loaderId: string }[] = []
  /** JS dialogs auto-closed since the last getState, as "[type] message". */
  private closedDialogs: string[] = []
  /** backendNodeId -> node, from the latest getState. The index IS the backendNodeId. */
  private selectorMap = new Map<number, DomNode>()

  private get browserSource(): 'launch' | 'profile' | 'cdp' {
    if (this.options.browser) return this.options.browser
    if (this.options.launch) return 'launch'
    if (this.options.cdpUrl) return 'cdp'
    if (this.options.profile || this.options.connect) return 'profile'
    return 'launch'
  }

  private get debugPorts(): number[] {
    return this.options.debugPorts?.length ? this.options.debugPorts : DEFAULT_DEBUG_PORTS
  }

  private readText = (path: string): string | null => {
    const fs = this.container.feature('fs')
    try { return fs.exists(path) ? String(fs.readFile(path, 'utf8')) : null } catch { return null }
  }

  private get profileDirs(): string[] {
    const os = this.container.feature('os')
    return profileDirs(os.platform, process.env, os.homedir)
  }

  // --- Finding and launching Chrome -------------------------------------------

  /**
   * Find a debug Chrome already listening on one of the debug ports. Both
   * loopback families are probed, since a debug Chrome often binds only [::1].
   * @returns The browser websocket URL, or null when none answers
   *
   * @example
   * ```typescript
   * const ws = await browserUse.findDebugChrome() // 'ws://127.0.0.1:9222/devtools/browser/…' or null
   * ```
   */
  async findDebugChrome(): Promise<string | null> {
    for (const port of this.debugPorts) {
      for (const host of CDP_HOSTS) {
        const r = await probeVersion(host, port)
        if (r.kind === 'ok') return r.ws
      }
    }
    return null
  }

  /**
   * The Chrome executable to launch: the chromePath option, else the first
   * install found for this platform (macOS, Linux, Windows).
   * @returns An executable path, or null when none is installed
   *
   * @example
   * ```typescript
   * browserUse.findChromeExecutable() // '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
   * ```
   */
  findChromeExecutable(): string | null {
    if (this.options.chromePath) return this.options.chromePath
    const os = this.container.feature('os')
    const fs = this.container.feature('fs')
    for (const candidate of chromeExecutableCandidates(os.platform, process.env, os.homedir)) {
      // whichCommand hands the bare name back when the lookup fails.
      if (!/[\\/]/.test(candidate)) {
        const resolved = os.whichCommand(candidate)
        if (resolved !== candidate) return resolved
      } else if (fs.exists(candidate)) {
        return candidate
      }
    }
    return null
  }

  /**
   * Return the websocket URL of the debug Chrome, launching it when none is up.
   * Parallel callers share one launch.
   *
   * @example
   * ```typescript
   * const ws = await browserUse.ensureDebugChrome()
   * ```
   */
  async ensureDebugChrome(): Promise<string> {
    if (!this.launching) this.launching = this.findOrLaunchDebugChrome().finally(() => { this.launching = null })
    return this.launching
  }

  private async findOrLaunchDebugChrome(): Promise<string> {
    const running = await this.findDebugChrome()
    if (running) return running
    const executable = this.findChromeExecutable()
    if (!executable) throw new Error('No Chrome or Chromium install was found. Set the chromePath option to its executable.')

    const headed = !!this.state.get('headed')
    const userDataDir = this.options.userDataDir || this.container.paths.resolve(this.container.feature('os').homedir, '.chrome-debug')
    const args = [
      `--remote-debugging-port=${this.debugPorts[0]}`,
      `--user-data-dir=${userDataDir}`,
      '--no-first-run',
      '--no-default-browser-check',
    ]
    if (!headed) args.push('--headless=new', '--window-size=1280,900')
    const child = this.container.feature('proc').spawn(executable, args, { detached: true })
    // Chrome keeps its profile and sign-ins between runs, so it outlives us on purpose.
    child.on('error', () => {})
    child.unref()
    if (child.pid) this.launched = { pid: child.pid, headed }

    // Cold start against a large profile can take well over 10s to bind the port.
    const timeoutMs = this.options.launchTimeoutMs ?? 60_000
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
      const url = await this.findDebugChrome()
      if (url) return url
      await sleep(250)
    }
    throw new Error(`Debug Chrome did not come up on port ${this.debugPorts.join('/')} within ${Math.round(timeoutMs / 1000)}s`)
  }

  private async resolveWsUrl(): Promise<string> {
    switch (this.browserSource) {
      case 'cdp':
        if (!this.options.cdpUrl) throw new Error('browser: "cdp" needs the cdpUrl option')
        return resolveBrowserWsUrl(this.options.cdpUrl, { profileDirs: this.profileDirs, readText: this.readText })
      case 'profile':
        return findRealProfileBrowser(this.profileDirs, this.readText)
      default:
        return this.ensureDebugChrome()
    }
  }

  // --- Connection and tab -----------------------------------------------------

  /**
   * Connect (once per process) and attach to this session's own tab, opening
   * one if needed. A dropped connection is re-made on the next command, and in
   * launch mode a Chrome that went away is relaunched.
   * @returns The flat-mode CDP session id for the tab
   *
   * @example
   * ```typescript
   * const sessionId = await browserUse.ensurePage()
   * ```
   */
  async ensurePage(): Promise<string> {
    if (this.conn && !this.conn.closed && this.sessionId) return this.sessionId
    if (!this.ensuring) this.ensuring = this.attach().finally(() => { this.ensuring = null })
    return this.ensuring
  }

  private async connect(): Promise<CdpConnection> {
    if (this.conn && !this.conn.closed) return this.conn
    const wsUrl = await this.resolveWsUrl()
    const conn = await CdpConnection.connect(wsUrl)
    this.conn = conn
    this.state.set('wsUrl', wsUrl)
    this.state.set('connected', true)
    conn.onClose(() => {
      if (this.conn !== conn) return
      this.conn = null
      this.sessionId = null
      this.state.set('connected', false)
      this.emit('disconnected')
    })
    conn.on('Target.detachedFromTarget', (p) => { if (p.sessionId === this.sessionId) this.sessionId = null })
    conn.on('Inspector.targetCrashed', (_p, sid) => { if (sid === this.sessionId) this.sessionId = null })
    conn.on('Page.lifecycleEvent', (p, sid) => {
      if (sid !== this.sessionId) return
      this.lifecycle.push({ name: p.name, loaderId: p.loaderId })
      if (this.lifecycle.length > 200) this.lifecycle.splice(0, 100)
    })
    // An open alert() blocks the page's JS and every later command, so close
    // dialogs at once and report them in the next getState (as browser-use does).
    conn.on('Page.javascriptDialogOpening', (p, sid) => {
      if (sid !== this.sessionId) return
      if (p.message) this.closedDialogs.push(`[${p.type || 'alert'}] ${p.message}`)
      const accept = ['alert', 'confirm', 'beforeunload'].includes(p.type)
      conn.send('Page.handleJavaScriptDialog', { accept }, sid, 2000).catch(() => {})
    })
    return conn
  }

  private async attach(targetId?: string | null): Promise<string> {
    const conn = await this.connect()
    // Reuse this session's tab if it still exists, else open a fresh one.
    // Sharing the first page tab lets sessions clobber each other's navigation.
    let tid = targetId ?? this.state.get('targetId')
    if (tid) {
      const { targetInfos } = await conn.send('Target.getTargets')
      if (!targetInfos.some((t: any) => t.targetId === tid)) tid = null
    }
    if (!tid) {
      tid = (await conn.send('Target.createTarget', { url: 'about:blank' })).targetId as string
      openedTabs.add(tid)
    }
    this.state.set('targetId', tid)
    const { sessionId } = await conn.send('Target.attachToTarget', { targetId: tid, flatten: true })
    this.sessionId = sessionId
    this.selectorMap = new Map()
    // Domains must be re-enabled on every attach, or events silently stop.
    await Promise.all([
      conn.send('Page.enable', {}, sessionId),
      conn.send('Page.setLifecycleEventsEnabled', { enabled: true }, sessionId),
      conn.send('Inspector.enable', {}, sessionId).catch(() => {}),
    ])
    return sessionId
  }

  private async send(method: string, params: Record<string, any> = {}, timeoutMs?: number): Promise<any> {
    const sid = await this.ensurePage()
    return this.conn!.send(method, params, sid, timeoutMs)
  }

  /** Evaluate an expression in the page and return its value. */
  private async js(expression: string): Promise<any> {
    const r = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
    if (r.exceptionDetails) {
      const d = r.exceptionDetails
      throw new Error(d.exception?.description || d.text || 'JavaScript error')
    }
    return r?.result?.value
  }

  private async callOn(backendNodeId: number, functionDeclaration: string, args: any[] = []): Promise<any> {
    const { object } = await this.send('DOM.resolveNode', { backendNodeId })
    if (!object?.objectId) throw new Error('Failed to find DOM element based on backendNodeId, maybe page content changed?')
    const r = await this.send('Runtime.callFunctionOn', {
      objectId: object.objectId,
      functionDeclaration,
      arguments: args.map((value) => ({ value })),
      returnByValue: true,
    })
    return r?.result?.value
  }

  private node(index: string | number): DomNode | null {
    return this.selectorMap.get(Number(index)) ?? null
  }

  private notFound(index: string | number) {
    return fail(`Element index ${index} not found - page may have changed`)
  }

  /** Run a command and turn a thrown error into a failed result. */
  private async guard(fn: () => Promise<BrowserUseResult>): Promise<BrowserUseResult> {
    try {
      return await fn()
    } catch (e: any) {
      const msg = e instanceof Error ? e.message : String(e)
      return fail(this.browserSource === 'launch' && !this.conn ? `Browser unavailable: ${msg}` : msg)
    }
  }

  // --- Navigation -------------------------------------------------------------

  /**
   * Navigate this session's tab to a URL and wait for it to load.
   * @param url - The URL to open. A bare host gets https://
   *
   * @example
   * ```typescript
   * await browserUse.open('example.com')
   * ```
   */
  async open(url: string): Promise<BrowserUseResult> {
    return this.guard(async () => {
      if (!/^(https?|file):\/\//.test(url)) url = 'https://' + url
      const before = this.state.get('currentUrl') || ''
      const sameDomain = /^https?:/.test(url) && /^https?:/.test(before) && url.split('/')[2] === before.split('/')[2]
      const sid = await this.ensurePage()
      this.lifecycle = []
      const nav = await this.conn!.send('Page.navigate', { url, transitionType: 'address_bar' }, sid, 20_000)
      if (nav.errorText) return fail(`Navigation failed: ${nav.errorText}`)
      // Wait for load or network idle. A timeout is not an error: slow pages
      // are still usable, same as browser-use.
      const deadline = Date.now() + (sameDomain ? 3000 : 8000)
      while (Date.now() < deadline) {
        if (this.lifecycle.some((e) => (e.name === 'load' || e.name === 'networkIdle') && (!nav.loaderId || e.loaderId === nav.loaderId))) break
        await sleep(50)
      }
      this.state.set('currentUrl', url)
      this.emit('navigated', url)
      return ok({ url })
    })
  }

  /** Go back in browser history */
  async back(): Promise<BrowserUseResult> {
    return this.guard(async () => {
      const h = await this.send('Page.getNavigationHistory')
      if (h.currentIndex > 0) {
        await this.send('Page.navigateToHistoryEntry', { entryId: h.entries[h.currentIndex - 1].id })
        await sleep(500)
      }
      return ok({ back: true })
    })
  }

  /**
   * Scroll the page
   * @param direction - 'up' or 'down'
   * @param amount - Pixels to scroll (default 500)
   */
  async scroll(direction: 'up' | 'down' = 'down', amount?: number): Promise<BrowserUseResult> {
    return this.guard(async () => {
      const px = amount || 500
      await this.js(`window.scrollBy(0, ${direction === 'up' ? -px : px})`)
      return ok({ scrolled: direction, amount: px })
    })
  }

  // --- Page state ---------------------------------------------------------------

  /**
   * Get the page state: viewport info and every interactive element with its
   * index. The text matches browser-use's `state` output.
   *
   * @example
   * ```typescript
   * const state = await browserUse.getState()
   * console.log(state.data._raw_text)
   * ```
   */
  async getState(): Promise<BrowserUseResult> {
    return this.guard(async () => {
      const sid = await this.ensurePage()
      const pageUrl = String(await this.js('location.href'))
      const empty = () => llmRepresentation({ root: null, selectorMap: new Map() })
      if (!/^https?:/i.test(pageUrl)) {
        this.selectorMap = new Map()
        return ok({ _raw_text: empty() })
      }
      let text: string
      try {
        const trees = await getAllTrees(this.conn!, sid)
        const root = buildEnhancedTree(trees, sid)
        countHiddenElementsInIframes(root)
        const serialized = new DomTreeSerializer(root, { sessionId: sid }).serializeAccessibleElements()
        this.selectorMap = serialized.selectorMap
        text = llmRepresentation(serialized)
      } catch {
        this.selectorMap = new Map()
        text = empty()
      }
      try {
        const m = await this.conn!.send('Page.getLayoutMetrics', {}, sid)
        const css = m.cssLayoutViewport || {}
        const content = m.cssContentSize || m.contentSize || {}
        const vv = m.cssVisualViewport || m.visualViewport || {}
        const int = (n: any) => Math.trunc(Number(n) || 0)
        text = `viewport: ${int(css.clientWidth)}x${int(css.clientHeight)}\n` +
          `page: ${int(content.width)}x${int(content.height)}\n` +
          `scroll: (${int(vv.pageX)}, ${int(vv.pageY)})\n` + text
      } catch {}
      if (this.closedDialogs.length) {
        text += '\nAuto-closed dialogs:\n' + this.closedDialogs.map((m) => `  ${m}\n`).join('')
        this.closedDialogs = []
      }
      return ok({ _raw_text: text })
    })
  }

  /**
   * Take a screenshot
   * @param options - Optional path and full-page flag
   * @returns Base64 PNG data, or the saved path
   */
  async screenshot(options: { path?: string; full?: boolean } = {}): Promise<BrowserUseResult> {
    return this.guard(async () => {
      const r = await this.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: !!options.full })
      if (!r?.data) return fail('Screenshot failed - no data returned')
      const bytes = Buffer.from(r.data, 'base64')
      if (options.path) {
        const path = this.container.paths.resolve(options.path)
        await this.container.feature('fs').writeFileAsync(path, bytes)
        this.emit('screenshot', path)
        return ok({ saved: path, size: bytes.length })
      }
      this.emit('screenshot', 'base64')
      return ok({ screenshot: r.data, size: bytes.length })
    })
  }

  /**
   * Execute JavaScript in the page context
   * @param js - JavaScript expression to evaluate. Promises are awaited
   */
  async evaluate(js: string): Promise<BrowserUseResult> {
    return this.guard(async () => ok({ result: await this.js(js) }))
  }

  /**
   * Get the readable text of the page, with the query, so the calling model
   * can answer it. browser-use's own `extract` was never implemented, so this
   * hands the text back instead of calling a second LLM.
   * @param query - What to find on the page
   */
  async extract(query: string): Promise<BrowserUseResult> {
    return this.guard(async () => {
      const max = 50_000
      const text = String(await this.js('document.body ? document.body.innerText : ""') ?? '')
      return ok({ query, url: await this.js('location.href'), content: text.slice(0, max), truncated: text.length > max })
    })
  }

  /** Get the current page title */
  async getTitle(): Promise<BrowserUseResult> {
    return this.guard(async () => ok({ title: (await this.js('document.title')) || '' }))
  }

  /**
   * Get the page HTML, or one element's outerHTML
   * @param selector - Optional CSS selector
   */
  async getHtml(selector?: string): Promise<BrowserUseResult> {
    return this.guard(async () => {
      const expr = selector
        ? `(function(){ const el = document.querySelector(${JSON.stringify(selector)}); return el ? el.outerHTML : null; })()`
        : 'document.documentElement.outerHTML'
      return ok({ html: (await this.js(expr)) || '' })
    })
  }

  /**
   * Get text content of an element
   * @param index - Element index
   */
  async getText(index: string): Promise<BrowserUseResult> {
    const node = this.node(index)
    if (!node) return this.notFound(index)
    return ok({ index: Number(index), text: allChildrenText(node, 10) })
  }

  /**
   * Get the value of an input or textarea element
   * @param index - Element index
   */
  async getValue(index: string): Promise<BrowserUseResult> {
    const node = this.node(index)
    if (!node) return this.notFound(index)
    try {
      const value = await this.callOn(node.backendNodeId, 'function() { return this.value; }')
      return ok({ index: Number(index), value: value || '' })
    } catch {
      return ok({ index: Number(index), value: '' })
    }
  }

  /**
   * Get all attributes of an element
   * @param index - Element index
   */
  async getAttributes(index: string): Promise<BrowserUseResult> {
    const node = this.node(index)
    if (!node) return this.notFound(index)
    return ok({ index: Number(index), attributes: { ...node.attributes } })
  }

  /**
   * Wait for a CSS selector to become visible
   * @param selector - CSS selector
   * @param timeoutMs - Give up after this long (default 30000)
   */
  async waitForSelector(selector: string, timeoutMs = 30_000): Promise<BrowserUseResult> {
    const s = JSON.stringify(selector)
    return this.poll(`(function() {
      const el = document.querySelector(${s});
      if (!el) return false;
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0' && rect.width > 0 && rect.height > 0;
    })()`, timeoutMs, { selector })
  }

  /**
   * Wait for text to appear on the page
   * @param text - Text to wait for
   * @param timeoutMs - Give up after this long (default 30000)
   */
  async waitForText(text: string, timeoutMs = 30_000): Promise<BrowserUseResult> {
    return this.poll(`document.body ? document.body.innerText.includes(${JSON.stringify(text)}) : false`, timeoutMs, { text })
  }

  /** Not finding it is a successful answer (found: false), as in browser-use. */
  private async poll(expression: string, timeoutMs: number, data: Record<string, any>): Promise<BrowserUseResult> {
    return this.guard(async () => {
      const deadline = Date.now() + timeoutMs
      while (Date.now() < deadline) {
        try { if (await this.js(expression)) return ok({ ...data, found: true }) } catch {}
        await sleep(100)
      }
      return ok({ ...data, found: false })
    })
  }

  // --- Mouse --------------------------------------------------------------------

  /**
   * Click an element by index (from getState) or by "x y" coordinates.
   *
   * @example
   * ```typescript
   * await browserUse.click('21')       // element 21
   * await browserUse.click('100 200')  // coordinates
   * ```
   */
  async click(target: string): Promise<BrowserUseResult> {
    return this.guard(async () => {
      const args = String(target).trim().split(/\s+/).map(Number)
      if (args.length === 2 && args.every(Number.isFinite)) {
        await this.mouseClick(args[0]!, args[1]!)
        this.emit('clicked', target)
        return ok({ clicked_coordinate: { x: args[0], y: args[1] } })
      }
      if (args.length !== 1 || !Number.isInteger(args[0])) return fail('Usage: click <index> or click <x> <y>')
      const node = this.node(args[0]!)
      if (!node) return this.notFound(args[0]!)
      const r = await this.clickNode(node)
      if (r && 'validation_error' in r) return fail(r.validation_error)
      this.emit('clicked', target)
      return ok({ clicked: args[0] })
    })
  }

  /**
   * Hover over an element
   * @param index - Element index
   */
  async hover(index: string): Promise<BrowserUseResult> {
    return this.atElement(index, 'hover', async (x, y) => {
      await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y })
      return { hovered: Number(index) }
    })
  }

  /**
   * Double-click an element
   * @param index - Element index
   */
  async dblclick(index: string): Promise<BrowserUseResult> {
    return this.atElement(index, 'double-click', async (x, y) => {
      await this.mouseClick(x, y, 'left', 2)
      return { double_clicked: Number(index) }
    })
  }

  /**
   * Right-click an element
   * @param index - Element index
   */
  async rightclick(index: string): Promise<BrowserUseResult> {
    return this.atElement(index, 'right-click', async (x, y) => {
      await this.mouseClick(x, y, 'right', 1)
      return { right_clicked: Number(index) }
    })
  }

  /** Scroll an element into view, find its center, then act there. */
  private async atElement(index: string, what: string, act: (x: number, y: number) => Promise<Record<string, any>>) {
    return this.guard(async () => {
      const node = this.node(index)
      if (!node) return this.notFound(index)
      try { await this.send('DOM.scrollIntoViewIfNeeded', { backendNodeId: node.backendNodeId }); await sleep(50) } catch {}
      const rect = await this.elementRect(node.backendNodeId)
      if (!rect) return fail(`Could not get element coordinates for ${what}`)
      return ok(await act(rect.x + rect.width / 2, rect.y + rect.height / 2))
    })
  }

  private async mouseClick(x: number, y: number, button: 'left' | 'right' = 'left', clickCount = 1) {
    await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y })
    await sleep(50)
    await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button, clickCount }, 3000).catch(() => {})
    await sleep(button === 'left' && clickCount === 1 ? 80 : 50)
    await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button, clickCount }, 5000).catch(() => {})
  }

  private async jsClick(backendNodeId: number) {
    await this.callOn(backendNodeId, 'function() { this.click(); }')
    await sleep(50)
  }

  /** Element rect in viewport CSS pixels: content quads, then box model, then getBoundingClientRect. */
  private async elementRect(backendNodeId: number): Promise<{ x: number; y: number; width: number; height: number } | null> {
    let quads: number[][] = []
    try {
      const r = await this.send('DOM.getContentQuads', { backendNodeId })
      if (r.quads?.length) quads = r.quads
    } catch {}
    if (!quads.length) {
      try {
        const r = await this.send('DOM.getBoxModel', { backendNodeId })
        if (r.model?.content?.length >= 8) quads = [r.model.content]
      } catch {}
    }
    if (quads.length) {
      // Prefer the quad with the most area inside the viewport (a wrapped link
      // has one quad per line, and the first may be off screen).
      let best = quads[0]!
      try {
        const m = await this.send('Page.getLayoutMetrics')
        const vw = m.layoutViewport.clientWidth, vh = m.layoutViewport.clientHeight
        let bestArea = 0
        for (const q of quads) {
          if (q.length < 8) continue
          const xs = [q[0]!, q[2]!, q[4]!, q[6]!], ys = [q[1]!, q[3]!, q[5]!, q[7]!]
          const w = Math.min(vw, Math.max(...xs)) - Math.max(0, Math.min(...xs))
          const h = Math.min(vh, Math.max(...ys)) - Math.max(0, Math.min(...ys))
          if (w > 0 && h > 0 && w * h > bestArea) { bestArea = w * h; best = q }
        }
      } catch {}
      const xs = [best[0]!, best[2]!, best[4]!, best[6]!]
      const ys = [best[1]!, best[3]!, best[5]!, best[7]!]
      const x = Math.min(...xs), y = Math.min(...ys)
      return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y }
    }
    try {
      const v = await this.callOn(backendNodeId, 'function() { const r = this.getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; }')
      if (v && v.width > 0 && v.height > 0) return v
    } catch {}
    return null
  }

  /** True when something else sits on top of the element at (x, y). */
  private async isOccluded(backendNodeId: number, x: number, y: number): Promise<boolean> {
    try {
      return (await this.callOn(backendNodeId, OCCLUSION_JS, [x, y])) !== true
    } catch {
      return true
    }
  }

  /** Port of browser-use's _click_element_node_impl, with its fallbacks. */
  private async clickNode(node: DomNode): Promise<{ validation_error: string } | Record<string, any> | null> {
    const tag = node.tagName
    const type = (node.attributes['type'] ?? '').toLowerCase()
    const id = node.backendNodeId
    if (tag === 'select') return { validation_error: `Cannot click on <select> elements. Use browserSelect(index=${id}) instead.` }
    if (tag === 'input' && type === 'file') return { validation_error: `Cannot click on file input element (index=${id}). Use browserUpload instead.` }

    // Checkboxes: verify the click toggled, fall back to a JS click if not.
    const isToggle = tag === 'input' && (type === 'checkbox' || type === 'radio')
    const readChecked = () => this.callOn(id, 'function() { return this.checked; }').catch(() => null)
    const preChecked = isToggle ? await readChecked() : null

    const metrics = await this.send('Page.getLayoutMetrics')
    const vw = metrics.layoutViewport.clientWidth
    const vh = metrics.layoutViewport.clientHeight
    try { await this.send('DOM.scrollIntoViewIfNeeded', { backendNodeId: id }); await sleep(50) } catch {}

    const rect = await this.elementRect(id)
    if (!rect) { await this.jsClick(id); return null }
    const cx = Math.max(0, Math.min(vw - 1, rect.x + rect.width / 2))
    const cy = Math.max(0, Math.min(vh - 1, rect.y + rect.height / 2))

    if (await this.isOccluded(id, cx, cy)) { await this.jsClick(id); return null }
    try {
      await this.mouseClick(cx, cy)
      if (isToggle && preChecked !== null) {
        await sleep(50)
        let post = await readChecked()
        if (post === preChecked) {
          await this.jsClick(id)
          post = await readChecked()
        }
        return { click_x: cx, click_y: cy, checked: post }
      }
      return { click_x: cx, click_y: cy }
    } catch {
      await this.jsClick(id)
      return null
    }
  }

  // --- Keyboard -----------------------------------------------------------------

  /**
   * Type text at the current focus
   * @param text - Text to type
   */
  async type(text: string): Promise<BrowserUseResult> {
    return this.guard(async () => {
      await this.send('Input.insertText', { text })
      this.emit('typed', text)
      return ok({ typed: text })
    })
  }

  /**
   * Click an element, clear it, and type into it. Pass "" to clear only.
   * @param index - Element index
   * @param text - Text to enter
   */
  async input(index: string, text: string): Promise<BrowserUseResult> {
    return this.guard(async () => {
      const node = this.node(index)
      if (!node) return this.notFound(index)
      await this.clickNode(node)
      let actual: any
      try {
        actual = await this.inputText(node, text)
      } catch {
        // Fallback, as in browser-use: click again and type at the focus.
        try { await this.clickNode(node) } catch {}
        await this.typeToPage(text)
      }
      this.emit('typed', text)
      const data: Record<string, any> = { input: text, element: Number(index) }
      if (typeof actual === 'string' && actual !== text) data.actual_value = actual
      return ok(data)
    })
  }

  private async key(type: string, params: Record<string, any>) {
    await this.send('Input.dispatchKeyEvent', { type, ...params })
  }

  private async typeChar(char: string) {
    if (char === '\n') {
      await this.key('keyDown', { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
      await this.key('char', { text: '\r', key: 'Enter' })
      await this.key('keyUp', { key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
      return
    }
    const [modifiers, vk, base] = charModifiersAndVk(char)
    const code = keyCodeForChar(base)
    await this.key('keyDown', { key: base, code, modifiers, windowsVirtualKeyCode: vk })
    await sleep(5)
    await this.key('char', { text: char, key: char })
    await this.key('keyUp', { key: base, code, modifiers, windowsVirtualKeyCode: vk })
  }

  private async typeToPage(text: string) {
    for (const char of text) {
      await this.typeChar(char)
      await sleep(10)
    }
  }

  /** Port of browser-use's _input_text_element_node_impl. Returns the value read back. */
  private async inputText(node: DomNode, text: string): Promise<any> {
    const id = node.backendNodeId
    try { await this.send('DOM.scrollIntoViewIfNeeded', { backendNodeId: id }); await sleep(10) } catch {}
    const { object } = await this.send('DOM.resolveNode', { backendNodeId: id })
    const objectId = object?.objectId
    if (!objectId) throw new Error('Failed to find DOM element based on backendNodeId, maybe page content changed?')
    const on = async (fn: string, args: any[] = []) =>
      (await this.send('Runtime.callFunctionOn', { objectId, functionDeclaration: fn, arguments: args.map((value) => ({ value })), returnByValue: true }))?.result?.value

    // Focus: DOM.focus, else a click at the center if nothing covers it.
    let coords: { x: number; y: number } | null = null
    const rect = await this.elementRect(id)
    if (rect) {
      const x = rect.x + rect.width / 2, y = rect.y + rect.height / 2
      if (!(await this.isOccluded(id, x, y))) coords = { x, y }
    }
    try {
      await this.send('DOM.focus', { backendNodeId: id })
    } catch {
      if (coords) {
        await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: coords.x, y: coords.y, button: 'left', clickCount: 1 }).catch(() => {})
        await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: coords.x, y: coords.y, button: 'left', clickCount: 1 }).catch(() => {})
      }
    }

    // Date pickers, color and range inputs reject partial typing; set the value outright.
    if (requiresDirectValue(node)) return on(SET_VALUE_JS, [text])

    await this.clearField(on, coords)

    const attrs = node.attributes
    const isContentEditable = attrs['contenteditable'] === 'true' || attrs['contenteditable'] === '' ||
      (attrs['role'] === 'textbox' && node.tagName !== 'input' && node.tagName !== 'textarea')
    const first = isContentEditable && text.length > 0 ? [...text][0]! : null

    let i = 0
    for (const char of text) {
      await this.typeChar(char)
      // Some rich editors swallow the first keystroke after a clear. Retype it.
      if (i === 0 && first) {
        const content = await this.js('document.activeElement ? document.activeElement.textContent : ""').catch(() => '')
        if (!String(content ?? '').includes(first)) await this.typeChar(first)
      }
      i++
      await sleep(1)
    }
    await on(FRAMEWORK_EVENTS_JS).catch(() => {})

    await sleep(50)
    let actual = await on('function() { return this.value !== undefined ? this.value : this.textContent; }').catch(() => null)
    // An autocomplete or formatter doubled the text: set it directly once.
    if (typeof actual === 'string' && actual !== text && actual.length > text.length && (actual.endsWith(text) || actual.startsWith(text))) {
      actual = await on(FORCE_VALUE_JS, [text]).catch(() => actual)
    }
    return actual
  }

  /** browser-use's three clearing strategies: JS, triple-click + Delete, select-all + Backspace. */
  private async clearField(on: (fn: string, args?: any[]) => Promise<any>, coords: { x: number; y: number } | null) {
    try {
      const info = await on(CLEAR_JS)
      if (info?.cleared && !String(info.finalText ?? '').trim()) return
    } catch {
      return
    }
    try {
      const b = await on('function() { const r = this.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }')
      const x = b ? b.x + b.width / 2 : coords?.x, y = b ? b.y + b.height / 2 : coords?.y
      if (x !== undefined && y !== undefined) {
        await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 3 })
        await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 3 })
        await this.key('keyDown', { key: 'Delete', code: 'Delete' })
        await this.key('keyUp', { key: 'Delete', code: 'Delete' })
        return
      }
    } catch {}
    const mod = this.container.feature('os').platform === 'darwin' ? 4 : 2
    await this.key('keyDown', { key: 'a', code: 'KeyA', modifiers: mod })
    await this.key('keyUp', { key: 'a', code: 'KeyA', modifiers: mod })
    await this.key('keyDown', { key: 'Backspace', code: 'Backspace' })
    await this.key('keyUp', { key: 'Backspace', code: 'Backspace' })
  }

  private async namedKey(type: 'keyDown' | 'keyUp', key: string, modifiers = 0) {
    const [code, vk] = getKeyInfo(key)
    const params: Record<string, any> = { key, code }
    if (modifiers) params.modifiers = modifiers
    if (vk !== null) params.windowsVirtualKeyCode = vk
    await this.key(type, params)
  }

  /**
   * Send keyboard keys
   * @param keys - A key or combination, e.g. "Enter", "Escape", "Control+a", "cmd+shift+k"
   */
  async keys(keys: string): Promise<BrowserUseResult> {
    return this.guard(async () => {
      const normalized = normalizeKeys(keys)
      if (normalized.includes('+')) {
        const parts = normalized.split('+')
        const mods = parts.slice(0, -1)
        const main = parts[parts.length - 1]!
        const bits = mods.reduce((b, m) => b | (MODIFIER_BITS[m] ?? 0), 0)
        for (const m of mods) await this.namedKey('keyDown', m)
        await this.namedKey('keyDown', main, bits)
        await this.namedKey('keyUp', main, bits)
        for (const m of [...mods].reverse()) await this.namedKey('keyUp', m)
      } else if (SPECIAL_KEYS.has(normalized)) {
        await this.namedKey('keyDown', normalized)
        if (normalized === 'Enter') await this.key('char', { text: '\r', key: 'Enter' })
        await this.namedKey('keyUp', normalized)
      } else {
        for (const char of normalized) {
          if (char === '\n' || char === '\r') {
            for (const type of ['rawKeyDown', 'char', 'keyUp']) await this.key(type, { windowsVirtualKeyCode: 13, unmodifiedText: '\r', text: '\r' })
            continue
          }
          const [modifiers, vk, base] = charModifiersAndVk(char)
          const code = keyCodeForChar(base)
          await this.key('keyDown', { key: base, code, modifiers, windowsVirtualKeyCode: vk })
          await this.key('char', { text: char, key: char })
          await this.key('keyUp', { key: base, code, modifiers, windowsVirtualKeyCode: vk })
          await sleep(10)
        }
      }
      if (/enter|return/i.test(keys)) await sleep(100)
      return ok({ sent: keys })
    })
  }

  // --- Forms ----------------------------------------------------------------------

  /**
   * Select a dropdown option by its text or value (case-insensitive).
   * Works on native selects, ARIA listboxes/menus, and Semantic UI dropdowns.
   * @param index - Element index of the dropdown
   * @param value - Option text or value to select
   */
  async select(index: string, value: string): Promise<BrowserUseResult> {
    return this.guard(async () => {
      const node = this.node(index)
      if (!node) return this.notFound(index)
      const id = node.backendNodeId
      let r = await this.callOn(id, SELECT_JS, [value]) ?? {}
      const opts: any[] = r.availableOptions || []
      // Options can load lazily on focus: focus, wait, try once more.
      if (!r.success && opts.length && opts.every((o) => !String(o.text ?? '').trim() && !String(o.value ?? '').trim())) {
        await this.callOn(id, 'function() { this.focus(); }').catch(() => {})
        await sleep(1000)
        r = await this.callOn(id, SELECT_JS, [value]) ?? {}
      }
      if (r.selectionReverted) {
        const fb = await this.callOn(id, SELECT_CLICK_FALLBACK_JS, [r.targetOption?.index ?? 0]) ?? {}
        if (fb.success) return ok({ selected: fb.value ?? value, element: Number(index), message: fb.message })
      }
      if (r.success) return ok({ selected: r.value ?? value, element: Number(index), message: r.message })
      const available = (r.availableOptions || []).map((o: any) => String(o.text || o.value || '').trim()).filter(Boolean)
      return fail(r.error || `Failed to select option: ${value}`, available.length ? { availableOptions: available } : {})
    })
  }

  /**
   * Upload a file to a file input. The index can be the input itself or a
   * nearby element (a styled "Choose file" button), as in browser-use.
   * @param index - Element index of the file input, or an element near it
   * @param path - Local file path to upload
   */
  async upload(index: string, path: string): Promise<BrowserUseResult> {
    return this.guard(async () => {
      const fs = this.container.feature('fs')
      const abs = this.container.paths.resolve(path)
      if (!fs.exists(abs)) return fail(`File not found: ${path}`)
      const stat = await fs.statAsync(abs).catch(() => null)
      if (stat && !stat.isFile()) return fail(`Not a file: ${path}`)
      if (stat && stat.size === 0) return fail(`File is empty (0 bytes): ${path}`)
      const node = this.node(index)
      if (!node) return this.notFound(index)
      const input = findFileInputNear(node)
      if (!input) {
        const hits = [...this.selectorMap.entries()].filter(([, n]) => isFileInput(n)).map(([i]) => i)
        return fail(`Element ${index} is not a file input.${hits.length ? ` File input(s) found at index: ${hits.join(', ')}` : ' No file input found on the page.'}`)
      }
      await this.send('DOM.setFileInputFiles', { files: [abs], backendNodeId: input.backendNodeId })
      return ok({ uploaded: abs, element: Number(index) })
    })
  }

  // --- Tabs and sessions --------------------------------------------------------

  private async pageTargets(): Promise<any[]> {
    const conn = await this.connect()
    const { targetInfos } = await conn.send('Target.getTargets')
    return targetInfos.filter((t: any) => t.type === 'page')
  }

  /**
   * List open tabs, with the one this session drives marked.
   *
   * @example
   * ```typescript
   * const { data } = await browserUse.tabs()
   * ```
   */
  async tabs(): Promise<BrowserUseResult> {
    return this.guard(async () => {
      const mine = this.state.get('targetId')
      const tabs = (await this.pageTargets()).map((t, i) => ({ index: i, url: t.url, title: t.title, current: t.targetId === mine }))
      return ok({ tabs })
    })
  }

  /**
   * Make this session drive another tab, by index from tabs().
   * @param tab - Tab index (0-based)
   */
  async switchTab(tab: string): Promise<BrowserUseResult> {
    return this.guard(async () => {
      const pages = await this.pageTargets()
      const i = Number(tab)
      if (!Number.isInteger(i) || i < 0 || i >= pages.length) return fail(`Invalid tab index ${tab}. Available: 0-${pages.length - 1}`)
      this.sessionId = null
      await this.attach(pages[i].targetId)
      await this.conn!.send('Target.activateTarget', { targetId: pages[i].targetId }).catch(() => {})
      this.state.set('currentUrl', pages[i].url)
      return ok({ switched: i, url: pages[i].url })
    })
  }

  /**
   * Close a tab
   * @param tab - Tab index (closes this session's tab if omitted)
   */
  async closeTab(tab?: string): Promise<BrowserUseResult> {
    return this.guard(async () => {
      const conn = await this.connect()
      const mine = this.state.get('targetId')
      let targetId = mine
      let i = 0
      if (tab !== undefined && tab !== '') {
        const pages = await this.pageTargets()
        i = Number(tab)
        if (!Number.isInteger(i) || i < 0 || i >= pages.length) return fail(`Tab ${tab} out of range`)
        targetId = pages[i].targetId
      }
      if (!targetId) return fail('No focused tab to close')
      await conn.send('Target.closeTarget', { targetId })
      openedTabs.delete(targetId)
      if (targetId === mine) {
        this.sessionId = null
        this.selectorMap = new Map()
        this.state.set('targetId', null)
      }
      return ok({ closed: [i] })
    })
  }

  /**
   * Close this session's tab and the CDP connection. Chrome keeps running.
   * @param all - Also close every other tab opened by browserUse in this process
   */
  async close(all?: boolean): Promise<BrowserUseResult> {
    const conn = this.conn
    const mine = this.state.get('targetId')
    const targets = all ? [...openedTabs] : mine ? [mine] : []
    try {
      if (conn && !conn.closed) {
        for (const t of targets) {
          await conn.send('Target.closeTarget', { targetId: t }, undefined, 5000).catch(() => {})
          openedTabs.delete(t)
        }
      }
    } finally {
      conn?.close()
      this.conn = null
      this.sessionId = null
      this.selectorMap = new Map()
      this.state.set('targetId', null)
      this.state.set('connected', false)
      this.emit('closed')
    }
    return ok({ closed: true, tabs: targets.length })
  }

  /** List open tabs. Kept as `sessions` for the browserSessions tool; see tabs(). */
  async sessions(): Promise<BrowserUseResult> {
    return this.tabs()
  }

  /**
   * Show or hide the browser window (launch mode). A running Chrome can't
   * switch, so a Chrome this instance launched is restarted in the new mode
   * on the next command. Sign-ins survive, since the profile is kept.
   * @param headed - true for a visible window, false for headless
   */
  async setHeaded(headed: boolean): Promise<{ success: boolean; headed: boolean; note?: string }> {
    this.state.set('headed', headed)
    if (this.browserSource !== 'launch') return { success: true, headed, note: 'Only launch mode starts Chrome; this browser was not launched by browserUse.' }
    const launched = this.launched
    if (launched && launched.headed !== headed) {
      await this.close()
      this.container.feature('proc').kill(launched.pid)
      this.launched = null
      // Wait for the old Chrome to release its port and profile lock.
      for (let i = 0; i < 40 && (await this.findDebugChrome()); i++) await sleep(250)
      return { success: true, headed }
    }
    if (!launched && this.conn) return { success: true, headed, note: 'Chrome was already running when browserUse connected, so its window mode was left alone.' }
    return { success: true, headed }
  }

  // --- Tool handlers (matched by name to static tools) ---

  async browserOpen(options: { url: string }) { return this.open(options.url) }
  async browserClick(options: { target: string }) { return this.click(options.target) }
  async browserType(options: { text: string }) { return this.type(options.text) }
  async browserInput(options: { index: string; text: string }) { return this.input(options.index, options.text) }
  async browserGetState() { return this.getState() }
  async browserScreenshot(options: { path?: string; full?: boolean }) { return this.screenshot(options) }
  async browserEval(options: { js: string }) { return this.evaluate(options.js) }
  async browserExtract(options: { query: string }) { return this.extract(options.query) }
  async browserScroll(options: { direction: 'up' | 'down'; amount?: number }) { return this.scroll(options.direction, options.amount) }
  async browserKeys(options: { keys: string }) { return this.keys(options.keys) }
  async browserBack() { return this.back() }
  async browserGetTitle() { return this.getTitle() }
  async browserGetHtml() { return this.getHtml() }
  async browserGetText(options: { index: string }) { return this.getText(options.index) }
  async browserSelect(options: { index: string; value: string }) { return this.select(options.index, options.value) }
  async browserWaitForSelector(options: { selector: string }) { return this.waitForSelector(options.selector) }
  async browserWaitForText(options: { text: string }) { return this.waitForText(options.text) }
  async browserSwitchTab(options: { tab: string }) { return this.switchTab(options.tab) }
  async browserCloseTab(options: { tab?: string }) { return this.closeTab(options.tab) }
  async browserClose(options: { all?: boolean }) { return this.close(options.all) }
  async browserSessions() { return this.sessions() }
  async browserHover(options: { index: string }) { return this.hover(options.index) }
  async browserDblclick(options: { index: string }) { return this.dblclick(options.index) }
  async browserRightclick(options: { index: string }) { return this.rightclick(options.index) }
  async browserUpload(options: { index: string; path: string }) { return this.upload(options.index, options.path) }
  async browserGetValue(options: { index: string }) { return this.getValue(options.index) }
  async browserGetAttributes(options: { index: string }) { return this.getAttributes(options.index) }
  async browserSetHeaded(options: { headed: boolean }) { return this.setHeaded(options.headed) }
}

export default BrowserUse
