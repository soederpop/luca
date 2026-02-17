# Evaluating AGENTS.md: Context Files Don't Help Much

Based on the paper [Evaluating AGENTS.md: Context Files for Coding Agents](https://arxiv.org/html/2602.11988v1) (Feb 2026). They built AGENTbench (138 tasks, 12 Python repos) and tested Claude Code, Codex, and Qwen Code with and without context files.

## What the Paper Proves

### The Numbers

- LLM-generated context files **decreased** success rates by ~3%
- Human-written context files improved success by only ~4%
- All context files increased inference costs by **20%+**
- Reasoning token usage increased 10-22% from following context file instructions
- Agents reliably **follow** instructions in context files — they just don't solve problems better because of them

### Why Context Files Fail

- They **duplicate information already in the codebase** (README, docstrings, type signatures, test files)
- When documentation was *removed* from repos, LLM-generated context files improved performance by 2.7% — confirming they're just restating what's already discoverable
- Agents don't find relevant files faster with context files
- More context = more tokens = more cost, not more success

### What Actually Helps

- **Specific tooling instructions** (e.g., "run tests with `bun test`", "use this linter config")
- **Minimal requirements** — constraints and gotchas, not architecture overviews
- Agents are better off discovering the codebase themselves than reading a summary of it

## What This Validates in Luca

### Runtime Introspection > Static Documentation

This is the strongest external validation of Luca's core design choice. The entire container/helper system is built around self-description:

- `container.features.available` — discover what exists
- `container.features.describeAll()` — get documentation at runtime
- `helper.introspect()` / `helper.introspectAsText()` — structured metadata from Zod schemas and docblocks
- Every endpoint, command, feature is introspectable without reading any docs

The paper proves that writing prose *about* a system is less useful than making the system *explain itself*. Luca's architecture bets on the latter.

### Typed Interfaces as Self-Documentation

Luca's type system — Zod-based schemas for state, events, and options — serves as discoverable documentation. An agent can inspect `HelperOptions`, `HelperState`, `HelperEvents` schemas directly rather than reading a prose description. The paper's finding that context files merely duplicate existing information reinforces this: if your types and schemas are good enough, the agent doesn't need a separate document explaining them.

## Implications for Our Work

### 1. Keep CLAUDE.md Lean

Our own CLAUDE.md should follow the paper's recommendation: minimal requirements only.

**Keep:**
- `bun test`, `bun run typecheck`, `bun run build:introspection` — specific tooling commands
- "Never break the type system" — actionable constraints
- "Runtime is bun" — environment facts

**Consider removing:**
- Architecture explanations (discoverable via introspection)
- Design philosophy (belongs in docs/philosophy.md, not agent context)
- Usage patterns (agents find these in code)

### 2. Assistant Documentation Strategy

The assistant system loads markdown docs into contentbase collections. Combined with the SkillsBench findings (concise > comprehensive), this paper reinforces:

- **Structure docs for extraction, not comprehension** — contentbase models with typed sections let agents pull specific data points rather than processing entire documents
- **Don't pre-load everything** — the paper shows more context hurts. Assistants should retrieve docs on-demand based on the task, not inject entire documentation sets upfront
- **Tooling over prose** — give assistants tools to *query* their knowledge base, not a dump of everything they might need

### 3. Complementary to SkillsBench

These two papers tell a coherent story:

| | Context Files (this paper) | Skills (SkillsBench) |
|---|---|---|
| Format | Prose about the codebase | Stepwise procedures for tasks |
| Benefit | ~4% (human), -3% (LLM) | +16.2% (curated) |
| Why | Duplicates discoverable info | Provides novel procedural knowledge |
| Cost | +20% inference tokens | Worth it at 2-3 skills |

**Context files describe what exists. Skills describe what to do.** The former is redundant with good introspection; the latter provides genuine value. This reinforces investing in SkillsLibrary over comprehensive documentation.

### 4. Introspection as Competitive Advantage

If most projects rely on AGENTS.md files that barely help, and Luca makes its entire runtime discoverable without static docs, that's a meaningful differentiation for agent-driven development. The paper essentially argues that the industry's current approach (write more docs for agents) is wrong, and that making systems self-describing (Luca's approach) is more effective.
