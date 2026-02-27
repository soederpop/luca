---
reusable: true
---

# Code Audit

Do an audit of the code in the following folders:

- src/**/features/**
- src/**/clients/**
- src/clients/**
- src/servers/**
- src/commands/**

Look for instances of the following, and fix them:

- using file system directly, instead of this.container.fs ( except the file system feature itself )
- using the path module functions instead of this.container.paths.resolve
- reinventing the wheel in general instead of using functionality already provided by the container
- anything that would break compatibility with node.js instead of Bun.  make sure you wrap it in a guard (if this.container.isBun)

Save the results of your audit in docs/reports/code-audit-results.md

If this file already exists, read it first, and note cases where items persist.
