# From a helper implementation to a discoverable, typed API

Use this workflow when adding or changing a public helper. Runtime behavior, introspection, and TypeScript declarations are separate checks; one does not prove the others.

## Scaffold and implement

In a consumer project:

```sh
luca scaffold feature task-cache --description "Caches task results"
```

Keep the scaffold's registration, schemas, and imports. Implement methods with JSDoc, including parameters and return semantics. Describe options, state, and event fields with Zod `.describe()`. Declare category and stability. Keep asynchronous connection work in an explicit awaited method rather than an unawaited initialization hook.

Project helpers are discovered by the CLI. Package embeddings need `await container.helpers.discoverAll()` or explicit registration. Framework built-ins also need the framework's registration/type wiring: follow that checkout's contributor instructions and generated feature-barrel build rather than treating a built-in like a consumer project file.

## Generate and inspect metadata

```sh
luca introspect --lint --dry-run
luca introspect --lint
luca describe taskCache
luca describe taskCache --options --state --events
```

The dry run previews scanning and lint diagnostics without writing generated metadata. Lint warnings need review; an exit code alone does not establish complete documentation. The normal consumer command writes `features/introspection.generated.ts` by default. Consult `luca introspect --help` to select source directories or output. In the Luca source checkout, use `bun run build:introspection` to regenerate the framework metadata.

Check that the next process can discover your helper and describe its public members. A missing member means checking JSDoc, generation, and registration before adding another prose workaround. For commands, also describe every argument and export usage examples and subcommand metadata; `luca <command> --help` is the acceptance surface for CLI usage.

## Install declarations and augment custom types

```sh
luca setup --types
luca describe taskCache --ts
```

`setup --types` installs the binary's bundled declarations under `.luca/types` and creates a tsconfig when missing. An existing tsconfig is preserved: merge the relevant paths/type settings when necessary. This operation refreshes built-in declarations; it does not generate declarations for your custom helper.

Keep the scaffold's module augmentation so `container.feature('taskCache')` returns your class type. For exported packages, include that augmentation in the declaration entry point consumers load. See [the type system](14-type-system.md) for augmentation details.

`describe --ts` is an approximate interface derived from metadata. Use the project's TypeScript checker for assignability, generics, and module resolution. Bun executes TypeScript but does not type-check it. In the framework checkout, run `bun run typecheck`; in a consumer project, use its configured TypeScript check. Evaluating a method in the VM only verifies runtime behavior.

## Verify the behavior separately

Run focused Bun tests for the behavior you changed, including errors and cleanup. [Testing a composed feature](../examples/testing-a-composed-feature.md) demonstrates fresh containers, spies, state, and events. For a compiled deliverable, follow [binary verification](30-shipping-a-binary.md) as well: source success does not prove bundled import resolution.
