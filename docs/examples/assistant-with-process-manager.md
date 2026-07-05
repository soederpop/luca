---
title: Assistant with ProcessManager Tools
tags:
  - assistant
  - processManager
  - tools
  - runtime
  - use
lastTested: '2026-07-05'
lastTestPassed: true
---

# Assistant with ProcessManager Tools

Create an assistant at runtime, give it processManager tools via `assistant.use()`, and let it orchestrate long-running processes — spawning ping and top, checking their output over time, running a quick command in between, then coming back to report.

## Wire the tools (no API key needed)

`assistant.use(feature)` registers the feature's tool surface immediately — the tool schemas, bound handlers, and system-prompt extension all exist before any model is involved. That makes the wiring verifiable without credentials:

```ts
pm = container.feature('processManager', { enable: true, autoCleanup: true })

assistant = container.feature('assistant', {
  systemPrompt: [
    'You are a process management assistant with tools to spawn, monitor, inspect, and kill background processes.',
    'When asked to check on processes, use getProcessOutput to read their latest output and summarize what you see.',
    'For ping output, parse the lines and calculate the average response time yourself.',
    'For top output, summarize CPU and memory usage from the header lines.',
    'Always be concise — give the data, not a lecture.',
  ].join('\n'),
  model: 'gpt-4.1-mini',
})

assistant.use(pm)

const tools = Object.keys(assistant.tools)
console.log('Tools registered:', tools.join(', '))
if (tools.length === 0) throw new Error('assistant.use(pm) registered no tools')
```

## The conversation demo

Driving the conversation calls the model, so this part needs an `OPENAI_API_KEY`:

```ts skip
await assistant.start()
const ui = container.feature('ui')

// ── Helper to print assistant responses ──────────────────────────────
const ask = async (label, question) => {
  console.log(ui.colors.dim(`── ${label} ──`))
  console.log(ui.colors.yellow('→'), question.split('\n')[0])
  const response = await assistant.ask(question)
  console.log(ui.markdown(response))
  console.log()
  return response
}

// Step 1: Spawn long-running processes
await ask('SPAWN',
  'Spawn two background processes:\n' +
  '1. Ping google.com with tag "ping-google" (use: ping -c 20 google.com)\n' +
  '2. Run top in batch mode with tag "top-monitor" (use: top -l 5 -s 2)\n' +
  'Confirm both are running.'
)

// Step 2: Wait, then check in on their output
await new Promise(r => setTimeout(r, 4000))
await ask('CHECK-IN #1',
  'Check on both processes. For ping-google, read the stdout and tell me how many replies so far and the average response time. For top-monitor, read the stdout and tell me the current CPU usage summary.'
)

// Step 3: Quick one-shot command while the others keep going
await ask('QUICK COMMAND',
  'Run a quick command: "uptime" — tell me the system load averages.'
)

// Step 4: Second check-in — more data should have accumulated
await new Promise(r => setTimeout(r, 4000))
await ask('CHECK-IN #2',
  'Check on ping-google again. How many replies now vs last time? What is the average response time? Also list all tracked processes and their status.'
)

// Step 5: Kill everything
await ask('CLEANUP',
  'Kill all running processes and confirm they are stopped.'
)
```

## Cleanup always works headlessly

The tools the assistant would call are just processManager methods — call them directly to prove the surface is live:

```ts
pm.killAll()
const remaining = pm.list().filter(h => h.status === 'running')
console.log('Running after cleanup:', remaining.length)
if (remaining.length !== 0) throw new Error('processes survived killAll')
```

## Summary

The runnable part proves the composition: a runtime assistant wired with processManager tools, verified without a model call. The skipped conversation shows what it looks like driven end to end — spawning long-running `ping` and `top` commands, checking in on their output as it accumulates, running a quick `uptime` in between, then cleaning everything up with natural language alone. See [feature-as-tool-provider](./feature-as-tool-provider.md) for how to author your own tool-providing feature.
