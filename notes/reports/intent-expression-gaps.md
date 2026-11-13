---
tags: [docs, examples, lora, training-data, idioms]
---

# Intent → Expression Gaps

Where a capable model's *application* knowledge (which it has) outruns its *Luca* knowledge (which it doesn't). Produced by handing agents the real capability surface plus an app intent they already know how to build in the abstract, and capturing the exact point they couldn't express it in Luca. The output is **idiom gaps**, not app ideas — the curriculum for the LoRA and the target list for new examples.

**Method note (honest):** 6 intents launched; 3 produced deep first-hand stall reports (scheduled-ETL, durable-job-queue, plugin-system), and the remaining 3 (caching-proxy, webhook-fan-out, semantic-search) are backed by my own direct `describe`/`eval` probes of their framework touch-points rather than a full agent trace. The stall points already converge hard across intents, so the picture is stable; the missing three would sharpen weights, not change the conclusions. (Aside: several probe agents fell into a delegation cascade — spawning sub-agents that waited on each other — which is itself a datum about small/weaker agents and long research prompts.)

## Ranked recurring stalls

Each is tagged **train** (bake the reflex/idiom into the LoRA — stable), **runtime** (`describe`/docs should answer this and doesn't — fix tooling/docs, don't bake), or **gap** (missing framework capability), plus a `holdout`/`train` note for the intent's use as an eval vs training task.

**1. No in-process scheduling idiom (`setTimeout` recursion is the sanctioned way).** — recurs across ETL, job-queue worker, any poller. Grep of all 67 features: no cron/scheduler/interval/queue feature. First reach every time: "surely there's `container.feature('scheduler')`." → **train** the reflex (there is no scheduler; recursive `setTimeout` / `setInterval` is idiomatic) **+ docs** (a "poll loops & daemons" tutorial). Highest-frequency gap.

**2. No `sleep`/`backoff`/`retry` in `container.utils`.** — job-queue backoff, any polite loop. Only path is raw `await new Promise(r => setTimeout(r, ms))`. → **gap** (a `utils.sleep`/`utils.backoff` would earn its keep) **or train** the raw idiom if it stays absent.

**3. Long-running / daemon command lifecycle is folk knowledge.** — `await new Promise(()=>{})` + `process.on('SIGINT', cleanup)`. Lives in *one* CLAUDE.md gotcha bullet and one un-indexed example command (`social.ts`); `describe` has no concept of command-authoring conventions, and `scaffold command --tutorial` doesn't mention it. → **train** (reflex) **+ runtime** (scaffold tutorial must grow a daemon section).

**4. "Which store for cross-process state?" has no decision guidance.** — ETL high-water mark, job-queue durability, plugin registry all faced sqlite vs diskCache vs container.state with no steer. The *handoff* pattern is in the skill; the *choice heuristic* isn't. → **train** the heuristic (scalar/blob → diskCache; queryable/relational/transactional → sqlite; in-process only → state).

**5. `describe` documents helper *instances*, not the framework's *authoring vocabulary*.** — the deepest one, hit hardest by framework-extension intents (plugin system). `describe RegistryType` → "not found"; the class-based vs config-based split, `helpers.discover(type,{directory})` as a composition point, and sqlite's `.transaction()` living only on the raw `db.db` getter were all found by *reading source*, not by describe/eval. → **train** (the reflex that authoring conventions live in scaffold tutorials + that `helpers` is composable) **+ runtime** (describe should cover the type vocabulary and the "build on the extension system" story).

