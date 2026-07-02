---
tags: [usability, agents, claude-md, skill, evaluation]
---

# Framework Struggle Analysis — July 2026

Where AI assistants struggle with the Luca framework, mined from 26 Claude Code session transcripts (luca repo, @agentic-loop, mydesigner) plus the 8 substantive challenge attempt logs in `docs/sessions/`. This report drove the proposals in `docs/bootstrap/CLAUDE-v2.md` and `docs/bootstrap/skill-v2/`.

## The ranked failure patterns

### 1. Discovery discipline collapses under pressure (most frequent)

`luca describe` is praised in 6 of 8 challenge logs as the best discovery tool — and then barely used in real working sessions (~2 describe/eval calls in ~200 tool calls across the two biggest sessions). Models default to `find`/`grep`/path-guessing, which produced:

- A wrong "this capability doesn't exist, let's build `mcpHost`" architecture proposal when `luca mcp` already existed (user had to correct).
- Four round-trips guessing `docs.path` / `_path` / `modelsPath` and finally reflection via `Object.getOwnPropertyNames` — the answer (`collectionPath`) was one `luca describe contentDb` away.
- Wrong directory guesses (`src/node/clients/`), wrong registry-name guesses (`telnyx` vs `telnyxAssistantConnector`), kebab-vs-camelCase filename misses (`cipherSocial` → `cipher-social.ts`).

The pattern: the CLI is used to *verify* at the end, not to *discover* at the start. In consumer projects it's worse — luca is often ignored entirely (mydesigner: one luca engagement in 5 sessions; the skill was never invoked; one session `bun add xlsx` + `node:fs` when `googleSheets.saveAsCsv` existed).

### 2. Verifying long-running commands is the #1 time sink (6/8 challenge attempts)

Models burned their largest retry budgets on `timeout`/`gtimeout`/`perl alarm` (all sandbox-blocked, up to 8 consecutive failures), compound `serve & curl && kill` one-liners (permission-denied), and stale servers squatting ports across attempts (port 3456 twice; two attempts ended with orphaned servers). The two patterns that worked — prototype logic in `luca eval`, run the live process as a background task — were discovered independently and documented nowhere.

### 3. Silent failures cost the most turns per incident

- `server.start()` reporting success on the wrong port (options in the wrong place) → whole session debugging a healthy client.
- `bun build --compile` exiting 0 without writing output, combined with `proc.execAndCapture` silently mangling a quoted path → fake successful build.
- Assistant `.ask()` returning `""` while the transport swallowed process errors → ~10-probe layer-by-layer bisection.
- `docs/models.ts` failing to load silently (`docs.models == ["Base"]`); `docs.query(undefined)` exploding as `undefined is not an object (evaluating 'definition.name')` deep in bundled code.
- A phantom API (`proc.resolveRealPath`) committed inside a try/catch — shipped wrong guess hiding a real bug.
- Helper `state` not hydrating (listening server with `state == {}`) — killed state-based debugging.

### 4. The process/import boundary is the hardest thing to learn by trial

Scripts importing `luca` under plain bun crash on native bindings; `luca run`'s VM breaks on relative static imports (`Unexpected string literal "./bundle.ts"`); `luca eval` can't import npm packages or project files; `'luca'` vs `'luca/agi'` container split (`assistantsManager is not registered`); every run is a fresh container; compiled consumer binaries auto-discover `commands/` but not `features/` (needs `luca.cli.ts` opt-in). All learned by expensive experiment; none was documented.

### 5. Specific API footguns (each cost a real session)

`fs.readFile` utf-8 default corrupting binaries; `execAndCapture` naive space-split; `fileManager.watch` emitting before its own stat (ENOENT crash on move-in-handler) + recursive-by-default; rest client returning errors instead of throwing; ink lifecycle/TTY/no-tsx; `paths.join` prepending cwd to absolute paths.

### 6. Ecosystem discipline erosion

A sibling repo's stale `"test": "vitest run"` flipped a model toward converting tests to vitest (user: "we don't use vitest its bun:test only"). Persistent shell cwd across two repos produced a false-green typecheck that took a 193k-token subagent to unwind. Missing first-party APIs got papered over with `as any` instead of raised.

### What's already working

The no-node-builtins rule is respected in framework-repo sessions (zero violations found). `luca scaffold <type> --tutorial` was called "the single most valuable resource." Describe's "Available:" error listing is good recovery UX. `createContainer()` existing because "LLMs love to hallucinate this function" shows this class of fix works.

## What the proposals change

**`docs/bootstrap/CLAUDE-v2.md`** (proposed replacement for the bootstrap CLAUDE.md) targets Opus-and-below with operational rather than aspirational guidance: a situation→command First Moves table, two no-exception rules ("never declare a capability missing until…", "never call a method you haven't seen in describe output"), a verification playbook for long-running processes, a runtime-envelope table, expanded gotchas with wrong→right pairs, an endpoints cheat sheet, an inline hello-world command, and a symptom-keyed debugging ladder.

**`docs/bootstrap/skill-v2/`** (proposed second skill folder) restructures the skill as a teacher: the Ask→Try→Build→Prove loop with "discipline check" tripwires, wrong-vs-right contrast pairs drawn from these transcripts, a debugging ladder, and four focused references (`testing-and-debugging.md`, `recipes.md` — the 8 most-requested patterns, `gotchas.md`, `runtime-envelope.md`). The frontmatter description adds trigger conditions aimed at the non-adoption problem ("BEFORE you add any npm dependency, import node:fs/node:path, or declare that a capability doesn't exist").

## Framework-side fixes the data suggests (out of scope for docs, worth tickets)

1. Guard `docs.query(undefined)` with a friendly error; warn loudly when `models.ts` fails to load.
2. Make transports throw (or surface) instead of returning `""` on failure.
3. Hydrate helper `state` (websocket `listening`/`connected`) or drop the fields from schemas.
4. `luca run`: support relative static imports, or error with "keep scripts self-contained" guidance.
5. Describe improvements: event payload schemas, categorized method summaries, complete method listings (`fs.mkdirp` was missing), quieter DescribeError output.
6. `proc.execAndCapture`: warn in JSDoc, or parse quotes properly.
7. `scaffold assistant --tutorial` is missing.
8. Challenge harness: isolate attempts (stale servers/ports leaked between attempts and contaminated results); attempt-log-1 of rest-api was lost.
