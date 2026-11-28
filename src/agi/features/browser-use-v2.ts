import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from '../../schemas/base.js'
import { Feature } from '../feature.js'
import { CdpConnection } from '../lib/cdp/connection.js'
import {
  CDP_HOSTS, DEFAULT_DEBUG_PORTS, chromeExecutableCandidates, findRealProfileBrowser,
  probeVersion, profileDirs, resolveBrowserWsUrl,
} from '../lib/cdp/discovery.js'
import { buildEnhancedTree, getAllTrees, type DomNode } from '../lib/cdp/dom-tree.js'
import { DomTreeSerializer, countHiddenElementsInIframes, llmRepresentation } from '../lib/cdp/dom-serializer.js'

declare module 'luca/feature' {
  interface AvailableFeatures {
    browserUseV2: typeof BrowserUseV2
  }
}

export const BrowserUseV2StateSchema = FeatureStateSchema.extend({
  session: z.string().default('default').describe('Session name. Each session drives its own tab'),
  currentUrl: z.string().optional().describe('The current page URL'),
  wsUrl: z.string().nullable().default(null).describe('Browser websocket URL of the connected Chrome'),
  targetId: z.string().nullable().default(null).describe('CDP target id of this session\'s tab'),
  connected: z.boolean().default(false).describe('Whether a CDP connection is open'),
})
export type BrowserUseV2State = z.infer<typeof BrowserUseV2StateSchema>

export const BrowserUseV2OptionsSchema = FeatureOptionsSchema.extend({
  session: z.string().optional().describe('Session name. Each session gets its own tab, so sessions sharing one browser do not clobber each other'),
  browser: z.enum(['launch', 'profile', 'cdp']).optional().describe('Where the browser comes from. launch (default): find or start a dedicated debug Chrome with its own profile. profile: attach to your everyday Chrome after you turn on chrome://inspect/#remote-debugging (Chrome 144+; Chrome asks you to Allow each connection). cdp: connect to cdpUrl. Setting cdpUrl implies cdp'),
  cdpUrl: z.string().optional().describe('Connect to an existing browser via CDP URL (http:// debug address or ws:// browser URL)'),
  headless: z.boolean().optional().describe('Launch mode: start Chrome headless. Default false, so you can sign into sites in the debug profile'),
  chromePath: z.string().optional().describe('Chrome or Chromium executable for launch mode. Default: found per platform (macOS, Linux, Windows)'),
  userDataDir: z.string().optional().describe('Chrome profile folder for launch mode (default ~/.chrome-debug). Chrome 136+ refuses remote debugging on the default profile, so this must be a separate folder'),
  debugPorts: z.array(z.number()).optional().describe('Ports a debug Chrome may already listen on, for launch mode. The first is used when launching (default [9222, 9223, 9229])'),
  launchTimeoutMs: z.number().optional().describe('How long launch mode waits for a fresh Chrome to bind its debug port (default 60000)'),
})
export type BrowserUseV2Options = z.infer<typeof BrowserUseV2OptionsSchema>

export const BrowserUseV2EventsSchema = FeatureEventsSchema.extend({
  navigated: z.tuple([z.string().describe('URL navigated to')]).describe('Emitted after navigating to a URL'),
  clicked: z.tuple([z.string().describe('Target description')]).describe('Emitted after clicking an element'),
  disconnected: z.tuple([]).describe('Emitted when the CDP connection drops'),
  closed: z.tuple([]).describe('Emitted when the session tab is closed'),
})

/** Same result shape as browserUse, so callers can switch between them. */
export interface BrowserUseV2Result {
  success: boolean
  data: Record<string, any>
}

const ok = (data: Record<string, any>): BrowserUseV2Result => ({ success: true, data })
const fail = (error: string): BrowserUseV2Result => ({ success: false, data: { error } })
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * Browser automation over the Chrome DevTools Protocol, in-process.
 *
 * A TypeScript port of the browser-use CLI (0.12/0.13 lineage). It speaks CDP
 * directly, so there is no Python and no daemon that outlives you. The page
 * state it returns (numbered interactive elements) matches browser-use's
 * output, so `click <index>` means the same thing.
 *
 * Temporary name while it gets battle tested next to `browserUse`.
 *
 * @example
 * ```typescript
 * const browser = container.feature('browserUseV2')
 * await browser.open('https://example.com')
 * const state = await browser.getState()
 * console.log(state.data._raw_text)
 * await browser.click('12')
 * await browser.close()
 * ```
 *
 * @extends Feature
 */
