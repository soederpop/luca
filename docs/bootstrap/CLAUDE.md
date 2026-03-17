# Luca Project

This project uses the [Luca framework](https://github.com/soederpop/luca) — Lightweight Universal Conversational Architecture.

For a deep dive into the framework internals, see the [Luca GitHub repository](https://github.com/soederpop/luca).

## Runtime

The runtime is **bun**. Use `bun run` for scripts, `bun test` for tests.

## The `luca` CLI

The `luca` binary is available in the path. Key commands:

- `luca` — list available commands (built-in + project commands)
- `luca eval "expression"` — evaluate JS with the container in scope
- `luca describe` — describe the container
- `luca describe fs` — describe a specific feature, client, or server
- `luca describe features` — describe all features
- `luca serve` — start a local server using `endpoints/` folder
- `luca run script.ts` — run a script with the container
- `luca scaffold <type> <name>` — generate boilerplate for a new helper (run `luca scaffold` for full help)

## Container Rules

- **NEVER import from `fs`, `path`, or other Node builtins.** Use `container.feature('fs')` for file operations, `container.paths` for path operations.
- The container should provide everything you need. If something is missing, raise the concern rather than pulling in external dependencies.
- Use `container.utils` for common utilities (uuid, lodash helpers, string utils).

## Learning the Framework

1. Read `.claude/skills/luca-framework/SKILL.md` for the mental model and discovery patterns
2. Use `luca describe <name>` to learn about any feature, client, or server
3. Browse `.claude/skills/luca-framework/references/api-docs/` for full API reference
4. In code, use `container.features.describe('name')` or `helper.introspect()` for runtime docs
5. For source-level deep dives: [github.com/soederpop/luca](https://github.com/soederpop/luca)

## Project Structure

- `commands/` — custom CLI commands, run via `luca <commandName>` (auto-discovered)
- `endpoints/` — file-based HTTP routes, served via `luca serve` (auto-discovered)
- `features/` — custom container features, discovered via `container.helpers.discoverAll()` (auto-discovered)
- `docs/` — content documents managed by the `contentDb` feature (`container.docs`). See [contentbase](https://github.com/soederpop/contentbase) for the document model system.
- `luca.cli.ts` — optional project-level CLI customization (runs before any command)

## Command Arguments

Command handlers receive `(options, context)`. The `options` object contains:
- **Named flags** from `argsSchema`: `--verbose` → `options.verbose`
- **Positional args** mapped via `positionals` export: `luca cmd ./src` → `options.target`
- **Raw positionals** in `options._`: array where `_[0]` is the command name, `_[1+]` are positional args

To accept positional arguments, export a `positionals` array that maps them to named fields in `argsSchema`:

```ts
export const positionals = ['target']  // luca myCmd ./src => options.target === './src'
export const argsSchema = z.object({
  target: z.string().optional().describe('The target to operate on'),
  verbose: z.boolean().default(false).describe('Enable verbose output'),
})
```

## Extending the Container

Use `luca scaffold` to generate new helpers:

```sh
luca scaffold command myTask --description "Automate something"
luca scaffold feature myCache --description "Custom caching layer"
luca scaffold endpoint users --description "User management API"
```

Run `luca scaffold` with no arguments for full usage and examples.

## Git Strategy

Roll on main. Commit with good messages that explain why, not just what.
