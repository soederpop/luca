# LUCA

Lightweight Universal Conversational Architecture. Runtime is bun.

The runtime is bun, that means no vitest.

Luca provides a system for building runtime `container` objects which provide server and browser applications with all of the dependencies they need to build complete applications.  A `container` is a per process global singleton, event bus, state machine, and dependency injector.  A `container` is either based on a node or browser runtime, and comes with features optimized for that environment.  You can build your own container on top of it, with your own features, clients, servers.  It is very much inspired by docker layer caching.

A `container` could be used for all "business logic" and state, and be a headless provider for an entire application.  The UI, Scripting output, input, etc, are all just functional interfaces and event bindings to the core container and all of its helpers, and their state.

Dependencies consist of Helpers - Features, Clients, Servers, as well as primitives like event buses, observable state.  The `container` contains registries of all available components: `container.features`, `container.clients`, `container.servers`, `container.commands`, `container.endpoints` as well as factory functions to create instances of them: `container.feature('fileManager')`, `container.server('express')`. 

The `container` and its helpers are perfect for scripts and long running services on the backend, or highly reactive and stateful applications on the frontend.  The components can easily talk to eachother, as the `container` on the server provides servers like `container.server('express')` and `container.server('websocket')` as well as `container.client('rest')` and `container.client('websocket')` and others.  

On the frontend the browser container is perfect for highly reactive, stateful web applications, especially works well with React.

## Developer Standards

- Please try not to have broken tests committed to the build and let them slide.  Encourage me to fix them so they dont grow out of control.
- When working on features, clients, servers, or other helpers, the introspection system relies on good zod descriptions, and good jsdoc descriptions


## The `luca` CLI

- in dev, `bun run src/cli/cli.ts` is the same as `luca`

- in prod, or educational material, `luca` refers to the binary build.  In this mode, it can work in any project, and load `commands/` and `endpoints/` through its VM and therefore allows folders of these modules which don't depend on anything from NPM to extend the CLI and be used in commands like `luca serve` to run a local express server

- The `luca` cli is an extremely helpful tool.  
	- it runs code `luca eval "container.features.available"` 
	- it generates docs:
		- `luca describe diskCache`
		- `luca describe` describe the container itself
		- `luca describe servers` describe which servers are available
		- `luca describe ui.banner` describe a specific method or getter on a helper
		- the arguments to describe are pretty forgiving and permissive

**IMPORTANT NOTE** When trying to investigate features, clients, servers, etc, see if these tools can help you first instead of searching for files and reading them that way.  If youw ant to understand what they do, vs how theyre actually implemented

## OpenAI Tool Schemas (Zod → JSON Schema)

**OpenAI requires `required` to list ALL property keys in `properties`**, even optional ones. Zod's `toJSONSchema()` only puts non-optional fields in `required`, which OpenAI rejects with "Missing 'X'" errors. The `assistant.addTool()` method handles this automatically by always setting `required: Object.keys(properties)`. Do NOT use `z.any()` or `z.record(z.any())` in tool schemas — Zod v4's `toJSONSchema()` cannot serialize `z.any()` and will throw `schema._zod is undefined`. Use concrete types like `z.string()` instead (e.g. accept a JSON string and parse it at runtime).

## Coding style and guidelines

- The container is intended to provide a collection of blessed, approved, audited modules that we've built and curated together.  It is intended to be the primary API and interface through the system  
- The container should provide you with everything you need, and you should not need to be importing dependencies or other modules.  If you find yourself stuck by this constraint, raise this concern, and we can work on finding a way to bring in a feature or client
- When trying to find paths in the project, use `container.paths.resolve()` or `container.paths.join()` instead of `import { resolve } from 'path'`
- **`paths.join()` vs `paths.resolve()` gotcha:** `paths.join()` always prepends `container.cwd` — even if you pass an absolute path as the first arg. Use `paths.resolve(absolutePath, 'sub')` when the base is already absolute (e.g. `os.tmpdir`). `resolve` respects absolute first args just like Node's `path.resolve`.
- **NEVER import from `fs`, `path`, or other Node builtins when the container provides equivalents.** Use `container.feature('fs')` for file operations, `container.paths` for path operations. This applies everywhere — command handlers, scripts, and feature implementations alike. If a container feature wraps the functionality, use it.

## Container Utilities

The container provides `container.utils` with common utilities. **Use these instead of importing packages directly** — they work in both node and web environments.

