---
name: luca-framework
description: Build and debug Luca commands, helpers, endpoints, assistants, and container-backed applications. Use in projects that depend on Luca or explicitly use its CLI; learn installed APIs through runtime introspection and runnable examples.
---
# Build with the Luca container

Luca components can be explored by people and agents through the same interface. The container holds business logic, observable state, events, and named helper registries; UI and CLI handlers remain thin adapters. Features compose capabilities, clients connect to services, and servers accept connections. Names, Zod schemas, and JSDoc make those components discoverable: metadata is part of the deliverable.

## Choose the execution environment

- **Compiled CLI:** `luca` loads project TypeScript through its VM. `container` is injected and imports such as `luca` and `zod` resolve to bundled modules without npm installation. Read [the VM contract](references/tutorials/26-the-vm.md) when writing scripts, loading modules, or diagnosing globals/imports.
- **Installed package:** import the appropriate Node, AGI, or web entry point and explicitly discover project helpers when needed. Read [embedding Luca](references/tutorials/21-embedding-luca.md).
- **Browser:** use the web container; filesystem, databases, and other Node work live behind server endpoints. Start with [reactive browser UIs](references/tutorials/22-reactive-frontend.md), including the shipped React hooks.

In the framework source checkout, `bun run src/cli/cli.ts` invokes the development CLI. An installed binary can be a different version: verify behavior against the runtime you will ship.

## Work from the task

1. Find a matching composition below, or search `luca describe --query "what I need to do" --limit 4`. Follow the returned helper, command-help, or reference pointer.
2. Inspect only the needed API: `luca describe fs.readFile`, or `luca serve --help` for CLI invocation. Existing helpers often solve the task without a custom class.
3. Try the smallest useful composition with `luca eval` or a runnable example. Inspect the example's setup and cleanup before running it; examples may create files, listeners, or external connections.
4. Scaffold only a missing reusable capability: `luca scaffold <type> --tutorial`, then `luca scaffold <type> <name> --description "..."`. Implement the logic and schemas.
5. Verify observable behavior, errors, and resource cleanup. For a helper, inspect `luca describe <name>`; for a command, inspect its `--help`. Run relevant Bun tests. Read [metadata and types](references/tutorials/27-metadata-and-types.md) when changing public APIs.

Do not read every registry or tutorial as a prerequisite. A one-method fix usually needs one member description and a focused check.

## Essential contracts

- Use container capabilities instead of importing filesystem, path, process, or utility packages. File operations: `container.feature('fs')`; processes: `container.feature('proc')`; paths: `container.paths`; utilities: `container.utils`. Raise a missing capability rather than adding a dependency automatically.
- `container.paths.join()` prepends cwd even to an absolute argument. Use `container.paths.resolve(absoluteBase, 'child')` for absolute bases.
- Each CLI invocation gets fresh in-memory state. Use `container.state` or helper state for reactive process-local data; `container.store(name)` for durable cross-process state; `diskCache` for recomputable caches; `sqlite` for relational data/transactions; `redis` for cross-process pub/sub. Use locked `store.update()` for concurrent changes.
- VM modules do not have every Bun global. Use the injected container and supported virtual imports. Keep schemas unconditional; `zod` is available. Runtime eval checks behavior, not TypeScript assignability.
- Close connections, watchers, timers, and listeners when finite work ends, preferably in `finally`. For a service, use `context.runUntilShutdown(cleanup)` or `container.runUntilShutdown(cleanup)`; use `scheduler.run({ onShutdown })` for managed schedules. See [process lifecycle](references/tutorials/28-process-lifecycle.md).
- Describe schema fields and public methods, register helpers by name, and declare category/stability. A helper whose public API is missing from introspection needs its metadata completed as well as its implementation.

## Discover precisely

```sh
luca describe --query "bundle standalone binary" --json --limit 4
luca describe features                       # catalog, when you need an overview
luca describe features --platform web        # browser-specific capabilities
luca describe git.branch                     # one getter or method
luca describe clients.websocket              # qualify ambiguous names
luca describe fs --methods --examples        # selected sections
luca describe git --getters --state --events
luca describe conversation --options --env-vars
luca describe fs --json                      # structured introspection
luca describe fs --ts                        # approximate interface
luca setup --types                          # shipped declarations + tsconfig
luca serve --help                           # command usage, flags, examples
```

