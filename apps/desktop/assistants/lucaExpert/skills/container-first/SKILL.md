---
name: container-first
description: How to get information and do work through the live container in one `evalCode` call instead of several shell calls. Read this before you reach for `runShellCommand` or `runLucaCommand` to look something up (ls, grep, cat, find, `luca describe`, `luca eval`) and before any task where you need to gather context, keep working values between tool calls, or build a small stateful object that outlives one snippet. Covers the one-snippet-inventory habit, file search with `fs.glob`, `fileManager.match` and `grep`, carrying state with `container.addContext`, and building ad-hoc features and entities with state, events and methods.
---

# Container First

You run inside a live Luca process. `evalCode` gives you the whole `container`: every feature, client and server, the registries, the event bus, state, and the file system of the current project. One snippet can gather everything a task needs and return it as one object. That is almost always better than three shell calls whose output you then have to read.

Everything starts in `evalCode`. Three other ways to run container code exist, each for a reason:

| Way | Where it runs | `assistant` in scope | Use it when |
|---|---|---|---|
| `evalCode` | this process, now | yes (it is you) | Gathering facts, prototyping, building working objects. The default. |
| `luca eval "<code>"` via `runLucaCommand` | a new process, waits for exit | no | One-off work that must not touch this process: a helper you just wrote (this process never sees it), another project (`cwd`), or something that may throw, leak or hang. |
| `luca run <file.ts>` via `runLucaCommand` or `processManager` | a new process | no | Long work. Write the script to a file, run it, and read its output when it ends. In the background with `processManager` while you do other things. |
| A long-lived process (`luca serve`, a `luca run` daemon, a watcher) | its own process, stays up | no | Work that should outlive one tool call. Talk to it over `container.store`, files, ipc or a socket. |

The shell is for a **new process**, never for a lookup this process can answer. `luca scaffold`, `bun test` and servers are new processes too.

## The habit

1. **Name what you need to know** before you call anything. "Which providers exist, which skills exist, which assistants exist, and what does `assistants/options.yml` say."
2. **Write one snippet that collects all of it** into one object, with short keys, and end with that object. Use `Promise.all` for independent async calls. Trim long lists with `.slice()` or `.map()` to the fields you need.
3. **Save what you will need again** with `container.addContext('name', value)`. Every later snippet in this process sees it as a bare variable.
4. **Only then decide.** Then write files, scaffold, or run a command.

A snippet that returns a focused object you can read in one glance is the goal. Do not print whole files or whole registries.

## Instead of the shell

| You want | Not this | This |
|---|---|---|
| Files by pattern | `find`, `ls -R` | `fs.glob('src/**/*.ts', { exclude: ['node_modules'] })` or `fileManager.match('features/*.ts')` after `await fileManager.start()` |
| Text in files | `grep -rn` | `await grep.search({ pattern, include: '*.ts', path, maxResults: 20 })`, `grep.filesContaining`, `grep.definitions('Name')`, `grep.todos()` |
| A file's contents | `cat` | `await fs.readFileAsync(path)`, `fs.readJsonAsync`, `fs.readFirstLineAsync` |
| What a helper can do | `luca describe x` in the shell | `container.feature('x').introspectAsText()` or `describe_helper`; `container.features.available` for the index |
| Which helpers expose tools | reading source | `container.features.availableToolsProviders` |
| Recent commits | `git log` | `await container.feature('git').getLatestChanges(5)` |
| Run a short command and parse its output | `runShellCommand` then read | `await proc.spawnAndCapture('cmd', ['args'])` inside the snippet, next to the other facts |
| YAML, JSON | `cat` + reading | `container.feature('yaml').parse(await fs.readFileAsync(p))` |

`fs`, `proc`, `grep`, `fileManager` and every other enabled feature are in scope by bare name. Anything else: `container.feature('name')`.

## Carry state across calls

The snippet's own variables are gone by the next call. The container is not.

```ts
const facts = { providers: modelProviders.available, cwd: container.cwd }
container.addContext('facts', facts)   // later snippets: `facts.providers`
```

`container.addContext` is the right place for an inventory, a parsed config, a list of files you are working through, or an object you built. It lives as long as this process. For state that must outlive the process, `container.store('name', { schema })` writes a locked JSON document under `.luca/store/`.

## Build the object you need

You are not limited to what exists. Make a stateful thing in the snippet and keep it:

**An entity** for a plain object with observable state, events and methods:

```ts
const review = container.entity('review', { files: [] }).extend({
  add(file: string) { this.setState(s => ({ seen: [...(s.seen || []), file] })); this.emit('added', file) },
  get count() { return (this.state.get('seen') || []).length },
})
review.on('added', f => console.log('added', f))
container.addContext('review', review)
```

**A feature** when you want the full helper contract (schemas, `introspectAsText`, a place in `container.features`):

```ts
const { Feature } = require('luca')
class Tally extends Feature {
  static { Feature.register(this, 'tally') }
  static stateSchema = z.object({ hits: z.number().default(0) }).passthrough()
  bump() { this.setState(s => ({ hits: (s.hits || 0) + 1 })); this.emit('bumped', this.state.get('hits')); return this.state.get('hits') }
}
const tally = container.feature('tally')
container.addContext('tally', tally)
```

Both are gone when the process ends. They are scaffolding for your work, not a replacement for a helper file in the project.

## Many processes

Every `luca` process has its own container with the same features. You can start more of them and make them work together. Ways to connect them:

- **`container.store('name', { schema })`**: one locked JSON document under `.luca/store/`, read and written by every process. A worker writes progress; you read it in a later snippet.
- **Files**: a script writes `out/report.json`; you read it with `fs.readJsonAsync`.
- **`processManager`**: `pm.spawn('luca', ['run', 'scripts/job.ts'])` returns a handle at once, with `exit` events and head and tail of its output. The child dies with this process.
- **`ipcSocket`**: a hub in one process, named spokes in others, `ask()` and `reply()` for request and reply over a Unix socket.
- **`container.server('websocket', { port })` and `container.client('websocket')`**: the same across machines.
- **Another instance of an assistant**: a `luca run` script can `container.feature('assistantsManager').create('name')` and `ask()` it. That is a second copy of you, or of any assistant, in its own process, with its own history. `luca prompt <assistant> <file.md>` does the same from the shell for a prompt file.

A `luca run` script is a `.ts` file whose top-level code runs with the container in scope and whose `default` or `main` export is called with the container context. Write it with `writeFile`, run it, read what it left behind.

## Gotchas

- **Instances are cached by options.** `container.feature('skillsLibrary')` is not the same instance as one created with `{ locations }`. To see the instance an assistant built, go through the assistant (`assistant.use(...)` registered it), or create one with the same options, or use `container.feature('helpers').getInstances(Class)`.
- **`fileManager.match` needs `await fileManager.start()` first.** `fs.glob` needs nothing.
- **Sync calls freeze the process** that every other session shares. Prefer `readFileAsync`, `spawnAndCapture`, `grep.search`.
- **Another project is another process.** `evalCode` sees only the current project. For a project from `createProject` or `openProject`, send the same snippet through `runLucaCommand` with `eval "<code>"` and that project's `cwd`.
- **Never end a snippet with a bare `({ ... })`.** A line that starts with `(` continues the previous line and becomes a call. Put the result in `const out = { ... }` and end with `out`.
- **`assistant` in a snippet is you.** Read from it; do not write into its conversation.

The copy-paste snippets for common tasks are in [references/recipes.md](references/recipes.md).
