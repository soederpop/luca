import { z } from 'zod'
import { FeatureStateSchema, FeatureOptionsSchema, FeatureEventsSchema } from '../../schemas/base.js'
import { Feature } from '../feature.js'
import type { Helper } from '../../helper.js'

declare module '@soederpop/luca/feature' {
  interface AvailableFeatures {
    browserUse: typeof BrowserUse
  }
}

export const BrowserUseStateSchema = FeatureStateSchema.extend({
  session: z.string().default('default').describe('Active browser session name'),
  headed: z.boolean().default(false).describe('Whether the browser window is visible'),
  currentUrl: z.string().optional().describe('The current page URL'),
})
export type BrowserUseState = z.infer<typeof BrowserUseStateSchema>

export const BrowserUseOptionsSchema = FeatureOptionsSchema.extend({
  session: z.string().optional().describe('Default session name'),
  headed: z.boolean().optional().describe('Show browser window by default'),
  profile: z.string().optional().describe('Chrome profile name to use'),
  connect: z.boolean().optional().describe('Auto-discover and connect to a running Chrome via CDP'),
  cdpUrl: z.string().optional().describe('Connect to an existing browser via CDP URL (http:// or ws://)'),
})
export type BrowserUseOptions = z.infer<typeof BrowserUseOptionsSchema>

export const BrowserUseEventsSchema = FeatureEventsSchema.extend({
  navigated: z.tuple([z.string().describe('URL navigated to')]).describe('Emitted after navigating to a URL'),
  clicked: z.tuple([z.string().describe('Target description')]).describe('Emitted after clicking an element'),
  typed: z.tuple([z.string().describe('Text typed')]).describe('Emitted after typing text'),
  screenshot: z.tuple([z.string().describe('Base64 or file path')]).describe('Emitted after taking a screenshot'),
  closed: z.tuple([]).describe('Emitted when the browser session is closed'),
})

/** Result shape from browser-use --json */
interface BrowserUseResult {
  id?: string
  success: boolean
  data: Record<string, any>
}

/**
 * Browser automation feature wrapping the browser-use CLI.
 * Provides programmatic browser control — navigation, clicking, typing,
 * screenshots, JavaScript evaluation, data extraction, and more.
 *
 * @example
 * ```typescript
 * const browser = container.feature('browserUse')
 * await browser.open('https://example.com')
 * const state = await browser.getState()
 * await browser.click('21')
 * await browser.close()
 * ```
 *
 * @extends Feature
 */
