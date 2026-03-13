---
title: "Window Manager Layouts"
tags: [windowManager, layout, native, ipc, macos, multi-window]
lastTested: null
lastTestPassed: null
---

# Window Manager Layouts

Spawn and manage multiple windows at once using the layout API. Layouts let you declare groups of browser and terminal windows that open in parallel, or sequence multiple groups so each batch waits for the previous one to finish.

## Overview

The `windowManager` feature exposes two layout methods:

- **`spawnLayout(config)`** — spawns all entries in parallel, returns `WindowHandle[]`
- **`spawnLayouts(configs)`** — spawns multiple layouts sequentially (each layout's windows still spawn in parallel), returns `WindowHandle[][]`

Each entry in a layout is a `LayoutEntry` — either a browser window or a TTY window. Type detection is automatic: if the entry has a `command` field or `type: 'tty'`, it's a terminal. Otherwise it's a browser window.

## Setup

```ts
const wm = container.feature('windowManager', {
  autoListen: true,
  requestTimeoutMs: 10000
})
console.log('Window Manager ready')
```

## Single Layout — Parallel Windows

Spawn a mix of browser and terminal windows that all open at the same time.

```ts 
const handles = await wm.spawnLayout([
  { url: 'https://github.com', width: '50%', height: '100%', x: 0, y: 0 },
  { url: 'https://soederpop.com', width: '50%', height: '100%', x: '50%', y: 0 },
  { command: 'top', title: 'System Monitor', width: 900, height: 400, x: 0, y: 720 },
])

console.log('Spawned', handles.length, 'windows')
handles.forEach((h, i) => console.log(`  [${i}] windowId: ${h.windowId}`))
```

All three windows open simultaneously. The returned `handles` array preserves the same order as the config entries, so `handles[0]` corresponds to the GitHub window, `handles[1]` to HN, and `handles[2]` to htop.

## Percentage-Based Dimensions

Dimensions (`width`, `height`, `x`, `y`) accept percentage strings resolved against the primary display. This makes layouts portable across different screen resolutions.

```ts skip
// Side-by-side: two windows each taking half the screen
const handles = await wm.spawnLayout([
  { url: 'https://github.com', width: '50%', height: '100%', x: '0%', y: '0%' },
  { url: 'https://news.ycombinator.com', width: '50%', height: '100%', x: '50%', y: '0%' },
])
```

You can mix absolute and percentage values freely:

```ts skip
const handles = await wm.spawnLayout([
  { url: 'https://example.com', width: '75%', height: 600, x: '12.5%', y: 50 },
  { command: 'htop', width: '100%', height: '30%', x: '0%', y: '70%' },
])
```

## Explicit Type Field

You can be explicit about entry types using the `type` field. This is equivalent to the implicit detection but more readable when mixing window types.

```ts skip
const handles = await wm.spawnLayout([
  { type: 'window', url: 'https://example.com', width: 800, height: 600 },
  { type: 'tty', command: 'tail -f /var/log/system.log', title: 'Logs' },
])

console.log('Browser window:', handles[0].windowId)
console.log('TTY window:', handles[1].windowId)
```

## Sequential Layouts

Use `spawnLayouts()` when you need windows to appear in stages. Each layout batch spawns in parallel, but the next batch waits until the previous one is fully ready.

```ts skip
const [dashboards, tools] = await wm.spawnLayouts([
  // First batch: main content
  [
    { url: 'https://grafana.internal/d/api-latency', width: 960, height: 800, x: 0, y: 0 },
    { url: 'https://grafana.internal/d/error-rate', width: 960, height: 800, x: 970, y: 0 },
  ],
  // Second batch: supporting tools (opens after dashboards are ready)
  [
    { command: 'htop', title: 'CPU', width: 640, height: 400, x: 0, y: 820 },
    { command: 'tail -f /var/log/system.log', title: 'Logs', width: 640, height: 400, x: 650, y: 820 },
  ],
])

console.log('Dashboards:', dashboards.map(h => h.windowId))
console.log('Tools:', tools.map(h => h.windowId))
```

This is useful when the second batch depends on the first being visible — for example, positioning tool windows below dashboard windows.

## Lifecycle Events on Layout Handles

Every handle returned from a layout supports the same event API as a single `spawn()` call. You can listen for `close` and `terminalExited` events on each handle independently.

```ts skip
const handles = await wm.spawnLayout([
  { url: 'https://example.com', width: 800, height: 600 },
  { command: 'sleep 5 && echo done', title: 'Short Task' },
])

const [browser, terminal] = handles

browser.on('close', () => console.log('Browser window closed'))

terminal.on('terminalExited', (info) => {
  console.log('Terminal process finished:', info)
})
```

## Window Chrome Options

Layout entries support all the same window chrome options as regular `spawn()` calls.

```ts skip
const handles = await wm.spawnLayout([
  {
    url: 'https://example.com',
    width: 400,
    height: 300,
    alwaysOnTop: true,
    window: {
      decorations: 'hiddenTitleBar',
      transparent: true,
      shadow: true,
      opacity: 0.9,
    }
  },
  {
    url: 'https://example.com/overlay',
    width: 200,
    height: 100,
    window: {
      decorations: 'none',
      clickThrough: true,
      transparent: true,
    }
  },
])
```

## Operating on All Handles

Since layouts return arrays of `WindowHandle`, you can easily batch operations across all windows.

```ts skip
const handles = await wm.spawnLayout([
  { url: 'https://example.com/a', width: 600, height: 400 },
  { url: 'https://example.com/b', width: 600, height: 400 },
  { url: 'https://example.com/c', width: 600, height: 400 },
])

// Navigate all windows to the same URL
await Promise.all(handles.map(h => h.navigate('https://example.com/updated')))

// Screenshot all windows
await Promise.all(handles.map((h, i) => h.screengrab(`./layout-${i}.png`)))

// Close all windows
await Promise.all(handles.map(h => h.close()))
```

## Summary

The layout API builds on top of `spawn()` and `spawnTTY()` to orchestrate multi-window setups. Use `spawnLayout()` for a single batch of parallel windows, and `spawnLayouts()` when you need staged sequences. Every returned handle supports the full `WindowHandle` API — events, navigation, eval, screenshots, and more.