export class BrowserUseV2 extends Feature<BrowserUseV2State, BrowserUseV2Options> {
  static override shortcut = 'features.browserUseV2' as const
  static override stability = 'experimental' as const
  static override category = 'media-browser' as const
  static override stateSchema = BrowserUseV2StateSchema
  static override optionsSchema = BrowserUseV2OptionsSchema
  static override eventsSchema = BrowserUseV2EventsSchema

  static override tools = {
    browserOpen: {
      description: 'Navigate the browser to a URL. Call this first to open a page before any interaction.',
      schema: z.object({
        url: z.string().describe('The URL to navigate to'),
      }).describe('Navigate the browser to a URL. Call this first to open a page before any interaction.'),
    },
    browserGetState: {
      description: 'Get the current page URL, title, and all interactive elements with their index numbers. Always call this after navigating or when you need to discover clickable elements — the indices returned are required for click and other element interactions.',
      schema: z.object({}).describe('Get the current page URL, title, and all interactive elements with their index numbers. Always call this after navigating or when you need to discover clickable elements.'),
    },
    browserClick: {
      description: 'Click an element by its index (from browserGetState) or by x,y pixel coordinates.',
      schema: z.object({
        target: z.string().describe('Element index number from browserGetState, or "x y" pixel coordinates separated by a space'),
      }).describe('Click an element by its index (from browserGetState) or by x,y pixel coordinates. You must call browserGetState first to obtain element indices.'),
    },
  }

  static { Feature.register(this, 'browserUseV2') }

  private conn: CdpConnection | null = null
  private sessionId: string | null = null
  /** In-flight ensurePage, shared so parallel tool calls attach once. */
  private ensuring: Promise<string> | null = null
  /** In-flight Chrome launch, shared so parallel calls launch Chrome once. */
  private launching: Promise<string> | null = null
  private lifecycle: { name: string; loaderId: string }[] = []
  /** backendNodeId -> node, from the latest getState. The index IS the backendNodeId. */
  private selectorMap = new Map<number, DomNode>()

  override get initialState(): BrowserUseV2State {
    return {
      ...super.initialState,
      session: this.options.session || 'default',
      wsUrl: null,
      targetId: null,
      connected: false,
    }
  }

