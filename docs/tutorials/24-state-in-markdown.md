---
title: "Modeling State in Markdown: Frontmatter vs. Body"
tags:
  - contentbase
  - contentdb
  - markdown
  - models
  - state
  - design
  - frontmatter
  - sections
---
# Modeling State in Markdown: Frontmatter vs. Body

[Tutorial 11](./11-contentbase.md) shows the mechanics of contentbase — `defineModel`, `meta`, `sections`, querying. This tutorial is about the *judgment call* that decides whether your markdown stays worth writing: **which state goes in the frontmatter, and which goes in the body.**

There's a trap. Once you learn that frontmatter is validated and queryable, it's tempting to treat it as *the database* and the prose as leftover comments — so an `overview` becomes a 12-line YAML string, `success_criteria` becomes a nested YAML array, and soon opening the file greets you with forty lines of `key: value` before the first sentence. At that point you've built a worse database *and* thrown away the one thing markdown was for: a document a human wants to read and edit.

The point of contentbase is the opposite. **The prose is the state. Frontmatter is just the index card taped to the front.**

## The two-drawer rule

Every piece of state you store goes in one of two drawers. Sorting them correctly is the whole skill.

**Frontmatter — the index card.** Only what the *system* filters, sorts, or joins on:
- Lifecycle status (`status: approved`)
- Tags and categorical labels
- Foreign-key slugs (`goal: user-experience`)
- Timestamps and machine-written scalars (`lastRanAt`, `costUsd`, `completedAt`)
- Small boolean flags (`running: true`)

These are **scalars and short arrays** — labels, not content.

**Body — the substance.** Anything a human writes in sentences, lists, or code: the overview, the reasoning, the criteria, the findings, the plan. This is the actual work product.

The litmus test: **would you write this in a sentence? → body. Is it a label the system filters on? → frontmatter.** If you're reaching for `|` (YAML multi-line) or nesting objects three deep, you're putting body content in the frontmatter drawer.

## Sections are fields, not comments

The reason you *can* keep substance in the body without losing queryability: a `section()` makes a heading's prose a **typed, validated, cached field.**

```ts
// docs/models.ts
import { defineModel, section, z } from 'contentbase'
import { toString } from 'mdast-util-to-string'

export const Goal = defineModel('Goal', {
  prefix: 'goals',
  meta: z.object({
    horizon: z.enum(['short', 'medium', 'long']).default('medium')
      .describe('short <3mo, medium 3–6mo, long >6mo'),
  }),
  sections: {
    successCriteria: section('Success Criteria', {
      extract: (q) => q.selectAll('*').map((n) => toString(n)).join('\n'),
      schema: z.string().min(1).describe('What success looks like'),
    }),
    motivation: section('Motivation', {
      extract: (q) => q.selectAll('*').map((n) => toString(n)).join('\n'),
      schema: z.string().min(1).describe('Why this goal matters'),
    }),
  },
})
```

