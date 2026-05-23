---
title: "tmux"
tags: [tmux, sessions, processes, terminal]
lastTested: null
lastTestPassed: null
---

# tmux

Create and control named background terminal sessions from any context.

## Overview

The `tmux` feature wraps the tmux multiplexer to manage named, detached sessions that run independently of any terminal you're in. Unlike running a subprocess directly, tmux sessions persist after your script exits and can be inspected or interacted with later. You send keystrokes to a session, capture its visible output, and check what process is currently in the foreground.

Requires `tmux` to be installed (`brew install tmux` on macOS).

## Creating a Session

Use `session()` to create a new named session running a command. If a session with that name already exists, you get a handle to it without restarting it — so calling `session()` repeatedly is safe.

```ts
const tmux = container.feature('tmux')

const s = await tmux.session('demo', { command: 'bash' })
console.log('exists:', await s.exists())
```

## Sending Input

Use `send()` to type text and press Enter. This is how you interact with any program waiting at a prompt.

```ts
const tmux = container.feature('tmux')
const s = await tmux.session('demo', { command: 'bash' })

await s.send('echo hello from tmux')
await new Promise(r => setTimeout(r, 300))

const output = await s.capture()
console.log(output.trim())
await s.kill()
```

## Capturing Output

Use `capture()` to read the current visible content of the pane. Pass `lines: -N` to also include N lines of scrollback history.

```ts
const tmux = container.feature('tmux')
const s = await tmux.session('demo', { command: 'bash' })

await s.send('for i in 1 2 3 4 5; do echo "line $i"; done')
await new Promise(r => setTimeout(r, 400))

const visible = await s.capture()
console.log('Visible pane:')
console.log(visible.trim())

const withHistory = await s.capture({ lines: -100 })
console.log('With 100 lines of scrollback, chars:', withHistory.length)

await s.kill()
```

## Checking Whether a Pane is Waiting for Input

Use `isWaitingForInput()` to detect whether the program at the prompt is idle. It checks the last non-empty line of the pane content against a set of prompt patterns (`>`, `$`, `%`, `?`, `❯`, `…`).

```ts
const tmux = container.feature('tmux')
const s = await tmux.session('demo', { command: 'bash' })

await new Promise(r => setTimeout(r, 500))
const ready = await s.isWaitingForInput()
console.log('ready at prompt:', ready)

await s.send('sleep 2')
const busy = await s.isWaitingForInput()
console.log('busy (sleep running):', busy)

await new Promise(r => setTimeout(r, 2200))
const doneNow = await s.isWaitingForInput()
console.log('done, back at prompt:', doneNow)

// Pass custom patterns to match any program's specific prompt
const customReady = await s.isWaitingForInput({
  patterns: [/your-app-prompt\s*$/, /\[y\/n\]\s*$/],
})
console.log('custom pattern check:', customReady)

await s.kill()
```

## Checking the Foreground Process

Use `currentCommand()` to see which process is in the foreground of the pane. This tells you whether the shell is idle or a subprocess is running.

```ts
const tmux = container.feature('tmux')
const s = await tmux.session('demo', { command: 'bash' })

await new Promise(r => setTimeout(r, 400))
console.log('at prompt:', await s.currentCommand())  // 'bash'

await s.send('sleep 5 &')  // background job, shell stays in foreground
await new Promise(r => setTimeout(r, 200))
console.log('after bg job:', await s.currentCommand())  // still 'bash'

await s.kill()
```

## Sending Raw Key Sequences

Use `sendKeys()` to send special key sequences without appending Enter. Useful for interrupting a process, navigating menus, or controlling interactive programs.

```ts
const tmux = container.feature('tmux')
const s = await tmux.session('demo', { command: 'bash' })

await s.send('sleep 60')
await new Promise(r => setTimeout(r, 300))
console.log('interrupting...')
await s.sendKeys('C-c')
await new Promise(r => setTimeout(r, 300))
console.log('after interrupt:', await s.currentCommand())  // 'bash'

await s.kill()
```

Common key sequences: `C-c` (Ctrl+C), `C-d` (Ctrl+D / EOF), `Escape`, `Up`, `Down`, `Enter`.

## Listing and Killing Sessions

Use `listSessions()` to see all active sessions, and `killSession()` or `session.kill()` to clean up.

```ts
const tmux = container.feature('tmux')

await tmux.session('worker-1', { command: 'bash' })
await tmux.session('worker-2', { command: 'bash' })

const sessions = await tmux.listSessions()
console.log('active sessions:')
sessions.forEach(s => console.log(' ', s.name, '— windows:', s.windows))

await tmux.killSession('worker-1')
await tmux.killSession('worker-2')

console.log('after cleanup:', (await tmux.listSessions()).length, 'sessions')
```

## Running a Low-Level Command

Use `run()` for any tmux operation not covered by the API. It returns stdout and stderr as strings.

```ts
const tmux = container.feature('tmux')
const s = await tmux.session('demo', { command: 'bash' })

const info = await tmux.run(['display-message', '-t', 'demo', '-p', '#{pane_width}x#{pane_height}'])
console.log('pane dimensions:', info.stdout.trim())

await s.kill()
```

## Summary

This demo covered creating named detached sessions, sending input, capturing pane output, detecting when a program is waiting for input, identifying the foreground process, sending raw key sequences, listing and killing sessions, and issuing raw tmux commands. Sessions persist independently of your script — start one, walk away, and come back to inspect it later.
