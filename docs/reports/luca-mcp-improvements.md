---
tags:
  - mcp
  - testing
  - scaffolding
---

## Problem

The luca MCP server (`luca sandbox-mcp`) had 5 introspection tools that Claude Code rarely used. When given tasks in luca projects, Claude Code would default to vanilla Node.js patterns — importing `fs`, `path`, installing npm packages — instead of using the container. The MCP wasn't teaching Claude Code *how* to work in the luca ecosystem.

The root cause: tool descriptions were informational but not prescriptive. They described what the tools do, but didn't tell Claude Code *when* to use them or *what workflow to follow*.

## What We Changed

### New MCP Tools

| Tool | Purpose | Why It Matters |
|---|---|---|
| `read_me` | Returns the behavioral contract — import rules, capability map, workflow | Gives Claude Code the "rules of the road" at session start. Verbose description tells it to call this BEFORE writing code. |
| `find_capability` | Returns full catalog of all features/clients/servers with descriptions | Single call that shows everything the container provides. Prevents the "I don't know what's available so I'll use npm" failure mode. |
| `scaffold` | Generates convention-correct boilerplate for any helper type | Eliminates guessing at patterns. Output includes schemas, JSDoc, module augmentation, registration — all the pieces Claude Code would otherwise get wrong. |

### Improved Existing Tools

- **`eval`**: Added "Use this to prototype and test container API calls before writing them into files" to the description
- **`describe_helper`**: Added "This is the API documentation — there is no other documentation available" to make it the authoritative source
- **`inspect_helper_instance`**: Added "Use this to inspect a live, running instance" to distinguish from static docs

### Scaffold System

Created `docs/scaffolds/` with tutorial+template markdown files for each helper type:
- `feature.md`, `client.md`, `server.md`, `command.md`, `endpoint.md`

Each scaffold:
- Explains WHY each section exists (for human learning)
- Uses `{{PascalName}}`, `{{camelName}}`, `{{description}}` template variables
- Includes a "Complete Example" that becomes the scaffold output
- Lists conventions and common mistakes

Build pipeline: `luca build-scaffolds` reads the markdown, extracts code blocks, generates `src/scaffolds/generated.ts`. This is imported by `sandbox-mcp.ts` and baked into the binary.

### z Re-export

Added `export { z } from 'zod'` to `src/node.ts` so consumer code can write `import { z } from '@soederpop/luca'` without needing zod installed.

### CLI Command

`luca scaffold <type> <name>` also available from the terminal, not just the MCP. Supports `--output` to write directly to a file and `--tutorial` to show the full teaching doc.

## Design Principles

1. **Prescriptive over informational** — Tool descriptions tell Claude Code exactly when and why to call each tool, not just what it returns
2. **One call to orient** — `read_me` + `find_capability` in two calls gives a complete picture. No need to explore incrementally.
3. **Correct by construction** — `scaffold` output is valid, convention-following code. The LLM fills in implementation, not boilerplate.
4. **Source of truth in markdown** — Scaffold templates live in `docs/scaffolds/*.md` as human-readable tutorials. The build script extracts code. One source, two consumers.

## Testing Approach

### Test Harness

Located in `playground/mcp-test/`. Simulates a consumer project:
- `.mcp.json` pointing at `luca sandbox-mcp`
- Minimal `CLAUDE.md` saying "this is a luca project, use the MCP"
- No luca source to read — the MCP is the only interface

### Challenges (Progressive Difficulty)

| # | Challenge | What It Tests |
|---|---|---|
| 01 | Build a `greet` command | Basic: Does it use the command pattern? Correct imports? |
| 02 | Build a `stopwatch` feature | Medium: Schemas, state, events, JSDoc, module augmentation |
| 03 | Build a todo REST API with endpoints | Hard: File-based routing, Zod validation, endpoint conventions |
| 04 | Build a REST client + command that uses it | Expert: Client pattern, cross-helper composition |

### Workflow

```
# 1. Run a challenge (Claude Code session in the test folder)
luca run-test --challenge 01-easy-command --clean

# 2. Review the output (separate Claude Code session grades it)  
luca run-test --challenge 01-easy-command --review

# 3. Read the review
cat output/review-01-easy-command.md

# 4. Apply MCP improvements based on findings
# Edit docs/mcp/readme.md, docs/scaffolds/*.md, or tool descriptions

# 5. Rebuild scaffolds
luca build-scaffolds

# 6. Re-run the same challenge to see if improvements helped
luca run-test --challenge 01-easy-command --clean
```

### Grading Criteria

Each review evaluates:
- **Import compliance** — Only `@soederpop/luca` imports, no Node builtins, no npm
- **Pattern compliance** — Correct base class, schemas, static properties, registration
- **Convention compliance** — `.describe()` on Zod fields, JSDoc, naming conventions
- **MCP tool usage** — Did it call `read_me` first? Use `scaffold`? Use `find_capability`?

### Success Criteria

The MCP is "done" when:
1. All four challenges pass import + pattern compliance on the first run
2. Claude Code calls `read_me` and at least one discovery tool before writing code
3. The generated code could be copy-pasted into any luca project and work

## Files Created/Modified

### New files
- `docs/mcp/readme.md` — Behavioral contract
- `docs/scaffolds/{feature,client,server,command,endpoint}.md` — Scaffold templates
- `commands/build-scaffolds.ts` — Build script
- `src/scaffolds/generated.ts` — Generated template data
- `src/scaffolds/template.ts` — Shared template helpers
- `src/commands/scaffold.ts` — CLI scaffold command
- `playground/mcp-test/` — End-to-end test harness

### Modified files
- `src/commands/sandbox-mcp.ts` — Added 3 tools, improved descriptions
- `src/commands/index.ts` — Registered scaffold command
- `src/node.ts` — Added z re-export
- `package.json` — Added build:scaffolds to pipeline
