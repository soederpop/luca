# LUCA

Lightweight Universal Conversational Architecture. Runtime is bun.

Luca provides a system for building runtime `container` objects which provide server and browser applications with all of the dependencies they need to build complete applications.  A `container` is a per process global singleton, event bus, state machine, and dependency injector.  A `container` is either based on a node or browser runtime, and comes with features optimized for that environment.  You can build your own container on top of it, with your own features, clients, servers.  It is very much inspired by docker layer caching.

A `container` could be used for all "business logic" and state, and be a headless provider for an entire application.  The UI, Scripting output, input, etc, are all just functional interfaces and event bindings to the core container and all of its helpers, and their state.

Dependencies consist of Helpers - Features, Clients, Servers, as well as primitives like event buses, observable state.  The `container` contains registries of all available components: `container.features`, `container.clients`, `container.servers`, `container.commands`, `container.endpoints` as well as factory functions to create instances of them: `container.feature('fileManager')`, `container.server('express')`. 

The `container` and its helpers are perfect for scripts and long running services on the backend, or highly reactive and stateful applications on the frontend.  The components can easily talk to eachother, as the `container` on the server provides servers like `container.server('express')` and `container.server('websocket')` as well as `container.client('rest')` and `container.client('websocket')` and others.  

On the frontend the browser container is perfect for highly reactive, stateful web applications, especially works well with React.

## The `luca` CLI

- in dev, `bun run src/cli/cli.ts` is the same as `luca`

- in prod, or educational material, `luca` refers to the binary build.  In this mode, it can work in any project, and load `commands/` and `endpoints/` through its VM and therefore allows folders of these modules which don't depend on anything from NPM to extend the CLI and be used in commands like `luca serve` to run a local express server

- The `luca` cli is an extremely helpful tool.  
	- it runs code `luca eval "container.features.available"` 
	- it generates docs:
		- `luca describe diskCache`
		- `luca describe` describe the container itself
		- `luca describe servers` describe which servers are available
		- the arguments to describe are pretty forgiving and permissive

**IMPORTANT NOTE** When trying to investigate features, clients, servers, etc, see if these tools can help you first instead of searching for files and reading them that way.  If youw ant to understand what they do, vs how theyre actually implemented

## Coding style and guidelines

- The container is intended to provide a collection of blessed, approved, audited modules that we've built and curated together.  It is intended to be the primary API and interface through the system  
- The container should provide you with everything you need, and you should not need to be importing dependencies or other modules.  If you find yourself stuck by this constraint, raise this concern, and we can work on finding a way to bring in a feature or client
- When trying to find paths in the project, use `container.paths.resolve()` or `container.paths.join()` instead of `import { resolve } from 'path'`
- **NEVER import from `fs`, `path`, or other Node builtins when the container provides equivalents.** Use `container.feature('fs')` for file operations, `container.paths` for path operations. This applies to command handlers, scripts, and any code that has access to a container. The only exception is inside feature implementations themselves (e.g. `proc.ts`, `fs.ts`) where you ARE building the container primitive — those may use Node builtins directly since they can't depend on themselves.

## Type Safety and Introspection

- Zod does a lot of the heavy lifting for us with its type inference
- For more descriptive things like class descriptions, method descriptions, we rely on jsdoc blocks.  These are parsed and used to generate modules we commit to source.  We shouldn't let these drift, so for this reason we have a pre-commit hook which ensures they're up to date
- We rely on module augmentation a lot to make sure `container.feature()` can provide type signatures for everything that gets added to it by extension modules down the road.  ( kind of like we did with AGIContainer extending NodeContainer )

## Testing

- Test runner is **bun** (not vitest). Do not import from or add vitest.
- `bun run test` — runs unit tests only (`test/*.test.ts`), excludes `test/integration/`
- `bun run test:integration` — runs integration tests that hit real APIs/CLIs (gated by env vars)
- Import `mock`, `spyOn` from `bun:test` when needed. If you import anything from `bun:test`, you must also import `describe`, `it`, `expect`, etc. from there (importing disables auto-globals).
- **ALL tests must pass. Zero tolerance for test failures.** The ESBuild feature's "service is no longer running" error is a known critical bug — if you encounter it, fix it. Do not ignore it, do not skip it, do not leave it broken. This applies to every test: if a test fails, that is a blocker. Fix the root cause.

## API Docs

- See [docs/apis](./docs/apis/) for detailed API descriptions of the public methods and options for creating various helpers
- See [docs/examples](./docs/examples/) for examples of using each feature.  NOTE: These docs are runnable so you can see the output of the code blocks.  `luca run docs/examples/grep` for example
- See [docs/tutorials](./docs/tutorials/) for longer form tutorials on various subjects and best practices