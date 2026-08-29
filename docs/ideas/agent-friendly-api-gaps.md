# Agent-Friendly API Gaps

A running list of features whose public APIs have gotchas that cost agent
roundtrips: the agent guesses wrong, gets **silent wrong data** (not an error),
then has to debug the failure far from its cause.

The fix pattern is the one established by `fs.readFile` / its documented
binary-file gotcha: add an explicit method whose *name encodes the contract*,
so the agent picks the right thing on the first try. The old method stays for
callers who know what they're doing.

## Status: proposed (not implemented)

## 1. `sqlite` — add `queryOne()`

**Gotcha (verified):** the feature forces the agent to classify SQL before
calling: `query` for SELECT, `execute` for writes. Misclassification fails
silently in both directions:

```ts
await db.query('INSERT INTO t VALUES (1)')  // → [], insert actually ran
await db.execute('SELECT * FROM t')         // → { changes: 0, ... }, rows discarded
```

**Fix:**

- `queryOne(sql, params) → Promise<T | null>` — name says "expect a single
  row"; null when there isn't one. Removes the `(await query(...))[0] ?? null`
  dance.
- Optional: `run(sql, params)` that auto-classifies SELECT vs write and calls
  the right underlying method — a no-gotcha default while `query`/`execute`
  remain for callers who know.

## 2. `diskCache` — add `getJson()` / `setJson()` / `ensureJson()`

**Gotcha (verified):** set/get are asymmetric. The `json: true` flag on `get`
is the same shape as `fs.readFile`'s encoding flag — an optional boolean whose
default silently hands back the wrong thing:

```ts
await dc.set('obj', { count: 42 })  // accepts an object, serializes it
await dc.get('obj')                 // → the string '{"count":42}'
await dc.get('obj', true)           // → { count: 42 }
```

The feature's own docs make agents `JSON.stringify` into `ensure()`.

**Fix:**

- `getJson(key) → parsed value` — "you get back the object you stored"
- `setJson(key, value, meta?)` — symmetrical partner
- `ensureJson(key, value)` — stops forcing `JSON.stringify` in doc examples

The existing `json` flag stays for string-cache use.

## 3. `downloader` — add `downloadJson()` (and optionally `downloadFile()`)

**Gotcha (documented):** `download()` does not throw on HTTP 404/500 — the
error-page body is written to disk as if it were the file. An agent that
downloads `data.json` from a misconfigured URL gets a 404 HTML page saved at
that path; the failure surfaces later as a parse error far from the cause.

**Fix:**

- `downloadJson<T>(url) → Promise<T>` — name communicates the whole contract:
  "this URL is a JSON API response." Non-2xx throws with the status code, body
  is parsed, no intermediate file.
- Optional: `downloadFile(url, path)` — same as `download()` but throws on
  4xx/5xx and sanity-checks the body isn't empty. `download()` keeps its
  write-whatever-came-back behavior.

## 4. `proc` — add `tryExec()` / `execJson()`, document the `exec` trap

`proc` has five spawn-shaped methods (`exec`, `execSync`, `execAndCapture`,
`spawnAndCapture`, `spawn`) and no combination of names that tells an agent
which are sync, which throw, and which mangle quoting. Verified behavior:

| method | sync? | shell (quotes OK)? | on non-zero exit | stderr |
|---|---|---|---|---|
| `exec` | **yes** | yes | **throws** | only inside thrown error |
| `execSync` | yes | yes | throws | only inside thrown error |
| `execAndCapture` | no | **no — naive space split** | never throws | captured |
| `spawnAndCapture` | no | n/a (args array) | never throws | captured |
| `spawn` | no | n/a | handle returned | streaming |

**Gotchas (verified):**

- `exec` is synchronous and throws, but the name is node's *async* `exec` —
  muscle memory says `await proc.exec(cmd)` (which "works" because awaiting a
  string is a no-op) and doesn't expect a throw. On failure the error message
  is `Command failed: <cmd>`; stderr is only in the error object.
