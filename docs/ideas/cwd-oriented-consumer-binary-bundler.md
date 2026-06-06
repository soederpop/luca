# CWD-Oriented Consumer Binary Bundler Spec

## Status

Draft alignment spec. Not ready for implementation yet.

## Goal

Luca should be able to compile a consumer Luca project into its own standalone binary, such as `loopy`, while preserving Luca's core runtime principle:

> The container orients itself to the current working directory.

A compiled consumer binary should behave like a normal Luca CLI for the project it is run inside, except its built-in command/feature surface is supplied by the consumer project that was baked into the binary rather than by Luca's own `src/commands/*`.

## Non-goals

- Do not anchor runtime behavior to `os.homedir()`.
- Do not require the Luca source checkout to exist at runtime.
- Do not treat the Luca source repo as the user's project root.
- Do not eagerly auto-discover every local feature/client/server at CLI startup.
- Do not embed mutable workspace data such as `docs/`, workflow HTML, assistant folders, or config as the primary runtime source of truth.

## Current POC Problem

The current `commands/bundle-consumer-project.ts` works as a proof of concept, but has the wrong mental model.

It invents a `lucaRoot` using:

```ts
const lucaRoot = container.paths.resolve(os.homedir, '@soederpop/projects/luca')
```

Then it:

- reads Luca's `package.json` from that guessed root
- writes generated bundle files under `src/cli/bundles/<name>` in the Luca source tree
- runs `bun build` with `cwd: lucaRoot`

This works only when the local machine happens to match that path. It fails under environments like Hermes where `HOME` differs, and more importantly it violates the architecture. The bundler should not care where a developer happens to keep the Luca repository.

The POC is useful because it proved that a consumer binary can be compiled, but the implementation should be replaced by a proper built-in Luca bundling command and reusable CLI entrypoint machinery.

## Luca Runtime Layering Model

Luca is built in layers:

1. Generic `Container`
   - `src/container.ts`
   - event bus, state, registries, helper factories, shared context

2. `NodeContainer`
   - `src/node/container.ts`
   - extends the generic container with Node/Bun runtime features
   - enables core features such as `fs`, `proc`, `git`, `grep`, `os`, `networking`, `ui`, `vm`, `transpiler`, `helpers`
   - attaches helper types: clients, servers, commands, endpoints, selectors
   - sets `cwd` from `process.cwd()` and CLI args
   - exposes `container.paths.resolve(...)` scoped to cwd

3. `AGIContainer`
   - `src/agi/container.server.ts`
   - extends `NodeContainer` with assistant/agent capabilities such as conversations, assistants, coding tools, docs reader, memory, etc.
   - initializes `container.docs` at `container.paths.resolve('docs')`

4. Normal Luca CLI entrypoint
   - `src/cli/cli.ts`
   - imports `container from 'luca/agi'`
   - imports Luca's baked command set via `@/commands/index.js`
   - loads global/project `luca.cli.ts`
   - auto-discovers cwd `commands/`
   - dispatches the selected command

A consumer binary should reuse layers 1-3 and replace layer 4's baked command set.

## Desired Consumer Binary Model

A compiled consumer binary should be:

```txt
Luca AGI runtime
+ consumer project's baked helpers/commands/features selected at compile time
+ normal cwd-oriented project command discovery at runtime
+ normal project `luca.cli.ts` customization at runtime
```

For `loopy`, that means:

```txt
loopy binary
+ luca/agi container
+ baked Agentic Loop command/feature surface
+ cwd workflows/docs/assistants/assets/config
+ cwd commands/ auto-discovered as local extensions
+ cwd luca.cli.ts can discover local features or customize the container
```

## Built-in Commands vs Runtime Features

"Rewinding" the binary means removing/replacing Luca's baked CLI commands, not removing Luca's runtime primitives.

Keep baked runtime primitives:

- Node and AGI container classes
- core features like `fs`, `proc`, `helpers`, `contentDb`, `express`, `websocket`, `conversation`, `assistantsManager`, etc.
- registries and helper factories

Replace baked CLI command set:

- normal `luca` imports `src/commands/index.js`
- consumer binary should not import that by default
- consumer binary imports a generated manifest of consumer project commands/features/etc.

Optional Luca built-in commands may still be included deliberately, e.g. `describe`, `eval`, `run`, but they should be an explicit bundling choice, not assumed.

## Runtime Discovery Rules

### Commands

Local cwd commands should be discovered automatically, just like Luca's CLI does today.

If a user runs `loopy` inside a cwd containing:

```txt
commands/foo.ts
```

then `foo` should appear and dispatch without requiring project code to discover it manually.

### Features / clients / servers / endpoints / selectors

These should be discovered by userland code, not blindly auto-discovered by the generic CLI entrypoint.

Accepted mechanisms:

- project `luca.cli.ts` calls `container.helpers.discoverAll()` or targeted discovery
- a command calls `container.helpers.discover('features')`, `container.helpers.discover('endpoints')`, etc.
- a baked command/feature statically imports or registers the dependencies it needs

The generic CLI dispatcher should not eagerly discover every local feature/client/server just because a directory exists.

## Shared CLI Runner

The current POC generates too much custom CLI/help/dispatch code.

There should be a reusable CLI runner, conceptually:

```ts
runCli(container, {
  binaryName,
  commandSetKind,
  discoverLocalCommands: true,
  discoverUserLayer: maybe,
})
```