  private get browserSource(): 'launch' | 'profile' | 'cdp' {
    if (this.options.browser) return this.options.browser
    return this.options.cdpUrl ? 'cdp' : 'launch'
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
   * Find a debug Chrome already listening on one of the debug ports.
   * @returns The browser websocket URL, or null
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

  /** The Chrome executable to launch: the chromePath option, else found per platform. */
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

  /** Return the websocket URL of the debug Chrome, launching it when none is up. */
  async ensureDebugChrome(): Promise<string> {
    if (!this.launching) this.launching = this.findOrLaunchDebugChrome().finally(() => { this.launching = null })
    return this.launching
  }

  private async findOrLaunchDebugChrome(): Promise<string> {
    const running = await this.findDebugChrome()
    if (running) return running
    const executable = this.findChromeExecutable()
    if (!executable) throw new Error('No Chrome or Chromium install was found. Set the chromePath option to its executable.')

    const userDataDir = this.options.userDataDir || this.container.paths.resolve(this.container.feature('os').homedir, '.chrome-debug')
    const args = [
      `--remote-debugging-port=${this.debugPorts[0]}`,
      `--user-data-dir=${userDataDir}`,
      '--no-first-run',
      '--no-default-browser-check',
    ]
    if (this.options.headless) args.push('--headless=new')
    const child = this.container.feature('proc').spawn(executable, args, { detached: true })
    // Chrome keeps its profile and sign-ins between runs, so it outlives us on purpose.
    child.on('error', () => {})
    child.unref()

    const deadline = Date.now() + (this.options.launchTimeoutMs ?? 60_000)
    while (Date.now() < deadline) {
      const url = await this.findDebugChrome()
      if (url) return url
      await sleep(250)
    }
    throw new Error(`Debug Chrome did not come up on port ${this.debugPorts.join('/')} in time`)
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
   * Connect (once) and attach to this session's own tab, creating it if needed.
   * @returns The flat-mode CDP session id for the tab
   */
  async ensurePage(): Promise<string> {
    if (this.conn && !this.conn.closed && this.sessionId) return this.sessionId
    if (!this.ensuring) this.ensuring = this.attach().finally(() => { this.ensuring = null })
    return this.ensuring
  }

  private async attach(): Promise<string> {
    if (!this.conn || this.conn.closed) {
      const wsUrl = await this.resolveWsUrl()
      const conn = await CdpConnection.connect(wsUrl)
      this.conn = conn
      this.state.set('wsUrl', wsUrl)
      this.state.set('connected', true)
      conn.onClose(() => {
        // Drop everything tied to the socket; the next command reconnects
        // (and in launch mode relaunches Chrome if it went away).
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
    }
    const conn = this.conn!

    // Reuse this session's tab if it still exists, else open a fresh one.
    // Sharing the first page tab lets sessions clobber each other's navigation.
    let targetId = this.state.get('targetId')
    if (targetId) {
      const { targetInfos } = await conn.send('Target.getTargets')
      if (!targetInfos.some((t: any) => t.targetId === targetId)) targetId = null
    }
    if (!targetId) {
      targetId = (await conn.send('Target.createTarget', { url: 'about:blank' })).targetId as string
      this.state.set('targetId', targetId)
    }
    const { sessionId } = await conn.send('Target.attachToTarget', { targetId, flatten: true })
    this.sessionId = sessionId
    // Domains must be re-enabled on every attach, or events silently stop.
    await Promise.all([
      conn.send('Page.enable', {}, sessionId),
      conn.send('Page.setLifecycleEventsEnabled', { enabled: true }, sessionId),
      conn.send('Inspector.enable', {}, sessionId).catch(() => {}),
    ])
    return sessionId
  }

  private async send(method: string, params: Record<string, any> = {}, timeoutMs?: number) {
    const sid = await this.ensurePage()
    return this.conn!.send(method, params, sid, timeoutMs)
  }

  // --- Commands ---------------------------------------------------------------

  /**
   * Navigate this session's tab to a URL and wait for it to load.
   * @param url - The URL to open. A bare host gets https://
   *
   * @example
   * ```typescript
   * await browserUseV2.open('example.com')
   * ```
   */
  async open(url: string): Promise<BrowserUseV2Result> {
    try {
      if (!/^(https?|file):\/\//.test(url)) url = 'https://' + url
      const before = this.state.get('currentUrl') || ''
      const sameDomain = /^https?:/.test(url) && /^https?:/.test(before) && url.split('/')[2] === before.split('/')[2]
      const sid = await this.ensurePage()
      this.lifecycle = []
      const nav = await this.conn!.send('Page.navigate', { url, transitionType: 'address_bar' }, sid, 20_000)
      if (nav.errorText) return fail(`Navigation failed: ${nav.errorText}`)
      // Wait for load or network idle on this navigation. A timeout is not an
      // error: slow pages are still usable, same as browser-use.
      const deadline = Date.now() + (sameDomain ? 3000 : 8000)
      while (Date.now() < deadline) {
        if (this.lifecycle.some((e) => (e.name === 'load' || e.name === 'networkIdle') && (!nav.loaderId || e.loaderId === nav.loaderId))) break
        await sleep(50)
      }
      this.state.set('currentUrl', url)
      this.emit('navigated', url)
      return ok({ url })
    } catch (e: any) {
      return fail(e.message)
    }
  }

  /** The URL of this session's tab, read from the page. */
  async currentUrl(): Promise<string> {
    const r = await this.send('Runtime.evaluate', { expression: 'location.href', returnByValue: true })
    return r?.result?.value ?? ''
  }

  /**
   * Get the page state: viewport info and every interactive element with its index.
   * The text matches browser-use's `state` output.
   *
   * @example
   * ```typescript
   * const state = await browserUseV2.getState()
   * console.log(state.data._raw_text)
   * ```
   */
  async getState(): Promise<BrowserUseV2Result> {
    try {
      const sid = await this.ensurePage()
      const pageUrl = await this.currentUrl()
      if (!/^https?:/i.test(pageUrl)) {
        this.selectorMap = new Map()
        return ok({ _raw_text: llmRepresentation({ root: null, selectorMap: new Map() }) })
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
        text = llmRepresentation({ root: null, selectorMap: new Map() })
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
      return ok({ _raw_text: text })
    } catch (e: any) {
      return fail(e.message)
    }
  }

  /**
   * Click an element by index (from getState) or by "x y" coordinates.
   *
   * @example
   * ```typescript
   * await browserUseV2.click('42')       // element 42
   * await browserUseV2.click('100 200')  // coordinates
   * ```
   */
  async click(target: string): Promise<BrowserUseV2Result> {
    try {
      const args = target.trim().split(/\s+/).map(Number)
      if (args.length === 2 && args.every(Number.isFinite)) {
        await this.mouseClick(args[0]!, args[1]!)
        this.emit('clicked', target)
        return ok({ clicked_coordinate: { x: args[0], y: args[1] } })
      }
      if (args.length !== 1 || !Number.isInteger(args[0])) return fail('Usage: click <index> or click <x> <y>')
      const node = this.selectorMap.get(args[0]!)
      if (!node) return fail(`Element index ${args[0]} not found - page may have changed`)
      const r = await this.clickNode(node)
      if (r && 'validation_error' in r) return fail(r.validation_error)
      this.emit('clicked', target)
      return ok({ clicked: args[0] })
    } catch (e: any) {
      return fail(e.message)
    }
  }

  private async mouseClick(x: number, y: number) {
    await this.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y })
    await sleep(50)
    await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 }, 3000).catch(() => {})
    await sleep(80)
    await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 }, 5000).catch(() => {})
  }

