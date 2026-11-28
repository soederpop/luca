# BrowserUse (features.browserUse)

> Stability: `experimental`

Browser automation over the Chrome DevTools Protocol, in-process. A TypeScript port of the browser-use CLI (0.12/0.13). It speaks CDP to Chrome directly: no Python, and no daemon left running after you exit. The page state (numbered interactive elements) matches browser-use's output byte for byte, so `click <index>` means the same thing. Where the browser comes from (the `browser` option): - `launch` (default): a dedicated debug Chrome with its own profile at ~/.chrome-debug, started on first use. Sign into sites there once. - `profile`: your everyday Chrome, after you turn on chrome://inspect/#remote-debugging (Chrome 144+). Chrome asks you to Allow the connection; it is held for the life of the process. - `cdp`: any Chrome at `cdpUrl`.

## Usage

```ts
container.feature('browserUse', {
  // Session name. Each session gets its own tab, so sessions sharing one browser do not clobber each other
  session,
  // Where the browser comes from. launch (default): find or start a dedicated debug Chrome with its own profile. profile: attach to your everyday Chrome after you turn on chrome://inspect/#remote-debugging (Chrome 144+; Chrome asks you to Allow each connection). cdp: connect to cdpUrl. Setting cdpUrl implies cdp; setting profile or connect implies profile
  browser,
  // Launch mode: show the Chrome window. Default false (headless)
  headed,
  // Attach to your everyday Chrome (same as browser: "profile"). Chrome decides which profile is debuggable, so the name is informational
  profile,
  // Auto-discover a running Chrome with remote debugging (same as browser: "profile")
  connect,
  // Connect to an existing browser via CDP URL (http:// debug address or ws:// browser URL)
  cdpUrl,
  // Find or launch a dedicated debug Chrome (same as browser: "launch", the default)
  launch,
  // Chrome or Chromium executable for launch mode. Default: found per platform (macOS, Linux, Windows)
  chromePath,
  // Chrome profile folder for launch mode (default ~/.chrome-debug). Chrome 136+ refuses remote debugging on the default profile, so this must be a separate folder
  userDataDir,
  // Ports a debug Chrome may already listen on, for launch mode. The first is used when launching (default [9222, 9223, 9229])
  debugPorts,
  // How long launch mode waits for a fresh Chrome to bind its debug port (default 60000)
  launchTimeoutMs,
})
```

