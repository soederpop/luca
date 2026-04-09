---
name: react-ink
description: >
  Building terminal UIs with React Ink — interactive CLIs, dashboards, menus, progress displays,
  keyboard navigation, focus management, and testing Ink apps. Use this skill when creating or
  modifying React components that render to the terminal, when you see ink imports, or when the
  user asks for a rich CLI interface beyond simple chalk output.
user-invocable: false
metadata:
  author: soederpop
  version: "1.0.0"
---

# React Ink: React for the Terminal

Ink is a custom React renderer for command-line interfaces. It uses Yoga for Flexbox-based terminal layout, so the mental model is **React components + Flexbox**, not ad hoc cursor math.

**Detection signals** — this skill applies when any of the following are true:
- Code imports from `ink` or `ink-testing-library`
- A component renders `<Box>`, `<Text>`, `<Static>`, or other Ink primitives
- The user asks for a rich interactive CLI: menus, dashboards, progress bars, keyboard-driven UIs
- `package.json` has `ink` in dependencies
- The user wants to move beyond simple `console.log` / chalk output to a reactive terminal UI

**When NOT to use Ink:**
- Simple one-shot scripts that print output and exit — chalk/console is fine
- Non-interactive log output in CI — Ink's live repainting adds overhead for no benefit
- Browser or web UIs — Ink is terminal-only

---

## 1. Mental Model

```
React component tree
    -> Custom DOM nodes (ink-root, ink-box, ink-text)
        -> Yoga layout (Flexbox)
            -> String rendering -> terminal output via log-update
```

Ink builds a custom host tree and applies Yoga layout before converting it to terminal output. Browser React intuitions mostly transfer for component composition and state, but layout and rendering behave differently.

---

## 2. Environment Requirements

- **React 19+** (peer dependency)
- **Ink 7.x** (pure ESM, `import` only — no `require`)
- **Node.js >= 22** (or Bun)
- **Testing:** `ink-testing-library`
- **Devtools:** `react-devtools-core` + `DEV=true` (optional)

---

## 3. Core API Cheat Sheet

### Rendering

| Export | Purpose |
|--------|---------|
| `render(element, options?)` | Mount an Ink app to stdout. Returns `{ unmount, waitUntilExit, rerender, clear }` |
| `renderToString(element)` | Render to a string (for testing or non-interactive output) |

### Layout & Display Primitives

| Component | Purpose | Key constraint |
|-----------|---------|---------------|
| `<Box>` | Flexbox container — dimensions, padding, margin, gap, flex, alignment, borders, overflow | The primary layout building block |
| `<Text>` | Styled text — bold, italic, underline, strikethrough, color, dimColor, wrap | **Cannot contain `<Box>`** — only text nodes and nested `<Text>` |
| `<Newline>` | Insert blank lines (`count` prop) | — |
| `<Spacer>` | Flex spacer (expands to fill available space) | — |
| `<Static>` | Append-only output rendered above the live app (logs, completed items) | Only renders *newly added* items; ignores re-renders of prior items |
| `<Transform>` | Post-process rendered text strings | Only wrap `<Text>` children; must not change output dimensions |

### Hooks

| Hook | Purpose |
|------|---------|
| `useInput(handler, options?)` | Keyboard input — normalized `key` object with arrows, modifiers, etc. Enables raw mode while active |
| `useApp()` | Access `{ exit }` to programmatically exit the app |
| `useStdin()` | Access stdin stream and `isRawModeSupported` |
| `useStdout()` | Access stdout stream and `write()` for side-channel output |
| `useStderr()` | Access stderr stream and `write()` |
| `useFocus(options?)` | Register a component as focusable — Tab/Shift+Tab navigation, auto-focus, focus by id |
| `useFocusManager()` | Programmatic focus control — `focusNext()`, `focusPrevious()`, `focus(id)` |
| `useCursor()` | Terminal cursor visibility control |
| `useAnimation()` | Shared animation timer — `frame`, `time`, `delta`. Coalesces into one render cycle |
| `useWindowSize()` | Terminal dimensions, updates on resize |
| `useBoxMetrics()` | Measure a Box's layout dimensions |
| `usePaste(handler)` | Distinct channel for pasted content (not misinterpreted as keystrokes) |

---

## 4. Design Rules

### Text vs Box
`<Text>` is strictly text-oriented. It allows text nodes and nested `<Text>`, but **never `<Box>` inside `<Text>`**. If you need layout, wrap in `<Box>` first.

```tsx
// WRONG
<Text>Hello <Box>world</Box></Text>

// RIGHT
<Box>
  <Text>Hello </Text>
  <Text>world</Text>
</Box>
```

