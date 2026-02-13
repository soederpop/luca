# Experts System

Experts are a combination of a prompt, tool calls, and documentation.

Each folder in here should have the following:

- README.md - for the developer / author
- SYSTEM-PROMPT.md - the core system prompt
- memories.json - modifications to the prompt made at runtime through conversation
- docs/ whatever collection of markdown documents make sense
- skills.ts - the tool calls and zod schemas this expert can make
- hooks.ts - a module of async functions which match the events emitted by the expert and will run in a fire and forget manner when they're called