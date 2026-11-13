# Agent DX code sweep

This sweep focused on public contracts that an agent can reasonably discover and follow, yet still get wrong behavior from. Findings were checked against the current source and CLI, rather than reopening the already-fixed historical API-gap list.

## Fixed: discovery output disagreed with its documentation

`luca describe --json` without a target printed a terminal help screen, although its own help said omitting the target describes the container. An agent bootstrapping its understanding could not parse the promised JSON.

Omitted targets now resolve to `container`, so the normal JSON, Markdown, and TypeScript rendering paths apply. Explicit `luca describe --help` continues to show usage. Regression tests exercise the actual CLI and parse its JSON output.

## Fixed: registry names were inconsistent across operations

Registration stripped the `features.` prefix, but `has()` and `lookup()` searched for the prefix in the opposite direction. For example, `features.has('fs')` returned true while `features.has('features.fs')` returned false. Copying a qualified ID from introspection into registry lookup failed.

There was a second mismatch: `registry.introspect('fs')` looked up the bare key in a globally qualified metadata map and returned undefined. Registration aliases could also lose their metadata. Finally, unrestricted string replacement could remove scope-like text from the middle of a legitimate ID.

Registry operations now consistently remove only their own leading scope prefix. Introspection resolves the registered constructor's metadata, supporting bare IDs, qualified IDs, and aliases. Unknown IDs still return undefined from introspect, while lookup retains its existing diagnostic. The regression tests cover all these forms and confirm that interior text is preserved.

## Fixed: process environment configuration was silently ignored

`spawnAndCapture(command, args, { environment: { LUCA_DX_PROBE: 'present' } })` advertised environment overrides but passed an `environment` property to Node's spawn API, which expects `env`. The child saw the variable as missing. The raw `spawn()` method already did the correct translation, so the two APIs disagreed.

Captured processes now merge the override into the inherited environment, matching raw spawn. Tests verify literal values with spaces, inherited PATH, unchanged parent state, and the `tryExec()` wrapper. This fixes an especially misleading failure mode: configuration can look correct in agent code while the invoked CLI acts as if it was never supplied.

## Fixed: file-tool inputs could damage files or defeat bounded reads

An empty `oldString` with `replaceAll` split the file between characters and inserted the replacement throughout. It was accepted by the tool schema. Empty matches are now rejected at both the schema and direct-call boundaries without modifying the file. Whitespace-only matches remain valid and literal.

`readFile({ limit: 0 })` silently returned the entire file because the implementation tested truthiness. Negative and fractional offsets/limits were also accepted. Both boundaries now require positive integers, with a diagnostic naming the invalid field. Valid ranges still return numbered lines.

`writeFile()` counted UTF-16 code units but reported bytes. Its confirmation now counts UTF-8 bytes; writing `é🙂` correctly reports six bytes.

The read/write/edit methods also lacked useful method descriptions in `luca describe`. Added JSDoc explains range behavior, literal matching, error returns, and replacement semantics; generated introspection and the file-tools API page were updated.

## Evaluation coverage

Suite version 2 adds registry discovery across features, clients, and servers, checking bare IDs, qualified IDs, and missing helpers without constructing them. The process task now checks child environment overrides. There are six tasks and 17 acceptance checks, plus negative controls and focused unit regressions. The changed suite fingerprint intentionally requires a fresh baseline; do not compare these scores with the earlier 13-check suite.

File-tool input cases are covered by deterministic unit tests. The diagnostic harness still runs on the Node surface, so these AGI-specific tools are not presented as measured agent-task coverage. No live-agent improvement claim is made from reference solutions passing.

Validation: the full unit run passed 1,262 tests across 117 files; the expanded reference suite passed all 17 checks; type checking passed. The latest assistant and cache tests were also verified separately after the example assistant changed.

## Next high-value findings

**Endpoint discovery loads modules but does not register them.** A temporary endpoint exporting `path = '/dx-probe'` and a `get` handler produced `{ discovered: [], registered: false }` after `helpers.discover('endpoints', { directory })`. In `src/node/features/helpers.ts`, `discoverEndpoints()` computes the name, then its registration branch contains only a comment. Express mounting creates endpoint instances separately. This needs an explicit registration/loading design that preserves handler schemas and avoids duplicate mounted instances; merely adding a registry name would hide the deeper gap.

**Helper-load failures are mostly console warnings, not structured discovery results.** The feature, command, selector, and endpoint discovery paths catch per-file errors and warn. This lets other modules load, but programmatic callers receive no error collection to distinguish an empty directory from broken modules. An additive `discoveryErrors` result or strict discovery option would make repair loops much clearer while preserving tolerant CLI startup.

**Intent search needs its own relevance corpus.** Current natural-language searches can surface related infrastructure ahead of the simplest capability. The new registry task measures identifier resolution, not semantic relevance. Add fixed intent queries with acceptable helpers/examples and measure recall at a small result limit before adjusting ranking; avoid tuning against a single anecdotal query.
