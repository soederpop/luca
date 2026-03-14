# Luca Project

This project uses the Luca framework — Lightweight Universal Conversational Architecture.

## Runtime

The runtime is **bun**. Use `bun run` for scripts, `bun test` for tests.

## The `luca` CLI

The `luca` binary is available in the path. Key commands:

- `luca eval "expression"` — evaluate JS with the container in scope
- `luca describe` — describe the container
- `luca describe fs` — describe a specific feature, client, or server
- `luca describe features` — describe all features
- `luca serve` — start a local server using `endpoints/` folder
- `luca run script.ts` — run a script with the container

## Container Rules

- **NEVER import from `fs`, `path`, or other Node builtins.** Use `container.feature('fs')` for file operations, `container.paths` for path operations.
- The container should provide everything you need. If something is missing, raise the concern rather than pulling in external dependencies.
- Use `container.utils` for common utilities (uuid, lodash helpers, string utils).

## Learning the Framework

1. Read `SKILL.md` for the mental model and discovery patterns
2. Use `luca describe <name>` to learn about any feature, client, or server
3. Browse `references/api-docs/` for full API reference
4. In code, use `container.features.describe('name')` or `helper.introspect()` for runtime docs

## Project Structure

- `commands/` — custom CLI commands, run via `luca <commandName>`
- `endpoints/` — file-based HTTP routes, served via `luca serve`

## Git Strategy

Roll on main. Commit with good messages that explain why, not just what.