- `container.utils.uuid()` — generates a v4 UUID (use instead of importing `node-uuid` or `crypto`)
- `container.utils.hashObject(obj)` — deterministic hash of any object
- `container.utils.stringUtils` — `{ kebabCase, camelCase, upperFirst, lowerFirst, pluralize, singularize }`
- `container.utils.lodash` — `{ uniq, keyBy, uniqBy, groupBy, debounce, throttle, mapValues, mapKeys, pick, get, set, omit }`

Also available on every container:
- `container.uuid` — the container's own unique ID
- `container.paths.resolve()` / `container.paths.join()` — path operations

## Adding a New Feature — Checklist

When creating a new feature (e.g. `gws`), all four of these steps must be completed or `container.feature('gws')` will fail silently or lack type safety:

1. **Feature file** — `src/node/features/gws.ts`
   - Export the class: `export class Gws extends Feature { ... }`
   - Register inside the class: `static { Feature.register(this, 'gws') }`
   - Default export is just the class: `export default Gws`

2. **Side-effect import** — `src/node/container.ts` (import block ~line 20-63)
   - Add `import "./features/gws";` (this triggers registration)

3. **Type import + re-export** — `src/node/container.ts` (type imports ~line 65-148)
   - Add `import type { Gws } from './features/gws';`
   - Add `type Gws,` to the `export { ... }` block

4. **Feature type mapping** — `src/node/container.ts` (`NodeFeatures` interface ~line 170-215)
   - Add `gws: typeof Gws;` to the `NodeFeatures` interface

Missing step 2 = feature never registers (invisible).
Missing steps 3-4 = no autocomplete, `container.feature('gws')` returns `Feature` not `Gws`.

If the feature has a test, it goes in `test/gws.test.ts`.

## Type Safety and Introspection

- Zod does a lot of the heavy lifting for us with its type inference
- For more descriptive things like class descriptions, method descriptions, we rely on jsdoc blocks.  These are parsed and used to generate modules we commit to source.  We shouldn't let these drift, so for this reason we have a pre-commit hook which ensures they're up to date
- We rely on module augmentation a lot to make sure `container.feature()` can provide type signatures for everything that gets added to it by extension modules down the road.  ( kind of like we did with AGIContainer extending NodeContainer )

## Generated Files — Build Artifacts

**Files matching `generated.ts` or `.generated*.ts` are BUILD ARTIFACTS, not source of truth.** They are produced by the introspection system (which parses JSDoc blocks, Zod schemas, etc.) and bundled into the binary at compile time. **Never edit these files directly** — your changes will be overwritten on the next build.

The source of truth for scaffolds and templates is the markdown files and the actual source code with their JSDoc annotations. If scaffold output is wrong, fix the markdown source or the JSDoc blocks on the real classes, then rebuild.

This means **JSDoc blocks on helpers (features, clients, servers) must be valid and complete** — they are picked up by the introspection system, used to generate API docs, scaffold tutorials, and the `luca describe` output. Treat JSDoc as documentation infrastructure, not comments.

## Testing

- Test runner is **bun** (not vitest). Do not import from or add vitest.
- `bun test` or `bun run test` — runs unit tests only (`test/*.test.ts`)
- `bun run test:integration` — runs integration tests in `test-integration/` that hit real APIs/CLIs (gated by env vars)
- Import `mock`, `spyOn` from `bun:test` when needed. If you import anything from `bun:test`, you must also import `describe`, `it`, `expect`, etc. from there (importing disables auto-globals).
- **ALL tests must pass. Zero tolerance for test failures.** The ESBuild feature's "service is no longer running" error is a known critical bug — if you encounter it, fix it. Do not ignore it, do not skip it, do not leave it broken. This applies to every test: if a test fails, that is a blocker. Fix the root cause.

## API Docs

- See [docs/apis](./docs/apis/) for detailed API descriptions of the public methods and options for creating various helpers
- See [docs/examples](./docs/examples/) for examples of using each feature.  NOTE: These docs are runnable so you can see the output of the code blocks.  `luca run docs/examples/grep` for example
- See [docs/tutorials](./docs/tutorials/) for longer form tutorials on various subjects and best practices

## Git Strategy

- We generally roll all on main.  Commit your changes after you're done, only your changes.  Leave a good message, tell me why don't just tell me what.  Don't gimme that coauthored by whoever bullshit.  The streets know we're one.

- Always commit your work
