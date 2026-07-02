# The Runtime Envelope — where code runs, what it can import

Luca code executes in several distinct environments with different powers. Most opaque errors ("Could not import the module", "Failed to load native binding", "is not registered") come from writing code for one envelope and running it in another.

## The matrix

| Entry point | Container available? | npm imports? | Project-file imports? | Notes |
|---|---|---|---|---|
| `luca eval "…"` | yes — live, helpers pre-bound (`fs`, `git`, `proc`…) | **no** | **no** | inline everything; trailing `undefined` after console output is the expression's return value |
| `luca run script.ts` | yes — injected as a global | only deps bundled into the binary | **no relative static imports** | see below |
| `luca run doc.md` | yes — per code block | same as above | same | runnable markdown; great prototype artifact |
| command / endpoint handlers | yes — via `context.container` / `ctx.container` | avoid; use container features | yes | no Bun globals; no `.tsx` |
| plain `bun script.ts` | **no** (unless you import it) | yes | yes | see "importing the luca package" below |

## `luca run` script rules

The VM wrapper rewrites imports, and **relative static imports break it**:

```ts
import { helper } from './bundle.ts'   // ✗ SyntaxError: Unexpected string literal
const { helper } = await import('/abs/path/bundle.ts')  // ~ works, but resolution can drag in transitive deps
```

**The reliable shape: keep `luca run` scripts self-contained.** One file, container global, no local imports. If a script genuinely needs project modules, run it with plain `bun` instead — or pass `--dontInjectContext` to `luca run` to skip the VM (you then construct the container yourself).

## Importing the `luca` package from plain bun

- `import container from 'luca'` → the **NodeContainer**. Can crash under plain bun on optional native bindings (e.g. iroh) depending on install state.
- `import container from 'luca/agi'` → the **AGIContainer** — this is where `assistant`, `assistantsManager`, `conversation`, `voiceMode` and other AI helpers live. `features "assistantsManager" is not registered` means you imported `'luca'` when you needed `'luca/agi'`.
- `createContainer()` is exported because models hallucinate it — it works, but the default export is already a ready container.
- When an import fails opaquely inside eval/run, run the same file with plain `bun` to see the true resolution error.

## Process lifetime

Every `luca <command>`, `luca run`, and `luca eval` invocation is a **fresh process with a fresh container**:

- Registrations, state, and event subscriptions do not survive between invocations.
- Two invocations can only communicate through disk (`diskCache`, `sqlite`, files) or through a running server.
- A "did my helper register?" check must happen in the *same* process that registered it, or via auto-discovery (files in `commands/`, `features/`, `endpoints/` are re-discovered every boot).

## Dev CLI vs installed binary (framework repo only)

Inside the luca framework repo itself, the installed `luca` binary bakes in introspection data from its build time — `luca describe` for a feature you *just added to source* will say it doesn't exist. Use `bun run src/cli/cli.ts describe …` (the dev CLI) until you rebuild. In consumer projects this doesn't apply to your own `features/` folder — those are discovered live — but an old installed binary can still lack recently-added built-ins (`luca -v` to check).

## Compiled consumer binaries (`luca bundle`)

A binary compiled from a consumer project auto-discovers cwd `commands/` at runtime, but **not** cwd `features/` — a project `luca.cli.ts` with `await container.helpers.discover('features')` opts features in. Workflow/docs folders are not baked in at all; plan for the repo checkout to travel with the binary if those matter.
