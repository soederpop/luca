# features.ink

Ink Feature — React-powered Terminal UI via Ink Exposes the Ink library (React for CLIs) through the container so any feature, script, or application can build rich terminal user interfaces using React components rendered directly in the terminal. This feature is intentionally a thin pass-through. It re-exports all of Ink's components, hooks, and the render function, plus a few convenience methods for mounting / unmounting apps. The actual UI composition is left entirely to the consumer — the feature just makes Ink available. **What you get:** - `ink.render(element)` — mount a React element to the terminal - `ink.components` — { Box, Text, Static, Transform, Newline, Spacer } - `ink.hooks` — { useInput, useApp, useStdin, useStdout, useStderr, useFocus, useFocusManager } - `ink.React` — the React module itself (createElement, useState, etc.) - `ink.unmount()` — tear down the currently mounted app - `ink.waitUntilExit()` — await the mounted app's exit **Quick start:** ```tsx const ink = container.feature('ink', { enable: true }) const { Box, Text } = ink.components const { React } = ink ink.render( React.createElement(Box, { flexDirection: 'column' }, React.createElement(Text, { color: 'green' }, 'hello from ink'), React.createElement(Text, { dimColor: true }, 'powered by luca'), ) ) await ink.waitUntilExit() ``` Or if you're in a .tsx file: ```tsx import React from 'react' const ink = container.feature('ink', { enable: true }) const { Box, Text } = ink.components ink.render( <Box flexDirection="column"> <Text color="green">hello from ink</Text> <Text dimColor>powered by luca</Text> </Box> ) ```

## Methods

### loadModules

Pre-load ink + react modules so the sync getters work. Called automatically by render(), but you can call it early.

**Returns:** `void`

```ts
const ink = container.feature('ink', { enable: true })
await ink.loadModules()
// Now sync getters like ink.React, ink.components, ink.hooks work
const { Box, Text } = ink.components
```



### render

Mount a React element to the terminal. Wraps `ink.render()` — automatically loads modules if needed, tracks the instance for unmount / waitUntilExit, and updates state.

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `node` | `any` | ✓ | A React element (JSX or React.createElement) |

| `options` | `Record<string, any>` |  | Ink render options (stdout, stdin, debug, etc.) |

**Returns:** `void`



### rerender

Re-render the currently mounted app with a new root element.

**Parameters:**

| Name | Type | Required | Description |

|------|------|----------|-------------|

| `node` | `any` | ✓ | Parameter node |

**Returns:** `void`

```ts
const ink = container.feature('ink', { enable: true })
const { React } = await ink.loadModules()
const { Text } = ink.components

await ink.render(React.createElement(Text, null, 'Hello'))
ink.rerender(React.createElement(Text, null, 'Updated!'))
```



### unmount

Unmount the currently mounted Ink app. Tears down the React tree rendered in the terminal and resets state. Safe to call when no app is mounted (no-op).

**Returns:** `void`

```ts
const ink = container.feature('ink', { enable: true })
await ink.render(myElement)
// ... later
ink.unmount()
console.log(ink.isMounted) // false
```



### waitUntilExit

Returns a promise that resolves when the mounted app exits. Useful for keeping a script alive while the terminal UI is active.

**Returns:** `Promise<void>`

```ts
const ink = container.feature('ink', { enable: true })
await ink.render(myElement)
await ink.waitUntilExit()
console.log('App exited')
```



### clear

Clear the terminal output of the mounted app. Erases all Ink-rendered content from the terminal. Safe to call when no app is mounted (no-op).

**Returns:** `void`

```ts
const ink = container.feature('ink', { enable: true })
await ink.render(myElement)
// ... later, wipe the screen
ink.clear()
```



## Getters

| Property | Type | Description |

|----------|------|-------------|

| `React` | `any` | The React module (createElement, useState, useEffect, etc.) Exposed so consumers don't need a separate react import. Lazy-loaded — first access triggers the import. |

| `components` | `any` | All Ink components as a single object for destructuring. ```ts const { Box, Text, Static, Spacer } = ink.components ``` |

| `hooks` | `any` | All Ink hooks as a single object for destructuring. ```ts const { useInput, useApp, useFocus } = ink.hooks ``` |

| `measureElement` | `any` | The Ink measureElement utility. |

| `isMounted` | `boolean` | Whether an ink app is currently mounted. |

| `instance` | `any` | The raw ink render instance if you need low-level access. |

## Events

### mounted

Event emitted by Ink



### unmounted

Event emitted by Ink



## State

| Property | Type | Description |

|----------|------|-------------|

| `enabled` | `boolean` | Whether this feature is currently enabled |

| `mounted` | `boolean` | Whether an ink app is currently rendered / mounted |

## Options

| Property | Type | Description |

|----------|------|-------------|

| `maxFps` | `number` | Maximum frames per second for render updates |

| `patchConsole` | `boolean` | Patch console methods to avoid mixing with Ink output |

| `incrementalRendering` | `boolean` | Enable incremental rendering mode |

| `concurrent` | `boolean` | Enable React concurrent rendering mode |

## Examples

**loadModules**

```ts
const ink = container.feature('ink', { enable: true })
await ink.loadModules()
// Now sync getters like ink.React, ink.components, ink.hooks work
const { Box, Text } = ink.components
```



**rerender**

```ts
const ink = container.feature('ink', { enable: true })
const { React } = await ink.loadModules()
const { Text } = ink.components

await ink.render(React.createElement(Text, null, 'Hello'))
ink.rerender(React.createElement(Text, null, 'Updated!'))
```



**unmount**

```ts
const ink = container.feature('ink', { enable: true })
await ink.render(myElement)
// ... later
ink.unmount()
console.log(ink.isMounted) // false
```



**waitUntilExit**

```ts
const ink = container.feature('ink', { enable: true })
await ink.render(myElement)
await ink.waitUntilExit()
console.log('App exited')
```



**clear**

```ts
const ink = container.feature('ink', { enable: true })
await ink.render(myElement)
// ... later, wipe the screen
ink.clear()
```

