# Gotchas: symptom → cause → fix

Debugging checklist for contentbase models. Scan the symptoms first.

## Relationships

**`hasMany` returns children you didn't expect (or from the wrong place)**
Cause: omitting `heading` silently switches `hasMany` into foreignKey mode, with the FK *guessed* by stripping a trailing "s" from the parent's prefix (`epics` → `epic`). Irregular plurals guess wrong.
Fix: always pass `heading:` or `foreignKey:` explicitly.

**Heading-derived `hasMany` returns `[]` even though the heading exists**
Cause 1: child headings are not at exactly parent depth + 1. `## Stories` requires `###` children; `####` directly under it yields nothing.
Cause 2: heading text doesn't match exactly (matching is exact-text, case-insensitive, trimmed — `## Stories:` ≠ "Stories").
Fix: correct the heading depths/text in the markdown.

**`belongsTo` throws `Could not find <Model> with id "..."`**
Cause: this is by design — `belongsTo` never returns undefined. The FK value doesn't resolve to an existing document under the target's prefix.
Fix: check the frontmatter value against the target file's pathId minus prefix (`epic: authentication` ↔ `epics/authentication.mdx`). Remember `foreignKey` is a *function* returning the id fragment, not a field name.

**foreignKey `hasMany` misses documents that have no frontmatter FK**
Cause: the FK falls back to pattern-inferred meta only if the child model declares a `pattern` covering that path.
Fix: add `pattern: "stories/:epic/:slug"` to the child model, or add the frontmatter field.

## Sections

**Section value is `[]` / `{}` and validation passes when it shouldn't**
Cause: a missing heading doesn't throw — `extract` runs against an empty query. Without a constraint, an empty result is schema-valid.
Fix: use `schema: z.array(...).min(1)` (or similar) so absence becomes a validation error.

**Section with `alternatives` works at read time but `validate()` flags it missing**
Cause: `validateDocument` checks only the primary heading for standalone/unmatched docs; alternatives are consulted only when the doc belongs to a collection with the model registered.
Fix: prefer normalizing headings in the content; treat `alternatives` as a read-time convenience.

**Stale section values after editing a file**
Cause: sections are lazily extracted and cached per model instance.
Fix: `await collection.load({ refresh: true })` (or fetch a fresh instance).

## Discovery & matching

**`models.ts` seems completely ignored**
Cause 1: auto-discovery only fires when zero models were registered — any manual `collection.register(X)` skips `models.ts`.
Cause 2: models are default-exported; only **named** top-level exports are scanned.
Cause 3: the import failed and the error was **silently swallowed** (`catch { continue }`), degrading to Base/folder-derived models.
Fix: use named exports, don't mix manual registration with auto-discovery, and debug import errors with `bun -e 'import("./docs/models.ts")'`.

**Documents match the wrong model**
Cause: prefix matching is a raw string-prefix check — `prefix: "post"` also claims `posts/**`. First matching model in declaration order wins.
Fix: avoid overlapping prefixes, or use `match()` / `exclude` / `_model:` frontmatter (which always wins).

**Root-level documents never match a custom model**
Cause: prefix matching requires a `/`; root docs fall through to `Base`.
Fix: `_model: MyModel` frontmatter, a `match()` function, or define your own `Base`.

**Files in `templates/` show up nowhere**
Cause: `templates/` is globally excluded from loading (it's for `cnotes create` scaffolding).

## TypeScript & runtime

**Circular Epic↔Story types collapse to `never`**
Cause: mutual inference between models that reference each other.
Fix: annotate both exports with explicit `ModelDefinition<...>` types (see Recipe D in SKILL.md). Never call into the other model inside the config object — only inside `hasMany`/`belongsTo` thunks.

**`parseTable` import fails**
Cause: `parseTable` is internal (`src/utils/parse-table`), not exported from the `contentbase` package.
Fix: inline the table walk (see recipes.md §1) or use `doc.nodes.tablesAsData` outside `extract`.

**`instance.meta` doesn't match the schema**
Cause: meta parse failures at construction are non-fatal — raw frontmatter is used so the instance still builds.
Fix: call `await instance.validate()` and check `errors` / `hasErrors`.

**`validate()` complains about a missing title**
Cause: an H1 is required unless `titleOptional: true` or `meta.title` is set.

**Imports in `models.ts` fail inside the compiled `cnotes` binary**
Cause: the compiled binary's module loader pre-seeds only `contentbase`, `zod`, `js-yaml`, and `mdast-util-to-string`.
Fix: keep `models.ts` imports to those four; anything else works under bun/node but not in the standalone binary.

**Zod v4 differences**
Contentbase re-exports zod v4: use the two-arg `z.record(z.string(), z.string())`, and `z.looseObject({})` (the default meta schema) instead of `.passthrough()`.

**Unknown scope name throws**
`query(Model).scope("nope")` throws rather than no-oping; scope functions must return the query they receive.