- `execSync` is a literal alias: `return this.exec(command, options)` — with
  placeholder jsdoc ("Parameter command"). Two names, one behavior, zero docs.
- `execAndCapture` splits the command string naively on spaces. Verified:
  `execAndCapture('echo "two words"')` passes `"two` and `words"` as separate
  args — quoted arguments are mangled. The escape hatch (`spawnAndCapture`)
  isn't discoverable from the failure mode.

**Fix:**

- `tryExec(cmd, options?) → Promise<{ stdout, stderr, exitCode }>` — async,
  runs through a real shell (quoting works), never throws. The name encodes
  the failure contract. Nothing today combines async + shell + no-throw.
- `execJson<T>(cmd, options?) → Promise<T>` — parse stdout as JSON; throw with
  stderr in the message on non-zero exit. The obvious shape for CLI APIs
  (`gh`, `curl`, `docker inspect`) and eliminates the manual
  `JSON.parse(result.stdout)` dance.
- `execSync` — give it real jsdoc stating it's a sync alias of `exec`, or
  remove it. Silent aliases with placeholder docs are their own gotcha.
- `exec`'s jsdoc NOTE about throwing is good; extend it to steer agents to
  `tryExec` the way `execAndCapture`'s warning steers to `spawnAndCapture`.

## 5. `grep` — all errors swallowed into `[]`

**Gotcha (verified):** the catch in `search()` (grep.ts ~158–161) is meant for
grep's exit-code-1 "no matches", but it eats everything:

```ts
await grep.search({ pattern: '(unclosed' })                  // → []  (regex parse error)
await grep.search({ pattern: 'x', path: '/not/a/real/dir' }) // → []  (missing path)
```

Invalid regex, nonexistent search path, and genuinely zero matches are
indistinguishable — the agent concludes "the codebase doesn't contain this"
when its pattern never compiled. `filesContaining`, `count`, `imports`,
`definitions`, `todos` all inherit the trap (`count` returns a confident `0`).

Two more in the same feature:

- `maxResults` is documented "max number of results" but maps to rg
  `--max-count`, which is **per file**. 3 files × 4 matches with
  `maxResults: 2` → 6 results, not 2.
- `before`/`after` context options are passed to rg, but the parser regex only
  matches `file:line:col:content` — rg emits context lines with `-` separators,
  so requested context is computed and silently discarded.

**Fix:**

- Inspect the exit code: rethrow anything other than 1 (rg/grep use 2 for
  errors), with stderr in the message. Requires exit-code-aware spawn instead
  of the bare try/catch around `proc.exec`.
- Slice parsed results to `maxResults` after parsing (keep `--max-count` as a
  perf bound), or rename the option `maxPerFile`.
- Parse `-`-separated context lines into the match objects, or drop the two
  options until they work.

## 6. `rest` — error objects lose the response body; no throwing variant exists

**Gotcha (verified):** the documented "errors are returned, not thrown"
behavior has an undocumented second layer: `handleError` returns
`error.toJSON()`, and axios' `toJSON()` **drops `response` entirely** — no
body, no headers. The agent can see *that* it failed (`status: 422`) but never
*why* — validation details, API error codes, rate-limit messages are
unrecoverable:

```ts
// server responds 422 { error: 'validation_failed', details: {...} }
const result = await api.post('/users', {})
result.status                                         // 422
JSON.stringify(result).includes('validation_failed')  // false — body is gone
```

Every wrapper client extending `RestClient` (`elevenlabs`, `civitai`,
`comfyui`, `voicebox`, `graph`) inherits this: a bad API key makes
`elevenlabs.listVoices()` return an AxiosError JSON, so the failure surfaces
as `result.voices === undefined`, not as an auth error.

**Fix:**

- `handleError` should merge the body back in:
  `{ ...error.toJSON(), data: error.response?.data, headers: ... }`. Purely
  additive.
