---
title: "Grep Audit Report"
---

# Grep Audit Report

Build `luca audit <path>` that scans a codebase at the given path and finds:

- TODO and FIXME comments
- `console.log` statements
- Hardcoded secret patterns (strings that look like API keys, tokens, passwords in assignments)

Generate a markdown report at `docs/reports/audit-<timestamp>.md` summarizing the findings with file paths and line numbers.

Support `luca audit <path> --json` for machine-readable output instead of markdown.

## After you are done

Write a LESSONS.md in the attempt folder that describes what you learned, what you struggled with, and what you could have been supplied with up front either in the CLAUDE.md or in the skills that come with luca so you could achieve the goal quicker and with less trouble.
