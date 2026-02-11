# Communication Topologies

## Overview

CAMEL only supports hub-and-spoke (everything through a coordinator). That's limiting. Different problems call for different coordination patterns. Luca should support multiple topologies as first-class options on a Crew.

## Topology: Coordinated (Hub-and-Spoke)

```
                    ┌─────────────┐
                    │ Coordinator │
                    │   (Crew)    │
                    └──┬───┬───┬──┘
                       │   │   │
              ┌────────┘   │   └────────┐
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │ Expert A │ │ Expert B │ │ Expert C │
        └──────────┘ └──────────┘ └──────────┘
```

**When to use:** Complex tasks requiring decomposition and diverse expertise. The coordinator has oversight of the full picture.

**How it works:**
- Crew's internal Conversation acts as coordinator
- Coordinator decomposes goal into tasks
- Assigns tasks to experts based on capabilities
- Experts report results back to coordinator
- Coordinator synthesizes, reviews, and decides next steps
- Experts don't talk to each other directly

**Turn management:** Coordinator speaks first (decomposition), then experts execute in parallel or sequence based on dependencies. Coordinator gets a turn after each task completion to review and re-plan.

**Termination:** Coordinator decides when the goal is met, or max rounds exceeded.

## Topology: Peer-to-Peer (Flat)

```
        ┌──────────┐     ┌──────────┐
        │ Expert A │◄───►│ Expert B │
        └────┬─────┘     └─────┬────┘
             │                  │
             │   ┌──────────┐  │
             └──►│ Expert C │◄─┘
                 └──────────┘
```

**When to use:** Brainstorming, creative tasks, problems where no single agent should dominate. Good for when expertise is roughly equal and the goal benefits from diverse perspectives.

**How it works:**
- All experts are equals
- Crew manages turn order (round-robin, or priority-based)
- Any expert can propose tasks, challenge another's output, or build on previous work
- Shared task board visible to all
- Experts claim tasks from the pool

**Turn management:** Round-robin by default. An expert can "pass" if it has nothing to add. Consecutive passes by all experts triggers termination check.

**Termination:** Consensus (all experts agree the goal is met), or max rounds, or a designated "judge" expert makes the call.

## Topology: Pipeline (Sequential)

```
        ┌──────────┐     ┌──────────┐     ┌──────────┐
        │ Expert A │────►│ Expert B │────►│ Expert C │
        │ (stage 1)│     │ (stage 2)│     │ (stage 3)│
        └──────────┘     └──────────┘     └──────────┘
```

**When to use:** Linear workflows where each stage transforms or enriches the previous output. Research → Analysis → Writing. Data collection → Processing → Visualization.

**How it works:**
- Experts are ordered in a sequence
- Expert A completes its work, output flows to Expert B as context
- Expert B completes, output flows to Expert C
- No backtracking by default (but can be enabled: Expert B can "reject" A's output, sending it back)

**Turn management:** Strictly sequential. Each expert gets one turn (or multiple turns with itself if it needs to iterate on its own task).

**Termination:** Pipeline completes when the last expert finishes. Or when any stage fails and retries are exhausted.

## Topology: Debate (Adversarial)

```
        ┌──────────┐                ┌──────────┐
        │ Expert A │◄──────────────►│ Expert B │
        │  (Pro)   │   structured   │  (Con)   │
        └──────────┘    argument    └──────────┘
                           │
                    ┌──────▼──────┐
                    │   Judge     │
                    │  (Expert C) │
                    └─────────────┘
```

**When to use:** Decision-making under uncertainty. Evaluating trade-offs. Code review. Risk assessment. Any situation where you want multiple perspectives to clash before reaching a conclusion.

**How it works:**
- Two or more experts argue positions
- Each expert's system prompt includes their assigned position/perspective
- Experts take turns presenting arguments, responding to counterarguments
- A judge expert (or the coordinator) evaluates arguments and renders a decision
- The debate can have multiple rounds with increasing specificity

**Turn management:** Alternating between debaters. Judge speaks after each round or at the end.

**Termination:** Judge makes a decision, max rounds reached, or debaters reach agreement.

## Topology: Swarm (Dynamic)

```
        ┌──────────┐
        │ Expert A │──── spawns ────► ┌──────────┐
        └──────────┘                  │ Expert D │
              │                       └──────────┘
              │
        ┌──────────┐
        │ Expert B │──── spawns ────► ┌──────────┐
        └──────────┘                  │ Expert E │
              │                       └──────────┘
        ┌──────────┐
        │ Expert C │
        └──────────┘
```

**When to use:** Exploration tasks where the scope isn't known upfront. Research where one finding opens multiple new threads. Any situation where the team size should grow or shrink based on the work discovered.

**How it works:**
- Starts with a small set of experts
- Experts can request the Crew to spawn new experts for subtasks
- The Crew dynamically creates new Expert instances via `container.feature('expert', { ... })`
- Spawned experts have system prompts generated from the spawning expert's context + the subtask description
- Experts that complete all their tasks are deactivated (not destroyed — cached by factory)

**Turn management:** Event-driven. Experts work in parallel, communicate results via the Crew's event bus.

**Termination:** Coordinator reviews periodically. All tasks completed. Or resource limits (max agents, max rounds, max tokens).

## Implementing Topology as a Protocol

Each topology is implemented as a combination of:

1. **System prompt templates** — injected into each Expert's identity to set behavioral expectations
2. **Turn manager** — a function on the Crew that decides which Expert(s) get to act next
3. **Message router** — determines which Expert(s) receive each message
4. **Termination checker** — evaluates whether the Crew should stop

```ts
interface Protocol {
  name: string
  // Generate the system prompt addendum for each expert based on their role in this topology
  systemPromptFor(expert: Expert, crew: Crew): string
  // Decide who acts next given current state
  nextTurn(crew: Crew): Expert | Expert[] | null  // null = terminated
  // Route a message from one expert to others
  routeMessage(from: Expert, message: Message, crew: Crew): Expert[]
  // Check if the crew should terminate
  shouldTerminate(crew: Crew): boolean
}
```

Protocols are pluggable. Ship with the five above, but anyone can define custom topologies by implementing the Protocol interface.
