---
title: Error-Handling Conventions
tags:
  - errors
  - conventions
  - rest
  - diskCache
  - proc
  - registries
  - composition
lastTested: '2026-07-03'
lastTestPassed: true
---

# Error-Handling Conventions

The framework's helpers do not all fail the same way — and several fail the *opposite* of how instinct says they should. This doc is the map: each convention below is demonstrated live and asserted, so if a contract ever changes, this doc fails.

The four to internalize:

1. **`rest` returns errors** as values — try/catch catches nothing.
2. **`diskCache.get` throws on a miss** — it does not return `undefined`.
3. **`proc.exec` throws on failure; `proc.execAndCapture` never throws** — check `.error`.
4. **Registries are classes** — `Object.keys()` lies; use `.available`.

## 1. The rest client returns errors

The full walkthrough (HTTP errors, health-check idiom, rate limits) lives in [full-stack-slice.md](./full-stack-slice.md); here is just the reflex. A request to a dead port **resolves** — the error comes back as a plain serialized object, not a thrown exception, and `instanceof Error` is `false`. Connection failures carry a `code` (the exact string is runtime-dependent: `'ConnectionRefused'` under Bun, `'ECONNREFUSED'` under Node — never assert the exact string).

```ts
const deadPort = await networking.findOpenPort(4720)
const down = container.client('rest', { baseURL: `http://localhost:${deadPort}` })

const result = await down.get('/anything')

if (result instanceof Error) throw new Error('unexpected: rest error came back as an Error instance')
if (!result?.code) throw new Error('expected a connection error code on the returned value')
console.log('dead server resolved to a value with code:', result.code)
```

So never write `try { await api.get(...) } catch { ... }` and call it handled — inspect the shape of what came back (`result?.name === 'AxiosError'`, `result?.code`, `result?.status`).

## 2. diskCache.get throws on a miss

The mirror image of the rest client: a cache miss **rejects**, it does not resolve to `undefined`. The rejection is a `NotFoundError` with `code: 'ENOENT'`. (Full API: `luca describe diskCache`.)

```ts
// bare assignment — cacheDir survives into the cleanup block
cacheDir = container.paths.resolve(os.tmpdir, `error-conventions-cache-${Date.now()}`)
cache = container.feature('diskCache', { path: cacheDir })

let caught = null
try {
  await cache.get('never-written')
} catch (err) {
  caught = err
}

if (!caught) throw new Error('diskCache.get on a missing key must throw — it did not')
if (caught.code !== 'ENOENT') throw new Error(`expected code ENOENT on a cache miss, got ${caught.code}`)
console.log('cache miss rejected with code:', caught.code)
```

The idiomatic guards: `has()` before `get()`, or `ensure()` to seed a default so the read can never miss.

```ts
if (await cache.has('never-written')) throw new Error('has() should be false for a missing key')

await cache.ensure('never-written', 'default-value')
const val = await cache.get('never-written')
if (val !== 'default-value') throw new Error('ensure() should have seeded the default')
console.log('guarded read after ensure():', val)
```

## 3. proc: exec throws, execAndCapture reports

`proc.exec(cmd)` is synchronous, runs through a shell, and returns the **trimmed stdout as a plain string**. On a nonzero exit it **throws**, with the exit code at `err.status`.

```ts
const banner = proc.exec('echo hello')
if (banner !== 'hello') throw new Error(`exec should return trimmed stdout, got ${JSON.stringify(banner)}`)

let execError = null
try {
  proc.exec('exit 3')
} catch (err) {
  execError = err
}
if (!execError) throw new Error('exec on a failing command must throw')
if (execError.status !== 3) throw new Error(`expected err.status === 3, got ${execError.status}`)
console.log('exec returned a string on success, threw with status', execError.status, 'on failure')
```

`proc.execAndCapture(cmd)` is asynchronous and **never throws for a failing command** — it always resolves to a structured `{ stdout, stderr, exitCode, pid, error }`. On success `error` is `null` and `exitCode` is `0`; on a nonzero exit `exitCode` carries the child's real status and `error` is set (with the code also at `error.code`).

```ts
const ok = await proc.execAndCapture('bun --version')
if (typeof ok.stdout !== 'string' || !ok.stdout.trim()) throw new Error('expected captured stdout')
if (ok.error !== null) throw new Error('successful run should have error === null')
if (ok.exitCode !== 0) throw new Error('successful run should have exitCode 0')

const failed = await proc.execAndCapture('bun -e process.exit(3)')
if (failed.exitCode !== 3) throw new Error(`expected exitCode === 3, got ${failed.exitCode}`)
if (failed.error == null) throw new Error('nonzero exit should also surface on .error')
if (failed.error.code !== 3) throw new Error(`expected error.code === 3, got ${failed.error.code}`)
console.log('execAndCapture failure: exitCode =', failed.exitCode, ', error.code =', failed.error.code)
```

One trap to know:

- **The command string is split naively on spaces** — no shell quoting. Any argument containing spaces (paths, `--format="%h %s"`) gets mangled. Use `proc.spawnAndCapture(command, argsArray)` and pass each argument as its own element.

## 4. Registries are classes — use .available

`container.features`, `container.commands`, `container.clients`, `container.servers` are class instances, not plain objects. `Object.keys()` on them returns internal fields, **not** helper ids. Enumerate with `.available`.

```ts
const keys = Object.keys(container.features)
if (keys.includes('fs')) throw new Error('unexpected: Object.keys() now enumerates helper ids — update this doc')
if (!container.features.available.includes('fs')) throw new Error('.available should list the fs feature')

console.log('Object.keys(container.features) =', JSON.stringify(keys), '— useless for enumeration')
console.log('.available lists', container.features.available.length, 'features, including fs')
```

## Clean up

```ts
await fs.rmdir(cacheDir)
console.log('removed scratch cache dir', cacheDir)
```

## The cheat sheet

- **`rest` client** — failure is **returned** as a plain object. Detect: `result?.name === 'AxiosError'`, `result?.code`, `result?.status`.
- **`diskCache.get`** — a miss **throws** `NotFoundError` (`code: 'ENOENT'`). Detect: try/catch, or guard with `has()` / `ensure()`.
- **`proc.exec`** — failure **throws**, exit code at `err.status`. Detect: try/catch.
- **`proc.execAndCapture`** — always **resolves**; failure reports the real `exitCode` and sets `.error`. Detect: `result.exitCode === 0` (or `result.error === null`) means success.
- **Registries** — `Object.keys()` returns internals. Enumerate with `.available`.
