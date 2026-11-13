# Agent DX: evaluate understanding through behavior

Assessment from the current checkout, September 4, 2026. This is a repository/API review plus executable reference and negative-control checks, not a new model-performance study.

## Biggest gaps, in priority order

1. **The evaluation loop cannot reliably distinguish completion from correctness.** `try-all-challenges` awaits `spawnAndCapture` but ignores its returned exit code, then marks the attempt `done`; its synthesis calls those attempts successful. The single-challenge runner also exits 0 from `onExit`. LESSONS.md existence is useful for retrospectives but says nothing about whether the application works. Both timeout races leave child termination unconnected to the deadline. Fix measurement before interpreting more rounds.

2. **Choosing the right abstraction is harder than finding a method.** The hardest recurring distinction is process-local state versus durable state versus a losable cache. The current `store` description explains this well, and runnable cross-process examples now exist. But a current `describe --query "share a counter between command invocations" --json` put containerLink, redis, socketRepl, and mcpBridge first in its helper results; a relevant cross-process example appeared in the example results. This is one query, not a ranking benchmark, but it illustrates the extra interpretation required. Evaluate whether an agent selects and successfully composes the right capability from a neutral task, rather than rewarding a high describe count.

3. **Familiar API shapes still require unusually precise contract knowledge.** Binary file encoding, process result handling, cwd-relative paths, and injected VM globals are places where plausible code can silently be wrong. The August API-gap report explicitly says its 16 issues shipped with fixes; do not reopen that historical list as current defects. Preserve those semantics with outcome checks. This implementation did expose a current type mismatch: `spawnAndCapture` accepted detached-process options at runtime but omitted them from the type, and `onStart` advertised the Luca helper instead of the real child-process handle. Those types are corrected with this harness.

4. **Runtime and extension boundaries remain under-measured.** Source imports, compiled VM modules, project-local helpers, generated introspection, and browser containers are different surfaces. Historical evaluations found local-client introspection and scaffold import failures. The project instructions also describe manual feature imports while the current build generates feature barrels. These are reasons to test the complete registration → discovery → execution path, not evidence that each historical bug still exists. The first suite covers VM context and failure propagation; registration, type augmentation, browser behavior, and binary packaging need additional tasks.

5. **The evidence does not yet support precise attribution or efficiency claims.** The July reports found large improvements after API fixes and recipes, but also a control-task slowdown, route variance, and confident false claims in LESSONS files. One attempt per cell cannot isolate framework, docs, model, or sampling effects. Record versions and instructions, repeat trials, and compare per task. Keep cost secondary to independently verified behavior.

## What was built

`bun run eval:agent-dx` provides a provider-neutral runner with five diagnostic tasks and 13 executable checks:

- Path semantics: absolute bases, relative bases, and parent traversal.
- Binary copying: arbitrary bytes, empty files, and destination directory creation.
- Process results: literal arguments, nonzero exits, and preserved stdout/stderr.
- Durable counters: initial state, cross-process persistence, and concurrent updates.
- Module loading: TypeScript plus injected container, missing-file diagnostics, and thrown transform errors.

The tasks give output contracts without prescribing the API being tested. Grading uses new processes and fresh fixtures after the runner exits. Known solutions establish that the framework supports the task. Plausible broken solutions establish that the grader catches the corresponding failure. An agent claiming success cannot override a failed check.

Each run preserves evidence and configuration, records per-task pass rates, and can fail a comparison when any task regresses. Reference and agent runs cannot be compared. Source checkout and instruction changes are recorded separately, enabling framework-only or docs-only experiments with a fixed suite and runner.

## How this complements try-challenge

Keep the existing challenges as the broad transfer tier. They exercise integration, product judgment, CLI discovery, and long-lived services that these small function tasks cannot capture. Add executable external acceptance commands to those challenges before calling their outputs successful. Promote reproducible failures from challenge traces into the diagnostic suite, then rerun the original challenge after the fix.

Use three layers: inexpensive framework contract tests on every change; repeated diagnostic agent tasks when APIs/docs change; selected end-to-end challenges before releases. Maintain held-out prompts so improvements generalize beyond examples copied from the instructions. Avoid collapsing all results into one score: a state-persistence failure matters even if four easier tasks got faster.

The initial reference run passes all 13 checks. No live agent baseline or measured DX improvement is claimed. Runner logs preserve whatever provider telemetry is emitted, but this version does not normalize tokens/tool calls, enforce implementation style, statistically establish improvements, or isolate hostile agents. Instructions and source remain accessible in the cooperative local evaluation environment.

The full unit run also caught a current store race: its cross-process increment test returned 42 instead of 45. Contenders treated empty/partial lock metadata, including a read racing with release, as proof of a dead owner and removed the lock. Recovery now requires a valid owner PID before deciding a lock is stale; unreadable metadata is retried until the deadline with an actionable diagnostic. Deterministic regressions cover empty, truncated, null, and disappearing metadata. Permanently malformed locks require inspection rather than unsafe automatic removal.

Run instructions and the adapter contract are in `scripts/agent-dx/README.md`. The next useful experiment is a fixed-model, repeated baseline followed by one focused discovery/recipe change and a paired rerun, with independent challenge verification as the transfer check.

Validation after the fixes: `bun run typecheck` passed; `bun run test` passed all 1,249 tests across 115 files; ten additional repetitions of the 17-test store suite passed; and the final reference run passed all 13 acceptance checks.
