# Luca Author-in-the-Loop Dataset Curation Workflow

This workflow is for curating a Luca-native training corpus with the framework author acting as the taste-maker.

The point is not to preserve raw transcripts.
The point is to distill examples that teach the model how to behave when asked to build or modify Luca systems.

## Curation Goal

Train behavior like:

1. Discover the runtime surface with `luca describe`.
2. Validate assumptions with `luca eval`.
3. Prefer `container.feature`, `container.client`, and `container.server` over ad hoc imports.
4. Put code in Luca convention folders.
5. Make small reviewable edits.
6. Verify with `bun test` when appropriate.
7. Incorporate user correction instead of defending a bad first guess.

Do not train the adapter to memorize static API docs.
Keep exact facts in runtime introspection and retrieval.

## Human Role

The author should be in the loop as the arbiter of:

- what counts as canonical Luca usage
- what is merely acceptable
- what is technically successful but philosophically off-policy
- which examples express the intended architecture and taste of the framework

The author should not spend time cleaning transcript noise by hand.
The machine should do that pre-processing first.

## Source Priority

### Tier 1: primary behavior corpus

- Claude sessions from `/Users/jonathansoeder/.claude/projects/-Users-jonathansoeder--agentic-loop`

Why:
- largest source of real Luca implementation behavior outside the framework itself
- many sessions show commands, workflows, features, assistants, runtime wiring, and cross-project usage

### Tier 2: framework-internal behavior corpus

- Claude sessions from `/Users/jonathansoeder/.claude/projects/-Users-jonathansoeder--soederpop-projects-luca`

Why:
- strongest source for framework-internal implementation style
- useful for helper design, command structure, tests, and low-level Luca conventions

### Tier 3: synthetic exemplars and reference material

Use these to author clean rewritten training examples and for retrieval:

- `README.md`
- `CLAUDE.md`
- `AGENTS.md`
- `docs/examples/`
- `docs/tutorials/`
- `docs/apis/`
- `test/`
- `test-integration/`
- scaffold examples and convention folders

## Recommended Dataset Buckets

Keep separate buckets instead of one mixed corpus.

### Bucket A: canonical-policy exemplars

Highest value.
These should teach the adapter the default Luca way to behave.

Requirements:
- clear task
- evidence of discovery or introspection when needed
- good placement in convention folders or explicit justification for where code goes
- small coherent implementation arc
- verification or a clear reason verification was not possible
- author label of `canonical`

### Bucket B: strong implementation examples

Good examples that may be more product-specific or less foundational.

Requirements:
- good engineering move
- broadly compatible with Luca taste
- maybe weaker on introspection or broader in scope

### Bucket C: planning and architecture examples

Useful for reasoning and project design.
Less useful as direct code imitation.

Examples:
- feature decomposition
- deciding whether something belongs in a feature, command, endpoint, assistant, or workflow
- migration planning

### Bucket D: rejects and anti-patterns

Do not train on these.
Keep only for analysis and for improving the ranking heuristics.

Examples:
- giant messy edits
- dependency-happy detours
- guessing instead of using runtime discovery
- code that works but violates the Luca story

## Machine + Human Workflow

### Phase 1: machine prefilter

Rank candidates using signals like:

Positive signals:
- `luca describe`
- `luca eval`
- `luca scaffold`
- `container.feature(`
- `container.client(`
- `container.server(`
- edits under `commands/`, `features/`, `endpoints/`, `clients/`, `servers/`
- `bun test`
- small changed-file set
- multi-turn refinement after correction

Negative signals:
- huge changed-file fan-out
- no discernible implementation outcome
- no Luca-specific behavior
- transcript dominated by noise or side quests
- environment-specific debugging with little policy value

Machine output should include:
- session id/path
- first instruction
- short extracted summary
- changed files
- detected commands
- detected helpers
- proposed task type
- proposed quality tier
- 3 to 8 key turns or snippets
- proposed keep/rewrite/reject recommendation

### Phase 2: author review

The author reviews a queue of candidates, not full raw transcripts by default.

Author inputs:
- canonicality
- policy value
- code taste
- verification quality
- keep/rewrite/reject
- notes about why

Escalate to full transcript reading only when the summary is ambiguous.

### Phase 3: exemplar rewrite

For all approved examples, rewrite the session into a clean training row.

Preferred shape:
- instruction
- minimal repo context
- concise Luca-style plan or approach
- implementation summary or code completion
- verification outcome
- optional note about why this is canonical

### Phase 4: final split

Recommended outputs:
- `datasets/lora/train-canonical.jsonl`
- `datasets/lora/train-broad.jsonl`
- `datasets/lora/val.jsonl`
- `datasets/lora/rejected.jsonl`
- `datasets/lora/reviews.jsonl`
- `datasets/lora/rag/` reference bundle

## Author Review Rubric

Each candidate should be judged on the following axes.

### 1. Canonicality

- `canonical`: should actively shape model behavior
- `acceptable`: good example, but not defining the philosophy
- `off-policy`: do not imitate this by default

### 2. Policy value

How much does the example teach Luca behavior?

- `high`
- `medium`
- `low`

### 3. Code taste

Would you want future Luca-generated code to look like this?

- `strong`
- `mixed`
- `weak`

### 4. Verification quality

- `strong`: tested or clearly validated
- `weak`: partial verification only
- `none`: no meaningful verification

### 5. Disposition

- `keep`
- `rewrite`
- `reject`

## Strong Positive Signals

These should push a candidate up the queue:

- starts with discovery when the runtime surface is unclear
- checks helpers with `luca describe`
- tests assumptions with `luca eval`
- uses container helpers rather than bypassing them
- chooses the right Luca abstraction level
- places code in the right convention folder
- makes a narrow coherent edit
- updates tests or validates behavior
- responds well to user correction

## Strong Negative Signals

These should push a candidate down or out:

- random external dependencies where Luca should own the capability
- bypassing container abstractions without good reason
- broad sweeping edits without a strong need
- guessing helper behavior instead of inspecting
- docs regurgitation with no applied behavior
- success that depends on product-specific hacks the framework should not generalize from

## Sampling Strategy

Do not review the corpus in chronological order.
Review by utility.

Recommended first pass:
1. top 20 candidates from Luca repo
2. top 30 to 50 candidates from @agentic-loop
3. 10 architecture/planning candidates
4. 10 likely rejects to calibrate the boundary

After that:
- refine the ranking heuristics
- review only the uncertain or highest-value candidates

## Review Unit

The review unit should be a compact packet, not a raw transcript dump.

A good review packet contains:
- session id
- repo source
- first instruction
- short machine summary
- commands run
- changed files
- relevant helpers
- policy signals
- verification signals
- snippet bundle with the most informative turns
- author label fields

## What gets trained vs retrieved

### Train

- decision policy
- preferred decomposition
- helper-first composition style
- placement and verification habits
- how to react to user correction

### Retrieve / introspect at runtime

- exact helper APIs
- full command options
- exhaustive docs
- version-specific details
- low-level framework reference trivia

## Practical Review Cadence

Recommended cadence:

Round 1:
- review 20 to 30 candidates together
- tighten rubric
- define what `canonical` really means

Round 2:
- review 50 to 100 ranked candidates
- focus on disagreements and high-value examples

Round 3:
- review rewritten exemplars, not raw sessions
- approve final training rows

## Success Criteria

A good curated corpus should cause the model to reliably:

- discover before guessing
- compose with Luca primitives
- place work in the right folders
- avoid unnecessary dependencies
- make smaller cleaner changes
- verify results
- sound like it understands Luca as a system, not as a memorized bag of APIs
