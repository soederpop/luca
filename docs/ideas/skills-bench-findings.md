# SkillsBench Paper Findings and Implications for Luca

Based on the paper [SkillsBench: Benchmarking How Well Agent Skills Work Across Diverse Tasks](https://arxiv.org/abs/2602.12670) (Feb 2026, 40 authors, 84 tasks, 7,308 trajectories).

## What the Paper Proves

SkillsBench is the first rigorous benchmark of "Agent Skills" — structured procedural knowledge packages (SKILL.md files with instructions, examples, and resources) injected into LLM agent sessions. They tested across 11 domains, 7 frontier models, and 3 agent harnesses (Claude Code, Gemini CLI, Codex CLI).

### The Numbers

- Curated skills improve task completion by **+16.2 percentage points** on average
- **2-3 focused skills** yield the best results (+18.6pp). 4+ skills drop to +5.9pp
- **Concise, stepwise** skills (+18.8pp) beat comprehensive/exhaustive ones (-2.9pp)
- **Self-generated skills are useless** (-1.3pp average). Models can't write their own procedures
- **Claude Code** shows the highest skill utilization and improvement (+23.3pp with Opus 4.5)
- Smaller models with skills can match larger models without: Haiku 4.5 + skills (27.7%) matches Opus 4.5 baseline (22.0%)
- Domain gap matters: Healthcare +51.9pp, Manufacturing +41.9pp, but Software Engineering only +4.5pp
- 16 of 84 tasks showed **negative** impact from skills — bad skills hurt

## What This Validates in Luca

Our `SkillsLibrary` architecture is well-aligned with what works:

- **Contentbase-backed SKILL.md files** — the exact format the paper validates
- **Two-tier storage** (project + user level) — supports curated, human-authored skills
- **Injection as tools and system prompt blocks** — matches the tested injection pattern
- **Deep Claude Code integration** — the harness that benefits most from skills

## What We Should Build

### 1. Smart Skill Selection (High Priority)

The single most impactful finding: 2-3 skills is optimal, more hurts. Right now `toConversationTools()` and `toSystemPromptBlock()` dump everything. We need relevance-based filtering.

Options:
- **Tag-based matching**: Skills declare tags, assistant context selects relevant tags
- **Embedding-based retrieval**: Embed skill descriptions, retrieve top-k by query similarity
- **Domain scoping**: Skills declare which assistants/domains they apply to, auto-filter

The simplest first step: add a `relevantTo` or `domains` field to skill frontmatter, and have `toConversationTools({ domain })` filter by it.

### 2. Auto-Wire Skills into Assistant (Medium Priority)

Skills aren't automatically injected into assistants today — it requires manual wiring. The paper shows skills reliably help, so this should be default behavior.

When an `Assistant` starts, it should:
1. Load `SkillsLibrary`
2. Select the top 2-3 relevant skills (see above)
3. Inject them as tools and/or append to system prompt
4. Optionally allow the assistant folder to declare skill preferences

### 3. Skill Quality Tracking (Medium Priority)

16/84 tasks showed negative impact. We need to know which skills help and which hurt.

- Track when skill tools get called during conversations
- Track conversation outcomes (user satisfaction, task completion)
- Surface usage stats: `skillsLibrary.stats()` showing call counts and success correlation

### 4. Skill Authoring Guidelines (Low Priority, High Value)

Encode the paper's findings into a template or linter:

- **Do**: Concise stepwise instructions, working code examples, focused scope
- **Don't**: Exhaustive documentation, wall-of-text reference material, overly broad scope
- **Ideal length**: Detailed but not comprehensive — think recipe, not textbook
- **Structure**: Problem statement, step-by-step procedure, concrete examples, edge cases

### 5. Model-Tier Aware Skill Loading (Low Priority)

Skills compensate for model capability. When running cheaper models (Haiku), load more/better skills. When running Opus, skills matter less. The `ClaudeCode` feature knows the model — it could adjust skill injection accordingly.

## What We Should NOT Build

- **Auto-skill generation from conversations** — the paper shows this doesn't work (-1.3pp). Don't invest in "learn skills from agent sessions" features.
- **Skill libraries with dozens of skills per session** — diminishing returns after 3. Quality over quantity.
- **Comprehensive reference-style skills** — these perform worse than no skills at all.
