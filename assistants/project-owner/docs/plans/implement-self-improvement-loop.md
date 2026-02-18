---
status: proposed
category: architecture
horizon: short
---

# Implement Self-Improvement Loop (v1)

## Summary

Build a first production loop where the `project-owner` assistant can run one bounded iteration that moves the project forward, produces an evidence-backed next-step recommendation, and writes a creator-facing `HANDOFF.md` for acceptance or rejection.

This plan operationalizes the intent in `assistants/project-owner/docs/ideas/crazy-idea.md` and aligns with the current project state captured in root `HANDOFF.md` (Phase 7, active assistant + planning infrastructure already in place).

## Goals

- Enable one-command execution of a full improvement cycle.
- Ground decisions in an explicit immutable North Star document.
- Require a persuasive, evidence-based “most important next step” argument.
- Generate a deterministic, reviewable handoff artifact for creator approval.
- Make rejection safe and cheap (no hidden side effects).

## Non-Goals (v1)

- Fully autonomous multi-iteration self-triggering loops.
- Automatic merge/deploy without explicit creator approval.
- Cross-repo orchestration.

## Deliverables

- A North Star document consumed as hard constraints during planning.
- A loop runner script/command that executes one iteration.
- A structured decision rubric for ranking candidate next tasks.
- A handoff generator that writes a standardized `HANDOFF.md`.
- A review gate model with explicit outcomes: `approved` or `rejected`.
- Basic telemetry/logging for iteration traceability.

## Files to Create or Update

- `assistants/project-owner/docs/north-star.md` (new)
- `assistants/project-owner/docs/plans/implement-self-improvement-loop.md` (this plan)
- `assistants/project-owner/docs/templates/handoff-template.md` (new)
- `assistants/project-owner/docs/templates/next-step-rubric.md` (new)
- `assistants/project-owner/` runtime entrypoints for running one loop (new/updated as needed)
- Root `HANDOFF.md` generation path (updated behavior)

## Loop Design (Single Iteration)

1. Load constraints:
- Read immutable North Star.
- Read current root `HANDOFF.md`.
- Read approved and proposed plans in `assistants/project-owner/docs/plans`.

2. Build candidate worklist:
- Pull possible tasks from known backlog/docs.
- Normalize to a common schema (scope, impact, risk, effort, dependencies).

3. Rank and select next task:
- Score candidates via rubric (impact, strategic fit, unblock value, implementation risk, verification cost).
- Select top candidate and record why alternatives were not selected.

4. Execute bounded work:
- Run one task loop using existing LUCA scripting/assistant capabilities.
- Enforce limits (time budget, file scope, command safety).

5. Verify and summarize outcomes:
- Gather concrete evidence (tests run, files changed, unresolved risks).
- Capture deltas against previous handoff.

6. Generate `HANDOFF.md`:
- Include project snapshot, what changed, rationale for next most important task, rejection implications, and rollback notes.
- Mark recommendation confidence and assumptions.

7. Stop and await creator decision:
- No automatic continuation.
- Explicitly record `approved`/`rejected` on review.

## Handoff Contract

The generated root `HANDOFF.md` must include:

- Current date and iteration id.
- Objective attempted and completion status.
- Evidence section (commands, tests, outputs summarized).
- “Most important next step” with ranked alternatives.
- “Why now” argument tied to North Star.
- Risks, unknowns, and cost of rejection.
- Exact files touched and validation results.

## Review Gate Behavior

- `approved`:
- Promote selected next step into a concrete plan doc or execution task.
- Carry forward only validated facts.

- `rejected`:
- Archive iteration reasoning.
- Do not auto-apply follow-up changes.
- Next loop must include a short “what was learned from rejection” section.

## Implementation Phases

### Phase 1: Decision Foundations

- Create `north-star.md` and rubric template.
- Define handoff schema/template.
- Add validation checks ensuring all required sections exist.

### Phase 2: Loop Runner (Bounded)

- Implement single-iteration runner entrypoint.
- Wire context loading, candidate scoring, task selection, and execution boundaries.
- Write structured iteration logs.

### Phase 3: Handoff Generation + Gate

- Generate root `HANDOFF.md` from template + runtime evidence.
- Add review outcome recording (`approved`/`rejected`).
- Add rejection feedback incorporation rules.

### Phase 4: Hardening

- Add tests for rubric scoring, template completeness, and gate transitions.
- Dry-run on 2-3 realistic tasks from existing backlog.
- Tune rubric weights with creator feedback.

## Validation Plan

- `bun run typecheck` passes.
- `bun test` passes for new loop/gate behavior.
- At least one dry-run iteration produces a complete `HANDOFF.md` with all required sections.
- Rejection path tested: second run reflects prior rejection learning.
- Generated recommendation references concrete repo evidence, not generic claims.

## Risks and Mitigations

- Overconfident task selection:
- Mitigation: force ranked alternatives + confidence + assumptions.

- Handoff quality drift:
- Mitigation: template + section validator + test coverage.

- Excessive autonomy:
- Mitigation: explicit stop-after-one-iteration and creator gate.

## Exit Criteria

- A creator can run one loop command and receive a reviewable `HANDOFF.md` that is persuasive, evidence-backed, and safely rejectable.
- The next step recommendation is reproducible from stored context and rubric scoring.

## References

- `assistants/project-owner/docs/ideas/crazy-idea.md`
- `HANDOFF.md`
