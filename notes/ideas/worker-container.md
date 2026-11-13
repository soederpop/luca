# WorkerContainer — Running Luca on Cloudflare Workers

## The Idea

A `WorkerContainer` that runs in a Cloudflare Worker V8 isolate — no Node.js, no filesystem, no subprocesses. The goal is to deploy AI assistants as edge workers with the same `assistant.ask()` interface developers already know, backed by Cloudflare's storage primitives instead of the local filesystem.

**Inheritance:** `Container → WorkerContainer` (parallel to `Container → NodeContainer`). Does not extend NodeContainer — that would pull in Node-specific assumptions we can't satisfy.

---

## Storage Mapping

| What currently uses | CF equivalent | Notes |
|---|---|---|
| `fs` (markdown, configs) | R2 | Object store, async-only, ~10-50ms reads |
| `sqlite` (conversation history, indices) | D1 | SQL at the edge, ~1-5ms from Worker |
| `diskCache` | KV | Eventually consistent, fine for hot-path reads |
| `contentDb` index | D1 + R2 | D1 for queries, R2 for raw markdown content |

---

## The R2FS Feature

A Worker-compatible replacement for `fs`. Implements only the async half of the API — sync I/O is not possible in Workers.

**Implementable:**

| Method | R2 API |
|---|---|
| `readFileAsync` | `r2.get(key)` → `.text()` / `.arrayBuffer()` |
| `writeFileAsync` | `r2.put(key, content)` |
| `readJsonAsync` | `r2.get(key)` → `.json()` |
| `writeJsonAsync` | `r2.put(key, JSON.stringify(data))` |
| `existsAsync` | `r2.head(key)` (null = not found) |
| `statAsync` | `r2.head(key)` → size, etag, uploaded |
| `rm` / `rmdir` | `r2.delete(key)` / `r2.delete([...keys])` |
| `readdir` | `r2.list({ prefix })` |
| `walkAsync` | `r2.list({ prefix })` with pagination cursor |
| `copyAsync` | get + put to new key |
| `moveAsync` | get + put + delete |
| `appendFileAsync` | get + concat + put (not atomic, acceptable) |
| `ensureFileAsync` | head check + put if missing |

**Not implementable — omit entirely:**

- All `*Sync` methods (no sync I/O in Workers)
- `isSymlink`, `realpath` (no symlinks in object storage)
- `findUp` / `findUpAsync` (no directory tree concept)
- `mkdirp`, `ensureFolder` (R2 directories are virtual key prefixes — no-op at best)

R2 "directories" are just key prefixes. `readdir('docs')` lists all keys beginning with `docs/`. This is sufficient for `contentDb`.

---

## The `container.isWorker` Guard

The cleanest implementation strategy: add `container.isWorker` alongside the existing `container.isNode`, `container.isBrowser`, `container.isBun` environment flags, and use it as a gate inside the existing feature implementations rather than forking every feature into a Worker variant.

### Detection

Cloudflare Workers expose two reliable globals for detection. The implementation follows the same `typeof` guard pattern already used by the other environment flags:

```ts
get isWorker(): boolean {
  return typeof navigator !== 'undefined'
    && navigator.userAgent === 'Cloudflare-Workers'
}
```

`navigator.userAgent === 'Cloudflare-Workers'` is the signal CF explicitly sets for this purpose — it's the most intentional indicator. A belt-and-suspenders alternative also checks for `HTMLRewriter`, a CF-only API absent from Node, browsers, and Bun:

```ts
get isWorker(): boolean {
  return (typeof navigator !== 'undefined' && navigator.userAgent === 'Cloudflare-Workers')
    || typeof HTMLRewriter !== 'undefined'
}
```

`isWorker` is naturally mutually exclusive with `isNode` (no `process.versions.node`) and `isBrowser` (no `window` or `document`), so there's no ambiguity with the existing detectors.

This keeps the feature surface unified. Code that can't run in a Worker simply doesn't attempt to — it either no-ops, throws a descriptive error, or takes a Worker-appropriate code path.

```ts
// Inside assistant.loadTools():
if (container.isWorker) {
  // Tools must be bundled — nothing to load from disk
  return this.options.tools ?? {}
}
// Node path: vm.loadModule(toolsModulePath)
```

The same pattern applies anywhere the current implementation touches the filesystem, VM, or subprocess execution.

---

## The `assistant` Feature in a Worker

### Bundled by default — no dynamic loading

In a Worker, `tools.ts` and `hooks.ts` are **not loaded at runtime**. They are imported and bundled at deploy time. The developer passes tools and hooks directly via `assistant.use()` or the `tools` / `hooks` constructor options. The file-based convention stays as a source organization pattern; the Worker ignores it entirely.

`loadTools()`, `loadHooks()`, and `reload()` all become no-ops (or return the already-bundled values) when `container.isWorker` is true.

### System prompt

`loadSystemPrompt()` reads CORE.md via the filesystem. In a Worker, the system prompt is either:

1. Passed directly as `systemPrompt` in constructor options (simplest — bundled as a string at build time)
2. Fetched from R2 at startup if dynamic prompt management is needed

When `container.isWorker` and no `systemPrompt` option is provided, the feature should warn clearly rather than silently returning an empty prompt.

### What works as-is

