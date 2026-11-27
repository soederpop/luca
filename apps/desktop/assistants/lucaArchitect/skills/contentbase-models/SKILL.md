---
name: contentbase-models
description: Author and edit contentbase model definitions (models.ts) and the markdown that satisfies them. Use this skill whenever the user wants to define, edit, or debug a contentbase models.ts file, add frontmatter/meta schemas, extract typed data from headings ("sections"), wire up relationships between documents (hasMany, belongsTo, epics/stories, parent/child), decide how a folder of markdown should be structured for a model, or asks why a model isn't matching documents or a relationship returns nothing. Also use it when scaffolding a new contentbase/cnotes collection or writing example documents for one.
---

# Authoring contentbase models

Contentbase turns a folder of markdown/MDX into a typed, queryable database. One file drives everything: `models.ts` at the collection root (default root is `./docs`). This skill covers writing that file correctly — especially relationships, where the model code and the markdown structure must agree exactly.

## Mental model

- A **Collection** loads every `.md`/`.mdx` under its `rootPath`. Each document's id ("pathId") is its path without extension: `epics/authentication`.
- A **model** claims documents by folder prefix (`prefix: "epics"` → `epics/**`). A document can also opt in with `_model: Epic` frontmatter, or a model can use a custom `match()` function.
- A **model instance** = `meta` (parsed frontmatter) + `sections` (typed data extracted from headings) + `relationships` (other documents) + `computed` (derived values).
- Content is the source of truth. There is no database — relationships are derived from document structure (headings, frontmatter keys, folder paths).

## File conventions

`models.ts` must use **named exports** — the loader scans top-level module exports for model-shaped values; a default-exported object is ignored:

```ts
// docs/models.ts
import { defineModel, section, hasMany, belongsTo, z, toString } from "contentbase";

export const Epic = defineModel("Epic", { /* ... */ });
export const Story = defineModel("Story", { /* ... */ });
```

Discovery (CLI and `Collection.load()`):
1. `<root>/index.ts` exporting a `Collection` instance wins if present.
2. Otherwise `<root>/models.{ts,js,mjs}` — every model-shaped named export is registered.
3. Otherwise each subfolder becomes a bare, schemaless model (with a warning).

Auto-discovery only fires when **zero** models were registered manually — mixing `collection.register(X)` with a `models.ts` means the file is never read. Import errors in `models.ts` are swallowed silently (you just get fallback models), so if models mysteriously vanish, `bun -e 'import("./docs/models.ts")'` to surface the real error.

## `defineModel(name, config)` reference

| Key | Purpose |
|-----|---------|
| `prefix` | Folder that documents live in. Default: pluralized lowercase name (`Epic` → `epics`). Matching is a raw string-prefix check — beware overlapping prefixes like `post` vs `posts`. |
| `meta` | Zod schema for frontmatter. Default `z.looseObject({})`. Add `.describe()` to every field — descriptions feed generated docs and AI tooling. |
| `sections` | `Record<string, section(...)>` — typed data extracted from headings (below). |
| `relationships` | `Record<string, hasMany(...) \| belongsTo(...)>` (below). |
| `computed` | `Record<string, (self) => any>` — derived values, e.g. `isComplete: (s) => s.meta.status === "complete"`. |
| `scopes` | Reusable query presets: `ready: (q) => q.where("meta.status", "ready")`. |
| `defaults` | Static frontmatter defaults, merged under pattern-inferred meta and actual frontmatter. |
| `pattern` | Express-style path pattern(s) like `"stories/:epic/:slug"` — infers meta fields from the file path. |
| `match` | `(doc: { id, meta }) => boolean` — replaces prefix matching entirely. |
| `exclude` | Globs/regexes to hide certain pathIds from the model. |
| `titleOptional` | Skip the "document must have an H1" validation rule. |
| `description` | Optional; auto-generated lazily from the schema if omitted. |

## Sections: headings as typed data

```ts
sections: {
  acceptanceCriteria: section("Acceptance Criteria", {
    extract: (query) => query.selectAll("listItem").map((n) => toString(n)),
    schema: z.array(z.string()).min(1),
    alternatives: ["Acceptance Criteria:", "AC"],   // fallback heading texts
  }),
}
```

- Heading match is **exact text** (case-insensitive, trimmed). "Acceptance Criteria:" does not match "Acceptance Criteria" — list variants in `alternatives`.
- `extract` receives an `AstQuery` scoped to the nodes *under* the heading (heading excluded). Useful methods: `selectAll("listItem" | "link" | "table" | "paragraph" | "code" | ...)`, `select`, `findBetween`, `headingsAtDepth`.
- A **missing heading does not throw** — `extract` runs against an empty query (`selectAll` → `[]`). Use `schema: z.array(...).min(1)` if a missing section should be a validation failure. `schema` is only checked by `instance.validate()`, not at read time.

Idiomatic extract patterns:

```ts
// bullet list → string[]
extract: (q) => q.selectAll("listItem").map((n) => toString(n))

// links → { label: url }
extract: (q) => Object.fromEntries(q.selectAll("link").map((l: any) => [toString(l), l.url]))

// GFM table → array of row objects (with list fallback) — see references/recipes.md
```

## Relationships

