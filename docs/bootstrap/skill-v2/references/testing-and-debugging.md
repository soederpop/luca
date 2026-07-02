# Testing and Debugging Luca Projects

Verification is where sessions lose the most time — more than any API confusion. Across recorded challenge attempts, 6 of 8 models burned their largest retry budget trying to test servers and watchers, not writing them. This playbook is the distilled version of what eventually worked.

## Principle: prove logic in `luca eval` before running the real thing

The processing logic inside a command, endpoint, or watcher handler can almost always be exercised directly:

```shell
# Instead of running `luca watch` and dropping files in...
luca eval "
  const fs = container.feature('fs')
  // ...the exact logic your handler will run:
  const raw = await fs.readFileAsync('inbox/sample.json')
  const parsed = JSON.parse(raw)
  console.log(parsed.valid ? 'would move to valid/' : 'would move to invalid/')
"
```

If the logic works in eval, the handler is plumbing — you've removed the hardest variable before starting any long-running process.

## Long-running commands: the background-task pattern

Servers and watchers never exit. The following **do not work** and have failed repeatedly in sandboxed sessions — do not try them again:

- `timeout 5 luca serve` / `gtimeout` — blocked or absent
- `perl -e 'alarm 5; exec ...'` — blocked
- `luca serve & curl localhost:3000 && kill %1` compound one-liners — permission-denied at the `kill`

**What works:**

1. Start the process with your harness's background-execution mechanism (e.g. `run_in_background`), which keeps it alive across turns.
2. Read its output file/stream to confirm it started and see its logs.
3. Interact with it from a separate foreground call (`curl`, `luca eval` with the websocket/rest client).
4. **Kill it before you finish.** An orphaned server squats the port and sabotages the next session.

## Port hygiene

Stale servers from previous attempts are endemic. Assume the port is taken:

```shell
luca serve --force        # kill whatever holds the port, take it
luca serve --any-port     # or just bind a free one

# Manual cleanup, no lsof/pkill needed (those are often permission-blocked):
luca eval "proc.findPidsByPort(3000)"     # → [12345]
luca eval "proc.kill(12345)"
```

When a server "isn't responding", check what port it actually bound before debugging the client. Pass `port` in **constructor options** — `container.server('websocket', { port: 8099, json: true })` — and confirm via logs or `proc.findPidsByPort`. A recorded session lost its entire debugging budget on a healthy client because the server had silently bound its default port.

## The silent-failure catalog

Luca surfaces some failures as empty values instead of exceptions. Treat these as alarms:

| Symptom | Actual cause | Probe |
|---|---|---|
| `docs.models` contains only `["Base"]` | `docs/models.ts` failed to load (import error swallowed) | `bun docs/models.ts` shows the real error |
| `undefined is not an object (evaluating 'definition.name')` from contentDb | you passed an undefined model to `docs.query()` | check `Object.keys(container.docs.models)` first |
| assistant/conversation `.ask()` returns `""` | transport swallowed a process/API error | probe each layer with `luca eval`: raw CLI → transport → provider → assistant |
| build exits 0, no output file | e.g. `bun build --compile` can succeed without writing | check the artifact exists on disk, always |
| helper `state` is `{}` or fields are `undefined` while it demonstrably works | state not hydrated for that helper | trust events and observed behavior; don't debug from state |
| CLI error "succeeded" in your output | you piped `2>&1 | head`, masking the exit code | check exit codes; don't pipe away stderr on discovery commands |

**Bisection discipline:** when a high-level call returns empty, do not fix at the top. Walk down with `luca eval` — call the innermost layer directly (the raw CLI, the transport, the feature method), find the layer where the error message actually appears, fix there. A recorded session needed ~10 eval probes to find what a thrown error would have said instantly — but eval-bisection was still the only thing that found it.

## Reading the live implementation

When docs and behavior disagree, the container will show you the truth:

```shell
luca eval "container.feature('fileManager').watch.toString()"   # the actual code
luca eval "typeof container.feature('fs').readFile"             # does it exist at all
luca eval "Object.getOwnPropertyNames(Object.getPrototypeOf(container.docs))"  # last resort
```

`luca console` gives you the same power interactively when you need several probes in sequence.

## Tests

- Runner is **bun:test**, always. A `package.json` saying `vitest` — even in a sibling repo — is stale; converting tests to vitest is the wrong fix.
- If you import anything from `bun:test`, import *everything* you use from it (`describe`, `it`, `expect`) — a single import disables auto-globals.
- All tests must pass before commit. If your change broke an assertion about old behavior, update the test to the new contract; don't skip it.

## Shell discipline (multi-repo sessions)

Bash working directory persists between calls. If two repos are in play, a bare `bun run typecheck` may run the *other* repo's typecheck and report a false green — this cost a real session an entire forensic subagent. Prefix every build/test/typecheck with an explicit `cd <absolute path> &&` or use absolute paths.
