---
tags: [docs, examples, coverage, lora, training-data]
---

# Example Coverage & Gap Map

The framework's teachable surface cross-tabbed against what has a runnable example today. Derived from `container.features/clients/servers.available` (v3.3.0) and a scan of `docs/examples/`. This is both the docs backlog and the **training-data sampling plan** for the LoRA — the `weights vs runtime` column is the division-of-labor decision (train the reflex, never the signature).

Surface: **67 features, 7 clients, 3 servers = 77 helpers. 46 example files.**

## Axis 1 — Capabilities (nouns)

Coverage state: **file** = has an example doc; **describe-only** = introspection docs but no example; category rollups below. Names are the registry (camelCase) identifiers.

| Category | Covered by an example | describe-only (NO example) |
|---|---|---|
| **FS & code** | fs, grep, fileManager | fileTools, transpiler (esbuild.md is stale/renamed) |
| **Process & shell** | proc, processManager, secureShell, tmux | — |
| **Data & storage** | sqlite, postgres, diskCache, contentDb, yaml, jsonTree, yamlTree | **redis**, memory |
| **Networking** | networking | dns |
| **HTTP clients/servers** | websocket (client+server), — | **rest client**, **express server**, mcp server, elevenlabs, graph, openai, socketio, voicebox |
| **AI / assistants** | assistant (+hooks, +process-manager, +structured-output), claudeController | assistantsManager, conversation, conversationHistory, **conversationv2**, **modelProviders**, claudeCode, openaiCodex, lucaCoder, codingTools, mcpBridge, telnyxAssistantConnector, voiceMode |
| **Content & NLP** | nlp | **docsReader**, **semanticSearch**, skillsLibrary, memory |
| **Google** | googleAuth, googleCalendar, googleDocs, googleDrive, googleSheets | googleMail |
| **UI** | ui, ink (+blocks, +renderer) | — |
| **Media / device** | tts, downloader, opener, telegram | browserUse, runpod (has example) |
| **System / meta** | vault, vm, os, packageFinder, git, docker, repl, python, runpod | **helpers**, introspectionScanner, containerLink, socketRepl |

**The load-bearing gaps** (high-frequency helpers with no example): the **`rest` client** and **`express` server** — the two most-reached-for helpers in every eval — plus **`semanticSearch`**, **`redis`**, **`docsReader`**, **`conversationv2`**, and **`helpers`** (the discovery API a plugin system needs). ~26 of 67 features and 6 of 7 clients have no example file.

## Axis 2 — Idioms (grammar) — the LoRA's core curriculum

These are the framework-specific mechanics a capable model **cannot infer** and that `describe` doesn't teach (it documents helpers, not authoring conventions). Each is `weights` (stable reflex → train into the LoRA) or `runtime` (volatile specifics → leave to introspection).

| Idiom | Covered? | weights/runtime |
|---|---|---|
| `container.feature/client/server` access | implicit everywhere | **weights** |
| Authoring a **command** (argsSchema, positionals, `options._`) | scaffold tutorial | **weights** (shape) |
| Authoring a **feature** (register, stability, lifecycle) | scaffold tutorial | **weights** |
| Authoring an **endpoint** (`(params,ctx)`, `ctx.response` for status) | scaffold + partial | **weights** |
| Authoring a **client/server** | scaffold tutorial | **weights** |
| Observable **state** (`.state.get/set/observe`) | tutorial 05 | **weights** |
| **Events** (`on/once/emit/waitFor`) on container + helpers | tutorial 05 | **weights** |
| **Lifecycle & discovery** (`afterInitialize`, `helpers.discover*`) | thin | **weights** |
| **Cross-process reality** (fresh container/invocation → diskCache/sqlite handoff) | skill Common Patterns | **weights** ← highest value |
| **Long-running / daemon command** (`await new Promise(()=>{})` + SIGINT) | 1 gotcha bullet only | **weights** ← gap |
| **In-process scheduling** (no cron feature → setTimeout recursion is the idiom) | **not covered** | **weights** ← gap |
| Runnable markdown (`luca run doc.md`) | mentioned | weights |
| The **eval/describe workflow** (discover-before-guess reflex) | skill core | **weights** ← the #1 reflex |
| Introspection (self-describing, zod+jsdoc) | tutorial 13 | runtime |
| utils / paths (`resolve` vs `join`, lodash surface) | CLAUDE.md | runtime |

## Axis 3 — Anti-priors (gotchas) — where the model's default is *wrong*

Each is a wrong→right the LoRA should make reflexive (they're the highest-value tokens because the base model is confidently wrong). Status = whether a runnable snippet demonstrates it today.

no node builtins · no `bun add` · constructor-vs-`start()` options · `fs.readFile` utf-8 corrupts binary · `execAndCapture` space-splitting · `ui.print` (side-effecting) vs `ui.colors` (returns string) · watch emit-before-stat · rest returns (not throws) errors incl. ECONNREFUSED · diskCache.get throws on miss · **diskCache.set has no TTL** (roll your own expiry via meta+timestamp) · chalk auto-off in non-TTY · `paths.join` prepends cwd · per-invocation fresh container. — All are in `gotchas.md` as prose; **none as a runnable, verifier-tested snippet yet.**

## Axis 4 — Compositions (assembly) — proof the primitives combine into anything

Existing: feature-as-tool-provider, assistant-with-process-manager, websocket-ask-and-reply, structured-output-with-assistants. Thin — these are the examples that most resist overfitting (they teach *combination*, not a feature). Deliberately spread candidates that are challenge-*disjoint*: a server+rest-client roundtrip, an event-bus fan-out, a discovery-driven registry.

## Runnable health (the verifier baseline)

**250 `ts` example blocks; 59 `skip`-blocked (24% non-runnable). `lastTested` is null on 44 of 46 files** — zero CI has ever executed them. This is the number the runnable-example harness makes go to green; every `skip` is a doc that can silently rot (exactly how the ipcSocket example lied pre-fix).

## How this drives the LoRA (and doesn't overfit)

- **Sampling plan:** generate training trajectories weighted to cover Axes 1–2 evenly, not clustered on the 46 apps we happen to have. Breadth here = generalization there.
- **Curriculum priority:** Axis 2 `weights` idioms + Axis 3 gotchas are the LoRA payload. Axis 1 is mostly `runtime` — teach the *reflex to `describe` a helper*, not its method list (which rots).
- **Coverage % per axis is the metric**; broadening = these climb. Watch it release-over-release the way `bun test` watches code.