Only two kinds exist: `hasMany` and `belongsTo`. Both take a **thunk** target (`() => Story`) so circular references work. `hasMany` has two modes — heading-derived and foreignKey — and **which mode you get is decided by the options**: pass `heading` for heading mode; pass `foreignKey` (or nothing) for foreignKey mode. Always be explicit: `hasMany(() => Story, {})` silently becomes foreignKey mode with an FK guessed by stripping a trailing "s" from the parent's prefix.

### Recipe A: heading-derived `hasMany` (children defined inside the parent doc)

```ts
export const Epic = defineModel("Epic", {
  prefix: "epics",
  meta: z.object({ status: z.enum(["created", "in-progress", "complete"]).default("created") }),
  relationships: {
    stories: hasMany(() => Story, { heading: "Stories" }),
  },
});
```

Matching markdown — `docs/epics/authentication.mdx`:

```mdx
---
status: created
---

# Authentication

Covers users logging in and out of the application.

## Stories

### A User should be able to register.

As a User I would like to register so that I can use the application.

#### Acceptance Criteria

- A user can visit the signup form and supply name, email, password

### A User should be able to log in.

...
```

Rules the markdown must follow:
- The relationship heading (`## Stories`) is matched by exact text.
- Each child is a heading at **exactly parent depth + 1** (`### ...` under `##`). A `####` directly under `## Stories` yields zero children.
- Everything under a child heading (including deeper headings like `#### Acceptance Criteria`) becomes that child's document body, promoted so the child's model sections still match by heading *text* — depth doesn't matter to `section()`.
- Child id = `stories/<kebab(parent title)>/<kebab(child title)>`. If a real file with that id exists, the file wins; otherwise a synthetic in-memory document is built from the extracted nodes. This is why the same content works inline or split into files.
- `epic.relationships.stories.create()` materializes inline children into real files.

### Recipe B: `belongsTo` via frontmatter

```ts
export const Story = defineModel("Story", {
  prefix: "stories",
  meta: z.object({ epic: z.string(), status: z.string().default("created") }),
  relationships: {
    epic: belongsTo(() => Epic, { foreignKey: (doc) => doc.meta.epic as string }),
  },
});
```

Note `foreignKey` here is a **function** returning the target's id fragment — the lookup is `` `${Epic.prefix}/${value}` ``. Matching markdown — `docs/stories/authentication/a-user-should-be-able-to-register.mdx`:

```mdx
---
epic: authentication
status: created
---

# A User should be able to register.

## Acceptance Criteria

- A user can visit the signup form and supply name, email, password
```

`belongsTo` **throws** (`Could not find Epic with id "epics/..."`) when the target doesn't exist — it never returns undefined.

### Recipe C: foreignKey `hasMany` + path pattern (folder structure as the join)

No frontmatter needed — the folder name *is* the foreign key:

```ts
export const Epic = defineModel("Epic", {
  prefix: "epics",
  relationships: {
    stories: hasMany(() => Story, { foreignKey: "epic" }),  // string = frontmatter/pattern field name
  },
});

export const Story = defineModel("Story", {
  prefix: "stories",
  pattern: "stories/:epic/:slug",           // infers meta.epic from the folder
  meta: z.object({ epic: z.string(), slug: z.string() }),
});
```

`docs/stories/authentication/user-can-register.mdx` gets `meta.epic === "authentication"` from its path; `Epic("epics/authentication").relationships.stories` finds it by matching that against the epic's slug. Explicit frontmatter still overrides the pattern-inferred value.

### Recipe D: circular models need explicit type annotations

Mutual inference between two models that reference each other collapses to `never`. Annotate both:

```ts
import { defineModel, hasMany, belongsTo, z, type ModelDefinition } from "contentbase";

type EpicDef = ModelDefinition<"Epic", typeof epicMeta, {}, { stories: any }, {}>;
type StoryDef = ModelDefinition<"Story", typeof storyMeta, {}, { epic: any }, {}>;

export const Epic: EpicDef = defineModel("Epic", {
  relationships: { stories: hasMany(() => Story, { heading: "Stories" }) },
});
export const Story: StoryDef = defineModel("Story", {
  relationships: { epic: belongsTo(() => Epic, { foreignKey: (d) => d.meta.epic as string }) },
});
```

Also: never *call* into the other model inside `defineModel` config (thunks aren't resolvable yet) — only reference it inside `hasMany`/`belongsTo` thunks.

## Using the models

```ts
const collection = new Collection({ rootPath: "./docs" });
await collection.load();

const ready = await collection.query(Story).where("meta.status", "ready").fetchAll();
const epic = await collection.getModel("epics/authentication");
const stories = await epic.relationships.stories.fetchAll();  // also: first(), last(), create()

const result = await stories[0].validate();  // schema + section checks; H1 required unless titleOptional
```

Meta parse failures are **non-fatal at load** — the instance is built with raw frontmatter and errors only surface via `validate()`. Section values are cached per instance; after editing files, reload with `collection.load({ refresh: true })`.

## Going deeper

- `references/recipes.md` — advanced recipes: table extraction, `match()`/`_model:` for root-level docs, multi-pattern models, meta merge order, scopes/computed, `templates/` scaffolding, materializing inline children.
- `references/gotchas.md` — symptom → cause → fix list. **Read this before debugging** "relationship returns empty", "model not matching", or "models.ts seems ignored".
