# Tmux Wrapper Feature

A terminal multiplexer wrapper that allows scripts to programmatically split terminal windows, run processes in separate panes, monitor their output/completion, and collapse back to a single terminal when done.

## Proposed API

```ts
const layout = terminal.split({ orientation: 'horizontal', count: 3 })
layout.panes[0].run('bun test')
layout.panes[1].run('bun run build')
layout.panes[2].run('tail -f logs/app.log')
await layout.waitForAll()
layout.collapse() // back to single pane
```

## Approach Options

1. **Direct tmux CLI control** — Drive tmux via its command interface (`tmux split-window`, `tmux send-keys`, `tmux select-pane`, `tmux capture-pane`). Proven, lightweight.
2. **node-pty + blessed/ink** — Spawn pseudo-terminals and render with a TUI library. More work, more control, no tmux dependency.
3. **Hybrid (recommended)** — Use tmux as the layout engine but wrap it so the API feels native to Luca. Script spawns a tmux session, orchestrates panes, and when everything finishes, collapses back to a single pane.

## Implementation Notes

- Would be a `Feature` in the container system
- Script detects or creates a tmux session
- Splits panes on demand, sends commands to specific panes
- Monitors via `tmux capture-pane` or exit codes
- Kills extra panes when complete
- tmux is nearly universal on unix systems
