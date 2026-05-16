# Luca LoRA Dataset Curation Starter

This is a first-pass curation plan for training a Luca-native adapter that learns decision policy rather than memorizing docs.

## Goal

Train for behavior like:

1. Discover helpers with `luca describe`.
2. Validate assumptions with `luca eval`.
3. Prefer `container.feature`, `container.client`, and `container.server` over ad hoc imports.
4. Make small edits in Luca convention folders.
5. Verify with `bun test` / `bun run test`.
6. Incorporate user corrections and refine the implementation.

Exact API details should stay in RAG / runtime introspection, not be baked into the adapter as static trivia.

## What we have in this repo

Repo sources worth indexing:

- `README.md`
- `CLAUDE.md`
- `AGENTS.md`
- `docs/apis/` (75 markdown files)
- `docs/examples/` (45 markdown files)
- `docs/tutorials/` (21 markdown files)
- `test/` (22 TypeScript tests)
- `test-integration/` (13 TypeScript tests)
- `src/commands/` (17 TypeScript files)

Claude session corpus discovered for this repo:

- session root: `/Users/jonathansoeder/.claude/projects/-Users-jonathansoeder--soederpop-projects-luca`
- main sessions: 29
- subagent sessions: 46

Starter extraction artifacts:

- `/Users/jonathansoeder/@soederpop/projects/luca/datasets/lora/luca-session-curation-summary.json`
- `/Users/jonathansoeder/@soederpop/projects/luca/datasets/lora/luca-session-candidates.jsonl`
- generator: `/Users/jonathansoeder/@soederpop/projects/luca/scripts/curate-claude-sessions.ts`

## Recommended split

Use for LoRA / SFT:

- gold sessions with task -> inspect -> edit -> verify
- silver sessions with strong Luca-native investigation traces
- rewritten traces derived from tests/examples when they clearly encode framework policy

Use for RAG instead:

- `docs/apis/`
- `docs/examples/`
- `docs/tutorials/`
- `README.md`
- `CLAUDE.md`
- `AGENTS.md`

## First-pass session schema

Each candidate row should normalize to something like:

```json
{
  "instruction": "Add an option on conversation to limit input context length.",
  "repo": "luca",
  "task_type": "feature-add",
  "context": {
    "repo_rules": [
      "discover helpers with luca describe",
      "validate with luca eval",
      "test with bun"
    ]
  },
  "relevant_helpers": ["conversation", "describe", "eval"],
  "policy_trace": [
    "inspect existing helper surface",
    "edit the minimal files",
    "run targeted tests"
  ],
  "changed_files": ["src/agi/features/conversation.ts"],
  "commands_run": ["luca describe", "luca eval", "bun test"],
  "tests_run": ["bun test test/conversation.test.ts"],
  "final_outcome": "implemented and verified",
  "quality_tier": "gold"
}
```

## Current heuristics in the extractor

Task labels:

- `architecture`
- `bugfix`
- `feature-add`
- `refactor`
- `docs`
- `test-fix`
- `investigation`

Quality labels:

- `gold`: edits + verification, or architecture analysis with explicit Luca introspection
- `silver`: edits or strong introspection, but weaker verification
- `bronze`: mostly exploratory/noisy

Policy signals detected:

- `luca describe`
- `luca eval`
- `bun test`
- changed repo files
- user correction / multi-turn iteration potential

## Initial seed set to hand-review first

Good early candidates from `luca-session-candidates.jsonl`:

- `5af16d01-e33a-444b-8ac2-6e008d06bee6` — local MCP bridge feature add with tests
- `0ec93154-d4ee-4103-84bd-ce8542a758a9` — cost tracking in conversation state with tests
- `348947be-8dcb-4698-9728-bb0ac3ce64fd` — conversation history cost tracking with tests
- `460fb007-c6e6-4111-82d7-23d17efda66b` — context-length limit option with tests
- `d456a62d-62eb-44a4-a758-3496ce94cca0` — file-tools safety option with tests
- `72989399-403e-4993-862a-7db29160e38e` — helper cache / running instances with `luca describe`, `luca eval`, and tests
- `16709ae6-a9ee-4664-a6b2-e94b70f63836` — Python env detection bugfix with explicit root cause and test intent
- `54df6a90-7a84-4305-b98c-c68cc868eb0c` — Cloudflare Worker architecture exploration with Luca-native introspection

## Known limitations of the first pass

- changed-file detection is heuristic and still over-captures in some long sessions
- the extractor does not yet strip hidden reasoning / signatures at field level
- subagent sessions are counted but not yet separately normalized
- examples/tests/docs are inventoried but not yet converted into synthetic instruction traces
- the direct `luca-framework` skill file was not present at the expected path, so current guidance came from repo docs plus the `luca-project-inspection` skill reference on Claude session curation

## Immediate next pass

1. Add a cleaner that removes thinking/signature/tool boilerplate from Claude JSONL.
2. Emit one JSONL for session metadata and one JSONL for trainable rewritten traces.
3. Add a `manual_review` field and curate the first 25 gold/silver sessions by hand.
4. Generate synthetic task-oriented examples from `docs/examples/` and `test/`.
5. Split final corpus into:
   - `train.jsonl`
   - `val.jsonl`
   - `rag/` source bundle

## Regenerate the starter artifacts

```sh
bun run scripts/curate-claude-sessions.ts /Users/jonathansoeder/@soederpop/projects/luca
```
