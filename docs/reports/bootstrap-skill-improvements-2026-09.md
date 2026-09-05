# Bootstrap skill: task-driven onboarding and CLI discovery

The entry files now teach the execution environment, core contracts, and a task-driven discovery loop. Detailed conventions live in a refreshable reference; the generated helper catalog remains available on demand. No new helper scaffolding is required merely to try an existing capability.

## Instruction cost

Measured with the installed `js-tiktoken` package and `o200k_base`:

- CLAUDE.md: 4,137 → 629 tokens.
- SKILL.md: 8,921 → 2,135 tokens.
- Combined entry cost: 13,058 → 2,764 tokens, a 78.8% reduction.

This measures instruction text only. It is not a claim about total model cost, completion time, or success rate. References are loaded when a task needs them.

## Content and packaging

Removed the obsolete watcher delay, the worker/cache contradiction, the blanket explicit-exit recipe, the scratch-directory isolation claim, the Node import contradiction, and unsupported type-accuracy percentages. Added task routes for selectors, metadata lint, shipped declarations, script entry points, selected markdown execution, assistants, prompts, MCP, and packaging.

Four tutorials cover metadata/types, process lifecycle, selectors, and shipping binaries. The browser tutorial now documents shipped React hooks alongside the no-build custom-event example. The daemon example uses the shared shutdown lifecycle.

The build embeds authored references from `docs/bootstrap/references/`. The primary skill no longer gets a generated catalog injected into it. Project instructions are deliberately short and retained on skill refresh; older verbose templates need their framework recipes migrated to the maintained skill pointer while retaining project-specific instructions.

## Search behavior

The search catalog includes registered CLI help, its schemas/flags/arguments/examples, and focused subcommand examples without executing handlers. It also indexes authored references. Helper pointers use qualified registry names so ambiguous names such as websocket remain actionable.

A common ranking reserves room for helper and command entry points without comparing scores from independently filtered RRF searches. Partially stale embeddings fall back to the complete keyword catalog until refreshed. Keyword invalidation includes sections and navigation metadata as well as body text.

Regression checks exercise packaging, selectors, declarations, and introspection queries with a three-result budget. Other checks prove that subcommand-only examples are searchable, changed/removed command metadata is refreshed, partial embeddings do not hide new commands, section-only and navigation-only edits are refreshed, and results are deduplicated and bounded. These are executable retrieval checks, not a model-performance benchmark.

## Validation and limits

- Skill frontmatter/naming validator passes.
- Bundle tests check source/content parity and resolve onboarding links against the files actually shipped.
- A fresh bootstrap successfully ran the selector tutorial and generated helper introspection. Refresh installed the current skill/references/tutorials while preserving a project-specific instruction appended to CLAUDE.md.
- The existing agent-DX reference suite passed all six tasks and 17 independent behavioral checks. Reference runs are not agent trials.
- The updated daemon example executes successfully through `luca run`.
- An intermittent embedding-client fixture failure exposed an unverified readiness assumption. The fixture now establishes HTTP readiness with a bounded check before testing server reuse, binds the probed loopback address explicitly, and closes health connections.
- TypeScript passes; the full Bun suite passes all 1,268 tests across 118 files in an isolated checkout containing this change. Unrelated tasks are concurrently editing the shared worktree, so their in-progress changes are excluded from this verification.

A live-model A/B study has not been run. Use the existing `scripts/agent-dx` runner with fixed model/argv/budget, at least five trials per task, preserved instruction bundles, and independent outcome grading before claiming better agent success or lower total cost. Compare the same framework revision for an instructions-only experiment; command-search changes should be evaluated separately as a framework change. Add held-out packaging, browser, and service tasks for transfer beyond the diagnostic suite.