### Static for history, Box for live state
Use `<Static>` for completed items, logs, and history that should remain visible above the live UI. Use `<Box>` for the active/updating portion. `<Static>` only renders newly added items — it is not a general-purpose list.

```tsx
<>
  <Static items={completedTasks}>
    {(task) => <Text key={task.id}>Done: {task.name}</Text>}
  </Static>
  <Box>
    <Text>Working on: {currentTask.name}</Text>
  </Box>
</>
```

### Interactive vs non-interactive (CI)
Ink auto-detects TTY vs CI. In non-interactive mode, it disables cursor manipulation, synchronized output, and continuous repainting — it writes only the final frame at unmount. Design your app to degrade gracefully:
- Gate interactive-only features behind `stdout.isTTY`
- Consider what the CI log output looks like

### App lifecycle
An Ink app is a Node.js process. It stays alive only while the event loop has work (timers, input listeners, pending promises). A component tree with no ongoing work renders once and exits. Use `waitUntilExit()` for cleanup logic after unmount.

### Stdout exclusivity
Ink maintains one live renderer per stdout stream. Do not call `render()` multiple times on the same stream without `unmount()`ing first.

---

## 5. Input & Focus Patterns

### Global keyboard shortcuts
```tsx
import { useInput, useApp } from 'ink';

function App() {
  const { exit } = useApp();

  useInput((input, key) => {
    if (input === 'q') exit();
    if (key.upArrow) { /* navigate up */ }
    if (key.return) { /* confirm */ }
  });

  return <Text>Press q to quit</Text>;
}
```

### Multi-widget focus
```tsx
import { useFocus, Box, Text } from 'ink';

function MenuItem({ label }: { label: string }) {
  const { isFocused } = useFocus();
  return (
    <Box>
      <Text color={isFocused ? 'green' : undefined}>
        {isFocused ? '> ' : '  '}{label}
      </Text>
    </Box>
  );
}
```

### When to use what
- **`useInput`** — global shortcuts, simple controls
- **`useFocus` + `useFocusManager`** — multi-widget interfaces with Tab navigation
- **`usePaste`** — accepting multiline or bulk text input

---

## 6. Performance Best Practices

- **Rendering is throttled** at 30fps by default (`maxFps` option). Don't fight this.
- **Use `useAnimation`** for animations — it coalesces into one render cycle instead of each component spinning its own timers.
- **Use `<Static>`** for immutable history — it avoids re-rendering completed output.
- **Avoid bespoke high-frequency timers** — they waste render cycles. Let Ink's throttling do its job.
- **Incremental rendering** is opt-in for updating only changed lines (reduces flicker for frequently updating UIs).

---

## 7. Accessibility

Ink supports screen reader mode via `render(..., { isScreenReaderEnabled: true })` or `INK_SCREEN_READER=true`.

Supported attributes on Box/Text: `aria-label`, `aria-hidden`, `aria-role`, `aria-state`.

Use `useIsScreenReaderEnabled()` to conditionally render more descriptive output for widgets like checkboxes, progress bars, and selection UIs.

---

## 8. Testing

Use `ink-testing-library` for component tests:

```tsx
import { render } from 'ink-testing-library';

const { lastFrame } = render(<MyComponent />);
expect(lastFrame()).toContain('expected output');
```

**Testing checklist:**
- Snapshot/frame tests for pure rendering (`lastFrame()`)
- Simulated input for interaction testing
- Use `act()` for async state updates, especially with concurrent mode or animations
- Test both interactive and non-interactive modes if your app supports both

---

## 9. Common Patterns

### Progress indicator
```tsx
function Progress({ percent }: { percent: number }) {
  const width = 20;
  const filled = Math.round(width * percent / 100);
  return (
    <Box>
      <Text>[{'='.repeat(filled)}{' '.repeat(width - filled)}]</Text>
      <Text> {percent}%</Text>
    </Box>
  );
}
```

### Spinner with status
```tsx
function Spinner({ label }: { label: string }) {
  const frames = ['|', '/', '-', '\\'];
  const { frame } = useAnimation();
  return <Text>{frames[frame % frames.length]} {label}</Text>;
}
```

### Two-column layout
```tsx
<Box>
  <Box flexDirection="column" width="30%">
    <Text bold>Sidebar</Text>
  </Box>
  <Box flexDirection="column" flexGrow={1}>
    <Text>Main content</Text>
  </Box>
</Box>
```

### Exit with cleanup
```tsx
const { waitUntilExit } = render(<App />);
await waitUntilExit();
console.log('Cleanup complete');
```
