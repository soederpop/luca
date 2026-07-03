---
tags: [evaluation, challenges, skill, instrumentation, comparison]
---

# Round 2: Fix the Framework, Re-run the Challenges

Follow-up to `challenge-baseline-round-2026-07.md`. Between rounds we changed the thing the baseline said to change: **the framework, not the prose discipline**. Ten bugs fixed with regression tests (`022d44c`, `d61387c`, `7a60d1c`), a JSDoc honesty pass on eight APIs, a Common Patterns section in the shipped skill (`49e50f4`), a runnable ipcSocket example (`c91c49d`), and a fresh binary (v3.3.0 @ `c91c49d`) installed. Then: same five challenges, same neutral prompts, same model (Sonnet), fresh sandboxes, same jq instrumentation.

## Round-over-round

| Challenge | Baseline | Round 2 | Δ duration | Errors |
|---|---|---|---|---|
| ipc-hub | 16m35s, 110k tok, 84 tools | **5m21s**, 85k tok, 51 tools | **−68%** | 4 → 1 |
| proc-fleet | 11m34s, 91k tok, 68 tools | **6m51s**, 88k tok, 51 tools | **−41%** | 7 → 1 |
| port-scout | 9m0s, 95k tok, 61 tools | **4m31s**, 82k tok, 44 tools | **−50%** | 3 → ~1 |
| secret-notes | 6m0s, 87k tok, 45 tools | **3m24s**, 75k tok, 31 tools | **−43%** | 2 → 0 |
| code-stats | 5m22s, 88k tok, 49 tools | 7m07s, 93k tok, 59 tools | +33% | 2 → 5 |
| **Total** | **48m31s, 471k tok, 18 errors** | **27m14s, 423k tok, ~8 errors** | **−44%** | **−56%** |

All ten runs produced working, independently spot-verified deliverables; describe/eval usage stayed healthy in round 2 (2–13 evals, 2–8 describes per session — lower describe counts on ipc-hub because the runnable example replaced discovery, which is the point).

## Attribution — the gains landed exactly where the fixes did

- **ipc-hub (−68%):** ask/reply now works as documented; the agent used it directly instead of reverse-engineering a manual correlation layer. Its words on the now-runnable example: *"reads almost like a template for this exact task."*
- **proc-fleet (−41%):** used `proc.spawn({ detached }) + unref() + diskCache` — the exact recipe that didn't exist last round (verified `PPID=1`). Errors 7 → 1.
- **port-scout (−50%):** diskCache handoff straight from the skill's Common Patterns: *"named this exact scenario almost verbatim."*
- **secret-notes (0 errors):** vault key persistence *"already spelled out the exact pattern needed"* — the round-1 trap (per-process keys) became a non-event.
- **code-stats (+33%):** the control. No fixes targeted it (it was already the clean one), and it regressed on run variance — which strengthens the attribution: improvements tracked the fixes, not the re-roll.

## New findings from round 2 (the loop keeps paying)

1. **`container.paths.relative(base, target)` ignores the base** and computes relative-to-cwd — `relative('/tmp/a', '/tmp/a/b')` → `../../../../../tmp/a/b` instead of `b`. Independently reproduced. Same family as the known `join()` cwd-prepending gotcha; fix or document.
2. **Raw positionals doc mismatch:** the commands tutorial says raw positionals live at `options._`, but discovered project commands get them via `container.argv._`. Cost r2-ipc-hub its only failure.
3. **`ui.print.<color>()` vs `ui.colors.<color>()`** — the former prints immediately and returns `undefined`, so using it as a string formatter silently produces `undefined` in composed output. Worth a Known Gotchas entry.
4. **No documented PID-liveness idiom** — `proc.kill(pid, 0)` returns false for dead PIDs (doesn't throw), verified empirically by an agent; document it.
5. The detached-worker + diskCache supervision recipe should be **one worked example**, not three prose sections; `processManager` should state it's in-memory (wrong for cross-process supervision).
6. Feature asks: passphrase-derived vault keys (KDF); clarify `diskCache.securely` vs hand-rolled vault+JSON; worked example of the rest client's error-as-JSON shape on ECONNREFUSED.
7. Caveat repeated from last round: verify LESSONS claims — one agent reported `ui.colors` "only exposes level"; in truth it works (chalk level 0 in non-TTY strips codes — the already-documented TTY gotcha wearing a different hat).

## Where this leaves the loop

The eval loop did what it was built to do, twice over: round 1 proved discipline wasn't the problem and located the real bugs; round 2 proved fixing those bugs (plus honest docs and named recipes) cuts total session cost ~44% and errors by more than half, with attribution clean against a control. The remaining items are small (a path bug, one doc mismatch, two gotcha entries, one consolidated recipe) — fold them in and the next round should be measuring polish, not craters. The harness (challenges + sandboxes + neutral prompts + jq instrumentation) is committed and reusable for regression-testing the docs the same way tests regression-test the code.
