# Memory namespace rollout runbook

Run this once per agentic loop, on the loop's machine, after the luca binary there has the per-assistant namespace change.

## What changed

- Before: every assistant made by `assistantsManager.create()` was named `assistant`. Any assistant that used `memory` without an explicit `namespace` read and wrote `namespace = 'assistant'`. Assistants in one loop shared memories.
- After: an assistant is named after its folder. Its memory namespace is the folder name (`researcher`, `lucaExpert`, ...).
- Not affected: an assistant whose `tools.ts` passes an explicit `namespace` to `container.feature('memory', ...)`. In the agentic-loop plugin, `chiefOfStaff` does this (`namespace: "chiefOfStaff"`).
- Rows do not record which assistant wrote them. You choose who gets the old rows.

## What an un-migrated loop does

Nothing is lost and nothing is deleted. An affected assistant starts with an empty namespace and prints one line to stderr on its first memory use in each process:

```
[memory] Assistant "researcher" now has its own memory namespace, and 42 older memories are still under the shared "assistant" namespace ...
```

It also emits `legacyNamespaceFound` on its memory feature. The line stops after a `rename`, a `copy` to that assistant, or a `leave`.

## Rules

- Run every command from the loop's root folder. The database is chosen by the working directory.
- One loop, one database. Never point `--db-path` at another loop's file, and never merge two loops' databases.
- Every `memory-namespaces` action is a dry run until you add `--apply`.
- The command never deletes a row. `rename` moves rows. `copy` adds rows.

## Steps per loop

**1. Check the binary has the command.**

```bash
luca memory-namespaces --help
```

If luca does not know the command, update the binary first (`luca self-update`) and check again.

**2. Stop the loop.** Ask before you stop a running `luca main`. A process on the old code keeps writing to `assistant` while it runs.

**3. Go to the loop root and find the database.**

```bash
cd <loop root>
```

```bash
luca eval "container.feature('memory').dbPath"
```

**4. Look at the row counts.**

```bash
luca memory-namespaces
```

- "No memory database for this folder": this loop has no memory. Stop here.
- "No memories under "assistant"": nothing to migrate. Go to step 8.
- Otherwise the output lists each assistant folder and how many old rows it cannot see.

**5. Back up the database.** Use the path from step 3. Copy the `-wal` and `-shm` files too if they exist.

```bash
cp <dbPath> <dbPath>.before-namespaces
```

**6. Choose one mode and dry-run it.** Read the counts it prints.

Only one assistant in this loop used memory without its own namespace:

```bash
luca memory-namespaces rename <assistant>
```

Several did, and each should keep the shared history:

```bash
luca memory-namespaces copy <assistantA> <assistantB>
```

Several did, and the old rows should stay under `assistant` (the assistants start empty):

```bash
luca memory-namespaces leave
```

To find which assistants are affected, look in each `assistants/<name>/tools.ts` and `hooks.ts` for `feature('memory'` or a `use` export that names memory. An entry with no `namespace` is affected.

**7. Apply.** Repeat the same command with `--apply`.

```bash
luca memory-namespaces rename <assistant> --apply
```

**8. Check the result.**

```bash
luca memory-namespaces
```

- After `rename`: `assistant` shows 0 memories (or is gone) and the target shows the old count plus anything it wrote since the upgrade.
- After `copy`: `assistant` keeps its count and each target shows at least that count. Each named assistant reads "has a copy of every memory".
- After `leave`: counts are unchanged and each assistant reads "left under "assistant" on purpose".

Run the apply command a second time. It must report nothing to move or copy, and the counts must not change.

**9. Start the loop again** and watch the first assistant turn. There must be no `[memory] ... still under the shared "assistant" namespace` line for a migrated assistant.

## If something looks wrong

- Stop the loop, copy `<dbPath>.before-namespaces` back over `<dbPath>`, and remove any `-wal` and `-shm` files next to it.
- `rename` refuses to run into a namespace that already holds copies from `copy`. That is on purpose. It would duplicate rows.
- Old rows written after a `copy` (a process still on the old binary): run the same `copy ... --apply` again. It copies only the new rows.

## Details

- `copy` keeps embeddings, status, dates, and usage counts. `superseded_by` and `derived_from` in the copies point at the copied rows.
- The target's epoch becomes the higher of its own and the source's.
- Bookkeeping lives in two tables in the same database: `namespace_migration_rows` (which source row became which copy) and `namespace_migrations` (what was run, and the `leave` decision).
- `--from <namespace>` changes the source. `--json` prints the report as JSON.
- Runtime assistants created with `container.feature('assistant', { ... })` and no `name` or `folder` used to be `assistant` too. They are now named after the working directory's folder. The same warning and the same command apply.
