---
tags: [evaluation, challenges, skill, instrumentation, bugs]
---

# Fresh Challenge Baseline — Instrumented Round, July 2026

Round 1 of the new eval loop: five fresh challenges (`secret-notes`, `ipc-hub`, `proc-fleet`, `code-stats`, `port-scout` — commit 492cbb0) targeting features the original challenge set never exercised, attempted by Sonnet agents in freshly bootstrapped sandboxes against the **stock** CLAUDE.md/skill and the shipped binary (v3.2.1). New this round: transcripts are parsed mechanically (jq) to count actual CLI usage, rather than trusting self-reports.

## Results and instrumentation

| Challenge | Works? | Duration | Tokens | `describe` | `eval` | `scaffold` | `run` | fs-spelunking | Tool errors |
|---|---|---|---|---|---|---|---|---|---|
| code-stats | ✅ | 5m22s | 88k | 5 | 7 | 2 | 0 | 0 | 2 |
| secret-notes | ✅ | 6m0s | 87k | 13 | 8 | 1 | 0 | 3 | 2 |
| port-scout | ✅ | 9m0s | 95k | 15 | 0 | 3 | 0 | 2 | 3 |
| proc-fleet | ✅ | 11m34s | 91k | 20 | 17 | 2 | 0 | 2 | 7 |
| ipc-hub | ✅ | 16m35s | 110k | 9 | 5 | 2 | 18 | 1 | 4 |

## The two headline conclusions

**1. Discipline is not the problem — content is.** The question this round was built to answer ("is the skill actually driving describe/eval usage?") has a clear answer: yes. Every agent used `luca describe` 5–20 times and most prototyped in `eval`; filesystem spelunking was near zero. The historical "models ignore the CLI" pattern did not appear in harnessed sandboxes with the current docs.

**2. Session cost tracks framework-bug density, almost linearly.** The clean challenge (code-stats) took 5 minutes; the one sitting on a broken feature (ipc-hub) took 17. When discipline is good, the remaining cost of a session ≈ the number of traps the framework itself sets. Improving the framework now beats improving the prose.

## Bugs and gaps found (in the order they cost time)

1. **ipcSocket `ask()`/`reply()` is broken server-side** — the client sends an `{id, data, requestId}` envelope, but the server's `message` event strips it, so the JSDoc's own request/reply example cannot work. Verified by sniffing the socket with `nc`. *(→ batch B1 fix)*
2. **`proc.spawn()` cannot detach** — no `detached` wired through; "background worker that outlives the CLI" has no supported path. Agent reverse-engineered `nohup … & echo $!` via eval. *(→ batch B1 fix)*
3. **`luca scaffold --description "…'s…"` generates invalid TypeScript** (unescaped interpolation into a single-quoted literal), and the broken file then poisons every subsequent `luca describe` with a parse-error banner. *(→ batch B1 fix)*
4. **`luca describe ui` hides `ui.print`; `describe ui.print` throws** — the API is real (the scaffolded about.ts uses it), introspection just can't see function-valued properties. This retroactively explains an earlier eval agent's "ui.print doesn't exist" claim: it trusted describe, as instructed. *(→ batch B1 fix)*
5. **vault mints a new random key per process, silently** — plus `secretText` is lazily populated (undefined until `secret()`/`encrypt()`/`decrypt()` runs). Exactly the wrong default shape for the CLI's process-per-invocation model. *(→ batch B2: JSDoc + persisted-key example)*
6. **`grep.todos()` docstring says "comments" but matches substrings anywhere** — flagged its own report files. *(→ batch B2: docstring)*
7. **rest client docs cover returned HTTP errors but not connection-level failures** (ECONNREFUSED) — the most common case for a health checker; behavior matched but had to be verified empirically. *(→ batch B2: JSDoc)*
8. **ipcSocket instance is mode-locked server-XOR-client** (undocumented); IPC/WS client commands hang after finishing without an explicit `process.exit(0)`. *(→ batch B2: JSDoc + skill gotcha)*
9. `container.utils.lodash` lacks `sortBy`/`orderBy` while CLAUDE.md's "etc." implies a fuller surface; `ui.table` doesn't exist (one wrong guess). *(→ docs honesty pass)*

Fixed in parallel with this round (batch A, commit 022d44c): the client scaffold's dead `RestClient` import, and the `afterInitialize` field-clobbering bug (ES2022 class fields redefine subclass fields to `undefined` after `super()`, erasing what the hook assigned — now runs post-construction via the factory).

## Skill/docs content gaps the round exposed

The recurring asks across the five LESSONS.md files, deduplicated:

- **A cross-process handoff recipe** (port file / diskCache / state conventions) — asked for twice, improvised twice.
- **A detached-worker recipe** — now landing as a real `proc.spawn({ detached })` option instead of prose.
- **A `noun verb` subcommand recipe** (`positionals` + `z.enum`).
- **A runnable ipcSocket hub+spoke example** — the agent noted websocket went smoothly *because* its runnable example ships; ipcSocket had only (wrong) JSDoc.
- Honest failure-mode docs: vault key lifecycle, client `process.exit`, connection-refused semantics.

## Next steps

- Batch B1 (in flight): the four behavior fixes above, with regression tests.
- Batch B2: remaining behavior + JSDoc/docstring items (watch emit-order, execAndCapture, fs.readFile encoding, chalk TTY, luca run import error message, DescribeError noise, `scaffold assistant --tutorial`).
- Fold the content gaps into the shipped skill (recipes + gotchas), rebuild the binary, re-run the same five challenges as round 2 — success criterion: error counts and durations drop on the bug-heavy challenges while describe/eval usage stays high.
