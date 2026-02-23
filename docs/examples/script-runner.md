---
title: "Script Runner"
tags: [scriptRunner, npm, scripts, automation]
lastTested: null
lastTestPassed: null
---

# scriptRunner

Run npm scripts defined in package.json as programmatic, camelCased methods.

## Overview

The `scriptRunner` feature is an on-demand feature that reads your project's `package.json` and generates callable methods for every npm script it finds. Script names are converted to camelCase (e.g., `build:dev` becomes `buildDev`), so you can invoke them directly from code instead of shelling out manually. This is useful for automation, CI pipelines, or orchestrating multiple build steps programmatically.

## Feature Documentation

Let us inspect the feature's built-in documentation to see what it provides.

```ts
const desc = container.features.describe('scriptRunner')
console.log(desc)
```

The key insight is the `scripts` getter: it dynamically builds an object whose keys are camelCased versions of the scripts in your package.json.

## Enabling and Inspecting Scripts

When enabled, the feature reads the current project's package.json and exposes each script as a callable function.

```ts
const scriptRunner = container.feature('scriptRunner', { enable: true })
const available = Object.keys(scriptRunner.scripts)
console.log('Available scripts:', available.join(', '))
```

Each entry in the list corresponds to a script defined in your project's package.json. Colons in script names are replaced with underscores before camelCasing, so `build:dev` becomes `build_Dev` or `buildDev`.

## How Script Execution Works

Each method on `scriptRunner.scripts` accepts two optional arguments: an array of additional CLI arguments, and a spawn options object. Under the hood it delegates to the container's process spawning.

```ts
console.log('Script runner state:', JSON.stringify(scriptRunner.state, null, 2))
console.log('Type of scripts getter:', typeof scriptRunner.scripts)
console.log('Is scripts an object:', typeof scriptRunner.scripts === 'object')
```

In a real scenario you would call a script like `await scriptRunner.scripts.test(['--verbose'])` and it would execute `bun run test --verbose` in a child process, returning stdout and stderr.

## Typical Usage Patterns

The scriptRunner is particularly useful when orchestrating multi-step build workflows. Here is pseudocode showing the pattern (not executed since it would run real builds).

```ts
// Typical usage (not executed here to avoid side effects):
//   await scriptRunner.scripts.typecheck()
//   await scriptRunner.scripts.test(['--coverage'])
//   await scriptRunner.scripts.build()
//
// Each call returns { stdout, stderr, exitCode }
console.log('scriptRunner is ready for use with', available.length, 'scripts')
```

## Summary

This demo covered the `scriptRunner` feature, which reads npm scripts from package.json and exposes them as camelCased callable methods. It simplifies programmatic script execution and is well suited for build automation, CI workflows, and multi-step orchestration tasks.
