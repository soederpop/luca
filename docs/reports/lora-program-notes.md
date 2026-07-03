---
tags: [lora, training-data, evaluation, strategy]
---

# LoRA Program Notes

Working notes on training a LoRA (target: a small open model, e.g. qwen3.6) that, with the luca skill + runtime introspection, can be *trusted* to build on the framework. These are notes to argue with, not a plan of record — the next conversation is about which assumptions here are wrong.

## The thesis in one line

**The verifier we built for docs is the verifier that makes a LoRA trainable and trustable.** Runnable examples + challenges turn "is this correct?" into a green/red bit; that same bit gates training data (reject-sample on it) and defines trust (held-out pass rate). Everything below hangs off that.

## Division of labor — the load-bearing decision

Three places to put framework knowledge; put each thing in exactly one:

| Layer | Holds | Why | Volatility |
|---|---|---|---|
| **Weights (LoRA)** | reflexes + grammar: describe-before-guess, `container.feature` not `import fs`, fresh-container-per-invocation, no scheduler feature → `setTimeout` recursion, rest returns-not-throws, choose sqlite-vs-diskCache | expensive to re-establish every turn; generalizes; a small model won't hold it in-context | low — safe to bake |
| **Skill (in-context)** | the pointer to introspection, the Common Patterns recipes, the volatile specifics too new to bake | cheap to edit, ships per-release | medium |
| **Introspection (runtime)** | exact signatures, current helper list, option shapes | *changes every release* | high — **never bake** |

**The rule that prevents rot:** never train into weights anything `describe` can answer at runtime. We just fixed 10 bugs; a LoRA trained on pre-fix transcripts would have memorized the *workarounds* (manual ipcSocket correlation, `server.start({port})`) and be wrong today. Train the **reflex to consult introspection** and the **grammar to use what it returns** — not the contents. The coverage map's `weights/runtime` column is exactly this call, made per idiom.

## What the artifacts feed

- **`example-coverage-map.md` → the sampling distribution.** Generate training trajectories weighted to cover Axes 1–2 evenly, not clustered on the 46 apps we happen to have. Breadth in the training distribution = generalization at inference. This is the concrete answer to "don't let it overfit to the examples we thought of."
- **`intent-expression-gaps.md` → the curriculum.** The `train`-tagged stalls (no scheduler idiom, daemon lifecycle, store-choice heuristic, rest error handling, diskCache TTL, meta-discovery) are precisely the framework-shaped reflexes a capable base model lacks. The `runtime`-tagged ones are docs/tooling fixes — *not* training targets. The `gap`-tagged ones are framework tickets.
- **Challenges → the held-out trust metric.** Disjoint from training by construction; pass rate + introspection-usage + zero-hallucinated-APIs on these = the trust number.

## The data pipeline (reject-sampling first, RL only if needed)

1. **Sample tasks** from the coverage/curriculum distribution (not hand-picked apps).
2. **Generate N trajectories** per task with a strong teacher model + the skill + live introspection.
3. **Verify** each against the *current* framework — runnable example harness / challenge-style execution. Keep only trajectories that actually run green.
4. **Filter for idiom density** — prefer trajectories that use `describe`/`eval`, container features, and the blessed patterns; drop ones that reach for node builtins or hallucinate (the verifier already kills the wrong ones; this biases toward *how* we want it solved).
5. **Distill to (task → verified trajectory)** training pairs. The trajectory should show the reflex: describe → eval → implement → verify.
6. **Train the LoRA**, then measure on held-out challenges. Gap analysis → new tasks → retrain. The verifier keeps every loop honest — the model cannot learn to sound right instead of be right.

Reject-sampling (SFT on verified-good trajectories) is the cheap first pass and probably sufficient. RL/preference methods only if SFT plateaus below the trust bar.

## Why this matters more for qwen3.6 than for our Sonnet evals

Our rounds used Sonnet, which *already had* strong describe/eval discipline in-context — which is why the failures were framework bugs, not behavior. A small model likely won't hold that discipline across a long skill in a small context window; it drifts. **The LoRA's core job is to install into qwen's weights the discipline Sonnet already had** — so task success doesn't depend on a 300-line skill surviving the context. Once the reflexes live in weights, the skill can *shrink* to volatile specifics, which suits a small context budget anyway. Corollary: re-run the whole eval harness with qwen+LoRA — the instrumentation (describe/eval counts, error rate, held-out pass) is already the trust dashboard.

## Defining "trust" concretely (so it's a number, not a vibe)

On held-out challenges the qwen+LoRA+skill+introspection stack should hit: pass rate ≥ target; consults `describe`/`eval` before calling unfamiliar APIs (measurable via the existing jq instrumentation); zero hallucinated helper/method names; leaves no orphaned processes; produces code that runs. Trust = these hold on tasks with *low* similarity to any training example (the similarity guard is what stops us fooling ourselves).

## Risks to design against (ranked)

1. **Leakage.** A challenge in training data stops measuring trust. Hard train/eval split, enforced by example↔challenge↔training similarity checks. This is the #1 way to ship a LoRA that looks great and isn't.
2. **Staleness.** Re-verify every trajectory against the current framework immediately before training. Fixed-but-now-wrong data teaches the workaround. (We have concrete proof this happens — 10 bugs’ worth.)
3. **Baking signatures.** If eval loss rewards reproducing exact method lists, the LoRA memorizes a snapshot. Reward the *reflex and shape*, keep specifics in introspection.
4. **Distribution skew.** Sample from the coverage map, not our imagination — else the LoRA is great at the six things we thought of and lost otherwise.
5. **Trajectory quality vs. correctness.** The verifier guarantees *correct*, not *idiomatic*. Add the idiom-density filter or the LoRA learns ugly-but-passing patterns.

## Open assumptions I'm least sure about (bring to the discussion)

- That **SFT-by-rejection-sampling** is enough and we don't need RL.
- That the framework is **stable enough** to be worth baking reflexes now vs. waiting (it's changing fast — we shipped fixes this week).
- That a **skill + introspection at runtime** will remain available in the deployment target — if qwen+LoRA runs somewhere without the `luca` binary/skill, the "consult introspection" reflex has nothing to consult, and the division-of-labor collapses. This is the biggest architectural dependency.
- That **describe/eval usage is trainable as a reflex** in a small model at all, vs. needing it enforced by the harness/scaffold around the model.
- That challenge pass-rate is a **faithful proxy for trust** on the long tail of real tasks (n is small; challenges are our imagination too).
