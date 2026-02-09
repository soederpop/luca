# The Self-Surgeon

A self-modifying Expert agent that can inspect its own codebase, write new skills for itself, hot-reload them, and then use those new skills — all in a single session.

## The Demo

User starts a conversation with an Expert that has a basic set of skills. The user says something like "I need you to be able to query Hacker News." The agent:

1. Recognizes it doesn't have that capability
2. Writes a new skill file (a TypeScript function with Zod schema)
3. Saves it to its own `skills.ts`
4. Hot-reloads via the VM + ESBuild pipeline
5. Immediately uses the new skill to fulfill the original request
6. Remembers it has this skill for future sessions via Identity

The user watches the agent literally grow in real time.

## What It Demonstrates

- The Expert system's skill loading and hot-reload capabilities
- VM + ESBuild for runtime code compilation and execution
- Identity for persistent memory across sessions
- FileManager for watching/writing skill files
- The philosophical core of Luca: introspectable, self-extending runtimes
- How an agentic system that understands its own container can bootstrap itself

## Features Used

- `Expert` — the agent itself, with skill registration
- `Conversation` — LLM interaction for reasoning about what to build
- `ClaudeCode` — alternative code generation path
- `FileManager` — watching the skills directory, writing new files
- `VM` — executing dynamically generated code
- `ESBuild` — transforming TypeScript to executable JavaScript at runtime
- `Identity` — remembering newly acquired capabilities across sessions
- `Git` — committing its own changes as a record of evolution
- `FS` — reading/writing skill files

## Key Moments

- The agent explaining what it's about to do before writing code
- The skill file appearing on disk in real time
- The agent calling its own brand-new function seconds after writing it
- Restarting the agent and seeing it still knows what it learned
