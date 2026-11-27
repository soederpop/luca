# lucaExpert tool-call bench

Measures whether commit `3270838` ("lucaExpert: gather context through the
container, not the shell") cut lucaExpert's shell lookups. Nothing here ships.

## Method

- `bench.ts` creates a lucaExpert instance from an assistant folder with
  `container.feature('assistant', { folder, cached: false, maxToolTurns: 40 })`,
  asks one of three prompts, records every `toolCall` event and the files the run
  left behind, and writes a JSON report. Env: `BENCH_FOLDER`, `BENCH_PROMPT`
  (`todoScout` | `untested` | `httpCache`), `BENCH_OUT`.
- `run-all.sh old|new` runs the three prompts for one version, each in a fresh
  copy of a `luca bootstrap --no-setup` project. The assistant folders are
  `git archive 0fe5d45` and `git archive 3270838` of
  `apps/desktop/assistants/lucaExpert` (since renamed to `lucaArchitect` in the working tree). `summarize.ts` prints the table.
- Provider: the machine default, `deepseek-v4-local`
  (`deepseek-v4-flash-vision-exp` on spark-f941), for both versions.
- Neither `luca try-challenge` nor `scripts/agent-dx` fit: both drive Claude
  Code, not a Luca assistant.

## Gotcha found on the way

`skills/building-assistants/SKILL.md` at `3270838` has an unquoted colon in
its `description:` frontmatter. `js-yaml` rejects it, `skillsLibrary.scanLocation`
swallows the error, and the skill is silently missing: the library warns
"`only` pattern matches no known skill: building-assistants". The `new-fixed`
variant in the results quotes the description and nothing else.
