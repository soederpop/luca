---
title: "Tmux"
tags: [tmux, terminal, multiplexer, panes]
lastTested: null
lastTestPassed: null
---

# tmux

Terminal multiplexer feature that wraps tmux to provide programmatic control over terminal sessions, panes, and commands running inside them.

## Overview

The `tmux` feature lets scripts split the terminal into multiple panes, run commands in each pane with full process handles, observe output, and collapse everything back when done. It requires tmux to be installed on the system. If the script is not already running inside a tmux session, `ensureSession` can re-exec the process inside one.

## Enabling the Feature

```ts
const tmux = container.feature('tmux', { enable: true })
console.log('Tmux enabled:', tmux.state.get('enabled'))
console.log('Tmux available:', tmux.state.get('isTmuxAvailable'))
console.log('Inside tmux:', tmux.state.get('isInsideTmux'))
```

## Exploring the API

```ts
const docs = container.features.describe('tmux')
console.log(docs)
```

## Ensuring a Session

The `ensureSession` method guarantees the script is running inside a tmux session. If not already inside one, it re-execs the current process inside a new tmux session.

```ts skip
const tmux = container.feature('tmux', { enable: true })
await tmux.ensureSession('my-session')
console.log('Session:', tmux.state.get('sessionName'))
```

Because `ensureSession` may replace the current process, any code after it only runs inside the tmux session. This is intentional -- it ensures pane operations have a real terminal to work with.

## Splitting Panes

Split the current window into multiple panes and run commands in each.

```ts skip
const layout = await tmux.split({
  count: 2,
  orientation: 'horizontal',
  size: 50
})
console.log('Pane IDs:', layout.panes.map(p => p.id))
```

The `count` option determines how many new panes to create. `orientation` can be `'horizontal'` (side by side) or `'vertical'` (stacked). The returned `TmuxLayout` object contains handles for each pane.

## Running Commands in Panes

Execute commands in specific panes and capture their output.

```ts skip
const process1 = await tmux.runInPane(layout.panes[0].id, 'bun test')
const process2 = await tmux.runInPane(layout.panes[1].id, 'bun run build')

process1.events.on('output', (data) => {
  console.log('tests:', data)
})

await layout.awaitAll()
```

Each `runInPane` call returns a `PaneProcess` handle with events for observing output. `layout.awaitAll()` waits for all pane commands to finish.

## Capturing and Collapsing

Read the current content of a pane, then collapse back to a single pane when finished.

```ts skip
const content = await tmux.capture(layout.panes[0].id)
console.log('Pane content:', content)

await tmux.collapse()
console.log('Back to a single pane')
```

The `collapse` method kills all managed panes except the first, returning to a single-pane view. Use `killSession` to tear down the entire session.

## Summary

The `tmux` feature provides programmatic control over tmux sessions and panes. Scripts can split terminals, run parallel commands with output observation, capture pane content, and clean up when done. Requires tmux to be installed.