## Options (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `session` | `string` | Session name. Each session gets its own tab, so sessions sharing one browser do not clobber each other |
| `browser` | `string` | Where the browser comes from. launch (default): find or start a dedicated debug Chrome with its own profile. profile: attach to your everyday Chrome after you turn on chrome://inspect/#remote-debugging (Chrome 144+; Chrome asks you to Allow each connection). cdp: connect to cdpUrl. Setting cdpUrl implies cdp; setting profile or connect implies profile |
| `headed` | `boolean` | Launch mode: show the Chrome window. Default false (headless) |
| `profile` | `string` | Attach to your everyday Chrome (same as browser: "profile"). Chrome decides which profile is debuggable, so the name is informational |
| `connect` | `boolean` | Auto-discover a running Chrome with remote debugging (same as browser: "profile") |
| `cdpUrl` | `string` | Connect to an existing browser via CDP URL (http:// debug address or ws:// browser URL) |
| `launch` | `boolean` | Find or launch a dedicated debug Chrome (same as browser: "launch", the default) |
| `chromePath` | `string` | Chrome or Chromium executable for launch mode. Default: found per platform (macOS, Linux, Windows) |
| `userDataDir` | `string` | Chrome profile folder for launch mode (default ~/.chrome-debug). Chrome 136+ refuses remote debugging on the default profile, so this must be a separate folder |
| `debugPorts` | `array` | Ports a debug Chrome may already listen on, for launch mode. The first is used when launching (default [9222, 9223, 9229]) |
| `launchTimeoutMs` | `number` | How long launch mode waits for a fresh Chrome to bind its debug port (default 60000) |

## Methods

### setupToolsConsumer

When an assistant uses browserUse, inject system prompt guidance about the browser interaction loop.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `consumer` | `Helper` | ✓ | Parameter consumer |

**Returns:** `void`



### afterInitialize

**Returns:** `void`



### findDebugChrome

Find a debug Chrome already listening on one of the debug ports. Both loopback families are probed, since a debug Chrome often binds only [::1].

**Returns:** `Promise<string | null>`

```ts
const ws = await browserUse.findDebugChrome() // 'ws://127.0.0.1:9222/devtools/browser/…' or null
```



### findChromeExecutable

The Chrome executable to launch: the chromePath option, else the first install found for this platform (macOS, Linux, Windows).

**Returns:** `string | null`

```ts
browserUse.findChromeExecutable() // '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
```



### ensureDebugChrome

Return the websocket URL of the debug Chrome, launching it when none is up. Parallel callers share one launch.

**Returns:** `Promise<string>`

```ts
const ws = await browserUse.ensureDebugChrome()
```



### ensurePage

Connect (once per process) and attach to this session's own tab, opening one if needed. A dropped connection is re-made on the next command, and in launch mode a Chrome that went away is relaunched.

**Returns:** `Promise<string>`

```ts
const sessionId = await browserUse.ensurePage()
```



### open

Navigate this session's tab to a URL and wait for it to load.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `url` | `string` | ✓ | The URL to open. A bare host gets https:// |

**Returns:** `Promise<BrowserUseResult>`

```ts
await browserUse.open('example.com')
```



### back

Go back in browser history

**Returns:** `Promise<BrowserUseResult>`



### scroll

Scroll the page

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `direction` | `'up' | 'down'` |  | 'up' or 'down' |
| `amount` | `number` |  | Pixels to scroll (default 500) |

**Returns:** `Promise<BrowserUseResult>`



### getState

Get the page state: viewport info and every interactive element with its index. The text matches browser-use's `state` output.

**Returns:** `Promise<BrowserUseResult>`

```ts
const state = await browserUse.getState()
console.log(state.data._raw_text)
```



### screenshot

Take a screenshot

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `{ path?: string; full?: boolean }` |  | Optional path and full-page flag |

**Returns:** `Promise<BrowserUseResult>`



### evaluate

Execute JavaScript in the page context

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `js` | `string` | ✓ | JavaScript expression to evaluate. Promises are awaited |

**Returns:** `Promise<BrowserUseResult>`



### extract

Get the readable text of the page, with the query, so the calling model can answer it. browser-use's own `extract` was never implemented, so this hands the text back instead of calling a second LLM.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `query` | `string` | ✓ | What to find on the page |

**Returns:** `Promise<BrowserUseResult>`



### getTitle

Get the current page title

**Returns:** `Promise<BrowserUseResult>`



### getHtml

Get the page HTML, or one element's outerHTML

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `selector` | `string` |  | Optional CSS selector |

**Returns:** `Promise<BrowserUseResult>`



### getText

Get text content of an element

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `index` | `string` | ✓ | Element index |

**Returns:** `Promise<BrowserUseResult>`



### getValue

Get the value of an input or textarea element

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `index` | `string` | ✓ | Element index |

**Returns:** `Promise<BrowserUseResult>`



### getAttributes

Get all attributes of an element

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `index` | `string` | ✓ | Element index |

**Returns:** `Promise<BrowserUseResult>`



### waitForSelector

Wait for a CSS selector to become visible

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `selector` | `string` | ✓ | CSS selector |
| `timeoutMs` | `any` |  | Give up after this long (default 30000) |

**Returns:** `Promise<BrowserUseResult>`



### waitForText

Wait for text to appear on the page

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `text` | `string` | ✓ | Text to wait for |
| `timeoutMs` | `any` |  | Give up after this long (default 30000) |

**Returns:** `Promise<BrowserUseResult>`



### click

Click an element by index (from getState) or by "x y" coordinates.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `target` | `string` | ✓ | Parameter target |

**Returns:** `Promise<BrowserUseResult>`

```ts
await browserUse.click('21')       // element 21
await browserUse.click('100 200')  // coordinates
```



### hover

Hover over an element

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `index` | `string` | ✓ | Element index |

**Returns:** `Promise<BrowserUseResult>`



### dblclick

Double-click an element

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `index` | `string` | ✓ | Element index |

**Returns:** `Promise<BrowserUseResult>`



### rightclick

Right-click an element

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `index` | `string` | ✓ | Element index |

**Returns:** `Promise<BrowserUseResult>`



### type

Type text at the current focus

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `text` | `string` | ✓ | Text to type |

**Returns:** `Promise<BrowserUseResult>`



### input

Click an element, clear it, and type into it. Pass "" to clear only.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `index` | `string` | ✓ | Element index |
| `text` | `string` | ✓ | Text to enter |

**Returns:** `Promise<BrowserUseResult>`



### keys

Send keyboard keys

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `keys` | `string` | ✓ | A key or combination, e.g. "Enter", "Escape", "Control+a", "cmd+shift+k" |

**Returns:** `Promise<BrowserUseResult>`



### select

Select a dropdown option by its text or value (case-insensitive). Works on native selects, ARIA listboxes/menus, and Semantic UI dropdowns.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `index` | `string` | ✓ | Element index of the dropdown |
| `value` | `string` | ✓ | Option text or value to select |

**Returns:** `Promise<BrowserUseResult>`



### upload

Upload a file to a file input. The index can be the input itself or a nearby element (a styled "Choose file" button), as in browser-use.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `index` | `string` | ✓ | Element index of the file input, or an element near it |
| `path` | `string` | ✓ | Local file path to upload |

**Returns:** `Promise<BrowserUseResult>`



### tabs

List open tabs, with the one this session drives marked.

**Returns:** `Promise<BrowserUseResult>`

```ts
const { data } = await browserUse.tabs()
```



### switchTab

Make this session drive another tab, by index from tabs().

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `tab` | `string` | ✓ | Tab index (0-based) |

**Returns:** `Promise<BrowserUseResult>`



### closeTab

Close a tab

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `tab` | `string` |  | Tab index (closes this session's tab if omitted) |

**Returns:** `Promise<BrowserUseResult>`



### close

Close this session's tab and the CDP connection. Chrome keeps running.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `all` | `boolean` |  | Also close every other tab opened by browserUse in this process |

**Returns:** `Promise<BrowserUseResult>`



### sessions

List open tabs. Kept as `sessions` for the browserSessions tool; see tabs().

**Returns:** `Promise<BrowserUseResult>`



### setHeaded

Show or hide the browser window (launch mode). A running Chrome can't switch, so a Chrome this instance launched is restarted in the new mode on the next command. Sign-ins survive, since the profile is kept.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `headed` | `boolean` | ✓ | true for a visible window, false for headless |

**Returns:** `Promise<{ success: boolean; headed: boolean; note?: string }>`



### browserOpen

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `{ url: string }` | ✓ | Parameter options |

**Returns:** `void`



### browserClick

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `{ target: string }` | ✓ | Parameter options |

**Returns:** `void`



### browserType

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `{ text: string }` | ✓ | Parameter options |

**Returns:** `void`



### browserInput

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `{ index: string; text: string }` | ✓ | Parameter options |

**Returns:** `void`



### browserGetState

**Returns:** `void`



### browserScreenshot

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `{ path?: string; full?: boolean }` | ✓ | Parameter options |

**Returns:** `void`



### browserEval

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `{ js: string }` | ✓ | Parameter options |

**Returns:** `void`



### browserExtract

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `{ query: string }` | ✓ | Parameter options |

**Returns:** `void`



### browserScroll

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `{ direction: 'up' | 'down'; amount?: number }` | ✓ | Parameter options |

**Returns:** `void`



### browserKeys

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `{ keys: string }` | ✓ | Parameter options |

**Returns:** `void`



### browserBack

**Returns:** `void`



### browserGetTitle

**Returns:** `void`



### browserGetHtml

**Returns:** `void`



### browserGetText

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `{ index: string }` | ✓ | Parameter options |

**Returns:** `void`



### browserSelect

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `{ index: string; value: string }` | ✓ | Parameter options |

**Returns:** `void`



### browserWaitForSelector

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `{ selector: string }` | ✓ | Parameter options |

**Returns:** `void`



### browserWaitForText

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `{ text: string }` | ✓ | Parameter options |

**Returns:** `void`



### browserSwitchTab

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `{ tab: string }` | ✓ | Parameter options |

**Returns:** `void`



### browserCloseTab

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `{ tab?: string }` | ✓ | Parameter options |

**Returns:** `void`



### browserClose

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `{ all?: boolean }` | ✓ | Parameter options |

**Returns:** `void`



### browserSessions

**Returns:** `void`



### browserHover

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `{ index: string }` | ✓ | Parameter options |

**Returns:** `void`



### browserDblclick

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `{ index: string }` | ✓ | Parameter options |

**Returns:** `void`



### browserRightclick

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `{ index: string }` | ✓ | Parameter options |

**Returns:** `void`



### browserUpload

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `{ index: string; path: string }` | ✓ | Parameter options |

**Returns:** `void`



### browserGetValue

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `{ index: string }` | ✓ | Parameter options |

**Returns:** `void`



### browserGetAttributes

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `{ index: string }` | ✓ | Parameter options |

**Returns:** `void`



### browserSetHeaded

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `{ headed: boolean }` | ✓ | Parameter options |

**Returns:** `void`



## Events (Zod v4 schema)

### disconnected

Emitted when the CDP connection drops



### navigated

Emitted after navigating to a URL

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | URL navigated to |



### screenshot

Emitted after taking a screenshot

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | Base64 or file path |



### clicked

Emitted after clicking an element

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | Target description |



### typed

Emitted after typing text

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | Text typed |



### closed

Emitted when the session tab is closed



## State (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `boolean` | Whether this feature is currently enabled |
| `session` | `string` | Session name. Each session drives its own tab |
| `headed` | `boolean` | Launch mode: whether Chrome runs with a visible window |
| `currentUrl` | `string` | The current page URL |
| `wsUrl` | `string,null` | Browser websocket URL of the connected Chrome |
| `targetId` | `string,null` | CDP target id of the tab this session drives |
| `connected` | `boolean` | Whether a CDP connection is open |

## Examples

**features.browserUse**

```ts
const browser = container.feature('browserUse')
await browser.open('https://example.com')
const state = await browser.getState()
console.log(state.data._raw_text)
await browser.click('12')
await browser.close()
```



**findDebugChrome**

```ts
const ws = await browserUse.findDebugChrome() // 'ws://127.0.0.1:9222/devtools/browser/…' or null
```



**findChromeExecutable**

```ts
browserUse.findChromeExecutable() // '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
```



**ensureDebugChrome**

```ts
const ws = await browserUse.ensureDebugChrome()
```



**ensurePage**

```ts
const sessionId = await browserUse.ensurePage()
```



**open**

```ts
await browserUse.open('example.com')
```



**getState**

```ts
const state = await browserUse.getState()
console.log(state.data._raw_text)
```



**click**

```ts
await browserUse.click('21')       // element 21
await browserUse.click('100 200')  // coordinates
```



**tabs**

```ts
const { data } = await browserUse.tabs()
```

