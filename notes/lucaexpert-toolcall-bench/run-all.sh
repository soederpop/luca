#!/bin/bash
# Runs bench.ts for one assistant version over all three prompts, each in a
# fresh copy of the bootstrapped scratch project. Usage: run-all.sh old|new
set -u
V=$1
S=/private/tmp/claude-501/-Users-jonathansoeder--soederpop-projects-luca/e4f63052-23b4-4681-9103-60a056c19a96/scratchpad
REPO=/Users/jonathansoeder/@soederpop/projects/luca
for P in todoScout untested httpCache; do
  RUN=$S/runs/$V-$P
  rm -rf "$RUN"; cp -R $S/scratch-project "$RUN"
  # lucaExpert looks for its always-loaded luca-framework skill in <cwd>/skills.
  mkdir -p "$RUN/skills" && ln -s "$RUN/.claude/skills/luca-framework" "$RUN/skills/luca-framework"
  echo "=== $V $P ==="
  ( cd "$RUN" && BENCH_FOLDER=$S/$V-lucaExpert BENCH_PROMPT=$P BENCH_OUT=$S/results/$V-$P.json \
      bun run $REPO/src/cli/cli.ts run $REPO/notes/lucaexpert-toolcall-bench/bench.ts ) > $S/results/$V-$P.log 2>&1
  echo "exit $?"
done