That `Goal` has exactly **one** frontmatter field (`horizon` — a label you'd filter on). "Success Criteria" and "Motivation" are the content, and they're still first-class: `goal.sections.motivation` returns the validated prose, `goal.validate()` fails if the section is empty (`z.string().min(1)`), and you never had to cram a paragraph into YAML. The file reads like a goal document a person wrote — because it is one.

## The payoff frontmatter can't match: prose that's also structured

Here's what makes sections better than "just parse the frontmatter" — a section can be *read by a human as prose and by the machine as structured data at the same time.*

The agentic-loop's `Project` model has a section called **Execution** that authors write as an ordinary bulleted list of links to plans:

```markdown
## Execution

- [Connect and poll](plans/drive-connect)
- [Detect change](plans/change-detection), [Dedupe events](plans/dedupe)
- [Operator inspection](plans/inspect)
```

A `computed` property turns that readable list into a dependency graph — each list item is a step, commas within an item mean "run in parallel":

```ts
computed: {
  executionOrder: (self) =>
    self.document.querySection('Execution')
      .selectAll('listItem')
      .map((item) => new AstQuery({ type: 'root', children: [item] })
        .selectAll('link').map((l) => l.url))
      .filter((group) => group.length > 0),
},
```

The human edits a to-do list; the machine reads a parallel/sequential DAG. Encode that same information in frontmatter and you'd have an unreadable nested YAML array that no one wants to maintain — and you'd *still* have to write prose explaining it. The section gives you both, with one source of truth.

The same trick powers scheduled work: the agentic-loop's `Play` and `Task` models extract a run-condition from `code[lang=ts]` blocks under a **Conditions** heading — executable logic living in the body, not a frontmatter string.

## What it looks like in practice

A real, completed project document from the agentic-loop:

```markdown
---
status: completed
goal: user-experience-improvements
---

# Shared File Service

## Overview

Build a new core service that watches shared file systems for changes and
turns those changes into structured events the Agentic Loop can react to.
...

## Success Criteria

- The loop can watch one or more configured Google Drive folders...
...

## Motivation

Important work often shows up in shared folders before it shows up in chat...
```

Two lines of frontmatter — a lifecycle `status` and a `goal` foreign key. Everything of substance is prose under headings. This is a document a person wrote and can read. It is *also* a queryable record with a status the pipeline routes on and a relationship to a goal. Both, with no tax on either.

## Reading and writing state that lives in the body

Because state is split across two drawers, you read from each the way it's meant to be read.

**Query on the cheap, indexed drawer:**

```ts
const db = container.feature('contentDb', { rootPath: './docs' })
await db.load()

// filter/sort/join happen on frontmatter — fast, no body parsing
const ready = await db.query(Project).where('meta.status', 'approved').fetchAll()
```

**Pull only the section you need** (don't load a whole 500-line doc to read one heading) — the `contentDb` feature reads by heading:

```ts
// just the Findings section, skip the rest
const findings = await db.getDocument('reports/q3-research', { include: ['Findings'] })
```

**Write to the body, save the document.** Editing a section is first-class; persistence is per-*document* (the file is the atomic unit — there's no section-level save):

```ts
const report = await db.query(Report).find('q3-research')

// replaceSectionContent is immutable by default → returns a new Document.
// (pass { mutate: true } to edit in place instead.)
const updated = report.document
  .replaceSectionContent('Findings', '- Source A confirms X\n- Source B contradicts Y')

await updated.save()   // rewrites frontmatter + body together, atomically
```

Related section writers: `appendToSection(heading, md)`, `removeSection(heading)`, `insertAfter(node, md)`. A tiny wrapper covers the common edit-and-persist case:

```ts
async function updateSection(doc, heading, md) {
  const next = doc.replaceSectionContent(heading, md)
  await next.save()
  return next
}
```

This is exactly how the agentic-loop's pipeline runs: **cheap `status` flips in frontmatter route the work** (`spark → exploring → ready → promoted`), while **agents accrete substance into the body sections** (research into "Findings", conclusions into "Synthesis"). The index card moves an item through the workflow; the prose is where the value accumulates.

## When frontmatter *is* the right drawer

Don't over-correct into "everything is prose." Some state genuinely belongs on the index card, and forcing it into the body is just as wrong:

- **Lifecycle / status enums** — the pipeline filters on these constantly; they must be a fast, indexed scalar.
- **Tags and foreign-key slugs** — labels and joins, not sentences.
- **Machine-written bookkeeping** — `lastRanAt`, `costUsd`, `turns`, `completedAt`, `running`. An agent stamps a timestamp, not a paragraph. These are the clearest frontmatter citizens: no human writes them, no human reads them as prose.
- **Small flags** that gate behavior (`repeatable`, `running`).

The rule isn't "no frontmatter." It's **labels up top, substance in the body.**

## Anti-patterns — the "defeats the purpose" list

You've put state in the wrong drawer when you see:

- **Multi-line prose as a YAML string** (`overview: |` followed by three paragraphs). That's a section wearing a frontmatter costume — and it's unreadable, awkward to diff, and fragile around special characters.
- **Nested YAML objects that are really sections** (`scope: { in: [...], out: [...] }`). Write "## Scope" with "### In / ### Out" and extract it.
- **Duplicating a heading's content into frontmatter "so it's easy to parse."** It's already parseable — that's what `section()` is for — and now you have two copies that drift.
- **The H1 below the fold.** If opening the file shows thirty lines of `key: value` before any prose, you built a worse database and discarded the readability you chose markdown for.

Every one of these trades away the thing that made markdown the right choice. Keep the frontmatter to the index card, let the document be a document, and you get the database for free.

## What's Next

- [Contentbase — Markdown as a Database](./11-contentbase.md) — the model/query/section API this builds on
- [Semantic search over a content collection](../examples/semantic-search-content-db.md) — searching the body, not just the labels
- `luca describe contentDb` — the feature's read/query/section tools