**6. `rest` client returns errors (incl. ECONNREFUSED) instead of throwing.** — ETL flagged this as a *silent correctness trap*: the natural `try/catch` catches nothing and error-shaped data flows downstream. Avoided only because CLAUDE.md pre-warned. → **train** (reflex: check the returned shape, don't rely on throw). Already a gotcha; needs a runnable snippet.

**7. `diskCache.set` has no TTL parameter** (`key, value, meta` only). — caching-proxy needs expiry; you roll it yourself via a timestamp in `meta` checked on read. → **train** (reflex) **+ gap** (a native `ttl` option is an obvious add).

**8. The framework already does things agents rebuild by hand — pure discoverability loss.** The webhook/proxy probes surfaced capabilities no agent found without source-diving: **endpoints have native IP-keyed sliding-window rate-limiting** (`rateLimit` / per-method `getRateLimit` on an endpoint module) — the caching-proxy's rate-limit is *not* something to build; **raw custom routes** come via `luca serve --setup setup.ts` (gets `server.app`), the `express` `create:(app,server)=>app` hook, or `server.app.use(...)` (as `telegram.setupWebhook` does in production); **`redis` has pub/sub** for cross-process fan-out. → **runtime** (these are the strongest argument that the gap is *discoverability*, not capability — surface them in the missing `rest`/`express` examples) **+ train** (the reflex: assume the container already has it; `describe` the server/endpoint before hand-rolling).

**9. "Meta-discovery" — building your own registry on top of `container.helpers.discover`** — plugin system: the Luca answer is compositional (call `helpers.discover('commands', { directory })` per plugin folder, model on `assistantsManager`), discoverable only by reading `helpers.ts` + `AssistantsManager`. → **train** the idiom **+ docs** (a meta-discovery tutorial/example — this is a great *composition* example that resists overfitting).

**10. Undiscovered gems that would have saved time:** `proc.establishLock(pidPath)` (single-instance PID lock w/ auto-cleanup — exactly what a worker needs, sits on `proc` so easy to miss), sqlite `UPDATE…RETURNING` + WAL (atomic job claim), `helpers.loadModuleExports` (native-vs-VM-safe dynamic import), endpoint native `rateLimit`. All real, all found only by source-diving. → **runtime** (raise their visibility in describe/examples).

**11. "Offline" semantic search is not turnkey — a trust-damaging silent trap.** `semanticSearch` with `embeddingProvider:'local'` but no `embeddingModel` silently pairs a local provider with the OpenAI default model name (`text-embedding-3-small`, 1536 dims); `installLocalEmbeddings()` installs `node-llama-cpp` but does **not** download the `.gguf` weights (no URL in source), so indexing fails at runtime with a missing-model error; the valid local model names + their filenames live only in a source `MODEL_FILENAMES` map, invisible to `describe`. → **gap** (per-provider model defaults + a real weight download or an explicit "you must fetch X to Y" error) **+ runtime** (member-level `describe semanticSearch.embeddingModel` should enumerate valid local models). *Training note: never generate a trajectory that claims local embeddings "just work" — it's exactly the plausible-but-false pattern the verifier must reject.*

**12. `helpers.discover(type, { directory })` throws ENOENT on a missing dir** (the explicit-directory path skips the `fs.exists` guard the conventional-folder path has). Any multi-folder loader hits it on the first "plugin declares no commands" case. Also: registries are **classes, not plain objects** — `Object.keys(container.commands)` returns `['scope','baseClass']`, not command names; use `.available`. → **train** (the `.available` reflex) **+ runtime** (JSDoc note on `directory`; a "use `.available`, not `Object.keys()`" line in `describe helpers`).

## Framework-repo bug found in passing

Two agents hit it: **the framework repo's own root `CLAUDE.md` points first-move at `.claude/skills/luca-framework/SKILL.md`, which doesn't exist in the framework repo** (only in *bootstrapped* consumer projects; here the source lives at `docs/bootstrap/SKILL.md`). A model following the documented step-1 stalls immediately. Worth a fix — point the framework repo's CLAUDE.md at `docs/bootstrap/SKILL.md`.

## What this yields for the LoRA

- **The `train`-tagged stalls are the curriculum.** #1, #3, #4, #6, #7, #9 are stable reflexes/idioms — exactly what belongs in weights, because they're framework-shaped and won't rot. A small model that has these as reflexes stops guessing `container.feature('scheduler')` and stops writing a swallow-everything `try/catch` around `rest`.
- **The `runtime`-tagged stalls are docs/tooling fixes**, not training — baking them risks staleness (#5, #8, #10 are "describe should say this").
- **The `gap`-tagged ones are framework tickets** (#2 sleep/backoff, #7 diskCache TTL).
- **Held-out split:** job-queue and plugin-system are the richest *composition* tasks and were probed deeply — reserve them as **holdout eval** intents (never in training) so they measure generalization. ETL/proxy/webhook/semantic-search → **train** side. Enforce with the example↔challenge similarity check.
- **New examples this points at** (idiom-dense, challenge-disjoint): a daemon/poll-loop command, a server+`create`-hook+rest roundtrip, a sqlite `UPDATE…RETURNING` worker, a meta-discovery registry. Each teaches a *reflex the base model lacks*, not an app it already knows.