  private async jsClick(backendNodeId: number) {
    const { object } = await this.send('DOM.resolveNode', { backendNodeId })
    if (!object?.objectId) throw new Error('Failed to find DOM element based on backendNodeId, maybe page content changed?')
    await this.send('Runtime.callFunctionOn', { functionDeclaration: 'function() { this.click(); }', objectId: object.objectId })
    await sleep(50)
  }

  /** Element rect in viewport CSS pixels: content quads, then box model, then getBoundingClientRect. */
  private async elementRect(backendNodeId: number): Promise<{ x: number; y: number; width: number; height: number } | null> {
    let quad: number[] | null = null
    try {
      const r = await this.send('DOM.getContentQuads', { backendNodeId })
      if (r.quads?.length) {
        // browser-use folds all quads into one rect via its first quad; keep that.
        quad = r.quads[0]
      }
    } catch {}
    if (!quad) {
      try {
        const r = await this.send('DOM.getBoxModel', { backendNodeId })
        if (r.model?.content?.length >= 8) quad = r.model.content
      } catch {}
    }
    if (quad) {
      const xs = [quad[0]!, quad[2]!, quad[4]!, quad[6]!]
      const ys = [quad[1]!, quad[3]!, quad[5]!, quad[7]!]
      const x = Math.min(...xs), y = Math.min(...ys)
      return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y }
    }
    try {
      const { object } = await this.send('DOM.resolveNode', { backendNodeId })
      const r = await this.send('Runtime.callFunctionOn', {
        objectId: object.objectId,
        functionDeclaration: 'function() { const r = this.getBoundingClientRect(); return { x: r.left, y: r.top, width: r.width, height: r.height }; }',
        returnByValue: true,
      })
      const v = r?.result?.value
      if (v && v.width > 0 && v.height > 0) return v
    } catch {}
    return null
  }

  /** True when something else sits on top of the element at (x, y). */
  private async isOccluded(backendNodeId: number, x: number, y: number): Promise<boolean> {
    try {
      const { object } = await this.send('DOM.resolveNode', { backendNodeId })
      if (!object?.objectId) return true
      const r = await this.send('Runtime.callFunctionOn', {
        objectId: object.objectId,
        arguments: [{ value: x }, { value: y }],
        returnByValue: true,
        functionDeclaration: `function(x, y) {
          const at = document.elementFromPoint(x, y);
          if (!at) return false;
          if (this === at || this.contains(at) || at.contains(this)) return true;
          if (this.tagName === 'INPUT' && this.id) {
            const l = document.querySelector('label[for="' + CSS.escape(this.id) + '"]');
            if (l && (l === at || l.contains(at))) return true;
          }
          if (this.tagName === 'INPUT') {
            let a = at;
            for (let i = 0; i < 3 && a; i++) { if (a.tagName === 'LABEL' && a.contains(this)) return true; a = a.parentElement; }
          }
          if (this.tagName === 'LABEL' && at.tagName === 'INPUT' && (at.id === this.htmlFor || this.contains(at))) return true;
          return false;
        }`,
      })
      return r?.result?.value !== true
    } catch {
      return true
    }
  }

  /** Port of browser-use's _click_element_node_impl, with its fallbacks. */
  private async clickNode(node: DomNode): Promise<{ validation_error: string } | Record<string, any> | null> {
    const tag = node.tagName
    const type = (node.attributes['type'] ?? '').toLowerCase()
    const id = node.backendNodeId
    if (tag === 'select') return { validation_error: `Cannot click on <select> elements. Use dropdown_options(index=${id}) action instead.` }
    if (tag === 'input' && type === 'file') return { validation_error: `Cannot click on file input element (index=${id}). File uploads must be handled using upload_file_to_element action.` }

    // Checkboxes: verify the click toggled, fall back to JS click if it didn't.
    const isToggle = tag === 'input' && (type === 'checkbox' || type === 'radio')
    let toggleObjectId: string | null = null
    let preChecked: boolean | null = null
    const readChecked = async () =>
      (await this.send('Runtime.callFunctionOn', { functionDeclaration: 'function() { return this.checked; }', objectId: toggleObjectId, returnByValue: true }))?.result?.value ?? null
    if (isToggle) {
      try {
        toggleObjectId = (await this.send('DOM.resolveNode', { backendNodeId: id })).object?.objectId ?? null
        if (toggleObjectId) preChecked = await readChecked()
      } catch {}
    }

    const metrics = await this.send('Page.getLayoutMetrics')
    const vw = metrics.layoutViewport.clientWidth
    const vh = metrics.layoutViewport.clientHeight
    try {
      await this.send('DOM.scrollIntoViewIfNeeded', { backendNodeId: id })
      await sleep(50)
    } catch {}

    const rect = await this.elementRect(id)
    if (!rect) {
      await this.jsClick(id)
      return null
    }
    let cx = rect.x + rect.width / 2
    let cy = rect.y + rect.height / 2
    cx = Math.max(0, Math.min(vw - 1, cx))
    cy = Math.max(0, Math.min(vh - 1, cy))

    if (await this.isOccluded(id, cx, cy)) {
      await this.jsClick(id)
      return null
    }
    try {
      await this.mouseClick(cx, cy)
      if (isToggle && preChecked !== null && toggleObjectId) {
        await sleep(50)
        let post = await readChecked()
        if (post === preChecked) {
          await this.send('Runtime.callFunctionOn', { functionDeclaration: 'function() { this.click(); }', objectId: toggleObjectId })
          await sleep(50)
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

  /**
   * Close this session's tab and the CDP connection. Chrome itself keeps running.
   * @example
   * ```typescript
   * await browserUseV2.close()
   * ```
   */
  async close(): Promise<BrowserUseV2Result> {
    const conn = this.conn
    const targetId = this.state.get('targetId')
    try {
      if (conn && !conn.closed && targetId) await conn.send('Target.closeTarget', { targetId }, undefined, 5000).catch(() => {})
    } finally {
      conn?.close()
      this.conn = null
      this.sessionId = null
      this.selectorMap = new Map()
      this.state.set('targetId', null)
      this.state.set('connected', false)
      this.emit('closed')
    }
    return ok({ closed: true })
  }

  // --- Tool handlers (matched by name to static tools) ---

  async browserOpen(options: { url: string }) {
    return this.open(options.url)
  }

  async browserGetState() {
    return this.getState()
  }

  async browserClick(options: { target: string }) {
    return this.click(options.target)
  }
}

export default BrowserUseV2
