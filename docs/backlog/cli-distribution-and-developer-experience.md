# CLI Distribution and Developer Experience

Now that `bun build --compile` produces a standalone `luca` binary, we need to design the consumer-facing experience. The binary ships a Layer 1 NodeContainer — users should be able to extend it with their own helpers, registries, and domain-specific logic.

## Open Questions

### 1. Discovery Convention

How does the container find user-defined helpers (features, clients, servers)?

Options:
- **`luca.config.ts`** — explicit config file that registers helpers, sets options
- **Directory convention** — e.g. `helpers/`, `clients/`, `servers/` folders scanned automatically
- **Both** — convention for simple cases, config for advanced wiring
- **Markdown-embedded** — helpers defined inline in `.md` files, extracted and registered by the container

### 2. Project Scaffolding

Does `luca init` exist, or is it zero-config?

Options:
- **Zero-config** — run `luca` in any folder, it just works. Discovers what's there.
- **`luca init`** — creates a minimal folder structure and config
- **Template-based** — `luca init --template restaurant` to scaffold a Layer 2 container

### 3. Helper Distribution

How do users share and consume helpers across projects?

Options:
- **npm packages** — publish helpers as regular packages, import in config
- **Git repos** — reference helpers by git URL, pulled into a local cache
- **Luca-native registry** — markdown+ts bundles that luca knows how to fetch and install
- **Local file references** — like the existing `contentbase` dep, just point at sibling folders

### 4. Multi-Project / Portfolio Organization

Luca encourages a "folder of folders" portfolio structure. How do projects relate?

Options:
- **Independent** — each project folder gets its own container instance, no awareness of siblings
- **Portfolio container** — top-level folder has a parent container that knows about child projects
- **Shared registry** — projects in the same portfolio share a helper registry (helpers authored in one project are available in others)

### 5. Authoring Surface

The primary editor experience is markdown with embedded TypeScript snippets.

Considerations:
- How much of the `rundoc` pattern carries forward vs. evolves?
- Should `.md` files be the canonical way to define helpers (literate programming style)?
- Or are `.md` files for documentation/tutorials and `.ts` files for actual helper code?
- What role does the REPL play — is it the primary dev loop, or a debugging tool?

### 6. Binary Size

The current compiled binary is ~92MB. For distribution:
- Is that acceptable as-is?
- Should we investigate tree-shaking to exclude unused features?
- Could we offer a "slim" build that excludes heavy optional deps (mdx-bundler, esbuild, etc.)?

## Context

- Compile script: `bun run compile` (builds `./luca` from `src/cli/cli.ts`)
- Existing CLI commands: `chat`, `rundoc`
- NodeContainer auto-enables: fs, proc, git, grep, os, networking, ui, vm
- 26 optional features available via `--enable`
- Full runtime introspection of all helpers, state, events, and signatures
