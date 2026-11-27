# Advanced recipes

Companion to the contentbase-models SKILL.md. Each recipe pairs `models.ts` code with the markdown it expects.

## Table of contents

1. [GFM table extraction](#1-gfm-table-extraction)
2. [Materializing inline children into files](#2-materializing-inline-children-into-files)
3. [Root-level docs: `match()` and `_model:`](#3-root-level-docs-match-and-_model)
4. [Multi-pattern models](#4-multi-pattern-models)
5. [Meta merge order: defaults < pattern < frontmatter](#5-meta-merge-order)
6. [Computed values and scopes](#6-computed-values-and-scopes)
7. [Templates for `cnotes create`](#7-templates-for-cnotes-create)

---

## 1. GFM table extraction

`parseTable` exists in the repo (`src/utils/parse-table`) but is **not a public export** of the `contentbase` package. From a consumer `models.ts`, walk the table inline (or use `doc.nodes.tablesAsData` outside of `extract`):

```ts
sections: {
  tracklist: section("Tracklist", {
    extract: (q) => {
      const tables = q.selectAll("table");
      if (tables.length > 0) {
        const [header, ...rows] = (tables[0] as any).children;
        const keys = header.children.map((c: any) => toString(c));
        return rows.map((row: any) =>
          Object.fromEntries(row.children.map((c: any, i: number) => [keys[i], toString(c)]))
        );
      }
      // fallback: plain bullet list
      return q.selectAll("listItem").map((n) => toString(n));
    },
    schema: z.union([
      z.array(z.record(z.string(), z.string())),
      z.array(z.string()),
    ]),
  }),
}
```

Matching markdown:

```mdx
## Tracklist

| # | Title            | Length |
|---|------------------|--------|
| 1 | Airbag           | 4:47   |
| 2 | Paranoid Android | 6:27   |
```

Produces `[{ "#": "1", Title: "Airbag", Length: "4:47" }, ...]`. If the author used a bullet list instead, you get `string[]` — the union schema accepts both.

## 2. Materializing inline children into files

Heading-derived `hasMany` children start as synthetic in-memory documents. `create()` writes each child to disk at its derived id, with the `meta` option seeding frontmatter:

```ts
relationships: {
  stories: hasMany(() => Story, {
    heading: "Stories",
    meta: (self) => ({ epic: self.slug, status: "created" }),  // frontmatter for created files
    id: (slug) => `stories/custom/${slug}`,                    // optional: override derived ids
  }),
}
```

```ts
const epic = await collection.getModel("epics/authentication");
await epic.relationships.stories.create();
// writes docs/stories/authentication/<child-slug>.mdx for each ### heading under ## Stories
```

Once the files exist, the same relationship resolves to the real files (file wins over synthetic). This is the intended workflow: draft children inline in the parent, then split them out when they mature.

## 3. Root-level docs: `match()` and `_model:`

Prefix matching only applies to documents in subfolders; root-level docs (no `/` in the pathId) fall through to `Base`. Two escape hatches:

**Frontmatter opt-in** (per-document, wins over everything):

```mdx
---
_model: Decision
---
# Use bun for the runtime
```

**`match()` function** (per-model, replaces prefix matching):

```ts
export const Decision = defineModel("Decision", {
  match: (doc) => doc.id.startsWith("decisions/") || doc.meta.kind === "decision",
});
```

You can also replace `Base` itself: `export const Base = defineModel("Base", { meta: ... })` gives every unmatched root-level doc a schema.

## 4. Multi-pattern models

`pattern` accepts an array; the first pattern that matches supplies the inferred meta:

```ts
export const Tutorial = defineModel("Tutorial", {
  prefix: "tutorials",
  pattern: ["tutorials/:slug", "tutorials/:category/:slug"],
  meta: z.object({
    slug: z.string(),
    category: z.string().default("general"),
  }),
});
```

- `tutorials/intro.md` → `{ slug: "intro", category: "general" }` (default fills the gap)
- `tutorials/advanced/hooks.md` → `{ slug: "hooks", category: "advanced" }`

## 5. Meta merge order

Instance meta is assembled as, lowest to highest priority:

1. Zod schema defaults (`.default(...)`)
2. `defaults` on the model definition
3. Pattern-inferred fields from `pattern`
4. Actual document frontmatter

Then the merged object is run through `meta.parse()`. If parsing throws, the **raw merged meta is used anyway** — the instance still constructs, and the error surfaces only through `await instance.validate()`. Don't rely on `instance.meta` being schema-conformant unless you've validated.

## 6. Computed values and scopes

```ts
export const Story = defineModel("Story", {
  // ...
  computed: {
    isComplete: (self: any) => self.meta.status === "complete",
    criteriaCount: (self: any) => self.sections.acceptanceCriteria?.length ?? 0,
  },
  scopes: {
    ready: (q: any) => q.where("meta.status", "ready"),
    forEpic: (q: any, slug: string) => q.where("meta.epic", slug),
  },
});
```

- `computed` values appear on instances (`story.computed.isComplete`) and in `toJSON({ computed: true })`.
- Scopes are query presets: `collection.query(Story).scope("ready")`. A scope receives the query and **must return it**; unknown scope names throw.

## 7. Templates for `cnotes create`

`templates/` at the collection root is globally excluded from loading. A file named `templates/<model-prefix-singular>.md` (e.g. `templates/story.md`) scaffolds new documents:

```mdx
---
status: created
---

# {{title}}

## Acceptance Criteria

-
```

`cnotes create story "User can log out" --meta.epic=authentication` merges frontmatter with priority: zod defaults < model `defaults` < template frontmatter < `--meta.*` flags.
