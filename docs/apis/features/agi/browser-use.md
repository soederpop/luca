# BrowserUse (features.browserUse)

Browser automation feature wrapping the browser-use CLI. Provides programmatic browser control — navigation, clicking, typing, screenshots, JavaScript evaluation, data extraction, and more.

## Usage

```ts
container.feature('browserUse', {
  // Default session name
  session,
  // Show browser window by default
  headed,
  // Chrome profile name to use
  profile,
  // Auto-discover and connect to a running Chrome via CDP
  connect,
  // Connect to an existing browser via CDP URL (http:// or ws://)
  cdpUrl,
})
```

## Options (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `session` | `string` | Default session name |
| `headed` | `boolean` | Show browser window by default |
| `profile` | `string` | Chrome profile name to use |
| `connect` | `boolean` | Auto-discover and connect to a running Chrome via CDP |
| `cdpUrl` | `string` | Connect to an existing browser via CDP URL (http:// or ws://) |

## Methods

### afterInitialize

**Returns:** `void`



### open

Navigate to a URL

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `url` | `string` | ✓ | The URL to open |

**Returns:** `Promise<BrowserUseResult>`

```ts
await browserUse.open('https://example.com')
```



### click

Click an element by index or coordinates

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `target` | `string` | ✓ | Element index or "x y" coordinates |

**Returns:** `Promise<BrowserUseResult>`

```ts
await browserUse.click('21')       // click element 21
await browserUse.click('100 200')  // click at coordinates
```



### type

Type text at the current cursor position

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `text` | `string` | ✓ | Text to type |

**Returns:** `Promise<BrowserUseResult>`



### input

Type text into a specific element

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `index` | `string` | ✓ | Element index |
| `text` | `string` | ✓ | Text to enter |

**Returns:** `Promise<BrowserUseResult>`



### getState

Get the current browser state (URL, title, interactive elements)

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
| `js` | `string` | ✓ | JavaScript code to evaluate |

**Returns:** `Promise<BrowserUseResult>`



### extract

Extract structured data from the page using an LLM

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `query` | `string` | ✓ | Natural language description of what to extract |

**Returns:** `Promise<BrowserUseResult>`



### scroll

Scroll the page

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `direction` | `'up' | 'down'` |  | 'up' or 'down' |
| `amount` | `number` |  | Pixels to scroll |

**Returns:** `Promise<BrowserUseResult>`



### keys

Send keyboard keys

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `keys` | `string` | ✓ | Key combination (e.g. "Enter", "Control+a") |

**Returns:** `Promise<BrowserUseResult>`



### back

Go back in browser history

**Returns:** `Promise<BrowserUseResult>`



### getTitle

Get the current page title

**Returns:** `Promise<BrowserUseResult>`



### getHtml

Get the full page HTML

**Returns:** `Promise<BrowserUseResult>`



### getText

Get text content of an element

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `index` | `string` | ✓ | Element index |

**Returns:** `Promise<BrowserUseResult>`



### select

Select a dropdown option

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `index` | `string` | ✓ | Element index of the dropdown |
| `value` | `string` | ✓ | Value to select |

**Returns:** `Promise<BrowserUseResult>`



### waitForSelector

Wait for a CSS selector to appear

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `selector` | `string` | ✓ | CSS selector |

**Returns:** `Promise<BrowserUseResult>`



### waitForText

Wait for text to appear on the page

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `text` | `string` | ✓ | Text to wait for |

**Returns:** `Promise<BrowserUseResult>`



### switchTab

Switch to a tab by index

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `tab` | `string` | ✓ | Tab index |

**Returns:** `Promise<BrowserUseResult>`



### closeTab

Close a tab

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `tab` | `string` |  | Tab index (closes current if omitted) |

**Returns:** `Promise<BrowserUseResult>`



### close

Close the browser session

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `all` | `boolean` |  | If true, close all sessions |

**Returns:** `Promise<BrowserUseResult>`



### sessions

List active browser sessions

**Returns:** `Promise<BrowserUseResult>`



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



### upload

Upload a file to a file input element

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `index` | `string` | ✓ | Element index of the file input |
| `path` | `string` | ✓ | Local file path to upload |

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



## Events (Zod v4 schema)

### navigated

Emitted after navigating to a URL

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | URL navigated to |



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



### screenshot

Emitted after taking a screenshot

**Event Arguments:**

| Name | Type | Description |
|------|------|-------------|
| `arg0` | `string` | Base64 or file path |



### closed

Emitted when the browser session is closed



## State (Zod v4 schema)

| Property | Type | Description |
|----------|------|-------------|
| `enabled` | `boolean` | Whether this feature is currently enabled |
| `session` | `string` | Active browser session name |
| `headed` | `boolean` | Whether the browser window is visible |
| `currentUrl` | `string` | The current page URL |

## Examples

**features.browserUse**

```ts
const browser = container.feature('browserUse')
await browser.open('https://example.com')
const state = await browser.getState()
await browser.click('21')
await browser.close()
```



**open**

```ts
await browserUse.open('https://example.com')
```



**click**

```ts
await browserUse.click('21')       // click element 21
await browserUse.click('100 200')  // click at coordinates
```



**getState**

```ts
const state = await browserUse.getState()
console.log(state.data._raw_text)
```