- `getOrThrow()` / `postOrThrow()` (or `request({ throwOnError: true })`) —
  today **no** method on the client throws on HTTP failure; the name encodes
  the contract. Wrapper domain methods (`listVoices()` etc.) should use them —
  a 401 has no meaningful "return the error" semantics.

## 7. `websocket` server — default (no `json: true`) silently breaks ask/reply

**Gotcha (verified):** `container.server('websocket')` with no options
delivers raw `Buffer`s to `message` handlers, so `msg.type` is `undefined`,
`msg.reply` never attaches, and every client `ask()` dies with a timeout that
says nothing about the cause. Worse, the framing is asymmetric: outbound
`send`/`broadcast` **always** JSON-encode, and the client always JSON-parses
inbound — the `json` flag only gates the server's inbound parsing. One
direction works, the other silently doesn't.

**Fix:** make inbound parse-JSON-when-possible the default (matching outbound
and the client), with `json: false` as the raw-Buffer opt-out. At minimum the
`ask()` timeout message should hint "does the server have `json: true`?".

## 8. Servers — busy-port behavior is silent and inconsistent

**Gotcha (verified):**

- `websocket.start({ port: 9350 })` when 9350 is busy silently binds 9351
  (`configure()` runs `findOpenPort` with no error/event). An agent that wrote
  `ws://localhost:9350` into a client config now talks to whatever else holds
  9350.
- `express.start({ port })` when the port is busy **neither resolves nor
  rejects** — the start promise has no `error` handler on the listener, so
  EADDRINUSE surfaces as an uncatchable async emit and `await start()` hangs
  forever. `try/catch` catches nothing.

**Fix:** an explicit port should mean "this port or throw" — auto-drift only
on the no-port path, plus a `portChanged` event when configure() moves it.
The express one is a plain bug: attach `listener.on('error', reject)` inside
the start promise.

## 9. `secureShell` — local shell interpolation and mangled scp argv

**Gotcha (verified):**

- `exec()` builds `ssh ... "<command>"` as one string through the **local**
  shell: `$VARS`, backticks, and `$(...)` expand locally before ssh runs.
  `ssh.exec('rm -rf "$TMPDIR/build"')` deletes using the *local* `$TMPDIR`
  value on the remote host.
- `upload()`/`download()` build a quoted string but run it through
  `proc.execAndCapture` (naive space-split), so the quotes become literal argv
  bytes and any path with a space splits apart. Fails as
  `scp: No such file or directory` pointing at a file that plainly exists.

**Fix:** pass argv arrays via `spawnAndCapture` — no quoting layer at all.
Optionally `execRemote(command)` whose jsdoc states "the string reaches the
remote shell verbatim".

## 10. `redis` — `connected: true` before any connection; commands hang forever

**Gotcha (verified):** the constructor unconditionally sets
`state.connected = true` when `lazyConnect` is false — before any TCP
connection exists. With nothing listening at all:

```ts
const redis = container.feature('redis', { url: 'redis://localhost:59999' })
redis.state.get('connected')  // → true — no server on that port
await redis.get('anything')   // never resolves, never rejects (retryStrategy retries forever)
```

`state.lastError` stays `''`. Zero signals point at "the server isn't there."

**Fix:** let the `'connect'` event own the flag (it already does); add
`ping(timeoutMs) → boolean` or `ensureConnected(timeoutMs)`; consider a
default `commandTimeout` so no command hangs unboundedly. (Side note: redis's
`setJSON`/`getJSON` are the symmetric pair `diskCache` should copy.)

## 11. `contentDb` — broken `models.ts` swallowed; `query()` before `load()` is opaque

**Gotcha (verified):** when `docs/models.ts` throws or fails to resolve an
import, `load()` succeeds silently and every document matches `Base`:

```ts
const db = container.feature('contentDb', { rootPath: './broken' })
await db.load()
db.modelNames  // → ['Base'] — no error, no warning
```

