# Tmux Wrapper Feature

Terminal multiplexer wrapper that lets scripts programmatically split the terminal into tmux panes, run commands in each with full process handles (await, cancel, observe output), and collapse back to a single pane when done.

## Status: Implemented (v1)

Initial implementation landed. See `src/node/features/tmux.ts`.

## API

```ts
const tmux = container.feature('tmux', { enable: true })
await tmux.ensureSession()

const layout = await tmux.split({ count: 3, orientation: 'horizontal' })

const test = await layout.panes[0].run('bun test')
const build = await layout.panes[1].run('bun run build')
const logs = await layout.panes[2].run('tail -f logs/app.log')

// Observable process handles
test.events.on('output', (data) => console.log('test:', data))

// Await completion
const result = await test.await()
console.log('tests exited with', result.exitCode)

// Cancel long-running processes
await logs.cancel()

// Wait for everything
await layout.awaitAll()

// Back to single pane
await layout.collapse()
```

## Key Design Decisions

- **PaneProcess handle**: `run()` returns a rich object with its own `State`, `Bus`, and methods (`await()`, `cancel()`, `kill()`, `capture()`, `sendKeys()`). Not a Helper, just a plain observable object.
- **Completion detection**: Uses `tmux wait-for` signals. The command is wrapped to signal when done.
- **Output streaming**: Polls `tmux capture-pane` on an interval (configurable via `pollInterval` option).
- **Session detection**: Automatically detects if already inside tmux (`$TMUX` env var) and operates within the current session.

## Future Improvements

- Exit code capture via `remain-on-exit` and `pane_dead_status` format
- Named pane support for easier targeting
- Layout presets (e.g. `split({ layout: 'tiled' })` using tmux built-in layouts)
- Pane resize support
- Better output diffing (line-based instead of string slice)
