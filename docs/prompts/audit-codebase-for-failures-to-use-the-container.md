---
reusable: true
lastRanAt: 1772162827313
durationMs: 278913
outputTokens: 552
---


# Code Audit

Do an audit of the code in the following folders:

- src/**/features/**
- src/**/clients/**
- src/clients/**
- src/servers/**
- src/commands/**

Ignore the fs, proc, git features in src/node/features.  These are a core abstraction that wraps the underlying ones provided by node or bun, so it is expected they would use child_process, fs, etc.  In general, if the feature you're looking at is intended to be wrapping a core runtime / os primitive, it is probably ok ( that's the point of the feature )

if a completely unrelated feature is using the fs or path module, or Bun unguarded, then that's probably an issue.

Look for instances of the following, but don't fix them yet.

- using file system directly, instead of this.container.fs ( except the file system feature itself )
- using the path module functions instead of this.container.paths.resolve ( with the exception of fileManager, where it is ok )
- reinventing the wheel in general instead of using functionality already provided by the container
- anything that would break compatibility with node.js instead of Bun.  make sure you wrap it in a guard (if this.container.isBun)

Save the results of your audit in docs/reports/code-audit-results.md

If this file already exists, read it first, and note cases where items persist.

The next step will be me reviewing the audit, providing commentary, and advising you what to fix