This is the existing CLAUDE.md gotcha ("run `bun docs/models.ts` to see the
real error") — the tell that the API should surface it itself. Related:
`read()` and the tool methods auto-load, but `query()` does not — calling it
pre-load dies with `TypeError: undefined is not an object (evaluating
'definition4.name')`, which names nothing about loading.

**Fix:** `load()` should throw (or set a `modelLoadError` state field) when a
models.ts exists but failed to evaluate, with `load({ ignoreModelErrors: true })`
for the tolerant case. Make `query()` auto-load like the rest of the API.

## 12. `jsonTree` / `yamlTree` — nonexistent path returns a silent empty tree

**Gotcha (verified):** a typo'd path is indistinguishable from an empty dir:

```ts
await jt.loadTree('no-such-dir-xyz')  // → { 'no-such-dir-xyz': {} } — no error
```

Downstream reads (`jt.tree.config.database.production`) fail with "undefined
is not an object" far from the cause.

**Fix:** throw when `basePath` doesn't exist; keep the tolerant behavior
behind `loadTreeIfExists()`, whose name encodes it.

## 13. `fs` — walk glob scoping, dangling symlinks, rm/rmSync asymmetry

**Gotchas (verified):**

- `walk`'s `include`/`exclude` match against the relative path with no
  basename fallback: `include: ['*.ts']` returns only top-level files
  (`**/*.ts` needed), and `exclude: ['node_modules']` only prunes the
  top-level one — nested copies in a monorepo come back.
- `exists()` stats through symlinks, so a dangling symlink reports `false` —
  then `symlink()` throws EEXIST one step later.
- `rmSync('missing')` is silent (force defaults true) but `await rm('missing')`
  throws ENOENT (force defaults false) — the sync/async halves of one pair
  disagree.

**Fix:** basename-match slash-free patterns (gitignore semantics) or
auto-prefix `**/`; add `linkExists(path)` (lstat-based, fs-extra precedent);
align the `force` defaults and steer docs to `remove()`/`removeSync()` as the
always-idempotent names.

## 14. `paths.dirname` — returns `''` where node returns `'.'`

**Gotcha (verified):** implemented as `parse(path).dir`, not node's `dirname`:
`paths.dirname('foo.txt')` → `''` (falsy) vs node's `'.'`. Branches like
`if (paths.dirname(f))` silently go the wrong way. Looks like an accident,
same misleading-name family as the `join()` cwd-prepend gotcha.

**Fix:** delegate to node's `dirname`.

## 15. `vm.loadModule` — missing file returns `{}`

**Gotcha (verified):** `vm.loadModule('/nope/missing.ts')` → `{}` (guarded by
`fs.exists`, returns empty exports). A typo'd path is indistinguishable from a
module with no exports; the failure surfaces later as "tool X is not a
function" — exactly how a broken `assistants/<name>/tools.ts` path fails.

**Fix:** throw on missing file (no legitimate caller wants `{}` for ENOENT),
or add `tryLoadModule(path) → exports | null` and make `loadModule` throw.

## 16. `yaml.parse` — empty/scalar input typed as object

**Gotcha (verified):** signature is `parse<T extends object>(s): T`, but
`parse('')` → `undefined`, `parse('# comment')` → null-ish,
`parse('just a string')` → a string scalar. An empty config file yields
`undefined` and `config.foo` explodes elsewhere.

**Fix:** `parseObject<T>(str) → T` — throws descriptively on empty input or
scalar results; `parse()` stays as the permissive raw wrapper.

## Checked, no gap

Verified clean: `store` (locked update, clear errors), `vault`, `scheduler`,
`utils.backoff`/`every`, `fs` JSON read/write pairs, `websocket`/`socketio`
clients (proper rejects), `downloader` non-HTTP error paths, `fileManager`
(beyond the documented watch gotcha), `container.state`.

Worth a doc line rather than a fix: `fs.readFile` is synchronous (same shape
as `proc.exec`'s name trap); `container.server('websocket')` with identical
options returns the same cached instance, so "spin up a second server" is
silently a no-op; contentDb tool methods return `{ error }` objects instead
of throwing (fine for assistant tools, a union-type trap for direct callers).