Keyword search works without model setup. Semantic ranking is optional: `luca setup --local-embeddings`, then `luca describe --calculate-embeddings`. The [helper index](references/helper-index.md) is a fallback catalog; don't load it if you already know the name. Type declarations are installed under `.luca/types`; local helper augmentation and a TypeScript check remain necessary for custom APIs.

## Match the task to a pattern

All paths below are relative to this skill. Examples are runnable with `luca run <path>`; tutorials explain designs and may contain illustrative, incomplete snippets.

- **Create a helper:** [custom feature](references/examples/custom-feature-authoring.md), [composed-feature tests](references/examples/testing-a-composed-feature.md). Choose `feature` for reusable local behavior, `client` for an external service, `server` for incoming connections.
- **CLI action:** scaffold `command`; read [commands](references/tutorials/08-commands.md) for arguments, schemas, examples, and subcommand help.
- **Cached query:** scaffold `selector`; `luca scaffold selector --tutorial`, then `luca select <name> --json --noCache`. See [selectors](references/tutorials/29-selectors.md).
- **HTTP API:** scaffold `endpoint`; [full-stack slice](references/examples/full-stack-slice.md), [REST roundtrip](references/examples/server-rest-roundtrip.md).
- **WebSocket messaging:** [ask/reply](references/examples/websocket-ask-and-reply-example.md); [HTTP + WebSocket sidecar](references/tutorials/25-express-websocket-sidecar.md) uses `luca serve --setup`.
- **Data and workers:** [cross-process state](references/examples/cross-process-state-handoff.md), [SQLite job queue](references/examples/sqlite-job-queue.md), [pipeline](references/examples/data-pipeline-fs-grep-sqlite.md), [daemon](references/examples/daemon-command.md), [event fan-out](references/examples/event-bus-fanout.md).
- **Browser application:** [reactive UI and React hooks](references/tutorials/22-reactive-frontend.md); [assistant-driven UI](references/tutorials/23-assistant-driven-ui.md) for `containerLink` and tool providers.
- **Assistants:** scaffold `assistant`; [assistant authoring](references/tutorials/12-assistants.md), [feature tools](references/examples/feature-as-tool-provider.md), [structured output](references/examples/structured-output-with-assistants.md). Use `luca assistant --help` for management and `luca chat --help` for interactive use.
- **Prompt automation or MCP:** `luca prompt --help`, `luca mcp --help`, `luca sandbox-mcp --help`. Read [scripts](references/tutorials/03-scripts.md) for runnable markdown and [VM execution](references/tutorials/26-the-vm.md) for evaluation modes.
- **Document models/search:** [markdown state](references/tutorials/24-state-in-markdown.md), [semantic search](references/examples/semantic-search-content-db.md).
- **Plugins:** [discovery and registries](references/examples/meta-discovery.md), [runtime conventions](references/runtime-conventions.md).
- **Shipping a binary:** [packaging and smoke verification](references/tutorials/30-shipping-a-binary.md); `luca bundle --help` for targets and built-in command selection.
- **Unexpected behavior:** [error contracts](references/examples/error-handling-conventions.md), [runtime conventions](references/runtime-conventions.md) for VM, terminal, paths, secrets, and discovery details.

## Prototype and verify

```sh
luca eval "container.features.available"
luca eval "await fs.readFileAsync('package.json')"
luca run scripts/check.ts
luca run notes.md --onlySections "Setup,Check"
luca run notes.md --console
luca introspect --lint --dry-run
```

Eval prints the final expression and supports top-level await. A script runs top-level code, then its exported `default` function or `main` receives the container context. Markdown blocks share a context. `run` defaults to executing code fences; `prompt` defaults to leaving them literal. Use `--eval-mode optIn` for only `eval` fences, `none` for no execution, and `skip` fence metadata to exclude illustrative code. Selected sections do not automatically execute their dependencies.

A scratch cwd helps isolate project files but still loads home hooks/helpers, configured plugins, credentials, and external services. Review those dependencies before treating an experiment as isolated. Discovery environment flags do not disable every startup hook.

After a framework upgrade, `luca bootstrap --update-skill` refreshes this skill and its references from that binary, replacing the skill directory. Keep project-specific guidance in the project instruction file, and local notes outside the generated skill directory.

When upgrading a project with an older, verbose CLAUDE.md template, replace its framework recipes with a link to this skill after preserving project-specific instructions. Refreshing the skill alone cannot remove stale rules copied into project instruction files.