Normal Luca binary:

```ts
import container from 'luca/agi'
import '@/commands/index.js'
import { runCli } from './runner'

await runCli(container, {
  binaryName: 'luca',
  commandSetKind: 'luca',
})
```

Consumer binary:

```ts
import container from 'luca/agi'
import './generated-consumer-manifest'
import { runCli } from 'luca/cli-runner'

await runCli(container, {
  binaryName: 'loopy',
  commandSetKind: 'consumer',
})
```

The CLI runner should preserve Luca's cwd semantics:

1. Snapshot baked commands.
2. Load global CLI module if enabled.
3. Load cwd `luca.cli.ts`.
4. Auto-discover cwd `commands/`.
5. Optionally discover user-level commands/helpers if that remains part of the product model.
6. Dispatch command or help.

## Bundling Command Shape

The real bundling command should be a baked Luca command in `src/commands/*`, not only a project-local POC command.

Possible command name:

```sh
luca bundle <name> --source <project> --out <file-or-dir>
```

or:

```sh
luca compile <name> --source <project> --out <file-or-dir>
```

The command should:

1. Resolve the source project path from explicit input or cwd.
2. Discover the source project's bundleable helpers.
3. Generate a consumer manifest/entrypoint in an isolated build directory, not inside Luca source.
4. Compile with Bun.
5. Emit binary artifacts to the requested output directory.

It should not need a `lucaRoot` concept.

If it needs to compile against a specific Luca implementation, that should be expressed explicitly as a runtime/package spec, for example:

```sh
--runtime luca@3.2.1
--runtime file:/Users/jonathansoeder/@luca
```

For local framework development, defaulting to the currently running Luca package may be useful, but it should not be guessed from `HOME`.

## Build Directory Model

Use an isolated generated build directory, for example:

```txt
<outDir>/.luca-bundle-build/<name>/
```

or a temp directory:

```txt
/tmp/luca-bundles/<name>-<hash>/
```

Generated files may include:

```txt
entry.ts
generated-consumer-manifest.ts
package.json
bun.lock
```

The generated `package.json` should declare the Luca runtime explicitly, e.g.:

```json
{
  "type": "module",
  "dependencies": {
    "luca": "file:/path/to/current/luca-or-npm-version"
  }
}
```

Then compile from that build directory:

```sh
bun install
bun build entry.ts --compile --outfile <outFile>
```

## Consumer Manifest Responsibilities

The generated consumer manifest should statically import/register the source project's selected baked surface.

For commands:

- import each source command module
- register it into the command registry using the normal command/graft machinery
- support accepted command module shapes consistently with Luca discovery

For features/clients/servers/endpoints/selectors:

- import modules that self-register, or register them explicitly if needed
- preserve the same naming and registration conventions as regular Luca discovery

The manifest is compile-time glue. It should not alter cwd orientation.

## Loopy Asset Model

The Loopy binary should not rely on baked mutable asset folders as the primary runtime source.

Instead, Loopy should have an init/sync/update path that downloads or refreshes assets from a known host into the cwd.

Possible cwd structure after init:

```txt
./workflows/
./assistants/
./docs/
./config.yml or ./loopy.yml
./commands/       optional user extensions
./features/       optional user extensions
./luca.cli.ts     optional user customization
```

Then normal runtime behavior works naturally:

- workflow library reads `container.paths.resolve('workflows')`
- content DB reads `container.paths.resolve('docs')`
- assistant manager can discover cwd assistants
- local commands are auto-discovered
- local features are discovered by `luca.cli.ts` or userland commands

## Acceptance Criteria

A correct implementation should satisfy:

1. `luca bundle loopy --source /path/to/agentic-loop --out /tmp/loopy` produces a binary.
2. The command works from a normal installed/compiled Luca binary, not only from a source checkout command.
3. No generated consumer files are written under Luca's `src/` tree.
4. No `os.homedir()`-derived Luca root is required.
5. The produced binary runs from a clean cwd.
6. The produced binary help shows baked consumer commands.
7. The produced binary auto-discovers cwd `commands/` just like Luca.
8. Local cwd features are not auto-discovered unless userland code asks for discovery.
9. `luca.cli.ts` in cwd can customize/discover features before dispatch.
10. Optional selected Luca built-in commands can be included intentionally.
11. The binary can operate against cwd-local `docs/`, `workflows/`, `assistants/`, and config.
12. Loopy-specific asset download/sync initializes those cwd-local folders from a known host.

## Open Questions

- What should the command be named: `bundle`, `compile`, or `build-binary`?
- Should user-level `~/.luca` discovery remain enabled by default for consumer binaries, or only for `luca`?
- Which Luca built-in commands should be allowed/encouraged in consumer binaries?
- Should asset sync be part of the generic Luca bundling system or a Loopy-specific baked command?
- Should consumer binaries include generated introspection for their baked surface?
- How should version/update metadata be represented for downloaded workflow/static assets?

## Current Understanding

The POC proved the compile path is possible, but the product version should be implemented as a proper Luca-native bundler:

- use Luca's existing container layers
- replace the baked command import layer
- share the CLI dispatcher
- preserve cwd orientation
- let commands auto-discover locally
- let userland code discover non-command helpers
- keep Loopy assets cwd-local and downloaded/synced from a known host