- `ask()` — pure OpenAI API calls over fetch, no changes needed
- `fork()`, `research()`, `createResearchJob()` — parallel async fan-out, works fine
- `addTool()`, `addSystemPromptExtension()`, interceptors — in-memory, works fine
- `subagent()` — works once `assistantsManager` is adapted

### What needs adaptation

**`save()` / `listHistory()` / `clearHistory()` — conversationHistory persistence**

Depends on a `conversationHistory` feature backed by D1 instead of local SQLite.

**`paths` getter and `cwdHash`**

`container.cwd` has no meaningful semantics in a stateless Worker. `cwdHash` (used to namespace thread IDs per project) needs a replacement — a configured namespace string or a per-request tenant ID. The thread prefix convention (`name:cwdHash:`) can stay, just sourced from `container.namespace` or an env binding instead.

**`contentDb` getter**

The per-assistant docs folder backed by R2 + D1 rather than local files. Unchanged interface; different backend.

### Voice (ElevenLabs, Web Speech API)

ElevenLabs works via fetch — usable in Workers. Web Speech API does not exist in Workers. Voice is a non-feature in this context.

---

## The `assistantsManager` Feature in a Worker

### What works as-is

- `register()` and factory pattern — purely in-memory, this is the right model for Workers
- `create()` — instantiates from registered factory, works fine
- `intercept()` — global interceptor registration, works fine
- `threadPrefixFor()` — string manipulation, works fine
- `loadAssistantHistory()` — works once `conversationHistory` is backed by D1

### What needs adaptation

**`discover()` — scans filesystem for `assistants/*/CORE.md`**

When `container.isWorker`, `discover()` is a no-op. Assistant definitions are not discovered at runtime — they must be seeded via `manager.register()` in the Worker entrypoint at bundle time. Multi-assistant workflows are fully supported this way; the developer just registers each assistant explicitly.

**`addDiscoveryFolder()` — adds a filesystem path to scan**

No-op when `container.isWorker`.

**`downloadLucaCoreAssistants()` — fetches from GitHub**

No-op or throw when `container.isWorker`. Deploy-time concern only.

### `subagent()` in a Worker

`subagent()` calls `assistantsManager` to look up and instantiate a named assistant. This works fine in a Worker **if** the target assistant has been registered via `manager.register()`. Multi-assistant pipelines are supported — developers wire them up at bundle time.

If the target subagent has not been registered (or no `assistantsManager` is configured), `subagent()` falls back to **cloning the calling assistant** — same system prompt, same tools, same options — creating an isolated fork rather than a distinct persona. The `container.isWorker` guard can enforce this fallback path and log clearly when it's happening.

---

## Key Architectural Insight: Deploy-Time vs Runtime Discovery

The Node model: **runtime discovery** — scan directories, dynamically load and transpile TypeScript, discover what's there.

The Worker model: **deploy-time bundling** — your assistants are imported modules, tools are statically bundled, the manifest is generated at build time.

This means the `assistants/my-bot/` folder convention still works as a **source organization pattern** — you write your assistant the same way. The difference is that a build step bundles everything before deploying, rather than the Worker VM loading it on demand.

---

## ConversationHistory on D1

The `conversationHistory` feature currently persists to a local SQLite file. On D1 this maps directly — D1 is SQLite. The schema (thread IDs, messages, metadata) can port unchanged. The main difference is that D1 queries are async (no synchronous query API).

Thread namespace: instead of `cwdHash` derived from `process.cwd()`, use a Worker binding — a configured `NAMESPACE` environment variable or a per-request tenant ID passed through the conversation context.

---

## Open Questions

1. **Cold start latency** — R2 + D1 reads on Worker cold start add up. How much system prompt loading can we defer or cache in KV?

2. **Tool execution model** — In Node, tools can spawn subprocesses, call local APIs, write files. In a Worker, tools are pure fetch calls or D1/R2/KV operations. The tool interface is the same; the implementations must be Worker-safe.

3. **Streaming** — `ask()` with streaming works in Workers via `ReadableStream` and `TransformStream`. The Cloudflare Worker response model supports streaming natively.

4. **Durable Objects** — For long-running conversations or agents that need to maintain state across requests, Durable Objects may be a better primitive than stateless Workers + D1. Worth exploring for the `research()` / `createResearchJob()` fan-out pattern.

5. **Thread identity without cwd** — What replaces `cwdHash`? Options: `env.NAMESPACE` binding, a request header, a Durable Object ID. Needs a decision before implementing `conversationHistory`.

6. **VM feature** — The `vm` feature is still needed in a Worker context (e.g. for sandboxed eval, dynamic expression evaluation). Workers run in a V8 isolate so `eval` and `new Function()` are available, but Node's `node:vm` module is not. The `vm` feature will need a Worker-compatible implementation that uses these primitives directly rather than `node:vm`. Needs investigation into what the current `vm` feature actually requires from `node:vm` vs what V8 builtins can cover.

7. **Transpiler** — The `transpiler` feature (esbuild-based) will not work in a Worker. esbuild requires native binaries and filesystem access. Since tools and hooks are bundled at deploy time, runtime transpilation isn't needed for the assistant use case — but any feature or code path that calls `container.feature('transpiler')` must be guarded with `container.isWorker`. Needs an audit of what depends on the transpiler and whether those paths can be skipped or need alternatives.