export class BrowserUse extends Feature<BrowserUseState, BrowserUseOptions> {
  static override shortcut = 'features.browserUse' as const
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
      description: 'Extract structured data from the current page using a natural-language query processed by an LLM.',
      schema: z.object({
        query: z.string().describe('Natural language description of what data to extract, e.g. "all product names and prices in the table"'),
      }).describe('Extract structured data from the current page using a natural-language query processed by an LLM. Use when you need to pull specific information from complex pages without writing selectors manually.'),
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
      description: 'Close the browser session and stop the daemon.',
      schema: z.object({
        all: z.boolean().optional().describe('If true, close all browser sessions'),
      }).describe('Close the browser session. Call this when you are done with browser automation to free resources.'),
    },
    browserSessions: {
      description: 'List all active browser sessions.',
      schema: z.object({}).describe('List all currently active browser sessions with their names and status.'),
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

  /** Build the base args array with global flags */
  private baseArgs(): string[] {
    const args: string[] = ['--json']
    if (this.state.get('headed')) args.push('--headed')
    const session = this.state.get('session')
    if (session && session !== 'default') args.push('--session', session)
    if (this.options.profile) args.push('--profile', this.options.profile)
    if (this.options.connect) args.push('--connect')
    if (this.options.cdpUrl) args.push('--cdp-url', this.options.cdpUrl)
    return args
  }

  /** Execute a browser-use command and parse the JSON result */
  private async exec(subcommand: string, ...cmdArgs: string[]): Promise<BrowserUseResult> {
    const args = [...this.baseArgs(), subcommand, ...cmdArgs]
    const proc = this.container.feature('proc')
    const result = await proc.spawnAndCapture('browser-use', args)

    const stdout = (result.stdout || '').trim()
    if (!stdout) {
      return { success: false, data: { error: result.stderr || 'No output from browser-use' } }
    }

    try {
      return JSON.parse(stdout) as BrowserUseResult
    } catch {
      return { success: true, data: { _raw_text: stdout } }
    }
  }

  // --- Core methods ---

  /**
   * Navigate to a URL
   * @param url - The URL to open
   * @returns The browser-use result
   *
   * @example
   * ```typescript
   * await browserUse.open('https://example.com')
   * ```
   */
  async open(url: string): Promise<BrowserUseResult> {
    const result = await this.exec('open', url)
    if (result.success) {
      this.state.set('currentUrl', url)
      this.emit('navigated', url)
    }
    return result
  }

  /**
   * Click an element by index or coordinates
   * @param target - Element index or "x y" coordinates
   *
   * @example
   * ```typescript
   * await browserUse.click('21')       // click element 21
   * await browserUse.click('100 200')  // click at coordinates
   * ```
   */
  async click(target: string): Promise<BrowserUseResult> {
    const args = target.split(/\s+/)
    const result = await this.exec('click', ...args)
    if (result.success) this.emit('clicked', target)
    return result
  }

  /**
   * Type text at the current cursor position
   * @param text - Text to type
   */
  async type(text: string): Promise<BrowserUseResult> {
    const result = await this.exec('type', text)
    if (result.success) this.emit('typed', text)
    return result
  }

  /**
   * Type text into a specific element
   * @param index - Element index
   * @param text - Text to enter
   */
  async input(index: string, text: string): Promise<BrowserUseResult> {
    return this.exec('input', index, text)
  }

  /**
   * Get the current browser state (URL, title, interactive elements)
   *
   * @example
   * ```typescript
   * const state = await browserUse.getState()
   * console.log(state.data._raw_text)
   * ```
   */
  async getState(): Promise<BrowserUseResult> {
    return this.exec('state')
  }

  /**
   * Take a screenshot
   * @param options - Optional path and full-page flag
   * @returns Base64 PNG data or file path
   */
  async screenshot(options: { path?: string; full?: boolean } = {}): Promise<BrowserUseResult> {
    const args: string[] = []
    if (options.full) args.push('--full')
    if (options.path) args.push(options.path)
    const result = await this.exec('screenshot', ...args)
    if (result.success) {
      this.emit('screenshot', options.path || 'base64')
    }
    return result
  }

  /**
   * Execute JavaScript in the page context
   * @param js - JavaScript code to evaluate
   */
  async evaluate(js: string): Promise<BrowserUseResult> {
    return this.exec('eval', js)
  }

  /**
   * Extract structured data from the page using an LLM
   * @param query - Natural language description of what to extract
   */
  async extract(query: string): Promise<BrowserUseResult> {
    return this.exec('extract', query)
  }

  /**
   * Scroll the page
   * @param direction - 'up' or 'down'
   * @param amount - Pixels to scroll
   */
  async scroll(direction: 'up' | 'down' = 'down', amount?: number): Promise<BrowserUseResult> {
    const args: string[] = [direction]
    if (amount) args.push('--amount', String(amount))
    return this.exec('scroll', ...args)
  }

  /**
   * Send keyboard keys
   * @param keys - Key combination (e.g. "Enter", "Control+a")
   */
  async keys(keys: string): Promise<BrowserUseResult> {
    return this.exec('keys', keys)
  }

  /** Go back in browser history */
  async back(): Promise<BrowserUseResult> {
    return this.exec('back')
  }

  /** Get the current page title */
  async getTitle(): Promise<BrowserUseResult> {
    return this.exec('get', 'title')
  }

  /** Get the full page HTML */
  async getHtml(): Promise<BrowserUseResult> {
    return this.exec('get', 'html')
  }

  /**
   * Get text content of an element
   * @param index - Element index
   */
  async getText(index: string): Promise<BrowserUseResult> {
    return this.exec('get', 'text', index)
  }

  /**
   * Select a dropdown option
   * @param index - Element index of the dropdown
   * @param value - Value to select
   */
  async select(index: string, value: string): Promise<BrowserUseResult> {
    return this.exec('select', index, value)
  }

  /**
   * Wait for a CSS selector to appear
   * @param selector - CSS selector
   */
  async waitForSelector(selector: string): Promise<BrowserUseResult> {
    return this.exec('wait', 'selector', selector)
  }

  /**
   * Wait for text to appear on the page
   * @param text - Text to wait for
   */
  async waitForText(text: string): Promise<BrowserUseResult> {
    return this.exec('wait', 'text', text)
  }

  /**
   * Switch to a tab by index
   * @param tab - Tab index
   */
  async switchTab(tab: string): Promise<BrowserUseResult> {
    return this.exec('switch', tab)
  }

  /**
   * Close a tab
   * @param tab - Tab index (closes current if omitted)
   */
  async closeTab(tab?: string): Promise<BrowserUseResult> {
    const args = tab ? [tab] : []
    return this.exec('close-tab', ...args)
  }

  /**
   * Close the browser session
   * @param all - If true, close all sessions
   */
  async close(all?: boolean): Promise<BrowserUseResult> {
    const args = all ? ['--all'] : []
    const result = await this.exec('close', ...args)
    if (result.success) this.emit('closed')
    return result
  }

  /** List active browser sessions */
  async sessions(): Promise<BrowserUseResult> {
    return this.exec('sessions')
  }

  /**
   * Toggle headed/headless mode
   * @param headed - true for visible browser window, false for headless
   */
  setHeaded(headed: boolean): { success: boolean; headed: boolean } {
    this.state.set('headed', headed)
    return { success: true, headed }
  }

  /**
   * Hover over an element
   * @param index - Element index
   */
  async hover(index: string): Promise<BrowserUseResult> {
    return this.exec('hover', index)
  }

  /**
   * Double-click an element
   * @param index - Element index
   */
  async dblclick(index: string): Promise<BrowserUseResult> {
    return this.exec('dblclick', index)
  }

  /**
   * Right-click an element
   * @param index - Element index
   */
  async rightclick(index: string): Promise<BrowserUseResult> {
    return this.exec('rightclick', index)
  }

  /**
   * Upload a file to a file input element
   * @param index - Element index of the file input
   * @param path - Local file path to upload
   */
  async upload(index: string, path: string): Promise<BrowserUseResult> {
    return this.exec('upload', index, path)
  }

  /**
   * Get the value of an input or textarea element
   * @param index - Element index
   */
  async getValue(index: string): Promise<BrowserUseResult> {
    return this.exec('get', 'value', index)
  }

  /**
   * Get all attributes of an element
   * @param index - Element index
   */
  async getAttributes(index: string): Promise<BrowserUseResult> {
    return this.exec('get', 'attributes', index)
  }

  // --- Tool handlers (matched by name to static tools) ---

  async browserOpen(options: { url: string }) {
    return this.open(options.url)
  }

  async browserClick(options: { target: string }) {
    return this.click(options.target)
  }

  async browserType(options: { text: string }) {
    return this.type(options.text)
  }

  async browserInput(options: { index: string; text: string }) {
    return this.input(options.index, options.text)
  }

  async browserGetState() {
    return this.getState()
  }

  async browserScreenshot(options: { path?: string; full?: boolean }) {
    return this.screenshot(options)
  }

  async browserEval(options: { js: string }) {
    return this.evaluate(options.js)
  }

  async browserExtract(options: { query: string }) {
    return this.extract(options.query)
  }

  async browserScroll(options: { direction: 'up' | 'down'; amount?: number }) {
    return this.scroll(options.direction, options.amount)
  }

  async browserKeys(options: { keys: string }) {
    return this.keys(options.keys)
  }

  async browserBack() {
    return this.back()
  }

  async browserGetTitle() {
    return this.getTitle()
  }

  async browserGetHtml() {
    return this.getHtml()
  }

  async browserGetText(options: { index: string }) {
    return this.getText(options.index)
  }

  async browserSelect(options: { index: string; value: string }) {
    return this.select(options.index, options.value)
  }

  async browserWaitForSelector(options: { selector: string }) {
    return this.waitForSelector(options.selector)
  }

  async browserWaitForText(options: { text: string }) {
    return this.waitForText(options.text)
  }

  async browserSwitchTab(options: { tab: string }) {
    return this.switchTab(options.tab)
  }

  async browserCloseTab(options: { tab?: string }) {
    return this.closeTab(options.tab)
  }

  async browserClose(options: { all?: boolean }) {
    return this.close(options.all)
  }

  async browserSessions() {
    return this.sessions()
  }

  async browserHover(options: { index: string }) {
    return this.hover(options.index)
  }

  async browserDblclick(options: { index: string }) {
    return this.dblclick(options.index)
  }

  async browserRightclick(options: { index: string }) {
    return this.rightclick(options.index)
  }

  async browserUpload(options: { index: string; path: string }) {
    return this.upload(options.index, options.path)
  }

  async browserGetValue(options: { index: string }) {
    return this.getValue(options.index)
  }

  async browserGetAttributes(options: { index: string }) {
    return this.getAttributes(options.index)
  }

  async browserSetHeaded(options: { headed: boolean }) {
    return this.setHeaded(options.headed)
  }
}

export default BrowserUse
