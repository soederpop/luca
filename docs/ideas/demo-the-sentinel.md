# The Sentinel

A self-healing development environment that watches your project, runs tests on change, diagnoses failures using git context and code search, and either fixes the problem automatically or explains exactly what went wrong.

## The Demo

Start the Sentinel pointed at your project. You're coding as usual. You introduce a bug (intentionally or not):

1. FileManager detects the change
2. ScriptRunner kicks off the test suite
3. Tests fail
4. The Sentinel diffs your recent changes via Git
5. Searches the codebase with Grep for related code
6. An AI diagnoses the failure: "You renamed `getUserById` to `getUser` in `users.ts` but didn't update the import in `auth.ts` line 42"
7. Either auto-fixes the issue or presents the diagnosis in a beautifully formatted terminal output
8. Re-runs tests to confirm the fix

You never leave your editor.

## What It Demonstrates

- FileManager as a reactive trigger for development workflows
- Git + Grep as context-gathering tools for AI diagnosis
- ScriptRunner for executing project-defined test commands
- The feedback loop: watch → test → diagnose → fix → verify
- How Luca can replace a whole category of CI/CD tooling locally

## Features Used

- `FileManager` — watching source files for changes
- `ScriptRunner` — running test suites from package.json
- `Git` — recent diffs, blame, file history for context
- `Grep` — searching for related code, finding all usages
- `Conversation` or `ClaudeCode` — AI diagnosis and fix generation
- `ChildProcess` — running tests, applying patches
- `UI` — formatted error reports, diff views, success banners
- `FS` — reading/writing fixed files

## Key Moments

- Saving a file and immediately seeing the test run start
- The diagnosis appearing with the exact line numbers and explanation
- An auto-fix being applied and tests going green
- The "all clear" banner after a successful healing cycle
