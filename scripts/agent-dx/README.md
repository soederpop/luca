# Agent DX evaluation

Outcome-graded diagnostic tasks complement the larger `try-challenge` projects. No model or API credentials are needed to validate the harness:

```sh
bun run eval:agent-dx list
bun run eval:agent-dx reference /tmp/luca-dx-reference
bun test test/agent-dx-harness.test.ts
```

Reference mode runs known solutions through the real framework and all 13 acceptance checks. It is **not an agent baseline**. Tests also run deliberately wrong solutions to ensure the graders discriminate.

## Run your agent

Create a JSON configuration. `runner` is an argv array for your noninteractive coding-agent executable or adapter. It runs in the fresh workspace, must finish within the deadline, and must write `solution.ts`. `{prompt}` and `{workspace}` are substituted literally within arguments, without a shell. Configure the runner's model and tool permissions as you normally would for unattended local coding tasks.

Use absolute paths for adapter scripts: the runner's working directory changes for every attempt.

```json
{
  "label": "baseline",
  "model": "your-pinned-model-id",
  "runner": ["your-agent", "--model", "your-pinned-model-id", "--prompt", "{prompt}"],
  "trials": 3,
  "timeoutMs": 180000
}
```

```sh
bun run eval:agent-dx run baseline.json /tmp/luca-dx-baseline
# Change the framework OR the instructions; keep the runner/model/budget fixed.
bun run eval:agent-dx run candidate.json /tmp/luca-dx-candidate
bun run eval:agent-dx compare /tmp/luca-dx-baseline/report.json /tmp/luca-dx-candidate/report.json
```

Optional `tasks` selects task IDs. Optional `contextDir` supplies replacement `AGENTS.md` and `SKILL.md`; both must exist. Default instruction text comes from `docs/bootstrap/CLAUDE.md` and `docs/bootstrap/SKILL.md`, with generated bootstrap examples, tutorials, and references. The complete instruction bundle is saved as `context.json` and hashed. Use `contextDir` to compare instruction variants. Update generated bootstrap references before evaluating changes to those examples.

The workspace contains `luca.ts`, which invokes this checkout's source CLI. Use `bun luca.ts describe ...` and `bun luca.ts eval ...`, as the task prompt instructs. This suite evaluates the **source Node/VM surface**, not an installed binary, npm consumer, browser, or full bootstrap workflow. Run the existing end-to-end challenges for those surfaces.

Use an output directory outside the checkout for agent runs so ancestor project instructions do not leak into the task. The default is a unique `/tmp/luca-agent-dx-*` directory. Output folders must be new; results are retained until you delete them. POSIX process groups are required. Runners and descendants remaining in the group are killed on exit, timeout, or interruption; deliberately detached grandchildren are outside that guarantee.

## What gets measured

- Every task must pass every behavioral check. Nonzero runner exits, launch failures, timeouts, and absent submissions cannot pass.
- Each function invocation uses a new process and evaluator-created fixtures in a fresh grading directory. Only `solution.ts` is copied from the agent workspace. The counter check exercises concurrent independent processes.
- Reports retain each check's diagnostic, runner stdout/stderr and duration, submission, prompt, instruction snapshot, Git revision/dirty flag/diff, Bun version, suite fingerprint, configuration, and per-task pass rates. Raw provider JSON traces are preserved when the runner emits them.
- Comparison requires matching suite fingerprint, model label, runner argv, Bun version, time budget, task set, and trial counts. Framework revision and instruction hash may differ. Incomplete runs are rejected. Any per-task pass-rate drop exits 1; incompatible configuration exits 2. A run exits 1 if any attempt fails.
- Successful-attempt median duration is descriptive, not a speed gate. It excludes failed attempts and includes only runner time, not grading. Reference runs have no agent-duration metric.

Three trials are an inexpensive starting point, not statistical confidence. Use at least five for decisions, alternate baseline/candidate execution order across batches, inspect failures, and rerun apparent regressions. A faster agent that verifies less may be worse: assess correctness first. Model labels are declared metadata; pin the actual runner model/version/settings yourself. Start from clean committed checkouts for reproducible comparisons; a dirty diff does not snapshot untracked framework files or the environment.

## Add coverage

Add a task with a neutral prompt and reference implementation in `suite.ts`, then add independent behavioral checks in `grade.ts` and a plausible failing implementation to the harness tests. Changing the suite/grader fingerprint requires a new baseline. Keep expected values and fixtures out of the prompt. Include failure and boundary inputs, not just the example an agent could hardcode.

These are cooperative local coding evaluations, not a security sandbox: an agent can access the repository and grader if it violates the prompt. Container-use instructions are not statically enforced. No LLM judge, token-cost estimate, or tool-use classification is fabricated. Add provider trace adapters before claiming discovery efficiency, API-guess counts, or token savings. Keep agent LESSONS files as hypotheses requiring reproduction.

Next coverage priorities: intent-search ranking, project-helper registration and introspection, command/schema errors, server lifecycle and port conflicts, browser state subscriptions, compiled-binary import parity, and larger held-out transfer tasks. See the assessment in `docs/reports/agent-dx-evaluation-2026-09.md`.
