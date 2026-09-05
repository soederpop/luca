# Luca Project

This project uses Luca: a container for business logic, named helpers, observable state, and events. Keep UI and command handlers as thin adapters over that container.

## Runtime and project rules

Use Bun: `bun run` for scripts and `bun test` for tests. The compiled `luca` CLI loads project TypeScript through its VM and supplies the container and bundled modules. Running the same file directly with Bun can have different module resolution and globals.

Use container capabilities rather than importing Node builtins or utility packages: `container.feature('fs')`, `container.feature('proc')`, `container.paths`, and `container.utils`. If a needed capability is missing, raise it before adding a dependency. Use `paths.resolve()` for absolute bases; `paths.join()` prepends the project cwd.

## Learn only what the task needs

Read [.claude/skills/luca-framework/SKILL.md](.claude/skills/luca-framework/SKILL.md) for the execution contract, task-to-example routes, and development workflow. Detailed framework guidance lives there so it can be refreshed without replacing this project's instructions.

- Find a capability: `luca describe --query "what I need to do" --limit 4`.
- Inspect a helper member: `luca describe fs.readFile`.
- Learn command invocation: `luca <command> --help`; list commands with `luca`.
- Try a small composition: `luca eval "expression"` or `luca run script.ts`.
- Before creating a helper, look for an existing composition; then use `luca scaffold <type> --tutorial`.

## Project layout

`commands/` contains CLI actions; `features/`, `clients/`, and `servers/` contain helpers; `selectors/` contains cached queries; `endpoints/` contains HTTP routes mounted by `luca serve`. The CLI discovers these folders before dispatch. Embedded package applications must discover their helpers explicitly.

`assistants/<name>/CORE.md` defines an assistant, with optional tools and hooks. `luca chat <name>` runs it. `docs/` holds content models and documents. `public/` supplies static web assets. `luca.cli.ts` customizes project startup before commands run.

## Completion and maintenance

Verify the requested behavior and relevant error cases with Bun tests or focused runtime checks. Close resources when finite work ends; use the framework shutdown lifecycle for services. Inspect new helper metadata with `luca describe <name>` and command arguments with `--help`.

Each command is a separate process. Persistent state belongs in `container.store(name)`, with locked `update()` for concurrent writes; recomputable caches belong in `diskCache`.

After upgrading Luca, run `luca bootstrap --update-skill` to replace the generated skill and references, and `luca setup --types` to refresh bundled declarations. The skill refresh does not overwrite this file. Keep project-specific conventions here and notes outside the generated skill directory.

## Git strategy

Roll on main. Commit only your changes, with messages explaining why.
