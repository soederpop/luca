# swift-markdown-engine (vendored)

Source: https://github.com/nodes-app/swift-markdown-engine, tag `0.16.0`.
License: Apache 2.0 (`LICENSE`). Only the core `MarkdownEngine` target is
here. The CodeBlocks and Latex products, the demo, the docs and the upstream
tests are left out.

## Why it is vendored

Upstream closes a fenced code block on the next line that starts with three
backticks. A four-backtick block that holds three-backtick fences then
breaks apart in the rich doc view. CommonMark closes a block only on a
backtick run at least as long as the opening run.

## Changes from upstream

`fence-fix.patch` is the full diff against `0.16.0`. Four files:

- `Parser/BlockParser.swift`: `fenceCloseIndex` compares run lengths
  (`fenceLength`).
- `Parser/BlockLevelTokenizer.swift`: `codeBlock` uses the same rule, and
  the close marker covers the whole run.
- `Parser/MarkdownTokenizer.swift` and `Styling/MarkdownASTStyler.swift`:
  the language starts after the whole opening run, not after three
  characters.

`Tests/MarkdownEngineTests/NestedFenceTests.swift` covers the fix. Run
`swift test` in this folder.

## Updating

Copy the new `Sources/MarkdownEngine` from upstream over this one, apply
`fence-fix.patch`, run the tests here and in `apps/desktop`. Drop this folder and
go back to the package URL when upstream has the fix.
