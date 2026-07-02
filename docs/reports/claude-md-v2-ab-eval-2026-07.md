---
tags: [evaluation, claude-md, skill, agents, ab-test]
---

# CLAUDE.md/Skill v1 vs v2 — First A/B Evaluation

First controlled comparison of the proposed `docs/bootstrap/CLAUDE-v2.md` + `skill-v2/` against the shipping v1 bootstrap docs. Method: six freshly `luca bootstrap`ed sandbox projects; three got the v2 overlay (CLAUDE.md replaced, SKILL.md replaced, four v2 reference files added alongside the stock examples/tutorials). One Sonnet agent per sandbox attempted a challenge from `docs/challenges/` with identical, neutral prompts; same `luca` binary (v3.2.1) throughout. Each attempt wrote LESSONS.md + ATTEMPT-LOG.md; deliverables were independently spot-verified afterward.

## Results

| Challenge | Variant | Works? | Output tokens | Tool uses | Duration | Errors hit |
|---|---|---|---|---|---|---|
| custom-command | v1 | ✅ | 69k | 28 | 3m10s | 0 |
| custom-command | v2 | ✅ | 75k | 44 | 4m50s | 0 |
| file-watcher | v1 | ✅ | 87k | 52 | 5m11s | 0 |
| file-watcher | v2 | ✅ | 101k | 73 | 8m06s | 2 |
| websocket | v1 | ✅ | 87k | 48 | 4m52s | 1 |
| websocket | v2 | ✅ | 135k | 102 | 14m15s | 8 |

## Honest read: v2 did not reduce cost in this round

All six attempts succeeded — including v1 on the challenges that historically failed. Two things changed since the June attempt logs that lifted the v1 baseline: the framework itself improved (websocket `start({port})` fixed, an ask/reply runnable example now ships in the skill's `references/examples/`), and none of the historical harness pathologies (timeout/gtimeout thrash, orphaned servers) recurred in either arm. With n=1 per cell, pass/fail no longer discriminates; cost and behavior do.

On cost, v2 was consistently *more* expensive. Three causes, only one of which is bad:

1. **Deeper verification by design (intended).** The v2 file-watcher attempt stress-tested at 6× and 10× batch sizes and caught a real concurrency bug in its own code (async read-modify-write race on diskCache stats) that the v1 version avoided only by accident (synchronous JSON writes). v2's "prove like a skeptic" is doing what it was written to do — it costs tool calls and buys correctness.
2. **Route variance (the expensive kind).** The v2 websocket agent scaffolded a *custom client class* — running into two real framework bugs (`scaffold client --tutorial` recommends a dead `RestClient` import; `afterInitialize()` never fires for clients) — while the v1 agent found the shipped ask/reply example, ran it with `luca run`, and copied the pattern. The single biggest efficiency lever observed is **examples-first**, and v2's skill under-weighted it while over-weighting scaffold.
3. **Verification overhead on trivial tasks.** Both custom-command attempts hit the same undocumented gotcha (chalk auto-disables color on non-TTY stdout); the v2 agent dug ~10 commands deeper before concluding it wasn't a bug.

## What v2 demonstrably improved

- **Blessed patterns were followed.** v2's file-watcher used `diskCache` for cross-process state per recipe #5; v1 hand-rolled a `.watcher-stats.json` (exactly the ad-hoc pattern the recipes warn against). v2's agent called the recipe "nearly frictionless — no guessed APIs, no source-diving."
- **Zero API guessing in the v2 arm's discovery phase** across all three attempts.
- The v2 websocket attempt's extra depth surfaced **two real framework bugs** v1's path never touched (see tickets below).

## Changes already applied to v2 from this round

- SKILL.md Build step now leads with **examples-first** ("a runnable example beats fifty describes") and adds "don't scaffold what you don't need — use the built-in client with your conventions on top."
- gotchas.md gained: chalk/TTY color auto-disable, `diskCache.get()` throws on missing key, serialize counter updates in concurrent `file:change` handlers, and the custom-client caveats (`afterInitialize` asymmetry, dead `RestClient` import fallback).

## Framework bugs / fixes surfaced (worth tickets)

1. `luca scaffold client --tutorial` template imports `RestClient` from `'luca/client'`, which is `undefined` under the compiled binary — 3 failed load attempts before the agent found the working pattern.
2. `afterInitialize()` fires for features but silently never for clients, contradicting the tutorial — manifests as a crash far from the cause.
3. `luca describe` didn't surface a project-local client's JSDoc/methods even after `luca introspect` ran clean.
4. Document the chalk TTY behavior in `ui.banner`/`ui.colors` JSDoc.
5. Caveat on agent self-reports: one LESSONS.md confidently claimed `ui.print` doesn't exist; it does (`typeof ui.print === 'function'` with color methods). Verify LESSONS claims before acting on them.

## Limitations and next steps

n=1 per cell, one model (Sonnet), and today's stronger baseline compress the differences; route variance (websocket) dominates the cost numbers. To get a real signal: run 3–5 attempts per cell, add Haiku (where v1's terser guidance may fail outright and v2's decision tables should matter most), and consider a harder challenge (`multi-feature-dashboard`, `process-orchestrator`) where discovery pressure is higher. The eval harness (bootstrapped sandboxes + neutral prompts + LESSONS/ATTEMPT-LOG protocol) is reusable as-is.
