# The Hydra

Multiple Expert agents, each with different specializations, communicating over unix sockets to collaboratively solve problems that no single expert could handle alone.

## The Demo

Spin up three experts:

1. **Codebase Expert** — knows the project structure, can read/write code, understands architecture
2. **DevOps Expert** — knows Docker, deployment, infrastructure, CI/CD
3. **Domain Expert** — knows the business rules, data models, user stories

A coordinator process routes a complex request like "Add a new payment method to the checkout flow" across all three. The codebase expert identifies where changes are needed, the domain expert validates the business rules, and the devops expert ensures the deployment pipeline handles the migration.

You watch them negotiate in real time in a split terminal view.

## What It Demonstrates

- IPC as a lightweight coordination layer between processes
- The Expert system's ability to specialize via skills and identity
- How multiple containers can collaborate without a central orchestrator
- The REPL-driven development style: you can jump into any expert's process and interact

## Features Used

- `Expert` — multiple instances with different SYSTEM-PROMPTs, skills, and memories
- `IpcSocket` — unix socket communication between expert processes
- `Identity` — each expert has persistent specialized knowledge
- `Conversation` — each expert has its own LLM context
- `ChildProcess` — spawning expert processes from the coordinator
- `UI` — terminal rendering of the multi-agent conversation with color-coded speakers

## Key Moments

- Watching experts disagree and resolve conflicts
- An expert asking another expert a clarifying question over IPC
- The coordinator synthesizing a final answer from all three perspectives
- Killing one expert and watching the others adapt
